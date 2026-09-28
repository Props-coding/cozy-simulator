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
