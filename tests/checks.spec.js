// The everyday checks (`npm test`, and on GitHub for every change): the
// house loads, you can walk into it, every floor draws without the game
// hitting a problem, and how smoothly each floor draws.
import { test, expect } from "@playwright/test";
import { FLOORS, enterHouse, goTo, whereAmI, frameErrors, seed } from "./helpers.js";

const CONFIG_REWARD = 25; // (Otis's payout: fishing.lessonReward in config.js)

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

// The test account starts with things already in it (seed, helpers.js), so
// these don't have to play the whole game to get there.
test("Porch Swap: put a fish up for trade, then take it back", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { basket: { "fish:bluegill": 2 } });
  await page.evaluate(async () => (await import("./laptop.js")).openLaptop());
  await page.click('#laptop-home .app[data-app="swap"]');
  await page.click(".swap-tabs button:nth-child(3)"); // Put something up
  await page.click(".swap-items .npc-item button");
  await page.fill("#trade-price", "7");
  await page.click("#trade-list");
  await page.click(".swap-tabs button:nth-child(2)"); // Your things
  await expect(page.locator(".swap-items .npc-item")).toHaveCount(1);
  await page.click(".swap-items .npc-item button"); // Take back
  await expect(page.locator(".swap-says")).toHaveText("Back in your basket.");
  const basket = await page.evaluate(async () => (await import("./bank.js")).myWallet().basket);
  expect(basket["fish:bluegill"]).toBe(2);
  expect(problems).toEqual([]);
});

test("Otis: hand him your first fish, he pays you and leaves", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { crumbs: 10, basket: { "fish:bluegill": 1 }, fishing: { lesson: "caught", lessonFish: "bluegill" } });
  await goTo(page, { name: "pond", spot: () => ({ x: 9.7, y: YARD + 5.3 }) });
  await page.waitForTimeout(800);
  await page.keyboard.press("e");
  for (let i = 0; i < 10 && !(await page.locator("#talk-choices button").count()); i++) {
    await page.keyboard.press("e");
    await page.waitForTimeout(300);
  }
  await page.click("#talk-choices button >> nth=0"); // Here you go
  await expect.poll(async () => page.evaluate(async () => (await import("./bank.js")).myWallet().fishing.lesson)).toBe("done");
  const wallet = await page.evaluate(async () => (await import("./bank.js")).myWallet());
  expect(wallet.crumbs).toBe(10 + CONFIG_REWARD);
  expect(wallet.basket["fish:bluegill"] ?? 0).toBe(0);
  expect(await page.evaluate("OTIS.atLake"), "Otis waits until he's said goodbye").toBe(false);
  expect(problems).toEqual([]);
});

test("House extras: a wish at the well, the TV, and the Library shelves", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { crumbs: 10, wishDay: 0 });
  await goTo(page, { name: "yard", spot: () => ({ x: 12.3, y: YARD + 6.75 }) });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await expect.poll(async () => page.evaluate(async () => (await import("./bank.js")).myWallet().wishDay)).toBeGreaterThan(0);
  await goTo(page, { name: "lounge", spot: () => ({ x: 9.4, y: BUSINESS + 6.3 }) });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await expect(page.locator("#extras-panel")).toBeVisible();
  await expect(page.locator(".tv-screen h3")).not.toBeEmpty();
  await page.keyboard.press("Escape");
  await goTo(page, { name: "library", spot: () => ({ x: 1.0, y: -2.6 }) });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await expect(page.locator(".book-row").first()).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await frameErrors(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("Pixel art: paint a canvas in your room and save it", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { crumbs: 100 });
  await page.evaluate(async () => {
    const { bank } = await import("./bank.js");
    await bank("buyDecor", { id: "artCanvas" });
    const home = await import("./home.js");
    home.myHome().placed.push({ item: "artCanvas", x: 2.4, y: 0 });
    home.setPixels(home.myHome().placed.length - 1, "0".repeat(256));
  });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const f = FURNITURE.find((x) => x.kind === "artCanvas" && x.mine);
    (await import("./extras.js")).openPaint(f);
  });
  await page.waitForTimeout(800);
  const grid = page.locator(".paint-grid");
  await page.click(".paint-swatch >> nth=4");
  const box = await grid.boundingBox();
  for (let i = 0; i < 16; i++) await page.mouse.click(box.x + 10 + i * (box.width / 16), box.y + box.height / 2);
  await page.click("#extras-body .warm-button");
  await page.waitForTimeout(1500);
  const pixels = await page.evaluate(async () => (await import("./home.js")).myHome().placed.find((p) => p.item === "artCanvas").pixels);
  expect(pixels.slice(128, 144)).toBe("4".repeat(16));
  expect(problems).toEqual([]);
});
