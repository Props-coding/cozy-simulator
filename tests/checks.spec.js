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
  await goTo(page, { name: "lounge", spot: () => ({ x: 9.8, y: BUSINESS + 4.2 }) });
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

test("Night & Mothman: the toolbox, and Mothman in the speech box", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { crumbs: 50, basket: {} });
  await goTo(page, { name: "workshop", spot: () => {
    const box = FURNITURE.find((f) => f.kind === "toolbox");
    return { x: box.x + box.w + 0.15, y: box.y - 0.1 };
  } });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await page.click("#npc-items .npc-item button >> nth=0"); // Buy a lightbulb
  await expect.poll(async () => page.evaluate(async () => (await import("./bank.js")).myWallet().basket["night:lightbulb"] ?? 0)).toBe(1);
  await page.keyboard.press("Escape");
  // Out in the corridor, Mothman comes to sit right beside you (as on a
  // lamp visit).
  await goTo(page, { name: "corridor", spot: () => ({ x: 12.5, y: BUSINESS + 1.4 }) });
  await page.evaluate(() => {
    const me = window.porchlightTest.where();
    setMothVisit({ x: me.x + 1.0, y: me.y + 0.5, until: Date.now() + 60_000 });
  });
  await page.waitForTimeout(500);
  await page.keyboard.press("e");
  await expect(page.locator("#talk-name")).toHaveText("Mothman");
  for (let i = 0; i < 10 && !(await page.locator("#talk-choices button").count()); i++) {
    await page.keyboard.press("e");
    await page.waitForTimeout(300);
  }
  await page.click('#talk-choices button:has-text("Your scrapbook")');
  await expect(page.locator("#extras-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await frameErrors(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("Arcade: play a cabinet, a go on the claw, and the elevator home", async ({ page }) => {
  const problems = await enterHouse(page);
  await seed(page, { crumbs: 20, arcade: {} });
  await goTo(page, { name: "arcade", spot: () => {
    const cab = FURNITURE.find((f) => f.kind === "arcadeGame" && f.game === "snake");
    return { x: cab.x + 0.15, y: cab.y + cab.h + 0.1 };
  } });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await expect(page.locator(".arcade-screen")).toBeVisible();
  await page.click("#extras-body .warm-button"); // Start
  // (The snake runs into the wall on its own after a couple of seconds.)
  await expect(page.locator("#extras-body .warm-button")).toHaveText("Play again", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await goTo(page, { name: "claw", spot: () => {
    const claw = FURNITURE.find((f) => f.kind === "clawMachine");
    return { x: claw.x + 0.2, y: claw.y + claw.h + 0.1 };
  } });
  await page.waitForTimeout(1500);
  const crumbs = () => page.evaluate(async () => (await import("./bank.js")).myWallet().crumbs);
  const before = await crumbs();
  await page.keyboard.press("e");
  await expect.poll(crumbs).not.toBe(before); // (a go costs 5 crumbs; a first win also pays the Claw Master badge)
  // The elevator, from the Games floor down to the ground floor.
  await goTo(page, { name: "lobby", spot: () => ({ x: 21.9, y: GAMES + 3.8 }) });
  await page.waitForTimeout(600);
  await page.keyboard.press("e");
  await page.click("#elevator-floors button >> nth=0");
  await expect.poll(async () => (await whereAmI(page)).floor).toBe(0);
  expect(await frameErrors(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("Mini games: walking into a door opens its lobby, and a round starts", async ({ page }) => {
  const problems = await enterHouse(page);
  await goTo(page, { name: "games corridor", spot: () => {
    const door = FURNITURE.find((f) => f.kind === "gamePortal" && f.game === "crumbRush");
    return { x: door.x + door.w / 2 - 0.3, y: door.y + 0.9 };
  } });
  await page.waitForTimeout(400);
  await page.keyboard.down("ArrowUp"); // (walking into the door)
  await expect(page.locator(".mini-lobby .mini-title")).toHaveText("Crumb Rush");
  await page.keyboard.up("ArrowUp");
  await expect(page.locator(".mini-player")).toHaveCount(1);
  await page.click(".mini-lobby .warm-button"); // Start
  await expect(page.locator(".mini-hud-bar")).toBeVisible();
  await page.waitForTimeout(5000); // (the countdown, then playing)
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowRight");
  await page.screenshot({ path: "tests/looks/mini-round.png" }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.click(".mini-leave .warm-button"); // Leave
  await expect(page.locator(".mini-results-card")).toBeVisible();
  await page.click(".mini-results-card .soft-button"); // Back to the Games floor
  await expect(page.locator(".mini-scene")).toBeHidden();
  expect(await frameErrors(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test("Mini games: all eight doors open their lobbies", async ({ page }) => {
  const problems = await enterHouse(page);
  for (const g of await page.evaluate(() => CONFIG.minigames.games.map((x) => [x.id, x.name]))) {
    await page.evaluate(async (id) => (await import("./minigames.js")).openPortal(FURNITURE.find((x) => x.kind === "gamePortal" && x.game === id)), g[0]);
    await expect(page.locator(".mini-lobby .mini-title")).toHaveText(g[1]);
    await page.keyboard.press("Escape");
    await expect(page.locator(".mini-scene")).toBeHidden();
  }
  expect(problems).toEqual([]);
});
