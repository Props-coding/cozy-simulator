// The ground floor's furniture as models (art night, batch 2): see
// render-models.js for how models work. Chairs face any way (their own
// `facing`), the theater seats and the back-row sofa face the screen (so
// you see their backs), and the grandfather clock and the turntable keep
// their moving parts (hands, pendulum, spinning record) drawn live.

// A kitchen counter: cream cupboard doors with knobs on a dark toe kick,
// and a wooden worktop. `top` adds details to the worktop.
function counterParts(W, D, topPaint) {
  const H = 18;
  const doors = (ctx, U, V) => {
    const n = Math.max(1, Math.round(U / 36)), dw = U / n;
    for (let i = 0; i < n; i++) {
      inset(ctx, i * dw + 2.5, 2.5, dw - 5, V - 5, "#e8dcc8");
      ctx.fillStyle = "#b8923a";
      ctx.beginPath();
      ctx.arc(i * dw + (i % 2 ? 6 : dw - 6), 7, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  return [
    part(0.04, 0.02, 0, W - 0.08, D - 0.08, 3, "#4a3a2e"),
    part(0, 0, 3, W, D - 0.03, H - 3, "#e8dcc8", "paint", { paint: { front: doors } }),
    part(-0.01, -0.01, H, W + 0.02, D + 0.02, 3, "#b58a5c", "wood", { paint: { top: topPaint } }),
  ];
}

// Table legs and the apron under a tabletop `H` pixels high.
function tableParts(W, D, H, c, inset = 0.08) {
  return [
    ...legs(W, D, H - 3, c, inset, 0.08),
    part(inset + 0.02, inset + 0.02, H - 8, W - 2 * inset - 0.04, D - 2 * inset - 0.04, 5, shadeColor(c, -6)),
    part(-0.02, -0.02, H - 3, W + 0.04, D + 0.04, 3.5, shadeColor(c, 6)),
  ];
}

// An open book lying on a table, pages up.
const openBook = (x, y, z, cover = "#8f2f2a") => [
  part(x, y, z, 0.56, 0.3, 1, cover, "paint"),
  part(x + 0.02, y + 0.02, z + 1, 0.52, 0.26, 1.2, "#f4ecdc", "pages", {
    paint: { top: (ctx, U, V) => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(U / 2 - 0.5, 0, 1, V);
      ctx.fillStyle = "rgba(60, 50, 40, 0.3)";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(2, 2.5 + i * 2.8, U / 2 - 4, 0.7);
        ctx.fillRect(U / 2 + 2, 2.5 + i * 2.8, U / 2 - 4, 0.7);
      }
    } },
  }),
];

// A mug: a little rounded box with tea in it.
const mug = (x, y, z, color) => part(x, y, z, 0.13, 0.12, 8, color, "paint", {
  round: 2,
  paint: { top: (ctx, U, V) => {
    ctx.fillStyle = "#6b3a1e";
    ctx.beginPath();
    ctx.ellipse(U / 2, V / 2, U / 2 - 1.3, V / 2 - 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } },
});

// A banker's lamp with a green glass shade, standing at p.
function bankersLamp(ctx, p) {
  ctx.fillStyle = "#b8923a";
  ctx.fillRect(p.x - 5, p.y - 2, 10, 2.5);
  ctx.fillRect(p.x - 0.9, p.y - 11, 1.8, 10);
  const g = ctx.createLinearGradient(0, p.y - 16, 0, p.y - 10);
  g.addColorStop(0, "#4f9a68");
  g.addColorStop(1, "#245a38");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 11, 8, 4.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 240, 180, 0.85)";
  ctx.fillRect(p.x - 6.5, p.y - 11, 13, 1.3);
}

registerModels({
  chair: (f) => {
    const [W, D] = sizeOf(f, 0.6, 0.6);
    const seat = f.seat || "#a3785a", back = f.back || "#8a6448", cushion = !!f.seat;
    const parts = [
      ...[[0.04, 0.04], [W - 0.1, 0.04], [0.04, D - 0.1], [W - 0.1, D - 0.1]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 12, shadeColor(back, -12))),
      part(0.02, 0.02, 12, W - 0.04, D - 0.04, 4, seat, cushion ? "fabric" : "wood", { round: cushion ? 3 : 1 }),
      part(0.03, 0, 12, 0.07, 0.08, 20, back), // the back posts
      part(W - 0.1, 0, 12, 0.07, 0.08, 20, back),
      part(0.03, 0, 26, W - 0.06, 0.08, 6, back, "wood", { round: 1 }), // the top rail
    ];
    for (let i = 1; i < 4; i++) parts.push(part(0.03 + (i * (W - 0.1)) / 4, 0.01, 16, 0.05, 0.05, 10, shadeColor(back, 8)));
    return { W, D, parts, shear: 0.12 };
  },

  theaterSeat: (f) => {
    const [W, D] = sizeOf(f, 0.7, 0.6), red = "#9b3540";
    return {
      W, D,
      parts: [
        part(0.06, 0.06, 0, W - 0.12, D - 0.1, 5, "#3a1f24"),
        part(0.09, 0.2, 5, W - 0.18, D - 0.22, 7, "#7d2a33", "fabric", { round: 3 }),
        part(0.06, 0, 5, W - 0.12, 0.2, 25, red, "fabric", { round: 5, paint: { back: (ctx, U, V) => {
          ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
          ctx.beginPath();
          ctx.roundRect(4, 3, U - 8, V - 9, 4);
          ctx.fill();
          ctx.fillStyle = "#e0b84c"; // a little brass seat number
          ctx.fillRect(U / 2 - 3, V - 6, 6, 2.5);
        } } }),
        part(0, 0.04, 0, 0.07, D - 0.04, 16, "#4a2a30", "wood", { round: 2 }),
        part(W - 0.07, 0.04, 0, 0.07, D - 0.04, 16, "#4a2a30", "wood", { round: 2 }),
      ],
    };
  },

  cinemaSofa: (f) => {
    const [W, D] = sizeOf(f, 3.4, 0.8), c = f.color ?? "#6b2f45", n = Math.max(2, Math.round(W / 1.1));
    const cw = (W - 0.4) / n;
    const parts = [
      ...[[0.06, 0.06], [W - 0.12, 0.06], [0.06, D - 0.12], [W - 0.12, D - 0.12]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 4, WOOD_DARK)),
      part(0.03, 0.03, 4, W - 0.06, D - 0.06, 6, shadeColor(c, -15), "fabric", { round: 3 }),
    ];
    for (let i = 0; i < n; i++) {
      parts.push(part(0.2 + i * cw + 0.01, 0.26, 10, cw - 0.02, D - 0.3, 6, c, "fabric", { round: 4 }));
      parts.push(part(0.2 + i * cw + 0.01, 0, 10, cw - 0.02, 0.26, 20, shadeColor(c, 14), "fabric", { round: 6 }));
    }
    parts.push(part(0, 0.04, 4, 0.2, D - 0.04, 16, shadeColor(c, -21), "fabric", { round: 5 }));
    parts.push(part(W - 0.2, 0.04, 4, 0.2, D - 0.04, 16, shadeColor(c, -21), "fabric", { round: 5 }));
    // A mustard blanket thrown over one end of the back, hanging down behind.
    parts.push(part(W - 0.95, -0.01, 30, 0.5, 0.28, 1.5, "#e9c46a", "knit"));
    parts.push(part(W - 0.95, -0.03, 12, 0.5, 0.025, 19.5, "#d9b25a", "knit", { fringe: true }));
    return { W, D, parts };
  },

  stove: (f) => {
    const [W, D] = sizeOf(f, 1.6, 0.6);
    const cook = W - 0.82;
    return {
      W, D,
      parts: [
        ...counterParts(W, D),
        part(cook + 0.06, D - 0.02, 4, 0.66, 0.025, 12, "#2e2e34", "metal", { paint: { front: (ctx, U, V) => { // the oven door
          ctx.fillStyle = "#15151a";
          ctx.fillRect(4, 4, U - 8, V - 7);
          ctx.fillStyle = "rgba(255, 170, 90, 0.25)";
          ctx.fillRect(5, 5, U - 10, V - 9);
          ctx.fillStyle = "#b8b8c0";
          ctx.fillRect(4, 1.5, U - 8, 1.2);
        } } }),
        part(cook, 0.06, 21, 0.76, D - 0.14, 1.2, "#2b2b30", "metal", { paint: { top: (ctx, U, V) => {
          ctx.strokeStyle = "#6a6a72";
          ctx.lineWidth = 1.4;
          for (const [bx, by] of [[0.28, 0.35], [0.72, 0.35], [0.28, 0.72], [0.72, 0.72]]) {
            ctx.beginPath();
            ctx.ellipse(U * bx, V * by, 5, 3.2, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } } }),
        part(cook + 0.08, 0.1, 22.2, 0.3, 0.22, 10, "#c0554a", "paint", { round: 3 }), // the pot
        part(cook + 0.06, 0.08, 32.2, 0.34, 0.26, 1.5, "#a8473a", "metal", { round: 2 }),
        part(0.12, 0.1, 21, 0.52, D - 0.24, 1.5, "#d9b98f", "wood", { round: 2 }), // a cutting board
      ],
      after: (ctx, P) => {
        const b = P(0.38, D * 0.45, 22.5); // a loaf of bread
        const g = ctx.createLinearGradient(0, b.y - 9, 0, b.y);
        g.addColorStop(0, "#e0a85a");
        g.addColorStop(1, "#b0742c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y - 4, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 235, 190, 0.6)";
        ctx.lineWidth = 1;
        for (const dx of [-4, 0, 4]) {
          ctx.beginPath();
          ctx.moveTo(b.x + dx - 1.5, b.y - 7);
          ctx.lineTo(b.x + dx + 1.5, b.y - 3);
          ctx.stroke();
        }
        const s = P(cook + 0.23, 0.2, 33); // steam
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        for (const dx of [-3, 3]) {
          ctx.beginPath();
          ctx.moveTo(s.x + dx, s.y - 2);
          ctx.quadraticCurveTo(s.x + dx - 3, s.y - 7, s.x + dx, s.y - 12);
          ctx.stroke();
        }
      },
    };
  },

  sink: (f) => {
    const [W, D] = sizeOf(f, 0.8, 0.6);
    const basin = (ctx, U, V) => {
      ctx.fillStyle = "#c8d0d5";
      ctx.beginPath();
      ctx.roundRect(4, 3, U - 8, V - 6, 4);
      ctx.fill();
      ctx.fillStyle = "#8f9aa1";
      ctx.beginPath();
      ctx.roundRect(7, 5.5, U - 14, V - 11, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(8, 6.5, U - 16, 1.2);
      ctx.fillStyle = "#5a646a";
      ctx.beginPath();
      ctx.arc(U / 2, V / 2 + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };
    return {
      W, D,
      parts: [
        ...counterParts(W, D, basin),
        part(W * 0.55, D - 0.005, 7, 0.2, 0.02, 10, "#e0845a", "fabric", { paint: { front: (ctx, U, V) => { // a tea towel
          ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
          ctx.fillRect(0, 2, U, 1.2);
          ctx.fillRect(0, V - 3, U, 1.2);
        } } }),
      ],
      after: (ctx, P) => {
        const t = P(W / 2, 0.08, 21);
        ctx.strokeStyle = "#cfd6da";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x, t.y - 11);
        ctx.quadraticCurveTo(t.x, t.y - 15, t.x + 6, t.y - 13);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(t.x - 0.6, t.y - 1);
        ctx.lineTo(t.x - 0.6, t.y - 11);
        ctx.stroke();
        ctx.lineCap = "butt";
      },
    };
  },

  fridge: (f) => {
    const [W, D] = sizeOf(f, 0.8, 0.6), H = 46, c = "#dfe6ea";
    return {
      W, D,
      parts: [
        part(0.03, 0.02, 0, W - 0.06, D - 0.04, 2, "#9aa6ad", "metal"),
        part(0, 0, 2, W, D, H - 2, c, "paint", { round: 3, paint: { front: (ctx, U, V) => {
          ctx.fillStyle = "rgba(90, 105, 115, 0.45)"; // the freezer door's edge
          ctx.fillRect(1, V * 0.3, U - 2, 1);
          ctx.fillStyle = "#c0554a"; // magnets, and a drawing held up by one
          ctx.fillRect(5, V * 0.42, 5, 5);
          ctx.fillStyle = "#fffaf0";
          ctx.save();
          ctx.translate(12, V * 0.44);
          ctx.rotate(0.06);
          ctx.fillRect(0, 0, 11, 13);
          ctx.fillStyle = "#e0a84c";
          ctx.beginPath();
          ctx.arc(5, 4.5, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#7a9e5c";
          ctx.fillRect(1.5, 9, 8, 2.5);
          ctx.restore();
          ctx.fillStyle = "#4a90a4";
          ctx.beginPath();
          ctx.arc(17, V * 0.44, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e0a84c";
          ctx.beginPath();
          ctx.arc(8, V * 0.12, 2, 0, Math.PI * 2);
          ctx.fill();
        } } }),
        part(W - 0.13, D + 0.005, H * 0.34, 0.04, 0.03, 12, "#9aa6ad", "metal"), // handles
        part(W - 0.13, D + 0.005, H * 0.78, 0.04, 0.03, 7, "#9aa6ad", "metal"),
        part(0.12, 0.12, H, 0.2, 0.12, 12, "#e0a84c", "paint", { paint: { front: (ctx, U, V) => { // a cereal box on top
          ctx.fillStyle = "#c0554a";
          ctx.fillRect(1.5, 2, U - 3, 4);
          ctx.fillStyle = "#fff4d0";
          ctx.beginPath();
          ctx.arc(U / 2, V * 0.65, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } } }),
      ],
    };
  },

  console: (f) => {
    const [W, D] = sizeOf(f, 1.6, 0.45), H = 26, c = WOOD;
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 3, c, 0.04, 0.07),
        part(0.08, 0.06, 4, W - 0.16, D - 0.1, 2, shadeColor(c, -4)), // the lower shelf
        part(0.18, 0.1, 6, 0.42, D - 0.16, 9, "#c49a5c", "wicker", { round: 2 }), // a basket on it
        part(W - 0.62, 0.1, 6, 0.42, D - 0.16, 9, "#b8906a", "wicker", { round: 2 }),
        part(0.06, 0.04, H - 10, W - 0.12, D - 0.06, 7, c, "wood", { paint: { front: (ctx, U, V) => {
          inset(ctx, U * 0.25, 1, U * 0.5, V - 2, c);
          drawKnob(ctx, U / 2, V / 2);
        } } }),
        part(-0.03, -0.02, H - 3, W + 0.06, D + 0.04, 3.5, shadeColor(c, 8)),
      ],
      after: (ctx, P) => {
        modelLamp(ctx, P(0.3, D * 0.5, H + 0.5));
        const v = P(W - 0.35, D * 0.5, H + 0.5); // a vase of flowers
        ctx.fillStyle = "#6f8a6a";
        ctx.beginPath();
        ctx.roundRect(v.x - 4, v.y - 11, 8, 11, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(v.x - 2.5, v.y - 9, 1.2, 6);
        ctx.strokeStyle = "#4f7a48";
        ctx.lineWidth = 1.1;
        for (const [fx, fy, color] of [[-5, -20, "#e37aa0"], [0, -23, "#f3e6d0"], [5, -19, "#e0a84c"], [-2, -17, "#c86bb0"]]) {
          ctx.beginPath();
          ctx.moveTo(v.x, v.y - 10);
          ctx.lineTo(v.x + fx, v.y + fy);
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(v.x + fx, v.y + fy, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 240, 150, 0.9)";
          ctx.beginPath();
          ctx.arc(v.x + fx, v.y + fy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        const k = P(W * 0.55, D * 0.55, H + 0.5); // a little bowl for keys
        ctx.fillStyle = "#d9825b";
        ctx.beginPath();
        ctx.ellipse(k.x, k.y - 2, 6, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e0b84c";
        ctx.fillRect(k.x - 2, k.y - 4, 3, 1.5);
      },
    };
  },

  grandfatherClock: (f) => {
    const [W, D] = sizeOf(f, 0.75, 0.45), c = "#6b4630";
    const win = { x0: 0.2, x1: W - 0.2, z0: 12, z1: 46 };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 7, shadeColor(c, -14)),
        part(0.07, 0.04, 7, W - 0.14, D - 0.06, 43, c, "wood", { paint: { front: (ctx, U, V) => inset(ctx, 3, 3, U - 6, V - 6, c) } }),
        part(0.02, 0, 50, W - 0.04, D, 22, c, "wood", { paint: { front: (ctx, U, V) => inset(ctx, 2, 2, U - 4, V - 4, c) } }),
        part(-0.03, -0.02, 72, W + 0.06, D + 0.04, 3, shadeColor(c, -20)),
        part(0.12, 0.04, 75, W - 0.24, D - 0.08, 3, shadeColor(c, -8)),
      ],
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        // The face, showing the real time.
        const o = P(W / 2, D, 61);
        ctx.fillStyle = "#f7f1e6";
        ctx.beginPath();
        ctx.arc(o.x, o.y, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c9a24a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#5c4530";
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ctx.fillRect(o.x + Math.cos(a) * 7 - 0.4, o.y + Math.sin(a) * 7 - 0.4, 0.8, 0.8);
        }
        const now = new Date();
        const hand = (turn, len, width) => {
          const a = turn * Math.PI * 2 - Math.PI / 2;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.x + Math.cos(a) * len, o.y + Math.sin(a) * len);
          ctx.stroke();
        };
        ctx.strokeStyle = "#2b2b2b";
        hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 4.5, 1.4);
        hand((now.getMinutes() + now.getSeconds() / 60) / 60, 6.5, 1);
        // The pendulum behind its glass window, one tick a second.
        const a = P(win.x0, D, win.z1), b = P(win.x1, D, win.z0);
        const w = b.x - a.x, h = b.y - a.y;
        ctx.fillStyle = "#3a2618";
        ctx.fillRect(a.x, a.y, w, h);
        const room = w / 2 - 4.5, arm = h - 8;
        const reach = Math.min(0.35, Math.asin(Math.max(0, Math.min(1, room / arm))));
        const swing = Math.sin((performance.now() / 1000) * Math.PI) * reach;
        ctx.save();
        ctx.beginPath();
        ctx.rect(a.x, a.y, w, h);
        ctx.clip();
        ctx.translate(a.x + w / 2, a.y);
        ctx.rotate(swing);
        ctx.strokeStyle = "#c9a24a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, h - 8);
        ctx.stroke();
        ctx.fillStyle = "#e0b84c";
        ctx.beginPath();
        ctx.arc(0, h - 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 250, 220, 0.6)";
        ctx.beginPath();
        ctx.arc(-1, h - 7, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(210, 230, 240, 0.18)"; // the glass
        ctx.fillRect(a.x, a.y, w, h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(a.x + 2, a.y + 1, 1.2, h - 2);
        ctx.strokeStyle = "#c9a24a";
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x + 0.5, a.y + 0.5, w - 1, h - 1);
      },
    };
  },

  candyCounter: (f) => {
    const [W, D] = sizeOf(f, 1.8, 0.6), c = "#8a4a2e";
    const candy = (ctx, U, V) => {
      const boxes = ["#e04a5a", "#f2c94c", "#5aa0d8", "#7ac07a", "#e98ac0", "#f28a3a"];
      ctx.fillStyle = "#5a2f1e";
      ctx.fillRect(0, 0, U, V);
      for (let i = 0, bx = 3; bx < U - 7; i++, bx += 8.5) {
        ctx.fillStyle = boxes[i % boxes.length];
        ctx.fillRect(bx, 3 + (i % 2) * 3, 7, 7);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillRect(bx + 1, 4 + (i % 2) * 3, 5, 1.2);
      }
    };
    return {
      W, D,
      parts: [
        part(0.02, 0.02, 0, W - 0.04, D - 0.04, 3, shadeColor(c, -25)),
        part(0, 0, 3, W, D - 0.02, 17, c, "wood"),
        part(0.08, D - 0.02, 5, W - 0.16, 0.03, 12, "#5a2f1e", "glass", { paint: { front: candy } }),
        part(-0.02, -0.02, 20, W + 0.04, D + 0.04, 2.5, shadeColor(c, 14), "wood"),
      ],
      after: (ctx, P) => {
        for (let i = 0; i < 3; i++) {
          const q = P(0.18 + i * 0.2, D * 0.5, 22.5);
          ctx.fillStyle = i === 1 ? "#5aa0d8" : "#e04a5a"; // soda cups
          ctx.beginPath();
          ctx.moveTo(q.x - 3.2, q.y - 11);
          ctx.lineTo(q.x + 3.2, q.y - 11);
          ctx.lineTo(q.x + 2.2, q.y);
          ctx.lineTo(q.x - 2.2, q.y);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(q.x - 2, q.y - 9, 1, 7);
          ctx.fillStyle = "#fffaf3";
          ctx.fillRect(q.x - 3.4, q.y - 12.5, 6.8, 2);
          ctx.fillRect(q.x + 0.5, q.y - 18, 1, 6);
        }
        const s = P(W - 0.45, D * 0.4, 22.5); // the SNACKS sign
        ctx.fillStyle = "#3a1f2a";
        ctx.beginPath();
        ctx.roundRect(s.x - 16, s.y - 13, 32, 12, 3);
        ctx.fill();
        ctx.fillStyle = "#ffcf6e";
        ctx.font = "700 7px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SNACKS", s.x, s.y - 4.5);
        ctx.textAlign = "left";
        ctx.fillStyle = "#e0b84c";
        for (let i = 0; i < 6; i++) ctx.fillRect(s.x - 14 + i * 5.6, s.y - 14.5, 1.6, 1.6);
      },
    };
  },

  studyTable: (f) => {
    const [W, D] = sizeOf(f, 2.4, 1.1), H = 24, c = "#8b5e3c";
    return {
      W, D,
      parts: [
        ...tableParts(W, D, H, c),
        ...openBook(0.2, D * 0.35, H + 0.5, "#3f6f9f"),
        ...openBook(W - 0.8, D * 0.3, H + 0.5, "#7a9e5c"),
        mug(W * 0.32, D * 0.4, H + 0.5, "#e8dcc8"),
        mug(W - 0.24, D * 0.45, H + 0.5, "#c0554a"),
        part(W * 0.56, D * 0.45, H + 0.5, 0.42, 0.26, 4, "#4a90a4", "book"),
        part(W * 0.57, D * 0.46, H + 4.5, 0.38, 0.24, 4, "#e0a84c", "book"),
        part(W * 0.58, D * 0.47, H + 8.5, 0.34, 0.22, 3.5, "#7a9e5c", "book"),
      ],
      after: (ctx, P) => modelLamp(ctx, P(W / 2, D * 0.35, H + 0.5)),
    };
  },

  table: (f) => {
    const [W, D] = sizeOf(f, 1.6, 1.4), H = 24, c = "#8b6b4a";
    return {
      W, D,
      parts: [
        ...tableParts(W, D, H, c),
        part(0.02, D / 2 - 0.17, H + 0.5, W - 0.04, 0.34, 0.8, "#c0554a", "fabric", { paint: { top: (ctx, U, V) => {
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(0, 2, U, 1);
          ctx.fillRect(0, V - 3, U, 1);
        } } }),
      ],
      after: (ctx, P) => {
        const plate = (q) => {
          ctx.fillStyle = "#f7f1e6";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 7.5, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(120, 90, 60, 0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = "rgba(120, 90, 60, 0.15)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 4.5, 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        };
        for (const [x, y] of [[W / 2, 0.2], [W / 2, D - 0.18], [0.24, D / 2], [W - 0.24, D / 2]]) plate(P(x, y, H + 0.5));
        const m = P(W / 2, D / 2, H + 1.3);
        ctx.fillStyle = "#e8dcc8"; // the fruit bowl
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, 15, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120, 90, 60, 0.35)";
        ctx.stroke();
        for (const [dx, dy, col] of [[-6, -3, "#c0554a"], [5, -4, "#e0a84c"], [0, 1, "#7a9e5c"], [-1, -6, "#9a5fb0"]]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(m.x + dx, m.y + dy, 4.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
          ctx.beginPath();
          ctx.arc(m.x + dx - 1.5, m.y + dy - 1.8, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const dx of [-0.48, 0.48]) drawCandle(ctx, P(W / 2 + dx, D / 2, H + 1.3).x, P(W / 2 + dx, D / 2, H + 1.3).y, 0);
      },
    };
  },

  readingTable: (f) => {
    const [W, D] = sizeOf(f, 2.2, 0.9), H = 22, c = "#5c3d2a";
    return {
      W, D,
      parts: [
        ...tableParts(W, D, H, c),
        ...openBook(0.24, D * 0.38, H + 0.5, "#8f2f2a"),
        ...openBook(W - 0.82, D * 0.38, H + 0.5, "#3f6f9f"),
        part(W / 2 - 0.2, D * 0.5, H + 0.5, 0.4, 0.24, 4, "#8f2f2a", "book"),
        part(W / 2 - 0.18, D * 0.51, H + 4.5, 0.36, 0.22, 4, "#c98a3c", "book"),
        part(W / 2 - 0.16, D * 0.52, H + 8.5, 0.32, 0.2, 3.5, "#3f6f9f", "book"),
      ],
      after: (ctx, P) => {
        bankersLamp(ctx, P(W * 0.33, D * 0.3, H + 0.5));
        bankersLamp(ctx, P(W * 0.67, D * 0.3, H + 0.5));
      },
    };
  },

  teaCart: (f) => {
    const [W, D] = sizeOf(f, 0.9, 0.6), H = 28, c = WOOD;
    return {
      W, D,
      parts: [
        ...legs(W, D, H, WOOD_DARK, 0.02, 0.06).map((p) => ({ ...p, z: 3, h: H - 3 })),
        part(0.02, 0.02, 7, W - 0.04, D - 0.04, 2, c), // the bottom shelf
        part(0, 0, H - 2, W, D, 2.5, c, "wood", { paint: { top: (ctx, U, V) => inset(ctx, 2, 2, U - 4, V - 4, c) } }),
        part(0, D - 0.03, H + 0.5, W, 0.03, 2.5, WOOD_DARK), // the tray's lip
        part(0, 0, H + 0.5, W, 0.03, 2.5, WOOD_DARK),
        part(0.3, 0.14, 9, 0.3, 0.3, 1.2, "#f7f1e6", "paint", { round: 5 }), // plates
        part(0.31, 0.15, 10.2, 0.28, 0.28, 1.2, "#e8dcc8", "paint", { round: 5 }),
        part(0.3, 0.14, 11.4, 0.3, 0.3, 1.2, "#f7f1e6", "paint", { round: 5 }),
        mug(W - 0.34, D * 0.4, H + 0.5, "#f7f1e6"),
        mug(W - 0.18, D * 0.45, H + 0.5, "#f7f1e6"),
      ],
      after: (ctx, P) => {
        for (const [x, y] of [[0.05, D - 0.05], [W - 0.05, D - 0.05]]) { // wheels
          const q = P(x, y, 0);
          ctx.fillStyle = "#3a2a22";
          ctx.beginPath();
          ctx.arc(q.x, q.y - 2.5, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#b8923a";
          ctx.beginPath();
          ctx.arc(q.x, q.y - 2.5, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        const t = P(0.26, D * 0.5, H + 0.5); // the teapot
        const g = ctx.createLinearGradient(0, t.y - 12, 0, t.y);
        g.addColorStop(0, "#6aa8bc");
        g.addColorStop(1, "#3a7a90");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(t.x, t.y - 5.5, 8, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(t.x - 2, t.y - 13.5, 4, 3);
        ctx.strokeStyle = "#3a7a90";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x + 7, t.y - 5);
        ctx.lineTo(t.x + 12, t.y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(t.x - 8.5, t.y - 6, 3, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.ellipse(t.x - 2.5, t.y - 8.5, 2.5, 1.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  },

  armchair: (f) => {
    const [W, D] = sizeOf(f, 1.1, 0.8), c = f.color || "#c98f3c", dark = shadeColor(c, -14), back = shadeColor(c, -8);
    return {
      W, D,
      parts: [
        ...[[0.06, 0.06], [W - 0.12, 0.06], [0.06, D - 0.12], [W - 0.12, D - 0.12]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 4, WOOD_DARK)),
        part(0.03, 0.03, 4, W - 0.06, D - 0.06, 6, dark, "fabric", { round: 3 }),
        part(0.05, 0, 4, W - 0.1, 0.3, 30, back, "fabric", { round: 7 }),
        part(0.2, 0.28, 10, W - 0.4, D - 0.3, 7, c, "fabric", { round: 5 }),
        part(0, 0.08, 4, 0.2, D - 0.08, 16, dark, "fabric", { round: 6 }),
        part(W - 0.2, 0.08, 4, 0.2, D - 0.08, 16, dark, "fabric", { round: 6 }),
        // A green knit blanket folded over the back, hanging down the front of it.
        part(W * 0.52, -0.01, 34, W * 0.28, 0.32, 1.5, "#6f8a6a", "knit"),
        part(W * 0.52, 0.3, 16, W * 0.28, 0.025, 19.5, "#5f7a5a", "knit", { fringe: true }),
      ],
    };
  },

  turntable: (f) => {
    const [W, D] = sizeOf(f, 1.1, 0.55), c = "#7a5238";
    const sleeves = (ctx, U, V) => {
      inset(ctx, 2, 2, U - 4, V - 4, c);
      ctx.fillStyle = "#3a2618";
      ctx.fillRect(4, 4, U - 8, V - 8);
      ["#d9825b", "#7a6bc8", "#3f6f9f", "#f2b84a", "#e07a8a", "#3f7a4a", "#c0554a", "#9ec7e0"].forEach((col, i) => {
        if (5 + i * 4.5 > U - 8) return;
        ctx.fillStyle = col;
        ctx.fillRect(5 + i * 4.5, 5 + (i % 3), 3.6, V - 10 - (i % 3));
      });
    };
    return {
      W, D,
      parts: [
        ...legs(W, D, 4, WOOD_DARK, 0.05, 0.07),
        part(0, 0, 4, W, D, 16, c, "wood", { paint: { front: sleeves } }),
        part(0.08, 0.04, 20, W - 0.16, D - 0.12, 3, "#3a2a22", "wood"),
      ],
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        const o = P(W * 0.42, (D - 0.08) / 2 + 0.04, 23);
        const r = Math.min((D - 0.12) * TILE, (W - 0.16) * TILE * 0.6) / 2 - 1;
        ctx.fillStyle = "#1c1618"; // the record
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; // grooves
        ctx.lineWidth = 0.6;
        for (const k of [0.55, 0.75]) {
          ctx.beginPath();
          ctx.ellipse(o.x, o.y, r * k, r * k * 0.8, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        const spin = performance.now() / 600; // a glint going round
        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, r * 0.85, r * 0.68, 0, spin, spin + 0.6);
        ctx.stroke();
        ctx.fillStyle = globalThis.myLofiColor || "#d9825b"; // the label
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, r * 0.3, r * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        const arm = P(W - 0.14, 0.1, 23); // the tonearm
        ctx.strokeStyle = "#c9c2b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(arm.x, arm.y);
        ctx.lineTo(arm.x - 3, o.y + 2);
        ctx.lineTo(o.x + r * 0.55, o.y + 1);
        ctx.stroke();
        ctx.fillStyle = "#e0b84c";
        ctx.beginPath();
        ctx.arc(arm.x, arm.y, 2, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  },

  popcorn: (f) => {
    const [W, D] = sizeOf(f, 0.6, 0.5), c = "#b8322a";
    const corn = (ctx, U, V) => {
      ctx.fillStyle = "rgba(255, 250, 235, 0.25)";
      ctx.fillRect(0, 0, U, V);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = i % 4 ? "#f7e6a8" : "#fff4d0";
        ctx.beginPath();
        ctx.arc(2 + ((i * 7.3) % (U - 4)), V - 3 - Math.floor(i / 6) * 3.2 - (i % 2), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 20, c, "paint", { paint: { front: (ctx, U) => {
          ctx.fillStyle = "#e0b84c";
          ctx.fillRect(0, 3, U, 2);
          ctx.fillRect(0, 15, U, 1.5);
        } } }),
        part(0.06, 0.08, 20, W - 0.12, D - 0.16, 26, "#f7e6a8", "glass", { paint: { front: corn, left: corn, right: corn, back: corn } }),
        part(0.03, 0.05, 46, W - 0.06, D - 0.1, 3, c, "paint"),
      ],
      after: (ctx, P) => {
        const a = P(0.03, D / 2, 49), b = P(W - 0.03, D / 2, 49), top = P(W / 2, D / 2, 57);
        ctx.fillStyle = c; // the little roof
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(top.x, top.y);
        ctx.lineTo(b.x, b.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e0b84c";
        ctx.beginPath();
        ctx.arc(top.x, top.y - 1, 2, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  },
}, { facing: { theaterSeat: "back", cinemaSofa: "back" } });
