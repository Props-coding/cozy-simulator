// The house layout: rooms, walls, and movement/collision logic.
// Positions here are in "grid units" (one grid unit = one floor tile), not
// screen pixels. render.js turns a grid position into a screen pixel
// position. Keeping that math in one place (render.js) is what keeps
// every object's positioning in sync; this file never touches pixels.
//
// Three floors, joined by an elevator at the east end of each:
//
// 1. Ground floor: a hallway runs across the middle of the house. Theater,
//    Study and Dinner hang below it (south), each with a doorway up into
//    the hallway, and the Library above its east end (north). South of the
//    hallway's east end is the elevator lobby, with a bit of garden below.
// 2. Business floor: a corridor with the Conference Room and the offices
//    on its north side, and the Workshop and the elevator lobby on its
//    south side. The rest is roof.
// 3. Bedroom hall: everyone's bedroom door along its north wall. Each
//    bedroom is its own little map behind its door. The upstairs is
// Each floor is kept further down the same grid (UPSTAIRS units lower
// than the one before), so floors never overlap and all the walking and room rules work the same
// on both. Only the floor you're on is drawn.
//
// Offices and bedrooms come and go as their owners join and leave, so the
// room and wall lists below get rebuilt when that happens (see buildHouse).

const WALL_THICKNESS = 0.4;
const HOUSE_WIDTH = 24; // how far east the house (and hallway) reaches
const UPSTAIRS = 40; // how much further down the grid each floor is kept than the one below it
// The corridors' top edges on the upper floors (the walls with the doors
// in them). They sit a little lower than the ground floor's hallway does,
// which leaves room for the rooms north of them.
const BUSINESS = UPSTAIRS + 3; // the business floor (floor 2)
const LANDING = 2 * UPSTAIRS + 3; // the bedroom hall (floor 3)

// Which floor a grid y position is on: 0 the ground floor, 1 business,
// 2 the bedroom hall, and 3 and up for the bedrooms (each is its own
// little map, see bedroomSpot).
function floorOf(y) {
  return Math.max(YARD_FLOOR, Math.floor((y + UPSTAIRS / 2) / UPSTAIRS));
}

// The yard (Update 4): the outdoors behind the house, on its own map one
// "floor" above the ground floor on the grid (floor -1), the same size as a
// floor so the view doesn't change size when you step outside. You get
// there through the kitchen door (the bottom of Dinner) or the front door
// (the bottom of the elevator lobby). In the yard, the house's back wall
// runs along the top, with a porch along it.
const YARD_FLOOR = -1;
const YARD = YARD_FLOOR * UPSTAIRS; // add this to a yard spot's y (so "YARD + 2" is 2 tiles down the yard)

// Open floor areas, in grid units, used to figure out which room the
// player is standing in. Order matters: checked top to bottom, first
// match wins. "sign" is where the room's little wooden sign hangs, over
// its doorway: x is the doorway's middle, y the middle of the wall it's in.
// (The icon on it comes from CONFIG.roomIcons.)
const BASE_ROOMS = [
  { id: "theater", name: CONFIG.roomNames.theater, rect: { x: 0, y: 3, w: 6, h: 8 }, sign: { x: 5, y: 3 } },
  { id: "study", name: CONFIG.roomNames.study, rect: { x: 6, y: 3, w: 6, h: 8 }, sign: { x: 9, y: 3 } },
  { id: "dinner", name: CONFIG.roomNames.dinner, rect: { x: 12, y: 3, w: 6, h: 8 }, sign: { x: 15, y: 3 } },
  // North side: the Library at the east end.
  { id: "library", name: CONFIG.roomNames.library, rect: { x: 18, y: -5.4, w: 6, h: 5 }, sign: { x: 21, y: -WALL_THICKNESS / 2 }, north: true },
  // The elevator lobby, south of the hallway's east end (the same spot on both floors).
  { id: "elevator", name: CONFIG.roomNames.elevator, rect: { x: 18, y: 3, w: 6, h: 4 }, sign: { x: 20, y: 3 } },
  // The business floor: the Conference Room north of the corridor's west
  // end (the offices are beside it), and the Workshop south of it (a place
  // to make things together, with the house's project boards on its wall).
  { id: "conference", name: CONFIG.roomNames.conference, rect: { x: 0, y: BUSINESS - 5.4, w: 5.6, h: 5 }, sign: { x: 2.8, y: BUSINESS - WALL_THICKNESS / 2 }, north: true },
  { id: "workshop", name: CONFIG.roomNames.workshop, rect: { x: 0, y: BUSINESS + 3, w: 8, h: 5 }, sign: { x: 6.2, y: BUSINESS + 3 } },
  // The business corridor and the bedroom hall are added in buildHouse;
  // here are their elevator lobbies.
  { id: "elevatorUp", name: CONFIG.roomNames.elevator, rect: { x: 18, y: BUSINESS + 3, w: 6, h: 4 }, sign: { x: 20, y: BUSINESS + 3 } },
  { id: "elevatorTop", name: CONFIG.roomNames.elevator, rect: { x: 18, y: LANDING + 3, w: 6, h: 4 }, sign: { x: 20, y: LANDING + 3 } },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
// (The corridors' top walls have doorways for the rooms north of them,
// so they're made in buildHouse instead.)
const BASE_WALLS = [
  // Outer walls
  // bottom (drawn short so it doesn't hide the rooms), with the kitchen
  // door out to the yard at the bottom of Dinner (x 14.2 to 15.8)
  { x: -WALL_THICKNESS, y: 11, w: 14.2 + WALL_THICKNESS, h: WALL_THICKNESS, low: true },
  { x: 15.8, y: 11, w: 18 - 15.8 + WALL_THICKNESS, h: WALL_THICKNESS, low: true },
  { x: -WALL_THICKNESS, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 11.4 + WALL_THICKNESS }, // left, from the hallway down to the bottom
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
  // (drawn short so it doesn't hide the lobby), with the front door out to
  // the yard (x 20.2 to 21.8)
  { x: 18 - WALL_THICKNESS / 2, y: 7 - WALL_THICKNESS / 2, w: 20.2 - 18 + WALL_THICKNESS / 2, h: WALL_THICKNESS, low: true },
  { x: 21.8, y: 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 21.8 + WALL_THICKNESS, h: WALL_THICKNESS, low: true },

  // The business floor: the Conference Room's north wall, left side and
  // right side, the corridor's sides and bottom (with a doorway into its
  // elevator lobby, x 19.2 to 20.8), and the lobby's walls. The
  // corridor's top wall has the doorways, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: BUSINESS - 5.8, w: 6, h: WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: BUSINESS - 5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: 5.6, y: BUSINESS - 5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: -WALL_THICKNESS, y: BUSINESS - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: BUSINESS - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  // (the landing's bottom wall has the Workshop's doorway, x 5.4 to 7.0)
  { x: -WALL_THICKNESS, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: 5.4 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 7.0, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: 12.2, h: WALL_THICKNESS },
  // The Workshop: its left side, its right side, and its bottom (drawn short).
  { x: -WALL_THICKNESS, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 5 + WALL_THICKNESS * 1.5 },
  { x: 8 - WALL_THICKNESS / 2, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 5 + WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: BUSINESS + 8, w: 8 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },
  { x: 20.8, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: BUSINESS + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

  // The bedroom hall: its sides and bottom (with a doorway into its
  // elevator lobby, x 19.2 to 20.8), and the lobby's walls. The hall's top
  // wall holds the bedroom doors, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: LANDING - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: LANDING - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: -WALL_THICKNESS, y: LANDING + 3 - WALL_THICKNESS / 2, w: 19.2 + WALL_THICKNESS, h: WALL_THICKNESS, low: true },
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
  // in the bottom-right corner. (The Conference Room and offices used to
  // open off this wall; they're on the business floor now.)
  { kind: "rug", x: 1.5, y: 0.95, w: 21, h: 0.95, color: "#b5603c", solid: false },
  { kind: "coatHooks", x: 0.3, y: 0, w: 1.1, solid: false },
  { kind: "boots", x: 0.4, y: 0.15, w: 0.9, h: 0.35, solid: false },
  { kind: "sconce", x: 1.7, y: 0, solid: false },
  { kind: "weatherWindow", x: 2.25, y: 0, w: 1.2, solid: false }, // (shows the real weather outside, see weather.js)
  { kind: "sconce", x: 3.9, y: 0, solid: false },
  { kind: "picture", x: 4.55, y: 0, w: 0.9, art: "flowers", solid: false },
  { kind: "bench", x: 4.25, y: 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 6.4, y: 0, solid: false },
  { kind: "mirror", x: 9.45, y: 0, w: 0.7, short: true, solid: false },
  { kind: "console", x: 8.9, y: 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 12.85, y: 0, solid: false },
  // A grandfather clock showing the real (local) time; it chimes on the hour.
  { kind: "grandfatherClock", x: 13.4, y: 0.05, w: 0.75, h: 0.45 },
  { kind: "sconce", x: 14.6, y: 0, solid: false },
  { kind: "weatherWindow", x: 15.3, y: 0, w: 1.2, solid: false },
  { kind: "sconce", x: 17.1, y: 0, solid: false },
  { kind: "picture", x: 18.6, y: 0, w: 1.1, art: "sea", solid: false },
  { kind: "sconce", x: 22.3, y: 0, solid: false },
  { kind: "picture", x: 23.0, y: 0, w: 0.75, art: "hills", solid: false },
  { kind: "fiddleFig", x: 23.3, y: 2.05, w: 0.6, h: 0.6 },
  // Three raccoons in a trenchcoat, lurking in the hallway's east corner
  // under the hills painting, clear of every door. They sell hats and
  // shoes for crumbs (walk up and press E; see shop.js).
  { kind: "raccoons", x: 23.15, y: 0.12, w: 0.65, h: 0.45 },

  // Conference Room (on the business floor, north of its corridor): a
  // rolling whiteboard at the front, a big table with
  // seats all round (stand on one to sit), a snake plant, and a coffee cart.
  { kind: "whiteboard", x: 1.0, y: BUSINESS - 5.3, w: 3.6, h: 0.3 },
  { kind: "conferenceTable", x: 1.0, y: BUSINESS - 3.8, w: 3.6, h: 1.4 },
  { kind: "chair", x: 1.3, y: BUSINESS - 4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 2.5, y: BUSINESS - 4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 3.7, y: BUSINESS - 4.45, w: 0.6, h: 0.6, facing: "down", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 1.3, y: BUSINESS - 2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 2.5, y: BUSINESS - 2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 3.7, y: BUSINESS - 2.35, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 0.3, y: BUSINESS - 3.4, w: 0.6, h: 0.6, facing: "right", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "chair", x: 4.7, y: BUSINESS - 3.4, w: 0.6, h: 0.6, facing: "left", sit: true, solid: false, seat: "#5a6272", back: "#454c5a" },
  { kind: "snakePlant", x: 0.15, y: BUSINESS - 5.3, w: 0.6, h: 0.6 },
  { kind: "teaCart", x: 4.3, y: BUSINESS - 1.5, w: 1.2, h: 0.6 },

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
  { kind: "elevatorDoor", x: 21.65, y: 3 + WALL_THICKNESS / 2, w: 1.1, floor: 0, solid: false },
  { kind: "sconce", x: 18.7, y: 3.2, solid: false },
  { kind: "rug", x: 20.8, y: 4.3, w: 2.8, h: 1.9, color: "#7a3b4a", round: true, solid: false },
  { kind: "bench", x: 18.3, y: 4.2, w: 1.5, h: 0.5 },
  { kind: "palm", x: 18.3, y: 6.0, w: 0.6, h: 0.6 },

  // The business floor's corridor: a slate runner, lamps between the
  // doorways (Conference Room x 2 to 3.6, offices 7 to 8.6, 11 to 12.6,
  // 15 to 16.6), a snake plant, and the elevator.
  { kind: "rug", x: 1.5, y: BUSINESS + 0.95, w: 21, h: 0.95, color: "#5f6b7a", solid: false },
  { kind: "sconce", x: 5.2, y: BUSINESS, solid: false },
  { kind: "sconce", x: 9.65, y: BUSINESS, solid: false },
  { kind: "sconce", x: 13.65, y: BUSINESS, solid: false },
  { kind: "picture", x: 18.4, y: BUSINESS, w: 1.1, art: "hills", solid: false },
  { kind: "sconce", x: 20.2, y: BUSINESS, solid: false },
  { kind: "snakePlant", x: 23.3, y: BUSINESS + 2.05, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.65, y: BUSINESS + 3 + WALL_THICKNESS / 2, w: 1.1, floor: 1, solid: false },

  // The Workshop: the house's project board (a big corkboard) and a tool
  // pegboard on the back wall, a long workbench with the "done jar" on it
  // and two stools, a rug, a toolbox, a lamp and a plant. Press E at the
  // corkboard to open the boards (kanban.js).
  { kind: "kanbanBoard", x: 0.3, y: BUSINESS + 3 + WALL_THICKNESS / 2, w: 3.7, solid: false },
  { kind: "pegboard", x: 4.1, y: BUSINESS + 3 + WALL_THICKNESS / 2, w: 1.2, solid: false },
  { kind: "sconce", x: 7.4, y: BUSINESS + 3 + WALL_THICKNESS / 2, solid: false },
  { kind: "rug", x: 0.8, y: BUSINESS + 5.4, w: 3.8, h: 2.2, color: "#8a6a4a", solid: false },
  { kind: "workbench", x: 1.0, y: BUSINESS + 5.6, w: 3.0, h: 0.75 },
  { kind: "stool", x: 1.6, y: BUSINESS + 6.45, w: 0.6, h: 0.6, color: "#c98a3a", solid: false },
  { kind: "stool", x: 2.9, y: BUSINESS + 6.45, w: 0.6, h: 0.6, color: "#6f8a6a", solid: false },
  { kind: "toolbox", x: 6.6, y: BUSINESS + 7.2, w: 0.8, h: 0.5 },
  { kind: "floorLamp", x: 5.4, y: BUSINESS + 7.3, w: 0.4, h: 0.4 },
  { kind: "monstera", x: 0.15, y: BUSINESS + 7.2, w: 0.6, h: 0.6 },
  { kind: "sconce", x: 18.7, y: BUSINESS + 3.2, solid: false },
  { kind: "rug", x: 20.8, y: BUSINESS + 4.3, w: 2.8, h: 1.9, color: "#4f5f7a", round: true, solid: false },
  { kind: "bench", x: 18.3, y: BUSINESS + 4.2, w: 1.5, h: 0.5 },
  { kind: "fern", x: 18.3, y: BUSINESS + 6.0, w: 0.6, h: 0.6 },

  // The bedroom hall: a runner down the middle and a cactus (the bedroom
  // doors and the lamps between them come from buildHouse), and its
  // elevator lobby.
  { kind: "rug", x: 1.5, y: LANDING + 0.95, w: 21, h: 0.95, color: "#6f5a8c", solid: false },
  { kind: "cactus", x: 0.15, y: LANDING + 2.05, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.65, y: LANDING + 3 + WALL_THICKNESS / 2, w: 1.1, floor: 2, solid: false },
  { kind: "sconce", x: 18.7, y: LANDING + 3.2, solid: false },
  { kind: "rug", x: 20.8, y: LANDING + 4.3, w: 2.8, h: 1.9, color: "#6f5a8c", round: true, solid: false },
  { kind: "bench", x: 18.3, y: LANDING + 4.2, w: 1.5, h: 0.5 },
  { kind: "palm", x: 18.3, y: LANDING + 6.0, w: 0.6, h: 0.6 },
];

// The elevator: one set of doors on each floor, in the same spot. Stand
// in front of the doors and press E to pick a floor.
// ELEVATOR_OPEN is how open each floor's doors are right now (0 shut, 1
// wide open), set by main.js while you ride and read when drawing.
const ELEVATOR_OPEN = [0, 0, 0];

// Where a bedroom's map is: its own "floor" further down the grid (map 0
// is floor 3, map 1 floor 4...), centered across the view like the house.
// x0 and top are its floor's top-left corner, w its width.
function bedroomSpot(door) {
  const w = bedroomWidth(door.size);
  return { x0: (HOUSE_WIDTH - w) / 2, top: (door.map + 3) * UPSTAIRS - 1.2, w };
}
const BEDROOM_DOOR_X = 1; // the doorway in a bedroom's front wall, from its left edge

// Stepping into someone's bedroom: just inside its doorway.
function bedroomEntry(door) {
  const { x0, top } = bedroomSpot(door);
  return { x: x0 + BEDROOM_DOOR_X + DOOR_WIDTH / 2 - PLAYER_SIZE / 2, y: top + BEDROOM_DEPTH - 1 };
}

// Walking out of a bedroom: back on the landing, in front of its door
// (or the middle of the landing if its door isn't there any more).
function bedroomExit(owner) {
  const f = FURNITURE.find((f) => f.kind === "bedroomDoor" && f.door.owner === owner);
  return f ? { x: f.x + f.w / 2 - PLAYER_SIZE / 2, y: LANDING + 0.35 } : { x: 8.7, y: LANDING + 1.2 };
}

// The bedroom door you're standing right in front of (its furniture
// piece, with .door from the server), or null.
function bedroomDoorInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.kind === "bedroomDoor" && cx > f.x - 0.2 && cx < f.x + f.w + 0.2 && cy > f.y && cy < f.y + 1.2) ?? null;
}

// The floor (0 or 1) of the elevator you're standing in front of, or -1.
function elevatorInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const door = FURNITURE.find((f) => f.kind === "elevatorDoor" && floorOf(f.y) === floorOf(player.y));
  if (!door) return -1;
  return cx > door.x - 0.2 && cx < door.x + door.w + 0.2 && cy > door.y && cy < door.y + 1.3 ? door.floor : -1;
}

// Where you step out on a floor (0, 1 or 2): just in front of its doors.
function elevatorArrival(toFloor) {
  const door = FURNITURE.find((f) => f.kind === "elevatorDoor" && f.floor === toFloor);
  return { x: door.x + door.w / 2 - PLAYER_SIZE / 2, y: door.y + 0.3 };
}

// --- The yard (Update 4) ---
// Everything outside, in yard spots (x across as in the house, y from the
// top of the yard, where the house's back wall is; YARD is added to y).
// Top: the house's back wall with its two doors, and a porch along its
// east half. Northwest: a clearing for the campfire. East: the fenced
// garden. Southwest: the pond. Southeast: the bus stop, on a sidewalk by
// the road along the bottom.
//
// The outdoor areas count as rooms (for room levels, voice rules and the
// room name on screen). "outdoor" marks them for drawing and sound. The
// plain "yard" is whatever's between them, so it's added last.
const YARD_ROOMS = [
  { id: "porch", name: CONFIG.roomNames.porch, rect: { x: 11.6, y: YARD - 5.4, w: 12.4, h: 2.4 }, outdoor: true },
  { id: "campfire", name: CONFIG.roomNames.campfire, rect: { x: 0, y: YARD - 5.4, w: 8.6, h: 5.6 }, outdoor: true },
  { id: "garden", name: CONFIG.roomNames.garden, rect: { x: 12.6, y: YARD - 1.6, w: 11.4, h: 6.4 }, outdoor: true },
  { id: "pond", name: CONFIG.roomNames.pond, rect: { x: 0, y: YARD + 2.4, w: 10.6, h: 7.2 }, outdoor: true },
  { id: "busStop", name: CONFIG.roomNames.busStop, rect: { x: 16.2, y: YARD + 6.8, w: 7.8, h: 3.2 }, outdoor: true },
];
const YARD_AREA = { id: "yard", name: CONFIG.roomNames.yard, rect: { x: 0, y: YARD - 5.4, w: HOUSE_WIDTH, h: 15.4 }, outdoor: true };

// The doors between the house and the yard. `house` is the doorway in the
// house's wall (x its left edge, top and bottom the wall's edges), `yard`
// the doorway in the house's back wall seen from the yard.
const YARD_DOORS = [
  { id: "kitchen", name: "Kitchen door", house: { x: 14.2, top: 11, bottom: 11 + WALL_THICKNESS }, yardX: 14.2 },
  { id: "front", name: "Front door", house: { x: 20.2, top: 7 - WALL_THICKNESS / 2, bottom: 7 + WALL_THICKNESS / 2 }, yardX: 20.2 },
];
const YARD_WALL_Y = YARD - 5.4; // the bottom edge of the house's back wall, seen from the yard

// Where walking through a door takes you, or null if you're not walking
// through one. From the house: stepping into the doorway puts you just
// outside the matching door in the yard; from the yard, walking up into a
// door puts you just inside.
function doorwayCrossing(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  for (const door of YARD_DOORS) {
    const inGap = (x) => cx > x + 0.15 && cx < x + DOOR_WIDTH - 0.15;
    if (floorOf(player.y) === 0 && inGap(door.house.x) && cy > door.house.top + 0.1 && cy < door.house.bottom + 1) {
      return { to: { x: door.yardX + DOOR_WIDTH / 2 - PLAYER_SIZE / 2, y: YARD_WALL_Y + 0.15 }, door, out: true };
    }
    if (floorOf(player.y) === YARD_FLOOR && inGap(door.yardX) && cy < YARD_WALL_Y - 0.05) {
      return { to: { x: door.house.x + DOOR_WIDTH / 2 - PLAYER_SIZE / 2, y: door.house.top - PLAYER_SIZE - 0.15 }, door, out: false };
    }
  }
  return null;
}

// The door you're walking toward (within a step of it), for the "Walk
// through to go outside" prompt.
function yardDoorNear(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return YARD_DOORS.find((door) => {
    if (floorOf(player.y) === 0) return cx > door.house.x - 0.3 && cx < door.house.x + DOOR_WIDTH + 0.3 && cy > door.house.top - 1.3 && cy < door.house.top + 0.2;
    return floorOf(player.y) === YARD_FLOOR && cx > door.yardX - 0.3 && cx < door.yardX + DOOR_WIDTH + 0.3 && cy < YARD_WALL_Y + 1.3;
  }) ?? null;
}

// The pond: an oval of water. It's solid (you can't walk on water), built
// from thin slices so its edge follows the oval, except where the dock
// reaches out over it from the east bank.
const POND = { cx: 4.8, cy: YARD + 5.9, rx: 3.6, ry: 2.4 };
const DOCK = { x: 7.0, y: YARD + 5.5, w: 2.6, h: 0.8 };
function pondSolids() {
  const slices = [];
  for (let y = POND.cy - POND.ry + 0.15; y < POND.cy + POND.ry - 0.15; y += 0.25) {
    const mid = y + 0.125, half = POND.rx * Math.sqrt(Math.max(0, 1 - ((mid - POND.cy) / POND.ry) ** 2)) - 0.2;
    if (half <= 0) continue;
    const left = POND.cx - half;
    let right = POND.cx + half;
    if (mid > DOCK.y - 0.1 && mid < DOCK.y + DOCK.h + 0.1) right = Math.min(right, DOCK.x); // the dock
    slices.push({ x: left, y, w: right - left, h: 0.25, hidden: true });
  }
  return slices;
}

// The yard's edges (invisible: the fence and trees show where they are),
// the house's back wall with the two doors in it, and the pond.
const YARD_WALLS = [
  { x: -WALL_THICKNESS, y: YARD - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // west edge
  { x: HOUSE_WIDTH, y: YARD - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // east edge
  { x: -WALL_THICKNESS, y: YARD + 10, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: WALL_THICKNESS, hidden: true }, // the curb (the road is beyond)
  // The house's back wall, with the kitchen door and the front door in it.
  { x: -WALL_THICKNESS, y: YARD - 5.8, w: 14.2 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 15.8, y: YARD - 5.8, w: 20.2 - 15.8, h: WALL_THICKNESS },
  { x: 21.8, y: YARD - 5.8, w: HOUSE_WIDTH - 21.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  ...pondSolids(),
];

// A straight run of fence from (x1, y1) to (x2, y2), in yard spots (one of
// them the same), as furniture. Along the page it's a row of pickets;
// down the page it's drawn from the side.
function fenceRun(x1, y1, x2, y2, style = "picket") {
  const across = y1 === y2;
  return across
    ? { kind: "fence", style, x: Math.min(x1, x2), y: YARD + y1 - 0.1, w: Math.abs(x2 - x1), h: 0.2 }
    : { kind: "fenceSide", style, x: x1 - 0.1, y: YARD + Math.min(y1, y2), w: 0.2, h: Math.abs(y2 - y1) };
}

// Flat things painted on the ground: paths (rectangles with rounded ends,
// in yard spots), the road and sidewalk, and the pond (see outdoors.js).
const YARD_PATHS = [
  { x: 17.2, y: -2.9, w: 1.6, h: 1.5 }, // porch steps down to the garden gate
  { x: 1.2, y: -2.8, w: 16.2, h: 0.9 }, // along the front of the porch, west to the campfire
  { x: 8.9, y: -2.4, w: 0.9, h: 8.2 }, // down to the pond's dock
  { x: 17.4, y: 4.6, w: 1.2, h: 2.6 }, // out of the garden's bottom gate
  { x: 9.2, y: 6.6, w: 14.2, h: 0.9 }, // along the bottom, from the pond to the bus stop
];

const YARD_FURNITURE = [
  // The house's back wall: the two doors (walk up into one to go in),
  // windows glowing warm from inside, and a lantern by each door.
  { kind: "yardDoor", x: 14.2, y: YARD_WALL_Y, w: 1.6, door: "kitchen", solid: false },
  { kind: "yardDoor", x: 20.2, y: YARD_WALL_Y, w: 1.6, door: "front", solid: false },
  { kind: "houseWindow", x: 0.9, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 3.5, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 6.1, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 8.7, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 11.7, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 17.4, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 22.5, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "porchLantern", x: 13.55, y: YARD_WALL_Y, solid: false },
  { kind: "porchLantern", x: 16.15, y: YARD_WALL_Y, solid: false },
  { kind: "porchLantern", x: 19.55, y: YARD_WALL_Y, solid: false },
  { kind: "porchLantern", x: 22.15, y: YARD_WALL_Y, solid: false },

  // The porch: a railing along its front (with the steps in the middle)
  // and its west end, doormats, a rocking chair and potted plants.
  { kind: "porchRail", x: 11.6, y: YARD - 3.2, w: 5.6, h: 0.2 },
  { kind: "porchRail", x: 18.8, y: YARD - 3.2, w: 5.2, h: 0.2 },
  { kind: "porchRailSide", x: 11.5, y: YARD - 5.4, w: 0.2, h: 2.4 },
  { kind: "porchSteps", x: 17.2, y: YARD - 3.1, w: 1.6, h: 0.5, solid: false },
  { kind: "doormat", x: 14.45, y: YARD - 5.3, w: 1.1, h: 0.45, solid: false },
  { kind: "doormat", x: 20.45, y: YARD - 5.3, w: 1.1, h: 0.45, solid: false },
  { kind: "rockingChair", x: 23.0, y: YARD - 4.95, w: 0.8, h: 0.6 },
  { kind: "fern", x: 16.3, y: YARD - 5.25, w: 0.6, h: 0.6 },
  { kind: "snakePlant", x: 19.3, y: YARD - 5.25, w: 0.6, h: 0.6 },

  // Flower beds along the house west of the porch.
  { kind: "flowerBed", x: 0.2, y: YARD - 5.35, w: 5.3, h: 0.5 },
  { kind: "flowerBed", x: 6.1, y: YARD - 5.35, w: 5.2, h: 0.5 },

  // The garden: a picket fence all round, with a gate at the top (under
  // the porch steps) and at the bottom (toward the bus stop).
  fenceRun(12.8, -1.4, 17.2, -1.4),
  fenceRun(18.8, -1.4, 23.8, -1.4),
  fenceRun(12.8, 4.6, 17.4, 4.6),
  fenceRun(18.6, 4.6, 23.8, 4.6),
  fenceRun(12.8, -1.4, 12.8, 4.6),
  fenceRun(23.8, -1.4, 23.8, 4.6),

  // The pond's dock, reeds and a few stones.
  { kind: "dock", ...DOCK, solid: false },
  { kind: "reeds", x: 1.0, y: YARD + 4.3, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 1.6, y: YARD + 7.9, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 6.9, y: YARD + 7.6, w: 0.6, h: 0.4, solid: false },
  { kind: "pondStones", x: 2.2, y: YARD + 3.3, w: 0.8, h: 0.4 },

  // The yard's west and south edges: a rustic fence (open at the bus stop).
  fenceRun(0.1, -4.6, 0.1, 9.3, "rail"),
  fenceRun(0.1, 9.3, 16.2, 9.3, "rail"),

  // Trees (big and leafy, or pines), bushes and a few flowers.
  { kind: "yardTree", x: 9.3, y: YARD - 3.75, w: 1.0, h: 0.55, n: 0 },
  { kind: "yardTree", x: 0.4, y: YARD + 0.55, w: 1.0, h: 0.55, n: 1 },
  { kind: "pineTree", x: 11.0, y: YARD + 1.2, w: 0.9, h: 0.5, n: 2 },
  { kind: "yardTree", x: 11.3, y: YARD + 8.4, w: 1.0, h: 0.55, n: 3 },
  { kind: "pineTree", x: 0.6, y: YARD + 9.3, w: 0.9, h: 0.5, n: 4 },
  { kind: "yardTree", x: 14.4, y: YARD + 8.3, w: 1.0, h: 0.55, n: 5 },
  { kind: "pineTree", x: 23.0, y: YARD + 5.9, w: 0.9, h: 0.5, n: 6 },
  { kind: "bush", x: 10.3, y: YARD + 4.9, w: 0.9, h: 0.55, n: 0 },
  { kind: "bush", x: 12.9, y: YARD + 5.4, w: 0.9, h: 0.55, n: 1 },
  { kind: "bush", x: 7.6, y: YARD - 0.3, w: 0.9, h: 0.55, n: 2 },
  { kind: "bush", x: 20.6, y: YARD + 5.3, w: 0.9, h: 0.55, n: 3 },
  { kind: "wildflowers", x: 3.1, y: YARD + 9.0, w: 1.1, h: 0.3, solid: false },
  { kind: "wildflowers", x: 12.2, y: YARD + 3.6, w: 0.5, h: 0.3, solid: false },
  { kind: "wildflowers", x: 21.3, y: YARD + 6.0, w: 1.0, h: 0.3, solid: false },

  // Signposts, so you know where you are.
  { kind: "signpost", x: 8.3, y: YARD - 1.4, w: 0.3, h: 0.2, text: "Campfire", point: "left" },
  { kind: "signpost", x: 10.05, y: YARD + 3.4, w: 0.3, h: 0.2, text: "Pond", point: "left" },
  { kind: "signpost", x: 19.1, y: YARD - 1.9, w: 0.3, h: 0.2, text: "Garden", point: "down" },
  { kind: "signpost", x: 16.3, y: YARD + 7.7, w: 0.3, h: 0.2, text: "Bus Stop", point: "right" },
];

// Where you pop back to in the yard (say the area you were in vanished):
// at the bottom of the porch steps.
const YARD_SPAWN = { x: 17.7, y: YARD - 2.3 };

// Is it night outside? Update 4's weather (weather.js) fills in OUTDOORS
// from the real sky over the hometown; until it has, night is guessed from
// this computer's clock (CONFIG.outdoors.nightFrom to nightTo).
const OUTDOORS = { night: null, sky: "clear", rain: 0, snow: 0, clouds: 0, temp: null, raining: false, words: "", updated: 0 };
function isNightOutside() {
  if (OUTDOORS.night !== null) return OUTDOORS.night;
  const hour = new Date().getHours();
  const { nightFrom, nightTo } = CONFIG.outdoors;
  return hour >= nightFrom || hour < nightTo;
}

// --- Seasonal decorations ---
// The shared rooms (hallways, Theater, Study, Dinner, Library) dress up
// for the season: little cutouts stuck along the hallway walls (bats and
// ghosts for Halloween in autumn, snowflakes, butterflies, suns), and a
// small and a big decoration in each room. Offices and bedrooms are left alone. The season
// comes from today's date (or CONFIG.season, or the admin panel's preview).
const SEASONS = ["spring", "summer", "autumn", "winter"];
const SEASONAL = {
  small: { autumn: "pumpkins", winter: "presents", spring: "eggBasket", summer: "sunflowerVase" },
  big: { autumn: "autumnCrate", winter: "winterTree", spring: "flowerPlanter", summer: "floorFan" },
  // Where they go (grid units), kept clear of doorways and furniture.
  spots: [
    { size: "small", x: 5.85, y: 0.12 }, // hallway, by the bench
    { size: "big", x: 18.9, y: 0.1 }, // hallway, under the sea painting
    { size: "small", x: 7.4, y: 9.8 }, // Study, by the beanbag
    { size: "big", x: 10.9, y: 8.7 }, // Study, beside the rug
    { size: "small", x: 13.65, y: 10.15 }, // Dinner, by the tea cart
    { size: "big", x: 16.9, y: 8.9 }, // Dinner, by the lemon tree
    { size: "small", x: 5.3, y: 9.2 }, // Theater, by the popcorn
    { size: "big", x: 1.0, y: 10.0 }, // Theater, back corner
    { size: "small", x: 20.8, y: -5.0 }, // Library, under the windows
    { size: "big", x: 22.9, y: -2.6 }, // Library, by the fern
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
  return SEASONAL.spots.map(({ size, x, y }) => ({ kind: SEASONAL[size][season], x, y, w: size === "big" ? 0.8 : 0.55, h: size === "big" ? 0.7 : 0.45 }));
}

// Cutouts along both hallways' back walls: roughly one every 3/4 tile,
// only on actual wall (not doorways) and clear of the lamps, pictures and
// doors already hanging there.
function seasonalWallDecor(walls, furniture) {
  const style = currentSeason();
  const decor = [];
  for (const corridor of [0, BUSINESS, LANDING]) {
    const taken = furniture.filter((f) => f.y === corridor).map((f) => [f.x - 0.12, f.x + (f.w ?? 0.3) + 0.12]);
    const stretches = walls.filter((w) => w.y === corridor - WALL_THICKNESS && w.h === WALL_THICKNESS);
    for (const wall of stretches) {
      for (let x = Math.max(0.1, wall.x + 0.15); x + 0.4 <= wall.x + wall.w - 0.05; x += 0.1) {
        if (taken.some(([a, b]) => x + 0.4 > a && x < b)) continue;
        decor.push({ kind: "wallCutout", style, n: decor.length, x, y: corridor, w: 0.4, solid: false });
        taken.push([x - 0.35, x + 0.75]); // keep the next one a little way along
      }
    }
  }
  return decor;
}

// --- Seats ---
// Where you can sit on each kind of furniture: a list of seat spots, each
// { x, y } as a fraction of the piece's footprint (0 to 1 across, 0 to 1
// down; y can go a little past 1 so you're drawn in front of a sofa's
// back) and which way you face. "front" means "the way the piece faces"
// (down, or right/left for a turned piece). Press E near a free spot to
// sit; moving gets you up. See CONFIG.sit for the reach.
const SEATS = {
  chair: [{ x: 0.5, y: 0.5, face: "own" }], // faces the way the chair does
  stool: [{ x: 0.5, y: 0.5, face: "up" }],
  theaterSeat: [{ x: 0.5, y: 0.5, face: "up" }],
  cinemaSofa: [{ x: 0.2, y: 0.55, face: "up" }, { x: 0.5, y: 0.55, face: "up" }, { x: 0.8, y: 0.55, face: "up" }],
  bench: [{ x: 0.28, y: 0.9, face: "front" }, { x: 0.72, y: 0.9, face: "front" }],
  loveseat: [{ x: 0.3, y: 0.95, face: "front" }, { x: 0.7, y: 0.95, face: "front" }],
  cloudSofa: [{ x: 0.22, y: 0.95, face: "front" }, { x: 0.5, y: 0.95, face: "front" }, { x: 0.78, y: 0.95, face: "front" }],
  armchair: [{ x: 0.5, y: 0.95, face: "front" }],
  cottageChair: [{ x: 0.5, y: 0.95, face: "front" }],
  papasanChair: [{ x: 0.5, y: 0.9, face: "front" }],
  eggChair: [{ x: 0.5, y: 0.9, face: "front" }],
  rockingChair: [{ x: 0.5, y: 0.9, face: "front" }],
  beanbag: [{ x: 0.5, y: 0.8, face: "front" }],
  pouf: [{ x: 0.5, y: 0.8, face: "front" }],
  mushroomStool: [{ x: 0.5, y: 0.8, face: "front" }],
  floorCushions: [{ x: 0.3, y: 0.8, face: "front" }, { x: 0.7, y: 0.8, face: "front" }],
  // Beds: sit on the edge, at the foot.
  bed: [{ x: 0.3, y: 0.95, face: "down" }, { x: 0.7, y: 0.95, face: "down" }],
  canopyBed: [{ x: 0.3, y: 0.95, face: "down" }, { x: 0.7, y: 0.95, face: "down" }],
  mattress: [{ x: 0.3, y: 0.95, face: "down" }, { x: 0.7, y: 0.95, face: "down" }],
};

// The seat spots on one piece of furniture, in grid units: { key, x, y,
// face }, where x, y is where you sit (your middle). A turned piece
// ("loveseatSide", facing right or left) gets its spots turned too.
function seatSpots(f) {
  const turned = f.kind.endsWith("Side");
  const kind = turned ? f.kind.slice(0, -4) : f.kind;
  const spots = SEATS[kind];
  if (!spots || f.h === undefined) return [];
  return spots.map((s, i) => {
    let fx = s.x, fy = s.y, face = s.face;
    if (face === "own") face = f.facing || "down";
    if (turned) {
      // Turned 90 degrees: along the piece's length is now down the page,
      // and "front" is toward the room (right or left).
      const right = f.facing === "right";
      fy = s.x;
      fx = right ? Math.min(1, s.y) : 1 - Math.min(1, s.y);
      if (face === "front" || face === "down") face = right ? "right" : "left";
      if (kind === "bed" || kind === "canopyBed" || kind === "mattress") {
        // A turned bed: still sit on its front edge, away from the headboard.
        fx = right ? 0.4 + s.x * 0.5 : 0.6 - s.x * 0.5;
        fy = 0.95;
        face = "down";
      }
    } else if (face === "front") {
      face = "down";
    }
    // Facing away on a seat with a tall back: you sit up so your head shows
    // over it ("upTall").
    if (face === "up" && (kind === "theaterSeat" || kind === "cinemaSofa" || kind === "chair")) face = "upTall";
    const x = f.x + f.w * fx, y = f.y + f.h * fy;
    return { key: `${floorOf(y)}:${Math.round(x * 20)}:${Math.round(y * 20)}`, x, y, face, n: i };
  });
}

// Every seat spot on a floor (0 downstairs, 1 upstairs).
function seatsOnFloor(floor) {
  return FURNITURE.filter((f) => floorOf(f.y) === floor).flatMap(seatSpots);
}

// --- Private rooms: offices ---
// Offices sit north of the hallway in up to three spots, filled left to
// right. When one is removed, the ones after it slide over to close the
// gap. The "+" door for making a new one is always on the wall at the
// next free spot. The layout:
//   slots: how many can exist at once. width: grid units per room,
//   including its wall. firstX: left edge of the first spot. floorY: the y
//   of the corridor wall they open onto (the hallway, or the landing).
//   doorX: where the doorway starts, from the room's left edge. depth: how
//   far north it reaches from the corridor.
const WINGS = {
  office: { slots: 3, width: 4, firstX: 6, floorY: BUSINESS, doorX: 1, depth: 5, name: "Office" },
};
const BEDROOM_DEPTH = 8; // every bedroom, from its back wall to its door
const DOOR_WIDTH = 1.6;

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
const houseTopY = -5.8; // the house's northern edge on each floor, from its corridor's top (for the camera)
const buildDoors = { office: null }; // left edge of each kind's next free spot, or null if all are taken

// offices: a list of { slot, since, ownerName, color, locked, mine },
// already in order (slot 1 first). An office's id comes from when it was
// made, so it stays the same when it slides to a different spot.
// doors: everyone's bedroom door, from the house server (see rooms.js),
// in the order they go along the landing.
let lastBuild = [[], []]; // what the house was last built with (see previewSeason)
function buildHouse(offices, doors = []) {
  lastBuild = [offices, doors];
  const t = WALL_THICKNESS;
  const rooms = [...BASE_ROOMS, ...YARD_ROOMS];
  const walls = [...BASE_WALLS, ...YARD_WALLS];
  const furniture = [...BASE_FURNITURE, ...seasonalFurniture(), ...YARD_FURNITURE];

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
      const inner = wing.width - t;
      const theme = officeThemeFor(info.ownerName);
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
      furniture.push(...(OFFICE_FURNITURE[theme] || OFFICE_FURNITURE.default)(x0, top, info));
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

  // The ground floor hallway's top wall, with a doorway into the Library
  // (x 20.2 to 21.8), and the business corridor's, with a doorway into the
  // Conference Room (x 2 to 3.6) and each office.
  corridorWall(0, [20.2]);
  corridorWall(BUSINESS, [2, ...offices.map((o) => wingX("office", o.slot) + WINGS.office.doorX)]);
  add("office", offices);

  // The bedroom hallway (the upstairs landing): one solid wall with every
  // member's bedroom door on it, and a warm lamp between each pair.
  corridorWall(LANDING, []);
  const { doorSpacing, firstDoorX } = CONFIG.bedrooms;
  const doorCount = Math.min(doors.length, Math.floor((HOUSE_WIDTH - firstDoorX) / doorSpacing));
  for (let i = 0; i < doorCount; i++) {
    const x = firstDoorX + i * doorSpacing;
    furniture.push({ kind: "bedroomDoor", x, y: LANDING, w: DOOR_WIDTH, door: doors[i], solid: false });
    if (i < doorCount - 1 || x + doorSpacing < HOUSE_WIDTH) furniture.push({ kind: "sconce", x: x + DOOR_WIDTH + (doorSpacing - DOOR_WIDTH) / 2 - 0.15, y: LANDING, solid: false });
  }

  // Each bedroom, on its own map: four walls with a doorway in the bottom
  // one (walk out of it and you're back on the landing), and everything
  // its owner has placed inside.
  for (const door of doors) {
    const { x0, top, w } = bedroomSpot(door);
    const bottom = top + BEDROOM_DEPTH;
    rooms.push({
      id: "bedroom-" + door.owner.toLowerCase(),
      name: `${door.owner}'s Bedroom`,
      rect: { x: x0, y: top, w, h: BEDROOM_DEPTH },
      owned: { kind: "bedroom", ownerName: door.owner, color: door.color, mine: !!door.mine, map: door.map },
      // Its look (see OFFICE_THEME_STYLE in render.js). Only the bedroom
      // styles; the personal office themes stay in offices.
      theme: ["classic", "cabin", "apartment", "beachHut"].includes(door.style) ? door.style : "classic",
      bedroom: true,
    });
    walls.push(
      { x: x0 - t, y: top - t, w: w + 2 * t, h: t }, // back wall
      { x: x0 - t, y: top - t, w: t, h: BEDROOM_DEPTH + 2 * t }, // left
      { x: x0 + w, y: top - t, w: t, h: BEDROOM_DEPTH + 2 * t }, // right
      { x: x0 - t, y: bottom, w: t + BEDROOM_DOOR_X, h: t }, // front, left of the doorway
      { x: x0 + BEDROOM_DOOR_X + DOOR_WIDTH, y: bottom, w: w - BEDROOM_DOOR_X - DOOR_WIDTH + t, h: t } // and right of it
    );
    const decor = door.mine ? door.placed : tidyDecor(door.size, door.placed);
    furniture.push(...BEDROOM_FURNITURE(x0, top, { color: door.color, mine: !!door.mine, decor }));
  }

  // The corridors are last, so rooms off them are found first. They have
  // no sign: the header already says where you are.
  rooms.push({ id: "hallway", name: CONFIG.roomNames.hallway, rect: { x: 0, y: 0, w: HOUSE_WIDTH, h: 3 } });
  rooms.push({ id: "business", name: CONFIG.roomNames.business, rect: { x: 0, y: BUSINESS, w: HOUSE_WIDTH, h: 3 } });
  rooms.push({ id: "landing", name: CONFIG.roomNames.landing, rect: { x: 0, y: LANDING, w: HOUSE_WIDTH, h: 3 } });
  rooms.push(YARD_AREA);

  furniture.push(...seasonalWallDecor(walls, furniture));
  ROOMS = rooms;
  WALLS = walls;
  FURNITURE = furniture;
  SOLIDS = [...walls, ...furniture.filter((f) => f.solid !== false)];
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
// A bedroom is "cozy" (8 wide) until the "Roomy" upgrade (bought at Nest
// & Nook) makes it 12 wide. Either way it's 8 deep, with the doorway at
// the bottom between x0 + 1 and x0 + 2.6. (Bedrooms used to be 4.1 and
// 5.6 wide, so everything placed back then still fits where it was.)
const BEDROOM_SIZES = { cozy: 8, roomy: 12 };
const ROOMY_PRICE = 150; // crumbs

function bedroomWidth(size) {
  return Object.hasOwn(BEDROOM_SIZES, size) ? BEDROOM_SIZES[size] : BEDROOM_SIZES.cozy;
}

// A piece of decor's footprint { w, h }. Pieces with `turn` can be turned
// to face right (r: 1, against the left wall) or left (r: 3, against the
// right wall), which swaps their width and depth.
function decorSize(piece) {
  const item = DECOR[piece.item];
  return piece.r && item.turn ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
}

// Everything Nest & Nook sells. `kind` is how it's drawn (see render.js),
// w and h its footprint in grid units, `tab` where it's listed in the
// store (furniture, plants, shelves or decor). `wall` items hang on the
// back wall. `sleep` means you can sleep in it. `ownerColor` uses the
// bedroom owner's color. Other fields (like color, art or shape) are
// passed on to the drawing.
const DECOR = {
  // --- Furniture ---
  quiltBed: { name: "Quilted Bed", tab: "furniture", price: 60, kind: "bed", w: 1.8, h: 2.3, sleep: true, solid: false, ownerColor: true , turn: true },
  canopyBed: { name: "Canopy Bed", tab: "furniture", price: 160, kind: "canopyBed", w: 1.8, h: 2.3, sleep: true, solid: false, ownerColor: true , turn: true },
  nightstand: { name: "Nightstand & Lamp", tab: "furniture", price: 20, kind: "nightstand", w: 0.55, h: 0.45 },
  wardrobe: { name: "Wardrobe", tab: "furniture", price: 45, kind: "wardrobe", w: 1.0, h: 0.6 , turn: true },
  dresser: { name: "Dresser", tab: "furniture", price: 45, kind: "dresser", w: 1.1, h: 0.5 , turn: true },
  vanity: { name: "Vanity with Bulb Mirror", tab: "furniture", price: 85, kind: "vanity", w: 1.2, h: 0.5 },
  clothesRack: { name: "Clothes Rack", tab: "furniture", price: 40, kind: "clothesRack", w: 1.2, h: 0.45 },
  cloudSofa: { name: "Cloud Sofa", tab: "furniture", price: 110, kind: "cloudSofa", w: 2.0, h: 0.85 , turn: true },
  loveseatSage: { name: "Sage Loveseat", tab: "furniture", price: 70, kind: "loveseat", w: 1.6, h: 0.8, color: "#7a9e8c" , turn: true },
  loveseatRose: { name: "Rose Loveseat", tab: "furniture", price: 70, kind: "loveseat", w: 1.6, h: 0.8, color: "#c98a8a" , turn: true },
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
  writingDesk: { name: "Writing Desk", tab: "furniture", price: 40, kind: "writingDesk", w: 1.3, h: 0.6 , turn: true },
  aestheticDesk: { name: "Aesthetic Desk", tab: "furniture", price: 75, kind: "aestheticDesk", w: 1.4, h: 0.6 , turn: true },
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
  hoyaCompacta: { name: "Hoya Compacta", tab: "plants", price: 26, kind: "hoyaCompacta", w: 0.6, h: 0.5 },
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
  hoyaPolyneura: { name: "Hoya Polyneura", tab: "plants", price: 24, kind: "hoyaPolyneura", w: 0.6, wall: true },
  pothosShelf: { name: "Pothos Shelf", tab: "plants", price: 16, kind: "pothosShelf", w: 0.8, wall: true },
  airPlants: { name: "Air Plant Rack", tab: "plants", price: 14, kind: "airPlants", w: 0.8, wall: true },
  driedHerbs: { name: "Dried Herbs", tab: "plants", price: 12, kind: "driedHerbs", w: 0.9, wall: true },

  // --- Shelves ---
  bookshelf: { name: "Bookshelf", tab: "shelves", price: 35, kind: "bookshelf", w: 1.3, h: 0.5 , turn: true },
  libraryShelf: { name: "Tall Library Shelf", tab: "shelves", price: 50, kind: "libraryShelf", w: 1.5, h: 0.45 , turn: true },
  cubeShelf: { name: "Cube Shelf with Baskets", tab: "shelves", price: 40, kind: "cubeShelf", w: 1.0, h: 0.5 , turn: true },
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
  starterDesk: { name: "Laptop Desk", tab: null, price: 0, kind: "laptopDesk", w: 1.3, h: 0.6, keep: true , turn: true },
  starterMattress: { name: "Plain Mattress", tab: null, price: 0, kind: "mattress", w: 1.4, h: 2.1, sleep: true, solid: false, ownerColor: true , turn: true },
  // The nightstand with your journal on it (press E there). It stays in your room.
  starterNightstand: { name: "Journal Nightstand", tab: null, price: 0, kind: "nightstand", w: 0.55, h: 0.45, keep: true, journal: true },
  // The bedroom phone, on the back wall (press E there to call a friend). It stays in your room.
  starterPhone: { name: "Bedroom Phone", tab: null, price: 0, kind: "wallPhone", w: 0.45, wall: true, keep: true },
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
  const { w, h } = decorSize(piece);
  if (piece.x < 0 || piece.x + w > width + 1e-9) return false;
  const others = placed.filter((p, i) => i !== skip && Object.hasOwn(DECOR, p.item));
  if (item.wall) {
    return !others.some((p) => DECOR[p.item].wall && piece.x < p.x + DECOR[p.item].w && piece.x + w > p.x);
  }
  if (piece.y < 0 || piece.y + h > BEDROOM_DEPTH + 1e-9) return false;
  if (item.kind === "rug") return true;
  const box = { x: piece.x, y: piece.y, w, h };
  if (rectsOverlap(box, DOOR_LANE)) return false;
  return !others.some((p) => {
    const o = DECOR[p.item];
    return !o.wall && o.kind !== "rug" && rectsOverlap(box, { x: p.x, y: p.y, ...decorSize(p) });
  });
}

// Keeps only the pieces that fit, in order (used for decor that comes in
// from friends, and when a room shrinks).
function tidyDecor(size, placed) {
  const kept = [];
  const pieces = withStarters(Array.isArray(placed) ? placed.slice(0, MAX_DECOR) : []);
  for (const piece of pieces) {
    const clean = { item: String(piece?.item), x: Number(piece?.x), y: Number(piece?.y) };
    if (piece?.r === 1 || piece?.r === 3) clean.r = piece.r; // turned to face right or left
    if (decorFits(size, kept, clean)) kept.push(clean);
  }
  if (!kept.some((p) => p.item === "starterNightstand")) {
    const spot = nightstandSpot(size, kept);
    if (spot) kept.push(spot);
  }
  if (!kept.some((p) => p.item === "starterPhone")) {
    const spot = phoneSpot(size, kept);
    if (spot) kept.push(spot);
  }
  return kept;
}

// Rooms from before the phone get it on the back wall: the first free
// spot from the right-hand end (the bed and desk tend to be on the left).
function phoneSpot(size, placed) {
  const { w } = DECOR.starterPhone;
  for (let x = bedroomWidth(size) - w - 0.3; x >= 0.1; x -= 0.25) {
    const piece = { item: "starterPhone", x: Math.round(x * 100) / 100, y: 0 };
    if (decorFits(size, placed, piece)) return piece;
  }
  return null;
}

// Rooms from before the journal get its nightstand in a free spot: by the
// head of the bed if there's room (right side, then left), otherwise the
// first free spot along the back of the room.
function nightstandSpot(size, placed) {
  const { w, h } = DECOR.starterNightstand;
  const tryAt = (x, y) => {
    const piece = { item: "starterNightstand", x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    return decorFits(size, placed, piece) ? piece : null;
  };
  const bedPiece = placed.find((p) => DECOR[p.item]?.sleep);
  if (bedPiece) {
    const bed = decorSize(bedPiece);
    const spot = tryAt(bedPiece.x + bed.w + 0.05, bedPiece.y + 0.1) || tryAt(bedPiece.x - w - 0.05, bedPiece.y + 0.1);
    if (spot) return spot;
  }
  for (let y = 0.1; y + h <= BEDROOM_DEPTH; y += 0.25) {
    for (let x = 0.1; x + w <= bedroomWidth(size); x += 0.25) {
      const spot = tryAt(x, y);
      if (spot) return spot;
    }
  }
  return null;
}

// Turns a placed piece of decor { item, x, y, r } (x and y from the room's
// top-left corner, r if it's turned) into furniture at (x0, top), the
// room's corner. `owner` is the bedroom's info (for its color, and
// whether it's yours). A turned piece is drawn by its side-view drawer
// (like "wardrobeSide"), facing right or left.
function decorPiece(piece, x0, top, owner, index) {
  const { name, tab, price, wall, centered, ownerColor, keep, turn, ...look } = DECOR[piece.item];
  const turned = turn && (piece.r === 1 || piece.r === 3);
  const { w, h } = decorSize(piece);
  return {
    ...look,
    ...(turned ? { kind: look.kind + "Side", facing: piece.r === 1 ? "right" : "left", w } : {}),
    x: x0 + piece.x + (centered ? look.w / 2 : 0),
    y: wall ? top : top + piece.y,
    h: wall ? undefined : h,
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
  return (
    FURNITURE.find((f) => {
      if (!f.sleep) return false;
      // (Past the headboard: at the top, or at the side for a turned bed.)
      if (f.facing === "right") return cx >= f.x + 0.5 && cx <= f.x + f.w && cy >= f.y + 0.15 && cy <= f.y + f.h - 0.15;
      if (f.facing === "left") return cx >= f.x && cx <= f.x + f.w - 0.5 && cy >= f.y + 0.15 && cy <= f.y + f.h - 0.15;
      return cx >= f.x + 0.15 && cx <= f.x + f.w - 0.15 && cy >= f.y + 0.5 && cy <= f.y + f.h;
    }) || null
  );
}

// True if the player is right next to a nightstand in their own bedroom
// (where the journal is).
function isNearMyNightstand(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.some((f) => f.kind === "nightstand" && f.mine && floorOf(f.y) === floorOf(player.y) && Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - f.h)) < 0.7);
}

// The phone on your own bedroom's wall, if you're standing right below it.
function myPhoneInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.kind === "wallPhone" && f.mine && floorOf(f.y) === floorOf(player.y) && cx > f.x - 0.35 && cx < f.x + f.w + 0.35 && cy > f.y && cy < f.y + 1.1) ?? null;
}

// True if the player is standing at their own bedroom's laptop desk.
function isNearMyLaptop(player) {
  const desk = FURNITURE.find((f) => (f.kind === "laptopDesk" || f.kind === "laptopDeskSide") && f.mine);
  if (!desk) return false;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  // Stand in front of it: below it, or beside it if it's been turned.
  const alongside = cy > desk.y - 0.3 && cy < desk.y + desk.h + 0.3;
  if (desk.facing === "right") return alongside && cx > desk.x + desk.w - 0.2 && cx < desk.x + desk.w + 1.0;
  if (desk.facing === "left") return alongside && cx < desk.x + 0.2 && cx > desk.x - 1.0;
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

// "office" if the player is standing right by the hallway's "+" door, or null.
function isNearBuildDoor(player) {
  const kind = "office";
  if (getCurrentRoom(player).id !== "business" || buildDoors[kind] === null) return null;
  const cx = player.x + PLAYER_SIZE / 2;
  const doorX = buildDoors[kind] + WINGS[kind].doorX;
  return cx >= doorX - 0.2 && cx <= doorX + 1.8 && player.y < WINGS[kind].floorY + 1.2 ? kind : null;
}

// If the player is in a corridor right in front of someone else's locked
// office or bedroom door, returns that room (otherwise null). Used for the
// "Press K to knock" prompt.
function lockedDoorInFront(player) {
  const corridor = getCurrentRoom(player).id;
  if (corridor !== "business") return null;
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
  if (isNearMyNightstand(player)) options.push(["journal", 0.1]);
  if (myPhoneInReach(player)) options.push(["phone", 0.05]);
  if (elevatorInReach(player) >= 0) options.push(["elevator", 0]);
  if (bedroomDoorInReach(player)) options.push(["bedroomDoor", 0]);
  // The Workshop's corkboard: stand below it.
  const cork = FURNITURE.find((f) => f.kind === "kanbanBoard");
  if (floorOf(player.y) === floorOf(cork.y) && cx > cork.x - 0.2 && cx < cork.x + cork.w + 0.2 && cy > cork.y && cy < cork.y + 1.4) options.push(["kanban", cy - cork.y]);
  // Your wardrobe (facing forward, or turned): within a step of it.
  const reach = (f) => Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - f.h));
  const closet = FURNITURE.find((f) => (f.kind === "wardrobe" || f.kind === "wardrobeSide") && f.mine && floorOf(f.y) === floorOf(player.y) && reach(f) < 0.9);
  if (closet) options.push(["wardrobe", reach(closet)]);
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
  if (room) return room;
  if (floorOf(cy) === YARD_FLOOR) return YARD_AREA;
  return ROOMS.find((r) => r.id === (["hallway", "business"][floorOf(cy)] ?? "landing")); // (a bedroom's doorway counts as the bedroom hall)
}
