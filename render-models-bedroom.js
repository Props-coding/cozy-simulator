// Bedroom furniture and Nest & Nook pieces as models (art night, batch 3):
// see render-models.js for how models work. The fish tank keeps its
// swimming fish, bubbles and swaying weeds drawn live, and the record
// player its spinning record (it's the Study turntable's model).

registerModels({
  // Every bedroom's nightstand: a drawer, an open cubby with a folded
  // blanket, a lamp, and (for the starter one) your journal on top.
  nightstand: (f) => {
    const [W, D] = sizeOf(f, 0.55, 0.45), H = 18, c = "#7a5238";
    const parts = [
      ...legs(W, D, 3, WOOD_DARK, 0.03, 0.06),
      part(0, 0, 3, W, D, H - 3, c, "wood", { paint: { front: (ctx, U, V) => {
        inset(ctx, 2, 2, U - 4, V * 0.42, c);
        ctx.fillStyle = "#d4ad52";
        ctx.beginPath();
        ctx.arc(U / 2, V * 0.23, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a2618"; // the cubby below, with a folded blanket
        ctx.fillRect(2.5, V * 0.52, U - 5, V * 0.4);
        ctx.fillStyle = "#c98a8a";
        ctx.fillRect(4, V * 0.66, U - 8, V * 0.26);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(4, V * 0.66, U - 8, 1);
      } } }),
      part(-0.02, -0.01, H, W + 0.04, D + 0.02, 2.5, shadeColor(c, 10)),
    ];
    if (f.journal) parts.push(part(0.04, D * 0.35, H + 2.5, 0.27, 0.16, 1.8, "#8c3b46", "book", { paint: { top: (ctx, U, V) => {
      ctx.fillStyle = "#e0b84c"; // a ribbon bookmark and a little stitched heart
      ctx.fillRect(U * 0.6, 0, 1, V);
      ctx.fillStyle = "rgba(255, 220, 220, 0.7)";
      ctx.beginPath();
      ctx.arc(U * 0.3 - 1, V * 0.45, 1.2, 0, Math.PI * 2);
      ctx.arc(U * 0.3 + 1, V * 0.45, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } } }));
    return { W, D, parts, after: (ctx, P) => modelLamp(ctx, P(W * 0.66, D * 0.5, H + 2.5)) };
  },

  // A white vanity on tapered legs: a drawer with a gold handle, a round
  // mirror ringed with bulbs, a perfume bottle and a lipstick.
  vanity: (f) => {
    const [W, D] = sizeOf(f, 1.2, 0.5), H = 22, c = "#f2ece2";
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 3, "#e6d9c6", 0.05, 0.06).map((p) => ({ ...p, mat: "paint" })),
        part(0.04, 0.03, H - 9, W - 0.08, D - 0.05, 6, c, "paint", { paint: { front: (ctx, U, V) => {
          inset(ctx, U * 0.2, 1, U * 0.6, V - 2, c);
          ctx.fillStyle = "#c9a24a";
          ctx.fillRect(U / 2 - 5, V / 2 - 0.8, 10, 1.6);
        } } }),
        part(-0.02, -0.01, H - 3, W + 0.04, D + 0.02, 3, shadeColor(c, 4), "paint"),
        part(0.12, D * 0.5, H, 0.08, 0.08, 7, "#e37aa0", "paint", { round: 1.5 }),
        part(W - 0.2, D * 0.55, H, 0.05, 0.05, 6, "#b69ad8", "metal"),
      ],
      after: (ctx, P) => {
        const m = P(W / 2, 0.12, H + 15);
        ctx.fillStyle = "#c9a24a";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#8a6a28";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        const g = ctx.createLinearGradient(0, m.y - 12, 0, m.y + 12);
        g.addColorStop(0, "#eef4f7");
        g.addColorStop(1, "#d0dde5");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.fillRect(m.x - 6, m.y - 7, 2, 10);
        ctx.fillRect(m.x - 2.5, m.y - 8, 1, 6);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          ctx.fillStyle = "#fff4c8";
          ctx.beginPath();
          ctx.arc(m.x + Math.cos(a) * 15, m.y + Math.sin(a) * 15, 1.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(200, 160, 60, 0.6)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      },
    };
  },

  // A low coffee table: a lower shelf with magazines, a book, a mug and a
  // little candle on top.
  coffeeTable: (f) => {
    const [W, D] = sizeOf(f, 1.2, 0.6), H = 12, c = "#8b5e3c";
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 2.5, c, 0.04, 0.07),
        part(0.07, 0.07, 2, W - 0.14, D - 0.14, 1.5, shadeColor(c, -6)),
        part(0.2, 0.14, 3.5, 0.34, 0.26, 1, "#4a90a4", "paint"), // magazines
        part(0.24, 0.16, 4.5, 0.3, 0.22, 1, "#e0a84c", "paint"),
        part(-0.02, -0.02, H - 2.5, W + 0.04, D + 0.04, 3, shadeColor(c, 6)),
        part(0.12, D * 0.3, H + 0.5, 0.32, 0.22, 3, "#c0554a", "book"),
        mug(W / 2 - 0.06, D * 0.35, H + 0.5, "#f2ece2"),
      ],
      live: (ctx, P) => { // (the candle flickers)
        const q = P(W - 0.2, D * 0.55, H + 0.5);
        drawCandle(ctx, q.x, q.y, performance.now() / 1000);
      },
    };
  },

  // An upright piano in polished dark wood: a tall back with a music
  // stand and sheet music, the keys, two legs, brass pedals and a candle.
  piano: (f) => {
    const [W, D] = sizeOf(f, 1.4, 0.6), c = "#3a2a24";
    const keys = (ctx, U, V) => {
      ctx.fillStyle = "#f7f4ee";
      ctx.fillRect(2, 2, U - 4, V - 3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      for (let x = 2 + 4.5; x < U - 2; x += 4.5) ctx.fillRect(x, 2, 0.5, V - 3);
      ctx.fillStyle = "#2b2b2b";
      for (let i = 0, x = 5; x < U - 4; i++, x += 4.5) if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(x, 2, 2.2, (V - 3) * 0.58);
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, 0.3, 46, c, "wood", { paint: { front: (ctx, U, V) => {
          inset(ctx, 4, 4, U - 8, V * 0.4, c);
          ctx.fillStyle = "#f4ecdc"; // sheet music on its stand
          ctx.fillRect(U / 2 - 11, V * 0.1, 22, 14);
          ctx.fillStyle = "rgba(40, 30, 20, 0.5)";
          for (let i = 0; i < 4; i++) ctx.fillRect(U / 2 - 9, V * 0.1 + 3 + i * 2.7, 18, 0.6);
          ctx.fillStyle = "#6b4a30";
          ctx.fillRect(U / 2 - 13, V * 0.1 + 14, 26, 1.5);
          inset(ctx, 4, V * 0.62, U - 8, V * 0.34, c);
        } } }),
        part(0.02, 0.3, 14, W - 0.04, D - 0.34, 8, c, "wood", { paint: { top: keys } }),
        part(0.06, D - 0.1, 0, 0.08, 0.08, 14, shadeColor(c, 8)),
        part(W - 0.14, D - 0.1, 0, 0.08, 0.08, 14, shadeColor(c, 8)),
        part(-0.02, -0.02, 46, W + 0.04, 0.34, 2.5, shadeColor(c, 12)),
      ],
      after: (ctx, P) => {
        for (const dx of [-5, 0, 5]) { // brass pedals
          const p = P(W / 2, 0.3, 2);
          ctx.fillStyle = "#d4ad52";
          ctx.fillRect(p.x + dx - 1.5, p.y - 1, 3, 2);
        }
      },
      live: (ctx, P) => { // (the candle flickers)
        const q = P(0.18, 0.15, 48.5);
        drawCandle(ctx, q.x, q.y, performance.now() / 1000 + 3);
      },
    };
  },

  // A painted toy chest with a star, brass corners, and a toy boat and a
  // teddy's ear peeking out under the lid.
  toyChest: (f) => {
    const [W, D] = sizeOf(f, 0.9, 0.5), c = "#c0664a";
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 15, c, "paint", { paint: { front: (ctx, U, V) => {
          ctx.fillStyle = "#f2d45c";
          const sx = U / 2, sy = V / 2 + 1;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 2.2 : 5, a = -Math.PI / 2 + (i * Math.PI) / 5;
            ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#d4ad52"; // brass corners
          for (const x of [0, U - 3]) {
            ctx.fillRect(x, 0, 3, 3);
            ctx.fillRect(x, V - 3, 3, 3);
          }
        } } }),
        part(-0.02, -0.02, 15, W + 0.04, D + 0.04, 3.5, shadeColor(c, 14), "paint"),
      ],
      after: (ctx, P) => {
        const b = P(0.2, D * 0.4, 18.5); // the boat
        ctx.fillStyle = "#6fa8c8";
        ctx.fillRect(b.x, b.y - 4, 10, 4);
        ctx.fillStyle = "#f7f4ee";
        ctx.beginPath();
        ctx.moveTo(b.x + 5, b.y - 4);
        ctx.lineTo(b.x + 5, b.y - 13);
        ctx.lineTo(b.x + 11, b.y - 6);
        ctx.closePath();
        ctx.fill();
        const e = P(W - 0.25, D * 0.4, 18.5); // a teddy's ear
        ctx.fillStyle = "#b07c50";
        ctx.beginPath();
        ctx.arc(e.x, e.y - 2, 3.5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#e8c8a0";
        ctx.beginPath();
        ctx.arc(e.x, e.y - 2, 1.8, Math.PI, 0);
        ctx.fill();
      },
    };
  },

  // A slatted wooden crate full of records standing in their sleeves.
  recordCrate: (f) => {
    const [W, D] = sizeOf(f, 0.7, 0.5), c = "#b08a60";
    const colors = ["#e37aa0", "#3f6f9f", "#f2d45c", "#7a9e5c", "#c0554a", "#9a6fb0", "#2b2b30"];
    const sleeves = colors.map((color, i) => part(0.06 + (i * (W - 0.12)) / colors.length, 0.08, 2, (W - 0.12) / colors.length - 0.01, D - 0.16, 17 + (i % 3) * 1.5, color, "paint", { paint: { front: (ctx, U, V) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(0, 0, U, 1.2);
    } } }));
    const slats = (ctx, U, V) => {
      ctx.fillStyle = "rgba(60, 35, 15, 0.45)";
      for (let y = V / 3; y < V; y += V / 3) ctx.fillRect(0, y - 0.6, U, 1.2);
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, 0.04, 14, c, "wood", { paint: { back: slats } }),
        part(0, 0, 0, W, D, 2, shadeColor(c, -10)),
        ...sleeves,
        part(0, D - 0.04, 0, W, 0.04, 14, c, "wood", { paint: { front: slats } }),
        part(0, 0, 0, 0.04, D, 14, c, "wood", { paint: { left: slats } }),
        part(W - 0.04, 0, 0, 0.04, D, 14, c, "wood", { paint: { right: slats } }),
      ],
    };
  },

  // A cottage armchair in plum velvet, a mustard knitted throw over its
  // right arm, and a ginger cat asleep on the seat (breathing, drawn live).
  cottageChair: (f) => {
    const [W, D] = sizeOf(f, 1.0, 0.8), c = "#6e3a58", dark = "#5e2f4a";
    return {
      W, D,
      parts: [
        ...[[0.06, 0.06], [W - 0.12, 0.06], [0.06, D - 0.12], [W - 0.12, D - 0.12]].map(([x, y]) => part(x, y, 0, 0.06, 0.06, 4, WOOD_DARK)),
        part(0.03, 0.03, 4, W - 0.06, D - 0.06, 6, dark, "fabric", { round: 3 }),
        part(0.05, 0, 4, W - 0.1, 0.26, 30, dark, "fabric", { round: 7, paint: { front: (ctx, U, V) => {
          ctx.fillStyle = shadeColor(dark, -25); // buttons tufted into the back
          for (const [x, y] of [[0.3, 0.3], [0.5, 0.3], [0.7, 0.3], [0.4, 0.55], [0.6, 0.55]]) {
            ctx.beginPath();
            ctx.arc(U * x, V * y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        } } }),
        part(0.19, 0.24, 10, W - 0.38, D - 0.26, 6, c, "fabric", { round: 5 }),
        part(0, 0.08, 4, 0.19, D - 0.08, 15, dark, "fabric", { round: 6 }),
        part(W - 0.19, 0.08, 4, 0.19, D - 0.08, 15, dark, "fabric", { round: 6 }),
        part(W - 0.22, 0.06, 19, 0.25, D - 0.04, 1.5, "#d9a441", "knit"), // the throw over the arm
        part(W - 0.22, D - 0.01, 4, 0.25, 0.025, 16.5, "#c9953a", "knit", { fringe: true }),
      ],
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        const s = P(W / 2, D - 0.08, 16);
        drawSleepingCat(ctx, s.x, s.y, "#e8a15a", performance.now() / 1000 + 1.3, 0.85);
      },
    };
  },

  // The record player: the Study turntable's cabinet and deck, with a red
  // label on the spinning record.
  recordPlayer: (f) => MODELS.turntable({ ...f, label: "#c0554a" }),

  // A brass bar cart: two cream shelves, little wheels, a pink teapot, cups
  // and a little plant on top, books and an orange tin below.
  barCart: (f) => {
    const [W, D] = sizeOf(f, 0.8, 0.45), brass = "#c9a24a";
    return {
      W, D,
      parts: [
        ...legs(W, D, 26, brass, 0.02, 0.04).map((p) => ({ ...p, z: 3, h: 24, mat: "metal", color: brass })),
        part(0, 0, 10, W, D, 2.5, "#f2e4c4", "paint"),
        part(0, 0, 25, W, D, 2.5, "#f2e4c4", "paint"),
        part(0.1, D * 0.3, 27.5, 0.1, 0.1, 5, "#fffaf3", "paint", { round: 1.5 }),
        part(0.24, D * 0.35, 27.5, 0.1, 0.1, 5, "#fffaf3", "paint", { round: 1.5 }),
        part(W - 0.3, D * 0.3, 12.5, 0.14, 0.12, 5, "#e8913a", "metal"), // an orange tin and books below
        part(0.1, D * 0.25, 12.5, 0.3, 0.22, 3, "#3f6f9f", "book"),
        part(0.12, D * 0.27, 15.5, 0.26, 0.2, 3, "#e0a84c", "book"),
      ],
      after: (ctx, P) => {
        for (const x of [0.04, W - 0.04]) {
          const w = P(x, D - 0.04, 0);
          ctx.fillStyle = "#3a3a40";
          ctx.beginPath();
          ctx.arc(w.x, w.y - 2.5, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        const t = P(W - 0.25, D * 0.5, 27.5); // the pink teapot
        ctx.fillStyle = "#f7c6d6";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y - 5, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d898a8";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillRect(t.x + 5, t.y - 8, 4, 1.5);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        ctx.ellipse(t.x - 2, t.y - 7, 2, 1, -0.4, 0, Math.PI * 2);
        ctx.fill();
        modelPlant(ctx, P(0.42, D * 0.55, 27.5), 0.55, 5);
      },
    };
  },

  // A fish tank on a wooden cabinet: the fish you've caught (or two little
  // starter fish) swimming about, weeds swaying, bubbles rising.
  fishTank: (f) => {
    const [W, D] = sizeOf(f, 0.9, 0.5), c = "#5c3d2a";
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 16, c, "wood", { paint: { front: (ctx, U, V) => {
          inset(ctx, 2, 2, U / 2 - 3, V - 4, c);
          inset(ctx, U / 2 + 1, 2, U / 2 - 3, V - 4, c);
        } } }),
        part(-0.02, -0.02, 16, W + 0.04, D + 0.04, 2, shadeColor(c, 10)),
      ],
      live: (ctx, P, facing, piece) => {
        if (facing !== "front") return;
        const a = P(0.04, D * 0.75, 18), b = P(W - 0.04, D * 0.75, 18);
        const x = a.x, w = b.x - a.x, bottom = a.y, h = 26, top = bottom - h;
        const water = ctx.createLinearGradient(0, top, 0, bottom);
        water.addColorStop(0, "rgba(140, 200, 230, 0.85)");
        water.addColorStop(1, "rgba(60, 130, 170, 0.9)");
        ctx.fillStyle = water;
        ctx.fillRect(x, top, w, h);
        ctx.fillStyle = "#e9dcb8"; // sand, with a few pebbles
        ctx.fillRect(x, bottom - 4, w, 4);
        for (const [px, col] of [[0.2, "#b8a890"], [0.45, "#8a9aa0"], [0.8, "#c9b08a"]]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(x + w * px, bottom - 3, 2, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const t = performance.now() / 1000;
        ctx.strokeStyle = "#4f8a4a"; // water plants
        ctx.lineWidth = 2;
        for (const px of [x + 5, x + w - 7]) {
          ctx.beginPath();
          ctx.moveTo(px, bottom - 3);
          ctx.quadraticCurveTo(px + Math.sin(t * 1.5 + px) * 3, bottom - 12, px + 1, bottom - 18);
          ctx.stroke();
        }
        const caught = Array.isArray(piece.fish) && piece.fish.length
          ? piece.fish.map((id, i) => [CONFIG.fish.find((fish) => fish.id === id)?.color ?? "#f2a03a", 0.3 + ((i * 0.13) % 0.35), 0.25 + ((i * 0.37) % 0.55), i * 1.7])
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
          ctx.fillStyle = "#1e1a18";
          ctx.fillRect(fx + dir * 1.8 - 0.5, fy - 0.8, 1, 1);
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
        ctx.fillStyle = "#2b2b30"; // the lid
        ctx.fillRect(x - 1, top - 3, w + 2, 3);
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(x - 1, top - 3, w + 2, 0.8);
      },
    };
  },
});
