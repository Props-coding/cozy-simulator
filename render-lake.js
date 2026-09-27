// How Willow Lake looks (the bus trip, see "Willow Lake" in world.js).
// The ground (grass, the forest floor under the pines, sandy banks, the
// water with its depth, the island, lily pads, the paths and the road) is
// painted once, like the yard's; the moving parts (ripples, glints, the
// sun or moon on the water, foam at the shore, fish shadows, fireflies
// and dragonflies) are drawn every frame; and the pier, the platform, the
// rowboats, Otis's bait shack, benches, lamp posts, the picnic table and
// the lake's sign are furniture drawings. Light comes from above, like
// everywhere else: lighter tops, darker bases, soft shadows underneath.

// The water's outline (a tiny wobble so it doesn't look drawn with a
// compass), as screen points. It stays within a hair of the real oval, so
// it matches where you can walk.
function lakeOutline(grow = 0, wobble = 1) {
  const w = LAKE_WATER, c = toScreen(w.cx, w.cy);
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const k = 1 + wobble * (0.006 * Math.sin(a * 3 + 1.3) + 0.004 * Math.sin(a * 7 + 0.4));
    pts.push([c.x + Math.cos(a) * (w.rx + grow) * TILE * k, c.y + Math.sin(a) * (w.ry + grow) * TILE * k]);
  }
  return pts;
}
function tracePoints(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// An oval gradient centered on the lake (radial, squashed to its shape).
function lakeGradient(ctx, stops) {
  const w = LAKE_WATER, c = toScreen(w.cx, w.cy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w.rx * TILE);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return { g, c, sy: w.ry / w.rx };
}
function fillLakeGradient(ctx, pts, stops) {
  const { g, c, sy } = lakeGradient(ctx, stops);
  ctx.save();
  tracePoints(ctx, pts);
  ctx.clip();
  ctx.translate(c.x, c.y);
  ctx.scale(1, sy);
  ctx.fillStyle = g;
  ctx.fillRect(-2000, -2000, 4000, 4000);
  ctx.restore();
}

// Lily pads on the water: [x, y (lake spots), size, flower color or null].
const LILY_PADS = [
  [3.2, -0.2, 1, "#f4b6cc"], [3.7, 0.3, 0.8, null], [2.8, 0.5, 0.7, null], [8.2, -3.4, 0.9, "#fbf6ee"], [8.9, -3.2, 0.7, null],
  [15.6, -2.3, 1, null], [16.1, -1.8, 0.8, "#f4b6cc"], [15.2, -1.6, 0.6, null], [16.8, 0.9, 0.8, null], [7.1, 2.0, 0.7, "#fbf6ee"], [6.6, 2.4, 0.9, null],
];

function paintLakeGround(ctx) {
  const { left, right, top, bottom } = houseBounds();
  const season = yardSeason();
  const g = GRASS[season] ?? GRASS.summer;
  // Grass everywhere, with tufts and the odd flower.
  ctx.fillStyle = g.ground;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const W = right - left, H = bottom - top;
  for (let i = 0; i < (W * H) / 480; i++) {
    const x = left + noise(i * 1.3 + 400) * W, y = top + noise(i * 2.9 + 405) * H;
    ctx.strokeStyle = noise(i + 411) > 0.5 ? g.dark : g.light;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
    if (noise(i + 423) > 0.96 && season !== "winter") {
      ctx.fillStyle = noise(i + 431) > 0.5 ? "#f7f1e6" : "#c9a8e8";
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The forest floor under the pines: darker, with needles and cones,
  // fading into the grass.
  const forestBottom = toScreen(0, LAKE - 4.7).y;
  const forest = ctx.createLinearGradient(0, top, 0, forestBottom + 30);
  forest.addColorStop(0, season === "winter" ? "#dfe6e8" : "#3a5a3a");
  forest.addColorStop(0.75, season === "winter" ? "#e6ecee" : "#4f7449");
  forest.addColorStop(1, "rgba(79, 116, 73, 0)");
  ctx.fillStyle = forest;
  ctx.fillRect(left - 20, top - 20, W + 40, forestBottom - top + 50);
  for (let i = 0; i < 160; i++) {
    const x = left + noise(i * 7.1 + 500) * W, y = top + noise(i * 3.3 + 501) * (forestBottom - top);
    ctx.strokeStyle = season === "winter" ? "rgba(160, 170, 175, 0.5)" : "rgba(150, 110, 60, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3 + noise(i) * 3, y + 1.5);
    ctx.stroke();
    if (i % 9 === 0) {
      ctx.fillStyle = "#7a5230";
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 1.6, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The paths and the road (under the sand, so the pier path meets the beach).
  paintPaths(ctx, LAKE_PATHS, LAKE);
  paintStreet(ctx, LAKE);

  // Sandy banks: a wide pale band, then darker wet sand at the water.
  tracePoints(ctx, lakeOutline(0.75, 2.2));
  ctx.fillStyle = season === "winter" ? "#e4e0d6" : "#dcc79c";
  ctx.fill();
  ctx.fillStyle = "rgba(150, 120, 80, 0.3)";
  for (let i = 0; i < 90; i++) {
    const a = noise(i * 5.3 + 600) * Math.PI * 2, r = 1 + 0.06 + noise(i * 2.2 + 601) * 0.06;
    const c = toScreen(LAKE_WATER.cx + Math.cos(a) * LAKE_WATER.rx * r, LAKE_WATER.cy + Math.sin(a) * LAKE_WATER.ry * r);
    ctx.fillRect(c.x, c.y, 1.6, 1.6);
  }
  tracePoints(ctx, lakeOutline(0.22, 1.4));
  ctx.fillStyle = season === "winter" ? "#c9c6bd" : "#b9a277";
  ctx.fill();

  // The water: clear and pale at the shallows, deep blue in the middle.
  const water = lakeOutline(0, 1);
  fillLakeGradient(ctx, water, season === "winter"
    ? [[0, "#4a7a94"], [0.55, "#6a98ae"], [0.86, "#8fb8c6"], [1, "#b8d4dc"]]
    : [[0, "#245d80"], [0.45, "#2f7196"], [0.78, "#4f97b2"], [0.93, "#79bcc4"], [1, "#9fd2c8"]]);
  // Stones and sand ripples seen through the shallows.
  ctx.save();
  tracePoints(ctx, water);
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const a = noise(i * 4.7 + 700) * Math.PI * 2, r = 0.8 + noise(i * 1.9 + 701) * 0.16;
    const c = toScreen(LAKE_WATER.cx + Math.cos(a) * LAKE_WATER.rx * r, LAKE_WATER.cy + Math.sin(a) * LAKE_WATER.ry * r);
    ctx.fillStyle = "rgba(60, 90, 90, 0.22)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 4 + noise(i) * 5, 2.5 + noise(i + 1) * 2, noise(i + 2) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Soft light patterns (caustics) in the shallows.
  ctx.strokeStyle = "rgba(220, 245, 240, 0.16)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) {
    const a = noise(i * 3.1 + 800) * Math.PI * 2, r = 0.7 + noise(i * 6.1 + 801) * 0.26;
    const c = toScreen(LAKE_WATER.cx + Math.cos(a) * LAKE_WATER.rx * r, LAKE_WATER.cy + Math.sin(a) * LAKE_WATER.ry * r);
    ctx.beginPath();
    ctx.moveTo(c.x - 6, c.y);
    ctx.quadraticCurveTo(c.x - 2, c.y - 3, c.x + 2, c.y);
    ctx.quadraticCurveTo(c.x + 5, c.y + 2, c.x + 8, c.y - 1);
    ctx.stroke();
  }
  ctx.restore();
  // A thin bright edge where the water meets the sand, lit from above.
  tracePoints(ctx, water);
  ctx.strokeStyle = "rgba(240, 250, 245, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Winter: ice at the edges.
  if (season === "winter") {
    tracePoints(ctx, lakeOutline(-0.35, 1));
    ctx.strokeStyle = "rgba(240, 248, 252, 0.7)";
    ctx.lineWidth = 12;
    ctx.stroke();
  }

  // The island: a sandy ring, then a grassy hump, lighter on top.
  const is = LAKE_ISLAND, ic = toScreen(is.cx, is.cy);
  ctx.fillStyle = "rgba(20, 50, 70, 0.25)"; // its shadow in the water
  ctx.beginPath();
  ctx.ellipse(ic.x, ic.y + 5, is.rx * TILE + 6, is.ry * TILE + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = season === "winter" ? "#e4e0d6" : "#dcc79c";
  ctx.beginPath();
  ctx.ellipse(ic.x, ic.y, is.rx * TILE + 4, is.ry * TILE + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const hump = ctx.createRadialGradient(ic.x - 8, ic.y - 10, 4, ic.x, ic.y, is.rx * TILE);
  hump.addColorStop(0, season === "winter" ? "#ffffff" : g.light);
  hump.addColorStop(1, season === "winter" ? "#d6dde0" : g.ground);
  ctx.fillStyle = hump;
  ctx.beginPath();
  ctx.ellipse(ic.x, ic.y - 2, is.rx * TILE - 6, is.ry * TILE - 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-30, 10], [26, 8]]) {
    ctx.fillStyle = "#a8a298";
    ctx.beginPath();
    ctx.ellipse(ic.x + dx, ic.y + dy, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lily pads (not in winter), each with its notch, some with a flower.
  if (season !== "winter") {
    for (const [x, y, size, flower] of LILY_PADS) {
      const p = toScreen(x, LAKE + y), r = 7 * size;
      ctx.fillStyle = "rgba(20, 50, 60, 0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + 1, p.y + 2, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5f9a4a";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0.35, Math.PI * 2 - 0.1);
      ctx.lineTo(p.x, p.y);
      ctx.fill();
      ctx.strokeStyle = "rgba(160, 210, 120, 0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - r * 0.7, p.y - r * 0.2);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - r * 0.2, p.y + r * 0.45);
      ctx.stroke();
      if (flower) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.fillStyle = flower;
          ctx.beginPath();
          ctx.ellipse(p.x + 2 + Math.cos(a) * 2.6, p.y - 2 + Math.sin(a) * 1.8, 2.2, 1.4, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#f2d24a";
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y - 2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- The water, every frame ---
function drawLakeShimmer(ctx) {
  const t = performance.now() / 1000;
  const w = LAKE_WATER, c = toScreen(w.cx, w.cy);
  const rx = w.rx * TILE, ry = w.ry * TILE;
  const water = lakeOutline(0, 1);
  const winter = yardSeason() === "winter";
  const night = outdoorNightLevel();
  ctx.save();
  tracePoints(ctx, water);
  ctx.clip();
  // Slow wave lines drifting across.
  ctx.strokeStyle = `rgba(230, 245, 250, ${winter ? 0.08 : 0.14})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const y = c.y - ry + ((i / 14) * 2 * ry + t * 6) % (2 * ry);
    const x = c.x - rx + noise(i * 3.3 + 900) * rx * 2 + Math.sin(t * 0.4 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.quadraticCurveTo(x - 8, y - 3, x, y);
    ctx.quadraticCurveTo(x + 10, y + 3, x + 24, y);
    ctx.stroke();
  }
  // Ripple rings.
  for (let i = 0; i < 12; i++) {
    const cycle = t * 0.3 + noise(i * 4.1 + 910);
    const phase = cycle % 1, round = Math.floor(cycle);
    const a = noise(i * 2.3 + round * 5.7 + 911) * Math.PI * 2, r = Math.sqrt(noise(i * 7.9 + round * 3.3 + 912)) * 0.9;
    const x = c.x + Math.cos(a) * rx * r, y = c.y + Math.sin(a) * ry * r;
    ctx.strokeStyle = `rgba(230, 245, 250, ${0.4 * (1 - phase)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + phase * 12, 1 + phase * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The sun (or the moon) on the water: a shimmering path of light.
  const clear = OUTDOORS.clouds < 0.7 && !OUTDOORS.rain && OUTDOORS.sky !== "fog";
  if (clear && !winter) {
    const moon = night > 0.5;
    const sx = c.x + rx * 0.35, top = c.y - ry * 0.95;
    for (let i = 0; i < 22; i++) {
      const k = i / 22, y = top + k * ry * 1.4;
      const width = 6 + k * 26, flick = Math.sin(t * 3 + i * 1.7);
      if (flick < -0.2) continue;
      ctx.fillStyle = moon ? `rgba(230, 235, 255, ${0.35 * (1 - k) * (0.5 + flick / 2)})` : `rgba(255, 250, 215, ${0.4 * (1 - k) * (0.5 + flick / 2)})`;
      ctx.fillRect(sx - width / 2 + Math.sin(t + i) * 4, y, width * (0.4 + 0.6 * noise(i + Math.floor(t * 2))), 1.6);
    }
  }
  // Sparkles.
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  for (let i = 0; i < 24; i++) {
    if (Math.sin(t * 2.2 + i * 1.9) < 0.7) continue;
    const a = noise(i * 9.1 + 920) * Math.PI * 2, r = Math.sqrt(noise(i * 3.7 + 921)) * 0.9;
    ctx.fillRect(c.x + Math.cos(a) * rx * r, c.y + Math.sin(a) * ry * r, 4, 1.2);
  }
  ctx.restore();
  // Foam lapping at the shore: soft white arcs that come and go.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1;
    const phase = (t * 0.25 + noise(i * 2.1 + 930)) % 1;
    const inset = 0.08 + phase * 0.12;
    const p = toScreen(w.cx + Math.cos(a) * (w.rx - inset), w.cy + Math.sin(a) * (w.ry - inset));
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * Math.sin(phase * Math.PI)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12, 4, a + Math.PI / 2, -0.8, 0.8);
    ctx.stroke();
  }
  // Fish shadows (not under the island).
  const lake = waterById("lake");
  const locked = POND_VIEW.locked;
  for (const s of waterShadows(lake, Date.now())) {
    if (lake.islands.some((o) => inOval(o, s.x, s.y, 0.3))) continue;
    if (locked && locked.water === "lake" && locked.id === s.id) continue;
    drawFishShadow(ctx, s.x, s.y, s.angle, CONFIG.fishing.shadows[s.size].scale, t + s.id);
  }
  if (locked && locked.water === "lake") drawFishShadow(ctx, locked.x - 0.25, locked.y + 0.12, 0, CONFIG.fishing.shadows[locked.size].scale, t * 3);
  // By day in the warm months: a couple of dragonflies darting over the water.
  const season = yardSeason();
  if (night < 0.3 && (season === "summer" || season === "spring")) {
    for (let i = 0; i < 2; i++) {
      const k = t * 0.18 + i * 0.5;
      const x = w.cx + Math.sin(k * 2.3 + i) * w.rx * 0.8 + Math.sin(t * 7 + i) * 0.1;
      const y = w.cy + Math.cos(k * 1.7 + i * 2) * w.ry * 0.7;
      const p = toScreen(x, y);
      const hover = Math.sin(t * 40) * 0.6;
      ctx.fillStyle = "rgba(20, 40, 50, 0.18)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, 5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i ? "#3f8ab0" : "#4aa878";
      ctx.fillRect(p.x - 5, p.y - 1 + hover, 10, 1.8);
      ctx.fillStyle = "rgba(230, 245, 255, 0.7)";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(p.x - 1, p.y - 1 + hover + side * 2.4, 3.6, 1.2, side * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Fireflies over the grass and reeds at night (drawn in the light pass, so
// they glow through the dark).
function drawLakeFireflies(ctx, level) {
  if (level < 0.3 || yardSeason() === "winter") return;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    const hx = noise(i * 5.1 + 950) * HOUSE_WIDTH, hy = LAKE - 4.5 + noise(i * 2.7 + 951) * 13;
    if (inOval(LAKE_WATER, hx, hy, -0.6)) continue; // (over land and the water's edge only)
    const x = hx + Math.sin(t * 0.5 + i * 1.3) * 0.5, y = hy + Math.cos(t * 0.4 + i * 2.1) * 0.35;
    const blink = Math.max(0, Math.sin(t * (1.5 + noise(i) * 1.5) + i * 3));
    if (blink < 0.05) continue;
    const p = toScreen(x, y);
    const glow = ctx.createRadialGradient(p.x, p.y - 14, 0, p.x, p.y - 14, 9);
    glow.addColorStop(0, `rgba(230, 255, 140, ${0.85 * blink * level})`);
    glow.addColorStop(1, "rgba(200, 255, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- The lake's furniture ---
const PLANK = "#a8804f";
const plankShade = (i) => shadeColor(PLANK, Math.round((noise(i * 3.7) - 0.5) * 22));

// A standing wooden post (seen from the front): a darker side, a lighter
// top, a soft shadow at its foot. (x, y) is its foot, in screen pixels.
function drawPost(ctx, x, y, h, w = 5) {
  ctx.fillStyle = "rgba(20, 40, 50, 0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 1, w, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4a30";
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = "#553a24";
  ctx.fillRect(x + w / 2 - 1.5, y - h, 1.5, h);
  ctx.fillStyle = "#8a6440";
  ctx.beginPath();
  ctx.ellipse(x, y - h, w / 2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A life ring hanging on a post.
function drawLifeRing(ctx, x, y) {
  ctx.lineWidth = 3.4;
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = k % 2 ? "#f4f0e8" : "#d9504a";
    ctx.beginPath();
    ctx.arc(x, y, 6, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(60, 40, 30, 0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, 7.8, 0, Math.PI * 2);
  ctx.stroke();
}

Object.assign(FURNITURE_DRAWERS, {
  // The long pier: planks across it, posts down both sides into the water,
  // and its shadow on the water.
  lakePier(ctx, f) {
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "rgba(15, 40, 55, 0.3)";
    ctx.fillRect(a.x - 2, a.y + 6, b.x - a.x + 4, b.y - a.y);
    for (let y = a.y, i = 0; y < b.y; y += 7, i++) {
      ctx.fillStyle = plankShade(i + 40);
      ctx.fillRect(a.x, y, b.x - a.x, 6.2);
      ctx.fillStyle = "rgba(255, 240, 210, 0.18)";
      ctx.fillRect(a.x, y, b.x - a.x, 1);
      ctx.fillStyle = "rgba(60, 35, 15, 0.4)";
      ctx.fillRect(a.x, y + 6.2, b.x - a.x, 0.8);
      ctx.fillStyle = "rgba(60, 40, 25, 0.5)";
      ctx.fillRect(a.x + 3, y + 3, 1, 1);
      ctx.fillRect(b.x - 4, y + 3, 1, 1);
    }
    ctx.fillStyle = "#6b4a30";
    ctx.fillRect(a.x - 1.5, a.y, 2, b.y - a.y);
    ctx.fillRect(b.x - 0.5, a.y, 2, b.y - a.y);
    for (let y = a.y + 14; y < b.y - 6; y += 34) {
      drawPost(ctx, a.x - 1, y + 4, 9, 4.5);
      drawPost(ctx, b.x + 1, y + 4, 9, 4.5);
    }
  },

  // The platform at the end of the pier: a wide deck with corner posts, a
  // lantern, a life ring, a bucket and a coil of rope.
  lakePlatform(ctx, f) {
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "rgba(15, 40, 55, 0.3)";
    ctx.fillRect(a.x - 3, a.y + 7, b.x - a.x + 6, b.y - a.y);
    for (let x = a.x, i = 0; x < b.x; x += 8, i++) {
      ctx.fillStyle = plankShade(i + 70);
      ctx.fillRect(x, a.y, Math.min(7.2, b.x - x), b.y - a.y);
      ctx.fillStyle = "rgba(255, 240, 210, 0.16)";
      ctx.fillRect(x, a.y, 1, b.y - a.y);
      ctx.fillStyle = "rgba(60, 35, 15, 0.4)";
      ctx.fillRect(x + 7.2, a.y, 0.8, b.y - a.y);
    }
    // A thicker front edge (the deck's side, lit a little less).
    ctx.fillStyle = "#7a5638";
    ctx.fillRect(a.x - 1, b.y, b.x - a.x + 2, 4);
    ctx.fillStyle = "rgba(255, 240, 210, 0.2)";
    ctx.fillRect(a.x - 1, a.y - 1, b.x - a.x + 2, 1.5);
    for (const [x, y] of [[a.x, a.y + 4], [b.x, a.y + 4], [a.x, b.y + 3], [b.x, b.y + 3]]) drawPost(ctx, x, y, 12, 5);
    drawLifeRing(ctx, b.x + 6, a.y + 14);
    // A bucket and a coil of rope.
    ctx.fillStyle = "#8a929a";
    roundRectPath(ctx, a.x + 10, b.y - 16, 11, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#b8bec6";
    ctx.beginPath();
    ctx.ellipse(a.x + 15.5, b.y - 16, 5.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a86a";
    ctx.lineWidth = 2;
    for (const r of [6, 4, 2]) {
      ctx.beginPath();
      ctx.ellipse(b.x - 16, b.y - 10, r * 1.4, r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The lantern on the far corner post (it glows at night: see lakeGlows).
    const lx = a.x + 1, ly = a.y + 4 - 12;
    ctx.fillStyle = "#3a3a40";
    ctx.fillRect(lx - 1, ly - 10, 2, 10);
    ctx.fillStyle = "#2f2f34";
    roundRectPath(ctx, lx - 5, ly - 20, 10, 11, 2);
    ctx.fill();
    ctx.fillStyle = outdoorNightLevel() > 0.2 ? "#ffd98a" : "#e8dcc0";
    ctx.fillRect(lx - 3, ly - 18, 6, 7);
    ctx.fillStyle = "#3a3a40";
    ctx.beginPath();
    ctx.moveTo(lx - 6, ly - 20);
    ctx.lineTo(lx, ly - 25);
    ctx.lineTo(lx + 6, ly - 20);
    ctx.fill();
  },

  // A little wooden rowboat, tied up, bobbing gently, with its oars in.
  rowboat(ctx, f) {
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 1.4 + f.n * 2) * 1.3, roll = Math.sin(t * 1.1 + f.n) * 0.03;
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    const L = f.w * TILE / 2, B = 11;
    // Ripples round it, and its shadow in the water.
    ctx.strokeStyle = "rgba(230, 245, 250, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, L + 6 + Math.sin(t * 1.4 + f.n) * 2, B, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(15, 40, 55, 0.3)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 7, L, B * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(roll);
    // The hull: painted outside, wooden inside, pointed at the bow.
    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-L, -2);
      ctx.quadraticCurveTo(-L + 6, -B, 0, -B);
      ctx.quadraticCurveTo(L - 10, -B, L + 4, 0);
      ctx.quadraticCurveTo(L - 10, B, 0, B);
      ctx.quadraticCurveTo(-L + 6, B, -L, 2);
      ctx.closePath();
    };
    ctx.fillStyle = f.n ? "#3f7a9a" : "#c9574a";
    hull();
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 25, 20, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.scale(0.82, 0.7);
    hull();
    const inside = ctx.createLinearGradient(0, -B, 0, B);
    inside.addColorStop(0, "#c9a070");
    inside.addColorStop(1, "#9a7448");
    ctx.fillStyle = inside;
    ctx.fill();
    ctx.restore();
    // Seats and oars.
    ctx.fillStyle = "#7a5638";
    for (const x of [-L * 0.4, L * 0.2]) ctx.fillRect(x - 2.5, -B * 0.65, 5, B * 1.3);
    ctx.strokeStyle = "#8a6440";
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-4, side * 3);
      ctx.lineTo(L * 0.7, side * (B + 3));
      ctx.stroke();
      ctx.fillStyle = "#a8804f";
      ctx.beginPath();
      ctx.ellipse(L * 0.72, side * (B + 3), 4, 2, 0.4 * side, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(-L * 0.6, -B + 2, L, 1.2);
    ctx.restore();
    // The rope to the dock.
    ctx.strokeStyle = "rgba(200, 170, 110, 0.9)";
    ctx.lineWidth = 1;
    const toX = f.n ? toScreen(LAKE_PIER.x + LAKE_PIER.w, f.y).x : toScreen(LAKE_PLATFORM.x, f.y).x;
    ctx.beginPath();
    ctx.moveTo(c.x + (f.n ? -L : L), c.y + bob);
    ctx.quadraticCurveTo((c.x + toX) / 2, c.y + 8, toX, c.y - 2);
    ctx.stroke();
  },

  // Otis's bait shack: a little clapboard cabin with a blue shingle roof,
  // a "Bait & Tackle" sign, a lit window, a net on the wall, a hanging fish
  // sign and lobster-pot crates.
  baitShack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE, x = a.x, base = a.y;
    const wallH = 42, top = base - wallH;
    // Walls: clapboards, darker at the bottom.
    for (let i = 0, y = top; y < base; y += 6, i++) {
      ctx.fillStyle = shadeColor("#8a6444", -i * 3);
      ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = "rgba(255, 240, 210, 0.15)";
      ctx.fillRect(x, y, w, 1);
    }
    ctx.fillStyle = "#5c4030";
    ctx.fillRect(x, base - 3, w, 3);
    // The door and the window.
    ctx.fillStyle = "#5c4030";
    roundRectPath(ctx, x + w * 0.62, base - 32, 18, 32, 2);
    ctx.fill();
    ctx.fillStyle = "#6f5038";
    ctx.fillRect(x + w * 0.62 + 3, base - 29, 12, 12);
    ctx.fillStyle = "#e0b84a";
    ctx.beginPath();
    ctx.arc(x + w * 0.62 + 14, base - 15, 1.6, 0, Math.PI * 2);
    ctx.fill();
    const lit = outdoorNightLevel() > 0.2;
    ctx.fillStyle = "#4a3424";
    ctx.fillRect(x + 12, base - 30, 26, 18);
    ctx.fillStyle = lit ? "#ffd98a" : "#a8cfe0";
    ctx.fillRect(x + 14, base - 28, 22, 14);
    ctx.fillStyle = lit ? "rgba(255, 240, 200, 0.5)" : "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(x + 15, base - 27, 6, 3);
    ctx.fillStyle = "#4a3424";
    ctx.fillRect(x + 24.5, base - 28, 1.5, 14);
    ctx.fillRect(x + 14, base - 21.5, 22, 1.5);
    // A fishing net draped on the wall.
    ctx.strokeStyle = "rgba(230, 220, 190, 0.6)";
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 44 + k * 4, top + 6);
      ctx.lineTo(x + 40 + k * 4, top + 24);
      ctx.moveTo(x + 40, top + 8 + k * 4);
      ctx.lineTo(x + 62, top + 7 + k * 4);
      ctx.stroke();
    }
    // The roof: blue-grey shingles, lighter on top.
    const roofTop = top - 22;
    ctx.fillStyle = "#4a6a80";
    ctx.beginPath();
    ctx.moveTo(x - 8, top + 2);
    ctx.lineTo(x + w * 0.5, roofTop);
    ctx.lineTo(x + w + 8, top + 2);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let r = 0; r < 5; r++) {
      const y = roofTop + r * 5;
      ctx.fillStyle = r % 2 ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(x - 10, y, w + 20, 5);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, roofTop);
    ctx.lineTo(x + w * 0.5 - 16, roofTop + 10);
    ctx.lineTo(x + w * 0.5 + 16, roofTop + 10);
    ctx.fill();
    // The sign over the door.
    ctx.fillStyle = "#e8dcc0";
    roundRectPath(ctx, x + w / 2 - 34, top - 12, 68, 14, 3);
    ctx.fill();
    ctx.strokeStyle = "#6b4a2e";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#3f5a70";
    ctx.font = "800 8px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BAIT & TACKLE", x + w / 2, top - 2);
    ctx.textAlign = "left";
    // A wooden fish hanging from the corner, swinging a little.
    const swing = Math.sin(performance.now() / 900) * 0.12;
    ctx.save();
    ctx.translate(x + w + 2, top + 4);
    ctx.rotate(swing);
    ctx.strokeStyle = "#5c4030";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.fillStyle = "#e0883a";
    ctx.beginPath();
    ctx.ellipse(0, 13, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, 13);
    ctx.lineTo(12, 9);
    ctx.lineTo(12, 17);
    ctx.fill();
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath();
    ctx.arc(-4, 12, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // A park bench facing the water (so we see its back): iron legs, wooden
  // slats, and a soft shadow.
  parkBench(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, seatY = a.y + 2;
    // Seat slats (lit from above).
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = shadeColor("#a8804f", 10 - k * 8);
      ctx.fillRect(a.x + 2, seatY + k * 4, w - 4, 3.2);
    }
    // Iron legs.
    ctx.fillStyle = "#2f2f34";
    for (const x of [a.x + 5, b.x - 8]) {
      ctx.fillRect(x, seatY + 10, 3, b.y - seatY - 8);
      ctx.fillRect(x - 1, seatY - 12, 3, 24);
    }
    // The backrest, in front of the seat (it faces away from us).
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = shadeColor("#9a7448", 14 - k * 10);
      ctx.fillRect(a.x, seatY - 12 + k * 5.5, w, 4.2);
      ctx.fillStyle = "rgba(255, 240, 210, 0.2)";
      ctx.fillRect(a.x, seatY - 12 + k * 5.5, w, 0.8);
    }
  },

  // A black iron lamp post with a glass lantern on top (glows at night).
  lampPost(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#2f2f34";
    ctx.fillRect(b.x - 4, b.y - 6, 8, 6);
    ctx.fillRect(b.x - 1.5, b.y - 58, 3, 54);
    ctx.fillStyle = "#4a4a52";
    ctx.fillRect(b.x - 1.5, b.y - 58, 1, 54);
    const lit = outdoorNightLevel() > 0.2;
    ctx.fillStyle = "#2f2f34";
    ctx.beginPath();
    ctx.moveTo(b.x - 7, b.y - 60);
    ctx.lineTo(b.x + 7, b.y - 60);
    ctx.lineTo(b.x + 5, b.y - 76);
    ctx.lineTo(b.x - 5, b.y - 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = lit ? "#ffd98a" : "#e8e4d8";
    ctx.fillRect(b.x - 4.5, b.y - 74, 9, 12);
    ctx.fillStyle = "#2f2f34";
    ctx.fillRect(b.x - 0.5, b.y - 74, 1, 12);
    ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y - 76);
    ctx.lineTo(b.x, b.y - 83);
    ctx.lineTo(b.x + 8, b.y - 76);
    ctx.fill();
  },

  // A picnic table with its benches, a checked cloth and a basket.
  picnicTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    // The back bench, the table, then the front bench.
    const bench = (y) => {
      ctx.fillStyle = "#8a6440";
      ctx.fillRect(a.x - 4, y, w + 8, 5);
      ctx.fillStyle = "#a8804f";
      ctx.fillRect(a.x - 4, y - 2, w + 8, 3);
      ctx.fillStyle = "#6b4a30";
      ctx.fillRect(a.x + 2, y + 5, 3, 7);
      ctx.fillRect(b.x - 5, y + 5, 3, 7);
    };
    bench(a.y - 2);
    const top = a.y + 8;
    ctx.fillStyle = "#6b4a30";
    ctx.fillRect(a.x + 6, top + 10, 4, b.y - top - 6);
    ctx.fillRect(b.x - 10, top + 10, 4, b.y - top - 6);
    ctx.fillStyle = "#a8804f";
    ctx.fillRect(a.x, top, w, 12);
    // The checked cloth.
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x + 8, top - 1, w - 16, 14);
    ctx.clip();
    ctx.fillStyle = "#f4eee4";
    ctx.fillRect(a.x + 8, top - 1, w - 16, 14);
    ctx.fillStyle = "rgba(201, 87, 74, 0.8)";
    for (let x = a.x + 8, i = 0; x < b.x - 8; x += 5, i++) ctx.fillRect(x, top - 1, 2.5, 14);
    for (let y = top - 1; y < top + 13; y += 5) ctx.fillRect(a.x + 8, y, w - 16, 2.5);
    ctx.restore();
    // A basket with a loaf.
    ctx.fillStyle = "#b58a52";
    roundRectPath(ctx, a.x + w / 2 - 9, top - 7, 18, 10, 3);
    ctx.fill();
    ctx.strokeStyle = "#8a6438";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(a.x + w / 2, top - 7, 7, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#d9a05a";
    ctx.beginPath();
    ctx.ellipse(a.x + w / 2 + 2, top - 8, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    bench(b.y - 4);
  },

  // The lake's sign: a wide carved board on two posts, "Willow Lake" with
  // a little fish, and flowers at its feet.
  lakeSign(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    for (const x of [a.x + 12, a.x + w - 12]) drawPost(ctx, x, a.y, 34, 6);
    const top = a.y - 50;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    roundRectPath(ctx, a.x + 1, top + 3, w - 2, 26, 5);
    ctx.fill();
    const board = ctx.createLinearGradient(0, top, 0, top + 26);
    board.addColorStop(0, "#c9965e");
    board.addColorStop(1, "#9a6c3e");
    ctx.fillStyle = board;
    roundRectPath(ctx, a.x, top, w, 25, 5);
    ctx.fill();
    ctx.strokeStyle = "#6b4426";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 240, 210, 0.25)";
    ctx.fillRect(a.x + 5, top + 2, w - 10, 1.5);
    ctx.font = "800 12px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(60, 35, 15, 0.5)";
    ctx.fillText("Willow Lake", a.x + w / 2 + 6, top + 17.5);
    ctx.fillStyle = "#fbf1dc";
    ctx.fillText("Willow Lake", a.x + w / 2 + 6, top + 16.5);
    ctx.textAlign = "left";
    // A little carved fish.
    ctx.fillStyle = "#3f7a9a";
    ctx.beginPath();
    ctx.ellipse(a.x + 14, top + 12.5, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(a.x + 19, top + 12.5);
    ctx.lineTo(a.x + 23, top + 9.5);
    ctx.lineTo(a.x + 23, top + 15.5);
    ctx.fill();
    // Flowers at the posts' feet.
    if (yardSeason() !== "winter") {
      for (let i = 0; i < 8; i++) {
        const x = a.x + 6 + i * (w - 12) / 7, y = a.y - 2 - noise(i * 3.1) * 3;
        ctx.fillStyle = "#5f8a4a";
        ctx.fillRect(x - 0.5, y, 1, 5);
        ctx.fillStyle = ["#f2c94c", "#f4b6cc", "#fbf6ee", "#c9a8e8"][i % 4];
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
});

// Warm lights at the Lake at night: [x, y (grid), radius, strength].
function lakeGlows() {
  const glows = [];
  for (const f of FURNITURE) {
    if (floorOf(f.y) !== LAKE_FLOOR) continue;
    if (f.kind === "lampPost") glows.push([f.x + f.w / 2, f.y + f.h - 1.45, 75, 0.95]);
    if (f.kind === "lakePlatform") glows.push([f.x + 0.05, f.y - 0.25, 55, 0.8]);
    if (f.kind === "baitShack") glows.push([f.x + 0.55, f.y + f.h - 0.5, 50, 0.7]);
  }
  return glows;
}
