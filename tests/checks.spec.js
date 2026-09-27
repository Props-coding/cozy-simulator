// The everyday checks (`npm test`, and on GitHub for every change): the
// house loads, you can walk into it, every floor draws without the game
// hitting a problem, and how smoothly each floor draws.
import { test, expect } from "@playwright/test";
import { FLOORS, enterHouse, goTo, whereAmI, frameErrors } from "./helpers.js";

// Taking longer than this to draw one frame (on average) counts as broken,
// not just slow: about 8 frames a second. (GitHub's test machines have no
// graphics card, so they draw slower than friends' PCs. The real numbers
// are printed in the test report.)
const TOO_SLOW_MS = 125;

test("the house loads and every floor draws without problems", async ({ page }) => {
  const problems = await enterHouse(page);
  const speeds = [];
  for (const floor of FLOORS) {
    await test.step(floor.name, async () => {
      await goTo(page, floor);
      await page.waitForTimeout(1500); // (let it settle and draw)
      const here = await whereAmI(page);
      if (floor.room) expect(here.room, `standing in the right place on the ${floor.name}`).toBe(floor.room);
      // How long each frame takes to draw (the house draws up to 60 frames
      // a second, so about 16 ms or less is smooth), over two seconds.
      await page.evaluate(() => (window.porchlightTest.frameMs.length = 0));
      await page.waitForTimeout(2000);
      const ms = await page.evaluate(() => {
        const list = [...window.porchlightTest.frameMs].sort((a, b) => a - b);
        return { average: list.reduce((a, b) => a + b, 0) / list.length, slowest: list[Math.floor(list.length * 0.95)] };
      });
      speeds.push(`${floor.name}: ${ms.average.toFixed(1)} ms a frame (slowest ${ms.slowest.toFixed(1)})`);
      expect(ms.average, `the ${floor.name} draws a frame in under ${TOO_SLOW_MS} ms`).toBeLessThan(TOO_SLOW_MS);
      expect(await frameErrors(page), `no drawing problems on the ${floor.name}`).toEqual([]);
    });
  }
  test.info().annotations.push({ type: "time to draw a frame", description: speeds.join(", ") });
  console.log("Time to draw a frame:\n  " + speeds.join("\n  "));
  expect(problems, "no errors on the page").toEqual([]);
});
