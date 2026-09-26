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
    if (f.glow) glows.push(f.glow(f));
  }
  return glows;
}

function drawOutdoorLight(ctx) {
  const level = outdoorNightLevel();
  if (level <= 0.001) return;
  const { left, right, top, bottom } = houseBounds();
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
  // A few stars over the roof line.
  ctx.fillStyle = `rgba(255, 250, 225, ${0.8 * level})`;
  const roofTop = toScreen(0, YARD - 5.8).y - WALL_HEIGHT;
  for (let i = 0; i < 26; i++) {
    const twinkle = 0.5 + 0.5 * Math.sin(performance.now() / 700 + i * 2.1);
    ctx.globalAlpha = level * (0.4 + 0.6 * twinkle);
    ctx.fillRect(left + noise(i * 3.3) * (right - left), top + noise(i * 5.9) * (roofTop - top - 4), 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
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
