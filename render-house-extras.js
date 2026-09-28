// How the house extras look (Update 7): the wishing well in the yard, the
// Lounge TV, and the canvases, posters and rugs you paint yourself (see
// extras.js for what they do). Light from above, a soft shadow under each,
// outlines from drawOutlined (render-scene.js).

// Pixel art: 16 by 16 squares, each a color from CONFIG.extras.palette
// (0 to f), filling the box x, y, w, h. Blank (no pixels yet): the first
// palette color, with a faint pencil grid so it looks ready to paint.
const ART_SIZE = 16;
function drawPixelArt(ctx, x, y, w, h, pixels) {
  const palette = CONFIG.extras.palette;
  const cw = w / ART_SIZE, ch = h / ART_SIZE;
  if (!pixels) {
    ctx.fillStyle = palette[0];
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(120, 100, 70, 0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 1; i < ART_SIZE; i += 3) {
      ctx.moveTo(x + i * cw, y);
      ctx.lineTo(x + i * cw, y + h);
      ctx.moveTo(x, y + i * ch);
      ctx.lineTo(x + w, y + i * ch);
    }
    ctx.stroke();
    return;
  }
  for (let i = 0; i < ART_SIZE * ART_SIZE; i++) {
    ctx.fillStyle = palette[parseInt(pixels[i], 16)] ?? palette[0];
    // (A hair bigger than the square, so no seams show between them.)
    ctx.fillRect(x + (i % ART_SIZE) * cw, y + Math.floor(i / ART_SIZE) * ch, cw + 0.4, ch + 0.4);
  }
}

Object.assign(FURNITURE_DRAWERS, {
  // The wishing well: a round wall of stones, dark water with a few coins
  // glinting in it, two posts holding a little shingled roof, and a bucket
  // on its rope.
  wishingWell(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2, top = b.y - 26, ry = 11;
    const t = performance.now() / 1000;
    // The front of the wall: rows of stones, darker toward the ground.
    ctx.fillStyle = "#6e6a66";
    ctx.fillRect(b.x - rx, top, rx * 2, 22);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4, rx, ry * 0.6, 0, 0, Math.PI);
    ctx.fill();
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const x = b.x - rx + ((i + (row % 2) * 0.5) * rx * 2) / 6;
        if (x > b.x + rx - 4) continue;
        drawStone(ctx, x + 4, top + 5 + row * 7, 5.5, 3.2, ["#a8a298", "#9a958c", "#b3aca0"][(i + row) % 3], f.x + i + row * 7);
      }
    }
    const band = ctx.createLinearGradient(0, top, 0, b.y);
    band.addColorStop(0, "rgba(0, 0, 0, 0)");
    band.addColorStop(1, "rgba(20, 15, 10, 0.3)");
    ctx.fillStyle = band;
    ctx.fillRect(b.x - rx, top, rx * 2, 26);
    // The rim, lit on top, and the water inside.
    ctx.fillStyle = "#c4beb2";
    ctx.beginPath();
    ctx.ellipse(b.x, top, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.ellipse(b.x, top - 1.5, rx - 3, ry - 3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    const water = ctx.createLinearGradient(0, top - ry, 0, top + ry);
    water.addColorStop(0, "#1e3a4a");
    water.addColorStop(1, "#2f5a6e");
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(b.x, top + 1, rx - 5, ry - 4, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const glint = 0.35 + 0.35 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = `rgba(242, 201, 76, ${glint})`;
      ctx.beginPath();
      ctx.ellipse(b.x - rx * 0.4 + i * rx * 0.28, top + 1 + (i % 2 ? 2 : -1), 2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The posts and the roof.
    for (const side of [-1, 1]) {
      const px = b.x + side * (rx - 4);
      ctx.fillStyle = "#5e412a";
      ctx.fillRect(px - 2.5, top - 44, 5, 44);
      ctx.fillStyle = "rgba(255, 225, 180, 0.2)";
      ctx.fillRect(px - 2.5, top - 44, 1.5, 44);
    }
    ctx.fillStyle = "#7a4a34";
    ctx.beginPath();
    ctx.moveTo(b.x - rx - 8, top - 40);
    ctx.lineTo(b.x, top - 64);
    ctx.lineTo(b.x + rx + 8, top - 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)"; // shingle rows
    for (let k = 1; k < 4; k++) ctx.fillRect(b.x - rx - 8 + k * 5, top - 40 - k * 6, (rx + 8 - k * 5) * 2, 1.2);
    ctx.fillStyle = "rgba(255, 220, 190, 0.25)"; // the lit ridge
    ctx.beginPath();
    ctx.moveTo(b.x - rx - 8, top - 40);
    ctx.lineTo(b.x, top - 64);
    ctx.lineTo(b.x, top - 60);
    ctx.lineTo(b.x - rx - 4, top - 40);
    ctx.fill();
    // The crossbar, rope and bucket.
    ctx.fillStyle = "#6b4a30";
    ctx.fillRect(b.x - rx + 4, top - 36, rx * 2 - 8, 3);
    ctx.strokeStyle = "#c8b48a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 6, top - 34);
    ctx.lineTo(b.x + 6, top - 20);
    ctx.stroke();
    ctx.fillStyle = "#8a6444";
    ctx.fillRect(b.x + 2, top - 20, 8, 7);
    ctx.fillStyle = "#3a3a40";
    ctx.fillRect(b.x + 2, top - 18, 8, 1.2);
  },

  // The Lounge TV: a wooden stand with two doors and a round old TV set on
  // it, rabbit-ear antennas, and a screen glowing in the channel's colors.
  tvSet(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stand = drawBlock(ctx, f.x, f.y, f.w, f.h, 16, "#7a5c3e");
    ctx.fillStyle = "rgba(40, 25, 10, 0.35)";
    ctx.fillRect(stand.face.x + stand.face.w / 2 - 0.5, stand.face.y + 2, 1, stand.face.h - 5);
    ctx.fillStyle = "#d9b04a";
    for (const dx of [-5, 4]) ctx.fillRect(stand.face.x + stand.face.w / 2 + dx, stand.face.y + 6, 1.5, 3);
    const w = stand.top.w * 0.72, h = 34;
    const x = stand.top.x + (stand.top.w - w) / 2, y = stand.top.y + stand.top.h / 2 - h;
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "#9a7a5a");
    body.addColorStop(1, "#6e5238");
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 235, 200, 0.25)";
    ctx.fillRect(x + 4, y + 1, w - 8, 1.5);
    // The screen, and what's on.
    const sx = x + 4, sy = y + 4, sw = w * 0.68, sh = h - 9;
    ctx.fillStyle = "#1e2226";
    roundRectPath(ctx, sx, sy, sw, sh, 5);
    ctx.fill();
    const t = performance.now() / 1000;
    const glow = ctx.createLinearGradient(0, sy, 0, sy + sh);
    const hue = (t * 12) % 360;
    glow.addColorStop(0, `hsla(${hue}, 45%, 70%, 0.85)`);
    glow.addColorStop(1, `hsla(${(hue + 60) % 360}, 45%, 45%, 0.85)`);
    ctx.fillStyle = glow;
    roundRectPath(ctx, sx + 2, sy + 2, sw - 4, sh - 4, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)"; // the glass's shine
    ctx.fillRect(sx + 4, sy + 3, sw * 0.35, 2);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(sx + 3, sy + 6 + ((t * 20 + i * 9) % (sh - 8)), sw - 6, 1);
    }
    // The dials and the speaker.
    const kx = sx + sw + (w - sw - 8) / 2;
    ctx.fillStyle = "#3a2a1c";
    for (const dy of [8, 17]) {
      ctx.beginPath();
      ctx.arc(kx + 2, y + dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(40, 25, 10, 0.4)";
    for (let i = 0; i < 3; i++) ctx.fillRect(kx - 2, y + 24 + i * 2.5, 8, 1);
    // Rabbit ears.
    ctx.strokeStyle = "#3a3a40";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 - 12, y - 16);
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 + 10, y - 17);
    ctx.stroke();
    ctx.fillStyle = "#3a3a40";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A canvas on the wall, in a thin wooden frame (painted or blank).
  artCanvas(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 4, h = w;
    ctx.fillStyle = "#8a6444";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = "rgba(255, 230, 190, 0.35)";
    ctx.fillRect(x - 2, y - 2, w + 4, 1.2);
    drawPixelArt(ctx, x, y, w, h, f.pixels);
  },

  // A wider poster, pinned at its corners (painted or blank).
  artPoster(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = Math.min(34, w * 0.7);
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    drawPixelArt(ctx, x + 1, y + 1, w - 2, h - 2, f.pixels);
    ctx.fillStyle = "#c0392b";
    for (const [px, py] of [[x + 2, y + 2], [x + w - 3, y + 2]]) {
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A rug on the floor with a woven border and fringe (painted or blank).
  artRug(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, h = f.h * TILE;
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    ctx.fillRect(a.x + 2, a.y + 3, w, h);
    ctx.fillStyle = "#b8a07a";
    ctx.fillRect(a.x, a.y, w, h);
    drawPixelArt(ctx, a.x + 4, a.y + 4, w - 8, h - 8, f.pixels);
    ctx.strokeStyle = "rgba(90, 65, 40, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x + 3.5, a.y + 3.5, w - 7, h - 7);
    ctx.fillStyle = "#e8dcc0"; // the fringe at each end
    for (let yy = a.y + 2; yy < a.y + h - 2; yy += 4) {
      ctx.fillRect(a.x - 4, yy, 4, 1.5);
      ctx.fillRect(a.x + w, yy, 4, 1.5);
    }
  },
});
