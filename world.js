// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (one grid unit = one floor tile), not
// screen pixels. render.js turns a grid position into a screen pixel
// position. Keeping that math in one place (render.js) is what keeps
// every object's positioning in sync; this file never touches pixels.
//
// Layout: a hallway runs across the middle of the house. Theater, Study
// and Dinner hang below it (south), each with a doorway up into the
// hallway. At the hallway's east end, a door leads into the Library, a
// tall room with rainy windows along its outside north wall. The Conference Room and personal offices hang above it
// (north), each with a doorway down into the hallway. Offices come and go as their owners join and
// leave, so the room and wall lists below get rebuilt when that happens
// (see buildHouse).

const WALL_THICKNESS = 0.4;
const HOUSE_WIDTH = 24; // how far east the house (and hallway) reaches

// Open floor areas, in grid units, used to figure out which room the
// player is standing in. Order matters: checked top to bottom, first
// match wins. "sign" is where the room's name goes: a doormat with the
// name on it, on the hallway floor in front of the room's door (x is its
// center, matY how far down the hallway it lies). People walk over mats
// like rugs, so names never float over anyone.
const BASE_ROOMS = [
  { id: "theater", name: CONFIG.roomNames.theater, rect: { x: 0, y: 3, w: 6, h: 8 }, sign: { x: 5, matY: 2.12 } },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 6, y: 3, w: 6, h: 8 }, sign: { x: 9, matY: 2.12 } },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 12, y: 3, w: 6, h: 8 }, sign: { x: 15, matY: 2.12 } },
  { id: "library", name: CONFIG.roomNames.library, rect: { x: 18, y: 0, w: 6, h: 11 }, sign: { x: 16.9, matY: 1.5 } },
  // North side, at the west end (same depth as the offices next to it).
  { id: "conference", name: CONFIG.roomNames.conference, rect: { x: 0, y: -5.4, w: 5.6, h: 5 }, sign: { x: 2.8, matY: 0.74 } },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
// (The hallway's top wall gets a doorway for the Conference Room and each
// office, so it's made in buildHouse instead.)
const BASE_WALLS = [
  // Outer walls
  { x: -WALL_THICKNESS, y: 11, w: HOUSE_WIDTH + WALL_THICKNESS * 2, h: WALL_THICKNESS, low: true }, // bottom (drawn short so it doesn't hide the rooms)
  { x: -WALL_THICKNESS, y: -5.8, w: WALL_THICKNESS, h: 17.2 }, // left, from the Conference Room down to the bottom

  // Conference Room: its north wall and its right-hand side
  { x: -WALL_THICKNESS, y: -5.8, w: 6, h: WALL_THICKNESS },
  { x: 5.6, y: -5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: HOUSE_WIDTH, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11 + WALL_THICKNESS * 2 }, // right

  // Dividers between rooms (no doors between rooms directly). They start
  // at the same line as the walls above the rooms so the tops line up.
  { x: 6 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },
  { x: 12 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },
  // Between the hallway's end and Dinner on one side and the Library on
  // the other, with the Library's door (y 0.4 to 2.6) at the hallway end.
  { x: 18 - WALL_THICKNESS / 2, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 0.8 },
  { x: 18 - WALL_THICKNESS / 2, y: 2.6, w: WALL_THICKNESS, h: 8.4 },

  // Wall above the Theater, with its doorway at the right-hand end (so the
  // big screen can fill the rest of that wall)
  { x: 0, y: 3 - WALL_THICKNESS / 2, w: 4.2, h: WALL_THICKNESS },

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
  // Hallway: a long runner rug, and along the back wall (west to east):
  // coat hooks with boots underneath, a cushioned bench under a flower
  // painting between warm wall lamps, a side table with a lamp and flowers
  // under a mirror, the Hallway's name plaque between lamps, and a hills
  // painting in the east corner where the raccoons hang out. A plant sits
  // in the bottom-right corner. They're spaced to leave the doorways
  // clear: Conference Room (x 2 to 3.6) and the three office spots (7 to
  // 8.6, 11 to 12.6, 15 to 16.6).
  { kind: "rug", x: 1.5, y: 0.95, w: 14.5, h: 0.95, color: "#b5603c", solid: false },
  { kind: "coatHooks", x: 0.3, y: 0, w: 1.1, solid: false },
  { kind: "boots", x: 0.4, y: 0.15, w: 0.9, h: 0.35, solid: false },
  { kind: "sconce", x: 1.7, y: 0, solid: false },
  { kind: "sconce", x: 3.9, y: 0, solid: false },
  { kind: "picture", x: 4.55, y: 0, w: 0.9, art: "flowers", solid: false },
  { kind: "bench", x: 4.25, y: 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 6.4, y: 0, solid: false },
  { kind: "mirror", x: 9.45, y: 0, w: 0.7, short: true, solid: false },
  { kind: "console", x: 8.9, y: 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 12.7, y: 0, solid: false },
  { kind: "sconce", x: 14.35, y: 0, solid: false },
  { kind: "picture", x: 16.7, y: 0, w: 0.75, art: "hills", solid: false },
  // Three raccoons in a trenchcoat, lurking near the hallway's east end,
  // to the right of the Hallway plaque, under the hills painting. They
  // sell hats and shoes for crumbs (walk up and press E; see shop.js).
  { kind: "raccoons", x: 16.45, y: 0.12, w: 0.65, h: 0.45 },

  // Conference Room: a rolling whiteboard at the front, a big table with
  // seats all round (stand on one to sit), a plant, and a coffee cart.
  { kind: "whiteboard", x: 1.0, y: -5.3, w: 3.6, h: 0.3 },
  { kind: "conferenceTable", x: 1.0, y: -3.8, w: 3.6, h: 1.4 },
  { kind: "chair", x: 1.3, y: -4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 2.5, y: -4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 3.7, y: -4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 1.3, y: -2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 2.5, y: -2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 3.7, y: -2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 0.3, y: -3.4, w: 0.6, h: 0.6, facing: "right", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 4.7, y: -3.4, w: 0.6, h: 0.6, facing: "left", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "plant", x: 0.15, y: -5.3, w: 0.6, h: 0.6 },
  { kind: "teaCart", x: 4.3, y: -1.5, w: 1.2, h: 0.6 },

  // Theater: a big screen along the top wall, two rows of plush cinema
  // seats facing it, and a popcorn machine by the door side. Seats aren't
  // solid: stand on one to "sit", and its back hides your lower half the
  // way a real cinema seat would.
  { kind: "bigScreen", x: 0.3, y: 3.3, w: 3.6, h: 0.3 },
  { kind: "theaterSeat", x: 0.4, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 1.3, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 2.2, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 3.1, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 0.4, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 1.3, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 2.2, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 3.1, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "popcorn", x: 4.5, y: 9.8, w: 0.9, h: 0.6 },

  // Study
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
  // window, sink, fridge), a rug under the dining table with chairs facing
  // it from all four sides, a tea cart, and a plant. A chair's "facing"
  // says which way you'd look sitting in it.
  { kind: "rug", x: 13.3, y: 5.1, w: 3.4, h: 3.6, color: "#b5763a", solid: false },
  { kind: "window", x: 12.3, y: 3.2, w: 1.5, short: true, solid: false },
  { kind: "stove", x: 12.2, y: 3.3, w: 1.7, h: 0.6 },
  { kind: "sink", x: 16.1, y: 3.3, w: 0.75, h: 0.6 },
  { kind: "fridge", x: 16.9, y: 3.3, w: 0.8, h: 0.6 },
  { kind: "teaCart", x: 12.4, y: 9.9, w: 1.2, h: 0.6 },
  { kind: "plant", x: 17.2, y: 10.1, w: 0.6, h: 0.6 },
  { kind: "chair", x: 14.7, y: 5.5, w: 0.6, h: 0.6, facing: "down" },
  { kind: "chair", x: 13.3, y: 6.7, w: 0.6, h: 0.6, facing: "right" },
  { kind: "chair", x: 16.1, y: 6.7, w: 0.6, h: 0.6, facing: "left" },
  { kind: "table", x: 14.1, y: 6.4, w: 1.8, h: 1.2 },
  { kind: "chair", x: 14.7, y: 7.9, w: 0.6, h: 0.6, facing: "up" },
  { kind: "pendant", x: 15, y: 7, solid: false },

  // Library: a tall room entered from the hallway's east end. Along its
  // outside north wall, three windows with rain running down them and a
  // clock, with a reading nook under them (an armchair turned to the
  // window, a beanbag, each with a floor lamp). Below: two rows of
  // freestanding bookshelves either side of a center aisle, and a long
  // reading table with green banker's lamps on a deep green rug, with
  // seats along the near side. Quiet, no voice.
  { kind: "rainWindow", x: 18.4, y: 0, w: 1.3, solid: false },
  { kind: "clock", x: 20.02, y: 0, solid: false },
  { kind: "rainWindow", x: 20.35, y: 0, w: 1.3, solid: false },
  { kind: "rainWindow", x: 22.3, y: 0, w: 1.3, solid: false },
  { kind: "armchair", x: 18.7, y: 0.45, w: 1.1, h: 0.8 },
  { kind: "floorLamp", x: 19.9, y: 0.4, w: 0.4, h: 0.4 },
  { kind: "floorLamp", x: 22.0, y: 0.4, w: 0.4, h: 0.4 },
  { kind: "beanbag", x: 22.6, y: 0.45, w: 0.9, h: 0.8 },
  { kind: "libraryShelf", x: 18.6, y: 3.6, w: 1.5, h: 0.45 },
  { kind: "libraryShelf", x: 21.9, y: 3.6, w: 1.5, h: 0.45 },
  { kind: "libraryShelf", x: 18.6, y: 5.6, w: 1.5, h: 0.45 },
  { kind: "libraryShelf", x: 21.9, y: 5.6, w: 1.5, h: 0.45 },
  { kind: "rug", x: 19.3, y: 7.95, w: 3.4, h: 2.1, color: "#4f6b52", solid: false },
  { kind: "readingTable", x: 19.7, y: 8.25, w: 2.6, h: 0.7 },
  { kind: "chair", x: 20.05, y: 9.1, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#7a5238", back: "#5c3d2a" },
  { kind: "chair", x: 21.35, y: 9.1, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#7a5238", back: "#5c3d2a" },
  { kind: "plant", x: 23.3, y: 10.1, w: 0.6, h: 0.6 },
  { kind: "plant", x: 18.4, y: 10.1, w: 0.6, h: 0.6 },
];

// --- Offices ---
// Offices sit north of the hallway in up to three spots, filled left to
// right. When one is removed, the ones after it slide over to close the
// gap. The door for building a new office is always on the hallway wall
// at the next free spot.
const OFFICE_SLOTS = 3; // how many offices can exist at once
const OFFICE_WIDTH = 4; // grid units per office, including its wall
const OFFICE_FIRST_X = 6; // left edge of the first office spot (right of the Conference Room)
const OFFICE_DEPTH = 5; // how far north an office reaches from the hallway
const OFFICE_TOP = -WALL_THICKNESS - OFFICE_DEPTH; // the office floor's north edge

// Left edge of office spot 1, 2 or 3.
function officeX(slot) {
  return OFFICE_FIRST_X + (slot - 1) * OFFICE_WIDTH;
}

// The current house: rebuilt by buildHouse whenever offices change.
// houseVersion goes up by one each time, so render.js knows to redraw
// its saved floor picture.
let ROOMS = [];
let WALLS = [];
let FURNITURE = [];
let SOLIDS = []; // everything you bump into: walls plus solid furniture
let houseVersion = 0;
let houseTopY = -5.8; // the house's northern edge (for the camera)
let buildDoorX = null; // left edge of the next free office spot, or null if all are taken

// offices: a list of { slot (1 to 3), since, ownerName, color, locked, mine },
// already in order (slot 1 first). An office's room id comes from when it
// was built, so it stays the same when it slides to a different spot.
function buildHouse(offices) {
  const t = WALL_THICKNESS;
  const rooms = [...BASE_ROOMS];
  const walls = [...BASE_WALLS];
  const furniture = [...BASE_FURNITURE];

  // The hallway's top wall, with a doorway into the Conference Room (x 2 to
  // 3.6) and into each office (x0 + 1 to x0 + 2.6).
  const doorways = [2, ...offices.map((o) => officeX(o.slot) + 1)].sort((a, b) => a - b);
  let from = -t;
  for (const doorway of doorways) {
    walls.push({ x: from, y: -t, w: doorway - from, h: t });
    from = doorway + 1.6;
  }
  walls.push({ x: from, y: -t, w: HOUSE_WIDTH + t - from, h: t });

  for (const office of offices) {
    const x0 = officeX(office.slot);
    const inner = OFFICE_WIDTH - t;
    const theme = officeThemeFor(office.ownerName);
    rooms.push({ id: "office-" + office.since, name: office.ownerName + "'s Office", rect: { x: x0, y: OFFICE_TOP, w: inner, h: OFFICE_DEPTH }, office, theme, sign: { x: x0 + 1.8, matY: 0.74 } });
    walls.push(
      { x: x0 - t, y: OFFICE_TOP - t, w: OFFICE_WIDTH + t, h: t }, // north wall
      { x: x0 - t, y: OFFICE_TOP - t, w: t, h: OFFICE_DEPTH + t }, // left side, down to the hallway wall
      { x: x0 + inner, y: OFFICE_TOP - t, w: t, h: OFFICE_DEPTH + t } // right side
    );
    furniture.push(...(OFFICE_FURNITURE[theme] || OFFICE_FURNITURE.default)(x0, OFFICE_TOP, office));
    if (office.locked) {
      furniture.push({ kind: "closedDoor", x: x0 + 1, y: 0, w: 1.6, solid: false });
    }
  }

  // The "+" door where the next office would go.
  buildDoorX = offices.length < OFFICE_SLOTS ? officeX(offices.length + 1) : null;
  if (buildDoorX !== null) {
    furniture.push({ kind: "buildDoor", x: buildDoorX + 1.35, y: 0, w: 0.9, solid: false });
  }

  // The hallway's sign is a carved wooden plaque hanging on its back wall,
  // between two lamps on the right (onWall: on the wall, not on its top).
  rooms.push({ id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 0, y: 0, w: 18, h: 3 }, sign: { x: 13.5, y: 0, plaque: true, onWall: true } });

  ROOMS = rooms;
  WALLS = walls;
  FURNITURE = furniture;
  SOLIDS = [...walls, ...furniture.filter((f) => f.solid !== false)];
  houseTopY = OFFICE_TOP - t; // the Conference Room always reaches this far north
  houseVersion++;
}

buildHouse([]);

// --- Office furniture ---
// What goes in an office, given x0 (its left edge), top (its north edge)
// and the office itself. Everyone gets "default"; a few names get a secret
// themed office instead (see officeThemes in config.js). Offices are 3.6
// wide and 5 deep, with the doorway at the bottom between x0 + 1 and
// x0 + 2.6, so that lane is kept clear. Wall hangings go on the north wall
// (their y is "top", the bottom edge of that wall).
const OFFICE_FURNITURE = {
  default: (x0, top, office) => [
    { kind: "rug", x: x0 + 0.4, y: top + 2.0, w: 2.8, h: 1.6, color: "#7d6a8f", solid: false },
    { kind: "plant", x: x0 + 0.15, y: top + 0.1, w: 0.6, h: 0.6 },
    { kind: "pcDesk", x: x0 + 0.95, y: top + 0.15, w: 1.7, h: 0.7, screen: office.color },
    { kind: "stool", x: x0 + 1.5, y: top + 0.9, w: 0.6, h: 0.6, color: office.color, solid: false },
    { kind: "bookshelf", x: x0 + 2.85, y: top + 0.1, w: 0.65, h: 0.5 },
    { kind: "plant", x: x0 + 2.9, y: top + 3.8, w: 0.6, h: 0.6 },
  ],

  // Cozy lake house: a stone fireplace with a rug in front, a window onto
  // the lake, a canoe paddle and fishing rod on the wall, a tackle box.
  lakehouse: (x0, top, office) => [
    { kind: "rug", x: x0 + 0.8, y: top + 0.9, w: 1.9, h: 1.1, color: "#8a3b2e", solid: false },
    { kind: "paddle", x: x0 + 0.1, y: top, w: 1.0, solid: false },
    { kind: "lakeWindow", x: x0 + 2.5, y: top, w: 1.0, solid: false },
    { kind: "fireplace", x: x0 + 1.2, y: top + 0.1, w: 1.1, h: 0.6 },
    { kind: "pcDesk", x: x0 + 0.05, y: top + 2.4, w: 1.35, h: 0.7, screen: office.color },
    { kind: "stool", x: x0 + 0.42, y: top + 3.15, w: 0.6, h: 0.6, color: "#8a3b2e", solid: false },
    { kind: "tackleBox", x: x0 + 2.8, y: top + 2.6, w: 0.6, h: 0.4 },
  ],

  // STALKER-style bunker: bare concrete, pipes and rebar in the walls, a
  // flickering fluorescent tube, a steel desk with a Geiger counter, an
  // army crate with a gas mask on it, and a rusty barrel.
  stalker: (x0, top, office) => [
    { kind: "pipes", x: x0 - 0.3, y: top, w: 1.6, solid: false },
    { kind: "rebar", x: x0 + 2.5, y: top, w: 1.0, solid: false },
    { kind: "metalDesk", x: x0 + 0.15, y: top + 0.15, w: 1.7, h: 0.7 },
    { kind: "stool", x: x0 + 0.7, y: top + 0.9, w: 0.6, h: 0.6, color: "#5b6340", solid: false },
    { kind: "crate", x: x0 + 2.6, y: top + 0.15, w: 0.85, h: 0.6 },
    { kind: "barrel", x: x0 + 2.9, y: top + 3.0, w: 0.55, h: 0.55 },
    { kind: "fluorescent", x: x0 + 1.8, y: top + 2.8, solid: false },
  ],

  // Classical Chinese scholar's study: a round moon window, a hanging
  // calligraphy scroll, potted bamboo and a bonsai, and a low writing desk
  // with an inkstone and brushes, with a cushion to kneel on and a paper
  // lantern overhead.
  scholar: (x0, top, office) => [
    { kind: "rug", x: x0 + 0.4, y: top + 1.0, w: 2.8, h: 2.2, color: "#8f2f2a", solid: false },
    { kind: "scroll", x: x0 + 0.95, y: top, w: 0.55, solid: false },
    { kind: "moonWindow", x: x0 + 2.55, y: top, w: 0.8, solid: false },
    { kind: "bamboo", x: x0 + 0.1, y: top + 0.1, w: 0.6, h: 0.5 },
    { kind: "lowDesk", x: x0 + 0.9, y: top + 1.3, w: 1.8, h: 0.7 },
    { kind: "floorCushion", x: x0 + 1.5, y: top + 2.05, w: 0.6, h: 0.5, solid: false },
    { kind: "bonsai", x: x0 + 2.9, y: top + 3.8, w: 0.6, h: 0.5 },
    { kind: "paperLantern", x: x0 + 1.8, y: top + 2.6, solid: false },
  ],
};

// The secret office theme for a name, or null for a normal office.
// Matched without caring about capital letters or stray spaces.
function officeThemeFor(name) {
  const key = String(name).trim().toLowerCase();
  // Only names actually listed count (so a name like "constructor" can't
  // accidentally match something built into JavaScript).
  return Object.hasOwn(CONFIG.officeThemes, key) ? CONFIG.officeThemes[key] : null;
}

// The on-screen name of a room, given its id (used by the sidebar).
function roomNameFor(id) {
  return ROOMS.find((r) => r.id === id)?.name || CONFIG.roomNames[id] || "somewhere";
}

// True if the player is standing in the hallway right by the "+" door
// where the next office would go.
function isNearBuildDoor(player) {
  if (buildDoorX === null || getCurrentRoom(player).id !== "hallway") return false;
  const cx = player.x + PLAYER_SIZE / 2;
  return cx >= buildDoorX + 0.8 && cx <= buildDoorX + 2.8 && player.y < 1.2;
}

// If the player is in the hallway right in front of someone else's locked
// office door, returns that office's room (otherwise null). Used for the
// "Press K to knock" prompt.
function lockedDoorInFront(player) {
  if (getCurrentRoom(player).id !== "hallway") return null;
  const cx = player.x + PLAYER_SIZE / 2;
  const nearDoor = (r) => cx >= r.rect.x + 1 && cx <= r.rect.x + 2.6 && player.y < 0.9;
  return ROOMS.find((r) => r.office?.locked && !r.office.mine && nearDoor(r)) || null;
}

// True if the player is close enough to the raccoons to talk to them.
function isNearRaccoons(player) {
  const r = FURNITURE.find((f) => f.kind === "raccoons");
  const dx = player.x + PLAYER_SIZE / 2 - (r.x + r.w / 2);
  const dy = player.y + PLAYER_SIZE / 2 - (r.y + r.h / 2);
  return Math.hypot(dx, dy) < 1.4;
}

// What pressing E would do right here: talk to the raccoons, build an
// office at the "+" door, or nothing. If both are in reach (the raccoons
// stand near the third office's doorway), whichever is closer wins.
function nearestInteraction(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const options = [];
  if (isNearRaccoons(player)) {
    const r = FURNITURE.find((f) => f.kind === "raccoons");
    options.push(["raccoons", Math.hypot(cx - (r.x + r.w / 2), cy - (r.y + r.h / 2))]);
  }
  if (isNearBuildDoor(player)) options.push(["buildDoor", Math.hypot(cx - (buildDoorX + 1.8), cy - 0.3)]);
  options.sort((a, b) => a[1] - b[1]);
  return options[0]?.[0] ?? null;
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
