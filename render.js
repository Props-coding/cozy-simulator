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

const FLOOR_STYLES = { planks: drawPlanks, carpet: drawCarpet, checker: drawChecker };

function paintFloors(ctx) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  for (const room of ROOMS) {
    const floor = CONFIG.roomFloors[room.id];
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

let floorCanvas = null;

function drawFloors(ctx) {
  if (!floorCanvas) {
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = CONFIG.canvasWidth;
    floorCanvas.height = CONFIG.canvasHeight;
    paintFloors(floorCanvas.getContext("2d"));
  }
  ctx.drawImage(floorCanvas, 0, 0);
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
  ctx.fillStyle = hasFace ? CONFIG.roomWallColors[facing.id] : WOOD_DARK;
  ctx.fillRect(a.x, b.y - height, b.x - a.x, height);
  // Baseboard.
  if (hasFace) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - 5, b.x - a.x, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // a thin trim line near the top
    ctx.fillRect(a.x, b.y - height + 3, b.x - a.x, 2);
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
    // Fruit bowl in the middle of the tabletop.
    const cx = t.top.x + t.top.w / 2, cy = t.top.y + t.top.h / 2;
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

  chair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x, f.y, f.w, 0.15, 30, "#8a6448"); // backrest
    drawBlock(ctx, f.x, f.y + 0.15, f.w, f.h - 0.15, 16, "#a3785a"); // seat
  },

  // Hung on a wall face: a window with curtains.
  window(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + 6, w = f.w * TILE, h = 24;
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

  // Hung on a wall face: a small round-cornered mirror.
  mirror(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + 5, w = f.w * TILE, h = 26;
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
  // The Study gets a soft golden wash, like a room lit by lamps at night.
  const study = ROOMS.find((r) => r.id === "study").rect;
  const s1 = toScreen(study.x, study.y - 1), s2 = toScreen(study.x + study.w, study.y + study.h);
  const cx = (s1.x + s2.x) / 2, cy = (s1.y + s2.y) / 2;
  const wash = ctx.createRadialGradient(cx, cy, 20, cx, cy, 260);
  wash.addColorStop(0, "rgba(255, 190, 100, 0.12)");
  wash.addColorStop(1, "rgba(60, 30, 10, 0.12)");
  ctx.fillStyle = wash;
  ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);

  for (const f of FURNITURE) {
    if (f.kind === "pcDesk") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x - 6, p.y - 30, 40, f.screen + "66");
    } else if (f.kind === "studyTable") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 44, 40, "rgba(255, 215, 130, 0.5)");
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
// drawn over them.
const STATIC_SPRITES = [
  ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
  ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
    sortY: f.h === undefined ? f.y + 0.001 : f.solid === false ? f.y : f.y + f.h,
    draw: (ctx) => FURNITURE_DRAWERS[f.kind](ctx, f),
  })),
];

// --- Characters ---
const PLAYER_RADIUS = 14; // screen pixels

// Where a player's feet touch the floor, in screen pixels.
function playerFeet(p) {
  return toScreen(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE);
}

// Draws one player's body (used for yourself and everyone else): a soft
// shadow at their feet, then a round body standing on it, lit from above
// (lighter on top, darker underneath) like everything else.
function drawPlayerBody(ctx, p) {
  const foot = playerFeet(p);
  const r = PLAYER_RADIUS;
  const cx = foot.x;
  const cy = foot.y - r - 3;

  ctx.fillStyle = "rgba(40, 25, 10, 0.25)";
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

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

  // Face: two eyes and a little smile.
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// Name tag and optional badge (like "eating"). Drawn in a last pass so
// they stay readable even when the player is behind furniture or a wall.
function drawPlayerTag(ctx, p) {
  const foot = playerFeet(p);
  const cx = foot.x;
  const headTop = foot.y - PLAYER_RADIUS * 2 - 3;

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
  ctx.textAlign = "left";
}

// Room names as small pills: the hallway's in its top-left corner, the
// other rooms' along their bottom edge, clear of furniture.
function drawRoomLabels(ctx) {
  ctx.font = "600 14px 'Quicksand', sans-serif";
  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    const textW = ctx.measureText(room.name).width;
    const p = room.id === "hallway" ? toScreen(x + 0.3, y + 0.25) : toScreen(x + w / 2, y + h - 0.6);
    const left = room.id === "hallway" ? p.x : p.x - textW / 2 - 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    roundRectPath(ctx, left, p.y, textW + 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, left + 10, p.y + 16);
  }
}

// Draws the whole house for one frame. `players` is an array of
// { x, y, color, name, badge }, including yourself.
function drawScene(ctx, players) {
  drawFloors(ctx);

  // Walls, furniture and players, sorted so lower on screen draws in front.
  const sprites = [...STATIC_SPRITES];
  for (const p of players) {
    sprites.push({ sortY: p.y + PLAYER_SIZE, draw: (ctx) => drawPlayerBody(ctx, p) });
  }
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const sprite of sprites) sprite.draw(ctx);

  drawLights(ctx);
  for (const p of players) drawPlayerTag(ctx, p);
  drawRoomLabels(ctx);
}
