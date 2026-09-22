// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (an abstract floor plan), not screen
// pixels. render.js turns a grid position into a screen pixel position
// for the isometric view. Keeping that math in one place (render.js) is
// what keeps every object's positioning in sync; this file never touches
// pixels directly.
//
// Layout: a hallway band across the top, with Gaming, Study, and Dinner
// in a row underneath. Each room has one doorway gap up into the hallway.

const WALL_THICKNESS = 0.4;

// Open floor areas, in grid units, used to figure out which room the
// player is standing in. Order matters: checked top to bottom, first
// match wins.
const ROOMS = [
  { id: "gaming", name: CONFIG.roomNames.gaming, rect: { x: 0, y: 3, w: 6, h: 8 }, color: CONFIG.roomColors.gaming },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 6, y: 3, w: 6, h: 8 }, color: CONFIG.roomColors.study },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 12, y: 3, w: 6, h: 8 }, color: CONFIG.roomColors.dinner },
  { id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 0, y: 0, w: 18, h: 3 }, color: CONFIG.roomColors.hallway },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
const WALLS = [
  // Outer walls
  { x: -WALL_THICKNESS, y: -WALL_THICKNESS, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS }, // top
  { x: -WALL_THICKNESS, y: 11, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS }, // bottom
  { x: -WALL_THICKNESS, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11 + WALL_THICKNESS * 2 }, // left
  { x: 18, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11 + WALL_THICKNESS * 2 }, // right

  // Dividers between rooms (no doors between rooms directly)
  { x: 6 - WALL_THICKNESS / 2, y: 3, w: WALL_THICKNESS, h: 8 },
  { x: 12 - WALL_THICKNESS / 2, y: 3, w: WALL_THICKNESS, h: 8 },

  // Wall above Gaming, with a doorway gap in the middle
  { x: 0, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },
  { x: 4, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },

  // Wall above Study, with a doorway gap in the middle
  { x: 6, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },
  { x: 10, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },

  // Wall above Dinner, with a doorway gap in the middle
  { x: 12, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },
  { x: 16, y: 3 - WALL_THICKNESS / 2, w: 2, h: WALL_THICKNESS },
];

const PLAYER_SIZE = 0.6; // grid units, used for collision and for depth sorting

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves a player by (dx, dy), sliding along walls instead of passing
// through them. Checks x and y separately so bumping into a wall on one
// axis doesn't stop movement on the other. dx/dy are in grid units.
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
