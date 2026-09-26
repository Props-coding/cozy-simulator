// Part of the house's drawing code (see render.js for how the pieces fit
// together): furniture for particular rooms (the Library, Conference Room,
// Theater, hallway, Workshop, raccoon shop) and the secret offices.

Object.assign(FURNITURE_DRAWERS, {
  // --- More furniture ---

  // A vanity table with a round mirror ringed with bulbs, and a stool.
  vanity(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#f2ece2");
    const cx = d.top.x + d.top.w / 2, cy = d.top.y - 14;
    ctx.fillStyle = "#c9a24a";
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dfeaf2";
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(cx - 6, cy - 6, 2, 9);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillStyle = "#fff4c8";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e37aa0"; // perfume and a lipstick
    ctx.fillRect(d.top.x + 6, d.top.y + d.top.h / 2 - 5, 5, 6);
    ctx.fillStyle = "#b69ad8";
    ctx.fillRect(d.top.x + d.top.w - 12, d.top.y + d.top.h / 2 - 6, 4, 7);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x + d.face.w / 2 - 5, d.face.y + 8, 10, 1.6);
  },

  // A bed with four posts, sheer drapes and fairy lights. You can sleep in it.
  canopyBed(ctx, f) {
    FURNITURE_DRAWERS.bed(ctx, f);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const topY = a.y - 58;
    ctx.fillStyle = "#e9dcc2"; // posts
    for (const px of [a.x + 1, b.x - 4]) {
      ctx.fillRect(px, topY, 3, a.y - topY);
      ctx.fillRect(px, b.y - 40, 3, 30);
    }
    ctx.fillStyle = "#e9dcc2";
    ctx.fillRect(a.x, topY - 2, b.x - a.x, 3);
    ctx.fillStyle = "rgba(255, 250, 245, 0.45)"; // sheer drapes
    for (const [x1, dir] of [[a.x + 3, 1], [b.x - 3, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x1, topY);
      ctx.quadraticCurveTo(x1 + dir * 14, topY + 30, x1 + dir * 4, b.y - 12);
      ctx.lineTo(x1, b.y - 12);
      ctx.closePath();
      ctx.fill();
    }
    const t = performance.now() / 1000;
    for (let i = 0; i <= 10; i++) {
      const px = a.x + ((b.x - a.x) * i) / 10;
      ctx.fillStyle = `rgba(255, 220, 140, ${0.7 + Math.sin(t * 2 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(px, topY + 3 + Math.sin((i / 10) * Math.PI) * 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A papasan chair: a big round rattan bowl with a thick cushion.
  papasanChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#a8783e"; // base
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c49a5c"; // bowl
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 16, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 60, 25, 0.35)";
    ctx.lineWidth = 0.8;
    for (let r = 6; r < 22; r += 4) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 16, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cushion = ctx.createRadialGradient(b.x, b.y - 20, 2, b.x, b.y - 17, 18);
    cushion.addColorStop(0, "#f7e0d0");
    cushion.addColorStop(1, "#e0b8a0");
    ctx.fillStyle = cushion;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 17, 17, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160, 110, 90, 0.35)";
    ctx.beginPath();
    ctx.arc(b.x, b.y - 17, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A hanging rattan egg chair on its stand, gently swaying.
  eggChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.strokeStyle = "#3a3a40"; // the stand
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - 12, b.y - 2);
    ctx.lineTo(b.x + 12, b.y - 2);
    ctx.moveTo(b.x + 8, b.y - 2);
    ctx.lineTo(b.x + 8, b.y - 66);
    ctx.quadraticCurveTo(b.x + 8, b.y - 74, b.x, b.y - 72);
    ctx.stroke();
    const sway = Math.sin(performance.now() / 900) * 0.05;
    ctx.save();
    ctx.translate(b.x, b.y - 72);
    ctx.rotate(sway);
    ctx.strokeStyle = "#5c4530";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.fillStyle = "#c49a5c";
    ctx.beginPath();
    ctx.ellipse(0, 32, 14, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b4a2e"; // the opening
    ctx.beginPath();
    ctx.ellipse(0, 36, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2e0c4"; // cushion
    ctx.beginPath();
    ctx.ellipse(0, 44, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 60, 25, 0.35)";
    ctx.lineWidth = 0.7;
    for (let y = 12; y < 54; y += 4) {
      ctx.beginPath();
      ctx.moveTo(-13, y);
      ctx.lineTo(-9, y);
      ctx.moveTo(9, y);
      ctx.lineTo(13, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  // A puffy cream boucle "cloud" sofa.
  cloudSofa(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x;
    const puff = (x, y, rx, ry, shade) => {
      const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
      g.addColorStop(0, shadeColor("#f2ece2", 10 + shade));
      g.addColorStop(1, shadeColor("#f2ece2", -22 + shade));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    puff(a.x + w / 2, b.y - 34, w / 2 - 2, 14, -6); // back
    puff(a.x + 10, b.y - 18, 11, 14, 0); // arms
    puff(b.x - 10, b.y - 18, 11, 14, 0);
    puff(a.x + w * 0.36, b.y - 14, w * 0.22, 10, 4); // seats
    puff(a.x + w * 0.64, b.y - 14, w * 0.22, 10, 4);
    ctx.fillStyle = "rgba(160, 140, 120, 0.25)"; // boucle texture
    for (let i = 0; i < 40; i++) ctx.fillRect(a.x + 4 + noise(i * 3.3) * (w - 8), b.y - 44 + noise(i * 5.1) * 36, 1, 1);
    ctx.fillStyle = "#e0b8a0"; // a pillow
    roundRectPath(ctx, a.x + w * 0.62, b.y - 30, 14, 11, 4);
    ctx.fill();
  },

  // A chunky knit pouf.
  pouf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const c = f.color || "#e0c8b0";
    const g = ctx.createLinearGradient(0, b.y - 22, 0, b.y);
    g.addColorStop(0, shadeColor(c, 20));
    g.addColorStop(1, shadeColor(c, -20));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 10, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(c, -30);
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x + i * 3.6, b.y - 10, 1.8, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // A round side table with a mug and a bud vase.
  sideTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#8b5e3c";
    ctx.fillRect(b.x - 1.5, b.y - 18, 3, 16);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8784e";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 19, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2ece2";
    ctx.fillRect(b.x - 7, b.y - 25, 5, 6);
    const vt = drawVase(ctx, b.x + 5, b.y - 19, "amber");
    ctx.fillStyle = "#f7c6d6";
    ctx.beginPath();
    ctx.arc(b.x + 5, vt - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A clothes rail with cozy sweaters and a little hat on top.
  clothesRack(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    const x = a.x, by = a.y - 2;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + 2, by - 50, 2, 50);
    ctx.fillRect(x + w - 4, by - 50, 2, 50);
    ctx.fillRect(x + 2, by - 50, w - 4, 2);
    const clothes = ["#e8b8a0", "#a8b89a", "#f2e0c4", "#b69ad8", "#c98a8a"];
    const n = Math.floor((w - 10) / 9);
    for (let i = 0; i < n; i++) {
      const cx = x + 7 + i * 9;
      ctx.strokeStyle = "#8a8a94";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, by - 49);
      ctx.lineTo(cx - 4, by - 45);
      ctx.lineTo(cx + 4, by - 45);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = clothes[i % clothes.length];
      roundRectPath(ctx, cx - 5, by - 45, 10, 22 + (i % 2) * 4, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let k = 0; k < 3; k++) ctx.fillRect(cx - 4, by - 40 + k * 5, 8, 1);
    }
    ctx.fillStyle = "#f2e0c4"; // a shoe box underneath
    ctx.fillRect(x + w * 0.3, by - 7, w * 0.4, 6);
  },

  // A little gold bar cart with a teapot and cups.
  barCart(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), w = f.w * TILE;
    const x = a.x, by = a.y - 2;
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + 3, by - 26, 2, 24);
    ctx.fillRect(x + w - 5, by - 26, 2, 24);
    ctx.fillStyle = "#f2e4c4";
    ctx.fillRect(x + 2, by - 26, w - 4, 3);
    ctx.fillRect(x + 2, by - 11, w - 4, 3);
    ctx.fillStyle = "#3a3a40";
    for (const wx of [x + 5, x + w - 5]) {
      ctx.beginPath();
      ctx.arc(wx, by - 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f7c6d6"; // teapot
    ctx.beginPath();
    ctx.arc(x + w * 0.35, by - 31, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w * 0.35 + 4, by - 33, 4, 1.5);
    for (const fx of [0.62, 0.78]) {
      ctx.fillStyle = "#fffaf3";
      ctx.fillRect(x + w * fx - 2.5, by - 30, 5, 4);
    }
    ctx.fillStyle = "#b9d6a4"; // a plant on the lower shelf
    ctx.beginPath();
    ctx.arc(x + w * 0.4, by - 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8913a";
    ctx.fillRect(x + w * 0.62, by - 16, 6, 5);
  },

  // A little mushroom stool.
  mushroomStool(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#f4ecdc";
    roundRectPath(ctx, b.x - 5, b.y - 12, 10, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#e0845a";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 13, 12, 7, 0, Math.PI, 0);
    ctx.ellipse(b.x, b.y - 13, 12, 3, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    for (const [dx, dy] of [[-5, -16], [3, -18], [7, -14]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // An aesthetic desk: a pastel keyboard, a monitor with a sunset, a plant
  // and a lamp.
  aestheticDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#f2ece2");
    const { x, y, w, h } = d.top;
    const mx = x + w / 2 - 20, my = y - 22;
    ctx.fillStyle = "#e8e2d8";
    roundRectPath(ctx, mx, my, 40, 26, 3);
    ctx.fill();
    const sky = ctx.createLinearGradient(0, my + 2, 0, my + 23);
    sky.addColorStop(0, "#f7b8c8");
    sky.addColorStop(1, "#f2d09a");
    ctx.fillStyle = sky;
    ctx.fillRect(mx + 2, my + 2, 36, 21);
    ctx.fillStyle = "#fff4d0";
    ctx.beginPath();
    ctx.arc(mx + 20, my + 17, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e8e2d8";
    ctx.fillRect(mx + 18, my + 26, 4, 5);
    ctx.fillStyle = "#f7d0da"; // pastel keyboard and mouse
    roundRectPath(ctx, x + w / 2 - 16, y + h - 12, 28, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 18, y + h - 8, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPot(ctx, x + 9, y + h / 2 + 2, "pink", 5, 7);
    drawLeaf(ctx, x + 9, y + h / 2 - 6, -0.4, 9, 3, "#5f9a55");
    drawLeaf(ctx, x + 9, y + h / 2 - 6, 0.4, 9, 3, "#4f8a4a");
    const lx = x + w - 10; // a little arch lamp
    ctx.strokeStyle = "#f2ece2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, y + h / 2);
    ctx.quadraticCurveTo(lx, y - 20, lx - 8, y - 14);
    ctx.stroke();
    ctx.fillStyle = "#fff4c8";
    ctx.beginPath();
    ctx.arc(lx - 8, y - 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A LAN station: desk with a PC tower, keyboard and a monitor facing
  // you. Whoever stands on the stool in front covers the desk's front,
  // with the screen still glowing above their head.
  pcDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, WOOD);
    const { x, y, w, h } = d.top;
    // Monitor on the back of the desk.
    const mw = 44, mh = 28, mx = x + w / 2 - mw / 2 - 6, my = y - mh + 6;
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(mx + mw / 2 - 3, my + mh - 2, 6, 8); // stand
    roundRectPath(ctx, mx, my, mw, mh, 3);
    ctx.fill();
    const screen = ctx.createLinearGradient(0, my, 0, my + mh);
    screen.addColorStop(0, shadeColor(f.screen, 30));
    screen.addColorStop(1, shadeColor(f.screen, -40));
    ctx.fillStyle = screen;
    ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 6);
    // A few blocky "game" shapes on the screen.
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(mx + 8, my + mh - 11, 6, 6);
    ctx.fillRect(mx + 20, my + 8, 10, 4);
    ctx.fillRect(mx + 30, my + mh - 13, 6, 8);
    // PC tower on the right, with a colored light strip.
    const tx = x + w - 16, ty = y - 18;
    ctx.fillStyle = "#26262c";
    roundRectPath(ctx, tx, ty, 12, 26, 2);
    ctx.fill();
    ctx.fillStyle = f.screen;
    ctx.fillRect(tx + 2, ty + 4, 2, 18);
    // Keyboard and mouse at the front edge.
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(mx + 4, y + h - 11, 30, 7);
    ctx.beginPath();
    ctx.ellipse(mx + 42, y + h - 7, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A round stool or cushion you stand on to sit at a desk or table.
  stool(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b33";
    ctx.fillRect(c.x - 2, c.y - 4, 4, 10);
    ctx.fillStyle = f.color || "#c0554a";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 5, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Kitchen counter with a stove: cream cupboards, a wood worktop, two
  // burners with a pot on one, and a cutting board with a loaf of bread.
  stove(ctx, f) {
    const c = drawCounter(ctx, f);
    const { x, y, w, h } = c.top;
    ctx.fillStyle = "#3a3a40";
    roundRectPath(ctx, x + w - 36, y + 3, 32, h - 6, 3);
    ctx.fill();
    ctx.strokeStyle = "#6a6a72";
    ctx.lineWidth = 1.5;
    for (const bx of [x + w - 28, x + w - 12]) {
      ctx.beginPath();
      ctx.ellipse(bx, y + h / 2, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#c0554a"; // pot
    ctx.fillRect(x + w - 35, y + h / 2 - 10, 14, 10);
    ctx.fillStyle = "#a8473a";
    ctx.fillRect(x + w - 37, y + h / 2 - 11, 18, 3);
    ctx.fillStyle = "#d9b98f"; // cutting board
    roundRectPath(ctx, x + 6, y + 4, 24, h - 8, 3);
    ctx.fill();
    ctx.fillStyle = "#c98a3c"; // bread
    ctx.beginPath();
    ctx.ellipse(x + 18, y + h / 2 - 1, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A small counter with a sink and a tall tap.
  sink(ctx, f) {
    const c = drawCounter(ctx, f);
    const { x, y, w, h } = c.top;
    ctx.fillStyle = "#b8c2c8";
    roundRectPath(ctx, x + 5, y + 4, w - 10, h - 8, 4);
    ctx.fill();
    ctx.fillStyle = "#8f9aa1";
    roundRectPath(ctx, x + 8, y + 7, w - 16, h - 12, 3);
    ctx.fill();
    ctx.strokeStyle = "#cfd6da";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 4);
    ctx.lineTo(x + w / 2, y - 8);
    ctx.quadraticCurveTo(x + w / 2, y - 12, x + w / 2 + 6, y - 10);
    ctx.stroke();
  },

  // A little wooden tea cart on wheels: plates on the bottom shelf, a
  // teapot and two cups on top. Looks the same from any side, so it sits
  // happily against any wall.
  teaCart(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, depth = b.y - a.y, trayH = 28;
    // Bottom shelf with a stack of plates.
    const shelf = drawBlock(ctx, f.x, f.y, f.w, f.h, 8, WOOD);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? "#e8dcc8" : "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(shelf.top.x + w / 2, shelf.top.y + depth / 2 - i * 2.5, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Legs and wheels.
    ctx.fillStyle = WOOD_DARK;
    for (const lx of [a.x + 2, b.x - 5]) ctx.fillRect(lx, b.y - trayH, 3, trayH - 2);
    for (const wx of [a.x + 3.5, b.x - 3.5]) {
      ctx.beginPath();
      ctx.arc(wx, b.y - 1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Top tray with a little raised lip.
    ctx.fillStyle = "#a3785a";
    ctx.fillRect(a.x, a.y - trayH, w, depth);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x, b.y - trayH - 3, w, 4);
    // Teapot and cups on the tray.
    const ty = a.y - trayH + depth / 2;
    ctx.fillStyle = "#4a90a4";
    ctx.beginPath();
    ctx.ellipse(a.x + 16, ty - 4, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(a.x + 14, ty - 12, 4, 3);
    ctx.strokeStyle = "#4a90a4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + 23, ty - 4);
    ctx.lineTo(a.x + 28, ty - 9);
    ctx.stroke();
    for (const cx of [a.x + w - 22, a.x + w - 11]) {
      ctx.fillStyle = "#f7f1e6";
      ctx.fillRect(cx - 3.5, ty - 5, 7, 6);
      ctx.fillStyle = "#5c3a22";
      ctx.fillRect(cx - 2.5, ty - 5, 5, 1.5);
    }
  },

  // --- Library ---

  // Hung on a wall face: a round clock showing the real time where you are.
  clock(ctx, f) {
    const a = toScreen(f.x, f.y);
    const cx = a.x, cy = a.y - WALL_HEIGHT + 17, r = 11;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 2.5, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b6b4a";
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbf6ea";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c4530";
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(angle) * (r - 2.5) - 0.6, cy + Math.sin(angle) * (r - 2.5) - 0.6, 1.2, 1.2);
    }
    const now = new Date();
    const hands = [
      [((now.getHours() % 12) + now.getMinutes() / 60) / 12, r * 0.5, 2],
      [now.getMinutes() / 60, r * 0.78, 1.4],
    ];
    ctx.strokeStyle = "#3a2a1e";
    ctx.lineCap = "round";
    for (const [turn, length, width] of hands) {
      const angle = turn * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  },

  // A tall freestanding bookcase, packed with three rows of books, with a
  // couple of books lying on top.
  libraryShelf(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const shelf = drawBlock(ctx, f.x, f.y, f.w, f.h, 58, "#5a3a26");
    const bookColors = ["#8f2f2a", "#3f6f9f", "#c98a3c", "#4f7a48", "#7d6a8f", "#b5603c", "#2f4f4f"];
    const { x, y, w } = shelf.face;
    for (let row = 0; row < 3; row++) {
      const rowY = y + 4 + row * 17;
      ctx.fillStyle = "#3a2618";
      ctx.fillRect(x + 3, rowY, w - 6, 14);
      for (let i = 0; i * 6 + 5 < w - 6; i++) {
        const bh = 10 + ((i * 5 + row * 3) % 4);
        ctx.fillStyle = bookColors[(i * 3 + row * 2 + Math.round(f.x)) % bookColors.length];
        ctx.fillRect(x + 5 + i * 6, rowY + 14 - bh, 5, bh);
      }
    }
    const top = shelf.top;
    ctx.fillStyle = "#c98a3c";
    ctx.fillRect(top.x + 6, top.y + top.h / 2 - 3, 16, 4);
    ctx.fillStyle = "#3f6f9f";
    ctx.fillRect(top.x + 8, top.y + top.h / 2 - 7, 13, 4);
  },

  // A long reading table with two green banker's lamps, open books and a
  // stack of books to get through.
  readingTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#5c3d2a");
    const { x, y, w, h } = t.top;
    const mid = y + h / 2;
    for (const bx of [x + 14, x + w - 44]) {
      ctx.fillStyle = "#f4ecdc"; // open book
      ctx.fillRect(bx, mid - 3, 26, 13);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(bx + 12.5, mid - 3, 1, 13);
    }
    for (const lx of [x + w * 0.33, x + w * 0.67]) {
      ctx.fillStyle = "#b8923a"; // brass stand
      ctx.fillRect(lx - 5, mid + 1, 10, 3);
      ctx.fillRect(lx - 0.8, mid - 10, 1.6, 11);
      ctx.fillStyle = "#2f6b45"; // green glass shade
      ctx.beginPath();
      ctx.ellipse(lx, mid - 11, 8, 4, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(lx - 8, mid - 11, 16, 2);
    }
    const stack = ["#8f2f2a", "#c98a3c", "#3f6f9f"];
    stack.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + w / 2 - 8, mid + 4 - i * 4, 16 - i * 2, 4);
    });
  },

  // --- Conference Room ---

  // A rolling whiteboard on legs, showing whatever's drawn on the shared
  // board right now.
  whiteboard(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const a = toScreen(f.x, f.y + f.h), b = toScreen(f.x + f.w, f.y + f.h);
    const w = b.x - a.x, boardH = w / 2.4, legH = 16;
    const y = a.y - legH - boardH;
    ctx.fillStyle = "#6f7680"; // legs and wheels
    ctx.fillRect(a.x + 10, a.y - legH, 3, legH);
    ctx.fillRect(b.x - 13, a.y - legH, 3, legH);
    ctx.fillRect(a.x + 4, a.y - 3, 16, 2);
    ctx.fillRect(b.x - 20, a.y - 3, 16, 2);
    ctx.fillStyle = "#9aa3ad"; // frame
    roundRectPath(ctx, a.x - 2, y - 2, w + 4, boardH + 4, 3);
    ctx.fill();
    const live = document.getElementById("whiteboard-canvas");
    if (live) {
      ctx.imageSmoothingEnabled = true; // shrinking the drawing: smooth, so thin lines don't vanish
      ctx.drawImage(live, a.x + 1, y + 1, w - 2, boardH - 2);
      ctx.imageSmoothingEnabled = false;
    }
    else {
      ctx.fillStyle = "white";
      ctx.fillRect(a.x + 1, y + 1, w - 2, boardH - 2);
    }
    ctx.fillStyle = "#7d858f"; // marker tray
    ctx.fillRect(a.x + 6, y + boardH + 1, w - 12, 3);
    const markers = ["#2b2b2b", "#c0554a", "#3f6f9f", "#4f7a48"];
    markers.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(a.x + 14 + i * 9, y + boardH - 1, 7, 2);
    });
  },

  // A big walnut conference table with laptops, notepads, water glasses
  // and a little plant in the middle.
  conferenceTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#6b4a32");
    const { x, y, w, h } = t.top;
    // Laptops along each long side.
    for (const lx of [x + 22, x + w - 48]) {
      ctx.fillStyle = "#c8ccd2";
      roundRectPath(ctx, lx, y + 6, 26, 16, 2);
      ctx.fill();
      ctx.fillStyle = "#6fa7c8";
      ctx.fillRect(lx + 3, y + 8, 20, 11);
    }
    // Notepads and pens on the near side.
    for (const nx of [x + 30, x + w - 44]) {
      ctx.fillStyle = "#f4ecd2";
      ctx.fillRect(nx, y + h - 20, 14, 16);
      ctx.fillStyle = "#3f6f9f";
      ctx.fillRect(nx + 16, y + h - 19, 2, 13);
    }
    // Water glasses.
    for (const gx of [x + 14, x + w / 2 + 24, x + w - 14]) {
      ctx.fillStyle = "rgba(200, 230, 245, 0.7)";
      ctx.fillRect(gx - 3, y + h / 2 - 4, 6, 8);
    }
    // A small plant in the middle.
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(cx - 6, cy - 2, 12, 8);
    for (const [dx, dy, color] of [[-4, -6, "#4f7a48"], [4, -7, "#5c8a54"], [0, -10, "#6fa05e"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // --- The raccoon shop ---

  // Three raccoons stacked in one long trenchcoat, swaying a little: the top
  // one's masked face under a floppy hat, the middle one's eyes peeking out
  // between the coat buttons, and a striped tail and little paws poking out
  // at the bottom.
  raccoons(ctx, f) {
    const t = performance.now() / 1000;
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const bx = base.x, by = base.y;
    drawShadow(ctx, f.x, f.y, f.w, f.h);

    // Striped tail poking out from under the hem, wagging.
    const wag = Math.sin(t * 3) * 3;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#3a3a40" : "#9a9aa2";
      ctx.beginPath();
      ctx.arc(bx + 12 + i * 3, by - 6 - i * 2.2 + (i * wag) / 6, 3.4 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Little feet.
    ctx.fillStyle = "#4a4a52";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + side * 5, by - 2, 4, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Everything above the feet sways gently.
    ctx.save();
    ctx.translate(bx, by - 4);
    ctx.rotate(Math.sin(t * 1.6) * 0.035);
    ctx.translate(-bx, -(by - 4));

    // The trenchcoat: wider at the hem, lit from above.
    const coat = ctx.createLinearGradient(0, by - 66, 0, by - 6);
    coat.addColorStop(0, "#d6b98a");
    coat.addColorStop(1, "#a88a5c");
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - 66);
    ctx.lineTo(bx + 12, by - 66);
    ctx.lineTo(bx + 16, by - 6);
    ctx.lineTo(bx - 16, by - 6);
    ctx.closePath();
    ctx.fill();
    // The gap between the coat flaps, where the middle raccoon peeks out.
    ctx.fillStyle = "#2f2a2a";
    ctx.beginPath();
    ctx.ellipse(bx + 1, by - 44, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = (t % 4) < 0.12;
    const look = Math.sin(t * 0.7) * 1.2;
    if (!blink) {
      ctx.fillStyle = "#fbe9a8";
      ctx.beginPath();
      ctx.arc(bx - 0.6 + look, by - 46, 1.8, 0, Math.PI * 2);
      ctx.arc(bx + 2.6 + look, by - 46, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Seam, belt and buttons.
    ctx.strokeStyle = "rgba(90, 65, 35, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 1, by - 36);
    ctx.lineTo(bx + 1, by - 6);
    ctx.stroke();
    ctx.fillStyle = "#8a6a40";
    ctx.fillRect(bx - 14, by - 32, 29, 4);
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(bx - 2, by - 33, 5, 6);
    ctx.fillStyle = "#5c4530";
    for (const yy of [by - 56, by - 22, by - 14]) {
      ctx.beginPath();
      ctx.arc(bx - 3, yy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sleeves with little grey paws.
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#b99a6a";
      roundRectPath(ctx, bx + side * 13 - 4, by - 58, 8, 22, 3);
      ctx.fill();
      ctx.fillStyle = "#6a6a72";
      ctx.beginPath();
      ctx.arc(bx + side * 13, by - 35, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Popped collar.
    ctx.fillStyle = "#c4a676";
    ctx.beginPath();
    ctx.moveTo(bx - 12, by - 66);
    ctx.lineTo(bx - 3, by - 66);
    ctx.lineTo(bx - 9, by - 58);
    ctx.closePath();
    ctx.moveTo(bx + 12, by - 66);
    ctx.lineTo(bx + 3, by - 66);
    ctx.lineTo(bx + 9, by - 58);
    ctx.closePath();
    ctx.fill();

    // The top raccoon's head.
    const hx = bx, hy = by - 75;
    ctx.fillStyle = "#8f8f98";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * 8, hy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ececef"; // white face markings
    ctx.beginPath();
    ctx.ellipse(hx, hy + 5, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx - 8, hy - 6, 16, 2.2);
    ctx.fillStyle = "#2b2b30"; // the bandit mask
    roundRectPath(ctx, hx - 10, hy - 3.5, 20, 6.5, 3);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(hx - 4.5, hy - 0.5, 1.6, 0, Math.PI * 2);
    ctx.arc(hx + 4.5, hy - 0.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1e22";
    ctx.beginPath();
    ctx.arc(hx, hy + 3.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Floppy brown hat, a little low over the eyes.
    ctx.fillStyle = "#5c4530";
    ctx.beginPath();
    ctx.ellipse(hx, hy - 7, 15, 3.8, -0.08, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, hx - 8, hy - 17, 16, 11, 4);
    ctx.fill();
    ctx.fillStyle = "#3f2f22";
    ctx.fillRect(hx - 8, hy - 10, 16, 2.5);
    ctx.restore();
  },

  // --- Theater ---

  // The big cinema screen on a low stage, with speakers either side.
  bigScreen(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stage = drawBlock(ctx, f.x, f.y, f.w, f.h, 6, "#3a2230");
    const x = stage.top.x + 8, w = stage.top.w - 16, h = 56;
    const y = stage.top.y - h + 4;
    ctx.fillStyle = "#1c1418";
    roundRectPath(ctx, x - 4, y - 4, w + 8, h + 8, 4);
    ctx.fill();
    const screen = ctx.createLinearGradient(0, y, 0, y + h);
    screen.addColorStop(0, "#dfe7f2");
    screen.addColorStop(1, "#b9c6d8");
    ctx.fillStyle = screen;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath(); // a soft play symbol
    ctx.moveTo(x + w / 2 - 7, y + h / 2 - 9);
    ctx.lineTo(x + w / 2 + 9, y + h / 2);
    ctx.lineTo(x + w / 2 - 7, y + h / 2 + 9);
    ctx.closePath();
    ctx.fill();
    for (const sx of [stage.top.x - 2, stage.top.x + stage.top.w - 10]) {
      ctx.fillStyle = "#2a1f26";
      roundRectPath(ctx, sx, y + 14, 12, 34, 3);
      ctx.fill();
      ctx.fillStyle = "#4a3a44";
      ctx.beginPath();
      ctx.arc(sx + 6, y + 24, 3.5, 0, Math.PI * 2);
      ctx.arc(sx + 6, y + 38, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A plush red cinema seat facing the screen (so you see its back), with
  // armrests. Sort order draws it over whoever sits in it.
  theaterSeat(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.08, f.y, f.w - 0.16, f.h - 0.2, 12, "#7d2a33"); // seat cushion
    drawBlock(ctx, f.x, f.y + 0.05, 0.08, f.h - 0.05, 17, "#4a2a30"); // armrests
    drawBlock(ctx, f.x + f.w - 0.08, f.y + 0.05, 0.08, f.h - 0.05, 17, "#4a2a30");
    const back = drawBlock(ctx, f.x + 0.04, f.y + f.h - 0.2, f.w - 0.08, 0.2, 26, "#9b3540");
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundRectPath(ctx, back.face.x + 4, back.face.y + 3, back.face.w - 8, back.face.h - 9, 4);
    ctx.fill();
  },

  // Red velvet stage curtains hung just in front of the Theater's screen,
  // drawn open on both sides of it, under a gold-fringed valance with a
  // row of little marquee bulbs.
  stageCurtains(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, top = a.y - 80, bottom = a.y;
    for (const side of [0, 1]) {
      const cx = side ? x + w - 14 : x + 14; // each drape gathers toward its edge
      const drape = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
      drape.addColorStop(0, "#5e1522");
      drape.addColorStop(0.5, "#a3263a");
      drape.addColorStop(1, "#5e1522");
      ctx.fillStyle = drape;
      ctx.beginPath();
      ctx.moveTo(cx - 16, top);
      ctx.lineTo(cx + 16, top);
      ctx.quadraticCurveTo(cx + 6, bottom - 18, cx + 10, bottom);
      ctx.lineTo(cx - 10, bottom);
      ctx.quadraticCurveTo(cx - 6, bottom - 18, cx - 16, top);
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 5, 15, 0.35)"; // folds
      ctx.lineWidth = 1;
      for (const dx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 1.5, top + 2);
        ctx.quadraticCurveTo(cx + dx * 0.6, bottom - 18, cx + dx, bottom);
        ctx.stroke();
      }
      ctx.fillStyle = "#e0b84c"; // gold tieback
      ctx.fillRect(cx - 9, bottom - 20, 18, 3);
    }
    ctx.fillStyle = "#7d1c2c"; // the valance along the top
    ctx.fillRect(x, top, w, 8);
    ctx.fillStyle = "#e0b84c"; // its fringe
    for (let fx = x + 2; fx < x + w - 2; fx += 4) ctx.fillRect(fx, top + 8, 2, 3);
    const t = performance.now() / 1000;
    for (let i = 0, bx = x + 6; bx < x + w - 4; i++, bx += 12) {
      const on = Math.sin(t * 3 + i * 0.9) > -0.3; // chasing marquee lights
      ctx.fillStyle = on ? "#ffe39a" : "#b89a5a";
      ctx.beginPath();
      ctx.arc(bx, top + 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A big plush back-row sofa, seen from behind (it faces the screen),
  // with a blanket thrown over it. Stand on it to sit; its back hides your
  // lower half like the cinema seats do.
  cinemaSofa(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.1, f.y, f.w - 0.2, f.h - 0.25, 12, "#6b2f45"); // seat cushions
    drawBlock(ctx, f.x, f.y + 0.05, 0.18, f.h - 0.05, 18, "#56243a"); // arms
    drawBlock(ctx, f.x + f.w - 0.18, f.y + 0.05, 0.18, f.h - 0.05, 18, "#56243a");
    const back = drawBlock(ctx, f.x + 0.05, f.y + f.h - 0.25, f.w - 0.1, 0.25, 24, "#7d3a52");
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    const seats = 3, sw = (back.face.w - 8) / seats;
    for (let i = 0; i < seats; i++) {
      roundRectPath(ctx, back.face.x + 4 + i * sw + 1, back.face.y + 3, sw - 2, back.face.h - 8, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#e9c46a"; // a mustard blanket over one end
    ctx.beginPath();
    ctx.moveTo(back.face.x + back.face.w - 34, back.top.y);
    ctx.lineTo(back.face.x + back.face.w - 10, back.top.y);
    ctx.lineTo(back.face.x + back.face.w - 8, back.face.y + back.face.h - 2);
    ctx.lineTo(back.face.x + back.face.w - 30, back.face.y + back.face.h - 5);
    ctx.fill();
    ctx.fillStyle = "rgba(160, 110, 30, 0.35)";
    for (let k = 0; k < 3; k++) ctx.fillRect(back.face.x + back.face.w - 30 + k * 7, back.top.y + 2, 1.5, back.face.h);
  },

  // A snack counter: a glass case of candy boxes, soda cups with straws,
  // and a little "SNACKS" sign.
  candyCounter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#8a4a2e");
    ctx.fillStyle = "rgba(200, 230, 240, 0.35)"; // glass front
    ctx.fillRect(c.face.x + 4, c.face.y + 3, c.face.w - 8, c.face.h - 7);
    const boxes = ["#e04a5a", "#f2c94c", "#5aa0d8", "#7ac07a", "#e98ac0", "#f28a3a"];
    for (let i = 0, bx = c.face.x + 7; bx < c.face.x + c.face.w - 12; i++, bx += 9) {
      ctx.fillStyle = boxes[i % boxes.length];
      ctx.fillRect(bx, c.face.y + 6 + (i % 2) * 3, 7, 8);
    }
    for (let i = 0; i < 3; i++) {
      const x = c.top.x + 8 + i * 9, y = c.top.y + c.top.h / 2;
      ctx.fillStyle = i === 1 ? "#5aa0d8" : "#e04a5a"; // soda cups
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 11);
      ctx.lineTo(x + 3, y - 11);
      ctx.lineTo(x + 2, y);
      ctx.lineTo(x - 2, y);
      ctx.fill();
      ctx.fillStyle = "#fffaf3";
      ctx.fillRect(x - 3, y - 12, 6, 2);
      ctx.fillRect(x + 0.5, y - 17, 1, 6); // straw
    }
    const sx = c.top.x + c.top.w - 34, sy = c.top.y - 10;
    ctx.fillStyle = "#3a1f2a";
    roundRectPath(ctx, sx, sy, 28, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#ffcf6e";
    ctx.font = "700 7px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SNACKS", sx + 14, sy + 8);
    ctx.textAlign = "left";
  },

  // Little lights set into the floor along the aisle, like in a cinema.
  aisleLights(ctx, f) {
    const n = Math.max(2, Math.round(f.h / 0.9));
    for (let i = 0; i < n; i++) {
      const p = toScreen(f.x + f.w / 2, f.y + (i + 0.5) * (f.h / n));
      ctx.fillStyle = "#3a1f2a";
      ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
      ctx.fillStyle = "#ffd98a";
      ctx.fillRect(p.x - 3, p.y - 1, 6, 2);
    }
  },

  // The Study's turntable on a little record cabinet: a spinning record
  // (its label is the color of the station you picked), a tonearm, and
  // records filed in the cabinet below. Press E at it to pick a station.
  turntable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cab = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#7a5238");
    const sleeves = ["#d9825b", "#7a6bc8", "#3f6f9f", "#f2b84a", "#e07a8a", "#3f7a4a"];
    sleeves.forEach((c, i) => { // records filed in the cabinet
      ctx.fillStyle = c;
      ctx.fillRect(cab.face.x + 4 + i * 5, cab.face.y + 4, 3.5, cab.face.h - 7);
    });
    const deck = drawBlock(ctx, f.x + 0.1, f.y + 0.02, f.w - 0.2, f.h - 0.12, 3, "#3a2a22");
    const cx = deck.top.x + deck.top.w * 0.42, cy = deck.top.y + deck.top.h / 2;
    const r = Math.min(deck.top.h, deck.top.w * 0.6) / 2 - 1;
    ctx.fillStyle = "#1c1618"; // the record
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; // grooves
    ctx.lineWidth = 0.6;
    for (const k of [0.55, 0.75]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * k, r * k * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const spin = performance.now() / 600; // a glint going round
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.85, r * 0.68, 0, spin, spin + 0.6);
    ctx.stroke();
    ctx.fillStyle = globalThis.myLofiColor || "#d9825b"; // the label
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.3, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9c2b8"; // the tonearm
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(deck.top.x + deck.top.w - 5, deck.top.y + 3);
    ctx.lineTo(deck.top.x + deck.top.w - 8, cy + 2);
    ctx.lineTo(cx + r * 0.55, cy + 1);
    ctx.stroke();
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.arc(deck.top.x + deck.top.w - 5, deck.top.y + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // An old-timey popcorn machine: a red cart with a glass box of popcorn.
  popcorn(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const cart = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#b8322a");
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(cart.face.x, cart.face.y + 3, cart.face.w, 2);
    const gx = cart.top.x + 4, gw = cart.top.w - 8, gh = 26, gy = cart.top.y + cart.top.h / 2 - gh;
    ctx.fillStyle = "rgba(230, 240, 245, 0.55)"; // glass
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = "#f7e6a8"; // popcorn piled in the bottom
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(gx + 3 + ((i * 7) % (gw - 6)), gy + gh - 4 - Math.floor(i / 5) * 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#8a2a24";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.fillStyle = "#b8322a"; // little roof
    ctx.beginPath();
    ctx.moveTo(gx - 3, gy);
    ctx.lineTo(gx + gw / 2, gy - 8);
    ctx.lineTo(gx + gw + 3, gy);
    ctx.closePath();
    ctx.fill();
  },

  // --- Hallway pieces ---

  // A slim side table with a drawer, holding a lamp, a vase of flowers
  // and a little bowl for keys.
  console(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 26, WOOD);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(c.face.x + 6.5, c.face.y + 4.5, c.face.w - 13, 9);
    drawKnob(ctx, c.face.x + c.face.w / 2, c.face.y + 9);
    const mid = c.top.y + c.top.h / 2;
    drawLamp(ctx, c.top.x + 16, mid + 2);
    // Vase of flowers.
    const vx = c.top.x + c.top.w - 22;
    ctx.fillStyle = "#6f8a6a";
    roundRectPath(ctx, vx - 4, mid - 8, 8, 11, 3);
    ctx.fill();
    ctx.strokeStyle = "#4f7a48";
    ctx.lineWidth = 1.2;
    for (const [fx, fy, color] of [[-5, -18, "#e37aa0"], [0, -21, "#f3e6d0"], [5, -17, "#e0a84c"]]) {
      ctx.beginPath();
      ctx.moveTo(vx, mid - 8);
      ctx.lineTo(vx + fx, mid + fy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(vx + fx, mid + fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Key bowl.
    ctx.fillStyle = "#c98a3c";
    ctx.beginPath();
    ctx.ellipse(c.top.x + c.top.w / 2 + 4, mid + 1, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(c.top.x + c.top.w / 2 + 2, mid - 1, 4, 2);
  },

  // A wooden bench with two plump cushions and a folded throw.
  bench(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, WOOD);
    const cw = b.top.w / 2 - 8;
    for (const [i, color] of [[0, "#6f8a6a"], [1, "#c98f3c"]]) {
      roundRectPath(ctx, b.top.x + 5 + i * (cw + 6), b.top.y - 3, cw, b.top.h, 5);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(b.top.x + 9 + i * (cw + 6), b.top.y - 1, cw - 8, 2);
    }
    ctx.fillStyle = "#b5603c"; // folded throw hanging over the front
    ctx.fillRect(b.face.x + b.face.w - 22, b.face.y - 2, 14, b.face.h - 2);
  },

  // A tall pot holding two umbrellas, handles poking out the top.
  umbrellaStand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const u = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#4a6a7a");
    const cx = u.top.x + u.top.w / 2;
    ctx.lineWidth = 2;
    for (const [dx, color] of [[-3, "#c0554a"], [3, "#e0a84c"]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + dx, u.top.y + 4);
      ctx.lineTo(cx + dx, u.top.y - 12);
      ctx.arc(cx + dx + 3, u.top.y - 12, 3, Math.PI, 0);
      ctx.stroke();
    }
  },

  // Boots and shoes lined up on the floor by the coat hooks.
  boots(ctx, f) {
    const a = toScreen(f.x, f.y + f.h);
    const shoes = [[4, "#5c4530"], [13, "#5c4530"], [26, "#7a4a3a"], [34, "#7a4a3a"]];
    for (const [dx, color] of shoes) {
      ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
      ctx.beginPath();
      ctx.ellipse(a.x + dx + 3, a.y, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      roundRectPath(ctx, a.x + dx, a.y - 12, 7, 12, 2);
      ctx.fill();
      roundRectPath(ctx, a.x + dx, a.y - 4, 9, 4, 2);
      ctx.fill();
    }
  },

  // Hung on a wall face: a wood rail of pegs with two coats and a scarf.
  coatHooks(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + 6, w = f.w * TILE;
    ctx.fillStyle = WOOD;
    ctx.fillRect(a.x, top, w, 4);
    ctx.fillStyle = WOOD_DARK;
    for (let i = 0; i < 3; i++) ctx.fillRect(a.x + 7 + i * (w - 14) / 2 - 1.5, top + 3, 3, 4);
    for (const [cx, color] of [[a.x + 7, "#6f8a6a"], [a.x + w / 2, "#b5603c"]]) {
      ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
      roundRectPath(ctx, cx - 6, top + 7, 14, 24, 4);
      ctx.fill();
      ctx.fillStyle = color;
      roundRectPath(ctx, cx - 7, top + 5, 14, 24, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(cx - 0.5, top + 9, 1, 19);
    }
    ctx.fillStyle = "#e0a84c"; // scarf
    ctx.fillRect(a.x + w - 10, top + 5, 5, 22);
    ctx.fillRect(a.x + w - 13, top + 5, 5, 16);
  },

  // Hung on a wall face: a small lamp with a warm glowing shade.
  sconce(ctx, f) {
    const a = toScreen(f.x, f.y);
    const y = a.y - WALL_HEIGHT + 14;
    ctx.fillStyle = WOOD_DARK;
    roundRectPath(ctx, a.x - 3, y + 2, 6, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(a.x - 6, y + 4);
    ctx.lineTo(a.x + 6, y + 4);
    ctx.lineTo(a.x + 4, y - 6);
    ctx.lineTo(a.x - 4, y - 6);
    ctx.closePath();
    ctx.fill();
  },

  // Hung on a wall face: a framed painting.
  picture(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 5, w = f.w * TILE, h = 22;
    // Flat on the wall with a thin gold frame (windows have deep frames,
    // sills and curtains, so the two never look alike).
    ctx.fillStyle = "rgba(40, 25, 10, 0.15)";
    ctx.fillRect(x + 1, y + 1.5, w, h);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y, w, h);
    const ix = x + 1.5, iy = y + 1.5, iw = w - 3, ih = h - 3;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    PICTURE_ART[f.art](ctx, ix, iy, iw, ih);
    ctx.restore();
  },

  // --- Secret office: lake house ---

  // A stone fireplace with a chimney, a wood mantel, and a crackling fire.
  fireplace(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const fp = drawBlock(ctx, f.x, f.y, f.w, f.h, 34, "#8d8a84");
    const { x, y, w, h } = fp.face;
    // Chimney rising up from the back.
    ctx.fillStyle = "#7d7a74";
    ctx.fillRect(x + w * 0.2, fp.top.y - 44, w * 0.6, 46);
    // Stones on the chimney and the front.
    const stones = ["#9a968f", "#85817a", "#a8a49c"];
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 4; i++) {
        const sx = x + w * 0.2 + ((row % 2) * 5 + i * 11), sy = fp.top.y - 42 + row * 5.5;
        if (sx + 9 > x + w * 0.8) continue;
        ctx.fillStyle = stones[(row + i) % 3];
        roundRectPath(ctx, sx, sy, 9, 4.5, 2);
        ctx.fill();
      }
    }
    for (let row = 0; row < 5; row++) {
      for (let sx = x + (row % 2) * 6; sx < x + w - 4; sx += 12) {
        ctx.fillStyle = stones[(row + Math.round(sx)) % 3];
        roundRectPath(ctx, sx + 1, y + 2 + row * 6.5, 10, 5, 2);
        ctx.fill();
      }
    }
    // Wood mantel.
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x - 3, y - 3, w + 6, 5);
    // Fire opening, logs and flickering flames.
    const ox = x + w / 2, oy = y + h - 3;
    ctx.fillStyle = "#2a1d14";
    ctx.beginPath();
    ctx.moveTo(ox - 14, oy);
    ctx.lineTo(ox - 14, oy - 12);
    ctx.arc(ox, oy - 12, 14, Math.PI, 0);
    ctx.lineTo(ox + 14, oy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(ox - 11, oy - 5, 22, 4);
    const t = performance.now() / 1000;
    for (const [dx, hgt, color] of [[-5, 14, "#e0602a"], [4, 16, "#e0602a"], [0, 18, "#f2a03a"], [-1, 11, "#fbd66a"]]) {
      const lick = Math.sin(t * 9 + dx) * 2.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + dx - 5, oy - 5);
      ctx.quadraticCurveTo(ox + dx, oy - 5 - hgt - lick, ox + dx + 5, oy - 5);
      ctx.fill();
    }
  },

  // Hung on a wall face: a canoe paddle and a fishing rod, crossed.
  paddle(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 4, w = f.w * TILE;
    ctx.strokeStyle = "#3a3a3a"; // fishing rod
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w - 6, y + 2);
    ctx.lineTo(x + 8, y + 30);
    ctx.stroke();
    ctx.fillStyle = "#b8923a";
    ctx.beginPath();
    ctx.arc(x + 13, y + 25, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 240, 240, 0.7)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w - 6, y + 2);
    ctx.lineTo(x + w - 5, y + 16);
    ctx.stroke();
    // Paddle: a wood shaft with a wide blade.
    ctx.save();
    ctx.translate(x + w / 2, y + 17);
    ctx.rotate(0.9);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(-16, -1, 32, 3);
    ctx.fillStyle = "#c89a68";
    ctx.fillRect(-18, -1.5, 22, 3);
    ctx.beginPath();
    ctx.ellipse(10, 0, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b5603c";
    ctx.fillRect(-20, -2, 4, 4);
    ctx.restore();
  },

  // A green tackle box with a brass latch.
  tackleBox(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#4f6b3a");
    ctx.fillStyle = "#3a5029";
    ctx.fillRect(b.top.x + b.top.w / 2 - 6, b.top.y + 2, 12, 3); // handle
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(b.face.x + b.face.w / 2 - 2, b.face.y + 3, 4, 4); // latch
  },

  // --- Secret office: STALKER bunker ---

  // Hung on a wall face: two old pipes with flanges, rust and a red valve.
  pipes(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 8, w = f.w * TILE;
    for (const [py, size] of [[y, 5], [y + 14, 4]]) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(x, py + 2, w, size);
      ctx.fillStyle = "#6f716c";
      ctx.fillRect(x, py, w, size);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(x, py, w, 1);
      ctx.fillStyle = "#555752";
      for (let fx = x + 14; fx < x + w; fx += 26) ctx.fillRect(fx, py - 1.5, 3, size + 3);
      ctx.fillStyle = "rgba(138, 75, 42, 0.6)";
      ctx.fillRect(x + w * 0.35, py + size - 1, 6, 2);
    }
    ctx.strokeStyle = "#8a2f24"; // valve wheel
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y - 3, 4, 0, Math.PI * 2);
    ctx.moveTo(x + w * 0.7 - 4, y - 3);
    ctx.lineTo(x + w * 0.7 + 4, y - 3);
    ctx.stroke();
  },

  // Hung on a wall face: a broken patch of concrete with rusty rebar
  // sticking out of it.
  rebar(ctx, f) {
    const a = toScreen(f.x, f.y);
    const x = a.x, y = a.y - WALL_HEIGHT + 6, w = f.w * TILE;
    ctx.fillStyle = "#6a6c67";
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 4);
    ctx.lineTo(x + w * 0.6, y);
    ctx.lineTo(x + w - 4, y + 8);
    ctx.lineTo(x + w - 10, y + 22);
    ctx.lineTo(x + w * 0.4, y + 26);
    ctx.lineTo(x + 4, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a4b2a";
    ctx.lineWidth = 1.5;
    for (const [x1, y1, x2, y2] of [[x + 8, y + 8, x + w - 6, y + 10], [x + 10, y + 17, x + w - 12, y + 19], [x + w * 0.4, y + 2, x + w * 0.45, y + 24]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  },

  // An olive army crate with a stencil, and a gas mask sitting on top.
  crate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#5b6340");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(c.face.x + 2.5, c.face.y + 2.5, c.face.w - 5, c.face.h - 6);
    ctx.fillStyle = "rgba(230, 225, 200, 0.55)"; // stencil marks
    ctx.fillRect(c.face.x + 8, c.face.y + 8, 14, 2);
    ctx.fillRect(c.face.x + 8, c.face.y + 12, 9, 2);
    ctx.fillStyle = "#8a4b2a";
    ctx.fillRect(c.face.x, c.face.y + c.face.h - 7, 4, 3);
    // Gas mask: a rubber face, two round lenses and a filter.
    const mx = c.top.x + c.top.w / 2, my = c.top.y + c.top.h / 2 - 4;
    ctx.fillStyle = "#3a3d38";
    ctx.beginPath();
    ctx.ellipse(mx, my, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#9fb3a8";
      ctx.beginPath();
      ctx.arc(mx + side * 4.5, my - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(mx + side * 4.5 - 1.5, my - 4, 1.5, 1.5);
    }
    ctx.fillStyle = "#5b6340";
    ctx.beginPath();
    ctx.arc(mx, my + 7, 4.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A grey steel desk with a yellow Geiger counter and a few papers.
  metalDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#6b6e68");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(d.face.x + d.face.w - 28.5, d.face.y + 4.5, 22, 7);
    ctx.strokeRect(d.face.x + d.face.w - 28.5, d.face.y + 12.5, 22, 7);
    const { x, y, w, h } = d.top;
    ctx.fillStyle = "#e8e2cf"; // papers
    ctx.fillRect(x + 8, y + 5, 18, h - 10);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 10, y + 8 + i * 4, 12, 1);
    // Geiger counter: a yellow box with a dial, and its probe on a cable.
    const gx = x + w - 34, gy = y + h / 2 - 12;
    ctx.fillStyle = "#c9a227";
    roundRectPath(ctx, gx, gy, 22, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#f3ecd8";
    ctx.beginPath();
    ctx.arc(gx + 8, gy + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a2f24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + 8, gy + 8);
    ctx.lineTo(gx + 8 + Math.cos(-0.8 + Math.sin(performance.now() / 300) * 0.4) * 4, gy + 8 + Math.sin(-0.8) * 4);
    ctx.stroke();
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx + 22, gy + 10);
    ctx.quadraticCurveTo(gx + 30, gy + 20, gx + 24, gy + 22);
    ctx.stroke();
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(gx + 16, gy + 20, 10, 3);
  },

  // A rusty oil barrel: a round drum, lighter on top where the light hits,
  // with two raised rings and a rust drip.
  barrel(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2, ry = 5, hgt = 30;
    const cx = base.x, bottom = base.y - ry, top = bottom - hgt;
    const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    side.addColorStop(0, "#6b3a20");
    side.addColorStop(0.45, "#9a5a34");
    side.addColorStop(1, "#6b3a20");
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.ellipse(cx, bottom, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, top);
    ctx.ellipse(cx, top, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 20, 10, 0.45)";
    ctx.lineWidth = 2;
    for (const ringY of [top + 10, top + 21]) {
      ctx.beginPath();
      ctx.ellipse(cx, ringY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(60, 30, 15, 0.5)";
    ctx.fillRect(cx - rx * 0.4, top + 3, 3, 14);
    ctx.fillStyle = "#a8683f";
    ctx.beginPath();
    ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3018";
    ctx.beginPath();
    ctx.arc(cx + rx * 0.4, top, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // --- Secret office: scholar's study ---

  // Hung on a wall face: a hanging calligraphy scroll with a red seal.
  scroll(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x + 2, y = a.y - WALL_HEIGHT + 3;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w - 4, 32);
    ctx.fillStyle = "#c9b48a";
    ctx.fillRect(x, y + 2, w - 4, 31);
    ctx.fillStyle = "#f5eedb";
    ctx.fillRect(x + 3, y + 5, w - 10, 25);
    ctx.fillStyle = "#5a2a1e"; // rods
    ctx.fillRect(x - 2, y, w, 3);
    ctx.fillRect(x - 2, y + 32, w, 3);
    ctx.fillStyle = "#1e1a17"; // brush strokes, like three characters
    const mx = x + (w - 4) / 2;
    for (let i = 0; i < 3; i++) {
      const cy = y + 9 + i * 7;
      ctx.fillRect(mx - 4, cy, 8, 1.3);
      ctx.fillRect(mx - 0.6, cy - 2, 1.3, 5);
      ctx.fillRect(mx - 3 + (i % 2) * 4, cy + 2, 3, 1.1);
    }
    ctx.fillStyle = "#b8322a"; // seal
    ctx.fillRect(mx + 1, y + 26, 3, 3);
  },

  // Potted bamboo: a celadon pot with a few tall jointed stalks.
  bamboo(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#7fa89a";
    roundRectPath(ctx, base.x - 10, base.y - 14, 20, 13, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(base.x - 8, base.y - 12, 16, 1.5);
    for (const [dx, hgt] of [[-5, 46], [0, 56], [5, 40]]) {
      ctx.fillStyle = "#6f9e4c";
      ctx.fillRect(base.x + dx - 1.5, base.y - 14 - hgt, 3, hgt);
      ctx.fillStyle = "#4f7a38";
      for (let ny = base.y - 24; ny > base.y - 14 - hgt; ny -= 10) ctx.fillRect(base.x + dx - 2, ny, 4, 1.5);
      ctx.fillStyle = "#7fb46a";
      ctx.beginPath();
      ctx.ellipse(base.x + dx + 5, base.y - 14 - hgt + 6, 6, 2, -0.5, 0, Math.PI * 2);
      ctx.ellipse(base.x + dx - 5, base.y - 14 - hgt + 12, 6, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A little bonsai tree in a shallow blue pot on a low wood stand.
  bonsai(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const stand = drawBlock(ctx, f.x, f.y, f.w, f.h, 10, "#5a2a1e");
    const cx = stand.top.x + stand.top.w / 2, cy = stand.top.y + stand.top.h / 2;
    ctx.fillStyle = "#3f6f8f";
    roundRectPath(ctx, cx - 11, cy - 6, 22, 7, 2);
    ctx.fill();
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.quadraticCurveTo(cx - 8, cy - 14, cx + 2, cy - 22);
    ctx.stroke();
    for (const [dx, dy, r, color] of [[-7, -18, 6, "#4f7a48"], [4, -24, 7, "#5c8a54"], [9, -16, 5, "#4f7a48"], [0, -28, 5, "#6fa05e"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A low lacquered writing desk with paper, an inkstone and brushes.
  lowDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#5a2a1e");
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x, d.face.y + 1, d.face.w, 1);
    const { x, y, w, h } = d.top;
    const mid = y + h / 2;
    // Rice paper with brush strokes.
    ctx.fillStyle = "#f5eedb";
    ctx.fillRect(x + w / 2 - 14, y + 4, 28, h - 8);
    ctx.fillStyle = "#1e1a17";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + w / 2 - 8 + i * 6, y + 8, 1.4, h - 16);
      ctx.fillRect(x + w / 2 - 10 + i * 6, y + 11 + (i % 2) * 4, 5, 1.2);
    }
    // Inkstone with a pool of ink.
    ctx.fillStyle = "#3a3a40";
    roundRectPath(ctx, x + 6, mid - 7, 16, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#15151a";
    ctx.beginPath();
    ctx.ellipse(x + 14, mid - 3, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brush rest with two brushes, and a brush pot.
    ctx.fillStyle = "#6f8a6a";
    ctx.fillRect(x + w - 30, mid + 4, 14, 3);
    ctx.strokeStyle = "#c89a68";
    ctx.lineWidth = 1.5;
    for (const by of [mid + 1, mid + 5]) {
      ctx.beginPath();
      ctx.moveTo(x + w - 34, by);
      ctx.lineTo(x + w - 14, by - 2);
      ctx.stroke();
      ctx.fillStyle = "#1e1a17";
      ctx.fillRect(x + w - 14, by - 3.5, 4, 2.5);
    }
    ctx.fillStyle = "#7fa89a";
    ctx.fillRect(x + w - 11, mid - 12, 7, 9);
    ctx.strokeStyle = "#c89a68";
    ctx.beginPath();
    ctx.moveTo(x + w - 9, mid - 12);
    ctx.lineTo(x + w - 11, mid - 20);
    ctx.moveTo(x + w - 6, mid - 12);
    ctx.lineTo(x + w - 4, mid - 19);
    ctx.stroke();
  },

  // A flat silk floor cushion to kneel on at the low desk.
  floorCushion(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, c.x - 13, c.y - 6, 26, 12, 5);
    ctx.fillStyle = "#b8322a";
    ctx.fill();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, c.x - 10, c.y - 4, 20, 8, 3);
    ctx.stroke();
  },

  // --- Secret office: dark cottage (fall, ivy, and a lot of cats) ---

  // Hung on a wall face: bundles of dried lavender, sage and wildflowers
  // hanging upside down from a little wooden rod.
  driedHerbs(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 6;
    ctx.fillStyle = "#4a3022";
    ctx.fillRect(x, y, w, 2.5);
    const bundles = [["#8a74a8", "#6f5a8c"], ["#8a9a6a", "#6f7f52"], ["#c96a3a", "#a8552e"], ["#b3a067", "#8f7f4f"]];
    bundles.forEach(([light, dark], i) => {
      const bx = x + 6 + i * ((w - 12) / (bundles.length - 1));
      ctx.strokeStyle = "#c9b48a"; // string
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, y + 2);
      ctx.lineTo(bx, y + 6);
      ctx.stroke();
      ctx.fillStyle = "#6b5a3a"; // stems
      ctx.fillRect(bx - 1.5, y + 5, 3, 5);
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = j % 2 ? dark : light;
        ctx.beginPath();
        ctx.ellipse(bx - 3 + j * 1.5, y + 13 + (j % 2) * 3, 1.6, 4, (j - 2) * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  // A dark wood writing desk with an open book, a cup of tea, a candle,
  // and a gray cat asleep on the papers.
  cottageDesk(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const d = drawBlock(ctx, f.x, f.y, f.w, f.h, 22, "#4a3022");
    const { x, y, w, h } = d.top;
    const mid = y + h / 2, t = performance.now() / 1000;
    ctx.fillStyle = "#3a2419"; // drawer and knob
    ctx.fillRect(d.face.x + d.face.w / 2 - 12, d.face.y + 5, 24, 8);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(d.face.x + d.face.w / 2 - 1.5, d.face.y + 8, 3, 2);
    ctx.fillStyle = "#efe3c8"; // open book
    ctx.fillRect(x + 6, mid - 7, 13, 12);
    ctx.fillRect(x + 20, mid - 7, 13, 12);
    ctx.fillStyle = "#6b3a2a";
    ctx.fillRect(x + 19, mid - 8, 1.5, 14);
    ctx.fillStyle = "rgba(60, 40, 30, 0.45)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 8, mid - 4 + i * 2.5, 9, 0.8);
      ctx.fillRect(x + 22, mid - 4 + i * 2.5, 9, 0.8);
    }
    ctx.fillStyle = "#e8dccb"; // teacup and saucer
    ctx.beginPath();
    ctx.ellipse(x + 41, mid + 3, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8472a";
    ctx.fillRect(x + 37.5, mid - 3, 7, 6);
    ctx.fillStyle = "#6b3a1e";
    ctx.fillRect(x + 38, mid - 3, 6, 1.5);
    drawCandle(ctx, x + w - 8, mid + 2, t);
    drawSleepingCat(ctx, x + w * 0.62, mid + 5, "#8d8d95", t, 0.8);
  },

  // A cat tree wrapped in rope, with a black cat perched on top.
  catTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = drawBlock(ctx, f.x, f.y, f.w, f.h, 6, "#6b4a3a");
    const cx = base.top.x + base.top.w / 2, by = base.top.y + base.top.h / 2;
    ctx.fillStyle = "#c9b089"; // rope-wrapped post
    ctx.fillRect(cx - 4, by - 34, 8, 34);
    ctx.fillStyle = "rgba(90, 65, 35, 0.4)";
    for (let ry = by - 32; ry < by; ry += 3) ctx.fillRect(cx - 4, ry, 8, 1);
    for (const [py, pw] of [[-16, 26], [-35, 22]]) {
      ctx.fillStyle = "#7a4a3a"; // carpeted platforms
      roundRectPath(ctx, cx - pw / 2, by + py - 3, pw, 7, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(cx - pw / 2 + 2, by + py - 3, pw - 4, 1.5);
    }
    ctx.strokeStyle = "#c9b089"; // a dangling toy
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 10, by - 16);
    ctx.lineTo(cx + 10 + Math.sin(performance.now() / 700) * 1.5, by - 8);
    ctx.stroke();
    ctx.fillStyle = "#b8472a";
    ctx.beginPath();
    ctx.arc(cx + 10 + Math.sin(performance.now() / 700) * 1.5, by - 7, 2, 0, Math.PI * 2);
    ctx.fill();
    drawSittingCat(ctx, cx, by - 38, "#2b2830", performance.now() / 1000);
  },

  // A velvet armchair facing into the room, with a knitted throw over one
  // arm and an orange cat curled up on the seat.
  cottageChair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, 0.25, 32, "#5e2f4a"); // back
    const seat = drawBlock(ctx, f.x + 0.12, f.y + 0.2, f.w - 0.24, f.h - 0.2, 12, "#6e3a58");
    drawBlock(ctx, f.x, f.y + 0.1, 0.2, f.h - 0.1, 18, "#5e2f4a"); // arms
    const arm = drawBlock(ctx, f.x + f.w - 0.2, f.y + 0.1, 0.2, f.h - 0.1, 18, "#5e2f4a");
    ctx.fillStyle = "#d9a441"; // knitted throw draped over the right arm
    ctx.fillRect(arm.top.x - 2, arm.top.y - 1, arm.top.w + 4, arm.top.h + arm.face.h - 2);
    ctx.fillStyle = "rgba(120, 80, 20, 0.35)";
    for (let ty = arm.top.y + 2; ty < arm.face.y + arm.face.h - 3; ty += 3) ctx.fillRect(arm.top.x - 2, ty, arm.top.w + 4, 1);
    drawSleepingCat(ctx, seat.top.x + seat.top.w / 2, seat.top.y + seat.top.h - 1, "#e8a15a", performance.now() / 1000 + 1.3, 0.85);
  },

  // A round cushioned cat bed with a calico cat asleep in it.
  catBed(ctx, f) {
    const c = toScreen(f.x + f.w / 2, f.y + f.h / 2);
    const rx = (f.w * TILE) / 2;
    ctx.fillStyle = "rgba(40, 25, 10, 0.22)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, rx + 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a3b2e"; // rim
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8d6b0"; // cushion
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 1, rx - 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSleepingCat(ctx, c.x, c.y + 4, "#f2ece2", performance.now() / 1000 + 2.6, 0.9, true);
  },

  // Pumpkins and a little gourd, with a jar candle glowing beside them.
  pumpkins(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    drawPumpkin(ctx, b.x - 3, b.y - 11, 12, 9, "#d9722e");
    drawPumpkin(ctx, b.x + 10, b.y - 6, 7, 5, "#efe3c8");
    drawPumpkin(ctx, b.x - 13, b.y - 5, 6, 4.5, "#7a8f4a");
    drawCandle(ctx, b.x + 12, b.y - 11, performance.now() / 1000 + 0.7, true);
  },

  // A wicker basket full of yarn, with one ball rolling off and unwinding.
  yarnBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const bk = drawBlock(ctx, f.x, f.y, f.w, f.h, 12, "#a8783e");
    ctx.strokeStyle = "rgba(90, 55, 20, 0.5)"; // weave
    ctx.lineWidth = 1;
    for (let wx = bk.face.x + 3; wx < bk.face.x + bk.face.w; wx += 4) {
      ctx.beginPath();
      ctx.moveTo(wx, bk.face.y + 1);
      ctx.lineTo(wx - 2, bk.face.y + bk.face.h - 1);
      ctx.stroke();
    }
    const top = bk.top;
    for (const [dx, color] of [[0.28, "#b8472a"], [0.55, "#d9a441"], [0.8, "#7a8f6a"]]) {
      drawYarnBall(ctx, top.x + top.w * dx, top.y + top.h / 2 - 2, 5.5, color);
    }
    const end = toScreen(f.x + f.w + 0.35, f.y + f.h);
    ctx.strokeStyle = "#5e2f4a"; // a loose strand to a ball on the floor
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x + top.w - 3, top.y + top.h);
    ctx.quadraticCurveTo(end.x - 6, end.y + 2, end.x, end.y - 4);
    ctx.stroke();
    drawYarnBall(ctx, end.x, end.y - 4, 4, "#5e2f4a");
  },

  // Ivy in a terracotta pot, trailing down over the rim and onto the floor.
  ivyPlant(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#b5623a";
    ctx.beginPath();
    ctx.moveTo(b.x - 10, b.y - 18);
    ctx.lineTo(b.x + 10, b.y - 18);
    ctx.lineTo(b.x + 7, b.y - 2);
    ctx.lineTo(b.x - 7, b.y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a4f2e";
    ctx.fillRect(b.x - 11, b.y - 20, 22, 4);
    for (const [dx, dy, r] of [[-5, -24, 6], [4, -26, 7], [0, -31, 5], [8, -21, 4]]) {
      ctx.fillStyle = "#3f6a30";
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawIvySprig(ctx, b.x - 8, b.y - 19, 20, -1);
    drawIvySprig(ctx, b.x + 8, b.y - 19, 15, 1);
    drawIvySprig(ctx, b.x + 1, b.y - 18, 11, 1);
  },

  // A tall grandfather clock: a wooden case, a face showing the real local
  // time, and a brass pendulum swinging behind a little glass window.
  grandfatherClock(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, f.h, 72, "#6b4630");
    const { x, y, w, h } = c.face;
    ctx.fillStyle = "#4a2f20"; // the crown on top
    ctx.fillRect(c.top.x - 2, c.top.y - 3, c.top.w + 4, 4);
    const cx = x + w / 2, fy = y + 13;
    ctx.fillStyle = "#f7f1e6"; // the face
    ctx.beginPath();
    ctx.arc(cx, fy, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(a) * 7 - 0.4, fy + Math.sin(a) * 7 - 0.4, 0.8, 0.8);
    }
    const now = new Date();
    const hand = (turn, len, width) => {
      const a = turn * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, fy);
      ctx.lineTo(cx + Math.cos(a) * len, fy + Math.sin(a) * len);
      ctx.stroke();
    };
    ctx.strokeStyle = "#2b2b2b";
    hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 4.5, 1.4);
    hand((now.getMinutes() + now.getSeconds() / 60) / 60, 6.5, 1);
    ctx.fillStyle = "rgba(200, 225, 235, 0.25)"; // the glass window
    ctx.fillRect(x + 5, y + 26, w - 10, h - 36);
    // One tick a second, swinging only as far as the window allows (the
    // bob's edge stays a pixel inside it), and clipped to the glass too.
    const room = (w - 10) / 2 - 4.5, arm = h - 42;
    const reach = Math.min(0.35, Math.asin(Math.max(0, Math.min(1, room / arm))));
    const swing = Math.sin(performance.now() / 1000 * Math.PI) * reach;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 5, y + 26, w - 10, h - 36);
    ctx.clip();
    ctx.translate(cx, y + 26);
    ctx.rotate(swing);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h - 44);
    ctx.stroke();
    ctx.fillStyle = "#d9b04a";
    ctx.beginPath();
    ctx.arc(0, h - 42, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(40, 25, 10, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 26, w - 10, h - 36);
  },

  // A bedroom door on the suite floor's wall (f.door comes from the house
  // server): about one and a half people wide and the wall's full height,
  // in a thin wooden frame, painted the owner's color with two tall inset
  // panels and a brass knob, with their nameplate, a little decoration, a
  // sticky note if they left one, a moon while they're away, and a light
  // showing who can come in: green open, amber knock first, red private,
  // or a balloon for a party.
  bedroomDoor(ctx, f) {
    const door = f.door;
    if (!door) return;
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, bottom = a.y, top = a.y - WALL_HEIGHT + 3;
    const h = bottom - top;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
    ctx.fillRect(x, top + 2, w + 4, h - 2);
    ctx.fillStyle = "#6b4630"; // a thin wooden frame
    ctx.fillRect(x - 2, top - 2, w + 4, h + 2);
    ctx.fillStyle = "#8a5c3c";
    ctx.fillRect(x - 2, top - 2, w + 4, 1.5); // (lit from above)
    const panel = ctx.createLinearGradient(0, top, 0, bottom);
    panel.addColorStop(0, shadeColor(door.color, 25));
    panel.addColorStop(1, shadeColor(door.color, -20));
    ctx.fillStyle = panel;
    ctx.fillRect(x, top, w, h);
    // Two tall inset panels, side by side.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    const pw = (w - 11) / 2;
    ctx.strokeRect(x + 4, top + 11, pw, h - 15);
    ctx.strokeRect(x + 7 + pw, top + 11, pw, h - 15);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(x + 4.5, top + 11.5);
    ctx.lineTo(x + 4.5 + pw, top + 11.5);
    ctx.moveTo(x + 7.5 + pw, top + 11.5);
    ctx.lineTo(x + 6.5 + pw * 2, top + 11.5);
    ctx.stroke();
    // The knob, on a little brass plate.
    ctx.fillStyle = "#b8923a";
    roundRectPath(ctx, x + w - 5.5, top + h * 0.5, 3, 6, 1);
    ctx.fill();
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.arc(x + w - 4, top + h * 0.5 + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // The nameplate.
    ctx.font = "700 6px 'Quicksand', sans-serif";
    const name = clipText(door.owner, 8, "…");
    const nw = Math.min(w - 4, ctx.measureText(name).width + 6);
    ctx.fillStyle = "#f7f1e6";
    roundRectPath(ctx, x + w / 2 - nw / 2, top + 2.5, nw, 7, 2);
    ctx.fill();
    ctx.fillStyle = "#4a3a2c";
    ctx.textAlign = "center";
    ctx.fillText(name, x + w / 2, top + 8, nw - 2);
    ctx.textAlign = "left";
    // The decoration, a little smaller than it'd be on a wide door.
    ctx.save();
    ctx.translate(x + w / 2, top + h * 0.45);
    ctx.scale(0.8, 0.8);
    drawDoorDeco(ctx, door.deco, 0, 0);
    ctx.restore();
    // A sticky note, if they left one (read it up close).
    if (door.note) {
      ctx.fillStyle = "#fff2a8";
      ctx.save();
      ctx.translate(x + 4, top + h * 0.7);
      ctx.rotate(-0.12);
      ctx.fillRect(0, 0, 7, 6);
      ctx.fillStyle = "rgba(90, 70, 40, 0.5)";
      ctx.fillRect(1.2, 1.8, 4.5, 0.8);
      ctx.fillRect(1.2, 3.6, 3.5, 0.8);
      ctx.restore();
    }
    // The light over the door (or a balloon for a party).
    if (door.privacy === "party") {
      const t = performance.now() / 1000;
      const bx = x + w + 4, by = top - 9 + Math.sin(t * 1.5 + x) * 1.5;
      ctx.strokeStyle = "rgba(90, 70, 50, 0.7)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bx, by + 6);
      ctx.quadraticCurveTo(bx - 2, by + 12, x + w - 1, top + 6);
      ctx.stroke();
      ctx.fillStyle = "#e84a5a";
      ctx.beginPath();
      ctx.ellipse(bx, by, 4.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.ellipse(bx - 1.5, by - 2, 1.2, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const light = { open: "#5fd07a", knock: "#f2a640", private: "#e8505a" }[door.privacy] ?? "#5fd07a";
      ctx.fillStyle = "#3a2a22";
      roundRectPath(ctx, x + w / 2 - 4, top - 6, 8, 4, 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(x + w / 2, top - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // A little moon on the door while its owner is away, asleep in bed.
    if (!door.online) {
      const mx = x + w - 6, my = top + 16;
      ctx.fillStyle = "#f4e3a1";
      ctx.beginPath();
      ctx.arc(mx, my, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeColor(door.color, 12); // the door shows through, making a crescent
      ctx.beginPath();
      ctx.arc(mx + 1.4, my - 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // --- The Workshop ---

  // The house's project board on the Workshop wall: a big corkboard with
  // three columns (To do, Doing, Done) of little sticky notes, colored by
  // who claimed them, kept up to date by kanban.js (globalThis.kanbanView
  // is { columns: [[colors], [colors], [colors]] } for the board last
  // looked at).
  kanbanBoard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 2, h = WALL_HEIGHT - 6;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow on the wall
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#8a5a3c"; // frame
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#c9a06a"; // cork
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = "rgba(120, 80, 40, 0.25)";
    for (let i = 0; i < 40; i++) ctx.fillRect(x + 4 + noise(i * 3.1) * (w - 8), y + 4 + noise(i * 5.7) * (h - 8), 1, 1);
    const colW = (w - 6) / 3;
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // column dividers
    for (const k of [1, 2]) ctx.fillRect(x + 3 + colW * k, y + 5, 1, h - 10);
    ctx.fillStyle = "#fffaf3"; // a little header strip on each column
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + colW * k + 3, y + 5, colW - 6, 3);
    ctx.fillStyle = ["#e0a84c", "#5aa0d8", "#7ac07a"][0];
    ["#e0a84c", "#5aa0d8", "#7ac07a"].forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + 3 + colW * k + 3, y + 5, 4, 3);
    });
    const columns = globalThis.kanbanView?.columns ?? [[], [], []];
    columns.forEach((notes, k) => {
      const perRow = Math.max(1, Math.floor((colW - 4) / 8));
      notes.slice(0, perRow * 3).forEach((color, i) => {
        const nx = x + 3 + colW * k + 3 + (i % perRow) * 8, ny = y + 11 + Math.floor(i / perRow) * 7;
        ctx.fillStyle = color || "#fff2a8";
        ctx.fillRect(nx, ny, 6, 5);
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(nx, ny + 4, 6, 1);
        ctx.fillStyle = "#c0303a"; // thumbtack
        ctx.fillRect(nx + 2.5, ny, 1, 1);
      });
      if (notes.length > perRow * 3) {
        ctx.fillStyle = "#5c4530";
        ctx.font = "700 6px 'Quicksand', sans-serif";
        ctx.fillText("+" + (notes.length - perRow * 3), x + 3 + colW * k + colW - 12, y + h - 5);
      }
    });
  },

  // A pegboard with tools hanging on it.
  pegboard(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + 3, h = WALL_HEIGHT - 9;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = "#d9b98a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // the holes
    for (let px = x + 3; px < x + w - 2; px += 5) for (let py = y + 3; py < y + h - 2; py += 5) ctx.fillRect(px, py, 1, 1);
    const cx = x + w / 2;
    ctx.fillStyle = "#7a5238"; // a hammer
    ctx.fillRect(x + 6, y + 6, 2, 14);
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(x + 3, y + 5, 8, 4);
    ctx.fillStyle = "#c0554a"; // a screwdriver
    ctx.fillRect(cx - 1.5, y + 5, 3, 7);
    ctx.fillStyle = "#b8bec6";
    ctx.fillRect(cx - 0.5, y + 12, 1, 10);
    ctx.strokeStyle = "#8a8f96"; // a wrench
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 8, y + 8);
    ctx.lineTo(x + w - 8, y + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 7, 3, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
  },

  // A sturdy workbench with a vise, some wood offcuts, and the "done jar":
  // a glass jar that fills up with little colored paper stars as cards are
  // finished (globalThis.kanbanJar, from kanban.js).
  workbench(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const legs = drawBlock(ctx, f.x + 0.1, f.y + 0.15, f.w - 0.2, f.h - 0.15, 20, "#6b4630");
    const top = drawBlock(ctx, f.x, f.y, f.w, f.h - 0.2, 6, "#a0703e");
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // the shelf underneath
    ctx.fillRect(legs.face.x + 4, legs.face.y + 6, legs.face.w - 8, 2);
    const t = top.top;
    ctx.fillStyle = "#8a8f96"; // a vise on the left end
    ctx.fillRect(t.x + 4, t.y - 6, 12, 7);
    ctx.fillStyle = "#5f656c";
    ctx.fillRect(t.x + 7, t.y - 9, 6, 3);
    ctx.fillStyle = "#d9b98a"; // a couple of wood offcuts
    ctx.fillRect(t.x + 24, t.y + 6, 18, 5);
    ctx.fillStyle = "#c49a5c";
    ctx.fillRect(t.x + 30, t.y + 2, 14, 4);
    // The done jar, on the right end.
    const jx = t.x + t.w - 24, jb = t.y + t.h - 4, jw = 16, jh = 22;
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
    ctx.fillStyle = "#fffaf3"; // its label
    ctx.fillRect(jx + 3, jb - 11, jw - 6, 5);
    ctx.fillStyle = "#5c4530";
    ctx.font = "700 4px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DONE", jx + jw / 2, jb - 7.5);
    ctx.textAlign = "left";
  },

  // A red metal toolbox with a handle.
  toolbox(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = drawBlock(ctx, f.x, f.y, f.w, f.h, 14, "#c0403a");
    ctx.fillStyle = "#8a2a24";
    ctx.fillRect(b.face.x, b.face.y + 4, b.face.w, 1.5);
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(b.face.x + b.face.w / 2 - 3, b.face.y + 6, 6, 3);
    ctx.strokeStyle = "#3a3a40"; // handle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.top.x + b.top.w / 2 - 7, b.top.y + b.top.h / 2);
    ctx.lineTo(b.top.x + b.top.w / 2 - 7, b.top.y + b.top.h / 2 - 5);
    ctx.lineTo(b.top.x + b.top.w / 2 + 7, b.top.y + b.top.h / 2 - 5);
    ctx.lineTo(b.top.x + b.top.w / 2 + 7, b.top.y + b.top.h / 2);
    ctx.stroke();
  },
});
