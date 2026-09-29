// Part of the house's drawing code (see render.js for how the pieces fit
// together): most furniture and plants, and the object every drawer lives in
// (FURNITURE_DRAWERS: kind name -> drawing function).

// --- Furniture ---
// One function per kind. Each gets the furniture entry from world.js,
// draws its own shadow first, then its upright shape.
const FURNITURE_DRAWERS = {
  // A leafy plant in a round clay pot.
  plant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2;
    // Pot: a tapered clay pot with a rim.
    ctx.fillStyle = "#b86b4b";
    ctx.beginPath();
    ctx.moveTo(cx - 9, by);
    ctx.lineTo(cx + 9, by);
    ctx.lineTo(cx + 12, by - 16);
    ctx.lineTo(cx - 12, by - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a5439";
    ctx.fillRect(cx - 9, by - 3, 18, 3);
    ctx.fillStyle = "#cf8260";
    ctx.fillRect(cx - 13, by - 20, 26, 5);
    // Leaves fanning up and out of the pot, darker at the back.
    const leaves = [
      [-0.9, 22, "#3f6b3c"], [0.9, 22, "#3f6b3c"],
      [-0.5, 26, "#4f7a48"], [0.5, 26, "#4f7a48"],
      [-0.2, 24, "#6fa05e"], [0.2, 24, "#6fa05e"], [0, 20, "#7fb46a"],
    ];
    for (const [angle, len, color] of leaves) {
      ctx.save();
      ctx.translate(cx, by - 18);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -len / 2, 6, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // --- More plants (each with its own pot) ---

  // A Boston fern: lots of feathery fronds arching out and drooping over
  // the pot's rim.
  fern(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "clay", 10, 14);
    for (let i = -5; i <= 5; i++) {
      const angle = i * 0.28;
      const len = 26 - Math.abs(i) * 1.2;
      const tipX = base.x + Math.sin(angle) * len * 1.2, tipY = soil - Math.cos(angle) * len + Math.abs(i) * 3.2;
      const shade = ["#3f6b3c", "#4f7a48", "#5f8a50", "#6fa05e"][(i + 8) % 4];
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(base.x + Math.sin(angle) * len * 0.5, soil - len * 0.9, tipX, tipY);
      ctx.stroke();
      // Little leaflets along each frond.
      ctx.fillStyle = shade;
      for (let t = 0.3; t < 1; t += 0.14) {
        const px = base.x + (tipX - base.x) * t, py = soil + (tipY - soil) * t - Math.sin(t * Math.PI) * 8;
        ctx.beginPath();
        ctx.ellipse(px, py, 3.2 * (1.1 - t), 1.3, angle + 0.9, 0, Math.PI * 2);
        ctx.ellipse(px, py, 3.2 * (1.1 - t), 1.3, angle - 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A monstera: big glossy leaves with splits, on long stems, in a white pot.
  monstera(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "ceramic", 11, 17);
    const leaves = [[-14, -34, -0.5, "#2f5a36"], [13, -38, 0.45, "#2f5a36"], [-6, -48, -0.15, "#3d6b40"], [8, -28, 0.8, "#3d6b40"], [-17, -22, -1.0, "#4a7a48"]];
    for (const [dx, dy, tilt, color] of leaves) {
      const lx = base.x + dx, ly = soil + dy;
      ctx.strokeStyle = "#4f7a3a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(base.x + dx * 0.3, ly + 10, lx, ly + 6);
      ctx.stroke();
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(tilt);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-13, 4, -11, -10, 0, -9);
      ctx.bezierCurveTo(11, -10, 13, 4, 0, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"; // midrib
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(0, -8);
      ctx.stroke();
      ctx.strokeStyle = "rgba(20, 40, 20, 0.55)"; // the splits
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        for (const yy of [-4, 0, 4]) {
          ctx.beginPath();
          ctx.moveTo(s * 11, yy - 1);
          ctx.lineTo(s * 5, yy + 1);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  },

  // A tall column cactus with two arms and a tiny pink flower, in a blue pot.
  cactus(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "glazed", 10, 15);
    const body = (x, y, w, h) => {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, "#4f8a4a");
      g.addColorStop(0.5, "#6fae62");
      g.addColorStop(1, "#3f7340");
      ctx.fillStyle = g;
      roundRectPath(ctx, x - w / 2, y - h, w, h, w / 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 60, 30, 0.35)"; // ribs
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - w / 5, y - h + 3);
      ctx.lineTo(x - w / 5, y - 2);
      ctx.moveTo(x + w / 5, y - h + 3);
      ctx.lineTo(x + w / 5, y - 2);
      ctx.stroke();
    };
    body(base.x - 11, soil - 18, 7, 16); // left arm
    ctx.fillStyle = "#4f8a4a";
    ctx.fillRect(base.x - 11, soil - 22, 8, 5);
    body(base.x + 11, soil - 26, 7, 14); // right arm
    ctx.fillRect(base.x + 3, soil - 30, 8, 5);
    body(base.x, soil, 11, 48); // main column
    ctx.fillStyle = "#f2a0b8"; // flower on top
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(base.x + Math.cos(i * 1.26) * 2.5, soil - 48 + Math.sin(i * 1.26) * 2.5, 2, 1.3, i * 1.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(base.x, soil - 48, 1.3, 0, Math.PI * 2);
    ctx.fill();
  },

  // A snake plant: stiff upright leaves with yellow edges, in a cement pot.
  snakePlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "cement", 10, 16);
    const leaves = [[-7, 36, -0.12], [-2, 46, -0.04], [3, 42, 0.05], [8, 32, 0.14], [0, 30, 0.0]];
    for (const [dx, h, lean] of leaves) {
      ctx.save();
      ctx.translate(base.x + dx, soil);
      ctx.rotate(lean);
      ctx.fillStyle = "#e0c85a"; // yellow edge
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.quadraticCurveTo(-4.5, -h * 0.6, 0, -h);
      ctx.quadraticCurveTo(4.5, -h * 0.6, 4, 0);
      ctx.fill();
      ctx.fillStyle = "#3f6b3c";
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.quadraticCurveTo(-3.3, -h * 0.6, 0, -h + 3);
      ctx.quadraticCurveTo(3.3, -h * 0.6, 3, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(170, 200, 140, 0.35)"; // pale bands
      for (let y = -6; y > -h + 6; y -= 6) ctx.fillRect(-3, y, 6, 1.5);
      ctx.restore();
    }
  },

  // Three little succulent rosettes in a wide shallow clay dish.
  succulents(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const by = base.y - 2;
    ctx.fillStyle = "#b86b4b";
    roundRectPath(ctx, base.x - 16, by - 9, 32, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#cf8260";
    ctx.fillRect(base.x - 17, by - 11, 34, 3);
    for (const [dx, r, colors] of [[-9, 7, ["#7fae8a", "#a9d0b0"]], [3, 8, ["#8fa87a", "#c4d9a4"]], [11, 5.5, ["#9a8fb8", "#c9bfe0"]]]) {
      const cx = base.x + dx, cy = by - 12;
      for (let ring = 0; ring < 2; ring++) {
        ctx.fillStyle = colors[ring];
        const rr = r * (1 - ring * 0.45);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + ring * 0.4;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.35, rr * 0.45, rr * 0.25, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = "#dfeecf";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A fiddle-leaf fig: a slim trunk with big wavy leaves up top, in a
  // woven basket. Tall.
  fiddleFig(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "basket", 11, 16);
    ctx.strokeStyle = "#7a5a3a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(base.x, soil);
    ctx.quadraticCurveTo(base.x + 3, soil - 25, base.x - 1, soil - 44);
    ctx.stroke();
    const leaves = [[-9, -40, -0.9], [9, -44, 0.8], [-6, -54, -0.4], [7, -58, 0.5], [0, -64, 0], [-11, -30, -1.2], [10, -32, 1.1], [2, -50, 0.2]];
    leaves.forEach(([dx, dy, tilt], i) => {
      ctx.save();
      ctx.translate(base.x + dx, soil + dy);
      ctx.rotate(tilt);
      ctx.fillStyle = ["#2f5a36", "#3d6b40", "#4a7a48"][i % 3];
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-7, 5, -8, -2, -5, -6);
      ctx.bezierCurveTo(-3, -9, 3, -9, 5, -6);
      ctx.bezierCurveTo(8, -2, 7, 5, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -7);
      ctx.stroke();
      ctx.restore();
    });
  },

  // A kentia palm: arching feathery fronds, in a white pot.
  palm(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "ceramic", 11, 17);
    for (const [angle, len] of [[-1.1, 30], [-0.6, 40], [-0.15, 46], [0.3, 42], [0.75, 36], [1.15, 28]]) {
      const tipX = base.x + Math.sin(angle) * len, tipY = soil - Math.cos(angle) * len * 0.9 + Math.abs(angle) * 10;
      const midX = base.x + Math.sin(angle) * len * 0.45, midY = soil - len * 0.85;
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(base.x, soil);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = "#4f8a4a"; // leaflets hanging off the frond
      for (let t = 0.25; t < 0.98; t += 0.09) {
        const u = 1 - t;
        const px = u * u * base.x + 2 * u * t * midX + t * t * tipX;
        const py = u * u * soil + 2 * u * t * midY + t * t * tipY;
        const drop = 7 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 3, py + drop);
        ctx.moveTo(px, py);
        ctx.lineTo(px + 3, py + drop);
        ctx.stroke();
      }
    }
  },

  // A little lemon tree: a round leafy top dotted with lemons, in clay.
  lemonTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, base.x, base.y - 2, "clay", 11, 16);
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(base.x - 1.5, soil - 22, 3, 22);
    for (const [dx, dy, r, color] of [[-8, -30, 10, "#3d6b40"], [8, -32, 10, "#3d6b40"], [0, -40, 11, "#4a7a48"], [-4, -26, 8, "#4f8a4a"], [6, -24, 8, "#4f8a4a"], [1, -34, 9, "#5f9a55"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(base.x + dx, soil + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d45c";
    for (const [dx, dy] of [[-10, -26], [7, -36], [-2, -44], [11, -27], [-6, -36]]) {
      ctx.beginPath();
      ctx.ellipse(base.x + dx, soil + dy, 2.6, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (const [dx, dy] of [[-10.8, -26.8], [6.2, -36.8]]) ctx.fillRect(base.x + dx, soil + dy, 1, 1);
  },

  // --- More furniture and decor (Nest & Nook, and a few around the house) ---

  // Hung on a wall face: a cork board with pinned notes, a photo and a
  // little calendar.
  corkBoard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 5, h = 26;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#c79a64";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "rgba(90, 55, 20, 0.25)"; // cork speckles
    for (let i = 0; i < w * 0.8; i++) ctx.fillRect(x + 3 + noise(i * 3.1) * (w - 6), y + 3 + noise(i * 5.7) * (h - 6), 1, 1);
    const notes = [[0.1, 4, 11, 9, "#fff3a8"], [0.36, 3, 10, 12, "#f7f4ee"], [0.58, 6, 12, 10, "#a8d8f0"], [0.8, 3, 9, 9, "#f5c6d6"]];
    notes.forEach(([fx, dy, nw, nh, color], i) => {
      const nx = x + fx * (w - nw);
      ctx.save();
      ctx.translate(nx + nw / 2, y + dy + nh / 2);
      ctx.rotate((i % 2 ? 1 : -1) * 0.08);
      ctx.fillStyle = color;
      ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
      ctx.fillStyle = "rgba(60, 50, 40, 0.35)"; // scribbles
      for (let l = 0; l < 3; l++) ctx.fillRect(-nw / 2 + 2, -nh / 2 + 3 + l * 2.5, nw - 4 - (l % 2) * 3, 0.8);
      ctx.fillStyle = ["#c0554a", "#3f6f9f", "#d9a441", "#4f7a48"][i]; // pin
      ctx.beginPath();
      ctx.arc(0, -nh / 2 + 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },

  // Hung on a wall face: a wooden shelf of jars and spices, with a little
  // plant at one end.
  jarShelf(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 20;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 2, w, 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x, y, w, 3.5);
    ctx.fillStyle = WOOD_DARK; // brackets
    ctx.fillRect(x + 4, y + 3, 2, 5);
    ctx.fillRect(x + w - 6, y + 3, 2, 5);
    const jars = [["#e0a84c", 9], ["#c0554a", 11], ["#f2ece2", 8], ["#7a9e5c", 10], ["#8a5a3c", 9], ["#e8c170", 7]];
    let jx = x + 4;
    for (const [color, jh] of jars) {
      if (jx + 7 > x + w - 12) break;
      ctx.fillStyle = "rgba(220, 235, 245, 0.55)"; // glass
      roundRectPath(ctx, jx, y - jh, 7, jh, 2);
      ctx.fill();
      ctx.fillStyle = color; // what's inside
      ctx.fillRect(jx + 1, y - jh * 0.7, 5, jh * 0.7 - 1);
      ctx.fillStyle = "#6b4a2e"; // lid
      ctx.fillRect(jx + 0.5, y - jh - 1.5, 6, 2);
      jx += 9;
    }
    ctx.fillStyle = "#b86b4b"; // a tiny potted herb at the end
    ctx.fillRect(x + w - 10, y - 6, 7, 6);
    ctx.fillStyle = "#5f9a55";
    ctx.beginPath();
    ctx.arc(x + w - 6.5, y - 9, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall face: a framed poster ("stars", "mountains" or "cat").
  // The bedroom phone: a retro wall phone with a coiled cord.
  wallPhone(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x + w / 2 - 7, y = a.y - WALL_HEIGHT + 10;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.fillRect(x + 2, y + 3, 14, 20);
    ctx.fillStyle = "#d9534f"; // the body
    roundRectPath(ctx, x, y, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = "#f6e7d0"; // the dial
    ctx.beginPath();
    ctx.arc(x + 7, y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8403c";
    ctx.beginPath();
    ctx.arc(x + 7, y + 12, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c2433f"; // the handset on top
    roundRectPath(ctx, x - 2, y - 3, 18, 4, 2);
    ctx.fill();
    ctx.strokeStyle = "#8f2f2c"; // the curly cord
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) ctx.lineTo(x - 2 + Math.sin(i * 1.7) * 1.5, y + 1 + i * 2.2);
    ctx.stroke();
    // A little glow and wiggle while it's ringing (globalThis.phoneRinging).
    if (f.mine && globalThis.phoneRinging) {
      ctx.fillStyle = "rgba(255, 220, 120, 0.35)";
      ctx.beginPath();
      ctx.arc(x + 7, y + 8, 13 + Math.sin(performance.now() / 60) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  poster(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = 30;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#2b2b30";
    ctx.fillRect(x, y, w, h);
    const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
    if (f.art === "stars") {
      const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
      sky.addColorStop(0, "#1e2a4a");
      sky.addColorStop(1, "#3f4f7a");
      ctx.fillStyle = sky;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = "#fff6d0";
      for (let i = 0; i < 14; i++) ctx.fillRect(ix + noise(i * 2.3) * iw, iy + noise(i * 4.1) * ih * 0.8, 1, 1);
      ctx.beginPath();
      ctx.arc(ix + iw * 0.72, iy + ih * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e2a4a";
      ctx.beginPath();
      ctx.arc(ix + iw * 0.72 + 2, iy + ih * 0.3 - 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.art === "mountains") {
      ctx.fillStyle = "#f2d9b0";
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = "#e0845a";
      ctx.beginPath();
      ctx.arc(ix + iw * 0.5, iy + ih * 0.55, 6, 0, Math.PI * 2);
      ctx.fill();
      for (const [color, peak, off] of [["#6f8a9a", 0.25, 0], ["#4f6a7a", 0.4, 0.3]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih);
        ctx.lineTo(ix + iw * (0.3 + off * 0.5), iy + ih * peak + 6);
        ctx.lineTo(ix + iw * (0.6 + off * 0.3), iy + ih * (0.55 + off * 0.2));
        ctx.lineTo(ix + iw * (0.85 - off * 0.2), iy + ih * peak + 2);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#f5c6a8"; // "cat": a cute cat face on peach
      ctx.fillRect(ix, iy, iw, ih);
      const cx = ix + iw / 2, cy = iy + ih / 2 + 2;
      ctx.fillStyle = "#3a3a40";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.lineTo(cx - 6, cy - 12);
      ctx.lineTo(cx - 2, cy - 6);
      ctx.moveTo(cx + 8, cy - 4);
      ctx.lineTo(cx + 6, cy - 12);
      ctx.lineTo(cx + 2, cy - 6);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2d45c";
      ctx.beginPath();
      ctx.arc(cx - 3.5, cy - 1, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 3.5, cy - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Hung on a wall face: a little shelf with a pothos plant trailing down.
  pothosShelf(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 12;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 2, w, 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x, y, w, 3.5);
    const cx = x + w / 2;
    ctx.fillStyle = "#ece6dc";
    ctx.fillRect(cx - 6, y - 8, 12, 8);
    drawIvySprig(ctx, cx - 5, y - 3, 22, -1);
    drawIvySprig(ctx, cx + 5, y - 3, 26, 1);
    drawIvySprig(ctx, cx, y - 2, 16, 1);
    ctx.fillStyle = "#4f7a3a";
    ctx.beginPath();
    ctx.arc(cx - 3, y - 10, 4, 0, Math.PI * 2);
    ctx.arc(cx + 3, y - 11, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall face: a soft glowing neon sign that says "cozy".
  neonSign(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, cy = a.y - WALL_HEIGHT + 17;
    const flicker = 0.85 + Math.sin(performance.now() / 300) * 0.05;
    ctx.save();
    ctx.font = "700 15px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 120, 190, 0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255, 170, 215, ${flicker})`;
    ctx.fillText("cozy", cx, cy + 5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 245, 250, 0.8)";
    ctx.fillText("cozy", cx, cy + 5);
    ctx.restore();
  },

  // Hung on a wall face: a world map with a few pins in it.
  worldMap(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 5, h = 24;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#bcd8e6";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "#a8c48a"; // blobby continents
    for (const [fx, fy, rx, ry] of [[0.22, 0.35, 0.12, 0.2], [0.3, 0.72, 0.07, 0.18], [0.52, 0.32, 0.1, 0.15], [0.55, 0.65, 0.08, 0.2], [0.75, 0.4, 0.15, 0.22], [0.85, 0.78, 0.07, 0.1]]) {
      ctx.beginPath();
      ctx.ellipse(x + 2 + fx * (w - 4), y + 2 + fy * (h - 4), rx * (w - 4), ry * (h - 4), 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#c0554a";
    for (const [fx, fy] of [[0.24, 0.32], [0.54, 0.3], [0.78, 0.42]]) {
      ctx.beginPath();
      ctx.arc(x + 2 + fx * (w - 4), y + 2 + fy * (h - 4), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A low coffee table with a mug, a book and a little candle.
  coffeeTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 12, "#8b5e3c");
    const { x, y, w, h } = t.top;
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x + 6, y + h / 2 - 5, 14, 9);
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(x + 7, y + h / 2 - 4, 12, 1.2);
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(x + w / 2 - 3, y + h / 2 - 4, 6, 7);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(x + w / 2 - 2.5, y + h / 2 - 4, 5, 1.5);
    drawCandle(ctx, x + w - 10, y + h / 2 + 3, performance.now() / 1000 + f.x);
  },

  // A record player on a little stand, with the record spinning.
  recordPlayer(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#6b4630");
    ctx.fillStyle = "#e37aa0"; // record sleeves in the stand
    ctx.fillRect(s.face.x + 4, s.face.y + 4, 5, s.face.h - 8);
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(s.face.x + 10, s.face.y + 4, 5, s.face.h - 8);
    const cx = s.top.x + s.top.w / 2 - 3, cy = s.top.y + s.top.h / 2;
    ctx.fillStyle = "#2b2b30"; // the player
    roundRectPath(ctx, cx - 14, cy - 9, 30, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#15151a"; // the record
    ctx.beginPath();
    ctx.ellipse(cx, cy, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const spin = performance.now() / 300;
    ctx.fillStyle = "#c0554a"; // its label, turning
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(cx + Math.cos(spin) * 7 - 1, cy + Math.sin(spin) * 4.5 - 0.5, 2, 1);
    ctx.strokeStyle = "#c9c9d0"; // tone arm
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy - 6);
    ctx.lineTo(cx + 5, cy + 1);
    ctx.stroke();
  },

  // A fish tank on a cabinet: water, plants, bubbles and two little fish.
  fishTank(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#5c3d2a");
    const x = cab.top.x + 2, w = cab.top.w - 4, bottom = cab.top.y + cab.top.h - 2, h = 26, top = bottom - h;
    const water = ctx.createLinearGradient(0, top, 0, bottom);
    water.addColorStop(0, "rgba(140, 200, 230, 0.8)");
    water.addColorStop(1, "rgba(60, 130, 170, 0.85)");
    ctx.fillStyle = water;
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "#e9dcb8"; // sand
    ctx.fillRect(x, bottom - 4, w, 4);
    ctx.strokeStyle = "#4f8a4a"; // water plants
    ctx.lineWidth = 2;
    const t = performance.now() / 1000;
    for (const px of [x + 5, x + w - 7]) {
      ctx.beginPath();
      ctx.moveTo(px, bottom - 3);
      ctx.quadraticCurveTo(px + Math.sin(t * 1.5 + px) * 3, bottom - 12, px + 1, bottom - 18);
      ctx.stroke();
    }
    // Fish you've caught and put in (Update 4), or two little starter fish.
    const caught = Array.isArray(f.fish) && f.fish.length
      ? f.fish.map((id, i) => [CONFIG.fish.find((fish) => fish.id === id)?.color ?? "#f2a03a", 0.3 + ((i * 0.13) % 0.35), 0.25 + ((i * 0.37) % 0.55), i * 1.7])
      : [["#f2a03a", 0.5, 0.4, 0], ["#e37aa0", 0.35, 0.65, 2]];
    for (const [color, speed, row, phase] of caught) {
      const swim = (Math.sin(t * speed + phase) + 1) / 2;
      const fx = x + 6 + swim * (w - 14), fy = top + row * h;
      const dir = Math.cos(t * speed + phase) >= 0 ? 1 : -1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx - dir * 3, fy);
      ctx.lineTo(fx - dir * 6, fy - 2);
      ctx.lineTo(fx - dir * 6, fy + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // bubbles
    for (let i = 0; i < 3; i++) {
      const rise = (t * 0.6 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(x + w * 0.55 + Math.sin(rise * 8) * 1.5, bottom - 4 - rise * (h - 6), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // glass edge and a glint
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x + 2, top + 2, 2, h - 8);
    ctx.fillStyle = "#2b2b30"; // lid
    ctx.fillRect(x - 1, top - 3, w + 2, 3);
  },

  // An upright piano with the keys showing and a candle on top.
  piano(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const back = drawBlock(ctx, f.x, f.y, f.w, 0.3, 46, "#3a2a24");
    const keysBed = drawBlock(ctx, f.x, f.y + 0.3, f.w, f.h - 0.3, 22, "#3a2a24");
    const kx = keysBed.top.x + 3, ky = keysBed.top.y + 2, kw = keysBed.top.w - 6, kh = keysBed.top.h - 4;
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(kx, ky, kw, kh);
    ctx.fillStyle = "#2b2b2b";
    for (let i = 0; i < kw / 4.5; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      ctx.fillRect(kx + 3 + i * 4.5, ky, 2.2, kh * 0.6);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let i = 1; i < kw / 4.5; i++) ctx.fillRect(kx + i * 4.5, ky, 0.5, kh);
    ctx.fillStyle = "#f4ecdc"; // sheet music
    ctx.fillRect(back.face.x + back.face.w / 2 - 10, back.face.y + 8, 20, 13);
    ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
    for (let i = 0; i < 4; i++) ctx.fillRect(back.face.x + back.face.w / 2 - 8, back.face.y + 11 + i * 2.5, 16, 0.6);
    drawCandle(ctx, back.top.x + 8, back.top.y + back.top.h / 2 + 2, performance.now() / 1000 + 3);
  },

  // A rocking chair that gently rocks, with a knitted blanket.
  rockingChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const rock = Math.sin(performance.now() / 700) * 0.06;
    ctx.save();
    ctx.translate(base.x, base.y - 3);
    ctx.rotate(rock);
    ctx.strokeStyle = "#6b4630"; // rockers
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -40, 42, Math.PI * 0.36, Math.PI * 0.64);
    ctx.stroke();
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(-14, -44, 3, 42); // back posts
    ctx.fillRect(11, -44, 3, 42);
    for (let i = 0; i < 4; i++) ctx.fillRect(-11, -42 + i * 7, 22, 2.5); // back slats
    ctx.fillStyle = "#9a6a45"; // seat
    ctx.fillRect(-15, -16, 30, 6);
    ctx.fillStyle = "#c0554a"; // blanket over the back
    ctx.fillRect(-12, -40, 16, 22);
    ctx.fillStyle = "rgba(255, 240, 220, 0.35)";
    for (let i = 0; i < 4; i++) ctx.fillRect(-12, -37 + i * 5, 16, 1.2);
    ctx.restore();
  },

  // A lava lamp with warm blobs slowly floating up and down.
  lavaLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2, t = performance.now() / 1000;
    ctx.fillStyle = "#8a8a94";
    ctx.beginPath();
    ctx.moveTo(cx - 7, by);
    ctx.lineTo(cx + 7, by);
    ctx.lineTo(cx + 4, by - 9);
    ctx.lineTo(cx - 4, by - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120, 60, 140, 0.85)"; // the glass
    ctx.beginPath();
    ctx.moveTo(cx - 4, by - 9);
    ctx.lineTo(cx - 6, by - 26);
    ctx.lineTo(cx - 3, by - 36);
    ctx.lineTo(cx + 3, by - 36);
    ctx.lineTo(cx + 6, by - 26);
    ctx.lineTo(cx + 4, by - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9a5c";
    for (let i = 0; i < 3; i++) {
      const rise = (Math.sin(t * 0.5 + i * 2.1) + 1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(t + i) * 1.2, by - 12 - rise * 20, 2.5 + (i % 2), 3 + (i % 2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#8a8a94";
    ctx.fillRect(cx - 3, by - 39, 6, 3);
  },

  // A retro arcade cabinet with a glowing screen and joystick.
  arcade(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 56, "#3f4f8a");
    const { x, y, w } = cab.face;
    ctx.fillStyle = "#e37aa0"; // marquee
    ctx.fillRect(x + 3, y + 3, w - 6, 7);
    ctx.fillStyle = "#1a1a24"; // screen
    ctx.fillRect(x + 4, y + 13, w - 8, 18);
    const t = performance.now() / 1000;
    ctx.fillStyle = "#6fe0a8";
    ctx.fillRect(x + 6 + ((t * 10) % (w - 16)), y + 20, 3, 3);
    ctx.fillStyle = "#f2d45c";
    ctx.fillRect(x + w - 12, y + 16, 2, 2);
    ctx.fillStyle = "#2b2b30"; // control panel
    ctx.fillRect(x + 2, y + 33, w - 4, 7);
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.arc(x + 8, y + 34, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 36, 1.8, 0, Math.PI * 2);
    ctx.arc(x + w - 5, y + 36, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },

  // A brass telescope on a tripod, pointed at the sky.
  telescope(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const cx = base.x, by = base.y - 2;
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx - 9, by);
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx + 9, by);
    ctx.moveTo(cx, by - 26);
    ctx.lineTo(cx + 2, by - 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, by - 28);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#c9a24a";
    roundRectPath(ctx, -14, -3.5, 28, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#a8832e";
    ctx.fillRect(10, -4.5, 5, 9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(-12, -2.5, 20, 1.2);
    ctx.restore();
  },

  // A globe on a little wooden stand.
  globe(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const s = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#7a5238");
    const cx = s.top.x + s.top.w / 2, cy = s.top.y - 9;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(cx - 1, cy + 6, 2, 6);
    ctx.fillStyle = "#6fa8c8";
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    const turn = (performance.now() / 4000) % 1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#a8c48a";
    for (const [ox, oy, r] of [[0, -3, 4], [0.45, 2, 3], [0.7, -1, 3.5]]) {
      const px = cx - 12 + (((ox + turn) % 1) * 24);
      ctx.beginPath();
      ctx.ellipse(px, cy + oy, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10.5, Math.PI * 0.6, Math.PI * 2.4);
    ctx.stroke();
  },

  // A painted toy chest with a star on the front.
  toyChest(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, "#c0664a");
    ctx.fillStyle = shadeColor("#c0664a", 25); // lid edge
    ctx.fillRect(c.face.x, c.face.y, c.face.w, 3);
    ctx.fillStyle = "#f2d45c";
    const sx = c.face.x + c.face.w / 2, sy = c.face.y + c.face.h / 2 + 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.2 : 5, a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6fa8c8"; // a toy boat poking out
    ctx.fillRect(c.top.x + 6, c.top.y - 4, 10, 4);
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.moveTo(c.top.x + 11, c.top.y - 4);
    ctx.lineTo(c.top.x + 11, c.top.y - 13);
    ctx.lineTo(c.top.x + 17, c.top.y - 6);
    ctx.closePath();
    ctx.fill();
  },

  // A pile of big floor cushions to flop onto.
  floorCushions(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, dy, color] of [[-9, -6, "#6f5a8c"], [8, -5, "#e0a84c"], [0, -13, "#c0664a"]]) {
      const g = ctx.createLinearGradient(0, c.y + dy - 9, 0, c.y + dy + 6);
      g.addColorStop(0, shadeColor(color, 25));
      g.addColorStop(1, shadeColor(color, -20));
      ctx.fillStyle = g;
      roundRectPath(ctx, c.x + dx - 13, c.y + dy - 7, 26, 12, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // button
      ctx.beginPath();
      ctx.arc(c.x + dx, c.y + dy - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A cluster of candles of different heights on a little tray.
  candles(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const t = performance.now() / 1000;
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 3, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, hgt, phase] of [[-6, 14, 0], [1, 20, 1.3], [7, 10, 2.6]]) {
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(c.x + dx - 2.5, c.y - 4 - hgt, 5, hgt);
      drawCandle(ctx, c.x + dx, c.y - 4 - hgt + 7, t + phase);
    }
  },

  // Stacks of books on the floor, one with a mug on top.
  bookStacks(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const colors = ["#c0554a", "#3f6f9f", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a"];
    for (const [dx, count] of [[-8, 5], [7, 3]]) {
      for (let i = 0; i < count; i++) {
        const bw = 16 - (i % 3) * 2;
        ctx.fillStyle = colors[(i + count) % colors.length];
        ctx.fillRect(c.x + dx - bw / 2 + ((i * 7) % 3) - 1, c.y - 5 - i * 4.5, bw, 4);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(c.x + dx - bw / 2 + ((i * 7) % 3), c.y - 4 - i * 4.5, bw - 3, 0.8);
      }
    }
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(c.x + 4, c.y - 22, 6, 7);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(c.x + 4.5, c.y - 22, 5, 1.5);
  },

  // --- The cozy plant collection ---

  // ZZ plant: upright stems lined with glossy little leaves.
  zzPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "cement", 10, 15);
    for (const [dx, lean, len] of [[-5, -0.25, 34], [-1, -0.08, 42], [3, 0.1, 38], [7, 0.3, 30]]) {
      const tipX = b.x + dx + Math.sin(lean) * len, tipY = soil - Math.cos(lean) * len;
      ctx.strokeStyle = "#4f7a3a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x + dx * 0.4, soil);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      for (let t = 0.3; t <= 1; t += 0.14) {
        const px = b.x + dx * 0.4 + (tipX - b.x - dx * 0.4) * t, py = soil + (tipY - soil) * t;
        drawLeaf(ctx, px, py, lean - 0.9, 7, 2.6, "#2f5a2f", "rgba(255,255,255,0.25)");
        drawLeaf(ctx, px, py, lean + 0.9, 7, 2.6, "#3d6b3a", "rgba(255,255,255,0.25)");
      }
    }
  },

  // Pilea (the Chinese money plant): round coin leaves on thin stems.
  pilea(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 8, 12);
    const leaves = [[-14, -14, 4.5], [13, -16, 4.8], [-8, -26, 5], [9, -28, 4.6], [0, -34, 5.2], [-15, -30, 3.8], [16, -30, 4], [2, -20, 4.2]];
    for (const [dx, dy, r] of leaves) {
      ctx.strokeStyle = "#6f9a4a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x, soil - 4);
      ctx.quadraticCurveTo(b.x + dx * 0.3, soil + dy * 0.6, b.x + dx, soil + dy);
      ctx.stroke();
      ctx.fillStyle = r > 4.7 ? "#5f9a4a" : "#6fae55";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Calathea: wide leaves with feathery stripes, in a pink pot.
  calathea(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "pink", 10, 15);
    for (const [angle, len] of [[-0.9, 24], [-0.45, 30], [0, 32], [0.45, 29], [0.9, 23]]) {
      drawLeaf(ctx, b.x, soil, angle, len, 9, "#4f7a48", null);
      ctx.save();
      ctx.translate(b.x, soil);
      ctx.rotate(angle);
      ctx.strokeStyle = "#a8c88a"; // feathery stripes
      ctx.lineWidth = 1.2;
      for (let t = 0.25; t < 0.9; t += 0.13) {
        ctx.beginPath();
        ctx.moveTo(0, -len * t);
        ctx.lineTo(-4, -len * t - 3);
        ctx.moveTo(0, -len * t);
        ctx.lineTo(4, -len * t - 3);
        ctx.stroke();
      }
      ctx.strokeStyle = "#c9708a"; // pink midrib
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -len + 3);
      ctx.stroke();
      ctx.restore();
    }
  },

  // Bird of paradise: tall stems with huge paddle leaves, in a basket.
  birdOfParadise(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "basket", 12, 17);
    for (const [dx, lean, stem, color] of [[-4, -0.35, 30, "#3d6b40"], [4, 0.3, 34, "#3d6b40"], [0, -0.05, 44, "#4a7a48"], [-2, 0.55, 22, "#2f5a36"], [2, -0.7, 20, "#2f5a36"]]) {
      const topX = b.x + dx + Math.sin(lean) * stem, topY = soil - Math.cos(lean) * stem;
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x + dx * 0.3, soil);
      ctx.lineTo(topX, topY);
      ctx.stroke();
      drawLeaf(ctx, topX, topY + 2, lean, 26, 9, color);
      ctx.save(); // splits in the leaf edge
      ctx.translate(topX, topY + 2);
      ctx.rotate(lean);
      ctx.strokeStyle = "rgba(20, 40, 20, 0.45)";
      ctx.lineWidth = 0.8;
      for (const t of [0.35, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(6, -26 * t);
        ctx.lineTo(2, -26 * t - 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  // An olive tree: a slim trunk and a silvery cloud of little leaves.
  oliveTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 11, 20);
    ctx.strokeStyle = "#7a6a52";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.quadraticCurveTo(b.x - 4, soil - 20, b.x + 1, soil - 38);
    ctx.stroke();
    for (let i = 0; i < 46; i++) {
      const a = noise(i * 2.7) * Math.PI * 2, r = 5 + noise(i * 5.3) * 14;
      drawLeaf(ctx, b.x + Math.cos(a) * r, soil - 50 + Math.sin(a) * r * 0.75, a + 1.2, 6, 1.6, ["#8fa88a", "#a8b89a", "#7a9474"][i % 3], null);
    }
    ctx.fillStyle = "#3a3040";
    for (const [dx, dy] of [[-6, -46], [5, -52], [9, -44]]) {
      ctx.beginPath();
      ctx.ellipse(b.x + dx, soil + dy, 1.3, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A peace lily: dark glossy leaves and white flowers.
  peaceLily(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    for (const [angle, len] of [[-1.0, 20], [-0.6, 26], [-0.2, 24], [0.25, 26], [0.65, 25], [1.0, 19]]) drawLeaf(ctx, b.x, soil, angle, len, 6, angle % 0.5 ? "#2f5a36" : "#3d6b40");
    for (const [dx, h] of [[-5, 34], [4, 38], [0, 30]]) {
      ctx.strokeStyle = "#5f8a4a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.lineTo(b.x + dx, soil - h + 6);
      ctx.stroke();
      ctx.fillStyle = "#fdfbf5";
      ctx.beginPath();
      ctx.moveTo(b.x + dx, soil - h + 6);
      ctx.quadraticCurveTo(b.x + dx - 5, soil - h, b.x + dx, soil - h - 4);
      ctx.quadraticCurveTo(b.x + dx + 5, soil - h, b.x + dx, soil - h + 6);
      ctx.fill();
      ctx.fillStyle = "#f2e08a";
      ctx.fillRect(b.x + dx - 0.7, soil - h - 1, 1.4, 5);
    }
  },

  // A rubber plant: big, dark, shiny burgundy leaves up a central stem.
  rubberPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "cement", 10, 16);
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.lineTo(b.x, soil - 46);
    ctx.stroke();
    [[-1, -10], [1, -18], [-1, -26], [1, -33], [-1, -40], [0, -48]].forEach(([side, dy], i) => {
      const angle = side === 0 ? 0 : side * 1.0;
      drawLeaf(ctx, b.x, soil + dy, angle, 15, 6, i % 2 ? "#3a2a35" : "#4a2e3a", "rgba(255, 200, 200, 0.25)");
    });
  },

  // Aloe vera: thick spiky leaves with little white speckles.
  aloeVera(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    for (const [angle, len] of [[-1.1, 18], [-0.6, 24], [-0.2, 27], [0.25, 26], [0.7, 22], [1.1, 17]]) {
      drawLeaf(ctx, b.x, soil, angle, len, 4, "#7fae8a", null);
      ctx.save();
      ctx.translate(b.x, soil);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let t = 0.25; t < 0.8; t += 0.15) ctx.fillRect(-1, -len * t, 1.2, 1.2);
      ctx.restore();
    }
  },

  // Alocasia: tall stems with arrow-shaped leaves and bright white veins.
  alocasia(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "black", 10, 16);
    for (const [dx, h, tilt] of [[-8, 34, -0.5], [7, 40, 0.45], [0, 48, 0.05]]) {
      const lx = b.x + dx, ly = soil - h;
      ctx.strokeStyle = "#6f8a4a";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.lineTo(lx, ly + 4);
      ctx.stroke();
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(tilt);
      ctx.fillStyle = "#26402c";
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e8f0e0";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(0, -11);
      for (const t of [-8, -3, 2]) {
        ctx.moveTo(0, t);
        ctx.lineTo(5, t + 5);
        ctx.moveTo(0, t);
        ctx.lineTo(-5, t + 5);
      }
      ctx.stroke();
      ctx.restore();
    }
  },

  // A pink orchid: two broad leaves, a stake and an arching spray of flowers.
  orchid(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 8, 13);
    drawLeaf(ctx, b.x, soil, -1.2, 13, 5, "#3d6b40");
    drawLeaf(ctx, b.x, soil, 1.15, 12, 5, "#2f5a36");
    ctx.strokeStyle = "#8b6b4a"; // stake
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 1, soil);
    ctx.lineTo(b.x + 1, soil - 36);
    ctx.stroke();
    ctx.strokeStyle = "#6f7a4a";
    ctx.beginPath();
    ctx.moveTo(b.x + 1, soil - 30);
    ctx.quadraticCurveTo(b.x + 8, soil - 42, b.x + 16, soil - 32);
    ctx.stroke();
    for (const [px, py] of [[b.x + 2, soil - 34], [b.x + 7, soil - 38], [b.x + 12, soil - 37], [b.x + 16, soil - 32]]) {
      ctx.fillStyle = "#f2b8d0";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(a) * 2.2, py + Math.sin(a) * 2.2, 2.2, 1.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#c0406a";
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A pot of lavender: slim stems topped with purple flower spikes.
  lavenderPot(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    for (let i = 0; i < 13; i++) {
      const angle = (i - 6) * 0.1, len = 22 + (i % 3) * 4;
      const tx = b.x + Math.sin(angle) * len, ty = soil - Math.cos(angle) * len;
      ctx.strokeStyle = "#8fa87a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(b.x + (i - 6) * 0.6, soil);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? "#9a7ac0" : "#b69ad8";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(tx, ty + k * 2, 1.5, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A long wooden planter of kitchen herbs: basil, rosemary and mint.
  herbGarden(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x, f.y, f.w, f.h, 11, "#a8783e");
    const x = box.top.x, y = box.top.y + box.top.h / 2, w = box.top.w;
    for (let i = 0; i < 9; i++) drawLeaf(ctx, x + w * 0.2 + (i % 3) * 3 - 3, y, (i - 4) * 0.35, 9, 4, "#5f9a55");
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = "#4f6a4a";
      ctx.lineWidth = 1;
      const px = x + w * 0.5 + (i - 4) * 1.6;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + (i - 4) * 0.8, y - 14 - (i % 3) * 3);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) drawHeartLeaf(ctx, x + w * 0.8 + (i % 3) * 4 - 4, y - 4 - Math.floor(i / 3) * 5, 3, i % 2 ? "#7fbf6a" : "#6fae55");
    ctx.fillStyle = "#f4ecdc"; // little labels
    for (const fx of [0.2, 0.5, 0.8]) ctx.fillRect(x + w * fx - 3, box.face.y + 3, 6, 4);
  },

  // Fluffy pampas grass plumes in a tall stone vase.
  pampasVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "stone");
    for (const [angle, len, color] of [[-0.45, 34, "#e8dcc2"], [-0.15, 42, "#f2e8d4"], [0.2, 38, "#ecdcbf"], [0.5, 30, "#f2e8d4"]]) {
      const tx = b.x + Math.sin(angle) * len, ty = top - Math.cos(angle) * len;
      ctx.strokeStyle = "#b8a888";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 2);
      ctx.lineTo(tx, ty + 8);
      ctx.stroke();
      ctx.fillStyle = color;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(tx + Math.sin(angle) * k * 1.5, ty + k * 2.5, 4, 5, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Pink tulips in a glass vase.
  tulipVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "glass");
    for (const [dx, h, color] of [[-7, 18, "#f2a0b8"], [0, 22, "#f7c0d0"], [6, 17, "#e880a0"], [-3, 14, "#fbd0dc"]]) {
      ctx.strokeStyle = "#6f9a4a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 8);
      ctx.lineTo(b.x + dx, top - h + 4);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(b.x + dx - 3.5, top - h + 1);
      ctx.lineTo(b.x + dx - 3.5, top - h - 4);
      ctx.lineTo(b.x + dx - 1.5, top - h - 2);
      ctx.lineTo(b.x + dx, top - h - 5);
      ctx.lineTo(b.x + dx + 1.5, top - h - 2);
      ctx.lineTo(b.x + dx + 3.5, top - h - 4);
      ctx.lineTo(b.x + dx + 3.5, top - h + 1);
      ctx.quadraticCurveTo(b.x + dx, top - h + 5, b.x + dx - 3.5, top - h + 1);
      ctx.fill();
    }
    drawLeaf(ctx, b.x - 1, top + 6, -0.5, 12, 3, "#5f8a4a");
  },

  // Three sunflowers in a yellow jug.
  sunflowerVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "jug");
    for (const [dx, h, r] of [[-8, 16, 6], [2, 22, 7], [9, 14, 5.5]]) {
      const cx = b.x + dx, cy = top - h;
      ctx.strokeStyle = "#5f8a3a";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(b.x, top + 3);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = "#f2c230";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, r * 0.45, r * 0.2, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#6b4226";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Eucalyptus stems with round silvery leaves in an amber bud vase.
  eucalyptusVase(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "amber");
    for (const [angle, len] of [[-0.35, 30], [0.05, 36], [0.4, 28]]) {
      const tx = b.x + Math.sin(angle) * len, ty = top - Math.cos(angle) * len;
      ctx.strokeStyle = "#8a7a6a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x, top);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      for (let t = 0.2; t <= 1; t += 0.16) {
        const px = b.x + (tx - b.x) * t, py = top + (ty - top) * t;
        ctx.fillStyle = t > 0.6 ? "#a8c0b0" : "#8fae9e";
        ctx.beginPath();
        ctx.arc(px - 3, py, 2.4, 0, Math.PI * 2);
        ctx.arc(px + 3, py - 1, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A cherry blossom branch in a tall cream vase.
  cherryBlossom(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const top = drawVase(ctx, b.x, b.y - 2, "cream");
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 1.6;
    const twigs = [[b.x, top, b.x - 10, top - 26], [b.x - 5, top - 13, b.x - 18, top - 22], [b.x, top, b.x + 8, top - 34], [b.x + 4, top - 17, b.x + 16, top - 24], [b.x + 7, top - 28, b.x + 2, top - 42]];
    for (const [x1, y1, x2, y2] of twigs) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const [x1, y1, x2, y2] = twigs[i % twigs.length];
      const t = 0.35 + noise(i * 4.7) * 0.65;
      ctx.fillStyle = i % 3 ? "#f7c6d6" : "#fbe0ea";
      ctx.beginPath();
      ctx.arc(x1 + (x2 - x1) * t + (noise(i) - 0.5) * 4, y1 + (y2 - y1) * t + (noise(i + 9) - 0.5) * 4, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glass terrarium globe with moss, pebbles and tiny plants.
  terrarium(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    roundRectPath(ctx, b.x - 11, b.y - 6, 22, 5, 2);
    ctx.fill();
    const cy = b.y - 17;
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, cy, 12, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(210, 235, 240, 0.35)";
    ctx.fillRect(b.x - 12, cy - 12, 24, 24);
    ctx.fillStyle = "#c9b089"; // sand and pebbles
    ctx.fillRect(b.x - 12, cy + 5, 24, 7);
    ctx.fillStyle = "#6fae55"; // moss
    ctx.beginPath();
    ctx.ellipse(b.x - 3, cy + 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a9a94";
    ctx.beginPath();
    ctx.arc(b.x + 6, cy + 6, 2, 0, Math.PI * 2);
    ctx.arc(b.x + 2, cy + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    drawLeaf(ctx, b.x - 4, cy + 4, -0.3, 10, 3, "#4f8a4a");
    drawLeaf(ctx, b.x - 2, cy + 4, 0.4, 8, 3, "#5f9a55");
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - 4, cy - 5, 5, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  },

  // A money tree: a braided trunk topped with fans of leaves.
  moneyTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "glazed", 10, 15);
    ctx.strokeStyle = "#8a6a4a"; // the braid
    ctx.lineWidth = 2;
    for (const phase of [0, 2.1, 4.2]) {
      ctx.beginPath();
      for (let y = 0; y <= 30; y += 2) ctx.lineTo(b.x + Math.sin(y * 0.35 + phase) * 2.5, soil - y);
      ctx.stroke();
    }
    for (const [dx, dy] of [[-10, -38], [9, -40], [0, -48], [-4, -32], [6, -31]]) {
      for (let i = -2; i <= 2; i++) drawLeaf(ctx, b.x + dx * 0.5, soil + dy + 6, i * 0.45 + dx * 0.04, 12, 3.2, i % 2 ? "#4f8a4a" : "#5f9a55");
    }
  },

  // A jade plant: a chunky little tree with round, fleshy leaves.
  jadePlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "clay", 10, 13);
    ctx.strokeStyle = "#7a6a4a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, soil);
    ctx.lineTo(b.x, soil - 12);
    ctx.lineTo(b.x - 9, soil - 22);
    ctx.moveTo(b.x, soil - 12);
    ctx.lineTo(b.x + 8, soil - 24);
    ctx.stroke();
    for (const [cx, cy] of [[b.x - 9, soil - 24], [b.x + 8, soil - 26], [b.x, soil - 18]]) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.fillStyle = "#5f9a55";
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4, 3.2, 2.4, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 80, 80, 0.5)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  },

  // A spider plant: arching striped leaves, with babies dangling down.
  spiderPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    for (let i = -6; i <= 6; i++) {
      const angle = i * 0.22, len = 22 - Math.abs(i);
      const tx = b.x + Math.sin(angle) * len * 1.2, ty = soil - Math.cos(angle) * len + Math.abs(i) * 2.4;
      ctx.strokeStyle = "#5f9a55";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.quadraticCurveTo(b.x + Math.sin(angle) * len * 0.5, soil - len, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = "#e8f0d0";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#8fa87a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 8, soil - 6);
      ctx.quadraticCurveTo(b.x + side * 20, soil - 12, b.x + side * 20, soil + 6);
      ctx.stroke();
      for (let i = -2; i <= 2; i++) drawLeaf(ctx, b.x + side * 20, soil + 6, i * 0.5, 7, 1.6, "#6fae55", null);
    }
  },

  // A heartleaf philodendron trailing heart-shaped leaves over a pink pot.
  philodendron(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "pink", 10, 15);
    for (const [dx, dy, s, a] of [[-5, -8, 5, -0.3], [5, -10, 5.5, 0.3], [0, -16, 5, 0], [-9, -2, 4.5, -0.6], [9, -3, 4.5, 0.6]]) drawHeartLeaf(ctx, b.x + dx, soil + dy, s, "#4f8a4a", a);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#5f7a3a";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 9, soil);
      ctx.quadraticCurveTo(b.x + side * 14, soil + 8, b.x + side * 12, soil + 16);
      ctx.stroke();
      for (let k = 0; k < 4; k++) drawHeartLeaf(ctx, b.x + side * (12 + (k % 2) * 2), soil + 3 + k * 4, 3.2, k % 2 ? "#5f9a55" : "#4f8a4a", side * 0.4);
    }
  },

  // Hoya finlaysonii: long, pointed leaves with a pale net of veins,
  // trailing over the pot's edge, with round clusters of little pink stars.
  hoyaFinlaysonii(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "ceramic", 10, 15);
    const leaf = (x, y, a, len) => {
      drawLeaf(ctx, x, y, a, len, 3.2, "#3f6a3a", "rgba(215, 235, 170, 0.55)");
      ctx.save(); // the netted veins
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.strokeStyle = "rgba(215, 235, 170, 0.35)";
      ctx.lineWidth = 0.5;
      for (let k = 2; k < len - 2; k += 2.5) {
        ctx.beginPath();
        ctx.moveTo(0, -k);
        ctx.lineTo(-2, -k - 1.5);
        ctx.moveTo(0, -k);
        ctx.lineTo(2, -k - 1.5);
        ctx.stroke();
      }
      ctx.restore();
    };
    for (const [dx, a, len] of [[-3, -0.45, 19], [3, 0.4, 20], [0, -0.05, 22], [-6, -0.85, 16], [6, 0.85, 16], [-2, -0.2, 14], [2, 0.2, 15]]) leaf(b.x + dx, soil, a, len);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = "#6b7a3a"; // vines trailing down
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x + side * 8, soil);
      ctx.quadraticCurveTo(b.x + side * 14, soil + 6, b.x + side * 12, soil + 18);
      ctx.stroke();
      for (let k = 0; k < 3; k++) leaf(b.x + side * 12.5, soil + 6 + k * 5, side * (2.4 + k * 0.1), 8);
    }
    for (const [dx, dy] of [[-9, -17], [9, -14]]) {
      for (let s = 0; s < 7; s++) {
        const a = (s / 7) * Math.PI * 2;
        ctx.fillStyle = "#f2c4d0";
        ctx.beginPath();
        ctx.arc(b.x + dx + Math.cos(a) * 2.6, soil + dy + Math.sin(a) * 2.6, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#c0556e";
      ctx.beginPath();
      ctx.arc(b.x + dx, soil + dy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Monstera adansonii (Swiss cheese vine): small leaves full of oval
  // holes, climbing a mossy pole.
  monsteraAdansonii(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "basket", 11, 15);
    ctx.fillStyle = "#6f7a4a"; // the moss pole
    ctx.fillRect(b.x - 2, soil - 38, 4, 38);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(b.x - 2, soil - 38, 1.5, 38);
    const leaf = (x, y, a, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = "#3f8a4a";
      ctx.beginPath();
      ctx.ellipse(0, -s, s * 0.62, s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)"; // lit from above
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 1.3, s * 0.3, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9dcc2"; // the holes (showing the wall's light behind)
      ctx.globalAlpha = 0.85;
      for (const [hx, hy] of [[-0.3, -0.6], [0.3, -0.9], [-0.28, -1.3], [0.28, -1.5]]) {
        ctx.beginPath();
        ctx.ellipse(hx * s, hy * s, s * 0.12, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };
    for (let k = 0; k < 5; k++) {
      const side = k % 2 ? 1 : -1;
      leaf(b.x + side * 2, soil - 4 - k * 7.5, side * 1.0, 7);
    }
    leaf(b.x, soil - 38, 0, 6); // the newest leaf at the top
    for (const side of [-1, 1]) leaf(b.x + side * 8, soil + 2, side * 2.3, 6); // a couple spilling over the pot
  },

  // Anthurium: glossy heart-shaped leaves and waxy flowers (a heart-shaped
  // bract with a little spike), red or pink (f.color).
  anthurium(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, f.color === "#e84a5a" ? "black" : "ceramic", 10, 15);
    ctx.strokeStyle = "#4f7a3a";
    ctx.lineWidth = 1;
    const stems = [[-8, -18, "leaf", -0.3], [8, -20, "leaf", 0.3], [0, -26, "leaf", 0], [-4, -30, "flower", -0.2], [6, -32, "flower", 0.25], [-10, -10, "leaf", -0.6], [10, -11, "leaf", 0.6]];
    for (const [dx, dy] of stems) {
      ctx.beginPath();
      ctx.moveTo(b.x, soil);
      ctx.quadraticCurveTo(b.x + dx * 0.3, soil + dy * 0.5, b.x + dx, soil + dy);
      ctx.stroke();
    }
    for (const [dx, dy, kind, a] of stems) {
      if (kind === "leaf") {
        drawHeartLeaf(ctx, b.x + dx, soil + dy + 3.5, 7, "#2f6a3a", a); // hangs from its notch, tip down
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // glossy shine
        ctx.beginPath();
        ctx.ellipse(b.x + dx - 2, soil + dy + 1.5, 1.2, 2.5, a, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawHeartLeaf(ctx, b.x + dx, soil + dy + 2.5, 5.5, f.color, a);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.ellipse(b.x + dx - 1.5, soil + dy + 1, 1, 2, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f2d07a"; // the little spike
        ctx.save();
        ctx.translate(b.x + dx, soil + dy - 1);
        ctx.rotate(a + 0.5);
        ctx.fillRect(-0.9, -7, 1.8, 7);
        ctx.restore();
      }
    }
  },

  // Hoya polyneura (the fishtail hoya), hung on the wall in a white pot:
  // long, thin, pointed leaves with dark "fishbone" veins, trailing down.
  hoyaPolyneura(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 3;
    ctx.strokeStyle = "#5c4530"; // hanging cords
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const dx of [-7, 0, 7]) {
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + dx, top + 10);
    }
    ctx.stroke();
    const leaf = (x, y, angle, len) => {
      drawLeaf(ctx, x, y, angle, len, 3.4, "#6aa85a", null);
      ctx.save(); // the fishbone veins
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = "rgba(40, 80, 30, 0.45)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(0, -len + 1.5);
      for (let k = 2.5; k < len - 2; k += 2.8) {
        ctx.moveTo(0, -k);
        ctx.lineTo(-1.6, -k - 1.2);
        ctx.moveTo(0, -k);
        ctx.lineTo(1.6, -k - 1.2);
      }
      ctx.stroke();
      ctx.restore();
    };
    // Leaves trailing down from the pot on both sides, then a few upright ones.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) leaf(cx + side * (6 + k * 1.5), top + 14 + k * 4, side * (2.3 + k * 0.12), 9);
    }
    ctx.fillStyle = "#f2ede4"; // the pot
    ctx.beginPath();
    ctx.moveTo(cx - 8, top + 10);
    ctx.lineTo(cx + 8, top + 10);
    ctx.lineTo(cx + 6, top + 18);
    ctx.lineTo(cx - 6, top + 18);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(cx - 6.5, top + 16, 13, 2);
    for (const [dx, ang] of [[-3, -0.4], [0, 0], [3, 0.4], [-5, -0.8], [5, 0.8]]) leaf(cx + dx, top + 11, ang, 10);
  },

  // Hoya carnosa 'Compacta' (Hindu rope): ropes of curled, twisted waxy
  // leaves spilling over a pot, with a cluster of pink star flowers.
  hoyaCompacta(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const soil = drawPot(ctx, b.x, b.y - 2, "glazed", 10, 14);
    // A rope: a chain of curled leaves along a curve.
    const rope = (x0, y0, x1, y1, bend) => {
      const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2.6));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
        const y = y0 + (y1 - y0) * t;
        const tilt = (k % 2 ? 0.7 : -0.7) + t; // curled leaves, turning this way and that
        ctx.fillStyle = k % 2 ? "#4f8a4a" : "#5f9a55";
        ctx.strokeStyle = "#2f5a32";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4, 1.7, tilt, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(230, 245, 210, 0.45)"; // the waxy curl catching the light
        ctx.beginPath();
        ctx.ellipse(x, y, 1.4, 0.8, tilt, Math.PI, Math.PI * 1.8);
        ctx.stroke();
      }
    };
    rope(b.x - 5, soil - 1, b.x - 12, soil + 19, -2); // ropes spilling over the sides
    rope(b.x - 2, soil, b.x - 7, soil + 14, -3);
    rope(b.x + 5, soil - 1, b.x + 13, soil + 17, 2);
    rope(b.x + 2, soil, b.x + 8, soil + 12, 3);
    rope(b.x - 1, soil - 1, b.x - 5, soil - 13, -2); // a couple arching up
    rope(b.x + 2, soil - 1, b.x + 5, soil - 11, 2);
    const fx = b.x + 7, fy = soil - 13; // a cluster of pink star flowers
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      ctx.fillStyle = "#f4c6d2";
      ctx.beginPath();
      ctx.arc(fx + Math.cos(ang) * 3, fy + Math.sin(ang) * 2.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#b8405e";
    ctx.beginPath();
    ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hung on a wall: a macramé hanger holding a golden pothos, trailing down.
  macramePothos(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 2;
    ctx.fillStyle = "#6b4a2e"; // hook
    ctx.fillRect(cx - 1, top, 2, 3);
    ctx.strokeStyle = "#e9dcc2"; // knotted cords
    ctx.lineWidth = 1.2;
    for (const dx of [-7, -3, 3, 7]) {
      ctx.beginPath();
      ctx.moveTo(cx, top + 3);
      ctx.lineTo(cx + dx, top + 16);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9dcc2";
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(cx + dx * 0.8, top + 12, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ece6dc"; // the pot
    roundRectPath(ctx, cx - 7, top + 15, 14, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#e9dcc2"; // tassel
    ctx.fillRect(cx - 1, top + 24, 2, 6);
    for (const [dx, len, lean] of [[-6, 24, -1], [6, 20, 1], [-2, 14, 1]]) {
      ctx.strokeStyle = "#6f8a3a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + dx, top + 16);
      ctx.quadraticCurveTo(cx + dx + lean * 4, top + 16 + len * 0.5, cx + dx + lean * 2, top + 16 + len);
      ctx.stroke();
      for (let k = 0; k < len / 4; k++) drawHeartLeaf(ctx, cx + dx + lean * (k % 2 ? 3 : 1), top + 18 + k * 4, 2.5, k % 2 ? "#a8c860" : "#6f9a4a", lean * 0.4);
    }
    for (const dx of [-4, 0, 4]) drawHeartLeaf(ctx, cx + dx, top + 13, 3, "#8fb850");
  },

  // Hung on a wall: string of pearls, little green beads spilling down.
  stringOfPearls(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 4;
    ctx.strokeStyle = "#8a6a4a";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - 6, top + 8);
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + 6, top + 8);
    ctx.stroke();
    ctx.fillStyle = "#c9b089"; // a little bowl
    ctx.beginPath();
    ctx.ellipse(cx, top + 10, 8, 4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(cx - 8, top + 8, 16, 2);
    for (const [dx, len] of [[-6, 22], [-2, 28], [2, 18], [6, 25], [0, 12]]) {
      ctx.strokeStyle = "rgba(90, 120, 60, 0.6)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + dx, top + 11);
      ctx.lineTo(cx + dx + Math.sin(dx) * 1.5, top + 11 + len);
      ctx.stroke();
      ctx.fillStyle = "#7fbf6a";
      for (let y = 3; y < len; y += 2.6) {
        ctx.beginPath();
        ctx.arc(cx + dx + Math.sin(dx + y * 0.3) * 1.2, top + 11 + y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Hung on a wall: a hanging basket with a fern spilling over.
  hangingFern(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, top = a.y - WALL_HEIGHT + 3;
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx - 8, top + 12);
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + 8, top + 12);
    ctx.stroke();
    ctx.fillStyle = "#b08a50";
    ctx.beginPath();
    ctx.ellipse(cx, top + 13, 9, 5, 0, 0, Math.PI);
    ctx.fill();
    for (let i = -4; i <= 4; i++) {
      const angle = Math.PI / 2 + i * 0.35 + (i < 0 ? 0.6 : -0.6) * 0;
      const tx = cx + i * 4, ty = top + 14 + (6 - Math.abs(i)) * 3.5;
      ctx.strokeStyle = ["#3f6b3c", "#4f7a48", "#5f8a50"][(i + 9) % 3];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + i * 1.2, top + 11);
      ctx.quadraticCurveTo(cx + i * 3, top + 6, tx, ty);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      for (let t = 0.3; t < 1; t += 0.2) {
        const px = cx + i * 1.2 + (tx - cx - i * 1.2) * t, py = top + 11 + (ty - top - 11) * t - Math.sin(t * Math.PI) * 5;
        ctx.beginPath();
        ctx.ellipse(px, py, 2.2, 1, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Hung on a wall: a little wooden rack holding three air plants.
  airPlants(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22, "#b08a60");
    for (const fx of [0.22, 0.5, 0.78]) {
      const cx = shelf.x + shelf.w * fx, cy = shelf.y - 2;
      ctx.fillStyle = "#e9dcc2"; // a tiny holder
      ctx.fillRect(cx - 3, cy - 2, 6, 2);
      for (let i = -3; i <= 3; i++) drawLeaf(ctx, cx, cy - 1, i * 0.4, 9, 1.4, i % 2 ? "#a8c0a0" : "#8fae9e", null);
    }
  },

  // --- Shelves ---

  // Hung on a wall: a floating shelf of books, with a little candle.
  floatingBooks(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22);
    drawBookRow(ctx, shelf.x + 3, shelf.y, shelf.w * 0.7, 1);
    drawCandle(ctx, shelf.x + shelf.w - 8, shelf.y, performance.now() / 1000 + f.x, true);
  },

  // Hung on a wall: a shelf of candles and a little framed photo.
  candleShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 24, "#e9dcc2");
    const t = performance.now() / 1000;
    ctx.fillStyle = "#c9a24a"; // frame
    ctx.fillRect(shelf.x + 4, shelf.y - 12, 10, 12);
    ctx.fillStyle = "#f7d0da";
    ctx.fillRect(shelf.x + 5.5, shelf.y - 10.5, 7, 9);
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.arc(shelf.x + 9, shelf.y - 6, 2, 0, Math.PI * 2);
    ctx.fill();
    for (const [fx, h] of [[0.5, 10], [0.66, 14], [0.82, 8]]) {
      const cx = shelf.x + shelf.w * fx;
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(cx - 2.5, shelf.y - h, 5, h);
      drawCandle(ctx, cx, shelf.y - h + 7, t + fx * 5);
    }
  },

  // Hung on a wall: crystals, a moon and a little mushroom friend.
  crystalShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 22, "#b08a60");
    const y = shelf.y;
    for (const [fx, h, color] of [[0.18, 10, "#b69ad8"], [0.3, 7, "#f2b8d0"], [0.4, 12, "#c9e0f0"]]) {
      const cx = shelf.x + shelf.w * fx;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y);
      ctx.lineTo(cx - 2, y - h + 2);
      ctx.lineTo(cx, y - h);
      ctx.lineTo(cx + 2, y - h + 2);
      ctx.lineTo(cx + 3, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(cx - 1, y - h + 3, 1, h - 5);
    }
    const mx = shelf.x + shelf.w * 0.6; // crescent moon
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(mx, y - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b08a60";
    ctx.beginPath();
    ctx.arc(mx + 2.5, y - 8, 4.2, 0, Math.PI * 2);
    ctx.fill();
    const sx = shelf.x + shelf.w * 0.82; // mushroom
    ctx.fillStyle = "#f4ecdc";
    ctx.fillRect(sx - 1.5, y - 5, 3, 5);
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.ellipse(sx, y - 6, 5, 3.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(sx - 3, y - 8, 1.3, 1.3);
    ctx.fillRect(sx + 1, y - 9, 1.3, 1.3);
  },

  // Hung on a wall: tea tins on a shelf, with mugs on hooks underneath.
  teaShelf(ctx, f) {
    const shelf = drawWallShelf(ctx, f, 16);
    let x = shelf.x + 4;
    for (const color of ["#4f7a48", "#c0554a", "#d9a441", "#5f7a8c"]) {
      if (x > shelf.x + shelf.w - 10) break;
      ctx.fillStyle = color;
      roundRectPath(ctx, x, shelf.y - 10, 7, 10, 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(x + 1, shelf.y - 7, 5, 3);
      x += 9;
    }
    for (const [fx, color] of [[0.25, "#f2ece2"], [0.5, "#f2b8c4"], [0.75, "#a8c8e0"]]) {
      const mx = shelf.x + shelf.w * fx;
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(mx - 0.5, shelf.y + 3, 1, 3);
      ctx.fillStyle = color;
      roundRectPath(ctx, mx - 4, shelf.y + 6, 8, 8, 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(mx + 4.5, shelf.y + 10, 2.2, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  },

  // A ladder shelf leaning on the wall, with a blanket, books and a plant.
  ladderShelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    const w = f.w * TILE, x = b.x, by = b.y - 2;
    ctx.fillStyle = "#b08a60"; // rails
    ctx.fillRect(x + 2, by - 62, 3, 62);
    ctx.fillRect(x + w - 5, by - 62, 3, 62);
    const rungs = [by - 12, by - 28, by - 44, by - 58];
    for (const [i, ry] of rungs.entries()) {
      const inset = i * 1.5;
      ctx.fillStyle = "#c9a57e";
      ctx.fillRect(x + 2 + inset, ry, w - 4 - inset * 2, 3);
    }
    ctx.fillStyle = "#e8b8a0"; // a blanket draped over the bottom rung
    ctx.fillRect(x + 6, rungs[0] - 2, w - 12, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 6, rungs[0] + 1 + i * 3, w - 12, 1);
    drawBookRow(ctx, x + 6, rungs[1], w * 0.45, 3);
    drawPot(ctx, x + w * 0.5, rungs[2], "clay", 5, 7);
    drawIvySprig(ctx, x + w * 0.5 - 3, rungs[2] - 7, 14, -1);
    drawIvySprig(ctx, x + w * 0.5 + 3, rungs[2] - 7, 10, 1);
    ctx.fillStyle = "#f2d45c"; // a little candle up top
    ctx.fillRect(x + w * 0.5 - 2, rungs[3] - 6, 4, 6);
  },

  // A wooden crate full of vinyl records.
  recordCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#b08a60");
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)";
    ctx.fillRect(c.face.x, c.face.y + c.face.h / 2, c.face.w, 1.5);
    const colors = ["#e37aa0", "#3f6f9f", "#f2d45c", "#7a9e5c", "#c0554a", "#9a6fb0", "#2b2b30"];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(c.top.x + 3 + i * ((c.top.w - 6) / 7), c.top.y - 8 + (i % 2), (c.top.w - 6) / 7 - 1, 12);
    }
  },

  // --- Decor ---

  // A glowing mushroom lamp, red with white spots.
  mushroomLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#f4ecdc";
    roundRectPath(ctx, b.x - 4, b.y - 16, 8, 14, 3);
    ctx.fill();
    const cap = ctx.createRadialGradient(b.x, b.y - 22, 2, b.x, b.y - 20, 14);
    cap.addColorStop(0, "#ff8a70");
    cap.addColorStop(1, "#c0554a");
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 17, 13, 11, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    for (const [dx, dy, r] of [[-6, -21, 2], [3, -24, 2.4], [7, -19, 1.6], [-1, -18, 1.4]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glowing moon lamp on a little wooden stand.
  moonLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const moon = ctx.createRadialGradient(b.x - 3, b.y - 16, 1, b.x, b.y - 13, 10);
    moon.addColorStop(0, "#fffbe8");
    moon.addColorStop(1, "#f2dca0");
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 170, 110, 0.35)"; // craters
    for (const [dx, dy, r] of [[-3, -15, 2], [3, -11, 1.5], [2, -17, 1]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A tall wavy-edged mirror standing on the floor.
  wavyMirror(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const h = 56, top = b.y - 2 - h;
    const path = (grow) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20, y = top + t * h;
        ctx.lineTo(b.x - 11 - grow + Math.sin(t * Math.PI * 4) * 2, y);
      }
      for (let i = 20; i >= 0; i--) {
        const t = i / 20, y = top + t * h;
        ctx.lineTo(b.x + 11 + grow + Math.sin(t * Math.PI * 4 + 1) * 2, y);
      }
      ctx.closePath();
    };
    path(2.5);
    ctx.fillStyle = "#f2e0c0";
    ctx.fill();
    path(0);
    const glass = ctx.createLinearGradient(b.x - 10, top, b.x + 10, top + h);
    glass.addColorStop(0, "#dfeaf2");
    glass.addColorStop(1, "#b8cad8");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(b.x - 5, top + 8, 2, 18);
    ctx.fillRect(b.x - 1, top + 10, 1.2, 10);
  },

  // A full-length arched mirror leaning on the wall, with a gold frame.
  archMirror(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x, f.y + f.h);
    const w = f.w * TILE, h = 62;
    ctx.fillStyle = "#c9a24a";
    archPath(ctx, b.x + 2, b.y - 2 - h, w - 4, h);
    ctx.fill();
    const glass = ctx.createLinearGradient(b.x, b.y - h, b.x + w, b.y);
    glass.addColorStop(0, "#e4eef4");
    glass.addColorStop(1, "#b8cad8");
    ctx.fillStyle = glass;
    archPath(ctx, b.x + 5, b.y - h + 1, w - 10, h - 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(b.x + 9, b.y - h + 16, 2, 22);
  },

  // Hung on a wall: polaroid photos pegged to a string of warm lights.
  polaroidWall(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 8;
    ctx.strokeStyle = "rgba(90, 70, 50, 0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y + 6, x + w, y);
    ctx.stroke();
    const photos = ["#f2b8c4", "#a8c8e0", "#b9d6a4", "#f2d9a0"];
    const count = Math.max(2, Math.floor(w / 16));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, px = x + w * t, py = y + Math.sin(t * Math.PI) * 5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i % 2 ? 1 : -1) * 0.1);
      ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
      ctx.fillRect(-4, 3, 10, 12);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-5, 2, 10, 12);
      ctx.fillStyle = photos[i % photos.length];
      ctx.fillRect(-4, 3, 8, 7);
      ctx.fillStyle = "#b08a60"; // clothespin
      ctx.fillRect(-1, 0, 2, 4);
      ctx.restore();
    }
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(x + w * t, y + Math.sin(t * Math.PI) * 5 + 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Hung on a wall: a boho tapestry with a sun and mountains.
  tapestry(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = 30;
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(x - 2, y, w + 4, 2);
    ctx.fillStyle = "#f2e0c4";
    ctx.fillRect(x, y + 2, w, h);
    ctx.fillStyle = "#e0845a";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 16, 6, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#e0845a";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI + (i + 0.5) * (Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 + Math.cos(ang) * 8, y + 16 + Math.sin(ang) * 8);
      ctx.lineTo(x + w / 2 + Math.cos(ang) * 11, y + 16 + Math.sin(ang) * 11);
      ctx.stroke();
    }
    ctx.fillStyle = "#a8785a";
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.lineTo(x + w * 0.3, y + 18);
    ctx.lineTo(x + w * 0.55, y + 26);
    ctx.lineTo(x + w * 0.75, y + 20);
    ctx.lineTo(x + w, y + 26);
    ctx.lineTo(x + w, y + h + 2);
    ctx.lineTo(x, y + h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e9dcc2"; // fringe
    for (let fx = x + 2; fx < x + w; fx += 3) {
      ctx.beginPath();
      ctx.moveTo(fx, y + h + 2);
      ctx.lineTo(fx, y + h + 6);
      ctx.stroke();
    }
  },

  // Hung on a wall: a glowing pink neon heart.
  heartNeon(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x + (f.w * TILE) / 2, cy = a.y - WALL_HEIGHT + 17;
    ctx.save();
    ctx.shadowColor = "rgba(255, 110, 170, 0.9)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255, 150, 200, ${0.85 + Math.sin(performance.now() / 350) * 0.1})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 9);
    ctx.bezierCurveTo(cx - 14, cy, cx - 8, cy - 11, cx, cy - 4);
    ctx.bezierCurveTo(cx + 8, cy - 11, cx + 14, cy, cx, cy + 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 240, 248, 0.9)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  },

  // Hung on a wall: a curtain of warm fairy lights.
  fairyCurtain(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3;
    const t = performance.now() / 1000;
    ctx.strokeStyle = "rgba(90, 70, 50, 0.5)";
    ctx.lineWidth = 0.6;
    for (let sx = x + 3; sx < x + w - 1; sx += 5) {
      const len = 18 + ((sx * 7) % 13);
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + len);
      ctx.stroke();
      for (let ly = y + 4; ly < y + len; ly += 6) {
        ctx.fillStyle = `rgba(255, 220, 140, ${0.6 + Math.sin(t * 2 + sx + ly) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, ly, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // A little disco ball, catching the light.
  discoBall(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const cy = b.y - 12, t = performance.now() / 1000;
    ctx.fillStyle = "#b8bcc8";
    ctx.beginPath();
    ctx.arc(b.x, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, cy, 10, 0, Math.PI * 2);
    ctx.clip();
    for (let gy = -10; gy < 10; gy += 3) {
      for (let gx = -10; gx < 10; gx += 3) {
        const shine = (Math.sin(gx * 0.9 + gy * 1.3 + t * 3) + 1) / 2;
        ctx.fillStyle = `rgba(${200 + shine * 55}, ${210 + shine * 45}, ${230 + shine * 25}, 1)`;
        ctx.fillRect(b.x + gx + 0.3, cy + gy + 0.3, 2.4, 2.4);
      }
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(b.x - 4, cy - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },

  // A basket of rolled-up chunky knit blankets.
  blanketBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const bk = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#c49a5c");
    ctx.strokeStyle = "rgba(90, 55, 20, 0.45)";
    ctx.lineWidth = 1;
    for (let yy = bk.face.y + 3; yy < bk.face.y + bk.face.h; yy += 3) {
      ctx.beginPath();
      ctx.moveTo(bk.face.x, yy);
      ctx.lineTo(bk.face.x + bk.face.w, yy);
      ctx.stroke();
    }
    for (const [fx, color] of [[0.3, "#f2e0c4"], [0.55, "#c98a8a"], [0.78, "#a8b89a"]]) {
      const cx = bk.top.x + bk.top.w * fx, cy = bk.top.y + 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shadeColor(color, -25);
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // A big, soft teddy bear sitting on the floor.
  teddyBear(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const c = "#c49a6c";
    petBlob(ctx, b.x - 7, b.y - 5, 5, 4, c); // feet
    petBlob(ctx, b.x + 7, b.y - 5, 5, 4, c);
    petBlob(ctx, b.x, b.y - 14, 11, 10, c); // body
    ctx.fillStyle = "#f2e0c4";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 12, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, b.x - 10, b.y - 17, 3.5, 5, c); // arms
    petBlob(ctx, b.x + 10, b.y - 17, 3.5, 5, c);
    petBlob(ctx, b.x - 7, b.y - 35, 4, 4, c); // ears
    petBlob(ctx, b.x + 7, b.y - 35, 4, 4, c);
    petBlob(ctx, b.x, b.y - 29, 9, 8, c); // head
    ctx.fillStyle = "#f2e0c4";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 26, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(b.x - 3.5, b.y - 31, 1.2, 0, Math.PI * 2);
    ctx.arc(b.x + 3.5, b.y - 31, 1.2, 0, Math.PI * 2);
    ctx.ellipse(b.x, b.y - 27, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e37aa0"; // a bow
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 21);
    ctx.lineTo(b.x - 5, b.y - 24);
    ctx.lineTo(b.x - 5, b.y - 18);
    ctx.moveTo(b.x, b.y - 21);
    ctx.lineTo(b.x + 5, b.y - 24);
    ctx.lineTo(b.x + 5, b.y - 18);
    ctx.fill();
  },
};
