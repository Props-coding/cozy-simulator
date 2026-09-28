// How the Farm looks (the bus trip, see "The Farm" in world.js).
// The ground (grass, the tilled fields, the orchard's mown grass, the
// chicken run's dirt, the pumpkin patch's mulch, the paths and the road)
// is painted once, like the yard's; a few moving things (butterflies by
// day, fireflies at night) are drawn every frame; and the barn, silo,
// windmill, chicken coop and chickens, Hazel's farm stand, the well, apple
// trees, sunflowers, pumpkins and the rest are furniture drawings below.
//
// Light comes from above, like everywhere else, and every object follows
// the detail standard (CLAUDE.md, rule 14): a soft darker outline, shading
// on the side away from the light, a highlight on the lit side, and some
// surface texture.

// --- Small drawing helpers ---
// A filled shape with a soft darker outline under it (drawn slightly
// larger, then the shape itself on top).
function outlined(ctx, color, path, spread = 1.4) {
  ctx.save();
  ctx.strokeStyle = shadeColor(color, -70);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = spread * 2;
  ctx.lineJoin = "round";
  path();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = color;
  path();
  ctx.fill();
}

// Vertical boards across a box (barn walls, crates): each board a slightly
// different shade, a dark seam between them, and a few knots.
function drawBoards(ctx, x, y, w, h, color, board = 9, seed = 0) {
  for (let i = 0, bx = x; bx < x + w; i++, bx += board) {
    const bw = Math.min(board, x + w - bx);
    ctx.fillStyle = shadeColor(color, Math.round((noise(seed + i * 1.7) - 0.5) * 16));
    ctx.fillRect(bx, y, bw, h);
    ctx.fillStyle = "rgba(40, 15, 10, 0.28)";
    ctx.fillRect(bx, y, 1, h);
    ctx.fillStyle = "rgba(255, 235, 215, 0.08)";
    ctx.fillRect(bx + 1, y, 1, h);
    if (noise(seed + i * 3.1) > 0.6) {
      ctx.fillStyle = "rgba(40, 15, 10, 0.3)";
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, y + h * (0.2 + noise(seed + i * 5.3) * 0.6), 1.4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A soft ground shadow (an oval) under something tall and wide.
function groundShadow(ctx, cx, cy, rx, ry, alpha = 0.22) {
  ctx.fillStyle = `rgba(40, 25, 10, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A little window with four panes, a white frame and a sill; warm light
// inside at night (the glow itself comes from farmGlows).
function drawFarmWindow(ctx, x, y, w, h, frame = "#f4efe4") {
  ctx.fillStyle = shadeColor(frame, -60);
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = frame;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const night = typeof isNightOutside === "function" && isNightOutside();
  const glass = ctx.createLinearGradient(0, y, 0, y + h);
  glass.addColorStop(0, night ? "#ffd98a" : "#8fb3c8");
  glass.addColorStop(1, night ? "#f0a850" : "#5d7f96");
  ctx.fillStyle = glass;
  ctx.fillRect(x, y, w, h);
  if (!night) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // a reflection, top left
    ctx.beginPath();
    ctx.moveTo(x + 1, y + h * 0.55);
    ctx.lineTo(x + w * 0.45, y + 1);
    ctx.lineTo(x + w * 0.6, y + 1);
    ctx.lineTo(x + 1, y + h * 0.8);
    ctx.fill();
  }
  ctx.fillStyle = frame;
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.fillStyle = shadeColor(frame, -30);
  ctx.fillRect(x - 4, y + h + 2, w + 8, 3); // sill
}

// --- The ground (painted once) ---
function paintFarmGround(ctx) {
  const { left, right, top, bottom } = houseBounds();
  const season = yardSeason();
  const g = GRASS[season] ?? GRASS.summer;
  ctx.fillStyle = g.ground;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const W = right - left, H = bottom - top;
  // Grass tufts and the odd flower.
  for (let i = 0; i < (W * H) / 460; i++) {
    const x = left + noise(i * 1.9 + 900) * W, y = top + noise(i * 2.7 + 905) * H;
    ctx.strokeStyle = noise(i + 911) > 0.5 ? g.dark : g.light;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
    if (noise(i + 923) > 0.965 && season !== "winter") {
      ctx.fillStyle = noise(i + 931) > 0.5 ? "#f7f1e6" : "#f2c94c";
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The orchard's grass, mown in soft stripes.
  const o1 = toScreen(0.2, FARM - 0.1), o2 = toScreen(5.6, FARM + 7.4);
  for (let i = 0, x = o1.x; x < o2.x; i++, x += 23) {
    ctx.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 40, 0, 0.05)";
    ctx.fillRect(x, o1.y, 23, o2.y - o1.y);
  }
  // Packed earth in front of the barn and around the stand and silo.
  const apron = toScreen(3.2, FARM - 1.4);
  ctx.fillStyle = "rgba(160, 125, 85, 0.45)";
  ctx.beginPath();
  ctx.ellipse(apron.x, apron.y, 3.3 * TILE, 0.8 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  // The fields: dark tilled soil inside the fence, with furrows.
  paintSoil(ctx, 5.95, -0.25, 11.1, 7.1, "#6e4a30", 24);
  // The chicken run: dusty dirt, scattered straw and grain.
  paintSoil(ctx, 12.85, -4.25, 5.5, 2.6, "#a88a62", 0);
  for (let i = 0; i < 60; i++) {
    const p = toScreen(13 + noise(i * 3.3 + 950) * 5.2, FARM - 4.1 + noise(i * 5.1 + 951) * 2.3);
    ctx.strokeStyle = noise(i + 952) > 0.4 ? "rgba(236, 206, 130, 0.8)" : "rgba(200, 160, 90, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const a = noise(i + 953) * Math.PI;
    ctx.moveTo(p.x - Math.cos(a) * 3, p.y - Math.sin(a) * 1.4);
    ctx.lineTo(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 1.4);
    ctx.stroke();
  }
  // The pumpkin patch: soil with straw mulch.
  paintSoil(ctx, 19.35, 0.95, 4.3, 5.4, "#7a5636", 0);
  for (let i = 0; i < 70; i++) {
    const p = toScreen(19.5 + noise(i * 2.9 + 970) * 4.0, FARM + 1.1 + noise(i * 4.3 + 971) * 5.1);
    ctx.strokeStyle = "rgba(226, 196, 120, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const a = noise(i + 972) * Math.PI;
    ctx.moveTo(p.x - Math.cos(a) * 3.5, p.y - Math.sin(a) * 1.5);
    ctx.lineTo(p.x + Math.cos(a) * 3.5, p.y + Math.sin(a) * 1.5);
    ctx.stroke();
  }
  // Round the well: trodden earth, a little damp.
  const well = toScreen(18.15, FARM + 1.45);
  ctx.fillStyle = "rgba(120, 95, 65, 0.35)";
  ctx.beginPath();
  ctx.ellipse(well.x, well.y, 36, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  paintPaths(ctx, FARM_PATHS, FARM);
  paintStreet(ctx, FARM);
}

// A patch of soil (grid spots from the farm's top): a darker edge, a
// little lighter in the middle, speckled, with furrows every `furrow`
// pixels if asked.
function paintSoil(ctx, x, y, w, h, color, furrow) {
  const a = toScreen(x, FARM + y), b = toScreen(x + w, FARM + y + h);
  ctx.fillStyle = shadeColor(color, -20);
  roundRectPath(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 10);
  ctx.fill();
  ctx.fillStyle = color;
  roundRectPath(ctx, a.x + 4, a.y + 3, b.x - a.x - 8, b.y - a.y - 7, 8);
  ctx.fill();
  if (furrow) {
    for (let yy = a.y + 10; yy < b.y - 6; yy += furrow) {
      ctx.fillStyle = "rgba(30, 15, 5, 0.22)";
      ctx.fillRect(a.x + 8, yy, b.x - a.x - 16, 2);
      ctx.fillStyle = "rgba(255, 220, 180, 0.08)";
      ctx.fillRect(a.x + 8, yy - 2, b.x - a.x - 16, 1.5);
    }
  }
  for (let i = 0; i < ((b.x - a.x) * (b.y - a.y)) / 140; i++) {
    ctx.fillStyle = i % 2 ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 235, 200, 0.1)";
    ctx.fillRect(a.x + 4 + noise(i * 1.3 + x) * (b.x - a.x - 8), a.y + 3 + noise(i * 2.1 + y) * (b.y - a.y - 7), 2, 1.5);
  }
}

// --- Every frame: butterflies by day ---
function drawFarmLife(ctx) {
  if (isNightOutside() || yardSeason() === "winter" || OUTDOORS.raining) return;
  const t = performance.now() / 1000;
  const spots = [[21.5, 1.4, "#f2c94c"], [9.6, 7.3, "#f7f1e6"], [3.0, 2.2, "#e8a0c0"]];
  spots.forEach(([gx, gy, color], i) => {
    const p = toScreen(gx + Math.sin(t * 0.4 + i) * 1.2, FARM + gy + Math.sin(t * 0.7 + i * 2) * 0.5);
    const y = p.y - 34 - Math.abs(Math.sin(t * 2 + i)) * 8;
    const flap = Math.abs(Math.sin(t * 14 + i)) * 0.8 + 0.2;
    ctx.fillStyle = shadeColor(color, -60);
    ctx.fillRect(p.x - 0.6, y - 2, 1.2, 4);
    ctx.fillStyle = color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(p.x + side * 3 * flap, y - 1, 3 * flap, 2.6, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Fireflies over the fields and the orchard on warm nights.
function drawFarmFireflies(ctx, level) {
  if (level < 0.3 || yardSeason() === "winter" || OUTDOORS.raining) return;
  const t = performance.now() / 1000;
  for (let i = 0; i < 12; i++) {
    const gx = 1 + noise(i * 3.7 + 990) * 22, gy = -0.5 + noise(i * 5.9 + 991) * 9;
    const p = toScreen(gx + Math.sin(t * 0.3 + i * 1.7) * 0.9, FARM + gy + Math.cos(t * 0.25 + i) * 0.6);
    const on = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.3);
    if (on < 0.35) continue;
    const g = ctx.createRadialGradient(p.x, p.y - 20, 0, p.x, p.y - 20, 9);
    g.addColorStop(0, `rgba(232, 255, 154, ${0.8 * on * level})`);
    g.addColorStop(1, "rgba(232, 255, 154, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 9, p.y - 29, 18, 18);
  }
}

// Warm lights at the Farm at night: [x, y (grid), radius, strength].
function farmGlows() {
  const glows = [];
  for (const f of FURNITURE) {
    if (floorOf(f.y) !== FARM_FLOOR) continue;
    if (f.kind === "lampPost") glows.push([f.x + f.w / 2, f.y + f.h - 1.45, 75, 0.95]);
    if (f.kind === "barn") {
      glows.push([f.x + f.w * 0.17, f.y + f.h - 0.8, 45, 0.7]);
      glows.push([f.x + f.w * 0.83, f.y + f.h - 0.8, 45, 0.7]);
      glows.push([f.x + f.w / 2, f.y - 0.9, 40, 0.5]); // the hay loft
    }
    if (f.kind === "farmStand") glows.push([f.x + f.w - 0.2, f.y - 0.5, 50, 0.8]);
    if (f.kind === "windmill") glows.push([f.x + f.w / 2, f.y - 0.9, 35, 0.6]);
    if (f.kind === "chickenCoop") glows.push([f.x + f.w * 0.7, f.y - 0.1, 25, 0.5]);
  }
  return glows;
}

// --- The Farm's furniture ---
Object.assign(FURNITURE_DRAWERS, {
  // The big red barn: board walls with white trim on a stone footing, big
  // double doors with white cross braces, a hay loft door with hay poking
  // out and a hoist beam, two windows, and a gambrel roof with a
  // weathervane (a rooster) on top.
  barn(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, cx = (a.x + b.x) / 2, y = a.y;
    groundShadow(ctx, cx, y + 2, w / 2 + 12, 12, 0.26);
    const wallH = 92, eave = y - wallH, peak = eave - 74, shoulder = eave - 42;
    const red = "#b3453a";
    // The gable (gambrel shape: steep lower slopes, gentle upper ones).
    const gable = () => {
      ctx.beginPath();
      ctx.moveTo(a.x - 8, eave + 2);
      ctx.lineTo(a.x + w * 0.1, shoulder);
      ctx.lineTo(cx, peak);
      ctx.lineTo(b.x - w * 0.1, shoulder);
      ctx.lineTo(b.x + 8, eave + 2);
      ctx.closePath();
    };
    // Roof edge (dark shingles) behind the gable's boards.
    outlined(ctx, "#4a3a36", () => {
      ctx.beginPath();
      ctx.moveTo(a.x - 14, eave + 6);
      ctx.lineTo(a.x + w * 0.1 - 6, shoulder - 5);
      ctx.lineTo(cx, peak - 9);
      ctx.lineTo(b.x - w * 0.1 + 6, shoulder - 5);
      ctx.lineTo(b.x + 14, eave + 6);
      ctx.lineTo(b.x + 8, eave + 2);
      ctx.lineTo(b.x - w * 0.1, shoulder);
      ctx.lineTo(cx, peak);
      ctx.lineTo(a.x + w * 0.1, shoulder);
      ctx.lineTo(a.x - 8, eave + 2);
      ctx.closePath();
    });
    ctx.save();
    gable();
    ctx.clip();
    drawBoards(ctx, a.x - 8, peak, w + 16, eave - peak + 2, red, 10, f.x);
    // Shade under the roof's edge.
    const shade = ctx.createLinearGradient(0, peak, 0, peak + 30);
    shade.addColorStop(0, "rgba(40, 10, 5, 0.35)");
    shade.addColorStop(1, "rgba(40, 10, 5, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(a.x - 8, peak, w + 16, 40);
    ctx.restore();
    // Shingle lines along the roof edge, and a highlight on its top edge.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a.x - 14, eave + 5);
    ctx.lineTo(a.x + w * 0.1 - 6, shoulder - 6);
    ctx.lineTo(cx, peak - 10);
    ctx.lineTo(b.x - w * 0.1 + 6, shoulder - 6);
    ctx.stroke();
    // The walls.
    ctx.fillStyle = shadeColor(red, -70);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(a.x - 1, eave - 1, w + 2, wallH + 2);
    ctx.globalAlpha = 1;
    drawBoards(ctx, a.x, eave, w, wallH - 8, red, 10, f.x + 3);
    // Wall shading: darker toward the ground and the right-hand side.
    const wallShade = ctx.createLinearGradient(0, eave, 0, y);
    wallShade.addColorStop(0, "rgba(255, 220, 200, 0.06)");
    wallShade.addColorStop(1, "rgba(40, 10, 5, 0.25)");
    ctx.fillStyle = wallShade;
    ctx.fillRect(a.x, eave, w, wallH - 8);
    // Stone footing.
    for (let i = 0, sx = a.x; sx < b.x; i++, sx += 16) {
      ctx.fillStyle = shadeColor("#8e877c", Math.round((noise(i * 2.2 + f.x) - 0.5) * 20));
      roundRectPath(ctx, sx + 0.5, y - 8, Math.min(15, b.x - sx - 0.5), 8, 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(a.x, y - 8, w, 1);
    // White trim: corners, the eave line.
    ctx.fillStyle = "#efe8da";
    ctx.fillRect(a.x, eave, 5, wallH - 8);
    ctx.fillRect(b.x - 5, eave, 5, wallH - 8);
    ctx.fillRect(a.x - 4, eave - 3, w + 8, 5);
    ctx.fillStyle = "rgba(60, 40, 30, 0.35)";
    ctx.fillRect(b.x - 2, eave, 2, wallH - 8);
    ctx.fillRect(a.x - 4, eave + 2, w + 8, 1);
    // The big doors: white frame, two leaves with cross braces.
    const dw = 78, dh = 70, dx = cx - dw / 2, dy = y - 8 - dh;
    ctx.fillStyle = "#e6ddcc";
    ctx.fillRect(dx - 5, dy - 5, dw + 10, dh + 5);
    drawBoards(ctx, dx, dy, dw, dh, "#a33d33", 8, f.x + 9);
    ctx.strokeStyle = "#efe8da";
    ctx.lineWidth = 4;
    for (const [lx] of [[dx], [dx + dw / 2]]) {
      ctx.strokeRect(lx + 2, dy + 2, dw / 2 - 4, dh - 4);
      ctx.beginPath();
      ctx.moveTo(lx + 3, dy + 3);
      ctx.lineTo(lx + dw / 2 - 3, dy + dh - 3);
      ctx.moveTo(lx + dw / 2 - 3, dy + 3);
      ctx.lineTo(lx + 3, dy + dh - 3);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(40, 10, 5, 0.45)";
    ctx.fillRect(cx - 1, dy, 2, dh);
    ctx.fillStyle = "#3a3a3e"; // the handles and the rail they hang on
    ctx.fillRect(dx - 6, dy - 7, dw + 12, 3);
    ctx.fillRect(cx - 7, dy + dh / 2, 3, 8);
    ctx.fillRect(cx + 4, dy + dh / 2, 3, 8);
    // The hay loft door, hay poking out, and the hoist beam with its hook.
    const lw = 34, lh = 30, lx = cx - lw / 2, ly = shoulder - 6;
    ctx.fillStyle = "#e6ddcc";
    ctx.fillRect(lx - 4, ly - 4, lw + 8, lh + 8);
    ctx.fillStyle = "#2e1c14";
    ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = "#e3c26a";
    for (let i = 0; i < 9; i++) {
      ctx.save();
      ctx.translate(lx + 4 + i * 3.4, ly + lh - 2);
      ctx.rotate((noise(i + f.x) - 0.5) * 0.9);
      ctx.fillRect(-1, -8 - noise(i * 2.1) * 6, 1.8, 10);
      ctx.restore();
    }
    ctx.fillStyle = "#c9a24e";
    ctx.fillRect(lx + 1, ly + lh - 6, lw - 2, 6);
    ctx.fillStyle = "#6e4e36";
    ctx.fillRect(cx - 3, ly - 16, 6, 12);
    ctx.fillRect(cx - 2, ly - 16, 18, 4);
    ctx.strokeStyle = "#3a3a3e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 13, ly - 12);
    ctx.lineTo(cx + 13, ly - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 13, ly, 2, 0, Math.PI);
    ctx.stroke();
    // Two windows either side of the doors.
    drawFarmWindow(ctx, a.x + w * 0.17 - 11, eave + 22, 22, 20);
    drawFarmWindow(ctx, a.x + w * 0.83 - 11, eave + 22, 22, 20);
    // The weathervane: a rooster on an arrow, on the peak.
    const vy = peak - 10;
    ctx.fillStyle = "#3a3a3e";
    ctx.fillRect(cx - 1, vy - 22, 2, 22);
    ctx.fillRect(cx - 12, vy - 12, 24, 1.6);
    ctx.beginPath();
    ctx.moveTo(cx + 12, vy - 14);
    ctx.lineTo(cx + 16, vy - 11);
    ctx.lineTo(cx + 12, vy - 8);
    ctx.fill();
    ctx.beginPath(); // the rooster
    ctx.moveTo(cx - 7, vy - 22);
    ctx.quadraticCurveTo(cx - 8, vy - 32, cx - 1, vy - 31);
    ctx.lineTo(cx + 2, vy - 35);
    ctx.lineTo(cx + 3, vy - 30);
    ctx.quadraticCurveTo(cx + 9, vy - 27, cx + 6, vy - 22);
    ctx.closePath();
    ctx.fill();
  },

  // A tall metal silo: a cylinder (lit in the middle, darker toward both
  // sides), ribbed with bands, rivets, a ladder, and a domed cap.
  silo(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, cx = (a.x + b.x) / 2, y = a.y, h = 150;
    groundShadow(ctx, cx, y, w / 2 + 8, 8, 0.24);
    const body = ctx.createLinearGradient(a.x, 0, b.x, 0);
    body.addColorStop(0, "#8d949a");
    body.addColorStop(0.35, "#d6dade");
    body.addColorStop(0.55, "#c2c7cc");
    body.addColorStop(1, "#7b8288");
    ctx.fillStyle = "#4e5358";
    ctx.fillRect(a.x - 1, y - h - 1, w + 2, h + 1);
    ctx.fillStyle = body;
    ctx.fillRect(a.x, y - h, w, h - 6);
    // Bands, with rivets.
    for (let yy = y - h + 14; yy < y - 8; yy += 18) {
      ctx.fillStyle = "rgba(40, 45, 50, 0.3)";
      ctx.fillRect(a.x, yy, w, 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(a.x, yy - 1, w, 1);
      ctx.fillStyle = "rgba(40, 45, 50, 0.45)";
      for (let rx = a.x + 5; rx < b.x - 3; rx += 7) ctx.fillRect(rx, yy + 3, 1.4, 1.4);
    }
    // A streak of rust, and the ladder.
    ctx.fillStyle = "rgba(150, 80, 40, 0.25)";
    ctx.fillRect(a.x + w * 0.66, y - h + 30, 3, 50);
    ctx.fillStyle = "#4e5358";
    ctx.fillRect(a.x + w * 0.22, y - h + 6, 1.8, h - 12);
    ctx.fillRect(a.x + w * 0.22 + 10, y - h + 6, 1.8, h - 12);
    for (let yy = y - h + 10; yy < y - 8; yy += 7) ctx.fillRect(a.x + w * 0.22, yy, 11.8, 1.4);
    // Concrete base.
    ctx.fillStyle = "#9a948a";
    ctx.fillRect(a.x - 3, y - 7, w + 6, 7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(a.x - 3, y - 7, w + 6, 1.2);
    // The dome.
    const dome = ctx.createRadialGradient(cx - w * 0.15, y - h - 14, 2, cx, y - h, w * 0.6);
    dome.addColorStop(0, "#eef0f2");
    dome.addColorStop(0.5, "#b8bec4");
    dome.addColorStop(1, "#6f767c");
    outlined(ctx, "#b8bec4", () => {
      ctx.beginPath();
      ctx.ellipse(cx, y - h, w / 2 + 2, w * 0.42, 0, Math.PI, 0);
      ctx.closePath();
    });
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(cx, y - h, w / 2 + 2, w * 0.42, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6f767c";
    ctx.fillRect(cx - 3, y - h - w * 0.42 - 6, 6, 7);
  },

  // Straw bales: two stacked, with twine and strands of straw.
  hayBales(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const bale = (gx, gy, w, h, height) => {
      const box = drawBlock(ctx, gx, gy, w, h, height, "#d9b45a");
      for (let i = 0; i < 22; i++) {
        const onTop = i % 3 === 0;
        const bx = (onTop ? box.top : box.face).x + noise(gx * 3 + i * 1.3) * ((onTop ? box.top : box.face).w - 4) + 2;
        const by = (onTop ? box.top : box.face).y + noise(gy * 2 + i * 2.7) * ((onTop ? box.top : box.face).h - 3) + 1;
        ctx.strokeStyle = i % 2 ? "rgba(255, 240, 180, 0.6)" : "rgba(150, 110, 40, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 4, by + (noise(i) - 0.5) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#7a5a30"; // twine
      for (const k of [0.3, 0.7]) {
        ctx.fillRect(box.face.x + box.face.w * k, box.face.y, 1.5, box.face.h);
        ctx.fillRect(box.top.x + box.top.w * k, box.top.y, 1.5, box.top.h);
      }
    };
    bale(f.x, f.y + 0.05, f.w, f.h - 0.05, 16);
    bale(f.x + 0.15, f.y + 0.02, f.w - 0.4, f.h - 0.12, 32);
  },

  // Hazel's farm stand: a wooden stall with a green-and-cream awning,
  // crates of produce on the counter, a hand-painted sign, a chalkboard,
  // and a lantern.
  farmStand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#9a7048");
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE;
    drawBoards(ctx, box.face.x + 1, box.face.y + 3, box.face.w - 2, box.face.h - 7, "#9a7048", 11, f.x);
    // Posts.
    for (const px of [a.x + 3, a.x + w - 8]) {
      ctx.fillStyle = "#5e3f28";
      ctx.fillRect(px - 0.5, box.top.y - 52, 5.5, 52);
      ctx.fillStyle = "#7a5436";
      ctx.fillRect(px, box.top.y - 52, 4.5, 52);
      ctx.fillStyle = "rgba(255, 230, 190, 0.25)";
      ctx.fillRect(px, box.top.y - 52, 1.2, 52);
    }
    // Crates of produce along the counter.
    const produce = [["#e0503a", 0], ["#e8883a", 1], ["#8fc06a", 2], ["#f2c230", 3], ["#4a5ab8", 4]];
    produce.forEach(([color, i]) => {
      const cx = box.top.x + 14 + i * ((box.top.w - 28) / 4), cy = box.top.y + box.top.h * 0.55;
      ctx.fillStyle = "#6e4e32";
      ctx.fillRect(cx - 10, cy - 3, 20, 9);
      ctx.fillStyle = "#8a6440";
      ctx.fillRect(cx - 10, cy - 3, 20, 2);
      for (let k = 0; k < 5; k++) {
        const px = cx - 7 + k * 3.5, py = cy - 4 - (k % 2) * 2;
        ctx.fillStyle = shadeColor(color, -40);
        ctx.beginPath();
        ctx.arc(px, py + 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillRect(px - 1.2, py - 1.6, 1.2, 1.2);
      }
    });
    // The awning: stripes with a scalloped edge, shaded underneath.
    const ay = box.top.y - 58;
    ctx.fillStyle = "rgba(30, 20, 10, 0.3)";
    ctx.fillRect(a.x - 6, ay + 1, w + 12, 16);
    for (let i = 0; i < 9; i++) {
      const sx = a.x - 6 + (i * (w + 12)) / 9, sw = (w + 12) / 9 + 0.5;
      ctx.fillStyle = i % 2 ? "#f4efe4" : "#5f9a52";
      ctx.fillRect(sx, ay, sw, 13);
      ctx.beginPath();
      ctx.arc(sx + sw / 2, ay + 13, sw / 2, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(a.x - 6, ay, w + 12, 2);
    ctx.fillStyle = "rgba(40, 60, 30, 0.25)";
    ctx.fillRect(a.x - 6, ay + 11, w + 12, 2);
    // The sign board on top: "HAZEL'S FARM".
    ctx.fillStyle = "#5e3f28";
    roundRectPath(ctx, a.x + w / 2 - 44, ay - 22, 88, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#f2e6c8";
    roundRectPath(ctx, a.x + w / 2 - 42, ay - 20, 84, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#4f7a3f";
    ctx.font = "800 10px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HAZEL'S FARM", a.x + w / 2, ay - 8.5);
    // A chalkboard leaning on the front: "FRESH TODAY".
    ctx.fillStyle = "#6e4e32";
    ctx.fillRect(box.face.x + 8, box.face.y + 2, 36, 21);
    ctx.fillStyle = "#2f3a34";
    ctx.fillRect(box.face.x + 10, box.face.y + 4, 32, 17);
    ctx.fillStyle = "rgba(240, 240, 230, 0.85)";
    ctx.font = "700 6.5px 'Quicksand', sans-serif";
    ctx.fillText("FRESH", box.face.x + 26, box.face.y + 11.5);
    ctx.fillText("TODAY", box.face.x + 26, box.face.y + 18.5);
    ctx.textAlign = "left";
    // A lantern hanging from the right post.
    const lx = a.x + w - 6, ly = ay + 22;
    ctx.fillStyle = "#2e2a26";
    ctx.fillRect(lx - 0.6, ly - 8, 1.2, 8);
    ctx.fillRect(lx - 5, ly, 10, 2);
    ctx.fillStyle = isNightOutside() ? "#ffd98a" : "#f4e2b0";
    ctx.fillRect(lx - 4, ly + 2, 8, 10);
    ctx.fillStyle = "#2e2a26";
    ctx.fillRect(lx - 5, ly + 12, 10, 2);
    ctx.fillRect(lx - 0.6, ly + 2, 1.2, 10);
  },

  // The chicken coop: a little wooden house on stilts with a sloped roof,
  // a round door and a ramp down, a nesting box on the side.
  chickenCoop(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, y = a.y;
    groundShadow(ctx, (a.x + b.x) / 2, y, w / 2 + 6, 8);
    // Stilts.
    ctx.fillStyle = "#5e3f28";
    for (const px of [a.x + 6, b.x - 10]) ctx.fillRect(px, y - 16, 4, 16);
    // The house.
    const hy = y - 58;
    ctx.fillStyle = shadeColor("#c9a46a", -70);
    ctx.fillRect(a.x + 1, hy - 1, w - 2, 44);
    drawBoards(ctx, a.x + 2, hy, w - 4, 42, "#c9a46a", 8, f.x);
    const sh = ctx.createLinearGradient(0, hy, 0, hy + 42);
    sh.addColorStop(0, "rgba(255, 240, 210, 0.08)");
    sh.addColorStop(1, "rgba(60, 30, 10, 0.25)");
    ctx.fillStyle = sh;
    ctx.fillRect(a.x + 2, hy, w - 4, 42);
    // Roof: red, sloping down to the left, overhanging.
    outlined(ctx, "#a8483c", () => {
      ctx.beginPath();
      ctx.moveTo(a.x - 6, hy + 4);
      ctx.lineTo(b.x + 6, hy - 14);
      ctx.lineTo(b.x + 6, hy - 6);
      ctx.lineTo(a.x - 6, hy + 12);
      ctx.closePath();
    });
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.moveTo(a.x - 6, hy + 4);
    ctx.lineTo(b.x + 6, hy - 14);
    ctx.lineTo(b.x + 6, hy - 12);
    ctx.lineTo(a.x - 6, hy + 6);
    ctx.fill();
    // Round door, and the ramp down with its slats.
    const dx = a.x + w * 0.62;
    ctx.fillStyle = "#3a2618";
    ctx.beginPath();
    ctx.arc(dx, hy + 30, 8, Math.PI, 0);
    ctx.lineTo(dx + 8, hy + 40);
    ctx.lineTo(dx - 8, hy + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6440";
    ctx.beginPath();
    ctx.moveTo(dx - 7, hy + 41);
    ctx.lineTo(dx + 7, hy + 41);
    ctx.lineTo(dx + 16, y);
    ctx.lineTo(dx + 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(40, 20, 10, 0.4)";
    for (let k = 1; k < 5; k++) ctx.fillRect(dx - 6 + k * 2.2, hy + 41 + k * 3.5, 12, 1);
    // A small window, and the nesting box on the left with straw.
    drawFarmWindow(ctx, a.x + 10, hy + 12, 12, 11);
    ctx.fillStyle = "#b08a58";
    ctx.fillRect(a.x - 8, hy + 20, 12, 16);
    ctx.fillStyle = "#e3c26a";
    ctx.fillRect(a.x - 7, hy + 19, 10, 3);
    ctx.fillStyle = "rgba(60, 30, 10, 0.4)";
    ctx.fillRect(a.x - 8, hy + 34, 12, 2);
  },

  // A handful of hens pecking about the run: each wanders slowly between
  // spots (the same for everyone, from the clock), bobs its head down to
  // peck, and flicks its tail.
  chickens(ctx, f) {
    const t = Date.now() / 1000;
    const hens = [];
    for (let i = 0; i < 5; i++) {
      const step = Math.floor(t / 6 + i * 0.37), k = (t / 6 + i * 0.37) % 1;
      const at = (n) => ({ x: f.x + 0.3 + noise(i * 17.3 + n * 3.1) * (f.w - 0.6), y: f.y + 0.15 + noise(i * 11.1 + n * 5.7) * (f.h - 0.3) });
      const p0 = at(step), p1 = at(step + 1);
      const walk = Math.min(1, k * 2.5); // walk for a bit, then peck
      const e = walk * walk * (3 - 2 * walk);
      hens.push({ x: p0.x + (p1.x - p0.x) * e, y: p0.y + (p1.y - p0.y) * e, facing: p1.x >= p0.x ? 1 : -1, pecking: walk >= 1 && Math.sin(t * 9 + i) > 0.2, walking: walk < 1, i });
    }
    hens.sort((p, q) => p.y - q.y);
    for (const h of hens) {
      const p = toScreen(h.x, h.y);
      const s = h.facing;
      groundShadow(ctx, p.x, p.y, 8, 2.5, 0.22);
      const brown = h.i % 3 === 1;
      const body = brown ? "#b8743a" : "#f4efe4";
      const legs = h.walking ? Math.sin(t * 14 + h.i) * 1.5 : 0;
      ctx.strokeStyle = "#d9a040";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - 1.5, p.y - 5);
      ctx.lineTo(p.x - 1.5 + legs, p.y);
      ctx.moveTo(p.x + 1.5, p.y - 5);
      ctx.lineTo(p.x + 1.5 - legs, p.y);
      ctx.stroke();
      // Body and tail.
      outlined(ctx, body, () => {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 9, 7.5, 5.5, 0, 0, Math.PI * 2);
      }, 1);
      ctx.fillStyle = shadeColor(body, -30);
      ctx.beginPath();
      ctx.moveTo(p.x - s * 5, p.y - 11);
      ctx.lineTo(p.x - s * 11, p.y - 17 + Math.sin(t * 5 + h.i) * 0.8);
      ctx.lineTo(p.x - s * 8, p.y - 8);
      ctx.fill();
      ctx.fillStyle = shadeColor(body, -18); // wing
      ctx.beginPath();
      ctx.ellipse(p.x - s * 0.5, p.y - 8.5, 4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(p.x - 2, p.y - 14, 4, 1.2);
      // Head (down when pecking), comb, beak, eye.
      const hx = p.x + s * (h.pecking ? 8 : 6), hy = p.y - (h.pecking ? 6 : 15);
      outlined(ctx, body, () => {
        ctx.beginPath();
        ctx.arc(hx, hy, 3.6, 0, Math.PI * 2);
      }, 0.8);
      ctx.fillStyle = "#d9403a";
      ctx.beginPath();
      ctx.arc(hx - s * 0.5, hy - 3.6, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(hx + s * 1.5, hy + 1.5, 1.4, 2.2);
      ctx.fillStyle = "#e8a03a";
      ctx.beginPath();
      ctx.moveTo(hx + s * 3, hy - 0.8);
      ctx.lineTo(hx + s * 6, hy + 0.3);
      ctx.lineTo(hx + s * 3, hy + 1.2);
      ctx.fill();
      ctx.fillStyle = "#2a2020";
      ctx.fillRect(hx + s * 1 - 0.6, hy - 1.2, 1.3, 1.3);
    }
  },

  // The windmill: a tapering white tower of shingles on a stone base, a
  // door and a window, a dark cap, and four lattice sails turning slowly.
  windmill(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, cx = (a.x + b.x) / 2, y = a.y, h = 150, topW = w * 0.52;
    groundShadow(ctx, cx, y, w / 2 + 10, 10, 0.24);
    const tower = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, y - 10);
      ctx.lineTo(cx - topW / 2, y - h);
      ctx.lineTo(cx + topW / 2, y - h);
      ctx.lineTo(b.x, y - 10);
      ctx.closePath();
    };
    outlined(ctx, "#ece4d4", tower);
    ctx.save();
    tower();
    ctx.clip();
    // Shingle rows, and shading down the right-hand side.
    for (let yy = y - h, row = 0; yy < y; yy += 7, row++) {
      for (let xx = a.x - 20 + (row % 2) * 5; xx < b.x + 20; xx += 10) {
        ctx.fillStyle = shadeColor("#ece4d4", Math.round((noise(row * 7.3 + xx * 0.11) - 0.5) * 14));
        ctx.fillRect(xx, yy, 9.5, 6.5);
      }
      ctx.fillStyle = "rgba(90, 70, 50, 0.22)";
      ctx.fillRect(a.x - 20, yy + 6, w + 40, 1);
    }
    const side = ctx.createLinearGradient(a.x, 0, b.x, 0);
    side.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    side.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    side.addColorStop(1, "rgba(60, 40, 30, 0.28)");
    ctx.fillStyle = side;
    ctx.fillRect(a.x, y - h, w, h);
    ctx.restore();
    // Stone base.
    for (let i = 0, sx = a.x - 2; sx < b.x + 2; i++, sx += 14) {
      ctx.fillStyle = shadeColor("#8e877c", Math.round((noise(i * 3.9 + f.x) - 0.5) * 22));
      roundRectPath(ctx, sx, y - 11, Math.min(13, b.x + 2 - sx), 11, 2);
      ctx.fill();
    }
    // Door and window.
    ctx.fillStyle = "#5e3f28";
    ctx.beginPath();
    ctx.moveTo(cx - 10, y - 11);
    ctx.lineTo(cx - 10, y - 36);
    ctx.arc(cx, y - 36, 10, Math.PI, 0);
    ctx.lineTo(cx + 10, y - 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 230, 190, 0.18)";
    ctx.fillRect(cx - 8, y - 38, 2, 26);
    ctx.fillStyle = "#c8a040";
    ctx.fillRect(cx + 5, y - 24, 2, 2);
    drawFarmWindow(ctx, cx - 7, y - 92, 14, 14);
    // The cap: a dark rounded roof.
    outlined(ctx, "#4a3a36", () => {
      ctx.beginPath();
      ctx.moveTo(cx - topW / 2 - 8, y - h + 2);
      ctx.quadraticCurveTo(cx, y - h - 34, cx + topW / 2 + 8, y - h + 2);
      ctx.closePath();
    });
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2 - 4, y - h - 2);
    ctx.quadraticCurveTo(cx - 6, y - h - 24, cx + 4, y - h - 16);
    ctx.lineTo(cx, y - h - 13);
    ctx.quadraticCurveTo(cx - 8, y - h - 18, cx - topW / 2 - 2, y - h);
    ctx.fill();
    // The sails, turning.
    const hub = { x: cx, y: y - h - 6 };
    // (Kept to one turn's worth: canvas angles lose precision when huge.)
    const turn = ((Date.now() / 1000) * 0.6) % (Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(hub.x, hub.y);
      ctx.rotate(turn + (k * Math.PI) / 2);
      ctx.fillStyle = "#4e3a2c"; // the arm
      ctx.fillRect(-2, -86, 4, 84);
      // The lattice frame and its canvas.
      ctx.fillStyle = "rgba(244, 238, 226, 0.92)";
      ctx.fillRect(2, -84, 16, 64);
      ctx.strokeStyle = "#6e5440";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(2, -84, 16, 64);
      ctx.beginPath();
      for (let yy = -76; yy < -20; yy += 8) {
        ctx.moveTo(2, yy);
        ctx.lineTo(18, yy);
      }
      ctx.moveTo(10, -84);
      ctx.lineTo(10, -20);
      ctx.stroke();
      ctx.fillStyle = "rgba(60, 40, 30, 0.12)";
      ctx.fillRect(12, -84, 6, 64);
      ctx.restore();
    }
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(hub.x - 1.5, hub.y - 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // A stone well: a round wall of cut stones (lit on top, shaded toward
  // the ground and the sides), dark water inside, a little shingled roof
  // on two posts, a winch with its crank, and a bucket on the rope.
  well(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, cx = (a.x + b.x) / 2, y = a.y;
    const rx = w / 2 - 3, ry = 8, top = y - 26;
    groundShadow(ctx, cx, y, rx + 6, 7);
    // Posts (behind the wall).
    for (const px of [a.x + 4, b.x - 8]) {
      ctx.fillStyle = "#4e3422";
      ctx.fillRect(px - 0.5, y - 66, 5, 44);
      ctx.fillStyle = "#6e4a30";
      ctx.fillRect(px, y - 66, 4, 44);
      ctx.fillStyle = "rgba(255, 230, 190, 0.25)";
      ctx.fillRect(px, y - 66, 1.2, 44);
    }
    // The wall: a cylinder, with its outline.
    const wall = () => {
      ctx.beginPath();
      ctx.moveTo(cx - rx, top);
      ctx.lineTo(cx - rx, y - ry + 2);
      ctx.ellipse(cx, y - ry + 2, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, top);
      ctx.closePath();
    };
    outlined(ctx, "#9a948a", wall);
    ctx.save();
    wall();
    ctx.clip();
    // Courses of stones, offset row to row, each a slightly different grey.
    for (let row = 0, yy = top; yy < y + 2; row++, yy += 7) {
      for (let xx = cx - rx - (row % 2) * 7; xx < cx + rx; xx += 14) {
        ctx.fillStyle = shadeColor("#a39c90", Math.round((noise(row * 5.3 + xx * 0.7 + f.x) - 0.5) * 26));
        roundRectPath(ctx, xx + 0.8, yy + 0.8, 12.4, 5.6, 1.6);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fillRect(xx + 2, yy + 1.2, 8, 1);
      }
    }
    // Round shading: darker at both sides and toward the ground.
    const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    side.addColorStop(0, "rgba(30, 25, 25, 0.35)");
    side.addColorStop(0.35, "rgba(30, 25, 25, 0)");
    side.addColorStop(0.7, "rgba(30, 25, 25, 0.05)");
    side.addColorStop(1, "rgba(30, 25, 25, 0.4)");
    ctx.fillStyle = side;
    ctx.fillRect(cx - rx, top, rx * 2, y - top + 4);
    const low = ctx.createLinearGradient(0, top, 0, y);
    low.addColorStop(0, "rgba(0, 0, 0, 0)");
    low.addColorStop(1, "rgba(30, 25, 25, 0.3)");
    ctx.fillStyle = low;
    ctx.fillRect(cx - rx, top, rx * 2, y - top + 4);
    ctx.restore();
    // The rim (a lighter capstone ring) and the dark water inside.
    ctx.fillStyle = "#6e675e";
    ctx.beginPath();
    ctx.ellipse(cx, top, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c2bbb0";
    ctx.beginPath();
    ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const water = ctx.createRadialGradient(cx - 4, top - 1, 1, cx, top, rx - 4);
    water.addColorStop(0, "#3a5a78");
    water.addColorStop(1, "#142230");
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(cx, top + 0.5, rx - 5, ry - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 225, 245, 0.35)";
    ctx.fillRect(cx - 6, top - 1, 7, 1);
    // Roof.
    outlined(ctx, "#6e4a3a", () => {
      ctx.beginPath();
      ctx.moveTo(a.x - 8, y - 62);
      ctx.lineTo(cx, y - 84);
      ctx.lineTo(b.x + 8, y - 62);
      ctx.closePath();
    });
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let k = 1; k < 4; k++) ctx.fillRect(a.x - 8 + k * 3.4, y - 62 - k * 5.4, w + 16 - k * 6.8, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(a.x - 8, y - 62);
    ctx.lineTo(cx, y - 84);
    ctx.lineTo(cx, y - 80);
    ctx.lineTo(a.x - 4, y - 62);
    ctx.fill();
    // The winch, its crank, the rope and a bucket.
    ctx.fillStyle = "#5e3f28";
    ctx.fillRect(a.x + 6, y - 53, w - 12, 6);
    ctx.fillStyle = "#7a5436";
    ctx.fillRect(a.x + 6, y - 53, w - 12, 2);
    ctx.fillStyle = "#3a3a3e";
    ctx.fillRect(b.x - 6, y - 51, 7, 2);
    ctx.fillRect(b.x, y - 51, 2, 9);
    ctx.strokeStyle = "#c8a878";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 6, y - 47);
    ctx.lineTo(cx + 6, y - 38);
    ctx.stroke();
    ctx.fillStyle = "#7a8288";
    ctx.beginPath();
    ctx.moveTo(cx + 1, y - 38);
    ctx.lineTo(cx + 11, y - 38);
    ctx.lineTo(cx + 10, y - 30);
    ctx.lineTo(cx + 2, y - 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(cx + 2.5, y - 37, 1.5, 6);
    ctx.fillStyle = "#4e5358";
    ctx.fillRect(cx + 1, y - 38, 10, 1.2);
  },

  // A red wheelbarrow with a load of soil and a trowel stuck in it.
  wheelbarrow(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, y = a.y;
    // Handles and legs.
    ctx.strokeStyle = "#6e4e32";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x + 2, y - 14);
    ctx.lineTo(a.x + w * 0.55, y - 18);
    ctx.moveTo(a.x + 10, y - 2);
    ctx.lineTo(a.x + 14, y - 14);
    ctx.stroke();
    ctx.lineCap = "butt";
    // The tray.
    outlined(ctx, "#c8423a", () => {
      ctx.beginPath();
      ctx.moveTo(a.x + 12, y - 24);
      ctx.lineTo(b.x - 6, y - 26);
      ctx.lineTo(b.x - 12, y - 10);
      ctx.lineTo(a.x + 18, y - 10);
      ctx.closePath();
    });
    ctx.fillStyle = "#5a3a24";
    ctx.beginPath();
    ctx.ellipse(a.x + w * 0.58, y - 24, w * 0.3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(a.x + 14, y - 22, w - 30, 1.5);
    ctx.fillStyle = "rgba(60, 10, 5, 0.3)";
    ctx.fillRect(a.x + 19, y - 13, w - 32, 3);
    // Trowel.
    ctx.fillStyle = "#8a9096";
    ctx.fillRect(a.x + w * 0.62, y - 36, 3, 10);
    ctx.fillStyle = "#6e4e32";
    ctx.fillRect(a.x + w * 0.62, y - 42, 3, 6);
    // The wheel.
    ctx.fillStyle = "#2e2a2a";
    ctx.beginPath();
    ctx.arc(b.x - 8, y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a9096";
    ctx.beginPath();
    ctx.arc(b.x - 8, y - 6, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // An apple tree: a leafy tree (like the yard's) with apples among the
  // leaves, and a few windfalls in the grass. No apples in winter; more
  // in autumn.
  appleTree(ctx, f) {
    FURNITURE_DRAWERS.yardTree(ctx, f);
    const season = yardSeason();
    if (season === "winter") return;
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const sway = Math.sin(performance.now() / 1600 + (f.n ?? 0)) * 1.2;
    const count = season === "autumn" ? 14 : season === "spring" ? 0 : 10;
    for (let i = 0; i < count; i++) {
      const ang = noise(f.x * 3.1 + i * 2.3) * Math.PI * 2, d = Math.sqrt(noise(f.y + i * 1.7));
      const x = base.x + sway + Math.cos(ang) * d * 38, y = base.y - 78 + Math.sin(ang) * d * 30;
      ctx.fillStyle = "#7a1e1a";
      ctx.beginPath();
      ctx.arc(x, y + 0.6, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 4 ? "#d9362e" : "#e8a030";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(x - 1.6, y - 1.8, 1.4, 1.4);
    }
    // Spring: blossom instead.
    if (season === "spring") {
      for (let i = 0; i < 16; i++) {
        const ang = noise(f.x * 3.1 + i * 2.3) * Math.PI * 2, d = Math.sqrt(noise(f.y + i * 1.7));
        ctx.fillStyle = i % 3 ? "#f7d8e4" : "#ffffff";
        ctx.beginPath();
        ctx.arc(base.x + sway + Math.cos(ang) * d * 40, base.y - 80 + Math.sin(ang) * d * 32, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Windfalls.
    for (let i = 0; i < 3; i++) {
      const x = base.x - 22 + noise(f.x + i * 4.4) * 44, y = base.y + 2 + noise(f.y + i * 3.3) * 6;
      ctx.fillStyle = "#7a1e1a";
      ctx.beginPath();
      ctx.ellipse(x, y + 0.5, 3.4, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c8322a";
      ctx.beginPath();
      ctx.ellipse(x, y, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A wooden crate heaped with picked apples.
  appleCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#a8845a");
    drawBoards(ctx, box.face.x, box.face.y + 2, box.face.w, box.face.h - 5, "#a8845a", 7, f.x);
    ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
    ctx.fillRect(box.face.x, box.face.y + box.face.h / 2, box.face.w, 1.5);
    for (let i = 0; i < 9; i++) {
      const x = box.top.x + 5 + (i % 5) * ((box.top.w - 10) / 4), y = box.top.y + 3 - Math.floor(i / 5) * 3 - (i % 2);
      ctx.fillStyle = "#7a1e1a";
      ctx.beginPath();
      ctx.arc(x, y + 0.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 3 ? "#d9362e" : "#e8a030";
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(x - 1.5, y - 1.8, 1.3, 1.3);
    }
  },

  // A row of tall sunflowers, nodding in the breeze (bare stalks in winter).
  sunflowerRow(ctx, f) {
    const t = performance.now() / 1000;
    const season = yardSeason();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const p = toScreen(f.x + ((i + 0.5) / n) * f.w, f.y + f.h);
      const h = 58 + noise(i * 2.3 + f.x) * 18;
      const sway = Math.sin(t * 1.1 + i * 0.8) * 2;
      groundShadow(ctx, p.x, p.y, 7, 2.5, 0.18);
      ctx.strokeStyle = "#3f6a32";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + sway * 0.4, p.y - h / 2, p.x + sway, p.y - h);
      ctx.stroke();
      if (season === "winter") continue;
      // Leaves.
      for (const [dy, side] of [[0.35, -1], [0.55, 1]]) {
        ctx.fillStyle = "#4f8a3f";
        ctx.beginPath();
        ctx.ellipse(p.x + side * 6 + sway * dy, p.y - h * dy, 6, 2.8, side * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fillRect(p.x + side * 5 + sway * dy - 2, p.y - h * dy - 1.5, 3, 0.8);
      }
      // The flower head: petals, a dark seed center, a lit edge.
      const fx = p.x + sway, fy = p.y - h;
      const petals = season === "autumn" ? "#d9a02a" : "#f2c230";
      ctx.fillStyle = shadeColor(petals, -60);
      ctx.beginPath();
      ctx.arc(fx, fy + 0.8, 11, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        ctx.fillStyle = k % 2 ? petals : shadeColor(petals, 16);
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(ang) * 7, fy + Math.sin(ang) * 7, 4.2, 2, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#5a3a1e";
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      for (let k = 0; k < 6; k++) ctx.fillRect(fx - 3 + noise(k + i) * 6, fy - 3 + noise(k * 2 + i) * 6, 1, 1);
      ctx.fillStyle = "rgba(255, 220, 160, 0.35)";
      ctx.fillRect(fx - 3, fy - 4, 3, 1.2);
    }
  },

  // Pumpkins on their vines: curling green vines with leaves, and
  // pumpkins of all sizes (ribbed, lit on top, a stem), a couple still
  // green. (Winter: a few left on the frosty ground.)
  pumpkinPatch(ctx, f) {
    const season = yardSeason();
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, h = b.y - a.y;
    // Vines: curling stems along the rows, with broad lobed leaves (an
    // outline, a lit top lobe, a vein) and little curly tendrils.
    if (season !== "winter") {
      for (let v = 0; v < 5; v++) {
        const y0 = a.y + ((v + 0.5) / 5) * h;
        ctx.strokeStyle = "#2f5a26";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x + 4, y0);
        for (let k = 1; k <= 8; k++) ctx.quadraticCurveTo(a.x + ((k - 0.5) / 8) * w, y0 + (k % 2 ? -6 : 6), a.x + (k / 8) * w - 4, y0);
        ctx.stroke();
        for (let k = 0; k < 9; k++) {
          const lx = a.x + 8 + noise(v * 5.1 + k * 1.3) * (w - 16), ly = y0 + (noise(v * 3.7 + k) - 0.5) * 12;
          const r = 4.2 + noise(v + k * 2.9) * 2;
          const shade = k % 3 === 0 ? "#4a8a3a" : k % 3 === 1 ? "#5a9a44" : "#3f7a34";
          ctx.fillStyle = shadeColor(shade, -50);
          for (const [dx, dy] of [[-r * 0.7, 0], [r * 0.7, 0], [0, -r * 0.6]]) {
            ctx.beginPath();
            ctx.arc(lx + dx, ly + dy + 0.8, r + 0.9, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = shade;
          for (const [dx, dy] of [[-r * 0.7, 0], [r * 0.7, 0], [0, -r * 0.6]]) {
            ctx.beginPath();
            ctx.arc(lx + dx, ly + dy, r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = shadeColor(shade, 28);
          ctx.beginPath();
          ctx.arc(lx - r * 0.2, ly - r * 0.9, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = shadeColor(shade, -40);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(lx, ly + r * 0.6);
          ctx.lineTo(lx, ly - r * 0.8);
          ctx.stroke();
          if (k % 3 === 2) {
            ctx.strokeStyle = "#5a8a3a";
            ctx.beginPath();
            ctx.arc(lx + r * 1.8, ly + 2, 2.2, 0, Math.PI * 1.6);
            ctx.stroke();
          }
        }
      }
    }
    // Pumpkins (fewer in winter; a green one or two in summer).
    const count = season === "winter" ? 4 : 11;
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({ x: a.x + 12 + noise(i * 4.7 + 1) * (w - 24), y: a.y + 10 + noise(i * 6.1 + 2) * (h - 16), r: 7 + noise(i * 2.9 + 3) * 7, green: season === "summer" && i % 5 === 2 });
    }
    list.sort((p, q) => p.y - q.y);
    for (const p of list) {
      const color = p.green ? "#7a9a3a" : "#e8883a";
      groundShadow(ctx, p.x, p.y + 1, p.r + 2, p.r * 0.35, 0.22);
      ctx.fillStyle = shadeColor(color, -70);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - p.r * 0.62, p.r + 1.3, p.r * 0.72 + 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ribs: overlapping lobes, darker at the sides, lit in the middle.
      for (const [dx, k] of [[-0.55, -24], [0.55, -24], [-0.25, -6], [0.25, -6], [0, 10]]) {
        ctx.fillStyle = shadeColor(color, k);
        ctx.beginPath();
        ctx.ellipse(p.x + dx * p.r, p.y - p.r * 0.62, p.r * 0.5, p.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255, 245, 210, 0.45)";
      ctx.beginPath();
      ctx.ellipse(p.x - p.r * 0.2, p.y - p.r * 1.05, p.r * 0.28, p.r * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a4020";
      ctx.fillRect(p.x - 1.3, p.y - p.r * 1.4 - 3, 2.6, 5);
    }
  },

  // The farm's sign by the road: a carved board on two posts, "Hazel's
  // Farm", with a painted sunflower.
  farmSign(ctx, f) {
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, cx = (a.x + b.x) / 2, y = a.y;
    groundShadow(ctx, cx, y, w / 2, 4, 0.2);
    for (const px of [a.x + 6, b.x - 10]) {
      ctx.fillStyle = "#4e3422";
      ctx.fillRect(px - 0.5, y - 40, 5, 40);
      ctx.fillStyle = "#6e4a30";
      ctx.fillRect(px, y - 40, 4, 40);
      ctx.fillStyle = "rgba(255, 230, 190, 0.25)";
      ctx.fillRect(px, y - 40, 1.2, 40);
    }
    ctx.fillStyle = "#4e3422";
    roundRectPath(ctx, a.x - 5, y - 50, w + 10, 26, 5);
    ctx.fill();
    ctx.fillStyle = "#9a7048";
    roundRectPath(ctx, a.x - 3, y - 48, w + 6, 22, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 235, 200, 0.25)";
    ctx.fillRect(a.x - 1, y - 47, w + 2, 2);
    ctx.fillStyle = "rgba(60, 35, 15, 0.25)";
    for (let k = 0; k < 3; k++) ctx.fillRect(a.x, y - 42 + k * 6, w, 0.8);
    // A little sunflower on the left.
    const sx = a.x + 6, sy = y - 37;
    ctx.fillStyle = "#f2c230";
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(sx + Math.cos(ang) * 3.6, sy + Math.sin(ang) * 3.6, 2.4, 1.2, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#5a3a1e";
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4ead0";
    ctx.font = "800 11px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(40, 20, 10, 0.5)";
    ctx.fillText("Hazel's Farm", cx + 9, y - 32);
    ctx.fillStyle = "#f4ead0";
    ctx.fillText("Hazel's Farm", cx + 9, y - 33);
    ctx.textAlign = "left";
  },
});
