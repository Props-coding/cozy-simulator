// Part of the house's drawing code (see render.js for how the pieces fit
// together): turned furniture, seasonal decorations, bedrooms, little
// drawing helpers, doors, and the draw order (getStaticSprites).

Object.assign(FURNITURE_DRAWERS, {
  // (Turned furniture is built as models now: see render-models.js.)

  // --- Seasonal decorations (see SEASONAL in world.js) ---

  // A little seasonal decoration stuck on a hallway wall (see
  // seasonalWallDecor in world.js). `n` picks which one and how high it
  // sits, so a row of them looks scattered, not lined up. Autumn is
  // Halloween: bats, ghosts, a trio of flying bats, jack-o'-lanterns.
  // Winter: paper snowflakes. Spring: butterflies. Summer: suns and
  // watermelon slices.
  wallCutout(ctx, f) {
    const a = toScreen(f.x + f.w / 2, f.y);
    const cx = a.x, cy = a.y - WALL_HEIGHT + 9 + ((f.n * 7) % 3) * 7;
    const tilt = (((f.n * 13) % 5) - 2) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(1.25, 1.25);
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)"; // a soft shadow on the wall, lit from above
    ctx.beginPath();
    ctx.ellipse(1, 2.5, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const style = { autumn: ["bat", "ghost", "bats", "jack"], winter: ["snowflake"], spring: ["butterfly"], summer: ["sun", "melon"] }[f.style];
    CUTOUTS[style[f.n % style.length]](ctx, f.n);
    ctx.restore();
  },

  // A little pile of wrapped presents with ribbons.
  presents(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    for (const [dx, w, h, color, ribbon] of [[-6, 12, 12, "#c0303a", "#f2d07a"], [6, 10, 9, "#3f7a5a", "#f7f1e6"], [0, 9, 8, "#f2d07a", "#c0303a"]]) {
      const x = b.x + dx - w / 2, y = b.y - 3 - h - (dx === 0 ? 8 : 0);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = ribbon;
      ctx.fillRect(x + w / 2 - 1, y, 2, h);
      ctx.fillRect(x, y + h / 2 - 1, w, 2);
      ctx.beginPath(); // bow
      ctx.ellipse(x + w / 2 - 2.5, y - 1, 2.5, 1.6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + w / 2 + 2.5, y - 1, 2.5, 1.6, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A woven basket of pastel eggs.
  eggBasket(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    const eggs = ["#f2a0b8", "#a8d8e8", "#fff2a8", "#c8b0e8", "#b9e0a4"];
    eggs.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(b.x - 9 + i * 4.5, b.y - 12 - (i % 2) * 2, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#c49a5c";
    ctx.beginPath();
    ctx.moveTo(b.x - 12, b.y - 11);
    ctx.lineTo(b.x + 12, b.y - 11);
    ctx.lineTo(b.x + 9, b.y - 2);
    ctx.lineTo(b.x - 9, b.y - 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)"; // weave
    for (let k = 0; k < 3; k++) ctx.fillRect(b.x - 11, b.y - 9 + k * 2.5, 22, 0.8);
    ctx.strokeStyle = "#a07a42"; // handle
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 11, 10, Math.PI, 0);
    ctx.stroke();
  },

  // A wooden crate spilling over with pumpkins, apples and fallen leaves.
  autumnCrate(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = drawBlock(ctx, f.x + 0.05, f.y + 0.1, f.w - 0.1, f.h - 0.2, 13, "#a0703e");
    ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
    for (let k = 1; k < 3; k++) ctx.fillRect(c.face.x, c.face.y + (c.face.h * k) / 3, c.face.w, 1);
    const top = c.top.y + c.top.h / 2;
    for (const [dx, r, color] of [[-9, 7, "#e07a2e"], [5, 8, "#d9682a"], [-1, 5, "#f0c05a"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(c.top.x + c.top.w / 2 + dx, top - r * 0.6, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120, 50, 10, 0.25)";
      ctx.fillRect(c.top.x + c.top.w / 2 + dx - 0.5, top - r * 1.3, 1, r * 1.3);
      ctx.fillStyle = "#5a7a3a";
      ctx.fillRect(c.top.x + c.top.w / 2 + dx - 1, top - r * 1.45, 2, 3);
    }
    for (const dx of [12, 16]) {
      ctx.fillStyle = "#b82a2a"; // apples
      ctx.beginPath();
      ctx.arc(c.top.x + c.top.w / 2 + dx, top - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const b = toScreen(f.x, f.y + f.h);
    for (const [dx, a, color] of [[4, 0.8, "#c8552e"], [30, -1.2, "#e09a3a"], [18, 2.2, "#a8392a"]]) drawLeaf(ctx, b.x + dx, b.y - 1, a, 6, 3, color, null);
  },

  // A little decorated tree: stacked green tiers, a star, twinkling
  // lights and ornaments, with a present underneath.
  winterTree(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#b86b4b"; // pot
    ctx.fillRect(b.x - 6, b.y - 9, 12, 7);
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(b.x - 1.5, b.y - 13, 3, 5);
    const tiers = [[16, b.y - 12, 14], [13, b.y - 24, 13], [9.5, b.y - 35, 12]];
    for (const [half, base, h] of tiers) {
      ctx.fillStyle = "#2f6a42";
      ctx.beginPath();
      ctx.moveTo(b.x - half, base);
      ctx.lineTo(b.x + half, base);
      ctx.lineTo(b.x, base - h - 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // lit from above
      ctx.beginPath();
      ctx.moveTo(b.x, base - h - 4);
      ctx.lineTo(b.x - half * 0.5, base - h * 0.4);
      ctx.lineTo(b.x, base - h * 0.5);
      ctx.fill();
    }
    const t = performance.now() / 1000;
    const bulbs = [[-9, -15], [7, -17], [-3, -21], [10, -13], [-6, -28], [5, -30], [0, -38], [-12, -14], [2, -25]];
    bulbs.forEach(([dx, dy], i) => {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2.5 + i * 1.7);
      ctx.fillStyle = ["#ffe08a", "#ff9aa8", "#a8d8ff"][i % 3];
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    for (const [dx, dy] of [[-5, -16], [6, -24], [-2, -33]]) {
      ctx.fillStyle = "#c0303a"; // ornaments
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y + dy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2d07a"; // the star on top
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 2 : 4.5, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(b.x + Math.cos(a) * r, b.y - 52 + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#5a8ac8"; // a present under the tree
    ctx.fillRect(b.x + 8, b.y - 9, 9, 7);
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(b.x + 11.5, b.y - 9, 2, 7);
  },

  // A wooden planter box full of tulips and daffodils.
  flowerPlanter(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const box = drawBlock(ctx, f.x + 0.05, f.y + 0.25, f.w - 0.1, f.h - 0.3, 11, "#9a6a3e");
    const cx = box.top.x + box.top.w / 2, soil = box.top.y + box.top.h / 2;
    ctx.fillStyle = "#5a3f2a"; // soil
    ctx.fillRect(box.top.x + 3, box.top.y + 2, box.top.w - 6, box.top.h - 4);
    const colors = ["#f2c94c", "#e8607a", "#f7f1e6", "#f2a0b8", "#f2c94c", "#c8b0e8", "#e8607a"];
    colors.forEach((color, i) => {
      const x = cx - 14 + i * 4.7, h = 12 + ((i * 5) % 7), base = soil + (i % 2) * 2;
      ctx.strokeStyle = "#4f8a4a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h);
      ctx.stroke();
      drawLeaf(ctx, x, base, i % 2 ? 0.4 : -0.4, 8, 2, "#5a9a4a", null);
      ctx.fillStyle = color;
      ctx.beginPath(); // a little cup-shaped bloom
      ctx.moveTo(x - 3, base - 2 - h);
      ctx.lineTo(x - 2, base + 3 - h);
      ctx.lineTo(x + 2, base + 3 - h);
      ctx.lineTo(x + 3, base - 2 - h);
      ctx.lineTo(x + 1, base - h);
      ctx.lineTo(x, base - 3 - h);
      ctx.lineTo(x - 1, base - h);
      ctx.fill();
    });
  },

  // A standing electric fan with a gently spinning blade.
  floorFan(ctx, f) {
    drawShadow(ctx, f.x + 0.15, f.y + 0.2, f.w - 0.3, f.h - 0.3);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = "#e9e3d6"; // base and pole
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(b.x - 1.5, b.y - 34, 3, 30);
    const cy = b.y - 42;
    ctx.fillStyle = "#a8d8d0"; // mint cage
    ctx.beginPath();
    ctx.arc(b.x, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    const spin = performance.now() / 120;
    for (let k = 0; k < 3; k++) {
      const a = spin + (k / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(b.x + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5.5, 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(90, 130, 125, 0.6)";
    ctx.lineWidth = 0.8;
    for (let r = 5; r <= 13; r += 4) {
      ctx.beginPath();
      ctx.arc(b.x, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9e3d6";
    ctx.beginPath();
    ctx.arc(b.x, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // --- Upstairs and bedrooms ---

  // Elevator doors set into the back wall: a brass frame, two brushed
  // metal doors that slide apart (ELEVATOR_OPEN, set while someone rides)
  // onto a warm lit car, a little arrow showing which way it goes, and a
  // brass call button beside it.
  elevatorDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE, x = a.x, bottom = a.y, top = a.y - WALL_HEIGHT + 3;
    const h = bottom - top;
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)"; // shadow of the frame on the wall
    ctx.fillRect(x - 2, top + 2, w + 6, h);
    ctx.fillStyle = "#b8904a"; // brass frame
    ctx.fillRect(x - 3, top - 1, w + 6, h + 1);
    ctx.fillStyle = "#e0bd6e"; // lit top edge
    ctx.fillRect(x - 3, top - 1, w + 6, 1.5);
    const inX = x + 1, inW = w - 2, inTop = top + 7;
    // The car inside: warm light, a handrail and a patterned floor.
    const car = ctx.createLinearGradient(0, inTop, 0, bottom);
    car.addColorStop(0, "#f4d9a0");
    car.addColorStop(1, "#c9965a");
    ctx.fillStyle = car;
    ctx.fillRect(inX, inTop, inW, bottom - inTop);
    ctx.fillStyle = "#a5773f";
    ctx.fillRect(inX, inTop + 14, inW, 1.5);
    ctx.fillStyle = "#8a3b3b";
    ctx.fillRect(inX, bottom - 5, inW, 5);
    // The doors, sliding apart from the middle.
    const open = ELEVATOR_OPEN[f.floor] || 0;
    const half = inW / 2, slide = half * open * 0.92;
    for (const side of [-1, 1]) {
      const dx = side < 0 ? inX - slide : inX + half + slide;
      const door = ctx.createLinearGradient(dx, 0, dx + half, 0);
      door.addColorStop(0, "#cfd3d6");
      door.addColorStop(0.5, "#eef0f1");
      door.addColorStop(1, "#b9bec2");
      ctx.save();
      ctx.beginPath();
      ctx.rect(inX, inTop, inW, bottom - inTop);
      ctx.clip(); // doors slide into the wall, not past the frame
      ctx.fillStyle = door;
      ctx.fillRect(dx, inTop, half, bottom - inTop);
      ctx.fillStyle = "rgba(90, 95, 100, 0.35)"; // the seam and a brass kick plate
      ctx.fillRect(side < 0 ? dx + half - 1 : dx, inTop, 1, bottom - inTop);
      ctx.fillStyle = "#c9a45a";
      ctx.fillRect(dx, bottom - 4, half, 4);
      ctx.restore();
    }
    // Floor indicator: a small dark window with a glowing arrow.
    const cx = x + w / 2;
    ctx.fillStyle = "#3a2a22";
    roundRectPath(ctx, cx - 7, top, 14, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#ffcf6e";
    ctx.beginPath();
    if (f.floor === 0) {
      ctx.moveTo(cx - 3, top + 4.5);
      ctx.lineTo(cx + 3, top + 4.5);
      ctx.lineTo(cx, top + 1.2);
    } else {
      ctx.moveTo(cx - 3, top + 1.5);
      ctx.lineTo(cx + 3, top + 1.5);
      ctx.lineTo(cx, top + 4.8);
    }
    ctx.fill();
    // The call button panel beside the doors.
    const px = x + w + 6, py = top + 14;
    ctx.fillStyle = "#b8904a";
    roundRectPath(ctx, px, py, 7, 12, 2);
    ctx.fill();
    ctx.fillStyle = open > 0 ? "#ffd27a" : "#f3e6d0";
    ctx.beginPath();
    ctx.arc(px + 3.5, py + 6, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // A little nightstand with a drawer and a glowing lamp.
  nightstand(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const n = drawBlock(ctx, f.x, f.y, f.w, f.h, 18, "#7a5238");
    ctx.fillStyle = "#5c3d2a";
    ctx.fillRect(n.face.x + 4, n.face.y + 4, n.face.w - 8, 6);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(n.face.x + n.face.w / 2 - 1.5, n.face.y + 6, 3, 2);
    const cx = n.top.x + n.top.w / 2, cy = n.top.y + n.top.h / 2;
    ctx.fillStyle = "#5c4530"; // lamp stand and shade
    ctx.fillRect(cx - 1, cy - 14, 2, 14);
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 12);
    ctx.lineTo(cx + 8, cy - 12);
    ctx.lineTo(cx + 5, cy - 22);
    ctx.lineTo(cx - 5, cy - 22);
    ctx.closePath();
    ctx.fill();
    // The journal lying beside the lamp, with a ribbon bookmark.
    if (f.journal) {
      const bx = n.top.x + 2, by = n.top.y + n.top.h / 2 - 3;
      ctx.fillStyle = "#8c3b46";
      ctx.fillRect(bx, by, 7, 5);
      ctx.fillStyle = "#f3e6cc"; // the pages' edge
      ctx.fillRect(bx + 7, by + 0.5, 1, 4);
      ctx.fillStyle = "#e0b84c";
      ctx.fillRect(bx + 4, by + 5, 1, 2.5);
    }
  },

  fridge(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const fr = drawBlock(ctx, f.x, f.y, f.w, f.h, 46, "#dfe6ea");
    ctx.fillStyle = "#9aa6ad";
    ctx.fillRect(fr.face.x + fr.face.w - 8, fr.face.y + 8, 3, 14); // handle
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(fr.face.x + 6, fr.face.y + 8, 8, 8); // a magnet
  },

  snackTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, WOOD);
    const { x, y, h } = t.top;
    // A chips bag and a few soda cans.
    ctx.fillStyle = "#e0a84c";
    roundRectPath(ctx, x + 8, y + h / 2 - 14, 16, 20, 3);
    ctx.fill();
    const cans = ["#c0554a", "#4a90a4", "#7a9e5c"];
    cans.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + 32 + i * 9, y + h / 2 - 10, 6, 12);
      ctx.fillStyle = "#cfd6da";
      ctx.fillRect(x + 32 + i * 9, y + h / 2 - 11, 6, 2);
    });
  },

  // The shared study table: open books, mugs, a stack of books and a lamp.
  studyTable(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#8b5e3c");
    const { x, y, w, h } = t.top;
    const mid = y + h / 2;
    // Open books.
    for (const bx of [x + 10, x + w - 64]) {
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(bx, mid - 4, 26, 15);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(bx + 12.5, mid - 4, 1, 15);
      ctx.fillRect(bx + 3, mid, 7, 1);
      ctx.fillRect(bx + 16, mid + 3, 7, 1);
    }
    // Mugs of tea.
    for (const [mx, color] of [[x + 44, "#e8dcc8"], [x + w - 28, "#c0554a"]]) {
      ctx.fillStyle = color;
      ctx.fillRect(mx, mid - 6, 9, 10);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx + 10, mid - 1, 3, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = "#5c3a22";
      ctx.fillRect(mx + 1, mid - 6, 7, 2);
    }
    // A stack of closed books.
    const stack = ["#4a90a4", "#e0a84c", "#7a9e5c"];
    stack.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + w / 2 + 14, mid + 4 - i * 5, 20 - i * 2, 5);
    });
    drawLamp(ctx, x + w / 2, mid + 2);
  },

  // A cozy reading armchair facing up toward the window, so you see its
  // back, with a blanket draped over the top.
  // An armchair facing the room: its tall back behind (with a blanket
  // folded over it), the seat cushion in front, and an arm each side.
  armchair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const back = drawBlock(ctx, f.x + 0.05, f.y, f.w - 0.1, 0.3, 32, "#a8732c");
    ctx.fillStyle = "#6f8a6a"; // the blanket over the back
    ctx.fillRect(back.face.x + back.face.w * 0.55, back.top.y, back.face.w * 0.3, back.face.h + back.top.h - 8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(back.face.x + back.face.w * 0.55, back.top.y + back.face.h + back.top.h - 10, back.face.w * 0.3, 2);
    drawBlock(ctx, f.x + 0.12, f.y + 0.25, f.w - 0.24, f.h - 0.25, 12, "#c98f3c"); // the seat
    drawBlock(ctx, f.x, f.y + 0.1, 0.2, f.h - 0.1, 18, "#b07c30"); // the arms
    drawBlock(ctx, f.x + f.w - 0.2, f.y + 0.1, 0.2, f.h - 0.1, 18, "#b07c30");
  },

  // A tall standing lamp with a fabric shade.
  floorLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const base = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.fillStyle = WOOD_DARK;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - 2, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(base.x - 1.5, base.y - 58, 3, 56);
    ctx.fillStyle = "#f2d9a0";
    ctx.beginPath();
    ctx.moveTo(base.x - 12, base.y - 52);
    ctx.lineTo(base.x + 12, base.y - 52);
    ctx.lineTo(base.x + 7, base.y - 70);
    ctx.lineTo(base.x - 7, base.y - 70);
    ctx.closePath();
    ctx.fill();
  },

  // A squishy beanbag, lighter on top where the light hits it.
  beanbag(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const c = toScreen(f.x + f.w / 2, f.y + f.h);
    const rx = (f.w * TILE) / 2, ry = 20;
    const fill = ctx.createLinearGradient(0, c.y - 2 * ry, 0, c.y);
    fill.addColorStop(0, "#d98c6a");
    fill.addColorStop(1, "#9a5439");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)"; // the dip where you sit
    ctx.beginPath();
    ctx.ellipse(c.x + 2, c.y - ry - 4, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Warm string lights draped along the top of a wall.
  lights(ctx, f) {
    ctx.strokeStyle = "rgba(60, 40, 20, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    stringLightBulbs(f).forEach((bulb, i) => (i === 0 ? ctx.moveTo(bulb.x, bulb.y) : ctx.lineTo(bulb.x, bulb.y)));
    ctx.stroke();
    for (const bulb of stringLightBulbs(f)) {
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  table(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const t = drawBlock(ctx, f.x, f.y, f.w, f.h, 24, "#8b6b4a");
    const cx = t.top.x + t.top.w / 2, cy = t.top.y + t.top.h / 2;
    // A cloth runner down the middle of the table.
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(t.top.x + 4, cy - 8, t.top.w - 8, 16);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(t.top.x + 4, cy - 6, t.top.w - 8, 1);
    ctx.fillRect(t.top.x + 4, cy + 5, t.top.w - 8, 1);
    // A plate in front of each chair.
    const plates = [[0, -t.top.h / 2 + 8], [0, t.top.h / 2 - 7], [-t.top.w / 2 + 10, 0], [t.top.w / 2 - 10, 0]];
    for (const [dx, dy] of plates) {
      ctx.fillStyle = "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Two candles either side of the fruit bowl.
    for (const dx of [-22, 22]) {
      ctx.fillStyle = "#f3e6c8";
      ctx.fillRect(cx + dx - 2, cy - 12, 4, 10);
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy - 15, 1.8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fruit bowl in the middle of the tabletop.
    ctx.fillStyle = "#e8dcc8";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const fruit = [[-6, -3, "#c0554a"], [5, -4, "#e0a84c"], [0, 1, "#7a9e5c"]];
    for (const [dx, dy, color] of fruit) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A dining chair. The backrest goes on the side opposite where it faces:
  // facing "down" (toward you) has its back at the top, facing "up" has its
  // back at the bottom (so you see the back of the chair), and facing
  // "left" or "right" has its back along the other side.
  chair(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const back = f.back || "#8a6448", seat = f.seat || "#a3785a", t = 0.15;
    if (f.facing === "up") {
      drawBlock(ctx, f.x, f.y, f.w, f.h - t, 16, seat);
      drawBlock(ctx, f.x, f.y + f.h - t, f.w, t, 30, back);
    } else if (f.facing === "left") {
      drawBlock(ctx, f.x, f.y, f.w - t, f.h, 16, seat);
      drawBlock(ctx, f.x + f.w - t, f.y, t, f.h, 30, back);
    } else if (f.facing === "right") {
      drawBlock(ctx, f.x + t, f.y, f.w - t, f.h, 16, seat);
      drawBlock(ctx, f.x, f.y, t, f.h, 30, back);
    } else {
      drawBlock(ctx, f.x, f.y, f.w, t, 30, back);
      drawBlock(ctx, f.x, f.y + t, f.w, f.h - t, 16, seat);
    }
  },

  // The door at the west end of the hallway that you use to build an
  // office: a paneled wood door in a lighter frame, with a brass knob, a
  // little brass "Office" sign, and a welcome mat on the floor in front.
  buildDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const doorW = 30, doorH = WALL_HEIGHT - 5;
    const x = a.x + (f.w * TILE - doorW) / 2, y = a.y - doorH;

    drawDoorFrame(ctx, x, y, doorW, doorH);
    drawDoorLeaf(ctx, x, y, doorW, doorH);
    drawKnob(ctx, x + doorW - 6, y + doorH * 0.58);

    // Small brass sign on the top panel, with a tiny "+" for "build".
    ctx.fillStyle = "#d9b04a";
    roundRectPath(ctx, x + doorW / 2 - 7, y + 6, 14, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#6b4a1e";
    ctx.fillRect(x + doorW / 2 - 3, y + 9.5, 6, 1);
    ctx.fillRect(x + doorW / 2 - 0.5, y + 7.5, 1, 5);

    // Welcome mat on the floor just in front of the door.
    roundRectPath(ctx, x - 4, a.y + 3, doorW + 8, 9, 3);
    ctx.fillStyle = "#b5543f";
    ctx.fill();
    roundRectPath(ctx, x - 1.5, a.y + 5, doorW + 3, 5, 2);
    ctx.strokeStyle = "#d98c6a";
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // A locked office: the doorway gets a matching wall top, a frame, a pair
  // of paneled doors shut in the middle, and a brass padlock across them.
  closedDoor(ctx, f) {
    const a = toScreen(f.x, f.y);
    const w = f.w * TILE;

    // Soft shade on the floor below, same as every wall.
    const shade = ctx.createLinearGradient(0, a.y, 0, a.y + 10);
    shade.addColorStop(0, "rgba(40, 25, 10, 0.22)");
    shade.addColorStop(1, "rgba(40, 25, 10, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(a.x, a.y, w, 10);

    // Wall top above the doorway, so the wall's top edge runs unbroken.
    const capTop = toScreen(f.x, f.y - WALL_THICKNESS).y - WALL_HEIGHT;
    ctx.fillStyle = WOOD;
    ctx.fillRect(a.x, capTop, w, a.y - WALL_HEIGHT - capTop);

    const frame = 3;
    const x = a.x + frame, y = a.y - WALL_HEIGHT + frame, doorH = WALL_HEIGHT - frame;
    const leafW = (w - frame * 2) / 2;
    drawDoorFrame(ctx, x, y, w - frame * 2, doorH);
    drawDoorLeaf(ctx, x, y, leafW, doorH);
    drawDoorLeaf(ctx, x + leafW, y, leafW, doorH);
    ctx.fillStyle = "rgba(40, 20, 5, 0.35)";
    ctx.fillRect(x + leafW - 0.5, y, 1, doorH); // the seam where the doors meet
    drawKnob(ctx, x + leafW - 5, y + doorH * 0.58);
    drawKnob(ctx, x + leafW + 5, y + doorH * 0.58);

    // Padlock hanging across the two knobs.
    const lx = x + leafW, ly = y + doorH * 0.58 + 3;
    ctx.strokeStyle = "#b8923a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#d9b04a";
    roundRectPath(ctx, lx - 5.5, ly, 11, 9, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(lx - 4, ly + 1, 8, 1.5);
    ctx.fillStyle = "#6b4a1e";
    ctx.beginPath();
    ctx.arc(lx, ly + 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(lx - 0.6, ly + 4, 1.2, 3);
  },

  // Hung on a wall face: a small round-cornered mirror.
  mirror(ctx, f) {
    const a = toScreen(f.x, f.y);
    const top = a.y - WALL_HEIGHT + (f.short ? 3 : 5), w = f.w * TILE, h = f.short ? 17 : 26;
    ctx.fillStyle = "rgba(40, 25, 10, 0.18)";
    roundRectPath(ctx, a.x + 2, top + 3, w, h, 6);
    ctx.fill();
    ctx.fillStyle = WOOD_DARK;
    roundRectPath(ctx, a.x, top, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#dfeaf2";
    roundRectPath(ctx, a.x + 3, top + 3, w - 6, h - 6, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    roundRectPath(ctx, a.x + 6, top + 5, 5, h - 12, 2);
    ctx.fill();
  },
});

// A kitchen counter: cream cupboards with a wood worktop. Returns the
// block's boxes so the stove and sink can add their details on top.
// --- Little helpers for the dark cottage office ---

// An arch-topped window shape (a rectangle with a round top).
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// A strand of ivy hanging down from (x, y), `length` pixels long, with
// little leaves on alternating sides. `lean` (-1 or 1) curls it sideways.
function drawIvySprig(ctx, x, y, length, lean) {
  ctx.strokeStyle = "#3d5a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 4, y + length * 0.5, x + lean * 2, y + length);
  ctx.stroke();
  const colors = ["#4f7a3a", "#5f8a44", "#3f6a30"];
  for (let i = 0, d = 2; d < length; i++, d += 3.5) {
    const k = d / length;
    const lx = x + lean * 4 * 2 * k * (1 - k) + lean * 2 * k * k;
    ctx.fillStyle = colors[i % 3];
    ctx.beginPath();
    ctx.ellipse(lx + (i % 2 ? 2 : -2), y + d, 2, 1.4, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A small candle with a flickering flame. `jar` puts it in a glass jar.
function drawCandle(ctx, x, y, t, jar = false) {
  if (jar) {
    ctx.fillStyle = "rgba(200, 150, 90, 0.45)";
    roundRectPath(ctx, x - 4, y - 8, 8, 9, 2);
    ctx.fill();
  }
  ctx.fillStyle = "#efe3c8";
  ctx.fillRect(x - 2, y - 7, 4, 7);
  const lick = Math.sin(t * 11) * 0.6 + Math.sin(t * 17) * 0.4;
  ctx.fillStyle = "#f2a03a";
  ctx.beginPath();
  ctx.moveTo(x - 1.8, y - 8);
  ctx.quadraticCurveTo(x + lick, y - 14, x + 1.8, y - 8);
  ctx.fill();
  ctx.fillStyle = "#fbe39a";
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 0.9, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A round pumpkin (or gourd) with ribs and a little stem.
function drawPumpkin(ctx, cx, cy, rx, ry, color) {
  for (const i of [-1, 1, 0]) {
    ctx.fillStyle = i === 0 ? color : shadeColor(color, -18);
    ctx.beginPath();
    ctx.ellipse(cx + i * rx * 0.42, cy, rx * 0.6, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.1, cy - ry * 0.55, rx * 0.3, ry * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a4a2a";
  ctx.fillRect(cx - 1, cy - ry - 3, 2.5, 4);
}

// A ball of yarn with a couple of wound lines across it.
function drawYarnBall(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -30);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy + r * 0.2, r * 0.8, -0.9, 0.9);
  ctx.moveTo(cx + r * 0.9, cy - r * 0.3);
  ctx.arc(cx + r * 0.3, cy - r * 0.2, r * 0.7, 2.2, 3.9);
  ctx.stroke();
}

// A cat curled up asleep, breathing slowly, centered at (x, y) where its
// belly rests. `calico` adds orange and black patches.
function drawSleepingCat(ctx, x, y, color, t, size = 1, calico = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size * (1 + Math.sin(t * 1.8) * 0.04));
  petEar(ctx, -9, -7.5, 3.4, 3.6, color, "#f3b8b8");
  petEar(ctx, -4.5, -8, 3.4, 3.6, color, "#f3b8b8");
  petBlob(ctx, 1, -4.5, 10, 5, color);
  if (calico) {
    ctx.fillStyle = "#d9803a";
    ctx.beginPath();
    ctx.ellipse(4, -6, 3.5, 2.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2830";
    ctx.beginPath();
    ctx.ellipse(-1, -7.5, 2.5, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  petBlob(ctx, -6.5, -4.5, 4.6, 3.8, color);
  petEye(ctx, -8.2, -4.6, true, 1);
  petEye(ctx, -5, -4.6, true, 1);
  ctx.strokeStyle = shadeColor(color, -20); // tail wrapped around the front
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.quadraticCurveTo(6, 1.5, -3, 0.2);
  ctx.stroke();
  ctx.restore();
  // Now and then, a small "z" drifts up.
  const z = (t * 0.35) % 1;
  if (z < 0.6) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - z / 0.6);
    ctx.fillStyle = "#8a8098";
    ctx.font = `700 ${Math.round(6 + z * 6)}px 'Quicksand', sans-serif`;
    ctx.fillText("z", x - 8 * size + z * 6, y - 12 * size - z * 12);
    ctx.restore();
  }
}

// A cat sitting up, facing you, with a swishing tail and slow blinks.
// (x, y) is where it sits.
function drawSittingCat(ctx, x, y, color, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; // tail
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(12, -4, 10 + Math.sin(t * 1.5) * 3, -13);
  ctx.stroke();
  petBlob(ctx, 0, -7, 5.5, 7, color);
  petEar(ctx, -3, -17.5, 3.6, 4.5, color, "#6b4a5a");
  petEar(ctx, 3, -17.5, 3.6, 4.5, color, "#6b4a5a");
  petBlob(ctx, 0, -15, 5, 4.3, color);
  const blink = t % 5 < 0.15;
  if (blink) {
    petEye(ctx, -2, -15.5, true, 1.1);
    petEye(ctx, 2, -15.5, true, 1.1);
  } else {
    ctx.fillStyle = "#c9d94a"; // green-gold eyes
    for (const ex of [-2, 2]) {
      ctx.beginPath();
      ctx.ellipse(ex, -15.5, 1.3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-2.3, -16.6, 0.6, 2.2);
    ctx.fillRect(1.7, -16.6, 0.6, 2.2);
  }
  ctx.fillStyle = "#e37aa0";
  ctx.fillRect(-0.6, -13.6, 1.2, 0.8);
  ctx.restore();
}

// A plant pot, centered at cx with its bottom at by: "clay" (terracotta),
// "ceramic" (white), "basket" (woven), "glazed" (blue), "cement", "pink"
// or "black". w is
// half its width at the top, h its height. Returns the y of the soil,
// where the plant grows from.
function drawPot(ctx, cx, by, style = "clay", w = 11, h = 16) {
  const [body, band, rim] = {
    clay: ["#b86b4b", "#9a5439", "#cf8260"],
    ceramic: ["#ece6dc", "#cfc6b8", "#f7f3ec"],
    basket: ["#c49a5c", "#9c7440", "#d8b67e"],
    glazed: ["#4f7aa0", "#3a5f80", "#6f98bc"],
    cement: ["#9a9a94", "#7f7f79", "#b3b3ad"],
    pink: ["#efb8c4", "#d898a8", "#f7d0da"],
    black: ["#3a3a40", "#2b2b30", "#55555c"],
  }[style];
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.8, by);
  ctx.lineTo(cx + w * 0.8, by);
  ctx.lineTo(cx + w, by - h);
  ctx.lineTo(cx - w, by - h);
  ctx.closePath();
  ctx.fill();
  if (style === "basket") {
    ctx.strokeStyle = "rgba(90, 60, 25, 0.45)"; // the weave
    ctx.lineWidth = 1;
    for (let y = by - 4; y > by - h; y -= 4) {
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx + w, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // a soft highlight, lit from above
    ctx.fillRect(cx - w * 0.6, by - h + 4, 3, h - 7);
  }
  ctx.fillStyle = band;
  ctx.fillRect(cx - w * 0.8, by - 3, w * 1.6, 3);
  ctx.fillStyle = rim;
  ctx.fillRect(cx - w - 1, by - h - 4, (w + 1) * 2, 5);
  return by - h - 2;
}

// --- Little drawing helpers for plants, vases and shelves ---

// A pointed leaf growing from (x, y), pointing along `angle` (0 is
// straight up), `len` long and `wid` wide at its middle.
function drawLeaf(ctx, x, y, angle, len, wid, color, vein = "rgba(255, 255, 255, 0.2)") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
  ctx.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
  ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, -len + 2);
    ctx.stroke();
  }
  ctx.restore();
}

// A heart-shaped leaf centered at (x, y).
function drawHeartLeaf(ctx, x, y, size, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.bezierCurveTo(-size * 1.3, 0, -size * 0.7, -size * 1.1, 0, -size * 0.45);
  ctx.bezierCurveTo(size * 0.7, -size * 1.1, size * 1.3, 0, 0, size);
  ctx.fill();
  ctx.restore();
}

// A vase standing at (cx, by): "glass" (with water), "cream", "amber" (a
// little bud vase), "stone" (tall and speckled) or "jug". Returns the y
// of its mouth.
function drawVase(ctx, cx, by, style = "glass") {
  const shapes = {
    glass: { w: 7, h: 22, neck: 4, color: "rgba(200, 225, 235, 0.55)" },
    cream: { w: 8, h: 20, neck: 4, color: "#efe6d6" },
    amber: { w: 5, h: 16, neck: 2.5, color: "rgba(200, 120, 50, 0.75)" },
    stone: { w: 8, h: 30, neck: 4, color: "#d8cbb8" },
    jug: { w: 9, h: 18, neck: 5, color: "#e9d27a" },
  };
  const s = shapes[style];
  const top = by - s.h;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.moveTo(cx - s.neck, top);
  ctx.quadraticCurveTo(cx - s.w * 1.4, by - s.h * 0.45, cx - s.w * 0.8, by);
  ctx.lineTo(cx + s.w * 0.8, by);
  ctx.quadraticCurveTo(cx + s.w * 1.4, by - s.h * 0.45, cx + s.neck, top);
  ctx.closePath();
  ctx.fill();
  if (style === "glass") {
    ctx.fillStyle = "rgba(150, 200, 220, 0.35)"; // water
    ctx.fillRect(cx - s.w + 1, by - s.h * 0.5, (s.w - 1) * 2, s.h * 0.5 - 1);
  }
  if (style === "stone") {
    ctx.fillStyle = "rgba(120, 100, 80, 0.25)";
    for (let i = 0; i < 12; i++) ctx.fillRect(cx - 7 + noise(i * 3.3) * 14, top + 4 + noise(i * 7.1) * (s.h - 6), 1, 1);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // shine
  ctx.fillRect(cx - s.w * 0.6, top + 4, 1.5, s.h * 0.5);
  return top;
}

// A wooden wall shelf `dy` pixels down the wall. Returns where its top is.
function drawWallShelf(ctx, f, dy = 20, color = WOOD) {
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, x = a.x, y = a.y - WALL_HEIGHT + dy;
  ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
  ctx.fillRect(x + 2, y + 2, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillStyle = shadeColor(color, -25);
  ctx.fillRect(x + 4, y + 3, 2, 5);
  ctx.fillRect(x + w - 6, y + 3, 2, 5);
  return { x, y, w };
}

// A row of book spines standing on a shelf at y, from x across width w.
function drawBookRow(ctx, x, y, w, seed = 0) {
  const colors = ["#c0554a", "#3f6f9f", "#e0a84c", "#7a9e5c", "#9a6fb0", "#d98c6a", "#e8c8d0", "#5f7a8c"];
  let bx = x;
  for (let i = 0; bx < x + w - 4; i++) {
    const bw = 3 + ((i * 7 + seed) % 3), bh = 9 + ((i * 5 + seed) % 5);
    ctx.fillStyle = colors[(i + seed) % colors.length];
    ctx.fillRect(bx, y - bh, bw, bh);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(bx, y - bh + 2, bw, 0.8);
    bx += bw + 0.6;
  }
}

function drawCounter(ctx, f) {
  drawShadow(ctx, f.x, f.y, f.w, f.h);
  const c = drawBlock(ctx, f.x, f.y, f.w, f.h, 20, "#e8dcc8");
  ctx.fillStyle = "#b58a5c";
  ctx.fillRect(c.top.x, c.top.y, c.top.w, c.top.h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(c.top.x, c.top.y, c.top.w, 1.5);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  for (let dx = 0; dx + 16 <= c.face.w; dx += 18) {
    ctx.strokeRect(c.face.x + dx + 2.5, c.face.y + 3.5, 14, c.face.h - 8);
  }
  return c;
}

// A ceiling fluorescent tube in the bunker office. Mostly on, but every so
// often it stutters off for a moment, like a bad starter.
function drawFluorescent(ctx, f, now) {
  const p = toScreen(f.x, f.y);
  const y = p.y - 110;
  const flick = noise(Math.floor(now * 10));
  const on = flick > 0.12 && !(flick > 0.9 && noise(Math.floor(now * 30)) > 0.5);
  ctx.strokeStyle = "rgba(40, 40, 40, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x - 18, y - 18);
  ctx.lineTo(p.x - 18, y);
  ctx.moveTo(p.x + 18, y - 18);
  ctx.lineTo(p.x + 18, y);
  ctx.stroke();
  ctx.fillStyle = "#5a5d58";
  ctx.fillRect(p.x - 26, y - 2, 52, 5);
  ctx.fillStyle = on ? "#eefcf4" : "#9aa39c";
  ctx.fillRect(p.x - 23, y + 3, 46, 3);
  if (on) {
    ctx.fillStyle = "rgba(210, 255, 235, 0.10)";
    ctx.beginPath();
    ctx.moveTo(p.x - 23, y + 6);
    ctx.lineTo(p.x + 23, y + 6);
    ctx.lineTo(p.x + 70, p.y + 20);
    ctx.lineTo(p.x - 70, p.y + 20);
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, p.x, y + 5, 40, "rgba(220, 255, 240, 0.45)");
  }
}

// A red paper lantern hanging from the ceiling, with gold caps, a tassel,
// and a warm glow.
function drawPaperLantern(ctx, f) {
  const p = toScreen(f.x, f.y);
  const y = p.y - 100;
  ctx.strokeStyle = "rgba(60, 40, 20, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, y - 30);
  ctx.lineTo(p.x, y - 12);
  ctx.stroke();
  drawGlow(ctx, p.x, y, 50, "rgba(255, 150, 90, 0.4)");
  ctx.fillStyle = "#c8372b";
  ctx.beginPath();
  ctx.ellipse(p.x, y, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 20, 15, 0.5)";
  ctx.beginPath();
  ctx.ellipse(p.x, y, 5, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#c9a24a";
  ctx.fillRect(p.x - 6, y - 14, 12, 3);
  ctx.fillRect(p.x - 6, y + 11, 12, 3);
  ctx.fillStyle = "#b8322a";
  ctx.fillRect(p.x - 1, y + 14, 2, 9);
}

// --- Doors ---
// A lighter wood frame (casing) around a door opening.
function drawDoorFrame(ctx, x, y, w, h) {
  ctx.fillStyle = "#c89a68";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(x - 3, y - 3, w + 6, 1);
}

// One door: warm wood with a raised edge and two sunken panels. Light
// comes from above, so each panel's top edge is in shadow and its bottom
// edge catches the light, which is what makes it look carved in.
function drawDoorLeaf(ctx, x, y, w, h) {
  ctx.fillStyle = "#a97a4f";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(x, y, w, 1.5);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(x, y + h - 2, w, 2);

  const px = x + 4, pw = w - 8;
  const panels = [[y + 4, h * 0.36], [y + h * 0.36 + 8, h - h * 0.36 - 13]];
  for (const [py, ph] of panels) {
    ctx.fillStyle = "#946840";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(px, py, pw, 1.5);
    ctx.fillRect(px, py, 1.5, ph);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(px, py + ph - 1.5, pw, 1.5);
    ctx.fillRect(px + pw - 1.5, py, 1.5, ph);
  }
}

// A round brass door knob with a little shine on top.
function drawKnob(ctx, x, y) {
  ctx.fillStyle = "#b8923a";
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d78a";
  ctx.beginPath();
  ctx.arc(x - 0.7, y - 0.8, 1, 0, Math.PI * 2);
  ctx.fill();
}

// A little table lamp with its base at (x, y) on a surface.
function drawLamp(ctx, x, y) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 1.5, y - 14, 3, 14);
  ctx.fillStyle = "#f2d9a0";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 12);
  ctx.lineTo(x + 8, y - 12);
  ctx.lineTo(x + 5, y - 24);
  ctx.lineTo(x - 5, y - 24);
  ctx.closePath();
  ctx.fill();
}

// Warm light effects, drawn over everything in a final pass so glows
// aren't cut off by things drawn after them.
function drawLights(ctx) {
  drawSunPatches(ctx); // sunlight on the floor in front of windows, on sunny days (outdoors.js)
  if (isOutdoorFloor(viewFloor)) {
    drawOutdoorLight(ctx); // daylight, dusk and night outdoors (the yard, the Lake: outdoors.js)
    return;
  }
  // Study, Dinner and the Hallway get a soft golden wash, like rooms lit
  // by lamps at night: warm in the middle, a little dimmer at the edges.
  for (const id of ["study", "dinner", "hallway", "business", "suite", "elevator", "elevatorUp", "elevatorTop"]) {
    const rect = ROOMS.find((r) => r.id === id).rect;
    const s1 = toScreen(rect.x, rect.y - 1), s2 = toScreen(rect.x + rect.w, rect.y + rect.h);
    const cx = (s1.x + s2.x) / 2, cy = (s1.y + s2.y) / 2;
    const reach = Math.max(s2.x - s1.x, s2.y - s1.y) * 0.6;
    const wash = ctx.createRadialGradient(cx, cy, 20, cx, cy, reach);
    wash.addColorStop(0, "rgba(255, 190, 100, 0.12)");
    wash.addColorStop(1, "rgba(60, 30, 10, 0.12)");
    ctx.fillStyle = wash;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  // The Theater is kept dim like a cinema, lit by the glow of its screen.
  const theater = ROOMS.find((r) => r.id === "theater").rect;
  const t1 = toScreen(theater.x, theater.y - 1), t2 = toScreen(theater.x + theater.w, theater.y + theater.h);
  ctx.fillStyle = "rgba(20, 8, 25, 0.28)";
  ctx.fillRect(t1.x, t1.y, t2.x - t1.x, t2.y - t1.y);

  // The Library is dim and a little cool, like a rainy evening, lit by
  // its reading lamps.
  const library = ROOMS.find((r) => r.id === "library").rect;
  const l1 = toScreen(library.x, library.y - 1), l2 = toScreen(library.x + library.w, library.y + library.h);
  ctx.fillStyle = "rgba(25, 40, 55, 0.2)";
  ctx.fillRect(l1.x, l1.y, l2.x - l1.x, l2.y - l1.y);

  // Bedrooms are dim and a little blue, like a room at night, lit by the
  // bedside lamps.
  for (const room of ROOMS) {
    if (room.owned?.kind !== "bedroom") continue;
    const s1 = toScreen(room.rect.x, room.rect.y - 1), s2 = toScreen(room.rect.x + room.rect.w, room.rect.y + room.rect.h);
    ctx.fillStyle = "rgba(30, 30, 70, 0.2)";
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  // Secret themed offices get their own warm or cold tint.
  for (const room of ROOMS) {
    if (!room.theme) continue;
    const s1 = toScreen(room.rect.x, room.rect.y - 1), s2 = toScreen(room.rect.x + room.rect.w, room.rect.y + room.rect.h);
    ctx.fillStyle = OFFICE_THEME_STYLE[room.theme].tint;
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
  }

  const now = performance.now() / 1000;
  for (const f of FURNITURE) {
    if (f.kind === "readingTable") {
      const p = toScreen(f.x, f.y + f.h / 2);
      for (const frac of [0.33, 0.67]) drawGlow(ctx, p.x + f.w * TILE * frac, p.y - 22 - 8, 34, "rgba(255, 220, 140, 0.45)");
    } else if (f.kind === "rainWindow") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 18, 34, "rgba(150, 185, 215, 0.25)");
    } else if (f.kind === "aisleLights") {
      const n = Math.max(2, Math.round(f.h / 0.9));
      for (let i = 0; i < n; i++) {
        const p = toScreen(f.x + f.w / 2, f.y + (i + 0.5) * (f.h / n));
        drawGlow(ctx, p.x, p.y, 14, "rgba(255, 210, 130, 0.35)");
      }
    } else if (f.kind === "stageCurtains") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - 76, 90, "rgba(255, 220, 140, 0.18)");
    } else if (f.kind === "bigScreen") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 30, 150, "rgba(170, 200, 255, 0.22)");
    } else if (f.kind === "fireplace") {
      // Firelight that breathes in and out a little.
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      const flicker = Math.sin(now * 7) * 3 + Math.sin(now * 13) * 2;
      drawGlow(ctx, p.x, p.y - 12, 60 + flicker, "rgba(255, 150, 60, 0.45)");
    } else if (f.kind === "fluorescent") {
      drawFluorescent(ctx, f, now);
    } else if (f.kind === "paperLantern") {
      drawPaperLantern(ctx, f);
    } else if (f.kind === "mushroomLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 16, 30, "rgba(255, 150, 110, 0.4)");
    } else if (f.kind === "moonLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 13, 30, "rgba(255, 240, 190, 0.45)");
    } else if (f.kind === "heartNeon") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 17, 30, "rgba(255, 120, 180, 0.3)");
    } else if (f.kind === "vanity") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 36, 30, "rgba(255, 240, 200, 0.4)");
    } else if (f.kind === "candles") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 20, 26 + Math.sin(now * 8) * 1.5, "rgba(255, 170, 80, 0.5)");
    } else if (f.kind === "lavaLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 24, 26, "rgba(255, 140, 110, 0.35)");
    } else if (f.kind === "neonSign") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 18, 32, "rgba(255, 120, 190, 0.3)");
    } else if (f.kind === "laptopDesk" || f.kind === "laptopDeskSide") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - 26, 26, "rgba(170, 215, 245, 0.35)");
    } else if (f.kind === "nightstand") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 18 - 17, 34, "rgba(255, 205, 130, 0.5)");
    } else if (f.kind === "cottageDesk") {
      // Candlelight on the desk.
      const p = toScreen(f.x + f.w, f.y + f.h / 2);
      drawGlow(ctx, p.x - 8, p.y - 22 - 8, 30 + Math.sin(now * 9) * 1.5, "rgba(255, 170, 80, 0.5)");
    } else if (f.kind === "pumpkins") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x + 12, p.y - 18, 22 + Math.sin(now * 8 + 1) * 1.5, "rgba(255, 160, 70, 0.5)");
    } else if (f.kind === "leafWindow") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 20, 30, "rgba(240, 150, 90, 0.25)");
    }
    if (f.kind === "pcDesk") {
      const p = toScreen(f.x + f.w / 2, f.y);
      drawGlow(ctx, p.x - 6, p.y - 30, 40, f.screen + "66");
    } else if (f.kind === "studyTable") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 44, 40, "rgba(255, 215, 130, 0.5)");
    } else if (f.kind === "sconce") {
      const p = toScreen(f.x, f.y);
      drawGlow(ctx, p.x, p.y - WALL_HEIGHT + 12, 26, "rgba(255, 205, 120, 0.5)");
    } else if (f.kind === "console") {
      const p = toScreen(f.x + 16 / TILE, f.y + f.h / 2);
      drawGlow(ctx, p.x, p.y - 26 - 18, 24, "rgba(255, 215, 130, 0.5)");
    } else if (f.kind === "table") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h / 2);
      for (const dx of [-22, 22]) drawGlow(ctx, p.x + dx, p.y - 24 - 15, 14, "rgba(255, 190, 110, 0.55)");
    } else if (f.kind === "floorLamp") {
      const p = toScreen(f.x + f.w / 2, f.y + f.h);
      drawGlow(ctx, p.x, p.y - 58, 60, "rgba(255, 210, 130, 0.45)");
    } else if (f.kind === "lights") {
      for (const bulb of stringLightBulbs(f)) drawGlow(ctx, bulb.x, bulb.y + 2, 9, "rgba(255, 210, 120, 0.55)");
    } else if (f.kind === "pendant") {
      // A lamp hanging from the ceiling over the dinner table.
      const p = toScreen(f.x, f.y);
      const shadeY = p.y - 100;
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, shadeY - 24);
      ctx.lineTo(p.x, shadeY);
      ctx.stroke();
      drawGlow(ctx, p.x, shadeY + 30, 70, "rgba(255, 200, 120, 0.3)");
      ctx.fillStyle = "#c0554a";
      ctx.beginPath();
      ctx.moveTo(p.x - 7, shadeY);
      ctx.lineTo(p.x + 7, shadeY);
      ctx.lineTo(p.x + 15, shadeY + 12);
      ctx.lineTo(p.x - 15, shadeY + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Walls and furniture never move, so their draw-order list is built once.
// `sortY` is where each thing touches the floor (the bottom edge of its
// footprint): things with a bigger sortY are lower on screen and draw in
// front. Wall hangings sort just after the wall they hang on. Things you
// can stand on (like stools) sort by their top edge, so you're always
// drawn over them. Cinema seats are the opposite: they draw over whoever
// sits in them, so you see heads above the seat backs.
// Seats whose back is toward you (cinema seats, and chairs facing away)
// draw over whoever sits in them (seatCoversSitter, see SEATS in world.js).

let staticSprites = [];
let spritesVersion = -1; // which house version (and floor) staticSprites is for

function getStaticSprites() {
  const version = houseVersion + "/" + viewFloor;
  if (spritesVersion !== version) {
    staticSprites = [
      ...WALLS.map((wall) => ({ sortY: wall.y + wall.h, draw: (ctx) => drawWall(ctx, wall) })),
      // Door signs sort just after the wall they're on (and a locked door).
      ...ROOMS.filter((room) => room.sign).map((room) => ({ sortY: room.sign.y + WALL_THICKNESS / 2 + 0.002, draw: (ctx) => drawRoomSign(ctx, room) })),
      ...FURNITURE.filter((f) => FURNITURE_DRAWERS[f.kind]).map((f) => ({
        sortY: f.h === undefined ? f.y + 0.001 : seatCoversSitter(f) ? f.y + f.h + 0.05 : f.solid === false ? f.y : f.y + f.h,
        draw: (ctx) => drawOutlined(ctx, f),
      })),
    ].filter((sprite) => floorOf(sprite.sortY) === viewFloor);
    spritesVersion = version;
  }
  return staticSprites;
}

