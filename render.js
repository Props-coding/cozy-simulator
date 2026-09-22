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
  return `rgb(${r}, ${g}, ${b})`;
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

const FLOOR_STYLES = { planks: drawPlanks, carpet: drawCarpet, checker: drawChecker, concrete: drawConcrete };

// The look of each secret office theme: floor, wall color, a pattern on
// the walls, and a tint over the whole room (warm or cold).
const OFFICE_THEME_STYLE = {
  lakehouse: { floor: { style: "planks", color: "#a8744c" }, wall: "#9c6b43", wallPattern: "logs", tint: "rgba(255, 160, 80, 0.10)" },
  stalker: { floor: { style: "concrete", color: "#8e908b" }, wall: "#8a8d88", wallPattern: "concrete", tint: "rgba(30, 60, 50, 0.16)" },
  scholar: { floor: { style: "planks", color: "#7a4a32" }, wall: "#eadcc0", wallPattern: "lacquer", tint: "rgba(255, 190, 120, 0.08)" },
};

function paintFloors(ctx) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(-2000, -2000, 6000, 6000);
  for (const room of ROOMS) {
    const floor = room.theme ? OFFICE_THEME_STYLE[room.theme].floor : CONFIG.roomFloors[room.id] || CONFIG.roomFloors.office;
    const a = toScreen(room.rect.x, room.rect.y);
    const box = { x: a.x, y: a.y, w: room.rect.w * TILE, h: room.rect.h * TILE };
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
    if (f.kind !== "rug") continue;
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, h = f.h * TILE;
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
}

// The house's full width in screen pixels, from the far west end of the
// hallway to the east wall, with a little margin. Used for the saved floor
// picture and for how far the camera can scroll.
function houseBounds() {
  return {
    left: toScreen(-1, 0).x,
    right: toScreen(19, 0).x,
    top: toScreen(0, houseTopY - 0.6).y - WALL_HEIGHT,
    bottom: toScreen(0, 12).y,
  };
}

let floorCanvas = null;
let floorVersion = -1;

function drawFloors(ctx) {
  // Repaint only when the house has changed (an office was added, removed
  // or locked), not every frame.
  if (floorVersion !== houseVersion) {
    const { left, right, top, bottom } = houseBounds();
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = right - left;
    floorCanvas.height = bottom - top;
    const fctx = floorCanvas.getContext("2d");
    fctx.translate(-left, -top);
    paintFloors(fctx);
    floorVersion = houseVersion;
  }
  const { left, top } = houseBounds();
  ctx.drawImage(floorCanvas, left, top);
}

// --- Walls ---
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
  // Front face.
  const hasFace = !wall.low && wall.w > wall.h;
  // The face belongs to whichever room it faces: the one just below it.
  const facing = getCurrentRoom({ x: wall.x + wall.w / 2 - PLAYER_SIZE / 2, y: wall.y + wall.h });
  const themeStyle = OFFICE_THEME_STYLE[facing.theme];
  ctx.fillStyle = hasFace ? themeStyle?.wall || CONFIG.roomWallColors[facing.id] || CONFIG.roomWallColors.office : WOOD_DARK;
  ctx.fillRect(a.x, b.y - height, b.x - a.x, height);
  // Baseboard.
  if (hasFace) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - 5, b.x - a.x, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // a thin trim line near the top
    ctx.fillRect(a.x, b.y - height + 3, b.x - a.x, 2);
    if (themeStyle) drawWallPattern(ctx, themeStyle.wallPattern, a.x, b.y - height, b.x - a.x, height);
    // Hallway walls get wood paneling on the bottom part, with a rail on top.
    if (facing.id === "hallway") {
      const panelTop = b.y - 18;
      ctx.fillStyle = "#b08a60";
      ctx.fillRect(a.x, panelTop, b.x - a.x, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      for (let px = a.x + 12; px < b.x; px += 24) ctx.fillRect(px, panelTop + 3, 1, 9);
      ctx.fillStyle = WOOD;
      ctx.fillRect(a.x, panelTop - 2, b.x - a.x, 3);
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
  } else if (pattern === "lacquer") {
    ctx.fillStyle = "#9a2f24";
    ctx.fillRect(x, y + 5, w, 4);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y + 9, w, 1);
  }
}

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
    const back = "#8a6448", seat = "#a3785a", t = 0.15;
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
  for (const id of ["study", "dinner", "hallway"]) {
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

  // Secret themed offices get their own warm or cold tint.
  for (const room of ROOMS) {
    if (!room.theme) continue;
    const s1 = toScreen(room.rect.x, room.rect.y - 1), s2 = toScreen(room.rect.x + room.rect.w, room.rect.y + room.rect.h);
    ctx.fillStyle = OFFICE_THEME_STYLE[room.theme].tint;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  const now = performance.now() / 1000;
  for (const f of FURNITURE) {
    if (f.kind === "bigScreen") {
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
let staticSprites = [];
let spritesVersion = -1;

function getStaticSprites() {
  if (spritesVersion !== houseVersion) {
    staticSprites = [
      ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
      ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
        sortY: f.h === undefined ? f.y + 0.001 : f.kind === "theaterSeat" ? f.y + f.h + 0.05 : f.solid === false ? f.y : f.y + f.h,
        draw: (ctx) => FURNITURE_DRAWERS[f.kind](ctx, f),
      })),
    ];
    spritesVersion = houseVersion;
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

// Draws one player's body (used for yourself and everyone else): a soft
// shadow, two little feet, and a round body lit from above (lighter on
// top, darker underneath) like everything else, with their hat on top.
// While walking (p.moving), the body bobs and the feet take turns lifting.
function drawPlayerBody(ctx, p) {
  const foot = playerFeet(p);
  const r = PLAYER_RADIUS;
  const step = p.moving ? Math.sin(performance.now() / 1000 * 12) : 0;
  const bob = Math.abs(step) * 2.5;
  const cx = foot.x;
  const cy = foot.y - r - 5 - bob;

  ctx.fillStyle = "rgba(40, 25, 10, 0.25)";
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, r * 0.85 - bob * 0.6, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet, peeking out under the body.
  ctx.fillStyle = shadeColor(p.color, -70);
  for (const [side, lift] of [[-1, Math.max(0, step) * 3], [1, Math.max(0, -step) * 3]]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 5.5, foot.y - 2.5 - lift, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
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

  // Face: two eyes, rosy cheeks and a little smile.
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(240, 120, 120, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  (HAT_DRAWERS[p.hat] || HAT_DRAWERS.none)(ctx, cx, cy, r);
}

// Draws a character by itself, centered in a small canvas, for the
// preview on the Join screen.
function drawCharacterPreview(canvas, color, hat) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const p = { x: 0, y: 0, color, hat, moving: false };
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
function drawPlayerTag(ctx, p) {
  const foot = playerFeet(p);
  const cx = foot.x;
  const headTop = foot.y - PLAYER_RADIUS * 2 - 10; // a little room above for hats

  ctx.font = "600 12px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  const tagWidth = ctx.measureText(p.name).width + 14;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  roundRectPath(ctx, cx - tagWidth / 2, headTop - 20, tagWidth, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillText(p.name, cx, headTop - 8);

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

// Room names as small pills: the hallway's near its top-left corner (just
// right of the office door and the coat hooks), the other rooms' along their
// bottom edge, clear of furniture.
function drawRoomLabels(ctx) {
  ctx.font = "600 14px 'Quicksand', sans-serif";
  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    const textW = ctx.measureText(room.name).width;
    const p = room.id === "hallway" ? toScreen(x + 2.9, y + 0.3) : toScreen(x + w / 2, y + h - 0.6);
    const left = room.id === "hallway" ? p.x : p.x - textW / 2 - 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    roundRectPath(ctx, left, p.y, textW + 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, left + 10, p.y + 16);
  }
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

// The camera: how far the view is scrolled, in pixels. In each direction,
// when the whole house fits on screen it stays centered; once offices
// make it bigger, it follows `focus` (your own character), stopping at
// the edges.
function camera(focus) {
  const { left, right, top, bottom } = houseBounds();
  const center = toScreen(focus.x + PLAYER_SIZE / 2, focus.y + PLAYER_SIZE / 2);
  // Along one direction: centered if the house fits, else follow `at`.
  const follow = (lo, hi, view, at) => (hi - lo <= view ? (lo + hi) / 2 - view / 2 : Math.max(lo, Math.min(hi - view, at - view / 2)));
  return {
    x: follow(left, right, CONFIG.canvasWidth, center.x),
    y: follow(top, bottom, CONFIG.canvasHeight, center.y),
  };
}

// Draws the whole house for one frame. `players` is an array of
// { x, y, color, name, badge }, including yourself; `focus` is who the
// camera follows.
function drawScene(ctx, players, focus, studySign) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.save();
  const cam = camera(focus);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  drawFloors(ctx);

  // Walls, furniture and players, sorted so lower on screen draws in front.
  const sprites = [...getStaticSprites()];
  for (const p of players) {
    sprites.push({ sortY: p.y + PLAYER_SIZE, draw: (ctx) => drawPlayerBody(ctx, p) });
  }
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const sprite of sprites) sprite.draw(ctx);

  drawLights(ctx);
  if (studySign) drawStudySign(ctx, studySign); // under name tags, so names stay readable
  for (const p of players) drawPlayerTag(ctx, p);
  drawRoomLabels(ctx);
  ctx.restore();
}
