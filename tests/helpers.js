// Shared steps for the tests: log in and walk into the house, and jump to
// a spot (using the page's test hook, see "For the automated tests" in main.js).
import { expect } from "@playwright/test";
import { TEST_HOUSE, HOUSE_PORT } from "./house.js";

// Every floor, with a spot to stand on each (the spots come from world.js).
export const FLOORS = [
  { name: "ground floor", room: "hallway", spot: () => ({ x: 8.7, y: 1.2 }) },
  { name: "business floor", room: "business", spot: () => ({ x: 8.7, y: BUSINESS + 1.2 }) },
  { name: "suite floor", room: "suite", spot: () => ({ x: 8.7, y: SUITE + 1.2 }) },
  { name: "yard", room: null, spot: () => YARD_SPAWN },
  { name: "Willow Lake", room: "lake", spot: () => LAKE_SPAWN },
  { name: "back alley", room: "alley", spot: () => ALLEY_SPAWN },
  { name: "the Farm", room: "farm", spot: () => FARM_SPAWN },
];

// Opens the site, logs in as the test account and joins the house.
// Returns the list of problems the page hit along the way.
export async function enterHouse(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/index.html");
  await page.locator("#account-login").waitFor({ state: "visible", timeout: 30_000 });
  await page.fill("#account-name", TEST_HOUSE.name);
  await page.fill("#account-password", TEST_HOUSE.password);
  await page.click("#account-submit");
  await page.locator("#join-button").waitFor({ state: "visible", timeout: 30_000 });
  await page.click("#join-button");
  // Joining wakes you up in your bed; wait for that before moving about.
  await page.waitForFunction(() => document.getElementById("join-screen").hidden && window.porchlightTest?.settled(), null, { timeout: 30_000 });
  await expect(page.locator("#room-name")).not.toBeEmpty();
  return problems;
}

// Jumps to a floor's spot (the nearest free place to it).
export async function goTo(page, floor) {
  const ok = await page.evaluate(`(() => { const s = (${floor.spot.toString()})(); return window.porchlightTest.go(s.x, s.y); })()`);
  expect(ok, `found somewhere to stand on the ${floor.name}`).toBe(true);
}

// Sets up the test account with things already in it, straight on the
// test house server, then has the page fetch its wallet again. For
// example: seed(page, { crumbs: 500, basket: { "fish:bluegill": 3 },
// fishing: { lesson: "caught", lessonFish: "bluegill" } }).
export async function seed(page, wallet) {
  const res = await fetch(`http://localhost:${HOUSE_PORT}/admin/test-seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": TEST_HOUSE.adminToken },
    body: JSON.stringify({ name: TEST_HOUSE.name, wallet }),
  });
  if (!res.ok) throw new Error(`seed: ${res.status} ${await res.text()}`);
  await page.evaluate(async () => (await import("./bank.js")).loadBank());
}

export const whereAmI = (page) => page.evaluate(() => window.porchlightTest.where());
export const frameErrors = (page) => page.evaluate(() => window.porchlightTest.frameErrors);
