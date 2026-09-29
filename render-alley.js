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

  paintAlleyStreet(ctx, a, b, left - 20);
  paintCobbles(ctx, alleyFoot(ALLEY_CURB).x, a.y, b.x, b.y);
  paintPuddles(ctx);
  paintAlleyWalls(ctx, alleyFoot(ALLEY_CURB), houseEnd, b);
  paintAlleyEnds(ctx, a, b);

  // The low brick ledge along the south side.
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

// Where the road's curb is (grid x). The sidewalk runs from it to the
// striped barrier at the alley's mouth (ALLEY_CURB, world.js).
const STREET_CURB = 0.4;

// The street past the alley's west end: asphalt (a little lighter than the
// dark around it) with grit, patches and cracks, a dashed line, the gutter
// with its storm drain, a raised curb, and a narrow concrete sidewalk up to
// the barrier. (The streetlight is furniture; its light is drawn in
// drawAlleyOverhead.)
function paintAlleyStreet(ctx, a, b, left) {
  const curb = alleyFoot(STREET_CURB).x, walkEnd = alleyFoot(ALLEY_CURB).x;
  const top = a.y - 80, bottom = b.y + 50, h = bottom - top;
  ctx.fillStyle = "#3b3a44";
  ctx.fillRect(left, top, curb - left, h);
  // Darker tar patches, then grit.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "rgba(10, 10, 14, 0.22)";
    roundRectPath(ctx, left + noise(i * 2.7 + 950) * (curb - left - 40), top + noise(i * 3.9 + 951) * h, 22 + noise(i + 952) * 26, 12 + noise(i + 953) * 14, 5);
    ctx.fill();
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = i % 3 ? "rgba(0, 0, 0, 0.18)" : "rgba(255, 255, 255, 0.07)";
    ctx.fillRect(left + noise(i * 3.3 + 900) * (curb - left), top + noise(i * 5.1 + 901) * h, 1.5, 1.5);
  }
  // Cracks: thin dark lines that wander, with a little branch.
  ctx.strokeStyle = "rgba(8, 8, 12, 0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = left + 10 + noise(i * 7.1 + 960) * (curb - left - 20), y = top + noise(i * 4.3 + 961) * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (noise(i * 9 + k * 1.7 + 962) - 0.5) * 16;
      y += 5 + noise(i * 5 + k * 2.3 + 963) * 8;
      ctx.lineTo(x, y);
      if (k === 2) {
        ctx.lineTo(x + 7, y + 4);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  // A dashed center line, worn.
  const lx = left + (curb - left) * 0.42;
  for (let y = top + 4; y < bottom; y += 26) {
    ctx.fillStyle = "rgba(230, 190, 70, 0.5)";
    ctx.fillRect(lx, y, 3, 14);
    ctx.fillStyle = "rgba(45, 44, 52, 0.6)";
    ctx.fillRect(lx + 1, y + 3 + noise(y) * 6, 2, 2);
  }
  // The gutter: darker and damp along the curb.
  const gutter = ctx.createLinearGradient(curb - 16, 0, curb, 0);
  gutter.addColorStop(0, "rgba(10, 10, 16, 0)");
  gutter.addColorStop(1, "rgba(10, 10, 16, 0.4)");
  ctx.fillStyle = gutter;
  ctx.fillRect(curb - 16, top, 16, h);
  // The storm drain, set in the gutter against the curb.
  const d = toScreen(STREET_CURB - 0.14, ALLEY + 2.3);
  ctx.fillStyle = "#121216";
  roundRectPath(ctx, d.x - 6, d.y - 15, 12, 30, 2);
  ctx.fill();
  ctx.strokeStyle = "#55555d";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#4a4a52";
  for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 4, d.y - 12 + i * 5.5, 8, 2.2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 4, d.y - 12 + i * 5.5, 8, 0.8);
  // The sidewalk: concrete slabs, with joints across and a little grit.
  ctx.fillStyle = "#6a6872";
  ctx.fillRect(curb, top, walkEnd - curb, h);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(curb + noise(i * 2.1 + 970) * (walkEnd - curb), top + noise(i * 3.7 + 971) * h, 1.5, 1.5);
  }
  for (let y = top + 10; y < bottom; y += 34) {
    ctx.fillStyle = "rgba(20, 18, 26, 0.45)";
    ctx.fillRect(curb, y, walkEnd - curb, 1.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(curb, y + 1.5, walkEnd - curb, 1);
  }
  // The curb: a pale stone edge, raised, lit on top, with a shadow on the road.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(curb - 9, top, 3, h);
  ctx.fillStyle = "#8a8682";
  ctx.fillRect(curb - 6, top, 7, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fillRect(curb - 6, top, 2, h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  for (let y = top + 20; y < bottom; y += 40) ctx.fillRect(curb - 6, y, 7, 1);
  // (Fading into the dark at its top and bottom: it's only a glimpse.)
  for (const [y0, y1] of [[top, top + 60], [bottom, bottom - 60]]) {
    const fade = ctx.createLinearGradient(0, y0, 0, y1);
    fade.addColorStop(0, "#15131b");
    fade.addColorStop(1, "rgba(21, 19, 27, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(left, Math.min(y0, y1), walkEnd - left, 60);
  }
}

// Wet cobblestones, paw prints from the dumpster to Reginald's door, and a
// few bits of litter. (The puddles: paintPuddles.)
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

// The puddles, only in the low spots: in the gutter along the curb, by
// the storm drain, under the house's drainpipe, and in front of the
// dumpster. Irregular blobs in a few sizes (x, y: the middle; rx, ry: how
// far they spread; seed: their shape), and what each one reflects (the sky
// tint always, plus "street" for the streetlight, "string" for the string
// lights, and "neon").
const ALLEY_PUDDLES = [
  { x: STREET_CURB - 0.22, y: ALLEY + 1.0, rx: 0.2, ry: 0.42, seed: 1, lights: ["street"] },
  { x: STREET_CURB - 0.3, y: ALLEY + 2.85, rx: 0.34, ry: 0.22, seed: 2, lights: ["street"] },
  { x: HOUSE_SIDE_W + 0.12, y: ALLEY + 0.9, rx: 0.4, ry: 0.16, seed: 3, lights: ["string"] },
  { x: 10.4, y: ALLEY + 1.08, rx: 0.52, ry: 0.19, seed: 4, lights: ["neon", "string"] },
  { x: 11.25, y: ALLEY + 1.3, rx: 0.2, ry: 0.09, seed: 5, lights: ["neon"] },
];

// A puddle's blobby outline (grow: pixels bigger or smaller all round).
function puddlePath(ctx, q, grow = 0) {
  const c = toScreen(q.x, q.y), n = 12;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 1 + (noise(q.seed * 13.1 + i * 1.7) - 0.5) * 0.55;
    pts.push([c.x + Math.cos(a) * (q.rx * TILE * r + grow), c.y + Math.sin(a) * (q.ry * TILE * r + grow)]);
  }
  ctx.beginPath();
  const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  ctx.moveTo(...mid(0));
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(pts[i % n][0], pts[i % n][1], ...mid(i));
  ctx.closePath();
}

// Painted once: damp darker ground around each puddle, the water (the
// dusk sky's tint, lighter at the far edge), and a lighter wet rim. The
// moving reflections and ripples: drawAlleyLife.
function paintPuddles(ctx) {
  for (const q of ALLEY_PUDDLES) {
    const c = toScreen(q.x, q.y);
    puddlePath(ctx, q, 3);
    ctx.fillStyle = "rgba(10, 8, 16, 0.22)";
    ctx.fill();
    puddlePath(ctx, q);
    const sky = ctx.createLinearGradient(0, c.y - q.ry * TILE, 0, c.y + q.ry * TILE);
    sky.addColorStop(0, "#3d3656");
    sky.addColorStop(1, "#1d1c28");
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.strokeStyle = "rgba(195, 200, 228, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

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
  paintAlleyFence(ctx, a, b);
}

// The east end: a chain-link fence like the yard's side fence (upright
// metal posts, a top rail, mesh panels between), with the alley carrying
// on darker behind it, barbed wire along the top, and a gate in the
// middle with a chain and the padlock (a way on, one day).
function paintAlleyFence(ctx, a, b) {
  const ex = toScreen(ALLEY_W, 0).x + 6, H = 46, half = 9; // (its line on the ground, its height, half its width)
  const y0 = a.y + 4, y1 = b.y - 4;
  // Behind it: the alley going on, darker, into the night.
  const beyond = ctx.createLinearGradient(ex, 0, ex + 100, 0);
  beyond.addColorStop(0, "#2c2a35");
  beyond.addColorStop(1, "#15131b");
  ctx.fillStyle = beyond;
  ctx.fillRect(ex - half, y0 - 150, 110, y1 - y0 + 160);
  ctx.fillStyle = "rgba(100, 96, 112, 0.22)";
  for (let yy = y0; yy < y1; yy += 11) for (let xx = ex + 4 + ((yy / 11) % 2) * 9; xx < ex + 80; xx += 18) {
    roundRectPath(ctx, xx, yy, 15, 8, 3);
    ctx.fill();
  }
  // A soft shadow on the ground along its foot.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(ex - half - 2, y0, half * 2 + 8, y1 - y0);
  // The mesh: see-through diamonds between the rails.
  const gateTop = toScreen(0, ALLEY + 1.1).y, gateBottom = toScreen(0, ALLEY + 2.25).y;
  const mesh = (from, to, alpha) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ex - half, from - H, half * 2, to - from + H);
    ctx.clip();
    ctx.strokeStyle = `rgba(196, 202, 214, ${alpha})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let yy = from - H - 20; yy < to; yy += 5) {
      ctx.moveTo(ex - half, yy);
      ctx.lineTo(ex + half, yy + 9);
      ctx.moveTo(ex + half, yy);
      ctx.lineTo(ex - half, yy + 9);
    }
    ctx.stroke();
    ctx.restore();
  };
  mesh(y0, gateTop - 3, 0.6);
  mesh(gateBottom + 3, y1, 0.6);
  // The rails: the top one and a lower one, down the length of it.
  for (const [x, dy] of [[ex - half, H], [ex + half - 3, H]]) {
    ctx.fillStyle = "#1c1b21";
    ctx.fillRect(x - 1, y0 - dy - 1, 5, y1 - y0 + 2);
    ctx.fillStyle = "#a0a6ae";
    ctx.fillRect(x, y0 - dy, 3, y1 - y0);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(x, y0 - dy, 1, y1 - y0);
  }
  // Posts: upright, with a dark outline, a lit left edge and a round cap.
  const post = (y, heavy) => {
    const w = heavy ? 7 : 6;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(ex, y + 1, w, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1b21";
    ctx.fillRect(ex - w / 2 - 1, y - H - 2, w + 2, H + 2);
    ctx.fillStyle = heavy ? "#7a8088" : "#8e949c";
    ctx.fillRect(ex - w / 2, y - H - 1, w, H + 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(ex + w / 2 - 2, y - H - 1, 2, H + 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(ex - w / 2, y - H - 1, 1.3, H + 1);
    ctx.fillStyle = "#1c1b21";
    ctx.beginPath();
    ctx.ellipse(ex, y - H - 2, w / 2 + 1.5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b4bac2";
    ctx.beginPath();
    ctx.ellipse(ex, y - H - 2.5, w / 2 + 0.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let y = y0; y <= y1 + 1; y += 44) if (y < gateTop - 10 || y > gateBottom + 10) post(y, false);
  // Barbed wire: a coil along the top, with barbs.
  ctx.strokeStyle = "rgba(160, 166, 176, 0.85)";
  ctx.lineWidth = 0.9;
  for (let y = y0 - 4; y < y1; y += 7) {
    ctx.beginPath();
    ctx.ellipse(ex, y - H - 9, 6, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#c8ccd4";
  for (let y = y0; y < y1; y += 12) ctx.fillRect(ex - 1, y - H - 14, 2, 2);
  // The gate: a framed panel with a brace, between two heavy posts, and a
  // chain with the padlock.
  ctx.fillStyle = "#1c1b21";
  ctx.fillRect(ex - half + 1, gateTop - H + 2, half * 2 - 2, gateBottom - gateTop);
  mesh(gateTop + 2, gateBottom - 2, 0.7);
  ctx.strokeStyle = "#8a9098";
  ctx.lineWidth = 2;
  ctx.strokeRect(ex - half + 2, gateTop - H + 3, half * 2 - 4, gateBottom - gateTop - 2);
  ctx.beginPath();
  ctx.moveTo(ex - half + 3, gateBottom - H);
  ctx.lineTo(ex + half - 3, gateTop - H + 5);
  ctx.stroke();
  post(gateTop, true);
  post(gateBottom, true);
  const lockY = gateBottom - H / 2 - 6;
  ctx.strokeStyle = "#a4a8b0";
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.ellipse(ex - 2 + (k % 2) * 3, lockY - 12 + k * 4, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#5a4418";
  roundRectPath(ctx, ex - 6, lockY + 4, 12, 10, 2);
  ctx.fill();
  ctx.fillStyle = "#d4ac4c";
  roundRectPath(ctx, ex - 5, lockY + 4, 10, 9, 1.5);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(ex - 4, lockY + 5, 2, 6);
  ctx.fillStyle = "#3a2a10";
  ctx.fillRect(ex - 0.6, lockY + 7, 1.2, 3.5);
  ctx.strokeStyle = "#c8a040";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(ex, lockY + 4, 3.4, Math.PI, 0);
  ctx.stroke();
}

// --- Every frame ---
function drawAlleyLife(ctx, players = []) {
  const t = performance.now() / 1000;
  const y = alleyFoot(0).y;
  // The TV behind the lit window, flickering blue and white.
  const win = alleyFoot(5.75);
  const flick = 0.25 + 0.2 * Math.sin(t * 7) * Math.sin(t * 2.3) + (Math.sin(t * 13) > 0.8 ? 0.15 : 0);
  ctx.fillStyle = `rgba(150, 190, 255, ${flick})`;
  ctx.fillRect(win.x - 8, y - 130, 16, 13);
  ctx.fillRect(win.x - 8, y - 115, 16, 13);
  drawNeonSign(ctx, t);
  drawPuddleLife(ctx, t, players);
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

// Each puddle mirrors what's near it (the streetlight's pale gold, the
// string lights' warm bulbs, the pink and teal neon), wobbling a little; a
// drip lands now and then (a ring spreading out), and anyone walking
// through splashes.
const alleySplashes = []; // { x, y, at } in screen pixels, and when
const lastStep = new Map(); // player id: when they last splashed
function drawPuddleLife(ctx, t, players) {
  const on = neonOn(t);
  const now = performance.now();
  for (const q of ALLEY_PUDDLES) {
    const c = toScreen(q.x, q.y), rx = q.rx * TILE, ry = q.ry * TILE;
    ctx.save();
    puddlePath(ctx, q, -1.5);
    ctx.clip();
    for (const light of q.lights) {
      if (light === "street") {
        const streak = ctx.createLinearGradient(0, c.y - ry, 0, c.y + ry); // a soft wobbly streak
        streak.addColorStop(0, "rgba(255, 228, 170, 0.5)");
        streak.addColorStop(1, "rgba(255, 228, 170, 0.08)");
        ctx.fillStyle = streak;
        ctx.beginPath();
        ctx.ellipse(c.x + Math.sin(t * 2) * 1.2, c.y, Math.min(4, rx * 0.4), ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (light === "string") {
        for (let i = 0; i < 4; i++) {
          const tw = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.9);
          ctx.fillStyle = `rgba(255, 205, 130, ${0.55 * tw})`;
          ctx.fillRect(c.x - rx * 0.6 + i * rx * 0.4 + Math.sin(t * 1.3 + i) * 0.8, c.y - ry * 0.35 + (i % 2) * 2, 2.2, 1.6);
        }
      } else if (light === "neon") {
        ctx.fillStyle = `rgba(255, 110, 190, ${on ? 0.45 : 0.12})`;
        for (let i = 0; i < 3; i++) ctx.fillRect(c.x - rx * 0.5 + Math.sin(t * 2 + i) * 2, c.y - ry * 0.5 + i * 3, rx * 0.9, 1.5);
        ctx.fillStyle = `rgba(120, 230, 220, ${on ? 0.4 : 0.12})`;
        ctx.fillRect(c.x + rx * 0.1 + Math.sin(t * 1.7) * 2, c.y - 1, rx * 0.4, 1.3);
      }
    }
    // A drip: every few seconds, a ring spreading out and fading.
    const every = 2.6 + noise(q.seed * 7.7) * 2.5, phase = (t + q.seed * 1.3) % every;
    if (phase < 1.1) {
      const k = Math.floor((t + q.seed * 1.3) / every);
      const dx = (noise(q.seed + k * 3.1) - 0.5) * rx * 1.1, dy = (noise(q.seed + k * 5.3) - 0.5) * ry * 1.1;
      ctx.strokeStyle = `rgba(210, 215, 240, ${0.55 * (1 - phase / 1.1)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(c.x + dx, c.y + dy, 1 + phase * 8, 0.5 + phase * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Splashes: whoever's walking with their feet in a puddle.
  for (const p of players) {
    if (!p.moving && p.moving !== undefined) continue;
    const fx = p.x + PLAYER_SIZE / 2, fy = p.y + PLAYER_SIZE * 0.85;
    const q = ALLEY_PUDDLES.find((w) => ((fx - w.x) / w.rx) ** 2 + ((fy - w.y) / w.ry) ** 2 < 1.2);
    if (!q || now - (lastStep.get(p.id ?? p.name) ?? 0) < 260) continue;
    const moved = lastStep.get((p.id ?? p.name) + ":at");
    lastStep.set((p.id ?? p.name) + ":at", fx + "," + fy);
    if (moved === fx + "," + fy) continue;
    lastStep.set(p.id ?? p.name, now);
    const at = toScreen(fx, fy);
    alleySplashes.push({ x: at.x, y: at.y, at: now });
  }
  while (alleySplashes.length && now - alleySplashes[0].at > 600) alleySplashes.shift();
  for (const sp of alleySplashes) {
    const k = (now - sp.at) / 600;
    ctx.strokeStyle = `rgba(215, 222, 245, ${0.7 * (1 - k)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, 3 + k * 12, 1.5 + k * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(215, 222, 245, ${0.8 * (1 - k)})`;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.2);
      ctx.fillRect(sp.x + Math.cos(a) * (4 + k * 10), sp.y - Math.sin(k * Math.PI) * 9 + Math.sin(a) * 2, 1.6, 1.6);
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

// Over everything: the string lights looped overhead between the walls
// (bright bulbs with a soft glow), the streetlight's cone on the road and
// sidewalk, a car's headlights passing now and then, and the neon's glow
// (kept close to its sign).
function drawAlleyOverhead(ctx, level) {
  const y = alleyFoot(0).y;
  const t = performance.now() / 1000;
  // Each strand: anchor points (x, y), with a swag drooping between each pair.
  const eave = y - HOUSE_WALL_PX + 6, brick = y - 116;
  const strands = [
    [[alleyFoot(ALLEY_CURB + 0.1).x, eave], [alleyFoot(2.4).x, eave], [alleyFoot(HOUSE_SIDE_W - 0.1).x, eave]],
    [[alleyFoot(HOUSE_SIDE_W - 0.1).x, eave], [alleyFoot(HOUSE_SIDE_W + 1.3).x, brick - 10]], // across, from the house's eave up to the bricks
    [[alleyFoot(HOUSE_SIDE_W + 1.3).x, brick - 10], [alleyFoot(7.3).x, brick], [alleyFoot(9.0).x, brick - 6], [alleyFoot(ALLEY_W - 0.1).x, brick]],
  ];
  for (const anchors of strands) {
    for (let s = 0; s < anchors.length - 1; s++) {
      const [x0, y0] = anchors[s], [x1, y1] = anchors[s + 1];
      const sag = 10 + Math.hypot(x1 - x0, y1 - y0) * 0.1;
      const at = (u) => ({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag });
      ctx.strokeStyle = "#2a2622";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = at(i / 30);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22));
      for (let i = 1; i < n; i++) {
        const p = at(i / n);
        const warm = ["255, 205, 120", "255, 170, 110", "255, 225, 160"][(i + s) % 3];
        const tw = 0.85 + 0.15 * Math.sin(t * 2 + i * 1.9 + s);
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
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // The streetlight: a cone from the lamp down to a pool on the road and
  // sidewalk.
  const lamp = FURNITURE.find((f) => f.kind === "streetLamp" && floorOf(f.y) === ALLEY_FLOOR);
  if (lamp) {
    const foot = toScreen(lamp.x + lamp.w / 2, lamp.y + lamp.h);
    const hx = foot.x - 22, hy = foot.y - 114, gy = foot.y + 6;
    const cone = ctx.createLinearGradient(0, hy, 0, gy);
    cone.addColorStop(0, "rgba(255, 228, 170, 0.22)");
    cone.addColorStop(1, "rgba(255, 228, 170, 0.04)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy);
    ctx.lineTo(hx + 6, hy);
    ctx.lineTo(hx + 44, gy);
    ctx.lineTo(hx - 44, gy);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(hx, gy);
    ctx.scale(1, 0.34);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
    pool.addColorStop(0, "rgba(255, 228, 170, 0.28)");
    pool.addColorStop(0.7, "rgba(255, 228, 170, 0.12)");
    pool.addColorStop(1, "rgba(255, 228, 170, 0)");
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Now and then a car goes by on the street: two headlights and their
  // beams sweeping down the road, brushing the sidewalk as they pass.
  const cycle = 13, drive = 2.4, k = (t % cycle) / drive;
  if (k < 1) {
    const curb = alleyFoot(STREET_CURB).x, left = houseBounds().left - 20;
    const top = alleyFoot(0).y - 140, bottom = toScreen(0, ALLEY + ALLEY_H).y + 120;
    const cy = top + (bottom - top) * k, lx = left + (curb - left) * 0.68;
    const beam = ctx.createLinearGradient(0, cy, 0, cy + 110);
    beam.addColorStop(0, "rgba(255, 245, 215, 0.3)");
    beam.addColorStop(1, "rgba(255, 245, 215, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - 10, cy);
    ctx.lineTo(lx + 10, cy);
    ctx.lineTo(lx + 36, cy + 110);
    ctx.lineTo(lx - 36, cy + 110);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 245, 215, 0.12)"; // brushing the sidewalk
    ctx.fillRect(curb, cy + 20, alleyFoot(ALLEY_CURB).x - curb, 60);
    for (const dx of [-8, 8]) {
      const g = ctx.createRadialGradient(lx + dx, cy, 0, lx + dx, cy, 9);
      g.addColorStop(0, "rgba(255, 250, 230, 0.95)");
      g.addColorStop(1, "rgba(255, 250, 230, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx + dx - 9, cy - 9, 18, 18);
    }
  }
  // The neon's glow: close around the sign, not over the raccoons.
  const p = alleyFoot(NEON_X);
  const haze = ctx.createRadialGradient(p.x, p.y - 70, 0, p.x, p.y - 70, 58);
  haze.addColorStop(0, `rgba(255, 90, 180, ${neonOn(t) ? 0.22 : 0.07})`);
  haze.addColorStop(1, "rgba(255, 90, 180, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(p.x - 58, p.y - 128, 116, 116);
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
    if (f.kind === "streetLamp") glows.push([f.x + f.w / 2 - 0.48, f.y + f.h + 0.1, 60, 0.75, "255, 225, 170"]);
  }
  glows.push([NEON_X + 0.1, ALLEY + 0.35, 42, neonOn(performance.now() / 1000) ? 0.55 : 0.2, "255, 90, 180"]);
  glows.push([5.75, ALLEY - 2.5, 40, 0.5]); // the lit window
  for (const [x, y] of [[2.0, 0.45], [3.6, 0.5], [5.4, 0.55], [6.9, 0.45], [10.6, 0.5], [11.5, 0.45]]) glows.push([x, ALLEY + y, 48, 0.4]); // under the string lights
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

  // The streetlight on the sidewalk: a tall pole with a lit left edge, an
  // arm reaching out over the road, and a lamp with a glowing lens (its
  // cone of light: drawAlleyOverhead).
  streetLamp(ctx, f) {
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#15161a"; // outline
    ctx.fillRect(b.x - 3.5, b.y - 121, 7, 121);
    ctx.fillRect(b.x - 27, b.y - 121, 27, 5);
    ctx.fillStyle = "#34363e";
    ctx.fillRect(b.x - 2.5, b.y - 120, 5, 120);
    ctx.fillRect(b.x - 26, b.y - 120, 26, 3); // the arm
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(b.x - 2.5, b.y - 120, 1.2, 120);
    ctx.fillStyle = "#2a2c32"; // the base
    ctx.fillRect(b.x - 5, b.y - 8, 10, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(b.x - 5, b.y - 8, 10, 1.2);
    ctx.fillStyle = "#3a3c44"; // the lamp head
    roundRectPath(ctx, b.x - 32, b.y - 122, 18, 7, 2);
    ctx.fill();
    ctx.fillStyle = "#fff0c8";
    ctx.fillRect(b.x - 30, b.y - 116, 14, 2.5);
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
