/**
 * Capture Bracket‑City puzzle screenshots to ./puzzles
 *   bun capture-puzzles.ts
 */
import { existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

/* ---------- Config ---------- */
const baseUrl = "https://www.theatlantic.com/games/bracket-city/?date=";
const startDate = new Date("2025-01-01"); // inclusive
const endDate = new Date(); // inclusive → today
endDate.setHours(23, 59, 59, 999);
const outDir = "puzzles";
/* ---------------------------- */

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
else if (!statSync(outDir).isDirectory())
  throw new Error(`"${outDir}" exists but is not a directory.`);

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const pathFor = (d: Date) => join(outDir, `${fmt(d)}.png`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateStr = fmt(d);
  const pngPath = pathFor(d);

  if (existsSync(pngPath)) {
    console.log(`Skip ${dateStr}: already captured`);
    continue;
  }

  const page = await context.newPage();
  try {
    console.log(`Processing ${dateStr} …`);
    await page.goto(baseUrl + dateStr, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    /* ----------- Page cleanup ----------- */
    // 1. Wait (≤5 s) for #announcement-overlay, then remove it if found
    await page
      .waitForSelector("#announcement-overlay", {
        state: "attached",
        timeout: 5_000,
      })
      .then(async (h) => h.evaluate((el) => el.remove()))
      .catch(() => {
        /* overlay never appeared */
      });

    // 2. Remove all <nav> elements and expand the puzzle
    await page.evaluate(() => {
      document.querySelectorAll("nav").forEach((el) => el.remove());

      const puzzle = document.querySelector(
        ".puzzle-display",
      ) as HTMLElement | null;
      if (puzzle) puzzle.style.maxHeight = "100%";
    });
    /* ------------------------------------ */

    // Wait for puzzle element (guaranteed to exist at this point)
    const puzzleHandle = await page.waitForSelector(".puzzle-display", {
      timeout: 15_000,
    });

    // Screenshot that element
    await puzzleHandle!.screenshot({ path: pngPath });
    console.log(`Saved → ${pngPath}`);
  } catch (err) {
    console.warn(`Failed ${dateStr}:`, err);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log("Done.");
