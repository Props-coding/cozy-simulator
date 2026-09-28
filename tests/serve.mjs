// Serves the site to the automated tests, on this computer only
// (http://localhost:4173). The files on disk are never changed: a few are
// adjusted on the way out, so the page talks to the test house server
// (tests/house-server.mjs) instead of the real one, and uses a stand-in
// for Trystero so no connection goes out to the internet.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_PORT, HOUSE_PORT } from "./house.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = SITE_PORT;
const HOUSE = `http://localhost:${HOUSE_PORT}`;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".ico": "image/x-icon" };

// [file, what to find, what to put instead]
const SWAPS = [
  ["config.js", /serverUrl: "[^"]*"/, `serverUrl: "${HOUSE}"`],
  ["index.html", "connect-src 'self'", `connect-src 'self' ${HOUSE}`],
  ["network.js", /"https:\/\/esm\.sh\/trystero@[^"]*"/, `"./tests/fake-trystero.js"`],
  // (NO_OUTLINES=1: object outlines off. Some cloud computers have no
  // graphics chip, and there the outline effect takes over a minute a frame.)
  ...(process.env.NO_OUTLINES ? [["config.js", "outlines: true,", "outlines: false,"]] : []),
];

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(path === "/" ? "/index.html" : path).replace(/^([/\\])+/, "");
  // (No offline copy in the tests: it would keep serving old files.)
  if (file.includes("..") || file === "sw.js" || file.startsWith("node_modules")) return res.writeHead(404).end();
  try {
    let body = await readFile(join(ROOT, file));
    const swaps = SWAPS.filter(([name]) => name === file);
    if (swaps.length) {
      let text = body.toString("utf8");
      for (const [, find, put] of swaps) {
        if (!text.match(find)) throw new Error(`tests/serve.mjs: couldn't find ${find} in ${file} (update SWAPS)`);
        text = text.replace(find, put);
      }
      body = text;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch (err) {
    if (err.code === "ENOENT") return res.writeHead(404).end();
    console.error(err);
    res.writeHead(500).end(String(err.message));
  }
}).listen(PORT, () => console.log(`Test site on http://localhost:${PORT}`));
