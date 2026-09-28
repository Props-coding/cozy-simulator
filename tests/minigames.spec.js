// The mini games with friends (run with `npm run test:friends`): three
// windows walk into the same door, get ready, play a round together and
// see the results. Pictures go to SHOTS_DIR (or tests/looks/minigames).
import { test, expect } from "@playwright/test";
import { friendsInHouse } from "./friends.js";

const DIR = process.env.SHOTS_DIR || "tests/looks/minigames";
const shot = (friend, name) => friend.page.screenshot({ path: `${DIR}/${name}.png` });

// Walks a friend into a game's door (up into it from just below).
async function walkIntoDoor(page, game) {
  await page.evaluate((id) => {
    const door = FURNITURE.find((f) => f.kind === "gamePortal" && f.game === id);
    window.porchlightTest.go(door.x + door.w / 2 - 0.3, door.y + 0.9);
  }, game);
  await page.waitForTimeout(300);
  await page.keyboard.down("ArrowUp");
  await page.locator(".mini-lobby").waitFor({ state: "visible", timeout: 10_000 });
  await page.keyboard.up("ArrowUp");
}

test("Mini games: a lobby, a round and the results, with three friends", async ({ browser }) => {
  const [alice, bob, carol] = await friendsInHouse(browser, ["Alice", "Bob", "Carol"]);
  await walkIntoDoor(alice.page, "crumbRush");
  await alice.page.waitForTimeout(800);
  await walkIntoDoor(bob.page, "crumbRush");
  await walkIntoDoor(carol.page, "crumbRush");
  await expect(alice.page.locator(".mini-player")).toHaveCount(3, { timeout: 8000 });
  await expect(alice.page.locator(".mini-lobby .warm-button")).toBeDisabled();
  await shot(alice, "1-lobby-alice-is-host");
  await bob.page.click(".mini-lobby .soft-button:has-text('Ready')");
  await carol.page.click(".mini-lobby .soft-button:has-text('Ready')");
  await expect(alice.page.locator(".mini-lobby .warm-button")).toBeEnabled({ timeout: 5000 });
  await shot(bob, "2-lobby-bob-ready");
  await alice.page.click(".mini-lobby .warm-button");
  for (const f of [alice, bob, carol]) await f.page.locator(".mini-hud-bar").waitFor({ state: "visible", timeout: 8000 });
  await alice.page.waitForTimeout(1500);
  await shot(alice, "3-countdown");
  await alice.page.waitForTimeout(3500);
  for (const f of [alice, bob, carol]) await f.page.keyboard.down(f === bob ? "ArrowLeft" : "ArrowRight");
  await alice.page.waitForTimeout(8000);
  for (const f of [alice, bob, carol]) await f.page.keyboard.up(f === bob ? "ArrowLeft" : "ArrowRight");
  await shot(alice, "4-round-alice");
  await shot(bob, "5-round-bob");
  // Everyone leaves early (Escape, then Leave): the results.
  for (const f of [alice, bob, carol]) {
    await f.page.keyboard.press("Escape");
    await f.page.click(".mini-leave .warm-button");
  }
  for (const f of [alice, bob, carol]) await f.page.locator(".mini-results-card").waitFor({ state: "visible", timeout: 10_000 });
  await expect(alice.page.locator(".mini-board-row")).toHaveCount(3, { timeout: 8000 });
  await shot(alice, "6-results-alice");
  await alice.page.click(".mini-results-card .soft-button");
  await expect(alice.page.locator(".mini-scene")).toBeHidden({ timeout: 5000 });
  await alice.page.waitForTimeout(500);
  const where = await alice.page.evaluate(() => window.porchlightTest.where());
  expect(where.floor).toBe(await alice.page.evaluate(() => GAMES_FLOOR));
  await shot(alice, "7-back-at-the-door");
  for (const f of [alice, bob, carol]) expect(f.problems).toEqual([]);
});

// Starts a round of a game with everyone (the first friend hosts).
async function startTogether(friends, game) {
  await walkIntoDoor(friends[0].page, game);
  await friends[0].page.waitForTimeout(600);
  for (const f of friends.slice(1)) await walkIntoDoor(f.page, game);
  await expect(friends[0].page.locator(".mini-player")).toHaveCount(friends.length, { timeout: 8000 });
  for (const f of friends.slice(1)) await f.page.click(".mini-lobby .soft-button:has-text('Ready')");
  await expect(friends[0].page.locator(".mini-lobby .warm-button")).toBeEnabled({ timeout: 5000 });
  return friends[0].page.locator(".mini-lobby .warm-button");
}
// Jumps someone in the cellar to a spot (by the ladders, for example).
const cellarGo = (f, pick) => f.page.evaluate(`(() => { const c = window.porchlightTest.cellar; const fl = c.floors[c.me.floor]; const s = (${pick})(fl, c); c.go(s.x, s.y); })()`);

test("Cellar Crawl: the cellar, three floors deep", async ({ browser }) => {
  const dir = process.env.CELLAR_DIR || DIR;
  const friends = await friendsInHouse(browser, ["Alice", "Bob"]);
  const [alice, bob] = friends;
  const start = await startTogether(friends, "cellarCrawl");
  await alice.page.screenshot({ path: `${dir}/1-lobby.png` });
  await start.click();
  await alice.page.waitForFunction(() => window.porchlightTest.cellar, null, { timeout: 15_000 });
  await bob.page.waitForFunction(() => window.porchlightTest.cellar, null, { timeout: 15_000 });
  await alice.page.waitForTimeout(1500);
  await alice.page.screenshot({ path: `${dir}/2-floor1-start-alice.png` });
  // Walk about a bit.
  await alice.page.keyboard.down("ArrowDown");
  await bob.page.keyboard.down("ArrowRight");
  await alice.page.waitForTimeout(900);
  await alice.page.keyboard.up("ArrowDown");
  await bob.page.keyboard.up("ArrowRight");
  await alice.page.waitForTimeout(600);
  await bob.page.screenshot({ path: `${dir}/3-floor1-bob.png` });
  // The whole floor, lights on (a test-only view), to check the layout.
  await alice.page.evaluate(() => Object.assign(window.porchlightTest.cellar.debug, { view: 50, lightsOn: true }));
  await alice.page.waitForTimeout(400);
  await alice.page.screenshot({ path: `${dir}/4-floor1-overview.png` });
  await alice.page.evaluate(() => Object.assign(window.porchlightTest.cellar.debug, { view: 0, lightsOn: false }));
  // Down the ladder, both of them, to floor 2, then floor 3.
  for (const n of [2, 3]) {
    for (const f of [alice, bob]) {
      await cellarGo(f, (fl) => ({ x: fl.ladderDown.x, y: fl.ladderDown.y + 0.8 }));
      await f.page.waitForTimeout(200);
      await f.page.keyboard.press("e");
    }
    await alice.page.waitForTimeout(1500);
    expect(await alice.page.evaluate(() => window.porchlightTest.cellar.me.floor)).toBe(n - 1);
    await alice.page.screenshot({ path: `${dir}/${n + 3}-floor${n}-alice.png` });
  }
  await alice.page.evaluate(() => Object.assign(window.porchlightTest.cellar.debug, { view: 60, lightsOn: true }));
  await alice.page.waitForTimeout(400);
  await alice.page.screenshot({ path: `${dir}/7-floor3-overview.png` });
  await alice.page.evaluate(() => Object.assign(window.porchlightTest.cellar.debug, { view: 0, lightsOn: false }));
  // Back up the ladder: home, and the results.
  await cellarGo(alice, (fl) => ({ x: fl.ladderUp.x + 0.5, y: fl.ladderUp.y + 1 }));
  await alice.page.waitForTimeout(300);
  await alice.page.screenshot({ path: `${dir}/8-ladder-up.png` });
  await alice.page.keyboard.press("e");
  await alice.page.locator(".mini-results-card").waitFor({ state: "visible", timeout: 10_000 });
  await alice.page.screenshot({ path: `${dir}/9-results.png` });
  for (const f of friends) expect(f.problems).toEqual([]);
});
