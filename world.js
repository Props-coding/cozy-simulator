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
// hallway's east end is the elevator lobby, with a bit of garden below it.
//
// Upstairs is a landing (a second hallway) with bedrooms along its north
// side and the elevator at its east end; the rest is roof. The upstairs is
// kept further down the same grid (UPSTAIRS units lower), so the two
// floors never overlap and all the walking and room rules work the same
// on both. Only the floor you're on is drawn.
//
// Offices and bedrooms come and go as their owners join and leave, so the
// room and wall lists below get rebuilt when that happens (see buildHouse).

const WALL_THICKNESS = 0.4;
const HOUSE_WIDTH = 24; // how far east the house (and hallway) reaches
const UPSTAIRS = 40; // how much further down the grid the upstairs floor is kept
// Upstairs, the landing sits lower than the hallway does downstairs, which
// leaves room for deep bedrooms above it. This is the landing's top edge
// (the wall with the bedroom doors).
const LANDING = UPSTAIRS + 3;

// Which floor a grid y position is on: 0 downstairs, 1 upstairs.
function floorOf(y) {
  return y > UPSTAIRS / 2 ? 1 : 0;
}

// Open floor areas, in grid units, used to figure out which room the
// player is standing in. Order matters: checked top to bottom, first
// match wins. "sign" is where the room's little wooden sign hangs, over
// its doorway: x is the doorway's middle, y the middle of the wall it's in.
// (The icon on it comes from CONFIG.roomIcons.)
const BASE_ROOMS = [
  { id: "theater", name: CONFIG.roomNames.theater, rect: { x: 0, y: 3, w: 6, h: 8 }, sign: { x: 5, y: 3 } },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 6, y: 3, w: 6, h: 8 }, sign: { x: 9, y: 3 } },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 12, y: 3, w: 6, h: 8 }, sign: { x: 15, y: 3 } },
  // North side: the Conference Room at the west end and the Library at the
  // east end (same depth as the offices between them).
  { id: "conference", name: CONFIG.roomNames.conference, rect: { x: 0, y: -5.4, w: 5.6, h: 5 }, sign: { x: 2.8, y: -WALL_THICKNESS / 2 }, north: true },
  { id: "library", name: CONFIG.roomNames.library, rect: { x: 18, y: -5.4, w: 6, h: 5 }, sign: { x: 21, y: -WALL_THICKNESS / 2 }, north: true },
  // The elevator lobby, south of the hallway's east end (the same spot on both floors).
  { id: "elevator", name: CONFIG.roomNames.elevator, rect: { x: 18, y: 3, w: 6, h: 4 }, sign: { x: 20, y: 3 } },
  // Upstairs: the landing (added in buildHouse) and its elevator lobby.
  { id: "elevatorUp", name: CONFIG.roomNames.elevator, rect: { x: 18, y: LANDING + 3, w: 6, h: 4 }, sign: { x: 20, y: LANDING + 3 } },
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

  // The elevator lobby south of the hallway's east end (doorway x 19.2 to
  // 20.8), with the garden below it.
  { x: 18, y: 3 - WALL_THICKNESS / 2, w: 1.2, h: WALL_THICKNESS },
  { x: 20.8, y: 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true }, // drawn short so it doesn't hide the lobby

  // Upstairs: the landing's sides and bottom (with a doorway into its
  // elevator lobby, x 19.2 to 20.8), and the lobby's walls. The landing's
  // top wall has the bedroom doorways, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: LANDING - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: LANDING - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: -WALL_THICKNESS, y: LANDING + 3 - WALL_THICKNESS / 2, w: 19.2 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 20.8, y: LANDING + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: LANDING + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: LANDING + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

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
  // under a mirror, more lamps, and a hills
  // painting in the east corner where the raccoons hang out. A fiddle-leaf fig sits
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
  { kind: "sconce", x: 17.1, y: 0, solid: false },
  { kind: "picture", x: 18.6, y: 0, w: 1.1, art: "sea", solid: false },
  { kind: "sconce", x: 22.3, y: 0, solid: false },
  { kind: "picture", x: 23.0, y: 0, w: 0.75, art: "hills", solid: false },
  { kind: "fiddleFig", x: 23.3, y: 2.05, w: 0.6, h: 0.6 },
  // Three raccoons in a trenchcoat, lurking in the hallway's east corner
  // under the hills painting, clear of every door. They sell hats and
  // shoes for crumbs (walk up and press E; see shop.js).
  { kind: "raccoons", x: 23.15, y: 0.12, w: 0.65, h: 0.45 },

  // Conference Room: a rolling whiteboard at the front, a big table with
  // seats all round (stand on one to sit), a snake plant, and a coffee cart.
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
  { kind: "snakePlant", x: 0.15, y: -5.3, w: 0.6, h: 0.6 },
  { kind: "teaCart", x: 4.3, y: -1.5, w: 1.2, h: 0.6 },

  // Theater: a big screen along the top wall between red velvet curtains
  // with marquee lights, floor cushions up front, two rows of plush cinema
  // seats, a big sofa in the back row, lights along the aisle, and a snack
  // counter and popcorn machine at the back. Seats and the sofa aren't
  // solid: stand on one to "sit", and its back hides your lower half the
  // way a real cinema seat would.
  { kind: "bigScreen", x: 0.3, y: 3.3, w: 3.6, h: 0.3 },
  { kind: "stageCurtains", x: 0.05, y: 3.61, w: 4.1, h: 0.05, solid: false }, // hung just in front of the screen
  { kind: "floorCushions", x: 0.5, y: 4.3, w: 1.0, h: 0.6, solid: false },
  { kind: "floorCushions", x: 2.6, y: 4.3, w: 1.0, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 0.4, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 1.3, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 2.2, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 3.1, y: 5.4, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 0.4, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 1.3, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 2.2, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "theaterSeat", x: 3.1, y: 7.2, w: 0.7, h: 0.6, solid: false },
  { kind: "cinemaSofa", x: 0.4, y: 8.6, w: 3.4, h: 0.8, solid: false },
  { kind: "aisleLights", x: 4.3, y: 4.2, w: 0.2, h: 5.6, solid: false },
  { kind: "candyCounter", x: 2.3, y: 10.2, w: 1.8, h: 0.55 },
  { kind: "popcorn", x: 4.6, y: 10.1, w: 0.9, h: 0.6 },
  { kind: "palm", x: 0.2, y: 10.1, w: 0.6, h: 0.6 },

  // Study
  // Study
  // Study: a shared study table on a big rug with cushions to sit on, a
  // reading armchair and floor lamp under a cork board (no window: that wall faces the hallway), string lights, a
  // beanbag, and a monstera.
  { kind: "rug", x: 7, y: 5.3, w: 4, h: 3, color: "#a8473a", solid: false },
  { kind: "lights", x: 6, y: 3.2, w: 2, solid: false },
  { kind: "lights", x: 10, y: 3.2, w: 2, solid: false },
  { kind: "bookshelf", x: 6.3, y: 3.3, w: 1.5, h: 0.5 },
  { kind: "corkBoard", x: 10.3, y: 3.2, w: 1.4, solid: false },
  { kind: "armchair", x: 10.1, y: 3.6, w: 1.1, h: 0.8 },
  { kind: "floorLamp", x: 11.3, y: 3.4, w: 0.4, h: 0.4 },
  { kind: "studyTable", x: 7.6, y: 6.2, w: 2.8, h: 0.9 },
  { kind: "stool", x: 7.8, y: 7.15, w: 0.6, h: 0.6, color: "#d9a441", solid: false },
  { kind: "stool", x: 8.7, y: 7.15, w: 0.6, h: 0.6, color: "#7a9e5c", solid: false },
  { kind: "stool", x: 9.6, y: 7.15, w: 0.6, h: 0.6, color: "#c0554a", solid: false },
  { kind: "beanbag", x: 6.4, y: 9.5, w: 0.9, h: 0.8 },
  { kind: "monstera", x: 11.1, y: 10.1, w: 0.6, h: 0.6 },
  // A turntable on a little record cabinet: press E to pick your lo-fi.
  { kind: "turntable", x: 6.25, y: 4.3, w: 1.1, h: 0.55 },

  // Dinner: a little kitchen along the back wall (stove counter under a
  // shelf of jars and spices, sink, fridge), a rug under the dining table with chairs facing
  // it from all four sides, a tea cart, and a little lemon tree. A chair's "facing"
  // says which way you'd look sitting in it.
  { kind: "rug", x: 13.3, y: 5.1, w: 3.4, h: 3.6, color: "#b5763a", solid: false },
  { kind: "jarShelf", x: 12.3, y: 3.2, w: 1.5, solid: false },
  { kind: "stove", x: 12.2, y: 3.3, w: 1.7, h: 0.6 },
  { kind: "sink", x: 16.1, y: 3.3, w: 0.75, h: 0.6 },
  { kind: "fridge", x: 16.9, y: 3.3, w: 0.8, h: 0.6 },
  { kind: "teaCart", x: 12.4, y: 9.9, w: 1.2, h: 0.6 },
  { kind: "lemonTree", x: 17.2, y: 10.1, w: 0.6, h: 0.6 },
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
  { kind: "fern", x: 23.2, y: -1.8, w: 0.6, h: 0.6 },

  // Elevator lobby (downstairs): brass elevator doors on the back wall
  // (walk up and press E), a lamp, a round rug, a bench and a palm.
  { kind: "elevatorDoor", x: 21.4, y: 3 + WALL_THICKNESS / 2, w: 1.6, floor: 0, solid: false },
  { kind: "sconce", x: 18.7, y: 3.2, solid: false },
  { kind: "rug", x: 20.8, y: 4.3, w: 2.8, h: 1.9, color: "#7a3b4a", round: true, solid: false },
  { kind: "bench", x: 18.3, y: 4.2, w: 1.5, h: 0.5 },
  { kind: "palm", x: 18.3, y: 6.0, w: 0.6, h: 0.6 },

  // Upstairs: a runner down the landing, lamps and paintings between the
  // bedroom doors (x0 + 1 to x0 + 2.6 for x0 = 0, 6, 12, 18), a side
  // table, a bench, a cactus and a fern, and the elevator lobby.
  { kind: "rug", x: 1.5, y: LANDING + 0.95, w: 21, h: 0.95, color: "#6f5a8c", solid: false },
  { kind: "sconce", x: 3.0, y: LANDING, solid: false },
  { kind: "picture", x: 4.4, y: LANDING, w: 1.0, art: "flowers", solid: false },
  { kind: "bench", x: 4.2, y: LANDING + 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 6.4, y: LANDING, solid: false },
  { kind: "sconce", x: 10.6, y: LANDING, solid: false },
  { kind: "sconce", x: 12.75, y: LANDING, solid: false },
  { kind: "sconce", x: 15.4, y: LANDING, solid: false },
  { kind: "picture", x: 16.4, y: LANDING, w: 1.0, art: "sea", solid: false },
  { kind: "console", x: 16.0, y: LANDING + 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 18.4, y: LANDING, solid: false },
  { kind: "sconce", x: 21.4, y: LANDING, solid: false },
  { kind: "picture", x: 22.4, y: LANDING, w: 0.9, art: "hills", solid: false },
  { kind: "cactus", x: 0.15, y: LANDING + 2.05, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.4, y: LANDING + 3 + WALL_THICKNESS / 2, w: 1.6, floor: 1, solid: false },
  { kind: "sconce", x: 18.7, y: LANDING + 3.2, solid: false },
  { kind: "rug", x: 20.8, y: LANDING + 4.3, w: 2.8, h: 1.9, color: "#4f5f7a", round: true, solid: false },
  { kind: "bench", x: 18.3, y: LANDING + 4.2, w: 1.5, h: 0.5 },
  { kind: "fern", x: 18.3, y: LANDING + 6.0, w: 0.6, h: 0.6 },
];

// The elevator: one set of doors on each floor, in the same spot. Stand
// in front of the doors and press E to ride to the other floor.
// ELEVATOR_OPEN is how open each floor's doors are right now (0 shut, 1
// wide open), set by main.js while you ride and read when drawing.
const ELEVATOR_OPEN = [0, 0];

// The floor (0 or 1) of the elevator you're standing in front of, or -1.
function elevatorInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const door = FURNITURE.find((f) => f.kind === "elevatorDoor" && floorOf(f.y) === floorOf(player.y));
  if (!door) return -1;
  return cx > door.x - 0.2 && cx < door.x + door.w + 0.2 && cy > door.y && cy < door.y + 1.3 ? door.floor : -1;
}

// Where you step out on the other floor: just in front of its doors.
function elevatorArrival(fromFloor) {
  const door = FURNITURE.find((f) => f.kind === "elevatorDoor" && f.floor !== fromFloor);
  return { x: door.x + door.w / 2 - PLAYER_SIZE / 2, y: door.y + 0.3 };
}

// --- Seasonal decorations ---
// The shared rooms (hallways, Theater, Study, Dinner, Library) dress up
// for the season: garlands along the hallway walls, and a small and a big
// decoration in each room. Offices and bedrooms are left alone. The season
// comes from today's date (or CONFIG.season, or the admin panel's preview).
const SEASONS = ["spring", "summer", "autumn", "winter"];
const SEASONAL = {
  small: { autumn: "pumpkins", winter: "presents", spring: "eggBasket", summer: "sunflowerVase" },
  big: { autumn: "autumnCrate", winter: "winterTree", spring: "flowerPlanter", summer: "floorFan" },
  // Where they go (grid units), kept clear of doorways and furniture.
  spots: [
    { size: "small", x: 5.85, y: 0.12 }, // hallway, by the bench
    { size: "big", x: 18.9, y: 0.1 }, // hallway, under the sea painting
    { size: "small", x: 5.8, y: LANDING + 0.12 }, // landing, by the bench
    { size: "big", x: 22.9, y: LANDING + 0.1 }, // landing, under the hills painting
    { size: "small", x: 7.4, y: 9.8 }, // Study, by the beanbag
    { size: "big", x: 10.9, y: 8.7 }, // Study, beside the rug
    { size: "small", x: 13.8, y: 10.15 }, // Dinner, by the tea cart
    { size: "big", x: 16.9, y: 8.9 }, // Dinner, by the lemon tree
    { size: "small", x: 5.3, y: 9.2 }, // Theater, by the popcorn
    { size: "big", x: 1.0, y: 10.0 }, // Theater, back corner
    { size: "small", x: 20.8, y: -5.0 }, // Library, under the windows
    { size: "big", x: 22.9, y: -2.6 }, // Library, by the fern
  ],
  // Garlands along the top of the hallway and landing walls, between doors.
  garlands: [
    [0.1, 0, 1.75], [3.75, 0, 3.15], [8.7, 0, 2.2], [12.7, 0, 2.2], [16.7, 0, 3.4], [21.9, 0, 2.0],
    [2.7, LANDING, 4.2], [8.7, LANDING, 4.2], [14.7, LANDING, 4.2], [20.7, LANDING, 3.2],
  ],
};
let seasonPreview = null; // set from the admin panel to try out a season

function currentSeason() {
  const pick = seasonPreview || CONFIG.season;
  if (SEASONS.includes(pick)) return pick;
  const month = new Date().getMonth(); // 0 is January
  return month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
}

// Shows a season in the house right now (or null to go back to the real
// one). Only on this computer.
function previewSeason(season) {
  seasonPreview = season;
  buildHouse(...lastBuild);
}

function seasonalFurniture() {
  const season = currentSeason();
  return [
    ...SEASONAL.spots.map(({ size, x, y }) => ({ kind: SEASONAL[size][season], x, y, w: size === "big" ? 0.8 : 0.55, h: size === "big" ? 0.7 : 0.45 })),
    ...SEASONAL.garlands.map(([x, y, w]) => ({ kind: "garland", style: season, x, y, w, solid: false })),
  ];
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
//   doorX: where the doorway starts, from the room's left edge. depth: how
//   far north it reaches from the corridor.
const WINGS = {
  office: { slots: 3, width: 4, firstX: 6, floorY: 0, doorX: 1, depth: 5, name: "Office" },
  bedroom: { slots: 4, width: 6, firstX: 0, floorY: LANDING, doorX: 1, depth: 8, name: "Bedroom" },
};
const BEDROOM_DEPTH = WINGS.bedroom.depth;
const DOOR_WIDTH = 1.6;
const OFFICE_TOP = -WALL_THICKNESS - WINGS.office.depth; // the office floor's north edge

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
let lastBuild = [[], []]; // what the house was last built with (see previewSeason)
function buildHouse(offices, bedrooms = []) {
  lastBuild = [offices, bedrooms];
  const t = WALL_THICKNESS;
  const rooms = [...BASE_ROOMS];
  const walls = [...BASE_WALLS];
  const furniture = [...BASE_FURNITURE, ...seasonalFurniture()];

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
    const top = wing.floorY - t - wing.depth;
    for (const info of list) {
      const x0 = wingX(kind, info.slot);
      // Bedrooms come in two sizes (see BEDROOM_SIZES); offices fill their spot.
      const inner = kind === "bedroom" ? bedroomWidth(info.size) : wing.width - t;
      const theme = kind === "office" ? officeThemeFor(info.ownerName) : null;
      rooms.push({
        id: kind + "-" + info.since,
        name: `${info.ownerName}'s ${wing.name}`,
        rect: { x: x0, y: top, w: inner, h: wing.depth },
        owned: { ...info, kind },
        theme,
        north: true,
        door: { x: x0 + wing.doorX, y: wing.floorY },
        sign: { x: x0 + wing.doorX + DOOR_WIDTH / 2, y: wing.floorY - t / 2 },
      });
      walls.push(
        { x: x0 - t, y: top - t, w: wing.width + t, h: t }, // north wall
        { x: x0 - t, y: top - t, w: t, h: wing.depth + t }, // left side, down to the corridor wall
        { x: x0 + inner, y: top - t, w: t, h: wing.depth + t } // right side
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
  corridorWall(LANDING, bedrooms.map((b) => wingX("bedroom", b.slot) + WINGS.bedroom.doorX));
  add("office", offices);
  add("bedroom", bedrooms);

  // The hallway and landing are last, so rooms off them are found first.
  // They have no sign: the header already says where you are.
  rooms.push({ id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 0, y: 0, w: HOUSE_WIDTH, h: 3 } });
  rooms.push({ id: "landing", name: CONFIG.roomNames.landing, rect: { x: 0, y: LANDING, w: HOUSE_WIDTH, h: 3 } });

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
    { kind: "succulents", x: x0 + 0.15, y: top + 0.1, w: 0.6, h: 0.6 },
    { kind: "pcDesk", x: x0 + 0.95, y: top + 0.15, w: 1.7, h: 0.7, screen: office.color },
    { kind: "stool", x: x0 + 1.5, y: top + 0.9, w: 0.6, h: 0.6, color: office.color, solid: false },
    { kind: "bookshelf", x: x0 + 2.85, y: top + 0.1, w: 0.65, h: 0.5 },
    { kind: "snakePlant", x: x0 + 2.9, y: top + 3.8, w: 0.6, h: 0.6 },
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

// --- Bedrooms: the starter room, and Nest & Nook decor ---
// A new bedroom is "cozy": 4.1 wide, with a partition wall on its right.
// The "Roomy" upgrade (bought at Nest & Nook) takes the wall down, making
// it 5.6 wide. Either way it's 8 deep, with the doorway at the bottom
// between x0 + 1 and x0 + 2.6.
const BEDROOM_SIZES = { cozy: 4.1, roomy: 5.6 };
const ROOMY_PRICE = 150; // crumbs

function bedroomWidth(size) {
  return Object.hasOwn(BEDROOM_SIZES, size) ? BEDROOM_SIZES[size] : BEDROOM_SIZES.cozy;
}

// Everything Nest & Nook sells. `kind` is how it's drawn (see render.js),
// w and h its footprint in grid units, `tab` where it's listed in the
// store (furniture, plants, shelves or decor). `wall` items hang on the
// back wall. `sleep` means you can sleep in it. `ownerColor` uses the
// bedroom owner's color. Other fields (like color, art or shape) are
// passed on to the drawing.
const DECOR = {
  // --- Furniture ---
  quiltBed: { name: "Quilted Bed", tab: "furniture", price: 60, kind: "bed", w: 1.8, h: 2.3, sleep: true, solid: false, ownerColor: true },
  canopyBed: { name: "Canopy Bed", tab: "furniture", price: 160, kind: "canopyBed", w: 1.8, h: 2.3, sleep: true, solid: false, ownerColor: true },
  nightstand: { name: "Nightstand & Lamp", tab: "furniture", price: 20, kind: "nightstand", w: 0.55, h: 0.45 },
  wardrobe: { name: "Wardrobe", tab: "furniture", price: 45, kind: "wardrobe", w: 1.0, h: 0.6 },
  dresser: { name: "Dresser", tab: "furniture", price: 45, kind: "dresser", w: 1.1, h: 0.5 },
  vanity: { name: "Vanity with Bulb Mirror", tab: "furniture", price: 85, kind: "vanity", w: 1.2, h: 0.5 },
  clothesRack: { name: "Clothes Rack", tab: "furniture", price: 40, kind: "clothesRack", w: 1.2, h: 0.45 },
  cloudSofa: { name: "Cloud Sofa", tab: "furniture", price: 110, kind: "cloudSofa", w: 2.0, h: 0.85 },
  loveseatSage: { name: "Sage Loveseat", tab: "furniture", price: 70, kind: "loveseat", w: 1.6, h: 0.8, color: "#7a9e8c" },
  loveseatRose: { name: "Rose Loveseat", tab: "furniture", price: 70, kind: "loveseat", w: 1.6, h: 0.8, color: "#c98a8a" },
  armchair: { name: "Reading Armchair", tab: "furniture", price: 40, kind: "armchair", w: 1.1, h: 0.8 },
  velvetChair: { name: "Velvet Chair (cat included)", tab: "furniture", price: 60, kind: "cottageChair", w: 1.0, h: 0.8 },
  papasanChair: { name: "Papasan Chair", tab: "furniture", price: 65, kind: "papasanChair", w: 1.0, h: 0.8 },
  eggChair: { name: "Hanging Egg Chair", tab: "furniture", price: 95, kind: "eggChair", w: 0.9, h: 0.7 },
  rockingChair: { name: "Rocking Chair", tab: "furniture", price: 45, kind: "rockingChair", w: 0.8, h: 0.6 },
  beanbag: { name: "Beanbag", tab: "furniture", price: 25, kind: "beanbag", w: 0.9, h: 0.8 },
  poufCream: { name: "Cream Knit Pouf", tab: "furniture", price: 20, kind: "pouf", w: 0.6, h: 0.5, color: "#e0c8b0" },
  poufPink: { name: "Pink Knit Pouf", tab: "furniture", price: 20, kind: "pouf", w: 0.6, h: 0.5, color: "#efb8c4" },
  mushroomStool: { name: "Mushroom Stool", tab: "furniture", price: 18, kind: "mushroomStool", w: 0.5, h: 0.45 },
  bench: { name: "Cushioned Bench", tab: "furniture", price: 25, kind: "bench", w: 1.5, h: 0.5 },
  coffeeTable: { name: "Coffee Table", tab: "furniture", price: 30, kind: "coffeeTable", w: 1.2, h: 0.6 },
  sideTable: { name: "Round Side Table", tab: "furniture", price: 22, kind: "sideTable", w: 0.6, h: 0.5 },
  writingDesk: { name: "Writing Desk", tab: "furniture", price: 40, kind: "writingDesk", w: 1.3, h: 0.6 },
  aestheticDesk: { name: "Aesthetic Desk", tab: "furniture", price: 75, kind: "aestheticDesk", w: 1.4, h: 0.6 },
  teaCart: { name: "Tea Cart", tab: "furniture", price: 30, kind: "teaCart", w: 1.2, h: 0.6 },
  barCart: { name: "Gold Bar Cart", tab: "furniture", price: 45, kind: "barCart", w: 0.9, h: 0.5 },
  fireplace: { name: "Stone Fireplace", tab: "furniture", price: 120, kind: "fireplace", w: 1.1, h: 0.6 },
  recordPlayer: { name: "Record Player", tab: "furniture", price: 55, kind: "recordPlayer", w: 0.9, h: 0.5 },
  piano: { name: "Upright Piano", tab: "furniture", price: 140, kind: "piano", w: 1.5, h: 0.7 },
  fishTank: { name: "Fish Tank", tab: "furniture", price: 80, kind: "fishTank", w: 1.0, h: 0.5 },
  arcade: { name: "Arcade Cabinet", tab: "furniture", price: 110, kind: "arcade", w: 0.8, h: 0.6 },
  telescope: { name: "Telescope", tab: "furniture", price: 65, kind: "telescope", w: 0.6, h: 0.5 },
  globe: { name: "Globe", tab: "furniture", price: 35, kind: "globe", w: 0.5, h: 0.45 },
  toyChest: { name: "Toy Chest", tab: "furniture", price: 30, kind: "toyChest", w: 0.9, h: 0.5 },
  catBed: { name: "Cat Bed (cat included)", tab: "furniture", price: 50, kind: "catBed", w: 0.75, h: 0.5, solid: false },
  catTree: { name: "Cat Tree (cat included)", tab: "furniture", price: 70, kind: "catTree", w: 0.6, h: 0.5 },

  // --- Plants ---
  plant: { name: "Potted Plant", tab: "plants", price: 10, kind: "plant", w: 0.6, h: 0.6 },
  monstera: { name: "Monstera", tab: "plants", price: 25, kind: "monstera", w: 0.6, h: 0.6 },
  monsteraAdansonii: { name: "Monstera Adansonii", tab: "plants", price: 26, kind: "monsteraAdansonii", w: 0.6, h: 0.5 },
  hoyaFinlaysonii: { name: "Hoya Finlaysonii", tab: "plants", price: 28, kind: "hoyaFinlaysonii", w: 0.6, h: 0.5 },
  anthuriumRed: { name: "Red Anthurium", tab: "plants", price: 24, kind: "anthurium", w: 0.6, h: 0.5, color: "#e84a5a" },
  anthuriumPink: { name: "Pink Anthurium", tab: "plants", price: 24, kind: "anthurium", w: 0.6, h: 0.5, color: "#f2a0b8" },
  fiddleFig: { name: "Fiddle-Leaf Fig", tab: "plants", price: 30, kind: "fiddleFig", w: 0.6, h: 0.6 },
  birdOfParadise: { name: "Bird of Paradise", tab: "plants", price: 40, kind: "birdOfParadise", w: 0.7, h: 0.6 },
  oliveTree: { name: "Olive Tree", tab: "plants", price: 40, kind: "oliveTree", w: 0.6, h: 0.6 },
  rubberPlant: { name: "Rubber Plant", tab: "plants", price: 28, kind: "rubberPlant", w: 0.6, h: 0.6 },
  moneyTree: { name: "Money Tree", tab: "plants", price: 30, kind: "moneyTree", w: 0.6, h: 0.6 },
  palm: { name: "Kentia Palm", tab: "plants", price: 28, kind: "palm", w: 0.6, h: 0.6 },
  lemonTree: { name: "Lemon Tree", tab: "plants", price: 35, kind: "lemonTree", w: 0.6, h: 0.6 },
  snakePlant: { name: "Snake Plant", tab: "plants", price: 18, kind: "snakePlant", w: 0.6, h: 0.6 },
  zzPlant: { name: "ZZ Plant", tab: "plants", price: 18, kind: "zzPlant", w: 0.6, h: 0.6 },
  alocasia: { name: "Alocasia", tab: "plants", price: 32, kind: "alocasia", w: 0.6, h: 0.6 },
  calathea: { name: "Calathea", tab: "plants", price: 24, kind: "calathea", w: 0.6, h: 0.6 },
  peaceLily: { name: "Peace Lily", tab: "plants", price: 22, kind: "peaceLily", w: 0.6, h: 0.6 },
  pilea: { name: "Pilea (Money Plant)", tab: "plants", price: 16, kind: "pilea", w: 0.5, h: 0.5 },
  philodendron: { name: "Heartleaf Philodendron", tab: "plants", price: 16, kind: "philodendron", w: 0.6, h: 0.5 },
  spiderPlant: { name: "Spider Plant", tab: "plants", price: 14, kind: "spiderPlant", w: 0.6, h: 0.5 },
  fern: { name: "Boston Fern", tab: "plants", price: 15, kind: "fern", w: 0.6, h: 0.6 },
  ivyPlant: { name: "Trailing Ivy", tab: "plants", price: 18, kind: "ivyPlant", w: 0.6, h: 0.5 },
  bamboo: { name: "Potted Bamboo", tab: "plants", price: 22, kind: "bamboo", w: 0.6, h: 0.5 },
  bonsai: { name: "Bonsai", tab: "plants", price: 30, kind: "bonsai", w: 0.6, h: 0.5 },
  jadePlant: { name: "Jade Plant", tab: "plants", price: 14, kind: "jadePlant", w: 0.5, h: 0.5 },
  aloeVera: { name: "Aloe Vera", tab: "plants", price: 12, kind: "aloeVera", w: 0.5, h: 0.5 },
  cactus: { name: "Tall Cactus", tab: "plants", price: 20, kind: "cactus", w: 0.6, h: 0.6 },
  succulents: { name: "Succulent Dish", tab: "plants", price: 12, kind: "succulents", w: 0.6, h: 0.5 },
  orchid: { name: "Pink Orchid", tab: "plants", price: 26, kind: "orchid", w: 0.5, h: 0.5 },
  lavenderPot: { name: "Lavender", tab: "plants", price: 14, kind: "lavenderPot", w: 0.5, h: 0.5 },
  herbGarden: { name: "Herb Garden", tab: "plants", price: 20, kind: "herbGarden", w: 0.9, h: 0.4 },
  terrarium: { name: "Terrarium", tab: "plants", price: 24, kind: "terrarium", w: 0.5, h: 0.5 },
  pampasVase: { name: "Pampas Grass Vase", tab: "plants", price: 22, kind: "pampasVase", w: 0.5, h: 0.5 },
  tulipVase: { name: "Tulip Vase", tab: "plants", price: 16, kind: "tulipVase", w: 0.5, h: 0.45 },
  sunflowerVase: { name: "Sunflower Jug", tab: "plants", price: 16, kind: "sunflowerVase", w: 0.5, h: 0.45 },
  eucalyptusVase: { name: "Eucalyptus Bud Vase", tab: "plants", price: 14, kind: "eucalyptusVase", w: 0.45, h: 0.4 },
  cherryBlossom: { name: "Cherry Blossom Branch", tab: "plants", price: 24, kind: "cherryBlossom", w: 0.5, h: 0.45 },
  macramePothos: { name: "Macramé Pothos", tab: "plants", price: 20, kind: "macramePothos", w: 0.6, wall: true },
  stringOfPearls: { name: "String of Pearls", tab: "plants", price: 18, kind: "stringOfPearls", w: 0.5, wall: true },
  hangingFern: { name: "Hanging Fern", tab: "plants", price: 18, kind: "hangingFern", w: 0.6, wall: true },
  pothosShelf: { name: "Pothos Shelf", tab: "plants", price: 16, kind: "pothosShelf", w: 0.8, wall: true },
  airPlants: { name: "Air Plant Rack", tab: "plants", price: 14, kind: "airPlants", w: 0.8, wall: true },
  driedHerbs: { name: "Dried Herbs", tab: "plants", price: 12, kind: "driedHerbs", w: 0.9, wall: true },

  // --- Shelves ---
  bookshelf: { name: "Bookshelf", tab: "shelves", price: 35, kind: "bookshelf", w: 1.3, h: 0.5 },
  libraryShelf: { name: "Tall Library Shelf", tab: "shelves", price: 50, kind: "libraryShelf", w: 1.5, h: 0.45 },
  cubeShelf: { name: "Cube Shelf with Baskets", tab: "shelves", price: 40, kind: "cubeShelf", w: 1.0, h: 0.5 },
  ladderShelf: { name: "Ladder Shelf", tab: "shelves", price: 38, kind: "ladderShelf", w: 0.8, h: 0.4 },
  recordCrate: { name: "Record Crate", tab: "shelves", price: 25, kind: "recordCrate", w: 0.8, h: 0.5 },
  floatingBooks: { name: "Floating Book Shelf", tab: "shelves", price: 18, kind: "floatingBooks", w: 1.1, wall: true },
  candleShelf: { name: "Candle Shelf", tab: "shelves", price: 18, kind: "candleShelf", w: 1.0, wall: true },
  crystalShelf: { name: "Crystal Shelf", tab: "shelves", price: 22, kind: "crystalShelf", w: 1.0, wall: true },
  teaShelf: { name: "Tea Shelf with Mugs", tab: "shelves", price: 20, kind: "teaShelf", w: 1.0, wall: true },
  jarShelf: { name: "Shelf of Jars", tab: "shelves", price: 18, kind: "jarShelf", w: 1.2, wall: true },

  // --- Decor ---
  rugBerry: { name: "Berry Rug", tab: "decor", price: 20, kind: "rug", w: 2.4, h: 1.6, color: "#a8473a", solid: false },
  rugSage: { name: "Sage Rug", tab: "decor", price: 20, kind: "rug", w: 2.4, h: 1.6, color: "#6f8a6a", solid: false },
  rugHoney: { name: "Honey Rug", tab: "decor", price: 20, kind: "rug", w: 2.4, h: 1.6, color: "#c98f3c", solid: false },
  rugPlum: { name: "Plum Rug", tab: "decor", price: 20, kind: "rug", w: 2.4, h: 1.6, color: "#6f5a8c", solid: false },
  roundRugCream: { name: "Round Cream Rug", tab: "decor", price: 22, kind: "rug", w: 1.8, h: 1.4, color: "#e9dcc2", round: true, solid: false },
  roundRugTeal: { name: "Round Teal Rug", tab: "decor", price: 22, kind: "rug", w: 1.8, h: 1.4, color: "#4f8a8a", round: true, solid: false },
  heartRug: { name: "Heart Rug", tab: "decor", price: 26, kind: "rug", w: 1.6, h: 1.4, color: "#efa8bc", shape: "heart", solid: false },
  checkerRug: { name: "Checkered Rug", tab: "decor", price: 26, kind: "rug", w: 2.2, h: 1.5, color: "#b9d6a4", shape: "checker", solid: false },
  fluffyRug: { name: "Fluffy Cloud Rug", tab: "decor", price: 28, kind: "rug", w: 2.0, h: 1.4, color: "#f7f1e6", shape: "fluffy", solid: false },
  floorLamp: { name: "Floor Lamp", tab: "decor", price: 25, kind: "floorLamp", w: 0.4, h: 0.4 },
  mushroomLamp: { name: "Mushroom Lamp", tab: "decor", price: 28, kind: "mushroomLamp", w: 0.5, h: 0.45 },
  moonLamp: { name: "Moon Lamp", tab: "decor", price: 24, kind: "moonLamp", w: 0.45, h: 0.4 },
  lavaLamp: { name: "Lava Lamp", tab: "decor", price: 22, kind: "lavaLamp", w: 0.4, h: 0.4 },
  candles: { name: "Candle Cluster", tab: "decor", price: 12, kind: "candles", w: 0.6, h: 0.4 },
  discoBall: { name: "Little Disco Ball", tab: "decor", price: 24, kind: "discoBall", w: 0.5, h: 0.45 },
  wavyMirror: { name: "Wavy Mirror", tab: "decor", price: 40, kind: "wavyMirror", w: 0.6, h: 0.3 },
  archMirror: { name: "Arched Floor Mirror", tab: "decor", price: 45, kind: "archMirror", w: 0.8, h: 0.3 },
  teddyBear: { name: "Big Teddy Bear", tab: "decor", price: 30, kind: "teddyBear", w: 0.6, h: 0.5 },
  blanketBasket: { name: "Blanket Basket", tab: "decor", price: 20, kind: "blanketBasket", w: 0.7, h: 0.45 },
  yarnBasket: { name: "Yarn Basket", tab: "decor", price: 15, kind: "yarnBasket", w: 0.55, h: 0.4 },
  bookStacks: { name: "Book Stacks", tab: "decor", price: 12, kind: "bookStacks", w: 0.7, h: 0.4 },
  floorCushions: { name: "Floor Cushions", tab: "decor", price: 20, kind: "floorCushions", w: 1.0, h: 0.6, solid: false },
  pumpkins: { name: "Pumpkins & Candle", tab: "decor", price: 15, kind: "pumpkins", w: 0.6, h: 0.5 },
  rainWindow: { name: "Rainy Window", tab: "decor", price: 40, kind: "rainWindow", w: 1.2, wall: true },
  lakeWindow: { name: "Lake Window", tab: "decor", price: 45, kind: "lakeWindow", w: 1.0, wall: true },
  moonWindow: { name: "Moon Window", tab: "decor", price: 50, kind: "moonWindow", w: 0.8, wall: true },
  leafWindow: { name: "Autumn Window", tab: "decor", price: 50, kind: "leafWindow", w: 0.9, wall: true },
  stringLights: { name: "String Lights", tab: "decor", price: 20, kind: "lights", w: 2.0, wall: true },
  fairyCurtain: { name: "Fairy Light Curtain", tab: "decor", price: 30, kind: "fairyCurtain", w: 1.4, wall: true },
  polaroidWall: { name: "Polaroid String", tab: "decor", price: 18, kind: "polaroidWall", w: 1.4, wall: true },
  tapestry: { name: "Boho Tapestry", tab: "decor", price: 28, kind: "tapestry", w: 1.2, wall: true },
  neonSign: { name: 'Neon "cozy" Sign', tab: "decor", price: 40, kind: "neonSign", w: 0.9, wall: true },
  heartNeon: { name: "Neon Heart", tab: "decor", price: 35, kind: "heartNeon", w: 0.7, wall: true },
  paintingFlowers: { name: "Flower Painting", tab: "decor", price: 15, kind: "picture", art: "flowers", w: 0.9, wall: true },
  paintingSea: { name: "Sea Painting", tab: "decor", price: 15, kind: "picture", art: "sea", w: 0.9, wall: true },
  paintingHills: { name: "Hills Painting", tab: "decor", price: 15, kind: "picture", art: "hills", w: 0.9, wall: true },
  posterStars: { name: "Night Sky Poster", tab: "decor", price: 12, kind: "poster", art: "stars", w: 0.7, wall: true },
  posterMountains: { name: "Mountain Poster", tab: "decor", price: 12, kind: "poster", art: "mountains", w: 0.7, wall: true },
  posterCat: { name: "Cat Poster", tab: "decor", price: 12, kind: "poster", art: "cat", w: 0.7, wall: true },
  worldMap: { name: "World Map", tab: "decor", price: 25, kind: "worldMap", w: 1.3, wall: true },
  corkBoard: { name: "Cork Board", tab: "decor", price: 15, kind: "corkBoard", w: 1.2, wall: true },
  clock: { name: "Wall Clock", tab: "decor", price: 20, kind: "clock", w: 0.5, wall: true, centered: true },
  mirror: { name: "Mirror", tab: "decor", price: 25, kind: "mirror", w: 0.7, wall: true, short: true },
  scroll: { name: "Calligraphy Scroll", tab: "decor", price: 15, kind: "scroll", w: 0.55, wall: true },

  // --- Starter pieces every bedroom comes with (not sold) ---
  starterDesk: { name: "Laptop Desk", tab: null, price: 0, kind: "laptopDesk", w: 1.3, h: 0.6, keep: true },
  starterMattress: { name: "Plain Mattress", tab: null, price: 0, kind: "mattress", w: 1.4, h: 2.1, sleep: true, solid: false, ownerColor: true },
};

// Where the starter pieces go in a brand new bedroom (from its top-left
// corner). They can be moved like anything else; the laptop desk can't be
// put away, since the laptop is how you get to Decorate.
const STARTERS = [
  { item: "starterDesk", x: 0.15, y: 0.1 },
  { item: "starterMattress", x: 2.05, y: 0.15 },
];
const DOOR_LANE = { x: 0.8, y: BEDROOM_DEPTH - 1.1, w: 2.0, h: 1.1 }; // kept clear so you can always get in

const MAX_DECOR = 80; // pieces per bedroom

// A bedroom's decor from before the starter pieces could be moved has no
// laptop desk in it: give it the desk (and the mattress, unless there's a
// bed) in their usual spots.
function withStarters(placed) {
  if (placed.some((p) => p.item === "starterDesk")) return placed;
  const hasBed = placed.some((p) => DECOR[p.item]?.sleep);
  return [STARTERS[0], ...(hasBed ? [] : [STARTERS[1]]), ...placed];
}

// True if a piece of decor { item, x, y } can go at that spot in a bedroom
// of this size, given what's already placed (skipping index `skip`, the
// piece being moved). Pieces must be inside the room, and floor pieces
// can't overlap each other or the doorway (rugs can go under anything).
// Wall pieces can't overlap each other.
function decorFits(size, placed, piece, skip = -1) {
  const item = Object.hasOwn(DECOR, piece?.item) ? DECOR[piece.item] : null;
  if (!item || !Number.isFinite(piece.x) || (!item.wall && !Number.isFinite(piece.y))) return false;
  const width = bedroomWidth(size);
  if (piece.x < 0 || piece.x + item.w > width + 1e-9) return false;
  const others = placed.filter((p, i) => i !== skip && Object.hasOwn(DECOR, p.item));
  if (item.wall) {
    return !others.some((p) => DECOR[p.item].wall && piece.x < p.x + DECOR[p.item].w && piece.x + item.w > p.x);
  }
  if (piece.y < 0 || piece.y + item.h > BEDROOM_DEPTH + 1e-9) return false;
  if (item.kind === "rug") return true;
  const box = { x: piece.x, y: piece.y, w: item.w, h: item.h };
  if (rectsOverlap(box, DOOR_LANE)) return false;
  return !others.some((p) => {
    const o = DECOR[p.item];
    return !o.wall && o.kind !== "rug" && rectsOverlap(box, { x: p.x, y: p.y, w: o.w, h: o.h });
  });
}

// Keeps only the pieces that fit, in order (used for decor that comes in
// from friends, and when a room shrinks).
function tidyDecor(size, placed) {
  const kept = [];
  const pieces = withStarters(Array.isArray(placed) ? placed.slice(0, MAX_DECOR) : []);
  for (const piece of pieces) {
    const clean = { item: String(piece?.item), x: Number(piece?.x), y: Number(piece?.y) };
    if (decorFits(size, kept, clean)) kept.push(clean);
  }
  return kept;
}

// Turns a placed piece of decor { item, x, y } (x and y from the room's
// top-left corner) into furniture at (x0, top), the room's corner.
// `owner` is the bedroom's info (for its color, and whether it's yours).
function decorPiece(piece, x0, top, owner, index) {
  const { name, tab, price, wall, centered, ownerColor, keep, ...look } = DECOR[piece.item];
  return {
    ...look,
    x: x0 + piece.x + (centered ? look.w / 2 : 0),
    y: wall ? top : top + piece.y,
    h: wall ? undefined : look.h,
    color: ownerColor ? owner.color : look.color,
    solid: wall ? false : look.solid,
    mine: owner.mine, // (the laptop desk opens only for its owner)
    decor: { index, mine: owner.mine }, // so its owner can pick it back up
  };
}

// What's in a bedroom: everything placed in it, starting with the laptop
// desk and (until you put it away) the plain mattress.
const BEDROOM_FURNITURE = (x0, top, bedroom) => withStarters(bedroom.decor || []).map((piece, index) => decorPiece(piece, x0, top, bedroom, index));

// The bed (or mattress) a player is lying in (their center is on it), or null.
function bedAt(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.sleep && cx >= f.x + 0.15 && cx <= f.x + f.w - 0.15 && cy >= f.y + 0.5 && cy <= f.y + f.h) || null;
}

// True if the player is standing at their own bedroom's laptop desk.
function isNearMyLaptop(player) {
  const desk = FURNITURE.find((f) => f.kind === "laptopDesk" && f.mine);
  if (!desk) return false;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return cx > desk.x - 0.3 && cx < desk.x + desk.w + 0.3 && cy > desk.y && cy < desk.y + desk.h + 1.0;
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

// What pressing E would do right here: talk to the raccoons, open your
// laptop, make an office or bedroom at a "+" door, or nothing. If both are in reach (the
// raccoons stand near the third office's doorway), whichever is closer wins.
function nearestInteraction(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const options = [];
  if (isNearRaccoons(player)) {
    const r = FURNITURE.find((f) => f.kind === "raccoons");
    options.push(["raccoons", Math.hypot(cx - (r.x + r.w / 2), cy - (r.y + r.h / 2))]);
  }
  if (isNearMyLaptop(player)) options.push(["laptop", 0]);
  if (elevatorInReach(player) >= 0) options.push(["elevator", 0]);
  const deck = FURNITURE.find((f) => f.kind === "turntable");
  const deckDistance = Math.hypot(cx - (deck.x + deck.w / 2), cy - (deck.y + deck.h / 2));
  if (deckDistance < 1.2) options.push(["turntable", deckDistance]);
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
