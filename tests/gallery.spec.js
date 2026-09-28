// The object gallery (`npm run gallery`): every kind of object the house
// can draw (FURNITURE_DRAWERS), each in its own labeled tile, saved as
// pictures in tests/gallery/ (48 to a page). For checking the art all at
// once: does everything have an outline, shading, a highlight, texture and
// a shadow (rule 14 in CLAUDE.md), and does it all look like one game?
// Each object is drawn with its real settings from the house when there is
// one (or its Nest & Nook entry), in daylight, on a plain background.
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { enterHouse } from "./helpers.js";

const OUT = new URL("./gallery/", import.meta.url);

test("every object, side by side", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await enterHouse(page);
  await page.evaluate(async () => {
    const w = await import("./weather.js");
    w.previewSky("clear");
    w.previewTime("day");
  });
  const pages = await page.evaluate(() => {
    const CELL = 170, COLS = 8, ROWS = 6;
    const kinds = Object.keys(FURNITURE_DRAWERS).sort();
    const decor = Object.values(DECOR);
    const failed = [];
    const out = [];
    for (let start = 0; start < kinds.length; start += COLS * ROWS) {
      const canvas = document.createElement("canvas");
      canvas.width = CELL * COLS;
      canvas.height = CELL * ROWS;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#d8cfbd";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      kinds.slice(start, start + COLS * ROWS).forEach((kind, i) => {
        const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.strokeRect(cx + 0.5, cy + 0.5, CELL - 1, CELL - 1);
        const f = { ...(FURNITURE.find((x) => x.kind === kind) ?? decor.find((d) => d.kind === kind) ?? { x: 0, y: 0, w: 1, h: 0.6 }) };
        f.x ??= 0;
        f.y ??= 0;
        f.w ??= 1;
        f.h ??= 0.6;
        f.color ??= "#d98a6a"; // (beds and desks take their owner's color)
        f.screen ??= f.color;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, CELL, CELL - 16);
        ctx.clip();
        const foot = toScreen(f.x + f.w / 2, f.y + f.h);
        ctx.translate(cx + CELL / 2 - foot.x, cy + CELL - 30 - foot.y);
        try {
          viewFloor = floorOf(f.y);
          FURNITURE_DRAWERS[kind](ctx, f);
        } catch (err) {
          failed.push(`${kind}: ${err.message}`);
        }
        ctx.restore();
        ctx.fillStyle = "#3a2a1c";
        ctx.font = "600 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(kind, cx + CELL / 2, cy + CELL - 5);
      });
      out.push(canvas.toDataURL("image/png"));
    }
    return { out, failed, count: kinds.length };
  });
  const { writeFileSync } = await import("node:fs");
  pages.out.forEach((url, i) => writeFileSync(new URL(`page-${i + 1}.png`, OUT), Buffer.from(url.split(",")[1], "base64")));
  console.log(`${pages.count} objects on ${pages.out.length} pages in tests/gallery/`);
  if (pages.failed.length) console.log("Couldn't draw:\n  " + pages.failed.join("\n  "));
});
