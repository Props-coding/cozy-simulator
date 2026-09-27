// How the residents look (Update 6): Clover the rabbit, the baker, and
// Mortimer the owl, the librarian. Where they are and what they're doing
// comes from residentState (world.js); this file only draws them, standing
// upright on the floor with a soft shadow, lit from above like everything
// else. Each is drawn from the front, or from behind while they face a
// counter or a shelf, and mirrored when walking left.

// Adds the residents who are on this floor to the list of things sorted
// and drawn by height on screen (see drawScene in render-scene.js).
function residentSprites(floor) {
  const out = [];
  for (const r of RESIDENTS) {
    const state = residentState(r);
    if (!state || floorOf(state.y) !== floor) continue;
    // Asleep on his perch, Mortimer sorts just in front of it.
    out.push({ sortY: state.y + (state.act === "perch" ? 0.2 : 0), draw: (ctx) => drawResident(ctx, r, state) });
  }
  return out;
}

function drawResident(ctx, r, state) {
  const at = toScreen(state.x, state.y);
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(at.x, at.y);
  if (r.kind === "rabbit") drawClover(ctx, state, t);
  else if (r.kind === "owl") drawMortimer(ctx, state, t);
  ctx.restore();
}

function residentShadow(ctx, w, alpha = 0.22) {
  ctx.fillStyle = `rgba(40, 25, 10, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Little puffs that drift up and fade (flour over the counter, steam from
// the stove). `n` puffs, each on its own cycle.
function drawPuffs(ctx, x, y, t, color, n = 4, spread = 10) {
  for (let i = 0; i < n; i++) {
    const k = (t * 0.6 + i / n) % 1;
    ctx.fillStyle = color.replace("A", String(0.55 * (1 - k)));
    ctx.beginPath();
    ctx.arc(x + Math.sin(i * 2.3 + t) * spread * 0.5, y - k * 18, 2 + k * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Clover the rabbit, the baker ---
// Cream fur, long ears (the right one flops over), a red polka-dot
// kerchief, and a flour-dusted apron. She hops as she walks, carries a
// bread basket in the yard, and stirs, bakes and washes up in the kitchen.
function drawClover(ctx, s, t) {
  const hop = s.moving ? Math.abs(Math.sin(t * 8)) * 4 : 0;
  const breathe = s.moving ? 0 : Math.sin(t * 2) * 0.6;
  residentShadow(ctx, 11 - hop * 0.6);
  const back = s.facing === "back";
  if (typeof s.facing === "number" && s.facing < 0) ctx.scale(-1, 1);
  const side = typeof s.facing === "number" && s.facing !== 0 ? 2.5 : 0; // face turned a little towards where she's going
  ctx.translate(0, -hop);
  const FUR = "#f1e6d6", FUR_DARK = "#d8c6ae", PINK = "#e9a9a4";
  const OUTLINE = "rgba(130, 100, 75, 0.4)"; // a soft edge, so her pale fur shows on light floors
  // Feet.
  ctx.fillStyle = FUR_DARK;
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.ellipse(dx + side, -1.5, 4.5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Body, lit from above.
  const body = ctx.createLinearGradient(0, -30, 0, -2);
  body.addColorStop(0, FUR);
  body.addColorStop(1, FUR_DARK);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -13 + breathe * 0.3, 10.5, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (back) {
    // Apron strings tied in a bow, and a cotton tail.
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(-10, -17, 20, 2.2);
    ctx.beginPath();
    ctx.ellipse(-3, -16, 3.2, 2, -0.4, 0, Math.PI * 2);
    ctx.ellipse(3, -16, 3.2, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -6, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Apron, dusted with flour.
    ctx.fillStyle = "#f7f3ea";
    roundRectPath(ctx, -7 + side, -21, 14, 17, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 185, 160, 0.6)";
    ctx.fillRect(-4 + side, -13, 8, 4); // pocket
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (const [dx, dy] of [[-4, -18], [3, -10], [-1, -7], [5, -16]]) ctx.fillRect(dx + side, dy, 1.4, 1.4);
  }
  // Head.
  const hy = -30 + breathe;
  // Ears (behind the head): the left one tall, the right one flopped over.
  const earWiggle = Math.sin(t * 1.7) * 0.06;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  for (const [ex, tilt, len] of [[-3.5, -0.12 + earWiggle, 11], [3.5, 0.9, 9]]) {
    ctx.save();
    ctx.translate(ex + side * 0.6, hy - 7);
    ctx.rotate(tilt);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, -len, 3.6, len, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!back) {
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.ellipse(0, -len, 1.8, len - 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = FUR;
  ctx.beginPath();
  ctx.arc(side * 0.6, hy, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The kerchief: a red band with white dots, knotted at the back.
  ctx.fillStyle = "#c9574a";
  ctx.beginPath();
  ctx.ellipse(side * 0.6, hy - 5, 9.2, 3.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-9 + side * 0.6, hy - 5.5, 18.4, 2.2);
  ctx.fillStyle = "#f7efe6";
  for (const dx of [-5, 0, 5]) ctx.fillRect(dx + side * 0.6, hy - 6.5, 1.3, 1.3);
  if (back) {
    // The knot at the back, with two little tails.
    ctx.fillStyle = "#b44a3e";
    ctx.beginPath();
    ctx.arc(0, hy - 3.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.5, hy - 3);
    ctx.lineTo(-4, hy + 3);
    ctx.lineTo(-1.5, hy + 3.5);
    ctx.closePath();
    ctx.moveTo(0.5, hy - 3);
    ctx.lineTo(4, hy + 2.5);
    ctx.lineTo(1.5, hy + 3.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Face.
    const fx = side;
    const blink = t % 4.7 < 0.13;
    ctx.fillStyle = "#3a2a24";
    if (blink) {
      ctx.fillRect(fx - 4.5, hy - 0.5, 3, 1);
      ctx.fillRect(fx + 1.5, hy - 0.5, 3, 1);
    } else {
      ctx.beginPath();
      ctx.arc(fx - 3, hy, 1.5, 0, Math.PI * 2);
      ctx.arc(fx + 3, hy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fx - 3.4, hy - 0.9, 0.9, 0.9);
      ctx.fillRect(fx + 2.6, hy - 0.9, 0.9, 0.9);
    }
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.ellipse(fx, hy + 3, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6a5a";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(fx - 1.5, hy + 5);
    ctx.quadraticCurveTo(fx, hy + 6.2, fx, hy + 4.2);
    ctx.quadraticCurveTo(fx, hy + 6.2, fx + 1.5, hy + 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(230, 120, 120, 0.4)";
    ctx.beginPath();
    ctx.arc(fx - 5.5, hy + 3, 1.9, 0, Math.PI * 2);
    ctx.arc(fx + 5.5, hy + 3, 1.9, 0, Math.PI * 2);
    ctx.fill();
    // Whiskers.
    ctx.strokeStyle = "rgba(120, 100, 90, 0.45)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const dir of [-1, 1]) {
      ctx.moveTo(fx + dir * 2.5, hy + 3.5);
      ctx.lineTo(fx + dir * 9, hy + 2.5);
      ctx.moveTo(fx + dir * 2.5, hy + 4);
      ctx.lineTo(fx + dir * 9, hy + 5);
    }
    ctx.stroke();
  }
  // Paws, and what she's holding.
  ctx.fillStyle = FUR;
  for (const dx of [-9, 9]) {
    ctx.beginPath();
    ctx.arc(dx + (back ? 0 : side), -14, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.act === "stir") {
    // A mixing bowl held in front, and a wooden spoon going round.
    const a = t * 4;
    ctx.strokeStyle = "#b58a52";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 3.5, -16 + Math.sin(a) * 1.2);
    ctx.lineTo(Math.cos(a) * 1.5 + 2, -25);
    ctx.stroke();
    const bowl = ctx.createLinearGradient(0, -15, 0, -8);
    bowl.addColorStop(0, "#9cc2d8");
    bowl.addColorStop(1, "#6f9ab4");
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.lineTo(8, -15);
    ctx.quadraticCurveTo(7, -8, 0, -8);
    ctx.quadraticCurveTo(-7, -8, -8, -15);
    ctx.fill();
    ctx.fillStyle = "#f2e2c4";
    ctx.beginPath();
    ctx.ellipse(0, -15, 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(-6, -14, 3, 1.2);
    drawPuffs(ctx, 0, -18, t, "rgba(255, 255, 255, A)", 3, 12);
  }
  if (s.act === "bake") drawPuffs(ctx, 0, -30, t, "rgba(240, 235, 225, A)", 4, 16);
  if (s.act === "wash") drawPuffs(ctx, 0, -20, t * 1.4, "rgba(220, 235, 245, A)", 3, 12);
  if (floorOf(s.y) === YARD_FLOOR && !back) {
    // A little basket of bread rolls on her arm.
    ctx.fillStyle = "#b58a52";
    roundRectPath(ctx, 6, -16, 11, 7, 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6438";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(11.5, -16, 5, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#d9a05a";
    for (const dx of [8.5, 12, 15]) {
      ctx.beginPath();
      ctx.ellipse(dx, -16.5, 2.4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2ead8";
    ctx.fillRect(6.5, -15.5, 10, 1.6); // a napkin peeking out
  }
}

// --- Mortimer the owl, the librarian ---
// Round and brown, with ear tufts, a pale face disc, big eyes behind round
// brass spectacles, and a tiny red bow tie. He glides between stops (wings
// out, just off the floor), reads at the table, and reaches up to the
// shelves. By day he's asleep on his perch.
function drawMortimer(ctx, s, t) {
  const perched = s.act === "perch";
  const lift = s.moving ? 7 + Math.sin(t * 9) * 1.5 : perched ? 19 : 0;
  if (!perched) residentShadow(ctx, s.moving ? 9 : 10, s.moving ? 0.14 : 0.22); // (on the perch, its shadow is enough)
  const back = s.facing === "back";
  if (typeof s.facing === "number" && s.facing < 0) ctx.scale(-1, 1);
  ctx.translate(0, -lift);
  const BROWN = "#a07a52", BROWN_DARK = "#7a5a3c", CREAM = "#f0e4c8";
  const puff = s.asleep ? 1.08 : 1; // fluffed up while he sleeps
  // Wings: spread and flapping in flight, folded at his sides otherwise.
  const flap = s.moving ? Math.sin(t * 9) * 0.5 : 0;
  ctx.fillStyle = BROWN_DARK;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 9, -16);
    ctx.rotate(dir * (s.moving ? 1.1 + flap : 0.15));
    ctx.beginPath();
    ctx.ellipse(0, 3, 4.5, s.moving ? 11 : 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Feet (tucked in flight).
  if (!s.moving) {
    ctx.fillStyle = "#d9973a";
    for (const dx of [-4, 4]) {
      ctx.beginPath();
      ctx.ellipse(dx, -1, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Body, lit from above.
  const body = ctx.createLinearGradient(0, -32, 0, -2);
  body.addColorStop(0, "#b48c62");
  body.addColorStop(1, BROWN_DARK);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -16, 11.5 * puff, 15 * puff, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ear tufts.
  ctx.fillStyle = BROWN;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3, -28);
    ctx.lineTo(dir * 9, -35);
    ctx.lineTo(dir * 8.5, -26);
    ctx.fill();
  }
  if (back) {
    // Feathers on his back, in little scallops.
    ctx.strokeStyle = "rgba(60, 40, 25, 0.35)";
    ctx.lineWidth = 1;
    for (const [dx, dy] of [[-4, -20], [4, -20], [0, -15], [-5, -10], [5, -10], [0, -6]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    // Reaching up to a shelf with a book.
    if (s.act === "shelve") {
      const reach = Math.sin(t * 1.3) > 0 ? -4 : 0;
      ctx.fillStyle = BROWN_DARK;
      ctx.beginPath();
      ctx.ellipse(9, -30 + reach, 3.5, 7, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ["#7a4a6a", "#4a6a8a", "#8a5a3a"][Math.floor(t / 4) % 3];
      ctx.fillRect(8, -42 + reach, 6, 8);
    }
    return;
  }
  // Belly with little chevron marks.
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.ellipse(0, -11, 7.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(138, 106, 74, 0.55)";
  ctx.lineWidth = 0.9;
  for (const [dx, dy] of [[-3, -13], [3, -13], [0, -9], [-3, -5], [3, -5]]) {
    ctx.beginPath();
    ctx.moveTo(dx - 1.5, dy - 1);
    ctx.lineTo(dx, dy);
    ctx.lineTo(dx + 1.5, dy - 1);
    ctx.stroke();
  }
  // Face disc: two pale circles.
  ctx.fillStyle = "#e6cfa4";
  ctx.beginPath();
  ctx.arc(-4.2, -24, 5.2, 0, Math.PI * 2);
  ctx.arc(4.2, -24, 5.2, 0, Math.PI * 2);
  ctx.fill();
  // Eyes: big and round, or closed (asleep, blinking, or reading).
  const blink = t % 5.3 < 0.14;
  const closed = s.asleep || blink;
  const down = s.act === "read" ? 1.2 : 0; // looking down at his book
  if (closed) {
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 1.2;
    for (const dx of [-4.2, 4.2]) {
      ctx.beginPath();
      ctx.arc(dx, -24, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    for (const dx of [-4.2, 4.2]) {
      ctx.fillStyle = "#fff8e0";
      ctx.beginPath();
      ctx.arc(dx, -24, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0a030";
      ctx.beginPath();
      ctx.arc(dx, -24 + down, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a120a";
      ctx.beginPath();
      ctx.arc(dx, -24 + down, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(dx - 1.2, -25.6 + down, 0.9, 0.9);
    }
  }
  // Round brass spectacles.
  ctx.strokeStyle = "#c9a040";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-4.2, -24, 4.2, 0, Math.PI * 2);
  ctx.moveTo(8.4, -24);
  ctx.arc(4.2, -24, 4.2, 0, Math.PI * 2);
  ctx.moveTo(-0.6, -24.5);
  ctx.lineTo(0.6, -24.5);
  ctx.stroke();
  // Beak.
  ctx.fillStyle = "#d9973a";
  ctx.beginPath();
  ctx.moveTo(-1.6, -21.5);
  ctx.lineTo(1.6, -21.5);
  ctx.lineTo(0, -18.5);
  ctx.fill();
  // A tiny red bow tie.
  ctx.fillStyle = "#b8443a";
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(-4, -19);
  ctx.lineTo(-4, -15);
  ctx.closePath();
  ctx.moveTo(0, -17);
  ctx.lineTo(4, -19);
  ctx.lineTo(4, -15);
  ctx.closePath();
  ctx.fill();
  // Reading: an open book held in front.
  if (s.act === "read") {
    ctx.fillStyle = "#6a4a3a";
    ctx.fillRect(-8, -13, 16, 8);
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(-7.2, -12.4, 6.8, 6.6);
    ctx.fillRect(0.4, -12.4, 6.8, 6.6);
    ctx.fillStyle = "rgba(90, 70, 50, 0.4)";
    for (const y of [-11, -9.4, -7.8]) {
      ctx.fillRect(-6.4, y, 5.2, 0.6);
      ctx.fillRect(1.2, y, 5.2, 0.6);
    }
    // A page turns now and then.
    if (t % 6 < 0.5) {
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(0.4, -12.4, 6.8 * (1 - (t % 6) / 0.5), 6.6);
    }
  }
  // Asleep: Z's drifting up.
  if (s.asleep) {
    ctx.fillStyle = "rgba(90, 100, 140, 0.8)";
    ctx.font = "bold 8px Quicksand, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.35 + i / 2) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.fillText("z", 10 + k * 8, -34 - k * 14);
    }
    ctx.globalAlpha = 1;
  }
}

// Mortimer's perch: a wooden T-stand on a round base, with a little brass
// plate. He sleeps up on the bar through the day.
FURNITURE_DRAWERS.owlPerch = (ctx, f) => {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const b = toScreen(f.x + f.w / 2, f.y + f.h);
  const x = b.x, y = b.y;
  ctx.fillStyle = "#5c4530";
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const pole = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
  pole.addColorStop(0, "#6a4e36");
  pole.addColorStop(1, "#8a6a4a");
  ctx.fillStyle = pole;
  ctx.fillRect(x - 2, y - 25, 4, 23);
  ctx.fillStyle = "#7a5c3e";
  roundRectPath(ctx, x - 13, y - 27, 26, 4, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(x - 12, y - 27, 24, 1);
  ctx.fillStyle = "#c9a040";
  ctx.fillRect(x - 3, y - 12, 6, 3);
};
