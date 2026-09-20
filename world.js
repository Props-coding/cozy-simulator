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

// Draws the house: room floors, walls, and room name labels.
function drawWorld(ctx) {
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  for (const room of ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(room.rect.x, room.rect.y, room.rect.w, room.rect.h);
    ctx.fillStyle = "#333";
    ctx.font = "14px sans-serif";
    ctx.fillText(room.name, room.rect.x + 10, room.rect.y + 20);
  }

  ctx.fillStyle = "#5a4a3a";
  for (const wall of WALLS) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }
}

// Draws one player (used for both yourself and everyone else) as a
// colored square with their name above it. Pass badge (e.g. "eating")
// to show a small label over their head, used for the Dinner room.
function drawPlayer(ctx, x, y, color, name, badge) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
  ctx.fillStyle = "#222";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, x + PLAYER_SIZE / 2, y - 4);

  if (badge) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 6, y - 34, PLAYER_SIZE + 12, 16);
    ctx.strokeStyle = "#5a4a3a";
    ctx.strokeRect(x - 6, y - 34, PLAYER_SIZE + 12, 16);
    ctx.fillStyle = "#5a4a3a";
    ctx.fillText(badge, x + PLAYER_SIZE / 2, y - 22);
  }

  ctx.textAlign = "left";
}
