import { parseArgs } from "util";
import { models, solvePuzzleWithLLM, type PuzzleData } from "./solve-puzzle";
import PQueue from "p-queue";

const dates = [
  "2025-05-14",
  "2025-05-13",
  "2025-05-12",
  "2025-05-11",
  "2025-05-10",
  "2025-05-09",
  "2025-05-08",
  "2025-05-07",
  "2025-05-06",
  "2025-05-05",
  "2025-05-04",
  "2025-05-03",
  "2025-05-02",
  "2025-05-01",
  "2025-04-30",
  "2025-04-29",
  "2025-04-28",
  "2025-04-27",
  "2025-04-26",
  "2025-04-25",
];

const RESULTS_DIR = "results";

async function main({
  filteredModels,
  concurrency = 10,
}: {
  filteredModels?: string[];
  concurrency?: number;
}) {
  const promises = [];
  const queue = new PQueue({ concurrency });

  let modelsToBench = models;
  if (filteredModels && filteredModels.length > 0) {
    modelsToBench = models.filter((model) =>
      filteredModels.includes(model.name),
    );
  }

  for (const date of dates) {
    const puzzle: PuzzleData = await Bun.file(`solutions/${date}.json`).json();

    for (const model of modelsToBench) {
      const filePath = `${RESULTS_DIR}/${model.name}-${puzzle.puzzleDate}.json`;
      const exists = await Bun.file(filePath).exists();

      if (exists) {
        console.log(
          `Skipping ${model.name} for ${puzzle.puzzleDate} (already exists)`,
        );
        continue;
      }

      promises.push(
        queue.add(async () => {
          const start = Date.now();
          try {
            const result = await solvePuzzleWithLLM(puzzle, model);
            const end = Date.now();
            const timeToSolve = (end - start) / 1000;

            const data = {
              timestamp: new Date().toISOString(),
              model: {
                name: model.name,
                provider: model.model.provider,
              },
              puzzle,
              result: {
                ...result,
                timeToSolve,
              },
            };
            await Bun.write(filePath, JSON.stringify(data, null, 2));
          } catch (error) {
            console.error(
              `Error running benchmark for ${model.name} on ${puzzle.puzzleDate}:`,
              error,
            );
          }
        }),
      );
    }
  }
  await Promise.all(promises);
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      model: {
        type: "string",
        multiple: true,
        short: "m",
      },
      concurrency: {
        type: "string",
        default: "10",
        short: "c",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  main({
    filteredModels: values.model,
    concurrency: parseInt(values.concurrency),
  }).catch(console.error);
}
