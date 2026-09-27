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

  // Beyond the alley: dusky rooftops against the sky, and shadow.
  const sky = ctx.createLinearGradient(0, top, 0, a.y - BRICK_WALL_PX);
  sky.addColorStop(0, "#8fa7bd");
  sky.addColorStop(1, "#c7cfd2");
  ctx.fillStyle = sky;
  ctx.fillRect(left - 20, top - 20, right - left + 40, a.y - top + 20);
  ctx.fillStyle = "#5d6470"; // far rooftops
  for (let i = 0; i < 14; i++) {
    const x = left + i * ((right - left) / 13) - 20, w = 50 + noise(i * 3.1 + 700) * 40, h = 20 + noise(i * 5.3 + 701) * 30;
    ctx.fillRect(x, a.y - BRICK_WALL_PX - h + 30, w, h + 40);
  }
  ctx.fillStyle = "#34323a";
  ctx.fillRect(left - 20, a.y - 60, right - left + 40, bottom - a.y + 80);

  paintCobbles(ctx, a.x, a.y, b.x, b.y);
  paintAlleyWalls(ctx, a, houseEnd, b);
  paintAlleyEnds(ctx, a, b);

  // The low brick ledge along the south side.
  const ledgeTop = b.y - 4;
  ctx.fillStyle = "#6e3e32";
  ctx.fillRect(a.x, ledgeTop, b.x - a.x, 16);
  ctx.fillStyle = "#8a5242";
  ctx.fillRect(a.x, ledgeTop - 6, b.x - a.x, 7);
  ctx.fillStyle = "rgba(255, 220, 190, 0.15)";
  ctx.fillRect(a.x, ledgeTop - 6, b.x - a.x, 1.5);
  ctx.fillStyle = "rgba(30, 15, 10, 0.35)";
  for (let x = a.x + 6; x < b.x; x += 22) ctx.fillRect(x, ledgeTop - 6, 1, 7);
  for (let x = a.x + 17; x < b.x; x += 22) ctx.fillRect(x, ledgeTop + 2, 1, 8);
  ctx.fillRect(a.x, ledgeTop + 1, b.x - a.x, 1);
  // Weeds poking up from the cracks along the ledge.
  for (let i = 0; i < 16; i++) {
    const x = a.x + 10 + noise(i * 7.7 + 720) * (b.x - a.x - 20);
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

// Wet cobblestones, a gutter down the middle with a drain, puddles, a
// trail of chalk paw prints from the hidden door to the raccoons, and a
// few bits of litter.
function paintCobbles(ctx, x0, y0, x1, y1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip(); // (the stones stop at the alley's edges)
  ctx.fillStyle = "#4a4852";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const stones = ["#6d6a72", "#76727a", "#646068", "#7c7470", "#6a6670"];
  let row = 0;
  for (let y = y0 + 2; y < y1 - 2; y += 11, row++) {
    for (let x = x0 - (row % 2) * 9; x < x1; x += 18) {
      const n = noise(row * 31.7 + x * 0.13 + 740);
      ctx.fillStyle = stones[Math.floor(n * stones.length)];
      roundRectPath(ctx, x + 1, y, 16, 9, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)"; // a wet sheen on top
      ctx.fillRect(x + 4, y + 1.5, 8, 1.5);
    }
  }
  // The gutter: a shallow channel of flat stones down the middle.
  const g = toScreen(0, ALLEY + 3.05).y;
  ctx.fillStyle = "rgba(25, 25, 35, 0.35)";
  ctx.fillRect(x0, g - 4, x1 - x0, 8);
  ctx.fillStyle = "rgba(140, 150, 170, 0.12)";
  ctx.fillRect(x0, g - 4, x1 - x0, 1);
  // A drain grate in it.
  const d = toScreen(7.6, ALLEY + 3.05);
  ctx.fillStyle = "#2a2a30";
  roundRectPath(ctx, d.x - 13, d.y - 6, 26, 12, 2);
  ctx.fill();
  ctx.fillStyle = "#55555e";
  for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 11 + i * 5, d.y - 4.5, 2.5, 9);
  // Puddles (their shine is drawn every frame, see drawAlleyLife).
  for (const p of ALLEY_PUDDLES) {
    const c = toScreen(p.x, p.y);
    ctx.fillStyle = "#3a3c4a";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, p.rx * TILE, p.ry * TILE, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 170, 190, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Chalk paw prints, from the hidden door over to the raccoons.
  ctx.fillStyle = "rgba(240, 236, 226, 0.4)";
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const gx = 2.0 + t * 6.3, gy = ALLEY + 0.95 + Math.sin(t * Math.PI) * 0.9 + t * 0.4;
    const p = toScreen(gx, gy + (i % 2 ? 0.12 : -0.12));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy] of [[-3, -3.5], [-1, -4.6], [1.4, -4.6], [3.4, -3.5]]) {
      ctx.beginPath();
      ctx.arc(p.x + dx, p.y + dy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Litter: a paper scrap, a bottle cap, a few leaves blown in.
  for (let i = 0; i < 12; i++) {
    const p = toScreen(0.4 + noise(i * 5.1 + 760) * (ALLEY_W - 0.8), ALLEY + 0.9 + noise(i * 2.7 + 761) * (ALLEY_H - 1.4));
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
  shade.addColorStop(0, "rgba(15, 10, 20, 0.4)");
  shade.addColorStop(1, "rgba(15, 10, 20, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(x0, y0, x1 - x0, 26);
  ctx.restore();
}

// Where the puddles lie (grid spots and sizes).
const ALLEY_PUDDLES = [
  { x: 8.4, y: ALLEY + 2.75, rx: 0.75, ry: 0.28 }, // under the neon sign: it shows pink in here
  { x: 3.9, y: ALLEY + 4.55, rx: 0.55, ry: 0.2 },
  { x: 10.6, y: ALLEY + 3.7, rx: 0.45, ry: 0.17 },
  { x: 1.3, y: ALLEY + 2.4, rx: 0.35, ry: 0.13 },
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
  const box = alleyFoot(5.05);
  ctx.fillStyle = "#8c9296";
  ctx.fillRect(box.x - 9, y - 58, 18, 22);
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.moveTo(box.x, y - 54);
  ctx.lineTo(box.x - 4, y - 46);
  ctx.lineTo(box.x + 4, y - 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(box.x - 1.5, y - 36, 3, 36); // its conduit, down to the ground
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

// The alley's two ends: a wooden fence (west) and a chain-link gate onto
// the street (east), with the street's lamplight beyond it.
function paintAlleyEnds(ctx, a, b) {
  const w = TILE * WALL_THICKNESS;
  // West: fence boards seen from above, with a loose one.
  ctx.fillStyle = "#6e5038";
  ctx.fillRect(a.x, a.y - 60, w, b.y - a.y + 60);
  ctx.fillStyle = "#86644a";
  for (let yy = a.y - 60; yy < b.y; yy += 12) ctx.fillRect(a.x + 2, yy, w - 4, 10);
  // East: the street beyond, lit by a lamp, then the chain-link gate.
  const ex = toScreen(ALLEY_W, 0).x;
  const glow = ctx.createRadialGradient(ex + 30, a.y + 60, 0, ex + 30, a.y + 60, 140);
  glow.addColorStop(0, "rgba(255, 210, 140, 0.45)");
  glow.addColorStop(1, "rgba(255, 210, 140, 0)");
  ctx.fillStyle = "#56555c";
  ctx.fillRect(ex, a.y - 60, 200, b.y - a.y + 80);
  ctx.fillStyle = glow;
  ctx.fillRect(ex, a.y - 80, 200, b.y - a.y + 160);
  ctx.strokeStyle = "rgba(190, 195, 200, 0.75)";
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
  // A padlock and a little sign on the gate.
  const mid = toScreen(ALLEY_W, ALLEY + 2.4).y;
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
  // The neon sign and its pink reflection in the puddle below.
  drawNeonSign(ctx, t);
  const p = ALLEY_PUDDLES[0], c = toScreen(p.x, p.y);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, p.rx * TILE - 2, p.ry * TILE - 1.5, 0, 0, Math.PI * 2);
  ctx.clip();
  const on = neonOn(t);
  ctx.fillStyle = `rgba(255, 110, 190, ${on ? 0.35 : 0.12})`;
  for (let i = 0; i < 4; i++) ctx.fillRect(c.x - 18 + Math.sin(t * 2 + i) * 2, c.y - 6 + i * 3, 30, 1.6);
  ctx.fillStyle = `rgba(120, 230, 220, ${on ? 0.3 : 0.1})`;
  ctx.fillRect(c.x + 6 + Math.sin(t * 1.7) * 2, c.y - 3, 10, 1.4);
  ctx.restore();
  // A glint on the other puddles, and rings when it rains.
  for (const q of ALLEY_PUDDLES) {
    const qc = toScreen(q.x, q.y);
    ctx.fillStyle = "rgba(220, 230, 255, 0.25)";
    ctx.fillRect(qc.x - q.rx * TILE * 0.4, qc.y - 1, q.rx * TILE * 0.5, 1.2);
    if (OUTDOORS.raining) {
      const ph = (t * 1.3 + q.x) % 1;
      ctx.strokeStyle = `rgba(220, 230, 255, ${0.5 * (1 - ph)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(qc.x + Math.sin(q.x * 9 + Math.floor(t * 1.3 + q.x)) * q.rx * TILE * 0.5, qc.y, 2 + ph * 8, 1 + ph * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
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
      ctx.fillStyle = `rgba(230, 230, 240, ${0.28 * Math.sin(ph * Math.PI)})`;
      ctx.beginPath();
      ctx.arc(mc.x + Math.sin(t * 0.8 + i * 2) * 6 * ph, mc.y - 4 - ph * 46, 5 + ph * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The neon's "N" flickers now and then (it's not a good sign. or it is).
function neonOn(t) {
  const s = t % 7;
  return !(s > 5.2 && s < 5.9 && Math.sin(t * 40) > -0.2);
}

// A raccoon face in teal over "OPEN" in pink, on the bricks above the raccoons.
function drawNeonSign(ctx, t) {
  const p = alleyFoot(8.85), y = p.y - 62;
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

// Over everything: the string lights along the walls (their bulbs glow
// warmer as it gets dark), and the neon's pink haze.
function drawAlleyOverhead(ctx, level) {
  const y = alleyFoot(0).y;
  const t = performance.now() / 1000;
  const strands = [
    [alleyFoot(-0.3).x, y - HOUSE_WALL_PX + 6, alleyFoot(HOUSE_SIDE_W - 0.1).x, y - HOUSE_WALL_PX + 6, 10],
    [alleyFoot(HOUSE_SIDE_W + 0.1).x, y - 112, alleyFoot(ALLEY_W + 0.3).x, y - 112, 16],
  ];
  for (const [x0, y0, x1, y1, sag] of strands) {
    const n = Math.round((x1 - x0) / 22);
    ctx.strokeStyle = "#2e2a26";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u + Math.sin(u * Math.PI * Math.max(1, Math.round(n / 5))) ** 2 * sag;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u + Math.sin(u * Math.PI * Math.max(1, Math.round(n / 5))) ** 2 * sag + 3;
      const warm = ["255, 205, 120", "255, 170, 110", "255, 225, 160"][i % 3];
      const tw = 0.85 + 0.15 * Math.sin(t * 2 + i * 1.9);
      if (level > 0.05) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, 14);
        g.addColorStop(0, `rgba(${warm}, ${0.5 * level * tw})`);
        g.addColorStop(1, `rgba(${warm}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(px - 14, py - 14, 28, 28);
      }
      ctx.fillStyle = `rgba(${warm}, ${0.75 + 0.25 * level})`;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The neon's glow on the bricks and cobbles around it.
  const p = alleyFoot(8.85);
  const on = neonOn(t);
  const haze = ctx.createRadialGradient(p.x, p.y - 60, 0, p.x, p.y - 60, 120);
  haze.addColorStop(0, `rgba(255, 90, 180, ${(on ? 0.22 : 0.08) * (0.4 + 0.6 * level)})`);
  haze.addColorStop(1, "rgba(255, 90, 180, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = haze;
  ctx.fillRect(p.x - 120, p.y - 180, 240, 240);
  ctx.restore();
}

// Warm (and pink) lights in the alley at night: [x, y (grid), radius, strength, color].
function alleyGlows() {
  const glows = [];
  for (const f of FURNITURE) {
    if (floorOf(f.y) !== ALLEY_FLOOR) continue;
    if (f.kind === "cagedLamp") glows.push([f.x, f.y - 0.9, 80, 1]);
    if (f.kind === "cableSpool") glows.push([f.x + f.w / 2, f.y, 45, 0.8]); // (the candle)
    if (f.kind === "alleyDoor" && HIDDEN_DOOR.open.alley > 0.05) glows.push([f.x + f.w / 2, f.y + 0.2, 60, HIDDEN_DOOR.open.alley]);
  }
  glows.push([5.75, ALLEY - 2.5, 40, 0.5]); // the lit window
  glows.push([ALLEY_W + 0.7, ALLEY + 1.2, 110, 0.9]); // the street lamp past the gate
  return glows;
}

// --- The alley's furniture ---
Object.assign(FURNITURE_DRAWERS, {
  // The hidden door, from the alley: a plain door in the house's siding
  // with no handle, just a little paw print scratched by the hinge. It
  // swings in (open) to show the warm hallway.
  alleyDoor(ctx, f) {
    const a = toScreen(f.x, f.y), w = f.w * TILE, h = 56;
    const open = HIDDEN_DOOR.open.alley;
    // A worn concrete step in front of it.
    ctx.fillStyle = "rgba(20, 15, 20, 0.3)";
    ctx.fillRect(a.x - 6, a.y + 2, w + 12, 9);
    ctx.fillStyle = "#8e8a86";
    ctx.fillRect(a.x - 6, a.y - 1, w + 12, 9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(a.x - 6, a.y - 1, w + 12, 1.5);
    ctx.fillStyle = "#4e3422"; // frame
    ctx.fillRect(a.x - 3, a.y - h - 3, w + 6, h + 3);
    if (open > 0) {
      const g = ctx.createLinearGradient(0, a.y - h, 0, a.y);
      g.addColorStop(0, "#f2d49a");
      g.addColorStop(1, "#d8a868");
      ctx.fillStyle = g;
      ctx.fillRect(a.x, a.y - h, w, h);
      ctx.fillStyle = "rgba(255, 220, 150, 0.25)"; // light spilling out
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + w, a.y);
      ctx.lineTo(a.x + w + 10 * open, a.y + 22 * open);
      ctx.lineTo(a.x - 10 * open, a.y + 22 * open);
      ctx.closePath();
      ctx.fill();
    }
    // The door leaf itself, narrowing as it swings in on its left hinge.
    const lw = w * (1 - open * 0.85);
    ctx.fillStyle = "#8a6848";
    ctx.fillRect(a.x, a.y - h, lw, h);
    ctx.fillStyle = "rgba(60, 35, 15, 0.25)";
    for (let yy = a.y - h + 6; yy < a.y - 2; yy += 7) ctx.fillRect(a.x, yy, lw, 1.5);
    ctx.fillStyle = "rgba(255, 235, 200, 0.15)"; // light catching its top edge
    ctx.fillRect(a.x, a.y - h, lw, 2);
    if (open < 0.2) {
      // A little paw print, low by the edge.
      ctx.fillStyle = "rgba(60, 40, 25, 0.55)";
      const px = a.x + w - 9, py = a.y - 12;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [dx, dy] of [[-2.4, -2.6], [-0.8, -3.4], [0.9, -3.4], [2.5, -2.6]]) ctx.fillRect(px + dx - 0.6, py + dy - 0.6, 1.2, 1.2);
    }
    ctx.fillStyle = "rgba(40, 20, 10, 0.3)";
    ctx.fillRect(a.x - 3, a.y - 3, w + 6, 3);
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

  // A plastic milk crate turned over for a seat (sit on it).
  milkCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 13, "#4a78a0");
    ctx.fillStyle = "rgba(20, 30, 50, 0.4)";
    for (let i = 0; i < 3; i++) ctx.fillRect(box.face.x + 3 + i * ((box.face.w - 6) / 3), box.face.y + 3, (box.face.w - 6) / 3 - 2, 6);
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

  // A round iron manhole cover set in the cobbles (steam: drawAlleyLife).
  manhole(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    ctx.fillStyle = "#2e2c34";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, (f.w * TILE) / 2, (f.h * TILE) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#55535c";
    ctx.lineWidth = 1.2;
    for (const k of [0.8, 0.55, 0.3]) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, (f.w * TILE * k) / 2, (f.h * TILE * k) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(c.x - (f.w * TILE) / 2.6, c.y);
    ctx.lineTo(c.x + (f.w * TILE) / 2.6, c.y);
    ctx.stroke();
  },

  // The hidden door, from the hallway: the wall panel under the crooked
  // hills painting. Shut, you'd only spot two faint seams and a scuff at
  // the bottom; it swings open (away from you) onto the alley's night.
  hiddenPanel(ctx, f) {
    const a = toScreen(f.x, f.y), w = f.w * TILE, h = WALL_HEIGHT;
    const open = HIDDEN_DOOR.open.hall;
    if (open > 0) {
      const g = ctx.createLinearGradient(0, a.y - h, 0, a.y);
      g.addColorStop(0, "#1e2236");
      g.addColorStop(1, "#3a2a44");
      ctx.fillStyle = g;
      ctx.fillRect(a.x, a.y - h, w, h);
      ctx.fillStyle = "rgba(255, 110, 190, 0.35)"; // a hint of neon from out there
      ctx.fillRect(a.x + w * 0.55, a.y - h + 6, 6, h - 10);
      ctx.fillStyle = "rgba(160, 110, 200, 0.2)"; // and on the floor
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + w, a.y);
      ctx.lineTo(a.x + w + 8 * open, a.y + 20 * open);
      ctx.lineTo(a.x - 8 * open, a.y + 20 * open);
      ctx.closePath();
      ctx.fill();
      // The panel itself, swinging away on its right-hand hinge.
      const lw = w * (1 - open * 0.85);
      ctx.fillStyle = "#b08a60";
      ctx.fillRect(a.x + w - lw, a.y - h, lw, h);
      ctx.fillStyle = WOOD_DARK;
      ctx.fillRect(a.x + w - lw, a.y - 5, lw, 5);
      return;
    }
    // Shut: faint seams, and a scuff low down where it's been pushed.
    ctx.fillStyle = "rgba(40, 25, 10, 0.3)";
    ctx.fillRect(a.x, a.y - h + 2, 1, h - 2);
    ctx.fillRect(a.x + w - 1, a.y - h + 2, 1, h - 2);
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    ctx.beginPath();
    ctx.ellipse(a.x + w * 0.35, a.y - 8, 6, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },
});
