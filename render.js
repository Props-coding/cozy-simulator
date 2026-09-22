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

function drawFloors(ctx) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const p = toScreen(x + tx, y + ty);
        // A faint checkerboard plus a thin edge line on each tile.
        ctx.fillStyle = shadeColor(room.color, (tx + ty) % 2 === 0 ? 4 : -4);
        ctx.fillRect(p.x, p.y, TILE, TILE);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  // Rugs lie flat on the floor, so they're part of the floor pass.
  for (const f of FURNITURE) {
    if (f.kind !== "rug") continue;
    const a = toScreen(f.x, f.y);
    const color = f.y < 3 ? "#c98a6b" : "#8a9bb5";
    roundRectPath(ctx, a.x, a.y, f.w * TILE, f.h * TILE, 10);
    ctx.fillStyle = color;
    ctx.fill();
    roundRectPath(ctx, a.x + 5, a.y + 5, f.w * TILE - 10, f.h * TILE - 10, 7);
    ctx.strokeStyle = shadeColor(color, 30);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// --- Walls ---
// Simple panels: a wood top edge, a lighter plaster front face, and a
// dark baseboard line where the wall meets the floor. Walls running up and
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
  ctx.fillStyle = hasFace ? "#e9d8bd" : WOOD_DARK;
  ctx.fillRect(a.x, b.y - height, b.x - a.x, height);
  // Baseboard.
  if (hasFace) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - 5, b.x - a.x, 5);
  }
}

// --- Furniture ---
// One function per kind. Each gets the furniture entry from world.js,
// draws its own shadow first, then its upright shape.
const FURNITURE_DRAWERS = {
  plant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const pot = drawBlock(ctx, f.x + 0.1, f.y, f.w - 0.2, f.h, 16, "#b86b4b");
    const cx = pot.top.x + pot.top.w / 2;
    const cy = pot.top.y;
    const leaves = [[-7, -8, 10, "#4f7a48"], [7, -10, 9, "#5c8a54"], [0, -18, 10, "#6fa05e"], [0, -4, 8, "#6fa05e"]];
    for (const [dx, dy, r, color] of leaves) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  tv(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stand = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, WOOD);
    // Screen sitting on the stand.
    const sx = stand.top.x + 6, sw = stand.top.w - 12, sh = 30;
    const sy = stand.top.y + stand.top.h / 2 - sh;
    ctx.fillStyle = "#26262c";
    roundRectPath(ctx, sx, sy, sw, sh, 3);
    ctx.fill();
    const grad = ctx.createLinearGradient(0, sy, 0, sy + sh);
    grad.addColorStop(0, "#8fe3ff");
    grad.addColorStop(1, "#4fb8e8");
    ctx.fillStyle = grad;
    ctx.fillRect(sx + 3, sy + 3, sw - 6, sh - 6);
  },

  couch(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const color = "#4a5568";
    drawBlock(ctx, f.x, f.y, f.w, 0.3, 36, "#404b5e"); // backrest
    const seat = drawBlock(ctx, f.x, f.y + 0.3, f.w, f.h - 0.3, 20, color);
    // Cushion seams on the seat.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.lineWidth = 1.5;
    for (const t of [1 / 3, 2 / 3]) {
      ctx.beginPath();
      ctx.moveTo(seat.top.x + seat.top.w * t, seat.top.y + 2);
      ctx.lineTo(seat.top.x + seat.top.w * t, seat.top.y + seat.top.h - 2);
      ctx.stroke();
    }
    // Arms on each end.
    drawBlock(ctx, f.x, f.y, 0.3, f.h, 28, "#3f495a");
    drawBlock(ctx, f.x + f.w - 0.3, f.y, 0.3, f.h, 28, "#3f495a");
  },

  sideTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, WOOD);
    drawLamp(ctx, t.top.x + t.top.w / 2, t.top.y + t.top.h / 2);
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

  desk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 26, WOOD);
    // An open book and a lamp on the desk.
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(d.top.x + 10, d.top.y + 8, 22, 14);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.moveTo(d.top.x + 21, d.top.y + 8);
    ctx.lineTo(d.top.x + 21, d.top.y + 22);
    ctx.stroke();
    drawLamp(ctx, d.top.x + d.top.w - 16, d.top.y + d.top.h / 2);
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
  for (const f of FURNITURE) {
    if (f.kind === "tv") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 30, 44, "rgba(111, 211, 255, 0.25)");
    } else if (f.kind === "sideTable") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 40, 28, "rgba(255, 210, 130, 0.5)");
    } else if (f.kind === "desk") {
      const p = toScreen(f.x + f.w, f.y + f.h / 2);
      drawGlow(ctx, p.x - 16, p.y - 44, 26, "rgba(255, 220, 130, 0.55)");
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
// front. Wall hangings sort just after the wall they hang on.
const STATIC_SPRITES = [
  ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
  ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
    sortY: f.h === undefined ? f.y + 0.001 : f.y + f.h,
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
