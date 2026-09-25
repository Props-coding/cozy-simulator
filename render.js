// Stardew-style drawing: turning grid positions (from world.js) into the
// picture on the canvas. This is the only file that knows about screen
// pixels; world.js and main.js only ever think in grid units.
//
// The look (see CLAUDE.md's "Stardew-style rendering" section):
// - The floor is a flat grid of square tiles, seen straight from above.
// - Walls, furniture and characters stand upright on the floor: each has
//   a lighter top surface, a front face, and a darker band at its base.
// - One light, straight from above, so every soft shadow sits directly
//   under its object.
// - Draw order, one rule: whatever stands lower on screen draws in front.

// --- Grid to screen ---
// Every drawing function below goes through this one formula, so nothing
// can drift out of alignment with anything else.
const TILE = 46; // one grid unit (one floor tile), in screen pixels
const ORIGIN_X = 86; // where grid (0,0) lands on the canvas, in pixels
const ORIGIN_Y = 77;

function toScreen(gx, gy) {
  return { x: ORIGIN_X + gx * TILE, y: ORIGIN_Y + gy * TILE };
}

const WOOD = "#7a5c3e";
const WOOD_DARK = "#5c4530";
const WALL_HEIGHT = 40; // how tall walls stand, in screen pixels
const LOW_WALL_HEIGHT = 8; // the front (bottom) wall, kept short so it doesn't hide the rooms

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shortens text to at most `max` characters, counting an emoji (even a
// combined one like 👍🏽, which is really several hidden pieces) as one
// character so it never gets cut in half. Adds `ending` (like "…") when
// something was cut off.
function clipText(text, max, ending = "") {
  const chars = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
  if (chars.length <= max) return text;
  return chars.slice(0, max - (ending ? 1 : 0)).join("") + ending;
}

// Lightens (positive amt) or darkens (negative amt) a "#rrggbb" color.
function shadeColor(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  // As "#rrggbb", so a shaded color can be shaded again.
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// A warm little lamp glow: a soft halo around a light source.
function drawGlow(ctx, cx, cy, r, color) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 220, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// --- The two building blocks: shadows and upright blocks ---

// A soft oval shadow on the floor, centered under the bottom edge of a
// footprint. Light comes from straight above, so shadows sit right under
// things, never off to one side.
function drawShadow(ctx, gx, gy, w, h) {
  const bottom = toScreen(gx + w / 2, gy + h);
  ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
  ctx.beginPath();
  ctx.ellipse(bottom.x, bottom.y, (w * TILE) / 2 + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Draws something standing on the floor: a footprint (grid units) raised
// up by `height` pixels. You see its top surface (a little lighter, lit
// from above) and its front face (the base color, with a darker band
// along the bottom where it meets the floor). Returns the pixel box of
// the top surface and front face so callers can add details on them.
function drawBlock(ctx, gx, gy, w, h, height, color) {
  const a = toScreen(gx, gy);
  const b = toScreen(gx + w, gy + h);
  const pw = b.x - a.x;
  const topBox = { x: a.x, y: a.y - height, w: pw, h: b.y - a.y };
  const faceBox = { x: a.x, y: b.y - height, w: pw, h: height };

  ctx.fillStyle = shadeColor(color, 22);
  ctx.fillRect(topBox.x, topBox.y, topBox.w, topBox.h);
  ctx.fillStyle = color;
  ctx.fillRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
  // Darker band at the base, and a thin highlight on the top edge.
  const band = Math.min(4, height / 3);
  ctx.fillStyle = shadeColor(color, -30);
  ctx.fillRect(faceBox.x, faceBox.y + faceBox.h - band, faceBox.w, band);
  ctx.fillStyle = shadeColor(color, 40);
  ctx.fillRect(topBox.x, topBox.y, topBox.w, 1.5);

  return { top: topBox, face: faceBox };
}

// --- Floors (drawn first, flat, never cover anything) ---
// Floors and rugs never change, so they're painted once onto a hidden
// canvas and copied onto the screen each frame, which is much faster
// than redrawing hundreds of floorboards 60 times a second.

// A repeatable "random" number from 0 to 1 for a given n, so each
// floorboard gets its own slightly different shade that stays the same
// every time the page loads.
function noise(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Wood boards running left to right, each a slightly different shade,
// with staggered joins like a real floor.
function drawPlanks(ctx, box, color) {
  const plankH = TILE / 3;
  for (let row = 0; row * plankH < box.h; row++) {
    const y = box.y + row * plankH;
    let x = box.x - noise(row) * TILE * 3;
    for (let i = 0; x < box.x + box.w; i++) {
      const len = TILE * (2.5 + noise(row * 31 + i + 0.5) * 3); // boards of different lengths
      ctx.fillStyle = shadeColor(color, Math.round((noise(row * 31 + i) - 0.5) * 16));
      ctx.fillRect(x, y, len, plankH);
      ctx.fillStyle = "rgba(40, 20, 5, 0.18)";
      ctx.fillRect(x, y, 1, plankH); // join between boards
      x += len;
    }
    ctx.fillStyle = "rgba(40, 20, 5, 0.22)";
    ctx.fillRect(box.x, y + plankH - 1, box.w, 1); // gap between rows
  }
}

// Soft carpet: an even color with tiny flecks of lighter and darker fibers.
function drawCarpet(ctx, box, color) {
  ctx.fillStyle = color;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  for (let i = 0; i < (box.w * box.h) / 30; i++) {
    ctx.fillStyle = noise(i) > 0.5 ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(box.x + noise(i + 0.3) * box.w, box.y + noise(i + 0.7) * box.h, 2, 2);
  }
}

// Small kitchen-style tiles, alternating the room color with a slightly
// lighter shade of it, with thin grout lines.
function drawChecker(ctx, box, color) {
  const size = TILE / 2;
  for (let ty = 0; ty * size < box.h; ty++) {
    for (let tx = 0; tx * size < box.w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? color : shadeColor(color, 22);
      ctx.fillRect(box.x + tx * size, box.y + ty * size, size, size);
      ctx.strokeStyle = "rgba(90, 60, 40, 0.12)";
      ctx.strokeRect(box.x + tx * size + 0.5, box.y + ty * size + 0.5, size - 1, size - 1);
    }
  }
}

// Bare concrete: big poured slabs with seams, a few stains and cracks.
function drawConcrete(ctx, box, color) {
  ctx.fillStyle = color;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  for (let x = box.x + TILE * 1.8; x < box.x + box.w; x += TILE * 1.8) ctx.fillRect(x, box.y, 1.5, box.h);
  for (let y = box.y + TILE * 1.5; y < box.y + box.h; y += TILE * 1.5) ctx.fillRect(box.x, y, box.w, 1.5);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(40, 35, 25, ${0.05 + noise(i + 9) * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(box.x + noise(i + 1.1) * box.w, box.y + noise(i + 2.3) * box.h, 10 + noise(i) * 22, 6 + noise(i + 4) * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(30, 30, 30, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = box.x + noise(i + 20) * box.w, y = box.y + noise(i + 30) * box.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += 6 + noise(i * 7 + j) * 8;
      y += (noise(i * 5 + j + 0.5) - 0.5) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Cinema carpet: the room color with a scattered pattern of little gold
// stars and swirls, like an old movie palace.
function drawCinemaCarpet(ctx, box, color) {
  drawCarpet(ctx, box, color);
  const step = TILE * 0.9;
  for (let row = 0, y = box.y + step / 2; y < box.y + box.h; row++, y += step) {
    for (let x = box.x + step / 2 + (row % 2) * (step / 2); x < box.x + box.w; x += step) {
      ctx.fillStyle = "rgba(224, 184, 76, 0.28)";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { // a little five-point star
        const r = k % 2 ? 1.6 : 4, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(224, 184, 76, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + step / 2, y, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
}

const FLOOR_STYLES = { planks: drawPlanks, carpet: drawCarpet, checker: drawChecker, concrete: drawConcrete, cinema: drawCinemaCarpet };

// The look of each secret office theme: floor, wall color, a pattern on
// the walls, and a tint over the whole room (warm or cold).
const OFFICE_THEME_STYLE = {
  lakehouse: { floor: { style: "planks", color: "#a8744c" }, wall: "#9c6b43", wallPattern: "logs", tint: "rgba(255, 160, 80, 0.10)" },
  stalker: { floor: { style: "concrete", color: "#8e908b" }, wall: "#8a8d88", wallPattern: "concrete", tint: "rgba(30, 60, 50, 0.16)" },
  scholar: { floor: { style: "planks", color: "#7a4a32" }, wall: "#eadcc0", wallPattern: "lacquer", tint: "rgba(255, 190, 120, 0.08)" },
  cottage: { floor: { style: "planks", color: "#5c3d2a" }, wall: "#3e4a36", wallPattern: "ivy", tint: "rgba(110, 55, 20, 0.14)" },
};

// Outside the house: a soft lawn with little tufts of grass and a few
// flowers, so empty office spots look like garden, not a dark gap.
function paintYard(ctx) {
  if (viewFloor === 1) {
    paintRoof(ctx);
    return;
  }
  const { left, right, top, bottom } = houseBounds();
  ctx.fillStyle = "#93b06c";
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const w = right - left, h = bottom - top;
  for (let i = 0; i < (w * h) / 700; i++) {
    const x = left + noise(i * 1.7) * w, y = top + noise(i * 2.3 + 5) * h;
    ctx.strokeStyle = noise(i + 11) > 0.5 ? "rgba(70, 110, 50, 0.45)" : "rgba(180, 210, 130, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
    if (noise(i + 23) > 0.93) {
      ctx.fillStyle = noise(i + 31) > 0.5 ? "#f7f1e6" : "#f2c94c";
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Upstairs, everything outside the rooms is the roof below you: rows of
// warm clay shingles, each a slightly different shade.
function paintRoof(ctx) {
  const { left, right, top, bottom } = houseBounds();
  ctx.fillStyle = "#6a3f33";
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  for (let y = top - 6, row = 0; y < bottom + 12; y += 11, row++) {
    for (let x = left - 18 + (row % 2) * 9, i = 0; x < right + 18; x += 18, i++) {
      ctx.fillStyle = shadeColor("#8a5242", Math.round((noise(row * 37 + i * 1.3) - 0.5) * 22));
      roundRectPath(ctx, x, y, 17, 12, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(30, 15, 10, 0.3)";
      ctx.fillRect(x + 1, y + 10, 15, 2);
    }
  }
}

function drawRug(ctx, f) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, h = f.h * TILE;
  if (f.shape === "heart") {
    const cx = a.x + w / 2, cy = a.y + h / 2;
    for (const [grow, color] of [[0, f.color], [-6, shadeColor(f.color, 30)], [-11, f.color]]) {
      const s = Math.min(w, h * 1.2) / 2 + grow;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.75);
      ctx.bezierCurveTo(cx - s * 1.35, cy, cx - s * 0.75, cy - s * 0.95, cx, cy - s * 0.35);
      ctx.bezierCurveTo(cx + s * 0.75, cy - s * 0.95, cx + s * 1.35, cy, cx, cy + s * 0.75);
      ctx.fill();
    }
    return;
  }
  if (f.shape === "checker") {
    roundRectPath(ctx, a.x, a.y, w, h, 8);
    ctx.save();
    ctx.clip();
    const size = 16;
    for (let yy = 0; yy < h; yy += size) {
      for (let xx = 0; xx < w; xx += size) {
        ctx.fillStyle = ((xx + yy) / size) % 2 ? f.color : "#f7f1e6";
        ctx.fillRect(a.x + xx, a.y + yy, size, size);
      }
    }
    ctx.restore();
    return;
  }
  if (f.shape === "fluffy") {
    const cx = a.x + w / 2, cy = a.y + h / 2;
    ctx.fillStyle = f.color;
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * (w / 2 - 5), cy + Math.sin(ang) * (h / 2 - 5), 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2 - 5, h / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < 40; i++) ctx.fillRect(a.x + 8 + noise(i * 2.9) * (w - 16), a.y + 8 + noise(i * 6.1) * (h - 16), 2, 1);
    return;
  }
  if (f.round) {
    // A round (oval) rug with rings.
    const cx = a.x + w / 2, cy = a.y + h / 2;
    for (const [shrink, color] of [[0, f.color], [8, shadeColor(f.color, 30)], [14, f.color], [22, shadeColor(f.color, 30)]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, w / 2 - shrink), Math.max(2, h / 2 - shrink * (h / w)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  roundRectPath(ctx, a.x, a.y, w, h, 10);
  ctx.fillStyle = f.color;
  ctx.fill();
  roundRectPath(ctx, a.x + 6, a.y + 6, w - 12, h - 12, 7);
  ctx.strokeStyle = shadeColor(f.color, 45);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = shadeColor(f.color, 30);
  const count = Math.floor((w - 30) / 26);
  for (let i = 0; i < count; i++) {
    const cx = a.x + w / 2 + (i - (count - 1) / 2) * 26, cy = a.y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
  }
}

function paintFloors(ctx) {
  paintYard(ctx);
  for (const room of ROOMS) {
    const floor = room.theme ? OFFICE_THEME_STYLE[room.theme].floor : CONFIG.roomFloors[room.owned?.kind] || CONFIG.roomFloors[room.id] || CONFIG.roomFloors.office;
    const a = toScreen(room.rect.x, room.rect.y);
    // Rooms north of a corridor also get floor under the corridor's wall,
    // so their doorways show floor, not grass.
    const underWall = room.north ? WALL_THICKNESS : 0;
    const box = { x: a.x, y: a.y, w: room.rect.w * TILE, h: (room.rect.h + underWall) * TILE };
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip(); // keep each room's pattern inside its own room
    FLOOR_STYLES[floor.style](ctx, box, floor.color);
    ctx.restore();
  }

  // Rugs lie flat on the floor: a main color, a lighter inner border,
  // and a row of diamonds down the middle.
  for (const f of FURNITURE) {
    if (f.kind === "rug") drawRug(ctx, f);
  }
}

// Which floor is being drawn (0 downstairs, 1 upstairs): the one you're
// on. drawScene sets it each frame.
let viewFloor = 0;

// The floor being drawn, in screen pixels, from the west wall to the east
// wall, with a little margin. Both floors are the same size, so the view
// doesn't change size when you take the stairs. Used for the saved floor
// picture and for fitting the house to the window.
function houseBounds() {
  const base = viewFloor * UPSTAIRS;
  return {
    left: toScreen(-WALL_THICKNESS, 0).x - 6,
    right: toScreen(HOUSE_WIDTH + WALL_THICKNESS, 0).x + 6,
    // Room above the north wall for its height and tall things against it.
    top: toScreen(0, base + houseTopY).y - WALL_HEIGHT - 14,
    bottom: toScreen(0, base + 11 + WALL_THICKNESS).y + 6,
  };
}

// The whole house's size, in the house's own pixels (before scaling).
// main.js uses this to size the view to fit the window.
function houseViewSize() {
  const b = houseBounds();
  return { w: b.right - b.left, h: b.bottom - b.top };
}

// How many screen pixels each of the house's own pixels takes up. main.js
// sets this to fit the window (already including high-resolution screens).
let viewScale = 1;

function setViewScale(scale) {
  if (scale === viewScale) return;
  viewScale = scale;
  floorVersion = -1; // repaint the floor at the new size so it stays crisp
}

let floorCanvas = null;
let floorVersion = -1; // which house version (and floor) the saved picture shows

// The doormats have writing on them, so repaint the floor once the cozy
// font has finished loading (in case the first paint happened before).
document.fonts?.ready.then(() => {
  floorVersion = -1;
});

function drawFloors(ctx) {
  // Repaint only when the house has changed (an office was added, removed
  // or locked), not every frame.
  const version = houseVersion + "/" + viewFloor;
  if (floorVersion !== version) {
    // Painted at full screen resolution, so copying it in is pixel-for-pixel.
    const { left, right, top, bottom } = houseBounds();
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = Math.ceil((right - left) * viewScale);
    floorCanvas.height = Math.ceil((bottom - top) * viewScale);
    const fctx = floorCanvas.getContext("2d");
    fctx.scale(viewScale, viewScale);
    fctx.translate(-left, -top);
    paintFloors(fctx);
    floorVersion = version;
  }
  const { left, top } = houseBounds();
  ctx.drawImage(floorCanvas, left, top, floorCanvas.width / viewScale, floorCanvas.height / viewScale);
}

// --- Walls ---
// Splits a wall's front face into stretches by which room each stretch
// faces (the room just below it). Returns [{ x0, x1, room }] in grid units.
function wallFaceParts(wall) {
  const below = wall.y + wall.h + 0.01;
  const edges = new Set([wall.x, wall.x + wall.w]);
  for (const r of ROOMS) {
    if (below >= r.rect.y && below <= r.rect.y + r.rect.h) {
      for (const x of [r.rect.x, r.rect.x + r.rect.w]) if (x > wall.x && x < wall.x + wall.w) edges.add(x);
    }
  }
  const xs = [...edges].sort((p, q) => p - q);
  const parts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const mid = (xs[i] + xs[i + 1]) / 2;
    const room = ROOMS.find((r) => mid >= r.rect.x && mid <= r.rect.x + r.rect.w && below >= r.rect.y && below <= r.rect.y + r.rect.h);
    parts.push({ x0: xs[i], x1: xs[i + 1], room });
  }
  return parts;
}

// Simple panels: a wood top edge, a painted front face (each room has its
// own wall color, see config.js), and a dark baseboard line where the wall
// meets the floor. Walls running up and
// down the screen (taller than wide) are all wood: their front face would
// only be a sliver at the bottom end. A soft shade on the floor just
// below the wall helps it read as standing up.
function drawWall(ctx, wall) {
  const height = wall.low ? LOW_WALL_HEIGHT : WALL_HEIGHT;
  const a = toScreen(wall.x, wall.y);
  const b = toScreen(wall.x + wall.w, wall.y + wall.h);

  const shade = ctx.createLinearGradient(0, b.y, 0, b.y + 10);
  shade.addColorStop(0, "rgba(40, 25, 10, 0.22)");
  shade.addColorStop(1, "rgba(40, 25, 10, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(a.x, b.y, b.x - a.x, 10);

  // Top edge (the wood cap you see from above).
  ctx.fillStyle = WOOD;
  ctx.fillRect(a.x, a.y - height, b.x - a.x, b.y - a.y);
  // Front face. Each stretch of it takes the look of the room it faces
  // (the one just below it), so a long wall shared by several rooms is
  // painted to match each of them.
  const hasFace = !wall.low && wall.w > wall.h;
  if (!hasFace) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - height, b.x - a.x, height);
    return;
  }
  for (const part of wallFaceParts(wall)) {
    const left = toScreen(part.x0, 0).x, right = toScreen(part.x1, 0).x, w = right - left;
    if (!part.room) {
      // Facing outside (the garden): warm wooden house siding.
      ctx.fillStyle = "#a07c55";
      ctx.fillRect(left, b.y - height, w, height);
      ctx.fillStyle = "rgba(60, 35, 15, 0.28)";
      for (let y = b.y - height + 6; y < b.y - 2; y += 7) ctx.fillRect(left, y, w, 1.5);
      ctx.fillStyle = "rgba(255, 235, 200, 0.12)";
      for (let y = b.y - height + 1; y < b.y - 2; y += 7) ctx.fillRect(left, y, w, 1);
      continue;
    }
    const themeStyle = OFFICE_THEME_STYLE[part.room?.theme];
    ctx.fillStyle = themeStyle?.wall || CONFIG.roomWallColors[part.room?.owned?.kind] || CONFIG.roomWallColors[part.room?.id] || CONFIG.roomWallColors.office;
    ctx.fillRect(left, b.y - height, w, height);
    ctx.fillStyle = WOOD_DARK; // baseboard
    ctx.fillRect(left, b.y - 5, w, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // a thin trim line near the top
    ctx.fillRect(left, b.y - height + 3, w, 2);
    if (themeStyle) drawWallPattern(ctx, themeStyle.wallPattern, left, b.y - height, w, height);
    // Hallway and landing walls get wood paneling on the bottom part, with a rail on top.
    if (part.room?.id === "hallway" || part.room?.id === "landing") {
      const panelTop = b.y - 18;
      ctx.fillStyle = "#b08a60";
      ctx.fillRect(left, panelTop, w, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      for (let px = left + 12; px < right; px += 24) ctx.fillRect(px, panelTop + 3, 1, 9);
      ctx.fillStyle = WOOD;
      ctx.fillRect(left, panelTop - 2, w, 3);
    }
  }
}

// Where each bulb on a string of lights sits: a gentle droop between
// the two ends, along the top of the wall it hangs on.
function stringLightBulbs(f) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, top = a.y - WALL_HEIGHT + 6;
  const bulbs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    bulbs.push({ x: a.x + 4 + t * (w - 8), y: top + Math.sin(t * Math.PI) * 8 });
  }
  return bulbs;
}

// What's painted in each framed picture (see "picture" below).
const PICTURE_ART = {
  // Rolling green hills under a sunset.
  hills(ctx, x, y, w, h) {
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, "#f2b38a");
    sky.addColorStop(1, "#f7dcb0");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#f7e08a";
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h * 0.55, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a9e5c";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.25, y + h, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c8a54";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.8, y + h, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  // The sea with a little sailboat.
  sea(ctx, x, y, w, h) {
    ctx.fillStyle = "#bfe0ee";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#4a90a4";
    ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
    ctx.fillStyle = "#f7f1e6";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.58);
    ctx.lineTo(x + w * 0.45, y + h * 0.15);
    ctx.lineTo(x + w * 0.62, y + h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(x + w * 0.35, y + h * 0.58, w * 0.32, 2);
  },
  // A little vase of flowers on a warm background.
  flowers(ctx, x, y, w, h) {
    ctx.fillStyle = "#f3e6d0";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#4a90a4";
    ctx.fillRect(x + w / 2 - 3, y + h - 7, 6, 7);
    for (const [dx, dy, color] of [[-6, -11, "#e37aa0"], [0, -13, "#c0554a"], [6, -10, "#e0a84c"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w / 2 + dx, y + h + dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Extra detail on a themed office's walls: stacked logs, poured concrete
// with rust stains, or plaster with a red lacquer band.
function drawWallPattern(ctx, pattern, x, y, w, h) {
  if (pattern === "logs") {
    for (let ly = y + 3; ly < y + h - 6; ly += 8) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(x, ly, w, 1.5);
      ctx.fillStyle = "rgba(40, 20, 5, 0.3)";
      ctx.fillRect(x, ly + 6, w, 1.5);
    }
  } else if (pattern === "concrete") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    for (let sx = x + 22; sx < x + w; sx += 30) ctx.fillRect(sx, y, 1, h - 5);
    ctx.fillStyle = "rgba(40, 40, 40, 0.35)"; // tie holes left by the concrete forms
    for (let sx = x + 11; sx < x + w; sx += 30) {
      ctx.fillRect(sx, y + 10, 2, 2);
      ctx.fillRect(sx, y + 24, 2, 2);
    }
    ctx.fillStyle = "rgba(138, 75, 42, 0.25)"; // rust streak
    ctx.fillRect(x + w * 0.6, y + 4, 3, h - 12);
  } else if (pattern === "ivy") {
    // Dark wood paneling on the lower wall, and ivy creeping along the top
    // with strands hanging down.
    ctx.fillStyle = "rgba(40, 22, 12, 0.4)";
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45 - 4);
    ctx.fillStyle = "rgba(255, 220, 170, 0.12)";
    ctx.fillRect(x, y + h * 0.55, w, 1);
    ctx.strokeStyle = "#3d5a2a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    for (let sx = x; sx <= x + w; sx += 6) ctx.lineTo(sx, y + 4 + Math.sin(sx * 0.3) * 1.5);
    ctx.stroke();
    let i = 0;
    for (let sx = x + 5; sx < x + w - 3; sx += 13, i++) drawIvySprig(ctx, sx, y + 4, 6 + ((i * 7) % 11), i % 2 ? 1 : -1);
  } else if (pattern === "lacquer") {
    ctx.fillStyle = "#9a2f24";
    ctx.fillRect(x, y + 5, w, 4);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y + 9, w, 1);
  }
}

// --- Helpers for turned furniture (see the "...Side" drawers) ---

// Draws a turned piece: as is when it faces right, mirrored when it faces
// left (light comes from above, so a mirror image still looks right).
function sideView(ctx, f, draw) {
  if (f.facing !== "left") {
    draw();
    return;
  }
  const mid = toScreen(f.x + f.w / 2, f.y).x;
  ctx.save();
  ctx.translate(mid, 0);
  ctx.scale(-1, 1);
  ctx.translate(-mid, 0);
  draw();
  ctx.restore();
}

// A shelf seen from the side: a plain side panel, and a row of book (or
// basket) edges along its front.
function drawShelfSide(ctx, f, height, color, fronts = ["#c0554a", "#4a90a4", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a"]) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const s = drawBlock(ctx, f.x, f.y, f.w, f.h, height, color);
  const { x, y, w, h } = s.face;
  ctx.strokeStyle = "rgba(40, 25, 10, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 4, w - 10, h - 10);
  // Book spines (or baskets) peeking out along the front edge, shelf by shelf.
  for (let row = 0, rows = Math.max(2, Math.round(height / 26)); row < rows; row++) {
    const rowY = y + 5 + (row * (h - 10)) / rows;
    for (let k = 0; k * 5 < s.top.h + h / rows - 6 && k < 8; k++) {
      ctx.fillStyle = fronts[(k + row) % fronts.length];
      ctx.fillRect(x + w - 4, rowY + k * 3, 3, 2.5);
    }
  }
  // Seen from above, the tops of the books (or baskets) line the front edge.
  const t = s.top;
  ctx.fillStyle = shadeColor(color, -25);
  ctx.fillRect(t.x + t.w - 8, t.y, 8, t.h);
  for (let by = t.y + 2, k = 0; by < t.y + t.h - 3; k++) {
    const bh = 3 + (k * 7) % 4;
    ctx.fillStyle = fronts[k % fronts.length];
    ctx.fillRect(t.x + t.w - 7, by, 6, Math.min(bh, t.y + t.h - 2 - by));
    by += bh + 0.8;
  }
}

// A bed seen from the side, headboard against the wall (on the left):
// pillows by the headboard and the blanket over the rest.
function drawBedSide(ctx, f, height, frameColor, headboard) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const board = 0.25;
  const frame = drawBlock(ctx, f.x + (headboard ? board : 0), f.y, f.w - (headboard ? board : 0), f.h, height, frameColor);
  if (headboard) {
    const head = drawBlock(ctx, f.x, f.y - 0.05, board, f.h + 0.1, 34, "#6b4630");
    ctx.fillStyle = "rgba(255, 235, 200, 0.18)";
    ctx.fillRect(head.face.x + 2, head.face.y + 5, head.face.w - 4, head.face.h - 12);
  }
  const { x, y, w, h } = frame.top;
  ctx.fillStyle = "#f5eee2"; // sheet
  ctx.fillRect(x + 2, y + 3, w - 4, h - 6);
  for (const py of [y + 6, y + h / 2 + 2]) { // two pillows, side by side along the headboard
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, x + 4, py, 15, h / 2 - 9, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(x + 15, py + 3, 2, h / 2 - 15);
  }
  const left = x + 24; // the blanket, with its folded-back cuff
  const blanket = ctx.createLinearGradient(left, 0, x + w, 0);
  blanket.addColorStop(0, shadeColor(f.color, 30));
  blanket.addColorStop(1, shadeColor(f.color, -10));
  ctx.fillStyle = blanket;
  roundRectPath(ctx, left, y + 1, x + w - left - 1, h - 2 + frame.face.h - 3, 5);
  ctx.fill();
  ctx.fillStyle = shadeColor(f.color, 55);
  ctx.fillRect(left, y + 1, 6, h - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // quilted lines
  for (let qx = left + 14; qx < x + w - 4; qx += 12) ctx.fillRect(qx, y + 3, 1, h - 6);
}

// A sofa seen from the side, back against the wall (on the left), arms at
// both ends, and throw pillows against the back.
function drawSofaSide(ctx, f, c) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  drawBlock(ctx, f.x, f.y + 0.05, 0.28, f.h - 0.1, 30, shadeColor(c, -15)); // back
  const seat = drawBlock(ctx, f.x + 0.22, f.y + 0.15, f.w - 0.22, f.h - 0.3, 13, c);
  drawBlock(ctx, f.x + 0.1, f.y, f.w - 0.1, 0.18, 19, shadeColor(c, -15)); // arms
  drawBlock(ctx, f.x + 0.1, f.y + f.h - 0.18, f.w - 0.1, 0.18, 19, shadeColor(c, -15));
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"; // the seam between the cushions
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(seat.top.x + 2, seat.top.y + seat.top.h / 2);
  ctx.lineTo(seat.top.x + seat.top.w - 2, seat.top.y + seat.top.h / 2);
  ctx.stroke();
  for (const [fy, color] of [[0.25, "#f2d9a0"], [0.75, "#e0845a"]]) {
    ctx.fillStyle = color; // throw pillows against the back
    roundRectPath(ctx, seat.top.x - 2, seat.top.y + seat.top.h * fy - 8, 9, 14, 4);
    ctx.fill();
  }
}

// A desk seen from the side, against the wall (on the left), with a lamp,
// flowers or the laptop (its screen turned to face into the room).
function drawDeskSide(ctx, f, color, topper) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, color);
  const { x, y, w, h } = d.top;
  if (topper === "laptop") {
    const lx = x + 4, ly = y + h / 2;
    ctx.fillStyle = "#c8c8d0"; // keyboard base, lying flat
    ctx.fillRect(lx + 4, ly - 14, w - 12, 28);
    ctx.fillStyle = "#3a3a44"; // the lid, standing up at the back, screen facing the room
    ctx.fillRect(lx, ly - 30, 5, 34);
    const glow = ctx.createLinearGradient(lx + 5, 0, lx + 9, 0);
    glow.addColorStop(0, "#bfe3f2");
    glow.addColorStop(1, "rgba(127, 178, 214, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(lx + 5, ly - 28, 4, 30);
    ctx.fillStyle = "#f2ece2"; // mug
    ctx.fillRect(x + w - 10, y + 5, 6, 7);
  } else if (topper === "lamp") {
    ctx.fillStyle = "#f4ecdc"; // paper
    ctx.fillRect(x + w / 2 - 6, y + h / 2 - 4, 12, 16);
    const lx = x + 8, ly = y + 12;
    ctx.fillStyle = "#4f7a48"; // a green banker's lamp by the wall
    ctx.fillRect(lx - 1, ly - 10, 2, 10);
    ctx.beginPath();
    ctx.ellipse(lx, ly - 11, 7, 3.5, 0, Math.PI, 0);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e8e0d0"; // a little vase of flowers and a notebook
    ctx.fillRect(x + 6, y + 8, 6, 9);
    for (const [dx, c] of [[-2, "#f2a0b8"], [2, "#fff2a8"], [0, "#c8b0e8"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 9 + dx, y + 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e98ac0";
    ctx.fillRect(x + w / 2 - 5, y + h / 2, 12, 16);
  }
}

// The shapes for wall cutouts, each drawn around (0, 0), about 16 pixels
// across (see wallCutout).
function drawBat(ctx, s = 1) {
  ctx.fillStyle = "#2a2230";
  ctx.beginPath(); // wings: scalloped along the bottom edge
  ctx.moveTo(0, -1 * s);
  ctx.quadraticCurveTo(-4 * s, -5 * s, -8 * s, -3 * s);
  ctx.quadraticCurveTo(-7 * s, 0, -8 * s, 2 * s);
  ctx.quadraticCurveTo(-6 * s, 0.5 * s, -5 * s, 2.5 * s);
  ctx.quadraticCurveTo(-3.5 * s, 1 * s, -2 * s, 2.5 * s);
  ctx.lineTo(0, 1.5 * s);
  ctx.lineTo(2 * s, 2.5 * s);
  ctx.quadraticCurveTo(3.5 * s, 1 * s, 5 * s, 2.5 * s);
  ctx.quadraticCurveTo(6 * s, 0.5 * s, 8 * s, 2 * s);
  ctx.quadraticCurveTo(7 * s, 0, 8 * s, -3 * s);
  ctx.quadraticCurveTo(4 * s, -5 * s, 0, -1 * s);
  ctx.fill();
  ctx.beginPath(); // body and ears
  ctx.ellipse(0, 0, 1.8 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.moveTo(-1.5 * s, -2 * s);
  ctx.lineTo(-1 * s, -4 * s);
  ctx.lineTo(-0.3 * s, -2.4 * s);
  ctx.moveTo(1.5 * s, -2 * s);
  ctx.lineTo(1 * s, -4 * s);
  ctx.lineTo(0.3 * s, -2.4 * s);
  ctx.fill();
  if (s >= 1) {
    ctx.fillStyle = "#f2d07a"; // little eyes
    ctx.fillRect(-1 * s, -1 * s, 0.8 * s, 0.8 * s);
    ctx.fillRect(0.3 * s, -1 * s, 0.8 * s, 0.8 * s);
  }
}

const CUTOUTS = {
  bat: (ctx) => drawBat(ctx, 1),
  bats(ctx) {
    for (const [x, y, s] of [[-5, 3, 0.55], [2, -3, 0.7], [7, 4, 0.5]]) {
      ctx.save();
      ctx.translate(x, y);
      drawBat(ctx, s);
      ctx.restore();
    }
  },
  ghost(ctx) {
    ctx.fillStyle = "#fbf7f0";
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.lineTo(-6, -1);
    ctx.arc(0, -1, 6, Math.PI, 0);
    ctx.lineTo(6, 7);
    for (let k = 0; k < 3; k++) { // wavy hem
      ctx.quadraticCurveTo(6 - k * 4 - 1, 4, 6 - k * 4 - 2, 7);
      ctx.quadraticCurveTo(6 - k * 4 - 3, 9, 6 - k * 4 - 4, 7);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 80, 100, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#2a2230"; // face: two eyes and a little "oo" mouth, each its own shape
    for (const [x, y, rx, ry] of [[-2.3, -1.6, 0.9, 1.3], [2.3, -1.6, 0.9, 1.3], [0, 2.4, 0.9, 1.1]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(240, 150, 170, 0.5)"; // rosy cheeks
    ctx.fillRect(-4.2, 0.2, 1.6, 1);
    ctx.fillRect(2.6, 0.2, 1.6, 1);
  },
  jack(ctx) {
    ctx.fillStyle = "#e07a2e";
    ctx.beginPath();
    ctx.ellipse(0, 1, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 70, 20, 0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 1, 3, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#5a7a3a";
    ctx.fillRect(-1, -6, 2, 2.5);
    ctx.fillStyle = "#3a2418"; // carved face
    ctx.beginPath();
    ctx.moveTo(-4, -0.5);
    ctx.lineTo(-2, -2.5);
    ctx.lineTo(-1, -0.5);
    ctx.moveTo(4, -0.5);
    ctx.lineTo(2, -2.5);
    ctx.lineTo(1, -0.5);
    ctx.moveTo(-4, 2);
    ctx.lineTo(-2, 4);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(2, 4);
    ctx.lineTo(4, 2);
    ctx.fill();
  },
  snowflake(ctx, n) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    const r = 6 + (n % 2);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * r, dy * r);
      for (const side of [-1, 1]) { // little branches
        const bx = dx * r * 0.6, by = dy * r * 0.6;
        const ba = ang + side * 0.7;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ba) * 2.4, by + Math.sin(ba) * 2.4);
      }
    }
    ctx.stroke();
  },
  butterfly(ctx, n) {
    const colors = ["#f2a0b8", "#c8b0e8", "#fff2a8", "#a8d8e8"];
    ctx.fillStyle = colors[n % colors.length];
    for (const side of [-1, 1]) {
      for (const [x, y, rx, ry, tilt] of [[side * 3.5, -2, 3.8, 3, side * 0.5], [side * 3, 2.5, 2.6, 2.2, -side * 0.4]]) {
        ctx.beginPath(); // each wing its own shape
        ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (const x of [-3.5, 3.5]) {
      ctx.beginPath();
      ctx.arc(x, -2.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#5a4636"; // body and feelers
    ctx.fillRect(-0.6, -4, 1.2, 8);
    ctx.strokeStyle = "#5a4636";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-2, -7);
    ctx.moveTo(0, -4);
    ctx.lineTo(2, -7);
    ctx.stroke();
  },
  sun(ctx) {
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = k % 2 ? 4.5 : 7.5, ang = (k / 16) * Math.PI * 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#f7dc7a";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c"; // a happy face
    ctx.fillRect(-1.8, -1.2, 0.9, 0.9);
    ctx.fillRect(0.9, -1.2, 0.9, 0.9);
    ctx.strokeStyle = "#8a5a3c";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0.6, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },
  melon(ctx) {
    ctx.fillStyle = "#4f8a4a"; // rind
    ctx.beginPath();
    ctx.arc(0, -3, 8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#e8e0b0";
    ctx.beginPath();
    ctx.arc(0, -3, 6.8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#e8566a"; // fruit
    ctx.beginPath();
    ctx.arc(0, -3, 6, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#2a2230"; // seeds
    for (const [x, y] of [[-3, -1], [0, 0.5], [3, -1], [-1.5, 1.5], [1.5, 1.5]]) ctx.fillRect(x - 0.4, y - 0.6, 0.8, 1.2);
  },
};

// --- Furniture ---
// One function per kind. Each gets the furniture entry from world.js,
// draws its own shadow first, then its upright shape.
const FURNITURE_DRAWERS = {
  // A leafy plant in a round clay pot.
  plant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2;
    // Pot: a tapered clay pot with a rim.
    ctx.fillStyle = "#b86b4b";
    ctx.beginPath();
    ctx.moveTo(cx - 9, by);
    ctx.lineTo(cx + 9, by);
    ctx.lineTo(cx + 12, by - 16);
    ctx.lineTo(cx - 12, by - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a5439";
    ctx.fillRect(cx - 9, by - 3, 18, 3);
    ctx.fillStyle = "#cf8260";
    ctx.fillRect(cx - 13, by - 20, 26, 5);
    // Leaves fanning up and out of the pot, darker at the back.
    const leaves = [
      [-0.9, 22, "#3f6b3c"], [0.9, 22, "#3f6b3c"],
      [-0.5, 26, "#4f7a48"], [0.5, 26, "#4f7a48"],
      [-0.2, 24, "#6fa05e"], [0.2, 24, "#6fa05e"], [0, 20, "#7fb46a"],
    ];
    for (const [angle, len, color] of leaves) {
      ctx.save();
      ctx.translate(cx, by - 18);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -len / 2, 6, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // --- More plants (each with its own pot) ---

  // A Boston fern: lots of feathery fronds arching out and drooping over
  // the pot's rim.
  fern(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "clay", 10, 14);
    for (let i = -5; i <= 5; i++) {
      const angle = i * 0.28;
      const len = 26 - Math.abs(i) * 1.2;
      const tipX = base.x + Math.sin(angle) * len * 1.2, tipY = soil - Math.cos(angle) * len + Math.abs(i) * 3.2;
      const shade = ["#3f6b3c", "#4f7a48", "#5f8a50", "#6fa05e"][(i + 8) % 4];
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(base.x + Math.sin(angle) * len * 0.5, soil - len * 0.9, tipX, tipY);
      ctx.stroke();
      // Little leaflets along each frond.
      ctx.fillStyle = shade;
      for (let t = 0.3; t < 1; t += 0.14) {
        const px = base.x + (tipX - base.x) * t, py = soil + (tipY - soil) * t - Math.sin(t * Math.PI) * 8;
        ctx.beginPath();
        ctx.ellipse(px, py, 3.2 * (1.1 - t), 1.3, angle + 0.9, 0, Math.PI * 2);
        ctx.ellipse(px, py, 3.2 * (1.1 - t), 1.3, angle - 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A monstera: big glossy leaves with splits, on long stems, in a white pot.
  monstera(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "ceramic", 11, 17);
    const leaves = [[-14, -34, -0.5, "#2f5a36"], [13, -38, 0.45, "#2f5a36"], [-6, -48, -0.15, "#3d6b40"], [8, -28, 0.8, "#3d6b40"], [-17, -22, -1.0, "#4a7a48"]];
    for (const [dx, dy, tilt, color] of leaves) {
      const lx = base.x + dx, ly = soil + dy;
      ctx.strokeStyle = "#4f7a3a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(base.x + dx * 0.3, ly + 10, lx, ly + 6);
      ctx.stroke();
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(tilt);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-13, 4, -11, -10, 0, -9);
      ctx.bezierCurveTo(11, -10, 13, 4, 0, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"; // midrib
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(0, -8);
      ctx.stroke();
      ctx.strokeStyle = "rgba(20, 40, 20, 0.55)"; // the splits
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        for (const yy of [-4, 0, 4]) {
          ctx.beginPath();
          ctx.moveTo(s * 11, yy - 1);
          ctx.lineTo(s * 5, yy + 1);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  },

  // A tall column cactus with two arms and a tiny pink flower, in a blue pot.
  cactus(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "glazed", 10, 15);
    const body = (x, y, w, h) => {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, "#4f8a4a");
      g.addColorStop(0.5, "#6fae62");
      g.addColorStop(1, "#3f7340");
      ctx.fillStyle = g;
      roundRectPath(ctx, x - w / 2, y - h, w, h, w / 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 60, 30, 0.35)"; // ribs
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - w / 5, y - h + 3);
      ctx.lineTo(x - w / 5, y - 2);
      ctx.moveTo(x + w / 5, y - h + 3);
      ctx.lineTo(x + w / 5, y - 2);
      ctx.stroke();
    };
    body(base.x - 11, soil - 18, 7, 16); // left arm
    ctx.fillStyle = "#4f8a4a";
    ctx.fillRect(base.x - 11, soil - 22, 8, 5);
    body(base.x + 11, soil - 26, 7, 14); // right arm
    ctx.fillRect(base.x + 3, soil - 30, 8, 5);
    body(base.x, soil, 11, 48); // main column
    ctx.fillStyle = "#f2a0b8"; // flower on top
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(base.x + Math.cos(i * 1.26) * 2.5, soil - 48 + Math.sin(i * 1.26) * 2.5, 2, 1.3, i * 1.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(base.x, soil - 48, 1.3, 0, Math.PI * 2);
    ctx.fill();
  },

  // A snake plant: stiff upright leaves with yellow edges, in a cement pot.
  snakePlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "cement", 10, 16);
    const leaves = [[-7, 36, -0.12], [-2, 46, -0.04], [3, 42, 0.05], [8, 32, 0.14], [0, 30, 0.0]];
    for (const [dx, h, lean] of leaves) {
      ctx.save();
      ctx.translate(base.x + dx, soil);
      ctx.rotate(lean);
      ctx.fillStyle = "#e0c85a"; // yellow edge
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.quadraticCurveTo(-4.5, -h * 0.6, 0, -h);
      ctx.quadraticCurveTo(4.5, -h * 0.6, 4, 0);
      ctx.fill();
      ctx.fillStyle = "#3f6b3c";
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.quadraticCurveTo(-3.3, -h * 0.6, 0, -h + 3);
      ctx.quadraticCurveTo(3.3, -h * 0.6, 3, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(170, 200, 140, 0.35)"; // pale bands
      for (let y = -6; y > -h + 6; y -= 6) ctx.fillRect(-3, y, 6, 1.5);
      ctx.restore();
    }
  },

  // Three little succulent rosettes in a wide shallow clay dish.
  succulents(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const by = base.y - 2;
    ctx.fillStyle = "#b86b4b";
    roundRectPath(ctx, base.x - 16, by - 9, 32, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#cf8260";
    ctx.fillRect(base.x - 17, by - 11, 34, 3);
    for (const [dx, r, colors] of [[-9, 7, ["#7fae8a", "#a9d0b0"]], [3, 8, ["#8fa87a", "#c4d9a4"]], [11, 5.5, ["#9a8fb8", "#c9bfe0"]]]) {
      const cx = base.x + dx, cy = by - 12;
      for (let ring = 0; ring < 2; ring++) {
        ctx.fillStyle = colors[ring];
        const rr = r * (1 - ring * 0.45);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + ring * 0.4;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.35, rr * 0.45, rr * 0.25, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = "#dfeecf";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A fiddle-leaf fig: a slim trunk with big wavy leaves up top, in a
  // woven basket. Tall.
  fiddleFig(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "basket", 11, 16);
    ctx.strokeStyle = "#7a5a3a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(base.x, soil);
    ctx.quadraticCurveTo(base.x + 3, soil - 25, base.x - 1, soil - 44);
    ctx.stroke();
    const leaves = [[-9, -40, -0.9], [9, -44, 0.8], [-6, -54, -0.4], [7, -58, 0.5], [0, -64, 0], [-11, -30, -1.2], [10, -32, 1.1], [2, -50, 0.2]];
    leaves.forEach(([dx, dy, tilt], i) => {
      ctx.save();
      ctx.translate(base.x + dx, soil + dy);
      ctx.rotate(tilt);
      ctx.fillStyle = ["#2f5a36", "#3d6b40", "#4a7a48"][i % 3];
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-7, 5, -8, -2, -5, -6);
      ctx.bezierCurveTo(-3, -9, 3, -9, 5, -6);
      ctx.bezierCurveTo(8, -2, 7, 5, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -7);
      ctx.stroke();
      ctx.restore();
    });
  },

  // A kentia palm: arching feathery fronds, in a white pot.
  palm(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "ceramic", 11, 17);
    for (const [angle, len] of [[-1.1, 30], [-0.6, 40], [-0.15, 46], [0.3, 42], [0.75, 36], [1.15, 28]]) {
      const tipX = base.x + Math.sin(angle) * len, tipY = soil - Math.cos(angle) * len * 0.9 + Math.abs(angle) * 10;
      const midX = base.x + Math.sin(angle) * len * 0.45, midY = soil - len * 0.85;
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = "#4f8a4a"; // leaflets hanging off the frond
      for (let t = 0.25; t < 0.98; t += 0.09) {
        const u = 1 - t;
        const px = u * u * base.x + 2 * u * t * midX + t * t * tipX;
        const py = u * u * soil + 2 * u * t * midY + t * t * tipY;
        const drop = 7 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 3, py + drop);
        ctx.moveTo(px, py);
        ctx.lineTo(px + 3, py + drop);
        ctx.stroke();
      }
    }
  },

  // A little lemon tree: a round leafy top dotted with lemons, in clay.
  lemonTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "clay", 11, 16);
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(base.x - 1.5, soil - 22, 3, 22);
    for (const [dx, dy, r, color] of [[-8, -30, 10, "#3d6b40"], [8, -32, 10, "#3d6b40"], [0, -40, 11, "#4a7a48"], [-4, -26, 8, "#4f8a4a"], [6, -24, 8, "#4f8a4a"], [1, -34, 9, "#5f9a55"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(base.x + dx, soil + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d45c";
    for (const [dx, dy] of [[-10, -26], [7, -36], [-2, -44], [11, -27], [-6, -36]]) {
      ctx.beginPath();
      ctx.ellipse(base.x + dx, soil + dy, 2.6, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (const [dx, dy] of [[-10.8, -26.8], [6.2, -36.8]]) ctx.fillRect(base.x + dx, soil + dy, 1, 1);
  },

  // --- More furniture and decor (Nest & Nook, and a few around the house) ---

  // Hung on a wall face: a cork board with pinned notes, a photo and a
  // little calendar.
  corkBoard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 5, h = 26;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#c79a64";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "rgba(90, 55, 20, 0.25)"; // cork speckles
    for (let i = 0; i < w * 0.8; i++) ctx.fillRect(x + 3 + noise(i * 3.1) * (w - 6), y + 3 + noise(i * 5.7) * (h - 6), 1, 1);
    const notes = [[0.1, 4, 11, 9, "#fff3a8"], [0.36, 3, 10, 12, "#f7f4ee"], [0.58, 6, 12, 10, "#a8d8f0"], [0.8, 3, 9, 9, "#f5c6d6"]];
    notes.forEach(([fx, dy, nw, nh, color], i) => {
      const nx = x + fx * (w - nw);
      ctx.save();
      ctx.translate(nx + nw / 2, y + dy + nh / 2);
      ctx.rotate((i % 2 ? 1 : -1) * 0.08);
      ctx.fillStyle = color;
      ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
      ctx.fillStyle = "rgba(60, 50, 40, 0.35)"; // scribbles
      for (let l = 0; l < 3; l++) ctx.fillRect(-nw / 2 + 2, -nh / 2 + 3 + l * 2.5, nw - 4 - (l % 2) * 3, 0.8);
      ctx.fillStyle = ["#c0554a", "#3f6f9f", "#d9a441", "#4f7a48"][i]; // pin
      ctx.beginPath();
      ctx.arc(0, -nh / 2 + 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },

  // Hung on a wall face: a wooden shelf of jars and spices, with a little
  // plant at one end.
  jarShelf(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 20;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 2, w, 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x, y, w, 3.5);
    ctx.fillStyle = WOOD_DARK; // brackets
    ctx.fillRect(x + 4, y + 3, 2, 5);
    ctx.fillRect(x + w - 6, y + 3, 2, 5);
    const jars = [["#e0a84c", 9], ["#c0554a", 11], ["#f2ece2", 8], ["#7a9e5c", 10], ["#8a5a3c", 9], ["#e8c170", 7]];
    let jx = x + 4;
    for (const [color, jh] of jars) {
      if (jx + 7 > x + w - 12) break;
      ctx.fillStyle = "rgba(220, 235, 245, 0.55)"; // glass
      roundRectPath(ctx, jx, y - jh, 7, jh, 2);
      ctx.fill();
      ctx.fillStyle = color; // what's inside
      ctx.fillRect(jx + 1, y - jh * 0.7, 5, jh * 0.7 - 1);
      ctx.fillStyle = "#6b4a2e"; // lid
      ctx.fillRect(jx + 0.5, y - jh - 1.5, 6, 2);
      jx += 9;
    }
    ctx.fillStyle = "#b86b4b"; // a tiny potted herb at the end
    ctx.fillRect(x + w - 10, y - 6, 7, 6);
    ctx.fillStyle = "#5f9a55";
    ctx.beginPath();
    ctx.arc(x + w - 6.5, y - 9, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall face: a framed poster ("stars", "mountains" or "cat").
  poster(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = 30;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#2b2b30";
    ctx.fillRect(x, y, w, h);
    const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
    if (f.art === "stars") {
      const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
      sky.addColorStop(0, "#1e2a4a");
      sky.addColorStop(1, "#3f4f7a");
      ctx.fillStyle = sky;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = "#fff6d0";
      for (let i = 0; i < 14; i++) ctx.fillRect(ix + noise(i * 2.3) * iw, iy + noise(i * 4.1) * ih * 0.8, 1, 1);
      ctx.beginPath();
      ctx.arc(ix + iw * 0.72, iy + ih * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e2a4a";
      ctx.beginPath();
      ctx.arc(ix + iw * 0.72 + 2, iy + ih * 0.3 - 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.art === "mountains") {
      ctx.fillStyle = "#f2d9b0";
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = "#e0845a";
      ctx.beginPath();
      ctx.arc(ix + iw * 0.5, iy + ih * 0.55, 6, 0, Math.PI * 2);
      ctx.fill();
      for (const [color, peak, off] of [["#6f8a9a", 0.25, 0], ["#4f6a7a", 0.4, 0.3]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih);
        ctx.lineTo(ix + iw * (0.3 + off * 0.5), iy + ih * peak + 6);
        ctx.lineTo(ix + iw * (0.6 + off * 0.3), iy + ih * (0.55 + off * 0.2));
        ctx.lineTo(ix + iw * (0.85 - off * 0.2), iy + ih * peak + 2);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#f5c6a8"; // "cat": a cute cat face on peach
      ctx.fillRect(ix, iy, iw, ih);
      const cx = ix + iw / 2, cy = iy + ih / 2 + 2;
      ctx.fillStyle = "#3a3a40";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.lineTo(cx - 6, cy - 12);
      ctx.lineTo(cx - 2, cy - 6);
      ctx.moveTo(cx + 8, cy - 4);
      ctx.lineTo(cx + 6, cy - 12);
      ctx.lineTo(cx + 2, cy - 6);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2d45c";
      ctx.beginPath();
      ctx.arc(cx - 3.5, cy - 1, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 3.5, cy - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Hung on a wall face: a little shelf with a pothos plant trailing down.
  pothosShelf(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 12;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 2, w, 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x, y, w, 3.5);
    const cx = x + w / 2;
    ctx.fillStyle = "#ece6dc";
    ctx.fillRect(cx - 6, y - 8, 12, 8);
    drawIvySprig(ctx, cx - 5, y - 3, 22, -1);
    drawIvySprig(ctx, cx + 5, y - 3, 26, 1);
    drawIvySprig(ctx, cx, y - 2, 16, 1);
    ctx.fillStyle = "#4f7a3a";
    ctx.beginPath();
    ctx.arc(cx - 3, y - 10, 4, 0, Math.PI * 2);
    ctx.arc(cx + 3, y - 11, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall face: a soft glowing neon sign that says "cozy".
  neonSign(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, cy = a.y - WALL_HEIGHT + 17;
    const flicker = 0.85 + Math.sin(performance.now() / 300) * 0.05;
    ctx.save();
    ctx.font = "700 15px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 120, 190, 0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255, 170, 215, ${flicker})`;
    ctx.fillText("cozy", cx, cy + 5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 245, 250, 0.8)";
    ctx.fillText("cozy", cx, cy + 5);
    ctx.restore();
  },

  // Hung on a wall face: a world map with a few pins in it.
  worldMap(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 5, h = 24;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#bcd8e6";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "#a8c48a"; // blobby continents
    for (const [fx, fy, rx, ry] of [[0.22, 0.35, 0.12, 0.2], [0.3, 0.72, 0.07, 0.18], [0.52, 0.32, 0.1, 0.15], [0.55, 0.65, 0.08, 0.2], [0.75, 0.4, 0.15, 0.22], [0.85, 0.78, 0.07, 0.1]]) {
      ctx.beginPath();
      ctx.ellipse(x + 2 + fx * (w - 4), y + 2 + fy * (h - 4), rx * (w - 4), ry * (h - 4), 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#c0554a";
    for (const [fx, fy] of [[0.24, 0.32], [0.54, 0.3], [0.78, 0.42]]) {
      ctx.beginPath();
      ctx.arc(x + 2 + fx * (w - 4), y + 2 + fy * (h - 4), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A small two-seat sofa (loveseat), facing into the room, with cushions.
  loveseat(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = f.color || "#7a9e8c";
    drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, 0.28, 30, shadeColor(c, -15)); // back
    const seat = drawBlock(ctx, f.x + 0.15, f.y + 0.22, f.w - 0.3, f.h - 0.22, 13, c);
    drawBlock(ctx, f.x, f.y + 0.1, 0.18, f.h - 0.1, 19, shadeColor(c, -15)); // arms
    drawBlock(ctx, f.x + f.w - 0.18, f.y + 0.1, 0.18, f.h - 0.1, 19, shadeColor(c, -15));
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"; // the seam between the two cushions
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(seat.top.x + seat.top.w / 2, seat.top.y + 2);
    ctx.lineTo(seat.top.x + seat.top.w / 2, seat.top.y + seat.top.h - 2);
    ctx.stroke();
    for (const [fx, color] of [[0.22, "#f2d9a0"], [0.78, "#e0845a"]]) {
      ctx.fillStyle = color; // throw pillows
      roundRectPath(ctx, seat.top.x + seat.top.w * fx - 7, seat.top.y - 8, 14, 11, 4);
      ctx.fill();
    }
  },

  // A low coffee table with a mug, a book and a little candle.
  coffeeTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 12, "#8b5e3c");
    const { x, y, w, h } = t.top;
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x + 6, y + h / 2 - 5, 14, 9);
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(x + 7, y + h / 2 - 4, 12, 1.2);
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(x + w / 2 - 3, y + h / 2 - 4, 6, 7);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(x + w / 2 - 2.5, y + h / 2 - 4, 5, 1.5);
    drawCandle(ctx, x + w - 10, y + h / 2 + 3, performance.now() / 1000 + f.x);
  },

  // A chest of drawers with brass handles and a little lamp on top.
  dresser(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 30, "#9a6a45");
    const { x, y, w, h } = d.face;
    for (let row = 0; row < 3; row++) {
      ctx.strokeStyle = "rgba(40, 25, 10, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3 + row * 8.5, w - 6, 7.5);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(x + w / 2 - 4, y + 6 + row * 8.5, 8, 1.6);
    }
    const cx = d.top.x + d.top.w * 0.75, cy = d.top.y + d.top.h / 2;
    ctx.fillStyle = "#5c4530";
    ctx.fillRect(cx - 1, cy - 12, 2, 12);
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 10);
    ctx.lineTo(cx + 7, cy - 10);
    ctx.lineTo(cx + 4, cy - 19);
    ctx.lineTo(cx - 4, cy - 19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e37aa0"; // a small framed photo
    ctx.fillRect(d.top.x + 6, cy - 9, 8, 9);
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(d.top.x + 7.5, cy - 7.5, 5, 5);
  },

  // A writing desk with a stack of paper, a pen pot and a lamp.
  writingDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#7a5238");
    const { x, y, w, h } = d.top;
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(x + w * 0.3, y + h / 2 - 6, 18, 12);
    ctx.fillStyle = "rgba(60, 50, 40, 0.35)";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.3 + 2, y + h / 2 - 4 + i * 2.5, 13, 0.8);
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(x + 6, y + h / 2 - 7, 6, 8);
    ctx.fillStyle = "#e0a84c";
    ctx.fillRect(x + 7, y + h / 2 - 11, 1, 5);
    ctx.fillRect(x + 9.5, y + h / 2 - 12, 1, 6);
    const lx = x + w - 10;
    ctx.fillStyle = "#4f7a48"; // a green banker's lamp
    ctx.fillRect(lx - 1, y + h / 2 - 10, 2, 10);
    ctx.beginPath();
    ctx.ellipse(lx, y + h / 2 - 11, 8, 3.5, 0, Math.PI, 0);
    ctx.fill();
  },

  // A record player on a little stand, with the record spinning.
  recordPlayer(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#6b4630");
    ctx.fillStyle = "#e37aa0"; // record sleeves in the stand
    ctx.fillRect(s.face.x + 4, s.face.y + 4, 5, s.face.h - 8);
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(s.face.x + 10, s.face.y + 4, 5, s.face.h - 8);
    const cx = s.top.x + s.top.w / 2 - 3, cy = s.top.y + s.top.h / 2;
    ctx.fillStyle = "#2b2b30"; // the player
    roundRectPath(ctx, cx - 14, cy - 9, 30, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#15151a"; // the record
    ctx.beginPath();
    ctx.ellipse(cx, cy, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const spin = performance.now() / 300;
    ctx.fillStyle = "#c0554a"; // its label, turning
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(cx + Math.cos(spin) * 7 - 1, cy + Math.sin(spin) * 4.5 - 0.5, 2, 1);
    ctx.strokeStyle = "#c9c9d0"; // tone arm
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy - 6);
    ctx.lineTo(cx + 5, cy + 1);
    ctx.stroke();
  },

  // A fish tank on a cabinet: water, plants, bubbles and two little fish.
  fishTank(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#5c3d2a");
    const x = cab.top.x + 2, w = cab.top.w - 4, bottom = cab.top.y + cab.top.h - 2, h = 26, top = bottom - h;
    const water = ctx.createLinearGradient(0, top, 0, bottom);
    water.addColorStop(0, "rgba(140, 200, 230, 0.8)");
    water.addColorStop(1, "rgba(60, 130, 170, 0.85)");
    ctx.fillStyle = water;
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "#e9dcb8"; // sand
    ctx.fillRect(x, bottom - 4, w, 4);
    ctx.strokeStyle = "#4f8a4a"; // water plants
    ctx.lineWidth = 2;
    const t = performance.now() / 1000;
    for (const px of [x + 5, x + w - 7]) {
      ctx.beginPath();
      ctx.moveTo(px, bottom - 3);
      ctx.quadraticCurveTo(px + Math.sin(t * 1.5 + px) * 3, bottom - 12, px + 1, bottom - 18);
      ctx.stroke();
    }
    for (const [color, speed, row, phase] of [["#f2a03a", 0.5, 0.4, 0], ["#e37aa0", 0.35, 0.65, 2]]) {
      const swim = (Math.sin(t * speed + phase) + 1) / 2;
      const fx = x + 6 + swim * (w - 14), fy = top + row * h;
      const dir = Math.cos(t * speed + phase) >= 0 ? 1 : -1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx - dir * 3, fy);
      ctx.lineTo(fx - dir * 6, fy - 2);
      ctx.lineTo(fx - dir * 6, fy + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // bubbles
    for (let i = 0; i < 3; i++) {
      const rise = (t * 0.6 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(x + w * 0.55 + Math.sin(rise * 8) * 1.5, bottom - 4 - rise * (h - 6), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // glass edge and a glint
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x + 2, top + 2, 2, h - 8);
    ctx.fillStyle = "#2b2b30"; // lid
    ctx.fillRect(x - 1, top - 3, w + 2, 3);
  },

  // An upright piano with the keys showing and a candle on top.
  piano(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const back = drawBlock(ctx, f.x, f.y, f.w, 0.3, 46, "#3a2a24");
    const keysBed = drawBlock(ctx, f.x, f.y + 0.3, f.w, f.h - 0.3, 22, "#3a2a24");
    const kx = keysBed.top.x + 3, ky = keysBed.top.y + 2, kw = keysBed.top.w - 6, kh = keysBed.top.h - 4;
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(kx, ky, kw, kh);
    ctx.fillStyle = "#2b2b2b";
    for (let i = 0; i < kw / 4.5; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      ctx.fillRect(kx + 3 + i * 4.5, ky, 2.2, kh * 0.6);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let i = 1; i < kw / 4.5; i++) ctx.fillRect(kx + i * 4.5, ky, 0.5, kh);
    ctx.fillStyle = "#f4ecdc"; // sheet music
    ctx.fillRect(back.face.x + back.face.w / 2 - 10, back.face.y + 8, 20, 13);
    ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
    for (let i = 0; i < 4; i++) ctx.fillRect(back.face.x + back.face.w / 2 - 8, back.face.y + 11 + i * 2.5, 16, 0.6);
    drawCandle(ctx, back.top.x + 8, back.top.y + back.top.h / 2 + 2, performance.now() / 1000 + 3);
  },

  // A rocking chair that gently rocks, with a knitted blanket.
  rockingChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const rock = Math.sin(performance.now() / 700) * 0.06;
    ctx.save();
    ctx.translate(base.x, base.y - 3);
    ctx.rotate(rock);
    ctx.strokeStyle = "#6b4630"; // rockers
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -40, 42, Math.PI * 0.36, Math.PI * 0.64);
    ctx.stroke();
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(-14, -44, 3, 42); // back posts
    ctx.fillRect(11, -44, 3, 42);
    for (let i = 0; i < 4; i++) ctx.fillRect(-11, -42 + i * 7, 22, 2.5); // back slats
    ctx.fillStyle = "#9a6a45"; // seat
    ctx.fillRect(-15, -16, 30, 6);
    ctx.fillStyle = "#c0554a"; // blanket over the back
    ctx.fillRect(-12, -40, 16, 22);
    ctx.fillStyle = "rgba(255, 240, 220, 0.35)";
    for (let i = 0; i < 4; i++) ctx.fillRect(-12, -37 + i * 5, 16, 1.2);
    ctx.restore();
  },

  // A lava lamp with warm blobs slowly floating up and down.
  lavaLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2, t = performance.now() / 1000;
    ctx.fillStyle = "#8a8a94";
    ctx.beginPath();
    ctx.moveTo(cx - 7, by);
    ctx.lineTo(cx + 7, by);
    ctx.lineTo(cx + 4, by - 9);
    ctx.lineTo(cx - 4, by - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120, 60, 140, 0.85)"; // the glass
    ctx.beginPath();
    ctx.moveTo(cx - 4, by - 9);
    ctx.lineTo(cx - 6, by - 26);
    ctx.lineTo(cx - 3, by - 36);
    ctx.lineTo(cx + 3, by - 36);
    ctx.lineTo(cx + 6, by - 26);
    ctx.lineTo(cx + 4, by - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9a5c";
    for (let i = 0; i < 3; i++) {
      const rise = (Math.sin(t * 0.5 + i * 2.1) + 1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(t + i) * 1.2, by - 12 - rise * 20, 2.5 + (i % 2), 3 + (i % 2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#8a8a94";
    ctx.fillRect(cx - 3, by - 39, 6, 3);
  },

  // A retro arcade cabinet with a glowing screen and joystick.
  arcade(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 56, "#3f4f8a");
    const { x, y, w } = cab.face;
    ctx.fillStyle = "#e37aa0"; // marquee
    ctx.fillRect(x + 3, y + 3, w - 6, 7);
    ctx.fillStyle = "#1a1a24"; // screen
    ctx.fillRect(x + 4, y + 13, w - 8, 18);
    const t = performance.now() / 1000;
    ctx.fillStyle = "#6fe0a8";
    ctx.fillRect(x + 6 + ((t * 10) % (w - 16)), y + 20, 3, 3);
    ctx.fillStyle = "#f2d45c";
    ctx.fillRect(x + w - 12, y + 16, 2, 2);
    ctx.fillStyle = "#2b2b30"; // control panel
    ctx.fillRect(x + 2, y + 33, w - 4, 7);
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.arc(x + 8, y + 34, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 36, 1.8, 0, Math.PI * 2);
    ctx.arc(x + w - 5, y + 36, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },

  // A brass telescope on a tripod, pointed at the sky.
  telescope(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2;
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx - 9, by);
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx + 9, by);
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx + 2, by - 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, by - 28);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#c9a24a";
    roundRectPath(ctx, -14, -3.5, 28, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#a8832e";
    ctx.fillRect(10, -4.5, 5, 9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(-12, -2.5, 20, 1.2);
    ctx.restore();
  },

  // A globe on a little wooden stand.
  globe(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#7a5238");
    const cx = s.top.x + s.top.w / 2, cy = s.top.y - 9;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(cx - 1, cy + 6, 2, 6);
    ctx.fillStyle = "#6fa8c8";
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    const turn = (performance.now() / 4000) % 1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#a8c48a";
    for (const [ox, oy, r] of [[0, -3, 4], [0.45, 2, 3], [0.7, -1, 3.5]]) {
      const px = cx - 12 + (((ox + turn) % 1) * 24);
      ctx.beginPath();
      ctx.ellipse(px, cy + oy, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10.5, Math.PI * 0.6, Math.PI * 2.4);
    ctx.stroke();
  },

  // A painted toy chest with a star on the front.
  toyChest(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, "#c0664a");
    ctx.fillStyle = shadeColor("#c0664a", 25); // lid edge
    ctx.fillRect(c.face.x, c.face.y, c.face.w, 3);
    ctx.fillStyle = "#f2d45c";
    const sx = c.face.x + c.face.w / 2, sy = c.face.y + c.face.h / 2 + 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.2 : 5, a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6fa8c8"; // a toy boat poking out
    ctx.fillRect(c.top.x + 6, c.top.y - 4, 10, 4);
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.moveTo(c.top.x + 11, c.top.y - 4);
    ctx.lineTo(c.top.x + 11, c.top.y - 13);
    ctx.lineTo(c.top.x + 17, c.top.y - 6);
    ctx.closePath();
    ctx.fill();
  },

  // A pile of big floor cushions to flop onto.
  floorCushions(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, dy, color] of [[-9, -6, "#6f5a8c"], [8, -5, "#e0a84c"], [0, -13, "#c0664a"]]) {
      const g = ctx.createLinearGradient(0, c.y + dy - 9, 0, c.y + dy + 6);
      g.addColorStop(0, shadeColor(color, 25));
      g.addColorStop(1, shadeColor(color, -20));
      ctx.fillStyle = g;
      roundRectPath(ctx, c.x + dx - 13, c.y + dy - 7, 26, 12, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // button
      ctx.beginPath();
      ctx.arc(c.x + dx, c.y + dy - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A cluster of candles of different heights on a little tray.
  candles(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const t = performance.now() / 1000;
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 3, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, hgt, phase] of [[-6, 14, 0], [1, 20, 1.3], [7, 10, 2.6]]) {
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(c.x + dx - 2.5, c.y - 4 - hgt, 5, hgt);
      drawCandle(ctx, c.x + dx, c.y - 4 - hgt + 7, t + phase);
    }
  },

  // Stacks of books on the floor, one with a mug on top.
  bookStacks(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const colors = ["#c0554a", "#3f6f9f", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a"];
    for (const [dx, count] of [[-8, 5], [7, 3]]) {
      for (let i = 0; i < count; i++) {
        const bw = 16 - (i % 3) * 2;
        ctx.fillStyle = colors[(i + count) % colors.length];
        ctx.fillRect(c.x + dx - bw / 2 + ((i * 7) % 3) - 1, c.y - 5 - i * 4.5, bw, 4);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(c.x + dx - bw / 2 + ((i * 7) % 3), c.y - 4 - i * 4.5, bw - 3, 0.8);
      }
    }
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(c.x + 4, c.y - 22, 6, 7);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(c.x + 4.5, c.y - 22, 5, 1.5);
  },

  // --- The cozy plant collection ---

  // ZZ plant: upright stems lined with glossy little leaves.
  zzPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "cement", 10, 15);
    for (const [dx, lean, len] of [[-5, -0.25, 34], [-1, -0.08, 42], [3, 0.1, 38], [7, 0.3, 30]]) {
      const tipX = b.x + dx + Math.sin(lean) * len, tipY = soil - Math.cos(lean) * len;
      ctx.strokeStyle = "#4f7a3a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x + dx * 0.4, soil);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      for (let t = 0.3; t <= 1; t += 0.14) {
        const px = b.x + dx * 0.4 + (tipX - b.x - dx * 0.4) * t, py = soil + (tipY - soil) * t;
        drawLeaf(ctx, px, py, lean - 0.9, 7, 2.6, "#2f5a2f", "rgba(255,255,255,0.25)");
        drawLeaf(ctx, px, py, lean + 0.9, 7, 2.6, "#3d6b3a", "rgba(255,255,255,0.25)");
      }
    }
  },

  // Pilea (the Chinese money plant): round coin leaves on thin stems.
  pilea(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 8, 12);
    const leaves = [[-14, -14, 4.5], [13, -16, 4.8], [-8, -26, 5], [9, -28, 4.6], [0, -34, 5.2], [-15, -30, 3.8], [16, -30, 4], [2, -20, 4.2]];
    for (const [dx, dy, r] of leaves) {
      ctx.strokeStyle = "#6f9a4a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x, soil - 4);
      ctx.quadraticCurveTo(b.x + dx * 0.3, soil + dy * 0.6, b.x + dx, soil + dy);
      ctx.stroke();
      ctx.fillStyle = r > 4.7 ? "#5f9a4a" : "#6fae55";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Calathea: wide leaves with feathery stripes, in a pink pot.
  calathea(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "pink", 10, 15);
    for (const [angle, len] of [[-0.9, 24], [-0.45, 30], [0, 32], [0.45, 29], [0.9, 23]]) {
      drawLeaf(ctx, b.x, soil, angle, len, 9, "#4f7a48", null);
      ctx.save();
      ctx.translate(b.x, soil);
      ctx.rotate(angle);
      ctx.strokeStyle = "#a8c88a"; // feathery stripes
      ctx.lineWidth = 1.2;
      for (let t = 0.25; t < 0.9; t += 0.13) {
        ctx.beginPath();
        ctx.moveTo(0, -len * t);
        ctx.lineTo(-4, -len * t - 3);
        ctx.moveTo(0, -len * t);
        ctx.lineTo(4, -len * t - 3);
        ctx.stroke();
      }
      ctx.strokeStyle = "#c9708a"; // pink midrib
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -len + 3);
      ctx.stroke();
      ctx.restore();
    }
  },

  // Bird of paradise: tall stems with huge paddle leaves, in a basket.
  birdOfParadise(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "basket", 12, 17);
    for (const [dx, lean, stem, color] of [[-4, -0.35, 30, "#3d6b40"], [4, 0.3, 34, "#3d6b40"], [0, -0.05, 44, "#4a7a48"], [-2, 0.55, 22, "#2f5a36"], [2, -0.7, 20, "#2f5a36"]]) {
      const topX = b.x + dx + Math.sin(lean) * stem, topY = soil - Math.cos(lean) * stem;
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x + dx * 0.3, soil);
      ctx.lineTo(topX, topY);
      ctx.stroke();
      drawLeaf(ctx, topX, topY + 2, lean, 26, 9, color);
      ctx.save(); // splits in the leaf edge
      ctx.translate(topX, topY + 2);
      ctx.rotate(lean);
      ctx.strokeStyle = "rgba(20, 40, 20, 0.45)";
      ctx.lineWidth = 0.8;
      for (const t of [0.35, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(6, -26 * t);
        ctx.lineTo(2, -26 * t - 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  // An olive tree: a slim trunk and a silvery cloud of little leaves.
  oliveTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 11, 20);
    ctx.strokeStyle = "#7a6a52";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.quadraticCurveTo(b.x - 4, soil - 20, b.x + 1, soil - 38);
    ctx.stroke();
    for (let i = 0; i < 46; i++) {
      const a = noise(i * 2.7) * Math.PI * 2, r = 5 + noise(i * 5.3) * 14;
      drawLeaf(ctx, b.x + Math.cos(a) * r, soil - 50 + Math.sin(a) * r * 0.75, a + 1.2, 6, 1.6, ["#8fa88a", "#a8b89a", "#7a9474"][i % 3], null);
    }
    ctx.fillStyle = "#3a3040";
    for (const [dx, dy] of [[-6, -46], [5, -52], [9, -44]]) {
      ctx.beginPath();
      ctx.ellipse(b.x + dx, soil + dy, 1.3, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A peace lily: dark glossy leaves and white flowers.
  peaceLily(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    for (const [angle, len] of [[-1.0, 20], [-0.6, 26], [-0.2, 24], [0.25, 26], [0.65, 25], [1.0, 19]]) drawLeaf(ctx, b.x, soil, angle, len, 6, angle % 0.5 ? "#2f5a36" : "#3d6b40");
    for (const [dx, h] of [[-5, 34], [4, 38], [0, 30]]) {
      ctx.strokeStyle = "#5f8a4a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.lineTo(b.x + dx, soil - h + 6);
      ctx.stroke();
      ctx.fillStyle = "#fdfbf5";
      ctx.beginPath();
      ctx.moveTo(b.x + dx, soil - h + 6);
      ctx.quadraticCurveTo(b.x + dx - 5, soil - h, b.x + dx, soil - h - 4);
      ctx.quadraticCurveTo(b.x + dx + 5, soil - h, b.x + dx, soil - h + 6);
      ctx.fill();
      ctx.fillStyle = "#f2e08a";
      ctx.fillRect(b.x + dx - 0.7, soil - h - 1, 1.4, 5);
    }
  },

  // A rubber plant: big, dark, shiny burgundy leaves up a central stem.
  rubberPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "cement", 10, 16);
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.lineTo(b.x, soil - 46);
    ctx.stroke();
    [[-1, -10], [1, -18], [-1, -26], [1, -33], [-1, -40], [0, -48]].forEach(([side, dy], i) => {
      const angle = side === 0 ? 0 : side * 1.0;
      drawLeaf(ctx, b.x, soil + dy, angle, 15, 6, i % 2 ? "#3a2a35" : "#4a2e3a", "rgba(255, 200, 200, 0.25)");
    });
  },

  // Aloe vera: thick spiky leaves with little white speckles.
  aloeVera(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    for (const [angle, len] of [[-1.1, 18], [-0.6, 24], [-0.2, 27], [0.25, 26], [0.7, 22], [1.1, 17]]) {
      drawLeaf(ctx, b.x, soil, angle, len, 4, "#7fae8a", null);
      ctx.save();
      ctx.translate(b.x, soil);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let t = 0.25; t < 0.8; t += 0.15) ctx.fillRect(-1, -len * t, 1.2, 1.2);
      ctx.restore();
    }
  },

  // Alocasia: tall stems with arrow-shaped leaves and bright white veins.
  alocasia(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "black", 10, 16);
    for (const [dx, h, tilt] of [[-8, 34, -0.5], [7, 40, 0.45], [0, 48, 0.05]]) {
      const lx = b.x + dx, ly = soil - h;
      ctx.strokeStyle = "#6f8a4a";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.lineTo(lx, ly + 4);
      ctx.stroke();
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(tilt);
      ctx.fillStyle = "#26402c";
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e8f0e0";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(0, -11);
      for (const t of [-8, -3, 2]) {
        ctx.moveTo(0, t);
        ctx.lineTo(5, t + 5);
        ctx.moveTo(0, t);
        ctx.lineTo(-5, t + 5);
      }
      ctx.stroke();
      ctx.restore();
    }
  },

  // A pink orchid: two broad leaves, a stake and an arching spray of flowers.
  orchid(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 8, 13);
    drawLeaf(ctx, b.x, soil, -1.2, 13, 5, "#3d6b40");
    drawLeaf(ctx, b.x, soil, 1.15, 12, 5, "#2f5a36");
    ctx.strokeStyle = "#8b6b4a"; // stake
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 1, soil);
    ctx.lineTo(b.x + 1, soil - 36);
    ctx.stroke();
    ctx.strokeStyle = "#6f7a4a";
    ctx.beginPath();
    ctx.moveTo(b.x + 1, soil - 30);
    ctx.quadraticCurveTo(b.x + 8, soil - 42, b.x + 16, soil - 32);
    ctx.stroke();
    for (const [px, py] of [[b.x + 2, soil - 34], [b.x + 7, soil - 38], [b.x + 12, soil - 37], [b.x + 16, soil - 32]]) {
      ctx.fillStyle = "#f2b8d0";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(a) * 2.2, py + Math.sin(a) * 2.2, 2.2, 1.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#c0406a";
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A pot of lavender: slim stems topped with purple flower spikes.
  lavenderPot(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    for (let i = 0; i < 13; i++) {
      const angle = (i - 6) * 0.1, len = 22 + (i % 3) * 4;
      const tx = b.x + Math.sin(angle) * len, ty = soil - Math.cos(angle) * len;
      ctx.strokeStyle = "#8fa87a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(b.x + (i - 6) * 0.6, soil);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? "#9a7ac0" : "#b69ad8";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(tx, ty + k * 2, 1.5, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A long wooden planter of kitchen herbs: basil, rosemary and mint.
  herbGarden(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 11, "#a8783e");
    const x = box.top.x, y = box.top.y + box.top.h / 2, w = box.top.w;
    for (let i = 0; i < 9; i++) drawLeaf(ctx, x + w * 0.2 + (i % 3) * 3 - 3, y, (i - 4) * 0.35, 9, 4, "#5f9a55");
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = "#4f6a4a";
      ctx.lineWidth = 1;
      const px = x + w * 0.5 + (i - 4) * 1.6;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + (i - 4) * 0.8, y - 14 - (i % 3) * 3);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) drawHeartLeaf(ctx, x + w * 0.8 + (i % 3) * 4 - 4, y - 4 - Math.floor(i / 3) * 5, 3, i % 2 ? "#7fbf6a" : "#6fae55");
    ctx.fillStyle = "#f4ecdc"; // little labels
    for (const fx of [0.2, 0.5, 0.8]) ctx.fillRect(x + w * fx - 3, box.face.y + 3, 6, 4);
  },

  // Fluffy pampas grass plumes in a tall stone vase.
  pampasVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "stone");
    for (const [angle, len, color] of [[-0.45, 34, "#e8dcc2"], [-0.15, 42, "#f2e8d4"], [0.2, 38, "#ecdcbf"], [0.5, 30, "#f2e8d4"]]) {
      const tx = b.x + Math.sin(angle) * len, ty = top - Math.cos(angle) * len;
      ctx.strokeStyle = "#b8a888";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 2);
      ctx.lineTo(tx, ty + 8);
      ctx.stroke();
      ctx.fillStyle = color;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(tx + Math.sin(angle) * k * 1.5, ty + k * 2.5, 4, 5, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Pink tulips in a glass vase.
  tulipVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "glass");
    for (const [dx, h, color] of [[-7, 18, "#f2a0b8"], [0, 22, "#f7c0d0"], [6, 17, "#e880a0"], [-3, 14, "#fbd0dc"]]) {
      ctx.strokeStyle = "#6f9a4a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 8);
      ctx.lineTo(b.x + dx, top - h + 4);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(b.x + dx - 3.5, top - h + 1);
      ctx.lineTo(b.x + dx - 3.5, top - h - 4);
      ctx.lineTo(b.x + dx - 1.5, top - h - 2);
      ctx.lineTo(b.x + dx, top - h - 5);
      ctx.lineTo(b.x + dx + 1.5, top - h - 2);
      ctx.lineTo(b.x + dx + 3.5, top - h - 4);
      ctx.lineTo(b.x + dx + 3.5, top - h + 1);
      ctx.quadraticCurveTo(b.x + dx, top - h + 5, b.x + dx - 3.5, top - h + 1);
      ctx.fill();
    }
    drawLeaf(ctx, b.x - 1, top + 6, -0.5, 12, 3, "#5f8a4a");
  },

  // Three sunflowers in a yellow jug.
  sunflowerVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "jug");
    for (const [dx, h, r] of [[-8, 16, 6], [2, 22, 7], [9, 14, 5.5]]) {
      const cx = b.x + dx, cy = top - h;
      ctx.strokeStyle = "#5f8a3a";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 3);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = "#f2c230";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, r * 0.45, r * 0.2, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#6b4226";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Eucalyptus stems with round silvery leaves in an amber bud vase.
  eucalyptusVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "amber");
    for (const [angle, len] of [[-0.35, 30], [0.05, 36], [0.4, 28]]) {
      const tx = b.x + Math.sin(angle) * len, ty = top - Math.cos(angle) * len;
      ctx.strokeStyle = "#8a7a6a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x, top);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      for (let t = 0.2; t <= 1; t += 0.16) {
        const px = b.x + (tx - b.x) * t, py = top + (ty - top) * t;
        ctx.fillStyle = t > 0.6 ? "#a8c0b0" : "#8fae9e";
        ctx.beginPath();
        ctx.arc(px - 3, py, 2.4, 0, Math.PI * 2);
        ctx.arc(px + 3, py - 1, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A cherry blossom branch in a tall cream vase.
  cherryBlossom(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "cream");
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 1.6;
    const twigs = [[b.x, top, b.x - 10, top - 26], [b.x - 5, top - 13, b.x - 18, top - 22], [b.x, top, b.x + 8, top - 34], [b.x + 4, top - 17, b.x + 16, top - 24], [b.x + 7, top - 28, b.x + 2, top - 42]];
    for (const [x1, y1, x2, y2] of twigs) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const [x1, y1, x2, y2] = twigs[i % twigs.length];
      const t = 0.35 + noise(i * 4.7) * 0.65;
      ctx.fillStyle = i % 3 ? "#f7c6d6" : "#fbe0ea";
      ctx.beginPath();
      ctx.arc(x1 + (x2 - x1) * t + (noise(i) - 0.5) * 4, y1 + (y2 - y1) * t + (noise(i + 9) - 0.5) * 4, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glass terrarium globe with moss, pebbles and tiny plants.
  terrarium(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    roundRectPath(ctx, b.x - 11, b.y - 6, 22, 5, 2);
    ctx.fill();
    const cy = b.y - 17;
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, cy, 12, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(210, 235, 240, 0.35)";
    ctx.fillRect(b.x - 12, cy - 12, 24, 24);
    ctx.fillStyle = "#c9b089"; // sand and pebbles
    ctx.fillRect(b.x - 12, cy + 5, 24, 7);
    ctx.fillStyle = "#6fae55"; // moss
    ctx.beginPath();
    ctx.ellipse(b.x - 3, cy + 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a9a94";
    ctx.beginPath();
    ctx.arc(b.x + 6, cy + 6, 2, 0, Math.PI * 2);
    ctx.arc(b.x + 2, cy + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    drawLeaf(ctx, b.x - 4, cy + 4, -0.3, 10, 3, "#4f8a4a");
    drawLeaf(ctx, b.x - 2, cy + 4, 0.4, 8, 3, "#5f9a55");
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - 4, cy - 5, 5, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  },

  // A money tree: a braided trunk topped with fans of leaves.
  moneyTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "glazed", 10, 15);
    ctx.strokeStyle = "#8a6a4a"; // the braid
    ctx.lineWidth = 2;
    for (const phase of [0, 2.1, 4.2]) {
      ctx.beginPath();
      for (let y = 0; y <= 30; y += 2) ctx.lineTo(b.x + Math.sin(y * 0.35 + phase) * 2.5, soil - y);
      ctx.stroke();
    }
    for (const [dx, dy] of [[-10, -38], [9, -40], [0, -48], [-4, -32], [6, -31]]) {
      for (let i = -2; i <= 2; i++) drawLeaf(ctx, b.x + dx * 0.5, soil + dy + 6, i * 0.45 + dx * 0.04, 12, 3.2, i % 2 ? "#4f8a4a" : "#5f9a55");
    }
  },

  // A jade plant: a chunky little tree with round, fleshy leaves.
  jadePlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    ctx.strokeStyle = "#7a6a4a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.lineTo(b.x, soil - 12);
    ctx.lineTo(b.x - 9, soil - 22);
    ctx.moveTo(b.x, soil - 12);
    ctx.lineTo(b.x + 8, soil - 24);
    ctx.stroke();
    for (const [cx, cy] of [[b.x - 9, soil - 24], [b.x + 8, soil - 26], [b.x, soil - 18]]) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.fillStyle = "#5f9a55";
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4, 3.2, 2.4, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 80, 80, 0.5)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  },

  // A spider plant: arching striped leaves, with babies dangling down.
  spiderPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    for (let i = -6; i <= 6; i++) {
      const angle = i * 0.22, len = 22 - Math.abs(i);
      const tx = b.x + Math.sin(angle) * len * 1.2, ty = soil - Math.cos(angle) * len + Math.abs(i) * 2.4;
      ctx.strokeStyle = "#5f9a55";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.quadraticCurveTo(b.x + Math.sin(angle) * len * 0.5, soil - len, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = "#e8f0d0";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#8fa87a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 8, soil - 6);
      ctx.quadraticCurveTo(b.x + side * 20, soil - 12, b.x + side * 20, soil + 6);
      ctx.stroke();
      for (let i = -2; i <= 2; i++) drawLeaf(ctx, b.x + side * 20, soil + 6, i * 0.5, 7, 1.6, "#6fae55", null);
    }
  },

  // A heartleaf philodendron trailing heart-shaped leaves over a pink pot.
  philodendron(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "pink", 10, 15);
    for (const [dx, dy, s, a] of [[-5, -8, 5, -0.3], [5, -10, 5.5, 0.3], [0, -16, 5, 0], [-9, -2, 4.5, -0.6], [9, -3, 4.5, 0.6]]) drawHeartLeaf(ctx, b.x + dx, soil + dy, s, "#4f8a4a", a);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 9, soil);
      ctx.quadraticCurveTo(b.x + side * 14, soil + 8, b.x + side * 12, soil + 16);
      ctx.stroke();
      for (let k = 0; k < 4; k++) drawHeartLeaf(ctx, b.x + side * (12 + (k % 2) * 2), soil + 3 + k * 4, 3.2, k % 2 ? "#5f9a55" : "#4f8a4a", side * 0.4);
    }
  },

  // Hoya finlaysonii: long, pointed leaves with a pale net of veins,
  // trailing over the pot's edge, with round clusters of little pink stars.
  hoyaFinlaysonii(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    const leaf = (x, y, a, len) => {
      drawLeaf(ctx, x, y, a, len, 3.2, "#3f6a3a", "rgba(215, 235, 170, 0.55)");
      ctx.save(); // the netted veins
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.strokeStyle = "rgba(215, 235, 170, 0.35)";
      ctx.lineWidth = 0.5;
      for (let k = 2; k < len - 2; k += 2.5) {
        ctx.beginPath();
        ctx.moveTo(0, -k);
        ctx.lineTo(-2, -k - 1.5);
        ctx.moveTo(0, -k);
        ctx.lineTo(2, -k - 1.5);
        ctx.stroke();
      }
      ctx.restore();
    };
    for (const [dx, a, len] of [[-3, -0.45, 19], [3, 0.4, 20], [0, -0.05, 22], [-6, -0.85, 16], [6, 0.85, 16], [-2, -0.2, 14], [2, 0.2, 15]]) leaf(b.x + dx, soil, a, len);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#6b7a3a"; // vines trailing down
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 8, soil);
      ctx.quadraticCurveTo(b.x + side * 14, soil + 6, b.x + side * 12, soil + 18);
      ctx.stroke();
      for (let k = 0; k < 3; k++) leaf(b.x + side * 12.5, soil + 6 + k * 5, side * (2.4 + k * 0.1), 8);
    }
    for (const [dx, dy] of [[-9, -17], [9, -14]]) {
      for (let s = 0; s < 7; s++) {
        const a = (s / 7) * Math.PI * 2;
        ctx.fillStyle = "#f2c4d0";
        ctx.beginPath();
        ctx.arc(b.x + dx + Math.cos(a) * 2.6, soil + dy + Math.sin(a) * 2.6, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#c0556e";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Monstera adansonii (Swiss cheese vine): small leaves full of oval
  // holes, climbing a mossy pole.
  monsteraAdansonii(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "basket", 11, 15);
    ctx.fillStyle = "#6f7a4a"; // the moss pole
    ctx.fillRect(b.x - 2, soil - 38, 4, 38);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(b.x - 2, soil - 38, 1.5, 38);
    const leaf = (x, y, a, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = "#3f8a4a";
      ctx.beginPath();
      ctx.ellipse(0, -s, s * 0.62, s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // lit from above
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 1.3, s * 0.3, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9dcc2"; // the holes (showing the wall's light behind)
      ctx.globalAlpha = 0.85;
      for (const [hx, hy] of [[-0.3, -0.6], [0.3, -0.9], [-0.28, -1.3], [0.28, -1.5]]) {
        ctx.beginPath();
        ctx.ellipse(hx * s, hy * s, s * 0.12, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };
    for (let k = 0; k < 5; k++) {
      const side = k % 2 ? 1 : -1;
      leaf(b.x + side * 2, soil - 4 - k * 7.5, side * 1.0, 7);
    }
    leaf(b.x, soil - 38, 0, 6); // the newest leaf at the top
    for (const side of [-1, 1]) leaf(b.x + side * 8, soil + 2, side * 2.3, 6); // a couple spilling over the pot
  },

  // Anthurium: glossy heart-shaped leaves and waxy flowers (a heart-shaped
  // bract with a little spike), red or pink (f.color).
  anthurium(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, f.color === "#e84a5a" ? "black" : "ceramic", 10, 15);
    ctx.strokeStyle = "#4f7a3a";
    ctx.lineWidth = 1;
    const stems = [[-8, -18, "leaf", -0.3], [8, -20, "leaf", 0.3], [0, -26, "leaf", 0], [-4, -30, "flower", -0.2], [6, -32, "flower", 0.25], [-10, -10, "leaf", -0.6], [10, -11, "leaf", 0.6]];
    for (const [dx, dy] of stems) {
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.quadraticCurveTo(b.x + dx * 0.3, soil + dy * 0.5, b.x + dx, soil + dy);
      ctx.stroke();
    }
    for (const [dx, dy, kind, a] of stems) {
      if (kind === "leaf") {
        drawHeartLeaf(ctx, b.x + dx, soil + dy + 3.5, 7, "#2f6a3a", a); // hangs from its notch, tip down
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // glossy shine
        ctx.beginPath();
        ctx.ellipse(b.x + dx - 2, soil + dy + 1.5, 1.2, 2.5, a, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawHeartLeaf(ctx, b.x + dx, soil + dy + 2.5, 5.5, f.color, a);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.ellipse(b.x + dx - 1.5, soil + dy + 1, 1, 2, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f2d07a"; // the little spike
        ctx.save();
        ctx.translate(b.x + dx, soil + dy - 1);
        ctx.rotate(a + 0.5);
        ctx.fillRect(-0.9, -7, 1.8, 7);
        ctx.restore();
      }
    }
  },

  // Hoya polyneura (the fishtail hoya), hung on the wall in a white pot:
  // long, thin, pointed leaves with dark "fishbone" veins, trailing down.
  hoyaPolyneura(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 3;
    ctx.strokeStyle = "#5c4530"; // hanging cords
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const dx of [-7, 0, 7]) {
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + dx, top + 10);
    }
    ctx.stroke();
    const leaf = (x, y, angle, len) => {
      drawLeaf(ctx, x, y, angle, len, 3.4, "#6aa85a", null);
      ctx.save(); // the fishbone veins
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = "rgba(40, 80, 30, 0.45)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(0, -len + 1.5);
      for (let k = 2.5; k < len - 2; k += 2.8) {
        ctx.moveTo(0, -k);
        ctx.lineTo(-1.6, -k - 1.2);
        ctx.moveTo(0, -k);
        ctx.lineTo(1.6, -k - 1.2);
      }
      ctx.stroke();
      ctx.restore();
    };
    // Leaves trailing down from the pot on both sides, then a few upright ones.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) leaf(cx + side * (6 + k * 1.5), top + 14 + k * 4, side * (2.3 + k * 0.12), 9);
    }
    ctx.fillStyle = "#f2ede4"; // the pot
    ctx.beginPath();
    ctx.moveTo(cx - 8, top + 10);
    ctx.lineTo(cx + 8, top + 10);
    ctx.lineTo(cx + 6, top + 18);
    ctx.lineTo(cx - 6, top + 18);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(cx - 6.5, top + 16, 13, 2);
    for (const [dx, ang] of [[-3, -0.4], [0, 0], [3, 0.4], [-5, -0.8], [5, 0.8]]) leaf(cx + dx, top + 11, ang, 10);
  },

  // Hoya carnosa 'Compacta' (Hindu rope): ropes of curled, twisted waxy
  // leaves spilling over a pot, with a cluster of pink star flowers.
  hoyaCompacta(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "glazed", 10, 14);
    // A rope: a chain of curled leaves along a curve.
    const rope = (x0, y0, x1, y1, bend) => {
      const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2.6));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
        const y = y0 + (y1 - y0) * t;
        const tilt = (k % 2 ? 0.7 : -0.7) + t; // curled leaves, turning this way and that
        ctx.fillStyle = k % 2 ? "#4f8a4a" : "#5f9a55";
        ctx.strokeStyle = "#2f5a32";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4, 1.7, tilt, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(230, 245, 210, 0.45)"; // the waxy curl catching the light
        ctx.beginPath();
        ctx.ellipse(x, y, 1.4, 0.8, tilt, Math.PI, Math.PI * 1.8);
        ctx.stroke();
      }
    };
    rope(b.x - 5, soil - 1, b.x - 12, soil + 19, -2); // ropes spilling over the sides
    rope(b.x - 2, soil, b.x - 7, soil + 14, -3);
    rope(b.x + 5, soil - 1, b.x + 13, soil + 17, 2);
    rope(b.x + 2, soil, b.x + 8, soil + 12, 3);
    rope(b.x - 1, soil - 1, b.x - 5, soil - 13, -2); // a couple arching up
    rope(b.x + 2, soil - 1, b.x + 5, soil - 11, 2);
    const fx = b.x + 7, fy = soil - 13; // a cluster of pink star flowers
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      ctx.fillStyle = "#f4c6d2";
      ctx.beginPath();
      ctx.arc(fx + Math.cos(ang) * 3, fy + Math.sin(ang) * 2.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#b8405e";
    ctx.beginPath();
    ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall: a macramé hanger holding a golden pothos, trailing down.
  macramePothos(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 2;
    ctx.fillStyle = "#6b4a2e"; // hook
    ctx.fillRect(cx - 1, top, 2, 3);
    ctx.strokeStyle = "#e9dcc2"; // knotted cords
    ctx.lineWidth = 1.2;
    for (const dx of [-7, -3, 3, 7]) {
      ctx.beginPath();
      ctx.moveTo(cx, top + 3);
      ctx.lineTo(cx + dx, top + 16);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9dcc2";
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(cx + dx * 0.8, top + 12, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ece6dc"; // the pot
    roundRectPath(ctx, cx - 7, top + 15, 14, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#e9dcc2"; // tassel
    ctx.fillRect(cx - 1, top + 24, 2, 6);
    for (const [dx, len, lean] of [[-6, 24, -1], [6, 20, 1], [-2, 14, 1]]) {
      ctx.strokeStyle = "#6f8a3a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + dx, top + 16);
      ctx.quadraticCurveTo(cx + dx + lean * 4, top + 16 + len * 0.5, cx + dx + lean * 2, top + 16 + len);
      ctx.stroke();
      for (let k = 0; k < len / 4; k++) drawHeartLeaf(ctx, cx + dx + lean * (k % 2 ? 3 : 1), top + 18 + k * 4, 2.5, k % 2 ? "#a8c860" : "#6f9a4a", lean * 0.4);
    }
    for (const dx of [-4, 0, 4]) drawHeartLeaf(ctx, cx + dx, top + 13, 3, "#8fb850");
  },

  // Hung on a wall: string of pearls, little green beads spilling down.
  stringOfPearls(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 4;
    ctx.strokeStyle = "#8a6a4a";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - 6, top + 8);
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + 6, top + 8);
    ctx.stroke();
    ctx.fillStyle = "#c9b089"; // a little bowl
    ctx.beginPath();
    ctx.ellipse(cx, top + 10, 8, 4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(cx - 8, top + 8, 16, 2);
    for (const [dx, len] of [[-6, 22], [-2, 28], [2, 18], [6, 25], [0, 12]]) {
      ctx.strokeStyle = "rgba(90, 120, 60, 0.6)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + dx, top + 11);
      ctx.lineTo(cx + dx + Math.sin(dx) * 1.5, top + 11 + len);
      ctx.stroke();
      ctx.fillStyle = "#7fbf6a";
      for (let y = 3; y < len; y += 2.6) {
        ctx.beginPath();
        ctx.arc(cx + dx + Math.sin(dx + y * 0.3) * 1.2, top + 11 + y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Hung on a wall: a hanging basket with a fern spilling over.
  hangingFern(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 3;
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - 8, top + 12);
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + 8, top + 12);
    ctx.stroke();
    ctx.fillStyle = "#b08a50";
    ctx.beginPath();
    ctx.ellipse(cx, top + 13, 9, 5, 0, 0, Math.PI);
    ctx.fill();
    for (let i = -4; i <= 4; i++) {
      const angle = Math.PI / 2 + i * 0.35 + (i < 0 ? 0.6 : -0.6) * 0;
      const tx = cx + i * 4, ty = top + 14 + (6 - Math.abs(i)) * 3.5;
      ctx.strokeStyle = ["#3f6b3c", "#4f7a48", "#5f8a50"][(i + 9) % 3];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + i * 1.2, top + 11);
      ctx.quadraticCurveTo(cx + i * 3, top + 6, tx, ty);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      for (let t = 0.3; t < 1; t += 0.2) {
        const px = cx + i * 1.2 + (tx - cx - i * 1.2) * t, py = top + 11 + (ty - top - 11) * t - Math.sin(t * Math.PI) * 5;
        ctx.beginPath();
        ctx.ellipse(px, py, 2.2, 1, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Hung on a wall: a little wooden rack holding three air plants.
  airPlants(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22, "#b08a60");
    for (const fx of [0.22, 0.5, 0.78]) {
      const cx = shelf.x + shelf.w * fx, cy = shelf.y - 2;
      ctx.fillStyle = "#e9dcc2"; // a tiny holder
      ctx.fillRect(cx - 3, cy - 2, 6, 2);
      for (let i = -3; i <= 3; i++) drawLeaf(ctx, cx, cy - 1, i * 0.4, 9, 1.4, i % 2 ? "#a8c0a0" : "#8fae9e", null);
    }
  },

  // --- Shelves ---

  // Hung on a wall: a floating shelf of books, with a little candle.
  floatingBooks(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22);
    drawBookRow(ctx, shelf.x + 3, shelf.y, shelf.w * 0.7, 1);
    drawCandle(ctx, shelf.x + shelf.w - 8, shelf.y, performance.now() / 1000 + f.x, true);
  },

  // Hung on a wall: a shelf of candles and a little framed photo.
  candleShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 24, "#e9dcc2");
    const t = performance.now() / 1000;
    ctx.fillStyle = "#c9a24a"; // frame
    ctx.fillRect(shelf.x + 4, shelf.y - 12, 10, 12);
    ctx.fillStyle = "#f7d0da";
    ctx.fillRect(shelf.x + 5.5, shelf.y - 10.5, 7, 9);
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.arc(shelf.x + 9, shelf.y - 6, 2, 0, Math.PI * 2);
    ctx.fill();
    for (const [fx, h] of [[0.5, 10], [0.66, 14], [0.82, 8]]) {
      const cx = shelf.x + shelf.w * fx;
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(cx - 2.5, shelf.y - h, 5, h);
      drawCandle(ctx, cx, shelf.y - h + 7, t + fx * 5);
    }
  },

  // Hung on a wall: crystals, a moon and a little mushroom friend.
  crystalShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22, "#b08a60");
    const y = shelf.y;
    for (const [fx, h, color] of [[0.18, 10, "#b69ad8"], [0.3, 7, "#f2b8d0"], [0.4, 12, "#c9e0f0"]]) {
      const cx = shelf.x + shelf.w * fx;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y);
      ctx.lineTo(cx - 2, y - h + 2);
      ctx.lineTo(cx, y - h);
      ctx.lineTo(cx + 2, y - h + 2);
      ctx.lineTo(cx + 3, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(cx - 1, y - h + 3, 1, h - 5);
    }
    const mx = shelf.x + shelf.w * 0.6; // crescent moon
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(mx, y - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b08a60";
    ctx.beginPath();
    ctx.arc(mx + 2.5, y - 8, 4.2, 0, Math.PI * 2);
    ctx.fill();
    const sx = shelf.x + shelf.w * 0.82; // mushroom
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(sx - 1.5, y - 5, 3, 5);
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.ellipse(sx, y - 6, 5, 3.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(sx - 3, y - 8, 1.3, 1.3);
    ctx.fillRect(sx + 1, y - 9, 1.3, 1.3);
  },

  // Hung on a wall: tea tins on a shelf, with mugs on hooks underneath.
  teaShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 16);
    let x = shelf.x + 4;
    for (const color of ["#4f7a48", "#c0554a", "#d9a441", "#5f7a8c"]) {
      if (x > shelf.x + shelf.w - 10) break;
      ctx.fillStyle = color;
      roundRectPath(ctx, x, shelf.y - 10, 7, 10, 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(x + 1, shelf.y - 7, 5, 3);
      x += 9;
    }
    for (const [fx, color] of [[0.25, "#f2ece2"], [0.5, "#f2b8c4"], [0.75, "#a8c8e0"]]) {
      const mx = shelf.x + shelf.w * fx;
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(mx - 0.5, shelf.y + 3, 1, 3);
      ctx.fillStyle = color;
      roundRectPath(ctx, mx - 4, shelf.y + 6, 8, 8, 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(mx + 4.5, shelf.y + 10, 2.2, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  },

  // A 2-by-2 cube shelf with woven baskets, and a record and plant on top.
  cubeShelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 34, "#f2ece2");
    const { x, y, w, h } = s.face;
    ctx.fillStyle = "#d8cfbe";
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    for (const [cx, cy, basket] of [[0, 0, true], [1, 0, false], [0, 1, false], [1, 1, true]]) {
      const bx = x + 3 + cx * (w / 2), by = y + 3 + cy * (h / 2), bw = w / 2 - 6, bh = h / 2 - 5;
      if (basket) {
        ctx.fillStyle = "#c49a5c";
        ctx.fillRect(bx, by + 2, bw, bh - 2);
        ctx.strokeStyle = "rgba(90, 60, 25, 0.4)";
        ctx.lineWidth = 0.8;
        for (let yy = by + 5; yy < by + bh; yy += 3) {
          ctx.beginPath();
          ctx.moveTo(bx, yy);
          ctx.lineTo(bx + bw, yy);
          ctx.stroke();
        }
      } else {
        drawBookRow(ctx, bx + 1, by + bh, bw - 2, cx + cy * 3);
      }
    }
    const t = s.top;
    ctx.fillStyle = "#15151a"; // a record leaning on top
    ctx.beginPath();
    ctx.arc(t.x + t.w * 0.3, t.y + 2, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.arc(t.x + t.w * 0.3, t.y + 2, 2.5, Math.PI, 0);
    ctx.fill();
    drawPot(ctx, t.x + t.w * 0.75, t.y + t.h / 2 + 2, "ceramic", 5, 8);
    drawHeartLeaf(ctx, t.x + t.w * 0.75 - 3, t.y - 6, 3.5, "#5f9a55", -0.3);
    drawHeartLeaf(ctx, t.x + t.w * 0.75 + 3, t.y - 7, 3.5, "#4f8a4a", 0.3);
  },

  // A ladder shelf leaning on the wall, with a blanket, books and a plant.
  ladderShelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    const w = f.w * TILE, x = b.x, by = b.y - 2;
    ctx.fillStyle = "#b08a60"; // rails
    ctx.fillRect(x + 2, by - 62, 3, 62);
    ctx.fillRect(x + w - 5, by - 62, 3, 62);
    const rungs = [by - 12, by - 28, by - 44, by - 58];
    for (const [i, ry] of rungs.entries()) {
      const inset = i * 1.5;
      ctx.fillStyle = "#c9a57e";
      ctx.fillRect(x + 2 + inset, ry, w - 4 - inset * 2, 3);
    }
    ctx.fillStyle = "#e8b8a0"; // a blanket draped over the bottom rung
    ctx.fillRect(x + 6, rungs[0] - 2, w - 12, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 6, rungs[0] + 1 + i * 3, w - 12, 1);
    drawBookRow(ctx, x + 6, rungs[1], w * 0.45, 3);
    drawPot(ctx, x + w * 0.5, rungs[2], "clay", 5, 7);
    drawIvySprig(ctx, x + w * 0.5 - 3, rungs[2] - 7, 14, -1);
    drawIvySprig(ctx, x + w * 0.5 + 3, rungs[2] - 7, 10, 1);
    ctx.fillStyle = "#f2d45c"; // a little candle up top
    ctx.fillRect(x + w * 0.5 - 2, rungs[3] - 6, 4, 6);
  },

  // A wooden crate full of vinyl records.
  recordCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#b08a60");
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)";
    ctx.fillRect(c.face.x, c.face.y + c.face.h / 2, c.face.w, 1.5);
    const colors = ["#e37aa0", "#3f6f9f", "#f2d45c", "#7a9e5c", "#c0554a", "#9a6fb0", "#2b2b30"];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(c.top.x + 3 + i * ((c.top.w - 6) / 7), c.top.y - 8 + (i % 2), (c.top.w - 6) / 7 - 1, 12);
    }
  },

  // --- Decor ---

  // A glowing mushroom lamp, red with white spots.
  mushroomLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#f4ecdc";
    roundRectPath(ctx, b.x - 4, b.y - 16, 8, 14, 3);
    ctx.fill();
    const cap = ctx.createRadialGradient(b.x, b.y - 22, 2, b.x, b.y - 20, 14);
    cap.addColorStop(0, "#ff8a70");
    cap.addColorStop(1, "#c0554a");
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 17, 13, 11, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    for (const [dx, dy, r] of [[-6, -21, 2], [3, -24, 2.4], [7, -19, 1.6], [-1, -18, 1.4]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glowing moon lamp on a little wooden stand.
  moonLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const moon = ctx.createRadialGradient(b.x - 3, b.y - 16, 1, b.x, b.y - 13, 10);
    moon.addColorStop(0, "#fffbe8");
    moon.addColorStop(1, "#f2dca0");
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 170, 110, 0.35)"; // craters
    for (const [dx, dy, r] of [[-3, -15, 2], [3, -11, 1.5], [2, -17, 1]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A tall wavy-edged mirror standing on the floor.
  wavyMirror(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const h = 56, top = b.y - 2 - h;
    const path = (grow) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20, y = top + t * h;
        ctx.lineTo(b.x - 11 - grow + Math.sin(t * Math.PI * 4) * 2, y);
      }
      for (let i = 20; i >= 0; i--) {
        const t = i / 20, y = top + t * h;
        ctx.lineTo(b.x + 11 + grow + Math.sin(t * Math.PI * 4 + 1) * 2, y);
      }
      ctx.closePath();
    };
    path(2.5);
    ctx.fillStyle = "#f2e0c0";
    ctx.fill();
    path(0);
    const glass = ctx.createLinearGradient(b.x - 10, top, b.x + 10, top + h);
    glass.addColorStop(0, "#dfeaf2");
    glass.addColorStop(1, "#b8cad8");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(b.x - 5, top + 8, 2, 18);
    ctx.fillRect(b.x - 1, top + 10, 1.2, 10);
  },

  // A full-length arched mirror leaning on the wall, with a gold frame.
  archMirror(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    const w = f.w * TILE, h = 62;
    ctx.fillStyle = "#c9a24a";
    archPath(ctx, b.x + 2, b.y - 2 - h, w - 4, h);
    ctx.fill();
    const glass = ctx.createLinearGradient(b.x, b.y - h, b.x + w, b.y);
    glass.addColorStop(0, "#e4eef4");
    glass.addColorStop(1, "#b8cad8");
    ctx.fillStyle = glass;
    archPath(ctx, b.x + 5, b.y - h + 1, w - 10, h - 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(b.x + 9, b.y - h + 16, 2, 22);
  },

  // Hung on a wall: polaroid photos pegged to a string of warm lights.
  polaroidWall(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 8;
    ctx.strokeStyle = "rgba(90, 70, 50, 0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y + 6, x + w, y);
    ctx.stroke();
    const photos = ["#f2b8c4", "#a8c8e0", "#b9d6a4", "#f2d9a0"];
    const count = Math.max(2, Math.floor(w / 16));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, px = x + w * t, py = y + Math.sin(t * Math.PI) * 5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i % 2 ? 1 : -1) * 0.1);
      ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
      ctx.fillRect(-4, 3, 10, 12);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-5, 2, 10, 12);
      ctx.fillStyle = photos[i % photos.length];
      ctx.fillRect(-4, 3, 8, 7);
      ctx.fillStyle = "#b08a60"; // clothespin
      ctx.fillRect(-1, 0, 2, 4);
      ctx.restore();
    }
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(x + w * t, y + Math.sin(t * Math.PI) * 5 + 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Hung on a wall: a boho tapestry with a sun and mountains.
  tapestry(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = 30;
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(x - 2, y, w + 4, 2);
    ctx.fillStyle = "#f2e0c4";
    ctx.fillRect(x, y + 2, w, h);
    ctx.fillStyle = "#e0845a";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 16, 6, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#e0845a";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI + (i + 0.5) * (Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 + Math.cos(ang) * 8, y + 16 + Math.sin(ang) * 8);
      ctx.lineTo(x + w / 2 + Math.cos(ang) * 11, y + 16 + Math.sin(ang) * 11);
      ctx.stroke();
    }
    ctx.fillStyle = "#a8785a";
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.lineTo(x + w * 0.3, y + 18);
    ctx.lineTo(x + w * 0.55, y + 26);
    ctx.lineTo(x + w * 0.75, y + 20);
    ctx.lineTo(x + w, y + 26);
    ctx.lineTo(x + w, y + h + 2);
    ctx.lineTo(x, y + h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e9dcc2"; // fringe
    for (let fx = x + 2; fx < x + w; fx += 3) {
      ctx.beginPath();
      ctx.moveTo(fx, y + h + 2);
      ctx.lineTo(fx, y + h + 6);
      ctx.stroke();
    }
  },

  // Hung on a wall: a glowing pink neon heart.
  heartNeon(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, cy = a.y - WALL_HEIGHT + 17;
    ctx.save();
    ctx.shadowColor = "rgba(255, 110, 170, 0.9)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255, 150, 200, ${0.85 + Math.sin(performance.now() / 350) * 0.1})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 9);
    ctx.bezierCurveTo(cx - 14, cy, cx - 8, cy - 11, cx, cy - 4);
    ctx.bezierCurveTo(cx + 8, cy - 11, cx + 14, cy, cx, cy + 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 240, 248, 0.9)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  },

  // Hung on a wall: a curtain of warm fairy lights.
  fairyCurtain(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3;
    const t = performance.now() / 1000;
    ctx.strokeStyle = "rgba(90, 70, 50, 0.5)";
    ctx.lineWidth = 0.6;
    for (let sx = x + 3; sx < x + w - 1; sx += 5) {
      const len = 18 + ((sx * 7) % 13);
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + len);
      ctx.stroke();
      for (let ly = y + 4; ly < y + len; ly += 6) {
        ctx.fillStyle = `rgba(255, 220, 140, ${0.6 + Math.sin(t * 2 + sx + ly) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, ly, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A little disco ball, catching the light.
  discoBall(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const cy = b.y - 12, t = performance.now() / 1000;
    ctx.fillStyle = "#b8bcc8";
    ctx.beginPath();
    ctx.arc(b.x, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, cy, 10, 0, Math.PI * 2);
    ctx.clip();
    for (let gy = -10; gy < 10; gy += 3) {
      for (let gx = -10; gx < 10; gx += 3) {
        const shine = (Math.sin(gx * 0.9 + gy * 1.3 + t * 3) + 1) / 2;
        ctx.fillStyle = `rgba(${200 + shine * 55}, ${210 + shine * 45}, ${230 + shine * 25}, 1)`;
        ctx.fillRect(b.x + gx + 0.3, cy + gy + 0.3, 2.4, 2.4);
      }
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(b.x - 4, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },

  // A basket of rolled-up chunky knit blankets.
  blanketBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const bk = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#c49a5c");
    ctx.strokeStyle = "rgba(90, 55, 20, 0.45)";
    ctx.lineWidth = 1;
    for (let yy = bk.face.y + 3; yy < bk.face.y + bk.face.h; yy += 3) {
      ctx.beginPath();
      ctx.moveTo(bk.face.x, yy);
      ctx.lineTo(bk.face.x + bk.face.w, yy);
      ctx.stroke();
    }
    for (const [fx, color] of [[0.3, "#f2e0c4"], [0.55, "#c98a8a"], [0.78, "#a8b89a"]]) {
      const cx = bk.top.x + bk.top.w * fx, cy = bk.top.y + 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shadeColor(color, -25);
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // A big, soft teddy bear sitting on the floor.
  teddyBear(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const c = "#c49a6c";
    petBlob(ctx, b.x - 7, b.y - 5, 5, 4, c); // feet
    petBlob(ctx, b.x + 7, b.y - 5, 5, 4, c);
    petBlob(ctx, b.x, b.y - 14, 11, 10, c); // body
    ctx.fillStyle = "#f2e0c4";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 12, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, b.x - 10, b.y - 17, 3.5, 5, c); // arms
    petBlob(ctx, b.x + 10, b.y - 17, 3.5, 5, c);
    petBlob(ctx, b.x - 7, b.y - 35, 4, 4, c); // ears
    petBlob(ctx, b.x + 7, b.y - 35, 4, 4, c);
    petBlob(ctx, b.x, b.y - 29, 9, 8, c); // head
    ctx.fillStyle = "#f2e0c4";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 26, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(b.x - 3.5, b.y - 31, 1.2, 0, Math.PI * 2);
    ctx.arc(b.x + 3.5, b.y - 31, 1.2, 0, Math.PI * 2);
    ctx.ellipse(b.x, b.y - 27, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e37aa0"; // a bow
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 21);
    ctx.lineTo(b.x - 5, b.y - 24);
    ctx.lineTo(b.x - 5, b.y - 18);
    ctx.moveTo(b.x, b.y - 21);
    ctx.lineTo(b.x + 5, b.y - 24);
    ctx.lineTo(b.x + 5, b.y - 18);
    ctx.fill();
  },

  // --- More furniture ---

  // A vanity table with a round mirror ringed with bulbs, and a stool.
  vanity(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#f2ece2");
    const cx = d.top.x + d.top.w / 2, cy = d.top.y - 14;
    ctx.fillStyle = "#c9a24a";
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dfeaf2";
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(cx - 6, cy - 6, 2, 9);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillStyle = "#fff4c8";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e37aa0"; // perfume and a lipstick
    ctx.fillRect(d.top.x + 6, d.top.y + d.top.h / 2 - 5, 5, 6);
    ctx.fillStyle = "#b69ad8";
    ctx.fillRect(d.top.x + d.top.w - 12, d.top.y + d.top.h / 2 - 6, 4, 7);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x + d.face.w / 2 - 5, d.face.y + 8, 10, 1.6);
  },

  // A bed with four posts, sheer drapes and fairy lights. You can sleep in it.
  canopyBed(ctx, f) {
    FURNITURE_DRAWERS.bed(ctx, f);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const topY = a.y - 58;
    ctx.fillStyle = "#e9dcc2"; // posts
    for (const px of [a.x + 1, b.x - 4]) {
      ctx.fillRect(px, topY, 3, a.y - topY);
      ctx.fillRect(px, b.y - 40, 3, 30);
    }
    ctx.fillStyle = "#e9dcc2";
    ctx.fillRect(a.x, topY - 2, b.x - a.x, 3);
    ctx.fillStyle = "rgba(255, 250, 245, 0.45)"; // sheer drapes
    for (const [x1, dir] of [[a.x + 3, 1], [b.x - 3, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x1, topY);
      ctx.quadraticCurveTo(x1 + dir * 14, topY + 30, x1 + dir * 4, b.y - 12);
      ctx.lineTo(x1, b.y - 12);
      ctx.closePath();
      ctx.fill();
    }
    const t = performance.now() / 1000;
    for (let i = 0; i <= 10; i++) {
      const px = a.x + ((b.x - a.x) * i) / 10;
      ctx.fillStyle = `rgba(255, 220, 140, ${0.7 + Math.sin(t * 2 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(px, topY + 3 + Math.sin((i / 10) * Math.PI) * 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A papasan chair: a big round rattan bowl with a thick cushion.
  papasanChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#a8783e"; // base
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c49a5c"; // bowl
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 16, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 60, 25, 0.35)";
    ctx.lineWidth = 0.8;
    for (let r = 6; r < 22; r += 4) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 16, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cushion = ctx.createRadialGradient(b.x, b.y - 20, 2, b.x, b.y - 17, 18);
    cushion.addColorStop(0, "#f7e0d0");
    cushion.addColorStop(1, "#e0b8a0");
    ctx.fillStyle = cushion;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 17, 17, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160, 110, 90, 0.35)";
    ctx.beginPath();
    ctx.arc(b.x, b.y - 17, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A hanging rattan egg chair on its stand, gently swaying.
  eggChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.strokeStyle = "#3a3a40"; // the stand
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - 12, b.y - 2);
    ctx.lineTo(b.x + 12, b.y - 2);
    ctx.moveTo(b.x + 8, b.y - 2);
    ctx.lineTo(b.x + 8, b.y - 66);
    ctx.quadraticCurveTo(b.x + 8, b.y - 74, b.x, b.y - 72);
    ctx.stroke();
    const sway = Math.sin(performance.now() / 900) * 0.05;
    ctx.save();
    ctx.translate(b.x, b.y - 72);
    ctx.rotate(sway);
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.fillStyle = "#c49a5c";
    ctx.beginPath();
    ctx.ellipse(0, 32, 14, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b4a2e"; // the opening
    ctx.beginPath();
    ctx.ellipse(0, 36, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2e0c4"; // cushion
    ctx.beginPath();
    ctx.ellipse(0, 44, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 60, 25, 0.35)";
    ctx.lineWidth = 0.7;
    for (let y = 12; y < 54; y += 4) {
      ctx.beginPath();
      ctx.moveTo(-13, y);
      ctx.lineTo(-9, y);
      ctx.moveTo(9, y);
      ctx.lineTo(13, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  // A puffy cream boucle "cloud" sofa.
  cloudSofa(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    const puff = (x, y, rx, ry, shade) => {
      const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
      g.addColorStop(0, shadeColor("#f2ece2", 10 + shade));
      g.addColorStop(1, shadeColor("#f2ece2", -22 + shade));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    puff(a.x + w / 2, b.y - 34, w / 2 - 2, 14, -6); // back
    puff(a.x + 10, b.y - 18, 11, 14, 0); // arms
    puff(b.x - 10, b.y - 18, 11, 14, 0);
    puff(a.x + w * 0.36, b.y - 14, w * 0.22, 10, 4); // seats
    puff(a.x + w * 0.64, b.y - 14, w * 0.22, 10, 4);
    ctx.fillStyle = "rgba(160, 140, 120, 0.25)"; // boucle texture
    for (let i = 0; i < 40; i++) ctx.fillRect(a.x + 4 + noise(i * 3.3) * (w - 8), b.y - 44 + noise(i * 5.1) * 36, 1, 1);
    ctx.fillStyle = "#e0b8a0"; // a pillow
    roundRectPath(ctx, a.x + w * 0.62, b.y - 30, 14, 11, 4);
    ctx.fill();
  },

  // A chunky knit pouf.
  pouf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const c = f.color || "#e0c8b0";
    const g = ctx.createLinearGradient(0, b.y - 22, 0, b.y);
    g.addColorStop(0, shadeColor(c, 20));
    g.addColorStop(1, shadeColor(c, -20));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 10, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(c, -30);
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x + i * 3.6, b.y - 10, 1.8, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // A round side table with a mug and a bud vase.
  sideTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(b.x - 1.5, b.y - 18, 3, 16);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8784e";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 19, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(b.x - 7, b.y - 25, 5, 6);
    const vt = drawVase(ctx, b.x + 5, b.y - 19, "amber");
    ctx.fillStyle = "#f7c6d6";
    ctx.beginPath();
    ctx.arc(b.x + 5, vt - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A clothes rail with cozy sweaters and a little hat on top.
  clothesRack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    const x = a.x, by = a.y - 2;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + 2, by - 50, 2, 50);
    ctx.fillRect(x + w - 4, by - 50, 2, 50);
    ctx.fillRect(x + 2, by - 50, w - 4, 2);
    const clothes = ["#e8b8a0", "#a8b89a", "#f2e0c4", "#b69ad8", "#c98a8a"];
    const n = Math.floor((w - 10) / 9);
    for (let i = 0; i < n; i++) {
      const cx = x + 7 + i * 9;
      ctx.strokeStyle = "#8a8a94";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, by - 49);
      ctx.lineTo(cx - 4, by - 45);
      ctx.lineTo(cx + 4, by - 45);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = clothes[i % clothes.length];
      roundRectPath(ctx, cx - 5, by - 45, 10, 22 + (i % 2) * 4, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let k = 0; k < 3; k++) ctx.fillRect(cx - 4, by - 40 + k * 5, 8, 1);
    }
    ctx.fillStyle = "#f2e0c4"; // a shoe box underneath
    ctx.fillRect(x + w * 0.3, by - 7, w * 0.4, 6);
  },

  // A little gold bar cart with a teapot and cups.
  barCart(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    const x = a.x, by = a.y - 2;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + 3, by - 26, 2, 24);
    ctx.fillRect(x + w - 5, by - 26, 2, 24);
    ctx.fillStyle = "#f2e4c4";
    ctx.fillRect(x + 2, by - 26, w - 4, 3);
    ctx.fillRect(x + 2, by - 11, w - 4, 3);
    ctx.fillStyle = "#3a3a40";
    for (const wx of [x + 5, x + w - 5]) {
      ctx.beginPath();
      ctx.arc(wx, by - 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f7c6d6"; // teapot
    ctx.beginPath();
    ctx.arc(x + w * 0.35, by - 31, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w * 0.35 + 4, by - 33, 4, 1.5);
    for (const fx of [0.62, 0.78]) {
      ctx.fillStyle = "#fffaf3";
      ctx.fillRect(x + w * fx - 2.5, by - 30, 5, 4);
    }
    ctx.fillStyle = "#b9d6a4"; // a plant on the lower shelf
    ctx.beginPath();
    ctx.arc(x + w * 0.4, by - 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8913a";
    ctx.fillRect(x + w * 0.62, by - 16, 6, 5);
  },

  // A little mushroom stool.
  mushroomStool(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#f4ecdc";
    roundRectPath(ctx, b.x - 5, b.y - 12, 10, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#e0845a";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 13, 12, 7, 0, Math.PI, 0);
    ctx.ellipse(b.x, b.y - 13, 12, 3, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    for (const [dx, dy] of [[-5, -16], [3, -18], [7, -14]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // An aesthetic desk: a pastel keyboard, a monitor with a sunset, a plant
  // and a lamp.
  aestheticDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#f2ece2");
    const { x, y, w, h } = d.top;
    const mx = x + w / 2 - 20, my = y - 22;
    ctx.fillStyle = "#e8e2d8";
    roundRectPath(ctx, mx, my, 40, 26, 3);
    ctx.fill();
    const sky = ctx.createLinearGradient(0, my + 2, 0, my + 23);
    sky.addColorStop(0, "#f7b8c8");
    sky.addColorStop(1, "#f2d09a");
    ctx.fillStyle = sky;
    ctx.fillRect(mx + 2, my + 2, 36, 21);
    ctx.fillStyle = "#fff4d0";
    ctx.beginPath();
    ctx.arc(mx + 20, my + 17, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e8e2d8";
    ctx.fillRect(mx + 18, my + 26, 4, 5);
    ctx.fillStyle = "#f7d0da"; // pastel keyboard and mouse
    roundRectPath(ctx, x + w / 2 - 16, y + h - 12, 28, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 18, y + h - 8, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPot(ctx, x + 9, y + h / 2 + 2, "pink", 5, 7);
    drawLeaf(ctx, x + 9, y + h / 2 - 6, -0.4, 9, 3, "#5f9a55");
    drawLeaf(ctx, x + 9, y + h / 2 - 6, 0.4, 9, 3, "#4f8a4a");
    const lx = x + w - 10; // a little arch lamp
    ctx.strokeStyle = "#f2ece2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, y + h / 2);
    ctx.quadraticCurveTo(lx, y - 20, lx - 8, y - 14);
    ctx.stroke();
    ctx.fillStyle = "#fff4c8";
    ctx.beginPath();
    ctx.arc(lx - 8, y - 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A LAN station: desk with a PC tower, keyboard and a monitor facing
  // you. Whoever stands on the stool in front covers the desk's front,
  // with the screen still glowing above their head.
  pcDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, WOOD);
    const { x, y, w, h } = d.top;
    // Monitor on the back of the desk.
    const mw = 44, mh = 28, mx = x + w / 2 - mw / 2 - 6, my = y - mh + 6;
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(mx + mw / 2 - 3, my + mh - 2, 6, 8); // stand
    roundRectPath(ctx, mx, my, mw, mh, 3);
    ctx.fill();
    const screen = ctx.createLinearGradient(0, my, 0, my + mh);
    screen.addColorStop(0, shadeColor(f.screen, 30));
    screen.addColorStop(1, shadeColor(f.screen, -40));
    ctx.fillStyle = screen;
    ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 6);
    // A few blocky "game" shapes on the screen.
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(mx + 8, my + mh - 11, 6, 6);
    ctx.fillRect(mx + 20, my + 8, 10, 4);
    ctx.fillRect(mx + 30, my + mh - 13, 6, 8);
    // PC tower on the right, with a colored light strip.
    const tx = x + w - 16, ty = y - 18;
    ctx.fillStyle = "#26262c";
    roundRectPath(ctx, tx, ty, 12, 26, 2);
    ctx.fill();
    ctx.fillStyle = f.screen;
    ctx.fillRect(tx + 2, ty + 4, 2, 18);
    // Keyboard and mouse at the front edge.
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(mx + 4, y + h - 11, 30, 7);
    ctx.beginPath();
    ctx.ellipse(mx + 42, y + h - 7, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A round stool or cushion you stand on to sit at a desk or table.
  stool(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b33";
    ctx.fillRect(c.x - 2, c.y - 4, 4, 10);
    ctx.fillStyle = f.color || "#c0554a";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 5, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Kitchen counter with a stove: cream cupboards, a wood worktop, two
  // burners with a pot on one, and a cutting board with a loaf of bread.
  stove(ctx, f) {
    const c = drawCounter(ctx, f);
    const { x, y, w, h } = c.top;
    ctx.fillStyle = "#3a3a40";
    roundRectPath(ctx, x + w - 36, y + 3, 32, h - 6, 3);
    ctx.fill();
    ctx.strokeStyle = "#6a6a72";
    ctx.lineWidth = 1.5;
    for (const bx of [x + w - 28, x + w - 12]) {
      ctx.beginPath();
      ctx.ellipse(bx, y + h / 2, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#c0554a"; // pot
    ctx.fillRect(x + w - 35, y + h / 2 - 10, 14, 10);
    ctx.fillStyle = "#a8473a";
    ctx.fillRect(x + w - 37, y + h / 2 - 11, 18, 3);
    ctx.fillStyle = "#d9b98f"; // cutting board
    roundRectPath(ctx, x + 6, y + 4, 24, h - 8, 3);
    ctx.fill();
    ctx.fillStyle = "#c98a3c"; // bread
    ctx.beginPath();
    ctx.ellipse(x + 18, y + h / 2 - 1, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A small counter with a sink and a tall tap.
  sink(ctx, f) {
    const c = drawCounter(ctx, f);
    const { x, y, w, h } = c.top;
    ctx.fillStyle = "#b8c2c8";
    roundRectPath(ctx, x + 5, y + 4, w - 10, h - 8, 4);
    ctx.fill();
    ctx.fillStyle = "#8f9aa1";
    roundRectPath(ctx, x + 8, y + 7, w - 16, h - 12, 3);
    ctx.fill();
    ctx.strokeStyle = "#cfd6da";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 4);
    ctx.lineTo(x + w / 2, y - 8);
    ctx.quadraticCurveTo(x + w / 2, y - 12, x + w / 2 + 6, y - 10);
    ctx.stroke();
  },

  // A little wooden tea cart on wheels: plates on the bottom shelf, a
  // teapot and two cups on top. Looks the same from any side, so it sits
  // happily against any wall.
  teaCart(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, depth = b.y - a.y, trayH = 28;
    // Bottom shelf with a stack of plates.
    const shelf = drawBlock(ctx, f.x, f.y, f.w, f.h, 8, WOOD);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? "#e8dcc8" : "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(shelf.top.x + w / 2, shelf.top.y + depth / 2 - i * 2.5, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Legs and wheels.
    ctx.fillStyle = WOOD_DARK;
    for (const lx of [a.x + 2, b.x - 5]) ctx.fillRect(lx, b.y - trayH, 3, trayH - 2);
    for (const wx of [a.x + 3.5, b.x - 3.5]) {
      ctx.beginPath();
      ctx.arc(wx, b.y - 1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Top tray with a little raised lip.
    ctx.fillStyle = "#a3785a";
    ctx.fillRect(a.x, a.y - trayH, w, depth);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - trayH - 3, w, 4);
    // Teapot and cups on the tray.
    const ty = a.y - trayH + depth / 2;
    ctx.fillStyle = "#4a90a4";
    ctx.beginPath();
    ctx.ellipse(a.x + 16, ty - 4, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(a.x + 14, ty - 12, 4, 3);
    ctx.strokeStyle = "#4a90a4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + 23, ty - 4);
    ctx.lineTo(a.x + 28, ty - 9);
    ctx.stroke();
    for (const cx of [a.x + w - 22, a.x + w - 11]) {
      ctx.fillStyle = "#f7f1e6";
      ctx.fillRect(cx - 3.5, ty - 5, 7, 6);
      ctx.fillStyle = "#5c3a22";
      ctx.fillRect(cx - 2.5, ty - 5, 5, 1.5);
    }
  },

  // --- Library ---

  // Hung on a wall face: a round clock showing the real time where you are.
  clock(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x, cy = a.y - WALL_HEIGHT + 17, r = 11;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 2.5, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b6b4a";
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbf6ea";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(angle) * (r - 2.5) - 0.6, cy + Math.sin(angle) * (r - 2.5) - 0.6, 1.2, 1.2);
    }
    const now = new Date();
    const hands = [
      [((now.getHours() % 12) + now.getMinutes() / 60) / 12, r * 0.5, 2],
      [now.getMinutes() / 60, r * 0.78, 1.4],
    ];
    ctx.strokeStyle = "#3a2a1e";
    ctx.lineCap = "round";
    for (const [turn, length, width] of hands) {
      const angle = turn * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  },

  // Hung on a wall face: a window on a rainy evening, with raindrops
  // running down the glass, green curtains and a little sill.
  rainWindow(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 4, w = f.w * TILE, h = 28;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x, y, w, h);
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, "#4f6478");
    sky.addColorStop(1, "#7f97aa");
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);
    // Raindrops sliding down the glass, each at its own speed.
    const t = performance.now() / 1000;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    ctx.strokeStyle = "rgba(220, 235, 245, 0.6)";
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.round(iw / 4); i++) {
      const dx = ix + ((i * 7.3) % iw);
      const fall = (t * (0.5 + noise(i + f.x) * 0.9) + noise(i * 3.1 + f.x)) % 1;
      const dy = iy - 4 + fall * (ih + 8);
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - 0.8, dy + 4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(220, 235, 245, 0.45)"; // drops resting on the glass
    for (let i = 0; i < 6; i++) ctx.fillRect(ix + noise(i + 40 + f.x) * iw, iy + noise(i + 50 + f.x) * ih, 1.5, 1.5);
    ctx.restore();
    ctx.fillStyle = WOOD_DARK; // window bars
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.fillStyle = "#8b6b4a"; // sill
    ctx.fillRect(x - 3, y + h, w + 6, 3);
    ctx.fillStyle = "#4f6b52"; // curtains
    ctx.fillRect(x - 4, y - 2, 7, h + 3);
    ctx.fillRect(x + w - 3, y - 2, 7, h + 3);
  },

  // A tall freestanding bookcase, packed with three rows of books, with a
  // couple of books lying on top.
  libraryShelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const shelf = drawBlock(ctx, f.x, f.y, f.w, f.h, 58, "#5a3a26");
    const bookColors = ["#8f2f2a", "#3f6f9f", "#c98a3c", "#4f7a48", "#7d6a8f", "#b5603c", "#2f4f4f"];
    const { x, y, w } = shelf.face;
    for (let row = 0; row < 3; row++) {
      const rowY = y + 4 + row * 17;
      ctx.fillStyle = "#3a2618";
      ctx.fillRect(x + 3, rowY, w - 6, 14);
      for (let i = 0; i * 6 + 5 < w - 6; i++) {
        const bh = 10 + ((i * 5 + row * 3) % 4);
        ctx.fillStyle = bookColors[(i * 3 + row * 2 + Math.round(f.x)) % bookColors.length];
        ctx.fillRect(x + 5 + i * 6, rowY + 14 - bh, 5, bh);
      }
    }
    const top = shelf.top;
    ctx.fillStyle = "#c98a3c";
    ctx.fillRect(top.x + 6, top.y + top.h / 2 - 3, 16, 4);
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(top.x + 8, top.y + top.h / 2 - 7, 13, 4);
  },

  // A long reading table with two green banker's lamps, open books and a
  // stack of books to get through.
  readingTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#5c3d2a");
    const { x, y, w, h } = t.top;
    const mid = y + h / 2;
    for (const bx of [x + 14, x + w - 44]) {
      ctx.fillStyle = "#f4ecdc"; // open book
      ctx.fillRect(bx, mid - 3, 26, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(bx + 12.5, mid - 3, 1, 13);
    }
    for (const lx of [x + w * 0.33, x + w * 0.67]) {
      ctx.fillStyle = "#b8923a"; // brass stand
      ctx.fillRect(lx - 5, mid + 1, 10, 3);
      ctx.fillRect(lx - 0.8, mid - 10, 1.6, 11);
      ctx.fillStyle = "#2f6b45"; // green glass shade
      ctx.beginPath();
      ctx.ellipse(lx, mid - 11, 8, 4, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(lx - 8, mid - 11, 16, 2);
    }
    const stack = ["#8f2f2a", "#c98a3c", "#3f6f9f"];
    stack.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + w / 2 - 8, mid + 4 - i * 4, 16 - i * 2, 4);
    });
  },

  // --- Conference Room ---

  // A rolling whiteboard on legs, showing whatever's drawn on the shared
  // board right now.
  whiteboard(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, boardH = w / 2.4, legH = 16;
    const y = a.y - legH - boardH;
    ctx.fillStyle = "#6f7680"; // legs and wheels
    ctx.fillRect(a.x + 10, a.y - legH, 3, legH);
    ctx.fillRect(b.x - 13, a.y - legH, 3, legH);
    ctx.fillRect(a.x + 4, a.y - 3, 16, 2);
    ctx.fillRect(b.x - 20, a.y - 3, 16, 2);
    ctx.fillStyle = "#9aa3ad"; // frame
    roundRectPath(ctx, a.x - 2, y - 2, w + 4, boardH + 4, 3);
    ctx.fill();
    const live = document.getElementById("whiteboard-canvas");
    if (live) {
      ctx.imageSmoothingEnabled = true; // shrinking the drawing: smooth, so thin lines don't vanish
      ctx.drawImage(live, a.x + 1, y + 1, w - 2, boardH - 2);
      ctx.imageSmoothingEnabled = false;
    }
    else {
      ctx.fillStyle = "white";
      ctx.fillRect(a.x + 1, y + 1, w - 2, boardH - 2);
    }
    ctx.fillStyle = "#7d858f"; // marker tray
    ctx.fillRect(a.x + 6, y + boardH + 1, w - 12, 3);
    const markers = ["#2b2b2b", "#c0554a", "#3f6f9f", "#4f7a48"];
    markers.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(a.x + 14 + i * 9, y + boardH - 1, 7, 2);
    });
  },

  // A big walnut conference table with laptops, notepads, water glasses
  // and a little plant in the middle.
  conferenceTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#6b4a32");
    const { x, y, w, h } = t.top;
    // Laptops along each long side.
    for (const lx of [x + 22, x + w - 48]) {
      ctx.fillStyle = "#c8ccd2";
      roundRectPath(ctx, lx, y + 6, 26, 16, 2);
      ctx.fill();
      ctx.fillStyle = "#6fa7c8";
      ctx.fillRect(lx + 3, y + 8, 20, 11);
    }
    // Notepads and pens on the near side.
    for (const nx of [x + 30, x + w - 44]) {
      ctx.fillStyle = "#f4ecd2";
      ctx.fillRect(nx, y + h - 20, 14, 16);
      ctx.fillStyle = "#3f6f9f";
      ctx.fillRect(nx + 16, y + h - 19, 2, 13);
    }
    // Water glasses.
    for (const gx of [x + 14, x + w / 2 + 24, x + w - 14]) {
      ctx.fillStyle = "rgba(200, 230, 245, 0.7)";
      ctx.fillRect(gx - 3, y + h / 2 - 4, 6, 8);
    }
    // A small plant in the middle.
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(cx - 6, cy - 2, 12, 8);
    for (const [dx, dy, color] of [[-4, -6, "#4f7a48"], [4, -7, "#5c8a54"], [0, -10, "#6fa05e"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // --- The raccoon shop ---

  // Three raccoons stacked in one long trenchcoat, swaying a little: the top
  // one's masked face under a floppy hat, the middle one's eyes peeking out
  // between the coat buttons, and a striped tail and little paws poking out
  // at the bottom.
  raccoons(ctx, f) {
    const t = performance.now() / 1000;
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const bx = base.x, by = base.y;
    drawShadow(ctx, f.x, f.y, f.w, f.h);

    // Striped tail poking out from under the hem, wagging.
    const wag = Math.sin(t * 3) * 3;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#3a3a40" : "#9a9aa2";
      ctx.beginPath();
      ctx.arc(bx + 12 + i * 3, by - 6 - i * 2.2 + (i * wag) / 6, 3.4 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Little feet.
    ctx.fillStyle = "#4a4a52";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + side * 5, by - 2, 4, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Everything above the feet sways gently.
    ctx.save();
    ctx.translate(bx, by - 4);
    ctx.rotate(Math.sin(t * 1.6) * 0.035);
    ctx.translate(-bx, -(by - 4));

    // The trenchcoat: wider at the hem, lit from above.
    const coat = ctx.createLinearGradient(0, by - 66, 0, by - 6);
    coat.addColorStop(0, "#d6b98a");
    coat.addColorStop(1, "#a88a5c");
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - 66);
    ctx.lineTo(bx + 12, by - 66);
    ctx.lineTo(bx + 16, by - 6);
    ctx.lineTo(bx - 16, by - 6);
    ctx.closePath();
    ctx.fill();
    // The gap between the coat flaps, where the middle raccoon peeks out.
    ctx.fillStyle = "#2f2a2a";
    ctx.beginPath();
    ctx.ellipse(bx + 1, by - 44, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = (t % 4) < 0.12;
    const look = Math.sin(t * 0.7) * 1.2;
    if (!blink) {
      ctx.fillStyle = "#fbe9a8";
      ctx.beginPath();
      ctx.arc(bx - 0.6 + look, by - 46, 1.8, 0, Math.PI * 2);
      ctx.arc(bx + 2.6 + look, by - 46, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Seam, belt and buttons.
    ctx.strokeStyle = "rgba(90, 65, 35, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 1, by - 36);
    ctx.lineTo(bx + 1, by - 6);
    ctx.stroke();
    ctx.fillStyle = "#8a6a40";
    ctx.fillRect(bx - 14, by - 32, 29, 4);
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(bx - 2, by - 33, 5, 6);
    ctx.fillStyle = "#5c4530";
    for (const yy of [by - 56, by - 22, by - 14]) {
      ctx.beginPath();
      ctx.arc(bx - 3, yy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sleeves with little grey paws.
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#b99a6a";
      roundRectPath(ctx, bx + side * 13 - 4, by - 58, 8, 22, 3);
      ctx.fill();
      ctx.fillStyle = "#6a6a72";
      ctx.beginPath();
      ctx.arc(bx + side * 13, by - 35, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Popped collar.
    ctx.fillStyle = "#c4a676";
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - 66);
    ctx.lineTo(bx - 3, by - 66);
    ctx.lineTo(bx - 9, by - 58);
    ctx.closePath();
    ctx.moveTo(bx + 12, by - 66);
    ctx.lineTo(bx + 3, by - 66);
    ctx.lineTo(bx + 9, by - 58);
    ctx.closePath();
    ctx.fill();

    // The top raccoon's head.
    const hx = bx, hy = by - 75;
    ctx.fillStyle = "#8f8f98";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * 8, hy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ececef"; // white face markings
    ctx.beginPath();
    ctx.ellipse(hx, hy + 5, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx - 8, hy - 6, 16, 2.2);
    ctx.fillStyle = "#2b2b30"; // the bandit mask
    roundRectPath(ctx, hx - 10, hy - 3.5, 20, 6.5, 3);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(hx - 4.5, hy - 0.5, 1.6, 0, Math.PI * 2);
    ctx.arc(hx + 4.5, hy - 0.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1e22";
    ctx.beginPath();
    ctx.arc(hx, hy + 3.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Floppy brown hat, a little low over the eyes.
    ctx.fillStyle = "#5c4530";
    ctx.beginPath();
    ctx.ellipse(hx, hy - 7, 15, 3.8, -0.08, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, hx - 8, hy - 17, 16, 11, 4);
    ctx.fill();
    ctx.fillStyle = "#3f2f22";
    ctx.fillRect(hx - 8, hy - 10, 16, 2.5);
    ctx.restore();
  },

  // --- Theater ---

  // The big cinema screen on a low stage, with speakers either side.
  bigScreen(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stage = drawBlock(ctx, f.x, f.y, f.w, f.h, 6, "#3a2230");
    const x = stage.top.x + 8, w = stage.top.w - 16, h = 56;
    const y = stage.top.y - h + 4;
    ctx.fillStyle = "#1c1418";
    roundRectPath(ctx, x - 4, y - 4, w + 8, h + 8, 4);
    ctx.fill();
    const screen = ctx.createLinearGradient(0, y, 0, y + h);
    screen.addColorStop(0, "#dfe7f2");
    screen.addColorStop(1, "#b9c6d8");
    ctx.fillStyle = screen;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath(); // a soft play symbol
    ctx.moveTo(x + w / 2 - 7, y + h / 2 - 9);
    ctx.lineTo(x + w / 2 + 9, y + h / 2);
    ctx.lineTo(x + w / 2 - 7, y + h / 2 + 9);
    ctx.closePath();
    ctx.fill();
    for (const sx of [stage.top.x - 2, stage.top.x + stage.top.w - 10]) {
      ctx.fillStyle = "#2a1f26";
      roundRectPath(ctx, sx, y + 14, 12, 34, 3);
      ctx.fill();
      ctx.fillStyle = "#4a3a44";
      ctx.beginPath();
      ctx.arc(sx + 6, y + 24, 3.5, 0, Math.PI * 2);
      ctx.arc(sx + 6, y + 38, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A plush red cinema seat facing the screen (so you see its back), with
  // armrests. Sort order draws it over whoever sits in it.
  theaterSeat(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.08, f.y, f.w - 0.16, f.h - 0.2, 12, "#7d2a33"); // seat cushion
    drawBlock(ctx, f.x, f.y + 0.05, 0.08, f.h - 0.05, 17, "#4a2a30"); // armrests
    drawBlock(ctx, f.x + f.w - 0.08, f.y + 0.05, 0.08, f.h - 0.05, 17, "#4a2a30");
    const back = drawBlock(ctx, f.x + 0.04, f.y + f.h - 0.2, f.w - 0.08, 0.2, 26, "#9b3540");
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundRectPath(ctx, back.face.x + 4, back.face.y + 3, back.face.w - 8, back.face.h - 9, 4);
    ctx.fill();
  },

  // Red velvet stage curtains hung just in front of the Theater's screen,
  // drawn open on both sides of it, under a gold-fringed valance with a
  // row of little marquee bulbs.
  stageCurtains(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, top = a.y - 80, bottom = a.y;
    for (const side of [0, 1]) {
      const cx = side ? x + w - 14 : x + 14; // each drape gathers toward its edge
      const drape = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
      drape.addColorStop(0, "#5e1522");
      drape.addColorStop(0.5, "#a3263a");
      drape.addColorStop(1, "#5e1522");
      ctx.fillStyle = drape;
      ctx.beginPath();
      ctx.moveTo(cx - 16, top);
      ctx.lineTo(cx + 16, top);
      ctx.quadraticCurveTo(cx + 6, bottom - 18, cx + 10, bottom);
      ctx.lineTo(cx - 10, bottom);
      ctx.quadraticCurveTo(cx - 6, bottom - 18, cx - 16, top);
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 5, 15, 0.35)"; // folds
      ctx.lineWidth = 1;
      for (const dx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 1.5, top + 2);
        ctx.quadraticCurveTo(cx + dx * 0.6, bottom - 18, cx + dx, bottom);
        ctx.stroke();
      }
      ctx.fillStyle = "#e0b84c"; // gold tieback
      ctx.fillRect(cx - 9, bottom - 20, 18, 3);
    }
    ctx.fillStyle = "#7d1c2c"; // the valance along the top
    ctx.fillRect(x, top, w, 8);
    ctx.fillStyle = "#e0b84c"; // its fringe
    for (let fx = x + 2; fx < x + w - 2; fx += 4) ctx.fillRect(fx, top + 8, 2, 3);
    const t = performance.now() / 1000;
    for (let i = 0, bx = x + 6; bx < x + w - 4; i++, bx += 12) {
      const on = Math.sin(t * 3 + i * 0.9) > -0.3; // chasing marquee lights
      ctx.fillStyle = on ? "#ffe39a" : "#b89a5a";
      ctx.beginPath();
      ctx.arc(bx, top + 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A big plush back-row sofa, seen from behind (it faces the screen),
  // with a blanket thrown over it. Stand on it to sit; its back hides your
  // lower half like the cinema seats do.
  cinemaSofa(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.1, f.y, f.w - 0.2, f.h - 0.25, 12, "#6b2f45"); // seat cushions
    drawBlock(ctx, f.x, f.y + 0.05, 0.18, f.h - 0.05, 18, "#56243a"); // arms
    drawBlock(ctx, f.x + f.w - 0.18, f.y + 0.05, 0.18, f.h - 0.05, 18, "#56243a");
    const back = drawBlock(ctx, f.x + 0.05, f.y + f.h - 0.25, f.w - 0.1, 0.25, 24, "#7d3a52");
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    const seats = 3, sw = (back.face.w - 8) / seats;
    for (let i = 0; i < seats; i++) {
      roundRectPath(ctx, back.face.x + 4 + i * sw + 1, back.face.y + 3, sw - 2, back.face.h - 8, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#e9c46a"; // a mustard blanket over one end
    ctx.beginPath();
    ctx.moveTo(back.face.x + back.face.w - 34, back.top.y);
    ctx.lineTo(back.face.x + back.face.w - 10, back.top.y);
    ctx.lineTo(back.face.x + back.face.w - 8, back.face.y + back.face.h - 2);
    ctx.lineTo(back.face.x + back.face.w - 30, back.face.y + back.face.h - 5);
    ctx.fill();
    ctx.fillStyle = "rgba(160, 110, 30, 0.35)";
    for (let k = 0; k < 3; k++) ctx.fillRect(back.face.x + back.face.w - 30 + k * 7, back.top.y + 2, 1.5, back.face.h);
  },

  // A snack counter: a glass case of candy boxes, soda cups with straws,
  // and a little "SNACKS" sign.
  candyCounter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#8a4a2e");
    ctx.fillStyle = "rgba(200, 230, 240, 0.35)"; // glass front
    ctx.fillRect(c.face.x + 4, c.face.y + 3, c.face.w - 8, c.face.h - 7);
    const boxes = ["#e04a5a", "#f2c94c", "#5aa0d8", "#7ac07a", "#e98ac0", "#f28a3a"];
    for (let i = 0, bx = c.face.x + 7; bx < c.face.x + c.face.w - 12; i++, bx += 9) {
      ctx.fillStyle = boxes[i % boxes.length];
      ctx.fillRect(bx, c.face.y + 6 + (i % 2) * 3, 7, 8);
    }
    for (let i = 0; i < 3; i++) {
      const x = c.top.x + 8 + i * 9, y = c.top.y + c.top.h / 2;
      ctx.fillStyle = i === 1 ? "#5aa0d8" : "#e04a5a"; // soda cups
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 11);
      ctx.lineTo(x + 3, y - 11);
      ctx.lineTo(x + 2, y);
      ctx.lineTo(x - 2, y);
      ctx.fill();
      ctx.fillStyle = "#fffaf3";
      ctx.fillRect(x - 3, y - 12, 6, 2);
      ctx.fillRect(x + 0.5, y - 17, 1, 6); // straw
    }
    const sx = c.top.x + c.top.w - 34, sy = c.top.y - 10;
    ctx.fillStyle = "#3a1f2a";
    roundRectPath(ctx, sx, sy, 28, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#ffcf6e";
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SNACKS", sx + 14, sy + 8);
    ctx.textAlign = "left";
  },

  // Little lights set into the floor along the aisle, like in a cinema.
  aisleLights(ctx, f) {
    const n = Math.max(2, Math.round(f.h / 0.9));
    for (let i = 0; i < n; i++) {
      const p = toScreen(f.x + f.w / 2, f.y + (i + 0.5) * (f.h / n));
      ctx.fillStyle = "#3a1f2a";
      ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
      ctx.fillStyle = "#ffd98a";
      ctx.fillRect(p.x - 3, p.y - 1, 6, 2);
    }
  },

  // The Study's turntable on a little record cabinet: a spinning record
  // (its label is the color of the station you picked), a tonearm, and
  // records filed in the cabinet below. Press E at it to pick a station.
  turntable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#7a5238");
    const sleeves = ["#d9825b", "#7a6bc8", "#3f6f9f", "#f2b84a", "#e07a8a", "#3f7a4a"];
    sleeves.forEach((c, i) => { // records filed in the cabinet
      ctx.fillStyle = c;
      ctx.fillRect(cab.face.x + 4 + i * 5, cab.face.y + 4, 3.5, cab.face.h - 7);
    });
    const deck = drawBlock(ctx, f.x + 0.1, f.y + 0.02, f.w - 0.2, f.h - 0.12, 3, "#3a2a22");
    const cx = deck.top.x + deck.top.w * 0.42, cy = deck.top.y + deck.top.h / 2;
    const r = Math.min(deck.top.h, deck.top.w * 0.6) / 2 - 1;
    ctx.fillStyle = "#1c1618"; // the record
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; // grooves
    ctx.lineWidth = 0.6;
    for (const k of [0.55, 0.75]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * k, r * k * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const spin = performance.now() / 600; // a glint going round
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.85, r * 0.68, 0, spin, spin + 0.6);
    ctx.stroke();
    ctx.fillStyle = globalThis.myLofiColor || "#d9825b"; // the label
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.3, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9c2b8"; // the tonearm
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(deck.top.x + deck.top.w - 5, deck.top.y + 3);
    ctx.lineTo(deck.top.x + deck.top.w - 8, cy + 2);
    ctx.lineTo(cx + r * 0.55, cy + 1);
    ctx.stroke();
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.arc(deck.top.x + deck.top.w - 5, deck.top.y + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // An old-timey popcorn machine: a red cart with a glass box of popcorn.
  popcorn(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cart = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#b8322a");
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(cart.face.x, cart.face.y + 3, cart.face.w, 2);
    const gx = cart.top.x + 4, gw = cart.top.w - 8, gh = 26, gy = cart.top.y + cart.top.h / 2 - gh;
    ctx.fillStyle = "rgba(230, 240, 245, 0.55)"; // glass
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = "#f7e6a8"; // popcorn piled in the bottom
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(gx + 3 + ((i * 7) % (gw - 6)), gy + gh - 4 - Math.floor(i / 5) * 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#8a2a24";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.fillStyle = "#b8322a"; // little roof
    ctx.beginPath();
    ctx.moveTo(gx - 3, gy);
    ctx.lineTo(gx + gw / 2, gy - 8);
    ctx.lineTo(gx + gw + 3, gy);
    ctx.closePath();
    ctx.fill();
  },

  // --- Hallway pieces ---

  // A slim side table with a drawer, holding a lamp, a vase of flowers
  // and a little bowl for keys.
  console(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 26, WOOD);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(c.face.x + 6.5, c.face.y + 4.5, c.face.w - 13, 9);
    drawKnob(ctx, c.face.x + c.face.w / 2, c.face.y + 9);
    const mid = c.top.y + c.top.h / 2;
    drawLamp(ctx, c.top.x + 16, mid + 2);
    // Vase of flowers.
    const vx = c.top.x + c.top.w - 22;
    ctx.fillStyle = "#6f8a6a";
    roundRectPath(ctx, vx - 4, mid - 8, 8, 11, 3);
    ctx.fill();
    ctx.strokeStyle = "#4f7a48";
    ctx.lineWidth = 1.2;
    for (const [fx, fy, color] of [[-5, -18, "#e37aa0"], [0, -21, "#f3e6d0"], [5, -17, "#e0a84c"]]) {
      ctx.beginPath();
      ctx.moveTo(vx, mid - 8);
      ctx.lineTo(vx + fx, mid + fy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(vx + fx, mid + fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Key bowl.
    ctx.fillStyle = "#c98a3c";
    ctx.beginPath();
    ctx.ellipse(c.top.x + c.top.w / 2 + 4, mid + 1, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(c.top.x + c.top.w / 2 + 2, mid - 1, 4, 2);
  },

  // A wooden bench with two plump cushions and a folded throw.
  bench(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, WOOD);
    const cw = b.top.w / 2 - 8;
    for (const [i, color] of [[0, "#6f8a6a"], [1, "#c98f3c"]]) {
      roundRectPath(ctx, b.top.x + 5 + i * (cw + 6), b.top.y - 3, cw, b.top.h, 5);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(b.top.x + 9 + i * (cw + 6), b.top.y - 1, cw - 8, 2);
    }
    ctx.fillStyle = "#b5603c"; // folded throw hanging over the front
    ctx.fillRect(b.face.x + b.face.w - 22, b.face.y - 2, 14, b.face.h - 2);
  },

  // A tall pot holding two umbrellas, handles poking out the top.
  umbrellaStand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const u = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#4a6a7a");
    const cx = u.top.x + u.top.w / 2;
    ctx.lineWidth = 2;
    for (const [dx, color] of [[-3, "#c0554a"], [3, "#e0a84c"]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + dx, u.top.y + 4);
      ctx.lineTo(cx + dx, u.top.y - 12);
      ctx.arc(cx + dx + 3, u.top.y - 12, 3, Math.PI, 0);
      ctx.stroke();
    }
  },

  // Boots and shoes lined up on the floor by the coat hooks.
  boots(ctx, f) {
    const a = toScreen(f.x, f.y + f.h);
    const shoes = [[4, "#5c4530"], [13, "#5c4530"], [26, "#7a4a3a"], [34, "#7a4a3a"]];
    for (const [dx, color] of shoes) {
      ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
      ctx.beginPath();
      ctx.ellipse(a.x + dx + 3, a.y, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      roundRectPath(ctx, a.x + dx, a.y - 12, 7, 12, 2);
      ctx.fill();
      roundRectPath(ctx, a.x + dx, a.y - 4, 9, 4, 2);
      ctx.fill();
    }
  },

  // Hung on a wall face: a wood rail of pegs with two coats and a scarf.
  coatHooks(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + 6, w = f.w * TILE;
    ctx.fillStyle = WOOD;
    ctx.fillRect(a.x, top, w, 4);
    ctx.fillStyle = WOOD_DARK;
    for (let i = 0; i < 3; i++) ctx.fillRect(a.x + 7 + i * (w - 14) / 2 - 1.5, top + 3, 3, 4);
    for (const [cx, color] of [[a.x + 7, "#6f8a6a"], [a.x + w / 2, "#b5603c"]]) {
      ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
      roundRectPath(ctx, cx - 6, top + 7, 14, 24, 4);
      ctx.fill();
      ctx.fillStyle = color;
      roundRectPath(ctx, cx - 7, top + 5, 14, 24, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(cx - 0.5, top + 9, 1, 19);
    }
    ctx.fillStyle = "#e0a84c"; // scarf
    ctx.fillRect(a.x + w - 10, top + 5, 5, 22);
    ctx.fillRect(a.x + w - 13, top + 5, 5, 16);
  },

  // Hung on a wall face: a small lamp with a warm glowing shade.
  sconce(ctx, f) {
    const a = toScreen(f.x, f.y);
    const y = a.y - WALL_HEIGHT + 14;
    ctx.fillStyle = WOOD_DARK;
    roundRectPath(ctx, a.x - 3, y + 2, 6, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(a.x - 6, y + 4);
    ctx.lineTo(a.x + 6, y + 4);
    ctx.lineTo(a.x + 4, y - 6);
    ctx.lineTo(a.x - 4, y - 6);
    ctx.closePath();
    ctx.fill();
  },

  // Hung on a wall face: a framed painting.
  picture(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 5, w = f.w * TILE, h = 22;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y, w, h);
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    PICTURE_ART[f.art](ctx, ix, iy, iw, ih);
    ctx.restore();
  },

  // --- Secret office: lake house ---

  // A stone fireplace with a chimney, a wood mantel, and a crackling fire.
  fireplace(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const fp = drawBlock(ctx, f.x, f.y, f.w, f.h, 34, "#8d8a84");
    const { x, y, w, h } = fp.face;
    // Chimney rising up from the back.
    ctx.fillStyle = "#7d7a74";
    ctx.fillRect(x + w * 0.2, fp.top.y - 44, w * 0.6, 46);
    // Stones on the chimney and the front.
    const stones = ["#9a968f", "#85817a", "#a8a49c"];
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 4; i++) {
        const sx = x + w * 0.2 + ((row % 2) * 5 + i * 11), sy = fp.top.y - 42 + row * 5.5;
        if (sx + 9 > x + w * 0.8) continue;
        ctx.fillStyle = stones[(row + i) % 3];
        roundRectPath(ctx, sx, sy, 9, 4.5, 2);
        ctx.fill();
      }
    }
    for (let row = 0; row < 5; row++) {
      for (let sx = x + (row % 2) * 6; sx < x + w - 4; sx += 12) {
        ctx.fillStyle = stones[(row + Math.round(sx)) % 3];
        roundRectPath(ctx, sx + 1, y + 2 + row * 6.5, 10, 5, 2);
        ctx.fill();
      }
    }
    // Wood mantel.
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x - 3, y - 3, w + 6, 5);
    // Fire opening, logs and flickering flames.
    const ox = x + w / 2, oy = y + h - 3;
    ctx.fillStyle = "#2a1d14";
    ctx.beginPath();
    ctx.moveTo(ox - 14, oy);
    ctx.lineTo(ox - 14, oy - 12);
    ctx.arc(ox, oy - 12, 14, Math.PI, 0);
    ctx.lineTo(ox + 14, oy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(ox - 11, oy - 5, 22, 4);
    const t = performance.now() / 1000;
    for (const [dx, hgt, color] of [[-5, 14, "#e0602a"], [4, 16, "#e0602a"], [0, 18, "#f2a03a"], [-1, 11, "#fbd66a"]]) {
      const lick = Math.sin(t * 9 + dx) * 2.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + dx - 5, oy - 5);
      ctx.quadraticCurveTo(ox + dx, oy - 5 - hgt - lick, ox + dx + 5, oy - 5);
      ctx.fill();
    }
  },

  // Hung on a wall face: a window onto the lake, with pines on the far shore.
  lakeWindow(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 5, w = f.w * TILE, h = 25;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x, y, w, h);
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, "#f2c49a");
    sky.addColorStop(1, "#bfdcea");
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = "#3f5a3a"; // pines
    for (let px = ix; px < ix + iw; px += 6) {
      ctx.beginPath();
      ctx.moveTo(px, iy + ih * 0.55);
      ctx.lineTo(px + 3, iy + ih * 0.2 + ((px * 7) % 4));
      ctx.lineTo(px + 6, iy + ih * 0.55);
      ctx.fill();
    }
    ctx.fillStyle = "#4a7f9e"; // the lake
    ctx.fillRect(ix, iy + ih * 0.55, iw, ih * 0.45);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(ix + 4, iy + ih * 0.7, 8, 1);
    ctx.fillRect(ix + iw - 14, iy + ih * 0.85, 9, 1);
    ctx.fillStyle = WOOD_DARK; // window bars
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
  },

  // Hung on a wall face: a canoe paddle and a fishing rod, crossed.
  paddle(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 4, w = f.w * TILE;
    ctx.strokeStyle = "#3a3a3a"; // fishing rod
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w - 6, y + 2);
    ctx.lineTo(x + 8, y + 30);
    ctx.stroke();
    ctx.fillStyle = "#b8923a";
    ctx.beginPath();
    ctx.arc(x + 13, y + 25, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 240, 240, 0.7)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w - 6, y + 2);
    ctx.lineTo(x + w - 5, y + 16);
    ctx.stroke();
    // Paddle: a wood shaft with a wide blade.
    ctx.save();
    ctx.translate(x + w / 2, y + 17);
    ctx.rotate(0.9);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(-16, -1, 32, 3);
    ctx.fillStyle = "#c89a68";
    ctx.fillRect(-18, -1.5, 22, 3);
    ctx.beginPath();
    ctx.ellipse(10, 0, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b5603c";
    ctx.fillRect(-20, -2, 4, 4);
    ctx.restore();
  },

  // A green tackle box with a brass latch.
  tackleBox(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#4f6b3a");
    ctx.fillStyle = "#3a5029";
    ctx.fillRect(b.top.x + b.top.w / 2 - 6, b.top.y + 2, 12, 3); // handle
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(b.face.x + b.face.w / 2 - 2, b.face.y + 3, 4, 4); // latch
  },

  // --- Secret office: STALKER bunker ---

  // Hung on a wall face: two old pipes with flanges, rust and a red valve.
  pipes(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 8, w = f.w * TILE;
    for (const [py, size] of [[y, 5], [y + 14, 4]]) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(x, py + 2, w, size);
      ctx.fillStyle = "#6f716c";
      ctx.fillRect(x, py, w, size);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(x, py, w, 1);
      ctx.fillStyle = "#555752";
      for (let fx = x + 14; fx < x + w; fx += 26) ctx.fillRect(fx, py - 1.5, 3, size + 3);
      ctx.fillStyle = "rgba(138, 75, 42, 0.6)";
      ctx.fillRect(x + w * 0.35, py + size - 1, 6, 2);
    }
    ctx.strokeStyle = "#8a2f24"; // valve wheel
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y - 3, 4, 0, Math.PI * 2);
    ctx.moveTo(x + w * 0.7 - 4, y - 3);
    ctx.lineTo(x + w * 0.7 + 4, y - 3);
    ctx.stroke();
  },

  // Hung on a wall face: a broken patch of concrete with rusty rebar
  // sticking out of it.
  rebar(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 6, w = f.w * TILE;
    ctx.fillStyle = "#6a6c67";
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 4);
    ctx.lineTo(x + w * 0.6, y);
    ctx.lineTo(x + w - 4, y + 8);
    ctx.lineTo(x + w - 10, y + 22);
    ctx.lineTo(x + w * 0.4, y + 26);
    ctx.lineTo(x + 4, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a4b2a";
    ctx.lineWidth = 1.5;
    for (const [x1, y1, x2, y2] of [[x + 8, y + 8, x + w - 6, y + 10], [x + 10, y + 17, x + w - 12, y + 19], [x + w * 0.4, y + 2, x + w * 0.45, y + 24]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  },

  // An olive army crate with a stencil, and a gas mask sitting on top.
  crate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#5b6340");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(c.face.x + 2.5, c.face.y + 2.5, c.face.w - 5, c.face.h - 6);
    ctx.fillStyle = "rgba(230, 225, 200, 0.55)"; // stencil marks
    ctx.fillRect(c.face.x + 8, c.face.y + 8, 14, 2);
    ctx.fillRect(c.face.x + 8, c.face.y + 12, 9, 2);
    ctx.fillStyle = "#8a4b2a";
    ctx.fillRect(c.face.x, c.face.y + c.face.h - 7, 4, 3);
    // Gas mask: a rubber face, two round lenses and a filter.
    const mx = c.top.x + c.top.w / 2, my = c.top.y + c.top.h / 2 - 4;
    ctx.fillStyle = "#3a3d38";
    ctx.beginPath();
    ctx.ellipse(mx, my, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#9fb3a8";
      ctx.beginPath();
      ctx.arc(mx + side * 4.5, my - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(mx + side * 4.5 - 1.5, my - 4, 1.5, 1.5);
    }
    ctx.fillStyle = "#5b6340";
    ctx.beginPath();
    ctx.arc(mx, my + 7, 4.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A grey steel desk with a yellow Geiger counter and a few papers.
  metalDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#6b6e68");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(d.face.x + d.face.w - 28.5, d.face.y + 4.5, 22, 7);
    ctx.strokeRect(d.face.x + d.face.w - 28.5, d.face.y + 12.5, 22, 7);
    const { x, y, w, h } = d.top;
    ctx.fillStyle = "#e8e2cf"; // papers
    ctx.fillRect(x + 8, y + 5, 18, h - 10);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 10, y + 8 + i * 4, 12, 1);
    // Geiger counter: a yellow box with a dial, and its probe on a cable.
    const gx = x + w - 34, gy = y + h / 2 - 12;
    ctx.fillStyle = "#c9a227";
    roundRectPath(ctx, gx, gy, 22, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#f3ecd8";
    ctx.beginPath();
    ctx.arc(gx + 8, gy + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a2f24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + 8, gy + 8);
    ctx.lineTo(gx + 8 + Math.cos(-0.8 + Math.sin(performance.now() / 300) * 0.4) * 4, gy + 8 + Math.sin(-0.8) * 4);
    ctx.stroke();
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx + 22, gy + 10);
    ctx.quadraticCurveTo(gx + 30, gy + 20, gx + 24, gy + 22);
    ctx.stroke();
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(gx + 16, gy + 20, 10, 3);
  },

  // A rusty oil barrel: a round drum, lighter on top where the light hits,
  // with two raised rings and a rust drip.
  barrel(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2, ry = 5, hgt = 30;
    const cx = base.x, bottom = base.y - ry, top = bottom - hgt;
    const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    side.addColorStop(0, "#6b3a20");
    side.addColorStop(0.45, "#9a5a34");
    side.addColorStop(1, "#6b3a20");
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.ellipse(cx, bottom, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, top);
    ctx.ellipse(cx, top, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 20, 10, 0.45)";
    ctx.lineWidth = 2;
    for (const ringY of [top + 10, top + 21]) {
      ctx.beginPath();
      ctx.ellipse(cx, ringY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(60, 30, 15, 0.5)";
    ctx.fillRect(cx - rx * 0.4, top + 3, 3, 14);
    ctx.fillStyle = "#a8683f";
    ctx.beginPath();
    ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3018";
    ctx.beginPath();
    ctx.arc(cx + rx * 0.4, top, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // --- Secret office: scholar's study ---

  // Hung on a wall face: a round "moon" window with a lattice and a plum branch.
  moonWindow(ctx, f) {
    const a = toScreen(f.x, f.y);
    const r = 15, cx = a.x + (f.w * TILE) / 2, cy = a.y - WALL_HEIGHT + 20;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 3, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a2a1e";
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f3e9d2";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = "#3a2a20"; // plum branch with blossoms
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + 6);
    ctx.quadraticCurveTo(cx - 2, cy + 2, cx + 6, cy - 8);
    ctx.stroke();
    ctx.fillStyle = "#e37aa0";
    for (const [bx, by] of [[-6, 3], [1, -2], [5, -7], [-10, 6]]) {
      ctx.beginPath();
      ctx.arc(cx + bx, cy + by, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(90, 42, 30, 0.55)"; // lattice
    ctx.lineWidth = 1;
    for (let i = -r; i <= r; i += 7) {
      ctx.beginPath();
      ctx.moveTo(cx + i, cy - r);
      ctx.lineTo(cx + i, cy + r);
      ctx.moveTo(cx - r, cy + i);
      ctx.lineTo(cx + r, cy + i);
      ctx.stroke();
    }
    ctx.restore();
  },

  // Hung on a wall face: a hanging calligraphy scroll with a red seal.
  scroll(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x + 2, y = a.y - WALL_HEIGHT + 3;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w - 4, 32);
    ctx.fillStyle = "#c9b48a";
    ctx.fillRect(x, y + 2, w - 4, 31);
    ctx.fillStyle = "#f5eedb";
    ctx.fillRect(x + 3, y + 5, w - 10, 25);
    ctx.fillStyle = "#5a2a1e"; // rods
    ctx.fillRect(x - 2, y, w, 3);
    ctx.fillRect(x - 2, y + 32, w, 3);
    ctx.fillStyle = "#1e1a17"; // brush strokes, like three characters
    const mx = x + (w - 4) / 2;
    for (let i = 0; i < 3; i++) {
      const cy = y + 9 + i * 7;
      ctx.fillRect(mx - 4, cy, 8, 1.3);
      ctx.fillRect(mx - 0.6, cy - 2, 1.3, 5);
      ctx.fillRect(mx - 3 + (i % 2) * 4, cy + 2, 3, 1.1);
    }
    ctx.fillStyle = "#b8322a"; // seal
    ctx.fillRect(mx + 1, y + 26, 3, 3);
  },

  // Potted bamboo: a celadon pot with a few tall jointed stalks.
  bamboo(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#7fa89a";
    roundRectPath(ctx, base.x - 10, base.y - 14, 20, 13, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(base.x - 8, base.y - 12, 16, 1.5);
    for (const [dx, hgt] of [[-5, 46], [0, 56], [5, 40]]) {
      ctx.fillStyle = "#6f9e4c";
      ctx.fillRect(base.x + dx - 1.5, base.y - 14 - hgt, 3, hgt);
      ctx.fillStyle = "#4f7a38";
      for (let ny = base.y - 24; ny > base.y - 14 - hgt; ny -= 10) ctx.fillRect(base.x + dx - 2, ny, 4, 1.5);
      ctx.fillStyle = "#7fb46a";
      ctx.beginPath();
      ctx.ellipse(base.x + dx + 5, base.y - 14 - hgt + 6, 6, 2, -0.5, 0, Math.PI * 2);
      ctx.ellipse(base.x + dx - 5, base.y - 14 - hgt + 12, 6, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A little bonsai tree in a shallow blue pot on a low wood stand.
  bonsai(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stand = drawBlock(ctx, f.x, f.y, f.w, f.h, 10, "#5a2a1e");
    const cx = stand.top.x + stand.top.w / 2, cy = stand.top.y + stand.top.h / 2;
    ctx.fillStyle = "#3f6f8f";
    roundRectPath(ctx, cx - 11, cy - 6, 22, 7, 2);
    ctx.fill();
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.quadraticCurveTo(cx - 8, cy - 14, cx + 2, cy - 22);
    ctx.stroke();
    for (const [dx, dy, r, color] of [[-7, -18, 6, "#4f7a48"], [4, -24, 7, "#5c8a54"], [9, -16, 5, "#4f7a48"], [0, -28, 5, "#6fa05e"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A low lacquered writing desk with paper, an inkstone and brushes.
  lowDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#5a2a1e");
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x, d.face.y + 1, d.face.w, 1);
    const { x, y, w, h } = d.top;
    const mid = y + h / 2;
    // Rice paper with brush strokes.
    ctx.fillStyle = "#f5eedb";
    ctx.fillRect(x + w / 2 - 14, y + 4, 28, h - 8);
    ctx.fillStyle = "#1e1a17";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + w / 2 - 8 + i * 6, y + 8, 1.4, h - 16);
      ctx.fillRect(x + w / 2 - 10 + i * 6, y + 11 + (i % 2) * 4, 5, 1.2);
    }
    // Inkstone with a pool of ink.
    ctx.fillStyle = "#3a3a40";
    roundRectPath(ctx, x + 6, mid - 7, 16, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#15151a";
    ctx.beginPath();
    ctx.ellipse(x + 14, mid - 3, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brush rest with two brushes, and a brush pot.
    ctx.fillStyle = "#6f8a6a";
    ctx.fillRect(x + w - 30, mid + 4, 14, 3);
    ctx.strokeStyle = "#c89a68";
    ctx.lineWidth = 1.5;
    for (const by of [mid + 1, mid + 5]) {
      ctx.beginPath();
      ctx.moveTo(x + w - 34, by);
      ctx.lineTo(x + w - 14, by - 2);
      ctx.stroke();
      ctx.fillStyle = "#1e1a17";
      ctx.fillRect(x + w - 14, by - 3.5, 4, 2.5);
    }
    ctx.fillStyle = "#7fa89a";
    ctx.fillRect(x + w - 11, mid - 12, 7, 9);
    ctx.strokeStyle = "#c89a68";
    ctx.beginPath();
    ctx.moveTo(x + w - 9, mid - 12);
    ctx.lineTo(x + w - 11, mid - 20);
    ctx.moveTo(x + w - 6, mid - 12);
    ctx.lineTo(x + w - 4, mid - 19);
    ctx.stroke();
  },

  // A flat silk floor cushion to kneel on at the low desk.
  floorCushion(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, c.x - 13, c.y - 6, 26, 12, 5);
    ctx.fillStyle = "#b8322a";
    ctx.fill();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, c.x - 10, c.y - 4, 20, 8, 3);
    ctx.stroke();
  },

  // --- Secret office: dark cottage (fall, ivy, and a lot of cats) ---

  // Hung on a wall face: an arched window onto an autumn evening, with a
  // tree losing its leaves and a few drifting past the glass.
  leafWindow(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = 31;
    const t = performance.now() / 1000;
    ctx.fillStyle = "rgba(20, 12, 5, 0.25)";
    archPath(ctx, x + 2, y + 3, w, h);
    ctx.fill();
    ctx.fillStyle = "#2e1f16"; // frame
    archPath(ctx, x, y, w, h);
    ctx.fill();
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    ctx.save();
    archPath(ctx, ix, iy, iw, ih);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, "#5a3f63");
    sky.addColorStop(0.6, "#d9804a");
    sky.addColorStop(1, "#f2b366");
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = "#3a2a2e"; // far hills
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih);
    ctx.quadraticCurveTo(ix + iw * 0.3, iy + ih * 0.62, ix + iw * 0.6, iy + ih * 0.8);
    ctx.quadraticCurveTo(ix + iw * 0.85, iy + ih * 0.7, ix + iw, iy + ih * 0.78);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.fill();
    ctx.fillStyle = "#2a1c16"; // the tree
    ctx.fillRect(ix + iw * 0.3, iy + ih * 0.45, 3, ih * 0.55);
    for (const [dx, dy, r, color] of [[-4, 8, 7, "#b8472a"], [6, 6, 6, "#d9803a"], [1, 2, 6, "#c95d2e"], [9, 12, 4, "#e0a040"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ix + iw * 0.3 + dx, iy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const leafColors = ["#d9803a", "#b8472a", "#e0a040"];
    for (let i = 0; i < 4; i++) {
      const fall = (t * 0.25 + i / 4) % 1;
      ctx.fillStyle = leafColors[i % 3];
      ctx.beginPath();
      ctx.ellipse(ix + ((i * 13 + 5) % iw) + Math.sin(t * 2 + i) * 3, iy + fall * ih, 1.6, 1, t * 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#2e1f16"; // window bars
    ctx.fillRect(x + w / 2 - 1, y + 2, 2, h - 2);
    ctx.fillRect(x + 2, y + h * 0.6, w - 4, 2);
    ctx.fillStyle = "#4a3022"; // sill
    ctx.fillRect(x - 3, y + h - 1, w + 6, 3);
    drawIvySprig(ctx, x + 1, y + 8, 12, 1);
    drawIvySprig(ctx, x + w - 1, y + 12, 9, -1);
  },

  // Hung on a wall face: bundles of dried lavender, sage and wildflowers
  // hanging upside down from a little wooden rod.
  driedHerbs(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 6;
    ctx.fillStyle = "#4a3022";
    ctx.fillRect(x, y, w, 2.5);
    const bundles = [["#8a74a8", "#6f5a8c"], ["#8a9a6a", "#6f7f52"], ["#c96a3a", "#a8552e"], ["#b3a067", "#8f7f4f"]];
    bundles.forEach(([light, dark], i) => {
      const bx = x + 6 + i * ((w - 12) / (bundles.length - 1));
      ctx.strokeStyle = "#c9b48a"; // string
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, y + 2);
      ctx.lineTo(bx, y + 6);
      ctx.stroke();
      ctx.fillStyle = "#6b5a3a"; // stems
      ctx.fillRect(bx - 1.5, y + 5, 3, 5);
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = j % 2 ? dark : light;
        ctx.beginPath();
        ctx.ellipse(bx - 3 + j * 1.5, y + 13 + (j % 2) * 3, 1.6, 4, (j - 2) * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  // A dark wood writing desk with an open book, a cup of tea, a candle,
  // and a gray cat asleep on the papers.
  cottageDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#4a3022");
    const { x, y, w, h } = d.top;
    const mid = y + h / 2, t = performance.now() / 1000;
    ctx.fillStyle = "#3a2419"; // drawer and knob
    ctx.fillRect(d.face.x + d.face.w / 2 - 12, d.face.y + 5, 24, 8);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x + d.face.w / 2 - 1.5, d.face.y + 8, 3, 2);
    ctx.fillStyle = "#efe3c8"; // open book
    ctx.fillRect(x + 6, mid - 7, 13, 12);
    ctx.fillRect(x + 20, mid - 7, 13, 12);
    ctx.fillStyle = "#6b3a2a";
    ctx.fillRect(x + 19, mid - 8, 1.5, 14);
    ctx.fillStyle = "rgba(60, 40, 30, 0.45)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 8, mid - 4 + i * 2.5, 9, 0.8);
      ctx.fillRect(x + 22, mid - 4 + i * 2.5, 9, 0.8);
    }
    ctx.fillStyle = "#e8dccb"; // teacup and saucer
    ctx.beginPath();
    ctx.ellipse(x + 41, mid + 3, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8472a";
    ctx.fillRect(x + 37.5, mid - 3, 7, 6);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(x + 38, mid - 3, 6, 1.5);
    drawCandle(ctx, x + w - 8, mid + 2, t);
    drawSleepingCat(ctx, x + w * 0.62, mid + 5, "#8d8d95", t, 0.8);
  },

  // A cat tree wrapped in rope, with a black cat perched on top.
  catTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = drawBlock(ctx, f.x, f.y, f.w, f.h, 6, "#6b4a3a");
    const cx = base.top.x + base.top.w / 2, by = base.top.y + base.top.h / 2;
    ctx.fillStyle = "#c9b089"; // rope-wrapped post
    ctx.fillRect(cx - 4, by - 34, 8, 34);
    ctx.fillStyle = "rgba(90, 65, 35, 0.4)";
    for (let ry = by - 32; ry < by; ry += 3) ctx.fillRect(cx - 4, ry, 8, 1);
    for (const [py, pw] of [[-16, 26], [-35, 22]]) {
      ctx.fillStyle = "#7a4a3a"; // carpeted platforms
      roundRectPath(ctx, cx - pw / 2, by + py - 3, pw, 7, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(cx - pw / 2 + 2, by + py - 3, pw - 4, 1.5);
    }
    ctx.strokeStyle = "#c9b089"; // a dangling toy
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 10, by - 16);
    ctx.lineTo(cx + 10 + Math.sin(performance.now() / 700) * 1.5, by - 8);
    ctx.stroke();
    ctx.fillStyle = "#b8472a";
    ctx.beginPath();
    ctx.arc(cx + 10 + Math.sin(performance.now() / 700) * 1.5, by - 7, 2, 0, Math.PI * 2);
    ctx.fill();
    drawSittingCat(ctx, cx, by - 38, "#2b2830", performance.now() / 1000);
  },

  // A velvet armchair facing into the room, with a knitted throw over one
  // arm and an orange cat curled up on the seat.
  cottageChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, 0.25, 32, "#5e2f4a"); // back
    const seat = drawBlock(ctx, f.x + 0.12, f.y + 0.2, f.w - 0.24, f.h - 0.2, 12, "#6e3a58");
    drawBlock(ctx, f.x, f.y + 0.1, 0.2, f.h - 0.1, 18, "#5e2f4a"); // arms
    const arm = drawBlock(ctx, f.x + f.w - 0.2, f.y + 0.1, 0.2, f.h - 0.1, 18, "#5e2f4a");
    ctx.fillStyle = "#d9a441"; // knitted throw draped over the right arm
    ctx.fillRect(arm.top.x - 2, arm.top.y - 1, arm.top.w + 4, arm.top.h + arm.face.h - 2);
    ctx.fillStyle = "rgba(120, 80, 20, 0.35)";
    for (let ty = arm.top.y + 2; ty < arm.face.y + arm.face.h - 3; ty += 3) ctx.fillRect(arm.top.x - 2, ty, arm.top.w + 4, 1);
    drawSleepingCat(ctx, seat.top.x + seat.top.w / 2, seat.top.y + seat.top.h - 1, "#e8a15a", performance.now() / 1000 + 1.3, 0.85);
  },

  // A round cushioned cat bed with a calico cat asleep in it.
  catBed(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    const rx = (f.w * TILE) / 2;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, rx + 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a3b2e"; // rim
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8d6b0"; // cushion
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 1, rx - 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSleepingCat(ctx, c.x, c.y + 4, "#f2ece2", performance.now() / 1000 + 2.6, 0.9, true);
  },

  // Pumpkins and a little gourd, with a jar candle glowing beside them.
  pumpkins(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    drawPumpkin(ctx, b.x - 3, b.y - 11, 12, 9, "#d9722e");
    drawPumpkin(ctx, b.x + 10, b.y - 6, 7, 5, "#efe3c8");
    drawPumpkin(ctx, b.x - 13, b.y - 5, 6, 4.5, "#7a8f4a");
    drawCandle(ctx, b.x + 12, b.y - 11, performance.now() / 1000 + 0.7, true);
  },

  // A wicker basket full of yarn, with one ball rolling off and unwinding.
  yarnBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const bk = drawBlock(ctx, f.x, f.y, f.w, f.h, 12, "#a8783e");
    ctx.strokeStyle = "rgba(90, 55, 20, 0.5)"; // weave
    ctx.lineWidth = 1;
    for (let wx = bk.face.x + 3; wx < bk.face.x + bk.face.w; wx += 4) {
      ctx.beginPath();
      ctx.moveTo(wx, bk.face.y + 1);
      ctx.lineTo(wx - 2, bk.face.y + bk.face.h - 1);
      ctx.stroke();
    }
    const top = bk.top;
    for (const [dx, color] of [[0.28, "#b8472a"], [0.55, "#d9a441"], [0.8, "#7a8f6a"]]) {
      drawYarnBall(ctx, top.x + top.w * dx, top.y + top.h / 2 - 2, 5.5, color);
    }
    const end = toScreen(f.x + f.w + 0.35, f.y + f.h);
    ctx.strokeStyle = "#5e2f4a"; // a loose strand to a ball on the floor
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x + top.w - 3, top.y + top.h);
    ctx.quadraticCurveTo(end.x - 6, end.y + 2, end.x, end.y - 4);
    ctx.stroke();
    drawYarnBall(ctx, end.x, end.y - 4, 4, "#5e2f4a");
  },

  // Ivy in a terracotta pot, trailing down over the rim and onto the floor.
  ivyPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#b5623a";
    ctx.beginPath();
    ctx.moveTo(b.x - 10, b.y - 18);
    ctx.lineTo(b.x + 10, b.y - 18);
    ctx.lineTo(b.x + 7, b.y - 2);
    ctx.lineTo(b.x - 7, b.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a4f2e";
    ctx.fillRect(b.x - 11, b.y - 20, 22, 4);
    for (const [dx, dy, r] of [[-5, -24, 6], [4, -26, 7], [0, -31, 5], [8, -21, 4]]) {
      ctx.fillStyle = "#3f6a30";
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawIvySprig(ctx, b.x - 8, b.y - 19, 20, -1);
    drawIvySprig(ctx, b.x + 8, b.y - 19, 15, 1);
    drawIvySprig(ctx, b.x + 1, b.y - 18, 11, 1);
  },

  // A tall grandfather clock: a wooden case, a face showing the real local
  // time, and a brass pendulum swinging behind a little glass window.
  grandfatherClock(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, f.h, 72, "#6b4630");
    const { x, y, w, h } = c.face;
    ctx.fillStyle = "#4a2f20"; // the crown on top
    ctx.fillRect(c.top.x - 2, c.top.y - 3, c.top.w + 4, 4);
    const cx = x + w / 2, fy = y + 13;
    ctx.fillStyle = "#f7f1e6"; // the face
    ctx.beginPath();
    ctx.arc(cx, fy, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(a) * 7 - 0.4, fy + Math.sin(a) * 7 - 0.4, 0.8, 0.8);
    }
    const now = new Date();
    const hand = (turn, len, width) => {
      const a = turn * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, fy);
      ctx.lineTo(cx + Math.cos(a) * len, fy + Math.sin(a) * len);
      ctx.stroke();
    };
    ctx.strokeStyle = "#2b2b2b";
    hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 4.5, 1.4);
    hand((now.getMinutes() + now.getSeconds() / 60) / 60, 6.5, 1);
    ctx.fillStyle = "rgba(200, 225, 235, 0.25)"; // the glass window
    ctx.fillRect(x + 5, y + 26, w - 10, h - 36);
    const swing = Math.sin(performance.now() / 1000 * Math.PI) * 0.35; // one tick a second
    ctx.save();
    ctx.translate(cx, y + 26);
    ctx.rotate(swing);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h - 44);
    ctx.stroke();
    ctx.fillStyle = "#d9b04a";
    ctx.beginPath();
    ctx.arc(0, h - 42, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(40, 25, 10, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 26, w - 10, h - 36);
  },

  // --- The Workshop ---

  // The house's project board on the Workshop wall: a big corkboard with
  // three columns (To do, Doing, Done) of little sticky notes, colored by
  // who claimed them, kept up to date by kanban.js (globalThis.kanbanView
  // is { columns: [[colors], [colors], [colors]] } for the board last
  // looked at).
  kanbanBoard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 2, h = WALL_HEIGHT - 6;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#8a5a3c"; // frame
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#c9a06a"; // cork
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = "rgba(120, 80, 40, 0.25)";
    for (let i = 0; i < 40; i++) ctx.fillRect(x + 4 + noise(i * 3.1) * (w - 8), y + 4 + noise(i * 5.7) * (h - 8), 1, 1);
    const colW = (w - 6) / 3;
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // column dividers
    for (const k of [1, 2]) ctx.fillRect(x + 3 + colW * k, y + 5, 1, h - 10);
    ctx.fillStyle = "#fffaf3"; // a little header strip on each column
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + colW * k + 3, y + 5, colW - 6, 3);
    ctx.fillStyle = ["#e0a84c", "#5aa0d8", "#7ac07a"][0];
    ["#e0a84c", "#5aa0d8", "#7ac07a"].forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + 3 + colW * k + 3, y + 5, 4, 3);
    });
    const columns = globalThis.kanbanView?.columns ?? [[], [], []];
    columns.forEach((notes, k) => {
      const perRow = Math.max(1, Math.floor((colW - 4) / 8));
      notes.slice(0, perRow * 3).forEach((color, i) => {
        const nx = x + 3 + colW * k + 3 + (i % perRow) * 8, ny = y + 11 + Math.floor(i / perRow) * 7;
        ctx.fillStyle = color || "#fff2a8";
        ctx.fillRect(nx, ny, 6, 5);
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(nx, ny + 4, 6, 1);
        ctx.fillStyle = "#c0303a"; // thumbtack
        ctx.fillRect(nx + 2.5, ny, 1, 1);
      });
      if (notes.length > perRow * 3) {
        ctx.fillStyle = "#5c4530";
        ctx.font = "700 6px 'Quicksand', sans-serif";
        ctx.fillText("+" + (notes.length - perRow * 3), x + 3 + colW * k + colW - 12, y + h - 5);
      }
    });
  },

  // A pegboard with tools hanging on it.
  pegboard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = WALL_HEIGHT - 9;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#d9b98a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // the holes
    for (let px = x + 3; px < x + w - 2; px += 5) for (let py = y + 3; py < y + h - 2; py += 5) ctx.fillRect(px, py, 1, 1);
    const cx = x + w / 2;
    ctx.fillStyle = "#7a5238"; // a hammer
    ctx.fillRect(x + 6, y + 6, 2, 14);
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(x + 3, y + 5, 8, 4);
    ctx.fillStyle = "#c0554a"; // a screwdriver
    ctx.fillRect(cx - 1.5, y + 5, 3, 7);
    ctx.fillStyle = "#b8bec6";
    ctx.fillRect(cx - 0.5, y + 12, 1, 10);
    ctx.strokeStyle = "#8a8f96"; // a wrench
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 8, y + 8);
    ctx.lineTo(x + w - 8, y + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 7, 3, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
  },

  // A sturdy workbench with a vise, some wood offcuts, and the "done jar":
  // a glass jar that fills up with little colored paper stars as cards are
  // finished (globalThis.kanbanJar, from kanban.js).
  workbench(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const legs = drawBlock(ctx, f.x + 0.1, f.y + 0.15, f.w - 0.2, f.h - 0.15, 20, "#6b4630");
    const top = drawBlock(ctx, f.x, f.y, f.w, f.h - 0.2, 6, "#a0703e");
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // the shelf underneath
    ctx.fillRect(legs.face.x + 4, legs.face.y + 6, legs.face.w - 8, 2);
    const t = top.top;
    ctx.fillStyle = "#8a8f96"; // a vise on the left end
    ctx.fillRect(t.x + 4, t.y - 6, 12, 7);
    ctx.fillStyle = "#5f656c";
    ctx.fillRect(t.x + 7, t.y - 9, 6, 3);
    ctx.fillStyle = "#d9b98a"; // a couple of wood offcuts
    ctx.fillRect(t.x + 24, t.y + 6, 18, 5);
    ctx.fillStyle = "#c49a5c";
    ctx.fillRect(t.x + 30, t.y + 2, 14, 4);
    // The done jar, on the right end.
    const jx = t.x + t.w - 24, jb = t.y + t.h - 4, jw = 16, jh = 22;
    const done = globalThis.kanbanJar ?? 0;
    const fill = Math.min(1, done / 40); // full after 40 finished cards
    const colors = ["#f2a0b8", "#fff2a8", "#a8d8e8", "#c8b0e8", "#b9e0a4", "#f7c68a"];
    ctx.save();
    ctx.beginPath();
    ctx.rect(jx + 1, jb - jh + 4, jw - 2, jh - 5);
    ctx.clip();
    const level = jb - 1 - (jh - 6) * fill;
    for (let i = 0; i < Math.min(done, 80); i++) {
      const sx = jx + 3 + noise(i * 2.3) * (jw - 6), sy = jb - 3 - noise(i * 4.1) * (jb - 3 - level);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(200, 225, 235, 0.35)"; // the glass
    roundRectPath(ctx, jx, jb - jh + 3, jw, jh - 3, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; // shine
    ctx.fillRect(jx + 2, jb - jh + 6, 1.5, jh - 10);
    ctx.fillStyle = "#c9a24a"; // lid
    ctx.fillRect(jx - 1, jb - jh, jw + 2, 4);
    ctx.fillStyle = "#fffaf3"; // its label
    ctx.fillRect(jx + 3, jb - 11, jw - 6, 5);
    ctx.fillStyle = "#5c4530";
    ctx.font = "700 4px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DONE", jx + jw / 2, jb - 7.5);
    ctx.textAlign = "left";
  },

  // A red metal toolbox with a handle.
  toolbox(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#c0403a");
    ctx.fillStyle = "#8a2a24";
    ctx.fillRect(b.face.x, b.face.y + 4, b.face.w, 1.5);
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(b.face.x + b.face.w / 2 - 3, b.face.y + 6, 6, 3);
    ctx.strokeStyle = "#3a3a40"; // handle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.top.x + b.top.w / 2 - 7, b.top.y + b.top.h / 2);
    ctx.lineTo(b.top.x + b.top.w / 2 - 7, b.top.y + b.top.h / 2 - 5);
    ctx.lineTo(b.top.x + b.top.w / 2 + 7, b.top.y + b.top.h / 2 - 5);
    ctx.lineTo(b.top.x + b.top.w / 2 + 7, b.top.y + b.top.h / 2);
    ctx.stroke();
  },

  // --- Turned furniture: side views ---
  // A piece turned to face right (against the left wall) or left (against
  // the right wall; the same drawing, mirrored). Its footprint is turned
  // too, so f.w is the piece's depth and f.h its width. See `turn` in
  // DECOR (world.js).

  wardrobeSide(ctx, f) {
    sideView(ctx, f, () => {
      drawShadow(ctx, f.x, f.y, f.w, f.h);
      const wd = drawBlock(ctx, f.x, f.y, f.w, f.h, 58, "#8b5e3c");
      const { x, y, w, h } = wd.face;
      ctx.strokeStyle = "rgba(40, 25, 10, 0.35)"; // the side panel
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 5, w - 11, h - 12);
      // The two doors, seen edge-on along the front (the side facing the
      // room), with their knobs.
      const t = wd.top;
      ctx.fillStyle = "#7a5234";
      ctx.fillRect(t.x + t.w - 7, t.y, 7, t.h);
      ctx.fillRect(x + w - 7, y, 7, h);
      ctx.fillStyle = "rgba(40, 25, 10, 0.45)"; // the gap between the doors
      ctx.fillRect(t.x + t.w - 7, t.y + t.h / 2 - 0.5, 7, 1);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(t.x + t.w - 4, t.y + t.h / 2 - 5, 3, 3);
      ctx.fillRect(t.x + t.w - 4, t.y + t.h / 2 + 2, 3, 3);
      ctx.fillStyle = WOOD_DARK; // crown on top
      ctx.fillRect(wd.top.x - 2, wd.top.y - 2, wd.top.w + 4, 3);
    });
  },

  dresserSide(ctx, f) {
    sideView(ctx, f, () => {
      drawShadow(ctx, f.x, f.y, f.w, f.h);
      const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 30, "#9a6a45");
      const { x, y, w, h } = d.face;
      ctx.strokeStyle = "rgba(40, 25, 10, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, w - 9, h - 8);
      ctx.fillStyle = "#7d5436"; // the drawer fronts along the front edge
      ctx.fillRect(x + w - 4, y, 4, h);
      ctx.fillStyle = "#c9a24a";
      for (let row = 0; row < 3; row++) ctx.fillRect(x + w - 3, y + 4 + row * 8.5, 2, 3);
      const cx = d.top.x + d.top.w * 0.4, cy = d.top.y + d.top.h * 0.55; // the lamp, near the wall
      ctx.fillStyle = "#5c4530";
      ctx.fillRect(cx - 1, cy - 12, 2, 12);
      ctx.fillStyle = "#f2d9a0";
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 10);
      ctx.lineTo(cx + 7, cy - 10);
      ctx.lineTo(cx + 4, cy - 19);
      ctx.lineTo(cx - 4, cy - 19);
      ctx.closePath();
      ctx.fill();
    });
  },

  bookshelfSide(ctx, f) {
    sideView(ctx, f, () => drawShelfSide(ctx, f, 62, WOOD));
  },

  libraryShelfSide(ctx, f) {
    sideView(ctx, f, () => drawShelfSide(ctx, f, 76, "#6b4630"));
  },

  cubeShelfSide(ctx, f) {
    sideView(ctx, f, () => drawShelfSide(ctx, f, 44, "#e9e1d3", ["#c49a5c", "#b8906a", "#d9b67e"]));
  },

  bedSide(ctx, f) {
    sideView(ctx, f, () => drawBedSide(ctx, f, 12, "#7a5238", true));
  },

  mattressSide(ctx, f) {
    sideView(ctx, f, () => drawBedSide(ctx, f, 7, "#e9e1d3", false));
  },

  canopyBedSide(ctx, f) {
    sideView(ctx, f, () => {
      drawBedSide(ctx, f, 12, "#7a5238", true);
      const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
      const topY = a.y - 58;
      ctx.fillStyle = "#e9dcc2"; // posts at the four corners
      for (const px of [a.x + 1, b.x - 4]) {
        ctx.fillRect(px, topY, 3, a.y - topY);
        ctx.fillRect(px, b.y - 40, 3, 30);
      }
      ctx.fillRect(a.x, topY - 2, b.x - a.x, 3);
      ctx.fillStyle = "rgba(255, 250, 245, 0.45)"; // sheer drapes gathered at the corners
      for (const [x1, dir] of [[a.x + 3, 1], [b.x - 3, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x1, topY);
        ctx.quadraticCurveTo(x1 + dir * 10, topY + 30, x1 + dir * 3, b.y - 12);
        ctx.lineTo(x1, b.y - 12);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe9a8"; // a few twinkly lights along the top
      for (let lx = a.x + 6; lx < b.x - 4; lx += 9) {
        ctx.beginPath();
        ctx.arc(lx, topY + 2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  loveseatSide(ctx, f) {
    sideView(ctx, f, () => drawSofaSide(ctx, f, f.color || "#7a9e8c"));
  },

  cloudSofaSide(ctx, f) {
    sideView(ctx, f, () => {
      drawSofaSide(ctx, f, "#f4efe8");
      const a = toScreen(f.x, f.y), b = toScreen(f.x, f.y + f.h);
      ctx.fillStyle = "#fbf8f3"; // puffy cloud bumps along the back
      for (let py = a.y + 6; py < b.y - 4; py += 11) {
        ctx.beginPath();
        ctx.arc(a.x + 8, py - 30, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  writingDeskSide(ctx, f) {
    sideView(ctx, f, () => drawDeskSide(ctx, f, "#7a5238", "lamp"));
  },

  aestheticDeskSide(ctx, f) {
    sideView(ctx, f, () => drawDeskSide(ctx, f, "#efe6d6", "flowers"));
  },

  laptopDeskSide(ctx, f) {
    sideView(ctx, f, () => drawDeskSide(ctx, f, "#9a6a45", "laptop"));
  },

  // --- Seasonal decorations (see SEASONAL in world.js) ---

  // A little seasonal decoration stuck on a hallway wall (see
  // seasonalWallDecor in world.js). `n` picks which one and how high it
  // sits, so a row of them looks scattered, not lined up. Autumn is
  // Halloween: bats, ghosts, a trio of flying bats, jack-o'-lanterns.
  // Winter: paper snowflakes. Spring: butterflies. Summer: suns and
  // watermelon slices.
  wallCutout(ctx, f) {
    const a = toScreen(f.x + f.w / 2, f.y);
    const cx = a.x, cy = a.y - WALL_HEIGHT + 9 + ((f.n * 7) % 3) * 7;
    const tilt = (((f.n * 13) % 5) - 2) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(1.25, 1.25);
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)"; // a soft shadow on the wall, lit from above
    ctx.beginPath();
    ctx.ellipse(1, 2.5, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const style = { autumn: ["bat", "ghost", "bats", "jack"], winter: ["snowflake"], spring: ["butterfly"], summer: ["sun", "melon"] }[f.style];
    CUTOUTS[style[f.n % style.length]](ctx, f.n);
    ctx.restore();
  },

  // A little pile of wrapped presents with ribbons.
  presents(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, w, h, color, ribbon] of [[-6, 12, 12, "#c0303a", "#f2d07a"], [6, 10, 9, "#3f7a5a", "#f7f1e6"], [0, 9, 8, "#f2d07a", "#c0303a"]]) {
      const x = b.x + dx - w / 2, y = b.y - 3 - h - (dx === 0 ? 8 : 0);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = ribbon;
      ctx.fillRect(x + w / 2 - 1, y, 2, h);
      ctx.fillRect(x, y + h / 2 - 1, w, 2);
      ctx.beginPath(); // bow
      ctx.ellipse(x + w / 2 - 2.5, y - 1, 2.5, 1.6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + w / 2 + 2.5, y - 1, 2.5, 1.6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A woven basket of pastel eggs.
  eggBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const eggs = ["#f2a0b8", "#a8d8e8", "#fff2a8", "#c8b0e8", "#b9e0a4"];
    eggs.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(b.x - 9 + i * 4.5, b.y - 12 - (i % 2) * 2, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#c49a5c";
    ctx.beginPath();
    ctx.moveTo(b.x - 12, b.y - 11);
    ctx.lineTo(b.x + 12, b.y - 11);
    ctx.lineTo(b.x + 9, b.y - 2);
    ctx.lineTo(b.x - 9, b.y - 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // weave
    for (let k = 0; k < 3; k++) ctx.fillRect(b.x - 11, b.y - 9 + k * 2.5, 22, 0.8);
    ctx.strokeStyle = "#a07a42"; // handle
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 11, 10, Math.PI, 0);
    ctx.stroke();
  },

  // A wooden crate spilling over with pumpkins, apples and fallen leaves.
  autumnCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x + 0.05, f.y + 0.1, f.w - 0.1, f.h - 0.2, 13, "#a0703e");
    ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
    for (let k = 1; k < 3; k++) ctx.fillRect(c.face.x, c.face.y + (c.face.h * k) / 3, c.face.w, 1);
    const top = c.top.y + c.top.h / 2;
    for (const [dx, r, color] of [[-9, 7, "#e07a2e"], [5, 8, "#d9682a"], [-1, 5, "#f0c05a"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(c.top.x + c.top.w / 2 + dx, top - r * 0.6, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120, 50, 10, 0.25)";
      ctx.fillRect(c.top.x + c.top.w / 2 + dx - 0.5, top - r * 1.3, 1, r * 1.3);
      ctx.fillStyle = "#5a7a3a";
      ctx.fillRect(c.top.x + c.top.w / 2 + dx - 1, top - r * 1.45, 2, 3);
    }
    for (const dx of [12, 16]) {
      ctx.fillStyle = "#b82a2a"; // apples
      ctx.beginPath();
      ctx.arc(c.top.x + c.top.w / 2 + dx, top - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const b = toScreen(f.x, f.y + f.h);
    for (const [dx, a, color] of [[4, 0.8, "#c8552e"], [30, -1.2, "#e09a3a"], [18, 2.2, "#a8392a"]]) drawLeaf(ctx, b.x + dx, b.y - 1, a, 6, 3, color, null);
  },

  // A little decorated tree: stacked green tiers, a star, twinkling
  // lights and ornaments, with a present underneath.
  winterTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#b86b4b"; // pot
    ctx.fillRect(b.x - 6, b.y - 9, 12, 7);
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(b.x - 1.5, b.y - 13, 3, 5);
    const tiers = [[16, b.y - 12, 14], [13, b.y - 24, 13], [9.5, b.y - 35, 12]];
    for (const [half, base, h] of tiers) {
      ctx.fillStyle = "#2f6a42";
      ctx.beginPath();
      ctx.moveTo(b.x - half, base);
      ctx.lineTo(b.x + half, base);
      ctx.lineTo(b.x, base - h - 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // lit from above
      ctx.beginPath();
      ctx.moveTo(b.x, base - h - 4);
      ctx.lineTo(b.x - half * 0.5, base - h * 0.4);
      ctx.lineTo(b.x, base - h * 0.5);
      ctx.fill();
    }
    const t = performance.now() / 1000;
    const bulbs = [[-9, -15], [7, -17], [-3, -21], [10, -13], [-6, -28], [5, -30], [0, -38], [-12, -14], [2, -25]];
    bulbs.forEach(([dx, dy], i) => {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2.5 + i * 1.7);
      ctx.fillStyle = ["#ffe08a", "#ff9aa8", "#a8d8ff"][i % 3];
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    for (const [dx, dy] of [[-5, -16], [6, -24], [-2, -33]]) {
      ctx.fillStyle = "#c0303a"; // ornaments
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d07a"; // the star on top
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 2 : 4.5, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(b.x + Math.cos(a) * r, b.y - 52 + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#5a8ac8"; // a present under the tree
    ctx.fillRect(b.x + 8, b.y - 9, 9, 7);
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(b.x + 11.5, b.y - 9, 2, 7);
  },

  // A wooden planter box full of tulips and daffodils.
  flowerPlanter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x + 0.05, f.y + 0.25, f.w - 0.1, f.h - 0.3, 11, "#9a6a3e");
    const cx = box.top.x + box.top.w / 2, soil = box.top.y + box.top.h / 2;
    ctx.fillStyle = "#5a3f2a"; // soil
    ctx.fillRect(box.top.x + 3, box.top.y + 2, box.top.w - 6, box.top.h - 4);
    const colors = ["#f2c94c", "#e8607a", "#f7f1e6", "#f2a0b8", "#f2c94c", "#c8b0e8", "#e8607a"];
    colors.forEach((color, i) => {
      const x = cx - 14 + i * 4.7, h = 12 + ((i * 5) % 7), base = soil + (i % 2) * 2;
      ctx.strokeStyle = "#4f8a4a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h);
      ctx.stroke();
      drawLeaf(ctx, x, base, i % 2 ? 0.4 : -0.4, 8, 2, "#5a9a4a", null);
      ctx.fillStyle = color;
      ctx.beginPath(); // a little cup-shaped bloom
      ctx.moveTo(x - 3, base - 2 - h);
      ctx.lineTo(x - 2, base + 3 - h);
      ctx.lineTo(x + 2, base + 3 - h);
      ctx.lineTo(x + 3, base - 2 - h);
      ctx.lineTo(x + 1, base - h);
      ctx.lineTo(x, base - 3 - h);
      ctx.lineTo(x - 1, base - h);
      ctx.fill();
    });
  },

  // A standing electric fan with a gently spinning blade.
  floorFan(ctx, f) {
    drawShadow(ctx, f.x + 0.15, f.y + 0.2, f.w - 0.3, f.h - 0.3);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#e9e3d6"; // base and pole
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(b.x - 1.5, b.y - 34, 3, 30);
    const cy = b.y - 42;
    ctx.fillStyle = "#a8d8d0"; // mint cage
    ctx.beginPath();
    ctx.arc(b.x, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    const spin = performance.now() / 120;
    for (let k = 0; k < 3; k++) {
      const a = spin + (k / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(b.x + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5.5, 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(90, 130, 125, 0.6)";
    ctx.lineWidth = 0.8;
    for (let r = 5; r <= 13; r += 4) {
      ctx.beginPath();
      ctx.arc(b.x, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9e3d6";
    ctx.beginPath();
    ctx.arc(b.x, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // --- Upstairs and bedrooms ---

  // Elevator doors set into the back wall: a brass frame, two brushed
  // metal doors that slide apart (ELEVATOR_OPEN, set while someone rides)
  // onto a warm lit car, a little arrow showing which way it goes, and a
  // brass call button beside it.
  elevatorDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, bottom = a.y, top = a.y - WALL_HEIGHT + 3;
    const h = bottom - top;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow of the frame on the wall
    ctx.fillRect(x - 2, top + 2, w + 6, h);
    ctx.fillStyle = "#b8904a"; // brass frame
    ctx.fillRect(x - 3, top - 1, w + 6, h + 1);
    ctx.fillStyle = "#e0bd6e"; // lit top edge
    ctx.fillRect(x - 3, top - 1, w + 6, 1.5);
    const inX = x + 1, inW = w - 2, inTop = top + 7;
    // The car inside: warm light, a handrail and a patterned floor.
    const car = ctx.createLinearGradient(0, inTop, 0, bottom);
    car.addColorStop(0, "#f4d9a0");
    car.addColorStop(1, "#c9965a");
    ctx.fillStyle = car;
    ctx.fillRect(inX, inTop, inW, bottom - inTop);
    ctx.fillStyle = "#a5773f";
    ctx.fillRect(inX, inTop + 14, inW, 1.5);
    ctx.fillStyle = "#8a3b3b";
    ctx.fillRect(inX, bottom - 5, inW, 5);
    // The doors, sliding apart from the middle.
    const open = ELEVATOR_OPEN[f.floor] || 0;
    const half = inW / 2, slide = half * open * 0.92;
    for (const side of [-1, 1]) {
      const dx = side < 0 ? inX - slide : inX + half + slide;
      const door = ctx.createLinearGradient(dx, 0, dx + half, 0);
      door.addColorStop(0, "#cfd3d6");
      door.addColorStop(0.5, "#eef0f1");
      door.addColorStop(1, "#b9bec2");
      ctx.save();
      ctx.beginPath();
      ctx.rect(inX, inTop, inW, bottom - inTop);
      ctx.clip(); // doors slide into the wall, not past the frame
      ctx.fillStyle = door;
      ctx.fillRect(dx, inTop, half, bottom - inTop);
      ctx.fillStyle = "rgba(90, 95, 100, 0.35)"; // the seam and a brass kick plate
      ctx.fillRect(side < 0 ? dx + half - 1 : dx, inTop, 1, bottom - inTop);
      ctx.fillStyle = "#c9a45a";
      ctx.fillRect(dx, bottom - 4, half, 4);
      ctx.restore();
    }
    // Floor indicator: a small dark window with a glowing arrow.
    const cx = x + w / 2;
    ctx.fillStyle = "#3a2a22";
    roundRectPath(ctx, cx - 7, top, 14, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#ffcf6e";
    ctx.beginPath();
    if (f.floor === 0) {
      ctx.moveTo(cx - 3, top + 4.5);
      ctx.lineTo(cx + 3, top + 4.5);
      ctx.lineTo(cx, top + 1.2);
    } else {
      ctx.moveTo(cx - 3, top + 1.5);
      ctx.lineTo(cx + 3, top + 1.5);
      ctx.lineTo(cx, top + 4.8);
    }
    ctx.fill();
    // The call button panel beside the doors.
    const px = x + w + 6, py = top + 14;
    ctx.fillStyle = "#b8904a";
    roundRectPath(ctx, px, py, 7, 12, 2);
    ctx.fill();
    ctx.fillStyle = open > 0 ? "#ffd27a" : "#f3e6d0";
    ctx.beginPath();
    ctx.arc(px + 3.5, py + 6, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // The starter desk every bedroom has: a small wooden desk with an open
  // laptop (its screen glowing), a mug, and a little chair tucked in.
  // Press E at your own to open the laptop.
  laptopDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#9a6a45");
    const { x, y, w, h } = d.top;
    const lx = x + w / 2 - 16, ly = y + 2;
    ctx.fillStyle = "#3a3a44"; // screen lid
    roundRectPath(ctx, lx, ly - 16, 32, 20, 3);
    ctx.fill();
    const glow = ctx.createLinearGradient(0, ly - 14, 0, ly + 2);
    glow.addColorStop(0, "#bfe3f2");
    glow.addColorStop(1, "#7fb2d6");
    ctx.fillStyle = glow;
    ctx.fillRect(lx + 2, ly - 14, 28, 15);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // little app icons
    for (let i = 0; i < 4; i++) ctx.fillRect(lx + 5 + i * 6, ly - 10, 4, 4);
    ctx.fillStyle = "#c8c8d0"; // keyboard base
    ctx.fillRect(lx, ly + 4, 32, h - 10);
    ctx.fillStyle = "rgba(60, 60, 70, 0.35)";
    for (let i = 0; i < 3; i++) ctx.fillRect(lx + 3, ly + 6 + i * 2.5, 26, 1);
    ctx.fillStyle = "#f2ece2"; // mug
    ctx.fillRect(x + w - 11, y + h / 2 - 6, 6, 7);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(x + w - 10.5, y + h / 2 - 6, 5, 1.5);
  },

  // A plain mattress on the floor, with a pillow and a blanket in the
  // owner's color. Step onto it to sleep.
  mattress(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const m = drawBlock(ctx, f.x, f.y, f.w, f.h, 7, "#e9e1d3");
    const { x, y, w, h } = m.top;
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, x + 6, y + 4, w - 12, 15, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(x + 9, y + 15, w - 18, 2);
    const top = y + 24;
    const blanket = ctx.createLinearGradient(0, top, 0, y + h);
    blanket.addColorStop(0, shadeColor(f.color, 30));
    blanket.addColorStop(1, shadeColor(f.color, -10));
    ctx.fillStyle = blanket;
    roundRectPath(ctx, x + 1, top, w - 2, y + h - top + m.face.h - 2, 4);
    ctx.fill();
    ctx.fillStyle = shadeColor(f.color, 55);
    ctx.fillRect(x + 1, top, w - 2, 5);
  },

  // A big cozy bed: a wooden headboard against the wall, pillows, and a
  // puffy blanket in the owner's color folded back at the top. It isn't
  // solid: step into it to go to sleep (you're drawn tucked in).
  bed(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const frame = drawBlock(ctx, f.x, f.y + 0.25, f.w, f.h - 0.25, 12, "#7a5238");
    const head = drawBlock(ctx, f.x - 0.05, f.y, f.w + 0.1, 0.25, 34, "#6b4630"); // headboard
    ctx.fillStyle = "rgba(255, 235, 200, 0.18)";
    roundRectPath(ctx, head.face.x + 6, head.face.y + 5, head.face.w - 12, head.face.h - 12, 6);
    ctx.fill();
    const { x, y, w, h } = frame.top;
    // Sheet and pillows.
    ctx.fillStyle = "#f5eee2";
    ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
    for (const px of [x + 8, x + w / 2 + 3]) {
      ctx.fillStyle = "#fffaf3";
      roundRectPath(ctx, px, y + 5, w / 2 - 11, 16, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(px + 3, y + 16, w / 2 - 17, 2);
    }
    // Blanket over the lower part, with a folded-back cuff.
    const top = y + 28;
    const blanket = ctx.createLinearGradient(0, top, 0, y + h);
    blanket.addColorStop(0, shadeColor(f.color, 30));
    blanket.addColorStop(1, shadeColor(f.color, -10));
    ctx.fillStyle = blanket;
    roundRectPath(ctx, x + 1, top, w - 2, y + h - top + frame.face.h - 3, 5);
    ctx.fill();
    ctx.fillStyle = shadeColor(f.color, 55);
    ctx.fillRect(x + 1, top, w - 2, 6);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // quilted lines
    for (let qy = top + 14; qy < y + h - 4; qy += 12) ctx.fillRect(x + 4, qy, w - 8, 1);
  },

  // A little nightstand with a drawer and a glowing lamp.
  nightstand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const n = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, "#7a5238");
    ctx.fillStyle = "#5c3d2a";
    ctx.fillRect(n.face.x + 4, n.face.y + 4, n.face.w - 8, 6);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(n.face.x + n.face.w / 2 - 1.5, n.face.y + 6, 3, 2);
    const cx = n.top.x + n.top.w / 2, cy = n.top.y + n.top.h / 2;
    ctx.fillStyle = "#5c4530"; // lamp stand and shade
    ctx.fillRect(cx - 1, cy - 14, 2, 14);
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 12);
    ctx.lineTo(cx + 8, cy - 12);
    ctx.lineTo(cx + 5, cy - 22);
    ctx.lineTo(cx - 5, cy - 22);
    ctx.closePath();
    ctx.fill();
  },

  // A tall wooden wardrobe with two doors and brass knobs.
  wardrobe(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const wd = drawBlock(ctx, f.x, f.y, f.w, f.h, 58, "#8b5e3c");
    const { x, y, w, h } = wd.face;
    ctx.strokeStyle = "rgba(40, 25, 10, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w / 2 - 6, h - 12);
    ctx.strokeRect(x + w / 2 + 2, y + 4, w / 2 - 6, h - 12);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + w / 2 - 4, y + h / 2 - 2, 2, 4);
    ctx.fillRect(x + w / 2 + 2, y + h / 2 - 2, 2, 4);
    ctx.fillStyle = WOOD_DARK; // crown on top
    ctx.fillRect(wd.top.x - 2, wd.top.y - 2, wd.top.w + 4, 3);
  },

  fridge(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const fr = drawBlock(ctx, f.x, f.y, f.w, f.h, 46, "#dfe6ea");
    ctx.fillStyle = "#9aa6ad";
    ctx.fillRect(fr.face.x + fr.face.w - 8, fr.face.y + 8, 3, 14); // handle
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(fr.face.x + 6, fr.face.y + 8, 8, 8); // a magnet
  },

  snackTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, WOOD);
    const { x, y, h } = t.top;
    // A chips bag and a few soda cans.
    ctx.fillStyle = "#e0a84c";
    roundRectPath(ctx, x + 8, y + h / 2 - 14, 16, 20, 3);
    ctx.fill();
    const cans = ["#c0554a", "#4a90a4", "#7a9e5c"];
    cans.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + 32 + i * 9, y + h / 2 - 10, 6, 12);
      ctx.fillStyle = "#cfd6da";
      ctx.fillRect(x + 32 + i * 9, y + h / 2 - 11, 6, 2);
    });
  },

  bookshelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const shelf = drawBlock(ctx, f.x, f.y, f.w, f.h, 62, WOOD);
    // Two rows of books on the front face.
    const bookColors = ["#c0554a", "#4a90a4", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a"];
    const { x, y, w } = shelf.face;
    for (let row = 0; row < 2; row++) {
      const rowY = y + 6 + row * 26;
      ctx.fillStyle = WOOD_DARK;
      ctx.fillRect(x + 4, rowY, w - 8, 22);
      for (let i = 0; i * 9 + 8 < w - 8; i++) {
        ctx.fillStyle = bookColors[(i + row * 2) % bookColors.length];
        const bh = 16 + ((i * 7 + row * 3) % 5);
        ctx.fillRect(x + 7 + i * 9, rowY + 22 - bh, 7, bh);
      }
    }
  },

  // The shared study table: open books, mugs, a stack of books and a lamp.
  studyTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#8b5e3c");
    const { x, y, w, h } = t.top;
    const mid = y + h / 2;
    // Open books.
    for (const bx of [x + 10, x + w - 64]) {
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(bx, mid - 4, 26, 15);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(bx + 12.5, mid - 4, 1, 15);
      ctx.fillRect(bx + 3, mid, 7, 1);
      ctx.fillRect(bx + 16, mid + 3, 7, 1);
    }
    // Mugs of tea.
    for (const [mx, color] of [[x + 44, "#e8dcc8"], [x + w - 28, "#c0554a"]]) {
      ctx.fillStyle = color;
      ctx.fillRect(mx, mid - 6, 9, 10);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx + 10, mid - 1, 3, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = "#5c3a22";
      ctx.fillRect(mx + 1, mid - 6, 7, 2);
    }
    // A stack of closed books.
    const stack = ["#4a90a4", "#e0a84c", "#7a9e5c"];
    stack.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + w / 2 + 14, mid + 4 - i * 5, 20 - i * 2, 5);
    });
    drawLamp(ctx, x + w / 2, mid + 2);
  },

  // A cozy reading armchair facing up toward the window, so you see its
  // back, with a blanket draped over the top.
  armchair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.12, f.y, f.w - 0.24, f.h - 0.25, 12, "#c98f3c"); // seat
    drawBlock(ctx, f.x, f.y, 0.2, f.h - 0.1, 18, "#b07c30"); // arms
    drawBlock(ctx, f.x + f.w - 0.2, f.y, 0.2, f.h - 0.1, 18, "#b07c30");
    const back = drawBlock(ctx, f.x + 0.05, f.y + f.h - 0.25, f.w - 0.1, 0.25, 30, "#a8732c");
    ctx.fillStyle = "#6f8a6a";
    ctx.fillRect(back.face.x + back.face.w * 0.55, back.top.y, back.face.w * 0.3, 16);
  },

  // A tall standing lamp with a fabric shade.
  floorLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = WOOD_DARK;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - 2, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(base.x - 1.5, base.y - 58, 3, 56);
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(base.x - 12, base.y - 52);
    ctx.lineTo(base.x + 12, base.y - 52);
    ctx.lineTo(base.x + 7, base.y - 70);
    ctx.lineTo(base.x - 7, base.y - 70);
    ctx.closePath();
    ctx.fill();
  },

  // A squishy beanbag, lighter on top where the light hits it.
  beanbag(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2, ry = 20;
    const fill = ctx.createLinearGradient(0, c.y - 2 * ry, 0, c.y);
    fill.addColorStop(0, "#d98c6a");
    fill.addColorStop(1, "#9a5439");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)"; // the dip where you sit
    ctx.beginPath();
    ctx.ellipse(c.x + 2, c.y - ry - 4, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Warm string lights draped along the top of a wall.
  lights(ctx, f) {
    ctx.strokeStyle = "rgba(60, 40, 20, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    stringLightBulbs(f).forEach((bulb, i) => (i === 0 ? ctx.moveTo(bulb.x, bulb.y) : ctx.lineTo(bulb.x, bulb.y)));
    ctx.stroke();
    for (const bulb of stringLightBulbs(f)) {
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  table(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#8b6b4a");
    const cx = t.top.x + t.top.w / 2, cy = t.top.y + t.top.h / 2;
    // A cloth runner down the middle of the table.
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(t.top.x + 4, cy - 8, t.top.w - 8, 16);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(t.top.x + 4, cy - 6, t.top.w - 8, 1);
    ctx.fillRect(t.top.x + 4, cy + 5, t.top.w - 8, 1);
    // A plate in front of each chair.
    const plates = [[0, -t.top.h / 2 + 8], [0, t.top.h / 2 - 7], [-t.top.w / 2 + 10, 0], [t.top.w / 2 - 10, 0]];
    for (const [dx, dy] of plates) {
      ctx.fillStyle = "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Two candles either side of the fruit bowl.
    for (const dx of [-22, 22]) {
      ctx.fillStyle = "#f3e6c8";
      ctx.fillRect(cx + dx - 2, cy - 12, 4, 10);
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy - 15, 1.8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fruit bowl in the middle of the tabletop.
    ctx.fillStyle = "#e8dcc8";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const fruit = [[-6, -3, "#c0554a"], [5, -4, "#e0a84c"], [0, 1, "#7a9e5c"]];
    for (const [dx, dy, color] of fruit) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A dining chair. The backrest goes on the side opposite where it faces:
  // facing "down" (toward you) has its back at the top, facing "up" has its
  // back at the bottom (so you see the back of the chair), and facing
  // "left" or "right" has its back along the other side.
  chair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const back = f.back || "#8a6448", seat = f.seat || "#a3785a", t = 0.15;
    if (f.facing === "up") {
      drawBlock(ctx, f.x, f.y, f.w, f.h - t, 16, seat);
      drawBlock(ctx, f.x, f.y + f.h - t, f.w, t, 30, back);
    } else if (f.facing === "left") {
      drawBlock(ctx, f.x, f.y, f.w - t, f.h, 16, seat);
      drawBlock(ctx, f.x + f.w - t, f.y, t, f.h, 30, back);
    } else if (f.facing === "right") {
      drawBlock(ctx, f.x + t, f.y, f.w - t, f.h, 16, seat);
      drawBlock(ctx, f.x, f.y, t, f.h, 30, back);
    } else {
      drawBlock(ctx, f.x, f.y, f.w, t, 30, back);
      drawBlock(ctx, f.x, f.y + t, f.w, f.h - t, 16, seat);
    }
  },

  // Hung on a wall face: a window with curtains.
  // (A "short" window sits higher up, so it clears a kitchen counter.)
  window(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + (f.short ? 3 : 6), w = f.w * TILE, h = f.short ? 15 : 24;
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)"; // small shadow just below it
    ctx.fillRect(a.x + 2, top + 3, w, h);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, top, w, h);
    const sky = ctx.createLinearGradient(0, top, 0, top + h);
    sky.addColorStop(0, "#9fd0ee");
    sky.addColorStop(1, "#d8eef8");
    ctx.fillStyle = sky;
    ctx.fillRect(a.x + 3, top + 3, w - 6, h - 6);
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(a.x - 3, top - 2, 9, h + 4);
    ctx.fillRect(a.x + w - 6, top - 2, 9, h + 4);
  },

  // The door at the west end of the hallway that you use to build an
  // office: a paneled wood door in a lighter frame, with a brass knob, a
  // little brass "Office" sign, and a welcome mat on the floor in front.
  buildDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const doorW = 30, doorH = WALL_HEIGHT - 5;
    const x = a.x + (f.w * TILE - doorW) / 2, y = a.y - doorH;

    drawDoorFrame(ctx, x, y, doorW, doorH);
    drawDoorLeaf(ctx, x, y, doorW, doorH);
    drawKnob(ctx, x + doorW - 6, y + doorH * 0.58);

    // Small brass sign on the top panel, with a tiny "+" for "build".
    ctx.fillStyle = "#d9b04a";
    roundRectPath(ctx, x + doorW / 2 - 7, y + 6, 14, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#6b4a1e";
    ctx.fillRect(x + doorW / 2 - 3, y + 9.5, 6, 1);
    ctx.fillRect(x + doorW / 2 - 0.5, y + 7.5, 1, 5);

    // Welcome mat on the floor just in front of the door.
    roundRectPath(ctx, x - 4, a.y + 3, doorW + 8, 9, 3);
    ctx.fillStyle = "#b5543f";
    ctx.fill();
    roundRectPath(ctx, x - 1.5, a.y + 5, doorW + 3, 5, 2);
    ctx.strokeStyle = "#d98c6a";
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // A locked office: the doorway gets a matching wall top, a frame, a pair
  // of paneled doors shut in the middle, and a brass padlock across them.
  closedDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE;

    // Soft shade on the floor below, same as every wall.
    const shade = ctx.createLinearGradient(0, a.y, 0, a.y + 10);
    shade.addColorStop(0, "rgba(40, 25, 10, 0.22)");
    shade.addColorStop(1, "rgba(40, 25, 10, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(a.x, a.y, w, 10);

    // Wall top above the doorway, so the wall's top edge runs unbroken.
    const capTop = toScreen(f.x, f.y - WALL_THICKNESS).y - WALL_HEIGHT;
    ctx.fillStyle = WOOD;
    ctx.fillRect(a.x, capTop, w, a.y - WALL_HEIGHT - capTop);

    const frame = 3;
    const x = a.x + frame, y = a.y - WALL_HEIGHT + frame, doorH = WALL_HEIGHT - frame;
    const leafW = (w - frame * 2) / 2;
    drawDoorFrame(ctx, x, y, w - frame * 2, doorH);
    drawDoorLeaf(ctx, x, y, leafW, doorH);
    drawDoorLeaf(ctx, x + leafW, y, leafW, doorH);
    ctx.fillStyle = "rgba(40, 20, 5, 0.35)";
    ctx.fillRect(x + leafW - 0.5, y, 1, doorH); // the seam where the doors meet
    drawKnob(ctx, x + leafW - 5, y + doorH * 0.58);
    drawKnob(ctx, x + leafW + 5, y + doorH * 0.58);

    // Padlock hanging across the two knobs.
    const lx = x + leafW, ly = y + doorH * 0.58 + 3;
    ctx.strokeStyle = "#b8923a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#d9b04a";
    roundRectPath(ctx, lx - 5.5, ly, 11, 9, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(lx - 4, ly + 1, 8, 1.5);
    ctx.fillStyle = "#6b4a1e";
    ctx.beginPath();
    ctx.arc(lx, ly + 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(lx - 0.6, ly + 4, 1.2, 3);
  },

  // Hung on a wall face: a small round-cornered mirror.
  mirror(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + (f.short ? 3 : 5), w = f.w * TILE, h = f.short ? 17 : 26;
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    roundRectPath(ctx, a.x + 2, top + 3, w, h, 6);
    ctx.fill();
    ctx.fillStyle = WOOD_DARK;
    roundRectPath(ctx, a.x, top, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#dfeaf2";
    roundRectPath(ctx, a.x + 3, top + 3, w - 6, h - 6, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    roundRectPath(ctx, a.x + 6, top + 5, 5, h - 12, 2);
    ctx.fill();
  },
};

// A kitchen counter: cream cupboards with a wood worktop. Returns the
// block's boxes so the stove and sink can add their details on top.
// --- Little helpers for the dark cottage office ---

// An arch-topped window shape (a rectangle with a round top).
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// A strand of ivy hanging down from (x, y), `length` pixels long, with
// little leaves on alternating sides. `lean` (-1 or 1) curls it sideways.
function drawIvySprig(ctx, x, y, length, lean) {
  ctx.strokeStyle = "#3d5a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 4, y + length * 0.5, x + lean * 2, y + length);
  ctx.stroke();
  const colors = ["#4f7a3a", "#5f8a44", "#3f6a30"];
  for (let i = 0, d = 2; d < length; i++, d += 3.5) {
    const k = d / length;
    const lx = x + lean * 4 * 2 * k * (1 - k) + lean * 2 * k * k;
    ctx.fillStyle = colors[i % 3];
    ctx.beginPath();
    ctx.ellipse(lx + (i % 2 ? 2 : -2), y + d, 2, 1.4, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A small candle with a flickering flame. `jar` puts it in a glass jar.
function drawCandle(ctx, x, y, t, jar = false) {
  if (jar) {
    ctx.fillStyle = "rgba(200, 150, 90, 0.45)";
    roundRectPath(ctx, x - 4, y - 8, 8, 9, 2);
    ctx.fill();
  }
  ctx.fillStyle = "#efe3c8";
  ctx.fillRect(x - 2, y - 7, 4, 7);
  const lick = Math.sin(t * 11) * 0.6 + Math.sin(t * 17) * 0.4;
  ctx.fillStyle = "#f2a03a";
  ctx.beginPath();
  ctx.moveTo(x - 1.8, y - 8);
  ctx.quadraticCurveTo(x + lick, y - 14, x + 1.8, y - 8);
  ctx.fill();
  ctx.fillStyle = "#fbe39a";
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 0.9, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A round pumpkin (or gourd) with ribs and a little stem.
function drawPumpkin(ctx, cx, cy, rx, ry, color) {
  for (const i of [-1, 1, 0]) {
    ctx.fillStyle = i === 0 ? color : shadeColor(color, -18);
    ctx.beginPath();
    ctx.ellipse(cx + i * rx * 0.42, cy, rx * 0.6, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.1, cy - ry * 0.55, rx * 0.3, ry * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a4a2a";
  ctx.fillRect(cx - 1, cy - ry - 3, 2.5, 4);
}

// A ball of yarn with a couple of wound lines across it.
function drawYarnBall(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -30);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy + r * 0.2, r * 0.8, -0.9, 0.9);
  ctx.moveTo(cx + r * 0.9, cy - r * 0.3);
  ctx.arc(cx + r * 0.3, cy - r * 0.2, r * 0.7, 2.2, 3.9);
  ctx.stroke();
}

// A cat curled up asleep, breathing slowly, centered at (x, y) where its
// belly rests. `calico` adds orange and black patches.
function drawSleepingCat(ctx, x, y, color, t, size = 1, calico = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size * (1 + Math.sin(t * 1.8) * 0.04));
  petEar(ctx, -9, -7.5, 3.4, 3.6, color, "#f3b8b8");
  petEar(ctx, -4.5, -8, 3.4, 3.6, color, "#f3b8b8");
  petBlob(ctx, 1, -4.5, 10, 5, color);
  if (calico) {
    ctx.fillStyle = "#d9803a";
    ctx.beginPath();
    ctx.ellipse(4, -6, 3.5, 2.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2830";
    ctx.beginPath();
    ctx.ellipse(-1, -7.5, 2.5, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  petBlob(ctx, -6.5, -4.5, 4.6, 3.8, color);
  petEye(ctx, -8.2, -4.6, true, 1);
  petEye(ctx, -5, -4.6, true, 1);
  ctx.strokeStyle = shadeColor(color, -20); // tail wrapped around the front
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.quadraticCurveTo(6, 1.5, -3, 0.2);
  ctx.stroke();
  ctx.restore();
  // Now and then, a small "z" drifts up.
  const z = (t * 0.35) % 1;
  if (z < 0.6) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - z / 0.6);
    ctx.fillStyle = "#8a8098";
    ctx.font = `700 ${Math.round(6 + z * 6)}px 'Quicksand', sans-serif`;
    ctx.fillText("z", x - 8 * size + z * 6, y - 12 * size - z * 12);
    ctx.restore();
  }
}

// A cat sitting up, facing you, with a swishing tail and slow blinks.
// (x, y) is where it sits.
function drawSittingCat(ctx, x, y, color, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; // tail
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(12, -4, 10 + Math.sin(t * 1.5) * 3, -13);
  ctx.stroke();
  petBlob(ctx, 0, -7, 5.5, 7, color);
  petEar(ctx, -3, -17.5, 3.6, 4.5, color, "#6b4a5a");
  petEar(ctx, 3, -17.5, 3.6, 4.5, color, "#6b4a5a");
  petBlob(ctx, 0, -15, 5, 4.3, color);
  const blink = t % 5 < 0.15;
  if (blink) {
    petEye(ctx, -2, -15.5, true, 1.1);
    petEye(ctx, 2, -15.5, true, 1.1);
  } else {
    ctx.fillStyle = "#c9d94a"; // green-gold eyes
    for (const ex of [-2, 2]) {
      ctx.beginPath();
      ctx.ellipse(ex, -15.5, 1.3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-2.3, -16.6, 0.6, 2.2);
    ctx.fillRect(1.7, -16.6, 0.6, 2.2);
  }
  ctx.fillStyle = "#e37aa0";
  ctx.fillRect(-0.6, -13.6, 1.2, 0.8);
  ctx.restore();
}

// A plant pot, centered at cx with its bottom at by: "clay" (terracotta),
// "ceramic" (white), "basket" (woven), "glazed" (blue), "cement", "pink"
// or "black". w is
// half its width at the top, h its height. Returns the y of the soil,
// where the plant grows from.
function drawPot(ctx, cx, by, style = "clay", w = 11, h = 16) {
  const [body, band, rim] = {
    clay: ["#b86b4b", "#9a5439", "#cf8260"],
    ceramic: ["#ece6dc", "#cfc6b8", "#f7f3ec"],
    basket: ["#c49a5c", "#9c7440", "#d8b67e"],
    glazed: ["#4f7aa0", "#3a5f80", "#6f98bc"],
    cement: ["#9a9a94", "#7f7f79", "#b3b3ad"],
    pink: ["#efb8c4", "#d898a8", "#f7d0da"],
    black: ["#3a3a40", "#2b2b30", "#55555c"],
  }[style];
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.8, by);
  ctx.lineTo(cx + w * 0.8, by);
  ctx.lineTo(cx + w, by - h);
  ctx.lineTo(cx - w, by - h);
  ctx.closePath();
  ctx.fill();
  if (style === "basket") {
    ctx.strokeStyle = "rgba(90, 60, 25, 0.45)"; // the weave
    ctx.lineWidth = 1;
    for (let y = by - 4; y > by - h; y -= 4) {
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx + w, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // a soft highlight, lit from above
    ctx.fillRect(cx - w * 0.6, by - h + 4, 3, h - 7);
  }
  ctx.fillStyle = band;
  ctx.fillRect(cx - w * 0.8, by - 3, w * 1.6, 3);
  ctx.fillStyle = rim;
  ctx.fillRect(cx - w - 1, by - h - 4, (w + 1) * 2, 5);
  return by - h - 2;
}

// --- Little drawing helpers for plants, vases and shelves ---

// A pointed leaf growing from (x, y), pointing along `angle` (0 is
// straight up), `len` long and `wid` wide at its middle.
function drawLeaf(ctx, x, y, angle, len, wid, color, vein = "rgba(255, 255, 255, 0.2)") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
  ctx.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
  ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, -len + 2);
    ctx.stroke();
  }
  ctx.restore();
}

// A heart-shaped leaf centered at (x, y).
function drawHeartLeaf(ctx, x, y, size, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.bezierCurveTo(-size * 1.3, 0, -size * 0.7, -size * 1.1, 0, -size * 0.45);
  ctx.bezierCurveTo(size * 0.7, -size * 1.1, size * 1.3, 0, 0, size);
  ctx.fill();
  ctx.restore();
}

// A vase standing at (cx, by): "glass" (with water), "cream", "amber" (a
// little bud vase), "stone" (tall and speckled) or "jug". Returns the y
// of its mouth.
function drawVase(ctx, cx, by, style = "glass") {
  const shapes = {
    glass: { w: 7, h: 22, neck: 4, color: "rgba(200, 225, 235, 0.55)" },
    cream: { w: 8, h: 20, neck: 4, color: "#efe6d6" },
    amber: { w: 5, h: 16, neck: 2.5, color: "rgba(200, 120, 50, 0.75)" },
    stone: { w: 8, h: 30, neck: 4, color: "#d8cbb8" },
    jug: { w: 9, h: 18, neck: 5, color: "#e9d27a" },
  };
  const s = shapes[style];
  const top = by - s.h;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(cx - s.neck, top);
  ctx.quadraticCurveTo(cx - s.w * 1.4, by - s.h * 0.45, cx - s.w * 0.8, by);
  ctx.lineTo(cx + s.w * 0.8, by);
  ctx.quadraticCurveTo(cx + s.w * 1.4, by - s.h * 0.45, cx + s.neck, top);
  ctx.closePath();
  ctx.fill();
  if (style === "glass") {
    ctx.fillStyle = "rgba(150, 200, 220, 0.35)"; // water
    ctx.fillRect(cx - s.w + 1, by - s.h * 0.5, (s.w - 1) * 2, s.h * 0.5 - 1);
  }
  if (style === "stone") {
    ctx.fillStyle = "rgba(120, 100, 80, 0.25)";
    for (let i = 0; i < 12; i++) ctx.fillRect(cx - 7 + noise(i * 3.3) * 14, top + 4 + noise(i * 7.1) * (s.h - 6), 1, 1);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // shine
  ctx.fillRect(cx - s.w * 0.6, top + 4, 1.5, s.h * 0.5);
  return top;
}

// A wooden wall shelf `dy` pixels down the wall. Returns where its top is.
function drawWallShelf(ctx, f, dy = 20, color = WOOD) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + dy;
  ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
  ctx.fillRect(x + 2, y + 2, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillStyle = shadeColor(color, -25);
  ctx.fillRect(x + 4, y + 3, 2, 5);
  ctx.fillRect(x + w - 6, y + 3, 2, 5);
  return { x, y, w };
}

// A row of book spines standing on a shelf at y, from x across width w.
function drawBookRow(ctx, x, y, w, seed = 0) {
  const colors = ["#c0554a", "#3f6f9f", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a", "#e8c8d0", "#5f7a8c"];
  let bx = x;
  for (let i = 0; bx < x + w - 4; i++) {
    const bw = 3 + ((i * 7 + seed) % 3), bh = 9 + ((i * 5 + seed) % 5);
    ctx.fillStyle = colors[(i + seed) % colors.length];
    ctx.fillRect(bx, y - bh, bw, bh);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(bx, y - bh + 2, bw, 0.8);
    bx += bw + 0.6;
  }
}

function drawCounter(ctx, f) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#e8dcc8");
  ctx.fillStyle = "#b58a5c";
  ctx.fillRect(c.top.x, c.top.y, c.top.w, c.top.h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(c.top.x, c.top.y, c.top.w, 1.5);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  for (let dx = 0; dx + 16 <= c.face.w; dx += 18) {
    ctx.strokeRect(c.face.x + dx + 2.5, c.face.y + 3.5, 14, c.face.h - 8);
  }
  return c;
}

// A ceiling fluorescent tube in the bunker office. Mostly on, but every so
// often it stutters off for a moment, like a bad starter.
function drawFluorescent(ctx, f, now) {
  const p = toScreen(f.x, f.y);
  const y = p.y - 110;
  const flick = noise(Math.floor(now * 10));
  const on = flick > 0.12 && !(flick > 0.9 && noise(Math.floor(now * 30)) > 0.5);
  ctx.strokeStyle = "rgba(40, 40, 40, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x - 18, y - 18);
  ctx.lineTo(p.x - 18, y);
  ctx.moveTo(p.x + 18, y - 18);
  ctx.lineTo(p.x + 18, y);
  ctx.stroke();
  ctx.fillStyle = "#5a5d58";
  ctx.fillRect(p.x - 26, y - 2, 52, 5);
  ctx.fillStyle = on ? "#eefcf4" : "#9aa39c";
  ctx.fillRect(p.x - 23, y + 3, 46, 3);
  if (on) {
    ctx.fillStyle = "rgba(210, 255, 235, 0.10)";
    ctx.beginPath();
    ctx.moveTo(p.x - 23, y + 6);
    ctx.lineTo(p.x + 23, y + 6);
    ctx.lineTo(p.x + 70, p.y + 20);
    ctx.lineTo(p.x - 70, p.y + 20);
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, p.x, y + 5, 40, "rgba(220, 255, 240, 0.45)");
  }
}

// A red paper lantern hanging from the ceiling, with gold caps, a tassel,
// and a warm glow.
function drawPaperLantern(ctx, f) {
  const p = toScreen(f.x, f.y);
  const y = p.y - 100;
  ctx.strokeStyle = "rgba(60, 40, 20, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, y - 30);
  ctx.lineTo(p.x, y - 12);
  ctx.stroke();
  drawGlow(ctx, p.x, y, 50, "rgba(255, 150, 90, 0.4)");
  ctx.fillStyle = "#c8372b";
  ctx.beginPath();
  ctx.ellipse(p.x, y, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 20, 15, 0.5)";
  ctx.beginPath();
  ctx.ellipse(p.x, y, 5, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#c9a24a";
  ctx.fillRect(p.x - 6, y - 14, 12, 3);
  ctx.fillRect(p.x - 6, y + 11, 12, 3);
  ctx.fillStyle = "#b8322a";
  ctx.fillRect(p.x - 1, y + 14, 2, 9);
}

// --- Doors ---
// A lighter wood frame (casing) around a door opening.
function drawDoorFrame(ctx, x, y, w, h) {
  ctx.fillStyle = "#c89a68";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(x - 3, y - 3, w + 6, 1);
}

// One door: warm wood with a raised edge and two sunken panels. Light
// comes from above, so each panel's top edge is in shadow and its bottom
// edge catches the light, which is what makes it look carved in.
function drawDoorLeaf(ctx, x, y, w, h) {
  ctx.fillStyle = "#a97a4f";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(x, y, w, 1.5);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(x, y + h - 2, w, 2);

  const px = x + 4, pw = w - 8;
  const panels = [[y + 4, h * 0.36], [y + h * 0.36 + 8, h - h * 0.36 - 13]];
  for (const [py, ph] of panels) {
    ctx.fillStyle = "#946840";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(px, py, pw, 1.5);
    ctx.fillRect(px, py, 1.5, ph);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(px, py + ph - 1.5, pw, 1.5);
    ctx.fillRect(px + pw - 1.5, py, 1.5, ph);
  }
}

// A round brass door knob with a little shine on top.
function drawKnob(ctx, x, y) {
  ctx.fillStyle = "#b8923a";
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d78a";
  ctx.beginPath();
  ctx.arc(x - 0.7, y - 0.8, 1, 0, Math.PI * 2);
  ctx.fill();
}

// A little table lamp with its base at (x, y) on a surface.
function drawLamp(ctx, x, y) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 1.5, y - 14, 3, 14);
  ctx.fillStyle = "#f2d9a0";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 12);
  ctx.lineTo(x + 8, y - 12);
  ctx.lineTo(x + 5, y - 24);
  ctx.lineTo(x - 5, y - 24);
  ctx.closePath();
  ctx.fill();
}

// Warm light effects, drawn over everything in a final pass so glows
// aren't cut off by things drawn after them.
function drawLights(ctx) {
  // Study, Dinner and the Hallway get a soft golden wash, like rooms lit
  // by lamps at night: warm in the middle, a little dimmer at the edges.
  for (const id of ["study", "dinner", "hallway", "landing", "elevator", "elevatorUp"]) {
    const rect = ROOMS.find((r) => r.id === id).rect;
    const s1 = toScreen(rect.x, rect.y - 1), s2 = toScreen(rect.x + rect.w, rect.y + rect.h);
    const cx = (s1.x + s2.x) / 2, cy = (s1.y + s2.y) / 2;
    const reach = Math.max(s2.x - s1.x, s2.y - s1.y) * 0.6;
    const wash = ctx.createRadialGradient(cx, cy, 20, cx, cy, reach);
    wash.addColorStop(0, "rgba(255, 190, 100, 0.12)");
    wash.addColorStop(1, "rgba(60, 30, 10, 0.12)");
    ctx.fillStyle = wash;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  // The Theater is kept dim like a cinema, lit by the glow of its screen.
  const theater = ROOMS.find((r) => r.id === "theater").rect;
  const t1 = toScreen(theater.x, theater.y - 1), t2 = toScreen(theater.x + theater.w, theater.y + theater.h);
  ctx.fillStyle = "rgba(20, 8, 25, 0.28)";
  ctx.fillRect(t1.x, t1.y, t2.x - t1.x, t2.y - t1.y);

  // The Library is dim and a little cool, like a rainy evening, lit by
  // its reading lamps.
  const library = ROOMS.find((r) => r.id === "library").rect;
  const l1 = toScreen(library.x, library.y - 1), l2 = toScreen(library.x + library.w, library.y + library.h);
  ctx.fillStyle = "rgba(25, 40, 55, 0.2)";
  ctx.fillRect(l1.x, l1.y, l2.x - l1.x, l2.y - l1.y);

  // Bedrooms are dim and a little blue, like a room at night, lit by the
  // bedside lamps.
  for (const room of ROOMS) {
    if (room.owned?.kind !== "bedroom") continue;
    const s1 = toScreen(room.rect.x, room.rect.y - 1), s2 = toScreen(room.rect.x + room.rect.w, room.rect.y + room.rect.h);
    ctx.fillStyle = "rgba(30, 30, 70, 0.2)";
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  // Secret themed offices get their own warm or cold tint.
  for (const room of ROOMS) {
    if (!room.theme) continue;
    const s1 = toScreen(room.rect.x, room.rect.y - 1), s2 = toScreen(room.rect.x + room.rect.w, room.rect.y + room.rect.h);
    ctx.fillStyle = OFFICE_THEME_STYLE[room.theme].tint;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  const now = performance.now() / 1000;
  for (const f of FURNITURE) {
    if (f.kind === "readingTable") {
      const p = toScreen(f.x, f.y + f.h / 2);
      for (const frac of [0.33, 0.67]) drawGlow(ctx, p.x + f.w * TILE * frac, p.y - 22 - 8, 34, "rgba(255, 220, 140, 0.45)");
    } else if (f.kind === "rainWindow") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 18, 34, "rgba(150, 185, 215, 0.25)");
    } else if (f.kind === "aisleLights") {
      const n = Math.max(2, Math.round(f.h / 0.9));
      for (let i = 0; i < n; i++) {
        const p = toScreen(f.x + f.w / 2, f.y + (i + 0.5) * (f.h / n));
        drawGlow(ctx, p.x, p.y, 14, "rgba(255, 210, 130, 0.35)");
      }
    } else if (f.kind === "stageCurtains") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - 76, 90, "rgba(255, 220, 140, 0.18)");
    } else if (f.kind === "bigScreen") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 30, 150, "rgba(170, 200, 255, 0.22)");
    } else if (f.kind === "fireplace") {
      // Firelight that breathes in and out a little.
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      const flicker = Math.sin(now * 7) * 3 + Math.sin(now * 13) * 2;
      drawGlow(ctx, p.x, p.y - 12, 60 + flicker, "rgba(255, 150, 60, 0.45)");
    } else if (f.kind === "fluorescent") {
      drawFluorescent(ctx, f, now);
    } else if (f.kind === "paperLantern") {
      drawPaperLantern(ctx, f);
    } else if (f.kind === "mushroomLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 16, 30, "rgba(255, 150, 110, 0.4)");
    } else if (f.kind === "moonLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 13, 30, "rgba(255, 240, 190, 0.45)");
    } else if (f.kind === "heartNeon") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 17, 30, "rgba(255, 120, 180, 0.3)");
    } else if (f.kind === "vanity") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 36, 30, "rgba(255, 240, 200, 0.4)");
    } else if (f.kind === "candles") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 20, 26 + Math.sin(now * 8) * 1.5, "rgba(255, 170, 80, 0.5)");
    } else if (f.kind === "lavaLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 24, 26, "rgba(255, 140, 110, 0.35)");
    } else if (f.kind === "neonSign") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 18, 32, "rgba(255, 120, 190, 0.3)");
    } else if (f.kind === "laptopDesk" || f.kind === "laptopDeskSide") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - 26, 26, "rgba(170, 215, 245, 0.35)");
    } else if (f.kind === "nightstand") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 18 - 17, 34, "rgba(255, 205, 130, 0.5)");
    } else if (f.kind === "cottageDesk") {
      // Candlelight on the desk.
      const p = toScreen(f.x + f.w, f.y + f.h / 2);
      drawGlow(ctx, p.x - 8, p.y - 22 - 8, 30 + Math.sin(now * 9) * 1.5, "rgba(255, 170, 80, 0.5)");
    } else if (f.kind === "pumpkins") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x + 12, p.y - 18, 22 + Math.sin(now * 8 + 1) * 1.5, "rgba(255, 160, 70, 0.5)");
    } else if (f.kind === "leafWindow") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 20, 30, "rgba(240, 150, 90, 0.25)");
    }
    if (f.kind === "pcDesk") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x - 6, p.y - 30, 40, f.screen + "66");
    } else if (f.kind === "studyTable") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 44, 40, "rgba(255, 215, 130, 0.5)");
    } else if (f.kind === "sconce") {
      const p = toScreen(f.x, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 12, 26, "rgba(255, 205, 120, 0.5)");
    } else if (f.kind === "console") {
      const p = toScreen(f.x + 16 / TILE, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 26 - 18, 24, "rgba(255, 215, 130, 0.5)");
    } else if (f.kind === "table") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      for (const dx of [-22, 22]) drawGlow(ctx, p.x + dx, p.y - 24 - 15, 14, "rgba(255, 190, 110, 0.55)");
    } else if (f.kind === "floorLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 58, 60, "rgba(255, 210, 130, 0.45)");
    } else if (f.kind === "lights") {
      for (const bulb of stringLightBulbs(f)) drawGlow(ctx, bulb.x, bulb.y + 2, 9, "rgba(255, 210, 120, 0.55)");
    } else if (f.kind === "pendant") {
      // A lamp hanging from the ceiling over the dinner table.
      const p = toScreen(f.x, f.y);
      const shadeY = p.y - 100;
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, shadeY - 24);
      ctx.lineTo(p.x, shadeY);
      ctx.stroke();
      drawGlow(ctx, p.x, shadeY + 30, 70, "rgba(255, 200, 120, 0.3)");
      ctx.fillStyle = "#c0554a";
      ctx.beginPath();
      ctx.moveTo(p.x - 7, shadeY);
      ctx.lineTo(p.x + 7, shadeY);
      ctx.lineTo(p.x + 15, shadeY + 12);
      ctx.lineTo(p.x - 15, shadeY + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Walls and furniture never move, so their draw-order list is built once.
// `sortY` is where each thing touches the floor (the bottom edge of its
// footprint): things with a bigger sortY are lower on screen and draw in
// front. Wall hangings sort just after the wall they hang on. Things you
// can stand on (like stools) sort by their top edge, so you're always
// drawn over them. Cinema seats are the opposite: they draw over whoever
// sits in them, so you see heads above the seat backs.
// Seats whose back is toward you (cinema seats, and chairs you can sit in
// that face away) draw over whoever sits in them.
function coversSitter(f) {
  return f.kind === "theaterSeat" || f.kind === "cinemaSofa" || (f.kind === "chair" && f.sit && f.facing === "up");
}

let staticSprites = [];
let spritesVersion = -1; // which house version (and floor) staticSprites is for

function getStaticSprites() {
  const version = houseVersion + "/" + viewFloor;
  if (spritesVersion !== version) {
    staticSprites = [
      ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
      // Door signs sort just after the wall they're on (and a locked door).
      ...ROOMS.filter((room) => room.sign).map((room) => ({ sortY: room.sign.y + WALL_THICKNESS / 2 + 0.002, draw: (ctx) => drawRoomSign(ctx, room) })),
      ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
        sortY: f.h === undefined ? f.y + 0.001 : coversSitter(f) ? f.y + f.h + 0.05 : f.solid === false ? f.y : f.y + f.h,
        draw: (ctx) => FURNITURE_DRAWERS[f.kind](ctx, f),
      })),
    ].filter((sprite) => floorOf(sprite.sortY) === viewFloor);
    spritesVersion = version;
  }
  return staticSprites;
}

// --- Characters ---
const PLAYER_RADIUS = 14; // screen pixels

// Where a player's feet touch the floor, in screen pixels.
function playerFeet(p) {
  return toScreen(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE);
}

// Hats you can pick on the Join screen. Each draws on top of a round body
// with its center at (cx, cy) and radius r. "none" draws nothing.
const HAT_DRAWERS = {
  none() {},

  // A knitted beanie with a folded band and a pompom.
  beanie(ctx, cx, cy, r) {
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.08, Math.PI * 1.92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a8473a";
    roundRectPath(ctx, cx - r + 1, cy - r * 0.55, r * 2 - 2, 5, 2);
    ctx.fill();
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A baseball cap with the brim pointing off to the side.
  cap(ctx, cx, cy, r) {
    ctx.fillStyle = "#4a90a4";
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a7384";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.75, cy - r * 0.5, 8, 2.8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // A big bow on top.
  bow(ctx, cx, cy, r) {
    const bx = cx + 5, by = cy - r + 1;
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 9, by - 6);
    ctx.lineTo(bx - 9, by + 5);
    ctx.closePath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 9, by - 6);
    ctx.lineTo(bx + 9, by + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c95a84";
    ctx.beginPath();
    ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // Chunky headphones: a band over the top and a cup on each side.
  headphones(ctx, cx, cy, r) {
    ctx.strokeStyle = "#3a3a40";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#3a3a40";
      roundRectPath(ctx, cx + side * (r + 1) - 3.5, cy - 5, 7, 11, 3);
      ctx.fill();
      ctx.fillStyle = "#e0a84c";
      ctx.fillRect(cx + side * (r + 1) - 1, cy - 3, 2, 7);
    }
  },

  // A little flower tucked behind one ear.
  flower(ctx, cx, cy, r) {
    const fx = cx - r * 0.6, fy = cy - r * 0.75;
    ctx.fillStyle = "#fbf3e4";
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * 3.6, fy + Math.sin(angle) * 3.6, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  },
};

// Hats sold by the raccoons (see shop.js for names and prices). Each draws
// on top of a round body with its center at (cx, cy) and radius r.
Object.assign(HAT_DRAWERS, {
  // A striped party cone with a pompom, tipped at a jaunty angle.
  partyHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.moveTo(cx - 8, base);
    ctx.lineTo(cx + 7, base);
    ctx.lineTo(cx + 3, base - 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = 2;
    for (const t of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(cx - 8 + 11 * t, base - 18 * t);
      ctx.lineTo(cx + 7 - 4 * t, base - 18 * t);
      ctx.stroke();
    }
    ctx.fillStyle = "#6fc8ff";
    ctx.beginPath();
    ctx.arc(cx + 3, base - 19, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  // A tall puffy white chef's hat.
  chefHat(ctx, cx, cy, r) {
    const base = cy - r + 4;
    ctx.fillStyle = "#f7f4ee";
    for (const [dx, dy, rr] of [[-6, -12, 6], [0, -15, 7], [6, -12, 6]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, base + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(cx - 9, base - 10, 18, 8);
    ctx.fillStyle = "#e3ddd2";
    ctx.fillRect(cx - 10, base - 3, 20, 5);
  },

  // A classic black top hat with a red band.
  topHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#2b2b2f";
    ctx.beginPath();
    ctx.ellipse(cx, base, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 9, base - 18, 18, 18);
    ctx.fillStyle = "#b8322a";
    ctx.fillRect(cx - 9, base - 5, 18, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(cx - 7, base - 17, 3, 11);
  },

  // A wide-brimmed cowboy hat.
  cowboyHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(cx, base, 19, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, cx - 9, base - 13, 18, 13, 5);
    ctx.fill();
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(cx - 9, base - 4, 18, 2.5);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, base - 13);
    ctx.lineTo(cx, base - 8);
    ctx.stroke();
  },

  // A pointy purple witch's hat with a gold buckle.
  witchHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#5b3f7a";
    ctx.beginPath();
    ctx.ellipse(cx, base, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 10, base);
    ctx.lineTo(cx + 10, base);
    ctx.quadraticCurveTo(cx + 4, base - 16, cx + 10, base - 24);
    ctx.quadraticCurveTo(cx - 2, base - 18, cx - 10, base);
    ctx.fill();
    ctx.fillStyle = "#3f2a57";
    ctx.fillRect(cx - 10, base - 5, 20, 3.5);
    ctx.strokeStyle = "#e0b84c";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 3, base - 6, 6, 5);
  },

  // A green frog hat with two googly eyes on top.
  frogHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#6fb05a";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      const ex = cx + side * 6, ey = cy - r - 2;
      ctx.fillStyle = "#6fb05a";
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.arc(ex + side * 0.8, ey - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e37aa0"; // little blush on the frog
    ctx.beginPath();
    ctx.arc(cx - 9, cy - r * 0.45, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - r * 0.45, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A little golden crown with three gems.
  crown(ctx, cx, cy, r) {
    const base = cy - r + 4;
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.moveTo(cx - 10, base);
    ctx.lineTo(cx - 10, base - 10);
    ctx.lineTo(cx - 5, base - 5);
    ctx.lineTo(cx, base - 12);
    ctx.lineTo(cx + 5, base - 5);
    ctx.lineTo(cx + 10, base - 10);
    ctx.lineTo(cx + 10, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7e08a";
    ctx.fillRect(cx - 10, base - 2, 20, 2);
    for (const [gx, color] of [[-6, "#c0554a"], [0, "#3f6f9f"], [6, "#4f7a48"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + gx, base - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glowing golden halo floating above the head.
  halo(ctx, cx, cy, r) {
    const hy = cy - r - 7 + Math.sin(performance.now() / 500) * 1.2;
    drawGlow(ctx, cx, hy, 16, "rgba(255, 230, 140, 0.55)");
    ctx.strokeStyle = "#f2d06b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, hy, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
});

// Shoes sold by the raccoons. Each draws one foot at (x, y) (its center),
// replacing the plain little foot. "side" is -1 for left, 1 for right.
const SHOE_DRAWERS = {
  none: null, // plain feet in your own color

  sneakers(ctx, x, y, side) {
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x - 3, y - 1, 6, 1.4);
    ctx.fillStyle = "#b9b3a8";
    ctx.fillRect(x - 4.4, y + 1.5, 8.8, 1.3);
  },

  rainBoots(ctx, x, y, side) {
    ctx.fillStyle = "#f2c94c";
    roundRectPath(ctx, x - 3.8, y - 6, 7.6, 9, 2.5);
    ctx.fill();
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x - 3.8, y + 1.8, 7.6, 1.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(x - 2.6, y - 5, 1.2, 5);
  },

  bunnySlippers(ctx, x, y, side) {
    ctx.fillStyle = "#f5c6d6";
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const ear of [-1.6, 1.6]) {
      ctx.beginPath();
      ctx.ellipse(x + ear, y - 4, 1.2, 3, ear * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(x - 1.8, y - 1, 1, 1);
    ctx.fillRect(x + 0.8, y - 1, 1, 1);
  },

  cowboyBoots(ctx, x, y, side) {
    ctx.fillStyle = "#8b5e3c";
    roundRectPath(ctx, x - 3.5, y - 7, 7, 9, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + side * 1.5, y + 1, 4.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3a22";
    ctx.fillRect(x - side * 3 - 1, y + 1, 2.5, 2.2); // heel
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(x - 0.8, y - 5, 1.6, 1.6); // a little star stitch
  },

  rollerSkates(ctx, x, y, side) {
    ctx.fillStyle = "#c0554a";
    roundRectPath(ctx, x - 4, y - 5, 8, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(x - 4, y + 0.5, 8, 1.5);
    ctx.fillStyle = "#6fc8ff";
    for (const wx of [-2.5, 2.5]) {
      ctx.beginPath();
      ctx.arc(x + wx, y + 3.4, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// --- Pets ---
// Little companions sold by the raccoons. Each drawer draws its pet
// facing right with its feet at (0, 0); drawPet moves it into place,
// flips it to face the way it's walking, and adds the shadow. `t` is the
// time in seconds, `moving` is true while it's trotting after its owner,
// and `blink` is true for the split second its eyes close.

// A round body shape, lit from above like everything else: lighter on
// top, darker underneath, with a soft darker outline.
function petBlob(ctx, x, y, rx, ry, color) {
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, shadeColor(color, 30));
  g.addColorStop(1, shadeColor(color, -25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -55);
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A small shiny eye (or a closed line when blinking).
function petEye(ctx, x, y, blink, size = 1.4) {
  if (blink) {
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - size * 0.2, y - size * 0.7, size * 0.6, size * 0.6);
}

// Pink blush on a cheek.
function petCheek(ctx, x, y) {
  ctx.fillStyle = "rgba(240, 120, 120, 0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y, 1.8, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Two little legs that take turns while walking.
function petLegs(ctx, color, t, moving, xs = [-3.5, 3.5]) {
  ctx.fillStyle = shadeColor(color, -40);
  xs.forEach((x, i) => {
    const lift = moving ? Math.max(0, Math.sin(t * 14 + i * Math.PI)) * 1.5 : 0;
    ctx.beginPath();
    ctx.ellipse(x, -1.2 - lift, 1.8, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// A pointy triangle ear.
function petEar(ctx, x, y, w, h, color, inner) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  if (inner) {
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(x - w / 4, y);
    ctx.lineTo(x, y - h * 0.6);
    ctx.lineTo(x + w / 4, y);
    ctx.closePath();
    ctx.fill();
  }
}

const PET_DRAWERS = {
  // An orange tabby with a curly tail.
  cat(ctx, t, moving, blink) {
    const c = "#e8a15a";
    ctx.strokeStyle = shadeColor(c, -20);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.quadraticCurveTo(-13, -10, -10 + Math.sin(t * 3) * 2, -16);
    ctx.stroke();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 7.5, 5, c);
    ctx.fillStyle = shadeColor(c, -25);
    for (const x of [-4, -1, 2]) ctx.fillRect(x, -10.5, 1.4, 3);
    petEar(ctx, 3.5, -14, 4, 5, c, "#f3b8b8");
    petEar(ctx, 8.5, -14, 4, 5, c, "#f3b8b8");
    petBlob(ctx, 6, -12, 5, 4.3, c);
    petEye(ctx, 4.8, -12.5, blink, 1.1);
    petEye(ctx, 8.4, -12.5, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(6.2, -10.8, 1.2, 0.9);
    petCheek(ctx, 9.8, -10.6);
  },

  // A happy pup with floppy ears and a very waggy tail.
  dog(ctx, t, moving, blink) {
    const c = "#c99a64";
    ctx.strokeStyle = shadeColor(c, -15);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(-11 + Math.sin(t * 16) * 2, -12);
    ctx.stroke();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 7.5, 5, c);
    petBlob(ctx, 6, -12, 5, 4.5, c);
    ctx.fillStyle = "#f3e2c6"; // snout
    ctx.beginPath();
    ctx.ellipse(9, -10.5, 2.6, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(10.6, -11.2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -45); // floppy ear
    ctx.beginPath();
    ctx.ellipse(3, -12.5, 1.8, 3.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 6.5, -13.5, blink, 1.1);
    if (!moving) {
      ctx.fillStyle = "#e37aa0"; // tongue out while sitting
      ctx.fillRect(8.5, -9, 1.5, 2);
    }
  },

  // A round bunny that hops instead of walking.
  bunny(ctx, t, moving, blink) {
    const c = "#f2ece2";
    const hop = moving ? Math.abs(Math.sin(t * 9)) * 3 : 0;
    ctx.translate(0, -hop);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-7, -5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, -1, -5.5, 7, 5.5, c);
    for (const [x, lean] of [[3.5, -0.15], [6.5, 0.15]]) {
      ctx.save();
      ctx.translate(x, -14);
      ctx.rotate(lean + Math.sin(t * 2 + x) * 0.05);
      petBlob(ctx, 0, -5, 1.7, 5, c);
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.ellipse(0, -5, 0.8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    petBlob(ctx, 5, -11.5, 4.5, 4, c);
    petEye(ctx, 6.8, -12, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(8.6, -10.8, 1.1, 0.9);
    petCheek(ctx, 7, -9.8);
  },

  // A fluffy yellow duckling that waddles.
  duck(ctx, t, moving, blink) {
    const c = "#f6d55c";
    if (moving) ctx.rotate(Math.sin(t * 12) * 0.12);
    ctx.fillStyle = "#e8913a";
    for (const x of [-3, 2]) {
      ctx.beginPath();
      ctx.ellipse(x, -1, 2.4, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    petBlob(ctx, -1, -6, 6.5, 5, c);
    ctx.fillStyle = shadeColor(c, -15); // wing
    ctx.beginPath();
    ctx.ellipse(-2, -6, 3.5, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 4, -12, 4.2, 4, c);
    ctx.fillStyle = "#e8913a"; // beak
    ctx.beginPath();
    ctx.ellipse(8.4, -11.4, 2.3, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 5.6, -13, blink, 1);
    petCheek(ctx, 5, -10.4);
  },

  // A little green frog that hops, with big eyes on top.
  frog(ctx, t, moving, blink) {
    const c = "#79b85b";
    const hop = moving ? Math.abs(Math.sin(t * 8)) * 3.5 : 0;
    ctx.translate(0, -hop);
    petBlob(ctx, 0, -5, 8, 5, c);
    ctx.fillStyle = "#e6f0c8"; // pale belly
    ctx.beginPath();
    ctx.ellipse(1, -3, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [-2, 4]) {
      petBlob(ctx, x, -10, 2.8, 2.8, c);
      petEye(ctx, x + 0.4, -10.3, blink, 1.2);
    }
    ctx.strokeStyle = shadeColor(c, -50);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(2, -6.5, 3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    petCheek(ctx, -3, -5.5);
    petCheek(ctx, 7, -5.5);
  },

  // A hedgehog: a spiky round back and a little pointed face.
  hedgehog(ctx, t, moving, blink) {
    const c = "#8a6a4c";
    petLegs(ctx, "#c9a987", t, moving);
    ctx.fillStyle = shadeColor(c, -20); // spikes
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (1.05 + i * 0.11);
      const x = -1 + Math.cos(a) * 7.5, y = -6 + Math.sin(a) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 1.6, y + 1);
      ctx.lineTo(-1 + Math.cos(a) * 10.5, -6 + Math.sin(a) * 9);
      ctx.lineTo(x + 1.6, y + 1);
      ctx.closePath();
      ctx.fill();
    }
    petBlob(ctx, -1, -6, 7.5, 5.5, c);
    ctx.fillStyle = "#e6cfae"; // face
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.quadraticCurveTo(10, -8, 11, -5);
    ctx.quadraticCurveTo(7, -2, 4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(11, -5.2, 1, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 6.5, -7, blink, 1);
    petCheek(ctx, 6.5, -4.6);
  },

  // A fox with a big bushy white-tipped tail.
  fox(ctx, t, moving, blink) {
    const c = "#e27b3c";
    ctx.save();
    ctx.translate(-6, -6);
    ctx.rotate(-0.5 + Math.sin(t * 2.5) * 0.15);
    petBlob(ctx, -4, 0, 6, 3.2, c);
    ctx.fillStyle = "#fbf3e6";
    ctx.beginPath();
    ctx.ellipse(-8.5, 0, 2.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    petLegs(ctx, "#5a3a2a", t, moving);
    petBlob(ctx, 0, -6, 6.5, 4.5, c);
    ctx.fillStyle = "#fbf3e6"; // white chest
    ctx.beginPath();
    ctx.ellipse(4, -5, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, 3.5, -14, 3.6, 5, c, "#5a3a2a");
    petEar(ctx, 8, -14, 3.6, 5, c, "#5a3a2a");
    petBlob(ctx, 6, -11.5, 4.5, 3.8, c);
    ctx.fillStyle = "#fbf3e6";
    ctx.beginPath();
    ctx.moveTo(6, -11);
    ctx.lineTo(11.5, -10.5);
    ctx.lineTo(7, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(11.3, -10.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 7, -12.6, blink, 1);
  },

  // A penguin standing up tall, waddling side to side.
  penguin(ctx, t, moving, blink) {
    const c = "#3a3f4a";
    if (moving) ctx.rotate(Math.sin(t * 12) * 0.14);
    ctx.fillStyle = "#e8913a";
    for (const x of [-2.5, 2.5]) {
      ctx.beginPath();
      ctx.ellipse(x, -0.8, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    petBlob(ctx, 0, -9, 6, 8.5, c);
    ctx.fillStyle = "#f7f4ee"; // white front
    ctx.beginPath();
    ctx.ellipse(1.5, -7.5, 3.8, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -15); // flipper
    ctx.beginPath();
    ctx.ellipse(-4.5, -8, 1.6, 4, 0.3 + (moving ? Math.sin(t * 12) * 0.3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8913a";
    ctx.beginPath();
    ctx.moveTo(4, -14);
    ctx.lineTo(8, -13);
    ctx.lineTo(4, -12);
    ctx.closePath();
    ctx.fill();
    petEye(ctx, 2.8, -15, blink, 1);
    petCheek(ctx, 3.5, -11.5);
  },

  // A friendly little ghost that floats (so it gets a fainter shadow).
  ghost(ctx, t, moving, blink) {
    const float = 6 + Math.sin(t * 2.5) * 2;
    ctx.translate(0, -float);
    ctx.globalAlpha *= 0.88;
    const g = ctx.createLinearGradient(0, -16, 0, 0);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#dfe3f0");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -9, 6.5, Math.PI, 0);
    ctx.lineTo(6.5, 0);
    for (let i = 0; i < 4; i++) {
      const x = 6.5 - (i + 1) * 3.25;
      ctx.quadraticCurveTo(x + 1.6, 2.5 + Math.sin(t * 6 + i) * 0.8, x, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha /= 0.88;
    petEye(ctx, 1, -9.5, blink, 1.2);
    petEye(ctx, 4.5, -9.5, blink, 1.2);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.ellipse(2.8, -6, 1.1, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    petCheek(ctx, -0.8, -7.2);
    petCheek(ctx, 6.3, -7.2);
  },

  // A tiny dragon with flapping wings and little horns.
  dragon(ctx, t, moving, blink) {
    const c = "#6fae8e";
    ctx.strokeStyle = c; // tail
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(-11, -3, -12, -7 + Math.sin(t * 3) * 1.5);
    ctx.stroke();
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.moveTo(-12, -9 + Math.sin(t * 3) * 1.5);
    ctx.lineTo(-14.5, -6.5 + Math.sin(t * 3) * 1.5);
    ctx.lineTo(-11, -5.5 + Math.sin(t * 3) * 1.5);
    ctx.closePath();
    ctx.fill();
    const flap = Math.sin(t * (moving ? 14 : 4)) * 0.35;
    ctx.save(); // wing
    ctx.translate(-2, -10);
    ctx.rotate(-0.6 + flap);
    ctx.fillStyle = "#b286c9";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-3, -8);
    ctx.lineTo(-7, -5);
    ctx.lineTo(-6, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 6.5, 5, c);
    ctx.fillStyle = "#e9e0b0"; // belly
    ctx.beginPath();
    ctx.ellipse(2, -5, 3, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 5, -12, 4.8, 4.2, c);
    ctx.fillStyle = "#f3e6c0"; // horns
    for (const x of [2.5, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(x - 1, -15.5);
      ctx.lineTo(x - 1.6, -19);
      ctx.lineTo(x + 1, -15.8);
      ctx.closePath();
      ctx.fill();
    }
    petEye(ctx, 6.5, -12.8, blink, 1.2);
    petCheek(ctx, 8, -10.5);
  },

  // A baby raccoon (the shopkeepers' cousin), with a mask and a stripy tail.
  raccoonKit(ctx, t, moving, blink) {
    const c = "#9a9aa2";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#3a3a40" : c;
      ctx.beginPath();
      ctx.arc(-7 - i * 1.8, -5 - i * 1.6 + Math.sin(t * 3) * i * 0.3, 2.6 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    petLegs(ctx, "#4a4a52", t, moving);
    petBlob(ctx, -1, -6, 7, 5, c);
    petEar(ctx, 3.5, -14.5, 3.8, 4, c, "#3a3a40");
    petEar(ctx, 8.5, -14.5, 3.8, 4, c, "#3a3a40");
    petBlob(ctx, 6, -12, 5, 4.2, c);
    ctx.fillStyle = "#f2f0ea"; // white face patch
    ctx.beginPath();
    ctx.ellipse(7, -11, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a40"; // the mask
    ctx.beginPath();
    ctx.ellipse(6.2, -12.5, 3.8, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 5, -12.5, blink, 0.9);
    petEye(ctx, 8.4, -12.5, blink, 0.9);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(10.8, -10.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  },
};

const PET_SCALE = 1.45; // pets are drawn small, then scaled up to sit nicely beside a character

// Draws one pet: `pet` is { kind, x, y, facing, moving } where x, y is the
// spot on the floor (grid units) its feet touch.
// --- More of the raccoons' stock (build 0.49) ---
// Hats are drawn around the head at (cx, cy) with radius r (the top of the
// head is cy - r); shoes around each foot at (x, y); glasses on the face
// (eyes at cx ± 4, cy - 2); pets standing at (0, 0), facing right.

Object.assign(HAT_DRAWERS, {
  // A French beret, tilted, with a little stalk.
  beret(ctx, cx, cy, r) {
    ctx.fillStyle = "#b8323a";
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - r + 1, r + 2, 5.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r - 1, r - 3, 2.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a2430";
    ctx.fillRect(cx + 1, cy - r - 7, 2, 4);
  },

  // A soft bucket hat with a wide floppy brim.
  bucketHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#c9b27a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.35, r + 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9c38a";
    ctx.beginPath();
    ctx.moveTo(cx - r + 1, cy - r * 0.4);
    ctx.quadraticCurveTo(cx - r + 2, cy - r - 5, cx, cy - r - 5);
    ctx.quadraticCurveTo(cx + r - 2, cy - r - 5, cx + r - 1, cy - r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6a3a"; // band
    ctx.fillRect(cx - r + 2, cy - r * 0.6, r * 2 - 4, 2.5);
  },

  // Cat ears on a headband.
  catEars(ctx, cx, cy, r) {
    for (const side of [-1, 1]) {
      const ex = cx + side * (r * 0.55);
      ctx.fillStyle = "#3a3440";
      ctx.beginPath();
      ctx.moveTo(ex - 5, cy - r + 3);
      ctx.lineTo(ex + side * 2, cy - r - 8);
      ctx.lineTo(ex + 5, cy - r + 3);
      ctx.fill();
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, cy - r + 2);
      ctx.lineTo(ex + side * 1.5, cy - r - 4);
      ctx.lineTo(ex + 2.5, cy - r + 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#3a3440";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },

  // Tall bunny ears, one flopped over.
  bunnyEars(ctx, cx, cy, r) {
    ctx.strokeStyle = "#f2ede4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    const ear = (x, angle) => {
      ctx.save();
      ctx.translate(x, cy - r + 2);
      ctx.rotate(angle);
      ctx.fillStyle = "#f7f3ec";
      ctx.beginPath();
      ctx.ellipse(0, -10, 4, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.ellipse(0, -10, 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    ear(cx - 5, -0.15);
    ear(cx + 5, 0.9);
  },

  // A crown of little flowers and leaves.
  flowerCrown(ctx, cx, cy, r) {
    const colors = ["#f2a0b8", "#fff2a8", "#c8b0e8", "#f7c68a", "#f2a0b8", "#a8d8e8", "#fff2a8"];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.12 + i * 0.127);
      const x = cx + Math.cos(a) * (r - 1), y = cy + Math.sin(a) * (r - 1);
      drawLeaf(ctx, x, y, a + Math.PI / 2 + 0.5, 5, 2, "#6aa05a", null);
      ctx.fillStyle = colors[i];
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(pa) * 1.8, y + Math.sin(pa) * 1.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e0a83a";
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
  },

  // A red mushroom cap with white spots.
  mushroomCap(ctx, cx, cy, r) {
    ctx.fillStyle = "#d8423a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r + 2, r + 4, r * 0.8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#f7f1e6";
    for (const [dx, dy, s] of [[-7, -4, 2.2], [1, -9, 2.6], [8, -4, 2], [-2, -3, 1.5]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy - r + 2 + dy, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(cx - r - 3, cy - r + 1, (r + 3) * 2, 1.5);
  },

  // A striped beanie with a spinning propeller on top.
  propellerCap(ctx, cx, cy, r) {
    const stripes = ["#e04a5a", "#f2c94c", "#5aa0d8", "#7ac07a"];
    stripes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1);
      ctx.arc(cx, cy - 1, r + 1, Math.PI * (1.08 + i * 0.21), Math.PI * (1.08 + (i + 1) * 0.21));
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = "#6b6b70";
    ctx.fillRect(cx - 0.8, cy - r - 6, 1.6, 6);
    const spin = performance.now() / 70;
    ctx.fillStyle = "#e04a5a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r - 6, Math.abs(Math.cos(spin)) * 8 + 1, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A black pirate hat with gold trim and a tiny skull.
  pirateHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#26222a";
    ctx.beginPath();
    ctx.moveTo(cx - r - 5, cy - r + 3);
    ctx.quadraticCurveTo(cx - r + 2, cy - r - 10, cx, cy - r - 12);
    ctx.quadraticCurveTo(cx + r - 2, cy - r - 10, cx + r + 5, cy - r + 3);
    ctx.quadraticCurveTo(cx, cy - r - 2, cx - r - 5, cy - r + 3);
    ctx.fill();
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - r - 4, cy - r + 2.5);
    ctx.quadraticCurveTo(cx, cy - r - 2.5, cx + r + 4, cy - r + 2.5);
    ctx.stroke();
    ctx.fillStyle = "#f7f1e6"; // skull
    ctx.beginPath();
    ctx.arc(cx, cy - r - 5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#26222a";
    ctx.fillRect(cx - 1.4, cy - r - 5.5, 1, 1);
    ctx.fillRect(cx + 0.4, cy - r - 5.5, 1, 1);
  },

  // A viking helmet with horns.
  vikingHelmet(ctx, cx, cy, r) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#efe4cf";
      ctx.beginPath();
      ctx.moveTo(cx + side * (r - 2), cy - r * 0.55);
      ctx.quadraticCurveTo(cx + side * (r + 9), cy - r * 0.6, cx + side * (r + 6), cy - r - 8);
      ctx.quadraticCurveTo(cx + side * (r + 3), cy - r * 0.9, cx + side * (r - 3), cy - r * 0.95);
      ctx.fill();
    }
    ctx.fillStyle = "#8a8f96";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.06, Math.PI * 1.94);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - r + 2, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6f75";
    ctx.fillRect(cx - r, cy - r * 0.5, r * 2, 3);
  },

  // A graduation cap with a swinging tassel.
  gradCap(ctx, cx, cy, r) {
    ctx.fillStyle = "#26222a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r + 2, r - 2, 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath(); // the flat board, seen at an angle
    ctx.moveTo(cx - r - 4, cy - r - 2);
    ctx.lineTo(cx, cy - r - 7);
    ctx.lineTo(cx + r + 4, cy - r - 2);
    ctx.lineTo(cx, cy - r + 3);
    ctx.closePath();
    ctx.fill();
    const sway = Math.sin(performance.now() / 500) * 1.5;
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 2);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx + r + sway, cy - r + 7);
    ctx.stroke();
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(cx + r - 1 + sway, cy - r + 6, 2, 4);
  },

  // A floppy santa hat with a white trim and pompom.
  santaHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#c0303a";
    ctx.beginPath();
    ctx.moveTo(cx - r + 1, cy - r * 0.45);
    ctx.quadraticCurveTo(cx - 2, cy - r - 16, cx + r + 6, cy - r - 4);
    ctx.lineTo(cx + r - 1, cy - r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7f3ec";
    roundRectPath(ctx, cx - r, cy - r * 0.6, r * 2, 5, 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r + 6, cy - r - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A little sprout growing out of the top of your head.
  sproutHat(ctx, cx, cy, r) {
    ctx.strokeStyle = "#5a8a3a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 1);
    ctx.quadraticCurveTo(cx - 1, cy - r - 4, cx, cy - r - 7);
    ctx.stroke();
    const wiggle = Math.sin(performance.now() / 700) * 0.15;
    drawLeaf(ctx, cx, cy - r - 6, -1.1 + wiggle, 8, 3.5, "#7ac05a", null);
    drawLeaf(ctx, cx, cy - r - 6, 1.1 + wiggle, 8, 3.5, "#8fd06a", null);
  },

  // A sparkly silver tiara with gems.
  tiara(ctx, cx, cy, r) {
    ctx.fillStyle = "#dfe3e8";
    ctx.beginPath();
    ctx.moveTo(cx - r + 2, cy - r + 3);
    for (const [dx, dy] of [[-8, -4], [-5, -2], [-2, -7], [0, -3], [2, -7], [5, -2], [8, -4]]) ctx.lineTo(cx + dx, cy - r + dy);
    ctx.lineTo(cx + r - 2, cy - r + 3);
    ctx.quadraticCurveTo(cx, cy - r + 1, cx - r + 2, cy - r + 3);
    ctx.fill();
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fb8e8";
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy - r + 0.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (Math.sin(performance.now() / 300) > 0.6) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx + 1.5, cy - r - 8, 1, 3);
      ctx.fillRect(cx + 0.5, cy - r - 7, 3, 1);
    }
  },

  // A wide straw sun hat with a ribbon.
  strawHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#e3c27a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.4, r + 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#edd08e";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r + 1, r - 3, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e8607a";
    ctx.fillRect(cx - r + 3, cy - r * 0.62, r * 2 - 6, 2.5);
    ctx.strokeStyle = "rgba(150, 110, 40, 0.3)";
    ctx.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.4, r + 8 - Math.abs(k) * 2, 4, 0, 0, Math.PI);
      ctx.stroke();
    }
  },
});

// Glasses, drawn over the face (eyes at cx ± 4, cy - 2).
const GLASSES_DRAWERS = {
  none: null,

  roundGlasses(ctx, cx, cy) {
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.2;
    for (const ex of [cx - 4.2, cx + 4.2]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 2.5);
    ctx.lineTo(cx + 1, cy - 2.5);
    ctx.stroke();
  },

  sunglasses(ctx, cx, cy) {
    ctx.fillStyle = "#1e1c22";
    for (const ex of [cx - 4.4, cx + 4.4]) {
      roundRectPath(ctx, ex - 3.6, cy - 4.5, 7.2, 5, 2);
      ctx.fill();
    }
    ctx.fillRect(cx - 1, cy - 3.6, 2, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (const ex of [cx - 5.5, cx + 3.3]) ctx.fillRect(ex, cy - 3.8, 1.2, 2.5);
  },

  heartGlasses(ctx, cx, cy) {
    for (const ex of [cx - 4.4, cx + 4.4]) {
      ctx.fillStyle = "#f06a9a";
      ctx.beginPath();
      ctx.moveTo(ex, cy + 1.5);
      ctx.bezierCurveTo(ex - 5, cy - 1.5, ex - 3, cy - 6, ex, cy - 3.5);
      ctx.bezierCurveTo(ex + 3, cy - 6, ex + 5, cy - 1.5, ex, cy + 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(ex - 2, cy - 3.5, 1, 1.5);
    }
    ctx.fillStyle = "#f06a9a";
    ctx.fillRect(cx - 1, cy - 3, 2, 1);
  },

  starGlasses(ctx, cx, cy) {
    for (const ex of [cx - 4.6, cx + 4.6]) {
      ctx.fillStyle = "#f2c94c";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? 2 : 4.5, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(ex + Math.cos(a) * rr, cy - 2 + Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(90, 60, 20, 0.6)";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  monocle(ctx, cx, cy) {
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx + 4.2, cy - 2, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(200, 225, 240, 0.35)";
    ctx.fill();
    ctx.lineWidth = 0.7; // its little chain
    ctx.beginPath();
    ctx.moveTo(cx + 7.6, cy - 1);
    ctx.quadraticCurveTo(cx + 10, cy + 5, cx + 6, cy + 9);
    ctx.stroke();
  },

  glasses3d(ctx, cx, cy) {
    ctx.fillStyle = "#f7f3ec";
    roundRectPath(ctx, cx - 9, cy - 5, 18, 6, 1.5);
    ctx.fill();
    ctx.fillStyle = "rgba(230, 60, 70, 0.85)";
    ctx.fillRect(cx - 8, cy - 4, 6.5, 4);
    ctx.fillStyle = "rgba(60, 170, 230, 0.85)";
    ctx.fillRect(cx + 1.5, cy - 4, 6.5, 4);
  },

  catEyeGlasses(ctx, cx, cy) {
    ctx.fillStyle = "#26222a";
    for (const side of [-1, 1]) {
      const ex = cx + side * 4.4;
      ctx.beginPath();
      ctx.moveTo(ex - side * 3.5, cy - 1);
      ctx.quadraticCurveTo(ex - side * 3.5, cy - 4.5, ex, cy - 4.5);
      ctx.lineTo(ex + side * 5, cy - 6.5); // the flick at the corner
      ctx.quadraticCurveTo(ex + side * 4, cy + 0.5, ex, cy + 0.5);
      ctx.quadraticCurveTo(ex - side * 3.5, cy + 0.5, ex - side * 3.5, cy - 1);
      ctx.fill();
      ctx.fillStyle = "rgba(200, 225, 240, 0.55)";
      ctx.beginPath();
      ctx.ellipse(ex, cy - 2, 2.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#26222a";
    }
  },

  goggles(ctx, cx, cy) {
    ctx.strokeStyle = "#6b4630"; // the strap
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy - 2);
    ctx.lineTo(cx + 13, cy - 2);
    ctx.stroke();
    for (const ex of [cx - 4.5, cx + 4.5]) {
      ctx.fillStyle = "#b8904a";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(240, 180, 80, 0.8)";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(ex - 1.8, cy - 3.8, 1, 1.5);
    }
  },
};

Object.assign(SHOE_DRAWERS, {
  flipFlops(ctx, x, y) {
    ctx.fillStyle = "#6fc2d4";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 4.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 1);
    ctx.lineTo(x, y - 1.5);
    ctx.lineTo(x + 3, y + 1);
    ctx.stroke();
  },

  clogs(ctx, x, y) {
    ctx.fillStyle = "#c49a5c";
    roundRectPath(ctx, x - 4.5, y - 3, 9, 5.5, 2.5);
    ctx.fill();
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(x - 4.5, y + 1.3, 9, 1.4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x - 3, y - 2.3, 4, 1);
  },

  moonBoots(ctx, x, y) {
    ctx.fillStyle = "#e8e6ee";
    roundRectPath(ctx, x - 4.5, y - 7, 9, 10, 3.5);
    ctx.fill();
    ctx.fillStyle = "#b8b4c8";
    for (let k = 0; k < 3; k++) ctx.fillRect(x - 4.5, y - 5 + k * 2.6, 9, 0.8);
    ctx.fillStyle = "#8a86a0";
    ctx.fillRect(x - 4.5, y + 1.6, 9, 1.5);
  },

  rubySlippers(ctx, x, y) {
    ctx.fillStyle = "#c0203a";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const t = performance.now() / 200;
    ctx.fillStyle = "#ffd0d8";
    for (let k = 0; k < 3; k++) {
      if (Math.sin(t + k * 2.1 + x) > 0.3) ctx.fillRect(x - 3 + k * 2.5, y - 1.5 + (k % 2), 1, 1);
    }
    ctx.fillStyle = "#e84a60";
    ctx.beginPath();
    ctx.arc(x + 1, y - 1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  },

  hikingBoots(ctx, x, y) {
    ctx.fillStyle = "#8a5a3a";
    roundRectPath(ctx, x - 4, y - 6, 8, 8.5, 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a22"; // chunky sole
    ctx.fillRect(x - 4.6, y + 1.5, 9.2, 2);
    ctx.strokeStyle = "#e0b84c"; // laces
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x - 1.5, y - 4.5 + k * 2);
      ctx.lineTo(x + 1.5, y - 3.5 + k * 2);
      ctx.stroke();
    }
  },

  balletFlats(ctx, x, y) {
    ctx.fillStyle = "#f2b8c8";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(x - 1.8, y - 2.2, 1.6, 1.4);
    ctx.fillRect(x + 0.2, y - 2.2, 1.6, 1.4);
  },

  sockSandals(ctx, x, y) {
    ctx.fillStyle = "#f7f4ee"; // the socks
    roundRectPath(ctx, x - 3.4, y - 6, 6.8, 8, 2.5);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x - 3.4, y - 5.5, 6.8, 1.2);
    ctx.fillStyle = "#6b4630"; // sandal sole and straps
    ctx.fillRect(x - 4.4, y + 1.2, 8.8, 1.6);
    ctx.fillRect(x - 3.6, y - 1.5, 7.2, 1.3);
  },

  glowSneakers(ctx, x, y) {
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const hue = (performance.now() / 8 + x * 10) % 360;
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.fillRect(x - 4.4, y + 1.4, 8.8, 1.6);
    ctx.fillStyle = "#5a5a66";
    ctx.fillRect(x - 3, y - 1, 6, 1.2);
  },
});

Object.assign(PET_DRAWERS, {
  // A round little owl with big eyes and ear tufts.
  owl(ctx, t, moving, blink) {
    const c = "#9a7456";
    petLegs(ctx, "#e0a84c", t, moving, [-2.5, 2.5]);
    petBlob(ctx, 0, -9, 7.5, 8.5, c);
    ctx.fillStyle = "#e8d7bf"; // belly
    ctx.beginPath();
    ctx.ellipse(0.5, -6, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, -4, -16, 3, 5, c, c);
    petEar(ctx, 4, -16, 3, 5, c, c);
    for (const ex of [-2.8, 2.8]) {
      ctx.fillStyle = "#fffaf3";
      ctx.beginPath();
      ctx.arc(ex, -12, 2.8, 0, Math.PI * 2);
      ctx.fill();
      petEye(ctx, ex, -12, blink, 1.5);
    }
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.lineTo(1, -10);
    ctx.lineTo(0, -8);
    ctx.fill();
    const flap = moving ? Math.sin(t * 16) * 0.3 : 0;
    ctx.fillStyle = shadeColor(c, -20);
    ctx.beginPath();
    ctx.ellipse(-7, -8, 2.2, 4.5, 0.2 + flap, 0, Math.PI * 2);
    ctx.fill();
  },

  // A pink axolotl with frilly gills and a sweet smile.
  axolotl(ctx, t, moving, blink) {
    const c = "#f4a6bd";
    ctx.strokeStyle = shadeColor(c, -10);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(-11, -6, -13, -4 + Math.sin(t * 5) * 1.5);
    ctx.stroke();
    petLegs(ctx, c, t, moving, [-4, -1, 2, 5]);
    petBlob(ctx, -1, -5, 7, 3.8, c);
    petBlob(ctx, 6, -8, 5, 4.2, c);
    ctx.strokeStyle = "#e0608a"; // gills
    ctx.lineWidth = 1.4;
    for (const [dx, dy, a] of [[3, -12, -2.2], [4.5, -13, -1.8], [6, -13.2, -1.3]]) {
      ctx.beginPath();
      ctx.moveTo(dx, dy + 2);
      ctx.lineTo(dx + Math.cos(a) * 4, dy + Math.sin(a) * 4);
      ctx.stroke();
    }
    petEye(ctx, 7.5, -9, blink, 1.1);
    ctx.strokeStyle = "#8a3a50";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(8.5, -7, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    petCheek(ctx, 10, -7.5);
  },

  // A calm capybara, with a little orange balanced on its head.
  capybara(ctx, t, moving, blink) {
    const c = "#a47a54";
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 8.5, 5.5, c);
    ctx.fillStyle = c; // the blocky head
    roundRectPath(ctx, 3, -14, 9, 7, 3);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -20);
    ctx.fillRect(10, -11, 2, 2.5); // nose
    petEar(ctx, 4.5, -14, 2.5, 2.5, c, shadeColor(c, -20));
    ctx.strokeStyle = "#2b2b2b"; // half-closed, very relaxed eyes
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6.5, -11.5);
    ctx.lineTo(8.5, -11.5);
    ctx.stroke();
    ctx.fillStyle = "#f0a040"; // the orange
    ctx.beginPath();
    ctx.arc(6.5, -16.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a8a3a";
    ctx.fillRect(6.2, -19.5, 1, 1.5);
  },

  // A little turtle with a patterned shell.
  turtle(ctx, t, moving, blink) {
    const skin = "#8fb86a";
    petLegs(ctx, skin, t, moving, [-4, 4]);
    petBlob(ctx, 8, -5, 3.5, 3, skin); // head
    petEye(ctx, 9.5, -5.5, blink, 1);
    const shell = "#5f8a4a";
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, -5, 8, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shadeColor(shell, 25);
    for (const [x, y] of [[-3.5, -7], [0, -9], [3.5, -7], [0, -5.5]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shadeColor(shell, -25);
    ctx.fillRect(-8, -5.5, 16, 1.5);
  },

  // A tiny bat that flutters beside you instead of walking.
  bat(ctx, t, moving, blink) {
    const hover = Math.sin(t * 4) * 1.5 - 10;
    const flap = Math.sin(t * 18) * 0.5;
    ctx.save();
    ctx.translate(0, hover);
    ctx.fillStyle = "#4a3a52";
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(flap);
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(8, -8, 11, -3);
      ctx.quadraticCurveTo(9, -2, 8, 0);
      ctx.quadraticCurveTo(6, -1, 5, 1);
      ctx.quadraticCurveTo(3, 0, 2, 1);
      ctx.fill();
      ctx.restore();
    }
    petBlob(ctx, 0, -1, 3.8, 4, "#5a4a62");
    petEar(ctx, -2, -5, 2, 3, "#5a4a62", "#c8a0b8");
    petEar(ctx, 2, -5, 2, 3, "#5a4a62", "#c8a0b8");
    petEye(ctx, -1.3, -1.5, blink, 0.9);
    petEye(ctx, 1.3, -1.5, blink, 0.9);
    ctx.fillStyle = "#fffaf3"; // tiny fangs
    ctx.fillRect(-0.9, 0.8, 0.6, 1);
    ctx.fillRect(0.3, 0.8, 0.6, 1);
    ctx.restore();
  },

  // A round golden hamster with stuffed cheeks.
  hamster(ctx, t, moving, blink) {
    const c = "#e0a860";
    petLegs(ctx, "#f3c8b0", t, moving, [-2.5, 2.5]);
    petBlob(ctx, 0, -6, 7.5, 6, c);
    ctx.fillStyle = "#fbeede"; // white belly and cheeks
    ctx.beginPath();
    ctx.ellipse(2.5, -4, 4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.5, -6.5, 2.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, -1.5, -11.5, 2.5, 2.5, c, "#f3b8b8");
    petEar(ctx, 3, -11.5, 2.5, 2.5, c, "#f3b8b8");
    petEye(ctx, 3.5, -8.5, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(6.8, -8, 1, 0.8);
    petCheek(ctx, 5.5, -6);
  },

  // A slow, happy snail.
  snail(ctx, t, moving, blink) {
    const body = "#d9c4a0";
    const stretch = moving ? Math.sin(t * 6) * 0.8 : 0;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(1 + stretch, -1.5, 9 + stretch, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = body; // eye stalks
    ctx.lineWidth = 1;
    for (const dx of [7, 9]) {
      ctx.beginPath();
      ctx.moveTo(dx - 1, -3);
      ctx.lineTo(dx + 0.5, -9);
      ctx.stroke();
      petEye(ctx, dx + 0.5, -9.5, blink, 1);
    }
    ctx.fillStyle = "#c0785a"; // the shell
    ctx.beginPath();
    ctx.arc(-1, -7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a4a3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const rr = 5.2 - a * 0.32;
      ctx.lineTo(-1 + Math.cos(a) * rr, -7 + Math.sin(a) * rr);
    }
    ctx.stroke();
  },

  // A fluffy sheep: a little cloud on legs.
  sheep(ctx, t, moving, blink) {
    petLegs(ctx, "#3a3440", t, moving);
    ctx.fillStyle = "#f7f3ec";
    for (const [x, y, rr] of [[-5, -7, 4], [-1, -9, 4.5], [3, -8, 4], [-3, -4.5, 4], [2, -4.5, 4]]) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.beginPath();
    ctx.ellipse(-1, -4, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 7, -10, 3.5, 4, "#3a3440"); // face
    petEar(ctx, 5, -13, 2, 2.5, "#3a3440", "#3a3440");
    ctx.fillStyle = "#f7f3ec"; // a tuft of wool on top
    ctx.beginPath();
    ctx.arc(6.5, -13.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.beginPath();
    ctx.arc(8.3, -10.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 8.3, -10.5, blink, 0.8);
  },
});

function drawPet(ctx, pet) {
  const drawer = Object.hasOwn(PET_DRAWERS, pet.kind) ? PET_DRAWERS[pet.kind] : null;
  if (!drawer) return;
  const at = toScreen(pet.x, pet.y);
  const t = performance.now() / 1000 + (pet.seed ?? 0); // so two pets don't blink in step
  const bob = pet.moving ? Math.abs(Math.sin(t * 14)) * 1.2 : 0;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(PET_SCALE, PET_SCALE);
  ctx.fillStyle = pet.kind === "ghost" ? "rgba(40, 25, 10, 0.12)" : "rgba(40, 25, 10, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -bob);
  ctx.scale(pet.facing < 0 ? -1 : 1, 1);
  drawer(ctx, t, pet.moving, t % 4.3 < 0.13);
  ctx.restore();
}

// Hearts floating up from a pet that was just petted (drawn with the name
// tags, so they're never hidden). `pet.petted` is seconds since petting.
function drawPetHearts(ctx, pet) {
  if (pet.petted === null || pet.petted === undefined || pet.petted > 1.6) return;
  const at = toScreen(pet.x, pet.y);
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "11px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  for (let i = 0; i < 2; i++) {
    const tt = pet.petted - i * 0.35;
    if (tt <= 0 || tt >= 1.2) continue;
    ctx.globalAlpha = 1 - tt / 1.2;
    ctx.fillText("💕", at.x + (i ? 6 : -5) + Math.sin(tt * 6) * 3, at.y - 32 - tt * 18);
  }
  ctx.restore();
}

// Draws a pet by itself, big, in a small canvas (for the shop).
function drawPetPreview(canvas, kind) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 16);
  ctx.scale(1.8, 1.8);
  const origin = toScreen(0, 0);
  ctx.translate(-origin.x, -origin.y);
  drawPet(ctx, { kind, x: 0, y: 0, facing: 1, moving: false });
  ctx.restore();
}

// --- The Exalted look (see CONFIG.exaltedNames and wardrobe.js) ---
// A look only certain accounts can wear, picked piece by piece in the
// wardrobe: a hooded crimson robe with glowing eyes, a slowly turning
// sigil circle on the floor, candles floating around them, and runes
// left glowing where they walk. p.aura is { robe, sigil, candles, runes }.

// A turning ring of runes on the floor, under their feet.
function drawSigil(ctx, x, y) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.38); // lying flat on the floor
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 30);
  glow.addColorStop(0, "rgba(200, 40, 70, 0.28)");
  glow.addColorStop(1, "rgba(200, 40, 70, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = "rgba(230, 70, 90, 0.75)";
  ctx.lineWidth = 1.4;
  for (const r of [24, 19]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); // a seven-pointed star inside
  for (let k = 0; k <= 7; k++) {
    const a = (k * 3 * Math.PI * 2) / 7;
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 200, 150, 0.8)"; // little runes around the ring
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(a) * 21.5, Math.sin(a) * 21.5);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillRect(-0.5, -1.8, 1, 3.6);
    ctx.fillRect(-1.6, k % 2 ? -1.8 : 0.6, 3.2, 0.9);
    ctx.restore();
  }
  ctx.restore();
}

// The candles floating around them: where each one is right now, and
// whether it's behind them (drawn first) or in front.
function candleSpots(cx, cy) {
  const t = performance.now() / 1000;
  return [0, 1, 2].map((k) => {
    const a = t * 0.9 + (k / 3) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 25, y: cy + 5 + Math.sin(a) * 6 + Math.sin(t * 2 + k) * 2, behind: Math.sin(a) < 0 }; // (low enough to pass below the face)
  });
}

function drawFloatingCandle(ctx, x, y) {
  const t = performance.now() / 1000;
  const glow = ctx.createRadialGradient(x, y - 9, 1, x, y - 9, 10);
  glow.addColorStop(0, "rgba(255, 210, 120, 0.55)");
  glow.addColorStop(1, "rgba(255, 210, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 9, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe4cf"; // the candle, with a drip
  ctx.fillRect(x - 2, y - 6, 4, 8);
  ctx.fillStyle = "#d8cbb2";
  ctx.fillRect(x + 1, y - 6, 1, 8);
  ctx.fillStyle = "#efe4cf";
  ctx.fillRect(x - 2.4, y - 6, 1.2, 3);
  const flick = Math.sin(t * 12 + x) * 0.6;
  ctx.fillStyle = "#ffb347"; // the flame
  ctx.beginPath();
  ctx.ellipse(x + flick * 0.4, y - 9, 1.6, 2.8 + flick * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath();
  ctx.ellipse(x + flick * 0.4, y - 8.4, 0.7, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A hooded crimson robe with gold trim over the body; inside the hood,
// shadow and two glowing eyes.
function drawRobe(ctx, cx, cy, r) {
  const robe = ctx.createLinearGradient(0, cy - r - 8, 0, cy + r + 4);
  robe.addColorStop(0, "#8a2438");
  robe.addColorStop(1, "#4a1020");
  ctx.fillStyle = robe;
  ctx.beginPath(); // the cloak, from the hood's point down to a flared hem
  ctx.moveTo(cx, cy - r - 8);
  ctx.quadraticCurveTo(cx + r + 2, cy - r + 2, cx + r + 1, cy + 2);
  ctx.lineTo(cx + r + 4, cy + r + 2);
  ctx.quadraticCurveTo(cx, cy + r + 6, cx - r - 4, cy + r + 2);
  ctx.lineTo(cx - r - 1, cy + 2);
  ctx.quadraticCurveTo(cx - r - 2, cy - r + 2, cx, cy - r - 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // lit from above
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - r - 1, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0a10"; // the dark opening of the hood
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d9a441"; // gold trim around the hood and down the front
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, r * 0.62 + 1, r * 0.55 + 1, 0, 0, Math.PI * 2);
  ctx.moveTo(cx, cy + r * 0.55);
  ctx.lineTo(cx, cy + r + 4);
  ctx.stroke();
  const t = performance.now() / 1000;
  ctx.fillStyle = `rgba(255, 207, 110, ${0.75 + Math.sin(t * 2) * 0.2})`; // glowing eyes
  for (const ex of [cx - 3.2, cx + 3.2]) {
    ctx.beginPath();
    ctx.ellipse(ex, cy - 2, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rune footsteps: little glowing marks left where they walk, fading away.
const runeMarks = []; // { x, y (grid, at their feet), born, glyph }
const lastRuneAt = {}; // player id -> where the last mark was dropped

function dropRuneMarks(players) {
  const now = performance.now();
  for (const p of players) {
    if (!p.aura?.runes || !p.moving || p.asleep) continue;
    const fx = p.x + PLAYER_SIZE / 2, fy = p.y + PLAYER_SIZE;
    const last = lastRuneAt[p.id];
    if (!last || Math.hypot(fx - last.x, fy - last.y) > 0.5) {
      runeMarks.push({ x: fx, y: fy, born: now, glyph: runeMarks.length % 4 });
      lastRuneAt[p.id] = { x: fx, y: fy };
    }
  }
  while (runeMarks.length && now - runeMarks[0].born > 1600) runeMarks.shift();
}

function drawRuneMarks(ctx) {
  const now = performance.now();
  for (const m of runeMarks) {
    if (floorOf(m.y) !== viewFloor) continue;
    const p = toScreen(m.x, m.y);
    const fade = 1 - (now - m.born) / 1600;
    ctx.save();
    ctx.translate(p.x, p.y - 2);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.strokeStyle = "#ff5a7a";
    ctx.shadowColor = "#ff5a7a";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (m.glyph === 0) { // a few simple rune shapes, taking turns
      ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(0, -2); ctx.lineTo(4, -6); ctx.moveTo(0, 2); ctx.lineTo(4, -2);
    } else if (m.glyph === 1) {
      ctx.moveTo(-4, 6); ctx.lineTo(0, -6); ctx.lineTo(4, 6); ctx.moveTo(-2, 1); ctx.lineTo(2, 1);
    } else if (m.glyph === 2) {
      ctx.moveTo(-4, -5); ctx.lineTo(4, 5); ctx.moveTo(4, -5); ctx.lineTo(-4, 5); ctx.moveTo(0, -6); ctx.lineTo(0, 6);
    } else {
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.moveTo(-4.5, 0); ctx.lineTo(4.5, 0);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Draws one player's body (used for yourself and everyone else): a soft
// shadow, two little feet, and a round body lit from above (lighter on
// top, darker underneath) like everything else, with their hat on top.
// While walking (p.moving), the body bobs and the feet take turns lifting.
// How far sitting moves someone up or down, in pixels: down a little on
// most seats, up on a tall-backed seat they're facing away from.
function seatLift(seated) {
  return seated === "upTall" ? -12 : seated ? 4 : 0;
}

function drawPlayerBody(ctx, p) {
  const foot = playerFeet(p);
  const r = PLAYER_RADIUS;
  const emote = p.emote?.id, et = p.emote?.t ?? 0; // which emote, and seconds since it started
  let step = p.moving ? Math.sin(performance.now() / 1000 * 12) : 0;
  let bob = Math.abs(step) * 2.5;
  let sway = 0, tilt = 0, kick = 0;
  if (emote === "jig") {
    // Hitting the jig: big bouncy hops, swaying side to side, feet kicking out.
    step = Math.sin(et * 9);
    bob = Math.abs(step) * 6;
    sway = Math.sin(et * 4.5) * 4;
    kick = 3.5;
  } else if (emote === "headbang") {
    // Headbanging to trap or dubstep: a hard nod forward on every beat
    // (140 BPM), sinking into it, feet planted.
    const hit = Math.pow(Math.abs(Math.sin(et * Math.PI * (140 / 60))), 4);
    step = 0;
    bob = -hit * 3;
    tilt = hit * 0.18;
  } else if (emote === "glitch") {
    // Glitching to breakcore: jumpy, twitchy jitter that jumps every 60ms.
    const n = Math.floor(et * 16);
    sway = (noise(n * 1.7) - 0.5) * 7;
    bob = noise(n * 2.3 + 5) * 5;
    tilt = (noise(n * 3.1 + 9) - 0.5) * 0.25;
    step = noise(n) > 0.5 ? 1 : -1;
  } else if (emote === "sway") {
    // Swaying to ambient: floating slowly up and down, drifting side to side.
    step = 0;
    sway = Math.sin(et * 1.3) * 4;
    bob = (Math.sin(et * 2.6) + 1) * 2.5;
    tilt = Math.sin(et * 1.3) * 0.07;
  } else if (p.whisper) {
    tilt = p.whisper.dir * 0.2; // leaning in toward the person they're whispering to
  } else if (DANCE_MOVES[emote]) {
    ({ step, bob, sway, tilt, kick } = { step: 0, bob: 0, sway: 0, tilt: 0, kick: 0, ...DANCE_MOVES[emote](et) });
  } else if (emote === "wave") {
    tilt = Math.sin(et * 8) * 0.12; // rocking side to side while waving
  } else if (emote === "laugh") {
    sway = Math.sin(et * 40) * 1.5; // shaking with laughter
  } else if (emote === "sleepy") {
    bob = (Math.sin(et * 1.5) + 1) * 0.8; // slow, sleepy breathing
  }
  const cx = foot.x + sway;
  // Sitting (p.seated is the way they face): lower, feet tucked, and
  // facing the way the seat does.
  const seated = p.seated;
  const speaking = p.speaking && !p.whisper && !p.asleep;
  const speechBob = speaking ? Math.abs(Math.sin((performance.now() / 1000) * 9)) * 2 : 0; // bouncing gently while talking
  const cy = foot.y - r - 5 - bob - speechBob + seatLift(seated); // (facing away on a tall seat, you sit up so your head shows over its back)

  // Talking (p.speaking, while their mic hears them): a soft glow behind
  // them and a gentle bounce. (Not while whispering: that has its own look.)
  if (speaking) {
    const glow = ctx.createRadialGradient(cx, cy, PLAYER_RADIUS * 0.6, cx, cy, PLAYER_RADIUS * 1.9);
    glow.addColorStop(0, "rgba(255, 245, 200, 0.55)");
    glow.addColorStop(1, "rgba(255, 245, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_RADIUS * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // The Exalted look's sigil circle (on the floor) and any floating
  // candles that are behind them right now.
  const aura = p.asleep ? null : p.aura;
  if (aura?.sigil) drawSigil(ctx, foot.x, foot.y);
  const candles = aura?.candles ? candleSpots(cx, cy) : [];
  for (const c of candles) if (c.behind) drawFloatingCandle(ctx, c.x, c.y);

  // (Someone asleep is tucked into bed: no shadow or feet, and a blanket
  // over their lower half, drawn further down.)
  if (!p.asleep) {
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)";
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y, r * 0.85 - bob * 0.6, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Feet, peeking out under the body (or shoes, if they're wearing some).
  const shoe = Object.hasOwn(SHOE_DRAWERS, p.shoes) ? SHOE_DRAWERS[p.shoes] : null;
  const liftSize = emote === "jig" ? 6 : 3;
  const facingAway = seated === "up" || seated === "upTall";
  const feet = p.asleep || facingAway ? [] : seated ? [[-1, 0], [1, 0]] : [[-1, Math.max(0, step) * liftSize], [1, Math.max(0, -step) * liftSize]];
  for (const [side, lift] of feet) {
    let fx = foot.x + side * (5.5 + (lift > 0 ? kick : 0)), fy = foot.y - 2.5 - lift;
    if (seated === "down") fy = foot.y + 0.5; // feet out in front
    if (seated === "left" || seated === "right") {
      fx = foot.x + (seated === "right" ? 7 : -7) + side * 2.5; // pointing the way they face
      fy = foot.y - 1 + side;
    }
    if (shoe) {
      shoe(ctx, fx, fy, side);
    } else {
      ctx.fillStyle = shadeColor(p.color, -70);
      ctx.beginPath();
      ctx.ellipse(fx, fy, 4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  if (tilt) {
    ctx.translate(foot.x, foot.y);
    ctx.rotate(tilt);
    ctx.translate(-foot.x, -foot.y);
  }

  const body = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  body.addColorStop(0, shadeColor(p.color, 35));
  body.addColorStop(1, shadeColor(p.color, -30));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(p.color, -50);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sitting facing away shows the back of the head; facing sideways moves
  // the face that way.
  const faceShift = seated === "left" ? -3.5 : seated === "right" ? 3.5 : 0;
  if (facingAway) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r - 3, 0, Math.PI);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(faceShift, 0);
  if (facingAway) ctx.globalAlpha = 0; // (the face is on the other side)
  // Face: eyes, rosy cheeks and a mouth, which change with some emotes.
  ctx.strokeStyle = "#2b2b2b";
  ctx.fillStyle = "#2b2b2b";
  ctx.lineWidth = 1.5;
  if (emote === "idleYawn") {
    // A big yawn: eyes squeezed shut, mouth opening wide and closing.
    const open = Math.sin(Math.min(1, et / 2.8) * Math.PI);
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 3, 2, Math.PI * 0.15, Math.PI * 0.85); // closed, relaxed eyes
      ctx.stroke();
    }
    ctx.fillStyle = "#6b2a2a";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3.5, 2 + open * 1.5, 1 + open * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === "idleLook") {
    // Looking around: eyes glancing one way, then the other.
    const look = Math.sin(et * 2) * 2.5;
    ctx.beginPath();
    ctx.arc(cx - 4 + look, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 4 + look, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === "sleepy" || emote === "sway" || emote === "idleSeated") {
    // Closed eyes: sleepy, lost in the music, or resting in a seat.
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 1.5);
    ctx.lineTo(cx - 2, cy - 1.5);
    ctx.moveTo(cx + 2, cy - 1.5);
    ctx.lineTo(cx + 6, cy - 1.5);
    ctx.stroke();
  } else if (emote === "laugh" || emote === "jig" || emote === "headbang" || emote === "glitch" || emote === "idleStretch" || HAPPY_DANCES.has(emote)) {
    // Happy squinting eyes, like ^ ^.
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 1, 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else if (p.typing && !emote) {
    // Thinking while typing: eyes glancing up and to the side, and one
    // eyebrow raised.
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 2.5, cy - 7.5);
    ctx.quadraticCurveTo(cx + 5, cy - 9, cx + 7.5, cy - 7.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(240, 120, 120, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (emote === "idleYawn") {
    // (the yawning mouth is drawn with the eyes)
  } else if (emote === "laugh") {
    ctx.fillStyle = "#6b2a2a"; // wide open laughing mouth
    ctx.beginPath();
    ctx.arc(cx, cy + 2.5, 3.5, 0, Math.PI);
    ctx.fill();
  } else if (p.typing && !emote) {
    ctx.beginPath(); // a small "hmm" mouth
    ctx.moveTo(cx - 1.5, cy + 4);
    ctx.lineTo(cx + 2.5, cy + 3.3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Glasses go on the face (a robe's hood hides them).
  if (!aura?.robe && Object.hasOwn(GLASSES_DRAWERS, p.glasses) && GLASSES_DRAWERS[p.glasses]) GLASSES_DRAWERS[p.glasses](ctx, cx, cy);
  ctx.restore();
  // A robe's hood takes the place of a hat.
  if (aura?.robe) drawRobe(ctx, cx, cy, r);
  else (Object.hasOwn(HAT_DRAWERS, p.hat) ? HAT_DRAWERS[p.hat] : HAT_DRAWERS.none)(ctx, cx, cy, r);
  for (const c of candles) if (!c.behind) drawFloatingCandle(ctx, c.x, c.y);

  if (p.asleep) {
    // Tucked in: the bed's blanket pulled up over their lower half.
    const blanket = ctx.createLinearGradient(0, cy + 2, 0, foot.y + 4);
    blanket.addColorStop(0, shadeColor(p.asleep.color, 30));
    blanket.addColorStop(1, shadeColor(p.asleep.color, -10));
    ctx.fillStyle = blanket;
    roundRectPath(ctx, cx - r - 6, cy + 2, r * 2 + 12, foot.y + 4 - cy - 2, 5);
    ctx.fill();
    ctx.fillStyle = shadeColor(p.asleep.color, 55); // the folded-back cuff
    ctx.fillRect(cx - r - 6, cy + 2, r * 2 + 12, 5);
  }

  if (p.typing && !emote) {
    // A little hand resting thoughtfully on the chin.
    ctx.fillStyle = shadeColor(p.color, 20);
    ctx.strokeStyle = shadeColor(p.color, -50);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy + r - 2.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (emote === "wave") {
    // A little waving hand beside the body.
    ctx.fillStyle = shadeColor(p.color, 20);
    ctx.strokeStyle = shadeColor(p.color, -50);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + r + 2, cy - 5 + Math.sin(et * 14) * 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Someone whispering: a little curl of air and a "psst" by their head, on
// the side of the person they're whispering to. Everyone can see a whisper
// is happening; only that one person hears it.
function drawWhisperSwirl(ctx, cx, headTop, dir) {
  const t = performance.now() / 1000;
  const x = cx + dir * 17, y = headTop + 20;
  ctx.save();
  ctx.strokeStyle = "rgba(120, 140, 170, 0.75)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.25) {
    const rr = 1 + a * 1.1;
    ctx.lineTo(x + dir * Math.cos(a + t * 3) * rr, y + Math.sin(a + t * 3) * rr * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(90, 105, 135, 0.9)";
  ctx.font = "italic 700 9px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
  ctx.fillText("psst", x + dir * 6, y - 10);
  ctx.restore();
}

// How long each emote lasts, in seconds (walking stops one early).
const EMOTE_LENGTHS = {
  wave: 2.5, heart: 3, laugh: 3, sleepy: 5,
  jig: 6, headbang: 6, glitch: 5, sway: 6.5,
  idleStretch: 2.6, idleYawn: 2.8, idleLook: 3.2, idleSeated: 3.5, // idle animations (not picked by you)
  disco: 6, rave: 6, boombap: 6, mosh: 5, pop: 6, twostep: 6, reggaeton: 6, swing: 5, synthwave: 7,
};

// How each of the newer dances moves: given seconds since it started,
// the body's hop (bob), side-to-side (sway), lean (tilt) and feet (step,
// kick). Each is timed to its music's tempo.
const beats = (t, bpm) => t * (bpm / 60);
const DANCE_MOVES = {
  // Idle animations (they share this table with the dances).
  idleStretch: (t) => { const up = Math.sin(Math.min(1, t / 2.6) * Math.PI); return { bob: up * 5, tilt: Math.sin(t * 5) * 0.04 * up }; },
  idleYawn: (t) => ({ tilt: -Math.sin(Math.min(1, t / 2.8) * Math.PI) * 0.08 }),
  idleLook: () => ({}),
  idleSeated: (t) => ({ bob: (Math.sin(t * 1.8) + 1) * 0.8 }),
  disco: (t) => { const b = beats(t, 118); return { sway: Math.sin(b * Math.PI) * 5, bob: Math.abs(Math.sin(b * Math.PI * 2)) * 3, tilt: Math.sin(b * Math.PI) * 0.1, step: Math.sin(b * Math.PI * 2) }; },
  rave: (t) => { const b = beats(t, 128); return { bob: Math.pow(Math.abs(Math.sin(b * Math.PI)), 2) * 7, step: Math.sin(b * Math.PI * 2), kick: 2 }; },
  boombap: (t) => { const b = beats(t, 90); return { sway: 2, bob: Math.abs(Math.sin(b * Math.PI)) * 2, tilt: 0.06 + Math.pow(Math.abs(Math.sin(b * Math.PI)), 3) * 0.12 }; },
  mosh: (t) => { const b = beats(t, 180), n = Math.floor(t * 12); return { sway: (noise(n * 1.3) - 0.5) * 9, bob: Math.abs(Math.sin(b * Math.PI)) * 8, tilt: (noise(n * 2.7) - 0.5) * 0.4, step: Math.sin(b * Math.PI * 2), kick: 3 }; },
  pop: (t) => { const b = beats(t, 120); return { bob: Math.abs(Math.sin(b * Math.PI)) * 6, sway: Math.sin(b * Math.PI / 2) * 2, tilt: Math.sin(b * Math.PI / 2) * 0.08, step: Math.sin(b * Math.PI * 2) }; },
  twostep: (t) => { const b = beats(t, 100); return { sway: Math.sin(b * Math.PI / 2) * 7, bob: Math.abs(Math.sin(b * Math.PI)) * 2, step: Math.sin(b * Math.PI), kick: 2 }; },
  reggaeton: (t) => { const b = beats(t, 95); return { sway: Math.sin(b * Math.PI * 2) * 3, tilt: Math.sin(b * Math.PI * 2) * 0.14, bob: Math.abs(Math.sin(b * Math.PI * 2)) * 1.5 }; },
  swing: (t) => { const b = beats(t, 160); return { bob: Math.abs(Math.sin(b * Math.PI)) * 5, tilt: Math.sin(b * Math.PI) * 0.1, step: Math.sin(b * Math.PI), kick: 3 }; },
  synthwave: (t) => { const b = beats(t, 100); return { sway: Math.sin(b * Math.PI / 2) * 3, tilt: Math.sin(b * Math.PI / 2) * 0.08, bob: 1 }; },
};
// Dances with the happy squinting eyes (the rest keep a cool open look).
const HAPPY_DANCES = new Set(["disco", "rave", "mosh", "pop", "twostep", "reggaeton", "swing"]);

// The little things floating above someone doing an emote: hearts, notes,
// Z's, or an emoji. Drawn with the name tags, so they're never hidden.
function drawEmoteFloaters(ctx, p, cx, headTop) {
  const { id, t } = p.emote;
  ctx.save();
  ctx.textAlign = "center";
  const emojiFont = (size) => `${size}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
  if (id === "heart") {
    ctx.font = emojiFont(14);
    for (let i = 0; i < 3; i++) {
      const tt = t - i * 0.5;
      if (tt <= 0 || tt >= 2) continue;
      ctx.globalAlpha = 1 - tt / 2;
      ctx.fillText("❤️", cx + Math.sin(tt * 3 + i * 2) * 9, headTop - 26 - tt * 16);
    }
  } else if (id === "wave") {
    ctx.font = emojiFont(16);
    ctx.fillText("👋", cx + 18, headTop - 4 + Math.sin(t * 10) * 2);
  } else if (id === "laugh") {
    ctx.font = emojiFont(16);
    ctx.fillText("😂", cx, headTop - 28 + Math.sin(t * 12) * 2);
  } else if (id === "sleepy") {
    ctx.fillStyle = "#5f6b7a";
    for (let i = 0; i < 3; i++) {
      const tt = (t * 0.7 + i / 3) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.font = `700 ${Math.round(9 + tt * 8)}px 'Quicksand', sans-serif`;
      ctx.fillText("z", cx + 12 + tt * 14, headTop - 4 - tt * 22);
    }
  } else if (id === "headbang") {
    // Bass rings pulsing out on the beat, and a lightning bolt now and then.
    const beat = (t * (140 / 60)) % 1;
    ctx.strokeStyle = `rgba(150, 80, 220, ${0.7 * (1 - beat)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, headTop + 44, 12 + beat * 20, 4 + beat * 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = emojiFont(14);
    if (Math.floor(t * (140 / 60)) % 2 === 0) ctx.fillText("⚡", cx + 22, headTop + 20);
    ctx.fillText("🔊", cx - 22, headTop + 22 + Math.sin(t * 15) * 1.5);
  } else if (id === "glitch") {
    // Flickering cyan and magenta glitch blocks around their head.
    const n = Math.floor(t * 14);
    for (let i = 0; i < 6; i++) {
      if (noise(n * 7 + i) < 0.45) continue;
      ctx.fillStyle = i % 2 ? "rgba(0, 230, 255, 0.75)" : "rgba(255, 40, 200, 0.75)";
      const x = cx + (noise(n * 3 + i * 5) - 0.5) * 44, y = headTop - 4 + (noise(n * 11 + i) - 0.5) * 34;
      ctx.fillRect(x, y, 3 + noise(i + n) * 10, 2 + noise(i * 2 + n) * 3);
    }
  } else if (id === "sway") {
    // Soft glowing orbs drifting slowly upward.
    const colors = ["rgba(170, 200, 255, ", "rgba(220, 180, 255, ", "rgba(180, 240, 220, "];
    for (let i = 0; i < 5; i++) {
      const tt = (t * 0.25 + i / 5) % 1;
      const x = cx + Math.sin(t * 0.8 + i * 1.9) * 20, y = headTop + 20 - tt * 40;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
      glow.addColorStop(0, colors[i % 3] + (0.95 * (1 - tt)) + ")");
      glow.addColorStop(0.4, colors[i % 3] + (0.6 * (1 - tt)) + ")");
      glow.addColorStop(1, colors[i % 3] + "0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === "idleYawn") {
    ctx.fillStyle = "#8a7560"; // a little sleepy "~"
    ctx.font = "700 11px 'Quicksand', sans-serif";
    ctx.globalAlpha = Math.sin(Math.min(1, t / 2.8) * Math.PI);
    ctx.fillText("~", cx + 14, headTop + 16 - t * 3);
  } else if (id === "idleStretch") {
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 10px 'Quicksand', sans-serif";
    ctx.globalAlpha = Math.sin(Math.min(1, t / 2.6) * Math.PI);
    ctx.fillText("✧", cx - 14, headTop + 10);
    ctx.fillText("✧", cx + 14, headTop + 10);
  } else if (id === "disco") {
    // A tiny mirror ball above them, throwing colorful sparkles.
    const bx = cx, by = headTop - 34;
    ctx.strokeStyle = "rgba(90, 80, 70, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by - 12);
    ctx.lineTo(bx, by - 6);
    ctx.stroke();
    ctx.fillStyle = "#cfd6de";
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let k = 0; k < 6; k++) ctx.fillRect(bx - 4 + (k % 3) * 3, by - 3 + Math.floor(k / 3) * 3, 1.6, 1.6);
    const colors = ["#ff6fa8", "#6fd8ff", "#ffe36f", "#b58cff"];
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + i;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 + i * 2);
      ctx.fillStyle = colors[i % 4];
      ctx.fillText("✦", cx + Math.cos(a) * 26, headTop + 10 + Math.sin(a * 1.3) * 16);
    }
  } else if (id === "rave") {
    // Laser beams sweeping out from above their head.
    const colors = ["rgba(80, 255, 170, 0.6)", "rgba(255, 60, 200, 0.6)", "rgba(80, 180, 255, 0.6)"];
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + Math.sin(t * 2.2 + i * 2.1) * 1.1;
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(cx, headTop - 26);
      ctx.lineTo(cx + Math.cos(a) * 60, headTop - 26 + Math.sin(a) * 60);
      ctx.stroke();
    }
  } else if (id === "boombap") {
    ctx.font = emojiFont(14);
    ctx.fillText("🎤", cx + 22, headTop + 18);
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    const tt = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - tt;
    ctx.fillText("♪", cx - 20, headTop + 10 - tt * 22);
  } else if (id === "mosh") {
    ctx.font = emojiFont(15);
    const flip = Math.floor(t * 3) % 2;
    ctx.fillText("🤘", cx + (flip ? 22 : -22), headTop + 14 + Math.sin(t * 18) * 2);
  } else if (id === "pop") {
    // Hearts and stars bubbling up in pastel colors.
    const shapes = ["♥", "★", "♥", "★", "✦"];
    const colors = ["#ff8fb8", "#ffd36f", "#b58cff", "#7fd8ff", "#ff8fb8"];
    ctx.font = "700 13px 'Quicksand', sans-serif";
    for (let i = 0; i < 5; i++) {
      const tt = (t * 0.7 + i / 5) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = colors[i];
      ctx.fillText(shapes[i], cx + Math.sin(t * 2 + i * 1.7) * 22, headTop + 16 - tt * 30);
    }
  } else if (id === "twostep") {
    ctx.font = emojiFont(14);
    ctx.fillText("🤠", cx - 22, headTop + 16);
    ctx.fillStyle = "#a0703e";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    const tt = (t * 0.8) % 1;
    ctx.globalAlpha = 1 - tt;
    ctx.fillText("♫", cx + 20, headTop + 10 - tt * 22);
  } else if (id === "reggaeton") {
    ctx.font = emojiFont(14);
    for (let i = 0; i < 2; i++) {
      const tt = (t * 0.7 + i / 2) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillText("🔥", cx + (i ? 20 : -20), headTop + 20 - tt * 20);
    }
  } else if (id === "swing") {
    ctx.font = emojiFont(14);
    ctx.fillText("🎷", cx + 22, headTop + 16 + Math.sin(t * 6) * 2);
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    for (let i = 0; i < 2; i++) {
      const tt = (t * 0.9 + i / 2) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillText(i ? "♪" : "♫", cx - 18 - tt * 6, headTop + 12 - tt * 24);
    }
  } else if (id === "synthwave") {
    // A little neon sunset floating above them, with scan lines.
    const sx = cx, sy = headTop - 30;
    const sun = ctx.createLinearGradient(0, sy - 9, 0, sy + 3);
    sun.addColorStop(0, "#ffd36f");
    sun.addColorStop(1, "#ff4f9a");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sx, sy + 3, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(40, 20, 60, 0.9)";
    for (let k = 0; k < 3; k++) ctx.fillRect(sx - 10, sy - 2 + k * 2.5, 20, 0.9 + k * 0.4);
    ctx.strokeStyle = `rgba(90, 220, 255, ${0.5 + Math.sin(t * 3) * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 16, sy + 4);
    ctx.lineTo(sx + 16, sy + 4);
    ctx.stroke();
  } else if (id === "jig") {
    const colors = ["#c0554a", "#3f6f9f", "#d9a441", "#4f7a48"];
    ctx.font = "700 15px 'Quicksand', sans-serif";
    for (let i = 0; i < 4; i++) {
      const tt = (t * 0.9 + i / 4) % 1;
      const angle = t * 3 + i * 1.6;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = colors[i];
      ctx.fillText(i % 2 ? "♪" : "♫", cx + Math.cos(angle) * 22, headTop + 12 - tt * 26);
    }
  }
  ctx.restore();
}

// Draws a character by itself, centered in a small canvas, for the
// preview on the Join screen.
function drawCharacterPreview(canvas, color, hat, shoes, aura = null, glasses = "none") {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const p = { x: 0, y: 0, color, hat, shoes, glasses, moving: false, aura: aura && { robe: aura.robe } }; // (just the robe: the rest wouldn't fit)
  const foot = playerFeet(p);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 13);
  ctx.scale(2, 2); // drawn at double size so it's easy to see
  ctx.translate(-foot.x, -foot.y);
  drawPlayerBody(ctx, p);
  ctx.restore();
}

// Name tag and optional badge (like "eating"). Drawn in a last pass so
// they stay readable even when the player is behind furniture or a wall.
// How far each player's name tag is lifted to clear their hat right now
// (eased, so it glides when they change hats). Keyed by player id.
const tagLifts = {};
let lastTagTime = performance.now();

// How much to lift a name tag for a hat: the name normally has 8 pixels
// of room above the head, so only hats taller than that (plus a small
// gap, which also covers the little bob while walking) push it up. Hat
// heights come from shop.js.
function tagLiftFor(hat) {
  const height = hat === "hood" ? 8 : globalThis.hatHeights?.[hat] ?? 0; // (the Exalted robe's hood is 8 pixels tall)
  return Math.max(0, height + 5 - 8);
}

function drawPlayerTag(ctx, p) {
  const foot = playerFeet(p);
  const cx = foot.x;
  const now = performance.now();
  const step = Math.min(1, ((now - lastTagTime) / 1000) * 10);
  lastTagTime = now;
  const target = p.aura?.robe && !p.asleep ? tagLiftFor("hood") : tagLiftFor(p.hat);
  const lift = (tagLifts[p.id] ??= target);
  tagLifts[p.id] = lift + (target - lift) * step;
  // The top of their head plus room for their hat. The name, badge, speech
  // bubbles and emotes all sit above this, so none of them cover the hat.
  const headTop = foot.y - PLAYER_RADIUS * 2 - 10 - tagLifts[p.id] + seatLift(p.seated);

  if (p.emote) drawEmoteFloaters(ctx, p, cx, headTop);
  if (p.whisper) drawWhisperSwirl(ctx, cx, headTop, p.whisper.dir);

  ctx.font = "600 11px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  // Admins get a little badge before their name (checked with the server's
  // signature, see checkBadge in account.js).
  const badgeWidth = p.admin ? 13 : 0;
  const tagWidth = ctx.measureText(p.name).width + 12 + badgeWidth;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  roundRectPath(ctx, cx - tagWidth / 2, headTop - 18, tagWidth, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillText(p.name, cx + badgeWidth / 2, headTop - 7.5);
  if (p.admin) {
    ctx.font = "9px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
    ctx.fillText(CONFIG.adminBadge, cx - tagWidth / 2 + 10, headTop - 7.5);
  }

  if (p.badge) {
    ctx.font = "13px sans-serif";
    const badgeWidth = ctx.measureText(p.badge).width + 16;
    roundRectPath(ctx, cx - badgeWidth / 2, headTop - 40, badgeWidth, 17, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(p.badge, cx, headTop - 27);
  }

  // While they're typing (and haven't just said something): a little
  // bubble with three dots bouncing one after another.
  if (p.typing && !p.bubble) {
    const bottom = headTop - (p.badge ? 46 : 26);
    const w = 34, h = 18, t = performance.now() / 1000;
    ctx.fillStyle = "rgba(40, 25, 10, 0.15)";
    roundRectPath(ctx, cx - w / 2 + 1, bottom - h + 2, w, h, 9);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, cx - w / 2, bottom - h, w, h, 9);
    ctx.fill();
    ctx.beginPath(); // little tail pointing down at them
    ctx.moveTo(cx - 4, bottom - 1);
    ctx.lineTo(cx + 4, bottom - 1);
    ctx.lineTo(cx, bottom + 4);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const hop = Math.max(0, Math.sin(t * 6 - i * 0.9)) * 3;
      ctx.fillStyle = "#b39c7a";
      ctx.beginPath();
      ctx.arc(cx - 8 + i * 8, bottom - h / 2 - hop, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Speech bubble for a recent chat message, above the name (and badge).
  if (p.bubble) {
    ctx.font = "600 12px 'Quicksand', sans-serif";
    const text = clipText(p.bubble, 34, "…");
    const w = ctx.measureText(text).width + 18, h = 22;
    const bottom = headTop - (p.badge ? 46 : 26);
    ctx.fillStyle = "rgba(40, 25, 10, 0.15)";
    roundRectPath(ctx, cx - w / 2 + 1, bottom - h + 2, w, h, 10);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, cx - w / 2, bottom - h, w, h, 10);
    ctx.fill();
    ctx.beginPath(); // little tail pointing down at the speaker
    ctx.moveTo(cx - 5, bottom - 1);
    ctx.lineTo(cx + 5, bottom - 1);
    ctx.lineTo(cx, bottom + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4a3a2c";
    ctx.fillText(text, cx, bottom - 7);
  }
  ctx.textAlign = "left";
}

// A room's sign: a little wooden board hanging over its doorway, all the
// same size. It shows the room's icon (CONFIG.roomIcons), or for an office
// or bedroom its owner's name. Drawn in the same front-to-back order as
// the wall, so people walk in front of or behind it like any wall.
const SIGN_W = 40, SIGN_H = 22;

// Where a room's sign hangs: its middle, in screen pixels.
function signCenter(room) {
  const p = toScreen(room.sign.x, room.sign.y + WALL_THICKNESS / 2); // the wall's front edge
  return { x: p.x, y: p.y - WALL_HEIGHT + 6 };
}

function drawRoomSign(ctx, room) {
  const c = signCenter(room);
  const x = c.x - SIGN_W / 2, y = c.y - SIGN_H / 2;
  ctx.fillStyle = "rgba(40, 25, 10, 0.3)"; // soft shadow on the wall behind
  roundRectPath(ctx, x + 1, y + 3, SIGN_W, SIGN_H, 5);
  ctx.fill();
  roundRectPath(ctx, x, y, SIGN_W, SIGN_H, 5);
  ctx.fillStyle = "#8a5a3c";
  ctx.fill();
  ctx.fillStyle = "rgba(255, 235, 200, 0.18)"; // lit from above
  ctx.fillRect(x + 3, y + 1.5, SIGN_W - 6, 2);
  roundRectPath(ctx, x + 2.5, y + 2.5, SIGN_W - 5, SIGN_H - 5, 3);
  ctx.strokeStyle = "#c9955f";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = "center";
  if (room.owned) {
    // A nameplate: the owner's name, shrunk to fit if it's long.
    let size = 10;
    do {
      ctx.font = `700 ${size}px 'Quicksand', sans-serif`;
    } while (ctx.measureText(room.owned.ownerName).width > SIGN_W - 9 && --size > 6);
    ctx.fillStyle = "#f3e6d0";
    ctx.fillText(room.owned.ownerName, c.x, c.y + size / 2 - 1, SIGN_W - 9);
  } else {
    const icon = CONFIG.roomIcons?.[room.id] || "door";
    ctx.fillStyle = ctx.strokeStyle = "#f3e6d0";
    if (Object.hasOwn(SIGN_ICONS, icon)) SIGN_ICONS[icon](ctx, c.x, c.y);
    else {
      ctx.font = "13px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      ctx.fillText(icon, c.x, c.y + 5);
    }
  }
  ctx.textAlign = "left";
}

// Little cream icons for door signs, each drawn around (cx, cy) in about
// a 16 by 14 pixel box, like they were burned into the wood.
const SIGN_ICONS = {
  film(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c"; // the reel's holes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 3.6, cy + Math.sin(a) * 3.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f3e6d0";
    ctx.fillRect(cx + 4, cy + 5, 6, 1.6); // film trailing off
  },
  pencil(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillRect(-7, -2, 10, 4);
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(7.5, 0);
    ctx.lineTo(3, 2);
    ctx.fill();
    ctx.fillStyle = "#e8a0a0"; // eraser
    ctx.fillRect(-9, -2, 2, 4);
    ctx.restore();
  },
  books(ctx, cx, cy) {
    ctx.fillRect(cx - 7, cy - 5, 3.5, 11);
    ctx.fillRect(cx - 2.5, cy - 7, 3.5, 13);
    ctx.save();
    ctx.translate(cx + 3, cy + 6);
    ctx.rotate(0.3);
    ctx.fillRect(0, -11, 3.5, 11); // one leaning over
    ctx.restore();
  },
  openBook(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.quadraticCurveTo(cx - 4, cy - 6, cx - 8, cy - 5);
    ctx.lineTo(cx - 8, cy + 5);
    ctx.quadraticCurveTo(cx - 4, cy + 4, cx, cy + 6);
    ctx.quadraticCurveTo(cx + 4, cy + 4, cx + 8, cy + 5);
    ctx.lineTo(cx + 8, cy - 5);
    ctx.quadraticCurveTo(cx + 4, cy - 6, cx, cy - 3);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 0.5, cy - 3, 1, 9);
  },
  lamp(ctx, cx, cy) {
    ctx.beginPath(); // the shade
    ctx.moveTo(cx - 3.5, cy - 7);
    ctx.lineTo(cx + 3.5, cy - 7);
    ctx.lineTo(cx + 6.5, cy - 1);
    ctx.lineTo(cx - 6.5, cy - 1);
    ctx.fill();
    ctx.fillRect(cx - 0.8, cy - 1, 1.6, 6);
    ctx.fillRect(cx - 4, cy + 5, 8, 2);
  },
  forkKnife(ctx, cx, cy) {
    for (const dx of [-6, -4, -2]) ctx.fillRect(cx + dx, cy - 7, 1.2, 5); // tines
    ctx.fillRect(cx - 6, cy - 3, 5.2, 1.6);
    ctx.fillRect(cx - 4.2, cy - 2, 1.6, 9);
    ctx.beginPath(); // the knife
    ctx.moveTo(cx + 3, cy - 7);
    ctx.quadraticCurveTo(cx + 7, cy - 4, cx + 5, cy + 1);
    ctx.lineTo(cx + 3, cy + 1);
    ctx.fill();
    ctx.fillRect(cx + 3, cy, 1.8, 7);
  },
  hammer(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.6);
    ctx.fillRect(-1.2, -3, 2.4, 11); // handle
    ctx.fillRect(-6, -7, 12, 4.5); // head
    ctx.fillRect(4, -7, 2.5, 2); // claw
    ctx.restore();
  },
  elevator(ctx, cx, cy) {
    ctx.fillRect(cx - 8, cy - 7, 10, 14); // two doors
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 3.5, cy - 7, 1, 14);
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath(); // up and down arrows
    ctx.moveTo(cx + 4, cy - 1.5);
    ctx.lineTo(cx + 9, cy - 1.5);
    ctx.lineTo(cx + 6.5, cy - 6);
    ctx.moveTo(cx + 4, cy + 1.5);
    ctx.lineTo(cx + 9, cy + 1.5);
    ctx.lineTo(cx + 6.5, cy + 6);
    ctx.fill();
  },
  stairs(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 6);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(cx - 8 + i * 4, cy + 6 - (i + 1) * 3);
      ctx.lineTo(cx - 8 + (i + 1) * 4, cy + 6 - (i + 1) * 3);
    }
    ctx.lineTo(cx + 8, cy + 6);
    ctx.closePath();
    ctx.fill();
  },
  gamepad(ctx, cx, cy) {
    roundRectPath(ctx, cx - 8, cy - 4.5, 16, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 5.5, cy - 0.7, 5, 1.4); // the d-pad
    ctx.fillRect(cx - 3.7, cy - 2.5, 1.4, 5);
    for (const [dx, dy] of [[3.5, -1], [5.5, 1]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  music(ctx, cx, cy) {
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy + 4, 3, 2.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 0.4, cy - 7, 1.6, 11);
    ctx.beginPath();
    ctx.moveTo(cx + 1.2, cy - 7);
    ctx.quadraticCurveTo(cx + 6, cy - 5, cx + 5, cy - 1);
    ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 1.2, cy - 4);
    ctx.fill();
  },
  heart(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6);
    ctx.bezierCurveTo(cx - 9, cy, cx - 5, cy - 8, cx, cy - 3);
    ctx.bezierCurveTo(cx + 5, cy - 8, cx + 9, cy, cx, cy + 6);
    ctx.fill();
  },
  leaf(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 6);
    ctx.quadraticCurveTo(cx - 6, cy - 6, cx + 7, cy - 6);
    ctx.quadraticCurveTo(cx + 6, cy + 5, cx - 6, cy + 6);
    ctx.fill();
  },
  moon(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.beginPath();
    ctx.arc(cx + 3.5, cy - 2.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
  },
  door(ctx, cx, cy) {
    roundRectPath(ctx, cx - 4.5, cy - 7, 9, 14, 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.beginPath();
    ctx.arc(cx + 2, cy, 1, 0, Math.PI * 2);
    ctx.fill();
  },
};

// A room's full name fades in as a small tag under its sign while you're
// near its doorway, and fades out as you walk away.
const signFade = {}; // room id -> how visible its tag is (0 to 1)
let lastFadeTime = 0;
const NEAR_DOOR = 1.7; // grid units from the doorway

function drawDoorTags(ctx, me) {
  const now = performance.now();
  const step = Math.min(0.1, (now - lastFadeTime) / 1000) * 5; // about a fifth of a second to fade
  lastFadeTime = now;
  ctx.font = "700 11px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  for (const room of ROOMS) {
    if (!room.sign || floorOf(room.sign.y) !== viewFloor) continue;
    const near = me && Math.abs(me.x + PLAYER_SIZE / 2 - room.sign.x) < NEAR_DOOR && Math.abs(me.y + PLAYER_SIZE / 2 - room.sign.y) < NEAR_DOOR;
    const fade = Math.max(0, Math.min(1, (signFade[room.id] || 0) + (near ? step : -step)));
    signFade[room.id] = fade;
    if (fade === 0) continue;
    const c = signCenter(room);
    const w = ctx.measureText(room.name).width + 14, h = 17;
    const x = c.x - w / 2, y = c.y + SIGN_H / 2 + 4;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    roundRectPath(ctx, x + 1, y + 2, w, h, 8);
    ctx.fill();
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, c.x, y + 12.5);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

// The Study focus timer, shown as a little chalkboard over the study table
// so everyone can see it (even from other rooms).
function drawStudySign(ctx, text) {
  const table = FURNITURE.find((f) => f.kind === "studyTable");
  const p = toScreen(table.x + table.w / 2, table.y);
  ctx.font = "700 14px 'Quicksand', sans-serif";
  const w = ctx.measureText(text).width + 24, h = 26;
  const x = p.x - w / 2, y = p.y - 78;
  // Two strings it hangs from.
  ctx.strokeStyle = "rgba(60, 40, 20, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 16, y - 10);
  ctx.moveTo(x + w - 10, y);
  ctx.lineTo(x + w - 16, y - 10);
  ctx.stroke();
  roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fillStyle = WOOD;
  ctx.fill();
  roundRectPath(ctx, x, y, w, h, 4);
  ctx.fillStyle = "#34473a";
  ctx.fill();
  ctx.fillStyle = "#f3ecd8";
  ctx.textAlign = "center";
  ctx.fillText(text, p.x, y + 18);
  ctx.textAlign = "left";
}



// The open lawn outside: north of the hallway where no room stands (empty
// office spots), and the garden south of the hallway's east end, as
// rectangles in grid units.
function lawnAreas() {
  const t = WALL_THICKNESS, base = viewFloor * UPSTAIRS;
  const taken = ROOMS.filter((r) => r.north && floorOf(r.rect.y) === viewFloor)
    .map((r) => [r.rect.x - t, r.rect.x + r.rect.w + t])
    .sort((a, b) => a[0] - b[0]);
  const areas = [];
  let from = -t;
  for (const [start, end] of taken) {
    if (start > from) areas.push({ x: from, w: start - from });
    from = Math.max(from, end);
  }
  if (from < HOUSE_WIDTH + t) areas.push({ x: from, w: HOUSE_WIDTH + t - from });
  // The corridor the north rooms open onto: the hallway, or the landing
  // (which sits lower upstairs).
  const corridor = viewFloor === 0 ? 0 : LANDING;
  const north = areas.map((a) => ({ ...a, y: base + houseTopY - 1.5, h: corridor - t - (base + houseTopY - 1.5) }));
  // Plus the garden below the stairs (downstairs), or the roof south of
  // the landing (upstairs).
  const belowStairs = { x: 18, y: corridor + 7 + t / 2, w: HOUSE_WIDTH + t - 18 + 1, h: 5 };
  if (viewFloor === 0) return [...north, belowStairs];
  // (Upstairs, the Workshop takes the west end of the roof south of the
  // landing.)
  return [...north, belowStairs, { x: 8 + t / 2, y: corridor + 3 + t / 2, w: 10, h: 9 }, { x: -t - 1, y: corridor + 8 + t, w: 9 + t / 2, h: 4 }];
}

// --- Decorating helpers ---

// Turns a point on the canvas (in CSS pixels from its top-left corner)
// into a grid position on the floor being drawn.
// The other way: where a grid spot is on the page, in page pixels (for
// placing things like the emote wheel over the house view).
function gridToPage(canvas, gx, gy) {
  const { left, top } = houseBounds();
  const perPixel = canvas.width / canvas.clientWidth / viewScale;
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (ORIGIN_X + gx * TILE - left) / perPixel, y: r.top + (ORIGIN_Y + gy * TILE - top) / perPixel };
}

function screenToGrid(canvas, px, py) {
  const { left, top } = houseBounds();
  const perPixel = canvas.width / canvas.clientWidth / viewScale; // house pixels per CSS pixel
  return { x: (px * perPixel + left - ORIGIN_X) / TILE, y: (py * perPixel + top - ORIGIN_Y) / TILE };
}

// Draws any furniture piece (or rug).
function drawPiece(ctx, f) {
  if (f.kind === "rug") drawRug(ctx, f);
  else if (FURNITURE_DRAWERS[f.kind]) FURNITURE_DRAWERS[f.kind](ctx, f);
}

// While decorating: the piece you're holding, see-through, with its
// footprint outlined in green (fits) or red (doesn't fit there).
function drawHeldPiece(ctx, held) {
  const f = held.f;
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, h = (f.h ?? 0.2) * TILE;
  ctx.save();
  ctx.fillStyle = held.ok ? "rgba(120, 200, 120, 0.25)" : "rgba(220, 90, 80, 0.3)";
  ctx.strokeStyle = held.ok ? "rgba(70, 150, 70, 0.9)" : "rgba(190, 60, 50, 0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  if (f.h === undefined) {
    // Wall pieces: outline the stretch of wall they'd hang on.
    ctx.fillRect(a.x, a.y - WALL_HEIGHT, w, WALL_HEIGHT);
    ctx.strokeRect(a.x, a.y - WALL_HEIGHT, w, WALL_HEIGHT);
  } else {
    ctx.fillRect(a.x, a.y, w, h);
    ctx.strokeRect(a.x, a.y, w, h);
  }
  // Center line guides: the room's middle (faint) and any center the piece
  // is lined up on (bright).
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  for (const g of held.guides ?? []) {
    const top = toScreen(g.x, g.top), bottom = toScreen(g.x, g.bottom);
    ctx.strokeStyle = g.strong ? "rgba(255, 250, 235, 0.9)" : "rgba(255, 250, 235, 0.3)";
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - WALL_HEIGHT);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  drawPiece(ctx, f);
  ctx.restore();
}

// Draws a piece of decor by itself, fitted into a small canvas (for the
// Nest & Nook store). Wall pieces get a little stretch of wall behind them.
function drawDecorPreview(canvas, item, color) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const f = { ...item, x: 0, y: 0, h: item.wall ? undefined : item.h, color: item.ownerColor ? color : item.color };
  if (item.centered) f.x = item.w / 2;
  const a = toScreen(0, 0);
  const w = item.w * TILE, h = item.wall ? 0 : item.h * TILE;
  const tall = item.wall ? WALL_HEIGHT : item.kind === "rug" ? 0 : 70; // room above the footprint for tall things
  const boxW = w + 16, boxH = h + tall + 16;
  const scale = Math.min(2.2, (canvas.width - 8) / boxW, (canvas.height - 8) / boxH);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(a.x + w / 2), -(a.y + (h - tall) / 2));
  if (item.wall) {
    ctx.fillStyle = CONFIG.roomWallColors.bedroom;
    ctx.fillRect(a.x - 8, a.y - WALL_HEIGHT, w + 16, WALL_HEIGHT);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x - 8, a.y - 5, w + 16, 5);
  }
  drawPiece(ctx, f);
  ctx.restore();
}

// It's raining outside: a slightly gloomy tint over the lawn, streaks of
// rain falling, and little ripples where drops land.
function drawOutsideRain(ctx) {
  const t = performance.now() / 1000;
  for (const area of lawnAreas()) {
    const a = toScreen(area.x, area.y), b = toScreen(area.x + area.w, area.y + area.h);
    const w = b.x - a.x, h = b.y - a.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, w, h);
    ctx.clip();
    ctx.fillStyle = "rgba(55, 75, 95, 0.16)";
    ctx.fillRect(a.x, a.y, w, h);
    const seed = Math.round(area.x * 10);
    // Ripples on the ground.
    for (let i = 0; i < Math.max(2, (w * h) / 5000); i++) {
      const cycle = t * 0.9 + noise(seed + i * 5.3);
      const phase = cycle % 1, round = Math.floor(cycle);
      const rx = a.x + noise(seed + i * 3.7 + round * 11.1) * w, ry = a.y + noise(seed + i * 9.1 + round * 7.3) * h;
      ctx.strokeStyle = `rgba(220, 235, 245, ${0.5 * (1 - phase)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 1 + phase * 6, 0.5 + phase * 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Falling rain.
    ctx.strokeStyle = "rgba(215, 230, 245, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = a.x + noise(seed + i * 1.3) * (w + 20);
      const fall = (t * (0.9 + noise(seed + i * 2.9) * 0.5) + noise(seed + i * 4.1)) % 1;
      const y = a.y - 12 + fall * (h + 24);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2.5, y + 9);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Draws the whole house for one frame, scaled to fit the view (see
// setViewScale). `players` is an array of { x, y, color, name, badge },
// including yourself, and `pets` the pets following them (see drawPet).
// Name tags and labels are drawn in the house's own pixels too, so they
// grow and shrink with it.
function drawScene(ctx, players, studySign, pets = [], floor = 0, held = null, me = null) {
  viewFloor = floor;
  players = players.filter((p) => floorOf(p.y) === floor);
  pets = pets.filter((pet) => floorOf(pet.y) === floor);
  ctx.save();
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const { left, top } = houseBounds();
  ctx.translate(-left, -top);

  drawFloors(ctx);
  drawOutsideRain(ctx);
  dropRuneMarks(players);
  drawRuneMarks(ctx);

  // Walls, furniture and players, sorted so lower on screen draws in front.
  const sprites = [...getStaticSprites()];
  for (const p of players) {
    sprites.push({ sortY: p.y + PLAYER_SIZE, draw: (ctx) => drawPlayerBody(ctx, p) });
  }
  for (const pet of pets) sprites.push({ sortY: pet.y, draw: (ctx) => drawPet(ctx, pet) });
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const sprite of sprites) sprite.draw(ctx);

  drawLights(ctx);
  if (held) drawHeldPiece(ctx, held);
  if (studySign) drawStudySign(ctx, studySign); // under name tags, so names stay readable
  for (const p of players) drawPlayerTag(ctx, p);
  for (const pet of pets) drawPetHearts(ctx, pet);
  drawDoorTags(ctx, me); // on top: it's only there because you walked up to a door
  ctx.restore();
}
