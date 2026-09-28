// How the back alley looks (Update 7, see "The back alley" in world.js).
// Sketchy, but it belongs: the house's own wooden siding on one side, the
// brick back of the building next door on the other, wet cobbles, a fire
// escape, a pink neon sign over the raccoons, and cozy touches (warm
// string lights, herbs in tin cans, an old sofa, a cat asleep on crates).
//
// The ground and the walls are painted once (paintAlleyGround); the moving
// parts (the neon's flicker and its reflection in the puddles, steam from
// the manhole, drips from the air conditioner, a TV flickering behind a
// window) every frame (drawAlleyLife); the string lights' bulbs glow over
// everything (drawAlleyOverhead). The rest are furniture drawings below.
// Light comes from above, like everywhere else.

const HOUSE_WALL_PX = 88; // how tall the house's side wall stands, in screen pixels
const BRICK_WALL_PX = 150; // and the building next door

// The floor line (the foot of the walls) at grid x, in screen pixels.
const alleyFoot = (x) => toScreen(x, ALLEY);

function paintAlleyGround(ctx) {
  const { left, right, top, bottom } = houseBounds();
  const a = alleyFoot(-WALL_THICKNESS), b = toScreen(ALLEY_W + WALL_THICKNESS, ALLEY + ALLEY_H);
  const houseEnd = alleyFoot(HOUSE_SIDE_W).x;

  // Around the alley: plain dark, like the space around the house's other
  // floors (the alley reads as one clean scene in the middle).
  ctx.fillStyle = "#15131b";
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);

  paintAlleyStreet(ctx, a, b);
  paintCobbles(ctx, alleyFoot(ALLEY_CURB).x, a.y, b.x, b.y);
  paintAlleyWalls(ctx, alleyFoot(ALLEY_CURB), houseEnd, b);
  paintAlleyEnds(ctx, a, b);

  // The low brick ledge along the south side, with two poles for the
  // lights strung across the alley.
  const x0 = alleyFoot(ALLEY_CURB).x;
  const ledgeTop = b.y - 4;
  ctx.fillStyle = "#6e3e32";
  ctx.fillRect(x0, ledgeTop, b.x - x0, 16);
  ctx.fillStyle = "#8a5242";
  ctx.fillRect(x0, ledgeTop - 6, b.x - x0, 7);
  ctx.fillStyle = "rgba(255, 220, 190, 0.15)";
  ctx.fillRect(x0, ledgeTop - 6, b.x - x0, 1.5);
  ctx.fillStyle = "rgba(30, 15, 10, 0.35)";
  for (let x = x0 + 6; x < b.x; x += 22) ctx.fillRect(x, ledgeTop - 6, 1, 7);
  for (let x = x0 + 17; x < b.x; x += 22) ctx.fillRect(x, ledgeTop + 2, 1, 8);
  ctx.fillRect(x0, ledgeTop + 1, b.x - x0, 1);
  for (const gx of ALLEY_LIGHT_POLES) {
    const p = toScreen(gx, ALLEY + ALLEY_H);
    ctx.fillStyle = "#2c2a30";
    ctx.fillRect(p.x - 1.5, p.y - 74, 3, 72);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(p.x - 1.5, p.y - 74, 1, 72);
  }
  // Weeds poking up from the cracks along the ledge.
  for (let i = 0; i < 14; i++) {
    const x = x0 + 10 + noise(i * 7.7 + 720) * (b.x - x0 - 20);
    ctx.strokeStyle = noise(i + 721) > 0.5 ? "#5f7f48" : "#7a9a58";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 3, ledgeTop - 6);
    ctx.lineTo(x - 1, ledgeTop - 12);
    ctx.moveTo(x + 2, ledgeTop - 6);
    ctx.lineTo(x + 3, ledgeTop - 11);
    ctx.stroke();
  }
}

// Where the lights strung across the alley are tied off on the ledge.
const ALLEY_LIGHT_POLES = [4.2, 9.2];

// The sliver of street past the alley's west end: asphalt with a painted
// line, a curb, and (drawn as furniture) the streetlight on the corner.
function paintAlleyStreet(ctx, a, b) {
  const curb = alleyFoot(ALLEY_CURB).x;
  const top = a.y - 40;
  // (Fading into the dark at its top and bottom: it's only a glimpse.)
  const road = ctx.createLinearGradient(0, top - 30, 0, b.y + 30);
  road.addColorStop(0, "rgba(40, 40, 48, 0)");
  road.addColorStop(0.2, "#2c2c34");
  road.addColorStop(0.85, "#2c2c34");
  road.addColorStop(1, "rgba(40, 40, 48, 0)");
  ctx.fillStyle = road;
  ctx.fillRect(a.x - 30, top - 30, curb - a.x + 30, b.y - top + 60);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(a.x - 30 + noise(i * 3.3 + 900) * (curb - a.x + 20), top + noise(i * 5.1 + 901) * (b.y - top), 2, 2);
  }
  // A dashed yellow line down the road.
  ctx.fillStyle = "rgba(230, 190, 70, 0.55)";
  const lx = a.x + 6;
  for (let y = top + 4; y < b.y; y += 24) ctx.fillRect(lx, y, 3, 13);
  // The curb: a pale stone edge, a little raised.
  ctx.fillStyle = "#8e8a86";
  ctx.fillRect(curb - 6, top, 6, b.y - top + 10);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(curb - 6, top, 1.5, b.y - top + 10);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(curb, top, 2, b.y - top + 10);
}

// Wet cobblestones, the storm drain at the curb, puddles in the low spots
// (by the drain, along the curb, under the gutter pipes), paw prints from
// the dumpster to Reginald's door, and a few bits of litter.
function paintCobbles(ctx, x0, y0, x1, y1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip(); // (the stones stop at the alley's edges)
  ctx.fillStyle = "#3e3c46";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const stones = ["#5f5c66", "#67636e", "#57545e", "#6c6562", "#5c5864"];
  let row = 0;
  for (let y = y0 + 2; y < y1 - 2; y += 11, row++) {
    for (let x = x0 - (row % 2) * 9; x < x1; x += 18) {
      const n = noise(row * 31.7 + x * 0.13 + 740);
      ctx.fillStyle = stones[Math.floor(n * stones.length)];
      roundRectPath(ctx, x + 1, y, 16, 9, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)"; // a wet sheen on top
      ctx.fillRect(x + 4, y + 1.5, 8, 1.5);
    }
  }
  // The storm drain, set in the curb's edge.
  const d = toScreen(ALLEY_CURB + 0.22, ALLEY + 2.1);
  ctx.fillStyle = "#1e1e24";
  roundRectPath(ctx, d.x - 6, d.y - 14, 12, 28, 2);
  ctx.fill();
  ctx.fillStyle = "#4e4e56";
  for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 4, d.y - 12 + i * 5.5, 8, 2.2);
  // Puddles (their shine and reflections move: see drawAlleyLife).
  for (const p of ALLEY_PUDDLES) {
    const c = toScreen(p.x, p.y);
    ctx.fillStyle = "#2c2e3a";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, p.rx * TILE, p.ry * TILE, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(190, 200, 225, 0.45)"; // a light wet edge
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Paw prints, from the dumpster over to Reginald's back door.
  ctx.fillStyle = "rgba(235, 228, 215, 0.35)";
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const p = toScreen(9.35 - t * 1.0, ALLEY + 0.95 + (i % 2 ? 0.1 : -0.06) - t * 0.15);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2.8, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy] of [[-2.6, -3.1], [-0.9, -4.1], [1.2, -4.1], [3, -3.1]]) {
      ctx.beginPath();
      ctx.arc(p.x + dx, p.y + dy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Litter: a paper scrap, a bottle cap, a few leaves blown in (along the edges).
  for (let i = 0; i < 10; i++) {
    const edge = i % 2 ? 0.75 + noise(i + 763) * 0.3 : ALLEY_WALK - 0.25 - noise(i + 764) * 0.3;
    const p = toScreen(ALLEY_CURB + 0.4 + noise(i * 5.1 + 760) * (ALLEY_W - ALLEY_CURB - 0.8), ALLEY + edge);
    ctx.fillStyle = ["#b88a4a", "#9a6a3a", "#c8a060", "#d8d0c0"][i % 4];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(noise(i + 762) * 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, i % 4 === 3 ? 4 : 2.8, i % 4 === 3 ? 3 : 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Soft shadow along the foot of the walls.
  const shade = ctx.createLinearGradient(0, y0, 0, y0 + 26);
  shade.addColorStop(0, "rgba(10, 6, 16, 0.45)");
  shade.addColorStop(1, "rgba(10, 6, 16, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(x0, y0, x1 - x0, 26);
  ctx.restore();
}

// The puddles, only in the low spots, and which light each one shows:
// the streetlight (by the drain and along the curb), the warm string
// lights (under the house's drainpipe), and the neon (under the building's
// pipe, below the sign).
const ALLEY_PUDDLES = [
  { x: ALLEY_CURB + 0.75, y: ALLEY + 2.2, rx: 0.5, ry: 0.19, light: "street" },
  { x: ALLEY_CURB + 0.45, y: ALLEY + 0.95, rx: 0.3, ry: 0.12, light: "street" },
  { x: HOUSE_SIDE_W + 0.12, y: ALLEY + 0.95, rx: 0.4, ry: 0.15, light: "warm" },
  { x: 9.3, y: ALLEY + 1.05, rx: 0.55, ry: 0.2, light: "neon" },
];

// The walls along the top: the house's side (siding, an eave, a little
// frosted window, a drainpipe), then the brick building (two windows, a
// fire escape, an air conditioner, a pipe, an electric box and a tag).
function paintAlleyWalls(ctx, a, houseEnd, b) {
  const y = a.y;
  // --- The house's side wall ---
  ctx.fillStyle = "#a07c55";
  ctx.fillRect(a.x, y - HOUSE_WALL_PX, houseEnd - a.x, HOUSE_WALL_PX);
  ctx.fillStyle = "rgba(60, 35, 15, 0.28)";
  for (let yy = y - HOUSE_WALL_PX + 6; yy < y - 2; yy += 7) ctx.fillRect(a.x, yy, houseEnd - a.x, 1.5);
  ctx.fillStyle = "rgba(255, 235, 200, 0.12)";
  for (let yy = y - HOUSE_WALL_PX + 1; yy < y - 2; yy += 7) ctx.fillRect(a.x, yy, houseEnd - a.x, 1);
  // Its eave: the roof's edge, with a gutter.
  ctx.fillStyle = "#5a3e2c";
  ctx.fillRect(a.x - 4, y - HOUSE_WALL_PX - 14, houseEnd - a.x + 8, 14);
  ctx.fillStyle = "#6e4e38";
  for (let x = a.x - 4; x < houseEnd + 4; x += 10) ctx.fillRect(x, y - HOUSE_WALL_PX - 14, 8, 6);
  ctx.fillStyle = "#8a8f96";
  ctx.fillRect(a.x - 4, y - HOUSE_WALL_PX - 2, houseEnd - a.x + 8, 3);
  // A darker band where the wall meets the cobbles (light from above).
  ctx.fillStyle = "rgba(40, 20, 10, 0.3)";
  ctx.fillRect(a.x, y - 6, houseEnd - a.x, 6);
  // A small frosted window, warm from inside (the house is cozy in there).
  const w = alleyFoot(3.35);
  ctx.fillStyle = "#6b4a30";
  ctx.fillRect(w.x - 15, y - 72, 30, 24);
  ctx.fillStyle = "#f4dfae";
  ctx.fillRect(w.x - 12, y - 69, 24, 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (let i = 0; i < 4; i++) ctx.fillRect(w.x - 11 + i * 6, y - 68, 3, 16);
  ctx.fillStyle = "#6b4a30";
  ctx.fillRect(w.x - 1, y - 69, 2, 18);
  ctx.fillRect(w.x - 17, y - 48, 34, 3);

  // --- The brick building next door ---
  const bx = houseEnd, bw = b.x - houseEnd;
  ctx.fillStyle = "#7e4636";
  ctx.fillRect(bx, y - BRICK_WALL_PX, bw, BRICK_WALL_PX);
  const bricks = ["#8a4c3a", "#7a4232", "#94563f", "#834838"];
  let row = 0;
  for (let yy = y - BRICK_WALL_PX + 1; yy < y - 1; yy += 7, row++) {
    for (let x = bx - (row % 2) * 8; x < b.x; x += 16) {
      ctx.fillStyle = bricks[Math.floor(noise(row * 13.3 + x * 0.21 + 780) * bricks.length)];
      ctx.fillRect(Math.max(x + 0.5, bx), yy, Math.min(15, b.x - x - 0.5), 6);
    }
  }
  // A stone cap along the top, and grime streaks running down.
  ctx.fillStyle = "#a89c8c";
  ctx.fillRect(bx - 2, y - BRICK_WALL_PX - 7, bw + 2, 8);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(bx - 2, y - BRICK_WALL_PX - 7, bw + 2, 2);
  for (let i = 0; i < 9; i++) {
    const x = bx + 10 + noise(i * 4.9 + 790) * (bw - 20);
    const g = ctx.createLinearGradient(0, y - BRICK_WALL_PX, 0, y - BRICK_WALL_PX + 60);
    g.addColorStop(0, "rgba(40, 30, 30, 0.25)");
    g.addColorStop(1, "rgba(40, 30, 30, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y - BRICK_WALL_PX, 4 + noise(i + 791) * 5, 60);
  }
  ctx.fillStyle = "rgba(25, 10, 10, 0.35)";
  ctx.fillRect(bx, y - 7, bw, 7);
  // The seam where the two buildings meet: a shadow, and the house's drainpipe.
  ctx.fillStyle = "rgba(20, 10, 10, 0.3)";
  ctx.fillRect(bx, y - BRICK_WALL_PX, 5, BRICK_WALL_PX);
  ctx.fillStyle = "#8a6a4e";
  ctx.fillRect(bx - 4, y - HOUSE_WALL_PX - 4, 6, HOUSE_WALL_PX + 2);
  ctx.fillStyle = "rgba(255, 230, 200, 0.25)";
  ctx.fillRect(bx - 4, y - HOUSE_WALL_PX - 4, 1.5, HOUSE_WALL_PX + 2);
  ctx.fillStyle = "#7a5c44";
  ctx.fillRect(bx - 7, y - 6, 12, 4); // its spout
  // Two windows up high: the left one lit (a TV flickers in there, see
  // drawAlleyLife), the right one dark with its blinds half down.
  for (const [gx, lit] of [[5.75, true], [10.7, false]]) {
    const p = alleyFoot(gx);
    ctx.fillStyle = "#a89c8c";
    ctx.fillRect(p.x - 17, y - 134, 34, 4); // lintel
    ctx.fillRect(p.x - 18, y - 102, 36, 4); // sill
    ctx.fillStyle = lit ? "#e8c890" : "#2e3440";
    ctx.fillRect(p.x - 14, y - 130, 28, 28);
    if (!lit) {
      ctx.fillStyle = "#c8c0b0";
      ctx.fillRect(p.x - 14, y - 130, 28, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      for (let yy = y - 128; yy < y - 117; yy += 3) ctx.fillRect(p.x - 14, yy, 28, 1);
    } else {
      ctx.fillStyle = "#c86a5a"; // curtains
      ctx.fillRect(p.x - 14, y - 130, 6, 28);
      ctx.fillRect(p.x + 8, y - 130, 6, 28);
    }
    ctx.fillStyle = "#4a3a34";
    ctx.fillRect(p.x - 1, y - 130, 2, 28);
    ctx.fillRect(p.x - 14, y - 117, 28, 2);
  }
  // The air conditioner under the dark window (it drips, see drawAlleyLife).
  const ac = alleyFoot(10.7);
  ctx.fillStyle = "#b8bcc0";
  ctx.fillRect(ac.x - 15, y - 96, 30, 17);
  ctx.fillStyle = "#8a9096";
  for (let i = 0; i < 5; i++) ctx.fillRect(ac.x - 12 + i * 6, y - 93, 3, 11);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(ac.x - 15, y - 96, 30, 2);
  ctx.fillStyle = "rgba(20, 15, 15, 0.3)";
  ctx.fillRect(ac.x - 15, y - 79, 30, 3);
  // A pipe running up the wall, and a grey electric box.
  const pipe = alleyFoot(9.25).x;
  ctx.fillStyle = "#6e7278";
  ctx.fillRect(pipe - 2.5, y - BRICK_WALL_PX, 5, BRICK_WALL_PX);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(pipe - 2.5, y - BRICK_WALL_PX, 1.2, BRICK_WALL_PX);
  for (const yy of [y - 120, y - 70, y - 25]) {
    ctx.fillStyle = "#55595e";
    ctx.fillRect(pipe - 4, yy, 8, 3);
  }
  // A grey electric box mounted on the bricks (its conduit runs up the
  // wall), with the yellow warning sign on its door.
  const box = alleyFoot(5.1);
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(box.x - 1.5, y - BRICK_WALL_PX, 3, BRICK_WALL_PX - 74);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(box.x - 10, y - 72, 22, 28);
  ctx.fillStyle = "#8c9296";
  ctx.fillRect(box.x - 11, y - 74, 22, 28);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(box.x - 11, y - 74, 22, 2);
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.moveTo(box.x, y - 68);
  ctx.lineTo(box.x - 6, y - 57);
  ctx.lineTo(box.x + 6, y - 57);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(box.x - 0.8, y - 65, 1.6, 5);
  ctx.fillRect(box.x - 0.8, y - 59, 1.6, 1.4);
  // A little tag sprayed low on the bricks: a raccoon's masked face.
  const tag = alleyFoot(11.55);
  ctx.strokeStyle = "rgba(150, 120, 210, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tag.x, y - 32, 9, 0, Math.PI * 2);
  ctx.moveTo(tag.x - 8, y - 38);
  ctx.lineTo(tag.x - 10, y - 45);
  ctx.lineTo(tag.x - 4, y - 40);
  ctx.moveTo(tag.x + 8, y - 38);
  ctx.lineTo(tag.x + 10, y - 45);
  ctx.lineTo(tag.x + 4, y - 40);
  ctx.stroke();
  ctx.fillStyle = "rgba(150, 120, 210, 0.75)";
  ctx.fillRect(tag.x - 8, y - 35, 16, 5);
  ctx.fillStyle = "rgba(245, 240, 230, 0.9)";
  ctx.fillRect(tag.x - 5, y - 34, 2, 2);
  ctx.fillRect(tag.x + 3, y - 34, 2, 2);
  // The fire escape: a black iron landing under the lit window, with a
  // railing and a ladder pulled up (drawn after the window, in front of it).
  paintFireEscape(ctx, y);
}

function paintFireEscape(ctx, y) {
  const l = alleyFoot(4.95).x, r = alleyFoot(7.6).x;
  const deck = y - 88;
  ctx.fillStyle = "rgba(10, 8, 12, 0.25)"; // its shadow on the bricks
  ctx.fillRect(l + 4, deck + 4, r - l, 6);
  ctx.fillStyle = "#2c2a30";
  ctx.fillRect(l, deck, r - l, 5);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(l, deck, r - l, 1);
  // The railing: a top rail and thin balusters.
  ctx.fillStyle = "#2c2a30";
  ctx.fillRect(l, deck - 22, r - l, 2.5);
  for (let x = l; x <= r; x += 7) ctx.fillRect(x, deck - 22, 1.5, 22);
  // Brackets under the deck.
  ctx.strokeStyle = "#2c2a30";
  ctx.lineWidth = 2;
  for (const x of [l + 8, r - 8]) {
    ctx.beginPath();
    ctx.moveTo(x, deck + 5);
    ctx.lineTo(x - 10, deck + 20);
    ctx.stroke();
  }
  // The ladder, pulled up, hanging from the deck's right end.
  const lx = r - 16;
  ctx.fillRect(lx, deck + 5, 2, 44);
  ctx.fillRect(lx + 12, deck + 5, 2, 44);
  for (let yy = deck + 10; yy < deck + 48; yy += 7) ctx.fillRect(lx, yy, 14, 1.8);
  // A potted geranium someone keeps out there.
  const pot = l + 18;
  ctx.fillStyle = "#b8643c";
  ctx.fillRect(pot - 6, deck - 9, 12, 9);
  ctx.fillStyle = "#4f7a3f";
  ctx.beginPath();
  ctx.arc(pot, deck - 12, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0505a";
  for (const [dx, dy] of [[-3, -15], [3, -14], [0, -18]]) {
    ctx.beginPath();
    ctx.arc(pot + dx, deck + dy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The alley's two ends: at the west, a striped barrier across the mouth
// (past it, the street); at the east, the padlocked chain-link fence
// (a way on, one day).
function paintAlleyEnds(ctx, a, b) {
  const w = TILE * WALL_THICKNESS;
  // West: a sawhorse barrier, orange and white, across the alley's mouth.
  const bx = alleyFoot(ALLEY_CURB).x + 3;
  const y0 = toScreen(0, ALLEY + 0.35).y, y1 = toScreen(0, ALLEY + ALLEY_WALK - 0.1).y;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(bx + 3, y0 + 4, 6, y1 - y0);
  for (let y = y0; y < y1; y += 10) {
    ctx.fillStyle = Math.floor((y - y0) / 10) % 2 ? "#f2ede4" : "#e0782e";
    ctx.fillRect(bx, y, 7, Math.min(10, y1 - y));
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(bx, y0, 1.5, y1 - y0);
  ctx.fillStyle = "#3a3a40"; // its feet
  for (const y of [y0, y1 - 4]) ctx.fillRect(bx - 4, y, 15, 4);
  // East: the chain-link fence, with dark beyond it, and a padlock.
  const ex = toScreen(ALLEY_W, 0).x;
  ctx.fillStyle = "#1e1c24";
  ctx.fillRect(ex, a.y - 60, 60, b.y - a.y + 80);
  ctx.strokeStyle = "rgba(170, 175, 185, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let yy = a.y - 60; yy < b.y - 6; yy += 6) {
    ctx.moveTo(ex, yy);
    ctx.lineTo(ex + w, yy + 6);
    ctx.moveTo(ex + w, yy);
    ctx.lineTo(ex, yy + 6);
  }
  ctx.stroke();
  ctx.fillStyle = "#8a9096";
  ctx.fillRect(ex - 1, a.y - 62, 3, b.y - a.y + 58);
  ctx.fillRect(ex + w - 2, a.y - 62, 3, b.y - a.y + 58);
  const mid = toScreen(ALLEY_W, ALLEY + 1.6).y;
  ctx.fillStyle = "#c8a040";
  roundRectPath(ctx, ex + w / 2 - 4, mid, 8, 7, 1.5);
  ctx.fill();
  ctx.strokeStyle = "#c8a040";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ex + w / 2, mid, 3, Math.PI, 0);
  ctx.stroke();
}

// --- Every frame ---
function drawAlleyLife(ctx) {
  const t = performance.now() / 1000;
  const y = alleyFoot(0).y;
  // The TV behind the lit window, flickering blue and white.
  const win = alleyFoot(5.75);
  const flick = 0.25 + 0.2 * Math.sin(t * 7) * Math.sin(t * 2.3) + (Math.sin(t * 13) > 0.8 ? 0.15 : 0);
  ctx.fillStyle = `rgba(150, 190, 255, ${flick})`;
  ctx.fillRect(win.x - 8, y - 130, 16, 13);
  ctx.fillRect(win.x - 8, y - 115, 16, 13);
  drawNeonSign(ctx, t);
  // Each puddle mirrors the light nearest it: pink and teal neon, the warm
  // string lights, or the streetlight's pale gold.
  const on = neonOn(t);
  for (const q of ALLEY_PUDDLES) {
    const c = toScreen(q.x, q.y), rx = q.rx * TILE, ry = q.ry * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx - 1.5, ry - 1, 0, 0, Math.PI * 2);
    ctx.clip();
    if (q.light === "neon") {
      ctx.fillStyle = `rgba(255, 110, 190, ${on ? 0.45 : 0.14})`;
      for (let i = 0; i < 4; i++) ctx.fillRect(c.x - rx * 0.6 + Math.sin(t * 2 + i) * 2, c.y - ry * 0.6 + i * 3, rx * 1.1, 1.6);
      ctx.fillStyle = `rgba(120, 230, 220, ${on ? 0.4 : 0.14})`;
      ctx.fillRect(c.x + rx * 0.15 + Math.sin(t * 1.7) * 2, c.y - 2, rx * 0.5, 1.4);
    } else {
      const color = q.light === "warm" ? "255, 200, 120" : "255, 228, 170";
      ctx.fillStyle = `rgba(${color}, 0.4)`;
      ctx.fillRect(c.x - rx * 0.5 + Math.sin(t * 1.3 + q.x) * 1.5, c.y - 1.5, rx * 0.8, 1.6);
      ctx.fillStyle = `rgba(${color}, 0.22)`;
      ctx.fillRect(c.x - rx * 0.3, c.y + 2, rx * 0.5, 1.2);
    }
    ctx.restore();
  }
  // Drips from the air conditioner.
  const ac = alleyFoot(10.9);
  const drop = (t * 0.9) % 1;
  ctx.fillStyle = "rgba(190, 215, 240, 0.8)";
  ctx.fillRect(ac.x, y - 76 + drop * 70, 1.6, 3);
  // Steam curling up from the manhole.
  const m = FURNITURE.find((f) => f.kind === "manhole" && floorOf(f.y) === ALLEY_FLOOR);
  if (m) {
    const mc = toScreen(m.x + m.w / 2, m.y + m.h / 2);
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.25 + i / 6) % 1;
      ctx.fillStyle = `rgba(230, 230, 240, ${0.26 * Math.sin(ph * Math.PI)})`;
      ctx.beginPath();
      ctx.arc(mc.x + Math.sin(t * 0.8 + i * 2) * 6 * ph, mc.y - 4 - ph * 46, 5 + ph * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Where the raccoons' neon sign hangs (grid x), over their dumpster.
const NEON_X = 9.8;

// The neon's "N" flickers now and then (it's not a good sign. or it is).
function neonOn(t) {
  const s = t % 7;
  return !(s > 5.2 && s < 5.9 && Math.sin(t * 40) > -0.2);
}

// A raccoon face in teal over "OPEN" in pink, on the bricks above the raccoons.
function drawNeonSign(ctx, t) {
  const p = alleyFoot(NEON_X), y = p.y - 62;
  const on = neonOn(t);
  ctx.save();
  // The backing board and its little bracket.
  ctx.fillStyle = "#2a2430";
  roundRectPath(ctx, p.x - 26, y - 34, 52, 50, 5);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const tube = (color, glow, lit, draw) => {
    ctx.strokeStyle = lit ? color : "rgba(120, 90, 110, 0.6)";
    ctx.shadowColor = glow;
    ctx.shadowBlur = lit ? 10 : 0;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    draw();
    ctx.stroke();
  };
  // The raccoon: round head, ears, and the mask.
  tube("#9ff5ea", "rgba(90, 240, 220, 0.9)", true, () => {
    ctx.arc(p.x, y - 16, 10, 0, Math.PI * 2);
    ctx.moveTo(p.x - 8, y - 23);
    ctx.lineTo(p.x - 11, y - 31);
    ctx.lineTo(p.x - 4, y - 25);
    ctx.moveTo(p.x + 8, y - 23);
    ctx.lineTo(p.x + 11, y - 31);
    ctx.lineTo(p.x + 4, y - 25);
    ctx.moveTo(p.x - 9, y - 17);
    ctx.quadraticCurveTo(p.x, y - 22, p.x + 9, y - 17);
    ctx.moveTo(p.x - 1, y - 11);
    ctx.lineTo(p.x + 1, y - 11);
  });
  // "OPEN", with the N on the blink.
  ctx.font = "800 11px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255, 90, 180, 0.95)";
  ctx.shadowBlur = 10;
  // (Measured, so the N sits right after "OPE".)
  ctx.textAlign = "left";
  const full = ctx.measureText("OPEN").width, ope = ctx.measureText("OPE").width;
  ctx.fillStyle = "#ff9fd4";
  ctx.fillText("OPE", p.x - full / 2, y + 9);
  ctx.fillStyle = on ? "#ff9fd4" : "rgba(130, 80, 110, 0.7)";
  ctx.shadowBlur = on ? 10 : 0;
  ctx.fillText("N", p.x - full / 2 + ope, y + 9);
  ctx.restore();
  ctx.textAlign = "left";
}

// Over everything: the string lights along the walls and strung across
// the alley to poles on the ledge (bright bulbs, with a soft glow), and the
// neon's pink haze.
function drawAlleyOverhead(ctx, level) {
  const y = alleyFoot(0).y;
  const t = performance.now() / 1000;
  const ledge = toScreen(0, ALLEY + ALLEY_H).y - 74; // the poles' tops
  // [x0, y0, x1, y1, sag]: along the house's eave, along the brick wall,
  // and two strands across the alley from the brick wall to the poles.
  const strands = [
    [alleyFoot(ALLEY_CURB + 0.1).x, y - HOUSE_WALL_PX + 6, alleyFoot(HOUSE_SIDE_W - 0.1).x, y - HOUSE_WALL_PX + 6, 10],
    [alleyFoot(HOUSE_SIDE_W + 0.1).x, y - 112, alleyFoot(ALLEY_W + 0.2).x, y - 112, 16],
    [alleyFoot(5.4).x, y - 112, toScreen(ALLEY_LIGHT_POLES[0], 0).x, ledge, 18],
    [alleyFoot(10.6).x, y - 112, toScreen(ALLEY_LIGHT_POLES[1], 0).x, ledge, 18],
  ];
  for (const [x0, y0, x1, y1, sag] of strands) {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22));
    const at = (u) => ({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag });
    ctx.strokeStyle = "#2a2622";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = at(i / 40);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    for (let i = 1; i < n; i++) {
      const p = at(i / n);
      const warm = ["255, 205, 120", "255, 170, 110", "255, 225, 160"][i % 3];
      const tw = 0.85 + 0.15 * Math.sin(t * 2 + i * 1.9);
      const g = ctx.createRadialGradient(p.x, p.y + 3, 0, p.x, p.y + 3, 16);
      g.addColorStop(0, `rgba(${warm}, ${0.6 * level * tw})`);
      g.addColorStop(1, `rgba(${warm}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 16, p.y - 13, 32, 32);
      ctx.fillStyle = `rgb(${warm})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, 2.3, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The neon's glow on the bricks and cobbles around it.
  const p = alleyFoot(NEON_X);
  const on = neonOn(t);
  const haze = ctx.createRadialGradient(p.x, p.y - 60, 0, p.x, p.y - 60, 130);
  haze.addColorStop(0, `rgba(255, 90, 180, ${on ? 0.28 : 0.1})`);
  haze.addColorStop(1, "rgba(255, 90, 180, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = haze;
  ctx.fillRect(p.x - 130, p.y - 190, 260, 260);
  ctx.restore();
}

// The alley's pools of light: [x, y (grid), radius, strength, color]. The
// streetlight on the corner, the caged bulb over Reginald's door, the neon
// (pink), the candle, the lit window, and soft pools under the string lights.
function alleyGlows() {
  const glows = [];
  for (const f of FURNITURE) {
    if (floorOf(f.y) !== ALLEY_FLOOR) continue;
    if (f.kind === "cagedLamp") glows.push([f.x, f.y + 0.3, 75, 1]);
    if (f.kind === "cableSpool") glows.push([f.x + f.w / 2, f.y, 45, 0.8]); // (the candle)
    if (f.kind === "streetLamp") glows.push([f.x + 0.45, f.y + 1.0, 105, 0.6, "255, 225, 170"]);
  }
  glows.push([NEON_X, ALLEY + 0.9, 95, neonOn(performance.now() / 1000) ? 0.9 : 0.35, "255, 90, 180"]);
  glows.push([5.75, ALLEY - 2.5, 40, 0.5]); // the lit window
  for (const [x, y] of [[2.9, 0.5], [4.2, 1.6], [6.6, 0.8], [7.5, 2.2], [9.2, 1.9], [11.2, 0.7]]) glows.push([x, ALLEY + y, 55, 0.45]); // under the string lights
  return glows;
}

// --- The alley's furniture ---
Object.assign(FURNITURE_DRAWERS, {
  // Reginald's back door, in the brick wall: dark reddish wood (not the
  // house's pale siding), iron straps, a brass knob, and a little brass
  // paw print plaque. A worn step in front.
  reginaldDoor(ctx, f) {
    const a = toScreen(f.x, f.y), w = f.w * TILE, h = 58;
    ctx.fillStyle = "rgba(20, 15, 20, 0.35)";
    ctx.fillRect(a.x - 6, a.y + 2, w + 12, 9);
    ctx.fillStyle = "#7e7a76";
    ctx.fillRect(a.x - 6, a.y - 1, w + 12, 9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(a.x - 6, a.y - 1, w + 12, 1.5);
    ctx.fillStyle = "#2e2420"; // frame
    ctx.fillRect(a.x - 3, a.y - h - 3, w + 6, h + 3);
    const wood = ctx.createLinearGradient(0, a.y - h, 0, a.y);
    wood.addColorStop(0, "#6e3326");
    wood.addColorStop(1, "#4e2219");
    ctx.fillStyle = wood;
    ctx.fillRect(a.x, a.y - h, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; // planks
    for (let x = a.x + w / 4; x < a.x + w - 2; x += w / 4) ctx.fillRect(x, a.y - h, 1, h);
    ctx.fillStyle = "rgba(255, 210, 180, 0.12)"; // light on its top edge
    ctx.fillRect(a.x, a.y - h, w, 2);
    ctx.fillStyle = "#2a2426"; // iron straps
    for (const yy of [a.y - h + 9, a.y - 14]) ctx.fillRect(a.x, yy, w, 3);
    ctx.fillStyle = "#d9b04a"; // the knob
    ctx.beginPath();
    ctx.arc(a.x + w - 7, a.y - 28, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // The brass plaque with a paw print.
    const px = a.x + w / 2, py = a.y - h + 20;
    ctx.fillStyle = "#c8a040";
    roundRectPath(ctx, px - 8, py - 7, 16, 14, 3);
    ctx.fill();
    ctx.fillStyle = "#5a3a1e";
    ctx.beginPath();
    ctx.ellipse(px, py + 2, 3, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy] of [[-3, -1.8], [-1, -3.2], [1.1, -3.2], [3.1, -1.8]]) {
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(40, 20, 10, 0.3)";
    ctx.fillRect(a.x - 3, a.y - 3, w + 6, 3);
  },

  // Two recycling bins against the wall: blue for paper, green for glass.
  recyclingBins(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const half = f.w / 2 - 0.03;
    for (const [i, color, lid] of [[0, "#3f6f9f", "#335d86"], [1, "#4f7a48", "#41683b"]]) {
      const box = drawBlock(ctx, f.x + i * (half + 0.06), f.y, half, f.h, 26, color);
      ctx.fillStyle = lid;
      ctx.fillRect(box.top.x - 1, box.top.y - 2, box.top.w + 2, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)"; // the recycling arrows, simply
      ctx.beginPath();
      ctx.arc(box.face.x + box.face.w / 2, box.face.y + box.face.h / 2, 4, 0.3, Math.PI * 1.7);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.stroke();
    }
  },

  // Wooden pallets leaning on the ledge, one on top of another.
  pallets(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    for (const [dx, lean] of [[0, 0], [6, -4]]) {
      ctx.save();
      ctx.translate(a.x + dx, a.y);
      ctx.transform(1, 0, lean / 30, 1, 0, 0);
      ctx.fillStyle = "#9a7a54";
      for (let i = 0; i < 4; i++) ctx.fillRect(0, -30 + i * 8, w - 6, 5);
      ctx.fillStyle = "#7a5c3c";
      for (const x of [2, w / 2 - 4, w - 12]) ctx.fillRect(x, -32, 5, 32);
      ctx.fillStyle = "rgba(255, 235, 200, 0.12)";
      ctx.fillRect(0, -30, w - 6, 1.5);
      ctx.restore();
    }
  },

  // An old bicycle leaning on the ledge (a basket on the front).
  alleyBike(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    const back = a.x + 10, front = a.x + w - 10, hub = a.y - 11;
    ctx.strokeStyle = "#2a2a30";
    ctx.lineWidth = 2;
    for (const x of [back, front]) {
      ctx.beginPath();
      ctx.arc(x, hub, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#3f7a8a"; // the frame
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(back, hub);
    ctx.lineTo(a.x + w * 0.45, hub);
    ctx.lineTo(a.x + w * 0.4, hub - 16);
    ctx.lineTo(front - 4, hub - 18);
    ctx.lineTo(front, hub);
    ctx.moveTo(a.x + w * 0.45, hub);
    ctx.lineTo(front - 4, hub - 18);
    ctx.moveTo(back, hub);
    ctx.lineTo(a.x + w * 0.4, hub - 16);
    ctx.stroke();
    ctx.fillStyle = "#2a2a30"; // seat and handlebars
    ctx.fillRect(a.x + w * 0.4 - 5, hub - 20, 10, 3);
    ctx.fillRect(front - 8, hub - 23, 10, 2.5);
    ctx.fillStyle = "#b08a50"; // a wicker basket
    ctx.fillRect(front - 2, hub - 26, 10, 8);
  },

  // A stack of old pipes lying along the ledge.
  pipeStack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    for (const [dy, dx, r, color] of [[-5, 0, 5, "#6e7278"], [-5, 12, 5, "#7a7e84"], [-14, 6, 5, "#5f6368"], [-5, 24, 4, "#8a5a3a"]]) {
      ctx.fillStyle = color;
      ctx.fillRect(a.x + dx, a.y + dy - r, w - 30, r * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(a.x + dx, a.y + dy - r, w - 30, 1.5);
      ctx.fillStyle = "#2a2a30"; // the open end
      ctx.beginPath();
      ctx.ellipse(a.x + dx + w - 30, a.y + dy, 2.5, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // The streetlight on the corner past the barrier: a tall pole, an arm
  // reaching over the street, and a lamp.
  streetLamp(ctx, f) {
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c2e34";
    ctx.fillRect(b.x - 2.5, b.y - 120, 5, 120);
    ctx.fillRect(b.x - 5, b.y - 6, 10, 6);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(b.x - 2.5, b.y - 120, 1.2, 120);
    ctx.fillRect(b.x, b.y - 120, 22, 3); // the arm
    ctx.fillStyle = "#2c2e34";
    ctx.fillRect(b.x, b.y - 120, 22, 3);
    ctx.fillStyle = "#3a3c44"; // the lamp head
    roundRectPath(ctx, b.x + 14, b.y - 121, 16, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#fff0c8";
    ctx.fillRect(b.x + 16, b.y - 115, 12, 2.5);
  },

  // A faint trail of muddy paw prints across the grass (the raccoons went
  // this way). Its `points` are yard spots, like the paths.
  pawTrail(ctx, f) {
    const pts = f.points.map(([x, y]) => toScreen(x, YARD + y));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const side = i % 2 ? 4 : -4;
      // Each print: a darker muddy rim, then the print, fainter further back.
      for (const [color, grow] of [["rgba(60, 40, 22, 0.35)", 0.7], [`rgba(105, 78, 48, ${0.3 + (i / pts.length) * 0.25})`, 0]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + side, 3 + grow, 2.2 + grow, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const [dx, dy] of [[-2.8, -3.2], [-1, -4.3], [1.2, -4.3], [3, -3.2]]) {
          ctx.beginPath();
          ctx.arc(p.x + dx, p.y + side + dy, 0.9 + grow * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  // A caged bulb on a bracket over the door.
  cagedLamp(ctx, f) {
    const a = toScreen(f.x, f.y), y = a.y - 66;
    ctx.fillStyle = "#2c2a30";
    ctx.fillRect(a.x - 1, y - 10, 2, 8);
    ctx.fillRect(a.x - 6, y - 12, 12, 3);
    ctx.fillStyle = "#ffe1a0";
    ctx.beginPath();
    ctx.ellipse(a.x, y + 3, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2c2a30";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x - 5, y + 3);
    ctx.lineTo(a.x + 5, y + 3);
    ctx.moveTo(a.x, y - 2);
    ctx.lineTo(a.x, y + 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(a.x, y + 3, 5.5, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  // Herbs growing in old tin cans along the house wall: basil, rosemary,
  // mint and a leggy tomato.
  herbCans(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    const cans = [[7, 14, "#c8423a", "#4f8a3f"], [19, 11, "#3f6f9f", "#5f8a58"], [30, 15, "#e0b84c", "#3f7a42"], [42, 12, "#b0b6ba", "#5fa052"]];
    for (const [dx, h, label, leaf] of cans) {
      const x = b.x + dx;
      ctx.fillStyle = "#a8adb2";
      ctx.fillRect(x - 5, b.y - h, 10, h);
      ctx.fillStyle = label;
      ctx.fillRect(x - 5, b.y - h + 3, 10, h - 7);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x - 5, b.y - h, 2, h);
      ctx.fillStyle = leaf;
      for (const [lx, ly, r] of [[0, -6, 5], [-4, -3, 3.5], [4, -3, 3.5], [0, -10, 3]]) {
        ctx.beginPath();
        ctx.arc(x + lx, b.y - h + ly, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#e0505a"; // two little tomatoes
    for (const dx of [28, 33]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y - 22, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // An old sagging sofa, mustard velvet, patched, with a crocheted blanket
  // over one arm. Sit on it.
  alleySofa(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    // Back cushions.
    ctx.fillStyle = "#a88838";
    roundRectPath(ctx, a.x + 2, b.y - 40, w - 4, 22, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 240, 200, 0.18)";
    ctx.fillRect(a.x + 6, b.y - 38, w - 12, 3);
    // Seat, sagging in the middle.
    ctx.fillStyle = "#b8963e";
    ctx.beginPath();
    ctx.moveTo(a.x + 4, b.y - 20);
    ctx.quadraticCurveTo(a.x + w / 2, b.y - 14, a.x + w - 4, b.y - 20);
    ctx.lineTo(a.x + w - 4, b.y - 6);
    ctx.lineTo(a.x + 4, b.y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6e2c";
    ctx.fillRect(a.x + 4, b.y - 8, w - 8, 5);
    // Arms.
    for (const x of [a.x, a.x + w - 10]) {
      ctx.fillStyle = "#9a7c34";
      roundRectPath(ctx, x, b.y - 28, 10, 24, 4);
      ctx.fill();
    }
    // A patch, and the blanket over the right arm.
    ctx.fillStyle = "#6a8ab0";
    ctx.fillRect(a.x + w * 0.3, b.y - 33, 9, 7);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(a.x + w * 0.3, b.y - 33, 9, 7);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ["#d9644f", "#f2c94c", "#5fa052", "#e8e0cc"][i];
      ctx.fillRect(a.x + w - 13, b.y - 30 + i * 5, 14, 5);
    }
    // Stubby legs.
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(a.x + 4, b.y - 3, 3, 3);
    ctx.fillRect(a.x + w - 7, b.y - 3, 3, 3);
  },

  // A wooden cable spool as a table, a candle stuck in a bottle on top,
  // and a deck of cards.
  cableSpool(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2;
    ctx.fillStyle = "#8a6a44"; // the drum
    ctx.fillRect(c.x - rx * 0.45, c.y - 20, rx * 0.9, 16);
    ctx.fillStyle = "#6e5236"; // bottom flange
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 3, rx, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8845a"; // top flange
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 22, rx, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a6a44";
    ctx.fillRect(c.x - rx, c.y - 22, rx * 2, 3);
    ctx.fillStyle = "rgba(255, 240, 210, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 23, rx * 0.8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // The bottle (green), dribbled with wax, and its candle flame.
    const t = performance.now() / 1000;
    ctx.fillStyle = "#3f6a4a";
    ctx.fillRect(c.x - 4, c.y - 34, 8, 12);
    ctx.fillRect(c.x - 2, c.y - 38, 4, 5);
    ctx.fillStyle = "#f2ead8";
    ctx.fillRect(c.x - 1.8, c.y - 44, 3.6, 7);
    ctx.fillRect(c.x - 4, c.y - 36, 2, 5);
    ctx.fillStyle = "#ffcf6a";
    ctx.beginPath();
    ctx.ellipse(c.x + Math.sin(t * 9) * 0.6, c.y - 47, 1.8, 3.2 + Math.sin(t * 13) * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cards, fanned out.
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(c.x + 10 + i * 3, c.y - 23);
      ctx.rotate(-0.4 + i * 0.3);
      ctx.fillStyle = "#fbf6ea";
      ctx.fillRect(-2.5, -3.5, 5, 7);
      ctx.fillStyle = i === 1 ? "#d9644f" : "#3a3a40";
      ctx.fillRect(-0.8, -1, 1.6, 1.6);
      ctx.restore();
    }
  },

  // A plastic milk crate turned over for a seat (sit on it): open slats on
  // its sides, a rim, and a grid on top.
  milkCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#4a78a0");
    // The side: slots between the slats, showing the dark inside.
    ctx.fillStyle = "rgba(15, 22, 40, 0.7)";
    const slot = (box.face.w - 6) / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(box.face.x + 3 + i * slot, box.face.y + 3, slot - 2.5, box.face.h - 7);
    }
    ctx.fillStyle = "#5a8ab4"; // the rim along the bottom
    ctx.fillRect(box.face.x, box.face.y + box.face.h - 3, box.face.w, 3);
    // The top: a grid of little squares.
    ctx.strokeStyle = "rgba(20, 35, 60, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const x = box.top.x + (box.top.w * i) / 4;
      ctx.moveTo(x, box.top.y + 1);
      ctx.lineTo(x, box.top.y + box.top.h - 1);
    }
    ctx.moveTo(box.top.x + 1, box.top.y + box.top.h / 2);
    ctx.lineTo(box.top.x + box.top.w - 1, box.top.y + box.top.h / 2);
    ctx.stroke();
    ctx.strokeStyle = "#6a9ac4";
    ctx.strokeRect(box.top.x + 0.5, box.top.y + 0.5, box.top.w - 1, box.top.h - 1);
  },

  // A rolling clothes rack of hats and scarves: the raccoons' "stock".
  hatRack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    ctx.fillStyle = "#8a9096";
    ctx.fillRect(a.x + 3, a.y - 50, 2.5, 48);
    ctx.fillRect(a.x + w - 5.5, a.y - 50, 2.5, 48);
    ctx.fillRect(a.x + 1, a.y - 52, w - 2, 3);
    ctx.fillRect(a.x, a.y - 4, w, 2.5);
    ctx.fillStyle = "#2a2a30";
    for (const x of [a.x + 2, a.x + w - 4]) {
      ctx.beginPath();
      ctx.arc(x + 1, a.y - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Things hanging off the rail: scarves, a coat, and hats on top.
    const hung = [["#d9644f", 22], ["#5a4a8a", 30], ["#e0b84c", 18], ["#3f7a42", 26], ["#c86aa0", 20]];
    hung.forEach(([color, len], i) => {
      const x = a.x + 8 + i * ((w - 16) / 4);
      ctx.fillStyle = color;
      roundRectPath(ctx, x - 4, a.y - 49, 8, len, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(x - 4, a.y - 49, 2, len);
    });
    // A top hat and a beanie perched on the rail.
    ctx.fillStyle = "#2e2a30";
    ctx.fillRect(a.x + 9, a.y - 66, 12, 13);
    ctx.fillRect(a.x + 5, a.y - 55, 20, 3);
    ctx.fillStyle = "#c8423a";
    ctx.fillRect(a.x + 9, a.y - 58, 12, 2);
    ctx.fillStyle = "#e0a040";
    ctx.beginPath();
    ctx.arc(a.x + w - 16, a.y - 53, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fbf6ea";
    ctx.beginPath();
    ctx.arc(a.x + w - 16, a.y - 62, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // A price tag, slightly too expensive.
    ctx.fillStyle = "#f2e2c0";
    ctx.fillRect(a.x + w / 2 - 5, a.y - 30, 10, 7);
    ctx.fillStyle = "#7a5c3e";
    ctx.fillRect(a.x + w / 2 - 3, a.y - 28, 6, 1);
    ctx.fillRect(a.x + w / 2 - 3, a.y - 26, 4, 1);
  },

  // Wooden crates stacked by the fence, and a stray cat asleep on top
  // (her tail twitches, and she breathes).
  crateStack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const low = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, "#9a7650");
    const top = drawBlock(ctx, f.x + 0.12, f.y + 0.02, f.w - 0.3, f.h - 0.1, 34, "#a8845a");
    for (const box of [low, top]) {
      ctx.fillStyle = "rgba(60, 40, 20, 0.35)";
      ctx.fillRect(box.face.x, box.face.y + box.face.h / 2 - 0.5, box.face.w, 1.2);
      ctx.fillRect(box.face.x + 2, box.face.y, 1.5, box.face.h);
      ctx.fillRect(box.face.x + box.face.w - 3.5, box.face.y, 1.5, box.face.h);
    }
    ctx.fillStyle = "rgba(40, 25, 15, 0.6)";
    ctx.font = "700 6px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FRAGILE", low.face.x + low.face.w / 2, low.face.y + 7);
    ctx.textAlign = "left";
    // The cat: a grey tabby curled into a loaf.
    const t = performance.now() / 1000;
    const cx = top.top.x + top.top.w / 2, cy = top.top.y + top.top.h / 2 + 1;
    const breathe = 1 + Math.sin(t * 1.6) * 0.04;
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a8480";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4 * breathe, 12, 7 * breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6e6864"; // stripes
    for (const dx of [-5, 0, 5]) ctx.fillRect(cx + dx - 1, cy - 10 * breathe, 2, 5);
    // Her head, tucked in on the left, eyes shut.
    ctx.fillStyle = "#8a8480";
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - 10 + s * 2 - 2.5, cy - 9);
      ctx.lineTo(cx - 10 + s * 3.5, cy - 13.5);
      ctx.lineTo(cx - 10 + s * 5 - (s > 0 ? 0 : 0), cy - 8);
      ctx.fill();
    }
    ctx.strokeStyle = "#3a3430";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 5, 1.3, 0.2, Math.PI - 0.2);
    ctx.moveTo(cx - 6.8, cy - 5);
    ctx.arc(cx - 8, cy - 5, 1.3, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // The tail curling round the front, its tip twitching now and then.
    const twitch = Math.sin(t * 0.7) > 0.8 ? Math.sin(t * 12) * 2 : 0;
    ctx.strokeStyle = "#7a7470";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 11, cy - 3);
    ctx.quadraticCurveTo(cx + 12, cy + 3, cx + 2, cy + 2);
    ctx.lineTo(cx - 4 + twitch, cy + 1 + twitch * 0.3);
    ctx.stroke();
    ctx.lineCap = "butt";
    // A "z" drifting up now and then.
    const z = (t * 0.35) % 1;
    ctx.fillStyle = `rgba(250, 245, 235, ${0.7 * Math.sin(z * Math.PI)})`;
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.fillText("z", cx - 14 + z * 4, cy - 16 - z * 14);
  },

  // A round iron manhole cover (steam in the alley: drawAlleyLife): a soft
  // ground shadow, the iron frame around the hole, and the cover with a
  // raised rim, a grid of grips and bolts round the edge, lit from above.
  // In the yard (`tilt`) it's nudged off its seat so its right edge peeks
  // up over the dark hole, with a note taped beside it (`note`).
  manhole(ctx, f) {
    const rx = (f.w * TILE) / 2, ry = (f.h * TILE) / 2;
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    const oval = (x, y, a, b) => {
      ctx.beginPath();
      ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
    };
    ctx.fillStyle = "rgba(20, 15, 10, 0.3)";
    oval(c.x, c.y + 2, rx + 5, ry + 3.5);
    ctx.fill();
    ctx.fillStyle = "#3c3b42"; // the frame, and the hole
    oval(c.x, c.y, rx + 2.5, ry + 2);
    ctx.fill();
    ctx.fillStyle = "#0b0a0e";
    oval(c.x, c.y, rx, ry);
    ctx.fill();
    ctx.save();
    if (f.tilt) {
      ctx.translate(c.x + 4, c.y - 1);
      ctx.rotate(-0.12);
    } else ctx.translate(c.x, c.y);
    const lift = f.tilt ? 3.5 : 1.5;
    ctx.fillStyle = "#1e1d23"; // the cover's thickness, showing where it's lifted
    oval(0, lift, rx, ry);
    ctx.fill();
    const iron = ctx.createRadialGradient(-rx * 0.35, -ry * 0.5, 1, 0, 0, rx * 1.1);
    iron.addColorStop(0, "#8e8e96");
    iron.addColorStop(1, "#4a4950");
    ctx.fillStyle = iron;
    oval(0, 0, rx, ry);
    ctx.fill();
    ctx.strokeStyle = "#1a191e"; // outline
    ctx.lineWidth = 1;
    ctx.stroke();
    // The raised rim: lit along the top, shaded along the bottom.
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(210, 210, 220, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.84, ry * 0.84, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = "rgba(20, 20, 26, 0.6)";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.84, ry * 0.84, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    // The grid of grips inside the rim: little raised squares.
    ctx.save();
    oval(0, 0, rx * 0.72, ry * 0.72);
    ctx.clip();
    for (let gx = -rx; gx < rx; gx += 4.2) {
      for (let gy = -ry; gy < ry; gy += 3.2) {
        ctx.fillStyle = "rgba(25, 25, 30, 0.55)";
        ctx.fillRect(gx + 0.6, gy + 0.6, 2.4, 1.8);
        ctx.fillStyle = "rgba(220, 220, 230, 0.3)";
        ctx.fillRect(gx, gy, 2.4, 0.8);
      }
    }
    ctx.restore();
    // Bolts round the edge.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, bx = Math.cos(a) * rx * 0.93, by = Math.sin(a) * ry * 0.92;
      ctx.fillStyle = "#26252b";
      ctx.fillRect(bx - 0.8, by - 0.4, 1.8, 1.6);
      ctx.fillStyle = "#b4b4bc";
      ctx.fillRect(bx - 0.8, by - 0.8, 1.2, 1);
    }
    ctx.restore();
    if (f.note) {
      // A scrap of paper taped on the ground beside the cover, the tape
      // reaching over its edge: "Moved. -R"
      ctx.save();
      ctx.translate(c.x - rx - 24, c.y + 4);
      ctx.rotate(-0.1);
      ctx.fillStyle = "rgba(20, 15, 10, 0.25)";
      ctx.fillRect(-15, -5, 31, 13);
      ctx.fillStyle = "#f4ecd8";
      ctx.fillRect(-16, -7, 31, 13);
      ctx.strokeStyle = "#b8a888";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-16, -7, 31, 13);
      ctx.fillStyle = "rgba(230, 220, 170, 0.85)"; // the tape
      ctx.fillRect(12, -5, 13, 4);
      ctx.fillStyle = "#3a2a20";
      ctx.font = "700 7px 'Quicksand', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.note, -0.5, 2.5);
      ctx.restore();
      ctx.textAlign = "left";
    }
  },

});
