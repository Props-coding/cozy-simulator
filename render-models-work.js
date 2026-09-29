// The business floor's work furniture, and the yard's bait crate, as models
// (art night, batch 4): see render-models.js for how models work. The
// Workshop's done jar still fills up live as the house finishes cards.

registerModels({
  // The Conference Room's long table on sturdy legs: laptops open along the
  // back, notepads and pens in front, water glasses and a plant.
  conferenceTable: (f) => {
    const [W, D] = sizeOf(f, 4.0, 1.4), H = 24, c = "#6b4a32";
    const laptop = (x) => [
      part(x, 0.18, H + 0.5, 0.56, 0.3, 1.5, "#c8ccd2", "metal", { paint: { top: (ctx, U, V) => {
        ctx.fillStyle = "rgba(60, 60, 70, 0.3)";
        for (let i = 0; i < 3; i++) ctx.fillRect(3, 2 + i * 2.6, U - 6, 1.1);
      } } }),
      part(x, 0.14, H + 0.5, 0.56, 0.04, 16, "#9aa2aa", "metal", { round: 1.5, paint: { front: (ctx, U, V) => {
        const g = ctx.createLinearGradient(0, 2, 0, V - 2);
        g.addColorStop(0, "#9fd0ea");
        g.addColorStop(1, "#5f97c0");
        ctx.fillStyle = g;
        ctx.fillRect(2, 2, U - 4, V - 4);
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // a slide on screen
        ctx.fillRect(5, 5, U * 0.5, 2);
        ctx.fillRect(5, 9, U * 0.35, 1.5);
      } } }),
    ];
    const notepad = (x) => [
      part(x, D - 0.46, H + 0.5, 0.32, 0.3, 1, "#f4ecd2", "pages", { paint: { top: (ctx, U, V) => {
        ctx.fillStyle = "rgba(90, 120, 160, 0.35)";
        for (let y = 3; y < V - 1; y += 2.6) ctx.fillRect(2, y, U - 4, 0.6);
        ctx.fillStyle = "#c0554a";
        ctx.fillRect(3, 0, 0.8, V);
      } } }),
      part(x + 0.36, D - 0.44, H + 0.5, 0.04, 0.26, 1.2, "#3f6f9f", "metal"),
    ];
    return {
      W, D,
      parts: [
        ...tableParts(W, D, H, c, 0.2),
        ...laptop(W * 0.15), ...laptop(W * 0.7),
        ...notepad(W * 0.2), ...notepad(W * 0.68),
      ],
      after: (ctx, P) => {
        for (const x of [0.12, 0.56, 0.9]) { // water glasses
          const g = P(W * x, D * 0.5, H + 0.5);
          ctx.fillStyle = "rgba(200, 230, 245, 0.6)";
          ctx.fillRect(g.x - 3, g.y - 9, 6, 9);
          ctx.fillStyle = "rgba(120, 180, 210, 0.45)";
          ctx.fillRect(g.x - 3, g.y - 5, 6, 5);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctx.lineWidth = 0.7;
          ctx.strokeRect(g.x - 3, g.y - 9, 6, 9);
        }
        modelPlant(ctx, P(W / 2, D * 0.45, H + 0.5), 0.8, 11);
      },
    };
  },

  // The Workshop's workbench: a thick butcher-block top on sturdy legs, a
  // shelf of offcuts below, a vise, a hammer and a pencil, and the done jar.
  workbench: (f) => {
    const [W, D] = sizeOf(f, 3.0, 0.75), H = 26, c = "#a0703e";
    const block = (ctx, U, V) => { // butcher-block strips
      ctx.fillStyle = "rgba(60, 35, 15, 0.18)";
      for (let y = 4; y < V; y += 4.5) ctx.fillRect(0, y, U, 0.8);
    };
    return {
      W, D,
      parts: [
        ...legs(W, D, H - 5, "#6b4630", 0.08, 0.1),
        part(0.12, 0.1, 4, W - 0.24, D - 0.2, 2, "#6b4630"), // the shelf underneath
        part(0.4, 0.2, 6, 0.6, 0.2, 3, "#d9b98a"), // offcuts on it
        part(0.5, 0.25, 9, 0.5, 0.16, 2.5, "#c49a5c"),
        part(W * 0.45, 0.18, 6, 0.36, 0.3, 7, "#5c7a9a", "paint"), // a paint tin
        part(-0.02, -0.02, H - 5, W + 0.04, D + 0.04, 5, c, "wood", { paint: { top: block, front: block } }),
        part(0.1, 0.1, H, 0.3, 0.26, 6, "#8a8f96", "metal"), // the vise
        part(0.16, 0.14, H + 6, 0.18, 0.18, 3, "#5f656c", "metal"),
        part(0.7, D * 0.4, H, 0.5, 0.12, 2.5, "#d9b98a"), // an offcut on top
      ],
      after: (ctx, P) => {
        const h = P(W * 0.45, D * 0.55, H); // a hammer
        ctx.fillStyle = "#8a5a36";
        ctx.fillRect(h.x - 9, h.y - 2.5, 16, 2.4);
        ctx.fillStyle = "#6a7078";
        ctx.fillRect(h.x + 6, h.y - 4.5, 3, 6.5);
        const p = P(W * 0.6, D * 0.35, H); // a pencil
        ctx.fillStyle = "#f2c94c";
        ctx.fillRect(p.x, p.y - 1.5, 10, 1.6);
        ctx.fillStyle = "#e8c8a0";
        ctx.fillRect(p.x + 10, p.y - 1.5, 2, 1.6);
      },
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        // The done jar, on the right end, filling up with finished cards.
        const base = P(W - 0.35, D * 0.55, H);
        const jx = base.x - 8, jb = base.y, jw = 16, jh = 22;
        const done = globalThis.kanbanJar ?? 0;
        const fill = Math.min(1, done / 40); // full after 40 finished cards
        const colors = ["#f2a0b8", "#fff2a8", "#a8d8e8", "#c8b0e8", "#b9e0a4", "#f7c68a"];
        ctx.save();
        ctx.beginPath();
        ctx.rect(jx + 1, jb - jh + 4, jw - 2, jh - 5);
        ctx.clip();
        const level = jb - 1 - (jh - 6) * fill;
        for (let i = 0; i < Math.min(done, 80); i++) {
          const sx = jx + 3 + noise(i * 2.3) * (jw - 6), sy = jb - 3 - noise(i * 4.1) * (jb - 3 - level);
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        }
        ctx.restore();
        ctx.fillStyle = "rgba(200, 225, 235, 0.35)"; // the glass
        roundRectPath(ctx, jx, jb - jh + 3, jw, jh - 3, 3);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; // shine
        ctx.fillRect(jx + 2, jb - jh + 6, 1.5, jh - 10);
        ctx.fillStyle = "#c9a24a"; // lid
        ctx.fillRect(jx - 1, jb - jh, jw + 2, 4);
        ctx.fillStyle = "rgba(255, 245, 200, 0.5)";
        ctx.fillRect(jx - 1, jb - jh, jw + 2, 1);
        ctx.fillStyle = "#fffaf3"; // its label
        ctx.fillRect(jx + 3, jb - 11, jw - 6, 5);
        ctx.fillStyle = "#5c4530";
        ctx.font = "700 4px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DONE", jx + jw / 2, jb - 7.5);
        ctx.textAlign = "left";
      },
    };
  },

  // A red metal toolbox: a lid with a lit edge, two latches and a handle.
  toolbox: (f) => {
    const [W, D] = sizeOf(f, 0.7, 0.4), c = "#c0403a";
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 10, c, "paint", { round: 1.5, paint: { front: (ctx, U, V) => {
          ctx.fillStyle = "#d9d9d9"; // latches
          for (const x of [U * 0.25, U * 0.75]) ctx.fillRect(x - 2.5, 0.5, 5, 3.5);
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.fillRect(2, V - 4, U - 4, 1);
        } } }),
        part(-0.01, -0.01, 10, W + 0.02, D + 0.02, 4, shadeColor(c, 10), "paint", { round: 1.5 }),
      ],
      after: (ctx, P) => {
        const h = P(W / 2, D / 2, 14);
        ctx.strokeStyle = "#3a3a40"; // the handle
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(h.x - 7, h.y);
        ctx.lineTo(h.x - 7, h.y - 5);
        ctx.lineTo(h.x + 7, h.y - 5);
        ctx.lineTo(h.x + 7, h.y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(h.x - 6, h.y - 5.6);
        ctx.lineTo(h.x + 6, h.y - 5.6);
        ctx.stroke();
      },
    };
  },

  // An arcade cabinet: painted sides with stars, a glowing marquee, the
  // screen (a little game plays on it, live), a control ledge with a
  // stick and buttons, and a coin door.
  arcade: (f) => {
    const [W, D] = sizeOf(f, 0.7, 0.6), c = "#3f4f8a";
    const stars = (ctx, U, V) => {
      ctx.fillStyle = "rgba(255, 220, 120, 0.55)";
      for (let i = 0; i < 6; i++) {
        const x = noise(i * 3.1) * U, y = noise(i * 5.7) * V;
        ctx.fillRect(x - 1.5, y - 0.4, 3, 0.8);
        ctx.fillRect(x - 0.4, y - 1.5, 0.8, 3);
      }
      ctx.fillStyle = "#e37aa0"; // a racing stripe
      ctx.fillRect(0, V * 0.55, U, 2);
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 56, c, "paint", { paint: { left: stars, right: stars, top: (ctx, U, V) => {
          stars(ctx, U, V); // (the top is painted like the sides)
          ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
          ctx.fillRect(0, 0, U, 2);
        }, front: (ctx, U, V) => {
          ctx.fillStyle = "#e37aa0"; // the marquee, lit from inside
          ctx.fillRect(3, 3, U - 6, 8);
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.fillRect(3, 3, U - 6, 2);
          ctx.fillStyle = "#fff4f8";
          ctx.font = "800 5px 'Quicksand', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("PLAY", U / 2, 9.5);
          ctx.textAlign = "left";
          ctx.fillStyle = "#1a1a24"; // the screen's bezel
          ctx.fillRect(4, 13, U - 8, 18);
          ctx.fillStyle = "#2b2b30"; // the coin door
          ctx.fillRect(U / 2 - 5, V - 14, 10, 9);
          ctx.fillStyle = "#f2d45c";
          ctx.fillRect(U / 2 - 1, V - 12, 2, 4);
        } } }),
        part(-0.02, D - 0.02, 22, W + 0.04, 0.16, 4, "#2b2b30", "paint"), // the control ledge
      ],
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        const a = P(0, D, 56), x = a.x + 6, y = a.y + 15, w = W * TILE - 12, h = 14;
        const t = performance.now() / 1000;
        ctx.fillStyle = "#101820";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#6fe0a8"; // the player
        ctx.fillRect(x + 2 + ((t * 10) % (w - 6)), y + 8, 3, 3);
        ctx.fillStyle = "#f2d45c"; // a coin
        ctx.fillRect(x + w - 6, y + 3, 2, 2);
        ctx.fillStyle = "#e04a5a"; // a ghost
        ctx.fillRect(x + ((t * 6 + 20) % (w - 4)), y + 3, 3, 3);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // scanlines and glass
        for (let yy = y; yy < y + h; yy += 2) ctx.fillRect(x, yy, w, 0.6);
        const l = P(0, D + 0.1, 26); // the stick and buttons on the ledge
        ctx.fillStyle = "#3a3a40";
        ctx.fillRect(l.x + 7, l.y - 5, 1.2, 5);
        ctx.fillStyle = "#c0554a";
        ctx.beginPath();
        ctx.arc(l.x + 7.6, l.y - 5.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f2d45c";
        for (const dx of [W * TILE - 12, W * TILE - 7]) {
          ctx.beginPath();
          ctx.ellipse(l.x + dx, l.y - 1.5, 1.8, 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    };
  },

  // Otis's bait stand: a slatted crate with a painted BAIT sign, a cooler
  // on top and a bucket of wriggling worms (drawn live).
  baitCrate: (f) => {
    const [W, D] = sizeOf(f, 1.0, 0.5), c = "#9a7250";
    const slats = (ctx, U, V) => {
      ctx.fillStyle = "rgba(60, 35, 15, 0.4)";
      for (let i = 1; i < 3; i++) ctx.fillRect(0, (V * i) / 3 - 0.5, U, 1);
    };
    return {
      W, D,
      parts: [
        part(0, 0, 0, W, D, 16, c, "wood", { paint: { front: (ctx, U, V) => {
          slats(ctx, U, V);
          ctx.fillStyle = "#f4ead4"; // the sign
          ctx.beginPath();
          ctx.roundRect(U / 2 - 14, 3, 28, 10, 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(90, 60, 30, 0.5)";
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.fillStyle = "#3f6f9f";
          ctx.font = "800 8px 'Quicksand', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BAIT", U / 2, 11);
          ctx.textAlign = "left";
        }, left: slats, right: slats } }),
        part(0.12, 0.08, 16, 0.5, 0.3, 11, "#4a8ab8", "paint", { round: 2, paint: { front: (ctx, U, V) => {
          ctx.fillStyle = "#f4f4f0"; // the cooler's white lid band
          ctx.fillRect(0, 0, U, 3.5);
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(2, 5, 2.5, V - 7);
        } } }),
        part(W - 0.36, 0.12, 16, 0.26, 0.24, 11, "#8a9298", "metal", { round: 2 }), // the worm bucket
      ],
      live: (ctx, P, facing) => {
        if (facing !== "front") return;
        const b = P(W - 0.23, 0.24, 27);
        ctx.strokeStyle = "#e08a8a";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        const t = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(b.x - 4 + i * 4, b.y);
          ctx.quadraticCurveTo(b.x - 3 + i * 4 + Math.sin(t * 3 + i) * 2, b.y - 5, b.x - 2 + i * 4, b.y - 2);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      },
    };
  },
});
