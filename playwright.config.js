// Settings for the automated tests (Playwright): run `npm test`.
// They start a test copy of the site and of the house server on this
// computer, open the house in a real (hidden) browser, and check it.
//   checks    the house loads, every floor draws with no errors, and how
//             smoothly each floor draws (frames per second)
//   pictures  a picture of every floor, compared with the last approved one
//             (run `npm run test:pictures`; approve new ones with
//             `npm run test:pictures:update`)
import { defineConfig } from "@playwright/test";
import { SITE_PORT, HOUSE_PORT } from "./tests/house.js";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.js",
  timeout: 90_000,
  workers: 1, // (one test account, one house: one at a time)
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${SITE_PORT}`,
    viewport: { width: 1920, height: 969 }, // a 1080p screen, inside the browser
    timezoneId: "America/Chicago",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [
    { name: "checks", testMatch: /checks\.spec\.js/ },
    { name: "pictures", testMatch: /pictures\.spec\.js/, snapshotPathTemplate: "tests/pictures/{arg}{ext}" },
  ],
  webServer: [
    { command: "node tests/house-server.mjs", url: `http://localhost:${HOUSE_PORT}/api/health`, reuseExistingServer: false, stdout: "ignore", stderr: "pipe" },
    { command: "node tests/serve.mjs", url: `http://localhost:${SITE_PORT}/index.html`, reuseExistingServer: false },
  ],
});
