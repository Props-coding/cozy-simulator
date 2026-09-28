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
      await expect.poll(() => f.page.evaluate(() => window.porchlightTest.cellar.settled()), { timeout: 10_000 }).toBe(true);
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

// --- Step 3: the play ---
const cellar = (f, fn, arg) => f.page.evaluate(`(${fn})(window.porchlightTest.cellar, ${JSON.stringify(arg ?? null)})`);
// Down one floor, everyone.
async function allDown(friends) {
  for (const f of friends) {
    await expect.poll(() => cellar(f, (c) => c.settled()), { timeout: 10_000 }).toBe(true);
    await cellarGo(f, (fl) => ({ x: fl.ladderDown.x, y: fl.ladderDown.y + 0.8 }));
    await f.page.waitForTimeout(150);
    await f.page.keyboard.press("e");
  }
  await friends[0].page.waitForTimeout(1200);
}

test("Cellar Crawl: brooms, crates, critters, a knockout, a revive and the Rat King", async ({ browser }) => {
  const dir = process.env.CELLAR_DIR || DIR;
  const friends = await friendsInHouse(browser, ["Alice", "Bob", "Cara"]);
  const [alice, bob, cara] = friends;
  const start = await startTogether(friends, "cellarCrawl");
  await start.click();
  for (const f of friends) await f.page.waitForFunction(() => window.porchlightTest.cellar, null, { timeout: 15_000 });
  await alice.page.waitForTimeout(1500);

  // Alice breaks a crate (or a barrel) with her broom: the house server
  // says what was inside, and it shows as words floating up.
  const target = await cellar(alice, (c) => {
    const fl = c.floors[c.me.floor];
    const o = fl.objects.filter((x) => x.breakable && !x.broken).sort((a, b) => Math.hypot(a.x - c.me.x, a.y - c.me.y) - Math.hypot(b.x - c.me.x, b.y - c.me.y))[0];
    c.go(o.x + o.w / 2, o.y + o.h + 0.35);
    c.aim(0, -1);
    return { id: o.id, hits: o.breakable };
  });
  for (let k = 0; k < target.hits; k++) {
    await alice.page.keyboard.press(" ");
    await alice.page.waitForTimeout(450);
  }
  await cellar(alice, (c) => c.waitForServer());
  expect(await cellar(alice, (c, id) => c.floors[0].objects.find((o) => o.id === id).broken, target.id)).toBe(true);
  // (Bob's cellar hears about it too.)
  await expect.poll(() => cellar(bob, (c, id) => c.floors[0].objects.find((o) => o.id === id).broken, target.id)).toBe(true);
  await alice.page.waitForTimeout(250);
  await alice.page.screenshot({ path: `${dir}/1-broom-breaks-a-crate.png` });

  // Down to floor 2, where every room has rats.
  await allDown(friends);
  expect(await cellar(cara, (c) => c.me.floor)).toBe(1);
  // Alice walks up to a rat and swings at it (the host moves the critters,
  // so everyone sees the same ones).
  const rat = await cellar(alice, (c) => {
    const fl = c.floors[1];
    const r = fl.critters.filter((x) => x.kind === "rat")[0];
    c.me.hurt = 99; // (no getting hurt in this bit of the test)
    c.go(r.x - 1.6, r.y);
    c.aim(1, 0);
    return r.id;
  });
  await alice.page.waitForTimeout(700);
  await alice.page.screenshot({ path: `${dir}/2-a-rat-notices-alice.png` });
  for (let k = 0; k < 6; k++) {
    await cellar(alice, (c, id) => {
      const r = c.floors[1].critters.find((x) => x.id === id);
      if (!r) return;
      c.go(r.x - 0.8, r.y + 0.1);
      c.aim(1, 0);
    }, rat);
    await alice.page.keyboard.press(" ");
    if (k === 0) await alice.page.screenshot({ path: `${dir}/3-alice-swings-her-broom.png` });
    await alice.page.waitForTimeout(420);
  }
  expect(await cellar(alice, (c, id) => !c.floors[1].critters.some((x) => x.id === id), rat)).toBe(true);
  // Bob's copy lost the rat too.
  await expect.poll(() => cellar(bob, (c, id) => !c.floors[1].critters.some((x) => x.id === id), rat)).toBe(true);

  // Bob is knocked out (three hits), and drops half of what he carries.
  await cellar(bob, (c) => {
    c.go(c.floors[1].spawn.x, c.floors[1].spawn.y + 1);
    for (let k = 0; k < 3; k++) {
      c.me.hurt = 0;
      c.hurt();
    }
  });
  expect(await cellar(bob, (c) => c.me.downed)).toBe(true);
  // Cara comes over and stands next to him: after a few seconds he's up.
  await cellar(alice, (c) => (c.me.hurt = 0));
  const bobAt = await cellar(bob, (c) => ({ x: c.me.x, y: c.me.y }));
  await cellar(cara, (c, at) => {
    c.me.hurt = 99;
    c.go(at.x + 0.8, at.y);
  }, bobAt);
  await cellar(alice, (c, at) => c.go(at.x - 1.2, at.y + 0.6), bobAt);
  await alice.page.waitForTimeout(1600);
  await alice.page.screenshot({ path: `${dir}/4-cara-helps-bob-up.png` });
  await bob.page.screenshot({ path: `${dir}/5-bob-knocked-out.png` });
  await expect.poll(() => cellar(bob, (c) => c.me.downed), { timeout: 8000 }).toBe(false);
  expect(await cellar(bob, (c) => c.me.hearts)).toBe(2);

  // A spider and its webs, if this floor has one (they slow you down).
  const spider = await cellar(alice, (c) => {
    const s = c.floors[1].critters.find((x) => x.kind === "spider");
    if (!s) return false;
    c.me.hurt = 99;
    c.go(s.x - 2.2, s.y + 0.3);
    return true;
  });
  if (spider) {
    await alice.page.waitForTimeout(3500);
    await alice.page.screenshot({ path: `${dir}/6-a-spider-and-its-webs.png` });
  }

  // The bottom floor, and the Rat King.
  await allDown(friends);
  const kingAt = await cellar(alice, (c) => {
    const k = c.floors[2].critters.find((x) => x.kind === "ratKing");
    c.me.hurt = 99;
    c.go(k.x, k.y + 2.4);
    c.aim(0, -1);
    return { x: k.x, y: k.y };
  });
  for (const f of [bob, cara]) await cellar(f, (c, at) => {
    c.me.hurt = 99;
    c.go(at.x + (Math.random() - 0.5) * 2, at.y + 2.8);
  }, kingAt);
  await alice.page.waitForTimeout(1200);
  await alice.page.screenshot({ path: `${dir}/7-the-rat-king.png` });
  // (The house server wants a little time on the floor before the king
  // can fall, so nobody skips straight to him.)
  await alice.page.waitForTimeout(9000);
  for (let k = 0; k < 60; k++) {
    const alive = await cellar(alice, (c) => {
      const king = c.floors[2].critters.find((x) => x.kind === "ratKing");
      if (!king) return false;
      c.me.hurt = 99;
      c.go(king.x, king.y + 0.9);
      c.aim(0, -1);
      return true;
    });
    if (!alive) break;
    await alice.page.keyboard.press(" ");
    if (k === 6) await alice.page.screenshot({ path: `${dir}/8-fighting-the-king.png` });
    await alice.page.waitForTimeout(380);
  }
  expect(await cellar(alice, (c) => c.floors[2].critters.some((x) => x.kind === "ratKing"))).toBe(false);
  await alice.page.waitForTimeout(600);
  await alice.page.screenshot({ path: `${dir}/9-the-king-is-beaten.png` });
  await cellar(alice, (c) => c.waitForServer());
  expect((await cellar(alice, (c) => c.carrying())).items).toContain("The Rat King's Throne");

  // Up the ladder: it all comes home.
  await cellarGo(alice, (fl) => ({ x: fl.ladderUp.x + 0.5, y: fl.ladderUp.y + 1 }));
  await alice.page.waitForTimeout(200);
  await alice.page.keyboard.press("e");
  await alice.page.locator(".mini-results-card").waitFor({ state: "visible", timeout: 10_000 });
  await expect(alice.page.locator(".mini-results-card")).toContainText("The Rat King's Throne");
  await alice.page.screenshot({ path: `${dir}/10-results-alice.png` });
  for (const f of friends) expect(f.problems).toEqual([]);
});
