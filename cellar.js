// Cellar Crawl (a mini game on the Games floor, rebuilt in 0.84): the old
// cellar under the house, explored together. Each run is new: every floor
// is a handful of connected rooms, arranged at random from the round's
// seed (so everyone in the round gets the same cellar). It's dark down
// there: you see what your lantern (and your friends' lanterns) light up.
// A ladder down on each floor leads deeper, where it's darker and bigger.
// The ladder up by where you came in takes you home.
// How it looks is in render-cellar.js; the numbers are in config.js
// (minigames.cellar).
import { drawHero } from "./game-kit.js";
import { bank, myWallet } from "./bank.js";
import { uiIcon } from "./ui-icons.js";
import { playCellarSound } from "./audio.js";

// --- Little bits flying about (the game's "feel") ---
// Splinters and straw from a crate, tufts of fur from a bopped critter,
// sparkles when one's gone, crumbs flying to you, dust at your feet. Each
// bit: where it is (x, y on the floor, z up in the air, in tiles), how it
// moves, how long it lives, its color and size. `home` bits fly to you.
const BURSTS = {
  splinters: { n: 12, colors: ["#8a6038", "#b8844e", "#6b4426", "#d9b98a"], speed: 2.6, up: 3.2, size: [2, 4.5], life: 0.9, shape: "chip" },
  straw: { n: 6, colors: ["#e8c86a", "#d9b45a"], speed: 1.8, up: 2.2, size: [1, 2], life: 1.1, shape: "stalk" },
  fur: { n: 7, colors: ["#b8b0b8", "#8a8290", "#f4ecf4"], speed: 2.2, up: 1.6, size: [1.5, 3], life: 0.5, shape: "dot" },
  stars: { n: 5, colors: ["#fff4c8", "#ffe39a"], speed: 1.6, up: 2.6, size: [2, 3.5], life: 0.55, shape: "star" },
  sparkle: { n: 12, colors: ["#fff4c8", "#ffe39a", "#d8f0ff"], speed: 2.2, up: 2.4, size: [1.5, 3], life: 0.8, shape: "star" },
  crumbs: { n: 8, colors: ["#e8b85a", "#c98a3c", "#f2d27a"], speed: 1.4, up: 3.4, size: [2, 3], life: 3, shape: "dot", home: true },
  treasure: { n: 16, colors: ["#b8f0c0", "#fff4c8", "#9fd8ff"], speed: 2.4, up: 3.6, size: [2, 3.5], life: 3, shape: "star", home: true },
  dust: { n: 2, colors: ["rgba(216, 204, 184, 0.7)"], speed: 0.4, up: 0.3, size: [2.5, 4], life: 0.45, shape: "puff" },
};
function burst(effects, floor, at, kind, rng = Math.random) {
  const b = BURSTS[kind];
  for (let i = 0; i < b.n; i++) {
    const a = rng() * Math.PI * 2, v = b.speed * (0.4 + rng() * 0.6);
    effects.bits.push({
      f: floor, x: at.x, y: at.y, z: at.z ?? 0.3,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: b.up * (0.5 + rng() * 0.5),
      life: b.life * (0.7 + rng() * 0.3), age: 0, spin: rng() * 6,
      color: b.colors[i % b.colors.length], size: b.size[0] + rng() * (b.size[1] - b.size[0]), shape: b.shape, home: !!b.home,
    });
  }
}

const CFG = () => CONFIG.minigames.cellar;
const debug = { view: 0, lightsOn: false }; // (tests only: see startCellar)

// --- Making a floor ---
// A floor is a grid of room-sized cells. Starting from one room, rooms
// are added next to rooms already there (so they're all connected), plus
// a few extra doors between neighbors so there's more than one way round.
// Tiles: 0 wall, 1 floor.
function makeFloor(n, rng) {
  const cfg = CFG().floors[n];
  const [gw, gh] = cfg.grid;
  const [CW, CH] = CFG().roomSize;
  const W = gw * CW + 1, H = gh * CH + 1;
  const key = (cx, cy) => cx + "," + cy;
  const cells = new Map();
  const links = [];
  const first = { cx: Math.floor(rng() * gw), cy: gh - 1 };
  cells.set(key(first.cx, first.cy), first);
  const order = [first];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let tries = 0; order.length < Math.min(cfg.rooms, gw * gh) && tries < 500; tries++) {
    const from = rng() < 0.55 ? order[order.length - 1] : order[Math.floor(rng() * order.length)];
    const [dx, dy] = dirs[Math.floor(rng() * 4)];
    const cx = from.cx + dx, cy = from.cy + dy;
    if (cx < 0 || cy < 0 || cx >= gw || cy >= gh || cells.has(key(cx, cy))) continue;
    const cell = { cx, cy };
    cells.set(key(cx, cy), cell);
    order.push(cell);
    links.push([from, cell]);
  }
  // A few extra doors between rooms that sit side by side.
  for (const a of order) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = cells.get(key(a.cx + dx, a.cy + dy));
      if (b && !links.some(([p, q]) => (p === a && q === b) || (p === b && q === a)) && rng() < CFG().extraDoors) links.push([a, b]);
    }
  }

  const tiles = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = v;
  };
  // Each room's floor: everything inside its cell but the walls (one tile
  // on the left, two along the top: the wall's top and its face).
  const rooms = order.map((c, i) => {
    const x0 = c.cx * CW + 1, x1 = (c.cx + 1) * CW, y0 = c.cy * CH + 2, y1 = (c.cy + 1) * CH;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, 1);
    return Object.assign(c, { i, x0, x1, y0, y1, mx: x0 + Math.floor((x1 - x0) / 2), my: y0 + Math.floor((y1 - y0) / 2), doors: [] });
  });
  // Doors (three tiles wide) through the walls between linked rooms.
  for (const [p, q] of links) {
    const [a, b] = p.cx + p.cy < q.cx + q.cy ? [p, q] : [q, p];
    if (a.cy === b.cy) {
      const x = b.cx * CW;
      for (let y = a.my - 1; y <= a.my + 1; y++) set(x, y, 1);
      a.doors.push("e");
      b.doors.push("w");
    } else {
      for (const y of [b.cy * CH, b.cy * CH + 1]) for (let x = a.mx - 1; x <= a.mx + 1; x++) set(x, y, 1);
      a.doors.push("s");
      b.doors.push("n");
    }
  }
  // The way out (and deeper) is in the room furthest from the way in.
  const dist = new Map([[rooms[0], 0]]);
  const queue = [rooms[0]];
  while (queue.length) {
    const r = queue.shift();
    for (const [p, q] of links) {
      const next = p === r ? q : q === r ? p : null;
      if (next && !dist.has(next)) {
        dist.set(next, dist.get(r) + 1);
        queue.push(next);
      }
    }
  }
  const start = rooms[0];
  const exit = [...rooms].sort((a, b) => dist.get(b) - dist.get(a))[0];
  const last = n === CFG().floors.length - 1;
  const floor = { n, W, H, tiles, rooms, start, exit, objects: [], webs: [], cobwebs: [], lights: [] };
  floor.open = (x, y) => at(Math.floor(x), Math.floor(y)) === 1;

  // --- Furnishing the rooms ---
  // The middle of each room (a cross, three tiles wide, joining its doors)
  // stays clear, so there's always a way through; things go in the four
  // corners around it.
  let nextId = 0;
  const add = (o) => floor.objects.push({ id: n * 1000 + nextId++, ...o });
  for (const room of rooms) {
    const used = new Set();
    const free = (x, y) => at(x, y) === 1 && !used.has(x + "," + y) && Math.abs(x - room.mx) > 1 && Math.abs(y - room.my) > 1;
    const take = (x, y, w = 1, h = 1) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used.add(xx + "," + yy);
    };
    const kind = room === start ? "start" : room === exit ? (last ? "throne" : "exit") : ROOM_KINDS[Math.floor(rng() * ROOM_KINDS.length)];
    room.kind = kind;
    // A corner of rubble, now and then (not in the way in or out).
    if (kind !== "start" && kind !== "exit" && kind !== "throne" && rng() < 0.35) {
      const right = rng() < 0.5, bottom = rng() < 0.5;
      const bx = right ? room.x1 - 2 : room.x0, by = bottom ? room.y1 - 2 : room.y0;
      for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) set(x, y, 0);
    }
    // Along the back wall: shelves of jars, or wine racks.
    for (const side of [0, 1]) {
      const x = side ? room.mx + 2 : room.x0;
      const width = side ? room.x1 - room.mx - 2 : room.mx - 1 - room.x0;
      if (!free(x, room.y0) || kind === "start" && side === 0) continue;
      const pick = rng();
      const piece = kind === "wine" || (pick < 0.3 && kind !== "pantry") ? "wineRack" : pick < 0.75 || kind === "pantry" ? "shelf" : null;
      if (!piece) continue;
      const w = Math.min(width - 0.2, 1.4 + rng() * 0.8);
      add({ kind: piece, x: x + 0.1 + rng() * (width - w - 0.2), y: room.y0 + 0.02, w, h: 0.45, solid: true });
      take(x, room.y0, width, 1);
    }
    // Cobwebs up in the top corners (more of them deeper down).
    if (rng() < CFG().floors[n].cobwebs) floor.cobwebs.push({ x: room.x0, y: room.y0, side: -1, size: 0.8 + rng() * 0.6 });
    if (rng() < CFG().floors[n].cobwebs) floor.cobwebs.push({ x: room.x1, y: room.y0, side: 1, size: 0.8 + rng() * 0.6 });
    // The ladders.
    if (kind === "start") {
      add({ kind: "ladderUp", x: room.mx - 0.5, y: room.y0, w: 1, h: 0.1, solid: false });
      floor.ladderUp = { x: room.mx, y: room.y0 + 0.2 };
      floor.spawn = { x: room.mx + 0.5, y: room.y0 + 1.6 };
      floor.lights.push({ x: room.mx + 0.5, y: room.y0 + 0.6, r: 2.6, warm: true });
    }
    if (kind === "exit") {
      add({ kind: "ladderDown", x: room.mx, y: room.my, w: 1, h: 1, solid: true });
      floor.ladderDown = { x: room.mx + 0.5, y: room.my + 0.5 };
    }
    if (kind === "throne") {
      floor.throne = { x: room.mx + 0.5, y: room.my + 0.4, room };
      add({ kind: "ratThrone", x: room.mx, y: room.my - 1.2, w: 1, h: 0.8, solid: true });
    }
    // Crates and barrels to break (step by step, from the config), and
    // the odd sack, crock, post or patch of glowing mushrooms.
    const spots = [];
    for (let y = room.y0 + 1; y < room.y1; y++) for (let x = room.x0; x < room.x1; x++) if (free(x, y)) spots.push([x, y]);
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const fill = ROOM_FILL[kind] ?? ROOM_FILL.storage;
    for (const [what, count] of fill) {
      for (let k = 0; k < count && spots.length; k++) {
        const [x, y] = spots.pop();
        if (!free(x, y)) continue;
        take(x, y);
        const jx = (rng() - 0.5) * 0.2, jy = (rng() - 0.5) * 0.15;
        if (what === "crate") add({ kind: "crate", x: x + 0.08 + jx, y: y + 0.25 + jy, w: 0.84, h: 0.6, solid: true, breakable: CFG().crateHits, tint: rng() < 0.3 ? "#8a6440" : undefined });
        else if (what === "barrel") add({ kind: "barrel", x: x + 0.18 + jx, y: y + 0.3 + jy, w: 0.64, h: 0.55, solid: true, breakable: CFG().barrelHits });
        else if (what === "sacks") add({ kind: "sacks", x: x + 0.05, y: y + 0.4, w: 0.9, h: 0.5, solid: true });
        else if (what === "crocks") add({ kind: "crocks", x: x + 0.15, y: y + 0.4, w: 0.7, h: 0.45, solid: true });
        else if (what === "post") add({ kind: "post", x: x + 0.35, y: y + 0.5, w: 0.3, h: 0.3, solid: true });
      }
    }
    // Glowing mushrooms on the deeper floors: a little light of their own.
    for (let k = 0; k < CFG().floors[n].glowcaps && spots.length; k++) {
      if (rng() > 0.45) continue;
      const [x, y] = spots.pop();
      if (!free(x, y)) continue;
      take(x, y);
      add({ kind: "glowcaps", x: x + 0.2, y: y + 0.5, w: 0.6, h: 0.3, solid: false });
      floor.lights.push({ x: x + 0.5, y: y + 0.7, r: 1.3, cool: true });
    }
  }

  // --- The critters ---
  // Every room but the first gets a few (from the config), and the Rat
  // King waits on his throne at the bottom. Where they start comes from the
  // round's seed too, so everyone's cellar starts the same; after that the
  // host's computer moves them (see "The critters, moving" below).
  floor.critters = [];
  floor.called = 0;
  const count = ([lo, hi] = [0, 0]) => lo + Math.floor(rng() * (hi - lo + 1));
  const spotIn = (room) => {
    for (let k = 0; k < 40; k++) {
      const x = room.x0 + 0.6 + rng() * (room.x1 - room.x0 - 1.2), y = room.y0 + 1.2 + rng() * (room.y1 - room.y0 - 1.6);
      if (!blocked(floor, x, y)) return { x, y };
    }
    return { x: room.mx + 0.5, y: room.my + 0.5 };
  };
  for (const room of rooms) {
    if (room === start || room.kind === "throne") continue;
    const want = cfg.critters;
    for (let k = count(want.rat); k > 0; k--) floor.critters.push(newCritter(floor, "rat", spotIn(room)));
    for (let k = count(want.spider); k > 0; k--) floor.critters.push(newCritter(floor, "spider", spotIn(room)));
    for (let k = count(want.bunny); k > 0; k--) {
      const at = spotIn(room);
      for (let b = 0; b < CFG().critters.bunny.swarm; b++) {
        const x = at.x + (rng() - 0.5) * 1.4, y = at.y + (rng() - 0.5) * 0.9;
        floor.critters.push(newCritter(floor, "bunny", blocked(floor, x, y) ? at : { x, y }));
      }
    }
  }
  if (floor.throne) floor.critters.push(newCritter(floor, "ratKing", floor.throne));
  return floor;
}

// One critter: where it is, its hits left, and what it's up to (`mode`:
// idle, windup, dash or rest).
function newCritter(floor, kind, at) {
  const c = CFG().critters[kind];
  floor.made = (floor.made ?? 0) + 1;
  return { id: `${floor.n}-${floor.made}`, kind, x: at.x, y: at.y, sx: at.x, sy: at.y, hp: c.hp, max: c.hp, face: 1, mode: "idle", t: 0, vx: 0, vy: 0, hurt: 0, web: c.webEvery ?? 0, call: c.callEvery ?? 0 };
}

// What goes in each kind of room: [thing, how many].
const ROOM_KINDS = ["storage", "storage", "wine", "pantry", "roots"];
const ROOM_FILL = {
  start: [["sacks", 1], ["crate", 1], ["crocks", 1]],
  exit: [["crate", 2], ["barrel", 1], ["post", 1]],
  throne: [["post", 2]],
  storage: [["crate", 4], ["barrel", 1], ["post", 1], ["sacks", 1]],
  wine: [["barrel", 4], ["crate", 1], ["crocks", 1]],
  pantry: [["crocks", 2], ["sacks", 2], ["crate", 2], ["barrel", 1]],
  roots: [["sacks", 3], ["crate", 2], ["crocks", 1], ["post", 1]],
};

// --- Moving about ---
// Your feet are a small box; walls and solid things stop it.
const FOOT = { w: 0.22, up: 0.14, down: 0.08 };
function blocked(floor, x, y) {
  for (const [cx, cy] of [[x - FOOT.w, y - FOOT.up], [x + FOOT.w, y - FOOT.up], [x - FOOT.w, y + FOOT.down], [x + FOOT.w, y + FOOT.down]]) if (!floor.open(cx, cy)) return true;
  for (const o of floor.objects) {
    if (!o.solid || o.broken) continue;
    if (x + FOOT.w > o.x && x - FOOT.w < o.x + o.w && y + FOOT.down > o.y && y - FOOT.up < o.y + o.h) return true;
  }
  return false;
}
function moveBy(floor, who, dx, dy) {
  if (dx && !blocked(floor, who.x + dx, who.y)) who.x += dx;
  if (dy && !blocked(floor, who.x, who.y + dy)) who.y += dy;
}

// --- The run ---
// Starts Cellar Crawl on the frame's screen (minigames.js). Returns
// { stop, score, pressed, leave, message, left } for the frame.
//
// Who decides what: the house server picks what's in every crate (and
// keeps what you carry), so loot can't be faked. The critters are moved by
// one computer, the host's (the one who pressed Start, or the next one
// along if they go), which sends where they are about ten times a second.
// Your own computer decides when a critter has bumped into you.
export function startCellar(screen, round, { finish }) {
  const floors = CFG().floors.map((_, n) => makeFloor(n, mixed(round.seed, n)));
  const last = floors.length - 1;
  const up = upgradesNow();
  const me = { x: 0, y: 0, floor: 0, face: 1, moving: false, deepest: 0, aimX: 1, aimY: 0, hearts: CFG().hearts, hurt: 0, kx: 0, ky: 0, swing: 0, cooldown: 0, downed: false, downFor: 0, revive: 0, floorAt: 0 };
  const place = (n, at) => {
    if (n !== 0 || at) playCellarSound("ladder");
    me.floor = n;
    me.deepest = Math.max(me.deepest, n);
    me.floorAt = performance.now();
    Object.assign(me, at ?? floors[n].spawn);
  };
  place(0);
  const friends = new Map(); // peerId -> { x, y, floor, face, moving, shown, downed, revive, swing, aim }
  const effects = { puffs: [], words: [], bits: [], swipes: [] }; // (dust puffs, words floating up, flying bits, broom swooshes)
  let quake = 0; // (the screen shakes a little: a hit, a crate breaking, getting hurt)
  const shake = (n) => (quake = Math.max(quake, n));
  let stepIn = 0; // (a little dust at your feet as you walk)
  let over = false, frame = 0, last2 = performance.now();
  let fadeIn = 1; // (a moment of dark between floors)
  let prompt = "";
  let flash = 0; // (the edges glow red for a moment when you're hurt)
  let banner = null; // { text, left } (a big line across the middle)
  const dark = document.createElement("canvas");

  // What you're carrying (the house server's count). If the server doesn't
  // answer, you can still explore, just for fun.
  let run = null, carry = { crumbs: 0, items: [], value: 0 }, bag = CFG().bag, noServer = false, kingPaid = false;
  let chain = bank("cellarStart").then((r) => {
    if (r?.id) {
      run = r;
      bag = r.bag;
      hud();
    } else noServer = true;
  });
  const later = (job) => (chain = chain.then(job).catch(() => {}));
  const say = (at, text, color = "#fff6e6", big = false) => effects.words.push({ x: at.x, y: at.y, text, color, big, age: 0 });

  // The bar across the top: which floor, your hearts, and your bag.
  const hud = () => {
    const hearts = [];
    for (let k = 0; k < CFG().hearts; k++) {
      const h = document.createElement("span");
      h.className = "mini-heart" + (k < me.hearts ? "" : " lost");
      h.innerHTML = uiIcon("heart");
      hearts.push(h);
    }
    const floorText = document.createElement("span");
    floorText.textContent = floorLabel(me.floor);
    const bagEl = document.createElement("span");
    bagEl.className = "mini-bag";
    bagEl.innerHTML = uiIcon("basket");
    bagEl.append(` ${carry.items.length} of ${bag}`);
    const heartsEl = document.createElement("span");
    heartsEl.className = "mini-hearts";
    heartsEl.append(...hearts);
    screen.hud({ score: carry.value, scoreLabel: "Carrying", extraKey: `${me.floor}|${me.hearts}|${carry.items.length}|${bag}`, extraNodes: () => [floorText, heartsEl, bagEl] });
  };
  const carrying = (c) => {
    if (!c) return;
    carry = c;
    hud();
  };
  hud();

  // --- E: the ladders ---
  const near = (p, r) => p && Math.hypot(me.x - p.x, me.y - p.y) < r;
  const settled = () => (performance.now() - me.floorAt) / 1000 >= CFG().minFloorSeconds + 0.5; // (a little extra: the house server counts too)
  const use = () => {
    if (over || me.downed) return;
    const f = floors[me.floor];
    if (near(f.ladderUp, 1.3)) return climbUp();
    if (f.ladderDown && near(f.ladderDown, 1.4) && settled() && !climbing) {
      // (The house server keeps which floor your run is on, for the loot:
      // down you go once it says yes. If it says no, you stay, and can try
      // again in a moment.)
      const from = me.floor, next = from + 1;
      climbing = true;
      later(async () => {
        const ok = noServer || !run || (await bank("cellarDeeper", { id: run.id, floor: next }));
        climbing = false;
        if (over || me.floor !== from) return;
        if (!ok) return void (banner = { text: "The ladder creaks. Try again in a moment.", left: 2 });
        place(next);
        fadeIn = 1;
        banner = { text: next === last ? "The bottom floor. Something squeaks, royally." : `Floor ${next + 1}: darker, and the crates look older.`, left: 3 };
        hud();
      });
    }
  };
  let climbing = false;
  // Up the ladder: everything you're carrying comes home.
  const climbUp = async () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    clearInterval(hiddenTimer);
    screen.send({ t: "gone" });
    await chain;
    const got = run ? await bank("cellarBank", { id: run.id }) : null;
    const lines = [];
    if (got) {
      lines.push(got.home.length ? `Came home with you: ${got.home.join(", ")}.` : "No rare finds this time, just crumbs.");
      if (got.home.some((name) => Object.values(DECOR).some((d) => d.name === name))) lines.push("Decor goes into your room's storage, ready to place.");
      if (got.capped) lines.push("Some crumbs stayed behind: that's all the cellar pays today.");
    }
    lines.push(`You got as deep as floor ${me.deepest + 1} of ${floors.length}.`);
    if (kingPaid) lines.push("You beat the Rat King!");
    finish(got?.score ?? 0, got, { title: "Back up into the daylight", scoreLabel: "Your haul", lines });
  };

  // --- Space: the broom ---
  const broom = () => ({ ...CFG().broom, damage: CFG().broom.damage + up.broom });
  const swing = () => {
    if (over || me.downed || me.cooldown > 0) return;
    const b = broom();
    me.cooldown = b.cooldown;
    me.swing = 1;
    playCellarSound("swing");
    effects.swipes.push({ f: me.floor, x: me.x, y: me.y - 0.2, aim: Math.atan2(me.aimY, me.aimX), reach: b.reach, age: 0 });
    const f = floors[me.floor];
    const cx = me.x, cy = me.y - 0.2;
    // (In the arc in front of you, or right on top of you.)
    const inArc = (x, y, extra) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d > b.reach + extra) return null;
      if (d > 0.5 && (dx * me.aimX + dy * me.aimY) / d < 0.15) return null;
      return { dx: dx / (d || 1), dy: dy / (d || 1) };
    };
    for (const c of [...f.critters]) {
      const dir = inArc(c.sx, c.sy - 0.15, c.kind === "ratKing" ? 0.55 : 0.2);
      if (!dir) continue;
      playCellarSound(c.kind === "ratKing" ? "king" : "hit");
      burst(effects, f.n, { x: c.sx, y: c.sy, z: 0.3 }, "fur");
      burst(effects, f.n, { x: c.sx, y: c.sy, z: 0.5 }, "stars");
      shake(c.kind === "ratKing" ? 0.3 : 0.18);
      if (screen.isHost()) hitCritter(f, c, dir.dx, dir.dy, b.damage);
      else {
        c.hurt = 0.25; // (the host does the real knocking; this shows it at once)
        screen.send({ t: "h", f: f.n, id: c.id, dx: round2(dir.dx), dy: round2(dir.dy), n: b.damage });
      }
    }
    for (const o of f.objects) {
      if (!o.breakable || o.broken || !inArc(o.x + o.w / 2, o.y + o.h / 2, 0.45)) continue;
      o.hits = (o.hits ?? o.breakable) - 1;
      o.shake = 0.25;
      if (o.hits > 0) {
        playCellarSound("knock");
        burst(effects, f.n, { x: o.x + o.w / 2, y: o.y + o.h, z: 0.4 }, "dust");
        shake(0.1);
        screen.send({ t: "o", f: f.n, id: o.id, left: o.hits });
        continue;
      }
      o.broken = true;
      effects.puffs.push({ x: o.x + o.w / 2, y: o.y + o.h, age: 0, f: f.n });
      playCellarSound("crack");
      burst(effects, f.n, { x: o.x + o.w / 2, y: o.y + o.h - 0.1, z: 0.4 }, "splinters");
      burst(effects, f.n, { x: o.x + o.w / 2, y: o.y + o.h - 0.1, z: 0.4 }, "straw");
      shake(0.28);
      screen.send({ t: "o", f: f.n, id: o.id, left: 0 });
      openUp(o);
    }
  };
  // A crate or barrel broken by you: the house server says what was in it.
  const openUp = (o) => {
    const at = { x: o.x + o.w / 2, y: o.y };
    later(async () => {
      if (!run) return noServer && say(at, "Just dust (no house server)");
      const res = await bank("cellarBreak", { id: run.id, kind: o.kind });
      await new Promise((r) => setTimeout(r, 210)); // (the server wants a breath between crates)
      if (!res) return;
      const got = res.got;
      const from = { x: at.x, y: at.y + 0.4, z: 0.5 };
      if (got.kind === "crumbs") {
        say(at, `+${got.crumbs} crumbs`, "#ffd98a");
        burst(effects, me.floor, from, "crumbs");
        playCellarSound("coin");
      } else if (got.kind === "nothing") say(at, "Just dust and cobwebs", "#d8ccb8");
      else if (got.kind === "full") say(at, "Your bag is full!", "#ffb0a0");
      else {
        say(at, `Found: ${got.name}!`, "#b8f0c0", true);
        burst(effects, me.floor, from, "treasure");
        playCellarSound("find");
      }
      carrying(res.carried);
    });
  };

  // The critters, hit. (On the host's computer: everyone else's hits come
  // here as messages.)
  const hitCritter = (f, c, dx, dy, damage) => {
    if (c.hp <= 0) return;
    const push = CFG().broom.knockback * (c.kind === "ratKing" ? 0.25 : 1);
    c.hp -= Math.max(1, Math.min(4, damage));
    c.hurt = 0.3;
    c.vx = dx * push;
    c.vy = dy * push;
    if (c.mode === "dash" || c.mode === "windup") Object.assign(c, { mode: "rest", t: 0.6 });
    if (c.hp > 0) return;
    f.critters.splice(f.critters.indexOf(c), 1);
    effects.puffs.push({ x: c.x, y: c.y, age: 0, f: f.n });
    burst(effects, f.n, { x: c.x, y: c.y, z: 0.3 }, "sparkle");
    playCellarSound("poof");
    if (c.kind === "ratKing") {
      screen.send({ t: "k", f: f.n });
      kingDown(f.n);
    }
  };
  // Everyone on the bottom floor when he falls gets the prize. (The house
  // server wants you to have been down there a little while first, so if
  // you only just arrived, your claim waits until then.)
  let kingClaimed = false;
  const kingDown = (n) => {
    if (kingClaimed || n !== last || me.floor !== last) return;
    kingClaimed = true;
    banner = { text: "The Rat King is beaten!", left: 4 };
    const wait = Math.max(0, (CFG().kingMinSeconds + 0.6) * 1000 - (performance.now() - me.floorAt));
    setTimeout(() => {
      later(async () => {
        if (!run || over) return;
        let res = await bank("cellarKing", { id: run.id });
        if (!res && !over) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await bank("cellarKing", { id: run.id });
        }
        if (!res) return;
        kingPaid = true;
        say({ x: me.x, y: me.y - 1 }, res.got.length ? `The king's treasure! ${res.got.join(", ")}` : "The king's treasure: a pile of crumbs!", "#ffd98a", true);
        carrying(res.carried);
      });
    }, wait);
  };

  // --- Getting hurt, knocked out, and back up ---
  const hurtMe = (fromX, fromY) => {
    if (me.downed || me.hurt > 0 || over) return;
    me.hearts -= 1;
    me.hurt = CFG().hurtSeconds;
    flash = 1;
    shake(0.45);
    playCellarSound("hurt");
    const dx = me.x - fromX, dy = me.y - fromY, d = Math.hypot(dx, dy) || 1;
    me.kx = (dx / d) * 7;
    me.ky = (dy / d) * 7;
    if (me.hearts <= 0) knockedOut();
    hud();
  };
  const knockedOut = () => {
    Object.assign(me, { hearts: 0, downed: true, downFor: 0, revive: 0, moving: false, kx: 0, ky: 0 }); // (you drop where you were hit, so friends find you there)
    banner = { text: "Knocked out! A friend can help you up.", left: 3 };
    const at = { x: me.x, y: me.y - 1 };
    later(async () => {
      if (!run) return;
      const res = await bank("cellarDown", { id: run.id });
      if (!res) return;
      const lost = [res.lost.crumbs ? `${res.lost.crumbs} crumbs` : "", ...res.lost.items].filter(Boolean);
      if (lost.length) say(at, `Dropped: ${lost.join(", ")}`, "#ffb0a0", true);
      carrying(res.carried);
    });
  };
  const getUp = (hearts, at) => {
    Object.assign(me, { hearts, downed: false, revive: 0, hurt: CFG().hurtSeconds, kx: 0, ky: 0 });
    if (at) Object.assign(me, at);
    banner = { text: at ? "You come to by the ladder." : "Back on your feet!", left: 2 };
    hud();
  };

  // (For the automated tests, only on this computer: jump about, see a
  // whole floor with the lights on, and a few shortcuts.)
  if (window.porchlightTest) {
    window.porchlightTest.cellar = {
      me,
      floors,
      go: (x, y) => Object.assign(me, { x, y }),
      use,
      swing,
      aim: (x, y) => Object.assign(me, { aimX: x, aimY: y, face: x < 0 ? -1 : x > 0 ? 1 : me.face }),
      hurt: () => hurtMe(me.x + 0.5, me.y),
      settled,
      carrying: () => carry,
      waitForServer: () => chain,
      debug,
    };
  }

  // --- The critters: the host moves them and tells everyone; the others
  // glide theirs towards what the host said. (Also run from a timer, so
  // they keep going while the host's window is hidden or minimized, when
  // the browser pauses its drawing. Hidden windows get their timers slowed
  // down, so the critters move in bigger, rarer steps then.)
  let critterLast = performance.now(), shareIn = 0;
  const critters = () => {
    const now = performance.now();
    const dt = Math.min(1, (now - critterLast) / 1000);
    critterLast = now;
    const host = screen.isHost();
    for (const floor of floors) {
      const people = peopleOn(floor.n, me, friends);
      if (!people.length && floor.n !== me.floor) continue;
      // (Big steps are taken in small pieces, so nothing jumps through walls.)
      if (host) for (let left = dt; left > 0; left -= 0.05) simulate(floor, people.filter((p) => !p.downed), Math.min(0.05, left));
      for (const c of floor.critters) {
        c.hurt = Math.max(0, c.hurt - dt);
        if (host) Object.assign(c, { sx: c.x, sy: c.y });
        else {
          const ease = 1 - Math.pow(0.0005, dt);
          c.sx += (c.x - c.sx) * ease;
          c.sy += (c.y - c.sy) * ease;
        }
      }
      if (host) for (const w of floor.webs) w.left -= dt;
      floor.webs = floor.webs.filter((w) => w.left > 0);
    }
    if (host) {
      shareIn -= dt;
      if (shareIn <= 0) {
        shareIn = 0.1;
        for (const floor of floors) if (peopleOn(floor.n, me, friends).some((p) => p.friend)) screen.send(snapshot(floor));
      }
    }
  };
  const hiddenTimer = setInterval(() => document.hidden && !over && critters(), 100);

  // --- Every frame ---
  let sendIn = 0;
  const tick = (now) => {
    if (over) return;
    // (Moving uses small steps, so a slow frame never jumps you through a
    // wall; the knocked-out and help-up timers count real seconds, so they
    // take as long on a slow or background window as anywhere else.)
    const real = Math.min(1, (now - last2) / 1000);
    const dt = Math.min(0.05, real);
    last2 = now;
    const f = floors[me.floor];
    const k = screen.keys;
    // Walking (not while knocked out; slower in a web).
    const ax = me.downed ? 0 : (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
    const ay = me.downed ? 0 : (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
    const len = Math.hypot(ax, ay) || 1;
    const webbed = f.webs.some((w) => Math.hypot(w.x - me.x, (w.y - me.y) * 1.6) < 0.62);
    const speed = CFG().walkSpeed * (webbed ? CFG().critters.spider.webSlow : 1) * dt;
    me.moving = !!(ax || ay);
    if (ax) me.face = ax;
    if (ax || ay) Object.assign(me, { aimX: ax / len, aimY: ay / len });
    moveBy(f, me, (ax / len) * speed, (ay / len) * speed);
    if (Math.abs(me.kx) + Math.abs(me.ky) > 0.05) {
      moveBy(f, me, me.kx * dt, me.ky * dt);
      me.kx *= Math.exp(-9 * dt);
      me.ky *= Math.exp(-9 * dt);
    }
    me.hurt = Math.max(0, me.hurt - real);
    me.cooldown = Math.max(0, me.cooldown - real); // (real seconds: a slow computer swings as often as a fast one)
    me.swing = Math.max(0, me.swing - dt * 4.5);
    flash = Math.max(0, flash - dt * 2.5);
    for (const o of f.objects) if (o.shake) o.shake = Math.max(0, o.shake - dt);

    // Knocked out: a friend standing close gets you up; otherwise you come
    // to by the ladder (quickly, if there's nobody here to help).
    if (me.downed) {
      me.downFor += real;
      const helpers = [...friends.values()].filter((fr) => fr.floor === me.floor && !fr.downed && fr.shown);
      const helping = helpers.some((fr) => Math.hypot(fr.shown.x - me.x, fr.shown.y - me.y) < CFG().reviveRange);
      me.revive = helping ? me.revive + real : Math.max(0, me.revive - real * 0.5);
      if (me.revive >= CFG().reviveSeconds) getUp(CFG().reviveHearts);
      else if (me.downFor >= (helpers.length ? CFG().downedSeconds : 2.5)) getUp(CFG().hearts, f.spawn);
    }

    critters();
    // A critter bumping into you (your own computer decides).
    if (!me.downed && me.hurt <= 0) {
      for (const c of f.critters) {
        if (c.mode === "rest" || c.hp <= 0) continue;
        const reach = c.kind === "ratKing" ? 0.8 : c.kind === "bunny" ? 0.36 : 0.45;
        if (Math.hypot(c.sx - me.x, (c.sy - me.y) * 1.3) < reach) {
          hurtMe(c.sx, c.sy);
          break;
        }
      }
    }

    // Where you are (and what you're doing) goes to the others, about 12
    // times a second.
    sendIn -= dt;
    if (sendIn <= 0) {
      sendIn = 0.08;
      screen.send({ t: "p", x: round2(me.x), y: round2(me.y), f: me.floor, d: me.face, m: me.moving ? 1 : 0, a: round2(Math.atan2(me.aimY, me.aimX)), s: round2(me.swing), dn: me.downed ? 1 : 0, rv: round2(me.revive / CFG().reviveSeconds), hu: me.hurt > 0 ? 1 : 0 });
    }
    for (const fr of friends.values()) {
      fr.shown ??= { x: fr.x, y: fr.y };
      const ease = 1 - Math.pow(0.001, dt);
      fr.shown.x += (fr.x - fr.shown.x) * ease;
      fr.shown.y += (fr.y - fr.shown.y) * ease;
    }
    for (const p of effects.puffs) p.age += dt;
    for (const w of effects.words) w.age += dt;
    effects.puffs = effects.puffs.filter((p) => p.age < 0.5);
    effects.words = effects.words.filter((w) => w.age < 2.4);
    for (const b of effects.bits) {
      b.age += dt;
      if (b.home && b.age > 0.35 && b.f === me.floor) { // (crumbs and treasure fly to you)
        const dx = me.x - b.x, dy = me.y - 0.3 - b.y, d = Math.hypot(dx, dy) || 1;
        const pull = Math.min(14, 3 + (b.age - 0.35) * 16);
        b.vx += (dx / d) * pull * dt * 6 - b.vx * dt * 3;
        b.vy += (dy / d) * pull * dt * 6 - b.vy * dt * 3;
        b.z += (0.6 - b.z) * dt * 4;
        b.vz = 0;
        if (d < 0.3) b.age = b.life;
      } else {
        b.vz -= 9 * dt;
        if (b.z + b.vz * dt < 0 && b.vz < 0) { // (a little bounce, then it settles)
          b.vz *= -0.35;
          b.vx *= 0.5;
          b.vy *= 0.5;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      b.spin += dt * 8;
    }
    effects.bits = effects.bits.filter((b) => b.age < b.life).slice(-300);
    for (const s of effects.swipes) s.age += dt;
    effects.swipes = effects.swipes.filter((s) => s.age < 0.22);
    quake = Math.max(0, quake - dt * 1.8);
    if (me.moving && !me.downed && (stepIn -= dt) <= 0) {
      stepIn = 0.26;
      burst(effects, me.floor, { x: me.x, y: me.y, z: 0.05 }, "dust");
    }
    if (banner && (banner.left -= dt) <= 0) banner = null;

    const downedFriend = [...friends.values()].some((fr) => fr.floor === me.floor && fr.downed && fr.shown && Math.hypot(fr.shown.x - me.x, fr.shown.y - me.y) < CFG().reviveRange + 1);
    prompt = me.downed
      ? ""
      : downedFriend
        ? "Stay close to help them up"
        : near(f.ladderUp, 1.3)
          ? "Press E to climb up and take it all home"
          : f.ladderDown && near(f.ladderDown, 1.4)
            ? settled()
              ? `Press E to climb down to floor ${me.floor + 2}`
              : "Catch your breath a moment..."
            : "";
    fadeIn = Math.max(0, fadeIn - dt * 1.6);
    draw(screen, f, me, friends, dark, { prompt, fadeIn, flash, banner, effects, lantern: CFG().lantern + up.lantern, last, quake });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    score: () => carry.value,
    pressed: (key) => (key === "e" ? use() : key === " " ? swing() : null),
    stop() {
      over = true;
      cancelAnimationFrame(frame);
      clearInterval(hiddenTimer);
    },
    // Escape, then Leave: out of the cellar, empty-handed.
    leave() {
      if (over) return;
      over = true;
      cancelAnimationFrame(frame);
      clearInterval(hiddenTimer);
      screen.send({ t: "gone" });
      finish(0, { score: 0, crumbs: 0 }, { title: "You left the cellar", scoreLabel: "Your haul", lines: ["You left without climbing the ladder, so what you carried stays down there."] });
    },
    message(data, peerId) {
      if (!data || typeof data !== "object") return;
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const floorNo = (v) => Math.max(0, Math.min(last, Math.floor(num(v))));
      if (data.t === "p") {
        const fr = friends.get(peerId) ?? {};
        Object.assign(fr, { x: num(data.x), y: num(data.y), floor: floorNo(data.f), face: data.d === -1 ? -1 : 1, moving: data.m === 1, aim: num(data.a), swing: Math.max(0, Math.min(1, num(data.s))), downed: data.dn === 1, revive: Math.max(0, Math.min(1, num(data.rv))), hurt: data.hu === 1 });
        if (fr.shown && fr.shownFloor !== fr.floor) fr.shown = null; // (a new floor: no sliding across it)
        fr.shownFloor = fr.floor;
        friends.set(peerId, fr);
      }
      // A crate or barrel knocked by a friend.
      if (data.t === "o") {
        const o = floors[floorNo(data.f)].objects.find((x) => x.id === num(data.id) && x.breakable);
        if (!o || o.broken) return;
        o.hits = Math.max(0, Math.floor(num(data.left)));
        o.shake = 0.25;
        if (o.hits <= 0) {
          o.broken = true;
          effects.puffs.push({ x: o.x + o.w / 2, y: o.y + o.h, age: 0, f: floorNo(data.f) });
          burst(effects, floorNo(data.f), { x: o.x + o.w / 2, y: o.y + o.h - 0.1, z: 0.4 }, "splinters");
          if (floorNo(data.f) === me.floor) playCellarSound("crack");
        }
      }
      // A friend's broom hit a critter (only the host does anything with it).
      if (data.t === "h" && screen.isHost()) {
        const f = floors[floorNo(data.f)];
        const c = f.critters.find((x) => x.id === String(data.id));
        const dx = num(data.dx), dy = num(data.dy), l = Math.hypot(dx, dy) || 1;
        if (c) hitCritter(f, c, dx / l, dy / l, Math.floor(num(data.n)) || 1);
      }
      // Where the critters are now (from the host).
      if (data.t === "e" && !screen.isHost()) applySnapshot(floors[floorNo(data.f)], data, effects);
      if (data.t === "k") kingDown(floorNo(data.f));
      if (data.t === "gone") friends.delete(peerId);
    },
    left(peerId) {
      friends.delete(peerId);
    },
  };
}

// Your workbench upgrades (step 4), as what they add.
function upgradesNow() {
  const have = myWallet().minis?.cellar?.upgrades ?? {};
  const adds = (id) => (CFG().upgrades[id]?.levels ?? []).slice(0, have[id] ?? 0).reduce((sum, l) => sum + l.adds, 0);
  return { lantern: adds("lantern"), broom: adds("broom"), bag: adds("bag") };
}

// Everyone on a floor (you, and friends there), for the critters to chase.
function peopleOn(n, me, friends) {
  const list = [];
  if (me.floor === n) list.push({ x: me.x, y: me.y, downed: me.downed });
  for (const fr of friends.values()) if (fr.floor === n && fr.shown) list.push({ x: fr.shown.x, y: fr.shown.y, downed: fr.downed, friend: true });
  return list;
}

// Which room a spot is in (null in a doorway).
function roomAt(f, x, y) {
  return f.rooms.find((r) => x >= r.x0 && x < r.x1 && y >= r.y0 - 1 && y < r.y1) ?? null;
}

// --- The critters, moving (on the host's computer) ---
const KINDS = ["rat", "bunny", "spider", "ratKing"];
const MODES = ["idle", "windup", "dash", "rest"];
function simulate(f, people, dt) {
  const all = CFG().critters;
  const born = [];
  for (const c of f.critters) {
    const cc = all[c.kind];
    // Knocked back by a broom.
    if (Math.abs(c.vx) + Math.abs(c.vy) > 0.05) {
      moveBy(f, c, c.vx * dt, c.vy * dt);
      c.vx *= Math.exp(-8 * dt);
      c.vy *= Math.exp(-8 * dt);
    }
    // Who it's after: the nearest person it can see (in its own room, or
    // very close).
    const room = roomAt(f, c.x, c.y);
    let target = null, dist = Infinity;
    for (const p of people) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < dist && d < cc.sees && (d < 2.5 || roomAt(f, p.x, p.y) === room)) (target = p), (dist = d);
    }
    c.t -= dt;
    const angry = c.kind === "ratKing" && c.hp <= c.max / 2 ? 1.35 : 1;
    const go = (dx, dy, sp) => {
      const l = Math.hypot(dx, dy) || 1;
      if (Math.abs(dx) > 0.05) c.face = dx < 0 ? -1 : 1;
      const bx = c.x, by = c.y;
      moveBy(f, c, (dx / l) * sp * dt, (dy / l) * sp * dt);
      return c.x !== bx || c.y !== by;
    };
    if (c.kind === "rat" || c.kind === "ratKing") {
      // Rats creep up, wind up (shivering), then dash in a straight line.
      if (c.mode === "windup") {
        if (c.t <= 0) Object.assign(c, { mode: "dash", t: cc.dashSeconds });
      } else if (c.mode === "dash") {
        if (!go(c.dx, c.dy, cc.dashSpeed * angry) || c.t <= 0) Object.assign(c, { mode: "rest", t: cc.rest / angry });
      } else if (c.mode === "rest") {
        if (c.t <= 0) c.mode = "idle";
      } else if (target) {
        if (dist < cc.dashFrom) {
          const l = dist || 1;
          Object.assign(c, { mode: "windup", t: cc.windup / angry, dx: (target.x - c.x) / l, dy: (target.y - c.y) / l, face: target.x < c.x ? -1 : 1 });
        } else go(target.x - c.x, target.y - c.y, cc.speed * angry);
      } else wander(c, go, cc.speed * 0.35, dt);
      // The king calls his rats.
      if (c.kind === "ratKing" && target && (c.call -= dt) <= 0) {
        c.call = cc.callEvery / angry;
        const called = f.critters.filter((r) => r.called).length;
        for (let k = 0; k < cc.calls && called + k < cc.callMost; k++) {
          const at = { x: c.x + (k ? 1 : -1) * 1.1, y: c.y + 0.6 };
          const rat = newCritter(f, "rat", blocked(f, at.x, at.y) ? c : at);
          rat.id = `${f.n}-k${Math.floor(Math.random() * 1e6)}`;
          rat.called = true;
          born.push(rat);
        }
      }
    } else if (c.kind === "bunny") {
      // Dust bunnies hop at you in a wobbly swarm, keeping a little apart.
      if (target) {
        let dx = target.x - c.x, dy = target.y - c.y;
        const wob = Math.sin(performance.now() / 180 + c.x * 3);
        dx += -dy * wob * 0.6;
        dy += dx * wob * 0.3;
        for (const o of f.critters) {
          if (o === c || o.kind !== "bunny") continue;
          const ox = c.x - o.x, oy = c.y - o.y, d = Math.hypot(ox, oy);
          if (d < 0.5 && d > 0) (dx += (ox / d) * 1.5), (dy += (oy / d) * 1.5);
        }
        go(dx, dy, cc.speed);
      } else wander(c, go, cc.speed * 0.3, dt);
    } else if (c.kind === "spider") {
      // Spiders keep their distance, circle, and leave webs behind.
      if (target) {
        const dx = target.x - c.x, dy = target.y - c.y;
        if (dist < cc.keepAway - 0.3) go(-dx, -dy, cc.speed);
        else if (dist > cc.keepAway + 0.8) go(dx, dy, cc.speed);
        else go(-dy, dx, cc.speed * 0.6);
        if ((c.web -= dt) <= 0) {
          c.web = cc.webEvery;
          f.webs.push({ x: c.x, y: c.y, left: cc.webSeconds });
        }
      } else wander(c, go, cc.speed * 0.3, dt);
    }
  }
  f.critters.push(...born);
}
function wander(c, go, speed, dt) {
  c.wt = (c.wt ?? Math.random() * 2) - dt;
  if (c.wt <= 0) {
    c.wt = 1 + Math.random() * 2;
    const a = Math.random() * Math.PI * 2;
    c.wx = Math.random() < 0.5 ? 0 : Math.cos(a);
    c.wy = c.wx ? Math.sin(a) : 0;
  }
  if (c.wx || c.wy) go(c.wx, c.wy, speed);
}
// The host's message about a floor: every critter (and web) on it.
function snapshot(f) {
  return {
    t: "e",
    f: f.n,
    c: f.critters.map((c) => [c.id, KINDS.indexOf(c.kind), round2(c.x), round2(c.y), c.face, MODES.indexOf(c.mode), c.hp, c.max, c.hurt > 0 ? 1 : 0]),
    w: f.webs.map((w) => [round2(w.x), round2(w.y), round2(w.left)]),
  };
}
function applySnapshot(f, data, effects) {
  if (!Array.isArray(data.c)) return;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const seen = new Set();
  for (const row of data.c.slice(0, 200)) {
    if (!Array.isArray(row)) continue;
    const id = String(row[0]).slice(0, 24);
    const kind = KINDS[num(row[1])];
    if (!kind) continue;
    seen.add(id);
    let c = f.critters.find((x) => x.id === id);
    if (!c) f.critters.push((c = { ...newCritter({ n: f.n }, kind, { x: num(row[2]), y: num(row[3]) }), id }));
    Object.assign(c, { x: num(row[2]), y: num(row[3]), face: row[4] === -1 ? -1 : 1, mode: MODES[num(row[5])] ?? "idle", hp: num(row[6]), max: Math.max(1, num(row[7])) });
    if (row[8] === 1) c.hurt = Math.max(c.hurt, 0.15);
  }
  for (const c of [...f.critters]) {
    if (seen.has(c.id)) continue;
    f.critters.splice(f.critters.indexOf(c), 1);
    effects.puffs.push({ x: c.sx, y: c.sy, age: 0, f: f.n });
    burst(effects, f.n, { x: c.sx, y: c.sy, z: 0.3 }, "sparkle");
  }
  if (Array.isArray(data.w)) f.webs = data.w.slice(0, 60).filter(Array.isArray).map((w) => ({ x: num(w[0]), y: num(w[1]), left: num(w[2]) }));
}

const round2 = (v) => Math.round(v * 100) / 100;
const floorLabel = (n) => `Floor ${n + 1} of ${CFG().floors.length}`;
// A random number maker for each floor, from the round's seed.
function mixed(seed, n) {
  let s = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Drawing ---
// The camera follows you, showing about `view` tiles across.
function draw(screen, f, me, friends, dark, { prompt, fadeIn, flash, banner, effects, lantern, last, quake = 0 }) {
  const ctx = screen.begin();
  const cw = screen.canvas.width, ch = screen.canvas.height;
  const t = performance.now() / 1000;
  ctx.fillStyle = "#0a0706";
  ctx.fillRect(0, 0, cw, ch);
  const view = debug.view || CFG().view;
  const z = Math.min(cw / (view * TILE), ch / ((view * 0.62) * TILE));
  const tt = performance.now() / 1000, q = quake * quake * 0.35; // (the shake: strong at first, settling fast)
  const camX = me.x + Math.sin(tt * 67) * q, camY = me.y - 0.6 + Math.cos(tt * 59) * q;
  const toPx = (gx, gy) => ({ x: cw / 2 + (gx - camX) * TILE * z, y: ch / 2 + (gy - camY) * TILE * z });
  const world = () => ctx.setTransform(z, 0, 0, z, cw / 2 - (camX * TILE + ORIGIN_X) * z, ch / 2 - (camY * TILE + ORIGIN_Y) * z);
  ctx.save();
  world();
  // The tiles in view.
  const halfW = cw / (2 * TILE * z) + 1, halfH = ch / (2 * TILE * z) + 2;
  const x0 = Math.max(0, Math.floor(camX - halfW)), x1 = Math.min(f.W, Math.ceil(camX + halfW));
  const y0 = Math.max(0, Math.floor(camY - halfH)), y1 = Math.min(f.H, Math.ceil(camY + halfH));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (f.open(x, y)) drawCellarFloorTile(ctx, x, y, f.n);
      else drawCellarWallTile(ctx, x, y, f.n, f.open(x, y + 1), f);
    }
  }
  for (const c of f.cobwebs) drawCobweb(ctx, c.x, c.y, c.side, c.size);
  // Flat things first (the ladder down, broken crates, spiders' webs),
  // then everything standing, lowest on screen in front.
  const inView = (x, y, w = 1, h = 1) => x + w > x0 - 1 && x < x1 + 1 && y + h > y0 - 2 && y < y1 + 2;
  const standing = [];
  for (const o of f.objects) {
    if (!inView(o.x, o.y, o.w, o.h)) continue;
    if (o.broken) drawDebris(ctx, o);
    else if (o.kind === "ladderDown") CELLAR_DRAWERS.ladderDown(ctx, o);
    else {
      standing.push({
        y: o.kind === "ladderUp" ? o.y - 0.5 : o.y + o.h,
        draw: () => {
          const drawIt = CELLAR_DRAWERS[o.kind] ?? FURNITURE_DRAWERS[o.kind]; // (the king's throne is the decor piece)
          if (!o.shake) return drawIt(ctx, o);
          ctx.save();
          ctx.translate(Math.sin(t * 70) * o.shake * 12, 0);
          drawIt(ctx, o);
          ctx.restore();
        },
      });
    }
  }
  for (const w of f.webs) {
    const at = toScreen(w.x, w.y);
    drawFloorWeb(ctx, at.x, at.y, TILE * 0.62, Math.min(1, w.left / 2));
  }
  for (const c of f.critters) {
    if (!inView(c.sx - 1, c.sy - 1, 2, 2)) continue;
    standing.push({
      y: c.sy,
      draw: () => {
        const at = toScreen(c.sx, c.sy);
        const state = { windup: c.mode === "windup", dash: c.mode === "dash", hurt: c.hurt > 0 && Math.floor(t * 20) % 2 === 0 };
        if (c.kind === "ratKing") drawRatKing(ctx, at.x, at.y, c.face, t, state);
        else if (c.kind === "bunny") drawBunny(ctx, at.x, at.y, c.face, t, state);
        else if (c.kind === "spider") drawSpider(ctx, at.x, at.y, c.face, t, state);
        else drawRat(ctx, at.x, at.y, c.face, t, state);
      },
    });
  }
  // The people: you and friends on this floor, each with a lantern and a
  // broom (swinging it, or over the shoulder). Knocked out, you lie down.
  const people = [{ look: screen.look, x: me.x, y: me.y, face: me.face, moving: me.moving, aim: Math.atan2(me.aimY, me.aimX), swing: me.swing, downed: me.downed, revive: me.revive / CFG().reviveSeconds, hurt: me.hurt > 0, lantern }];
  for (const [id, fr] of friends) if (fr.floor === f.n && fr.shown) people.push({ look: screen.lookOf(id), x: fr.shown.x, y: fr.shown.y, face: fr.face, moving: fr.moving, aim: fr.aim, swing: fr.swing, downed: fr.downed, revive: fr.revive, hurt: fr.hurt, lantern: CFG().lantern });
  for (const p of people) standing.push({ y: p.y, draw: () => drawPerson(ctx, p, t) });
  standing.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  for (const p of effects.puffs) {
    if (p.f !== f.n) continue;
    const at = toScreen(p.x, p.y);
    drawPuff(ctx, at.x, at.y, p.age);
  }
  for (const sw of effects.swipes) if (sw.f === f.n) drawSwipe(ctx, sw);
  for (const b of effects.bits) if (b.f === f.n) drawBit(ctx, b);
  ctx.restore();

  // The dark, with a hole of light around every lantern.
  if (dark.width !== cw || dark.height !== ch) {
    dark.width = cw;
    dark.height = ch;
  }
  const d = dark.getContext("2d");
  const floorCfg = CFG().floors[f.n];
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, cw, ch);
  d.fillStyle = `rgba(6, 4, 3, ${debug.lightsOn ? 0.15 : floorCfg.dark})`;
  d.fillRect(0, 0, cw, ch);
  d.globalCompositeOperation = "destination-out";
  const lights = [...people.map((p) => ({ x: p.x, y: p.y - 0.4, r: p.lantern * floorCfg.light * (p.downed ? 0.6 : 1) * (1 + Math.sin(t * 9 + p.x) * 0.02) })), ...f.lights];
  for (const l of lights) {
    const at = toPx(l.x, l.y);
    const r = l.r * TILE * z;
    if (at.x < -r || at.x > cw + r || at.y < -r || at.y > ch + r) continue;
    const g = d.createRadialGradient(at.x, at.y, r * 0.15, at.x, at.y, r);
    g.addColorStop(0, "rgba(0, 0, 0, 1)");
    g.addColorStop(0.55, "rgba(0, 0, 0, 0.75)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    d.fillStyle = g;
    d.beginPath();
    d.arc(at.x, at.y, r, 0, Math.PI * 2);
    d.fill();
  }
  ctx.drawImage(dark, 0, 0);
  // The warm color of the lanterns (and the cool of the mushrooms).
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const at = toPx(l.x, l.y);
    const r = l.r * TILE * z * 0.8;
    const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
    g.addColorStop(0, l.cool ? "rgba(60, 140, 130, 0.18)" : "rgba(255, 160, 70, 0.16)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Over the dark: name tags, words floating up, and the ladder prompt.
  ctx.save();
  world();
  for (const p of people) {
    const at = toScreen(p.x, p.y);
    const foot = playerFeet({ x: 0, y: 0 });
    const tagged = { ...p.look, id: "tag", title: p.look.title };
    ctx.save();
    ctx.translate(at.x - foot.x, at.y - foot.y + (p.downed ? 22 : 0));
    drawPlayerTag(ctx, { p: tagged, cx: foot.x, headTop: foot.y - PLAYER_RADIUS * 2 - 10 - tagLiftFor(p.look.hat) });
    ctx.restore();
    if (p.downed) drawReviveRing(ctx, at.x + 34, at.y - 18, p.revive, t);
  }
  for (const w of effects.words) {
    const at = toScreen(w.x, w.y);
    // (They pop in a little big, settle, drift up and fade.)
    const pop = w.age < 0.18 ? 0.6 + (w.age / 0.18) * 0.55 : Math.max(1, 1.15 - (w.age - 0.18) * 1.5);
    const rise = 20 + (1 - Math.exp(-w.age * 2.2)) * 34;
    ctx.globalAlpha = Math.min(1, (2.4 - w.age) / 0.6);
    ctx.save();
    ctx.translate(at.x, at.y - rise);
    ctx.scale(pop, pop);
    pill(ctx, w.text, 0, 0, w.big ? 14 : 12, w.color);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (prompt) {
    const at = toScreen(me.x, me.y);
    pill(ctx, prompt, at.x, at.y + 20, 12);
  }
  ctx.restore();

  // The Rat King's health, across the top, while he's near.
  const king = f.critters.find((c) => c.kind === "ratKing");
  if (king && f.n === last && Math.hypot(king.sx - me.x, king.sy - me.y) < 9) {
    const w = Math.min(420, cw * 0.5), x = (cw - w) / 2, y = 104;
    ctx.fillStyle = "rgba(20, 12, 8, 0.8)";
    roundRectPath(ctx, x - 8, y - 22, w + 16, 40, 10);
    ctx.fill();
    ctx.font = "700 13px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#f2d27a";
    ctx.fillText("The Rat King", cw / 2, y - 6);
    ctx.fillStyle = "#3a2418";
    roundRectPath(ctx, x, y, w, 9, 4);
    ctx.fill();
    const fill = ctx.createLinearGradient(0, y, 0, y + 9);
    fill.addColorStop(0, "#d86a8a");
    fill.addColorStop(1, "#8a2a4a");
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, Math.max(0, (w * king.hp) / king.max), 9, 4);
    ctx.fill();
    ctx.textAlign = "left";
  }
  // On your last heart: a slow heartbeat at the edges.
  if (me.hearts === 1 && !me.downed) {
    const beat = Math.pow(Math.max(0, Math.sin(t * 5.2)), 6);
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    g.addColorStop(0, "rgba(150, 20, 20, 0)");
    g.addColorStop(1, `rgba(150, 20, 20, ${0.12 + beat * 0.2})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  // Hurt: the edges glow red for a moment.
  if (flash > 0) {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    g.addColorStop(0, "rgba(180, 30, 20, 0)");
    g.addColorStop(1, `rgba(180, 30, 20, ${flash * 0.45})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  if (fadeIn > 0) {
    ctx.fillStyle = `rgba(6, 4, 3, ${fadeIn})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  // A big line across the middle (a new floor, knocked out, the king).
  if (banner) {
    ctx.globalAlpha = Math.min(1, banner.left);
    ctx.font = "700 22px 'Quicksand', sans-serif";
    const w = ctx.measureText(banner.text).width + 48;
    ctx.fillStyle = "rgba(255, 250, 243, 0.95)";
    roundRectPath(ctx, (cw - w) / 2, ch * 0.24, w, 46, 14);
    ctx.fill();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.textAlign = "center";
    ctx.fillText(banner.text, cw / 2, ch * 0.24 + 30);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
  screen.end();
}

// One person in the cellar: their real character, a lantern in one hand
// and the broom in the other. Knocked out, they lie on the floor.
function drawPerson(ctx, p, t) {
  const at = toScreen(p.x, p.y);
  if (p.downed) {
    ctx.save();
    ctx.translate(at.x, at.y - 4);
    ctx.rotate((-Math.PI / 2) * p.face);
    drawHero(ctx, p.look, 0, 0, { moving: false, facing: p.face, tag: false, alpha: 0.9 });
    ctx.restore();
    drawBroom(ctx, at.x + 18 * p.face, at.y - 2, p.face > 0 ? 0.2 : Math.PI - 0.2, 0);
    // Little stars going round.
    ctx.fillStyle = "#ffe08a";
    for (let k = 0; k < 3; k++) {
      const a = t * 3 + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(at.x + Math.cos(a) * 12, at.y - 22 + Math.sin(a) * 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const blink = p.hurt && Math.floor(t * 12) % 2 === 0;
  // The broom: behind you over the shoulder, or sweeping round in front.
  const hand = { x: at.x - 9 * p.face, y: at.y - 16 };
  const rest = p.face > 0 ? -2.3 : -0.84;
  const swingAngle = p.aim - 1.1 + (1 - p.swing) * 2.2;
  const behind = p.swing <= 0;
  if (behind) drawBroom(ctx, hand.x, hand.y, rest, 0);
  drawHero(ctx, p.look, at.x, at.y, { moving: p.moving, facing: p.face, tag: false, alpha: blink ? 0.45 : 1 });
  drawHeldLantern(ctx, at.x + 13 * p.face, at.y - 16);
  if (!behind) drawBroom(ctx, at.x, at.y - 14, swingAngle, p.swing);
}

// A ring above a knocked-out person, filling as a friend helps them up.
function drawReviveRing(ctx, x, y, amount, t) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20, 12, 8, 0.6)";
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#8ad89a";
  ctx.beginPath();
  ctx.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, amount));
  ctx.stroke();
  // A little heart in the middle, pulsing.
  const s = 1 + Math.sin(t * 6) * 0.08;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "#e86a7a";
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-7, -1, -4, -7, 0, -3);
  ctx.bezierCurveTo(4, -7, 7, -1, 0, 4);
  ctx.fill();
  ctx.restore();
}

// A flying bit (see BURSTS): its shadow on the floor, then the bit up in
// the air, fading out at the end of its life.
function drawBit(ctx, b) {
  const at = toScreen(b.x, b.y), up = b.z * TILE;
  const fade = Math.min(1, (b.life - b.age) / 0.25);
  ctx.globalAlpha = fade;
  if (b.shape !== "puff") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, b.size * 0.8, b.size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = b.color;
  const x = at.x, y = at.y - up;
  if (b.shape === "chip" || b.shape === "stalk") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.spin);
    ctx.fillRect(-b.size, -b.size * (b.shape === "stalk" ? 0.15 : 0.35), b.size * 2, b.size * (b.shape === "stalk" ? 0.3 : 0.7));
    ctx.restore();
  } else if (b.shape === "star") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.spin * 0.4);
    ctx.fillRect(-b.size, -b.size * 0.22, b.size * 2, b.size * 0.44);
    ctx.fillRect(-b.size * 0.22, -b.size, b.size * 0.44, b.size * 2);
    ctx.restore();
  } else if (b.shape === "puff") {
    ctx.globalAlpha = fade * (1 - b.age / b.life);
    ctx.beginPath();
    ctx.arc(x, y, b.size * (1 + b.age * 2), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, b.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The broom's swoosh: a pale arc swept in front of you, fading fast.
function drawSwipe(ctx, sw) {
  const at = toScreen(sw.x, sw.y), r = sw.reach * TILE, k = sw.age / 0.22;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.55;
  ctx.strokeStyle = "#fff4dc";
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 5 - i * 1.5;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, r * (0.75 + i * 0.12), r * (0.75 + i * 0.12) * 0.62, 0, sw.aim - 1.1 + k * 0.4, sw.aim + 1.1 * (0.3 + k));
    ctx.stroke();
  }
  ctx.restore();
}

// A rounded label: prompts and words floating up.
function pill(ctx, text, x, y, size, color) {
  ctx.font = `700 ${size}px 'Quicksand', sans-serif`;
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 20, h = size + 9;
  ctx.fillStyle = color ? "rgba(30, 20, 14, 0.85)" : "rgba(255, 250, 243, 0.94)";
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = color ? "rgba(255, 220, 160, 0.35)" : WOOD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color ?? "#5c4530";
  ctx.fillText(text, x, y + size * 0.36);
  ctx.textAlign = "left";
}

// The little lantern everyone carries.
function drawHeldLantern(ctx, x, y) {
  drawLantern(ctx, x, y + 6, 0.55, performance.now() / 1000, false);
}

// The lobby's banner (minigames.js).
export function paintCellarBanner(ctx, w, h, t) {
  paintCellarScene(ctx, w, h, t);
}

// The workbench in the lobby: small upgrades for your next runs, bought
// with crumbs, one level at a time (the prices are in config.js,
// minigames.cellar.upgrades; the house server checks them).
const BENCH_SAYS = {
  lantern: (n) => `Your lantern lights ${n} tiles further`,
  bag: (n) => `Carry ${n} more finds`,
  broom: (n) => `Each swing hits ${n === 1 ? "one" : n} harder`,
};
export function cellarWorkbench() {
  const box = document.createElement("div");
  box.className = "mini-bench";
  const art = document.createElement("canvas");
  art.className = "mini-bench-art";
  art.width = 320;
  art.height = 130;
  const title = document.createElement("h3");
  title.textContent = "The workbench";
  const purse = document.createElement("p");
  purse.className = "mini-bench-purse";
  const rows = document.createElement("div");
  rows.className = "mini-bench-rows";
  const said = document.createElement("p");
  said.className = "mini-bench-said";
  box.append(art, title, purse, rows, said);
  const icons = [];
  const fill = () => {
    const wallet = myWallet();
    const have = wallet.minis?.cellar?.upgrades ?? {};
    purse.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
    purse.append(` You have ${wallet.crumbs ?? 0} crumbs`);
    rows.textContent = "";
    icons.length = 0;
    for (const [id, up] of Object.entries(CFG().upgrades)) {
      const level = have[id] ?? 0;
      const next = up.levels[level];
      const row = document.createElement("div");
      row.className = "mini-bench-row";
      const icon = document.createElement("canvas");
      icon.width = 48;
      icon.height = 48;
      icons.push({ id, icon });
      const words = document.createElement("div");
      words.className = "mini-bench-words";
      const name = document.createElement("strong");
      name.textContent = up.name;
      const pips = document.createElement("span");
      pips.className = "mini-bench-pips";
      for (let k = 0; k < up.levels.length; k++) {
        const pip = document.createElement("i");
        if (k < level) pip.className = "on";
        pips.append(pip);
      }
      const what = document.createElement("span");
      what.className = "mini-bench-what";
      what.textContent = next ? BENCH_SAYS[id]?.(next.adds) ?? "" : "As good as it gets!";
      words.append(name, pips, what);
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "warm-button";
      buy.textContent = next ? `Buy for ${next.price}` : "Done";
      buy.disabled = !next || (wallet.crumbs ?? 0) < next.price;
      buy.addEventListener("click", async () => {
        buy.disabled = true;
        const got = await bank("cellarUpgrade", { upgrade: id, level: level + 1 });
        said.textContent = got ? `${up.name}: level ${got.level}. It's ready for your next run.` : "";
        fill();
      });
      row.append(icon, words, buy);
      rows.append(row);
    }
  };
  fill();
  const onBank = () => (box.isConnected ? fill() : window.removeEventListener("bank-changed", onBank));
  window.addEventListener("bank-changed", onBank);
  // The art, with the lantern flickering.
  const paint = () => {
    if (!box.isConnected && painted) return;
    painted = true;
    const t = performance.now() / 1000;
    const c = art.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    paintWorkbench(c, art.width, art.height, t);
    for (const { id, icon } of icons) {
      const g = icon.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 48, 48);
      if (id === "lantern") drawLantern(g, 24, 16, 0.95, t, false);
      else if (id === "bag") drawFindsBag(g, 24, 44, 1.05);
      else drawBroom(g, 9, 40, -0.8, 0);
    }
    requestAnimationFrame(paint);
  };
  let painted = false;
  requestAnimationFrame(paint);
  return box;
}
