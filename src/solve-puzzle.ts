import fs from "fs";
import { parseArgs } from "util";
import { generateText, tool } from "ai";
import { z } from "zod";
import { models, type Model } from "./models";

// Types
type GameState = {
  displayState: string;
  solvedExpressions: Set<string>;
  hintedExpressions: Set<string>;
  revealedExpressions: Set<string>;
  activeClues: Clue[];
  totalClues: number;
};

// Scoring system types
type RankThresholds = {
  Tourist: number;
  Commuter: number;
  Resident: number;
  "Council Member": number;
  "Chief of Police": number;
  Mayor: number;
  "Power Broker": number;
  Kingmaker: number;
  "Puppet Master": number;
};

type ScoreConfig = {
  peekPenalty: number;
  megaPeekPenalty: number;
  wrongGuessPenalty: number;
  rankThresholds: RankThresholds;
};

type ScoreDetails = {
  baseScore: number;
  peekPenalty: number;
  megaPeekPenalty: number;
  wrongGuessPenalty: number;
  totalPenalty: number;
  finalScore: number;
  rank: string;
  nextRankName: string | null;
  pointsToNextRank: number;
};

type Clue = {
  start: number;
  end: number;
  text: string;
  expression: string;
};

type Expression = {
  expression: string;
  startIndex: number;
  endIndex: number;
};

type PuzzleData = {
  completionText: string;
  puzzleDate: string;
  completionURL: string;
  solutions: Record<string, string>;
  initialPuzzle: string;
  puzzleSolution: string;
};

// Load the puzzle data
function loadPuzzle(puzzlePath: string): PuzzleData {
  try {
    const data = fs.readFileSync(puzzlePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading puzzle:", error);
    throw error;
  }
}

// Initialize game state with puzzle data
function initializeGameState(puzzleData: PuzzleData): GameState {
  const initialState: GameState = {
    displayState: puzzleData.initialPuzzle,
    solvedExpressions: new Set<string>(),
    hintedExpressions: new Set<string>(),
    revealedExpressions: new Set<string>(),
    activeClues: findActiveClues(puzzleData.initialPuzzle),
    totalClues: Object.keys(puzzleData.solutions).length,
  };

  return initialState;
}

// Find all active clues in the puzzle text
function findActiveClues(puzzleText: string): Clue[] {
  const activeClues: Clue[] = [];

  function findClues(str: string, startOffset = 0) {
    let i = 0;
    while (i < str.length) {
      if (str[i] === "[") {
        const startIndex = i;
        let bracketCount = 1;
        let hasNestedBrackets = false;
        i++;

        let innerContent = "";
        while (i < str.length && bracketCount > 0) {
          if (str[i] === "[") {
            bracketCount++;
            hasNestedBrackets = true;
          } else if (str[i] === "]") {
            bracketCount--;
          }
          innerContent += str[i];
          i++;
        }

        innerContent = innerContent.slice(0, -1);

        if (!hasNestedBrackets) {
          activeClues.push({
            start: startOffset + startIndex,
            end: startOffset + i,
            text: str.substring(startIndex, i),
            expression: innerContent,
          });
        }

        if (hasNestedBrackets) {
          findClues(innerContent, startOffset + startIndex + 1);
        }
      } else {
        i++;
      }
    }
  }

  findClues(puzzleText);
  return activeClues;
}

// Find available expressions that can be solved
function findAvailableExpressions(gameState: GameState): Expression[] {
  const results: Expression[] = [];
  const regex = /\[([^\[\]]+?)\]/g;
  const matchedPositions = new Set<number>();
  let match;

  while ((match = regex.exec(gameState.displayState)) !== null) {
    const startIdx = match.index;
    const endIdx = startIdx + match[0].length;

    if (!matchedPositions.has(startIdx)) {
      matchedPositions.add(startIdx);
      results.push({
        expression: match[1],
        startIndex: startIdx,
        endIndex: endIdx,
      });
    }
  }

  return results;
}

// Scoring functions
function getScoreConfig(): ScoreConfig {
  return {
    peekPenalty: 5,
    megaPeekPenalty: 15,
    wrongGuessPenalty: 2,
    rankThresholds: {
      Tourist: 0,
      Commuter: 11,
      Resident: 21,
      "Council Member": 31,
      "Chief of Police": 51,
      Mayor: 68,
      "Power Broker": 79,
      Kingmaker: 91,
      "Puppet Master": 100,
    },
  };
}

function calculateScore(
  gameState: GameState,
  stats: {
    guesses: number;
    correctGuesses: number;
    hints: number;
    reveals: number;
  },
): ScoreDetails {
  const config = getScoreConfig();

  // Always ensure inputs are numbers and non-negative
  const peekCount = Math.max(0, gameState.hintedExpressions.size);
  const megaPeekCount = Math.max(0, gameState.revealedExpressions.size);
  const wrongGuessCount = Math.max(0, stats.guesses - stats.correctGuesses);

  // Calculate penalties
  const peekPenalty = peekCount * config.peekPenalty;
  const megaPeekPenalty = megaPeekCount * config.megaPeekPenalty;
  const wrongGuessPenalty = wrongGuessCount * config.wrongGuessPenalty;

  // Base score starts at 100
  const baseScore = 100;
  const totalPenalty = peekPenalty + megaPeekPenalty + wrongGuessPenalty;

  // Calculate final score (capped at 100)
  const finalScore = Math.min(100, Math.max(0, baseScore - totalPenalty));

  // Calculate rank
  const rank = calculateRank(
    finalScore,
    peekCount,
    megaPeekCount,
    wrongGuessCount,
  );

  // Calculate points needed for next rank
  const ranks = Object.entries(config.rankThresholds).sort(
    (a, b) => a[1] - b[1],
  ); // Sort ascending
  const currentRankIndex = ranks.findIndex(([r]) => r === rank);
  const nextRank =
    currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null;
  const pointsToNextRank = nextRank ? Math.max(0, nextRank[1] - finalScore) : 0;

  return {
    baseScore,
    peekPenalty,
    megaPeekPenalty,
    wrongGuessPenalty,
    totalPenalty,
    finalScore,
    rank,
    nextRankName: nextRank ? nextRank[0] : null,
    pointsToNextRank: Math.ceil(pointsToNextRank), // Round up for user-friendly display
  };
}

function calculateRank(
  finalScore: number,
  peekCount: number,
  megaPeekCount: number,
  wrongGuessCount: number,
): string {
  const config = getScoreConfig();

  // Puppet Master: 100% score AND no peeks/reveals/wrong guesses
  const isPerfect = finalScore === 100;
  const isNoHelp =
    peekCount === 0 && megaPeekCount === 0 && wrongGuessCount === 0;

  if (isPerfect && isNoHelp) {
    return "Puppet Master";
  }

  // For all other cases, follow normal threshold logic
  const ranks = Object.entries(config.rankThresholds).sort(
    (a, b) => b[1] - a[1],
  );

  // Find highest rank threshold that score exceeds
  const rank = ranks.find(([_, threshold]) => finalScore >= threshold);
  return rank ? rank[0] : "Tourist";
}

/**
 * Make a guess for a specific clue
 */
function makeGuess(
  expression: string,
  guess: string,
  gameState: GameState,
  puzzleData: PuzzleData,
): {
  success: boolean;
  message: string;
  gameState: GameState;
} {
  // Get all available expressions
  const availableExpressions = findAvailableExpressions(gameState);

  // Try to find matching solution for any available expression
  for (const expr of availableExpressions) {
    const currentExpression = expr.expression;
    const solution = puzzleData.solutions[currentExpression];

    if (
      solution &&
      guess.toLowerCase().trim() === solution.toLowerCase().trim()
    ) {
      // Found a match - update the game state with the solved clue
      const newDisplayState =
        gameState.displayState.slice(0, expr.startIndex) +
        solution +
        gameState.displayState.slice(expr.endIndex);

      // Create updated game state
      const updatedGameState: GameState = {
        ...gameState,
        displayState: newDisplayState,
        solvedExpressions: new Set([
          ...gameState.solvedExpressions,
          currentExpression,
        ]),
        activeClues: findActiveClues(newDisplayState),
      };

      return {
        success: true,
        message: `Correct! "${currentExpression}" = "${solution}"`,
        gameState: updatedGameState,
      };
    }
  }

  // If we get here, no match was found - check if the input expression has a solution
  const targetExpression = availableExpressions.find(
    (e) => e.expression === expression,
  );

  if (targetExpression) {
    const solution = puzzleData.solutions[expression];
    if (solution) {
      return {
        success: false,
        message: `Incorrect guess "${guess}" for "${expression}".`,
        gameState,
      };
    }
  }

  // No solution found or expression not available
  return {
    success: false,
    message: `No active bracketed clue found for "${expression}".`,
    gameState,
  };
}

/**
 * Get a hint (first letter) for a specific clue
 */
function getHint(
  expression: string,
  gameState: GameState,
  puzzleData: PuzzleData,
): {
  success: boolean;
  hint?: string;
  message: string;
  gameState: GameState;
} {
  // Verify that this is an active expression
  const availableExpressions = findAvailableExpressions(gameState);
  const targetExpression = availableExpressions.find(
    (e) => e.expression === expression,
  );

  if (!targetExpression) {
    return {
      success: false,
      message: `No active bracketed clue found for "${expression}".`,
      gameState,
    };
  }

  // Get the solution and the first letter as hint
  const solution = puzzleData.solutions[expression];
  if (!solution) {
    return {
      success: false,
      message: `No solution found for clue "${expression}".`,
      gameState,
    };
  }

  const firstLetter = solution.charAt(0);

  // Create updated game state with hint tracking
  const updatedGameState: GameState = {
    ...gameState,
    hintedExpressions: new Set([...gameState.hintedExpressions, expression]),
  };

  return {
    success: true,
    hint: firstLetter,
    message: `Hint for "${expression}": The answer begins with "${firstLetter}".`,
    gameState: updatedGameState,
  };
}

/**
 * Reveal the answer for a specific clue
 */
function revealClue(
  expression: string,
  gameState: GameState,
  puzzleData: PuzzleData,
): {
  success: boolean;
  solution?: string;
  message: string;
  gameState: GameState;
} {
  // Verify that this is an active expression
  const availableExpressions = findAvailableExpressions(gameState);
  const targetExpression = availableExpressions.find(
    (e) => e.expression === expression,
  );

  if (!targetExpression) {
    return {
      success: false,
      message: `No active bracketed clue found for "${expression}".`,
      gameState,
    };
  }

  // Get the solution
  const solution = puzzleData.solutions[expression];
  if (!solution) {
    return {
      success: false,
      message: `No solution found for clue "${expression}".`,
      gameState,
    };
  }

  // Update the game state to reveal the answer
  const newDisplayState =
    gameState.displayState.slice(0, targetExpression.startIndex) +
    solution +
    gameState.displayState.slice(targetExpression.endIndex);

  // Create updated game state
  const updatedGameState: GameState = {
    ...gameState,
    displayState: newDisplayState,
    solvedExpressions: new Set([...gameState.solvedExpressions, expression]),
    revealedExpressions: new Set([
      ...gameState.revealedExpressions,
      expression,
    ]),
    activeClues: findActiveClues(newDisplayState),
  };

  return {
    success: true,
    solution,
    message: `Revealed answer for "${expression}": "${solution}"`,
    gameState: updatedGameState,
  };
}

/**
 * Use LLM with tool calling to solve the puzzle
 */
// Define a type for tracking guesses
type GuessAttempt = {
  expression: string;
  guess: string;
  success: boolean;
  timestamp: number;
};

async function solvePuzzleWithLLM(
  puzzleData: PuzzleData,
  model: Model,
): Promise<{
  success: boolean;
  stats: {
    guesses: number;
    correctGuesses: number;
    totalClues: number; // Total clues in the puzzle
    hints: number;
    reveals: number;
    stepsTaken: number; // Total steps taken by the model
    completionPercentage: number; // Percentage of clues successfully solved
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  score: number;
  rank: string;
  scoreDetails: ScoreDetails;
  modelGuesses: GuessAttempt[]; // Track all guesses made by the model
  finalText: string;
}> {
  // Initialize game state
  let gameState = initializeGameState(puzzleData);

  // Initialize statistics
  const stats = {
    guesses: 0,
    correctGuesses: 0,
    totalClues: Object.keys(puzzleData.solutions).length,
    hints: 0,
    reveals: 0,
    stepsTaken: 0,
    completionPercentage: 0,
  };

  const usage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Track all guesses made by the model
  const modelGuesses: GuessAttempt[] = [];

  console.log(
    `Starting to solve puzzle (${puzzleData.puzzleDate}) with ${model.name} using tool calling...`,
  );

  // Track completion status
  let completedPuzzle = false;

  // Define the tools using AI SDK tool calling
  const tools = {
    makeGuess: tool({
      description: "Make a guess for a specific bracket clue",
      parameters: z.object({
        clue: z
          .string()
          .describe(
            "The clue text inside brackets []. Do not include the brackets in the input.",
          ),
        guess: z.string().describe("Your guess for the answer to this clue"),
      }),
      execute: async ({ clue, guess }) => {
        stats.guesses++;

        const result = makeGuess(clue, guess, gameState, puzzleData);
        const cluesRemaining = findActiveClues(
          result.gameState.displayState,
        ).length;

        if (process.env.DEBUG) {
          console.log(
            `\nTool called: makeGuess for [${clue}] with guess "${guess}"`,
          );
          console.log(result.message);
        }

        // Record this guess attempt
        modelGuesses.push({
          expression: clue,
          guess,
          success: result.success,
          timestamp: Date.now(),
        });

        // Update game state regardless of success/failure to track failed guesses
        gameState = result.gameState;

        // Update correct guess count if successful
        if (result.success) {
          stats.correctGuesses++;

          // Check if puzzle is complete
          if (cluesRemaining === 0) {
            completedPuzzle = true;
            return "Puzzle completed!";
          }
        }

        return {
          success: result.success,
          message: result.message,
          puzzleState: gameState.displayState,
          // activeClues: gameState.activeClues.map((clue) => clue.expression),
          cluesRemaining,
        };
      },
    }),

    getHint: tool({
      description: "Get a hint (first letter) for a difficult clue",
      parameters: z.object({
        clue: z
          .string()
          .describe(
            "The clue text inside brackets []. Do not include the brackets in the input.",
          ),
      }),
      execute: async ({ clue }) => {
        const result = getHint(clue, gameState, puzzleData);
        const cluesRemaining = findActiveClues(
          result.gameState.displayState,
        ).length;

        if (process.env.DEBUG) {
          console.log(`\nTool called: getHint for [${clue}]`);
          console.log(result.message);
        }

        // Update game state
        if (result.success) {
          stats.hints++;
          gameState = result.gameState;
        }

        return {
          success: result.success,
          message: result.message,
          puzzleState: gameState.displayState,
          // activeClues: gameState.activeClues.map((clue) => clue.expression),
          cluesRemaining,
        };
      },
    }),

    revealClue: tool({
      description:
        "Reveal the full answer for an expression/clue (only as a last resort)",
      parameters: z.object({
        clue: z
          .string()
          .describe(
            "The clue text inside brackets []. Do not include the brackets in the input.",
          ),
      }),
      execute: async ({ clue }) => {
        const result = revealClue(clue, gameState, puzzleData);
        const cluesRemaining = findActiveClues(
          result.gameState.displayState,
        ).length;

        if (process.env.DEBUG) {
          console.log(`\nTool called: revealClue for [${clue}]`);
          console.log(result.message);
        }

        // Update game state
        if (result.success) {
          stats.reveals++;
          gameState = result.gameState;

          // Check if puzzle is complete
          if (cluesRemaining === 0) {
            completedPuzzle = true;
          }
        }

        return {
          success: result.success,
          message: result.message,
          puzzleState: gameState.displayState,
          // activeClues: gameState.activeClues.map((clue) => clue.expression),
          cluesRemaining,
        };
      },
    }),
  };

  // Get current available clues
  // Prepare initial state information for the LLM
  const system = `
You are solving a "Bracket City" word puzzle. In this puzzle:
1. A word or phrase inside brackets [...] is a clue; replace it with the missing word.
2. Always resolve the *innermost* brackets first, working outward.
3. When no brackets remain, the text forms one coherent sentence.

You have three tools to help you solve this puzzle:
- makeGuess: Lets you guess an answer for a specific clue
- getHint: Gives you the first letter of the answer for a difficult clue
- revealClue: Reveals the full answer for a clue (only as a last resort)

Tool‑use rules
• **One tool call per assistant message**.
• You may call a tool **only** on an active **innermost** clue (still bracketed, no nested brackets inside).
• Do **not** call tools on clues that are already solved or not yet innermost.
• Include all characters inside a bracketed clue in your tool call.

Scoring
• Start: **100 pts**
• Each incorrect makeGuess: ‑2 pts
• Each getHint: ‑5 pts
• Each revealClue: ‑15 pts

Your goal: finish with the highest score.

Workflow
1. Read the current puzzle string and locate all innermost clues.
2. In each assistant message, choose **one** innermost clue and call **one** tool.
3. After receiving the tool response, update the puzzle internally and repeat.
4. Continue until every bracket is resolved.
5. When makeGuess returns "Puzzle solved!", send a final assistant message containing **only** the solved sentence—no tool calls, no commentary.
`;

  const prompt = `
Solve the following puzzle:
---
${gameState.displayState}
`;

  let finalText = "";
  try {
    // Use AI SDK's generateText with tools for a single call with multiple steps
    const result = await generateText({
      model: model.model,
      system,
      prompt,
      tools,
      maxSteps: 50, // Allow up to 50 tool calls in a single LLM call
      providerOptions: model.providerOptions,
    });

    finalText = result.text;
    stats.stepsTaken = result.steps.length;
    usage.promptTokens = result.usage.promptTokens;
    usage.completionTokens = result.usage.completionTokens;
    usage.totalTokens = result.usage.totalTokens;

    if (process.env.DEBUG) {
      console.log(`\nLLM's steps taken: ${stats.stepsTaken}`);
      console.log(`Result text: ${result.text}`);
      console.log(`Prompt Tokens: ${result.usage.promptTokens}`);
      console.log(`Completion Tokens: ${result.usage.completionTokens}`);
      console.log(`Total Tokens: ${result.usage.totalTokens}`);
    }

    // Check the final state of the puzzle
    const finalAvailableClues = findAvailableExpressions(gameState);
    completedPuzzle = finalAvailableClues.length === 0;
  } catch (error) {
    if (process.env.DEBUG) {
      console.error("Error during LLM generation:", error);
    }
    throw error;
  }

  // Prepare final result
  // Calculate and log score
  const scoreDetails = calculateScore(gameState, stats);

  // Sort guesses by timestamp
  const sortedGuesses = [...modelGuesses].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  // Calculate completion percentage
  const totalClues = gameState.totalClues;
  const solvedClues = gameState.solvedExpressions.size;
  stats.completionPercentage =
    totalClues > 0 ? (solvedClues / totalClues) * 100 : 0;

  // If puzzle not fully completed, score is 0
  const finalScore = completedPuzzle ? scoreDetails.finalScore : 0;
  const rank = completedPuzzle ? scoreDetails.rank : "Tourist"; // Default to lowest rank if not completed

  return {
    success: completedPuzzle,
    stats,
    usage,
    score: finalScore,
    rank: rank,
    scoreDetails: {
      ...scoreDetails,
      finalScore: finalScore, // Override finalScore in scoreDetails
    },
    modelGuesses: sortedGuesses,
    finalText,
  };
}

// Main function
async function main(modelName?: string, puzzleDate?: string) {
  process.env.DEBUG = process.env.DEBUG || "true";

  // Use provided puzzle date or default
  const puzzlePath = `./solutions/${puzzleDate}.json`;
  const puzzleData = loadPuzzle(puzzlePath);

  console.log(`Loaded puzzle from date: ${puzzleData.puzzleDate}`);
  console.log(`\n${puzzleData.initialPuzzle}\n`);

  // Solve puzzle using LLM with tool calling
  const result = await solvePuzzleWithLLM(
    puzzleData,
    models.find((model) => model.name === modelName) as Model,
  );

  console.log("\n=== Final Results ===");
  console.log(`Status: ${result.success ? "Success" : "Incomplete"}`);
  console.log(`Score: ${result.score}/100 (Rank: ${result.rank})`);
  console.log(`Rank achieved: ${result.rank}`);
  console.log(
    `Completion: ${result.stats.completionPercentage.toFixed(2)}% of clues solved (${result.stats.correctGuesses}/${result.stats.totalClues})`,
  );
  console.log(
    `Total Guesses: ${result.stats.guesses}, Correct Guesses: ${result.stats.correctGuesses}, Hints: ${result.stats.hints}, Reveals: ${result.stats.reveals}`,
  );
}

// Run the program if called directly
if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      model: {
        type: "string",
        default: "claude-4-sonnet-20250514-32k-thinking",
      },
      date: {
        type: "string",
        default: "2025-05-27",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  main(values.model, values.date).catch(console.error);
}

export type { Model, PuzzleData };
export { models, solvePuzzleWithLLM };
