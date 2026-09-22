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
  for (const room of ROOMS) {
    const floor = CONFIG.roomFloors[room.id] || CONFIG.roomFloors.office;
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
  const left = toScreen(hallwayWestX - 1, 0).x;
  const right = toScreen(19, 0).x;
  return { left, right };
}

let floorCanvas = null;
let floorVersion = -1;

function drawFloors(ctx) {
  // Repaint only when the house has changed (an office was added, removed
  // or locked), not every frame.
  if (floorVersion !== houseVersion) {
    const { left, right } = houseBounds();
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = right - left;
    floorCanvas.height = CONFIG.canvasHeight;
    const fctx = floorCanvas.getContext("2d");
    fctx.translate(-left, 0);
    paintFloors(fctx);
    floorVersion = houseVersion;
  }
  ctx.drawImage(floorCanvas, houseBounds().left, 0);
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
  ctx.fillStyle = hasFace ? CONFIG.roomWallColors[facing.id] || CONFIG.roomWallColors.office : WOOD_DARK;
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

  // A low wooden sideboard with the good plates stacked up and a teapot.
  sideboard(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 30, WOOD);
    const { x, y, w } = s.face;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, w / 2 - 7, 20);
    ctx.strokeRect(x + w / 2 + 2.5, y + 4.5, w / 2 - 7, 20);
    drawKnob(ctx, x + w / 2 - 6, y + 15);
    drawKnob(ctx, x + w / 2 + 6, y + 15);
    const top = s.top;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#e8dcc8" : "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(top.x + 20, top.y + top.h / 2 - i * 2.5, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#4a90a4"; // teapot
    ctx.beginPath();
    ctx.ellipse(top.x + top.w - 24, top.y + top.h / 2 - 5, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(top.x + top.w - 26, top.y + top.h / 2 - 14, 4, 3);
    ctx.strokeStyle = "#4a90a4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(top.x + top.w - 15, top.y + top.h / 2 - 5);
    ctx.lineTo(top.x + top.w - 9, top.y + top.h / 2 - 10);
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

  chair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x, f.y, f.w, 0.15, 30, "#8a6448"); // backrest
    drawBlock(ctx, f.x, f.y + 0.15, f.w, f.h - 0.15, 16, "#a3785a"); // seat
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
  // Study and Dinner get a soft golden wash, like rooms lit by lamps at
  // night: warm in the middle, a little dimmer at the edges.
  for (const id of ["study", "dinner"]) {
    const rect = ROOMS.find((r) => r.id === id).rect;
    const s1 = toScreen(rect.x, rect.y - 1), s2 = toScreen(rect.x + rect.w, rect.y + rect.h);
    const cx = (s1.x + s2.x) / 2, cy = (s1.y + s2.y) / 2;
    const wash = ctx.createRadialGradient(cx, cy, 20, cx, cy, 260);
    wash.addColorStop(0, "rgba(255, 190, 100, 0.12)");
    wash.addColorStop(1, "rgba(60, 30, 10, 0.12)");
    ctx.fillStyle = wash;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  for (const f of FURNITURE) {
    if (f.kind === "pcDesk") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x - 6, p.y - 30, 40, f.screen + "66");
    } else if (f.kind === "studyTable") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 44, 40, "rgba(255, 215, 130, 0.5)");
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
// drawn over them.
let staticSprites = [];
let spritesVersion = -1;

function getStaticSprites() {
  if (spritesVersion !== houseVersion) {
    staticSprites = [
      ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
      ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
        sortY: f.h === undefined ? f.y + 0.001 : f.solid === false ? f.y : f.y + f.h,
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
  ctx.textAlign = "left";
}

// Room names as small pills: the hallway's near its top-left corner (just
// right of the office door and its mat), the other rooms' along their
// bottom edge, clear of furniture.
function drawRoomLabels(ctx) {
  ctx.font = "600 14px 'Quicksand', sans-serif";
  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    const textW = ctx.measureText(room.name).width;
    const p = room.id === "hallway" ? toScreen(x + 1.5, y + 0.25) : toScreen(x + w / 2, y + h - 0.6);
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

// The camera: how far the view is scrolled sideways, in pixels. When the
// whole house fits on screen it stays centered; once offices make it
// wider, it follows `focus` (your own character), stopping at the ends.
function cameraX(focus) {
  const { left, right } = houseBounds();
  const view = CONFIG.canvasWidth;
  if (right - left <= view) return (left + right) / 2 - view / 2;
  const target = toScreen(focus.x + PLAYER_SIZE / 2, 0).x - view / 2;
  return Math.max(left, Math.min(right - view, target));
}

// Draws the whole house for one frame. `players` is an array of
// { x, y, color, name, badge }, including yourself; `focus` is who the
// camera follows.
function drawScene(ctx, players, focus, studySign) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.save();
  ctx.translate(-Math.round(cameraX(focus)), 0);

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
