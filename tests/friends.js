// Two or three friends in the house at once, for tests that play
// together (like the mini games). Each friend is their own browser window
// with their own test account on the test house server; their messages go
// through the test itself (see tests/fake-trystero.js), so they see each
// other walk about as if connected.
import { expect } from "@playwright/test";
import { TEST_HOUSE, HOUSE_PORT } from "./house.js";

const base = `http://localhost:${HOUSE_PORT}`;
async function call(path, body, headers = {}) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

// Makes a test account (if it isn't there yet) that's said the house phrase.
async function account(name, password) {
  const made = await call("/api/signup", { name, password });
  const token = made.ok ? made.data.token : (await call("/api/login", { name, password })).data.token;
  if (!token) throw new Error(`friends.js: couldn't make or log in ${name}`);
  await call("/api/join", { phrase: TEST_HOUSE.phrase }, { Authorization: `Bearer ${token}` });
}

// Sets up a friend's account with things already in it (like seed() in
// helpers.js, for any test account).
export async function seedFriend(friend, wallet) {
  const res = await fetch(`${base}/admin/test-seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": TEST_HOUSE.adminToken },
    body: JSON.stringify({ name: friend.name, wallet }),
  });
  if (!res.ok) throw new Error(`seed: ${res.status} ${await res.text()}`);
  await friend.page.evaluate(async () => (await import("./bank.js")).loadBank());
}

// Opens a window for each name, logs each in and walks them into the
// house. Returns [{ name, page, problems }].
export async function friendsInHouse(browser, names, { viewport = { width: 1600, height: 900 } } = {}) {
  const friends = [];
  for (const name of names) {
    const password = "friendpass123";
    await account(name, password);
    const context = await browser.newContext({ viewport, permissions: ["microphone"], timezoneId: "America/Chicago" });
    const page = await context.newPage();
    const friend = { name, page, problems: [] };
    page.on("pageerror", (e) => friend.problems.push(e.message));
    // (Messages between the windows: see tests/fake-trystero.js.)
    await page.exposeFunction("__meshSend", (m) => {
      for (const other of friends) if (other !== friend) other.page.evaluate((msg) => globalThis.__meshReceive?.(msg), m).catch(() => {});
    });
    await page.goto("/index.html");
    await page.locator("#account-login").waitFor({ state: "visible", timeout: 30_000 });
    await page.fill("#account-name", name);
    await page.fill("#account-password", password);
    await page.click("#account-submit");
    await page.locator("#join-button").waitFor({ state: "visible", timeout: 30_000 });
    // (Everyone in a random outfit, so they're easy to tell apart.)
    await page.click("#join-edit-outfit");
    for (let i = 0; i <= friends.length; i++) await page.click("#join-random");
    await page.click("#join-button");
    await page.waitForFunction(() => document.getElementById("join-screen").hidden && window.porchlightTest?.settled(), null, { timeout: 60_000 });
    await expect(page.locator("#room-name")).not.toBeEmpty();
    friends.push(friend);
  }
  return friends;
}
