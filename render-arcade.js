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
    ctx.strokeStyle = "rgba(60, 70, 80, 0.6)"; // the globe's rim
    ctx.lineWidth = 1.2;
    ctx.stroke();
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

  // The prize counter: a long glass case of prizes, plushies lined up on
  // top, and a ticket sign.
  prizeCounter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#6e4a8a");
    const { x, y, w } = c.face;
    // Wood-grain panels on the front, and a lit edge.
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    for (let px = x + w / 4; px < x + w - 2; px += w / 4) ctx.fillRect(px, y + 17, 1, 5);
    ctx.fillStyle = "rgba(255, 235, 255, 0.25)";
    ctx.fillRect(x, y, w, 1.2);
    // Plushies lined up along the top of the counter.
    const pals = ["#e89ab8", "#6fb86a", "#8a8a92", "#c9a27a", "#f2c94c"];
    for (let i = 0; i < 5; i++) {
      const px = c.top.x + 12 + i * ((c.top.w - 24) / 4), py = c.top.y + c.top.h / 2;
      ctx.fillStyle = shadeColor(pals[i], -60);
      ctx.beginPath();
      ctx.arc(px, py - 3, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pals[i];
      ctx.beginPath();
      ctx.arc(px, py - 3.4, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(40, 25, 20, 0.6)";
      ctx.fillRect(px - 2, py - 4.5, 1, 1);
      ctx.fillRect(px + 1, py - 4.5, 1, 1);
    }
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

// A mini game's door (Update 10), on the Games floor corridor's north
// wall: a painted door in the game's color with a little round window, a
// sign with its name over the top, and a soft glow spilling out under it.
// Doors for games that aren't ready yet are boarded over, with "SOON".
FURNITURE_DRAWERS.gamePortal = function gamePortal(ctx, f) {
  const game = CONFIG.minigames.games.find((g) => g.id === f.game) ?? { name: "?", color: "#888888" };
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, x = a.x, bottom = a.y, top = a.y - WALL_HEIGHT + 3;
  const dw = w * 0.62, dx = x + (w - dw) / 2, dy = top + 9;
  // The frame and the door.
  ctx.fillStyle = "#3a2f4a";
  ctx.fillRect(dx - 3, dy - 3, dw + 6, bottom - dy + 3);
  const door = ctx.createLinearGradient(0, dy, 0, bottom);
  door.addColorStop(0, shadeColor(game.color, 18));
  door.addColorStop(1, shadeColor(game.color, -30));
  ctx.fillStyle = door;
  ctx.fillRect(dx, dy, dw, bottom - dy);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(dx, dy, 1.5, bottom - dy);
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(dx + dw / 2 - 0.5, dy + 3, 1, bottom - dy - 5);
  // Two sunken panels on each leaf, and a little grain.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = 1;
  for (const px of [dx + 2.5, dx + dw / 2 + 1.5]) {
    ctx.strokeRect(px + 0.5, dy + 15.5, dw / 2 - 4.5, (bottom - dy - 20) / 2 - 1);
    ctx.strokeRect(px + 0.5, dy + 15.5 + (bottom - dy - 20) / 2 + 1, dw / 2 - 4.5, (bottom - dy - 20) / 2 - 2);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  for (let gy = dy + 4; gy < bottom - 2; gy += 5) ctx.fillRect(dx + 2, gy, dw - 4, 0.8);
  // A soft shadow where the door meets the floor.
  ctx.fillStyle = "rgba(20, 10, 30, 0.35)";
  ctx.fillRect(dx - 3, bottom - 1.5, dw + 6, 3);
  // The round window, glowing.
  ctx.fillStyle = "#2a2438";
  ctx.beginPath();
  ctx.arc(dx + dw / 2, dy + 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = game.soon ? "#3a3448" : "#fff0c0";
  ctx.beginPath();
  ctx.arc(dx + dw / 2, dy + 8, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d45c"; // the knob
  ctx.beginPath();
  ctx.arc(dx + dw - 3.5, dy + (bottom - dy) * 0.6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // The sign over the door.
  ctx.fillStyle = "#1e1a2a";
  roundRectPath(ctx, x + 1, top - 2, w - 2, 9, 2);
  ctx.fill();
  ctx.fillStyle = game.soon ? "#8a8494" : game.color;
  ctx.font = "800 6.5px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(game.name.toUpperCase(), x + w / 2, top + 5);
  ctx.textAlign = "left";
  if (game.soon) {
    // Boarded over, for now.
    ctx.save();
    ctx.translate(dx + dw / 2, dy + (bottom - dy) / 2);
    for (const turn of [-0.35, 0.7]) {
      ctx.rotate(turn);
      ctx.fillStyle = "#4a3220"; // the board's outline
      ctx.fillRect(-dw * 0.6 - 1, -3.5, dw * 1.2 + 2, 7);
      ctx.fillStyle = "#8a6444";
      ctx.fillRect(-dw * 0.6, -2.5, dw * 1.2, 5);
      ctx.fillStyle = "rgba(255, 230, 190, 0.25)"; // lit top edge, and grain
      ctx.fillRect(-dw * 0.6, -2.5, dw * 1.2, 1);
      ctx.fillStyle = "rgba(60, 38, 22, 0.35)";
      ctx.fillRect(-dw * 0.4, 0.5, dw * 0.5, 0.7);
      ctx.fillStyle = "#c8c8d0"; // nails
      ctx.fillRect(-dw * 0.5, -0.8, 1.2, 1.2);
      ctx.fillRect(dw * 0.45, -0.8, 1.2, 1.2);
    }
    ctx.restore();
    ctx.fillStyle = "#f2d45c";
    ctx.font = "800 6px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SOON", dx + dw / 2, bottom - 4);
    ctx.textAlign = "left";
  } else {
    const glow = ctx.createLinearGradient(0, bottom, 0, bottom + 8);
    glow.addColorStop(0, "rgba(255, 240, 190, 0.35)");
    glow.addColorStop(1, "rgba(255, 240, 190, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(dx, bottom, dw, 8);
  }
};

// A little plush: a round body with stubby arms, a round head with ears,
// and a face (`face(x, y)` draws it, at the head's middle).
function drawPlush(ctx, f, color, face) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const b = toScreen(f.x + f.w / 2, f.y + f.h);
  const x = b.x, y = b.y;
  const soft = (cx, cy, rx, ry, c) => {
    ctx.fillStyle = shadeColor(c, -60); // a soft darker outline
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.4, rx + 1.1, ry + 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, shadeColor(c, 25));
    g.addColorStop(1, shadeColor(c, -20));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const dx of [-5, 5]) soft(x + dx, y - 25, 2.8, 2.8, color); // ears
  soft(x, y - 7, 7.5, 7, color); // body
  for (const dx of [-7, 7]) soft(x + dx, y - 8, 2.5, 3.5, color); // arms
  soft(x, y - 19, 7, 6.5, color); // head
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)"; // a little fuzzy texture
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 5 + (i * 2.1) % 10, y - 11 + (i % 3) * 3, 1, 1);
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
