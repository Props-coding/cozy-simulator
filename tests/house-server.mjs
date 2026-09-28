// Runs a throwaway copy of the house server for the automated tests, on
// this computer only (http://localhost:3999), with its own empty save
// folder (tests/.data, wiped each run). Nothing here touches the real
// server or anyone's account. The made-up secrets below only work here.
import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HOUSE_PORT, TEST_HOUSE } from "./house.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA = fileURLToPath(new URL("./.data", import.meta.url));
rmSync(DATA, { recursive: true, force: true });

const server = spawn(process.execPath, ["server/server.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(HOUSE_PORT),
    DATA_DIR: DATA,
    GAME_DIR: ROOT, // (the server reads config.js, catalog.js and world.js straight from the site)
    HOUSE_PHRASE: TEST_HOUSE.phrase,
    ADMIN_TOKEN: TEST_HOUSE.adminToken,
    ROOM_ID: "test-room",
    ROOM_PASSWORD: "test-room-password",
    TURN_SECRET: "test-turn-secret",
    TURN_HOST: "localhost",
    TEST_SEED: "1", // (lets the tests set up the test account: seed() in helpers.js)
  },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
