// Drawing the outdoors (Update 4): the yard's ground, its trees, fences,
// porch and pond, and daylight, dusk and night outside. Loaded right after
// render.js and uses its helpers (toScreen, drawShadow, drawBlock, noise
// and so on). The yard's layout itself is in world.js.

// --- The ground ---

// Is it autumn, winter...? (for the trees' leaves and the grass)
function yardSeason() {
  return currentSeason();
}

const GRASS = {
  spring: { ground: "#8fb86a", dark: "rgba(60, 110, 45, 0.45)", light: "rgba(190, 225, 140, 0.55)" },
  summer: { ground: "#93b06c", dark: "rgba(70, 110, 50, 0.45)", light: "rgba(180, 210, 130, 0.5)" },
  autumn: { ground: "#a3ad6a", dark: "rgba(110, 100, 45, 0.45)", light: "rgba(215, 200, 130, 0.5)" },
  winter: { ground: "#a7b394", dark: "rgba(90, 105, 85, 0.4)", light: "rgba(235, 240, 235, 0.6)" },
};

// --- The yard's paths (world.js: YARD_PATHS) ---
// Each path is a line of points, smoothed into gentle curves. They're
// painted in layers over every path at once, so where two meet they blend
// into one wider patch instead of two strips crossing: a soft band of
// trodden grass along the edges, then the path itself (a little wider
// here, narrower there), then its stones or dirt, then pebbles and grass
// tufts along the borders.

// Points every `step` grid units along a smooth curve through `points`
// (yard spots), as screen positions.
function pathSamples(points, step = 0.1, base = YARD) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out.map(([x, y]) => toScreen(x, base + y));
}

function paintPaths(ctx, list = YARD_PATHS, base = YARD) {
  const paths = list.map((path, n) => ({ ...path, n, at: pathSamples(path.points, 0.1, base) }));
  // How wide a path is at sample i: its width, give or take a little.
  const radius = (path, i) => (path.w * TILE * (1 + 0.07 * Math.sin(i * 0.23 + path.n * 2.1) + 0.04 * (noise(path.n * 31 + i) - 0.5))) / 2;
  // 1. Trodden grass along the edges (one stroke, so crossings don't darken).
  const edge = new Path2D();
  for (const path of paths) {
    edge.moveTo(path.at[0].x, path.at[0].y);
    for (const p of path.at) edge.lineTo(p.x, p.y);
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(205, 190, 130, 0.35)";
  ctx.lineWidth = 1.35 * TILE;
  ctx.stroke(edge);
  ctx.restore();
  // 2. The paths themselves, as packed earth (the stone walk's flagstones
  //    are laid on top of earth too, so the gaps between them look like soil).
  for (const path of paths) {
    ctx.fillStyle = path.stone ? "#b39873" : "#c9ab80";
    path.at.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius(path, i), 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // 3. Specks of grit in the dirt paths.
  for (const path of paths) {
    if (path.stone) continue;
    const seed = path.n * 101;
    path.at.forEach((p, i) => {
      const r = radius(path, i) * 0.8;
      for (let k = 0; k < 2; k++) {
        const a = noise(seed + i * 5 + k) * Math.PI * 2, d = Math.sqrt(noise(seed + i * 7 + k * 3)) * r;
        ctx.fillStyle = (i + k) % 3 ? "rgba(150, 120, 85, 0.45)" : "rgba(235, 220, 195, 0.65)";
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, 1.6, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  // 3b. Flagstones on the stone paths (after all the dirt, so no grit lands on them).
  for (const path of paths) if (path.stone) paintFlagstones(ctx, path);
  // 4. Along the borders: a few pebbles and tufts of grass.
  const g = GRASS[yardSeason()] ?? GRASS.summer;
  for (const path of paths) {
    if (path.stone) continue; // the flagstone walk has neat edges
    path.at.forEach((p, i) => {
      if (i % 5 || i === 0 || i === path.at.length - 1) return;
      const next = path.at[i + 1], prev = path.at[i - 1];
      const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
      const side = noise(path.n * 13 + i) > 0.5 ? 1 : -1;
      const r = radius(path, i) + 3;
      const x = p.x + (-dy / len) * r * side, y = p.y + (dx / len) * r * side;
      if (noise(path.n * 17 + i * 3) > 0.55) {
        ctx.fillStyle = "#a8a298";
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4, 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(x - 1.2, y - 1.2, 1.4, 0.8);
      } else {
        ctx.strokeStyle = g.dark;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 3, y + 1);
        ctx.lineTo(x - 1, y - 4);
        ctx.lineTo(x, y + 1);
        ctx.lineTo(x + 2, y - 3.5);
        ctx.lineTo(x + 3, y + 1);
        ctx.stroke();
      }
    });
  }
}

// A stone walk: flat flagstones laid in rows across the path, two to a row
// with the joint shifting from row to row (like bricks), slightly uneven
// shapes and colors, a thin earth gap between them, and a sliver of their
// thickness showing along the bottom (light from above, like everything).
function paintFlagstones(ctx, path) {
  // Walk the path by distance, so rows are evenly spaced.
  const pts = path.at, dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = dist[dist.length - 1];
  const rows = Math.max(2, Math.round(total / (0.5 * TILE)));
  const rowH = total / rows, half = (path.w * TILE) / 2, gap = 2.5;
  const colors = ["#cbc3b3", "#c2b9a8", "#d3ccbe", "#bdb3a1"];
  const seed = path.n * 211;
  for (let row = 0; row < rows; row++) {
    // Where this row sits, and which way the path runs there.
    const at = (row + 0.5) * rowH;
    let i = 1;
    while (i < pts.length - 1 && dist[i] < at) i++;
    const a = pts[i - 1], b = pts[i], t = (at - dist[i - 1]) / ((dist[i] - dist[i - 1]) || 1);
    const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len; // along the path
    const vx = -uy, vy = ux; // across it
    // The joint between the two stones: left of middle, then right, and so on.
    const split = (row % 2 ? 0.2 : -0.2) + (noise(seed + row * 7) - 0.5) * 0.16;
    const pieces = [[-1, split], [split, 1]];
    pieces.forEach(([from, to], k) => {
      const j = (n) => (noise(seed + row * 13 + k * 5 + n) - 0.5) * 3; // a little unevenness
      // Corners in (along, across) pixels, pulled in by the gap.
      const al0 = -rowH / 2 + gap / 2, al1 = rowH / 2 - gap / 2;
      const ac0 = from * half + (from === -1 ? 1 : gap / 2), ac1 = to * half - (to === 1 ? 1 : gap / 2);
      const corners = [[al0 + j(1), ac0 + j(2)], [al0 + j(3), ac1 + j(4)], [al1 + j(5), ac1 + j(6)], [al1 + j(7), ac0 + j(8)]]
        .map(([al, ac]) => ({ x: cx + ux * al + vx * ac, y: cy + uy * al + vy * ac }));
      // A rounded four-sided outline (dy moves it down, for the edge below).
      const shape = (dy) => {
        const mid = (n) => ({ x: (corners[n % 4].x + corners[(n + 1) % 4].x) / 2, y: (corners[n % 4].y + corners[(n + 1) % 4].y) / 2 + dy });
        ctx.beginPath();
        ctx.moveTo(mid(0).x, mid(0).y);
        for (let n = 1; n <= 4; n++) ctx.arcTo(corners[n % 4].x, corners[n % 4].y + dy, mid(n).x, mid(n).y, 4);
        ctx.closePath();
      };
      // Its thickness (a darker edge peeking out below), then the top.
      ctx.fillStyle = "#958b7a";
      shape(2);
      ctx.fill();
      const color = colors[Math.floor(noise(seed + row * 3 + k * 11) * colors.length)];
      ctx.fillStyle = color;
      shape(0);
      ctx.fill();
      // Lit from above: a soft light band along the top of the stone.
      ctx.save();
      shape(0);
      ctx.clip();
      const top = Math.min(...corners.map((c) => c.y)), bottom = Math.max(...corners.map((c) => c.y));
      const shade = ctx.createLinearGradient(0, top, 0, bottom);
      shade.addColorStop(0, "rgba(255, 255, 255, 0.28)");
      shade.addColorStop(0.35, "rgba(255, 255, 255, 0)");
      shade.addColorStop(1, "rgba(90, 75, 55, 0.12)");
      ctx.fillStyle = shade;
      ctx.fillRect(Math.min(...corners.map((c) => c.x)) - 2, top - 2, 80, bottom - top + 4);
      // A few tiny specks, so it reads as stone.
      for (let n = 0; n < 3; n++) {
        const px = cx + ux * (noise(seed + row * 17 + k * 3 + n) - 0.5) * rowH * 0.6 + vx * ((from + to) / 2 + (noise(seed + row * 19 + k + n * 2) - 0.5) * (to - from) * 0.6) * half;
        const py = cy + uy * (noise(seed + row * 17 + k * 3 + n) - 0.5) * rowH * 0.6 + vy * ((from + to) / 2 + (noise(seed + row * 19 + k + n * 2) - 0.5) * (to - from) * 0.6) * half;
        ctx.fillStyle = "rgba(110, 100, 85, 0.3)";
        ctx.fillRect(px, py, 1.5, 1.5);
      }
      ctx.restore();
    });
  }
}

// The pond: deep in the middle, lighter and sandy at the edge, with lily
// pads. (The ripples and sparkles that move are drawn every frame, in
// drawPondShimmer.)
function paintPond(ctx) {
  const c = toScreen(POND.cx, POND.cy);
  const rx = POND.rx * TILE, ry = POND.ry * TILE;
  ctx.fillStyle = "#c9b388"; // sandy bank
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx + 8, ry + 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const water = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, rx);
  water.addColorStop(0, "#3f7f9a");
  water.addColorStop(0.7, "#5a9ab2");
  water.addColorStop(1, "#7fb9c4");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx - 3, ry - 3, 0, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  // Lily pads, a couple with a pink flower.
  for (const [dx, dy, r, flower] of [[-60, -30, 8, true], [-40, 20, 6, false], [50, 35, 7, false], [20, -45, 6, true], [-95, 5, 5, false]]) {
    ctx.fillStyle = "#5f9a4a";
    ctx.beginPath();
    ctx.arc(c.x + dx, c.y + dy, r, 0.3, Math.PI * 2 - 0.1);
    ctx.lineTo(c.x + dx, c.y + dy);
    ctx.fill();
    if (flower) {
      ctx.fillStyle = "#f2a8c4";
      ctx.beginPath();
      ctx.arc(c.x + dx + 1, c.y + dy - 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The street along the bottom of the yard: a sidewalk, then the road with
// a dashed line down the middle.
function paintStreet(ctx, base = YARD) {
  const { left, right, bottom } = houseBounds();
  const walk = toScreen(0, base + 9.5).y, road = toScreen(0, base + 10.4).y;
  ctx.fillStyle = "#cfc8bb";
  ctx.fillRect(left - 20, walk, right - left + 40, road - walk);
  ctx.fillStyle = "rgba(120, 110, 95, 0.35)";
  for (let x = left - 20; x < right + 20; x += 34) ctx.fillRect(x, walk, 1.5, road - walk);
  ctx.fillStyle = "#9a948a"; // curb
  ctx.fillRect(left - 20, road - 4, right - left + 40, 4);
  ctx.fillStyle = "#5f5d63";
  ctx.fillRect(left - 20, road, right - left + 40, bottom - road + 30);
  ctx.fillStyle = "#e8d57a";
  const mid = road + (bottom - road) / 2 + 4;
  for (let x = left; x < right; x += 44) ctx.fillRect(x, mid, 22, 3);
}

// The whole yard floor, painted once (like the house's floors).
function paintYardGround(ctx) {
  const { left, right, top, bottom } = houseBounds();
  const g = GRASS[yardSeason()] ?? GRASS.summer;
  ctx.fillStyle = g.ground;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const w = right - left, h = bottom - top;
  for (let i = 0; i < (w * h) / 500; i++) {
    const x = left + noise(i * 1.7) * w, y = top + noise(i * 2.3 + 5) * h;
    ctx.strokeStyle = noise(i + 11) > 0.5 ? g.dark : g.light;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
    if (noise(i + 23) > 0.95 && yardSeason() !== "winter") {
      ctx.fillStyle = noise(i + 31) > 0.5 ? "#f7f1e6" : "#f2c94c";
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The campfire clearing: a round patch of packed earth.
  const fire = toScreen(4.4, YARD - 2.1);
  ctx.fillStyle = "rgba(170, 135, 90, 0.55)";
  ctx.beginPath();
  ctx.ellipse(fire.x, fire.y, 2.6 * TILE, 1.9 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150, 115, 75, 0.35)";
  ctx.beginPath();
  ctx.ellipse(fire.x, fire.y, 1.7 * TILE, 1.2 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  // The starter garden's soil bed, inside its fence.
  const g1 = toScreen(13.0, YARD - 1.2), g2 = toScreen(17.1, YARD + 4.4);
  ctx.fillStyle = "rgba(120, 150, 80, 0.35)";
  ctx.fillRect(g1.x, g1.y, g2.x - g1.x, g2.y - g1.y);
  paintPaths(ctx);
  paintPond(ctx);
  paintStreet(ctx);
}

// On the ground floor: a few stepping stones out from the front door (at
// the bottom of the elevator lobby) onto the lawn.
function paintFrontSteps(ctx) {
  if (viewFloor !== 0) return;
  for (const [x, y] of [[20.75, 7.55], [21.2, 8.25], [20.8, 8.95], [21.15, 9.65]]) {
    const p = toScreen(x, y);
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bdb4a4";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x - 2, p.y - 2, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Moving water ---
// Little ripple rings and sparkles drifting over the pond, drawn every
// frame (flat on the ground, under everything standing).
function drawPondShimmer(ctx) {
  if (viewFloor === LAKE_FLOOR) return drawLakeShimmer(ctx); // (render-lake.js)
  if (viewFloor === ALLEY_FLOOR) return drawAlleyLife(ctx); // (render-alley.js)
  if (viewFloor === FARM_FLOOR) return drawFarmLife(ctx); // (render-farm.js)
  if (viewFloor !== YARD_FLOOR) return;
  const t = performance.now() / 1000;
  const c = toScreen(POND.cx, POND.cy);
  const rx = POND.rx * TILE - 12, ry = POND.ry * TILE - 10;
  for (let i = 0; i < 7; i++) {
    const cycle = t * 0.35 + noise(i * 4.1);
    const phase = cycle % 1, round = Math.floor(cycle);
    const a = noise(i * 2.3 + round * 5.7) * Math.PI * 2, r = Math.sqrt(noise(i * 7.9 + round * 3.3));
    const x = c.x + Math.cos(a) * rx * r, y = c.y + Math.sin(a) * ry * r;
    ctx.strokeStyle = `rgba(230, 245, 250, ${0.45 * (1 - phase)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + phase * 10, 1 + phase * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawFishShadows(ctx);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 0; i < 12; i++) {
    const on = Math.sin(t * 2 + i * 1.7) > 0.6;
    if (!on) continue;
    const a = noise(i * 9.1) * Math.PI * 2, r = Math.sqrt(noise(i * 3.7));
    ctx.fillRect(c.x + Math.cos(a) * rx * r, c.y + Math.sin(a) * ry * r, 4, 1.2);
  }
}

// Faint fish shapes swimming in the pond (world.js: pondShadows), bigger
// for bigger fish. The one on your line waits at your bobber.
function drawFishShadows(ctx) {
  const now = Date.now();
  const locked = POND_VIEW.locked;
  const t = performance.now() / 1000;
  const mine = locked && locked.water !== "lake" ? locked : null; // (the Lake draws its own)
  for (const s of pondShadows(now)) {
    if (mine && mine.id === s.id) continue;
    drawFishShadow(ctx, s.x, s.y, s.angle, CONFIG.fishing.shadows[s.size].scale, t + s.id);
  }
  if (mine) drawFishShadow(ctx, locked.x - 0.25, locked.y + 0.12, 0, CONFIG.fishing.shadows[locked.size].scale, t * 3);
}

function drawFishShadow(ctx, x, y, angle, scale, wiggle) {
  const p = toScreen(x, y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale * 0.55); // (seen from above, a little flattened)
  ctx.fillStyle = "rgba(20, 45, 60, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const flick = Math.sin(wiggle * 6) * 3;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(-20, -5 + flick);
  ctx.lineTo(-20, 5 + flick);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Daylight and night ---
// Dusk and night settle over the yard as a soft blue tint, and anything
// with a warm light (windows, lanterns, and later the campfire) glows
// through it.
let nightLevel = null; // eases from 0 (day) to 1 (night) so dusk fades in
let lastNightTime = 0;

function outdoorNightLevel() {
  const now = performance.now();
  const target = isNightOutside() ? 1 : 0;
  if (nightLevel === null) nightLevel = target;
  const dt = Math.min(0.1, (now - lastNightTime) / 1000);
  lastNightTime = now;
  nightLevel += Math.sign(target - nightLevel) * Math.min(Math.abs(target - nightLevel), dt / 3);
  return nightLevel;
}

// Warm lights in the yard: [x, y (grid), radius (pixels), strength].
function yardGlows() {
  const glows = [];
  for (const f of FURNITURE) {
    if (floorOf(f.y) !== YARD_FLOOR) continue;
    if (f.kind === "houseWindow") glows.push([f.x + f.w / 2, f.y - 0.35, 50, 0.7]);
    if (f.kind === "porchLantern") glows.push([f.x, f.y - 0.4, 70, 0.9]);
    if (f.kind === "yardDoor") glows.push([f.x + f.w / 2, f.y + 0.1, 60, 0.8]);
    const glow = f.glow?.(f); // (like the campfire, when it's lit)
    if (glow) glows.push(glow);
  }
  return glows;
}

function drawOutdoorLight(ctx) {
  // (The back alley is always dusk, whatever the weather: darker, with its
  // own lights glowing, and no rain or haze.)
  const alley = viewFloor === ALLEY_FLOOR;
  const level = alley ? 0.85 : outdoorNightLevel();
  const { left, right, top, bottom } = houseBounds();
  const base = viewFloor * UPSTAIRS; // (the yard's, or the Lake's)
  const whole = [{ x: -WALL_THICKNESS - 2, y: base - 8, w: HOUSE_WIDTH + 4, h: 21 }];
  if (level <= 0.001) {
    drawOutsideWeather(ctx, whole);
    return;
  }
  ctx.fillStyle = alley ? "rgba(18, 12, 40, 0.58)" : `rgba(14, 22, 62, ${0.55 * level})`;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glows = viewFloor === LAKE_FLOOR ? lakeGlows() : viewFloor === ALLEY_FLOOR ? alleyGlows() : viewFloor === FARM_FLOOR ? farmGlows() : yardGlows();
  for (const [x, y, r, strength, color = "255, 185, 95"] of glows) {
    const p = toScreen(x, y);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(0, `rgba(${color}, ${0.55 * strength * level})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A few stars over the roof line (when the sky is clear enough).
  const starry = viewFloor !== ALLEY_FLOOR && OUTDOORS.clouds < 0.6 && !OUTDOORS.rain && !OUTDOORS.snow && OUTDOORS.sky !== "fog";
  ctx.fillStyle = `rgba(255, 250, 225, ${0.8 * level})`;
  const roofTop = toScreen(0, base - 5.8).y - WALL_HEIGHT;
  for (let i = 0; i < (starry ? 26 : 0); i++) {
    const twinkle = 0.5 + 0.5 * Math.sin(performance.now() / 700 + i * 2.1);
    ctx.globalAlpha = level * (0.4 + 0.6 * twinkle);
    ctx.fillRect(left + noise(i * 3.3) * (right - left), top + noise(i * 5.9) * (roofTop - top - 4), 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
  if (viewFloor === LAKE_FLOOR) drawLakeFireflies(ctx, level); // (render-lake.js)
  if (viewFloor === FARM_FLOOR) drawFarmFireflies(ctx, level); // (render-farm.js)
  if (alley) return drawAlleyOverhead(ctx, level); // (render-alley.js; no weather back there)
  drawOutsideWeather(ctx, whole); // rain or snow falls in front of the lights
}

// --- Trees and plants ---

// Leaf colors for the season: [dark, middle, light].
function leafColors(n = 0) {
  const season = yardSeason();
  if (season === "autumn") return [["#b5572e", "#d9822b", "#e8b04a"], ["#9a4a2a", "#c8672e", "#e09a3a"], ["#a86a2a", "#d9a03a", "#eccb5a"]][n % 3];
  if (season === "winter") return ["#6f7f6a", "#8a9a84", "#e9eef0"];
  if (season === "spring") return n % 3 === 1 ? ["#4f8a4a", "#8fc06a", "#f3c4d6"] : ["#3f7a42", "#5fa052", "#9fd07a"];
  return ["#3f6b3c", "#57874a", "#7fb46a"];
}

// One stone: a soft dark outline, darker underneath, a lit top, and a few
// flecks in the rock.
function drawStone(ctx, x, y, rx, ry, color, seed = 0) {
  const oval = (cx, cy, a, b) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.fillStyle = shadeColor(color, -70);
  oval(x, y + 0.5, rx + 1.2, ry + 1.2);
  ctx.fillStyle = shadeColor(color, -28);
  oval(x, y, rx, ry);
  ctx.fillStyle = color;
  oval(x - rx * 0.08, y - ry * 0.22, rx * 0.86, ry * 0.72);
  ctx.fillStyle = shadeColor(color, 30);
  oval(x - rx * 0.3, y - ry * 0.5, rx * 0.35, ry * 0.2);
  ctx.fillStyle = shadeColor(color, -45);
  for (let i = 0; i < 3; i++) ctx.fillRect(x + (noise(seed + i * 2.7) - 0.5) * rx, y + (noise(seed + i * 4.9) - 0.3) * ry * 0.8, 1.4, 1);
}

// Leaf colors nudged a little for one plant: a touch lighter or darker,
// yellower or bluer, so no two bushes or trees look copy-pasted.
function leafVariant(colors, seed) {
  const v = noise(seed * 3.7 + 0.5) - 0.5, w = noise(seed * 5.1 + 0.3) - 0.5;
  return colors.map((c) => shadeColor(c, Math.round(v * 18 + w * 10), Math.round(v * 16), Math.round(v * 12 - w * 16)));
}

// A big leafy tree: a trunk and a round, puffy crown made of overlapping
// balls of leaves, darker underneath and lighter on top (light from above).
function drawYardTree(ctx, f) {
  const base = toScreen(f.x + f.w / 2, f.y + f.h);
  ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trunk, with a couple of roots.
  ctx.fillStyle = "#7a5638";
  ctx.beginPath();
  ctx.moveTo(base.x - 9, base.y);
  ctx.quadraticCurveTo(base.x - 5, base.y - 20, base.x - 6, base.y - 46);
  ctx.lineTo(base.x + 6, base.y - 46);
  ctx.quadraticCurveTo(base.x + 5, base.y - 20, base.x + 9, base.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5e412a";
  ctx.fillRect(base.x + 2, base.y - 44, 3, 40);
  // Bark: a darker outline, a lit stripe on the left, and a few grooves.
  ctx.strokeStyle = "#4a3220";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 225, 180, 0.22)";
  ctx.fillRect(base.x - 6, base.y - 44, 2, 38);
  ctx.strokeStyle = "rgba(60, 38, 22, 0.55)";
  ctx.beginPath();
  for (const [dx, y0, y1] of [[-2, 8, 22], [1, 26, 38], [-3, 30, 42]]) {
    ctx.moveTo(base.x + dx, base.y - y0);
    ctx.lineTo(base.x + dx + 0.5, base.y - y1);
  }
  ctx.stroke();
  // The crown: many small leaf clusters (each tree its own green).
  const colors = leafVariant(leafColors(f.n), f.x + f.y * 0.37);
  const sway = Math.sin(performance.now() / 1600 + (f.n ?? 0)) * 1.2;
  const cy = base.y - 72;
  drawLeafClump(ctx, base.x + sway, cy - 6, 48, 40, colors, f.x * 1.7 + (f.n ?? 0), 42);
  if (yardSeason() === "winter") {
    // Snow resting on the top clusters.
    ctx.fillStyle = "#f7fafc";
    for (const [dx, dy, r] of [[-16, -30, 15], [14, -32, 16], [0, -42, 14]]) {
      ctx.beginPath();
      ctx.ellipse(base.x + dx + sway, cy + dy, r, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A pine: three stacked triangles of needles over a short trunk.
function drawPineTree(ctx, f) {
  const base = toScreen(f.x + f.w / 2, f.y + f.h);
  ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4a30";
  ctx.fillRect(base.x - 5, base.y - 18, 10, 18);
  // Bark: an outline and a lit left edge.
  ctx.fillStyle = "#4a3220";
  ctx.fillRect(base.x - 6, base.y - 18, 1.2, 18);
  ctx.fillRect(base.x + 4.8, base.y - 18, 1.2, 18);
  ctx.fillStyle = "rgba(255, 225, 180, 0.22)";
  ctx.fillRect(base.x - 4.5, base.y - 18, 2, 18);
  const snow = yardSeason() === "winter";
  const v = noise(f.x * 2.3 + f.y) - 0.5; // (each pine its own green)
  const tint = (c) => shadeColor(c, Math.round(v * 16), Math.round(v * 14), Math.round(v * 8));
  const dark = tint("#2f5a3c"), lit = tint("#3f7449");
  const layers = [[0, 34, 30], [-26, 28, 26], [-50, 21, 22]];
  for (const [dy, half, height] of layers) {
    const y = base.y - 14 + dy, tip = y - height - 16;
    // The layer: a soft dark outline, the shaded body, and the lit left half.
    ctx.beginPath();
    ctx.moveTo(base.x - half, y);
    ctx.lineTo(base.x + half, y);
    ctx.lineTo(base.x, tip);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = shadeColor(dark, -30);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(base.x - half + 6, y - 4);
    ctx.lineTo(base.x, y - 4);
    ctx.lineTo(base.x, tip + 2);
    ctx.closePath();
    ctx.fill();
    // A ragged lower edge of needle tips, and needle strokes on the body.
    ctx.fillStyle = shadeColor(dark, -12);
    for (let x = base.x - half + 3; x < base.x + half - 2; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 1);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x + 3, y - 1);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(20, 45, 28, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const u = noise(f.x + dy + i * 3.1), w = noise(f.y + dy + i * 1.7);
      const nx = base.x + (u - 0.5) * half * 1.3 * (0.4 + w * 0.6), ny = y - 6 - w * (height - 4);
      ctx.moveTo(nx, ny);
      ctx.lineTo(nx + (nx < base.x ? -3 : 3), ny + 3);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(200, 240, 190, 0.3)"; // light catching the tip
    ctx.beginPath();
    ctx.moveTo(base.x, tip + 1);
    ctx.lineTo(base.x - 4, tip + 10);
    ctx.lineTo(base.x, tip + 9);
    ctx.fill();
    if (snow) {
      ctx.fillStyle = "#f4f8fb";
      ctx.beginPath();
      ctx.moveTo(base.x - half * 0.45, y - height * 0.55);
      ctx.lineTo(base.x + half * 0.45, y - height * 0.55);
      ctx.lineTo(base.x, tip);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// A round bush made of many small leaf clusters (each bush its own shade
// of green), with berries or blossoms depending on the season.
function drawBush(ctx, f) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const b = toScreen(f.x + f.w / 2, f.y + f.h);
  const rx = (f.w * TILE) / 2 + 1;
  drawLeafClump(ctx, b.x, b.y - 16, rx, 16, leafVariant(leafColors(f.n + 1), f.x + f.y * 0.61), f.x * 3.1 + f.y, 28);
  const season = yardSeason();
  if (season === "summer" || season === "spring") {
    const color = f.n % 2 ? "#f2f0f8" : "#e05a6a";
    for (let i = 0; i < 7; i++) {
      const x = b.x - 14 + noise(f.n * 7 + i + f.x) * 28, y = b.y - 28 + noise(f.n * 3 + i * 2 + f.x) * 18;
      ctx.fillStyle = shadeColor(color, -60);
      ctx.beginPath();
      ctx.arc(x, y + 0.6, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillRect(x - 1, y - 1.2, 1, 1);
    }
  }
}

Object.assign(FURNITURE_DRAWERS, {
  yardTree: drawYardTree,
  pineTree: drawPineTree,
  bush: drawBush,

  // A little cluster of wildflowers in the grass.
  wildflowers(ctx, f) {
    if (yardSeason() === "winter") return;
    const a = toScreen(f.x, f.y + f.h);
    const w = f.w * TILE;
    const petals = [[-1.6, 0], [1.6, 0], [0, -1.5], [0, 1.4]];
    for (let i = 0; i < Math.round(w / 6); i++) {
      const x = a.x + noise(f.x * 3 + i * 1.9) * w, h = 6 + noise(i * 4.3 + f.y) * 7;
      ctx.strokeStyle = "#4f7a3e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, a.y);
      ctx.quadraticCurveTo(x - 1, a.y - h / 2, x, a.y - h);
      ctx.stroke();
      ctx.fillStyle = "#6a9a4e"; // a leaf on the stem
      ctx.beginPath();
      ctx.ellipse(x + (i % 2 ? 2 : -2), a.y - h * 0.4, 2.2, 1, i % 2 ? -0.5 : 0.5, 0, Math.PI * 2);
      ctx.fill();
      // The petals: a darker edge, then the petals, then the center.
      const color = ["#f2c94c", "#f7f1e6", "#c86bb0", "#e8883a"][i % 4];
      for (const [fill, r] of [[shadeColor(color, -70), 1.9], [color, 1.4]]) {
        ctx.fillStyle = fill;
        for (const [dx, dy] of petals) {
          ctx.beginPath();
          ctx.arc(x + dx, a.y - h + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = i % 4 === 0 ? "#c8782a" : "#e8b43a";
      ctx.fillRect(x - 0.8, a.y - h - 0.8, 1.6, 1.6);
    }
  },

  // A flower bed along the house: a low wooden edge, dark soil and a row
  // of flowers (or, in winter, a blanket of snow).
  flowerBed(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 6, "#8a6040");
    ctx.fillStyle = "#5c3f2a";
    ctx.fillRect(box.top.x + 2, box.top.y + 2, box.top.w - 4, box.top.h - 3);
    const winter = yardSeason() === "winter";
    for (let i = 0; i < Math.floor(box.top.w / 12); i++) {
      const x = box.top.x + 7 + i * 12, y = box.top.y + box.top.h / 2 + 2;
      if (winter) continue;
      ctx.fillStyle = "#4f7a48";
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ["#e05a6a", "#f2c94c", "#c86bb0", "#f7f1e6", "#e8883a"][(i + Math.round(f.x)) % 5];
      for (const [dx, dy] of [[-2, -9], [2, -11], [0, -7]]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (winter) {
      ctx.fillStyle = "#f4f8fb";
      roundRectPath(ctx, box.top.x + 1, box.top.y - 3, box.top.w - 2, box.top.h + 2, 4);
      ctx.fill();
    }
  },

  // A fence along the page: pickets (white and pointy) or rails (rustic
  // wood with posts).
  fence(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "rgba(40, 25, 10, 0.16)";
    ctx.fillRect(a.x, a.y - 2, b.x - a.x, 5);
    if (f.style === "rail") {
      ctx.fillStyle = "#8a6444";
      for (let x = a.x; x <= b.x + 0.5; x += 46) ctx.fillRect(x - 2.5, a.y - 26, 5, 26);
      ctx.fillStyle = "#9c7550";
      ctx.fillRect(a.x, a.y - 22, b.x - a.x, 4);
      ctx.fillRect(a.x, a.y - 12, b.x - a.x, 4);
      ctx.fillStyle = "rgba(255, 240, 210, 0.25)";
      ctx.fillRect(a.x, a.y - 22, b.x - a.x, 1);
      ctx.fillRect(a.x, a.y - 12, b.x - a.x, 1);
      return;
    }
    ctx.fillStyle = "#e9e2d4";
    ctx.fillRect(a.x, a.y - 18, b.x - a.x, 3);
    ctx.fillRect(a.x, a.y - 9, b.x - a.x, 3);
    for (let x = a.x + 2; x < b.x - 2; x += 9) {
      ctx.fillStyle = "#f4efe4";
      ctx.beginPath();
      ctx.moveTo(x - 3, a.y);
      ctx.lineTo(x - 3, a.y - 22);
      ctx.lineTo(x, a.y - 26);
      ctx.lineTo(x + 3, a.y - 22);
      ctx.lineTo(x + 3, a.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(120, 100, 80, 0.25)";
      ctx.fillRect(x + 1.5, a.y - 22, 1.5, 22);
    }
  },

  // A fence running down the page, seen from its end: posts and the top
  // of the rails between them.
  fenceSide(ctx, f) {
    const a = toScreen(f.x + f.w / 2, f.y), b = toScreen(f.x + f.w / 2, f.y + f.h);
    const rail = f.style === "rail";
    ctx.fillStyle = "rgba(40, 25, 10, 0.14)";
    ctx.fillRect(a.x - 3, a.y, 8, b.y - a.y);
    ctx.fillStyle = rail ? "#9c7550" : "#e9e2d4";
    ctx.fillRect(a.x - 2, a.y - 20, 4, b.y - a.y);
    ctx.fillStyle = rail ? "#8a6444" : "#f4efe4";
    for (let y = a.y; y <= b.y + 0.5; y += rail ? 46 : 18) {
      ctx.fillRect(a.x - 3, y - (rail ? 26 : 24), 6, rail ? 26 : 24);
      ctx.fillStyle = rail ? "#6f4f35" : "#d8cfbe";
      ctx.fillRect(a.x - 3, y - 2, 6, 2);
      ctx.fillStyle = rail ? "#8a6444" : "#f4efe4";
    }
  },

  // The porch railing along the front: posts, a top rail and balusters.
  porchRail(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    ctx.fillRect(a.x, a.y - 1, b.x - a.x, 5);
    ctx.fillStyle = "#f0e8da";
    for (let x = a.x + 4; x < b.x - 2; x += 7) ctx.fillRect(x, a.y - 20, 2.5, 20);
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(a.x - 2, a.y - 24, b.x - a.x + 4, 5);
    ctx.fillStyle = "#a87a52";
    ctx.fillRect(a.x - 2, a.y - 24, b.x - a.x + 4, 1.5);
    ctx.fillStyle = "#7a5436";
    for (const x of [a.x, b.x - 6]) ctx.fillRect(x, a.y - 30, 6, 30);
  },

  // The porch railing's west end, seen from the side.
  porchRailSide(ctx, f) {
    const a = toScreen(f.x + f.w / 2, f.y), b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(a.x - 2.5, a.y - 24, 5, b.y - a.y);
    ctx.fillStyle = "#7a5436";
    ctx.fillRect(a.x - 3, b.y - 30, 6, 30);
  },

  // Two wooden steps down from the porch.
  porchSteps(ctx, f) {
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(a.x, a.y, b.x - a.x, (b.y - a.y) / 2);
    ctx.fillStyle = "#9c7250";
    ctx.fillRect(a.x, a.y + (b.y - a.y) / 2, b.x - a.x, (b.y - a.y) / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(a.x, a.y + (b.y - a.y) / 2 - 1.5, b.x - a.x, 1.5);
    ctx.fillRect(a.x, b.y - 1.5, b.x - a.x, 1.5);
  },

  // A coir doormat by a door.
  doormat(ctx, f) {
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "#b8894f";
    roundRectPath(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 3);
    ctx.fill();
    ctx.strokeStyle = "#8a6035";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, a.x + 3, a.y + 3, b.x - a.x - 6, b.y - a.y - 6, 2);
    ctx.stroke();
  },

  // The front door in the house's back wall, in the same style as the
  // bedroom doors: a thin wooden frame, a painted door with two tall
  // panels and a brass knob, and a little roof over it. It's a real
  // doorway (walk up into it), so it fills in the wall either side of it.
  yardDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, bottom = a.y, top = a.y - WALL_HEIGHT;
    // The wall around the door: siding below, the wooden top above.
    ctx.fillStyle = "#a07c55";
    ctx.fillRect(a.x, top, w, WALL_HEIGHT);
    ctx.fillStyle = "rgba(60, 35, 15, 0.28)";
    for (let y = top + 6; y < bottom - 2; y += 7) ctx.fillRect(a.x, y, w, 1.5);
    ctx.fillStyle = "rgba(255, 235, 200, 0.12)";
    for (let y = top + 1; y < bottom - 2; y += 7) ctx.fillRect(a.x, y, w, 1);
    ctx.fillStyle = WOOD;
    ctx.fillRect(a.x, top - WALL_THICKNESS * TILE, w, WALL_THICKNESS * TILE);
    const dw = 0.95 * TILE, x = a.x + (w - dw) / 2, dtop = top + 5, dh = bottom - dtop;
    const color = "#8a4a3a";
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
    ctx.fillRect(x, dtop + 2, dw + 4, dh - 2);
    ctx.fillStyle = "#6b4630"; // frame
    ctx.fillRect(x - 2, dtop - 2, dw + 4, dh + 2);
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(x - 2, dtop - 2, dw + 4, 1.5);
    const panel = ctx.createLinearGradient(0, dtop, 0, bottom);
    panel.addColorStop(0, shadeColor(color, 22));
    panel.addColorStop(1, shadeColor(color, -18));
    ctx.fillStyle = panel;
    ctx.fillRect(x, dtop, dw, dh);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)"; // two tall inset panels
    ctx.lineWidth = 1;
    const pw = (dw - 11) / 2;
    ctx.strokeRect(x + 4, dtop + 5, pw, dh - 9);
    ctx.strokeRect(x + 7 + pw, dtop + 5, pw, dh - 9);
    ctx.fillStyle = "#b8923a"; // the knob, on a little brass plate
    roundRectPath(ctx, x + dw - 5.5, dtop + dh * 0.5, 3, 6, 1);
    ctx.fill();
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.arc(x + dw - 4, dtop + dh * 0.5 + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // A small roof over the door.
    ctx.fillStyle = "#6a3f33";
    ctx.beginPath();
    ctx.moveTo(x - 8, dtop - 1);
    ctx.lineTo(x + dw / 2, dtop - 12);
    ctx.lineTo(x + dw + 8, dtop - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a5242";
    ctx.fillRect(x - 8, dtop - 3, dw + 16, 3);
  },

  // A window in the house's back wall, glowing warm from the rooms inside,
  // with a flower box under it.
  houseWindow(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, top = a.y - WALL_HEIGHT + 7, h = 22;
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(a.x + 3, top - 2, w - 6, h + 4);
    const night = isNightOutside();
    const pane = ctx.createLinearGradient(0, top, 0, top + h);
    pane.addColorStop(0, night ? "#f6c978" : "#bcd8e6");
    pane.addColorStop(1, night ? "#e0a052" : "#9ec3d6");
    ctx.fillStyle = pane;
    ctx.fillRect(a.x + 5, top, w - 10, h);
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(a.x + w / 2 - 1, top, 2, h);
    ctx.fillRect(a.x + 5, top + h / 2 - 1, w - 10, 2);
    if (!night) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(a.x + 8, top + 2, 4, h / 2 - 4);
    }
    // Flower box.
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(a.x + 2, top + h + 2, w - 4, 5);
    if (yardSeason() !== "winter") {
      for (let i = 0; i < Math.floor((w - 8) / 7); i++) {
        ctx.fillStyle = i % 2 ? "#4f7a48" : ["#e05a6a", "#f2c94c", "#c86bb0"][(i + Math.round(f.x)) % 3];
        ctx.beginPath();
        ctx.arc(a.x + 6 + i * 7, top + h + 1, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A wall lantern beside a door, lit at night.
  porchLantern(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 10;
    ctx.fillStyle = "#3a3030";
    ctx.fillRect(x - 1, y - 4, 2, 5);
    ctx.fillRect(x - 5, y, 10, 2);
    const lit = isNightOutside();
    ctx.fillStyle = lit ? "#ffd98a" : "#e9e0c8";
    ctx.fillRect(x - 4, y + 2, 8, 10);
    ctx.fillStyle = "#3a3030";
    ctx.fillRect(x - 5, y + 12, 10, 2);
    ctx.fillRect(x - 0.5, y + 2, 1, 10);
    if (lit) drawGlow(ctx, x, y + 7, 14, "rgba(255, 210, 120, 0.5)");
  },

  // The wooden dock reaching over the pond.
  dock(ctx, f) {
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    ctx.fillStyle = "rgba(20, 40, 50, 0.3)";
    ctx.fillRect(a.x, b.y, b.x - a.x, 5);
    ctx.fillStyle = "#6b4a30";
    for (const x of [a.x + 3, a.x + (b.x - a.x) * 0.45]) {
      ctx.fillRect(x, b.y - 2, 4, 8);
      ctx.fillRect(x, a.y - 2, 4, 4);
    }
    for (let x = a.x, i = 0; x < b.x; x += 9, i++) {
      ctx.fillStyle = shadeColor("#a07a52", Math.round((noise(i * 3.7) - 0.5) * 20));
      ctx.fillRect(x, a.y, 8, b.y - a.y);
      ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
      ctx.fillRect(x + 8, a.y, 1, b.y - a.y);
    }
  },

  // Reeds and cattails at the pond's edge, swaying.
  reeds(ctx, f) {
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const t = performance.now() / 1000;
    for (let i = 0; i < 7; i++) {
      const x = b.x - 12 + i * 4, h = 18 + noise(f.x + i * 2.1) * 14, lean = Math.sin(t * 1.2 + i) * 2;
      ctx.strokeStyle = i % 2 ? "#5f8a4a" : "#7aa05a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.quadraticCurveTo(x, b.y - h / 2, x + lean, b.y - h);
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.fillStyle = "#7a4a2a";
        ctx.beginPath();
        ctx.ellipse(x + lean, b.y - h + 3, 1.8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A few smooth stones (by the water, or out in the grass).
  pondStones(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, dy, rx, ry, c] of [[-10, -6, 11, 8, "#9a958c"], [8, -4, 9, 6, "#b3aca0"], [0, -12, 7, 6, "#c4beb2"]]) {
      drawStone(ctx, b.x + dx, b.y + dy, rx, ry, c, f.x + dx);
    }
  },

  // One small rock on its own in the grass.
  rock(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    drawStone(ctx, b.x, b.y - 6, (f.w * TILE) / 2, 7, "#a8a298", f.x);
  },

  // A wooden signpost with an arrow board.
  signpost(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#7a5638";
    ctx.fillRect(b.x - 2, b.y - 38, 4, 38);
    ctx.font = "700 10px 'Quicksand', sans-serif";
    const w = ctx.measureText(f.text).width + 16, h = 15, y = b.y - 40;
    const x = f.point === "left" ? b.x - w + 6 : f.point === "right" ? b.x - 6 : b.x - w / 2;
    ctx.fillStyle = "#b88a5a";
    ctx.beginPath();
    if (f.point === "left") {
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + 7, y + h);
    } else if (f.point === "right") {
      ctx.moveTo(x + w, y + h / 2);
      ctx.lineTo(x + w - 7, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w - 7, y + h);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 240, 210, 0.3)";
    ctx.fillRect(x + 3, y + 1, w - 6, 1.5);
    ctx.fillStyle = "#4a3222";
    ctx.textAlign = "center";
    ctx.fillText(f.text, x + w / 2 + (f.point === "left" ? 3 : f.point === "right" ? -3 : 0), y + 11);
    ctx.textAlign = "left";
  },
});

// --- Weather (Update 4, step 2) ---
// What the sky is doing comes from weather.js, into OUTDOORS (world.js).
// Over each outdoor area: a tint for clouds, fog or sunshine, drifting
// cloud shadows, rain (with ripples where drops land) or snow, and the odd
// flash of lightning in a storm.

// Falling rain over a rectangle (screen pixels), `amount` 0 to 1.
function drawRainIn(ctx, x0, y0, w, h, amount, seed, ripples) {
  const t = performance.now() / 1000;
  if (ripples) {
    for (let i = 0; i < Math.max(2, ((w * h) / 5000) * amount); i++) {
      const cycle = t * 0.9 + noise(seed + i * 5.3);
      const phase = cycle % 1, round = Math.floor(cycle);
      const rx = x0 + noise(seed + i * 3.7 + round * 11.1) * w, ry = y0 + noise(seed + i * 9.1 + round * 7.3) * h;
      ctx.strokeStyle = `rgba(220, 235, 245, ${0.5 * (1 - phase)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 1 + phase * 6, 0.5 + phase * 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = `rgba(215, 230, 245, ${0.3 + 0.25 * amount})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < ((w * h) / 900) * (0.4 + amount); i++) {
    const x = x0 + noise(seed + i * 1.3) * (w + 20);
    const fall = (t * (0.9 + noise(seed + i * 2.9) * 0.5) + noise(seed + i * 4.1)) % 1;
    const y = y0 - 12 + fall * (h + 24);
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.5, y + 9);
  }
  ctx.stroke();
}

// Snowflakes drifting down over a rectangle, `amount` 0 to 1.
function drawSnowIn(ctx, x0, y0, w, h, amount, seed) {
  const t = performance.now() / 1000;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (let i = 0; i < ((w * h) / 1400) * (0.4 + amount); i++) {
    const fall = (t * (0.12 + noise(seed + i * 2.9) * 0.1) + noise(seed + i * 4.1)) % 1;
    const x = x0 + noise(seed + i * 1.3) * w + Math.sin(t * 1.3 + i) * 6;
    const y = y0 - 6 + fall * (h + 12);
    const r = 1 + noise(seed + i * 7.7) * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Soft cloud shadows sliding slowly across the ground: faint, and fading
// out toward their edges.
function drawCloudShadows(ctx, x0, y0, w, h, amount) {
  const t = performance.now() / 1000;
  const alpha = 0.035 + 0.035 * amount;
  for (let i = 0; i < 4; i++) {
    const x = x0 - 200 + ((t * 9 + noise(i * 3.1) * 2000) % (w + 400));
    const y = y0 + noise(i * 7.3) * h;
    const rx = 120 + noise(i) * 60, ry = 45 + noise(i * 2) * 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const soft = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    soft.addColorStop(0, `rgba(40, 55, 70, ${alpha})`);
    soft.addColorStop(0.6, `rgba(40, 55, 70, ${alpha * 0.8})`);
    soft.addColorStop(1, "rgba(40, 55, 70, 0)");
    ctx.fillStyle = soft;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Lightning: a quick double flash every so often, during a storm.
function lightningFlash() {
  if (OUTDOORS.sky !== "storm") return 0;
  const t = performance.now() / 1000;
  const cycle = t % 9; // about every nine seconds
  if (cycle < 0.12) return 0.5;
  if (cycle > 0.22 && cycle < 0.3) return 0.35;
  return 0;
}

// The whole weather look over some outdoor areas (grid rectangles).
// `ground` is true for the lawn around the house, where it's drawn under
// everything standing (the yard's goes on top, from drawOutdoorLight).
function drawOutsideWeather(ctx, areas, ground = false) {
  const { sky, rain, snow, clouds } = OUTDOORS;
  const night = isNightOutside();
  const outsideView = viewFloor <= 2; // (bedrooms have their own view outside)
  for (const area of areas) {
    const a = toScreen(area.x, area.y), b = toScreen(area.x + area.w, area.y + area.h);
    const w = b.x - a.x, h = b.y - a.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, w, h);
    ctx.clip();
    if (sky === "clear" && !night) {
      ctx.fillStyle = "rgba(255, 220, 140, 0.08)"; // sunshine
      ctx.fillRect(a.x, a.y, w, h);
    }
    if (clouds > 0.3 || rain > 0 || snow > 0) {
      ctx.fillStyle = `rgba(60, 75, 95, ${0.06 + 0.12 * Math.max(clouds, rain)})`;
      ctx.fillRect(a.x, a.y, w, h);
    }
    if (snow > 0) {
      ctx.fillStyle = `rgba(245, 248, 252, ${0.15 + 0.25 * snow})`; // settling snow
      ctx.fillRect(a.x, a.y, w, h);
    }
    if (sky === "partly" || sky === "cloudy") drawCloudShadows(ctx, a.x, a.y, w, h, clouds);
    if (ground && night && outsideView) {
      ctx.fillStyle = "rgba(14, 22, 62, 0.4)";
      ctx.fillRect(a.x, a.y, w, h);
    }
    const seed = Math.round(area.x * 10);
    if (rain > 0) drawRainIn(ctx, a.x, a.y, w, h, rain, seed, true);
    if (snow > 0) drawSnowIn(ctx, a.x, a.y, w, h, snow, seed);
    if (sky === "fog") {
      ctx.fillStyle = "rgba(235, 238, 240, 0.35)";
      ctx.fillRect(a.x, a.y, w, h);
    }
    const flash = lightningFlash();
    if (flash) {
      ctx.fillStyle = `rgba(240, 245, 255, ${flash})`;
      ctx.fillRect(a.x, a.y, w, h);
    }
    ctx.restore();
  }
}

// --- Umbrellas ---
// Out in the rain, everyone carries an umbrella in their own color, held
// over their head (tilting a little as they walk). Name tags lift to
// clear it.
const UMBRELLA_LIFT = 20; // pixels

function drawUmbrella(ctx, p) {
  const foot = playerFeet(p);
  const r = PLAYER_RADIUS;
  const walk = p.moving ? Math.sin((performance.now() / 1000) * 12) : 0;
  const lift = -(p.seatLift ?? 0); // (sitting, you're up on the seat: see SEATS in world.js)
  const hand = { x: foot.x + r * 0.75, y: foot.y - r - 6 + lift };
  const top = { x: foot.x + walk * 1.5, y: foot.y - r * 2 - 22 + lift - Math.abs(walk) * 1.5 };
  const color = /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#5aa0d8";
  ctx.save();
  // The handle: a thin shaft from the hand up to the canopy, with a hook.
  ctx.strokeStyle = "#5c4530";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(hand.x - 2, hand.y + 3);
  ctx.quadraticCurveTo(hand.x - 4, hand.y + 7, hand.x, hand.y + 6);
  ctx.moveTo(hand.x, hand.y + 3);
  ctx.lineTo(top.x + 2, top.y + 4);
  ctx.stroke();
  // The canopy: a dome with scalloped edges, lighter on top (light from above).
  const span = 27;
  ctx.fillStyle = shadeColor(color, -18);
  ctx.beginPath();
  ctx.moveTo(top.x - span, top.y + 10);
  ctx.quadraticCurveTo(top.x, top.y - 14, top.x + span, top.y + 10);
  for (let i = 4; i > 0; i--) {
    const x1 = top.x - span + (span * 2 * i) / 4, x0 = top.x - span + (span * 2 * (i - 1)) / 4;
    ctx.quadraticCurveTo((x0 + x1) / 2, top.y + 5, x0, top.y + 10);
  }
  ctx.fill();
  ctx.fillStyle = shadeColor(color, 18);
  ctx.beginPath();
  ctx.moveTo(top.x - span + 6, top.y + 4);
  ctx.quadraticCurveTo(top.x, top.y - 11, top.x + span - 6, top.y + 4);
  ctx.quadraticCurveTo(top.x, top.y - 4, top.x - span + 6, top.y + 4);
  ctx.fill();
  // Ribs, and the tip.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 1;
  for (const dx of [-13, 0, 13]) {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 2);
    ctx.lineTo(top.x + dx, top.y + 8);
    ctx.stroke();
  }
  ctx.fillStyle = "#5c4530";
  ctx.fillRect(top.x - 1, top.y - 6, 2, 5);
  ctx.restore();
}

// --- Windows (every window in the house) ---
// Every window shows what's outside that wall: tree tops against a pale
// strip of sky, grass, and a bit of fence (or water, for the lake house).
// Never the sun or the moon: on sunny days the sunlight shows as a soft
// patch of light on the floor in front of the window instead (see
// drawSunPatches). The view follows the live weather (rain streaks,
// snow, overcast, fog, storms) and the time of day (a dusk glow, dark at
// night).
//
// Windows look clearly different from paintings: a deep frame (you see
// its inner edge in shadow), a sill that sticks out, a shine on the
// glass, and curtains on a rod. Paintings are flat with a thin frame.

// How much dusk (or dawn) glow the light has right now, from 0 to 1: the
// hour before sunset, and the half hour after sunrise. The times come
// with the weather (weather.js); until they do, from this computer's
// clock (CONFIG.outdoors.nightFrom and nightTo).
function duskLevel() {
  if (OUTDOORS.duskPreview) return 1;
  if (isNightOutside()) return 0;
  const now = Date.now(), hour = 3600_000;
  let { sunrise, sunset } = OUTDOORS;
  if (!sunset || !sunrise) {
    const today = new Date();
    today.setMinutes(0, 0, 0);
    sunset = new Date(today).setHours(CONFIG.outdoors.nightFrom);
    sunrise = new Date(today).setHours(CONFIG.outdoors.nightTo);
  }
  const untilSunset = (sunset - now) / hour, sinceSunrise = (now - sunrise) / hour;
  if (untilSunset >= 0 && untilSunset < 1) return 1 - untilSunset;
  if (sinceSunrise >= 0 && sinceSunrise < 0.5) return 1 - sinceSunrise * 2;
  return 0;
}

// Is the sun out right now (day, not dusk, and not grey, wet or foggy)?
function sunnyNow() {
  const { rain, snow, clouds, sky } = OUTDOORS;
  return !isNightOutside() && duskLevel() < 0.6 && rain === 0 && snow === 0 && clouds < 0.5 && sky !== "fog";
}

// The view out of a window, painted into (x, y, w, h). `view` is "yard"
// (grass and a fence), "lake" (water) or "leaves" (close to an autumn tree).
function drawWindowView(ctx, x, y, w, h, view = "yard", seed = 0) {
  const t = performance.now() / 1000;
  const { rain, snow, clouds, sky } = OUTDOORS;
  const grey = Math.max(clouds, rain, snow > 0 ? 0.7 : 0);
  const season = yardSeason();
  const leaves = view === "leaves" ? leafColors(0) : leafColors(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // A pale strip of sky at the top (just a strip: tree tops fill the rest).
  const skyFill = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  skyFill.addColorStop(0, grey > 0.5 ? "#c3c9cf" : "#bcd9ea");
  skyFill.addColorStop(1, grey > 0.5 ? "#d6dade" : "#e3f0f6");
  ctx.fillStyle = skyFill;
  ctx.fillRect(x, y, w, h);
  // Tree tops: a row of soft round crowns across the middle (closer and
  // bigger for a window right by a tree).
  const big = view === "leaves";
  const crowns = big ? 3 : Math.max(3, Math.round(w / 9));
  for (let i = 0; i < crowns; i++) {
    const cx = x + (i + 0.5) * (w / crowns) + (noise(seed * 7 + i * 3.1) - 0.5) * 5;
    const cy = y + h * (big ? 0.28 : 0.42) + noise(seed * 3 + i * 1.7) * 4;
    const r = (big ? h * 0.42 : h * 0.24) + noise(i * 5.3 + seed) * 3;
    ctx.fillStyle = leaves[0];
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = leaves[1]; // lighter on top (light from above)
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    if (season === "winter" || snow > 0) {
      ctx.fillStyle = "rgba(250, 252, 255, 0.9)"; // snow on the tree tops
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.1, cy - r * 0.55, r * 0.6, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The ground: grass (or the lake).
  const groundTop = y + h * (big ? 0.72 : 0.6);
  if (view === "lake") {
    const water = ctx.createLinearGradient(0, groundTop, 0, y + h);
    water.addColorStop(0, "#5f95b0");
    water.addColorStop(1, "#4a7f9e");
    ctx.fillStyle = water;
    ctx.fillRect(x, groundTop, w, y + h - groundTop);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + ((t * 3 + i * 11 + seed * 5) % w), groundTop + 3 + i * 3, 5, 1);
  } else {
    const grass = (GRASS[season] ?? GRASS.summer).ground;
    ctx.fillStyle = snow > 0 || season === "winter" ? "#eef2f4" : grass;
    ctx.fillRect(x, groundTop, w, y + h - groundTop);
    if (view === "yard") {
      // A bit of the yard's fence: two rails and a few posts.
      ctx.fillStyle = "#b08a60";
      ctx.fillRect(x, groundTop + 3, w, 1.5);
      ctx.fillRect(x, groundTop + 6.5, w, 1.5);
      for (let px = x + 3 + (seed % 3) * 2; px < x + w; px += 9) ctx.fillRect(px, groundTop + 1.5, 1.8, 8);
    }
  }
  // Weather.
  if (grey > 0.2) {
    ctx.fillStyle = `rgba(150, 160, 172, ${Math.min(0.35, grey * 0.35)})`; // overcast: everything a little grey
    ctx.fillRect(x, y, w, h);
  }
  if (sky === "fog") {
    ctx.fillStyle = "rgba(238, 240, 242, 0.65)";
    ctx.fillRect(x, y, w, h);
  }
  if (rain > 0) {
    drawRainIn(ctx, x, y, w, h, rain, Math.round(x), false);
    ctx.fillStyle = "rgba(230, 240, 250, 0.7)"; // drops running down the glass
    for (let i = 0; i < 4; i++) {
      const fall = (t * (0.15 + noise(i * 1.9) * 0.1) + noise(i * 4.3 + seed)) % 1;
      ctx.fillRect(x + 2 + noise(i * 2.7 + x) * (w - 4), y + fall * h, 1.2, 3);
    }
  }
  if (snow > 0) drawSnowIn(ctx, x, y, w, h, snow, Math.round(x));
  if (view === "leaves" && season === "autumn") {
    // A few leaves drifting past.
    for (let i = 0; i < 3; i++) {
      const fall = (t * 0.12 + noise(i * 3.7 + seed)) % 1;
      ctx.fillStyle = leaves[i % 3];
      ctx.fillRect(x + ((noise(i * 5.1) * w + t * 6) % w), y + fall * h, 2.5, 1.8);
    }
  }
  // The time of day: a warm glow at dusk, dark blue at night.
  const dusk = duskLevel();
  if (dusk > 0) {
    ctx.fillStyle = `rgba(255, 140, 90, ${0.3 * dusk})`;
    ctx.fillRect(x, y, w, h);
  }
  const night = outdoorNightLevel();
  if (night > 0) {
    ctx.fillStyle = `rgba(14, 20, 44, ${0.72 * night})`;
    ctx.fillRect(x, y, w, h);
  }
  const flash = lightningFlash();
  if (flash) {
    ctx.fillStyle = `rgba(245, 248, 255, ${flash * 1.4})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Each kind of window: its view, frame color, curtain color, and shape.
// (Nest & Nook sells some of these for bedrooms; the rest hang in the
// house and the themed offices.)
const WINDOW_LOOKS = {
  window: { view: "yard", frame: "#f1e9d8", curtain: "#c0554a" },
  weatherWindow: { view: "yard", frame: "#f1e9d8", curtain: "#c98a8a" },
  rainWindow: { view: "yard", frame: "#e9e1cf", curtain: "#5f7f5a" },
  lakeWindow: { view: "lake", frame: "#8a5c3c", curtain: "#b86a4a" },
  moonWindow: { view: "yard", frame: "#6b3f2a", curtain: null, round: true },
  leafWindow: { view: "leaves", frame: "#4a3325", curtain: "#7a3f4a" },
};
const WINDOW_KINDS = new Set(Object.keys(WINDOW_LOOKS));

// A window hung on a wall (f.x, f.w along the wall; f.y the wall's bottom edge).
function drawWindow(ctx, f) {
  const look = WINDOW_LOOKS[f.kind] ?? WINDOW_LOOKS.window;
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, x = a.x, top = a.y - WALL_HEIGHT + 6, h = 22;
  const seed = Math.round(f.x * 10);
  if (look.round) {
    // A round window: a deep round frame, the view inside, and a small sill.
    const r = Math.min(w / 2 - 3, h / 2 + 2), cx = x + w / 2, cy = top + h / 2 + 1;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 2, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.frame;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    drawWindowView(ctx, cx - r, cy - r, r * 2, r * 2, look.view, seed);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; // the frame's depth, in shadow at the top
    ctx.fillRect(cx - r, cy - r, r * 2, 3);
    drawGlassShine(ctx, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = shadeColor(look.frame, 25); // a lattice
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    drawSill(ctx, cx - r - 2, cy + r + 3, r * 2 + 4, look.frame);
    return;
  }
  const inset = 4; // the frame's width
  ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
  ctx.fillRect(x + 4, top + 1, w - 4, h + 5);
  ctx.fillStyle = look.frame; // the frame
  ctx.fillRect(x + 2, top - 2, w - 4, h + 4);
  const gx = x + 2 + inset, gy = top - 2 + inset, gw = w - 4 - inset * 2, gh = h + 4 - inset * 2;
  drawWindowView(ctx, gx, gy, gw, gh, look.view, seed);
  // The frame's depth: its inner top and left edges in shadow.
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(gx, gy, gw, 2.5);
  ctx.fillRect(gx, gy, 2, gh);
  // Glazing bars (a cross on wide windows, one bar on narrow ones).
  ctx.fillStyle = look.frame;
  ctx.fillRect(gx + gw / 2 - 1, gy, 2, gh);
  if (gw > 30) ctx.fillRect(gx, gy + gh / 2 - 1, gw, 2);
  drawGlassShine(ctx, gx, gy, gw, gh);
  drawSill(ctx, x, top + h + 2, w, look.frame);
  if (look.curtain) {
    // A curtain rod over the window, and a curtain tied back on each side.
    ctx.fillStyle = "#5c4530";
    ctx.fillRect(x - 1, top - 5, w + 2, 2);
    ctx.fillStyle = look.curtain;
    for (const side of [0, 1]) {
      const ex = side ? x + w + 1 : x - 1, dir = side ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(ex, top - 4);
      ctx.lineTo(ex + dir * 9, top - 4);
      ctx.quadraticCurveTo(ex + dir * 3, top + h * 0.45, ex + dir * 6, top + h + 1);
      ctx.lineTo(ex, top + h + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; // folds
    for (const [ex, dir] of [[x - 1, 1], [x + w + 1, -1]]) ctx.fillRect(ex + dir * 3, top - 3, 1, h + 2);
  }
}

// A soft shine across the glass: two thin diagonal streaks.
function drawGlassShine(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  for (const [off, width] of [[0.18, 5], [0.34, 2.5]]) {
    const sx = x + w * off;
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + width, y + h);
    ctx.lineTo(sx + width + h * 0.6, y);
    ctx.lineTo(sx + h * 0.6, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// A sill under a window: a ledge that sticks out, with a shadow under it.
function drawSill(ctx, x, y, w, color) {
  ctx.fillStyle = "rgba(40, 25, 10, 0.3)";
  ctx.fillRect(x - 1, y + 3, w + 2, 2.5);
  ctx.fillStyle = shadeColor(color, -18);
  ctx.fillRect(x - 3, y, w + 6, 3.5);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(x - 3, y, w + 6, 1);
}

for (const kind of WINDOW_KINDS) FURNITURE_DRAWERS[kind] = drawWindow;

// Sunlight through the windows: on sunny days, a soft patch of light on
// the floor in front of each window on the floor being drawn (none at
// night, at dusk, or when it's grey or wet outside). Drawn over
// everything, in the light pass (see drawLights in render.js).
function drawSunPatches(ctx) {
  if (!sunnyNow() || isOutdoorFloor(viewFloor)) return;
  const strength = 1 - outdoorNightLevel();
  for (const f of FURNITURE) {
    if (!WINDOW_KINDS.has(f.kind) || floorOf(f.y) !== viewFloor) continue;
    const a = toScreen(f.x, f.y), w = f.w * TILE, depth = 1.5 * TILE;
    // Slanting down and a little to the right, fading away from the wall.
    const glow = ctx.createLinearGradient(0, a.y, 0, a.y + depth);
    glow.addColorStop(0, `rgba(255, 238, 185, ${0.22 * strength})`);
    glow.addColorStop(1, "rgba(255, 238, 185, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(a.x + 4, a.y + 2);
    ctx.lineTo(a.x + w - 4, a.y + 2);
    ctx.lineTo(a.x + w + 10, a.y + depth);
    ctx.lineTo(a.x + 12, a.y + depth);
    ctx.closePath();
    ctx.fill();
  }
}

// --- The garden (Update 4, step 3) ---
// Raised beds with whatever's growing in them (garden.js keeps
// globalThis.gardenView up to date: for each bed, null or { crop, look,
// color, stage 0 to 4 (4 is ripe), dry, owner, ownerColor }).

// One plant, standing at (x, y) (screen pixels, its base), at a stage.
function drawCropPlant(ctx, x, y, look, color, stage, sway, n) {
  const green = "#5f9a48", dark = "#3f7434", light = "#8cc46a";
  if (stage === 0) {
    // A little mound of soil with a seed on top.
    ctx.fillStyle = "#6e4a30";
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8c08a";
    ctx.beginPath();
    ctx.arc(x, y - 3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const leaf = (lx, ly, len, angle, c) => {
    ctx.fillStyle = c;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + sway);
    ctx.beginPath();
    ctx.ellipse(0, -len / 2, len / 3.2, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const stem = (h) => {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x, y - h / 2, x + sway * 10, y - h);
    ctx.stroke();
  };
  if (stage === 1) {
    // A sprout: two tiny leaves.
    stem(5);
    leaf(x, y - 4, 6, -0.9, light);
    leaf(x, y - 4, 6, 0.9, light);
    return;
  }
  const tall = { stalk: 30, flower: 34, vine: 22, pumpkin: 10, berry: 12, leafy: 10, root: 12 }[look] ?? 14;
  const h = stage === 2 ? tall * 0.55 : tall;
  if (look === "leafy") {
    // Lettuce: a round head of ruffled leaves.
    const r = stage === 2 ? 5 : stage === 3 ? 7 : 9;
    for (const [dx, dy, c] of [[-r * 0.6, -r * 0.7, dark], [r * 0.6, -r * 0.7, dark], [0, -r * 1.1, green], [0, -r * 0.7, stage === 4 ? color : light]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (look === "root") {
    // Carrots and radishes: a tuft of leaves, and the top of the root
    // showing once it's ripe.
    for (let i = -2; i <= 2; i++) leaf(x + i, y - 1, h * (1 - Math.abs(i) * 0.12), i * 0.35, i % 2 ? dark : green);
    if (stage >= 3) {
      ctx.fillStyle = stage === 4 ? color : shadeColor(color, -40);
      ctx.beginPath();
      ctx.ellipse(x, y, stage === 4 ? 4.5 : 3, stage === 4 ? 3 : 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (look === "pumpkin") {
    // A sprawling vine, with a pumpkin that swells up as it ripens.
    leaf(x - 6, y, 9, -1.2, dark);
    leaf(x + 6, y, 9, 1.2, dark);
    leaf(x, y - 2, 8, 0, green);
    if (stage >= 3) {
      const r = stage === 4 ? 9 : 5;
      ctx.fillStyle = stage === 4 ? color : "#c8b85a";
      for (const dx of [-r * 0.5, r * 0.5, 0]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y - r * 0.7, r * 0.62, r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 1.05, r * 0.25, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5c4a2a";
      ctx.fillRect(x - 1, y - r * 1.5, 2, 3);
    }
    return;
  }
  // Everything else stands up on a stem, with leaves along it.
  stem(h);
  for (let i = 1; i <= (stage === 2 ? 1 : 2); i++) {
    leaf(x, y - (h * i) / 3, h / 3, -1.0, i % 2 ? green : dark);
    leaf(x, y - (h * i) / 3 - 2, h / 3, 1.0, i % 2 ? dark : green);
  }
  const top = { x: x + sway * 10, y: y - h };
  if (stage < 3) return;
  if (look === "flower") {
    // A sunflower: a bud, then a big yellow face.
    const r = stage === 4 ? 7 : 3.5;
    ctx.fillStyle = color;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(top.x + Math.cos(a) * r, top.y + Math.sin(a) * r, 3, 1.8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6a4a2a";
    ctx.beginPath();
    ctx.arc(top.x, top.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (look === "stalk") {
    // Corn: cobs on the stalk, with a tassel on top.
    ctx.fillStyle = stage === 4 ? color : "#b8c86a";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * 3.5, y - h * 0.55, 2.5, 5.5, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#d8b860";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + i * 2, top.y - 5);
      ctx.stroke();
    }
  } else {
    // Berries and tomatoes: white flowers first, then fruit.
    const spots = [[-4, 0.35], [4, 0.5], [-2, 0.7], [3, 0.85], [0, 1]];
    for (const [dx, f] of spots) {
      const bx = x + dx + sway * 8 * f, by = y - h * f + 2;
      ctx.fillStyle = stage === 4 ? color : "#f4f0e4";
      ctx.beginPath();
      ctx.arc(bx, by, stage === 4 ? (look === "vine" ? 3 : 2.2) : 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (stage === 4) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillRect(bx - 1, by - 1.5, 1, 1);
      }
    }
  }
}

Object.assign(FURNITURE_DRAWERS, {
  // A raised wooden garden bed, with dark soil (darker still when
  // watered), its crop, and a little stake in the owner's color.
  gardenPlot(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 7, "#8a6040");
    const plot = globalThis.gardenView?.beds?.[f.bed] ?? null;
    ctx.fillStyle = plot && !plot.dry ? "#4a3020" : "#6b4a32";
    ctx.fillRect(box.top.x + 3, box.top.y + 3, box.top.w - 6, box.top.h - 5);
    // Furrows (and on an empty bed, neat tilled rows ready for seeds).
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    for (let i = 1; i < 3; i++) ctx.fillRect(box.top.x + 5, box.top.y + 3 + ((box.top.h - 5) * i) / 3, box.top.w - 10, 1.5);
    if (!plot && yardSeason() !== "winter") {
      const rows = 4, rowH = (box.top.h - 7) / rows;
      for (let i = 0; i < rows; i++) {
        const y = box.top.y + 4 + i * rowH;
        ctx.fillStyle = "rgba(160, 118, 82, 0.55)"; // the ridge, catching the light
        roundRectPath(ctx, box.top.x + 5, y, box.top.w - 10, rowH * 0.45, 1.5);
        ctx.fill();
        ctx.fillStyle = "rgba(30, 18, 10, 0.22)"; // the furrow beside it
        ctx.fillRect(box.top.x + 5, y + rowH * 0.55, box.top.w - 10, 1.2);
      }
    }
    if (plot && !plot.dry) {
      ctx.fillStyle = "rgba(120, 170, 220, 0.16)";
      ctx.fillRect(box.top.x + 3, box.top.y + 3, box.top.w - 6, box.top.h - 5);
    }
    if (yardSeason() === "winter" && !plot) {
      ctx.fillStyle = "rgba(244, 248, 251, 0.85)";
      roundRectPath(ctx, box.top.x + 2, box.top.y + 1, box.top.w - 4, box.top.h - 2, 4);
      ctx.fill();
    }
    if (!plot) return;
    const t = performance.now() / 1000;
    // Two rows of plants (big crops like pumpkins get fewer, wider apart).
    const perRow = plot.look === "pumpkin" || plot.look === "flower" ? 2 : 3;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < perRow; i++) {
        const x = box.top.x + ((i + 0.5 + (row ? 0.25 : -0.1)) * box.top.w) / perRow;
        const y = box.top.y + box.top.h * (row ? 0.88 : 0.45);
        drawCropPlant(ctx, x, y, plot.look, plot.color, plot.stage, Math.sin(t * 1.3 + f.bed + i + row) * 0.05, i);
      }
    }
    // The owner's stake at the bed's back corner, with a sparkle when ripe.
    const sx = box.top.x + box.top.w - 6, sy = box.top.y + 4;
    ctx.fillStyle = "#c8a878";
    ctx.fillRect(sx - 1, sy - 12, 2, 12);
    ctx.fillStyle = plot.ownerColor;
    roundRectPath(ctx, sx - 5, sy - 17, 10, 7, 2);
    ctx.fill();
    if (plot.stage === 4) {
      const s = 2 + Math.sin(t * 4 + f.bed) * 1.2;
      ctx.fillStyle = "rgba(255, 245, 190, 0.95)";
      const px = box.top.x + 8, py = box.top.y - 6;
      ctx.beginPath();
      ctx.moveTo(px, py - s * 2);
      ctx.lineTo(px + s * 0.6, py - s * 0.6);
      ctx.lineTo(px + s * 2, py);
      ctx.lineTo(px + s * 0.6, py + s * 0.6);
      ctx.lineTo(px, py + s * 2);
      ctx.lineTo(px - s * 0.6, py + s * 0.6);
      ctx.lineTo(px - s * 2, py);
      ctx.lineTo(px - s * 0.6, py - s * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    // A droplet when it's dry and could use water.
    if (plot.dry && plot.stage < 4) {
      const bob = Math.sin(t * 2.5 + f.bed) * 1.5;
      ctx.fillStyle = "rgba(90, 150, 220, 0.9)";
      const dx = box.top.x + box.top.w / 2, dy = box.top.y - 14 + bob;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 5);
      ctx.quadraticCurveTo(dx + 4, dy, dx, dy + 3);
      ctx.quadraticCurveTo(dx - 4, dy, dx, dy - 5);
      ctx.fill();
    }
  },

  // Hazel's seed stand: a little wooden market stall with a striped
  // awning, seed packets on the counter and a chalkboard price sign.
  seedStand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#a0764c");
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE;
    // Posts up to the awning.
    ctx.fillStyle = "#7a5436";
    ctx.fillRect(a.x + 2, box.top.y - 34, 4, 34);
    ctx.fillRect(a.x + w - 6, box.top.y - 34, 4, 34);
    // Seed packets and a few pots on the counter.
    const colors = CONFIG.crops.map((c) => c.color);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#f4ead4";
      ctx.fillRect(box.top.x + 6 + i * 10, box.top.y + 2, 8, 10);
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(box.top.x + 10 + i * 10, box.top.y + 7, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // The awning: cream and green stripes, with a scalloped edge.
    const ay = box.top.y - 40;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? "#f4efe4" : "#6a9a5a";
      ctx.fillRect(a.x - 4 + (i * (w + 8)) / 7, ay, (w + 8) / 7 + 0.5, 10);
      ctx.beginPath();
      ctx.arc(a.x - 4 + ((i + 0.5) * (w + 8)) / 7, ay + 10, (w + 8) / 14, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(a.x - 4, ay, w + 8, 2);
    // A little sign: "SEEDS".
    ctx.fillStyle = "#3a3a36";
    roundRectPath(ctx, a.x + w / 2 - 16, box.face.y + 4, 32, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#f4efe4";
    ctx.font = "700 8px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SEEDS", a.x + w / 2, box.face.y + 12.5);
    ctx.textAlign = "left";
    // Once Hazel's moved to her farm: a little tag hanging off the awning,
    // and an honesty jar for crumbs.
    if (!HAZEL.atFarm) return;
    const tx = a.x + w - 14, ty = ay + 12;
    ctx.strokeStyle = "#6e5440";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(tx - 6, ty);
    ctx.lineTo(tx, ty + 6);
    ctx.lineTo(tx + 6, ty);
    ctx.stroke();
    ctx.fillStyle = "#6e5440";
    roundRectPath(ctx, tx - 17, ty + 5, 34, 13, 2);
    ctx.fill();
    ctx.fillStyle = "#f2e6c8";
    roundRectPath(ctx, tx - 16, ty + 6, 32, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#4f7a3f";
    ctx.font = "800 6.5px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SELF SERVE", tx, ty + 13.8);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(200, 225, 235, 0.75)";
    roundRectPath(ctx, box.top.x + box.top.w - 12, box.top.y - 7, 8, 9, 2);
    ctx.fill();
    ctx.fillStyle = "#e3a954";
    ctx.fillRect(box.top.x + box.top.w - 11, box.top.y - 3, 6, 4);
  },

  // Hazel the hedgehog, the gardener: spiky and round, in a straw hat and
  // a green apron, holding a little watering can.
  hazel(ctx, f) {
    if (f.place && !hazelHere(f)) return; // (in the yard or at the Farm: see HAZEL in world.js)
    const t = performance.now() / 1000;
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const bx = b.x, by = b.y - Math.abs(Math.sin(t * 1.5)) * 1.2;
    // Feet.
    ctx.fillStyle = "#5c4030";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + side * 5, b.y - 2, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spiky back (behind the body).
    ctx.fillStyle = "#6a4a36";
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.95 + (i / 10) * 1.1);
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * 11, by - 18 + Math.sin(a) * 13);
      ctx.lineTo(bx + Math.cos(a) * 19, by - 18 + Math.sin(a) * 20);
      ctx.lineTo(bx + Math.cos(a + 0.2) * 11, by - 18 + Math.sin(a + 0.2) * 13);
      ctx.fill();
    }
    // Round body, lit from above.
    const body = ctx.createLinearGradient(0, by - 34, 0, by - 4);
    body.addColorStop(0, "#9a7456");
    body.addColorStop(1, "#7a5840");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(bx, by - 18, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Apron.
    ctx.fillStyle = "#6a9a5a";
    roundRectPath(ctx, bx - 8, by - 20, 16, 15, 4);
    ctx.fill();
    ctx.fillStyle = "#58844a";
    ctx.fillRect(bx - 5, by - 14, 10, 5);
    // Cream face.
    ctx.fillStyle = "#ecd8bc";
    ctx.beginPath();
    ctx.ellipse(bx, by - 25, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = t % 5 < 0.12;
    ctx.fillStyle = "#2a1e18";
    if (blink) {
      ctx.fillRect(bx - 4.5, by - 26.5, 3, 1);
      ctx.fillRect(bx + 1.5, by - 26.5, 3, 1);
    } else {
      ctx.beginPath();
      ctx.arc(bx - 3, by - 26.5, 1.4, 0, Math.PI * 2);
      ctx.arc(bx + 3, by - 26.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(bx, by - 23, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(230, 120, 120, 0.45)";
    ctx.beginPath();
    ctx.arc(bx - 5.5, by - 23.5, 1.8, 0, Math.PI * 2);
    ctx.arc(bx + 5.5, by - 23.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Straw hat with a red band.
    ctx.fillStyle = "#e0c070";
    ctx.beginPath();
    ctx.ellipse(bx, by - 31, 15, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, bx - 7, by - 39, 14, 9, 4);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(bx - 7, by - 33.5, 14, 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(bx - 6, by - 38, 5, 1.5);
    // A little watering can in one paw.
    ctx.fillStyle = "#7aa0b8";
    roundRectPath(ctx, bx + 10, by - 16, 8, 7, 2);
    ctx.fill();
    ctx.fillRect(bx + 17, by - 15, 5, 1.8);
    ctx.fillStyle = "#ecd8bc";
    ctx.beginPath();
    ctx.arc(bx + 10, by - 13, 2.4, 0, Math.PI * 2);
    ctx.fill();
  },

  // --- The bins (the yard's), which the raccoons also keep in their alley ---

  // Two metal trash cans with lids (one lid slightly askew).
  trashCans(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    for (const [dx, tilt] of [[9, 0], [27, -0.18]]) {
      const x = b.x + dx, y = b.y - 2;
      const can = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      can.addColorStop(0, "#8a9298");
      can.addColorStop(0.5, "#b4bcc2");
      can.addColorStop(1, "#7a8288");
      ctx.fillStyle = can;
      ctx.fillRect(x - 8, y - 22, 16, 22);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      for (const ry of [y - 16, y - 8]) ctx.fillRect(x - 8, ry, 16, 1.5);
      ctx.save();
      ctx.translate(x, y - 23);
      ctx.rotate(tilt);
      ctx.fillStyle = "#9aa2a8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a7278";
      ctx.fillRect(-3, -4, 6, 2);
      ctx.restore();
    }
    // A banana peel flopped by the cans.
    ctx.fillStyle = "#e8c84a";
    ctx.beginPath();
    ctx.ellipse(b.x + 18, b.y + 1, 4, 1.8, 0.4, 0, Math.PI * 2);
    ctx.fill();
  },

  // A big green dumpster with its lid propped open (someone's been in it).
  dumpster(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#3f6a4a");
    // The lid, propped open at the back.
    ctx.fillStyle = "#355a3e";
    ctx.beginPath();
    ctx.moveTo(box.top.x - 2, box.top.y + 2);
    ctx.lineTo(box.top.x + box.top.w + 2, box.top.y + 2);
    ctx.lineTo(box.top.x + box.top.w - 2, box.top.y - 14);
    ctx.lineTo(box.top.x + 2, box.top.y - 14);
    ctx.closePath();
    ctx.fill();
    // Rubbish peeking over the rim.
    ctx.fillStyle = "#2a2a2e";
    ctx.fillRect(box.top.x + 3, box.top.y + 3, box.top.w - 6, box.top.h - 4);
    for (const [dx, c] of [[10, "#e8e0cc"], [24, "#6a8ab0"], [38, "#c8a060"], [52, "#e05a5a"]]) {
      ctx.fillStyle = c;
      ctx.fillRect(box.top.x + dx, box.top.y + 2, 8, 5);
    }
    // Rust streaks, a stencilled label and little wheels.
    ctx.fillStyle = "rgba(150, 90, 50, 0.4)";
    ctx.fillRect(box.face.x + 8, box.face.y + 4, 2, 12);
    ctx.fillRect(box.face.x + box.face.w - 14, box.face.y + 6, 2, 9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOT A SHOP", box.face.x + box.face.w / 2, box.face.y + 13);
    ctx.textAlign = "left";
    ctx.fillStyle = "#2a2a2e";
    for (const x of [box.face.x + 6, box.face.x + box.face.w - 10]) ctx.fillRect(x, box.face.y + box.face.h - 1, 4, 3);
  },

  // A heap of tied-up trash bags, and a fish skeleton.
  trashBags(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, dy, r, c] of [[-8, -7, 8, "#3a3a40"], [7, -6, 7, "#46464e"], [0, -13, 7, "#303036"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(b.x + dx, b.y + dy, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.ellipse(b.x + dx - r * 0.35, b.y + dy - r * 0.4, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#e8e0cc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 10, b.y + 2);
    ctx.lineTo(b.x + 20, b.y + 2);
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(b.x + 12 + i * 3, b.y);
      ctx.lineTo(b.x + 12 + i * 3, b.y + 4);
    }
    ctx.stroke();
  },

  // A wonky cardboard sign on a stick: "totally normal trash".
  shadySign(ctx, f) {
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8a6444";
    ctx.fillRect(b.x - 1.5, b.y - 22, 3, 22);
    ctx.save();
    ctx.translate(b.x, b.y - 26);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#c8a870";
    ctx.fillRect(-24, -8, 48, 15);
    ctx.fillStyle = "#4a3222";
    ctx.font = "700 6.5px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    // (Its words: "totally normal trash", unless it says otherwise.)
    const [one, two] = f.lines ?? ["totally normal", "trash"];
    ctx.fillText(one, 0, -1.5);
    ctx.fillText(two, 0, 5);
    ctx.restore();
    ctx.textAlign = "left";
  },

  // An umbrella stand by the hallway's east corner (inside the house).
  umbrellaStand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, h, c] of [[-4, 34, "#c0554a"], [3, 38, "#3f6f9f"], [0, 30, "#e0b84c"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + dx, b.y - 8);
      ctx.lineTo(b.x + dx * 1.6, b.y - h);
      ctx.stroke();
      ctx.strokeStyle = "#4a3a2c";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x + dx * 1.6 + 2.5, b.y - h, 2.5, Math.PI, 0);
      ctx.stroke();
    }
    const stand = ctx.createLinearGradient(b.x - 8, 0, b.x + 8, 0);
    stand.addColorStop(0, "#6a4a30");
    stand.addColorStop(0.5, "#9a7050");
    stand.addColorStop(1, "#6a4a30");
    ctx.fillStyle = stand;
    ctx.fillRect(b.x - 8, b.y - 18, 16, 17);
    ctx.fillStyle = "#4a3222";
    ctx.fillRect(b.x - 9, b.y - 19, 18, 2);
  },
});

// --- Fishing (Update 4, step 4) ---
// Where the rod tip is for someone fishing: up and out from their hands,
// leaning toward the bobber.
function rodTip(p) {
  const hand = toScreen(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE);
  const bob = toScreen(p.fishing.bx, p.fishing.by);
  const d = Math.hypot(bob.x - hand.x, bob.y - hand.y) || 1;
  const hx = hand.x + ((bob.x - hand.x) / d) * 6, hy = hand.y - 20;
  return { hx, hy, tx: hx + ((bob.x - hand.x) / d) * 20, ty: hy - 16 + ((bob.y - hand.y) / d) * 6 };
}

// The rod in your hands, and the line down to the bobber (sagging a little).
function drawFishingLine(ctx, p) {
  const { hx, hy, tx, ty } = rodTip(p);
  const bob = toScreen(p.fishing.bx, p.fishing.by);
  ctx.strokeStyle = "#7a5436";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.strokeStyle = "rgba(250, 250, 250, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.quadraticCurveTo((tx + bob.x) / 2, Math.max(ty, bob.y) + (p.fishing.bite ? -4 : 8), bob.x, bob.y - 3);
  ctx.stroke();
}

// The red and white bobber, bobbing gently with rings on the water, or
// dipping and splashing when a fish bites (with a "!" over you).
function drawBobber(ctx, p) {
  const t = performance.now() / 1000;
  const bob = toScreen(p.fishing.bx, p.fishing.by);
  const bite = p.fishing.bite;
  // A bite dips it hard; a nibble gives it a quick little twitch.
  const dip = bite ? Math.abs(Math.sin(t * 14)) * 3 : p.fishing.nibble ? Math.abs(Math.sin(t * 30)) * 1.8 : Math.sin(t * 2) * 1;
  const ring = (t * (bite ? 1.6 : 0.6)) % 1;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - ring)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(bob.x, bob.y, 5 + ring * 12, 2 + ring * 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f4f4f0";
  ctx.beginPath();
  ctx.arc(bob.x, bob.y - 2 + dip, 3.6, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#d8404a";
  ctx.beginPath();
  ctx.arc(bob.x, bob.y - 2 + dip, 3.6, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#2b2b30";
  ctx.fillRect(bob.x - 0.5, bob.y - 8 + dip, 1, 3);
  if (bite) {
    const head = toScreen(p.x + PLAYER_SIZE / 2, p.y);
    const pop = 1 + Math.abs(Math.sin(t * 8)) * 0.15;
    ctx.save();
    ctx.translate(head.x, head.y - 42);
    ctx.scale(pop, pop);
    ctx.fillStyle = "#fff7e6";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c0554a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#c0554a";
    ctx.font = "800 15px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, 5.5);
    ctx.restore();
    ctx.textAlign = "left";
  }
}

Object.assign(FURNITURE_DRAWERS, {
  // Otis's bait stand: a wooden crate with a cooler on top, a bucket of
  // worms and a hand-painted "BAIT" sign.
  baitCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#9a7250");
    ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
    for (let i = 1; i < 3; i++) ctx.fillRect(box.face.x, box.face.y + (box.face.h * i) / 3, box.face.w, 1);
    // The cooler.
    const cx = box.top.x + 6, cy = box.top.y - 10;
    ctx.fillStyle = "#4a8ab8";
    roundRectPath(ctx, cx, cy, 22, 14, 3);
    ctx.fill();
    ctx.fillStyle = "#f4f4f0";
    ctx.fillRect(cx, cy, 22, 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(cx + 2, cy + 6, 3, 6);
    // A bucket of worms.
    const bx = box.top.x + box.top.w - 12, by = box.top.y + 6;
    ctx.fillStyle = "#8a9298";
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - 12);
    ctx.lineTo(bx + 7, by - 12);
    ctx.lineTo(bx + 5, by);
    ctx.lineTo(bx - 5, by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e08a8a";
    ctx.lineWidth = 1.6;
    const t = performance.now() / 1000;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - 4 + i * 4, by - 12);
      ctx.quadraticCurveTo(bx - 3 + i * 4 + Math.sin(t * 3 + i) * 2, by - 17, bx - 2 + i * 4, by - 14);
      ctx.stroke();
    }
    // The sign.
    ctx.fillStyle = "#f4ead4";
    roundRectPath(ctx, box.face.x + box.face.w / 2 - 14, box.face.y + 3, 28, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#3f6f9f";
    ctx.font = "800 8px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BAIT", box.face.x + box.face.w / 2, box.face.y + 11);
    ctx.textAlign = "left";
  },

  // Otis the otter: sleek and brown with a cream face, a yellow rain hat
  // and a little fish in his paws.
  // Otis's self-serve bait box at the pond (once he's moved to the Lake):
  // a little wooden box on a post, a jar for crumbs, and his note.
  baitBox(ctx, f) {
    if (!OTIS.atLake) return;
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#6b4a30";
    ctx.fillRect(b.x - 2.5, b.y - 20, 5, 20);
    const box = ctx.createLinearGradient(0, b.y - 40, 0, b.y - 20);
    box.addColorStop(0, "#b8844e");
    box.addColorStop(1, "#8a6038");
    ctx.fillStyle = box;
    roundRectPath(ctx, b.x - 13, b.y - 40, 26, 20, 3);
    ctx.fill();
    ctx.fillStyle = "#6b4426";
    ctx.fillRect(b.x - 14, b.y - 42, 28, 4);
    ctx.fillStyle = "#f2e2c0";
    ctx.fillRect(b.x - 9, b.y - 35, 18, 9);
    // (A little pink worm painted on its label.)
    ctx.strokeStyle = "#d9788a";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) ctx[i ? "lineTo" : "moveTo"](b.x - 6 + i, b.y - 30.5 + Math.sin(i * 0.9) * 1.6);
    ctx.stroke();
    // The honesty jar, and Otis's note pinned to the post.
    ctx.fillStyle = "rgba(200, 225, 235, 0.7)";
    roundRectPath(ctx, b.x + 9, b.y - 48, 7, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#e3a954";
    ctx.fillRect(b.x + 10, b.y - 44, 5, 3);
    ctx.fillStyle = "#fbf6ea";
    ctx.save();
    ctx.translate(b.x - 1, b.y - 15);
    ctx.rotate(-0.08);
    ctx.fillRect(-6, 0, 12, 9);
    ctx.fillStyle = "rgba(90, 70, 50, 0.5)";
    for (const y of [2.5, 5, 7]) ctx.fillRect(-4.5, y, 9, 0.8);
    ctx.restore();
  },

  otis(ctx, f) {
    if (f.place && !otisHere(f)) return; // (at the pond or the Lake: see OTIS in world.js)
    const t = performance.now() / 1000;
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const bx = b.x, by = b.y;
    // Tail, swishing.
    ctx.strokeStyle = "#6a4a30";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx + 6, by - 5);
    ctx.quadraticCurveTo(bx + 16, by - 4, bx + 18 + Math.sin(t * 2.2) * 3, by - 12);
    ctx.stroke();
    ctx.lineCap = "butt";
    // Feet.
    ctx.fillStyle = "#4a3222";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + side * 4.5, by - 2, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(t * 1.4) * 0.03);
    // Long body, lit from above.
    const body = ctx.createLinearGradient(0, -44, 0, -4);
    body.addColorStop(0, "#8a6444");
    body.addColorStop(1, "#6a4a30");
    ctx.fillStyle = body;
    roundRectPath(ctx, -10, -40, 20, 38, 10);
    ctx.fill();
    // Cream belly and face.
    ctx.fillStyle = "#e8d4b4";
    ctx.beginPath();
    ctx.ellipse(0, -18, 6.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a5638";
    ctx.beginPath();
    ctx.arc(0, -42, 10, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 8, -49, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e8d4b4";
    ctx.beginPath();
    ctx.ellipse(0, -38.5, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = t % 4.5 < 0.12;
    ctx.fillStyle = "#1e1a18";
    if (blink) {
      ctx.fillRect(-5, -44, 3, 1);
      ctx.fillRect(2, -44, 3, 1);
    } else {
      ctx.beginPath();
      ctx.arc(-3.5, -43.5, 1.5, 0, Math.PI * 2);
      ctx.arc(3.5, -43.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, -39.5, 2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Whiskers.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 0.7;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3, -38.5);
      ctx.lineTo(side * 11, -40);
      ctx.moveTo(side * 3, -37.5);
      ctx.lineTo(side * 11, -36.5);
      ctx.stroke();
    }
    // Yellow rain hat.
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.ellipse(0, -50, 14, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, -8, -58, 16, 9, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(-6, -57, 5, 1.5);
    // A fish in his paws.
    ctx.fillStyle = "#8ab0d0";
    ctx.beginPath();
    ctx.ellipse(0, -26, 7, 3, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -26);
    ctx.lineTo(11, -29);
    ctx.lineTo(11, -23);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7a5638";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 5, -25, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
});

// --- The campfire (Update 4, step 5) ---
// Is the campfire burning? It lights itself at night.
function campfireLit() {
  return isNightOutside();
}

Object.assign(FURNITURE_DRAWERS, {
  // A ring of stones with logs inside. At night: dancing flames, sparks
  // drifting up and a warm glow (the glow itself is in drawOutdoorLight).
  // By day: cold logs and a thin curl of smoke.
  firePit(ctx, f) {
    const t = performance.now() / 1000;
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    const rx = (f.w / 2) * TILE, ry = (f.h / 2) * TILE;
    // Ash bed.
    ctx.fillStyle = "#5a4a40";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx * 0.8, ry * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stones round the edge (back half first, the front ones after the fire).
    const stone = (i) => {
      const a = (i / 12) * Math.PI * 2;
      const x = c.x + Math.cos(a) * rx * 0.92, y = c.y + Math.sin(a) * ry * 0.9;
      ctx.fillStyle = ["#8a847a", "#a09a8e", "#77716a"][i % 3];
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 6.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.beginPath();
      ctx.ellipse(x - 1.5, y - 5.5, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 6; i < 12; i++) stone(i);
    // Crossed logs.
    ctx.lineCap = "round";
    for (const [dx, tilt] of [[-4, 0.5], [4, -0.5], [0, 0]]) {
      ctx.strokeStyle = "#6a4428";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(c.x + dx - Math.cos(tilt) * 13, c.y - 2 + Math.sin(tilt) * 5);
      ctx.lineTo(c.x + dx + Math.cos(tilt) * 13, c.y - 2 - Math.sin(tilt) * 5);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    if (campfireLit()) {
      // Flames: layered teardrops that flicker.
      for (const [color, scale, speed] of [["#e0503a", 1, 7], ["#f29a3a", 0.75, 9], ["#ffd970", 0.45, 11]]) {
        ctx.fillStyle = color;
        for (let i = -1; i <= 1; i++) {
          const h = (30 + Math.sin(t * speed + i * 2.3) * 6 + noise(i + 5) * 6) * scale * (i === 0 ? 1.2 : 0.8);
          const w = 9 * scale;
          const x = c.x + i * 7 * scale + Math.sin(t * speed * 0.7 + i) * 1.5;
          const y = c.y - 2;
          ctx.beginPath();
          ctx.moveTo(x - w, y);
          ctx.quadraticCurveTo(x - w, y - h * 0.5, x + Math.sin(t * 5 + i) * 3, y - h);
          ctx.quadraticCurveTo(x + w, y - h * 0.5, x + w, y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Sparks drifting up.
      for (let i = 0; i < 7; i++) {
        const life = (t * 0.6 + noise(i * 3.1)) % 1;
        const x = c.x + (noise(i * 7.7) - 0.5) * 22 + Math.sin(t * 3 + i) * 4 * life;
        const y = c.y - 20 - life * 55;
        ctx.fillStyle = `rgba(255, ${190 + Math.round(60 * (1 - life))}, 110, ${1 - life})`;
        ctx.fillRect(x, y, 2, 2);
      }
      drawGlow(ctx, c.x, c.y - 14, 34, "rgba(255, 170, 80, 0.35)");
    } else {
      // A few glowing embers and a curl of smoke.
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(230, 110, 50, ${0.4 + 0.3 * Math.sin(t * 2 + i)})`;
        ctx.fillRect(c.x - 8 + i * 5, c.y - 3 + (i % 2) * 2, 2.5, 2);
      }
      for (let i = 0; i < 5; i++) {
        const life = (t * 0.25 + i / 5) % 1;
        ctx.fillStyle = `rgba(220, 220, 225, ${0.35 * (1 - life)})`;
        ctx.beginPath();
        ctx.arc(c.x + Math.sin(life * 6 + i) * 5 * life, c.y - 8 - life * 50, 3 + life * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 6; i++) stone(i);
  },

  // A log lying along the page, to sit on: bark, a cut end, knots.
  logSeat(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const h = b.y - a.y + 8, y = b.y - h;
    const bark = ctx.createLinearGradient(0, y, 0, b.y);
    bark.addColorStop(0, "#9a7050");
    bark.addColorStop(1, "#6a4830");
    ctx.fillStyle = bark;
    roundRectPath(ctx, a.x + 3, y, b.x - a.x - 6, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 35, 20, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = a.x + 12 + noise(f.x * 3 + i) * (b.x - a.x - 30);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + 10, y + 4);
      ctx.stroke();
    }
    // Cut ends showing their rings.
    for (const x of [a.x + 3 + h / 4, b.x - 3 - h / 4]) {
      ctx.fillStyle = "#d8b888";
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, h / 4, h / 2 - 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a88458";
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, h / 8, h / 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 240, 210, 0.2)";
    ctx.fillRect(a.x + h / 2, y + 2, b.x - a.x - h, 2);
  },

  // A log running down the page (seen end on at the bottom).
  logSeatSide(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    ctx.fillStyle = "#7a5638";
    roundRectPath(ctx, a.x, a.y - 8, w, b.y - a.y, w / 2);
    ctx.fill();
    ctx.fillStyle = "#9a7050";
    ctx.fillRect(a.x + 4, a.y - 6, w - 8, b.y - a.y - 10);
    ctx.fillStyle = "#d8b888";
    ctx.beginPath();
    ctx.ellipse(a.x + w / 2, b.y - 8, w / 2 - 1, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a88458";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(a.x + w / 2, b.y - 8, w / 4, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
});

// --- The porch swing (Update 4, step 6) ---
// How far the swing (and whoever's on it) has swung toward or away from
// you right now, in grid units. Still when nobody's sitting on it; eases
// in and out so it doesn't jerk.
let swingEnergy = 0;
let swingLast = performance.now();
function porchSwingSway() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - swingLast) / 1000);
  swingLast = now;
  swingEnergy += ((globalThis.porchSwingBusy ? 1 : 0) - swingEnergy) * (1 - Math.pow(0.3, dt));
  return Math.sin(now / 1000 * 1.7) * 0.13 * swingEnergy;
}

FURNITURE_DRAWERS.porchSwing = (ctx, f) => {
  const sway = porchSwingSway() * TILE; // pixels, toward (+) or away from (-) you
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
  const w = b.x - a.x;
  const seatY = b.y - 10 + sway, backTop = seatY - 26;
  // Chains up to the porch ceiling (off the top of the view), a little
  // longer or shorter as it swings.
  ctx.strokeStyle = "#6a6a70";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  for (const x of [a.x + 6, b.x - 6]) {
    ctx.beginPath();
    ctx.moveTo(x, a.y - 58);
    ctx.lineTo(x, backTop + 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // The back: slats between two rails.
  ctx.fillStyle = "#b08a5e";
  ctx.fillRect(a.x + 4, backTop, w - 8, 4);
  for (let x = a.x + 8; x < b.x - 8; x += 9) ctx.fillRect(x, backTop + 3, 5, 18);
  ctx.fillStyle = "#9a7650";
  ctx.fillRect(a.x + 4, backTop + 18, w - 8, 3);
  // The seat, with a cushion and a little throw pillow.
  ctx.fillStyle = "#8a6444";
  ctx.fillRect(a.x + 2, seatY - 4, w - 4, 9);
  ctx.fillStyle = "#c8d8b8";
  roundRectPath(ctx, a.x + 5, seatY - 7, w - 10, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#e0a0a0";
  roundRectPath(ctx, b.x - 22, backTop + 8, 13, 12, 4);
  ctx.fill();
  // Armrests.
  ctx.fillStyle = "#7a5638";
  for (const x of [a.x + 2, b.x - 7]) ctx.fillRect(x, seatY - 16, 5, 14);
  ctx.fillStyle = "rgba(255, 240, 210, 0.25)";
  ctx.fillRect(a.x + 4, backTop, w - 8, 1.5);
};

// --- The bus stop (Update 4, step 7) ---
const BUS_LENGTH = 4.4;
const BUS_STOP_X = 14.8; // where its left end stops: just left of the shelter (not in front of it), its door by the gate
// The bus is always parked at the stop now (trips to the Lake and the
// Farm leave whenever you like), so it's simply "waiting", with its door open.
function busState() {
  return { phase: "waiting", x: BUS_STOP_X };
}

Object.assign(FURNITURE_DRAWERS, {
  // A cute little bus, seen from the side: cream and teal, round windows,
  // a door in the middle (open while it waits), and headlights at night.
  bus(ctx, f) {
    const bus = busState();
    const t = performance.now() / 1000;
    const a = toScreen(f.stopX ?? bus.x, f.y + f.h); // (stopX: where it parks at the Lake)
    const w = BUS_LENGTH * TILE, h = 50;
    const moving = bus.phase !== "waiting";
    const bob = moving ? Math.sin(t * 18) * 0.8 : 0;
    const x = a.x, base = a.y - 4, top = base - h + bob;
    // Shadow on the road.
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, base + 2, w / 2 + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: teal below, cream above, rounded.
    ctx.fillStyle = "#4f9a9a";
    roundRectPath(ctx, x, top, w, h - 6, 12);
    ctx.fill();
    ctx.fillStyle = "#f4ead4";
    roundRectPath(ctx, x + 2, top + 2, w - 4, 26, 10);
    ctx.fill();
    ctx.fillStyle = "#e0b84c"; // a stripe
    ctx.fillRect(x + 2, top + 28, w - 4, 4);
    // Windows (a friendly face at the driver's window, at the front).
    for (let i = 0; i < 5; i++) {
      const wx = x + 12 + i * ((w - 30) / 5);
      if (i === 2) continue; // the door goes here
      ctx.fillStyle = "#9cc8dc";
      roundRectPath(ctx, wx, top + 6, (w - 30) / 5 - 6, 16, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(wx + 3, top + 8, 3, 10);
    }
    const driverX = x + 12 + 4 * ((w - 30) / 5) + 10;
    ctx.fillStyle = "#8a6444"; // Gus the bear, driving
    ctx.beginPath();
    ctx.arc(driverX, top + 16, 5.5, 0, Math.PI * 2);
    ctx.arc(driverX - 4, top + 11, 2.2, 0, Math.PI * 2);
    ctx.arc(driverX + 4, top + 11, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(driverX - 6, top + 8, 12, 3); // his cap
    // The door: folded open while it waits.
    const doorX = x + 12 + 2 * ((w - 30) / 5), doorW = (w - 30) / 5 - 6;
    ctx.fillStyle = bus.phase === "waiting" ? "#f2c98a" : "#7ab0c8";
    ctx.fillRect(doorX, top + 6, doorW, h - 14);
    ctx.strokeStyle = "#3a6a6a";
    ctx.lineWidth = 1.5;
    if (bus.phase === "waiting") {
      ctx.strokeRect(doorX, top + 6, 3, h - 14);
      ctx.strokeRect(doorX + doorW - 3, top + 6, 3, h - 14);
    } else {
      ctx.beginPath();
      ctx.moveTo(doorX + doorW / 2, top + 6);
      ctx.lineTo(doorX + doorW / 2, base - 8);
      ctx.stroke();
    }
    // Wheels, turning while it drives.
    for (const wx of [x + 22, x + w - 24]) {
      ctx.fillStyle = "#2b2b30";
      ctx.beginPath();
      ctx.arc(wx, base - 4, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8b8c0";
      ctx.beginPath();
      ctx.arc(wx, base - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      const spin = moving ? t * 12 : 0;
      ctx.strokeStyle = "#6a6a70";
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(spin) * 4, base - 4 + Math.sin(spin) * 4);
      ctx.lineTo(wx - Math.cos(spin) * 4, base - 4 - Math.sin(spin) * 4);
      ctx.stroke();
    }
    // Lights: headlight at the front (right), a red tail light at the back.
    const night = isNightOutside();
    ctx.fillStyle = night ? "#fff2b0" : "#f4e8c0";
    ctx.beginPath();
    ctx.arc(x + w - 4, top + 36, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (night) drawGlow(ctx, x + w + 10, top + 38, 30, "rgba(255, 240, 170, 0.5)");
    ctx.fillStyle = "#d8404a";
    ctx.fillRect(x + 1, top + 33, 3, 6);
    // The route sign over the windscreen.
    ctx.fillStyle = "#2b2b30";
    roundRectPath(ctx, x + w / 2 - 26, top - 9, 52, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#f2c94c";
    ctx.font = "700 7.5px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(floorOf(f.y) === YARD_FLOOR ? "LAKE · FARM" : "HOME", x + w / 2, top - 1);
    ctx.textAlign = "left";
  },

  // A bus shelter: a glass back panel, a curved roof and a wooden bench.
  busShelter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    const roofY = b.y - 70;
    // Posts.
    ctx.fillStyle = "#4a5a6a";
    for (const x of [a.x + 3, b.x - 7]) ctx.fillRect(x, roofY, 4, b.y - roofY - 2);
    // Glass back panel, with a little poster.
    ctx.fillStyle = "rgba(170, 210, 230, 0.55)";
    ctx.fillRect(a.x + 7, roofY + 6, w - 14, b.y - roofY - 30);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(a.x + 11, roofY + 9, 3, b.y - roofY - 38);
    ctx.fillStyle = "#f4ead4";
    ctx.fillRect(b.x - 38, roofY + 12, 22, 26);
    ctx.fillStyle = "#e0883a";
    ctx.beginPath();
    ctx.arc(b.x - 27, roofY + 21, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a9a5a";
    ctx.fillRect(b.x - 36, roofY + 28, 18, 6);
    // Bench.
    const benchY = b.y - 18;
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(a.x + 9, benchY, w - 18, 6);
    ctx.fillStyle = "#a87a52";
    ctx.fillRect(a.x + 9, benchY, w - 18, 2);
    ctx.fillStyle = "#4a5a6a";
    for (const x of [a.x + 14, b.x - 17]) ctx.fillRect(x, benchY + 6, 3, 10);
    // Curved roof.
    ctx.fillStyle = "#3f6f7f";
    ctx.beginPath();
    ctx.moveTo(a.x - 4, roofY + 4);
    ctx.quadraticCurveTo(a.x + w / 2, roofY - 12, b.x + 4, roofY + 4);
    ctx.lineTo(b.x + 4, roofY + 8);
    ctx.quadraticCurveTo(a.x + w / 2, roofY - 6, a.x - 4, roofY + 8);
    ctx.closePath();
    ctx.fill();
    if (yardSeason() === "winter") {
      ctx.fillStyle = "#f4f8fb";
      ctx.beginPath();
      ctx.moveTo(a.x - 2, roofY + 2);
      ctx.quadraticCurveTo(a.x + w / 2, roofY - 15, b.x + 2, roofY + 2);
      ctx.quadraticCurveTo(a.x + w / 2, roofY - 10, a.x - 2, roofY + 2);
      ctx.fill();
    }
  },

  // The bus stop sign: a pole with a round "BUS" sign and a timetable
  // board that counts down to the next bus.
  busSign(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#6a7078";
    ctx.fillRect(b.x - 1.5, b.y - 70, 3, 70);
    ctx.fillStyle = "#3f6f9f";
    ctx.beginPath();
    ctx.arc(b.x, b.y - 72, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4f4f0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#f4f4f0";
    ctx.font = "800 8px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUS", b.x, b.y - 69);
    // The board: where the bus goes.
    const text = "Trips";
    ctx.fillStyle = "#2b2b30";
    roundRectPath(ctx, b.x - 22, b.y - 52, 44, 22, 3);
    ctx.fill();
    ctx.fillStyle = "#f2c94c";
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.fillText(text, b.x, b.y - 43);
    ctx.fillStyle = "#c8c8d0";
    ctx.font = "600 6px 'Quicksand', sans-serif";
    ctx.fillText(floorOf(f.y) === YARD_FLOOR ? "Lake · Farm" : "Home", b.x, b.y - 34);
    ctx.textAlign = "left";
  },
});

// --- Yard odds and ends (the cleanup pass) ---
// A scarecrow and a watering station in the garden, a birdbath, and the
// mailbox by the gate. Each stands on the grass with a soft shadow, lit
// from above.
Object.assign(FURNITURE_DRAWERS, {
  // A scarecrow on a post: a burlap head with button eyes and a stitched
  // smile under a straw hat, a patched plaid shirt, and straw hands.
  scarecrow(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h * 0.6);
    const sway = Math.sin(performance.now() / 1400 + f.x) * 0.03;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(sway);
    ctx.fillStyle = "#7a5238"; // the post and crossbar
    ctx.fillRect(-1.5, -40, 3, 40);
    ctx.fillRect(-16, -30, 32, 2.5);
    ctx.fillStyle = "#e3c26a"; // straw hands
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) ctx.fillRect(side * 16 - (side < 0 ? 4 : 0) + side * k * 0.5, -31 + k * 1.6, 4, 1.2);
    }
    ctx.fillStyle = "#c0554a"; // shirt
    roundRectPath(ctx, -11, -32, 22, 20, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 30, 25, 0.35)"; // plaid
    for (const px of [-6, 0, 6]) ctx.fillRect(px, -32, 1.5, 20);
    for (const py of [-26, -19]) ctx.fillRect(-11, py, 22, 1.5);
    ctx.fillStyle = "#6f8a6a"; // a patch
    ctx.fillRect(3, -22, 5, 5);
    ctx.fillStyle = "#d9b77a"; // burlap head
    ctx.beginPath();
    ctx.arc(0, -39, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a1e";
    ctx.beginPath();
    ctx.arc(-2.6, -40, 1.2, 0, Math.PI * 2);
    ctx.arc(2.6, -40, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2a1e";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, -38, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "#c9a24a"; // straw hat
    ctx.fillRect(-11, -45, 22, 2.5);
    roundRectPath(ctx, -6, -52, 12, 8, 3);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(-6, -46.5, 12, 1.5);
    ctx.restore();
  },

  // A wooden rain barrel (water on top) with two watering cans beside it.
  wateringStation(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const barrel = toScreen(f.x + 0.3, f.y + f.h);
    const bw = 22, bh = 24;
    ctx.fillStyle = "#8a5c3c";
    roundRectPath(ctx, barrel.x - bw / 2, barrel.y - bh, bw, bh, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (const sx of [-5, 0, 5]) ctx.fillRect(barrel.x + sx, barrel.y - bh + 2, 1, bh - 3);
    ctx.fillStyle = "#4a4a4a"; // hoops
    ctx.fillRect(barrel.x - bw / 2, barrel.y - bh + 5, bw, 2);
    ctx.fillRect(barrel.x - bw / 2, barrel.y - 7, bw, 2);
    ctx.fillStyle = "#6fa8c0"; // water
    ctx.beginPath();
    ctx.ellipse(barrel.x, barrel.y - bh + 1, bw / 2 - 1, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(barrel.x - 4, barrel.y - bh, 5, 1);
    for (const [cx, color] of [[0.72, "#6f9a5a"], [0.95, "#9aa4ae"]]) {
      const c = toScreen(f.x + cx, f.y + f.h);
      ctx.fillStyle = shadeColor(color, -15); // spout
      ctx.save();
      ctx.translate(c.x + 5, c.y - 8);
      ctx.rotate(-0.6);
      ctx.fillRect(0, -1, 9, 2.2);
      ctx.restore();
      ctx.fillStyle = color; // body
      roundRectPath(ctx, c.x - 6, c.y - 12, 12, 12, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(c.x - 5, c.y - 11, 10, 2);
      ctx.strokeStyle = shadeColor(color, -25); // handle
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 12, 4.5, Math.PI, 0);
      ctx.stroke();
    }
  },

  // A stone birdbath: a pedestal and a shallow bowl of water, with a
  // little bluebird on the rim (except in winter, when the water's ice).
  birdbath(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h * 0.6);
    ctx.fillStyle = "#a8a196"; // pedestal
    ctx.beginPath();
    ctx.moveTo(b.x - 7, b.y);
    ctx.lineTo(b.x - 3, b.y - 16);
    ctx.lineTo(b.x + 3, b.y - 16);
    ctx.lineTo(b.x + 7, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#948d82";
    ctx.fillRect(b.x - 8, b.y - 2, 16, 3);
    ctx.fillStyle = "#b8b1a6"; // bowl
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 18, 14, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = yardSeason() === "winter" ? "#dfeef4" : "#8fc3d6"; // water (or ice)
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 18.5, 11, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(b.x - 5, b.y - 20, 4, 1);
    if (yardSeason() !== "winter") {
      const bx = b.x + 10, by = b.y - 22 + (Math.sin(performance.now() / 700 + f.x) > 0.8 ? -1 : 0);
      ctx.fillStyle = "#5a8ac8"; // a bluebird
      ctx.beginPath();
      ctx.ellipse(bx, by, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + 3, by - 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8883a";
      ctx.fillRect(bx + 5, by - 2.8, 2, 1);
      ctx.fillStyle = "#f2b8a0";
      ctx.beginPath();
      ctx.ellipse(bx + 0.5, by + 0.8, 2.2, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A mailbox on a wooden post, with its little red flag up.
  mailbox(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h * 0.6);
    ctx.fillStyle = "#7a5238"; // post
    ctx.fillRect(b.x - 1.5, b.y - 20, 3, 20);
    ctx.fillStyle = "#5a7a9a"; // box, with a rounded top
    ctx.beginPath();
    ctx.moveTo(b.x - 9, b.y - 20);
    ctx.lineTo(b.x - 9, b.y - 27);
    ctx.arc(b.x, b.y - 27, 9, Math.PI, 0);
    ctx.lineTo(b.x + 9, b.y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(b.x - 7, b.y - 31, 6, 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(b.x - 9, b.y - 22, 18, 2);
    ctx.fillStyle = "#c0554a"; // the flag
    ctx.fillRect(b.x + 9, b.y - 33, 1.5, 11);
    ctx.fillRect(b.x + 9, b.y - 33, 6, 4);
  },
});

// --- Kitchen & Trade (Update 5) ---
Object.assign(FURNITURE_DRAWERS, {
  // The fortune cookie jar, on a little round table in the Dinner room: a
  // glass jar with a wooden lid, full of cookies.
  cookieJar(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    // The table: one leg on a round foot, and a round top.
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(b.x - 1.5, b.y - 18, 3, 16);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8784e";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 19, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cookies inside the glass (drawn first, so the glass tints them).
    const jy = b.y - 20;
    ctx.fillStyle = "#e0b060";
    for (const [dx, dy] of [[-4, -3], [3, -3], [-1, -7], [4, -9], [-4, -11]]) {
      ctx.beginPath();
      ctx.ellipse(b.x + dx, jy + dy, 3.4, 2.2, dx * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(200, 225, 235, 0.35)";
    roundRectPath(ctx, b.x - 8, jy - 16, 16, 16, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)"; // a shine, lit from above
    ctx.fillRect(b.x - 6, jy - 14, 2, 9);
    // Wooden lid with a knob.
    ctx.fillStyle = "#9a6a42";
    roundRectPath(ctx, b.x - 9, jy - 19, 18, 4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, jy - 20, 2.2, 0, Math.PI * 2);
    ctx.fill();
  },

  // The trading post: a wooden stall with an orange and cream awning,
  // parcels of swapped things on the counter, and a chalkboard sign.
  tradingPost(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#9a6e48");
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE;
    ctx.fillStyle = "#6e4a30";
    ctx.fillRect(a.x + 2, box.top.y - 36, 4, 36);
    ctx.fillRect(a.x + w - 6, box.top.y - 36, 4, 36);
    // Little crates and parcels on the counter.
    const goods = ["#c98f3c", "#6f8a6a", "#b5763a", "#8a7ab0", "#d9a441"];
    for (let i = 0; i < 5; i++) {
      const x = box.top.x + 5 + i * ((box.top.w - 14) / 5);
      ctx.fillStyle = goods[i];
      roundRectPath(ctx, x, box.top.y + 1 - (i % 2) * 3, 9, 8 + (i % 2) * 3, 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(x + 1, box.top.y + 2 - (i % 2) * 3, 7, 1.5);
    }
    // The awning: orange and cream stripes, with a scalloped edge.
    const ay = box.top.y - 42;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#f4efe4" : "#e0883a";
      ctx.fillRect(a.x - 4 + (i * (w + 8)) / 8, ay, (w + 8) / 8 + 0.5, 10);
      ctx.beginPath();
      ctx.arc(a.x - 4 + ((i + 0.5) * (w + 8)) / 8, ay + 10, (w + 8) / 16, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(a.x - 4, ay, w + 8, 2);
    // Sign: "TRADE".
    ctx.fillStyle = "#3a3a36";
    roundRectPath(ctx, a.x + w / 2 - 18, box.face.y + 4, 36, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#f4efe4";
    ctx.font = "700 8px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TRADE", a.x + w / 2, box.face.y + 12.5);
    ctx.textAlign = "left";
  },

  // Juniper's wares on a patterned blanket (only while she's here).
  merchantWares(ctx, f) {
    if (!MERCHANT.here) return;
    const a = toScreen(f.x, f.y), w = f.w * TILE, h = f.h * TILE;
    ctx.fillStyle = "#7a3f5a";
    roundRectPath(ctx, a.x, a.y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = "#e8c070";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    roundRectPath(ctx, a.x + 3, a.y + 3, w - 6, h - 6, 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // A seed pouch, a jar of glowing worms, a scroll and a little globe.
    const cy = a.y + h / 2;
    ctx.fillStyle = "#c9a26a";
    ctx.beginPath();
    ctx.ellipse(a.x + 9, cy + 1, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(240, 230, 140, 0.9)";
    roundRectPath(ctx, a.x + 17, cy - 5, 7, 9, 2);
    ctx.fill();
    ctx.fillStyle = "#f4ead4";
    ctx.fillRect(a.x + 28, cy - 2, 10, 4);
    ctx.fillStyle = "#4f8a8a";
    ctx.beginPath();
    ctx.arc(a.x + w - 9, cy - 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // Juniper the fox, the traveling merchant: orange fur and a cream chest,
  // a bushy tail, a green scarf and a patched traveling hat, with a big
  // backpack of goods (only while she's here, on her day).
  juniper(ctx, f) {
    if (!MERCHANT.here) return;
    const t = performance.now() / 1000;
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const bx = b.x, by = b.y;
    // Bushy tail with a white tip, swishing.
    const swish = Math.sin(t * 1.8) * 3;
    ctx.fillStyle = "#d9702e";
    ctx.beginPath();
    ctx.ellipse(bx + 14 + swish * 0.3, by - 12, 6, 11, 0.6 + swish * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.ellipse(bx + 19 + swish * 0.5, by - 20, 3.5, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Backpack (behind her), with a rolled blanket and a pot on top.
    ctx.fillStyle = "#7a5436";
    roundRectPath(ctx, bx - 14, by - 44, 20, 26, 4);
    ctx.fill();
    ctx.fillStyle = "#a8473a";
    roundRectPath(ctx, bx - 15, by - 49, 22, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = "#6a7278";
    ctx.beginPath();
    ctx.arc(bx - 10, by - 51, 3.5, Math.PI, 0);
    ctx.fill();
    // Feet.
    ctx.fillStyle = "#3a2a22";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + side * 4.5, by - 2, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Body, lit from above, with a cream chest.
    const body = ctx.createLinearGradient(0, by - 36, 0, by - 4);
    body.addColorStop(0, "#e8843a");
    body.addColorStop(1, "#c8622a");
    ctx.fillStyle = body;
    roundRectPath(ctx, bx - 9, by - 34, 18, 32, 8);
    ctx.fill();
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.ellipse(bx, by - 18, 5.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Green scarf.
    ctx.fillStyle = "#4f7a5a";
    roundRectPath(ctx, bx - 9, by - 31, 18, 5, 2.5);
    ctx.fill();
    ctx.fillRect(bx + 3, by - 28, 4, 9);
    // Head: pointed ears, a cream muzzle.
    ctx.fillStyle = "#e8843a";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(bx + side * 3, by - 42);
      ctx.lineTo(bx + side * 9, by - 51);
      ctx.lineTo(bx + side * 9.5, by - 39);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(bx, by - 38, 9, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.ellipse(bx, by - 35, 5.5, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = t % 4.5 < 0.12;
    ctx.fillStyle = "#2a1e18";
    if (blink) {
      ctx.fillRect(bx - 5, by - 40, 3, 1);
      ctx.fillRect(bx + 2, by - 40, 3, 1);
    } else {
      ctx.beginPath();
      ctx.arc(bx - 3.5, by - 40, 1.4, 0, Math.PI * 2);
      ctx.arc(bx + 3.5, by - 40, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(bx, by - 36, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // A patched traveling hat with a feather.
    ctx.fillStyle = "#5a4a3a";
    ctx.beginPath();
    ctx.ellipse(bx, by - 45, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, bx - 6.5, by - 53, 13, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#8a6a4a";
    ctx.fillRect(bx - 3, by - 51, 4, 3);
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 5, by - 48);
    ctx.quadraticCurveTo(bx + 11, by - 58, bx + 14, by - 60);
    ctx.stroke();
  },
});
