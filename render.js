// Isometric grid math and drawing: turning grid positions (from world.js)
// into an isometric-looking scene on the canvas. This is the only file
// that knows about screen pixels; world.js and main.js only ever think in
// grid units.
//
// The look this aims for (see CLAUDE.md's "Isometric rendering" section):
// every solid object gets a top/right/left three-tone shading from one
// consistent light direction, every object casts a soft shadow on the
// floor, walls stand up as real boxes, the floor is a grid of tiles (not
// one flat color), and draw order is sorted so nearer things correctly
// cover farther things.

// --- Isometric projection ---
// Turns a grid position into a screen pixel position. Classic 2:1-ish
// isometric diamond: moving one unit right on the grid moves you right
// and down a bit on screen; moving one unit "down" on the grid moves you
// left and down a bit. Every drawing function below goes through this one
// formula, so nothing can drift out of alignment with anything else.
const TILE_HALF_W = 30; // half a tile's width on screen, in pixels
const TILE_HALF_H = 16; // half a tile's height on screen, in pixels
const ORIGIN_X = 395; // where grid (0,0) lands horizontally on the canvas
const ORIGIN_Y = 90; // where grid (0,0) lands vertically on the canvas

function toScreen(gx, gy) {
  return {
    x: ORIGIN_X + (gx - gy) * TILE_HALF_W,
    y: ORIGIN_Y + (gx + gy) * TILE_HALF_H,
  };
}

const WOOD = "#7a5c3e";
const WOOD_DARK = "#5c4530";
const WALL_HEIGHT = 46; // how tall walls stand, in screen pixels

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

// A warm little lamp glow: a soft halo behind a light source.
function drawGlow(ctx, cx, cy, r, color) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 220, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// --- Floors ---
// One light source for the whole scene, coming from the upper-right, used
// consistently for every tile, box, and character below.

function drawFloors(ctx) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  for (const room of ROOMS) {
    drawRoomFloorTiles(ctx, room);
  }
}

// Draws a room's floor as a grid of individual tiles with a faint
// checkerboard shade and thin edge lines, instead of one flat color, so
// the floor has depth cues even with nothing sitting on it.
function drawRoomFloorTiles(ctx, room) {
  const { x, y, w, h } = room.rect;
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const gx = x + tx, gy = y + ty;
      const a = toScreen(gx, gy);
      const b = toScreen(gx + 1, gy);
      const c = toScreen(gx + 1, gy + 1);
      const d = toScreen(gx, gy + 1);
      const shade = (tx + ty) % 2 === 0 ? 5 : -5;
      ctx.fillStyle = shadeColor(room.color, shade);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// A flat diamond patch of color on top of the floor tiles, for rugs.
function drawDiamondPatch(ctx, rect, color) {
  const a = toScreen(rect.x, rect.y);
  const b = toScreen(rect.x + rect.w, rect.y);
  const c = toScreen(rect.x + rect.w, rect.y + rect.h);
  const d = toScreen(rect.x, rect.y + rect.h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

// --- Solid objects (walls and furniture) ---
// Every solid thing on the grid is drawn the same way: a shadow on the
// floor, then a top face (lightest), a right face (medium), and a left
// face (darkest), all shaded from the same base color. That's what reads
// as "a 3D block" instead of "a flat sticker." Matches the light coming
// from the upper-right, same as the floor tiles and the characters.
function drawIsoBox(ctx, gx, gy, w, d, heightPx, baseColor) {
  const back = toScreen(gx, gy);
  const right = toScreen(gx + w, gy);
  const front = toScreen(gx + w, gy + d);
  const left = toScreen(gx, gy + d);
  const lift = (p) => ({ x: p.x, y: p.y - heightPx });

  // Shadow on the floor, in the same footprint shape as the object.
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.moveTo(back.x, back.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.fill();

  // Top face.
  ctx.fillStyle = shadeColor(baseColor, 25);
  ctx.beginPath();
  ctx.moveTo(lift(back).x, lift(back).y);
  ctx.lineTo(lift(right).x, lift(right).y);
  ctx.lineTo(lift(front).x, lift(front).y);
  ctx.lineTo(lift(left).x, lift(left).y);
  ctx.closePath();
  ctx.fill();

  // Right-facing side (medium shade).
  ctx.fillStyle = shadeColor(baseColor, -15);
  ctx.beginPath();
  ctx.moveTo(right.x, right.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(lift(front).x, lift(front).y);
  ctx.lineTo(lift(right).x, lift(right).y);
  ctx.closePath();
  ctx.fill();

  // Left-facing side (darkest).
  ctx.fillStyle = shadeColor(baseColor, -35);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(lift(front).x, lift(front).y);
  ctx.lineTo(lift(left).x, lift(left).y);
  ctx.closePath();
  ctx.fill();
}

// A wall segment's "depth": the sum of its front-most grid corner
// (x+w, y+h). Sorting by this puts things closer to the camera (further
// down and right on the grid) later in the draw order, so they correctly
// cover things further back. Furniture and players use the same rule
// (their own front corner) so everything sorts on one consistent scale.
function frontCornerDepth(gx, gy, w, d) {
  return gx + w + gy + d;
}

function buildWallSprites() {
  return WALLS.map((wall) => ({
    depth: frontCornerDepth(wall.x, wall.y, wall.w, wall.h),
    draw: (ctx) => drawIsoBox(ctx, wall.x, wall.y, wall.w, wall.h, WALL_HEIGHT, WOOD),
  }));
}

// Builds the furniture sprites for one room. Each entry is a small box
// (drawn with drawIsoBox, so it automatically gets the shadow and
// three-tone shading) plus, sometimes, a decorative extra like a glow or
// a screen, anchored to the same depth as the box it sits on.
function buildFurnitureSprites(room) {
  const { x, y, w } = room.rect;
  const sprites = [];
  const add = (gx, gy, bw, bd, heightPx, color, extra) => {
    sprites.push({
      depth: frontCornerDepth(gx, gy, bw, bd),
      draw: (ctx) => {
        drawIsoBox(ctx, gx, gy, bw, bd, heightPx, color);
        extra?.(ctx);
      },
    });
  };

  if (room.id === "gaming") {
    // A rug under the couch, drawn flat with the floor.
    sprites.push({ depth: x + y - 5, draw: (ctx) => drawDiamondPatch(ctx, { x: x + 0.4, y: y + 0.8, w: 4, h: 1.2 }, "rgba(0,0,0,0.06)") });
    // Couch along the back-left wall.
    add(x + 0.6, y + 1, 3.6, 0.8, 26, "#4a5568");
    // Small side table with a lamp.
    add(x + 4.6, y + 1, 0.7, 0.7, 16, WOOD, (ctx) => {
      const p = toScreen(x + 4.95, y + 1.35);
      drawGlow(ctx, p.x, p.y - 40, 24, "rgba(255, 210, 130, 0.5)");
    });
    // TV on a low stand against the back wall, with a soft screen glow.
    add(x + 1.8, y + 5.6, 2.2, 0.5, 30, "#222", (ctx) => {
      const p1 = toScreen(x + 1.95, y + 5.65);
      const p2 = toScreen(x + 3.85, y + 6.05);
      drawGlow(ctx, p1.x + 30, p1.y - 44, 40, "rgba(111, 211, 255, 0.28)");
      const grad = ctx.createLinearGradient(p1.x, p1.y - 40, p2.x, p2.y - 14);
      grad.addColorStop(0, "#8fe3ff");
      grad.addColorStop(1, "#4fb8e8");
      ctx.fillStyle = grad;
      ctx.fillRect(p1.x - 6, p1.y - 42, 60, 26);
    });
  }

  if (room.id === "study") {
    // Bookshelf against the back wall.
    add(x + 0.6, y + 0.8, 1.4, 0.6, 34, WOOD, (ctx) => {
      const p = toScreen(x + 0.75, y + 0.85);
      const bookColors = ["#c0554a", "#4a90a4", "#e0a84c", "#7a9e5c"];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = bookColors[i];
        ctx.fillRect(p.x - 8 + i * 8, p.y - 30, 6, 22);
      }
    });
    // Desk with a lamp glow, against the side wall.
    add(x + 4.2, y + 5.6, 1.3, 0.7, 20, WOOD, (ctx) => {
      const p = toScreen(x + 4.85, y + 5.65);
      drawGlow(ctx, p.x, p.y - 36, 22, "rgba(255, 220, 130, 0.6)");
    });
    // A little potted plant in the corner.
    add(x + 0.5, y + 6.6, 0.7, 0.7, 14, WOOD, (ctx) => {
      const p = toScreen(x + 0.85, y + 6.95);
      ctx.fillStyle = "#6fa05e";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 28, 10, 0, Math.PI * 2);
      ctx.arc(p.x - 7, p.y - 22, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (room.id === "dinner") {
    const tx = x + 3, ty = y + 4;
    // Hanging cord and lamp shade, plus a warm pool of light on the table.
    sprites.push({
      depth: tx + ty - 3,
      draw: (ctx) => {
        const topAnchor = toScreen(tx, y + 0.2);
        const lampAnchor = toScreen(tx, ty);
        ctx.strokeStyle = WOOD_DARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topAnchor.x, topAnchor.y - WALL_HEIGHT);
        ctx.lineTo(lampAnchor.x, lampAnchor.y - 60);
        ctx.stroke();
        drawGlow(ctx, lampAnchor.x, lampAnchor.y - 20, 55, "rgba(255, 200, 120, 0.35)");
        ctx.fillStyle = "#c0554a";
        ctx.beginPath();
        ctx.moveTo(lampAnchor.x - 14, lampAnchor.y - 60);
        ctx.lineTo(lampAnchor.x + 14, lampAnchor.y - 60);
        ctx.lineTo(lampAnchor.x + 9, lampAnchor.y - 48);
        ctx.lineTo(lampAnchor.x - 9, lampAnchor.y - 48);
        ctx.closePath();
        ctx.fill();
      },
    });
    // Chairs around the table.
    const chairSpots = [[tx - 1.6, ty], [tx + 1.6, ty], [tx, ty - 1.6], [tx, ty + 1.6]];
    for (const [cgx, cgy] of chairSpots) {
      add(cgx - 0.35, cgy - 0.35, 0.7, 0.7, 16, "#a3785a");
    }
    // The table itself, with a fruit bowl on top.
    add(tx - 1.1, ty - 0.8, 2.2, 1.6, 20, "#8b6b4a", (ctx) => {
      const p = toScreen(tx, ty);
      ctx.fillStyle = "#e8dcc8";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 24, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const fruitColors = ["#c0554a", "#e0a84c", "#7a9e5c"];
      const fruitOffsets = [[-6, -2], [5, -3], [0, 3]];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = fruitColors[i];
        ctx.beginPath();
        ctx.arc(p.x + fruitOffsets[i][0], p.y - 24 + fruitOffsets[i][1], 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  if (room.id === "hallway") {
    // A rug in the middle of the hallway, drawn flat with the floor.
    sprites.push({ depth: x + y - 5, draw: (ctx) => drawDiamondPatch(ctx, { x: x + w / 2 - 3, y: y + 0.6, w: 6, h: 1.4 }, "#c98a6b") });
    // A little plant in one corner.
    add(x + w - 1.2, y + 1.6, 0.6, 0.6, 16, WOOD, (ctx) => {
      const p = toScreen(x + w - 0.9, y + 1.9);
      ctx.fillStyle = "#4f7a48";
      ctx.beginPath();
      ctx.arc(p.x - 4, p.y - 30, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5c8a54";
      ctx.beginPath();
      ctx.arc(p.x + 6, p.y - 26, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6fa05e";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 18, 10, 0, Math.PI * 2);
      ctx.fill();
    });
    // A small wall mirror, near the other corner.
    add(x + 1, y + 0.3, 0.15, 0.9, 30, WOOD_DARK, (ctx) => {
      const p = toScreen(x + 1.08, y + 0.3);
      roundRectPath(ctx, p.x - 12, p.y - 60, 24, 34, 5);
      ctx.fillStyle = "#dfeaf2";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      roundRectPath(ctx, p.x - 9, p.y - 57, 7, 24, 3);
      ctx.fill();
    });
  }

  return sprites;
}

// Static parts of the scene never move, so we only need to build their
// sprite list once instead of every frame.
const SCENE_SPRITES = [
  ...buildWallSprites(),
  ...ROOMS.flatMap((room) => buildFurnitureSprites(room)),
];

// Draws every room's name as a small pill, near that room's back corner.
// Called last, so labels always stay readable on top of everything else.
function drawRoomLabels(ctx) {
  ctx.font = "600 14px 'Quicksand', sans-serif";
  for (const room of ROOMS) {
    const p = toScreen(room.rect.x + 0.3, room.rect.y + 0.3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    roundRectPath(ctx, p.x - 6, p.y - 4, ctx.measureText(room.name).width + 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, p.x + 4, p.y + 12);
  }
}

// --- Characters ---
const PLAYER_DRAW_RADIUS = 14; // screen pixels
const PLAYER_LIFT = 16; // how far above their floor spot a character's body is drawn

// Draws one player (used for both yourself and everyone else): a soft
// shadow on the floor, then a round body shaded from the same
// upper-right light direction as every wall and piece of furniture (a
// gradient instead of flat faces, since a round character doesn't have
// flat sides), plus their name and, optionally, a badge like "eating".
function drawPlayer(ctx, gx, gy, color, name, badge) {
  const foot = toScreen(gx + PLAYER_SIZE / 2, gy + PLAYER_SIZE / 2);
  const cx = foot.x;
  const cy = foot.y - PLAYER_LIFT;
  const r = PLAYER_DRAW_RADIUS;

  // Shadow underfoot.
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body, lit from the upper-right like everything else in the scene.
  const bodyGradient = ctx.createRadialGradient(cx + r * 0.35, cy - r * 0.45, r * 0.2, cx, cy, r);
  bodyGradient.addColorStop(0, shadeColor(color, 35));
  bodyGradient.addColorStop(1, shadeColor(color, -25));
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -50);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Face: two eyes and a little smile.
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Name tag, as a soft pill behind the text so it stays readable over
  // any floor color.
  ctx.font = "600 12px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  const tagWidth = ctx.measureText(name).width + 14;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  roundRectPath(ctx, cx - tagWidth / 2, cy - r - 22, tagWidth, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillText(name, cx, cy - r - 10);

  if (badge) {
    ctx.font = "13px sans-serif";
    const badgeWidth = ctx.measureText(badge).width + 16;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    roundRectPath(ctx, cx - badgeWidth / 2, cy - r - 42, badgeWidth, 17, 8);
    ctx.fill();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1;
    roundRectPath(ctx, cx - badgeWidth / 2, cy - r - 42, badgeWidth, 17, 8);
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(badge, cx, cy - r - 30);
  }

  ctx.textAlign = "left";
}

// Draws the whole house for one frame: floors, then every wall, piece of
// furniture, and player sorted so nearer things correctly cover farther
// things, then room name labels on top. `players` is an array of
// { x, y, color, name, badge }, including yourself.
function drawScene(ctx, players) {
  drawFloors(ctx);

  const sprites = [...SCENE_SPRITES];
  for (const p of players) {
    sprites.push({
      depth: frontCornerDepth(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE),
      draw: (ctx) => drawPlayer(ctx, p.x, p.y, p.color, p.name, p.badge),
    });
  }
  sprites.sort((a, b) => a.depth - b.depth);
  for (const sprite of sprites) sprite.draw(ctx);

  drawRoomLabels(ctx);
}
