// Out and about (art night, batch 5): the Lake's and Farm's park benches,
// the Games floor's arcade cabinets and the alley's old sofa, as models (see
// render-models.js). The cabinets' marquees and screens stay live.

registerModels({
  // A park bench facing the view (so you see its back): wooden slats on
  // curly cast-iron ends with armrests.
  parkBench: (f) => {
    const [W, D] = sizeOf(f, 1.5, 0.45), wood = "#a8804f", iron = "#2f2f34";
    const parts = [];
    for (const x of [0.04, W - 0.1]) { // the iron ends: legs, a rail and an armrest
      parts.push(part(x, 0.06, 0, 0.06, 0.05, 14, iron, "metal"));
      parts.push(part(x, D - 0.1, 0, 0.06, 0.05, 14, iron, "metal"));
      parts.push(part(x, 0.04, 20, 0.06, D - 0.1, 2, iron, "metal", { round: 1 }));
      parts.push(part(x, 0, 12, 0.06, 0.06, 24, iron, "metal"));
    }
    for (let k = 0; k < 3; k++) parts.push(part(0.02, 0.1 + k * ((D - 0.12) / 3), 13, W - 0.04, (D - 0.12) / 3 - 0.02, 2.5, shadeColor(wood, 6 - k * 5)));
    for (let k = 0; k < 3; k++) parts.push(part(0, -0.03, 17 + k * 6, W, 0.04, 4.2, shadeColor(wood, 10 - k * 8))); // the back slats
    return { W, D, parts };
  },

  // An arcade cabinet on the Games floor: painted sides, a glowing marquee
  // with the game's name, the screen (its game playing), a control ledge
  // and speaker grilles. Its colors come from CABINET_LOOKS (render-arcade.js).
  arcadeGame: (f) => {
    const [W, D] = sizeOf(f, 0.9, 0.65);
    const [body] = (CABINET_LOOKS[f.game] ?? CABINET_LOOKS.snake)[f.look ?? 0];
    const sides = (ctx, U, V) => {
      ctx.fillStyle = shadeColor(body, 18); // a sweeping side stripe and a few stars
      ctx.beginPath();
      ctx.moveTo(0, V * 0.35);
      ctx.quadraticCurveTo(U * 0.5, V * 0.2, U, V * 0.4);
      ctx.lineTo(U, V * 0.5);
      ctx.quadraticCurveTo(U * 0.5, V * 0.3, 0, V * 0.45);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 240, 200, 0.45)";
      for (let i = 0; i < 4; i++) ctx.fillRect(noise(i * 2.3 + U) * U, noise(i * 4.1) * V * 0.3 + 3, 1.5, 1.5);
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 60, body, "paint", { paint: { left: sides, right: sides, top: sides, front: (ctx, U, V) => {
          ctx.fillStyle = "#1e1c26"; // the marquee's frame and the screen's bezel
          ctx.fillRect(2, 2, U - 4, 10);
          ctx.fillRect(3, 14, U - 6, 22);
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // speaker grilles, low down
          for (let i = 0; i < 3; i++) ctx.fillRect(5, 48 + i * 2.5, U - 10, 1);
          ctx.fillStyle = shadeColor(body, -20); // a coin slot panel
          ctx.fillRect(U / 2 - 5, V - 10, 10, 6);
          ctx.fillStyle = "#e0b84c";
          ctx.fillRect(U / 2 - 1, V - 9, 2, 3);
        } } }),
        part(-0.02, D - 0.02, 16, W + 0.04, 0.14, 5, "#2b2b30", "paint"), // the control ledge
      ],
      live: (ctx, P, facing, piece) => {
        if (facing !== "front") return;
        const [, glow] = (CABINET_LOOKS[piece.game] ?? CABINET_LOOKS.snake)[piece.look ?? 0];
        const o = P(0, D, 60), x = o.x, y = o.y, w = W * TILE;
        const t = performance.now() / 1000;
        ctx.fillStyle = glow; // the marquee, softly pulsing
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3);
        ctx.fillRect(x + 3, y + 3, w - 6, 8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(x + 3, y + 3, w - 6, 1.5);
        ctx.fillStyle = "#1e1c26";
        ctx.font = "800 6px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(piece.game === "moths" ? "MOTHS" : "SNAKE", x + w / 2, y + 9.5);
        ctx.textAlign = "left";
        const sx = x + 4, sy = y + 15, sw = w - 8, sh = 20; // the screen
        ctx.fillStyle = "#101018";
        ctx.fillRect(sx, sy, sw, sh);
        if (piece.game === "snake") {
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
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // scanlines and the glass's shine
        for (let yy = sy; yy < sy + sh; yy += 2) ctx.fillRect(sx, yy, sw, 0.6);
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(sx, sy, sw, 2);
        const l = P(0, D + 0.12, 21); // the joystick and buttons on the ledge
        ctx.fillStyle = "#1a1a1e";
        ctx.fillRect(l.x + 7, l.y - 5, 1.6, 5);
        ctx.fillStyle = "#c0392b";
        ctx.beginPath();
        ctx.arc(l.x + 7.8, l.y - 5.5, 2.4, 0, Math.PI * 2);
        ctx.fill();
        for (const [dx, c] of [[w - 12, "#f2d45c"], [w - 6, "#6fd8c8"]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(l.x + dx, l.y - 1.5, 1.9, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    };
  },

  // The alley's old sofa: mustard, sagging, a blue patch on the back, a
  // striped blanket over one arm, a cigarette burn and stubby legs.
  alleySofa: (f) => {
    const [W, D] = sizeOf(f, 1.6, 0.6), c = "#b8963e", dark = "#9a7c34";
    return {
      W, D,
      parts: [
        ...[[0.06, 0.06], [W - 0.12, 0.06], [0.06, D - 0.12], [W - 0.12, D - 0.12]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 3, "#3a2a1c")),
        part(0.02, 0.02, 3, W - 0.04, D - 0.04, 6, shadeColor(dark, -8), "fabric", { round: 3 }),
        part(0.05, 0, 3, W - 0.1, 0.22, 26, "#a88838", "fabric", { round: 6, paint: { front: (ctx, U, V) => {
          ctx.fillStyle = "#6a8ab0"; // the patch
          ctx.fillRect(U * 0.28, V * 0.25, 9, 7);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.setLineDash([1.2, 1.2]);
          ctx.lineWidth = 0.7;
          ctx.strokeRect(U * 0.28, V * 0.25, 9, 7);
          ctx.setLineDash([]);
        } } }),
        part(0.17, 0.2, 9, (W - 0.34) / 2 - 0.01, D - 0.22, 5, c, "fabric", { round: 4 }),
        part(W / 2 + 0.01, 0.2, 8, (W - 0.34) / 2 - 0.01, D - 0.22, 5, shadeColor(c, -6), "fabric", { round: 4, paint: { top: (ctx, U, V) => {
          ctx.fillStyle = "rgba(40, 25, 10, 0.55)"; // a little burn mark
          ctx.beginPath();
          ctx.arc(U * 0.6, V * 0.5, 1.4, 0, Math.PI * 2);
          ctx.fill();
        } } }),
        part(0, 0.06, 3, 0.17, D - 0.06, 15, dark, "fabric", { round: 5 }),
        part(W - 0.17, 0.06, 3, 0.17, D - 0.06, 15, dark, "fabric", { round: 5 }),
        part(W - 0.22, 0.04, 18, 0.25, D - 0.02, 1.5, "#d9644f", "knit", { paint: { top: stripes } }), // the blanket over the arm
        part(W - 0.22, D - 0.01, 4, 0.25, 0.025, 15.5, "#d9644f", "knit", { fringe: true, paint: { front: stripes } }),
      ],
    };
  },
});

// A striped blanket's colors, across it.
function stripes(ctx, U, V) {
  const colors = ["#d9644f", "#f2c94c", "#5fa052", "#e8e0cc"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, (V * i) / 4, U, V / 4 + 0.5);
  }
}
