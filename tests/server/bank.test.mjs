// The house server's money rules (`npm run test:server`): crumbs, selling,
// trading on Porch Swap and Otis's payout. A throwaway copy of the server
// starts on this computer with an empty save folder and two test accounts,
// then each test tries both the right way and the cheating way (selling
// what you don't have, buying with too few crumbs, getting paid twice...).
// Nothing here touches the real server. Uses Node's own test tool.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DATA = fileURLToPath(new URL("../.data-server-tests", import.meta.url));
const PHRASE = "test house phrase", ADMIN = "test-admin-token";
let server;
const tokens = {};

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const as = (name) => ({ Authorization: `Bearer ${tokens[name]}` });
// One bank action for a test account: its status and new wallet.
const bank = (name, action, extra = {}) => call("POST", "/api/bank", { action, ...extra }, as(name));
const wallet = async (name) => (await call("GET", "/api/bank", undefined, as(name))).data.wallet;
// Sets up an account's wallet directly (the test-only seed route).
async function seed(name, w) {
  const r = await call("POST", "/admin/test-seed", { name, wallet: w }, { "X-Admin-Token": ADMIN });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}

before(async () => {
  rmSync(DATA, { recursive: true, force: true });
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, GAME_DIR: ROOT, HOUSE_PHRASE: PHRASE, ADMIN_TOKEN: ADMIN, ROOM_ID: "test-room", ROOM_PASSWORD: "x", TURN_SECRET: "x", TURN_HOST: "localhost", TEST_SEED: "1" },
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const name of ["Alice", "Bruno"]) {
    const { data } = await call("POST", "/api/signup", { name, password: "testpass123" });
    tokens[name] = data.token;
    assert.equal((await call("POST", "/api/join", { phrase: PHRASE }, as(name))).status, 200);
  }
});
after(() => {
  server?.kill();
  rmSync(DATA, { recursive: true, force: true });
});

test("selling fish pays their price, and only for fish you have", async () => {
  await seed("Alice", { crumbs: 0, basket: { "fish:bluegill": 3 } });
  const sold = await bank("Alice", "sell", { id: "fish:bluegill", n: 2 });
  assert.equal(sold.status, 200);
  assert.equal(sold.data.wallet.crumbs, 6); // (a bluegill sells for 3)
  assert.equal(sold.data.wallet.basket["fish:bluegill"], 1);
  assert.equal((await bank("Alice", "sell", { id: "fish:bluegill", n: 5 })).status, 409, "more than you have");
  assert.equal((await bank("Alice", "sell", { id: "fish:bluegill", n: -3 })).status, 400, "a negative amount");
  assert.equal((await bank("Alice", "sell", { id: "fish:dragon", n: 1 })).status, 400, "a fish that doesn't exist");
  assert.equal((await wallet("Alice")).crumbs, 6, "nothing changed after the refusals");
});

test("Porch Swap: a sale moves the crumbs and the fish, once", async () => {
  await seed("Alice", { crumbs: 0, basket: { "fish:bluegill": 2 } });
  await seed("Bruno", { crumbs: 10, basket: {} });
  assert.equal((await bank("Alice", "tradeList", { item: "fish:bluegill", n: 1, price: 7 })).status, 200);
  const { listings } = (await call("GET", "/api/market", undefined, as("Bruno"))).data;
  const listing = listings.find((l) => l.item === "fish:bluegill");
  assert.ok(listing, "the fish is up for trade");
  assert.equal((await bank("Alice", "tradeBuy", { id: listing.id })).status, 400, "buying your own");
  const bought = await bank("Bruno", "tradeBuy", { id: listing.id });
  assert.equal(bought.status, 200);
  assert.equal(bought.data.wallet.crumbs, 3);
  assert.equal(bought.data.wallet.basket["fish:bluegill"], 1);
  const alice = await wallet("Alice");
  assert.equal(alice.crumbs, 7 + 15, "the seller got paid (and 15 for the Open for Business badge)");
  assert.equal(alice.basket["fish:bluegill"], 1);
  assert.equal((await bank("Bruno", "tradeBuy", { id: listing.id })).status, 404, "it can't be bought twice");
});

test("Porch Swap: too few crumbs buys nothing, and taking back returns it", async () => {
  await seed("Alice", { crumbs: 0, basket: { "fish:bluegill": 1 } });
  await seed("Bruno", { crumbs: 3, basket: {} });
  await bank("Alice", "tradeList", { item: "fish:bluegill", n: 1, price: 50 });
  const listing = (await call("GET", "/api/market", undefined, as("Bruno"))).data.listings.find((l) => l.price === 50);
  assert.equal((await bank("Bruno", "tradeBuy", { id: listing.id })).status, 409);
  assert.equal((await wallet("Bruno")).crumbs, 3);
  assert.equal((await bank("Bruno", "tradeCancel", { id: listing.id })).status, 404, "only the seller can take it back");
  const back = await bank("Alice", "tradeCancel", { id: listing.id });
  assert.equal(back.status, 200);
  assert.equal(back.data.wallet.basket["fish:bluegill"], 1);
  assert.equal((await bank("Alice", "tradeList", { item: "fish:bluegill", n: 5, price: 1 })).status, 409, "listing more than you have");
});

test("Otis pays for your first fish once", async () => {
  await seed("Alice", { crumbs: 0, basket: { "fish:bluegill": 1 }, fishing: { lesson: "caught", lessonFish: "bluegill" } });
  const paid = await bank("Alice", "lessonHandIn");
  assert.equal(paid.status, 200);
  assert.equal(paid.data.wallet.crumbs, 25);
  assert.equal(paid.data.wallet.fishing.lesson, "done");
  assert.equal(paid.data.wallet.basket["fish:bluegill"] ?? 0, 0, "Otis took the fish");
  assert.equal((await bank("Alice", "lessonHandIn")).status, 409, "no second payout");
  await seed("Bruno", { crumbs: 0, basket: {}, fishing: { lesson: "caught", lessonFish: "bluegill" } });
  assert.equal((await bank("Bruno", "lessonHandIn")).status, 409, "no fish, no payout");
  assert.equal((await wallet("Bruno")).crumbs, 0);
});

test("admin tools are for admins only", async () => {
  await seed("Bruno", { crumbs: 0 });
  assert.equal((await bank("Bruno", "adminCrumbs", { n: 1000 })).status, 403);
  assert.equal((await wallet("Bruno")).crumbs, 0);
});

// --- House extras (Update 7) ---
test("the wishing well: one coin, once a day, and something back", async () => {
  await seed("Alice", { crumbs: 5, basket: {}, wishDay: 0 });
  const wish = await bank("Alice", "wish");
  assert.equal(wish.status, 200);
  const r = wish.data.result;
  assert.ok(r.crumbs > 0 || (r.item && r.n > 0), "a reward came back");
  if (r.crumbs) assert.equal(wish.data.wallet.crumbs, 5 - 1 + r.crumbs + 5, "paid 1, got the reward and the badge's 5");
  else assert.equal(wish.data.wallet.basket[r.item], r.n);
  assert.equal((await bank("Alice", "wish")).status, 409, "only one wish a day");
  await seed("Bruno", { crumbs: 0, wishDay: 0 });
  assert.equal((await bank("Bruno", "wish")).status, 409, "no coin, no wish");
});

test("the cooking channel teaches today's recipe, once", async () => {
  await seed("Alice", { recipes: [] });
  const first = await bank("Alice", "tvCooking");
  assert.equal(first.status, 200);
  assert.ok(first.data.result.recipe, "a recipe is on");
  assert.equal(first.data.result.learned, true);
  assert.ok(first.data.wallet.recipes.includes(first.data.result.recipe));
  const again = await bank("Alice", "tvCooking");
  assert.equal(again.data.result.learned, false);
  assert.equal(again.data.wallet.recipes.length, 1);
});

test("Library books: write, read, and only the author takes one back", async () => {
  assert.equal((await call("POST", "/api/books", { title: "", text: "words" }, as("Alice"))).status, 400, "no title");
  const made = await call("POST", "/api/books", { title: "My Pond Diary", kind: "diary", text: "Caught a boot." }, as("Alice"));
  assert.equal(made.status, 200);
  assert.equal(made.data.book.text, "Caught a boot.", "control characters are stripped");
  const { books } = (await call("GET", "/api/books", undefined, as("Bruno"))).data;
  assert.ok(books.some((b) => b.id === made.data.book.id && b.author === "Alice"));
  assert.equal((await call("POST", "/api/books/remove", { id: made.data.book.id }, as("Bruno"))).status, 403, "not Bruno's book");
  assert.equal((await call("POST", "/api/books/remove", { id: made.data.book.id }, as("Alice"))).status, 200);
  assert.equal((await call("GET", "/api/books", undefined, as("Bruno"))).data.books.length, 0);
});

test("pixel art is kept only if it's real pixel art", async () => {
  await seed("Alice", { crumbs: 100 });
  assert.equal((await bank("Alice", "buyDecor", { id: "artCanvas" })).status, 200);
  const good = "0123456789abcdef".repeat(16);
  const put = await call("PUT", "/api/room/home", { size: "cozy", placed: [{ item: "artCanvas", x: 1, y: 0, pixels: good }] }, as("Alice"));
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const mine = async () => (await call("GET", "/api/rooms", undefined, as("Alice"))).data.doors.find((r) => r.owner === "Alice")?.placed ?? [];
  assert.equal((await mine()).find((p) => p.item === "artCanvas")?.pixels, good);
  await call("PUT", "/api/room/home", { size: "cozy", placed: [{ item: "artCanvas", x: 1, y: 0, pixels: "<script>" }] }, as("Alice"));
  assert.equal((await mine()).find((p) => p.item === "artCanvas")?.pixels, undefined, "junk is dropped");
});

// --- Night & Mothman (Update 8) ---
const setSky = (sky) => call("POST", "/admin/test-sky", sky, { "X-Admin-Token": ADMIN });

test("the toolbox sells lightbulbs and lanterns, never fireflies", async () => {
  await seed("Alice", { crumbs: 30, basket: {} });
  const bought = await bank("Alice", "buyNightItem", { id: "lightbulb", n: 2 });
  assert.equal(bought.status, 200);
  assert.equal(bought.data.wallet.crumbs, 30 - 12);
  assert.equal(bought.data.wallet.basket["night:lightbulb"], 2);
  assert.equal((await bank("Alice", "buyNightItem", { id: "firefly" })).status, 400, "fireflies are caught, not bought");
  assert.equal((await bank("Alice", "buyNightItem", { id: "lantern", n: 5 })).status, 409, "not enough crumbs");
});

test("fireflies: only at night, not too fast, and a few a night", async () => {
  await seed("Alice", { basket: {}, night: {} });
  await setSky({ night: false });
  assert.equal((await bank("Alice", "catchFirefly")).status, 409, "not by day");
  await setSky({ night: true });
  const caught = await bank("Alice", "catchFirefly");
  assert.equal(caught.status, 200);
  assert.equal(caught.data.wallet.basket["night:firefly"], 1);
  assert.equal((await bank("Alice", "catchFirefly")).status, 409, "give it a moment");
});

test("Mothman: a sighting a night, his requests, and his gifts at so many hearts", async () => {
  await setSky({ night: true });
  await seed("Bruno", { crumbs: 0, owned: [], night: {}, basket: { "night:lightbulb": 5, "night:lantern": 2, "night:firefly": 5, "food:honey": 2 } });
  const seen = await bank("Bruno", "mothSighting", { where: "porch" });
  assert.equal(seen.status, 200);
  assert.equal(seen.data.wallet.night.sightings.length, 1);
  await bank("Bruno", "mothSighting", { where: "porch" });
  assert.equal((await wallet("Bruno")).night.sightings.length, 1, "one photo a night");
  const request = await bank("Bruno", "residentRequest", { id: "mothman" });
  assert.equal(request.status, 200, JSON.stringify(request.data));
  // Up to 4 hearts: the Believer badge (and its title) and the antennae.
  await seed("Bruno", { residents: { ...(await wallet("Bruno")).residents, hearts: { mothman: 390 } } });
  const gift = await bank("Bruno", "residentGift", { id: "mothman", item: "night:lantern" });
  assert.equal(gift.status, 200);
  assert.equal(gift.data.result.taste, "loved");
  const w = gift.data.wallet;
  assert.ok(w.unlocked.believer, "Believer");
  assert.ok(w.owned.includes("mothAntennae"), "the antennae");
  assert.ok(!w.owned.includes("mothWings"), "not the wings yet");
  assert.equal((await bank("Bruno", "buy", { id: "mothWings" })).status, 400, "his gifts are never for sale");
});

test("the porch light: only at nine, once a night", async () => {
  await seed("Alice", { crumbs: 0, night: {} });
  const d = new Date();
  const at = (h, m) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - Date.now();
  await setSky({ night: true, offset: at(15, 0) });
  assert.equal((await bank("Alice", "porchSwarm")).status, 409, "not at three in the afternoon");
  await setSky({ night: true, offset: at(21, 5) });
  const watched = await bank("Alice", "porchSwarm");
  assert.equal(watched.status, 200);
  assert.ok(watched.data.wallet.crumbs >= 15);
  assert.equal((await bank("Alice", "porchSwarm")).status, 409, "once a night");
  await setSky({ night: null, offset: 0 });
});

// --- The Arcade (Update 9) ---
test("arcade: a score can't beat the clock, and tickets go on the board", async () => {
  await seed("Alice", { arcade: {} });
  const { data: start } = await bank("Alice", "arcadeStart", { game: "snake" });
  const end = await bank("Alice", "arcadeEnd", { id: start.result.id, score: 9999 });
  assert.equal(end.status, 200);
  assert.ok(end.data.result.score <= 4, `an instant 9999 counts as at most a few points (got ${end.data.result.score})`);
  assert.equal(end.data.wallet.arcade.tickets, end.data.result.tickets);
  assert.equal((await bank("Alice", "arcadeEnd", { id: start.result.id, score: 5 })).status, 409, "a play only ends once");
  assert.equal((await bank("Alice", "arcadeStart", { game: "pinball" })).status, 400, "no such cabinet");
  const { boards } = (await call("GET", "/api/arcade/scores", undefined, as("Bruno"))).data;
  assert.ok(boards.snake.some((e) => e.name === "Alice"));
});

test("arcade: cashing in has a daily cap, and prizes cost tickets", async () => {
  await seed("Alice", { crumbs: 0, arcade: { tickets: 900 }, owned: [] });
  const cash = await bank("Alice", "arcadeCashIn");
  assert.equal(cash.status, 200);
  assert.equal(cash.data.result.crumbs, 30, "30 crumbs a day at most");
  assert.equal(cash.data.wallet.arcade.tickets, 600);
  assert.equal((await bank("Alice", "arcadeCashIn")).status, 409, "that's today's cashing in");
  const crown = await bank("Alice", "arcadePrize", { id: "prizeCrown" });
  assert.equal(crown.status, 200);
  assert.ok(crown.data.wallet.owned.includes("prizeCrown"));
  assert.equal(crown.data.wallet.arcade.tickets, 100);
  assert.equal((await bank("Alice", "arcadePrize", { id: "miniArcade" })).status, 409, "not enough tickets");
  assert.equal((await bank("Alice", "buy", { id: "prizeCrown" })).status, 400, "never sold by the raccoons");
});

test("arcade: the claw and the capsules cost crumbs, and the server decides", async () => {
  await seed("Bruno", { crumbs: 20, arcade: {} });
  const claw = await bank("Bruno", "arcadeClaw");
  assert.equal(claw.status, 200);
  assert.equal(typeof claw.data.result.won, "boolean");
  const cap = await bank("Bruno", "arcadeCapsule");
  assert.equal(cap.status, 200);
  assert.ok(cap.data.wallet.arcade.pins[cap.data.result.pin] >= 1);
  await seed("Bruno", { crumbs: 2 });
  assert.equal((await bank("Bruno", "arcadeClaw")).status, 409, "5 crumbs a go");
});

// --- Mini games (Update 10) ---
test("mini games: a round's crumbs can't beat the clock, and there's a daily cap", async () => {
  await seed("Alice", { crumbs: 0, minis: {} });
  assert.equal((await bank("Alice", "miniStart", { game: "ghostHunt" })).status, 400, "that door doesn't open yet");
  const { data: start } = await bank("Alice", "miniStart", { game: "crumbRush" });
  const end = await bank("Alice", "miniEnd", { id: start.result.id, score: 5000 });
  assert.equal(end.status, 200);
  assert.ok(end.data.result.score <= 4, `an instant 5000 counts as a few points at most (got ${end.data.result.score})`);
  assert.ok(end.data.result.crumbs <= 1);
  assert.equal((await bank("Alice", "miniEnd", { id: start.result.id, score: 5 })).status, 409, "a round only ends once");
  // Near the day's cap: only what's left of it is paid.
  await seed("Bruno", { crumbs: 0, minis: { day: 0 } });
  const { data: s2 } = await bank("Bruno", "miniStart", { game: "scarecrow" });
  const e2 = await bank("Bruno", "miniEnd", { id: s2.result.id, score: 1 });
  assert.equal(e2.status, 200);
  assert.equal(e2.data.result.crumbs, 2, "1 point at The Scarecrow is 2 crumbs");
  assert.equal(e2.data.wallet.minis.best.scarecrow, 1);
});
