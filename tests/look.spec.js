// Quick pictures of any spots in the house (`npm run look`), for checking
// how something looks. Which spots: SHOTS="name:x:y;name:x:y" (y can use
// YARD, ALLEY, BUSINESS...), e.g. SHOTS="yard:8:YARD + 1". Daylight, clear
// skies; DUSK=1 for evening, SOLIDS=1 to outline what you bump into. Pictures land in tests/looks/ (not committed).
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { enterHouse } from "./helpers.js";

test("pictures of chosen spots", async ({ page }) => {
  const out = new URL("./looks/", import.meta.url);
  mkdirSync(out, { recursive: true });
  await enterHouse(page);
  await page.evaluate(async (dusk) => {
    const w = await import("./weather.js");
    w.previewSky("clear");
    w.previewTime(dusk ? "dusk" : "day");
  }, !!process.env.DUSK);
  if (process.env.EVAL) await page.evaluate(process.env.EVAL); // (EVAL="...": set something up first)
  if (process.env.SOLIDS) await page.evaluate("DEBUG_OVERLAYS.solids = true"); // (SOLIDS=1: what you bump into, in red)
  const shots = (process.env.SHOTS || "hallway:12:1.4").split(";").map((s) => s.split(":"));
  for (const [name, x, y] of shots) {
    await page.evaluate(`window.porchlightTest.go(${x}, ${y})`);
    await page.waitForTimeout(Number(process.env.WAIT || 2500));
    await page.locator("#house").screenshot({ path: fileURLToPath(new URL(`${name}.png`, out)) });
  }
});
