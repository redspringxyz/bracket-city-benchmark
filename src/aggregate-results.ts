import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { stringify } from "csv-stringify/sync";

interface AgentResult {
  model: {
    name: string;
  };
  result: {
    success: boolean;
    score: number;
    stats: {
      completionPercentage: number;
    };
  };
}

interface ModelStats {
  model: string;
  totalPuzzles: number;
  averageScore: number;
  averageCompletionPercentage: number;
  successRate: number;
}

async function aggregateAgentResults() {
  const resultsDir = join(process.cwd(), "results");
  const files = await readdir(resultsDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const modelStatsMap = new Map<
    string,
    {
      scores: number[];
      completions: number[];
      successes: boolean[];
    }
  >();

  // Process each JSON file
  for (const file of jsonFiles) {
    const filePath = join(resultsDir, file);
    const content = await readFile(filePath, "utf-8");
    const data: AgentResult = JSON.parse(content);

    const modelName = data.model.name;

    if (!modelStatsMap.has(modelName)) {
      modelStatsMap.set(modelName, {
        scores: [],
        completions: [],
        successes: [],
      });
    }

    const stats = modelStatsMap.get(modelName)!;
    stats.scores.push(data.result.score);
    stats.completions.push(data.result.stats.completionPercentage);
    stats.successes.push(data.result.success);
  }

  // Calculate averages
  const results: ModelStats[] = [];

  for (const [model, stats] of modelStatsMap.entries()) {
    const averageScore =
      stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
    const averageCompletionPercentage =
      stats.completions.reduce((a, b) => a + b, 0) / stats.completions.length;
    const averageSuccess =
      stats.successes.filter((s) => s).length / stats.successes.length;

    results.push({
      model,
      totalPuzzles: stats.scores.length,
      averageScore: Math.round(averageScore * 100) / 100,
      averageCompletionPercentage:
        Math.round(averageCompletionPercentage * 100) / 100,
      successRate: Math.round(averageSuccess * 100),
    });
  }

  // Sort by average score descending
  results.sort((a, b) => b.averageScore - a.averageScore);

  // Write to CSV
  const csv = stringify(results, {
    header: true,
    columns: [
      { key: "model", header: "Model" },
      { key: "totalPuzzles", header: "Total Puzzles" },
      { key: "averageScore", header: "Average Score" },
      { key: "averageCompletionPercentage", header: "Average Completion %" },
      { key: "successRate", header: "Average Success Rate" },
    ],
  });

  await Bun.write("results-summary.csv", csv);

  console.log("Agent results aggregated successfully!");
  console.log("\nResults summary:");
  console.table(results);
}

// Run the aggregation
aggregateAgentResults().catch(console.error);
