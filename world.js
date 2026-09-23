// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (one grid unit = one floor tile), not
// screen pixels. render.js turns a grid position into a screen pixel
// position. Keeping that math in one place (render.js) is what keeps
// every object's positioning in sync; this file never touches pixels.
//
// Layout: a hallway runs across the middle of the house. Theater, Study
// and Dinner hang below it (south), each with a doorway up into the
// hallway. The Conference Room, the offices and the Library hang above it
// (north), each with a doorway down into the hallway. South of the
// hallway's east end are the stairs, with a bit of garden below them.
//
// Upstairs is a landing (a second hallway) with bedrooms along its north
// side and the stairs at its east end; the rest is roof. The upstairs is
// kept further down the same grid (UPSTAIRS units lower), so the two
// floors never overlap and all the walking and room rules work the same
// on both. Only the floor you're on is drawn.
//
// Offices and bedrooms come and go as their owners join and leave, so the
// room and wall lists below get rebuilt when that happens (see buildHouse).

const WALL_THICKNESS = 0.4;
const HOUSE_WIDTH = 24; // how far east the house (and hallway) reaches
const UPSTAIRS = 40; // how much further down the grid the upstairs floor is kept

// Which floor a grid y position is on: 0 downstairs, 1 upstairs.
function floorOf(y) {
  return y > UPSTAIRS / 2 ? 1 : 0;
}

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
  // North side: the Conference Room at the west end and the Library at the
  // east end (same depth as the offices between them).
  { id: "conference", name: CONFIG.roomNames.conference, rect: { x: 0, y: -5.4, w: 5.6, h: 5 }, sign: { x: 2.8, matY: 0.74 }, north: true },
  { id: "library", name: CONFIG.roomNames.library, rect: { x: 18, y: -5.4, w: 6, h: 5 }, sign: { x: 21, matY: 0.74 }, north: true },
  // The stairs, south of the hallway's east end (the same spot on both floors).
  { id: "stairs", name: CONFIG.roomNames.stairs, rect: { x: 18, y: 3, w: 6, h: 4 }, sign: { x: 20, matY: 2.12 } },
  // Upstairs: the landing (its sign is added in buildHouse) and its stairs.
  { id: "stairsUp", name: CONFIG.roomNames.stairs, rect: { x: 18, y: UPSTAIRS + 3, w: 6, h: 4 }, sign: { x: 20, matY: UPSTAIRS + 2.12 } },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
// (The hallway's top wall gets a doorway for the Conference Room, the
// Library and each office, so it's made in buildHouse instead.)
const BASE_WALLS = [
  // Outer walls
  { x: -WALL_THICKNESS, y: 11, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS, low: true }, // bottom (drawn short so it doesn't hide the rooms)
  { x: -WALL_THICKNESS, y: -5.8, w: WALL_THICKNESS, h: 17.2 }, // left, from the Conference Room down to the bottom

  // Conference Room: its north wall and its right-hand side
  { x: -WALL_THICKNESS, y: -5.8, w: 6, h: WALL_THICKNESS },
  { x: 5.6, y: -5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: HOUSE_WIDTH, y: -5.8, w: WALL_THICKNESS, h: 9 }, // right, from the Library down to the hallway's end

  // Library: its north wall and its left-hand side
  { x: 18 - WALL_THICKNESS, y: -5.8, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS, y: -5.8, w: WALL_THICKNESS, h: 5.4 },

  // The stairwell south of the hallway's east end (doorway x 19.2 to
  // 20.8), with the garden below it.
  { x: 18, y: 3 - WALL_THICKNESS / 2, w: 1.2, h: WALL_THICKNESS },
  { x: 20.8, y: 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS },

  // Upstairs: the landing's sides and bottom (with a doorway into its
  // stairwell, x 19.2 to 20.8), and the stairwell's walls. The landing's
  // top wall has the bedroom doorways, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: UPSTAIRS - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: UPSTAIRS - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: -WALL_THICKNESS, y: UPSTAIRS + 3 - WALL_THICKNESS / 2, w: 19.2 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 20.8, y: UPSTAIRS + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: UPSTAIRS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: UPSTAIRS + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

  // Dividers between rooms (no doors between rooms directly). They start
  // at the same line as the walls above the rooms so the tops line up.
  { x: 6 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },
  { x: 12 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS / 2 },

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
  { kind: "rug", x: 1.5, y: 0.95, w: 21, h: 0.95, color: "#b5603c", solid: false },
  { kind: "coatHooks", x: 0.3, y: 0, w: 1.1, solid: false },
  { kind: "boots", x: 0.4, y: 0.15, w: 0.9, h: 0.35, solid: false },
  { kind: "sconce", x: 1.7, y: 0, solid: false },
  { kind: "sconce", x: 3.9, y: 0, solid: false },
  { kind: "picture", x: 4.55, y: 0, w: 0.9, art: "flowers", solid: false },
  { kind: "bench", x: 4.25, y: 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 6.4, y: 0, solid: false },
  { kind: "mirror", x: 9.45, y: 0, w: 0.7, short: true, solid: false },
  { kind: "console", x: 8.9, y: 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 12.85, y: 0, solid: false },
  { kind: "sconce", x: 14.6, y: 0, solid: false },
  { kind: "sconce", x: 14.35, y: 0, solid: false },
  { kind: "sconce", x: 17.1, y: 0, solid: false },
  { kind: "picture", x: 18.6, y: 0, w: 1.1, art: "sea", solid: false },
  { kind: "sconce", x: 22.3, y: 0, solid: false },
  { kind: "picture", x: 23.0, y: 0, w: 0.75, art: "hills", solid: false },
  { kind: "plant", x: 23.3, y: 2.05, w: 0.6, h: 0.6 },
  // Three raccoons in a trenchcoat, lurking in the hallway's east corner
  // under the hills painting, clear of every door. They sell hats and
  // shoes for crumbs (walk up and press E; see shop.js).
  { kind: "raccoons", x: 23.15, y: 0.12, w: 0.65, h: 0.45 },

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

  // Library: north of the hallway's east end, with its door (x 20.2 to
  // 21.8) at the bottom. Along its outside north wall, three windows with
  // rain running down them and a clock, with a reading nook under them (an
  // armchair turned to the window, a beanbag, each with a floor lamp).
  // Below: a bookshelf on each side of the aisle up from the door, and a
  // reading table with green banker's lamps on a deep green rug, with a
  // seat. Quiet, no voice.
  { kind: "rainWindow", x: 18.35, y: -5.4, w: 1.3, solid: false },
  { kind: "clock", x: 20.0, y: -5.4, solid: false },
  { kind: "rainWindow", x: 20.35, y: -5.4, w: 1.3, solid: false },
  { kind: "rainWindow", x: 22.35, y: -5.4, w: 1.3, solid: false },
  { kind: "armchair", x: 18.5, y: -5.0, w: 1.1, h: 0.8 },
  { kind: "floorLamp", x: 19.7, y: -5.05, w: 0.4, h: 0.4 },
  { kind: "floorLamp", x: 22.1, y: -5.05, w: 0.4, h: 0.4 },
  { kind: "beanbag", x: 22.6, y: -4.95, w: 0.9, h: 0.8 },
  { kind: "libraryShelf", x: 18.5, y: -3.4, w: 1.5, h: 0.45 },
  { kind: "libraryShelf", x: 22.1, y: -3.4, w: 1.5, h: 0.45 },
  { kind: "rug", x: 18.3, y: -2.4, w: 1.9, h: 1.55, color: "#4f6b52", solid: false },
  { kind: "readingTable", x: 18.45, y: -2.2, w: 1.6, h: 0.6 },
  { kind: "chair", x: 18.95, y: -1.45, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#7a5238", back: "#5c3d2a" },
  { kind: "plant", x: 23.2, y: -1.8, w: 0.6, h: 0.6 },

  // Stairs (downstairs): the staircase up along the east side, a lamp
  // and a plant. Walk onto the steps to go up.
  { kind: "staircase", x: 21.3, y: 3.3, w: 2.4, h: 2.7, solid: false },
  { kind: "sconce", x: 18.7, y: 3.2, solid: false },
  { kind: "plant", x: 18.3, y: 6.0, w: 0.6, h: 0.6 },

  // Upstairs: a runner down the landing, lamps and paintings between the
  // bedroom doors (x0 + 2.2 to x0 + 3.8 for x0 = 0, 6, 12, 18), a side
  // table, a bench and plants, and the staircase down in its stairwell.
  // The landing's "Upstairs" plaque hangs at x 12, between two lamps.
  { kind: "rug", x: 1.5, y: UPSTAIRS + 0.95, w: 21, h: 0.95, color: "#6f5a8c", solid: false },
  { kind: "sconce", x: 1.2, y: UPSTAIRS, solid: false },
  { kind: "picture", x: 4.4, y: UPSTAIRS, w: 1.0, art: "flowers", solid: false },
  { kind: "bench", x: 4.2, y: UPSTAIRS + 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 7.3, y: UPSTAIRS, solid: false },
  { kind: "sconce", x: 10.6, y: UPSTAIRS, solid: false },
  { kind: "sconce", x: 13.3, y: UPSTAIRS, solid: false },
  { kind: "picture", x: 16.4, y: UPSTAIRS, w: 1.0, art: "sea", solid: false },
  { kind: "console", x: 16.0, y: UPSTAIRS + 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 19.3, y: UPSTAIRS, solid: false },
  { kind: "picture", x: 22.4, y: UPSTAIRS, w: 0.9, art: "hills", solid: false },
  { kind: "plant", x: 23.3, y: UPSTAIRS + 2.05, w: 0.6, h: 0.6 },
  { kind: "plant", x: 0.15, y: UPSTAIRS + 2.05, w: 0.6, h: 0.6 },
  { kind: "staircase", x: 21.3, y: UPSTAIRS + 3.3, w: 2.4, h: 2.7, down: true, solid: false },
  { kind: "sconce", x: 18.7, y: UPSTAIRS + 3.2, solid: false },
  { kind: "plant", x: 18.3, y: UPSTAIRS + 6.0, w: 0.6, h: 0.6 },
];

// Where the stairs take you: step onto a staircase (the middle of it, so
// brushing its edge doesn't count) and you arrive beside the other one.
const STAIRS = [
  { from: { x: 21.5, y: 3.4, w: 2.0, h: 2.4 }, to: { x: 19.6, y: UPSTAIRS + 4.6 } },
  { from: { x: 21.5, y: UPSTAIRS + 3.4, w: 2.0, h: 2.4 }, to: { x: 19.6, y: 4.6 } },
];

// Where a player's center is on the stairs, the spot they arrive at on the
// other floor (as a player position), or null if they're not on the stairs.
function stairsDestination(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const hit = STAIRS.find(({ from: r }) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
  return hit ? hit.to : null;
}

// --- Private rooms: offices and bedrooms ---
// Offices sit north of the hallway in up to three spots, and bedrooms
// north of the upstairs landing in up to four, filled left to right. When
// one is removed, the ones after it slide over to close the gap. The "+"
// door for making a new one is always on the wall at the next free spot.
// Each kind's layout:
//   slots: how many can exist at once. width: grid units per room,
//   including its wall. firstX: left edge of the first spot. floorY: the y
//   of the corridor wall they open onto (the hallway, or the landing).
//   doorX: where the doorway starts, from the room's left edge.
const WINGS = {
  office: { slots: 3, width: 4, firstX: 6, floorY: 0, doorX: 1, name: "Office" },
  bedroom: { slots: 4, width: 6, firstX: 0, floorY: UPSTAIRS, doorX: 2.2, name: "Bedroom" },
};
const WING_DEPTH = 5; // how far north a private room reaches from its corridor
const DOOR_WIDTH = 1.6;
const OFFICE_TOP = -WALL_THICKNESS - WING_DEPTH; // the office floor's north edge

// Left edge of spot 1, 2, 3... for a kind of room.
function wingX(kind, slot) {
  return WINGS[kind].firstX + (slot - 1) * WINGS[kind].width;
}

// The current house: rebuilt by buildHouse whenever offices or bedrooms
// change. houseVersion goes up by one each time, so render.js knows to
// redraw its saved floor picture.
let ROOMS = [];
let WALLS = [];
let FURNITURE = [];
let SOLIDS = []; // everything you bump into: walls plus solid furniture
let houseVersion = 0;
let houseTopY = -5.8; // the house's northern edge on each floor (for the camera)
const buildDoors = { office: null, bedroom: null }; // left edge of each kind's next free spot, or null if all are taken

// offices and bedrooms: lists of { slot, since, ownerName, color, locked,
// mine }, already in order (slot 1 first). A room's id comes from when it
// was made, so it stays the same when it slides to a different spot.
function buildHouse(offices, bedrooms = []) {
  const t = WALL_THICKNESS;
  const rooms = [...BASE_ROOMS];
  const walls = [...BASE_WALLS];
  const furniture = [...BASE_FURNITURE];

  // A corridor's top wall, from x -t to the east end, with gaps for its doorways.
  const corridorWall = (y, doorways) => {
    let from = -t;
    for (const doorway of doorways.sort((a, b) => a - b)) {
      walls.push({ x: from, y: y - t, w: doorway - from, h: t });
      from = doorway + DOOR_WIDTH;
    }
    walls.push({ x: from, y: y - t, w: HOUSE_WIDTH + t - from, h: t });
  };

  const add = (kind, list) => {
    const wing = WINGS[kind];
    const top = wing.floorY - t - WING_DEPTH;
    for (const info of list) {
      const x0 = wingX(kind, info.slot);
      const inner = wing.width - t;
      const theme = kind === "office" ? officeThemeFor(info.ownerName) : null;
      rooms.push({
        id: kind + "-" + info.since,
        name: `${info.ownerName}'s ${wing.name}`,
        rect: { x: x0, y: top, w: inner, h: WING_DEPTH },
        owned: { ...info, kind },
        theme,
        north: true,
        door: { x: x0 + wing.doorX, y: wing.floorY },
        sign: { x: x0 + wing.doorX + 0.8, matY: wing.floorY + 0.74 },
      });
      walls.push(
        { x: x0 - t, y: top - t, w: wing.width + t, h: t }, // north wall
        { x: x0 - t, y: top - t, w: t, h: WING_DEPTH + t }, // left side, down to the corridor wall
        { x: x0 + inner, y: top - t, w: t, h: WING_DEPTH + t } // right side
      );
      const pieces = kind === "office" ? OFFICE_FURNITURE[theme] || OFFICE_FURNITURE.default : BEDROOM_FURNITURE;
      furniture.push(...pieces(x0, top, info));
      if (info.locked) {
        furniture.push({ kind: "closedDoor", x: x0 + wing.doorX, y: wing.floorY, w: DOOR_WIDTH, solid: false });
      }
    }
    // The "+" door where the next one would go.
    buildDoors[kind] = list.length < wing.slots ? wingX(kind, list.length + 1) : null;
    if (buildDoors[kind] !== null) {
      furniture.push({ kind: "buildDoor", x: buildDoors[kind] + wing.doorX + 0.35, y: wing.floorY, w: 0.9, solid: false });
    }
  };

  // The hallway's top wall, with a doorway into the Conference Room (x 2 to
  // 3.6), the Library (x 20.2 to 21.8) and each office. The landing's has
  // one for each bedroom.
  corridorWall(0, [2, 20.2, ...offices.map((o) => wingX("office", o.slot) + WINGS.office.doorX)]);
  corridorWall(UPSTAIRS, bedrooms.map((b) => wingX("bedroom", b.slot) + WINGS.bedroom.doorX));
  add("office", offices);
  add("bedroom", bedrooms);

  // The hallway's sign is a carved wooden plaque hanging on its back wall,
  // between two lamps on the right (onWall: on the wall, not on its top).
  // The landing gets one too, between the second and third bedroom doors.
  rooms.push({ id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 0, y: 0, w: HOUSE_WIDTH, h: 3 }, sign: { x: 13.72, y: 0, plaque: true, onWall: true } });
  rooms.push({ id: "landing", name: CONFIG.roomNames.landing, rect: { x: 0, y: UPSTAIRS, w: HOUSE_WIDTH, h: 3 }, sign: { x: 12, y: UPSTAIRS, plaque: true, onWall: true } });

  ROOMS = rooms;
  WALLS = walls;
  FURNITURE = furniture;
  SOLIDS = [...walls, ...furniture.filter((f) => f.solid !== false)];
  houseTopY = OFFICE_TOP - t; // the Conference Room always reaches this far north
  houseVersion++;
}

buildHouse([], []);

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

  // Dark cottage: deep green walls with ivy creeping along them, an arched
  // window onto an autumn evening, dried herbs, a candlelit writing desk,
  // pumpkins, a yarn basket, and cats everywhere (asleep on the desk, the
  // armchair and the cat bed, and one keeping watch from the cat tree).
  cottage: (x0, top, office) => [
    { kind: "rug", x: x0 + 0.5, y: top + 1.3, w: 2.6, h: 2.2, color: "#7a3b1f", solid: false },
    { kind: "driedHerbs", x: x0 + 0.1, y: top, w: 0.9, solid: false },
    { kind: "leafWindow", x: x0 + 1.45, y: top, w: 0.9, solid: false },
    { kind: "catTree", x: x0 + 2.85, y: top + 0.1, w: 0.6, h: 0.5 },
    { kind: "cottageDesk", x: x0 + 0.9, y: top + 0.15, w: 1.8, h: 0.65 },
    { kind: "stool", x: x0 + 1.5, y: top + 0.9, w: 0.6, h: 0.6, color: "#6e3a58", solid: false },
    { kind: "ivyPlant", x: x0 + 0.1, y: top + 0.15, w: 0.6, h: 0.5 },
    { kind: "cottageChair", x: x0 + 0.05, y: top + 2.2, w: 1.0, h: 0.8 },
    { kind: "catBed", x: x0 + 2.75, y: top + 2.4, w: 0.75, h: 0.5, solid: false },
    { kind: "yarnBasket", x: x0 + 0.1, y: top + 3.55, w: 0.55, h: 0.4 },
    { kind: "pumpkins", x: x0 + 2.85, y: top + 3.45, w: 0.6, h: 0.5 },
  ],
};

// --- Bedroom furniture ---
// Bedrooms are 5.6 wide and 5 deep, with the doorway at the bottom between
// x0 + 2.2 and x0 + 3.8. A big bed against the north wall (its blanket in
// the owner's color; step into it to go to sleep), a nightstand with a lamp
// on each side, a rainy window, a wardrobe, a rug, a bookshelf and a plant.
const BEDROOM_FURNITURE = (x0, top, bedroom) => [
  { kind: "rug", x: x0 + 1.3, y: top + 2.75, w: 3.0, h: 1.3, color: "#8a6a9a", solid: false },
  { kind: "rainWindow", x: x0 + 4.25, y: top, w: 1.2, solid: false },
  { kind: "wardrobe", x: x0 + 0.1, y: top + 0.1, w: 1.0, h: 0.6 },
  { kind: "nightstand", x: x0 + 1.25, y: top + 0.15, w: 0.55, h: 0.45 },
  { kind: "bed", x: x0 + 1.9, y: top + 0.1, w: 1.8, h: 2.3, color: bedroom.color, solid: false },
  { kind: "nightstand", x: x0 + 3.8, y: top + 0.15, w: 0.55, h: 0.45 },
  { kind: "bookshelf", x: x0 + 0.1, y: top + 3.9, w: 1.3, h: 0.5 },
  { kind: "plant", x: x0 + 4.85, y: top + 3.9, w: 0.6, h: 0.6 },
];

// The bed a player is lying in (their center is on it), or null.
function bedAt(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.kind === "bed" && cx >= f.x + 0.15 && cx <= f.x + f.w - 0.15 && cy >= f.y + 0.5 && cy <= f.y + f.h) || null;
}

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

// Which "+" door the player is standing right by ("office" in the
// hallway, "bedroom" on the landing), or null.
function isNearBuildDoor(player) {
  const corridor = getCurrentRoom(player).id;
  const kind = corridor === "hallway" ? "office" : corridor === "landing" ? "bedroom" : null;
  if (!kind || buildDoors[kind] === null) return null;
  const cx = player.x + PLAYER_SIZE / 2;
  const doorX = buildDoors[kind] + WINGS[kind].doorX;
  return cx >= doorX - 0.2 && cx <= doorX + 1.8 && player.y < WINGS[kind].floorY + 1.2 ? kind : null;
}

// If the player is in a corridor right in front of someone else's locked
// office or bedroom door, returns that room (otherwise null). Used for the
// "Press K to knock" prompt.
function lockedDoorInFront(player) {
  const corridor = getCurrentRoom(player).id;
  if (corridor !== "hallway" && corridor !== "landing") return null;
  const cx = player.x + PLAYER_SIZE / 2;
  const nearDoor = (r) => cx >= r.door.x && cx <= r.door.x + DOOR_WIDTH && player.y >= r.door.y && player.y < r.door.y + 0.9;
  return ROOMS.find((r) => r.owned?.locked && !r.owned.mine && nearDoor(r)) || null;
}

// True if the player is close enough to the raccoons to talk to them.
function isNearRaccoons(player) {
  const r = FURNITURE.find((f) => f.kind === "raccoons");
  const dx = player.x + PLAYER_SIZE / 2 - (r.x + r.w / 2);
  const dy = player.y + PLAYER_SIZE / 2 - (r.y + r.h / 2);
  return Math.hypot(dx, dy) < 1.4;
}

// What pressing E would do right here: talk to the raccoons, make an
// office or bedroom at a "+" door, or nothing. If both are in reach (the
// raccoons stand near the third office's doorway), whichever is closer wins.
function nearestInteraction(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const options = [];
  if (isNearRaccoons(player)) {
    const r = FURNITURE.find((f) => f.kind === "raccoons");
    options.push(["raccoons", Math.hypot(cx - (r.x + r.w / 2), cy - (r.y + r.h / 2))]);
  }
  const kind = isNearBuildDoor(player);
  if (kind) options.push(["buildDoor", Math.hypot(cx - (buildDoors[kind] + WINGS[kind].doorX + 0.8), cy - (WINGS[kind].floorY + 0.3))]);
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
// Also stops you walking into someone else's locked office or bedroom (but
// anyone already inside can always walk out).
function movePlayer(player, dx, dy) {
  const box = () => ({ x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE });
  const startRoomId = getCurrentRoom(player).id;
  const blocked = () => {
    if (SOLIDS.some((w) => rectsOverlap(box(), w))) return true;
    const room = getCurrentRoom(player);
    return room.id !== startRoomId && room.owned?.locked && !room.owned.mine;
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

// Returns the room the player's center point is currently inside (or the
// hallway or landing, if they're somehow in between).
function getCurrentRoom(player) {
  const cx = player.x + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;
  const room = ROOMS.find((r) => cx >= r.rect.x && cx <= r.rect.x + r.rect.w && cy >= r.rect.y && cy <= r.rect.y + r.rect.h);
  return room || ROOMS.find((r) => r.id === (floorOf(cy) ? "landing" : "hallway"));
}
