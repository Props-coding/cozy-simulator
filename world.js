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
//    the hallway, and the Library above its west end (north), across from
//    the Theater. South of the
//    hallway's east end is the elevator lobby, with a bit of garden below.
// 2. Business floor: a corridor with the Conference Room and the offices
//    on its north side, and the Workshop, the Lounge and the elevator
//    lobby on its south side.
// 3. Suite floor: everyone's bedroom door along its north wall. Each
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
const SUITE = 2 * UPSTAIRS + 3; // the suite floor's hall, with the bedroom doors (floor 3)
// The front door, at the bottom of the ground floor's elevator lobby (and
// in the house's back wall, seen from the yard): its left edge and width.
const FRONT_DOOR_X = 20.2, FRONT_DOOR_W = 1.6;
// The way to the back alley (Update 7): a manhole in the yard, where the
// raccoons' dumpster used to be, and a matching one in the alley. Press E
// on either to climb through. Returns "yard" or "alley" if you're standing
// by one, or null.
function manholeNear(player) {
  const cx = player.x + 0.3, cy = player.y + 0.3; // (the player's middle)
  const floor = floorOf(player.y);
  if (floor !== YARD_FLOOR && floor !== ALLEY_FLOOR) return null;
  const m = FURNITURE.find((f) => f.kind === "manhole" && f.way && floorOf(f.y) === floor);
  if (!m) return null;
  const d = Math.hypot(Math.max(m.x - cx, 0, cx - m.x - m.w), Math.max(m.y - cy, 0, cy - m.y - m.h));
  return d < 0.75 ? (floor === YARD_FLOOR ? "yard" : "alley") : null;
}

// Where you come out after climbing through (beside the other manhole).
function manholeArrival(side) {
  return side === "yard" ? { ...ALLEY_SPAWN } : { x: 13.7, y: YARD + 9.6 }; // (on the sidewalk, beside it)
}

// Which floor a grid y position is on: 0 the ground floor, 1 business,
// 2 the bedroom hall, and 3 and up for the bedrooms (each is its own
// little map, see bedroomSpot).
function floorOf(y) {
  return Math.max(GAMES_FLOOR, Math.floor((y + UPSTAIRS / 2) / UPSTAIRS));
}

// The yard (Update 4): the outdoors behind the house, on its own map one
// "floor" above the ground floor on the grid (floor -1), the same size as a
// floor so the view doesn't change size when you step outside. You get
// there through the front door (the bottom of the elevator lobby). In the yard, the house's back wall
// runs along the top, with a porch along it.
const YARD_FLOOR = -1;
const YARD = YARD_FLOOR * UPSTAIRS; // add this to a yard spot's y (so "YARD + 2" is 2 tiles down the yard)
// Willow Lake (a bus trip away): its own map, one more "floor" up the
// grid (floor -2), the same size as the yard. See "Willow Lake" below.
const LAKE_FLOOR = -2;
const LAKE = LAKE_FLOOR * UPSTAIRS; // add this to a lake spot's y
// The back alley (Update 7): a narrow alley behind the house, where the
// raccoons keep their not-a-shop. Its own small map (floor -3), reached
// through a hidden door at the hallway's east end. See "The back alley" below.
const ALLEY_FLOOR = -3;
const ALLEY = ALLEY_FLOOR * UPSTAIRS; // add this to an alley spot's y
// The Farm (a bus trip away, Update 8): Hazel's farm, where the big
// garden is. Its own map, one more "floor" up the grid (floor -4), the same
// size as the yard. See "The Farm" below.
const FARM_FLOOR = -4;
const FARM = FARM_FLOOR * UPSTAIRS; // add this to a farm spot's y
// The Games floor (Update 9): the fourth stop on the elevator. Indoors,
// though it's kept below the outdoor maps on the grid. A corridor across
// the top (the mini games' doors go along its north wall, Update 10), the
// Arcade below its west end, and the elevator lobby at its east end.
const GAMES_FLOOR = -5;
const GAMES = GAMES_FLOOR * UPSTAIRS + 3; // the corridor's top edge (like BUSINESS)
// Outdoor maps (the yard, the Lake and the alley): weather, day and night, umbrellas.
function isOutdoorFloor(floor) {
  return floor <= YARD_FLOOR && floor !== GAMES_FLOOR;
}
// Indoor floors with no garden around them (the floors upstairs, and the
// Games floor): fitted to their rooms, no weather but through windows.
function isInsideFloor(floor) {
  return floor >= 1 || floor === GAMES_FLOOR;
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
  // North side: the Library at the west end, across from the Theater.
  { id: "library", name: CONFIG.roomNames.library, rect: { x: 0, y: -5.4, w: 6, h: 5 }, sign: { x: 2.8, y: -WALL_THICKNESS / 2 }, north: true },
  // The elevator lobby, south of the hallway's east end (the same spot on both floors).
  { id: "elevator", name: CONFIG.roomNames.elevator, rect: { x: 18, y: 3, w: 6, h: 4 }, sign: { x: 20, y: 3 } },
  // The business floor: the Conference Room north of the corridor's west
  // end (the offices are beside it), and the Workshop south of it (a place
  // to make things together, with the house's project boards on its wall).
  { id: "conference", name: CONFIG.roomNames.conference, rect: { x: 0, y: BUSINESS - 5.4, w: 5.6, h: 5 }, sign: { x: 2.8, y: BUSINESS - WALL_THICKNESS / 2 }, north: true },
  { id: "workshop", name: CONFIG.roomNames.workshop, rect: { x: 0, y: BUSINESS + 3, w: 8, h: 5 }, sign: { x: 6.2, y: BUSINESS + 3 } },
  // Between the Workshop and the elevator: the Lounge, for a break and a chat.
  { id: "lounge", name: CONFIG.roomNames.lounge, rect: { x: 8, y: BUSINESS + 3, w: 10, h: 5 }, sign: { x: 13, y: BUSINESS + 3 } },
  // The business corridor and the bedroom hall are added in buildHouse;
  // here are their elevator lobbies.
  { id: "elevatorUp", name: CONFIG.roomNames.elevator, rect: { x: 18, y: BUSINESS + 3, w: 6, h: 4 }, sign: { x: 20, y: BUSINESS + 3 } },
  { id: "elevatorTop", name: CONFIG.roomNames.elevator, rect: { x: 18, y: SUITE + 3, w: 6, h: 4 }, sign: { x: 20, y: SUITE + 3 } },
  // The Games floor (Update 9): its corridor, the Arcade and its lobby.
  { id: "games", name: CONFIG.roomNames.games, rect: { x: 0, y: GAMES, w: HOUSE_WIDTH, h: 3 } },
  { id: "arcade", name: CONFIG.roomNames.arcade, rect: { x: 0, y: GAMES + 3, w: 18, h: 7 }, sign: { x: 9, y: GAMES + 3 } },
  { id: "elevatorGames", name: CONFIG.roomNames.elevator, rect: { x: 18, y: GAMES + 3, w: 6, h: 4 }, sign: { x: 20, y: GAMES + 3 } },
];

// Solid rectangles the player can't walk through: the outer walls, the
// dividers between rooms, and the wall segments above each room (with a
// gap left open for the doorway). Same shape of logic as a plain top-down
// house, just in grid units instead of pixels.
// (The corridors' top walls have doorways for the rooms north of them,
// so they're made in buildHouse instead.)
const BASE_WALLS = [
  // Outer walls
  { x: -WALL_THICKNESS, y: 11, w: 18 + WALL_THICKNESS * 2, h: WALL_THICKNESS, low: true }, // bottom (drawn short so it doesn't hide the rooms)
  { x: -WALL_THICKNESS, y: -5.8, w: WALL_THICKNESS, h: 17.2 }, // left, from the Library down to the bottom
  { x: HOUSE_WIDTH, y: -WALL_THICKNESS, w: WALL_THICKNESS, h: 3.2 + WALL_THICKNESS }, // right, the hallway's end

  // Library: its north wall and its right-hand side
  { x: -WALL_THICKNESS, y: -5.8, w: 6 + WALL_THICKNESS * 2, h: WALL_THICKNESS },
  { x: 6, y: -5.8, w: WALL_THICKNESS, h: 5.4 },

  // The elevator lobby south of the hallway's east end (doorway x 19.2 to
  // 20.8), with the garden below it.
  { x: 18, y: 3 - WALL_THICKNESS / 2, w: 1.2, h: WALL_THICKNESS },
  { x: 20.8, y: 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 8 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  // (drawn short so it doesn't hide the lobby), with the front door out to
  // the yard (FRONT_DOOR_X)
  { x: 18 - WALL_THICKNESS / 2, y: 7 - WALL_THICKNESS / 2, w: FRONT_DOOR_X - 18 + WALL_THICKNESS / 2, h: WALL_THICKNESS, low: true },
  { x: FRONT_DOOR_X + FRONT_DOOR_W, y: 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - FRONT_DOOR_X - FRONT_DOOR_W + WALL_THICKNESS, h: WALL_THICKNESS, low: true },

  // The business floor: the Conference Room's north wall, left side and
  // right side, the corridor's sides and bottom (with a doorway into its
  // elevator lobby, x 19.2 to 20.8), and the lobby's walls. The
  // corridor's top wall has the doorways, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: BUSINESS - 5.8, w: 6, h: WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: BUSINESS - 5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: 5.6, y: BUSINESS - 5.8, w: WALL_THICKNESS, h: 5.4 },
  { x: -WALL_THICKNESS, y: BUSINESS - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: BUSINESS - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  // (the business corridor's bottom wall has the Workshop's doorway, x 5.4 to 7.0)
  { x: -WALL_THICKNESS, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: 5.4 + WALL_THICKNESS, h: WALL_THICKNESS },
  // (and the Lounge's, x 12.2 to 13.8)
  { x: 7.0, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: 5.2, h: WALL_THICKNESS },
  { x: 13.8, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: 5.4, h: WALL_THICKNESS },
  // The Lounge's right side (below the lobby's) and its bottom (drawn short).
  { x: 18 - WALL_THICKNESS / 2, y: BUSINESS + 7, w: WALL_THICKNESS, h: 1 + WALL_THICKNESS },
  { x: 8, y: BUSINESS + 8, w: 10 + WALL_THICKNESS / 2, h: WALL_THICKNESS, low: true },
  // The Workshop: its left side, its right side, and its bottom (drawn short).
  { x: -WALL_THICKNESS, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 5 + WALL_THICKNESS * 1.5 },
  { x: 8 - WALL_THICKNESS / 2, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 5 + WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: BUSINESS + 8, w: 8 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },
  { x: 20.8, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: BUSINESS + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: BUSINESS + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

  // The Games floor (Update 9): the corridor's top wall (the mini games'
  // doors come later), its sides, its bottom (with doorways into the
  // Arcade, x 8.2 to 9.8, and the elevator lobby, x 19.2 to 20.8), the
  // Arcade's walls, and the lobby's.
  { x: -WALL_THICKNESS, y: GAMES - WALL_THICKNESS, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: GAMES - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: GAMES - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: -WALL_THICKNESS, y: GAMES + 3 - WALL_THICKNESS / 2, w: 8.2 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 9.8, y: GAMES + 3 - WALL_THICKNESS / 2, w: 19.2 - 9.8, h: WALL_THICKNESS },
  { x: 20.8, y: GAMES + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: GAMES + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: 18 - WALL_THICKNESS / 2, y: GAMES + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS },
  { x: -WALL_THICKNESS, y: GAMES + 10, w: 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },
  { x: 18 - WALL_THICKNESS / 2, y: GAMES + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

  // The bedroom hall: its sides and bottom (with a doorway into its
  // elevator lobby, x 19.2 to 20.8), and the lobby's walls. The hall's top
  // wall holds the bedroom doors, so it's made in buildHouse.
  { x: -WALL_THICKNESS, y: SUITE - WALL_THICKNESS, w: WALL_THICKNESS, h: 3 + WALL_THICKNESS * 1.5 },
  { x: HOUSE_WIDTH, y: SUITE - WALL_THICKNESS, w: WALL_THICKNESS, h: 7 + WALL_THICKNESS * 1.5 },
  { x: -WALL_THICKNESS, y: SUITE + 3 - WALL_THICKNESS / 2, w: 19.2 + WALL_THICKNESS, h: WALL_THICKNESS, low: true },
  { x: 20.8, y: SUITE + 3 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 20.8 + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: SUITE + 3 - WALL_THICKNESS / 2, w: WALL_THICKNESS, h: 4 + WALL_THICKNESS },
  { x: 18 - WALL_THICKNESS / 2, y: SUITE + 7 - WALL_THICKNESS / 2, w: HOUSE_WIDTH - 18 + WALL_THICKNESS * 1.5, h: WALL_THICKNESS, low: true },

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
  // painting in the east corner, over an umbrella stand (the raccoons used
  // to lurk there; they moved out to the yard in Update 4). A fiddle-leaf fig sits
  // in the bottom-right corner. The Library's door (x 2 to 3.6) is between
  // the first two lamps. (The Conference Room and offices used to open off
  // this wall; they're on the business floor now.)
  { kind: "rug", x: 1.5, y: 0.95, w: 21, h: 0.95, color: "#b5603c", solid: false },
  { kind: "coatHooks", x: 0.3, y: 0, w: 1.1, solid: false },
  { kind: "boots", x: 0.4, y: 0.15, w: 0.9, h: 0.35, solid: false },
  { kind: "sconce", x: 1.7, y: 0, solid: false },
  { kind: "sconce", x: 3.9, y: 0, solid: false },
  { kind: "picture", x: 4.55, y: 0, w: 0.9, art: "flowers", solid: false },
  { kind: "bench", x: 4.25, y: 0.1, w: 1.5, h: 0.5 },
  { kind: "sconce", x: 6.4, y: 0, solid: false },
  { kind: "picture", x: 7.2, y: 0, w: 1.1, art: "sea", solid: false },
  { kind: "mirror", x: 9.45, y: 0, w: 0.7, short: true, solid: false },
  { kind: "console", x: 8.9, y: 0.1, w: 1.8, h: 0.45 },
  { kind: "sconce", x: 12.85, y: 0, solid: false },
  // A grandfather clock showing the real (local) time; it chimes on the hour.
  { kind: "grandfatherClock", x: 13.4, y: 0.05, w: 0.75, h: 0.45 },
  { kind: "sconce", x: 14.6, y: 0, solid: false },
  { kind: "weatherWindow", x: 15.3, y: 0, w: 1.2, solid: false },
  { kind: "sconce", x: 17.1, y: 0, solid: false },
  { kind: "weatherWindow", x: 20.5, y: 0, w: 1.2, solid: false }, // (shows the real weather outside, see weather.js)
  { kind: "sconce", x: 22.3, y: 0, solid: false },
  { kind: "picture", x: 23.0, y: 0, w: 0.75, art: "hills", solid: false },
  { kind: "fiddleFig", x: 23.3, y: 2.05, w: 0.6, h: 0.6 },
  { kind: "umbrellaStand", x: 21.85, y: 0.12, w: 0.5, h: 0.4 },

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
  // The fortune cookie jar (Update 5): one cookie a day each.
  { kind: "cookieJar", x: 17.15, y: 5.3, w: 0.5, h: 0.45 },
  { kind: "chair", x: 14.7, y: 5.5, w: 0.6, h: 0.6, facing: "down" },
  { kind: "chair", x: 13.3, y: 6.7, w: 0.6, h: 0.6, facing: "right" },
  { kind: "chair", x: 16.1, y: 6.7, w: 0.6, h: 0.6, facing: "left" },
  { kind: "table", x: 14.1, y: 6.4, w: 1.8, h: 1.2 },
  { kind: "chair", x: 14.7, y: 7.9, w: 0.6, h: 0.6, facing: "up" },
  { kind: "pendant", x: 15, y: 7, solid: false },

  // Library: north of the hallway's west end, across from the Theater,
  // with its door (x 2 to 3.6) at the bottom. Along its outside north
  // wall, two windows onto the real weather and a clock, with a
  // reading nook under them (an
  // armchair turned to the window, a beanbag, each with a floor lamp).
  // Below: a bookshelf on each side of the aisle up from the door, and a
  // reading table with green banker's lamps on a deep green rug, with a
  // seat. Soft rain on the windows (voice on, like everywhere but the Study).
  { kind: "rainWindow", x: 0.35, y: -5.4, w: 1.15, solid: false },
  { kind: "clock", x: 3.0, y: -5.4, solid: false },
  { kind: "rainWindow", x: 4.45, y: -5.4, w: 1.15, solid: false },
  { kind: "armchair", x: 0.5, y: -5.0, w: 1.1, h: 0.8 },
  { kind: "floorLamp", x: 1.7, y: -5.05, w: 0.4, h: 0.4 },
  { kind: "floorLamp", x: 4.1, y: -5.05, w: 0.4, h: 0.4 },
  { kind: "beanbag", x: 4.6, y: -4.95, w: 0.9, h: 0.8 },
  { kind: "libraryShelf", x: 0.5, y: -3.4, w: 1.5, h: 0.45 },
  { kind: "libraryShelf", x: 4.1, y: -3.4, w: 1.5, h: 0.45 },
  { kind: "rug", x: 0.3, y: -2.4, w: 1.9, h: 1.55, color: "#4f6b52", solid: false },
  { kind: "readingTable", x: 0.45, y: -2.2, w: 1.6, h: 0.6 },
  { kind: "chair", x: 0.95, y: -1.45, w: 0.6, h: 0.6, facing: "up", sit: true, solid: false, seat: "#7a5238", back: "#5c3d2a" },
  { kind: "fern", x: 5.2, y: -1.8, w: 0.6, h: 0.6 },
  { kind: "owlPerch", x: 5.15, y: -2.75, w: 0.5, h: 0.3 }, // where Mortimer sleeps through the day (Update 6)
  // A little garden on the lawn north of the hallway (outside, past the
  // Library): a birdbath in the middle with a flower bed on each side, a
  // low hedge along the house, and a tree in each far corner.
  { kind: "birdbath", x: 15.0, y: -4.1, w: 0.6, h: 0.4 },
  { kind: "flowerBed", x: 10.6, y: -4.05, w: 3.6, h: 0.5 },
  { kind: "flowerBed", x: 16.4, y: -4.05, w: 3.6, h: 0.5 },
  ...[7.4, 8.3, 9.2, 10.1, 11.0, 11.9, 12.8, 13.7, 16.1, 17.0, 17.9, 18.8, 19.7, 20.6, 21.5, 22.4].map((x, i) => ({ kind: "bush", x, y: -2.75, w: 0.9, h: 0.5, n: i })),
  { kind: "yardTree", x: 7.0, y: -4.5, w: 1.0, h: 0.55, n: 4 },
  { kind: "yardTree", x: 22.5, y: -4.5, w: 1.0, h: 0.55, n: 5 },
  { kind: "wildflowers", x: 14.4, y: -2.95, w: 1.7, h: 0.3, solid: false },

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
  // Rain windows on the outside wall east of the offices (indoors, the
  // weather only shows through windows).
  { kind: "rainWindow", x: 18.35, y: BUSINESS, w: 1.3, solid: false },
  { kind: "sconce", x: 20.05, y: BUSINESS, solid: false },
  { kind: "rainWindow", x: 20.75, y: BUSINESS, w: 1.3, solid: false },
  { kind: "snakePlant", x: 23.3, y: BUSINESS + 2.05, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.65, y: BUSINESS + 3 + WALL_THICKNESS / 2, w: 1.1, floor: 1, solid: false },

  // The Lounge: the TV against the back wall (cooking, weather and news
  // channels, press E: Update 7), a sage sofa facing it across a coffee
  // table on a rug (seen from behind, like the Theater's), and a beanbag; a fridge and a tea cart for
  // snacks, an arcade cabinet, an armchair in the corner by the lava lamp,
  // and plants. Voice is on, like the Conference Room.
  { kind: "rug", x: 8.7, y: BUSINESS + 4.3, w: 3.4, h: 2.3, color: "#6f8a6a", solid: false },
  { kind: "tvSet", x: 9.4, y: BUSINESS + 3.35, w: 1.3, h: 0.5 },
  { kind: "coffeeTable", x: 9.45, y: BUSINESS + 4.75, w: 1.2, h: 0.6 },
  { kind: "cinemaSofa", x: 9.05, y: BUSINESS + 5.9, w: 2.0, h: 0.8, color: "#7a9e8c" },
  { kind: "beanbag", x: 11.5, y: BUSINESS + 4.7, w: 0.9, h: 0.8 },
  { kind: "armchair", x: 12.9, y: BUSINESS + 6.5, w: 1.1, h: 0.8 },
  { kind: "fridge", x: 14.3, y: BUSINESS + 3.35, w: 0.8, h: 0.6 },
  { kind: "teaCart", x: 15.3, y: BUSINESS + 3.35, w: 1.2, h: 0.6 },
  { kind: "arcade", x: 16.9, y: BUSINESS + 3.35, w: 0.8, h: 0.6 },
  { kind: "lavaLamp", x: 14.4, y: BUSINESS + 7.3, w: 0.4, h: 0.4 },
  { kind: "monstera", x: 8.2, y: BUSINESS + 7.2, w: 0.6, h: 0.6 },
  { kind: "palm", x: 17.2, y: BUSINESS + 7.2, w: 0.6, h: 0.6 },

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
  { kind: "rug", x: 1.5, y: SUITE + 0.95, w: 21, h: 0.95, color: "#6f5a8c", solid: false },
  { kind: "cactus", x: 0.15, y: SUITE + 2.05, w: 0.6, h: 0.6 },
  // Along the hall's south side, so the long hall isn't bare.
  { kind: "snakePlant", x: 4.6, y: SUITE + 2.05, w: 0.6, h: 0.6 },
  { kind: "bench", x: 7.9, y: SUITE + 2.2, w: 1.5, h: 0.5 },
  { kind: "floorLamp", x: 11.3, y: SUITE + 2.25, w: 0.4, h: 0.4 },
  { kind: "fern", x: 14.2, y: SUITE + 2.05, w: 0.6, h: 0.6 },
  { kind: "monstera", x: 16.7, y: SUITE + 2.05, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.65, y: SUITE + 3 + WALL_THICKNESS / 2, w: 1.1, floor: 2, solid: false },

  // --- The Games floor (Update 9) ---
  // The corridor: a runner, plants, and along its north wall, the mini
  // games' doors (Update 10): one for each game in config.js minigames,
  // press E at one for its lobby.
  ...CONFIG.minigames.games.map((g, i) => ({ kind: "gamePortal", x: 1.2 + i * 2.6, y: GAMES, w: 1.5, game: g.id, solid: false })),
  { kind: "rug", x: 1.5, y: GAMES + 0.95, w: 21, h: 0.95, color: "#4a4a7a", solid: false },
  { kind: "palm", x: 0.2, y: GAMES + 0.1, w: 0.6, h: 0.6 },
  { kind: "palm", x: 23.2, y: GAMES + 0.1, w: 0.6, h: 0.6 },
  { kind: "elevatorDoor", x: 21.65, y: GAMES + 3 + WALL_THICKNESS / 2, w: 1.1, floor: 3, solid: false },
  { kind: "bench", x: 18.3, y: GAMES + 4.2, w: 1.5, h: 0.5 },
  { kind: "snakePlant", x: 23.2, y: GAMES + 5.8, w: 0.6, h: 0.6 },
  // The Arcade: a checkered carpet, two playable cabinets (press E), the
  // high score board between them, the claw machine, the capsule machine,
  // and the prize counter where tickets become prizes (or crumbs).
  { kind: "rug", x: 1.2, y: GAMES + 4.6, w: 15.6, h: 4.9, color: "#3a2f5a", solid: false },
  { kind: "arcadeGame", x: 1.0, y: GAMES + 3.3, w: 0.9, h: 0.65, game: "snake" },
  { kind: "arcadeGame", x: 2.3, y: GAMES + 3.3, w: 0.9, h: 0.65, game: "moths" },
  { kind: "scoreBoard", x: 3.7, y: GAMES + 3 + WALL_THICKNESS / 2, w: 1.6, solid: false },
  { kind: "arcadeGame", x: 5.6, y: GAMES + 3.3, w: 0.9, h: 0.65, game: "snake", look: 1 },
  { kind: "arcadeGame", x: 6.9, y: GAMES + 3.3, w: 0.9, h: 0.65, game: "moths", look: 1 },
  { kind: "clawMachine", x: 11.2, y: GAMES + 3.35, w: 1.1, h: 0.8 },
  { kind: "capsuleMachine", x: 12.8, y: GAMES + 3.4, w: 0.7, h: 0.55 },
  { kind: "prizeCounter", x: 13.9, y: GAMES + 7.6, w: 3.6, h: 0.9 },
  { kind: "beanbag", x: 2.0, y: GAMES + 8.2, w: 0.9, h: 0.8 },
  { kind: "beanbag", x: 3.4, y: GAMES + 8.5, w: 0.9, h: 0.8 },
  { kind: "neonSign", x: 14.4, y: GAMES + 3 + WALL_THICKNESS / 2, w: 1.0, solid: false },
  { kind: "monstera", x: 17.2, y: GAMES + 3.3, w: 0.6, h: 0.6 },
  { kind: "sconce", x: 18.7, y: SUITE + 3.2, solid: false },
  { kind: "rug", x: 20.8, y: SUITE + 4.3, w: 2.8, h: 1.9, color: "#6f5a8c", round: true, solid: false },
  { kind: "bench", x: 18.3, y: SUITE + 4.2, w: 1.5, h: 0.5 },
  { kind: "palm", x: 18.3, y: SUITE + 6.0, w: 0.6, h: 0.6 },
];

// The elevator: one set of doors on each floor, in the same spot. Stand
// in front of the doors and press E to pick a floor.
// ELEVATOR_OPEN is how open each floor's doors are right now (0 shut, 1
// wide open), set by main.js while you ride and read when drawing.
const ELEVATOR_OPEN = [0, 0, 0, 0];

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

// Walking out of a bedroom: back on the suite floor, in front of its door
// (or the middle of the suite floor if its door isn't there any more).
function bedroomExit(owner) {
  const f = FURNITURE.find((f) => f.kind === "bedroomDoor" && f.door.owner === owner);
  return f ? { x: f.x + f.w / 2 - PLAYER_SIZE / 2, y: SUITE + 0.35 } : { x: 8.7, y: SUITE + 1.2 };
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
  { id: "busStop", name: CONFIG.roomNames.busStop, rect: { x: 16.2, y: YARD + 6.8, w: 7.8, h: 3.5 }, outdoor: true },
];
const YARD_AREA = { id: "yard", name: CONFIG.roomNames.yard, rect: { x: 0, y: YARD - 5.4, w: HOUSE_WIDTH, h: 15.7 }, outdoor: true };

// The doors between the house and the yard. `house` is the doorway in the
// house's wall (x its left edge, top and bottom the wall's edges), `yard`
// the doorway in the house's back wall seen from the yard.
const YARD_DOORS = [
  { id: "front", name: "Front door", house: { x: FRONT_DOOR_X, top: 7 - WALL_THICKNESS / 2, bottom: 7 + WALL_THICKNESS / 2 }, yardX: FRONT_DOOR_X },
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
const POND = { cx: 4.6, cy: YARD + 5.9, rx: 3.0, ry: 2.0 };
const DOCK = { x: 6.3, y: YARD + 5.5, w: 2.6, h: 0.8 };

// Willow Lake's water: a big oval with a long pier reaching out from the
// south shore to a wide platform, and a little island you can't reach.
const LAKE_WATER = { cx: 10.2, cy: LAKE - 0.6, rx: 8.4, ry: 3.8 };
const LAKE_PIER = { x: 11.6, y: LAKE + 0.8, w: 1.0, h: 2.9 };
const LAKE_PLATFORM = { x: 10.7, y: LAKE - 0.45, w: 2.8, h: 1.25 };
const LAKE_ISLAND = { cx: 4.9, cy: LAKE - 1.5, rx: 1.35, ry: 0.95 };

// Every body of water you can fish in: where it is, its docks (you can
// walk and fish from them), and anything in it that isn't water. How
// rare its fish can be is in CONFIG.fishing.waters.
const WATERS = [
  { id: "pond", floor: YARD_FLOOR, ...POND, docks: [DOCK], islands: [], seed: 0 },
  { id: "lake", floor: LAKE_FLOOR, ...LAKE_WATER, docks: [LAKE_PIER, LAKE_PLATFORM], islands: [LAKE_ISLAND], seed: 50 },
];
const inRect = (r, x, y, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
const inOval = (o, x, y, grow = 0) => ((x - o.cx) / (o.rx + grow)) ** 2 + ((y - o.cy) / (o.ry + grow)) ** 2 <= 1;

// Out on a water's surface (not right at the edge, not on a dock or an island).
function inWater(water, x, y) {
  return inOval(water, x, y, -0.3) && !water.docks.some((d) => inRect(d, x, y, 0.15)) && !water.islands.some((o) => inOval(o, x, y, 0.2));
}
// The water at (x, y), or null.
function waterAt(x, y) {
  return WATERS.find((w) => floorOf(y) === w.floor && inWater(w, x, y)) ?? null;
}
const waterById = (id) => WATERS.find((w) => w.id === id) ?? null;

// A water as solid slices (you can't walk on it), leaving its docks free.
function waterSolids(water) {
  const slices = [];
  for (let y = water.cy - water.ry + 0.15; y < water.cy + water.ry - 0.15; y += 0.25) {
    const mid = y + 0.125, half = water.rx * Math.sqrt(Math.max(0, 1 - ((mid - water.cy) / water.ry) ** 2)) - 0.2;
    if (half <= 0) continue;
    let runs = [[water.cx - half, water.cx + half]];
    for (const d of water.docks) {
      if (mid < d.y - 0.1 || mid > d.y + d.h + 0.1) continue;
      runs = runs.flatMap(([l, r]) => [[l, Math.min(r, d.x)], [Math.max(l, d.x + d.w), r]]).filter(([l, r]) => r - l > 0.05);
    }
    for (const [l, r] of runs) slices.push({ x: l, y, w: r - l, h: 0.25, hidden: true });
  }
  return slices;
}
function pondSolids() {
  return waterSolids(WATERS[0]);
}

// The yard's edges (invisible: the fence and trees show where they are),
// the house's back wall with the front door in it, and the pond.
const YARD_WALLS = [
  { x: -WALL_THICKNESS, y: YARD - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // west edge
  { x: HOUSE_WIDTH, y: YARD - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // east edge
  { x: -WALL_THICKNESS, y: YARD + 10.3, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: WALL_THICKNESS, hidden: true }, // the curb (the road is beyond)
  // The house's back wall, with the front door in it.
  { x: -WALL_THICKNESS, y: YARD - 5.8, w: FRONT_DOOR_X + WALL_THICKNESS, h: WALL_THICKNESS },
  { x: FRONT_DOOR_X + FRONT_DOOR_W, y: YARD - 5.8, w: HOUSE_WIDTH - FRONT_DOOR_X - FRONT_DOOR_W + WALL_THICKNESS, h: WALL_THICKNESS },
  ...pondSolids(),
];

// A straight run of fence from (x1, y1) to (x2, y2), in yard spots (one of
// them the same), as furniture. Along the page it's a row of pickets;
// down the page it's drawn from the side. (`base`: the Farm's fences use FARM.)
function fenceRun(x1, y1, x2, y2, style = "picket", base = YARD) {
  const across = y1 === y2;
  return across
    ? { kind: "fence", style, x: Math.min(x1, x2), y: base + y1 - 0.1, w: Math.abs(x2 - x1), h: 0.2 }
    : { kind: "fenceSide", style, x: x1 - 0.1, y: base + Math.min(y1, y2), w: 0.2, h: Math.abs(y2 - y1) };
}

// Flat things painted on the ground: the paths, the road and sidewalk, and
// the pond (see outdoors.js). The paths make one loop with no dead ends:
// the porch steps, through the garden, down past the bus stop, west past
// the old trading post spot to the pond, up past Hazel, and back along the porch.
// Short spurs lead into the campfire ring, onto the dock, and out through
// the fence gate to the bus shelter. Each is a line of points (yard spots:
// x, and y from the yard's top) drawn as a smooth curve `w` wide; `stone`
// ones (near the house) are laid with stones, the rest are dirt.
const YARD_PATHS = [
  { stone: true, w: 1.5, points: [[18.0, -2.75], [18.0, -2.0], [18.0, -1.2]] }, // flagstones from the porch steps down to the garden gate
  { w: 0.95, points: [[17.4, -2.3], [15.4, -2.28], [12.6, -2.25], [10.5, -2.2], [9.4, -1.7], [9.15, -0.6]] }, // along the porch, west to Hazel's corner
  { w: 0.95, points: [[9.15, -0.6], [9.2, 1.5], [9.3, 3.2], [9.25, 4.8], [9.45, 6.3], [10.1, 7.1], [11.2, 7.3]] }, // down past Otis to the pond
  { w: 1.0, points: [[11.0, 7.3], [13.5, 7.25], [15.6, 7.2], [17.3, 7.15], [18.0, 7.1]] }, // along the bottom, past the bush where the trading post stood
  { w: 1.1, points: [[18.0, -1.3], [18.0, 1.5], [18.0, 4.6], [18.0, 6.2], [18.0, 7.1]] }, // through the garden, out of its bottom gate
  { w: 1.1, points: [[18.0, 7.1], [18.0, 8.5], [18.0, 9.6]] }, // through the fence gate to the bus stop
  { w: 0.85, points: [[9.15, -1.15], [7.8, -1.05], [6.5, -1.2], [5.8, -1.4]] }, // into the campfire ring
  { w: 0.8, points: [[9.35, 5.9], [8.5, 5.9]] }, // onto the dock
];

// The garden beds, each 1.7 wide and 1.0 deep, numbered in this order
// (the house server keeps what's growing by number):
//   0 to 2   the starter patch in the yard (quick beginner crops only)
//   3 to 18  the Farm's fields: four rows of four, a walkway down the middle
// `place` says which. (Until Update 8 all twelve were in the yard; a crop
// already growing in beds 3 to 11 simply carries on at the Farm.)
const GARDEN_BEDS = [
  ...[-0.75, 1.0, 2.75].map((y) => ({ x: 14.15, y: YARD + y, w: 1.7, h: 1.0, place: "yard" })),
  ...[0.2, 1.95, 3.7, 5.45].flatMap((y) => [6.5, 8.7, 12.6, 14.8].map((x) => ({ x, y: FARM + y, w: 1.7, h: 1.0, place: "farm" }))),
];

// Where you'd cast from (a spot at the pond's edge or on the dock), and
// where the bobber lands: { bx, by } in grid units, or null if you're not
// at the water.
// --- Fish shadows in the pond ---
// A few faint fish shapes swim slow loops around the pond. Where each one
// is comes only from the clock (t, in milliseconds), so everyone sees the
// same fish and the house server can work out which one was near your
// bobber when it bit. Their sizes (small, medium, large) change each hour.
// Returns [{ id, x, y, angle, size }].
function shadowHash(n) {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}
function waterShadows(water, t) {
  const cfg = CONFIG.fishing.shadows;
  const w = CONFIG.fishing.waters?.[water.id] ?? {};
  const hour = Math.floor(t / 3_600_000);
  const s = t / 1000;
  const shadows = [];
  const count = w.shadowCount ?? cfg.count;
  for (let i = 0; i < count; i++) {
    // Deeper waters have bigger fish: `bigger` pushes the roll up.
    const roll = Math.min(0.999, shadowHash(hour * 97 + i * 31 + water.seed) + (w.bigger ?? 0));
    const size = roll < cfg.small.chance ? "small" : roll < cfg.small.chance + cfg.medium.chance ? "medium" : "large";
    // Around and around (half of them the other way), drifting in and out.
    const turn = (0.06 + 0.05 * shadowHash(i * 7.1 + water.seed)) * (i % 2 ? -1 : 1) * (water.rx > 5 ? 0.6 : 1);
    const theta = s * turn + shadowHash(i * 5.5 + water.seed) * Math.PI * 2;
    const drift = 0.11 + 0.08 * shadowHash(i * 3.3 + water.seed);
    const r = 0.35 + 0.25 * (1 + Math.sin(s * drift + i * 1.9));
    const x = water.cx + (water.rx - 0.7) * r * Math.cos(theta);
    const y = water.cy + (water.ry - 0.6) * r * Math.sin(theta);
    // Facing the way it swims.
    const angle = Math.atan2((water.ry - 0.6) * Math.cos(theta) * turn, -(water.rx - 0.7) * Math.sin(theta) * turn);
    shadows.push({ id: i, x, y, angle, size });
  }
  return shadows;
}
// (The pond's, as before.)
function pondShadows(t) {
  return waterShadows(WATERS[0], t);
}

// The shadow that's come to your own bobber (fishing.js sets it; it's
// drawn there, nibbling), or null.
const POND_VIEW = { locked: null };

// True if (x, y) is out on water you can fish in (the pond or the Lake).
function inPond(x, y) {
  return !!waterAt(x, y);
}

// Where you can cast from: standing on a dock, or at a water's edge. Returns
// { bx, by, water } (where the bobber lands, about 1.6 steps out toward the
// middle, always on open water), or null.
function fishingSpot(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const water = WATERS.find((w) => w.floor === floorOf(player.y));
  if (!water) return null;
  const onDock = water.docks.some((d) => inRect(d, cx, cy, 0.35));
  if (!onDock && !inOval(water, cx, cy, 0.9)) return null;
  // Out from a dock's far end: straight ahead. Otherwise toward the middle.
  const dx = cx - water.cx, dy = cy - water.cy;
  const d = Math.hypot(dx, dy) || 1;
  let ux = -dx / d, uy = -dy / d;
  if (onDock && inRect(LAKE_PLATFORM, cx, cy, 0.35)) (ux = 0), (uy = -1);
  for (let reach = 1.6; reach < 6; reach += 0.2) {
    const bx = cx + ux * reach, by = cy + uy * reach;
    if (inWater(water, bx, by)) return { bx, by, water: water.id };
  }
  // (From the side of a pier: out to the side.)
  for (const side of [-1, 1]) {
    for (let reach = 1.2; reach < 3; reach += 0.2) if (inWater(water, cx + side * reach, cy)) return { bx: cx + side * reach, by: cy, water: water.id };
  }
  return null;
}

// Your own fish tank, if you're standing within a step of it (in your bedroom).
// The mini game door you're standing at (Update 10), or null.
function gamePortalNear(player) {
  if (floorOf(player.y) !== GAMES_FLOOR) return null;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.kind === "gamePortal" && cx > f.x - 0.3 && cx < f.x + f.w + 0.3 && cy - f.y < 1.2) ?? null;
}

// The Arcade cabinet you're standing at (Update 9), or null.
function arcadeCabinetNear(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  let best = null, bestD = 0.8;
  for (const f of FURNITURE) {
    if (f.kind !== "arcadeGame" || floorOf(f.y) !== floorOf(player.y)) continue;
    const d = Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - f.h));
    if (d < bestD) (best = f), (bestD = d);
  }
  return best;
}

// Your own canvas, poster or rug (Update 7) within reach, or null.
const ART_KINDS = ["artCanvas", "artPoster", "artRug"];
function myArtInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => ART_KINDS.includes(f.kind) && f.mine && floorOf(f.y) === floorOf(player.y) && Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - (f.h ?? 0.4))) < 0.9) ?? null;
}

function myFishTankInReach(player) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.find((f) => f.kind === "fishTank" && f.mine && floorOf(f.y) === floorOf(player.y) && Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - f.h)) < 0.9) ?? null;
}

// The garden bed you're standing next to (within a step, on the yard), as
// its number, or -1.
function gardenBedInReach(player) {
  const floor = floorOf(player.y);
  if (floor !== YARD_FLOOR && floor !== FARM_FLOOR) return -1;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  let best = -1, bestD = 0.75;
  GARDEN_BEDS.forEach((b, n) => {
    if (floorOf(b.y) !== floor) return;
    const d = Math.hypot(Math.max(b.x - cx, 0, cx - b.x - b.w), Math.max(b.y - cy, 0, cy - b.y - b.h));
    if (d < bestD) (best = n), (bestD = d);
  });
  return best;
}

const YARD_FURNITURE = [
  // The house's back wall: the front door on the porch (walk up into it
  // to go in), windows glowing warm from inside, and lanterns by the door.
  { kind: "yardDoor", x: FRONT_DOOR_X, y: YARD_WALL_Y, w: FRONT_DOOR_W, solid: false },
  { kind: "houseWindow", x: 0.9, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 3.0, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 5.1, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 7.2, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 9.6, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 11.7, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 14.4, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 17.4, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "houseWindow", x: 22.5, y: YARD_WALL_Y, w: 1.2, solid: false },
  { kind: "porchLantern", x: 19.55, y: YARD_WALL_Y, solid: false },
  { kind: "porchLantern", x: 22.15, y: YARD_WALL_Y, solid: false },

  // The porch: a railing along its front (with the steps in the middle)
  // and its west end, doormats, a rocking chair and potted plants.
  { kind: "porchRail", x: 11.6, y: YARD - 3.2, w: 5.6, h: 0.2 },
  { kind: "porchRail", x: 18.8, y: YARD - 3.2, w: 5.2, h: 0.2 },
  { kind: "porchRailSide", x: 11.5, y: YARD - 5.4, w: 0.2, h: 2.4 },
  { kind: "porchSteps", x: 17.2, y: YARD - 3.1, w: 1.6, h: 0.5, solid: false },
  { kind: "doormat", x: 20.45, y: YARD - 5.3, w: 1.1, h: 0.45, solid: false },
  { kind: "rockingChair", x: 23.0, y: YARD - 4.95, w: 0.8, h: 0.6 },
  // A porch swing for two, hanging on chains at the porch's west end
  // (press E by it to sit; it sways gently while someone's on it).
  { kind: "porchSwing", x: 11.95, y: YARD - 4.75, w: 1.9, h: 0.55 },
  { kind: "fern", x: 16.3, y: YARD - 5.25, w: 0.6, h: 0.6 },
  { kind: "snakePlant", x: 19.3, y: YARD - 5.25, w: 0.6, h: 0.6 },

  // Flower beds along the house west of the porch, under the windows.
  { kind: "flowerBed", x: 0.2, y: YARD - 5.35, w: 4.1, h: 0.5 },
  { kind: "flowerBed", x: 7.1, y: YARD - 5.35, w: 4.2, h: 0.5 },

  // The starter garden (since Update 8; the big garden moved to the Farm):
  // a picket fence round three beds west of the path, with a little gate
  // on its east side, onto the path.
  fenceRun(12.8, -1.4, 17.3, -1.4),
  fenceRun(12.8, 4.6, 17.3, 4.6),
  fenceRun(12.8, -1.4, 12.8, 4.6),
  fenceRun(17.3, -1.4, 17.3, 0.55),
  fenceRun(17.3, 1.45, 17.3, 4.6),

  // The pond's dock, reeds and a few stones.
  { kind: "dock", ...DOCK, solid: false },
  { kind: "reeds", x: 2.0, y: YARD + 4.3, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 2.6, y: YARD + 7.3, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 5.9, y: YARD + 7.4, w: 0.6, h: 0.4, solid: false },
  { kind: "pondStones", x: 2.6, y: YARD + 3.3, w: 0.8, h: 0.4 },

  // The yard's west and south edges: a rustic fence, with a gate in the
  // bottom one where the path goes out to the sidewalk and the bus stop.
  fenceRun(0.1, -4.6, 0.1, 9.3, "rail"),
  fenceRun(0.1, 9.3, 17.2, 9.3, "rail"),
  fenceRun(18.8, 9.3, 23.9, 9.3, "rail"),

  // Trees (big and leafy, or pines), bushes and a few flowers.
  { kind: "yardTree", x: 6.2, y: YARD + 1.0, w: 1.0, h: 0.55, n: 0 }, // (clear of the Campfire sign)
  { kind: "yardTree", x: 1.0, y: YARD + 0.55, w: 1.0, h: 0.55, n: 1 },
  { kind: "pineTree", x: 11.2, y: YARD + 2.6, w: 0.9, h: 0.5, n: 2 },
  { kind: "yardTree", x: 0.6, y: YARD + 8.3, w: 1.0, h: 0.55, n: 3 },
  { kind: "pineTree", x: 23.0, y: YARD + 5.9, w: 0.9, h: 0.5, n: 6 },
  { kind: "bush", x: 14.3, y: YARD + 5.4, w: 0.9, h: 0.55, n: 1 },
  { kind: "bush", x: 4.1, y: YARD + 1.4, w: 0.9, h: 0.55, n: 2 },
  { kind: "bush", x: 20.6, y: YARD + 5.3, w: 0.9, h: 0.55, n: 3 },
  { kind: "wildflowers", x: 3.1, y: YARD + 8.7, w: 1.1, h: 0.3, solid: false },
  // A little life in the open grass (kept light): flowers and a rock
  // between the campfire and the pond; a birdbath, flowers, rocks and the
  // mailbox by the gate in the bottom right.
  { kind: "wildflowers", x: 2.0, y: YARD + 2.3, w: 1.1, h: 0.3, solid: false },
  { kind: "pondStones", x: 5.4, y: YARD + 2.6, w: 0.7, h: 0.35 },
  { kind: "mailbox", x: 19.9, y: YARD - 2.5, w: 0.4, h: 0.3 }, // by the porch steps
  { kind: "wildflowers", x: 19.8, y: YARD + 8.75, w: 0.9, h: 0.3, solid: false },
  { kind: "birdbath", x: 21.6, y: YARD + 6.9, w: 0.6, h: 0.4 },
  { kind: "pondStones", x: 23.1, y: YARD + 7.8, w: 0.7, h: 0.35 },
  { kind: "wildflowers", x: 12.2, y: YARD + 3.6, w: 0.5, h: 0.3, solid: false },
  { kind: "wildflowers", x: 21.3, y: YARD + 6.0, w: 1.0, h: 0.3, solid: false },

  // The garden beds (numbered, see garden.js): the starter patch's three
  // here, and the Farm's sixteen (they're all in GARDEN_BEDS).
  ...GARDEN_BEDS.map((b, n) => ({ kind: "gardenPlot", ...b, bed: n })),
  // In the starter patch: a watering station (a rain barrel with cans) by
  // the west fence, and a little scarecrow on the east side.
  { kind: "wateringStation", x: 12.95, y: YARD + 2.9, w: 1.0, h: 0.5 },
  { kind: "scarecrow", x: 16.25, y: YARD + 2.3, w: 0.7, h: 0.35 },
  // East of the path, where the rest of the garden was: open lawn again,
  // with a few flowers, a bush and a stone.
  { kind: "wildflowers", x: 19.6, y: YARD - 0.4, w: 1.1, h: 0.3, solid: false },
  { kind: "wildflowers", x: 22.1, y: YARD + 1.7, w: 1.0, h: 0.3, solid: false },
  { kind: "wildflowers", x: 20.2, y: YARD + 3.6, w: 0.9, h: 0.3, solid: false },
  { kind: "bush", x: 22.6, y: YARD - 0.6, w: 0.9, h: 0.55, n: 4 },
  { kind: "pondStones", x: 21.0, y: YARD + 1.1, w: 0.7, h: 0.35 },

  // Hazel the hedgehog's seed stand, just outside the garden's west fence
  // (walk up and press E to buy seeds or sell your harvest; see garden.js).
  { kind: "seedStand", x: 10.15, y: YARD - 1.35, w: 1.45, h: 0.6 },
  { kind: "hazel", x: 11.8, y: YARD - 1.05, w: 0.55, h: 0.4, place: "yard" }, // (only for new gardeners: see HAZEL)

  // The campfire: a stone fire pit that lights itself at night (see
  // outdoors.js), with four logs around it to sit on (press E by one).
  { kind: "firePit", x: 3.85, y: YARD - 2.55, w: 1.1, h: 0.7, glow: (f) => (isNightOutside() ? [f.x + f.w / 2, f.y + f.h / 2 - 0.3, 150, 0.85] : [0, 0, 0, 0]) },
  { kind: "logSeat", x: 3.3, y: YARD - 3.75, w: 2.2, h: 0.45, facing: "down" },
  { kind: "logSeat", x: 3.3, y: YARD - 1.0, w: 2.2, h: 0.45, facing: "up" },
  { kind: "logSeatSide", x: 2.1, y: YARD - 2.9, w: 0.45, h: 1.4, facing: "right" },
  { kind: "logSeatSide", x: 6.25, y: YARD - 2.9, w: 0.45, h: 1.4, facing: "left" },

  // Otis the otter's bait stand by the dock (walk up and press E for rods,
  // bait, selling fish and your fish log; see fishing.js).
  { kind: "baitCrate", x: 9.95, y: YARD + 4.25, w: 1.0, h: 0.5 },
  { kind: "otis", x: 10.25, y: YARD + 5.2, w: 0.55, h: 0.4, place: "pond" }, // (only for new fishers: see OTIS)
  { kind: "baitBox", x: 10.8, y: YARD + 5.0, w: 0.6, h: 0.45 }, // (once Otis has gone to the Lake)

  // Where the raccoons used to lurk. They've moved to the back alley
  // (Update 7) and taken their bins with them: the grass has grown back,
  // with a few flowers and a rock. Their way down is out on the sidewalk,
  // west of the bus stop: a manhole cover, a little off its seat, with a note
  // taped beside it and a faint trail of paw prints leading to it along the
  // sidewalk. Press E on it to climb down.
  { kind: "wildflowers", x: 10.8, y: YARD + 8.25, w: 0.9, h: 0.3, solid: false },
  { kind: "rock", x: 11.85, y: YARD + 8.55, w: 0.4, h: 0.25, solid: false },
  { kind: "wildflowers", x: 12.3, y: YARD + 7.55, w: 0.5, h: 0.3, solid: false },
  { kind: "pawTrail", x: 13.1, y: YARD + 9.5, w: 1.6, h: 0.5, points: [[14.5, 9.95], [14.05, 9.85], [13.6, 9.95], [13.15, 9.85]], solid: false },
  { kind: "manhole", x: 12.2, y: YARD + 9.55, w: 0.8, h: 0.5, solid: false, way: "down", tilt: true, note: "Moved. -R" },

  // The bus stop by the road: a shelter with a bench (press E to sit and
  // wait), the bus stop sign with its timetable, and the bus itself, which
  // drives along the road on a schedule (see outdoors.js and bus.js).
  { kind: "busShelter", x: 19.4, y: YARD + 9.5, w: 2.5, h: 0.75 },
  // Kitchen & Trade (Update 5): where Juniper the traveling merchant sets
  // out her blanket of wares by the bus stop on her day (drawn only then).
  // (The trading post stall stood here; trading moved to Porch Swap, a
  // website on the bedroom laptop. A bush and flowers where it was.)
  // The wishing well (Update 7): one coin a day, a small surprise.
  { kind: "wishingWell", x: 12.0, y: YARD + 5.75, w: 1.1, h: 0.8 },
  { kind: "wildflowers", x: 11.6, y: YARD + 6.35, w: 0.7, h: 0.3, solid: false },
  { kind: "merchantWares", x: 19.7, y: YARD + 8.0, w: 1.6, h: 0.5, solid: false },
  { kind: "juniper", x: 19.0, y: YARD + 8.25, w: 0.55, h: 0.4, solid: false },
  { kind: "busSign", x: 22.6, y: YARD + 10.0, w: 0.3, h: 0.2 },
  { kind: "bus", x: 0, y: YARD + 10.7, w: HOUSE_WIDTH, h: 0.5, solid: false },

  // Signposts, so you know where you are.
  { kind: "signpost", x: 8.0, y: YARD - 0.4, w: 0.3, h: 0.2, text: "Campfire", point: "left" },
  { kind: "signpost", x: 10.05, y: YARD + 3.4, w: 0.3, h: 0.2, text: "Pond", point: "left" },
  { kind: "signpost", x: 19.1, y: YARD - 1.9, w: 0.3, h: 0.2, text: "Garden", point: "left" },
  { kind: "signpost", x: 16.9, y: YARD + 8.1, w: 0.3, h: 0.2, text: "Bus Stop", point: "right" },
];

// Where you pop back to in the yard (say the area you were in vanished):
// at the bottom of the porch steps.
const YARD_SPAWN = { x: 17.7, y: YARD - 2.3 };

// --- Willow Lake (a bus trip away) ---
// A big lake in a clearing in the pines, on its own map (floor -2), laid
// out like the yard: x across 0 to HOUSE_WIDTH, y from its top (LAKE is
// added). Pine forest along the top; the lake in the middle with a little
// island, lily pads and reeds; a long pier from the south shore out to a
// wide platform (the best fishing), with two rowboats tied up; Otis's bait
// shack on the east shore; a path from the bus stop along the shore past
// benches, lanterns and a picnic table; the road and Gus's bus at the bottom.
const LAKE_AREA = { id: "lake", name: CONFIG.roomNames.lake, rect: { x: 0, y: LAKE - 5.4, w: HOUSE_WIDTH, h: 15.7 }, outdoor: true };

// Its edges (the pines, the sides and the curb), and the water.
const LAKE_WALLS = [
  { x: -WALL_THICKNESS, y: LAKE - 5.4, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: 0.5, hidden: true }, // the pines
  { x: -WALL_THICKNESS, y: LAKE - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // west edge
  { x: HOUSE_WIDTH, y: LAKE - 5.8, w: WALL_THICKNESS, h: 16, hidden: true }, // east edge
  { x: -WALL_THICKNESS, y: LAKE + 10.3, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: WALL_THICKNESS, hidden: true }, // the curb
  ...waterSolids(waterById("lake")),
];

// Its paths (painted like the yard's, see paintPaths in outdoors.js): from
// the bus stop up to the pier, and along the south shore both ways.
const LAKE_PATHS = [
  { w: 1.1, points: [[17.0, 9.3], [16.6, 7.8], [15.0, 6.6], [13.2, 5.6], [12.1, 4.6], [12.1, 3.5]] },
  { w: 0.95, points: [[12.1, 4.9], [9.8, 5.4], [7.2, 5.6], [4.8, 5.8], [2.6, 6.4], [1.2, 7.4]] },
  { w: 0.9, points: [[13.4, 5.5], [15.4, 4.8], [17.2, 4.4], [18.6, 4.0]] },
];

const LAKE_FURNITURE = [
  // The pine forest along the top: two staggered rows.
  ...[0.9, 3.0, 5.1, 7.2, 9.3, 11.4, 13.5, 15.6, 17.7, 19.8, 21.9].map((x, i) => ({ kind: "pineTree", x: x - 0.45, y: LAKE - 6.4, w: 0.9, h: 0.5, n: i, solid: false })),
  ...[-0.1, 2.0, 4.1, 6.2, 8.3, 10.4, 12.5, 14.6, 16.7, 18.8, 20.9, 23.0].map((x, i) => ({ kind: "pineTree", x: x - 0.45, y: LAKE - 5.6, w: 0.9, h: 0.5, n: i + 20, solid: false })),

  // The pier and its platform, the rowboats tied up beside them, and a
  // life ring on a post at the platform's corner.
  { kind: "lakePier", ...LAKE_PIER, solid: false },
  { kind: "lakePlatform", ...LAKE_PLATFORM, solid: false },
  { kind: "rowboat", x: 9.55, y: LAKE + 0.35, w: 1.3, h: 0.5, solid: false, n: 0 },
  { kind: "rowboat", x: 12.85, y: LAKE + 1.5, w: 1.3, h: 0.5, solid: false, n: 1 },

  // The island: a lone tree on a little hump of grass (drawn with the water).
  { kind: "yardTree", x: 4.4, y: LAKE - 2.05, w: 1.0, h: 0.55, n: 5, solid: false },

  // Reeds and cattails around the edge, stones and wildflowers on the shore.
  { kind: "reeds", x: 2.3, y: LAKE + 1.5, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 3.4, y: LAKE + 2.4, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 1.4, y: LAKE - 1.2, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 16.6, y: LAKE + 2.1, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 17.7, y: LAKE + 0.9, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 18.2, y: LAKE - 2.6, w: 0.6, h: 0.4, solid: false },
  { kind: "reeds", x: 7.6, y: LAKE + 2.95, w: 0.6, h: 0.4, solid: false },
  { kind: "pondStones", x: 5.4, y: LAKE + 3.35, w: 0.8, h: 0.4 },
  { kind: "pondStones", x: 18.9, y: LAKE - 1.1, w: 0.7, h: 0.35 },
  { kind: "pondStones", x: 0.4, y: LAKE + 2.6, w: 0.7, h: 0.35 },
  { kind: "wildflowers", x: 7.4, y: LAKE + 7.0, w: 1.1, h: 0.3, solid: false },
  { kind: "wildflowers", x: 19.8, y: LAKE + 6.4, w: 1.0, h: 0.3, solid: false },
  { kind: "wildflowers", x: 1.2, y: LAKE + 4.4, w: 0.9, h: 0.3, solid: false },
  { kind: "wildflowers", x: 10.6, y: LAKE + 7.9, w: 1.0, h: 0.3, solid: false },

  // Trees round the sides.
  { kind: "yardTree", x: 20.8, y: LAKE - 3.6, w: 1.0, h: 0.55, n: 1 },
  { kind: "pineTree", x: 22.6, y: LAKE - 0.9, w: 0.9, h: 0.5, n: 30 },
  { kind: "yardTree", x: 0.1, y: LAKE + 8.2, w: 1.0, h: 0.55, n: 2 },
  { kind: "pineTree", x: 22.9, y: LAKE + 5.3, w: 0.9, h: 0.5, n: 31 },
  { kind: "bush", x: 20.3, y: LAKE + 0.9, w: 0.9, h: 0.55, n: 1 },
  { kind: "bush", x: 4.1, y: LAKE + 8.6, w: 0.9, h: 0.55, n: 2 },
  { kind: "bush", x: 8.3, y: LAKE + 8.4, w: 0.9, h: 0.55, n: 3 },

  // Otis the otter's bait shack on the east shore (walk up and press E;
  // he's here once you've had his fishing lesson at the pond back home).
  { kind: "baitShack", x: 19.4, y: LAKE + 1.7, w: 2.6, h: 1.0 },
  { kind: "baitCrate", x: 22.2, y: LAKE + 2.3, w: 1.0, h: 0.5 },
  { kind: "otis", x: 18.7, y: LAKE + 2.9, w: 0.55, h: 0.4, place: "lake" },

  // Along the shore path: benches looking out over the water (press E to
  // sit), lanterns, a picnic table, and the lake's sign by the bus stop.
  { kind: "parkBench", x: 6.2, y: LAKE + 4.55, w: 1.5, h: 0.45 },
  { kind: "parkBench", x: 14.6, y: LAKE + 3.55, w: 1.5, h: 0.45 },
  { kind: "lampPost", x: 10.55, y: LAKE + 4.9, w: 0.3, h: 0.25 },
  { kind: "lampPost", x: 3.3, y: LAKE + 5.2, w: 0.3, h: 0.25 },
  { kind: "lampPost", x: 16.3, y: LAKE + 4.0, w: 0.3, h: 0.25 },
  { kind: "lampPost", x: 17.9, y: LAKE + 8.2, w: 0.3, h: 0.25 },
  { kind: "picnicTable", x: 2.2, y: LAKE + 7.6, w: 1.8, h: 0.9 },
  { kind: "lakeSign", x: 19.5, y: LAKE + 7.3, w: 2.2, h: 0.35 },

  // The bus stop by the road, with Gus's bus parked to take you home.
  { kind: "busShelter", x: 19.4, y: LAKE + 9.5, w: 2.5, h: 0.75 },
  { kind: "busSign", x: 22.6, y: LAKE + 10.0, w: 0.3, h: 0.2 },
  { kind: "bus", x: 0, y: LAKE + 10.7, w: HOUSE_WIDTH, h: 0.5, solid: false, stopX: 14.8 },
];

// Where Otis is, for you: at the pond until you've had his fishing lesson,
// then at the Lake (fishing.js keeps `atLake` up to date from your save).
const OTIS = { atLake: true };
const otisHere = (f) => (f.place === "lake") === OTIS.atLake;

// Where you step off the bus at the Lake.
const LAKE_SPAWN = { x: 16.8, y: LAKE + 8.7 };

// --- The back alley (Update 7) ---
// A narrow cobbled alley behind the house, where the raccoons moved their
// not-a-shop. On its own small map (floor -3), shown whole. You get there
// down the manhole in the yard (and come up out of the matching one here:
// it's where the alley's steam comes from).
// Along the top: the house's wooden side wall, then the tall brick back of
// the building next door, with a fire escape, Reginald's back door and the
// raccoons' pink neon sign. The west end opens onto a sliver of street (a
// streetlight on the corner, a barrier across the alley's mouth); the east
// end is a padlocked chain-link fence (one day, maybe). Clutter lines the
// edges (pallets, a bike, pipes, crates with a cat asleep on them), and
// the middle stays clear to walk. It's always dusk back here.
// Voice is on. x runs 0 to ALLEY_W, y from ALLEY (the foot of the walls).
const ALLEY_W = 12, ALLEY_H = 3.9;
const ALLEY_CURB = 1.25; // the street's curb: west of it, the street (not walkable)
const ALLEY_WALK = 3.2; // the walkway's south edge (the clutter and a low brick ledge beyond)
const ALLEY_AREA = { id: "alley", name: CONFIG.roomNames.alley, rect: { x: 0, y: ALLEY, w: ALLEY_W, h: ALLEY_H }, outdoor: true };
const HOUSE_SIDE_W = 4.6; // where the house's side wall ends and the brick building begins

const ALLEY_WALLS = [
  { x: -WALL_THICKNESS, y: ALLEY - 0.5, w: ALLEY_W + 2 * WALL_THICKNESS, h: 0.5, hidden: true }, // the walls along the top
  { x: ALLEY_CURB, y: ALLEY - 0.5, w: 0.25, h: ALLEY_H + 1, hidden: true }, // the barrier at the street
  { x: ALLEY_W, y: ALLEY - 0.5, w: WALL_THICKNESS, h: ALLEY_H + 1, hidden: true }, // the padlocked fence (east)
  { x: ALLEY_CURB, y: ALLEY + ALLEY_WALK, w: ALLEY_W - ALLEY_CURB, h: 1.2, hidden: true }, // the clutter and the ledge (south)
];

const ALLEY_FURNITURE = [
  // Along the house's side: herbs in old tin cans, and an old sofa someone
  // dragged out (sit on it), by the drainpipe.
  { kind: "herbCans", x: 1.55, y: ALLEY + 0.05, w: 1.1, h: 0.35 },
  { kind: "alleySofa", x: 2.8, y: ALLEY + 0.1, w: 1.6, h: 0.6 },
  // Along the brick building: recycling bins, the raccoons' rolling rack
  // of hats (their "stock"), Reginald's back door with a caged bulb over
  // it, the raccoons themselves, their NOT A SHOP dumpster, the bins, and
  // their "totally normal trash" sign beside them.
  { kind: "recyclingBins", x: 4.9, y: ALLEY + 0.1, w: 1.15, h: 0.5 },
  { kind: "hatRack", x: 6.25, y: ALLEY + 0.2, w: 1.3, h: 0.4 },
  { kind: "reginaldDoor", x: 7.8, y: ALLEY, w: 0.95, solid: false },
  { kind: "cagedLamp", x: 8.27, y: ALLEY, solid: false },
  { kind: "raccoons", x: 7.95, y: ALLEY + 0.95, w: 0.65, h: 0.45 },
  { kind: "dumpster", x: 9.4, y: ALLEY + 0.1, w: 1.5, h: 0.7 },
  { kind: "trashCans", x: 11.05, y: ALLEY + 0.2, w: 0.8, h: 0.45 },
  { kind: "shadySign", x: 11.35, y: ALLEY + 0.72, w: 0.3, h: 0.15 },
  // A little hangout at the walkway's south edge: a cable spool for a
  // table, with a candle in a bottle, and milk crates to sit on.
  { kind: "cableSpool", x: 6.15, y: ALLEY + 2.5, w: 0.8, h: 0.55 },
  { kind: "milkCrate", x: 5.4, y: ALLEY + 2.6, w: 0.5, h: 0.45, solid: false },
  { kind: "milkCrate", x: 7.2, y: ALLEY + 2.6, w: 0.5, h: 0.45, solid: false },
  // Clutter along the south edge, past the walkway.
  { kind: "pallets", x: 1.6, y: ALLEY + 3.3, w: 1.2, h: 0.4 },
  { kind: "alleyBike", x: 3.05, y: ALLEY + 3.35, w: 1.25, h: 0.3 },
  { kind: "crateStack", x: 4.5, y: ALLEY + 3.25, w: 0.95, h: 0.55 },
  { kind: "pipeStack", x: 8.2, y: ALLEY + 3.35, w: 1.6, h: 0.35 },
  { kind: "trashBags", x: 10.15, y: ALLEY + 3.35, w: 0.6, h: 0.35, solid: false },
  { kind: "pallets", x: 10.85, y: ALLEY + 3.3, w: 1.0, h: 0.4 },
  // The manhole you climb up out of (and back down), steaming a little.
  { kind: "manhole", x: 3.2, y: ALLEY + 1.8, w: 0.8, h: 0.5, solid: false, way: "up" },
  // The streetlight on the sidewalk past the barrier.
  { kind: "streetLamp", x: 0.62, y: ALLEY + 1.3, w: 0.3, h: 0.2, solid: false },
];

// Where you come up in the alley: beside the manhole.
const ALLEY_SPAWN = { x: 4.1, y: ALLEY + 1.8 };

// --- The Farm (a bus trip away, Update 8) ---
// Hazel's farm, where the big garden is. On its own map (floor -4), laid
// out like the yard: x across 0 to HOUSE_WIDTH, y from its top (FARM is
// the top of its walkable middle, like YARD). Along the top: the big red
// barn and its silo, Hazel's farm stand, a fenced chicken run with the
// coop, and a windmill. In the middle: the fields (sixteen shared beds,
// four rows of four, a walkway down the middle), a well, a wheelbarrow and
// hay bales, an orchard of apple trees to the west, and a fenced pumpkin
// patch with sunflowers and a scarecrow to the east. Along the bottom: a
// picnic table, a bench facing the fields, the farm's sign, the road and
// Gus's bus. Voice is on everywhere here.
const FARM_AREA = { id: "farm", name: CONFIG.roomNames.farm, rect: { x: 0, y: FARM - 5.4, w: HOUSE_WIDTH, h: 15.7 }, outdoor: true };

// Its edges (the hedgerow along the top, the sides, the curb).
const FARM_WALLS = [
  { x: -WALL_THICKNESS, y: FARM - 5.4, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: 0.5, hidden: true },
  { x: -WALL_THICKNESS, y: FARM - 5.8, w: WALL_THICKNESS, h: 16, hidden: true },
  { x: HOUSE_WIDTH, y: FARM - 5.8, w: WALL_THICKNESS, h: 16, hidden: true },
  { x: -WALL_THICKNESS, y: FARM + 10.3, w: HOUSE_WIDTH + 2 * WALL_THICKNESS, h: WALL_THICKNESS, hidden: true },
];

// Its paths (painted like the yard's, see paintPaths in outdoors.js): the
// lane along the top past the barn and Hazel's stand, the walkway down the
// middle of the fields, on down to the bus stop, and a spur to the picnic table.
const FARM_PATHS = [
  { w: 1.0, points: [[2.6, -0.95], [5.2, -0.9], [8.4, -0.98], [11.5, -1.0], [15.0, -1.05], [19.6, -1.0]] },
  { w: 1.1, points: [[11.5, -1.0], [11.5, 1.6], [11.5, 4.2], [11.5, 6.9], [11.6, 7.7]] },
  { w: 1.1, points: [[11.6, 7.7], [12.7, 8.5], [14.6, 8.9], [16.5, 9.1], [17.4, 9.8]] },
  { w: 0.85, points: [[11.5, 7.7], [10.0, 8.0], [8.6, 8.3]] },
];

const FARM_FURNITURE = [
  // Along the top: a hedgerow of trees, the barn and silo with hay bales,
  // Hazel's farm stand (Hazel stands beside it, once she's moved here: see
  // HAZEL), the chicken run and the windmill.
  { kind: "yardTree", x: 7.3, y: FARM - 4.7, w: 1.0, h: 0.55, n: 5 },
  { kind: "yardTree", x: 10.3, y: FARM - 4.95, w: 1.0, h: 0.55, n: 1 },
  { kind: "yardTree", x: 18.9, y: FARM - 4.75, w: 1.0, h: 0.55, n: 2 },
  { kind: "pineTree", x: 23.0, y: FARM - 4.6, w: 0.9, h: 0.5, n: 7 },
  { kind: "barn", x: 0.6, y: FARM - 2.6, w: 5.2, h: 1.3 },
  { kind: "silo", x: 6.15, y: FARM - 2.25, w: 1.25, h: 0.9 },
  { kind: "hayBales", x: 0.7, y: FARM - 1.25, w: 1.2, h: 0.55 },
  { kind: "farmStand", x: 8.1, y: FARM - 2.35, w: 2.7, h: 0.75 },
  { kind: "hazel", x: 10.95, y: FARM - 2.0, w: 0.55, h: 0.4, place: "farm" },
  { kind: "lampPost", x: 7.6, y: FARM - 1.75, w: 0.3, h: 0.25 },
  fenceRun(12.8, -4.3, 18.4, -4.3, "rail", FARM),
  fenceRun(12.8, -1.6, 18.4, -1.6, "rail", FARM),
  fenceRun(12.8, -4.3, 12.8, -1.6, "rail", FARM),
  fenceRun(18.4, -4.3, 18.4, -1.6, "rail", FARM),
  { kind: "chickenCoop", x: 13.3, y: FARM - 3.65, w: 1.9, h: 0.9 },
  { kind: "chickens", x: 13.1, y: FARM - 2.55, w: 5.0, h: 0.75, solid: false },
  { kind: "windmill", x: 20.5, y: FARM - 2.75, w: 2.1, h: 1.2 },

  // The fields: a rail fence round the sixteen beds (the beds themselves
  // are in GARDEN_BEDS), open where the walkway goes through.
  fenceRun(5.9, -0.3, 10.9, -0.3, "rail", FARM),
  fenceRun(12.1, -0.3, 17.1, -0.3, "rail", FARM),
  fenceRun(5.9, 6.9, 10.9, 6.9, "rail", FARM),
  fenceRun(12.1, 6.9, 17.1, 6.9, "rail", FARM),
  fenceRun(5.9, -0.3, 5.9, 6.9, "rail", FARM),
  fenceRun(17.1, -0.3, 17.1, 6.9, "rail", FARM),
  { kind: "well", x: 17.6, y: FARM + 0.7, w: 1.1, h: 0.8 },
  { kind: "wheelbarrow", x: 17.55, y: FARM + 3.4, w: 1.1, h: 0.5 },
  { kind: "hayBales", x: 17.55, y: FARM + 5.4, w: 1.2, h: 0.55 },

  // The orchard, west of the fields: apple trees (apples on the branches
  // and a few in the grass), and a crate of picked ones.
  { kind: "appleTree", x: 0.6, y: FARM + 0.35, w: 1.0, h: 0.55, n: 0 },
  { kind: "appleTree", x: 3.2, y: FARM + 0.8, w: 1.0, h: 0.55, n: 1 },
  { kind: "appleTree", x: 1.5, y: FARM + 3.0, w: 1.0, h: 0.55, n: 2 },
  { kind: "appleTree", x: 4.1, y: FARM + 3.45, w: 1.0, h: 0.55, n: 3 },
  { kind: "appleTree", x: 0.6, y: FARM + 5.6, w: 1.0, h: 0.55, n: 4 },
  { kind: "appleTree", x: 3.1, y: FARM + 6.1, w: 1.0, h: 0.55, n: 5 },
  { kind: "appleCrate", x: 2.0, y: FARM + 8.05, w: 0.8, h: 0.5 },

  // The pumpkin patch, east of the fields: a low fence round it, pumpkins
  // on their vines, sunflowers along the back, and a scarecrow.
  fenceRun(19.3, 0.9, 23.7, 0.9, "rail", FARM),
  fenceRun(19.3, 6.4, 23.7, 6.4, "rail", FARM),
  fenceRun(19.3, 0.9, 19.3, 6.4, "rail", FARM),
  fenceRun(23.7, 0.9, 23.7, 6.4, "rail", FARM),
  { kind: "sunflowerRow", x: 19.5, y: FARM + 1.0, w: 4.0, h: 0.45, solid: false },
  { kind: "pumpkinPatch", x: 19.5, y: FARM + 1.6, w: 4.0, h: 4.6, solid: false },
  { kind: "scarecrow", x: 21.2, y: FARM + 3.3, w: 0.7, h: 0.35 },

  // Along the bottom: a picnic table, a bench facing the fields, lamps,
  // flowers, the farm's sign, the fence along the sidewalk (with a gap for
  // the path), and the bus stop.
  { kind: "picnicTable", x: 6.8, y: FARM + 7.85, w: 1.8, h: 0.9 },
  { kind: "parkBench", x: 13.6, y: FARM + 7.55, w: 1.5, h: 0.45 },
  { kind: "lampPost", x: 10.7, y: FARM + 7.3, w: 0.3, h: 0.25 },
  { kind: "lampPost", x: 18.1, y: FARM + 8.2, w: 0.3, h: 0.25 },
  { kind: "wildflowers", x: 4.6, y: FARM + 8.6, w: 1.1, h: 0.3, solid: false },
  { kind: "wildflowers", x: 19.9, y: FARM + 7.4, w: 1.0, h: 0.3, solid: false },
  { kind: "wildflowers", x: 9.4, y: FARM + 6.95, w: 0.9, h: 0.3, solid: false },
  { kind: "bush", x: 22.6, y: FARM + 7.3, w: 0.9, h: 0.55, n: 5 },
  { kind: "bush", x: 0.5, y: FARM + 8.3, w: 0.9, h: 0.55, n: 6 },
  { kind: "farmSign", x: 12.2, y: FARM + 9.3, w: 1.7, h: 0.25 },
  fenceRun(0.1, -4.6, 0.1, 9.3, "rail", FARM),
  fenceRun(0.1, 9.3, 11.6, 9.3, "rail", FARM),
  fenceRun(18.3, 9.3, 23.9, 9.3, "rail", FARM),
  { kind: "busShelter", x: 19.4, y: FARM + 9.5, w: 2.5, h: 0.75 },
  { kind: "busSign", x: 22.6, y: FARM + 10.0, w: 0.3, h: 0.2 },
  { kind: "bus", x: 0, y: FARM + 10.7, w: HOUSE_WIDTH, h: 0.5, solid: false, stopX: 14.8 },
];

// Where you arrive at the Farm, and pop back to: just inside the gate by the bus stop.
const FARM_SPAWN = { x: 16.9, y: FARM + 8.6 };

// Hazel the hedgehog: by her seed stand in the yard until you've had her
// gardening lesson (garden.js), then at her farm stand here (for you). A
// seed box takes her place in the yard. main.js keeps atFarm up to date.
const HAZEL = { atFarm: true };
const hazelHere = (f) => (f.place === "farm") === HAZEL.atFarm;

// Is it night outside? Update 4's weather (weather.js) fills in OUTDOORS
// from the real sky over the hometown; until it has, night is guessed from
// this computer's clock (CONFIG.outdoors.nightFrom to nightTo).
// Whether Juniper, the traveling merchant, is in the yard today (Update
// 5: market.js fills it in from the house server).
const MERCHANT = { here: false };

// Whether a piece is really there right now. The house's visitors come and
// go (Hazel, Otis and his pond stand, Otis's bait box, Juniper and her
// wares): while one is away you can walk through their spot, and a
// right-click there finds nothing.
function isThere(f) {
  if (f.showroom) return true; // (the showroom shows everyone)
  if (f.kind === "hazel") return hazelHere(f);
  if (f.kind === "otis") return otisHere(f);
  if (f.kind === "baitCrate" && floorOf(f.y) === YARD_FLOOR) return !OTIS.atLake; // (his pond stand goes with him)
  if (f.kind === "baitBox") return OTIS.atLake; // (and his bait box and note take its place)
  if (f.kind === "juniper" || f.kind === "merchantWares") return MERCHANT.here;
  return true;
}

// Whether a box bumps into a wall or something solid that's there.
const bumpsIntoSomething = (box) => SOLIDS.some((s) => rectsOverlap(box, s) && isThere(s));
const OUTDOORS = { night: null, sky: "clear", rain: 0, snow: 0, clouds: 0, temp: null, raining: false, words: "", updated: 0 };
function isNightOutside() {
  if (OUTDOORS.night !== null) return OUTDOORS.night;
  const hour = new Date().getHours();
  const { nightFrom, nightTo } = CONFIG.outdoors;
  return hour >= nightFrom || hour < nightTo;
}


// --- Residents (Update 6) ---
// Characters who live in the house and keep their own hours, by the
// hometown's clock: Clover the rabbit bakes in the kitchen in the morning,
// takes a stroll in the yard at midday and is back for supper; Mortimer
// the owl, the librarian, sleeps on his perch in the Library all day and
// pads between the shelves at night. Each part of their day is a loop of
// stops ({ x, y } where their feet are, how long they stay, and what they
// do there); where they are in it comes from the clock, so everyone sees
// them in the same place. Outside all their hours they're home (not shown).
// Their talk lives in residents.js, their looks in render-residents.js.
// --- The moon (Update 8) ---
// How far through its cycle the real moon is (0 new, 0.5 full), from a
// known new moon (January 6, 2000). Full moon: about two nights either
// side of the peak. The house server uses the same sums.
function moonPhase(now = Date.now()) {
  const synodic = 29.530588853 * 86_400_000;
  return ((((now - Date.UTC(2000, 0, 6, 18, 14)) / synodic) % 1) + 1) % 1;
}
function isFullMoon(now = Date.now()) {
  const p = moonPhase(now);
  return p > 0.466 && p < 0.534;
}

// Mothman's lamp visit (Update 8): set by main.js when you arrive at night
// and he's come to sit by your bedside lamp ({ x, y, until }), or null.
let mothVisit = null;
function setMothVisit(visit) {
  mothVisit = visit;
}

const RESIDENTS = [
  {
    id: "clover",
    name: "Clover",
    kind: "rabbit",
    speed: 1.1, // tiles a second
    day: [
      { from: 5, to: 11, stops: [
        { x: 13.05, y: 4.4, stay: 14, act: "bake" },
        { x: 14.9, y: 4.4, stay: 7, act: "stir" },
        { x: 17.3, y: 4.45, stay: 4, act: "fetch" },
        { x: 14.9, y: 4.4, stay: 6, act: "stir" },
      ] },
      { from: 11, to: 16, stops: [
        { x: 17.0, y: YARD - 2.2, stay: 10, act: "stroll" },
        { x: 12.9, y: YARD - 1.85, stay: 16, act: "chat", face: -1 },
      ] },
      { from: 16, to: 21, stops: [
        { x: 13.05, y: 4.4, stay: 16, act: "bake" },
        { x: 14.9, y: 4.4, stay: 6, act: "stir" },
        { x: 16.45, y: 4.45, stay: 6, act: "wash" },
        { x: 14.9, y: 4.4, stay: 4, act: "stir" },
      ] },
    ],
  },
  {
    id: "mortimer",
    name: "Mortimer",
    kind: "owl",
    speed: 0.9,
    day: [
      { from: 19, to: 6, stops: [
        { x: 2.45, y: -1.6, stay: 16, act: "read" },
        { x: 2.3, y: -2.65, stay: 0 },
        { x: 1.3, y: -2.7, stay: 9, act: "shelve" },
        { x: 2.3, y: -2.65, stay: 0 },
        { x: 3.05, y: -4.3, stay: 9, act: "look" },
        { x: 3.8, y: -2.7, stay: 0 },
        { x: 4.6, y: -2.7, stay: 9, act: "shelve" },
        { x: 3.8, y: -2.7, stay: 0 },
      ] },
      { from: 6, to: 19, asleep: true, stops: [{ x: 5.4, y: -2.62, stay: 60, act: "perch" }] },
    ],
  },
  // Mothman (Update 8): shy, fluffy, and only out at night, drifting
  // between the lights: the two porch lanterns, the top of the porch
  // steps, and the campfire.
  {
    id: "mothman",
    name: "Mothman",
    kind: "moth",
    speed: 0.7,
    day: [
      { from: 20, to: 5, stops: [
        { x: 19.55, y: YARD - 4.9, stay: 22, act: "lamp" },
        { x: 22.15, y: YARD - 4.9, stay: 18, act: "lamp" },
        { x: 17.9, y: YARD - 2.9, stay: 8, act: "look" },
        { x: 5.2, y: YARD - 1.7, stay: 14, act: "fire" },
      ] },
    ],
  },
];

// The hometown's hour right now, with minutes as a fraction (like 13.5).
// The live weather tells us the hometown's offset from UTC; until it has,
// this computer's own clock is used.
function hometownHour(now = Date.now()) {
  const offset = OUTDOORS.utcOffset ?? -new Date(now).getTimezoneOffset() * 60_000;
  const d = new Date(now + offset);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

// Where a resident is right now: { x, y, facing (-1 left, 1 right, 0 front,
// "back"), moving, act, asleep }, or null while they're home.
function residentState(r, now = Date.now()) {
  // (Mothman sitting by your bedside lamp, for a little while after you arrive.)
  if (r.id === "mothman") {
    if (mothVisit && now < mothVisit.until) return { x: mothVisit.x, y: mothVisit.y, facing: 0, moving: false, act: "lamp", asleep: false, visit: true };
    // (Only while it's really dark out, and at nine he leads the moths at
    // the porch light.)
    if (!isNightOutside()) return null;
    if (typeof porchSwarmOn === "function" && porchSwarmOn(now)) return { x: 20.85, y: YARD - 4.9, facing: 0, moving: false, act: "lamp", asleep: false };
  }
  const hour = hometownHour(now);
  const part = r.day.find((p) => (p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to));
  if (!part) return null;
  const stops = part.stops;
  // One trip round the loop: stay at each stop, then walk to the next.
  const legs = stops.map((s, i) => {
    const next = stops[(i + 1) % stops.length];
    return { s, next, walk: stops.length > 1 ? Math.hypot(next.x - s.x, next.y - s.y) / r.speed : 0 };
  });
  const loop = legs.reduce((sum, l) => sum + l.s.stay + l.walk, 0) || 1;
  let t = (now / 1000) % loop;
  for (const { s, next, walk } of legs) {
    if (t < s.stay) {
      // Facing: at the counter or the shelves you face the wall; otherwise
      // towards whatever the stop says, or the front.
      const facing = ["bake", "fetch", "wash", "shelve", "look"].includes(s.act) ? "back" : s.face ?? 0;
      return { x: s.x, y: s.y, facing, moving: false, act: s.act, asleep: !!part.asleep, t: s.stay - t };
    }
    t -= s.stay;
    if (t < walk) {
      const k = t / walk;
      const dx = next.x - s.x, dy = next.y - s.y;
      const facing = Math.abs(dx) > Math.abs(dy) * 0.6 ? Math.sign(dx) : dy < 0 ? "back" : 0;
      return { x: s.x + dx * k, y: s.y + dy * k, facing, moving: true, act: null, asleep: false };
    }
    t -= walk;
  }
  const s = stops[0];
  return { x: s.x, y: s.y, facing: 0, moving: false, act: s.act, asleep: !!part.asleep };
}

// The resident you're standing next to (within `reach` tiles), with how
// far away they are: { r, state, d }, or null.
function residentInReach(player, reach = 1.1) {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE;
  let best = null;
  for (const r of RESIDENTS) {
    const state = residentState(r);
    if (!state || floorOf(state.y) !== floorOf(player.y)) continue;
    const d = Math.hypot(cx - state.x, (cy - state.y) * 1.2);
    if (d < reach && (!best || d < best.d)) best = { r, state, d };
  }
  return best;
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
    { size: "big", x: 18.9, y: 0.1 }, // hallway, between the lamp and the east window
    { size: "small", x: 7.4, y: 9.8 }, // Study, by the beanbag
    { size: "big", x: 10.9, y: 8.7 }, // Study, beside the rug
    { size: "small", x: 13.65, y: 10.15 }, // Dinner, by the tea cart
    { size: "big", x: 16.9, y: 8.9 }, // Dinner, by the lemon tree
    { size: "small", x: 5.3, y: 9.2 }, // Theater, by the popcorn
    { size: "big", x: 1.0, y: 10.0 }, // Theater, back corner
    { size: "small", x: 2.8, y: -5.0 }, // Library, under the windows
    { size: "big", x: 4.3, y: -1.0 }, // Library, in the front corner (Mortimer's perch is by the fern)
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
  for (const corridor of [0, BUSINESS, SUITE]) {
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
// Where you can sit on each kind of furniture. Each seat spot is:
//   x, y  the exact spot your feet rest, as a fraction of the piece's
//         footprint (0 to 1 across, 0 to 1 down)
//   face  which way you face: "down", "up" (away from us), "left",
//         "right", or "front" (the way the piece faces: down, or right
//         or left for a turned piece). A chair's "own" is the way it faces.
//   lift  how far up you're drawn, in pixels, so you sit on the seat's
//         surface instead of the floor.
// Seats whose back faces us (a chair facing away, cinema seats) are drawn
// over you, so their back hides your lower back; every other seat is
// drawn behind you. Press E near a free spot to sit; moving gets you up.
// See CONFIG.sit for the reach.
const SEATS = {
  // Chairs: on the seat, whichever way they face. Facing down (behind a
  // table, say), you sit up on the seat, so the table only hides your
  // lower half; facing away, the chair's back hides your lower back.
  chair: {
    down: [{ x: 0.5, y: 0.95, face: "down", lift: 9 }],
    up: [{ x: 0.5, y: 0.6, face: "upTall", lift: 19 }],
    left: [{ x: 0.42, y: 0.92, face: "left", lift: 9 }],
    right: [{ x: 0.58, y: 0.92, face: "right", lift: 9 }],
  },
  stool: [{ x: 0.5, y: 0.75, face: "up", lift: 6 }],
  theaterSeat: [{ x: 0.5, y: 0.6, face: "upTall", lift: 12 }],
  cinemaSofa: [{ x: 0.2, y: 0.65, face: "upTall", lift: 12 }, { x: 0.5, y: 0.65, face: "upTall", lift: 12 }, { x: 0.8, y: 0.65, face: "upTall", lift: 12 }],
  bench: [{ x: 0.28, y: 0.95, face: "front", lift: 5 }, { x: 0.72, y: 0.95, face: "front", lift: 5 }],
  loveseat: [{ x: 0.3, y: 0.92, face: "front", lift: 6 }, { x: 0.7, y: 0.92, face: "front", lift: 6 }],
  cloudSofa: [{ x: 0.22, y: 0.92, face: "front", lift: 6 }, { x: 0.5, y: 0.92, face: "front", lift: 6 }, { x: 0.78, y: 0.92, face: "front", lift: 6 }],
  armchair: [{ x: 0.5, y: 0.92, face: "front", lift: 6 }],
  cottageChair: [{ x: 0.5, y: 0.92, face: "front", lift: 6 }],
  papasanChair: [{ x: 0.5, y: 0.85, face: "front", lift: 6 }],
  eggChair: [{ x: 0.5, y: 0.9, face: "front", lift: 6 }],
  rockingChair: [{ x: 0.5, y: 0.92, face: "front", lift: 6 }],
  beanbag: [{ x: 0.5, y: 0.85, face: "front", lift: 3 }],
  pouf: [{ x: 0.5, y: 0.85, face: "front", lift: 5 }],
  mushroomStool: [{ x: 0.5, y: 0.85, face: "front", lift: 5 }],
  floorCushions: [{ x: 0.3, y: 0.85, face: "front", lift: 1 }, { x: 0.7, y: 0.85, face: "front", lift: 1 }],
  // Outdoors (Update 4): the bus shelter's bench, the porch swing, and the
  // campfire's logs ("own": facing the way the log does, toward the fire).
  busShelter: [{ x: 0.3, y: 0.95, face: "front", lift: 5 }, { x: 0.7, y: 0.95, face: "front", lift: 5 }],
  porchSwing: [{ x: 0.28, y: 0.95, face: "front", lift: 6 }, { x: 0.72, y: 0.95, face: "front", lift: 6 }],
  logSeat: [{ x: 0.28, y: 0.8, face: "own", lift: 4 }, { x: 0.72, y: 0.8, face: "own", lift: 4 }],
  // The Lake's benches face the water (away from us): the backrest hides your lower back.
  parkBench: [{ x: 0.28, y: 0.55, face: "up", lift: 5 }, { x: 0.72, y: 0.55, face: "up", lift: 5 }],
  // The back alley's old sofa and milk crates.
  alleySofa: [{ x: 0.3, y: 0.92, face: "front", lift: 6 }, { x: 0.7, y: 0.92, face: "front", lift: 6 }],
  milkCrate: [{ x: 0.5, y: 0.85, face: "front", lift: 7 }],
  // Beds: sit on the edge, at the foot.
  bed: [{ x: 0.3, y: 0.98, face: "down", lift: 6 }, { x: 0.7, y: 0.98, face: "down", lift: 6 }],
  canopyBed: [{ x: 0.3, y: 0.98, face: "down", lift: 6 }, { x: 0.7, y: 0.98, face: "down", lift: 6 }],
  mattress: [{ x: 0.3, y: 0.98, face: "down", lift: 3 }, { x: 0.7, y: 0.98, face: "down", lift: 3 }],
};

// True for seats whose back faces us: they're drawn over whoever sits in
// them, so you see their head above the back.
function seatCoversSitter(f) {
  return f.kind === "theaterSeat" || f.kind === "cinemaSofa" || f.kind === "parkBench" || (f.kind === "chair" && f.facing === "up");
}

// The seat spots on one piece of furniture: { key, x, y, face, lift,
// sortY }, where x, y is where your feet rest (in grid units) and sortY
// is where you're sorted for drawing: just in front of the piece, or
// just behind it if its back faces us. A turned piece ("loveseatSide",
// facing right or left) gets its spots turned too.
function seatSpots(f) {
  const turned = f.kind.endsWith("Side");
  const kind = turned ? f.kind.slice(0, -4) : f.kind;
  const spots = kind === "chair" ? SEATS.chair[f.facing || "down"] : SEATS[kind];
  if (!spots || f.h === undefined) return [];
  const covered = seatCoversSitter(f);
  return spots.map((s, i) => {
    let fx = s.x, fy = s.y, face = s.face;
    if (face === "own") face = f.facing || "down";
    if (turned) {
      // Turned 90 degrees: along the piece's length is now down the page,
      // and "front" is toward the room (right or left): you sit on the
      // seat, between its back and its front edge.
      const right = f.facing === "right";
      fy = 0.15 + s.x * 0.8;
      fx = right ? 0.6 : 0.4;
      if (face === "front" || face === "down") face = right ? "right" : "left";
      if (kind === "bed" || kind === "canopyBed" || kind === "mattress") {
        // A turned bed: still sit on its front edge, away from the headboard.
        fx = right ? 0.4 + s.x * 0.5 : 0.6 - s.x * 0.5;
        fy = 0.98;
        face = "down";
      }
    } else if (face === "front") {
      face = "down";
    }
    const x = f.x + f.w * fx, y = f.y + f.h * fy;
    return { key: `${floorOf(y)}:${Math.round(x * 20)}:${Math.round(y * 20)}`, x, y, face, lift: s.lift, sortY: f.y + f.h + (covered ? -0.02 : 0.02), n: i };
  });
}

// Every seat spot on a floor (0 downstairs, 1 upstairs).
// (Asked for every frame, so each floor's list is remembered until the
// house changes.)
let seatCache = { version: -1, floors: new Map() }; // floor -> seat spots, for one house layout
function seatsOnFloor(floor) {
  if (seatCache.version !== houseVersion) seatCache = { version: houseVersion, floors: new Map() };
  if (!seatCache.floors.has(floor)) seatCache.floors.set(floor, FURNITURE.filter((f) => floorOf(f.y) === floor).flatMap(seatSpots));
  return seatCache.floors.get(floor);
}

// --- Private rooms: offices ---
// Offices sit north of the hallway in up to three spots, filled left to
// right. When one is removed, the ones after it slide over to close the
// gap. The "+" door for making a new one is always on the wall at the
// next free spot. The layout:
//   slots: how many can exist at once. width: grid units per room,
//   including its wall. firstX: left edge of the first spot. floorY: the y
//   of the corridor wall they open onto (the hallway, or the suite floor).
//   doorX: where the doorway starts, from the room's left edge. depth: how
//   far north it reaches from the corridor.
const WINGS = {
  office: { slots: 3, width: 4, firstX: 6, floorY: BUSINESS, doorX: 1, depth: 5, name: "Office" },
};
const BEDROOM_DEPTH = 8; // every bedroom, from its back wall to its door
const DOOR_WIDTH = 1.6;
const SUITE_DOOR = 0.9; // a bedroom door on the suite floor (narrower: it's a door, not a doorway)

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
// in the order they go along the suite floor.
let lastBuild = [[], []]; // what the house was last built with (see previewSeason)
function buildHouse(offices, doors = []) {
  lastBuild = [offices, doors];
  const t = WALL_THICKNESS;
  const rooms = [...BASE_ROOMS, ...YARD_ROOMS];
  const walls = [...BASE_WALLS, ...YARD_WALLS, ...LAKE_WALLS, ...ALLEY_WALLS, ...FARM_WALLS];
  const furniture = [...BASE_FURNITURE, ...seasonalFurniture(), ...YARD_FURNITURE, ...LAKE_FURNITURE, ...ALLEY_FURNITURE, ...FARM_FURNITURE];

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
  // (x 2 to 3.6), and the business corridor's, with a doorway into the
  // Conference Room (x 2 to 3.6) and each office.
  corridorWall(0, [2]);
  corridorWall(BUSINESS, [2, ...offices.map((o) => wingX("office", o.slot) + WINGS.office.doorX)]);
  add("office", offices);

  // The suite floor's hall: one solid wall with every
  // member's bedroom door on it, and a warm lamp between each pair.
  corridorWall(SUITE, []);
  // The wall is split evenly into spots, each with a door in the middle
  // (a door is about one and a half people wide). Spots with no door yet get a rain
  // window instead (the only place the weather shows, indoors). A lamp
  // hangs between each pair of spots.
  const spots = CONFIG.bedrooms.doorSpots;
  const spot = HOUSE_WIDTH / spots;
  for (let i = 0; i < spots; i++) {
    const middle = (i + 0.5) * spot;
    if (i < doors.length) furniture.push({ kind: "bedroomDoor", x: middle - SUITE_DOOR / 2, y: SUITE, w: SUITE_DOOR, door: doors[i], solid: false });
    else furniture.push({ kind: "rainWindow", x: middle - 0.65, y: SUITE, w: 1.3, solid: false });
    if (i < spots - 1) furniture.push({ kind: "sconce", x: (i + 1) * spot - 0.15, y: SUITE, solid: false });
  }

  // Each bedroom, on its own map: four walls with a doorway in the bottom
  // one (walk out of it and you're back on the suite floor), and everything
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
  rooms.push({ id: "suite", name: CONFIG.roomNames.suite, rect: { x: 0, y: SUITE, w: HOUSE_WIDTH, h: 3 } });
  rooms.push(YARD_AREA);
  rooms.push(LAKE_AREA);
  rooms.push(ALLEY_AREA);
  rooms.push(FARM_AREA);

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
  bench: { name: "Cushioned Bench", tab: "furniture", price: 25, kind: "bench", w: 1.5, h: 0.5, turn: true },
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
  rainWindow: { name: "Garden Window", tab: "decor", price: 40, kind: "rainWindow", w: 1.2, wall: true },
  lakeWindow: { name: "Lake Window", tab: "decor", price: 45, kind: "lakeWindow", w: 1.0, wall: true },
  moonWindow: { name: "Round Window", tab: "decor", price: 50, kind: "moonWindow", w: 0.8, wall: true },
  leafWindow: { name: "Autumn Window", tab: "decor", price: 50, kind: "leafWindow", w: 0.9, wall: true },
  stringLights: { name: "String Lights", tab: "decor", price: 20, kind: "lights", w: 2.0, wall: true },
  fairyCurtain: { name: "Fairy Light Curtain", tab: "decor", price: 30, kind: "fairyCurtain", w: 1.4, wall: true },
  polaroidWall: { name: "Polaroid String", tab: "decor", price: 18, kind: "polaroidWall", w: 1.4, wall: true },
  tapestry: { name: "Boho Tapestry", tab: "decor", price: 28, kind: "tapestry", w: 1.2, wall: true },
  // The art aisle (Update 7): blank things you paint yourself (walk up to
  // one in your room and press E).
  // (Update 8) The Mothman lamp, and the plush he gives his best friends.
  // (Update 9) Arcade prizes: never sold in Nest & Nook. The plushies come
  // from the claw machine (and the prize counter), the little cabinet and
  // the neon star from the prize counter (config.js arcade).
  plushRaccoon: { name: "Raccoon Plush", kind: "plushRaccoon", w: 0.5, h: 0.4 },
  plushOtter: { name: "Otter Plush", kind: "plushOtter", w: 0.5, h: 0.4 },
  plushFrog: { name: "Frog Plush", kind: "plushFrog", w: 0.45, h: 0.35 },
  miniArcade: { name: "Mini Arcade Cabinet", kind: "arcade", w: 0.8, h: 0.6 },
  neonStar: { name: "Neon Star", kind: "neonStar", w: 0.7, wall: true },
  // (0.84) Cellar Crawl's rare finds: never sold in Nest & Nook. They come
  // up from the cellar (config.js minigames.cellar: rareDecor, and the Rat
  // King's throne).
  wineRack: { name: "Cellar Wine Rack", kind: "wineRack", w: 1.2, h: 0.45 },
  cellarLantern: { name: "Old Cellar Lantern", kind: "cellarLantern", w: 0.45, h: 0.35 },
  ratPortrait: { name: "Portrait of a Rat Noble", kind: "ratPortrait", w: 0.8, wall: true },
  ratThrone: { name: "The Rat King's Throne", kind: "ratThrone", w: 1.0, h: 0.8 },
  mothLamp: { name: "Mothman Lamp", tab: "decor", price: 45, kind: "mothLamp", w: 0.5, h: 0.4 },
  mothPlush: { name: "Mothman Plush", kind: "mothPlush", w: 0.5, h: 0.4 }, // (no price or aisle: only Mothman gives it)
  artCanvas: { name: "Blank Canvas", tab: "art", price: 12, kind: "artCanvas", w: 0.7, wall: true },
  artPoster: { name: "Blank Poster", tab: "art", price: 18, kind: "artPoster", w: 1.2, wall: true },
  artRug: { name: "Blank Rug", tab: "art", price: 25, kind: "artRug", w: 1.6, h: 1.2, solid: false },
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

  // --- From Juniper, the traveling merchant (Update 5): not sold at Nest & Nook ---
  travelRug: { name: "Far-Off Rug", tab: "traveler", price: 70, kind: "rug", w: 2.4, h: 1.6, color: "#3f6f7a", shape: "checker", solid: false },
  brassGlobe: { name: "Brass Globe", tab: "traveler", price: 90, kind: "globe", w: 0.5, h: 0.45 },
  spyglass: { name: "Brass Spyglass", tab: "traveler", price: 120, kind: "telescope", w: 0.6, h: 0.5 },

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

// Where a bedroom piece (a furniture entry, f.decor) is in its owner's own
// list of placed pieces: its number counts the starter desk and bed that
// withStarters adds at the front when the room doesn't have them saved.
function placedIndex(f, placed) {
  return (f?.decor?.index ?? -1) - (withStarters(placed).length - placed.length);
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
    if (Array.isArray(piece?.fish) && piece.fish.length) clean.fish = piece.fish.filter((id) => typeof id === "string" && /^[a-zA-Z]{1,24}$/.test(id)).slice(0, 12); // (a fish tank's fish)
    if (ART_KINDS.includes(clean.item) && typeof piece?.pixels === "string" && /^[0-9a-f]{256}$/.test(piece.pixels)) clean.pixels = piece.pixels; // (pixel art painted on it)
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
    decor: { index, mine: owner.mine, item: piece.item }, // so its owner can pick it back up (and anyone can see what it is)
    ...(piece.fish ? { fish: piece.fish } : {}), // (the fish in a fish tank)
    ...(piece.pixels ? { pixels: piece.pixels } : {}), // (pixel art painted on it, Update 7)
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
  if (floorOf(r.y) !== floorOf(player.y)) return false;
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
  // Outdoors (Update 4): Hazel's seed stand, and the garden beds.
  // Hazel: in the yard until you've had her lesson, then at the Farm (her
  // seed stand in the yard becomes a self-serve seed box).
  const hazel = FURNITURE.find((f) => f.kind === "hazel" && floorOf(f.y) === floorOf(player.y) && hazelHere(f));
  const hazelDistance = hazel ? Math.hypot(cx - (hazel.x + hazel.w / 2), cy - (hazel.y + hazel.h / 2)) : Infinity;
  if (hazelDistance < 1.4) options.push(["hazel", hazelDistance]);
  if (gardenBedInReach(player) >= 0) options.push(["gardenBed", 0.5]);
  // Otis: at the pond until you've had his lesson, then at the Lake (a
  // bait box takes his place at the pond).
  const otis = FURNITURE.find((f) => f.kind === "otis" && floorOf(f.y) === floorOf(player.y) && otisHere(f));
  const otisDistance = otis ? Math.hypot(cx - (otis.x + otis.w / 2), cy - (otis.y + otis.h / 2)) : Infinity;
  if (otisDistance < 1.3) options.push(["otis", otisDistance]);
  if (fishingSpot(player)) options.push(["fishing", 1.35]);
  // Kitchen & Trade (Update 5): the stove, the fridge, the cookie jar, and
  // Juniper (on her day).
  const near = (kind, most) => {
    const f = FURNITURE.find((x) => x.kind === kind && floorOf(x.y) === floorOf(player.y));
    if (!f) return;
    const d = Math.hypot(Math.max(f.x - cx, 0, cx - f.x - f.w), Math.max(f.y - cy, 0, cy - f.y - f.h));
    if (d < most) options.push([kind, d]);
  };
  near("stove", 0.9);
  near("fridge", 0.9);
  near("cookieJar", 0.9);
  // House extras (Update 7): the wishing well, the Lounge TV, the Library's
  // shelves (books by friends; a tall library shelf in your bedroom works
  // too), and pixel art you can paint (your own).
  near("wishingWell", 0.9);
  // The Arcade (Update 9): the cabinets, the claw, the capsules and the
  // prize counter.
  near("arcadeGame", 0.8);
  if (gamePortalNear(player)) options.push(["gamePortal", 0.5]);
  near("clawMachine", 0.9);
  near("capsuleMachine", 0.9);
  near("prizeCounter", 1.0);
  // Night & Mothman (Update 8): the Workshop's toolbox (lightbulbs and
  // lanterns), and the porch light swarm at nine. (Fireflies are caught
  // only when nothing at all is in reach: main.js, night.js fireflyHere.)
  near("toolbox", 0.9);
  if (typeof porchSwarmOn === "function" && porchSwarmOn() && floorOf(player.y) === YARD_FLOOR && FURNITURE.some((f) => f.kind === "porchLantern" && Math.hypot(f.x - cx, f.y + 0.6 - cy) < 3)) options.push(["porchSwarm", 0.4]);
  near("tvSet", 1.0);
  near("libraryShelf", 0.7);
  if (myArtInReach(player)) options.push(["paint", 0.25]);
  if (OTIS.atLake) near("baitBox", 0.9); // (Otis's bait box at the pond, once he's at the Lake)
  if (HAZEL.atFarm) near("seedStand", 0.9); // (Hazel's seed box in the yard, once she's at the Farm)
  if (MERCHANT.here) near("juniper", 1.1);
  // Residents (Update 6), wherever they are right now.
  const resident = residentInReach(player);
  if (resident) options.push(["resident:" + resident.r.id, resident.d]);
  if (myFishTankInReach(player)) options.push(["fishTank", 0.2]);
  if (isNearMyNightstand(player)) options.push(["journal", 0.1]);
  if (myPhoneInReach(player)) options.push(["phone", 0.05]);
  if (elevatorInReach(player) >= 0) options.push(["elevator", 0]);
  if (manholeNear(player)) options.push(["manhole", 0.3]);
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
    if (bumpsIntoSomething(box())) return true;
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
// hallway or suite floor, if they're somehow in between).
function getCurrentRoom(player) {
  const cx = player.x + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;
  const room = ROOMS.find((r) => cx >= r.rect.x && cx <= r.rect.x + r.rect.w && cy >= r.rect.y && cy <= r.rect.y + r.rect.h);
  if (room) return room;
  if (floorOf(cy) === YARD_FLOOR) return YARD_AREA;
  if (floorOf(cy) === LAKE_FLOOR) return LAKE_AREA;
  if (floorOf(cy) === ALLEY_FLOOR) return ALLEY_AREA;
  if (floorOf(cy) === FARM_FLOOR) return FARM_AREA;
  if (floorOf(cy) === GAMES_FLOOR) return ROOMS.find((r) => r.id === "games");
  return ROOMS.find((r) => r.id === (["hallway", "business"][floorOf(cy)] ?? "suite")); // (a bedroom's doorway counts as the suite floor's hall)
}
