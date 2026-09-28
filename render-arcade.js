// How the Arcade looks (Update 9, on the Games floor): the cabinets, the
// high score board, the claw machine, the capsule machine and the prize
// counter, plus the prizes (plushies, a neon star, a crown). Upright on the
// floor with a soft shadow, lit from above; outlines from drawOutlined.

// Each cabinet's colors: [body, marquee], by game (and a second look).
const CABINET_LOOKS = {
  snake: [["#2f6a5a", "#9ff5ea"], ["#3a5a8a", "#8fd0f0"]],
  moths: [["#5a3f6e", "#f2c0e0"], ["#6e3f4a", "#f2d45c"]],
};

Object.assign(FURNITURE_DRAWERS, {
  // A standing cabinet: a lit marquee with its name, a glowing screen
  // playing its game, a joystick and two buttons, and speaker grilles.
  arcadeGame(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const [body, glow] = (CABINET_LOOKS[f.game] ?? CABINET_LOOKS.snake)[f.look ?? 0];
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 60, body);
    const { x, y, w } = cab.face;
    const t = performance.now() / 1000;
    // The marquee.
    ctx.fillStyle = "#1e1c26";
    ctx.fillRect(x + 2, y + 2, w - 4, 10);
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3);
    ctx.fillRect(x + 3, y + 3, w - 6, 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1e1c26";
    ctx.font = "800 6px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.game === "moths" ? "MOTHS" : "SNAKE", x + w / 2, y + 9.5);
    ctx.textAlign = "left";
    // The screen, and what's playing on it.
    const sx = x + 4, sy = y + 15, sw = w - 8, sh = 20;
    ctx.fillStyle = "#101018";
    ctx.fillRect(sx, sy, sw, sh);
    if (f.game === "snake") {
      ctx.fillStyle = "#6fd8c8";
      const k = Math.floor(t * 4) % 10;
      for (let i = 0; i < 5; i++) ctx.fillRect(sx + 2 + ((k + i) % 10) * 2.6, sy + 9, 2.2, 2.2);
      ctx.fillStyle = "#e8b84a";
      ctx.fillRect(sx + sw - 6, sy + 5, 2.5, 2.5);
    } else {
      ctx.fillStyle = "#e6d6c8";
      for (let i = 0; i < 3; i++) ctx.fillRect(sx + 4 + i * 7, sy + ((t * 12 + i * 7) % (sh - 4)), 3, 2);
      ctx.fillStyle = "#cfe6ee";
      ctx.fillRect(sx + sw / 2 - 3, sy + sh - 4, 6, 3);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(sx, sy, sw, 2);
    // The control panel: a joystick and two buttons.
    ctx.fillStyle = "#2b2b30";
    ctx.fillRect(x + 1, y + 37, w - 2, 7);
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(x + 7, y + 34, 1.6, 5);
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(x + 7.8, y + 34, 2.4, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, c] of [[w - 12, "#f2d45c"], [w - 6, "#6fd8c8"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + dx, y + 40, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Speaker grilles, low down.
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 5, y + 48 + i * 2.5, w - 10, 1);
  },

  // The high score board on the wall: a dark panel with glowing rows.
  scoreBoard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 2, h = 30;
    ctx.fillStyle = "#1a1826";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#6a5a8a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    ctx.fillStyle = "#f2d45c";
    ctx.font = "800 6px 'Quicksand', sans-serif";
    ctx.fillText("HIGH SCORES", x + 5, y + 8);
    const t = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === Math.floor(t) % 4 ? "#9ff5ea" : "rgba(159, 245, 234, 0.55)";
      ctx.fillRect(x + 5, y + 12 + i * 4.3, w * 0.45 - (i % 2) * 6, 2);
      ctx.fillRect(x + w - 18, y + 12 + i * 4.3, 12, 2);
    }
  },

  // The claw machine: a tall glass case full of plushies, a claw hanging
  // from the top, a coin slot and a joystick.
  clawMachine(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = drawBlock(ctx, f.x, f.y, f.w, f.h, 26, "#c0554a");
    const { x, w } = base.face;
    const top = base.face.y;
    // The glass case above the base.
    const gx = x + 3, gw = w - 6, gy = top - 40;
    ctx.fillStyle = "rgba(190, 220, 235, 0.35)";
    ctx.fillRect(gx, gy, gw, 40);
    // Plushies piled inside.
    const pile = [["#c9a27a", 8], ["#6fb86a", 18], ["#8a8a92", 28], ["#e89ab8", 13], ["#d9985a", 24]];
    for (const [c, dx] of pile) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(gx + (dx / 34) * gw, gy + 33 - (dx % 3) * 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(40, 25, 20, 0.6)";
      ctx.fillRect(gx + (dx / 34) * gw - 2, gy + 32 - (dx % 3) * 2, 1, 1);
      ctx.fillRect(gx + (dx / 34) * gw + 1, gy + 32 - (dx % 3) * 2, 1, 1);
    }
    // The claw, swaying a little.
    const t = performance.now() / 1000;
    const cx = gx + gw / 2 + Math.sin(t * 0.8) * gw * 0.25;
    ctx.strokeStyle = "#8a8a92";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, gy);
    ctx.lineTo(cx, gy + 12);
    ctx.moveTo(cx, gy + 12);
    ctx.lineTo(cx - 4, gy + 18);
    ctx.moveTo(cx, gy + 12);
    ctx.lineTo(cx + 4, gy + 18);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // the glass's shine
    ctx.fillRect(gx + 2, gy + 2, 2, 34);
    // The roof and its sign.
    ctx.fillStyle = "#a8473a";
    ctx.fillRect(x, gy - 8, w, 9);
    ctx.fillStyle = "#f2d45c";
    ctx.font = "800 6px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CLAW", x + w / 2, gy - 1.5);
    ctx.textAlign = "left";
    // Coin slot and joystick on the base.
    ctx.fillStyle = "#2b2b30";
    ctx.fillRect(x + w - 9, top + 5, 4, 6);
    ctx.fillStyle = "#f2d45c";
    ctx.fillRect(x + w - 8, top + 7, 2, 2);
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(x + 7, top + 2, 1.5, 5);
    ctx.fillStyle = "#f2d45c";
    ctx.beginPath();
    ctx.arc(x + 7.8, top + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  },

  // The capsule machine: a round glass globe of colored capsules on a red
  // stand, with a turning handle.
  capsuleMachine(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stand = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#c0392b");
    const { x, w } = stand.face;
    const cx = x + w / 2, cy = stand.top.y - 12;
    ctx.fillStyle = "rgba(210, 230, 240, 0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    const colors = ["#e05a47", "#f2c94c", "#6fb86a", "#3f8ab0", "#8a6ab0", "#e89ab8"];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 3 + (i % 3) * 3;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + 4 + Math.sin(a) * r * 0.6, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 8, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = "#e8e0d0"; // the handle, and the chute
    ctx.beginPath();
    ctx.arc(cx, stand.face.y + 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a8a92";
    ctx.fillRect(cx - 3.5, stand.face.y + 6.5, 7, 1.2);
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(cx - 3, stand.face.y + 13, 6, 4);
  },

  // The prize counter: a long glass case of prizes, with a wall of plushies
  // above (drawn on the counter's back) and a ticket sign.
  prizeCounter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#6e4a8a");
    const { x, y, w } = c.face;
    ctx.fillStyle = "rgba(200, 225, 240, 0.35)"; // the glass front
    ctx.fillRect(x + 3, y + 3, w - 6, 13);
    const colors = ["#e89ab8", "#6fb86a", "#f2c94c", "#8fd0f0", "#c9a27a", "#e05a47"];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x + 9 + i * ((w - 18) / 8), y + 11, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 3, y + 3, w - 6, 1.5);
    // The ticket sign on top.
    const sx = c.top.x + c.top.w / 2 - 16, sy = c.top.y - 12;
    ctx.fillStyle = "#f2d45c";
    roundRectPath(ctx, sx, sy, 32, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#6e3f1a";
    ctx.font = "800 6.5px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PRIZES", sx + 16, sy + 8);
    ctx.textAlign = "left";
  },

  // The plushies (the claw machine's, and the prize counter's).
  plushRaccoon(ctx, f) {
    drawPlush(ctx, f, "#8a8a92", (x, y) => {
      ctx.fillStyle = "#3a3a40"; // the mask
      ctx.fillRect(x - 5.5, y - 2, 11, 3.5);
      ctx.fillStyle = "#f4f0e8";
      for (const dx of [-2.5, 2.5]) ctx.fillRect(x + dx - 0.6, y - 1.2, 1.2, 1.2);
    });
  },
  plushOtter(ctx, f) {
    drawPlush(ctx, f, "#8a6444", (x, y) => {
      ctx.fillStyle = "#e8d4b8"; // the pale muzzle
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1a10";
      for (const dx of [-2.6, 2.6]) ctx.fillRect(x + dx - 0.6, y - 2, 1.3, 1.3);
    });
  },
  plushFrog(ctx, f) {
    drawPlush(ctx, f, "#6fb86a", (x, y) => {
      for (const dx of [-3.5, 3.5]) {
        ctx.fillStyle = "#f4f0e8";
        ctx.beginPath();
        ctx.arc(x + dx, y - 5, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a1a1e";
        ctx.fillRect(x + dx - 0.6, y - 5.5, 1.2, 1.2);
      }
      ctx.strokeStyle = "#3f7a42";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    });
  },

  // A neon star on the wall, softly glowing.
  neonStar(ctx, f) {
    const a = toScreen(f.x + f.w / 2, f.y);
    const cx = a.x, cy = a.y - WALL_HEIGHT * 0.55;
    ctx.save();
    ctx.shadowColor = "rgba(255, 210, 90, 0.9)";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 5 : 12, ang = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  },
});

// A little plush: a round body with stubby arms, a round head with ears,
// and a face (`face(x, y)` draws it, at the head's middle).
function drawPlush(ctx, f, color, face) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const b = toScreen(f.x + f.w / 2, f.y + f.h);
  const x = b.x, y = b.y;
  const soft = (cx, cy, rx, ry, c) => {
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, shadeColor(c, 25));
    g.addColorStop(1, shadeColor(c, -20));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  soft(x, y - 7, 7.5, 7, color); // body
  for (const dx of [-7, 7]) soft(x + dx, y - 8, 2.5, 3.5, color); // arms
  for (const dx of [-5, 5]) soft(x + dx, y - 25, 2.8, 2.8, color); // ears
  soft(x, y - 19, 7, 6.5, color); // head
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; // a stitched seam
  ctx.setLineDash([1.5, 1.5]);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x, y - 2);
  ctx.stroke();
  ctx.setLineDash([]);
  face(x, y - 19);
}

// The prize crown (a hat): shiny plastic gold with bright plastic gems.
Object.assign(HAT_DRAWERS, {
  prizeCrown(ctx, cx, cy, r) {
    const y = cy - r * 0.75;
    const g = ctx.createLinearGradient(0, y - 12, 0, y + 3);
    g.addColorStop(0, "#fff0a0");
    g.addColorStop(1, "#d9a441");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, y + 3);
    ctx.lineTo(cx - r * 0.8, y - 9);
    ctx.lineTo(cx - r * 0.4, y - 3);
    ctx.lineTo(cx, y - 12);
    ctx.lineTo(cx + r * 0.4, y - 3);
    ctx.lineTo(cx + r * 0.8, y - 9);
    ctx.lineTo(cx + r * 0.75, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#a8742a";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const [dx, c] of [[-0.45, "#e05a47"], [0, "#3f8ab0"], [0.45, "#6fb86a"]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(cx + dx * r, y - 0.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
});
