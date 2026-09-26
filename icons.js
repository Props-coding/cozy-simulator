// Small icons in the house's own art style, for the profile card (and
// anywhere else that wants one). Most are the house's real drawings (a
// piece of furniture, a pet, a hat on a little character) drawn by
// render.js; a few simple things (a padlock, a moon, a speech bubble, the
// tier medals) are drawn here to match: soft shapes, lit from above, a
// darker edge at the bottom. Every icon is trimmed to what was drawn and
// fitted into its square, so they all come out the same size.

// What each achievement and room looks like. { f } is a piece of
// furniture (with its footprint w and h, and `wall` for things that hang
// on a wall), { pet }, { hat } or { shoes } a pet or something worn, and
// { glyph } one of the little drawings below.
const ICONS = {
  // Settling in
  welcome: { f: "umbrellaStand", w: 0.5, h: 0.4 },
  tour: { f: "worldMap", w: 1.4, wall: true },
  office: { f: "writingDesk", w: 1.3, h: 0.6 },
  lock: { glyph: "padlock" },
  knock: { glyph: "door" },
  doodle: { glyph: "whiteboard" },
  movie: { f: "popcorn", w: 0.6, h: 0.5 },
  bookworm: { f: "bookStacks", w: 0.7, h: 0.5 },
  snack: { f: "teaCart", w: 0.9, h: 0.5 },
  bedroomMade: { f: "bed", w: 1.8, h: 2.3 },
  goodnight: { glyph: "moon" },
  sleepover: { f: "teddyBear", w: 0.5, h: 0.4 },
  decorator: { f: "monstera", w: 0.8, h: 0.8 },
  designer: { f: "fishTank", w: 1.1, h: 0.5 },
  roomy: { f: "toolbox", w: 0.8, h: 0.4 },
  penPal: { glyph: "letter" },
  gotMail: { glyph: "mailbox" },
  newsReader: { f: "laptopDesk", w: 1.3, h: 0.6 },
  // Friends
  hello: { glyph: "bubble" },
  roommates: { f: "loveseat", w: 1.6, h: 0.8, color: "#c98a8a" },
  fullHouse: { f: "presents", w: 0.9, h: 0.5 },
  expressive: { glyph: "heart" },
  jigParty: { f: "discoBall", w: 0.6, h: 0.6 },
  // Time in the house
  nightOwl: { pet: "owl" },
  earlyBird: { glyph: "sun" },
  // The raccoons, and pets
  raccoons: { f: "raccoons", w: 0.9, h: 0.6 },
  firstBuy: { f: "clothesRack", w: 1.2, h: 0.45 },
  allHats: { hat: "topHat" },
  allShoes: { shoes: "cowboyBoots" },
  patPat: { pet: "dog" },
  pettingZoo: { pet: "bunny" },
  hoarder: { glyph: "crumb" },
  // Secrets
  whoAreYou: { pet: "raccoonKit" },
  foodComa: { glyph: "zzz" },
  danceFloor: { f: "theaterSeat", w: 0.9, h: 0.7 },

  // Tiered achievements
  homebody: { f: "armchair", w: 1.1, h: 0.8 },
  visitor: { glyph: "calendar" },
  wellRounded: { glyph: "house" },
  crumbs: { glyph: "crumbPile" },
  collector: { hat: "cowboyHat" },
  menagerie: { pet: "cat" },
  chatterbox: { glyph: "bubbles" },
  emotes: { glyph: "heart" },
  dancer: { f: "discoBall", w: 0.6, h: 0.6 },
  focus: { glyph: "hourglass" },
  rested: { f: "canopyBed", w: 1.8, h: 2.3 },

  // Rooms (CONFIG.roomLevels)
  "room:study": { f: "studyTable", w: 1.6, h: 0.9 },
  "room:library": { f: "libraryShelf", w: 1.6, h: 0.5 },
  "room:theater": { f: "popcorn", w: 0.6, h: 0.5 },
  "room:conference": { glyph: "whiteboard" },
  "room:dinner": { f: "stove", w: 1.0, h: 0.6 },
  "room:workshop": { f: "workbench", w: 1.8, h: 0.7 },
  "room:office": { f: "writingDesk", w: 1.3, h: 0.6 },
  "room:bedroom": { f: "bed", w: 1.8, h: 2.3 },
};

// --- The little drawings ---
// Each draws around (0, 0) in a box about 60 across, light from above.
const shade = (color, amount) => shadeColor(color, amount); // (render.js)

function softShadow(ctx, w, y) {
  ctx.fillStyle = "rgba(60, 40, 20, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, y, w, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

const GLYPHS = {
  padlock(ctx) {
    softShadow(ctx, 20, 30);
    ctx.strokeStyle = "#9aa4ae";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -6, 12, Math.PI, 0);
    ctx.lineTo(12, 4);
    ctx.moveTo(-12, -6);
    ctx.lineTo(-12, 4);
    ctx.stroke();
    roundRectPath(ctx, -19, 2, 38, 28, 6);
    ctx.fillStyle = "#d9a441";
    ctx.fill();
    ctx.fillStyle = shade("#d9a441", -25);
    ctx.fillRect(-19, 24, 38, 6);
    ctx.fillStyle = "#6b4226";
    ctx.beginPath();
    ctx.arc(0, 13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-1.5, 14, 3, 8);
  },
  moon(ctx) {
    ctx.fillStyle = "#f2d47a";
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(12, -8, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff4c8";
    for (const [x, y, r] of [[18, 14, 3], [24, 2, 2], [8, 22, 2]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  sun(ctx) {
    ctx.strokeStyle = "#e8a13a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.stroke();
    }
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8e08a";
    ctx.beginPath();
    ctx.arc(-4, -5, 6, 0, Math.PI * 2);
    ctx.fill();
  },
  letter(ctx) {
    softShadow(ctx, 26, 20);
    roundRectPath(ctx, -26, -16, 52, 34, 4);
    ctx.fillStyle = "#f7f1e6";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, -16);
    ctx.lineTo(0, 4);
    ctx.lineTo(26, -16);
    ctx.stroke();
    ctx.fillStyle = "#e05a47";
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  mailbox(ctx) {
    softShadow(ctx, 16, 32);
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(-3, 2, 6, 30);
    roundRectPath(ctx, -20, -22, 40, 26, 12);
    ctx.fillStyle = "#5aa0d8";
    ctx.fill();
    ctx.fillStyle = shade("#5aa0d8", -25);
    ctx.fillRect(-20, -2, 40, 6);
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(-12, -28, 18, 10);
    ctx.fillStyle = "#e05a47";
    ctx.fillRect(14, -30, 3, 16);
    ctx.fillRect(14, -30, 10, 6);
  },
  bubble(ctx) {
    roundRectPath(ctx, -26, -22, 52, 34, 14);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-16, 24);
    ctx.lineTo(2, 11);
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, -26, -22, 52, 34, 14);
    ctx.stroke();
    ctx.fillStyle = "#c9955f";
    for (const x of [-11, 0, 11]) {
      ctx.beginPath();
      ctx.arc(x, -5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  bubbles(ctx) {
    ctx.save();
    ctx.translate(8, 8);
    ctx.scale(0.75, 0.75);
    ctx.globalAlpha = 0.85;
    GLYPHS.bubble(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(-8, -10);
    ctx.scale(0.75, 0.75);
    GLYPHS.bubble(ctx);
    ctx.restore();
  },
  heart(ctx) {
    ctx.fillStyle = "#f06a9a";
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.bezierCurveTo(-34, 2, -18, -28, 0, -10);
    ctx.bezierCurveTo(18, -28, 34, 2, 0, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(-11, -6, 5, 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
  },
  crumbPile(ctx) {
    for (const [x, y, s] of [[-12, 8, 0.8], [12, 8, 0.8], [0, -6, 0.95]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawCrumb(ctx);
      ctx.restore();
    }
  },
  zzz(ctx) {
    ctx.fillStyle = "#7a6bc8";
    ctx.font = "700 30px 'Quicksand', sans-serif";
    ctx.fillText("z", -22, 20);
    ctx.font = "700 22px 'Quicksand', sans-serif";
    ctx.fillText("z", -2, 0);
    ctx.font = "700 15px 'Quicksand', sans-serif";
    ctx.fillText("z", 14, -16);
  },
  calendar(ctx) {
    softShadow(ctx, 24, 28);
    roundRectPath(ctx, -24, -22, 48, 48, 6);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#e05a47";
    ctx.fillRect(-24, -22, 48, 12);
    ctx.fillStyle = "#6b4226";
    for (const x of [-12, 12]) ctx.fillRect(x - 2, -28, 4, 10);
    ctx.fillStyle = "#c9955f";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-18 + c * 10, -4 + r * 9, 6, 5);
    ctx.fillStyle = "#e05a47";
    ctx.fillRect(2, 5, 6, 5);
  },
  house(ctx) {
    softShadow(ctx, 26, 28);
    ctx.fillStyle = "#e9d2ad";
    ctx.fillRect(-20, -4, 40, 32);
    ctx.fillStyle = shade("#e9d2ad", -18);
    ctx.fillRect(-20, 22, 40, 6);
    ctx.fillStyle = "#b85c3c";
    ctx.beginPath();
    ctx.moveTo(-28, -2);
    ctx.lineTo(0, -28);
    ctx.lineTo(28, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(-6, 10, 12, 18);
    ctx.fillStyle = "#f2d47a";
    ctx.fillRect(9, 4, 8, 8);
  },
  door(ctx) {
    softShadow(ctx, 22, 32);
    ctx.fillStyle = "#6b4630";
    roundRectPath(ctx, -20, -32, 40, 64, 4);
    ctx.fill();
    ctx.fillStyle = "#a8744c";
    ctx.fillRect(-16, -28, 32, 60);
    ctx.strokeStyle = "rgba(60, 35, 15, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -22, 22, 20);
    ctx.strokeRect(-11, 4, 22, 20);
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.arc(9, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e0b84c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -8, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },
  whiteboard(ctx) {
    softShadow(ctx, 26, 30);
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(-14, 10, 4, 20);
    ctx.fillRect(10, 10, 4, 20);
    roundRectPath(ctx, -28, -24, 56, 38, 3);
    ctx.fillStyle = "#9aa4ae";
    ctx.fill();
    ctx.fillStyle = "#fbfbf7";
    ctx.fillRect(-25, -21, 50, 32);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#5aa0d8";
    ctx.beginPath();
    ctx.moveTo(-19, -4);
    ctx.bezierCurveTo(-12, -16, -6, 6, 2, -8);
    ctx.stroke();
    ctx.strokeStyle = "#e05a47";
    ctx.beginPath();
    ctx.arc(12, -4, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(-20, 11, 40, 3);
  },
  hourglass(ctx) {
    softShadow(ctx, 18, 30);
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(-18, -30, 36, 6);
    ctx.fillRect(-18, 24, 36, 6);
    ctx.fillStyle = "rgba(200, 225, 235, 0.7)";
    ctx.beginPath();
    ctx.moveTo(-13, -24);
    ctx.lineTo(13, -24);
    ctx.lineTo(2, 0);
    ctx.lineTo(13, 24);
    ctx.lineTo(-13, 24);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e3a954";
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.lineTo(7, -12);
    ctx.lineTo(1, -2);
    ctx.lineTo(-1, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, 24);
    ctx.lineTo(0, 12);
    ctx.lineTo(11, 24);
    ctx.closePath();
    ctx.fill();
  },
};

// The cookie crumb from the crumb counter, in its colors.
function drawCrumb(ctx) {
  ctx.save();
  ctx.scale(1.6, 1.6);
  ctx.translate(-16, -16);
  ctx.fillStyle = "#e3a954";
  ctx.strokeStyle = "#b9832a";
  ctx.lineWidth = 1.6;
  const shape = new Path2D("M7 12 C6 7 11 4 16 5 C18 3.5 21 4 22 6 C23.5 5.5 25 7 24.5 8.5 C27.5 11 28.5 16 26 20 C25.5 25 20 28 15 27 C10 28.5 5.5 25 5 20.5 C3.5 18 4.5 14 7 12 Z");
  ctx.fill(shape);
  ctx.stroke(shape);
  ctx.fillStyle = "#6b4226";
  for (const [x, y, r] of [[9.5, 21.5, 1.8], [22.5, 12, 1.5], [23, 21, 1.3], [13.2, 16, 1.35]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
GLYPHS.crumb = drawCrumb; // (the same crumb as the crumb counter)

// A tier medal (Bronze to Legend): a ribbon and a round medal in the
// tier's color, with its number of stars.
function drawMedal(ctx, tierIndex) {
  const tier = CONFIG.achievementTiers[tierIndex];
  ctx.fillStyle = "#e05a47";
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.lineTo(-2, -30);
  ctx.lineTo(6, -6);
  ctx.lineTo(-6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5aa0d8";
  ctx.beginPath();
  ctx.moveTo(14, -30);
  ctx.lineTo(2, -30);
  ctx.lineTo(-6, -6);
  ctx.lineTo(6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(tier.color, -25);
  ctx.beginPath();
  ctx.arc(0, 10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tier.color;
  ctx.beginPath();
  ctx.arc(0, 8, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(-6, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffaf3";
  ctx.font = "700 20px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(tierIndex + 1), 0, 15);
}

// --- Drawing an icon ---
const cache = new Map(); // key -> a finished canvas

function drawSpec(big, spec) {
  const ctx = big.getContext("2d");
  if (spec.f) {
    drawDecorPreview(big, { kind: spec.f, w: spec.w, h: spec.h ?? 0.5, wall: spec.wall, color: spec.color ?? "#d9785f" }, "#d9785f");
  } else if (spec.pet) {
    drawPetPreview(big, spec.pet);
  } else if (spec.hat || spec.shoes) {
    // A little character wearing it (just the top half for hats).
    const me = Object.assign(document.createElement("canvas"), { width: 96, height: 136 });
    drawCharacterPreview(me, { color: "#e8b84a", hat: spec.hat ?? "none", shoes: spec.shoes ?? "none" });
    const part = spec.hat ? [0, 0, 96, 104] : [0, 106, 96, 30];
    ctx.drawImage(me, ...part, big.width / 2 - part[2], big.height / 2 - part[3], part[2] * 2, part[3] * 2);
  } else if (spec.medal !== undefined) {
    ctx.save();
    ctx.translate(big.width / 2, big.height / 2);
    ctx.scale(2.5, 2.5);
    drawMedal(ctx, spec.medal);
    ctx.restore();
  } else if (GLYPHS[spec.glyph]) {
    ctx.save();
    ctx.translate(big.width / 2, big.height / 2);
    ctx.scale(2.5, 2.5);
    GLYPHS[spec.glyph](ctx);
    ctx.restore();
  }
}

// Trims `big` to what was drawn and fits it into `out`, centered.
function fitInto(big, out) {
  const { width: W, height: H } = big;
  const data = big.getContext("2d").getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, out.width, out.height);
  if (x1 < 0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const pad = out.width * 0.08;
  const s = Math.min((out.width - pad * 2) / w, (out.height - pad * 2) / h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(big, x0, y0, w, h, (out.width - w * s) / 2, (out.height - h * s) / 2, w * s, h * s);
}

// An icon as a canvas, `size` CSS pixels across (drawn at twice that, so
// it's sharp). `key` is an achievement id, "room:" + a room, or "medal:"
// + a tier number (0 for Bronze). Unknown keys get a plain star.
export function iconCanvas(key, size = 32) {
  const spec = key.startsWith("medal:") ? { medal: Number(key.slice(6)) } : ICONS[key] ?? { glyph: "sun" };
  const id = key + "|" + size;
  let done = cache.get(id);
  if (!done) {
    const big = Object.assign(document.createElement("canvas"), { width: 240, height: 240 });
    drawSpec(big, spec);
    done = Object.assign(document.createElement("canvas"), { width: size * 2, height: size * 2 });
    fitInto(big, done);
    cache.set(id, done);
  }
  const c = Object.assign(document.createElement("canvas"), { width: done.width, height: done.height, className: "house-icon" });
  c.style.width = c.style.height = size + "px";
  c.getContext("2d").drawImage(done, 0, 0);
  return c;
}
