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

// A patch of dirt path: soft rounded edges and a few pebbles.
function paintPath(ctx, box) {
  const a = toScreen(box.x, YARD + box.y), b = toScreen(box.x + box.w, YARD + box.y + box.h);
  const w = b.x - a.x, h = b.y - a.y;
  ctx.fillStyle = "#c9ab80";
  roundRectPath(ctx, a.x, a.y, w, h, Math.min(w, h) / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120, 90, 55, 0.18)";
  roundRectPath(ctx, a.x + 2, a.y + h - 5, w - 4, 4, 2);
  ctx.fill();
  const seed = Math.round(box.x * 7 + box.y * 13);
  for (let i = 0; i < (w * h) / 120; i++) {
    ctx.fillStyle = i % 3 ? "rgba(150, 120, 85, 0.5)" : "rgba(235, 220, 195, 0.7)";
    const px = a.x + 4 + noise(seed + i * 1.7) * (w - 8), py = a.y + 3 + noise(seed + i * 3.1) * (h - 6);
    ctx.beginPath();
    ctx.ellipse(px, py, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
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
function paintStreet(ctx) {
  const { left, right, bottom } = houseBounds();
  const walk = toScreen(0, YARD + 9.5).y, road = toScreen(0, YARD + 10.4).y;
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
  // The garden's soil bed, inside its fence.
  const g1 = toScreen(13.0, YARD - 1.2), g2 = toScreen(23.6, YARD + 4.4);
  ctx.fillStyle = "rgba(120, 150, 80, 0.35)";
  ctx.fillRect(g1.x, g1.y, g2.x - g1.x, g2.y - g1.y);
  for (const path of YARD_PATHS) paintPath(ctx, path);
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
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 0; i < 12; i++) {
    const on = Math.sin(t * 2 + i * 1.7) > 0.6;
    if (!on) continue;
    const a = noise(i * 9.1) * Math.PI * 2, r = Math.sqrt(noise(i * 3.7));
    ctx.fillRect(c.x + Math.cos(a) * rx * r, c.y + Math.sin(a) * ry * r, 4, 1.2);
  }
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
  const level = outdoorNightLevel();
  const { left, right, top, bottom } = houseBounds();
  const whole = [{ x: -WALL_THICKNESS - 2, y: YARD - 8, w: HOUSE_WIDTH + 4, h: 21 }];
  if (level <= 0.001) {
    drawOutsideWeather(ctx, whole);
    return;
  }
  ctx.fillStyle = `rgba(14, 22, 62, ${0.55 * level})`;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, r, strength] of yardGlows()) {
    const p = toScreen(x, y);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(0, `rgba(255, 185, 95, ${0.55 * strength * level})`);
    glow.addColorStop(1, "rgba(255, 190, 100, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A few stars over the roof line (when the sky is clear enough).
  const starry = OUTDOORS.clouds < 0.6 && !OUTDOORS.rain && !OUTDOORS.snow && OUTDOORS.sky !== "fog";
  ctx.fillStyle = `rgba(255, 250, 225, ${0.8 * level})`;
  const roofTop = toScreen(0, YARD - 5.8).y - WALL_HEIGHT;
  for (let i = 0; i < (starry ? 26 : 0); i++) {
    const twinkle = 0.5 + 0.5 * Math.sin(performance.now() / 700 + i * 2.1);
    ctx.globalAlpha = level * (0.4 + 0.6 * twinkle);
    ctx.fillRect(left + noise(i * 3.3) * (right - left), top + noise(i * 5.9) * (roofTop - top - 4), 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
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
  const [dark, mid, light] = leafColors(f.n);
  const sway = Math.sin(performance.now() / 1600 + (f.n ?? 0)) * 1.2;
  const cy = base.y - 72;
  const balls = [[-24, 8, 22], [24, 8, 22], [0, 12, 24], [-14, -12, 24], [14, -12, 24], [0, -24, 22]];
  ctx.fillStyle = dark;
  for (const [dx, dy, r] of balls) {
    ctx.beginPath();
    ctx.arc(base.x + dx + sway * 0.5, cy + dy + 3, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = mid;
  for (const [dx, dy, r] of balls) {
    ctx.beginPath();
    ctx.arc(base.x + dx + sway, cy + dy - 1, r - 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = light;
  for (const [dx, dy, r] of balls.slice(3)) {
    ctx.beginPath();
    ctx.arc(base.x + dx + sway - 4, cy + dy - 7, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  if (yardSeason() === "winter") {
    // Snow resting on top.
    ctx.fillStyle = "#f7fafc";
    for (const [dx, dy, r] of balls.slice(3)) {
      ctx.beginPath();
      ctx.ellipse(base.x + dx + sway, cy + dy - r + 8, r * 0.7, 5, 0, 0, Math.PI * 2);
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
  const snow = yardSeason() === "winter";
  const layers = [[0, 34, 30], [-26, 28, 26], [-50, 21, 22]];
  for (const [dy, half, height] of layers) {
    const y = base.y - 14 + dy;
    ctx.fillStyle = "#2f5a3c";
    ctx.beginPath();
    ctx.moveTo(base.x - half, y);
    ctx.lineTo(base.x + half, y);
    ctx.lineTo(base.x, y - height - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3f7449";
    ctx.beginPath();
    ctx.moveTo(base.x - half + 6, y - 4);
    ctx.lineTo(base.x, y - 4);
    ctx.lineTo(base.x, y - height - 14);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = "#f4f8fb";
      ctx.beginPath();
      ctx.moveTo(base.x - half * 0.45, y - height * 0.55);
      ctx.lineTo(base.x + half * 0.45, y - height * 0.55);
      ctx.lineTo(base.x, y - height - 16);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// A round bush, with berries or blossoms depending on the season.
function drawBush(ctx, f) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const b = toScreen(f.x + f.w / 2, f.y + f.h);
  const [dark, mid, light] = leafColors(f.n + 1);
  for (const [dx, dy, r, color] of [[-10, -12, 12, dark], [10, -12, 12, dark], [0, -18, 14, mid], [-6, -22, 7, light], [7, -20, 6, light]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const season = yardSeason();
  if (season === "summer" || season === "spring") {
    ctx.fillStyle = f.n % 2 ? "#f2f0f8" : "#e05a6a";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(b.x - 14 + noise(f.n * 7 + i) * 28, b.y - 26 + noise(f.n * 3 + i * 2) * 18, 1.8, 0, Math.PI * 2);
      ctx.fill();
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
    for (let i = 0; i < Math.round(w / 6); i++) {
      const x = a.x + noise(f.x * 3 + i * 1.9) * w, h = 6 + noise(i * 4.3 + f.y) * 7;
      ctx.strokeStyle = "#5f8a4a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, a.y);
      ctx.lineTo(x, a.y - h);
      ctx.stroke();
      ctx.fillStyle = ["#f2c94c", "#f7f1e6", "#c86bb0", "#e8883a"][i % 4];
      ctx.beginPath();
      ctx.arc(x, a.y - h, 2.2, 0, Math.PI * 2);
      ctx.fill();
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

  // A door in the house's back wall, standing open: warm light inside, the
  // door swung in, a little roof over it.
  yardDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, top = a.y - WALL_HEIGHT + 2, x = a.x + 6, dw = w - 12;
    drawDoorFrame(ctx, x, top + 2, dw, WALL_HEIGHT - 2);
    const inside = ctx.createLinearGradient(0, top, 0, a.y);
    inside.addColorStop(0, "#f2c98a");
    inside.addColorStop(1, "#d99a58");
    ctx.fillStyle = inside;
    ctx.fillRect(x, top + 2, dw, WALL_HEIGHT - 2);
    // The door, open against the frame (seen edge-on, a narrow panel).
    ctx.fillStyle = f.door === "kitchen" ? "#5f8a6a" : "#7a4a3a";
    ctx.fillRect(x, top + 2, 8, WALL_HEIGHT - 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x, top + 2, 1.5, WALL_HEIGHT - 2);
    // A small roof over the door.
    ctx.fillStyle = "#6a3f33";
    ctx.beginPath();
    ctx.moveTo(x - 8, top + 2);
    ctx.lineTo(x + dw / 2, top - 10);
    ctx.lineTo(x + dw + 8, top + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a5242";
    ctx.fillRect(x - 8, top, dw + 16, 3);
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

  // A few smooth stones by the water.
  pondStones(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, dy, rx, ry, c] of [[-10, -6, 11, 8, "#9a958c"], [8, -4, 9, 6, "#b3aca0"], [0, -12, 7, 6, "#c4beb2"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(b.x + dx, b.y + dy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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

// Soft cloud shadows sliding slowly across the ground.
function drawCloudShadows(ctx, x0, y0, w, h, amount) {
  const t = performance.now() / 1000;
  ctx.fillStyle = `rgba(40, 55, 70, ${0.08 + 0.06 * amount})`;
  for (let i = 0; i < 4; i++) {
    const x = x0 - 200 + ((t * 9 + noise(i * 3.1) * 2000) % (w + 400));
    const y = y0 + noise(i * 7.3) * h;
    ctx.beginPath();
    ctx.ellipse(x, y, 110 + noise(i) * 60, 40 + noise(i * 2) * 20, 0, 0, Math.PI * 2);
    ctx.fill();
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
  const lift = seatLift(p.seated);
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

// --- Windows onto the real weather ---
// A window in the hallway's back wall that shows the sky outside: blue by
// day with the sun or passing clouds, deep blue with the moon and stars at
// night, grey when it's raining (drops on the glass) or snowing.
function drawWeatherPane(ctx, x, y, w, h) {
  const night = isNightOutside();
  const { sky, rain, snow, clouds } = OUTDOORS;
  const t = performance.now() / 1000;
  const grey = Math.max(clouds, rain, snow > 0 ? 0.7 : 0);
  const pane = ctx.createLinearGradient(0, y, 0, y + h);
  if (night) {
    pane.addColorStop(0, grey > 0.6 ? "#2a3244" : "#1c2750");
    pane.addColorStop(1, grey > 0.6 ? "#3a4254" : "#34407a");
  } else {
    pane.addColorStop(0, grey > 0.6 ? "#9aa6b2" : "#7fb6de");
    pane.addColorStop(1, grey > 0.6 ? "#c2c8cf" : "#cfe6f2");
  }
  ctx.fillStyle = pane;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (grey < 0.6) {
    if (night) {
      ctx.fillStyle = "#f7f1d8"; // moon
      ctx.beginPath();
      ctx.arc(x + w * 0.72, y + h * 0.3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c2750";
      ctx.beginPath();
      ctx.arc(x + w * 0.72 + 2, y + h * 0.3 - 1.5, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 250, 225, 0.85)";
      for (let i = 0; i < 6; i++) ctx.fillRect(x + noise(i * 3.3) * w, y + noise(i * 5.1) * h * 0.7, 1.2, 1.2);
    } else {
      drawGlow(ctx, x + w * 0.72, y + h * 0.3, 10, "rgba(255, 230, 140, 0.7)");
      ctx.fillStyle = "#ffe07a";
      ctx.beginPath();
      ctx.arc(x + w * 0.72, y + h * 0.3, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Clouds drifting past.
  if (clouds > 0.1 && sky !== "fog") {
    ctx.fillStyle = night ? "rgba(120, 130, 150, 0.8)" : grey > 0.6 ? "rgba(235, 238, 242, 0.85)" : "rgba(255, 255, 255, 0.9)";
    for (let i = 0; i < 2 + Math.round(clouds * 2); i++) {
      const cx = x - 14 + ((t * 4 + i * 23) % (w + 28)), cy = y + 5 + i * 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 5, cy - 2, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (sky === "fog") {
    ctx.fillStyle = "rgba(240, 242, 244, 0.6)";
    ctx.fillRect(x, y, w, h);
  }
  if (rain > 0) {
    drawRainIn(ctx, x, y, w, h, rain, Math.round(x), false);
    // Drops running down the glass.
    ctx.fillStyle = "rgba(230, 240, 250, 0.7)";
    for (let i = 0; i < 5; i++) {
      const fall = (t * (0.15 + noise(i * 1.9) * 0.1) + noise(i * 4.3)) % 1;
      ctx.fillRect(x + 2 + noise(i * 2.7 + x) * (w - 4), y + fall * h, 1.2, 3);
    }
  }
  if (snow > 0) {
    drawSnowIn(ctx, x, y, w, h, snow, Math.round(x));
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(x, y + h - 3, w, 3); // snow piled on the sill
  }
  const flash = lightningFlash();
  if (flash) {
    ctx.fillStyle = `rgba(245, 248, 255, ${flash * 1.4})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

FURNITURE_DRAWERS.weatherWindow = (ctx, f) => {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, top = a.y - WALL_HEIGHT + 5, h = 25;
  ctx.fillStyle = "#f4efe4"; // frame
  ctx.fillRect(a.x + 3, top - 2, w - 6, h + 4);
  drawWeatherPane(ctx, a.x + 5, top, w - 10, h);
  ctx.fillStyle = "#f4efe4"; // cross bars
  ctx.fillRect(a.x + w / 2 - 1, top, 2, h);
  ctx.fillRect(a.x + 5, top + h / 2 - 1, w - 10, 2);
  ctx.fillStyle = "#c98a8a"; // little curtains tied back
  ctx.beginPath();
  ctx.moveTo(a.x + 2, top - 3);
  ctx.quadraticCurveTo(a.x + 9, top + h / 2, a.x + 4, top + h + 2);
  ctx.lineTo(a.x + 2, top + h + 2);
  ctx.closePath();
  ctx.moveTo(a.x + w - 2, top - 3);
  ctx.quadraticCurveTo(a.x + w - 9, top + h / 2, a.x + w - 4, top + h + 2);
  ctx.lineTo(a.x + w - 2, top + h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a6040"; // sill
  ctx.fillRect(a.x + 1, top + h + 2, w - 2, 3);
};

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
    // Furrows.
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    for (let i = 1; i < 3; i++) ctx.fillRect(box.top.x + 5, box.top.y + 3 + ((box.top.h - 5) * i) / 3, box.top.w - 10, 1.5);
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
  },

  // Hazel the hedgehog, the gardener: spiky and round, in a straw hat and
  // a green apron, holding a little watering can.
  hazel(ctx, f) {
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

  // --- Reginald's corner: the raccoons' new spot by the bins ---

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
    ctx.fillText("totally normal", 0, -1.5);
    ctx.fillText("trash", 0, 5);
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
  const dip = bite ? Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 1;
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
  otis(ctx, f) {
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
// Where the bus is right now. Everyone's clock agrees (it's worked out from
// the time of day), so friends see the bus at the same moment.
// Returns { phase: "away" | "arriving" | "waiting" | "leaving", x (the
// bus's left end, grid units), untilNext (seconds until it next arrives),
// leavesIn (seconds, while waiting) }.
const BUS_LENGTH = 4.4;
const BUS_STOP_X = 18.4; // where its left end stops, by the shelter
const BUS_DRIVE = 7; // seconds to drive in (or out)
function busState(now = Date.now()) {
  const period = Math.max(2, CONFIG.bus.everyMinutes) * 60;
  const wait = CONFIG.bus.waitSeconds;
  const t = (now / 1000) % period;
  const ease = (k) => 1 - (1 - k) ** 3; // slowing down as it pulls in
  if (t < BUS_DRIVE) {
    return { phase: "arriving", x: -BUS_LENGTH - 1 + (BUS_STOP_X + BUS_LENGTH + 1) * ease(t / BUS_DRIVE), untilNext: 0 };
  }
  if (t < BUS_DRIVE + wait) return { phase: "waiting", x: BUS_STOP_X, untilNext: 0, leavesIn: BUS_DRIVE + wait - t };
  if (t < BUS_DRIVE * 2 + wait) {
    const k = (t - BUS_DRIVE - wait) / BUS_DRIVE;
    return { phase: "leaving", x: BUS_STOP_X + (HOUSE_WIDTH + 1 - BUS_STOP_X) * k * k, untilNext: period - t };
  }
  return { phase: "away", x: null, untilNext: period - t };
}

Object.assign(FURNITURE_DRAWERS, {
  // A cute little bus, seen from the side: cream and teal, round windows,
  // a door in the middle (open while it waits), and headlights at night.
  bus(ctx, f) {
    const bus = busState();
    if (bus.x === null) return;
    const t = performance.now() / 1000;
    const a = toScreen(bus.x, f.y + f.h);
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
    ctx.fillText("TRIPS SOON", x + w / 2, top - 1);
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
    // Timetable board.
    const bus = busState();
    const text = bus.phase === "waiting" ? "Here now!" : bus.phase === "arriving" ? "Arriving..." : `Next: ${Math.max(1, Math.ceil(bus.untilNext / 60))} min`;
    ctx.fillStyle = "#2b2b30";
    roundRectPath(ctx, b.x - 22, b.y - 52, 44, 22, 3);
    ctx.fill();
    ctx.fillStyle = "#f2c94c";
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.fillText(text, b.x, b.y - 43);
    ctx.fillStyle = "#c8c8d0";
    ctx.font = "600 6px 'Quicksand', sans-serif";
    ctx.fillText("Trips coming soon", b.x, b.y - 34);
    ctx.textAlign = "left";
  },
});
