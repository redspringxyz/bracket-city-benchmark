import { mkdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'path';

// ---------- config ----------
const baseUrl = 'https://8huadblp0h.execute-api.us-east-2.amazonaws.com/puzzles/';
const startDate = new Date('2025-01-01');
const today = new Date();
today.setHours(23, 59, 59, 999); // Set to end of today to ensure inclusion
const outDir = 'solutions';
// -----------------------------

// make sure `solutions/` is a directory
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
} else if (!statSync(outDir).isDirectory()) {
  throw new Error(`"${outDir}" exists but is not a directory – please remove/rename it.`);
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function fetchDay(date: Date) {
  const stamp = fmt(date);
  const outPath = join(outDir, `${stamp}.json`);

  const outFile = Bun.file(outPath);
  if (await outFile.exists()) {
    console.log(`Skip ${stamp}: already saved`);
    return;
  }

  try {
    const res = await fetch(baseUrl + stamp);
    if (!res.ok) {
      console.warn(`Skip ${stamp}: HTTP ${res.status}`);
      return;
    }
    const solution = await res.json();
    const text = JSON.stringify(solution, null, 2);
    await Bun.write(outPath, text);
    console.log(`Saved ${stamp}`);
  } catch (err) {
    console.error(`Error ${stamp}:`, err);
  }
}

// inclusive walk: 2025‑01‑01 → today
for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
  await fetchDay(new Date(d));
}
