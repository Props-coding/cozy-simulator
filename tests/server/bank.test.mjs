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
