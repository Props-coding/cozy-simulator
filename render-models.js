// Furniture built as models (art night, batch 1). Instead of a separate
// hand-drawn picture for each way a piece can face, a piece is described
// once as its real parts (side panels, shelves, books, cushions, legs...),
// each a box with a size, a color and a material, and drawn from whichever
// way it faces: the front, turned right or left, or from the back. So a
// turned bookcase shows its shelves and books, not a plank.
//
// How a model is laid out: in its own front-facing frame, x runs along its
// width (0 to W, grid units), y from its back (0, against the wall) to its
// front (D), and z up from the floor (pixels, like drawBlock's height).
// Turned pieces are drawn a little turned toward the camera (SHEAR), the
// way cozy games cheat, so the side that faces the room shows.
//
// Models never move, so each one is drawn once into a little picture
// (per facing, color and zoom) and copied onto the screen after that.
// Anything that twinkles (the canopy bed's fairy lights) is drawn live.

// How far a turned piece is turned toward the camera: its far end is
// drawn this many tiles out into the room per tile of length (its near
// end stays put, so nothing leans back into the wall).
const MODEL_SHEAR = 0.42;

// --- The parts ---
// A box part: x, y (grid units) and z (pixels) of its back-left-bottom
// corner, then its width, depth and height. `mat` is its material (wood,
// fabric, boucle, paint, metal, wicker, book, pages, glass, sheer), `round`
// rounds its corners (pixels) for soft things, and `paint` adds details on
// a face: { front(ctx, U, V), top, left, right, back }, drawn in that
// face's own pixels (U across, V down).
const part = (x, y, z, w, d, h, color, mat = "wood", more = {}) => ({ x, y, z, w, d, h, color, mat, ...more });

// A row of books standing on a shelf between x0 and x1 (grid units), from
// the floor of the shelf at z, up to `tall` pixels high, `deep` deep and
// set back to leave `front` of shelf showing. Heights, widths and colors
// vary (the same every time, from `seed`), with a gap or a leaning book
// now and then.
const BOOK_COLORS = ["#8f2f2a", "#3f6f9f", "#c98a3c", "#4f7a48", "#7d6a8f", "#b5603c", "#2f4f4f", "#c0554a", "#e0a84c", "#9a6fb0"];
function bookRow(x0, x1, z, tall, y, deep, seed, colors = BOOK_COLORS) {
  const books = [];
  let x = x0 + 0.01;
  for (let i = 0; x < x1 - 0.06; i++) {
    const w = 0.065 + noise(seed + i * 1.7) * 0.05;
    if (x + w > x1 - 0.01) break;
    const h = tall * (0.72 + noise(seed + i * 2.9) * 0.28);
    const color = colors[Math.floor(noise(seed + i * 4.3) * colors.length)];
    books.push(part(x, y + (1 - noise(seed + i * 5.1)) * 0.02, z, w, deep - 0.02, h, color, "book"));
    x += w + (noise(seed + i * 6.7) > 0.86 ? 0.05 : 0.004);
  }
  return books;
}

// A small potted plant standing on a surface, drawn upright (from any side).
function modelPlant(ctx, p, size = 1, seed = 1) {
  drawPot(ctx, p.x, p.y, "clay", 9 * size, 10 * size);
  drawLeafClump(ctx, p.x, p.y - 13 * size, 8 * size, 7 * size, ["#3f6e3a", "#5f9a55", "#8cc07a"], seed, 12);
}

// A little table lamp: a stem and a pleated shade, glowing warm.
function modelLamp(ctx, p, shade = "#f2d9a0") {
  ctx.fillStyle = "#5c4530";
  ctx.fillRect(p.x - 4, p.y - 2, 8, 2);
  ctx.fillRect(p.x - 1, p.y - 12, 2, 11);
  const g = ctx.createLinearGradient(0, p.y - 22, 0, p.y - 11);
  g.addColorStop(0, shadeColor(shade, 18));
  g.addColorStop(1, shadeColor(shade, -12));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p.x - 8, p.y - 11);
  ctx.lineTo(p.x + 8, p.y - 11);
  ctx.lineTo(p.x + 5, p.y - 22);
  ctx.lineTo(p.x - 5, p.y - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shadeColor(shade, -45) + "80";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "rgba(120, 90, 40, 0.18)"; // pleats
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x + i * 1.9, p.y - 21);
    ctx.lineTo(p.x + i * 3, p.y - 12);
    ctx.stroke();
  }
}

// Desk legs: four square legs under a top that's `top` pixels high.
function legs(W, D, top, color, inset = 0.06, size = 0.07) {
  return [
    [inset, inset], [W - inset - size, inset], [inset, D - inset - size], [W - inset - size, D - inset - size],
  ].map(([x, y]) => part(x, y, 0, size, size, top, shadeColor(color, -10), "wood"));
}

// A panel line inset on a face (drawers, doors, headboards).
function inset(ctx, x, y, w, h, color) {
  ctx.strokeStyle = shadeColor(color, -40) + "90";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = shadeColor(color, 30) + "70";
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + h - 1);
  ctx.lineTo(x + w - 1, y + h - 1);
  ctx.lineTo(x + w - 1, y + 1.5);
  ctx.stroke();
}

// --- The models ---
// Each takes the piece (for its color) and returns { W, D, parts, after,
// live }: `after(ctx, P)` draws upright extras (plants, lamps) once, and
// `live(ctx, P)` draws things that move, every frame. P(x, y, z) is where
// a point of the model lands on the screen.
// Which of a few arrangements a piece gets (its books), from where it
// stands, so a row of shelves doesn't look copied and pasted.
const modelVariant = (f) => Math.abs(Math.round(f.x * 7.3 + f.y * 3.1)) % 5;

// A model's width and depth: the piece's own footprint (turned pieces
// have theirs swapped), or the usual size for a sample.
function sizeOf(f, W, D) {
  if (f.w === undefined || f.h === undefined) return [W, D];
  return f.kind.endsWith("Side") || f.facing === "right" || f.facing === "left" ? [f.h, f.w] : [f.w, f.h];
}

const MODELS = {
  bookshelf: (f) => {
    const v = modelVariant(f) * 17;
    const [W, D] = sizeOf(f, 1.3, 0.5), H = 62, c = WOOD;
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, 0.05, H, shadeColor(c, -28)),
        part(0.07, 0.03, 0, W - 0.14, D - 0.05, 6, shadeColor(c, -8)),
        ...bookRow(0.08, W - 0.08, 6, 22, 0.1, 0.34, 3 + v),
        part(0.07, 0.03, 30, W - 0.14, D - 0.05, 3, c),
        ...bookRow(0.08, W - 0.08, 33, 24, 0.1, 0.34, 11 + v),
        part(0, 0, 0, 0.08, D, H, c),
        part(W - 0.08, 0, 0, 0.08, D, H, c),
        part(-0.02, -0.01, H, W + 0.04, D + 0.03, 4, shadeColor(c, 6)),
        part(0.2, 0.12, H + 4, 0.34, 0.24, 4, "#3f6f9f", "book"), // books lying on top
        part(0.24, 0.14, H + 8, 0.28, 0.2, 3.5, "#c98a3c", "book"),
      ],
      after: (ctx, P) => modelPlant(ctx, P(W - 0.28, D * 0.55, H + 4), 0.8, 4),
    };
  },

  libraryShelf: (f) => {
    const [W, D] = sizeOf(f, 1.5, 0.45), H = 58, c = "#5a3a26", v = modelVariant(f) * 17;
    const shelves = [4, 21, 38];
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, 0.05, H, shadeColor(c, -25)),
        part(0.07, 0.03, 0, W - 0.14, D - 0.05, 4, shadeColor(c, -6)),
        ...shelves.flatMap((z, i) => [
          ...bookRow(0.08, W - 0.08, z, 15, 0.08, 0.32, 20 + i * 9 + v),
          part(0.07, 0.03, z + 15, W - 0.14, D - 0.05, 2, c),
        ]),
        part(0, 0, 0, 0.07, D, H, c),
        part(W - 0.07, 0, 0, 0.07, D, H, c),
        part(-0.03, -0.01, H, W + 0.06, D + 0.03, 4, shadeColor(c, 8)),
        part(0.14, 0.1, H + 4, 0.36, 0.24, 4, "#c98a3c", "book"),
        part(0.17, 0.12, H + 8, 0.3, 0.2, 4, "#3f6f9f", "book"),
      ],
    };
  },

  cubeShelf: (f) => {
    const [W, D] = sizeOf(f, 1.0, 0.5), H = 34, c = "#f2ece2", t = 0.05;
    const cubes = [[0, 0, true], [1, 0, false], [0, 1, false], [1, 1, true]];
    const cw = (W - 3 * t) / 2, ch = (H - 3 * 2.5) / 2;
    const wicker = (x, z) => part(x + 0.02, 0.1, z, cw - 0.04, D - 0.14, ch - 3, "#c49a5c", "wicker", { round: 2 });
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, 0.04, H, shadeColor(c, -12), "paint"),
        ...cubes.flatMap(([cx, cy, basket], i) => {
          const x = t + cx * (cw + t), z = 2.5 + cy * (ch + 2.5);
          return basket ? [wicker(x, z)] : bookRow(x, x + cw, z, ch - 2, 0.08, 0.34, 40 + i * 7);
        }),
        part(t, 0.02, 0, W - 2 * t, D - 0.02, 2.5, c, "paint"),
        part(t, 0.02, 2.5 + ch, W - 2 * t, D - 0.02, 2.5, c, "paint"),
        part(t + cw, 0.02, 0, t, D - 0.02, H, c, "paint"),
        part(0, 0, 0, t, D, H, c, "paint"),
        part(W - t, 0, 0, t, D, H, c, "paint"),
        part(0, 0, H - 2.5, W, D, 2.5, shadeColor(c, 4), "paint"),
      ],
      after: (ctx, P) => {
        const r = P(W * 0.3, D * 0.35, H); // a record leaning on top
        ctx.fillStyle = "#15151a";
        ctx.beginPath();
        ctx.arc(r.x, r.y - 7, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.arc(r.x, r.y - 7, 5.5, -2.4, -1.2);
        ctx.lineTo(r.x, r.y - 7);
        ctx.fill();
        ctx.fillStyle = "#e37aa0";
        ctx.beginPath();
        ctx.arc(r.x, r.y - 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        modelPlant(ctx, P(W * 0.72, D * 0.5, H), 0.75, 9);
      },
    };
  },

  wardrobe: (f) => {
    const [W, D] = sizeOf(f, 1.0, 0.6), H = 64, c = "#8b5e3c";
    const door = (x) => part(x, D - 0.02, 5, W / 2 - 0.07, 0.03, H - 11, shadeColor(c, 5), "wood", {
      paint: { front: (ctx, U, V) => {
        inset(ctx, 3, 3, U - 6, V * 0.42, c);
        inset(ctx, 3, V * 0.5, U - 6, V * 0.47, c);
      } },
    });
    return {
      W, D,
      parts: [
        part(0.03, 0.02, 0, W - 0.06, D - 0.04, 5, shadeColor(c, -25)),
        part(0, 0, 5, W, D - 0.02, H - 5, c, "wood", {
          paint: { left: (ctx, U, V) => inset(ctx, 4, 4, U - 8, V - 10, c), right: (ctx, U, V) => inset(ctx, 4, 4, U - 8, V - 10, c) },
        }),
        door(0.05),
        door(W / 2 + 0.02),
        part(W / 2 - 0.07, D + 0.01, H * 0.52, 0.035, 0.03, 5, "#d4ad52", "metal"), // knobs
        part(W / 2 + 0.035, D + 0.01, H * 0.52, 0.035, 0.03, 5, "#d4ad52", "metal"),
        part(-0.03, -0.02, H, W + 0.06, D + 0.03, 3, shadeColor(c, -8)), // the crown
        part(0.03, 0.02, H + 3, W - 0.06, D - 0.04, 1.5, shadeColor(c, 10)),
      ],
    };
  },

  dresser: (f) => {
    const [W, D] = sizeOf(f, 1.1, 0.5), H = 30, c = "#9a6a45";
    const drawer = (i) => part(0.05, D - 0.01, 4 + i * 8.3, W - 0.1, 0.025, 7.6, shadeColor(c, 4), "wood", {
      paint: { front: (ctx, U, V) => {
        inset(ctx, 1, 0.5, U - 2, V - 1, c);
        ctx.fillStyle = "#d4ad52";
        ctx.fillRect(U / 2 - 5, V / 2 - 1, 10, 2);
        ctx.fillStyle = "rgba(255, 245, 200, 0.6)";
        ctx.fillRect(U / 2 - 5, V / 2 - 1, 10, 0.7);
      } },
    });
    return {
      W, D,
      parts: [
        ...[[0.04, 0.04], [W - 0.1, 0.04], [0.04, D - 0.1], [W - 0.1, D - 0.1]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 4, shadeColor(c, -30))),
        part(0.02, 0, 3, W - 0.04, D - 0.02, H - 5, c),
        drawer(0), drawer(1), drawer(2),
        part(-0.02, -0.01, H - 2, W + 0.04, D + 0.03, 3, shadeColor(c, 10)),
        part(0.1, D * 0.4, H + 1, 0.16, 0.03, 10, "#e37aa0", "paint", { // a framed photo
          paint: { front: (ctx, U, V) => {
            ctx.fillStyle = "#fffaf3";
            ctx.fillRect(1.5, 1.5, U - 3, V - 3);
            ctx.fillStyle = "#9ec7e0";
            ctx.fillRect(2.5, 2.5, U - 5, (V - 5) * 0.55);
            ctx.fillStyle = "#7aa860";
            ctx.fillRect(2.5, 2.5 + (V - 5) * 0.55, U - 5, (V - 5) * 0.45);
          } },
        }),
      ],
      after: (ctx, P) => modelLamp(ctx, P(W * 0.74, D * 0.5, H + 1)),
    };
  },

  writingDesk: (f) => {
    const [W, D] = sizeOf(f, 1.3, 0.6), H = 22, c = "#7a5238";
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 3, c),
        part(0.08, 0.06, H - 9, W - 0.16, D - 0.1, 6, c, "wood", {
          paint: { front: (ctx, U, V) => {
            inset(ctx, U * 0.3, 1, U * 0.4, V - 2, c);
            ctx.fillStyle = "#d4ad52";
            ctx.fillRect(U / 2 - 1.5, V / 2 - 1, 3, 2);
          } },
        }),
        part(-0.02, -0.01, H - 3, W + 0.04, D + 0.03, 3.5, shadeColor(c, 6)),
        part(W * 0.34, D * 0.3, H + 0.5, 0.36, 0.26, 2, "#f4ecdc", "pages"), // a stack of paper
        part(W * 0.36, D * 0.33, H + 2.5, 0.32, 0.22, 1, "#fffaf0", "pages", {
          paint: { top: (ctx, U, V) => {
            ctx.fillStyle = "rgba(60, 50, 40, 0.35)";
            for (let i = 0; i < 4; i++) ctx.fillRect(2, 2 + i * (V / 5), U * (i === 3 ? 0.5 : 0.85), 0.8);
          } },
        }),
        part(0.1, D * 0.35, H + 0.5, 0.1, 0.1, 8, "#3f6f9f", "paint"), // the pen pot
      ],
      after: (ctx, P) => {
        const p = P(0.15, D * 0.4, H + 8);
        ctx.fillStyle = "#e0a84c";
        ctx.fillRect(p.x - 2, p.y - 5, 1, 6);
        ctx.fillStyle = "#c0554a";
        ctx.fillRect(p.x + 1, p.y - 6, 1, 7);
        const l = P(W - 0.2, D * 0.45, H + 0.5); // a green banker's lamp
        ctx.fillStyle = "#b8923a";
        ctx.fillRect(l.x - 5, l.y - 2, 10, 2);
        ctx.fillRect(l.x - 1, l.y - 11, 2, 10);
        const g = ctx.createLinearGradient(0, l.y - 16, 0, l.y - 10);
        g.addColorStop(0, "#6aa062");
        g.addColorStop(1, "#3f6a3a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(l.x, l.y - 11, 8, 4.5, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 240, 180, 0.8)";
        ctx.fillRect(l.x - 6, l.y - 11, 12, 1.2);
      },
    };
  },

  aestheticDesk: (f) => {
    const [W, D] = sizeOf(f, 1.4, 0.6), H = 22, c = "#f2ece2";
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 3, "#e6d9c6", 0.07, 0.06).map((p) => ({ ...p, mat: "paint" })),
        part(-0.02, -0.01, H - 3, W + 0.04, D + 0.03, 3.5, c, "paint"),
        part(W / 2 - 0.05, 0.12, H + 0.5, 0.1, 0.08, 6, "#e0d8cc", "paint"), // the monitor's stand
        part(W / 2 - 0.44, 0.1, H + 5, 0.88, 0.05, 26, "#e8e2d8", "paint", {
          round: 2,
          paint: { front: (ctx, U, V) => {
            const sky = ctx.createLinearGradient(0, 2, 0, V - 2);
            sky.addColorStop(0, "#f7b8c8");
            sky.addColorStop(1, "#f2d09a");
            ctx.fillStyle = sky;
            ctx.fillRect(2, 2, U - 4, V - 4);
            ctx.fillStyle = "#fff4d0";
            ctx.beginPath();
            ctx.arc(U / 2, V - 6, 5, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
            ctx.fillRect(4, 4, U * 0.3, 1.5);
          } },
        }),
        part(W / 2 - 0.34, D - 0.24, H + 0.5, 0.6, 0.14, 2, "#f7d0da", "paint", { round: 1 }), // keyboard
        part(W / 2 + 0.34, D - 0.22, H + 0.5, 0.07, 0.1, 2.5, "#f7d0da", "paint", { round: 2 }), // mouse
      ],
      after: (ctx, P) => {
        const p = P(0.14, D * 0.55, H + 0.5);
        drawPot(ctx, p.x, p.y, "pink", 5, 7);
        drawLeaf(ctx, p.x, p.y - 8, -0.4, 9, 3, "#5f9a55");
        drawLeaf(ctx, p.x, p.y - 8, 0.4, 9, 3, "#4f8a4a");
        drawLeaf(ctx, p.x, p.y - 8, 0, 10, 3, "#6aa860");
        const l = P(W - 0.12, D * 0.45, H + 0.5); // a little arch lamp
        ctx.fillStyle = "#f2ece2";
        ctx.fillRect(l.x - 4, l.y - 2, 8, 2);
        ctx.strokeStyle = "#e6d9c6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - 1);
        ctx.quadraticCurveTo(l.x, l.y - 30, l.x - 8, l.y - 24);
        ctx.stroke();
        ctx.fillStyle = "#fff4c8";
        ctx.beginPath();
        ctx.arc(l.x - 8, l.y - 22, 3.5, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  },

  laptopDesk: (f) => {
    const [W, D] = sizeOf(f, 1.3, 0.6), H = 20, c = "#9a6a45";
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 3, c),
        part(0.08, 0.06, H - 8, W - 0.16, D - 0.1, 5, c),
        part(-0.02, -0.01, H - 3, W + 0.04, D + 0.03, 3.5, shadeColor(c, 6)),
        part(W / 2 - 0.36, 0.22, H + 0.5, 0.72, 0.3, 2, "#c8c8d0", "metal", { // the laptop's base
          paint: { top: (ctx, U, V) => {
            ctx.fillStyle = "rgba(60, 60, 70, 0.35)";
            for (let i = 0; i < 4; i++) ctx.fillRect(3, 2 + i * 2.6, U - 6, 1.2);
            ctx.fillStyle = "rgba(60, 60, 70, 0.2)";
            ctx.fillRect(U / 2 - 5, V - 5, 10, 3);
          } },
        }),
        part(W / 2 - 0.36, 0.18, H + 0.5, 0.72, 0.04, 20, "#3a3a44", "metal", { // its lid, the screen facing the room
          round: 1.5,
          paint: { front: (ctx, U, V) => {
            const glow = ctx.createLinearGradient(0, 2, 0, V - 2);
            glow.addColorStop(0, "#bfe3f2");
            glow.addColorStop(1, "#7fb2d6");
            ctx.fillStyle = glow;
            ctx.fillRect(2, 2, U - 4, V - 4);
            ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
            for (let i = 0; i < 4; i++) ctx.fillRect(5 + i * 7, 5, 4, 4);
          }, back: (ctx, U, V) => {
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // a little logo
            ctx.beginPath();
            ctx.arc(U / 2, V / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } },
        }),
        part(W - 0.26, D * 0.4, H + 0.5, 0.12, 0.12, 8, "#f2ece2", "paint", { // a mug
          round: 2,
          paint: { top: (ctx, U, V) => {
            ctx.fillStyle = "#6b3a1e";
            ctx.beginPath();
            ctx.ellipse(U / 2, V / 2, U / 2 - 1.2, V / 2 - 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
          } },
        }),
      ],
    };
  },

  mattress: (f) => {
    const [W, D] = sizeOf(f, 1.4, 2.1), c = f.color || "#e05a47";
    return {
      W, D, shear: 0.28, // (beds turn a little less: someone asleep lies where they stand)
      parts: [
        part(0, 0, 0, W, D, 7, "#e9e1d3", "fabric", { round: 3 }),
        part(0.12, 0.08, 7, W - 0.24, 0.36, 5, "#fffaf3", "fabric", { round: 5 }),
        ...quilt(W, D, 0.6, 7, c, 0),
      ],
    };
  },

  bed: (f) => bedModel(f, false),
  canopyBed: (f) => bedModel(f, true),

  loveseat: (f) => {
    const [W, D] = sizeOf(f, 1.6, 0.8), c = f.color || "#7a9e8c", dark = shadeColor(c, -15);
    return {
      W, D,
      parts: [
        ...[[0.06, 0.06], [W - 0.12, 0.06], [0.06, D - 0.12], [W - 0.12, D - 0.12]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 4, WOOD_DARK)),
        part(0.02, 0.02, 4, W - 0.04, D - 0.04, 8, dark, "fabric", { round: 3 }),
        part(0.05, 0, 12, W - 0.1, 0.26, 21, dark, "fabric", { round: 6 }), // the back
        part(0.17, 0.24, 12, (W - 0.34) / 2 - 0.01, D - 0.28, 7, c, "fabric", { round: 5 }), // the seat cushions
        part(W / 2 + 0.01, 0.24, 12, (W - 0.34) / 2 - 0.01, D - 0.28, 7, c, "fabric", { round: 5 }),
        part(0.26, 0.22, 19, 0.3, 0.1, 12, "#f2d9a0", "fabric", { round: 5 }), // throw pillows
        part(W - 0.56, 0.22, 19, 0.3, 0.1, 12, "#e0845a", "fabric", { round: 5 }),
        part(0, 0.06, 4, 0.17, D - 0.06, 18, dark, "fabric", { round: 5 }), // the arms
        part(W - 0.17, 0.06, 4, 0.17, D - 0.06, 18, dark, "fabric", { round: 5 }),
      ],
    };
  },

  cloudSofa: (f) => {
    const [W, D] = sizeOf(f, 2.0, 0.85), c = "#f2ece2";
    return {
      W, D,
      parts: [
        part(0.04, 0.04, 0, W - 0.08, D - 0.08, 9, shadeColor(c, -14), "boucle", { round: 4 }),
        part(0.06, 0, 9, W - 0.12, 0.34, 26, shadeColor(c, -4), "boucle", { round: 12 }), // the back
        part(0.3, 0.3, 9, (W - 0.6) / 2 - 0.01, D - 0.32, 10, shadeColor(c, 6), "boucle", { round: 8 }), // seats
        part(W / 2 + 0.01, 0.3, 9, (W - 0.6) / 2 - 0.01, D - 0.32, 10, shadeColor(c, 6), "boucle", { round: 8 }),
        part(W * 0.6, 0.3, 19, 0.3, 0.1, 13, "#e0b8a0", "fabric", { round: 5 }), // a pillow
        part(0, 0.04, 0, 0.3, D - 0.04, 24, c, "boucle", { round: 12 }), // the arms
        part(W - 0.3, 0.04, 0, 0.3, D - 0.04, 24, c, "boucle", { round: 12 }),
      ],
    };
  },

  bench: (f) => {
    const [W, D] = sizeOf(f, 1.5, 0.5), S = 17, c = WOOD;
    const parts = [
      ...[[0.04, 0.05], [W / 2 - 0.035, 0.05], [W - 0.11, 0.05], [0.04, D - 0.1], [W / 2 - 0.035, D - 0.1], [W - 0.11, D - 0.1]].map(([x, y]) => part(x, y, 0, 0.07, 0.06, S - 5, WOOD_DARK)),
      part(0.08, 0.08, 4, W - 0.16, D - 0.16, 2, shadeColor(WOOD_DARK, -8)), // the stretcher
      part(0.02, 0.02, S - 6, W - 0.04, D - 0.03, 6, c), // the seat frame
      part(0.04, 0.1, S, W - 0.08, D - 0.12, 5, "#7fa592", "fabric", { round: 4, paint: { top: tufts } }),
    ];
    for (let i = 1; i < 10; i++) parts.push(part(0.04 + (i * (W - 0.12)) / 10, 0.02, S, 0.035, 0.05, 16, c)); // spindles
    parts.push(part(0.05, 0, S + 16, W - 0.1, 0.07, 4, c)); // the top rail
    parts.push(part(0, 0, 0, 0.09, 0.09, S + 22, WOOD_DARK), part(W - 0.09, 0, 0, 0.09, 0.09, S + 22, WOOD_DARK));
    parts.push(part(0.1, 0.1, S + 5, 0.34, 0.1, 14, "#dca84e", "fabric", { round: 5 })); // the mustard pillow
    parts.push(part(W - 0.44, 0.12, S + 5, 0.28, D - 0.1, 1.5, "#c9714a", "knit")); // the throw, folded over the end
    parts.push(part(W - 0.44, D - 0.02, S - 8, 0.28, 0.025, 14.5, "#b35e3c", "knit", { fringe: true }));
    return {
      W, D, parts,
      after: (ctx, P) => {
        for (const x of [0.045, W - 0.045]) { // round knobs on the posts
          const k = P(x, 0.045, S + 24);
          ctx.fillStyle = shadeColor(WOOD, 12);
          ctx.beginPath();
          ctx.arc(k.x, k.y, 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 240, 210, 0.45)";
          ctx.beginPath();
          ctx.arc(k.x - 0.9, k.y - 1.1, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    };
  },
};

// Buttons pressed into a cushion's top, with a soft puff around each.
function tufts(ctx, U, V) {
  for (let i = 0; i < 3; i++) {
    const x = (U * (i + 0.5)) / 3, y = V / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 2.5, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40, 70, 55, 0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(50, 80, 65, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((U * i) / 3, 2);
    ctx.lineTo((U * i) / 3, V - 2);
    ctx.stroke();
  }
}

// A quilted blanket in the owner's color over a bed from `from` (grid
// units from the head) to the foot, on top of a mattress `z` high, with a
// folded-back cuff and the blanket hanging down over the foot end.
function quilt(W, D, from, z, color, drop) {
  const quilted = (ctx, U, V) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let y = 12; y < V - 3; y += 12) {
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.lineTo(U - 3, y);
      ctx.stroke();
    }
    for (let x = 14; x < U - 3; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 3);
      ctx.lineTo(x, V - 3);
      ctx.stroke();
    }
  };
  return [
    part(0.01, from, z, W - 0.02, D - from - 0.02, 4, color, "fabric", { round: 4, paint: { top: quilted } }),
    part(0.01, from - 0.02, z + 4, W - 0.02, 0.16, 2, shadeColor(color, 45), "fabric", { round: 2 }), // the cuff
    part(0.01, D - 0.03, Math.max(0, z - drop), W - 0.02, 0.03, drop + 4, shadeColor(color, -6), "fabric", { round: 3 }),
  ];
}

// A bed: a wooden frame on little legs, a paneled headboard against the
// wall, a mattress, two pillows and a quilt. The canopy bed adds four
// posts, rails, sheer drapes and fairy lights.
function bedModel(f, canopy) {
  const [W, D] = sizeOf(f, 1.8, 2.3), c = "#7a5238", color = f.color || "#e05a47";
  const panel = (ctx, U, V) => {
    inset(ctx, 5, 4, U / 2 - 7, V - 8, c);
    inset(ctx, U / 2 + 2, 4, U / 2 - 7, V - 8, c);
  };
  const parts = [
    ...[[0.04, 0.3], [W - 0.12, 0.3], [0.04, D - 0.1], [W - 0.12, D - 0.1]].map(([x, y]) => part(x, y, 0, 0.08, 0.08, 4, WOOD_DARK)),
    part(0, 0.25, 4, W, D - 0.25, 8, c),
    part(0.04, 0.29, 12, W - 0.08, D - 0.33, 7, "#f5eee2", "fabric", { round: 3 }),
    part(0.14, 0.34, 19, W / 2 - 0.2, 0.36, 6, "#fffaf3", "fabric", { round: 6 }),
    part(W / 2 + 0.06, 0.34, 19, W / 2 - 0.2, 0.36, 6, "#fffaf3", "fabric", { round: 6 }),
    ...quilt(W - 0.04, D - 0.04, 0.85, 19, color, 12).map((p) => ({ ...p, x: p.x + 0.02, y: p.y })),
    part(-0.05, 0, 0, W + 0.1, 0.25, 34, "#6b4630", "wood", { paint: { front: panel, back: panel } }),
    part(-0.07, -0.02, 34, W + 0.14, 0.29, 3, shadeColor("#6b4630", 10)),
  ];
  if (canopy) {
    const post = "#e9dcc2";
    for (const [x, y] of [[-0.05, -0.02], [W - 0.03, -0.02], [-0.05, D - 0.08], [W - 0.03, D - 0.08]]) parts.push(part(x, y, 0, 0.08, 0.08, 72, post, "paint"));
    parts.push(part(-0.05, -0.02, 72, W + 0.1, 0.08, 3, post, "paint"), part(-0.05, D - 0.08, 72, W + 0.1, 0.08, 3, post, "paint"));
    parts.push(part(-0.05, 0.06, 72, 0.08, D - 0.14, 3, post, "paint"), part(W - 0.03, 0.06, 72, 0.08, D - 0.14, 3, post, "paint"));
    // Sheer drapes gathered at the foot posts.
    parts.push(part(-0.03, D - 0.26, 20, 0.05, 0.18, 52, "#fffaf5", "sheer"), part(W - 0.02, D - 0.26, 20, 0.05, 0.18, 52, "#fffaf5", "sheer"));
  }
  return {
    W, D, parts, shear: 0.28, // (see the mattress)
    live: canopy ? (ctx, P) => { // fairy lights along the front rail, twinkling
      const t = performance.now() / 1000;
      for (let i = 0; i <= 12; i++) {
        const p = P(-0.05 + ((W + 0.1) * i) / 12, D - 0.04, 70 - Math.sin((i / 12) * Math.PI) * 6);
        ctx.fillStyle = `rgba(255, 220, 140, ${0.7 + Math.sin(t * 2 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } : null,
  };
}

// --- Drawing a model ---

// The model's points on screen, relative to the piece's top-left corner,
// for a facing. Turned: its length runs down the page, and it's drawn
// turned a little toward the camera (the side facing the room shows).
function modelProjector(model, facing) {
  const { W, D } = model;
  const turned = facing === "right";
  const h = turned ? W : D;
  return (mx, my, mz) => {
    let wx, wy;
    if (facing === "back") [wx, wy] = [W - mx, D - my];
    else if (turned) [wx, wy] = [my, W - mx];
    else [wx, wy] = [mx, my];
    // (Pinned at the near end, so the far end leans out into the room,
    // never back into the wall behind.)
    const shift = turned ? -(model.shear ?? MODEL_SHEAR) * (wy - h) * TILE : 0;
    return { x: wx * TILE + shift, y: wy * TILE - mz, wx, wy };
  };
}

// A part's faces: the corner it starts at, then the corners across (u)
// and down (v) its face, and how many pixels across and down it is.
function partFaces(p) {
  const { x, y, z, w, d, h } = p, x1 = x + w, y1 = y + d, z1 = z + h;
  return [
    ["top", [x, y, z1], [x1, y, z1], [x, y1, z1], w * TILE, d * TILE],
    ["front", [x, y1, z1], [x1, y1, z1], [x, y1, z], w * TILE, h],
    ["back", [x1, y, z1], [x, y, z1], [x1, y, z], w * TILE, h],
    ["right", [x1, y1, z1], [x1, y, z1], [x1, y1, z], d * TILE, h],
    ["left", [x, y, z1], [x, y1, z1], [x, y, z], d * TILE, h],
  ];
}

// The order to draw parts in: anything further from the camera first.
// The camera looks from the south (the bottom of the screen), from above,
// and for a turned piece a little from the room's side.
function orderParts(model, P, facing) {
  const boxes = model.parts.map((p, i) => {
    const pts = [];
    for (const mx of [p.x, p.x + p.w]) for (const my of [p.y, p.y + p.d]) for (const mz of [p.z, p.z + p.h]) pts.push(P(mx, my, mz));
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y), wxs = pts.map((q) => q.wx), wys = pts.map((q) => q.wy);
    return {
      p, i,
      sx0: Math.min(...xs), sx1: Math.max(...xs), sy0: Math.min(...ys), sy1: Math.max(...ys),
      x0: Math.min(...wxs), x1: Math.max(...wxs), y0: Math.min(...wys), y1: Math.max(...wys), z0: p.z, z1: p.z + p.h,
    };
  });
  const e = 0.001;
  const behind = (a, b) => {
    if (a.sx1 <= b.sx0 || b.sx1 <= a.sx0 || a.sy1 <= b.sy0 || b.sy1 <= a.sy0) return false;
    if (a.y1 <= b.y0 + e) return true;
    if (b.y1 <= a.y0 + e) return false;
    if (a.z1 <= b.z0 + e) return true;
    if (b.z1 <= a.z0 + e) return false;
    if (facing === "right") {
      if (a.x1 <= b.x0 + e) return true;
      if (b.x1 <= a.x0 + e) return false;
    }
    return false;
  };
  const done = new Set(), visiting = new Set(), out = [];
  const visit = (b) => {
    if (done.has(b)) return;
    if (visiting.has(b)) return; // (a tie: either order is fine)
    visiting.add(b);
    for (const a of boxes) if (a !== b && behind(a, b)) visit(a);
    visiting.delete(b);
    done.add(b);
    out.push(b.p);
  };
  // Start with the ones furthest back, so ties keep a sensible order.
  const key = (b) => b.y1 * 1000 + b.z0 + (facing === "right" ? b.x1 * 10 : 0);
  for (const b of [...boxes].sort((a, b2) => key(a) - key(b2))) visit(b);
  return out;
}

// A face's own look: its color lit from above (tops lightest, the side
// faces a little darker), then its material, a rim, and its details.
function drawFace(ctx, p, name, U, V, lit, seed) {
  const r = Math.min(p.round ?? 0, U / 2, V / 2);
  const shape = () => {
    ctx.beginPath();
    if (r > 0) ctx.roundRect(0, 0, U, V, r);
    else ctx.rect(0, 0, U, V);
  };
  const base = shadeColor(p.color, lit);
  if (p.mat === "glass") { // (what's behind it first, then the glass over it)
    ctx.save();
    shape();
    ctx.clip();
    p.paint?.[name]?.(ctx, U, V);
    ctx.fillStyle = "rgba(205, 230, 240, 0.28)";
    ctx.fillRect(0, 0, U, V);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(U * 0.12, 0);
    ctx.lineTo(U * 0.22, 0);
    ctx.lineTo(U * 0.08, V);
    ctx.lineTo(U * -0.02, V);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(90, 110, 120, 0.5)";
    ctx.lineWidth = 1;
    shape();
    ctx.stroke();
    return;
  }
  if (p.mat === "sheer") {
    ctx.fillStyle = "rgba(255, 250, 245, 0.42)";
    shape();
    ctx.fill();
    ctx.strokeStyle = "rgba(230, 215, 200, 0.5)";
    ctx.lineWidth = 0.8;
    for (let x = 2; x < U; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(x) * 1.5, V);
      ctx.stroke();
    }
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, V);
  if (name === "top") {
    g.addColorStop(0, shadeColor(base, 6));
    g.addColorStop(1, base);
  } else {
    g.addColorStop(0, shadeColor(base, 8));
    g.addColorStop(1, shadeColor(base, -12));
  }
  ctx.fillStyle = g;
  shape();
  ctx.fill();
  ctx.save();
  ctx.clip();
  paintMaterial(ctx, p, name, U, V, seed);
  if (name !== "top" && p.z === 0) { // (where it meets the floor)
    ctx.fillStyle = "rgba(30, 18, 8, 0.2)";
    ctx.fillRect(0, V - Math.min(3, V / 3), U, 3);
  }
  if (name === "top" && V > 3) { // (the lit edge)
    ctx.fillStyle = "rgba(255, 250, 235, 0.22)";
    ctx.fillRect(0, 0, U, 1.2);
  }
  p.paint?.[name]?.(ctx, U, V);
  ctx.restore();
  // The rim: a soft darker line around every part, like the bushes.
  ctx.strokeStyle = shadeColor(p.color, -48) + (p.mat === "book" ? "70" : "88");
  ctx.lineWidth = 1;
  shape();
  ctx.stroke();
}

// Materials: wood grain, fabric weave, boucle loops, wicker, book spines
// and page edges, metal sheen, painted flecks.
function paintMaterial(ctx, p, name, U, V, seed) {
  const n = (i) => noise(seed + i * 1.37);
  if (p.mat === "wood") {
    const along = U >= V; // (grain runs along the longer side)
    const L = along ? U : V, A = along ? V : U;
    for (let i = 0; i < Math.max(2, A / 3); i++) {
      const at = ((i + 0.5) / Math.max(2, A / 3)) * A + (n(i) - 0.5) * 2;
      ctx.strokeStyle = i % 3 ? "rgba(40, 22, 10, 0.12)" : "rgba(255, 235, 200, 0.1)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let s = 0; s <= L; s += 6) {
        const off = Math.sin(s * 0.12 + i * 2.1 + seed) * 0.8;
        const [x, y] = along ? [s, at + off] : [at + off, s];
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (U * V > 500 && n(99) > 0.5) { // a knot
      ctx.fillStyle = "rgba(50, 28, 12, 0.22)";
      ctx.beginPath();
      ctx.ellipse(U * (0.2 + n(7) * 0.6), V * (0.25 + n(8) * 0.5), 2.2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.mat === "fabric" || p.mat === "knit") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    for (let y = 1; y < V; y += 3) for (let x = (y % 2) * 1.5; x < U; x += 3) ctx.fillRect(x, y, 1, 1);
    if (p.mat === "knit") {
      ctx.strokeStyle = "rgba(255, 220, 190, 0.28)";
      ctx.lineWidth = 1;
      for (let x = 3; x < U; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, V);
        ctx.stroke();
      }
      if (p.fringe && name !== "top") {
        ctx.fillStyle = "#e7c9a4";
        for (let x = 1.5; x < U - 1; x += 3) ctx.fillRect(x, V - 2, 1, 2);
      }
    }
    if (name !== "top") { // (a puffy top edge, and softer shade low down)
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(0, 0, U, Math.min(2.5, V / 3));
    } else if (U * V < 1500) { // (a soft sheen on small cushions)
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.ellipse(U * 0.4, V * 0.35, U * 0.3, V * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.mat === "boucle") {
    for (let i = 0; i < (U * V) / 10; i++) { // (little loops of yarn)
      ctx.fillStyle = i % 3 ? "rgba(255, 255, 255, 0.28)" : "rgba(170, 150, 130, 0.14)";
      ctx.beginPath();
      ctx.arc(n(i) * U, n(i + 500) * V, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (name !== "top") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(0, 0, U, Math.min(3, V / 3));
    }
  } else if (p.mat === "wicker") {
    ctx.strokeStyle = "rgba(90, 60, 25, 0.4)";
    ctx.lineWidth = 0.8;
    for (let y = 2; y < V; y += 2.5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(U, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 230, 180, 0.25)";
    for (let y = 1; y < V; y += 5) for (let x = (y % 10 > 4 ? 2 : 0); x < U; x += 4) ctx.fillRect(x, y, 2, 1.5);
  } else if (p.mat === "book") {
    if (name === "top" || (name === "back" && V < 6)) {
      ctx.fillStyle = "#f3e8cf"; // the pages, between the covers
      ctx.fillRect(1, 1, U - 2, V - 2);
      ctx.fillStyle = "rgba(150, 120, 80, 0.3)";
      for (let x = 2; x < U - 1; x += 2) ctx.fillRect(x, 1, 0.5, V - 2);
    } else if (name === "front") { // the spine: bands and a little label
      ctx.fillStyle = "rgba(255, 235, 190, 0.45)";
      ctx.fillRect(0, 2, U, 1);
      ctx.fillRect(0, V - 3, U, 1);
      if (V > 12 && U > 3) {
        ctx.fillStyle = "rgba(255, 245, 220, 0.5)";
        ctx.fillRect(U * 0.2, V * 0.35, U * 0.6, V * 0.18);
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(0, 0, 1, V);
    } else if (name !== "top") { // a cover
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(1, 1, U - 2, V - 2);
    }
  } else if (p.mat === "pages") {
    ctx.fillStyle = "rgba(150, 120, 80, 0.2)";
    if (name !== "top") for (let y = 1; y < V; y += 1.2) ctx.fillRect(0, y, U, 0.4);
  } else if (p.mat === "metal") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.moveTo(U * 0.15, 0);
    ctx.lineTo(U * 0.3, 0);
    ctx.lineTo(U * 0.1, V);
    ctx.lineTo(0, V);
    ctx.fill();
  } else if (p.mat === "paint") {
    for (let i = 0; i < Math.min(8, (U * V) / 120); i++) {
      ctx.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(n(i) * (U - 2), n(i + 50) * (V - 1), 1.5, 1);
    }
  }
}

// Draws a whole model, part by part, with P placing its points.
function paintModel(ctx, model, P, facing) {
  for (const p of orderParts(model, P, facing)) {
    const seed = p.x * 13.1 + p.y * 7.7 + p.z * 0.31 + p.w * 3.3;
    for (const [name, o, u, v, U, V] of partFaces(p)) {
      if (U < 0.3 || V < 0.3) continue;
      const a = P(...o), b = P(...u), c = P(...v);
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 0.01) continue; // (facing away)
      // Lit from above: tops lightest; faces turned sideways a little darker.
      const facingDown = Math.abs(b.y - a.y) < 0.01 && name !== "top";
      const lit = name === "top" ? 16 : facingDown ? 0 : -10;
      ctx.save();
      ctx.transform((b.x - a.x) / U, (b.y - a.y) / U, (c.x - a.x) / V, (c.y - a.y) / V, a.x, a.y);
      drawFace(ctx, p, name, U, V, lit, seed);
      ctx.restore();
    }
  }
  model.after?.(ctx, P);
}

// The drawn models, kept as little pictures: kind, facing, color and zoom.
const modelCache = new Map();
function cachedModel(kind, f, facing, scale) {
  const key = `${kind}|${facing}|${f.w}x${f.h}|${f.color}|${f.seat}|${f.back}|${modelVariant(f)}|${scale}`;
  let hit = modelCache.get(key);
  if (hit) return hit;
  const model = MODELS[kind](f);
  const P = modelProjector(model, facing);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of model.parts) {
    for (const mx of [p.x, p.x + p.w]) for (const my of [p.y, p.y + p.d]) for (const mz of [p.z, p.z + p.h]) {
      const q = P(mx, my, mz);
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    }
  }
  x0 -= 14;
  x1 += 14;
  y0 -= 34; // (room for lamps and plants on top)
  y1 += 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((x1 - x0) * scale);
  canvas.height = Math.ceil((y1 - y0) * scale);
  const c = canvas.getContext("2d");
  c.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  paintModel(c, model, P, facing);
  if (modelCache.size > 400) modelCache.clear();
  hit = { canvas, x0, y0, w: x1 - x0, h: y1 - y0, model, P };
  modelCache.set(key, hit);
  return hit;
}

// Draws a model piece at its spot, facing "front", "back" or "right"
// ("left" is "right" mirrored, see sideView).
function drawModelPiece(ctx, f, kind, facing) {
  const t = ctx.getTransform();
  const scale = Math.max(1, Math.hypot(t.a, t.b)); // (a left-facing piece is drawn mirrored: a is negative)
  const m = cachedModel(kind, f, facing, Math.round(scale * 100) / 100);
  const at = toScreen(f.x, f.y);
  if (facing === "right") {
    // A turned piece's shadow: soft, under its whole (turned) footprint.
    const { W, D } = m.model;
    const corners = [[0, 0], [W, 0], [W, D], [0, D]].map(([x, y]) => m.P(x, y, 0));
    ctx.fillStyle = "rgba(40, 25, 10, 0.16)";
    ctx.beginPath();
    corners.forEach((q, i) => ctx[i ? "lineTo" : "moveTo"](at.x + q.x + (i === 1 || i === 2 ? 4 : -2), at.y + q.y + (i < 2 ? 3 : 5)));
    ctx.closePath();
    ctx.fill();
  } else drawShadow(ctx, f.x, f.y, f.w, f.h);
  ctx.drawImage(m.canvas, at.x + m.x0, at.y + m.y0, m.w, m.h);
  if (m.model.live) m.model.live(ctx, (x, y, z) => {
    const q = m.P(x, y, z);
    return { x: at.x + q.x, y: at.y + q.y };
  }, facing);
}

// How far a spot on a turned model piece is drawn sideways (grid units),
// so seats line up with the turned drawing (see seatsOf in world.js).
function modelSeatShift(f, y) {
  const make = f.kind.endsWith("Side") && MODELS[f.kind.slice(0, -4)];
  if (!make) return 0;
  const shift = -(make(f).shear ?? MODEL_SHEAR) * (y - (f.y + f.h));
  return f.facing === "left" ? -shift : shift;
}

// Draws a model piece the way it faces: its own `facing` ("down" or none
// is the front, "up" the back, "right" or "left" turned), unless `how`
// says (theater seats always show their backs: they face the screen).
function drawModelFacing(ctx, f, kind, how = "own") {
  const dir = how !== "own" ? how : f.kind.endsWith("Side") ? f.facing : ({ up: "back", right: "right", left: "left" }[f.facing] ?? "front");
  if (dir === "left") sideView(ctx, f, () => drawModelPiece(ctx, f, kind, "right"));
  else drawModelPiece(ctx, f, kind, dir);
}

// Adds models and their drawers: the piece itself, and turned ("...Side",
// facing right or left). `keepFront` pieces keep their hand-drawn front;
// `facing` fixes which way some always face.
function registerModels(models, { keepFront = [], facing = {} } = {}) {
  Object.assign(MODELS, models);
  for (const kind of Object.keys(models)) {
    if (!keepFront.includes(kind)) FURNITURE_DRAWERS[kind] = (ctx, f) => drawModelFacing(ctx, f, kind, facing[kind]);
    FURNITURE_DRAWERS[kind + "Side"] = (ctx, f) => drawModelFacing(ctx, f, kind);
  }
}
// The bench and the cloud sofa keep their hand-drawn fronts (see
// render-rooms.js): puffs and spindles that read better straight on.
registerModels({ ...MODELS }, { keepFront: ["bench", "cloudSofa"] });

// The showroom's back view (models only).
function drawModelBack(ctx, f) {
  if (!MODELS[f.kind]) return false;
  drawModelPiece(ctx, f, f.kind, "back");
  return true;
}
