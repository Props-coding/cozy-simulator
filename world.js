// The house layout: rooms, walls, and movement/collision logic.
// Layout: a hallway band across the top, with Gaming, Study, and Dinner
// in a row underneath. Each room has one doorway gap up into the hallway.

const WALL_THICKNESS = 20;

// Open floor areas, used to figure out which room the player is standing in.
// Order matters: checked top to bottom, first match wins.
const ROOMS = [
  { id: "gaming", name: CONFIG.roomNames.gaming, rect: { x: 20, y: 155, w: 230, h: 425 }, color: CONFIG.roomColors.gaming },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 275, y: 155, w: 250, h: 425 }, color: CONFIG.roomColors.study },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 550, y: 155, w: 230, h: 425 }, color: CONFIG.roomColors.dinner },
  { id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 20, y: 20, w: 760, h: 135 }, color: CONFIG.roomColors.hallway },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway).
const WALLS = [
  // Outer walls
  { x: 0, y: 0, w: CONFIG.canvasWidth, h: WALL_THICKNESS }, // top
  { x: 0, y: CONFIG.canvasHeight - WALL_THICKNESS, w: CONFIG.canvasWidth, h: WALL_THICKNESS }, // bottom
  { x: 0, y: 0, w: WALL_THICKNESS, h: CONFIG.canvasHeight }, // left
  { x: CONFIG.canvasWidth - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: CONFIG.canvasHeight }, // right

  // Dividers between rooms (no doors between rooms directly)
  { x: 250, y: 150, w: 25, h: 450 },
  { x: 525, y: 150, w: 25, h: 450 },

  // Wall above Gaming, with a doorway gap in the middle
  { x: 20, y: 140, w: 60, h: 20 },
  { x: 170, y: 140, w: 80, h: 20 },

  // Wall above Study, with a doorway gap in the middle
  { x: 275, y: 140, w: 80, h: 20 },
  { x: 445, y: 140, w: 80, h: 20 },

  // Wall above Dinner, with a doorway gap in the middle
  { x: 550, y: 140, w: 80, h: 20 },
  { x: 720, y: 140, w: 60, h: 20 },
];

const PLAYER_SIZE = 24;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves a player by (dx, dy), sliding along walls instead of passing
// through them. Checks x and y separately so bumping into a wall on one
// axis doesn't stop movement on the other.
function movePlayer(player, dx, dy) {
  const box = () => ({ x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE });

  player.x += dx;
  if (WALLS.some((w) => rectsOverlap(box(), w))) {
    player.x -= dx;
  }

  player.y += dy;
  if (WALLS.some((w) => rectsOverlap(box(), w))) {
    player.y -= dy;
  }
}

// Returns the room the player's center point is currently inside.
function getCurrentRoom(player) {
  const cx = player.x + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;
  const room = ROOMS.find((r) => cx >= r.rect.x && cx <= r.rect.x + r.rect.w && cy >= r.rect.y && cy <= r.rect.y + r.rect.h);
  return room || ROOMS.find((r) => r.id === "hallway");
}

const WOOD = "#7a5c3e";
const WOOD_DARK = "#5c4530";

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

// Faint wood-plank stripes across a floor area, for a bit of texture
// instead of a flat color fill.
function drawFloorPlanks(ctx, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
  ctx.lineWidth = 1;
  for (let x = rect.x - (rect.x % 28); x < rect.x + rect.w; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x, rect.y + rect.h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRug(ctx, cx, cy, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2 - 5, h / 2 - 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// A soft dark ellipse under a piece of furniture, so it looks like it's
// sitting on the floor instead of floating on it.
function drawFurnitureShadow(ctx, cx, groundY, w, h) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A warm little lamp glow: a soft radial-ish halo behind a light source.
function drawGlow(ctx, cx, cy, r, color) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 220, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Small pieces of furniture drawn as simple shapes, just enough for each
// room to feel like a lived-in place rather than an empty colored box.
function drawRoomFurniture(ctx, room) {
  const { x, y, w, h } = room.rect;

  if (room.id === "gaming") {
    const couchX = x + 20, couchY = y + h - 58, couchW = w - 40;
    drawFurnitureShadow(ctx, couchX + couchW / 2, couchY + 40, couchW + 10, 18);

    // Couch: a backrest, a seat cushion row, and a highlight so it
    // doesn't read as one flat block.
    roundRectPath(ctx, couchX, couchY - 14, couchW, 22, 8);
    ctx.fillStyle = "#3f4a5c";
    ctx.fill();
    roundRectPath(ctx, couchX, couchY, couchW, 34, 10);
    ctx.fillStyle = "#4a5568";
    ctx.fill();
    const cushionCount = 3;
    const cushionW = (couchW - 16) / cushionCount;
    for (let i = 0; i < cushionCount; i++) {
      roundRectPath(ctx, couchX + 8 + i * cushionW, couchY + 6, cushionW - 6, 22, 6);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fill();
    }

    // Small side table with a lamp for a warm corner glow.
    const lampX = couchX + couchW + 4, lampY = couchY - 4;
    drawGlow(ctx, lampX, lampY - 6, 26, "rgba(255, 210, 130, 0.5)");
    roundRectPath(ctx, lampX - 10, lampY, 20, 10, 3);
    ctx.fillStyle = WOOD;
    ctx.fill();
    ctx.fillStyle = "#f0d9a0";
    ctx.beginPath();
    ctx.moveTo(lampX - 8, lampY - 4);
    ctx.lineTo(lampX + 8, lampY - 4);
    ctx.lineTo(lampX + 5, lampY - 16);
    ctx.lineTo(lampX - 5, lampY - 16);
    ctx.closePath();
    ctx.fill();

    // TV on a stand, with a soft screen glow.
    const tvX = x + w / 2, tvY = y + 30;
    drawGlow(ctx, tvX, tvY + 23, 50, "rgba(111, 211, 255, 0.25)");
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(tvX - 14, tvY + 46, 28, 6);
    roundRectPath(ctx, tvX - 40, tvY, 80, 46, 6);
    ctx.fillStyle = "#222";
    ctx.fill();
    const screenGradient = ctx.createLinearGradient(tvX - 34, tvY, tvX + 34, tvY + 34);
    screenGradient.addColorStop(0, "#8fe3ff");
    screenGradient.addColorStop(1, "#4fb8e8");
    ctx.fillStyle = screenGradient;
    ctx.fillRect(tvX - 34, tvY + 6, 68, 34);

    // Small game console under the TV, just a hint of detail.
    roundRectPath(ctx, tvX - 22, tvY + 52, 44, 10, 3);
    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.fillStyle = "#6fd3ff";
    ctx.beginPath();
    ctx.arc(tvX + 14, tvY + 57, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (room.id === "study") {
    // Bookshelf: shelf lines, and two rows of books at different heights.
    const shelfX = x + 20, shelfY = y + 20;
    drawFurnitureShadow(ctx, shelfX + 30, shelfY + 94, 66, 12);
    roundRectPath(ctx, shelfX, shelfY, 60, 90, 4);
    ctx.fillStyle = WOOD;
    ctx.fill();
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shelfX + 4, shelfY + 46);
    ctx.lineTo(shelfX + 56, shelfY + 46);
    ctx.stroke();
    const bookColors = ["#c0554a", "#4a90a4", "#e0a84c", "#7a9e5c"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = bookColors[i];
      ctx.fillRect(shelfX + 6 + i * 12, shelfY + 8, 9, 34);
    }
    const bookColors2 = ["#7a9e5c", "#c0554a", "#4a90a4", "#e0a84c"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = bookColors2[i];
      ctx.fillRect(shelfX + 6 + i * 12, shelfY + 54, 9, 28);
    }

    // A curtained window on the back wall for a bit of atmosphere.
    const winX = x + w / 2 - 26, winY = y + 18;
    roundRectPath(ctx, winX, winY, 52, 40, 4);
    ctx.fillStyle = "#cfe0f0";
    ctx.fill();
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 2;
    roundRectPath(ctx, winX, winY, 52, 40, 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(150, 110, 200, 0.55)";
    ctx.beginPath();
    ctx.moveTo(winX - 4, winY - 4);
    ctx.quadraticCurveTo(winX + 6, winY + 20, winX - 2, winY + 44);
    ctx.lineTo(winX - 10, winY + 44);
    ctx.lineTo(winX - 10, winY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(winX + 56, winY - 4);
    ctx.quadraticCurveTo(winX + 46, winY + 20, winX + 54, winY + 44);
    ctx.lineTo(winX + 62, winY + 44);
    ctx.lineTo(winX + 62, winY - 6);
    ctx.closePath();
    ctx.fill();

    // Desk with a chair and a warm lamp glow.
    const deskX = x + w - 90, deskY = y + h - 60;
    drawFurnitureShadow(ctx, deskX + 35, deskY + 40, 84, 16);
    roundRectPath(ctx, deskX + 6, deskY + 30, 6, 16, 2);
    ctx.fillStyle = WOOD_DARK;
    ctx.fill();
    roundRectPath(ctx, deskX + 58, deskY + 30, 6, 16, 2);
    ctx.fill();
    roundRectPath(ctx, deskX, deskY, 70, 34, 6);
    ctx.fillStyle = WOOD;
    ctx.fill();
    roundRectPath(ctx, deskX + 74, deskY + 10, 18, 22, 6);
    ctx.fillStyle = "#8b6b4a";
    ctx.fill();
    drawGlow(ctx, deskX + 60, deskY - 2, 22, "rgba(255, 220, 130, 0.6)");
    roundRectPath(ctx, deskX + 52, deskY - 8, 16, 8, 3);
    ctx.fillStyle = "#f0d9a0";
    ctx.fill();

    // A little potted plant to soften the corner.
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + 22, y + h - 26, 20, 16);
    ctx.fillStyle = "#6fa05e";
    ctx.beginPath();
    ctx.arc(x + 32, y + h - 32, 10, 0, Math.PI * 2);
    ctx.arc(x + 24, y + h - 26, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (room.id === "dinner") {
    const tx = x + w / 2, ty = y + h / 2;
    drawFurnitureShadow(ctx, tx, ty + 46, 130, 24);

    // A pendant lamp hanging over the table, with a warm pool of light.
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, y + 16);
    ctx.lineTo(tx, ty - 60);
    ctx.stroke();
    drawGlow(ctx, tx, ty - 10, 70, "rgba(255, 200, 120, 0.35)");
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.moveTo(tx - 16, ty - 60);
    ctx.lineTo(tx + 16, ty - 60);
    ctx.lineTo(tx + 10, ty - 46);
    ctx.lineTo(tx - 10, ty - 46);
    ctx.closePath();
    ctx.fill();

    // Chairs with a backrest, drawn before the table so they tuck under it.
    const chairOffsets = [[-75, 0], [75, 0], [0, -55], [0, 55]];
    for (const [dx, dy] of chairOffsets) {
      ctx.fillStyle = "#8a6547";
      roundRectPath(ctx, tx + dx - 10, ty + dy - 16, 20, 8, 3);
      ctx.fill();
      ctx.fillStyle = "#a3785a";
      roundRectPath(ctx, tx + dx - 12, ty + dy - 12, 24, 24, 5);
      ctx.fill();
    }

    // Round table with a lighter tablecloth highlight and a fruit bowl.
    ctx.fillStyle = "#8b6b4a";
    ctx.beginPath();
    ctx.ellipse(tx, ty, 55, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.ellipse(tx, ty - 6, 44, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8dcc8";
    ctx.beginPath();
    ctx.ellipse(tx, ty, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const fruitColors = ["#c0554a", "#e0a84c", "#7a9e5c"];
    const fruitOffsets = [[-6, -2], [5, -4], [0, 3]];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = fruitColors[i];
      ctx.beginPath();
      ctx.arc(tx + fruitOffsets[i][0], ty + fruitOffsets[i][1], 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (room.id === "hallway") {
    drawRug(ctx, x + w / 2, y + h / 2, 140, 55, "#c98a6b");

    // A little plant in one corner, shaded leaves for some depth.
    drawFurnitureShadow(ctx, x + w - 30, y + h - 18, 30, 10);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x + w - 40, y + h - 26, 22, 16);
    ctx.fillStyle = "#4f7a48";
    ctx.beginPath();
    ctx.arc(x + w - 34, y + h - 34, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c8a54";
    ctx.beginPath();
    ctx.arc(x + w - 22, y + h - 30, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fa05e";
    ctx.beginPath();
    ctx.arc(x + w - 30, y + h - 20, 11, 0, Math.PI * 2);
    ctx.fill();

    // A small wall mirror with a couple of coat hooks underneath.
    const mirrorX = x + 30, mirrorY = y + 26;
    roundRectPath(ctx, mirrorX, mirrorY, 34, 44, 8);
    ctx.fillStyle = WOOD_DARK;
    ctx.fill();
    roundRectPath(ctx, mirrorX + 4, mirrorY + 4, 26, 36, 6);
    ctx.fillStyle = "#dfeaf2";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    roundRectPath(ctx, mirrorX + 7, mirrorY + 7, 8, 26, 4);
    ctx.fill();
    ctx.fillStyle = WOOD_DARK;
    ctx.beginPath();
    ctx.arc(mirrorX + 10, mirrorY + 54, 3, 0, Math.PI * 2);
    ctx.arc(mirrorX + 24, mirrorY + 54, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draws the house: room floors, furniture, walls, and room name labels.
function drawWorld(ctx) {
  // Outer background, a touch darker than the walls for depth.
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  for (const room of ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(room.rect.x, room.rect.y, room.rect.w, room.rect.h);
    drawFloorPlanks(ctx, room.rect);
    drawRoomFurniture(ctx, room);

    ctx.font = "600 14px 'Quicksand', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    roundRectPath(ctx, room.rect.x + 6, room.rect.y + 6, ctx.measureText(room.name).width + 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, room.rect.x + 16, room.rect.y + 21);
  }

  // Walls, drawn with rounded corners, a light top edge and a darker
  // baseboard edge, so they read as slightly three-dimensional.
  for (const wall of WALLS) {
    ctx.fillStyle = WOOD;
    roundRectPath(ctx, wall.x, wall.y, wall.w, wall.h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(wall.x, wall.y, wall.w, 3);
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
  }
}

// Draws one player (used for both yourself and everyone else) as a
// round cozy character with a little face, plus their name and a soft
// shadow. Pass badge (e.g. "eating") to show a small label over their
// head, used for the Dinner room.
function drawPlayer(ctx, x, y, color, name, badge) {
  const cx = x + PLAYER_SIZE / 2;
  const cy = y + PLAYER_SIZE / 2;
  const r = PLAYER_SIZE / 2;

  // Soft shadow underfoot.
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(cx, y + PLAYER_SIZE + 3, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  ctx.fillStyle = color;
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
  roundRectPath(ctx, cx - tagWidth / 2, y - 22, tagWidth, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillText(name, cx, y - 10);

  if (badge) {
    ctx.font = "13px sans-serif";
    const badgeWidth = ctx.measureText(badge).width + 16;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    roundRectPath(ctx, cx - badgeWidth / 2, y - 42, badgeWidth, 17, 8);
    ctx.fill();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1;
    roundRectPath(ctx, cx - badgeWidth / 2, y - 42, badgeWidth, 17, 8);
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(badge, cx, y - 30);
  }

  ctx.textAlign = "left";
}
