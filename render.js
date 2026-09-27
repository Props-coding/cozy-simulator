// Stardew-style drawing: turning grid positions (from world.js) into the
// picture on the canvas. This is the only file that knows about screen
// pixels; world.js and main.js only ever think in grid units.
//
// The look (see CLAUDE.md's "Stardew-style rendering" section):
// - The floor is a flat grid of square tiles, seen straight from above.
// - Walls, furniture and characters stand upright on the floor: each has
//   a lighter top surface, a front face, and a darker band at its base.
// - One light, straight from above, so every soft shadow sits directly
//   under its object.
// - Draw order, one rule: whatever stands lower on screen draws in front.

// --- Grid to screen ---
// Every drawing function below goes through this one formula, so nothing
// can drift out of alignment with anything else.
const TILE = 46; // one grid unit (one floor tile), in screen pixels
const ORIGIN_X = 86; // where grid (0,0) lands on the canvas, in pixels
const ORIGIN_Y = 77;

function toScreen(gx, gy) {
  return { x: ORIGIN_X + gx * TILE, y: ORIGIN_Y + gy * TILE };
}

const WOOD = "#7a5c3e";
const WOOD_DARK = "#5c4530";
const WALL_HEIGHT = 40; // how tall walls stand, in screen pixels
const LOW_WALL_HEIGHT = 8; // the front (bottom) wall, kept short so it doesn't hide the rooms

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- The creator's crown ---
// True if `name` is the house owner (CONFIG.ownerName, any capitals).
// Only used together with a server-checked admin badge, so the crown
// can't be faked by just typing the owner's name.
function isHouseOwner(name) {
  return !!CONFIG.ownerName && String(name).toLowerCase() === CONFIG.ownerName.toLowerCase();
}

// Draws the owner's little gold crown, `s` pixels per unit (the crown is
// 12 units wide and 10 tall), with its bottom middle at (cx, bottom).
// Our own design: three rounded points, each topped with a pearl, a ruby
// in the middle of the band and two sapphires beside it. Lit from above,
// like everything else: lighter gold at the top, darker at the band.
function drawCreatorCrown(ctx, cx, bottom, s = 1) {
  ctx.save();
  ctx.translate(cx - 6 * s, bottom - 10 * s);
  ctx.scale(s, s);
  // The points and body.
  const gold = ctx.createLinearGradient(0, 1, 0, 10);
  gold.addColorStop(0, "#ffe27a");
  gold.addColorStop(1, "#d99a1e");
  ctx.beginPath();
  ctx.moveTo(0.8, 9.5);
  ctx.lineTo(0.5, 3);
  ctx.lineTo(3.4, 5.6);
  ctx.lineTo(6, 1.6);
  ctx.lineTo(8.6, 5.6);
  ctx.lineTo(11.5, 3);
  ctx.lineTo(11.2, 9.5);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#8a5a0e";
  ctx.stroke();
  // The band along the bottom, a shade darker.
  ctx.fillStyle = "#c9861a";
  ctx.fillRect(1.2, 7.2, 9.6, 2);
  // Pearls on the tips.
  ctx.fillStyle = "#fff8e6";
  for (const [x, y] of [[0.5, 2.6], [6, 1.2], [11.5, 2.6]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // Jewels on the band: a ruby in the middle, sapphires either side.
  ctx.fillStyle = "#d93a4a";
  ctx.beginPath();
  ctx.arc(6, 8.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a6fd9";
  for (const x of [3, 9]) {
    ctx.beginPath();
    ctx.arc(x, 8.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The same crown as a picture (for the chat), drawn once and reused.
let creatorCrownPicture = null;
function creatorCrownURL() {
  if (!creatorCrownPicture) {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = 42;
    drawCreatorCrown(c.getContext("2d"), 24, 41, 3.8);
    creatorCrownPicture = c.toDataURL();
  }
  return creatorCrownPicture;
}

// Shortens text to at most `max` characters, counting an emoji (even a
// combined one like 👍🏽, which is really several hidden pieces) as one
// character so it never gets cut in half. Adds `ending` (like "…") when
// something was cut off.
function clipText(text, max, ending = "") {
  const chars = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
  if (chars.length <= max) return text;
  return chars.slice(0, max - (ending ? 1 : 0)).join("") + ending;
}

// Lightens (positive amt) or darkens (negative amt) a "#rrggbb" color.
function shadeColor(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  // As "#rrggbb", so a shaded color can be shaded again.
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// A warm little lamp glow: a soft halo around a light source.
function drawGlow(ctx, cx, cy, r, color) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 220, 130, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// --- The two building blocks: shadows and upright blocks ---

// A soft oval shadow on the floor, centered under the bottom edge of a
// footprint. Light comes from straight above, so shadows sit right under
// things, never off to one side.
function drawShadow(ctx, gx, gy, w, h) {
  const bottom = toScreen(gx + w / 2, gy + h);
  ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
  ctx.beginPath();
  ctx.ellipse(bottom.x, bottom.y, (w * TILE) / 2 + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Draws something standing on the floor: a footprint (grid units) raised
// up by `height` pixels. You see its top surface (a little lighter, lit
// from above) and its front face (the base color, with a darker band
// along the bottom where it meets the floor). Returns the pixel box of
// the top surface and front face so callers can add details on them.
function drawBlock(ctx, gx, gy, w, h, height, color) {
  const a = toScreen(gx, gy);
  const b = toScreen(gx + w, gy + h);
  const pw = b.x - a.x;
  const topBox = { x: a.x, y: a.y - height, w: pw, h: b.y - a.y };
  const faceBox = { x: a.x, y: b.y - height, w: pw, h: height };

  ctx.fillStyle = shadeColor(color, 22);
  ctx.fillRect(topBox.x, topBox.y, topBox.w, topBox.h);
  ctx.fillStyle = color;
  ctx.fillRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
  // Darker band at the base, and a thin highlight on the top edge.
  const band = Math.min(4, height / 3);
  ctx.fillStyle = shadeColor(color, -30);
  ctx.fillRect(faceBox.x, faceBox.y + faceBox.h - band, faceBox.w, band);
  ctx.fillStyle = shadeColor(color, 40);
  ctx.fillRect(topBox.x, topBox.y, topBox.w, 1.5);

  return { top: topBox, face: faceBox };
}

// --- Floors (drawn first, flat, never cover anything) ---
// Floors and rugs never change, so they're painted once onto a hidden
// canvas and copied onto the screen each frame, which is much faster
// than redrawing hundreds of floorboards 60 times a second.

// A repeatable "random" number from 0 to 1 for a given n, so each
// floorboard gets its own slightly different shade that stays the same
// every time the page loads.
function noise(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Wood boards running left to right, each a slightly different shade,
// with staggered joins like a real floor.
function drawPlanks(ctx, box, color) {
  const plankH = TILE / 3;
  for (let row = 0; row * plankH < box.h; row++) {
    const y = box.y + row * plankH;
    let x = box.x - noise(row) * TILE * 3;
    for (let i = 0; x < box.x + box.w; i++) {
      const len = TILE * (2.5 + noise(row * 31 + i + 0.5) * 3); // boards of different lengths
      ctx.fillStyle = shadeColor(color, Math.round((noise(row * 31 + i) - 0.5) * 16));
      ctx.fillRect(x, y, len, plankH);
      ctx.fillStyle = "rgba(40, 20, 5, 0.18)";
      ctx.fillRect(x, y, 1, plankH); // join between boards
      x += len;
    }
    ctx.fillStyle = "rgba(40, 20, 5, 0.22)";
    ctx.fillRect(box.x, y + plankH - 1, box.w, 1); // gap between rows
  }
}

// Soft carpet: an even color with tiny flecks of lighter and darker fibers.
function drawCarpet(ctx, box, color) {
  ctx.fillStyle = color;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  for (let i = 0; i < (box.w * box.h) / 30; i++) {
    ctx.fillStyle = noise(i) > 0.5 ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(box.x + noise(i + 0.3) * box.w, box.y + noise(i + 0.7) * box.h, 2, 2);
  }
}

// Small kitchen-style tiles, alternating the room color with a slightly
// lighter shade of it, with thin grout lines.
function drawChecker(ctx, box, color) {
  const size = TILE / 2;
  for (let ty = 0; ty * size < box.h; ty++) {
    for (let tx = 0; tx * size < box.w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? color : shadeColor(color, 22);
      ctx.fillRect(box.x + tx * size, box.y + ty * size, size, size);
      ctx.strokeStyle = "rgba(90, 60, 40, 0.12)";
      ctx.strokeRect(box.x + tx * size + 0.5, box.y + ty * size + 0.5, size - 1, size - 1);
    }
  }
}

// Bare concrete: big poured slabs with seams, a few stains and cracks.
function drawConcrete(ctx, box, color) {
  ctx.fillStyle = color;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  for (let x = box.x + TILE * 1.8; x < box.x + box.w; x += TILE * 1.8) ctx.fillRect(x, box.y, 1.5, box.h);
  for (let y = box.y + TILE * 1.5; y < box.y + box.h; y += TILE * 1.5) ctx.fillRect(box.x, y, box.w, 1.5);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(40, 35, 25, ${0.05 + noise(i + 9) * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(box.x + noise(i + 1.1) * box.w, box.y + noise(i + 2.3) * box.h, 10 + noise(i) * 22, 6 + noise(i + 4) * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(30, 30, 30, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = box.x + noise(i + 20) * box.w, y = box.y + noise(i + 30) * box.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += 6 + noise(i * 7 + j) * 8;
      y += (noise(i * 5 + j + 0.5) - 0.5) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Cinema carpet: the room color with a scattered pattern of little gold
// stars and swirls, like an old movie palace.
function drawCinemaCarpet(ctx, box, color) {
  drawCarpet(ctx, box, color);
  const step = TILE * 0.9;
  for (let row = 0, y = box.y + step / 2; y < box.y + box.h; row++, y += step) {
    for (let x = box.x + step / 2 + (row % 2) * (step / 2); x < box.x + box.w; x += step) {
      ctx.fillStyle = "rgba(224, 184, 76, 0.28)";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { // a little five-point star
        const r = k % 2 ? 1.6 : 4, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(224, 184, 76, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + step / 2, y, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
}

const FLOOR_STYLES = { planks: drawPlanks, carpet: drawCarpet, checker: drawChecker, concrete: drawConcrete, cinema: drawCinemaCarpet };

// The look of each secret office theme (and each bedroom style): floor,
// wall color, a pattern on the walls, and a tint over the whole room
// (warm or cold).
const OFFICE_THEME_STYLE = {
  // Bedroom styles anyone can pick (the four themes below are the secret
  // office themes, only for offices).
  classic: { floor: { style: "carpet", color: "#b7a2c4" }, wall: "#a9b8cf", wallPattern: null, tint: "rgba(0, 0, 0, 0)" },
  cabin: { floor: { style: "planks", color: "#946244" }, wall: "#8a5c3c", wallPattern: "logs", tint: "rgba(255, 150, 70, 0.08)" },
  apartment: { floor: { style: "planks", color: "#c49a6c" }, wall: "#d9d0c4", wallPattern: "brick", tint: "rgba(0, 0, 0, 0)" },
  beachHut: { floor: { style: "planks", color: "#d9c29a" }, wall: "#8fcac6", wallPattern: "slats", tint: "rgba(255, 230, 170, 0.08)" },
  lakehouse: { floor: { style: "planks", color: "#a8744c" }, wall: "#9c6b43", wallPattern: "logs", tint: "rgba(255, 160, 80, 0.10)" },
  stalker: { floor: { style: "concrete", color: "#8e908b" }, wall: "#8a8d88", wallPattern: "concrete", tint: "rgba(30, 60, 50, 0.16)" },
  scholar: { floor: { style: "planks", color: "#7a4a32" }, wall: "#eadcc0", wallPattern: "lacquer", tint: "rgba(255, 190, 120, 0.08)" },
  cottage: { floor: { style: "planks", color: "#5c3d2a" }, wall: "#3e4a36", wallPattern: "ivy", tint: "rgba(110, 55, 20, 0.14)" },
};

// The bedroom whose map is being drawn (floors 2 and up), or undefined.
function viewedBedroom() {
  return viewFloor >= 3 ? ROOMS.find((r) => r.bedroom && floorOf(r.rect.y) === viewFloor) : undefined;
}

// Indoor floors (every floor above the ground, bedrooms included): the
// floor floats like a cutaway dollhouse on a calm, dark warm background
// (a little lighter in the middle), with a soft shadow round its rooms,
// cast a little downward since the light comes from above. No roof and
// no weather out here: rain only shows through the windows.
function paintIndoorBackdrop(ctx) {
  const { left, right, top, bottom } = houseBounds();
  const cx = (left + right) / 2, cy = (top + bottom) / 2, reach = Math.max(right - left, bottom - top) * 0.75;
  const glow = ctx.createRadialGradient(cx, cy, reach * 0.15, cx, cy, reach);
  glow.addColorStop(0, "#4a3628");
  glow.addColorStop(1, "#24190f");
  ctx.fillStyle = glow;
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const t = WALL_THICKNESS;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 22 * viewScale; // (shadows are measured in screen pixels)
  ctx.shadowOffsetY = 8 * viewScale;
  ctx.fillStyle = "#24190f";
  for (const room of ROOMS) {
    if (floorOf(room.rect.y) !== viewFloor) continue;
    const a = toScreen(room.rect.x - t, room.rect.y - t), b = toScreen(room.rect.x + room.rect.w + t, room.rect.y + room.rect.h + t);
    ctx.fillRect(a.x, a.y - WALL_HEIGHT, b.x - a.x, b.y - a.y + WALL_HEIGHT);
  }
  ctx.restore();
}

// Outside the house (on the ground floor): a soft lawn with little tufts
// of grass and a few flowers, so the space north of the hallway looks like
// garden, not a dark gap. Upper floors are indoors (see above).
function paintYard(ctx) {
  if (viewFloor === YARD_FLOOR) {
    paintYardGround(ctx); // the yard itself (Update 4, see outdoors.js)
    return;
  }
  if (viewFloor === LAKE_FLOOR) {
    paintLakeGround(ctx); // Willow Lake (render-lake.js)
    return;
  }
  if (viewFloor === ALLEY_FLOOR) {
    paintAlleyGround(ctx); // the back alley (render-alley.js)
    return;
  }
  if (viewFloor >= 1) {
    paintIndoorBackdrop(ctx);
    return;
  }
  const { left, right, top, bottom } = houseBounds();
  ctx.fillStyle = "#93b06c";
  ctx.fillRect(left - 20, top - 20, right - left + 40, bottom - top + 40);
  const w = right - left, h = bottom - top;
  for (let i = 0; i < (w * h) / 700; i++) {
    const x = left + noise(i * 1.7) * w, y = top + noise(i * 2.3 + 5) * h;
    ctx.strokeStyle = noise(i + 11) > 0.5 ? "rgba(70, 110, 50, 0.45)" : "rgba(180, 210, 130, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
    if (noise(i + 23) > 0.93) {
      ctx.fillStyle = noise(i + 31) > 0.5 ? "#f7f1e6" : "#f2c94c";
      ctx.beginPath();
      ctx.arc(x + 4, y - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  paintFrontSteps(ctx); // stepping stones from the front door (outdoors.js)
}

function drawRug(ctx, f) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, h = f.h * TILE;
  if (f.shape === "heart") {
    const cx = a.x + w / 2, cy = a.y + h / 2;
    for (const [grow, color] of [[0, f.color], [-6, shadeColor(f.color, 30)], [-11, f.color]]) {
      const s = Math.min(w, h * 1.2) / 2 + grow;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.75);
      ctx.bezierCurveTo(cx - s * 1.35, cy, cx - s * 0.75, cy - s * 0.95, cx, cy - s * 0.35);
      ctx.bezierCurveTo(cx + s * 0.75, cy - s * 0.95, cx + s * 1.35, cy, cx, cy + s * 0.75);
      ctx.fill();
    }
    return;
  }
  if (f.shape === "checker") {
    roundRectPath(ctx, a.x, a.y, w, h, 8);
    ctx.save();
    ctx.clip();
    const size = 16;
    for (let yy = 0; yy < h; yy += size) {
      for (let xx = 0; xx < w; xx += size) {
        ctx.fillStyle = ((xx + yy) / size) % 2 ? f.color : "#f7f1e6";
        ctx.fillRect(a.x + xx, a.y + yy, size, size);
      }
    }
    ctx.restore();
    return;
  }
  if (f.shape === "fluffy") {
    const cx = a.x + w / 2, cy = a.y + h / 2;
    ctx.fillStyle = f.color;
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * (w / 2 - 5), cy + Math.sin(ang) * (h / 2 - 5), 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2 - 5, h / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < 40; i++) ctx.fillRect(a.x + 8 + noise(i * 2.9) * (w - 16), a.y + 8 + noise(i * 6.1) * (h - 16), 2, 1);
    return;
  }
  if (f.round) {
    // A round (oval) rug with rings.
    const cx = a.x + w / 2, cy = a.y + h / 2;
    for (const [shrink, color] of [[0, f.color], [8, shadeColor(f.color, 30)], [14, f.color], [22, shadeColor(f.color, 30)]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, w / 2 - shrink), Math.max(2, h / 2 - shrink * (h / w)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  roundRectPath(ctx, a.x, a.y, w, h, 10);
  ctx.fillStyle = f.color;
  ctx.fill();
  roundRectPath(ctx, a.x + 6, a.y + 6, w - 12, h - 12, 7);
  ctx.strokeStyle = shadeColor(f.color, 45);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = shadeColor(f.color, 30);
  const count = Math.floor((w - 30) / 26);
  for (let i = 0; i < count; i++) {
    const cx = a.x + w / 2 + (i - (count - 1) / 2) * 26, cy = a.y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
  }
}

function paintFloors(ctx) {
  paintYard(ctx);
  for (const room of ROOMS) {
    if (room.outdoor && !CONFIG.roomFloors[room.id]) continue; // grass, already painted
    const floor = room.theme ? OFFICE_THEME_STYLE[room.theme].floor : CONFIG.roomFloors[room.owned?.kind] || CONFIG.roomFloors[room.id] || CONFIG.roomFloors.office;
    const a = toScreen(room.rect.x, room.rect.y);
    // Rooms north of a corridor also get floor under the corridor's wall,
    // so their doorways show floor, not grass.
    const underWall = room.north ? WALL_THICKNESS : 0;
    const box = { x: a.x, y: a.y, w: room.rect.w * TILE, h: (room.rect.h + underWall) * TILE };
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip(); // keep each room's pattern inside its own room
    FLOOR_STYLES[floor.style](ctx, box, floor.color);
    ctx.restore();
  }

  // Rugs lie flat on the floor: a main color, a lighter inner border,
  // and a row of diamonds down the middle.
  for (const f of FURNITURE) {
    if (f.kind === "rug") drawRug(ctx, f);
  }
}

// Which floor is being drawn (0 downstairs, 1 upstairs): the one you're
// on. drawScene sets it each frame.
let viewFloor = 0;

// The floor being drawn, in screen pixels, from the west wall to the east
// wall, with a little margin. Both floors are the same size, so the view
// doesn't change size when you take the stairs. Used for the saved floor
// picture and for fitting the house to the window.
// (Asked for many times a frame, so it's worked out once per floor and
// house layout, and remembered.)
let boundsCache = { key: "", value: null };
function houseBounds() {
  const key = houseVersion + "/" + viewFloor;
  if (boundsCache.key !== key) boundsCache = { key, value: measureHouseBounds() };
  return boundsCache.value;
}

function measureHouseBounds() {
  const bedroom = viewedBedroom();
  if (bedroom) return fitBounds(bedroom.rect, 1.6);
  // The back alley: small, so it's shown whole, at the camera's usual
  // closeness (the same size as the view), with its tall walls in view.
  if (viewFloor === ALLEY_FLOOR) return alleyBounds();
  // Other indoor floors: fitted to all their rooms together.
  if (viewFloor >= 1) {
    const rects = ROOMS.filter((r) => floorOf(r.rect.y) === viewFloor).map((r) => r.rect);
    const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
    return fitBounds({ x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y }, 0.9);
  }
  const base = viewFloor * UPSTAIRS;
  return {
    left: toScreen(-WALL_THICKNESS, 0).x - 6,
    right: toScreen(HOUSE_WIDTH + WALL_THICKNESS, 0).x + 6,
    // Room above the north wall for its height and tall things against it.
    top: toScreen(0, base + houseTopY).y - WALL_HEIGHT - 14,
    bottom: toScreen(0, base + 11 + WALL_THICKNESS).y + 6,
  };
}

// The back alley's view: a window the size of the camera's, centered on
// the alley and its walls.
function alleyBounds() {
  const ground = groundSize();
  const zoom = Math.max(1, CONFIG.camera?.zoom ?? 1);
  const w = ground.w / zoom, h = ground.h / zoom;
  const a = toScreen(-WALL_THICKNESS, ALLEY), b = toScreen(ALLEY_W + WALL_THICKNESS, ALLEY + ALLEY_H + 0.4);
  const cx = (a.x + b.x) / 2, cy = (a.y - BRICK_WALL_PX - 10 + b.y) / 2;
  return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
}

// On an indoor floor, the view zooms in to fit it: the same shape as the
// ground floor's view (so the picture on screen stays the same size),
// just smaller, and centered on `rect` (a bedroom, or all of a floor's
// rooms together). `below` is how much room to leave under it (a
// bedroom's doorway leads out there).
function fitBounds(rect, below) {
  const floor = viewFloor;
  viewFloor = 0;
  const house = measureHouseBounds();
  viewFloor = floor;
  const W = house.right - house.left, H = house.bottom - house.top;
  const a = toScreen(rect.x - 1.2, rect.y), b = toScreen(rect.x + rect.w + 1.2, rect.y + rect.h + below);
  const top = a.y - WALL_HEIGHT - 34;
  const k = Math.max((b.x - a.x) / W, (b.y - top) / H);
  const cx = (a.x + b.x) / 2, cy = (top + b.y) / 2;
  return { left: cx - (W * k) / 2, right: cx + (W * k) / 2, top: cy - (H * k) / 2, bottom: cy + (H * k) / 2 };
}

// --- The camera ---
// houseBounds() is the whole floor. The view (what's on screen) is a
// window onto it, CONFIG.camera.zoom times closer than the whole ground
// floor, that follows you (gliding, and stopping at the floor's edges).
// Press M for the map: the whole floor at once, like before. Bedrooms
// (and anything smaller than the window) are shown whole, as they were.
let mapView = false;
const camera = { x: null, y: null, floor: null };

function setMapView(on) {
  mapView = on;
}
function isMapView() {
  return mapView;
}

// The ground floor's whole size (the window's shape comes from it).
let groundSizeCache = null;
function groundSize() {
  if (!groundSizeCache || groundSizeCache.version !== houseVersion) {
    const floor = viewFloor;
    viewFloor = 0;
    const b = measureHouseBounds();
    viewFloor = floor;
    groundSizeCache = { version: houseVersion, w: b.right - b.left, h: b.bottom - b.top };
  }
  return groundSizeCache;
}

// Moves the camera toward a point (in the house's pixels; main.js passes
// where you stand, every frame). It jumps straight there on a new floor.
function followWithCamera(x, y) {
  const far = camera.x === null || camera.floor !== viewFloor || Math.hypot(x - camera.x, y - camera.y) > 600;
  const k = far ? 1 : CONFIG.camera?.follow ?? 0.12;
  camera.x = far ? x : camera.x + (x - camera.x) * k;
  camera.y = far ? y : camera.y + (y - camera.y) * k;
  camera.floor = viewFloor;
}

// What's on screen right now: { left, right, top, bottom } in the house's
// pixels.
function viewBounds() {
  const world = houseBounds();
  const zoom = CONFIG.camera?.zoom ?? 1;
  const ground = groundSize();
  const vw = ground.w / zoom, vh = ground.h / zoom;
  const ww = world.right - world.left, wh = world.bottom - world.top;
  if (mapView || zoom <= 1 || (ww <= vw + 1 && wh <= vh + 1) || camera.x === null) return world;
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  const cx = clamp(camera.x, world.left + vw / 2, world.right - vw / 2);
  const cy = clamp(camera.y, world.top + vh / 2, world.bottom - vh / 2);
  return { left: cx - vw / 2, right: cx + vw / 2, top: cy - vh / 2, bottom: cy + vh / 2 };
}

// The view's size, in the house's own pixels (before scaling). main.js
// uses this to size the view to fit the window (it only changes between
// the map, a bedroom and the rest).
function houseViewSize() {
  const b = viewBounds();
  return { w: b.right - b.left, h: b.bottom - b.top };
}

// How many screen pixels each of the house's own pixels takes up. main.js
// sets this to fit the window (already including high-resolution screens).
let viewScale = 1;

function setViewScale(scale) {
  if (scale === viewScale) return;
  viewScale = scale;
  floorVersion = -1; // repaint the floor at the new size so it stays crisp
}

let floorCanvas = null;
let floorScale = 1; // the resolution the saved floor picture was painted at
let floorVersion = -1; // which house version (and floor) the saved picture shows

// The doormats have writing on them, so repaint the floor once the cozy
// font has finished loading (in case the first paint happened before).
document.fonts?.ready.then(() => {
  floorVersion = -1;
});

function drawFloors(ctx) {
  // Repaint only when the house has changed (an office was added, removed
  // or locked), not every frame.
  const version = houseVersion + "/" + viewFloor;
  if (floorVersion !== version) {
    // Painted at full screen resolution, so copying it in is pixel-for-pixel.
    // (Zoomed in, the whole floor at screen resolution could be huge, so
    // it's kept under about 16 million pixels; past that it's scaled up a
    // little when copied in.)
    const { left, right, top, bottom } = houseBounds();
    floorScale = Math.min(viewScale, Math.sqrt(16e6 / ((right - left) * (bottom - top))));
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = Math.ceil((right - left) * floorScale);
    floorCanvas.height = Math.ceil((bottom - top) * floorScale);
    const fctx = floorCanvas.getContext("2d");
    fctx.scale(floorScale, floorScale);
    fctx.translate(-left, -top);
    paintFloors(fctx);
    floorVersion = version;
  }
  const { left, top } = houseBounds();
  ctx.drawImage(floorCanvas, left, top, floorCanvas.width / floorScale, floorCanvas.height / floorScale);
}

// --- Walls ---
// Splits a wall's front face into stretches by which room each stretch
// faces (the room just below it). Returns [{ x0, x1, room }] in grid units.
function wallFaceParts(wall) {
  const below = wall.y + wall.h + 0.01;
  const edges = new Set([wall.x, wall.x + wall.w]);
  for (const r of ROOMS) {
    if (below >= r.rect.y && below <= r.rect.y + r.rect.h) {
      for (const x of [r.rect.x, r.rect.x + r.rect.w]) if (x > wall.x && x < wall.x + wall.w) edges.add(x);
    }
  }
  const xs = [...edges].sort((p, q) => p - q);
  const parts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const mid = (xs[i] + xs[i + 1]) / 2;
    const room = ROOMS.find((r) => mid >= r.rect.x && mid <= r.rect.x + r.rect.w && below >= r.rect.y && below <= r.rect.y + r.rect.h);
    parts.push({ x0: xs[i], x1: xs[i + 1], room });
  }
  return parts;
}

// Simple panels: a wood top edge, a painted front face (each room has its
// own wall color, see config.js), and a dark baseboard line where the wall
// meets the floor. Walls running up and
// down the screen (taller than wide) are all wood: their front face would
// only be a sliver at the bottom end. A soft shade on the floor just
// below the wall helps it read as standing up.
function drawWall(ctx, wall) {
  if (wall.hidden) return; // (the yard's edges and the pond: nothing to see)
  const height = wall.low ? LOW_WALL_HEIGHT : WALL_HEIGHT;
  const a = toScreen(wall.x, wall.y);
  const b = toScreen(wall.x + wall.w, wall.y + wall.h);

  const shade = ctx.createLinearGradient(0, b.y, 0, b.y + 10);
  shade.addColorStop(0, "rgba(40, 25, 10, 0.22)");
  shade.addColorStop(1, "rgba(40, 25, 10, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(a.x, b.y, b.x - a.x, 10);

  // Top edge (the wood cap you see from above).
  ctx.fillStyle = WOOD;
  ctx.fillRect(a.x, a.y - height, b.x - a.x, b.y - a.y);
  // Front face. Each stretch of it takes the look of the room it faces
  // (the one just below it), so a long wall shared by several rooms is
  // painted to match each of them.
  const hasFace = !wall.low && wall.w > wall.h;
  if (!hasFace) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - height, b.x - a.x, height);
    return;
  }
  for (const part of wallFaceParts(wall)) {
    const left = toScreen(part.x0, 0).x, right = toScreen(part.x1, 0).x, w = right - left;
    if (!part.room || part.room.outdoor) {
      // Facing outside (the garden, or the yard): warm wooden house siding.
      ctx.fillStyle = "#a07c55";
      ctx.fillRect(left, b.y - height, w, height);
      ctx.fillStyle = "rgba(60, 35, 15, 0.28)";
      for (let y = b.y - height + 6; y < b.y - 2; y += 7) ctx.fillRect(left, y, w, 1.5);
      ctx.fillStyle = "rgba(255, 235, 200, 0.12)";
      for (let y = b.y - height + 1; y < b.y - 2; y += 7) ctx.fillRect(left, y, w, 1);
      continue;
    }
    const themeStyle = OFFICE_THEME_STYLE[part.room?.theme];
    ctx.fillStyle = themeStyle?.wall || CONFIG.roomWallColors[part.room?.owned?.kind] || CONFIG.roomWallColors[part.room?.id] || CONFIG.roomWallColors.office;
    ctx.fillRect(left, b.y - height, w, height);
    ctx.fillStyle = WOOD_DARK; // baseboard
    ctx.fillRect(left, b.y - 5, w, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // a thin trim line near the top
    ctx.fillRect(left, b.y - height + 3, w, 2);
    if (themeStyle) drawWallPattern(ctx, themeStyle.wallPattern, left, b.y - height, w, height);
    // Corridor walls (the hallway, business floor and suite floor) get wood paneling on the bottom part, with a rail on top.
    if (part.room?.id === "hallway" || part.room?.id === "business" || part.room?.id === "suite") {
      const panelTop = b.y - 18;
      ctx.fillStyle = "#b08a60";
      ctx.fillRect(left, panelTop, w, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      for (let px = left + 12; px < right; px += 24) ctx.fillRect(px, panelTop + 3, 1, 9);
      ctx.fillStyle = WOOD;
      ctx.fillRect(left, panelTop - 2, w, 3);
    }
  }
}

// Where each bulb on a string of lights sits: a gentle droop between
// the two ends, along the top of the wall it hangs on.
function stringLightBulbs(f) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, top = a.y - WALL_HEIGHT + 6;
  const bulbs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    bulbs.push({ x: a.x + 4 + t * (w - 8), y: top + Math.sin(t * Math.PI) * 8 });
  }
  return bulbs;
}

// What's painted in each framed picture (see "picture" below).
const PICTURE_ART = {
  // Rolling green hills under a sunset.
  hills(ctx, x, y, w, h) {
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, "#f2b38a");
    sky.addColorStop(1, "#f7dcb0");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#f7e08a";
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h * 0.55, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a9e5c";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.25, y + h, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c8a54";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.8, y + h, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  // The sea with a little sailboat.
  sea(ctx, x, y, w, h) {
    ctx.fillStyle = "#bfe0ee";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#4a90a4";
    ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
    ctx.fillStyle = "#f7f1e6";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.58);
    ctx.lineTo(x + w * 0.45, y + h * 0.15);
    ctx.lineTo(x + w * 0.62, y + h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(x + w * 0.35, y + h * 0.58, w * 0.32, 2);
  },
  // A little vase of flowers on a warm background.
  flowers(ctx, x, y, w, h) {
    ctx.fillStyle = "#f3e6d0";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#4a90a4";
    ctx.fillRect(x + w / 2 - 3, y + h - 7, 6, 7);
    for (const [dx, dy, color] of [[-6, -11, "#e37aa0"], [0, -13, "#c0554a"], [6, -10, "#e0a84c"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w / 2 + dx, y + h + dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Extra detail on a themed office's walls: stacked logs, poured concrete
// with rust stains, or plaster with a red lacquer band.
function drawWallPattern(ctx, pattern, x, y, w, h) {
  if (pattern === "logs") {
    for (let ly = y + 3; ly < y + h - 6; ly += 8) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(x, ly, w, 1.5);
      ctx.fillStyle = "rgba(40, 20, 5, 0.3)";
      ctx.fillRect(x, ly + 6, w, 1.5);
    }
  } else if (pattern === "concrete") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    for (let sx = x + 22; sx < x + w; sx += 30) ctx.fillRect(sx, y, 1, h - 5);
    ctx.fillStyle = "rgba(40, 40, 40, 0.35)"; // tie holes left by the concrete forms
    for (let sx = x + 11; sx < x + w; sx += 30) {
      ctx.fillRect(sx, y + 10, 2, 2);
      ctx.fillRect(sx, y + 24, 2, 2);
    }
    ctx.fillStyle = "rgba(138, 75, 42, 0.25)"; // rust streak
    ctx.fillRect(x + w * 0.6, y + 4, 3, h - 12);
  } else if (pattern === "ivy") {
    // Dark wood paneling on the lower wall, and ivy creeping along the top
    // with strands hanging down.
    ctx.fillStyle = "rgba(40, 22, 12, 0.4)";
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45 - 4);
    ctx.fillStyle = "rgba(255, 220, 170, 0.12)";
    ctx.fillRect(x, y + h * 0.55, w, 1);
    ctx.strokeStyle = "#3d5a2a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    for (let sx = x; sx <= x + w; sx += 6) ctx.lineTo(sx, y + 4 + Math.sin(sx * 0.3) * 1.5);
    ctx.stroke();
    let i = 0;
    for (let sx = x + 5; sx < x + w - 3; sx += 13, i++) drawIvySprig(ctx, sx, y + 4, 6 + ((i * 7) % 11), i % 2 ? 1 : -1);
  } else if (pattern === "brick") {
    // A painted-over brick wall: faint rows of bricks, offset every row.
    ctx.fillStyle = "rgba(90, 70, 60, 0.12)";
    for (let by = y + 4, row = 0; by < y + h - 6; by += 6, row++) {
      ctx.fillRect(x, by, w, 1);
      for (let bx = x + (row % 2) * 7; bx < x + w; bx += 14) ctx.fillRect(bx, by, 1, 6);
    }
  } else if (pattern === "slats") {
    // Beach hut boards running up and down, and a white trim along the top.
    ctx.fillStyle = "rgba(20, 60, 70, 0.18)";
    for (let sx = x + 6; sx < x + w; sx += 8) ctx.fillRect(sx, y, 1, h - 5);
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(x, y + 3, w, 3);
  } else if (pattern === "lacquer") {
    ctx.fillStyle = "#9a2f24";
    ctx.fillRect(x, y + 5, w, 4);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y + 9, w, 1);
  }
}

// --- Helpers for turned furniture (see the "...Side" drawers) ---

// Draws a turned piece: as is when it faces right, mirrored when it faces
// left (light comes from above, so a mirror image still looks right).
function sideView(ctx, f, draw) {
  if (f.facing !== "left") {
    draw();
    return;
  }
  const mid = toScreen(f.x + f.w / 2, f.y).x;
  ctx.save();
  ctx.translate(mid, 0);
  ctx.scale(-1, 1);
  ctx.translate(-mid, 0);
  draw();
  ctx.restore();
}

// A shelf seen from the side: a plain side panel, and a row of book (or
// basket) edges along its front.
function drawShelfSide(ctx, f, height, color, fronts = ["#c0554a", "#4a90a4", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a"]) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const s = drawBlock(ctx, f.x, f.y, f.w, f.h, height, color);
  const { x, y, w, h } = s.face;
  ctx.strokeStyle = "rgba(40, 25, 10, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 4, w - 10, h - 10);
  // Book spines (or baskets) peeking out along the front edge, shelf by shelf.
  for (let row = 0, rows = Math.max(2, Math.round(height / 26)); row < rows; row++) {
    const rowY = y + 5 + (row * (h - 10)) / rows;
    for (let k = 0; k * 5 < s.top.h + h / rows - 6 && k < 8; k++) {
      ctx.fillStyle = fronts[(k + row) % fronts.length];
      ctx.fillRect(x + w - 4, rowY + k * 3, 3, 2.5);
    }
  }
  // Seen from above, the tops of the books (or baskets) line the front edge.
  const t = s.top;
  ctx.fillStyle = shadeColor(color, -25);
  ctx.fillRect(t.x + t.w - 8, t.y, 8, t.h);
  for (let by = t.y + 2, k = 0; by < t.y + t.h - 3; k++) {
    const bh = 3 + (k * 7) % 4;
    ctx.fillStyle = fronts[k % fronts.length];
    ctx.fillRect(t.x + t.w - 7, by, 6, Math.min(bh, t.y + t.h - 2 - by));
    by += bh + 0.8;
  }
}

// A bed seen from the side, headboard against the wall (on the left):
// pillows by the headboard and the blanket over the rest.
function drawBedSide(ctx, f, height, frameColor, headboard) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const board = 0.25;
  const frame = drawBlock(ctx, f.x + (headboard ? board : 0), f.y, f.w - (headboard ? board : 0), f.h, height, frameColor);
  if (headboard) {
    const head = drawBlock(ctx, f.x, f.y - 0.05, board, f.h + 0.1, 34, "#6b4630");
    ctx.fillStyle = "rgba(255, 235, 200, 0.18)";
    ctx.fillRect(head.face.x + 2, head.face.y + 5, head.face.w - 4, head.face.h - 12);
  }
  const { x, y, w, h } = frame.top;
  ctx.fillStyle = "#f5eee2"; // sheet
  ctx.fillRect(x + 2, y + 3, w - 4, h - 6);
  for (const py of [y + 6, y + h / 2 + 2]) { // two pillows, side by side along the headboard
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, x + 4, py, 15, h / 2 - 9, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(x + 15, py + 3, 2, h / 2 - 15);
  }
  const left = x + 24; // the blanket, with its folded-back cuff
  const blanket = ctx.createLinearGradient(left, 0, x + w, 0);
  blanket.addColorStop(0, shadeColor(f.color, 30));
  blanket.addColorStop(1, shadeColor(f.color, -10));
  ctx.fillStyle = blanket;
  roundRectPath(ctx, left, y + 1, x + w - left - 1, h - 2 + frame.face.h - 3, 5);
  ctx.fill();
  ctx.fillStyle = shadeColor(f.color, 55);
  ctx.fillRect(left, y + 1, 6, h - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // quilted lines
  for (let qx = left + 14; qx < x + w - 4; qx += 12) ctx.fillRect(qx, y + 3, 1, h - 6);
}

// A sofa seen from the side, back against the wall (on the left), arms at
// both ends, and throw pillows against the back.
function drawSofaSide(ctx, f, c) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  drawBlock(ctx, f.x, f.y + 0.05, 0.28, f.h - 0.1, 30, shadeColor(c, -15)); // back
  const seat = drawBlock(ctx, f.x + 0.22, f.y + 0.15, f.w - 0.22, f.h - 0.3, 13, c);
  drawBlock(ctx, f.x + 0.1, f.y, f.w - 0.1, 0.18, 19, shadeColor(c, -15)); // arms
  drawBlock(ctx, f.x + 0.1, f.y + f.h - 0.18, f.w - 0.1, 0.18, 19, shadeColor(c, -15));
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"; // the seam between the cushions
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(seat.top.x + 2, seat.top.y + seat.top.h / 2);
  ctx.lineTo(seat.top.x + seat.top.w - 2, seat.top.y + seat.top.h / 2);
  ctx.stroke();
  for (const [fy, color] of [[0.25, "#f2d9a0"], [0.75, "#e0845a"]]) {
    ctx.fillStyle = color; // throw pillows against the back
    roundRectPath(ctx, seat.top.x - 2, seat.top.y + seat.top.h * fy - 8, 9, 14, 4);
    ctx.fill();
  }
}

// A desk seen from the side, against the wall (on the left), with a lamp,
// flowers or the laptop (its screen turned to face into the room).
function drawDeskSide(ctx, f, color, topper) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, color);
  const { x, y, w, h } = d.top;
  if (topper === "laptop") {
    const lx = x + 4, ly = y + h / 2;
    ctx.fillStyle = "#c8c8d0"; // keyboard base, lying flat
    ctx.fillRect(lx + 4, ly - 14, w - 12, 28);
    ctx.fillStyle = "#3a3a44"; // the lid, standing up at the back, screen facing the room
    ctx.fillRect(lx, ly - 30, 5, 34);
    const glow = ctx.createLinearGradient(lx + 5, 0, lx + 9, 0);
    glow.addColorStop(0, "#bfe3f2");
    glow.addColorStop(1, "rgba(127, 178, 214, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(lx + 5, ly - 28, 4, 30);
    ctx.fillStyle = "#f2ece2"; // mug
    ctx.fillRect(x + w - 10, y + 5, 6, 7);
  } else if (topper === "lamp") {
    ctx.fillStyle = "#f4ecdc"; // paper
    ctx.fillRect(x + w / 2 - 6, y + h / 2 - 4, 12, 16);
    const lx = x + 8, ly = y + 12;
    ctx.fillStyle = "#4f7a48"; // a green banker's lamp by the wall
    ctx.fillRect(lx - 1, ly - 10, 2, 10);
    ctx.beginPath();
    ctx.ellipse(lx, ly - 11, 7, 3.5, 0, Math.PI, 0);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e8e0d0"; // a little vase of flowers and a notebook
    ctx.fillRect(x + 6, y + 8, 6, 9);
    for (const [dx, c] of [[-2, "#f2a0b8"], [2, "#fff2a8"], [0, "#c8b0e8"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 9 + dx, y + 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e98ac0";
    ctx.fillRect(x + w / 2 - 5, y + h / 2, 12, 16);
  }
}

// A bedroom door's little decoration, centered at (cx, cy).
function drawDoorDeco(ctx, deco, cx, cy) {
  if (deco === "wreath") {
    ctx.strokeStyle = "#3f7a4a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#c0303a";
    ctx.fillRect(cx - 2, cy + 3, 4, 2.5);
  } else if (deco === "flowers") {
    for (const [dx, dy, c] of [[-2.5, -1, "#f2a0b8"], [2.5, -1.5, "#fff2a8"], [0, -3.5, "#c8b0e8"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6aa05a";
    ctx.fillRect(cx - 0.6, cy, 1.2, 4);
  } else if (deco === "star" || deco === "snowflake") {
    ctx.fillStyle = deco === "star" ? "#f2c94c" : "#ffffff";
    ctx.beginPath();
    for (let k = 0; k < (deco === "star" ? 10 : 12); k++) {
      const n = deco === "star" ? 10 : 12;
      const r = k % 2 ? (deco === "star" ? 1.8 : 1.2) : 4.5, a = (k / n) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.fill();
  } else if (deco === "heart") {
    ctx.fillStyle = "#f06a9a";
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.bezierCurveTo(cx - 6, cy, cx - 3.5, cy - 5, cx, cy - 2);
    ctx.bezierCurveTo(cx + 3.5, cy - 5, cx + 6, cy, cx, cy + 4);
    ctx.fill();
  } else if (deco === "plant") {
    ctx.fillStyle = "#c98a5a";
    ctx.fillRect(cx - 2.5, cy + 1, 5, 3.5);
    drawLeaf(ctx, cx, cy + 1, -0.5, 5, 2, "#5a9a4a", null);
    drawLeaf(ctx, cx, cy + 1, 0.5, 5, 2, "#6aaa5a", null);
  } else if (deco === "pumpkin") {
    ctx.fillStyle = "#e07a2e";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a7a3a";
    ctx.fillRect(cx - 0.6, cy - 3.5, 1.2, 2);
  }
}

// The shapes for wall cutouts, each drawn around (0, 0), about 16 pixels
// across (see wallCutout).
function drawBat(ctx, s = 1) {
  ctx.fillStyle = "#2a2230";
  ctx.beginPath(); // wings: scalloped along the bottom edge
  ctx.moveTo(0, -1 * s);
  ctx.quadraticCurveTo(-4 * s, -5 * s, -8 * s, -3 * s);
  ctx.quadraticCurveTo(-7 * s, 0, -8 * s, 2 * s);
  ctx.quadraticCurveTo(-6 * s, 0.5 * s, -5 * s, 2.5 * s);
  ctx.quadraticCurveTo(-3.5 * s, 1 * s, -2 * s, 2.5 * s);
  ctx.lineTo(0, 1.5 * s);
  ctx.lineTo(2 * s, 2.5 * s);
  ctx.quadraticCurveTo(3.5 * s, 1 * s, 5 * s, 2.5 * s);
  ctx.quadraticCurveTo(6 * s, 0.5 * s, 8 * s, 2 * s);
  ctx.quadraticCurveTo(7 * s, 0, 8 * s, -3 * s);
  ctx.quadraticCurveTo(4 * s, -5 * s, 0, -1 * s);
  ctx.fill();
  ctx.beginPath(); // body and ears
  ctx.ellipse(0, 0, 1.8 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.moveTo(-1.5 * s, -2 * s);
  ctx.lineTo(-1 * s, -4 * s);
  ctx.lineTo(-0.3 * s, -2.4 * s);
  ctx.moveTo(1.5 * s, -2 * s);
  ctx.lineTo(1 * s, -4 * s);
  ctx.lineTo(0.3 * s, -2.4 * s);
  ctx.fill();
  if (s >= 1) {
    ctx.fillStyle = "#f2d07a"; // little eyes
    ctx.fillRect(-1 * s, -1 * s, 0.8 * s, 0.8 * s);
    ctx.fillRect(0.3 * s, -1 * s, 0.8 * s, 0.8 * s);
  }
}

const CUTOUTS = {
  bat: (ctx) => drawBat(ctx, 1),
  bats(ctx) {
    for (const [x, y, s] of [[-5, 3, 0.55], [2, -3, 0.7], [7, 4, 0.5]]) {
      ctx.save();
      ctx.translate(x, y);
      drawBat(ctx, s);
      ctx.restore();
    }
  },
  ghost(ctx) {
    ctx.fillStyle = "#fbf7f0";
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.lineTo(-6, -1);
    ctx.arc(0, -1, 6, Math.PI, 0);
    ctx.lineTo(6, 7);
    for (let k = 0; k < 3; k++) { // wavy hem
      ctx.quadraticCurveTo(6 - k * 4 - 1, 4, 6 - k * 4 - 2, 7);
      ctx.quadraticCurveTo(6 - k * 4 - 3, 9, 6 - k * 4 - 4, 7);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 80, 100, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#2a2230"; // face: two eyes and a little "oo" mouth, each its own shape
    for (const [x, y, rx, ry] of [[-2.3, -1.6, 0.9, 1.3], [2.3, -1.6, 0.9, 1.3], [0, 2.4, 0.9, 1.1]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(240, 150, 170, 0.5)"; // rosy cheeks
    ctx.fillRect(-4.2, 0.2, 1.6, 1);
    ctx.fillRect(2.6, 0.2, 1.6, 1);
  },
  jack(ctx) {
    ctx.fillStyle = "#e07a2e";
    ctx.beginPath();
    ctx.ellipse(0, 1, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 70, 20, 0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 1, 3, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#5a7a3a";
    ctx.fillRect(-1, -6, 2, 2.5);
    ctx.fillStyle = "#3a2418"; // carved face
    ctx.beginPath();
    ctx.moveTo(-4, -0.5);
    ctx.lineTo(-2, -2.5);
    ctx.lineTo(-1, -0.5);
    ctx.moveTo(4, -0.5);
    ctx.lineTo(2, -2.5);
    ctx.lineTo(1, -0.5);
    ctx.moveTo(-4, 2);
    ctx.lineTo(-2, 4);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(2, 4);
    ctx.lineTo(4, 2);
    ctx.fill();
  },
  snowflake(ctx, n) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    const r = 6 + (n % 2);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * r, dy * r);
      for (const side of [-1, 1]) { // little branches
        const bx = dx * r * 0.6, by = dy * r * 0.6;
        const ba = ang + side * 0.7;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ba) * 2.4, by + Math.sin(ba) * 2.4);
      }
    }
    ctx.stroke();
  },
  butterfly(ctx, n) {
    const colors = ["#f2a0b8", "#c8b0e8", "#fff2a8", "#a8d8e8"];
    ctx.fillStyle = colors[n % colors.length];
    for (const side of [-1, 1]) {
      for (const [x, y, rx, ry, tilt] of [[side * 3.5, -2, 3.8, 3, side * 0.5], [side * 3, 2.5, 2.6, 2.2, -side * 0.4]]) {
        ctx.beginPath(); // each wing its own shape
        ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (const x of [-3.5, 3.5]) {
      ctx.beginPath();
      ctx.arc(x, -2.5, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#5a4636"; // body and feelers
    ctx.fillRect(-0.6, -4, 1.2, 8);
    ctx.strokeStyle = "#5a4636";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-2, -7);
    ctx.moveTo(0, -4);
    ctx.lineTo(2, -7);
    ctx.stroke();
  },
  sun(ctx) {
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = k % 2 ? 4.5 : 7.5, ang = (k / 16) * Math.PI * 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#f7dc7a";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c"; // a happy face
    ctx.fillRect(-1.8, -1.2, 0.9, 0.9);
    ctx.fillRect(0.9, -1.2, 0.9, 0.9);
    ctx.strokeStyle = "#8a5a3c";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0.6, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },
  melon(ctx) {
    ctx.fillStyle = "#4f8a4a"; // rind
    ctx.beginPath();
    ctx.arc(0, -3, 8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#e8e0b0";
    ctx.beginPath();
    ctx.arc(0, -3, 6.8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#e8566a"; // fruit
    ctx.beginPath();
    ctx.arc(0, -3, 6, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#2a2230"; // seeds
    for (const [x, y] of [[-3, -1], [0, 0.5], [3, -1], [-1.5, 1.5], [1.5, 1.5]]) ctx.fillRect(x - 0.4, y - 0.6, 0.8, 1.2);
  },
};

// The rest of the drawing code is split into files by area, loaded in
// this order after this one (see index.html): render-furniture.js (most
// furniture and plants), render-rooms.js (pieces for particular rooms and
// the secret offices), render-extras.js (turned furniture, seasonal decor,
// bedrooms, doors and the draw order), render-characters.js (players, hats,
// pets, accessories, faces, emotes and dances) and render-scene.js (name
// tags, signs, lights, and drawing a whole frame).
