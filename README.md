# Bracket City Benchmark

A benchmark for LLM models based on their ability to solve bracket-based word-substitution puzzles from [Bracket City](https://www.theatlantic.com/games/bracket-city/).

## Getting Started

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Install dependencies:

```bash
bun install
```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure API keys in `.env`:
   ```
   OPENROUTER_API_KEY="your-api-key-here"
   ```

## Available Commands

### Data Collection

```bash
# Fetch puzzle solutions from the Bracket City API
bun run fetch-solutions

# Capture puzzle screenshots
bun run capture-puzzles
```

### Running Benchmarks

```bash
# Run the benchmark script for all models and dates
bun run run-benchmarks

# Run benchmarks for specific models only
bun run run-benchmarks --model claude-4-sonnet-20250514-32k-thinking --model gpt-4o

# Run benchmarks with custom concurrency
bun run run-benchmarks --concurrency 5

# Solve a single puzzle (for testing)
bun run solve-puzzle

# Solve a specific puzzle with a specific model
bun run solve-puzzle --model claude-4-sonnet-20250514-32k-thinking --date 2025-04-25

# Aggregate benchmark results
bun run aggregate-results
```

### Development

```bash
# Format code with Prettier
bun run format
```

## Architecture

The benchmark system consists of:

1. **Data Collection Tools**:
   - `src/fetch-solutions.ts`: Retrieves puzzle solutions from API
   - `src/capture-puzzles.ts`: Creates screenshots of puzzles

2. **Benchmark Engine** (`src/run-benchmarks.ts`):
   - Configures models to test
   - Loads puzzle data
   - Calls LLMs with puzzle inputs
   - Calculates metrics
   - Saves results as JSON

3. **Puzzle Solver** (`src/solve-puzzle.ts`):
   - Core LLM puzzle-solving logic
   - Model configurations and prompts
   - Single puzzle solver for testing

4. **Results Processing**:
   - `src/aggregate-results.ts`: Processes and summarizes benchmark data
   - Stores full results in JSON files in `/results` directory
   - Maintains a summary in `results-summary.csv`

## How It Works

The benchmark loads puzzles from the `solutions/` directory and tests each model's ability to solve bracket-based word substitution puzzles. Each puzzle contains nested brackets with clues that need to be solved from the inside out to reveal the final answer.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Bracket City Benchmark: Visual Guide                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │    Puzzle Loading       │
                    │                         │
                    │ • Load from solutions/  │
                    │ • Parse bracket clues   │
                    │ • Initialize game state │
                    └──────────┬──────────────┘
                               │
                               ▼
┌─────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│   The Tools     │  │      The Prompt         │  │    The Core Loop        │
│                 │  │                         │  │                         │
│ makeGuess       │  │ • System instructions   │  │ 1. Parse puzzle state   │
│ ┌─────────────┐ │  │ • Tool definitions      │  │ 2. Find innermost clues │
│ │ clue: str   │ │  │ • Scoring rules         │  │ 3. Call model with tools│
│ │ guess: str  │ │  │ • Workflow guidance     │  │ 4. Execute tool actions │
│ └─────────────┘ │  │                         │  │ 5. Update game state    │
│                 │  │ Context Management:     │  │ 6. Check completion     │
│ getHint         │  │ • Current puzzle state  │  │ 7. Calculate score      │
│ ┌─────────────┐ │  │ • Active clues list     │  │                         │
│ │ clue: str   │ │  │ • Tool call history     │  └─────────┬───────────────┘
│ └─────────────┘ │  │                         │            │
│                 │  └─────────────────────────┘            │
│ revealClue      │                                         │
│ ┌─────────────┐ │                                         │
│ │ clue: str   │ │                                         ▼
│ └─────────────┘ │                               ┌─────────────────────────┐
│                 │                               │   Result Processing     │
└─────────────────┘                               │                         │
                                                  │ • Success rate          │
                                                  │ • Completion percentage │
                                                  │ • Score calculation     │
                                                  │ • Time to solve         │
                                                  │ • Token usage stats     │
                                                  │ • Export to JSON/CSV    │
                                                  └─────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                          Scoring System                                    │
│                                                                            │
│ • Start: 100 points                                                        │
│ • Each incorrect makeGuess: -2 pts                                         │
│ • Each getHint: -5 pts                                                     │
│ • Each revealClue: -15 pts                                                 │
│ • Perfect score (100) + no help = "Puppet Master" rank                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Models Tested

The benchmark currently supports models from multiple providers including:

- **Anthropic**: Claude models (3.5 Sonnet, 3.7 Sonnet, 4 Opus, 4 Sonnet)
- **OpenAI**: GPT-4o, GPT-4.1, o3, o3-mini, o4-mini
- **Google**: Gemini 2.5 Flash, Gemini 2.5 Pro
- **xAI**: Grok-3 Beta
- **Alibaba**: Qwen3-235B

## Results and Analysis

The benchmark produces:

1. **JSON Files**: Detailed results for each model/puzzle combination in `results/`
2. **CSV File**: Summary data at `results-summary.csv` with metrics including:
   - Success rate
   - Percentage of clues solved correctly
   - Final solution accuracy
   - Format validity
   - Time to solve

## Project Structure

```
bracket-city-bench/
├── src/                    # Source code
│   ├── fetch-solutions.ts  # Fetch puzzle solutions from API
│   ├── capture-puzzles.ts  # Capture puzzle screenshots
│   ├── run-benchmarks.ts   # Main benchmark runner
│   ├── solve-puzzle.ts     # Single puzzle solver
│   └── aggregate-results.ts # Results aggregation
├── puzzles/                # Puzzle screenshot images
├── solutions/              # Puzzle solution JSON files
├── results/                # Benchmark result JSON files
├── results-summary.csv     # Summary of all benchmark results
└── README.md              # This file
```
