// Before-and-after pictures (`npm run test:pictures`): a picture of every
// floor, compared with the last approved one in tests/pictures/. It catches
// changes nobody meant to make (moving one thing nudging another, a floor
// drawn darker, something gone missing). Time is frozen and the dice are
// loaded, so the same house draws the same picture every time.
//
// After a change you DID mean to make, look at the new pictures, and if
// they're right, approve them: `npm run test:pictures:update`.
// (Pictures differ a little from one computer to another, fonts mostly, so
// these are compared on Claude's test machine, not on GitHub's.)
import { test, expect } from "@playwright/test";
import { FLOORS, enterHouse, goTo, frameErrors } from "./helpers.js";

// A summer afternoon, in the hometown.
const WHEN = new Date("2026-06-15T13:00:00-05:00");

test("every floor looks the way it did", async ({ page }) => {
  // The same "random" numbers every run (dust, sparkles, who stands where).
  await page.addInitScript(() => {
    let seed = 20260615;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.clock.install({ time: WHEN });
  const problems = await enterHouse(page);
  // Clear skies and daylight, whatever the real weather is.
  await page.evaluate(async () => {
    const weather = await import("./weather.js");
    weather.previewSky("clear");
    weather.previewTime("day");
  });
  // From here on, time only moves when the test says so.
  await page.clock.pauseAt(new Date(WHEN.getTime() + 60_000));
  for (const floor of FLOORS) {
    await test.step(floor.name, async () => {
      await goTo(page, floor);
      await page.clock.runFor(4000); // (the camera glides over, then everything settles)
      await expect(page.locator("#house")).toHaveScreenshot(`${floor.name.replace(/ /g, "-")}.png`, { maxDiffPixels: 150, animations: "disabled" });
    });
  }
  expect(await frameErrors(page)).toEqual([]);
  expect(problems).toEqual([]);
});
