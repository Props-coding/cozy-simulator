// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (one grid unit = one floor tile), not
// screen pixels. render.js turns a grid position into a screen pixel
// position. Keeping that math in one place (render.js) is what keeps
// every object's positioning in sync; this file never touches pixels.
//
// Layout: a hallway band across the top, with Gaming, Study, and Dinner
// in a row underneath. Each room has one doorway gap up into the hallway.
// Friends can also build personal offices through a door at the west end
// of the hallway: each one extends the hallway further west, with the
// office underneath it. Offices come and go as their owners join and
// leave, so the room and wall lists below get rebuilt when that happens
// (see buildHouse at the bottom).

const WALL_THICKNESS = 0.4;

// Open floor areas, in grid units, used to figure out which room the
// player is standing in. Order matters: checked top to bottom, first
// match wins.
const BASE_ROOMS = [
  { id: "gaming", name: CONFIG.roomNames.gaming, rect: { x: 0, y: 3, w: 6, h: 8 } },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 6, y: 3, w: 6, h: 8 } },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 12, y: 3, w: 6, h: 8 } },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
// (The top wall and the hallway's west end move as offices are added, so
// those are made in buildHouse instead.)
const BASE_WALLS = [
  // Outer walls
  { x: -WALL_THICKNESS, y: 11, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS, low: true }, // bottom (drawn short so it doesn't hide the rooms)
  { x: -WALL_THICKNESS, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS * 1.5 }, // left side of Gaming
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
const BASE_FURNITURE = [
  // Hallway
  { kind: "rug", x: 6, y: 0.7, w: 6, h: 1.4, color: "#7b8fa8", solid: false },
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
  { kind: "snackTable", x: 4.2, y: 9.9, w: 1.4, h: 0.6 },

  // Study
  // Study: a shared study table on a big rug with cushions to sit on, a
  // reading armchair and floor lamp by the window, string lights, a
  // beanbag, and plants.
  { kind: "rug", x: 7, y: 5.3, w: 4, h: 3, color: "#a8473a", solid: false },
  { kind: "lights", x: 6, y: 3.2, w: 2, solid: false },
  { kind: "lights", x: 10, y: 3.2, w: 2, solid: false },
  { kind: "bookshelf", x: 6.3, y: 3.3, w: 1.5, h: 0.5 },
  { kind: "window", x: 10.3, y: 3.2, w: 1.4, solid: false },
  { kind: "armchair", x: 10.1, y: 3.6, w: 1.1, h: 0.8 },
  { kind: "floorLamp", x: 11.3, y: 3.4, w: 0.4, h: 0.4 },
  { kind: "studyTable", x: 7.6, y: 6.2, w: 2.8, h: 0.9 },
  { kind: "stool", x: 7.8, y: 7.15, w: 0.6, h: 0.6, color: "#d9a441", solid: false },
  { kind: "stool", x: 8.7, y: 7.15, w: 0.6, h: 0.6, color: "#7a9e5c", solid: false },
  { kind: "stool", x: 9.6, y: 7.15, w: 0.6, h: 0.6, color: "#c0554a", solid: false },
  { kind: "beanbag", x: 6.4, y: 9.5, w: 0.9, h: 0.8 },
  { kind: "plant", x: 11.1, y: 10.1, w: 0.6, h: 0.6 },
  { kind: "plant", x: 6.4, y: 4.3, w: 0.6, h: 0.6 },

  // Dinner: a little kitchen along the back wall (stove counter under a
  // window, sink, fridge), a rug under the dining table, a sideboard with
  // the good plates, and a plant.
  { kind: "rug", x: 13.3, y: 5.1, w: 3.4, h: 3.6, color: "#b5763a", solid: false },
  { kind: "window", x: 12.3, y: 3.2, w: 1.5, short: true, solid: false },
  { kind: "stove", x: 12.2, y: 3.3, w: 1.7, h: 0.6 },
  { kind: "sink", x: 16.1, y: 3.3, w: 0.75, h: 0.6 },
  { kind: "fridge", x: 16.9, y: 3.3, w: 0.8, h: 0.6 },
  { kind: "sideboard", x: 12.2, y: 10.0, w: 1.8, h: 0.6 },
  { kind: "plant", x: 17.2, y: 10.1, w: 0.6, h: 0.6 },
  { kind: "chair", x: 14.7, y: 5.5, w: 0.6, h: 0.6 },
  { kind: "chair", x: 13.3, y: 6.7, w: 0.6, h: 0.6 },
  { kind: "chair", x: 16.1, y: 6.7, w: 0.6, h: 0.6 },
  { kind: "table", x: 14.1, y: 6.4, w: 1.8, h: 1.2 },
  { kind: "chair", x: 14.7, y: 7.9, w: 0.6, h: 0.6 },
  { kind: "pendant", x: 15, y: 7, solid: false },
];

// --- Offices ---
const OFFICE_SLOTS = 3; // how many offices can exist at once
const OFFICE_WIDTH = 4; // grid units per office, including its wall
const OFFICE_BOTTOM = 9; // offices run from the hallway (y 3) down to here

// The current house: rebuilt by buildHouse whenever offices change.
// houseVersion goes up by one each time, so render.js knows to redraw
// its saved floor picture.
let ROOMS = [];
let WALLS = [];
let FURNITURE = [];
let SOLIDS = []; // everything you bump into: walls plus solid furniture
let houseVersion = 0;
let hallwayWestX = 0; // where the hallway currently ends on the west side

// offices: a list of { slot (1 to 3), ownerName, color, locked, mine }.
// Slot 1 is right next to Gaming, slot 3 is furthest west. The hallway
// reaches as far west as the furthest built office.
function buildHouse(offices) {
  const furthest = Math.max(0, ...offices.map((o) => o.slot));
  const westX = -furthest * OFFICE_WIDTH;
  const t = WALL_THICKNESS;
  hallwayWestX = westX;

  const rooms = [...BASE_ROOMS];
  const walls = [
    ...BASE_WALLS,
    { x: westX - t, y: -t, w: 18 - westX + t * 2, h: t }, // top, full length of the hallway
    { x: westX - t, y: -t, w: t, h: furthest ? OFFICE_BOTTOM + t * 2 : 3 + t * 2 }, // west end
  ];
  const furniture = [...BASE_FURNITURE];

  // The door you use to build an office, on the back wall at the far west.
  furniture.push({ kind: "buildDoor", x: westX + 0.3, y: 0, w: 0.9, solid: false });

  for (let slot = 1; slot <= furthest; slot++) {
    // Office floor runs from x0 to x0 + 3.6; its right wall is at x0 + 3.6
    // (for slot 1 that's the Gaming room's left wall).
    const x0 = -slot * OFFICE_WIDTH;
    const inner = OFFICE_WIDTH - t;
    const office = offices.find((o) => o.slot === slot);

    if (!office) {
      // An empty slot between built offices: just a plain wall along the hallway.
      walls.push({ x: x0 - t, y: 3 - t / 2, w: OFFICE_WIDTH + t, h: t });
      continue;
    }

    const id = "office-" + slot;
    rooms.push({ id, name: office.ownerName + "'s Office", rect: { x: x0, y: 3, w: inner, h: OFFICE_BOTTOM - 3 }, office });
    walls.push(
      { x: x0 - t, y: 3 - t / 2, w: 1 + t, h: t }, // wall above, left of the doorway
      { x: x0 + 2.6, y: 3 - t / 2, w: inner - 2.6, h: t }, // wall above, right of the doorway
      { x: x0 - t, y: 3 - t / 2, w: t, h: OFFICE_BOTTOM - 3 + t * 1.5 }, // left side
      { x: x0 + inner, y: 3 - t / 2, w: t, h: OFFICE_BOTTOM - 3 + t * 1.5 }, // right side
      { x: x0 - t, y: OFFICE_BOTTOM, w: OFFICE_WIDTH + t, h: t, low: true } // bottom
    );
    furniture.push(
      { kind: "rug", x: x0 + 0.4, y: 4.4, w: 2.8, h: 1.6, color: "#7d6a8f", solid: false },
      { kind: "plant", x: x0 + 0.2, y: 3.3, w: 0.6, h: 0.6 },
      { kind: "bookshelf", x: x0 + 2.8, y: 3.3, w: 0.7, h: 0.5 },
      { kind: "pcDesk", x: x0 + 0.3, y: 6.4, w: 1.7, h: 0.7, screen: office.color },
      { kind: "stool", x: x0 + 0.85, y: 7.15, w: 0.6, h: 0.6, color: office.color, solid: false },
      { kind: "plant", x: x0 + 2.8, y: 8.2, w: 0.6, h: 0.6 }
    );
    if (office.locked) {
      furniture.push({ kind: "closedDoor", x: x0 + 1, y: 3 + t / 2, w: 1.6, solid: false });
    }
  }

  rooms.push({ id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: westX, y: 0, w: 18 - westX, h: 3 } });

  ROOMS = rooms;
  WALLS = walls;
  FURNITURE = furniture;
  SOLIDS = [...walls, ...furniture.filter((f) => f.solid !== false)];
  houseVersion++;
}

buildHouse([]);

// The on-screen name of a room, given its id (used by the sidebar).
function roomNameFor(id) {
  return ROOMS.find((r) => r.id === id)?.name || CONFIG.roomNames[id] || "somewhere";
}

// True if the player is standing right by the office door at the west
// end of the hallway.
function isNearBuildDoor(player) {
  return player.x < hallwayWestX + 1.6 && player.y < 1.2;
}

// If the player is in the hallway right in front of someone else's locked
// office door, returns that office's room (otherwise null). Used for the
// "Press K to knock" prompt.
function lockedDoorInFront(player) {
  if (getCurrentRoom(player).id !== "hallway") return null;
  const cx = player.x + PLAYER_SIZE / 2;
  const nearDoor = (r) => cx >= r.rect.x + 1 && cx <= r.rect.x + 2.6 && player.y + PLAYER_SIZE > 2.4;
  return ROOMS.find((r) => r.office?.locked && !r.office.mine && nearDoor(r)) || null;
}

// True if the player's center is inside some room (false means a room
// just disappeared from under them, like an office whose owner left).
function isInsideARoom(player) {
  const cx = player.x + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;
  return ROOMS.some((r) => cx >= r.rect.x && cx <= r.rect.x + r.rect.w && cy >= r.rect.y && cy <= r.rect.y + r.rect.h);
}

const PLAYER_SIZE = 0.6; // grid units, used for collision and for draw order

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves a player by (dx, dy), sliding along walls and furniture instead of passing
// through them. Checks x and y separately so bumping into a wall on one
// axis doesn't stop movement on the other. dx/dy are in grid units.
// Also stops you walking into someone else's locked office (but anyone
// already inside can always walk out).
function movePlayer(player, dx, dy) {
  const box = () => ({ x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE });
  const startRoomId = getCurrentRoom(player).id;
  const blocked = () => {
    if (SOLIDS.some((w) => rectsOverlap(box(), w))) return true;
    const room = getCurrentRoom(player);
    return room.id !== startRoomId && room.office?.locked && !room.office.mine;
  };

  player.x += dx;
  if (blocked()) {
    player.x -= dx;
  }

  player.y += dy;
  if (blocked()) {
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
