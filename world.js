// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (one grid unit = one floor tile), not
// screen pixels. render.js turns a grid position into a screen pixel
// position. Keeping that math in one place (render.js) is what keeps
// every object's positioning in sync; this file never touches pixels.
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
  { x: -WALL_THICKNESS, y: 11, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS, low: true }, // bottom (drawn short so it doesn't hide the rooms)
  { x: -WALL_THICKNESS, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11 + WALL_THICKNESS * 2 }, // left
  { x: 18, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11 + WALL_THICKNESS * 2 }, // right

  // Dividers between rooms (no doors between rooms directly). They start
  // at the same line as the walls above the rooms so the tops line up.
  { x: 6 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },
  { x: 12 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },

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

// Furniture and decorations. x/y/w/h is the patch of floor each one
// stands on (its "footprint"), in grid units. render.js decides what each
// kind looks like. Solid pieces block walking, so you can walk in front of
// and behind a table but not through it. Rugs, windows and the hanging
// lamp are "solid: false" since you can walk over or under them. Stools
// are also not solid: you stand on one to "sit" at a computer.
// Windows and mirrors hang on a wall: their y is the bottom edge of the
// wall they're on.
const FURNITURE = [
  // Hallway
  { kind: "rug", x: 6, y: 0.7, w: 6, h: 1.4, solid: false },
  { kind: "plant", x: 16.9, y: 0.3, w: 0.6, h: 0.6 },
  { kind: "mirror", x: 2, y: 0, w: 0.7, solid: false },

  // Gaming: a LAN room, two rows of two computer desks with a stool in
  // front of each. "screen" is the color of that monitor's game.
  { kind: "pcDesk", x: 0.3, y: 3.3, w: 1.7, h: 0.7, screen: "#7fd67a" },
  { kind: "stool", x: 0.85, y: 4.05, w: 0.6, h: 0.6, solid: false },
  { kind: "pcDesk", x: 4.0, y: 3.3, w: 1.7, h: 0.7, screen: "#ff9a6b" },
  { kind: "stool", x: 4.55, y: 4.05, w: 0.6, h: 0.6, solid: false },
  { kind: "pcDesk", x: 0.3, y: 6.4, w: 1.7, h: 0.7, screen: "#b78cff" },
  { kind: "stool", x: 0.85, y: 7.15, w: 0.6, h: 0.6, solid: false },
  { kind: "pcDesk", x: 4.0, y: 6.4, w: 1.7, h: 0.7, screen: "#6fc8ff" },
  { kind: "stool", x: 4.55, y: 7.15, w: 0.6, h: 0.6, solid: false },
  { kind: "fridge", x: 0.4, y: 9.7, w: 0.8, h: 0.6 },
  { kind: "snackTable", x: 4.2, y: 9.9, w: 1.4, h: 0.6 },

  // Study
  { kind: "bookshelf", x: 6.4, y: 3.3, w: 1.4, h: 0.5 },
  { kind: "window", x: 10.3, y: 3.2, w: 1.4, solid: false },
  { kind: "desk", x: 10.2, y: 3.4, w: 1.6, h: 0.7 },
  { kind: "plant", x: 6.4, y: 10.1, w: 0.6, h: 0.6 },

  // Dinner
  { kind: "chair", x: 14.7, y: 5.5, w: 0.6, h: 0.6 },
  { kind: "chair", x: 13.3, y: 6.7, w: 0.6, h: 0.6 },
  { kind: "chair", x: 16.1, y: 6.7, w: 0.6, h: 0.6 },
  { kind: "table", x: 14.1, y: 6.4, w: 1.8, h: 1.2 },
  { kind: "chair", x: 14.7, y: 7.9, w: 0.6, h: 0.6 },
  { kind: "pendant", x: 15, y: 7, solid: false },
];

// Everything you bump into: walls plus solid furniture.
const SOLIDS = [...WALLS, ...FURNITURE.filter((f) => f.solid !== false)];

const PLAYER_SIZE = 0.6; // grid units, used for collision and for draw order

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves a player by (dx, dy), sliding along walls and furniture instead of passing
// through them. Checks x and y separately so bumping into a wall on one
// axis doesn't stop movement on the other. dx/dy are in grid units.
function movePlayer(player, dx, dy) {
  const box = () => ({ x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE });

  player.x += dx;
  if (SOLIDS.some((w) => rectsOverlap(box(), w))) {
    player.x -= dx;
  }

  player.y += dy;
  if (SOLIDS.some((w) => rectsOverlap(box(), w))) {
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
