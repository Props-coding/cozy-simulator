// How Cellar Crawl looks (the mini game under the house, cellar.js):
// stone walls with wooden beams and posts, flagstone floors, shelves of
// jars, wine racks, barrels, crates, sacks, crocks, cobwebs, and the
// ladders up and down. Drawn in the house's own grid units (toScreen), in
// the house style: soft darker outlines, lit from above (a lighter top, a
// darker base), a soft shadow under everything and some texture on every
// surface. cellar.js places them and sorts them by how low they stand.

// Each floor's stone (1 is near the top, 3 the deepest, oldest part).
const CELLAR_STONE = [
  { floor: "#7c7266", joint: "#4e463e", wall: "#8a7c6c", top: "#2e2620", moss: "#5f7042" },
  { floor: "#6c665e", joint: "#403b36", wall: "#766e64", top: "#26211c", moss: "#4f6a4a" },
  { floor: "#5e5a58", joint: "#34302e", wall: "#66605c", top: "#1e1a18", moss: "#44605a" },
];
const cellarStone = (n) => CELLAR_STONE[Math.max(0, Math.min(2, n))];

// A soft darker outline (the detail standard) around whatever `draw` paints.
function cellarOutlined(ctx, draw) {
  if (!outlinesOn) return draw(); // (off for everyone, or on a computer that struggles: render-scene.js)
  ctx.save();
  ctx.filter = "drop-shadow(0 0 0.8px rgba(20, 12, 6, 0.75))";
  draw();
  ctx.restore();
}

// --- The floor: flagstones, a slightly different shade each, with worn
// edges, cracks, and a little dirt and straw here and there ---
function drawCellarFloorTile(ctx, tx, ty, floorNo) {
  const s = cellarStone(floorNo);
  const a = toScreen(tx, ty);
  ctx.fillStyle = s.joint;
  ctx.fillRect(a.x, a.y, TILE, TILE);
  // Two or four stones per tile, staggered by row.
  const seed = tx * 13.7 + ty * 7.3;
  const split = noise(seed) > 0.5;
  const stones = split ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]];
  stones.forEach(([sx, sy, sw, sh], i) => {
    const x = a.x + sx * TILE + 1.5, y = a.y + sy * TILE + 1.5, w = sw * TILE - 3, h = sh * TILE - 3;
    const shade = Math.round((noise(seed + i * 3.1) - 0.5) * 22);
    ctx.fillStyle = shadeColor(s.floor, shade);
    roundRectPath(ctx, x, y, w, h, 3);
    ctx.fill();
    // Lit from above: a lighter upper edge, a darker lower one.
    ctx.fillStyle = "rgba(255, 240, 220, 0.08)";
    ctx.fillRect(x + 2, y, w - 4, 1.5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(x + 2, y + h - 1.5, w - 4, 1.5);
    // Texture: pits and flecks.
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k % 2 ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(x + 2 + noise(seed + i * 5 + k * 1.7) * (w - 4), y + 2 + noise(seed + i * 7 + k * 2.3) * (h - 4), 1.8, 1.2);
    }
  });
  // Now and then a crack, some dirt, or a wisp of straw.
  const r = noise(seed * 1.9);
  if (r < 0.12) {
    ctx.strokeStyle = "rgba(20, 14, 10, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x + 8 + noise(seed + 1) * 20, a.y + 6);
    ctx.lineTo(a.x + 14 + noise(seed + 2) * 14, a.y + 20);
    ctx.lineTo(a.x + 10 + noise(seed + 3) * 20, a.y + 34);
    ctx.stroke();
  } else if (r < 0.2) {
    ctx.fillStyle = "rgba(70, 50, 30, 0.35)";
    ctx.beginPath();
    ctx.ellipse(a.x + TILE / 2, a.y + TILE / 2, 14, 6, noise(seed) * 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (r < 0.25) {
    ctx.strokeStyle = "rgba(210, 180, 100, 0.55)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const x = a.x + 10 + noise(seed + k) * 26, y = a.y + 10 + noise(seed + k * 2) * 26, ang = noise(seed + k * 3) * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * 8, y + Math.sin(ang) * 8);
      ctx.stroke();
    }
  }
}

// --- The walls ---
// A wall tile with floor just below it shows its face: rough stone blocks
// in mortar, darker and damp toward the floor, with a wooden beam along
// the top and a post every few tiles. Other wall tiles are seen from
// above: packed earth and rubble in the dark.
function drawCellarWallTile(ctx, tx, ty, floorNo, face, map) {
  const s = cellarStone(floorNo);
  const a = toScreen(tx, ty);
  const seed = tx * 9.1 + ty * 4.7;
  if (!face) {
    ctx.fillStyle = s.top;
    ctx.fillRect(a.x, a.y, TILE, TILE);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? "rgba(255, 240, 220, 0.04)" : "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.arc(a.x + noise(seed + k) * TILE, a.y + noise(seed + k * 1.3) * TILE, 2 + noise(seed + k * 2) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // An edge where the wall top meets the room below it or beside it.
    ctx.fillStyle = "rgba(255, 230, 200, 0.07)";
    if (map.open(tx, ty + 1)) ctx.fillRect(a.x, a.y + TILE - 3, TILE, 3);
    if (map.open(tx - 1, ty)) ctx.fillRect(a.x, a.y, 2, TILE);
    if (map.open(tx + 1, ty)) ctx.fillRect(a.x + TILE - 2, a.y, 2, TILE);
    // Beams across the tops, like the cellar's ceiling joists (just near
    // the rooms: further out it's all dark earth).
    const nearRoom = map.open(tx, ty + 1) || map.open(tx, ty - 1) || map.open(tx, ty + 2);
    if (tx % 4 === 0 && nearRoom) {
      ctx.fillStyle = "#3e2c1e";
      ctx.fillRect(a.x + TILE / 2 - 5, a.y, 10, TILE);
      ctx.fillStyle = "rgba(255, 220, 170, 0.08)";
      ctx.fillRect(a.x + TILE / 2 - 5, a.y, 2, TILE);
    }
    return;
  }
  // The face: the bottom WALL_HEIGHT pixels of the tile; a dark cap above.
  const top = a.y + TILE - WALL_HEIGHT;
  ctx.fillStyle = s.top;
  ctx.fillRect(a.x, a.y, TILE, TILE - WALL_HEIGHT);
  ctx.fillStyle = s.joint;
  ctx.fillRect(a.x, top, TILE, WALL_HEIGHT);
  const rows = 4, rowH = (WALL_HEIGHT - 8) / rows;
  for (let r = 0; r < rows; r++) {
    const y = top + 8 + r * rowH;
    let x = a.x - noise(seed + r) * 14;
    for (let k = 0; x < a.x + TILE; k++) {
      const w = 12 + noise(seed + r * 5 + k) * 12;
      const x0 = Math.max(a.x, x + 1), x1 = Math.min(a.x + TILE, x + w - 1);
      if (x1 > x0) {
        const shade = Math.round((noise(seed + r * 3 + k * 1.9) - 0.5) * 26) - r * 5; // (darker toward the floor)
        ctx.fillStyle = shadeColor(s.wall, shade);
        roundRectPath(ctx, x0, y + 1, x1 - x0, rowH - 2, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 240, 220, 0.1)"; // lit top edge
        ctx.fillRect(x0 + 1, y + 1, x1 - x0 - 2, 1);
      }
      x += w;
    }
  }
  // Damp and moss along the bottom.
  const damp = ctx.createLinearGradient(0, a.y + TILE - 12, 0, a.y + TILE);
  damp.addColorStop(0, "rgba(20, 30, 20, 0)");
  damp.addColorStop(1, "rgba(20, 30, 20, 0.35)");
  ctx.fillStyle = damp;
  ctx.fillRect(a.x, a.y + TILE - 12, TILE, 12);
  if (noise(seed * 3.3) < 0.35) {
    ctx.fillStyle = s.moss;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(a.x + 6 + noise(seed + k * 4.1) * (TILE - 12), a.y + TILE - 2 - noise(seed + k) * 5, 2 + noise(seed + k * 2) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The wooden beam along the top of the wall.
  ctx.fillStyle = "#4a3424";
  ctx.fillRect(a.x, top, TILE, 8);
  ctx.fillStyle = "#6a4c34";
  ctx.fillRect(a.x, top, TILE, 5);
  ctx.fillStyle = "rgba(255, 225, 180, 0.2)";
  ctx.fillRect(a.x, top, TILE, 1.2);
  ctx.fillStyle = "rgba(30, 18, 10, 0.4)"; // wood grain
  ctx.fillRect(a.x + noise(seed) * 30, top + 2.5, 10, 0.8);
  // A post holding it up, every few tiles (and at each door's sides).
  if (tx % 4 === 2 || map.open(tx - 1, ty) || map.open(tx + 1, ty)) {
    const px = map.open(tx - 1, ty) ? a.x : map.open(tx + 1, ty) ? a.x + TILE - 8 : a.x + TILE / 2 - 4;
    ctx.fillStyle = "#4a3424";
    ctx.fillRect(px, top, 8, WALL_HEIGHT);
    ctx.fillStyle = "#6a4c34";
    ctx.fillRect(px + 1, top, 5, WALL_HEIGHT);
    ctx.fillStyle = "rgba(255, 225, 180, 0.15)";
    ctx.fillRect(px + 1, top, 1, WALL_HEIGHT);
    ctx.fillStyle = "#2e2016"; // an iron bolt
    ctx.fillRect(px + 3, top + 3, 2, 2);
  }
  // A thin dark line where the wall meets the floor.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(a.x, a.y + TILE - 1.5, TILE, 1.5);
}

// A cobweb in a room's top corner (side: -1 left, 1 right), across the
// corner where the wall face meets the side wall.
function drawCobweb(ctx, gx, gy, side, size = 1) {
  const a = toScreen(gx, gy);
  const x = a.x, y = a.y - WALL_HEIGHT + 6, r = 26 * size;
  ctx.save();
  ctx.strokeStyle = "rgba(235, 235, 240, 0.45)";
  ctx.lineWidth = 0.8;
  const spokes = 5;
  const ends = [];
  for (let i = 0; i <= spokes; i++) {
    const ang = side > 0 ? Math.PI / 2 + (i / spokes) * (Math.PI / 2) : (i / spokes) * (Math.PI / 2);
    ends.push(ang);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
    ctx.stroke();
  }
  for (let ring = 1; ring <= 4; ring++) {
    const rr = (r * ring) / 4.3;
    ctx.beginPath();
    ends.forEach((ang, i) => {
      const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
      if (!i) ctx.moveTo(px, py);
      else {
        const mid = (ang + ends[i - 1]) / 2;
        ctx.quadraticCurveTo(x + Math.cos(mid) * rr * 0.82, y + Math.sin(mid) * rr * 0.82, px, py);
      }
    });
    ctx.stroke();
  }
  ctx.restore();
}

// --- The things in the cellar (each takes { x, y, w, h } in grid units:
// the footprint on the floor, top-left corner) ---
const CELLAR_DRAWERS = {
  // A wooden crate: slatted sides, dark corner boards, nails, a stencil.
  crate(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const c = drawBlock(ctx, o.x, o.y, o.w, o.h, 26, o.tint ?? "#9a7148");
      const { face, top } = c;
      ctx.fillStyle = "rgba(40, 22, 10, 0.35)"; // gaps between slats
      for (let i = 1; i < 3; i++) ctx.fillRect(face.x, face.y + (face.h * i) / 3, face.w, 1.2);
      for (let i = 1; i < 3; i++) ctx.fillRect(top.x, top.y + (top.h * i) / 3, top.w, 1);
      ctx.fillStyle = "#6a4a2c"; // corner boards
      ctx.fillRect(face.x, face.y, 4, face.h);
      ctx.fillRect(face.x + face.w - 4, face.y, 4, face.h);
      ctx.fillStyle = "rgba(255, 230, 190, 0.2)";
      ctx.fillRect(face.x + 1, face.y, 1, face.h);
      ctx.fillStyle = "#3a2a1e"; // nails
      for (const nx of [face.x + 2, face.x + face.w - 2]) for (const ny of [face.y + 3, face.y + face.h - 4]) ctx.fillRect(nx - 0.8, ny, 1.6, 1.6);
      ctx.strokeStyle = "rgba(40, 22, 10, 0.4)"; // a stencilled mark
      ctx.lineWidth = 1.2;
      ctx.strokeRect(face.x + face.w / 2 - 5, face.y + 7, 10, 7);
    });
  },

  // A wooden barrel: bulging staves, two iron hoops, a lid with a bung.
  barrel(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const base = toScreen(o.x + o.w / 2, o.y + o.h);
      const rx = (o.w * TILE) / 2, ry = 5, hgt = 34;
      const cx = base.x, bottom = base.y - ry, top = bottom - hgt;
      const wood = o.tint ?? "#8a5a34";
      const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      side.addColorStop(0, shadeColor(wood, -30));
      side.addColorStop(0.4, shadeColor(wood, 18));
      side.addColorStop(1, shadeColor(wood, -34));
      ctx.fillStyle = side;
      ctx.beginPath(); // (bulging out in the middle)
      ctx.moveTo(cx - rx * 0.9, bottom);
      ctx.quadraticCurveTo(cx - rx * 1.12, bottom - hgt / 2, cx - rx * 0.9, top);
      ctx.lineTo(cx + rx * 0.9, top);
      ctx.quadraticCurveTo(cx + rx * 1.12, bottom - hgt / 2, cx + rx * 0.9, bottom);
      ctx.ellipse(cx, bottom, rx * 0.9, ry, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 20, 8, 0.35)"; // the staves
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * rx * 0.36, top + 2);
        ctx.quadraticCurveTo(cx + i * rx * 0.44, bottom - hgt / 2, cx + i * rx * 0.36, bottom + 2);
        ctx.stroke();
      }
      for (const hy of [top + 7, bottom - 7]) {
        ctx.strokeStyle = "#3a3a40"; // iron hoops
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, hy, rx * 1.02, ry, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
        ctx.strokeStyle = "rgba(220, 220, 230, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, hy - 1, rx * 1.0, ry, 0, 0.9, 1.6);
        ctx.stroke();
      }
      ctx.fillStyle = shadeColor(wood, 26); // the lid, lit from above
      ctx.beginPath();
      ctx.ellipse(cx, top, rx * 0.9, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 20, 8, 0.3)";
      ctx.lineWidth = 0.8;
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * rx, top - ry * 0.8);
        ctx.lineTo(cx + dx * rx, top + ry * 0.8);
        ctx.stroke();
      }
      ctx.fillStyle = "#3a2414";
      ctx.beginPath();
      ctx.arc(cx + rx * 0.35, top, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  // A tall shelf against the wall: three boards of jars (preserves,
  // pickles, honey), bottles and a crock, dusty.
  shelf(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const b = drawBlock(ctx, o.x, o.y, o.w, o.h, 66, "#6e5036");
      const { face } = b;
      ctx.fillStyle = "#2e2016"; // the dark inside
      ctx.fillRect(face.x + 4, face.y + 3, face.w - 8, face.h - 6);
      const seed = o.x * 3.1 + o.y * 7.7;
      const colors = ["#e0a84c", "#c0554a", "#7a9e5c", "#8a5a3c", "#e8c170", "#a04a6a", "#f2ece2"];
      for (let row = 0; row < 3; row++) {
        const by = face.y + 3 + ((face.h - 6) * (row + 1)) / 3;
        ctx.fillStyle = "#7e5c3e"; // the board
        ctx.fillRect(face.x + 4, by - 3, face.w - 8, 3);
        ctx.fillStyle = "rgba(255, 225, 180, 0.2)";
        ctx.fillRect(face.x + 4, by - 3, face.w - 8, 1);
        let jx = face.x + 7;
        for (let k = 0; jx < face.x + face.w - 12; k++) {
          const n = noise(seed + row * 11 + k * 3.7);
          const jh = 9 + n * 6, jw = 6 + noise(seed + k) * 3;
          if (n < 0.15) { jx += 6; continue; } // (a gap)
          if (n > 0.85) {
            ctx.fillStyle = "#3e5a3a"; // a bottle
            roundRectPath(ctx, jx, by - 3 - jh - 3, 5, jh + 3, 2);
            ctx.fill();
            ctx.fillRect(jx + 1.5, by - 3 - jh - 7, 2, 4);
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.fillRect(jx + 1, by - 3 - jh, 1, jh - 3);
            jx += 8;
            continue;
          }
          ctx.fillStyle = "rgba(220, 235, 245, 0.45)"; // the glass
          roundRectPath(ctx, jx, by - 3 - jh, jw, jh, 2);
          ctx.fill();
          ctx.fillStyle = colors[Math.floor(noise(seed + k * 5.3 + row) * colors.length)]; // what's inside
          ctx.fillRect(jx + 1, by - 3 - jh * 0.72, jw - 2, jh * 0.72 - 1);
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; // a glint
          ctx.fillRect(jx + 1, by - 3 - jh + 2, 1, jh * 0.5);
          ctx.fillStyle = "#6b4a2e"; // the lid
          ctx.fillRect(jx - 0.5, by - 3 - jh - 1.5, jw + 1, 2.2);
          jx += jw + 2.5;
        }
      }
      // Dust along the top.
      ctx.fillStyle = "rgba(220, 210, 190, 0.18)";
      ctx.fillRect(b.top.x, b.top.y, b.top.w, b.top.h);
    });
  },

  // A wine rack: a lattice of cubbies with bottle ends poking out.
  wineRack(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => drawWineRack(ctx, o));
  },

  // Burlap sacks, slumped against each other, tied at the top.
  sacks(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const base = toScreen(o.x + o.w / 2, o.y + o.h);
      const n = o.w > 0.8 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const cx = base.x + (i - (n - 1) / 2) * 15, hgt = 26 + (i % 2) * 5, bottom = base.y - 2 - (i === 1 ? 3 : 0);
        const g = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
        g.addColorStop(0, "#9a8058");
        g.addColorStop(0.45, "#c8aa78");
        g.addColorStop(1, "#8a7050");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - 5, bottom - hgt);
        ctx.quadraticCurveTo(cx - 14, bottom - hgt * 0.5, cx - 11, bottom);
        ctx.lineTo(cx + 11, bottom);
        ctx.quadraticCurveTo(cx + 14, bottom - hgt * 0.5, cx + 5, bottom - hgt);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(60, 40, 20, 0.25)"; // the weave
        for (let k = 0; k < 10; k++) ctx.fillRect(cx - 8 + noise(i * 9 + k) * 16, bottom - 4 - noise(i * 7 + k * 2) * (hgt - 8), 1.5, 1);
        ctx.fillStyle = "#8a6a40"; // the tied top
        ctx.fillRect(cx - 4, bottom - hgt - 4, 8, 4);
        ctx.fillStyle = "#5a3e22";
        ctx.fillRect(cx - 5, bottom - hgt, 10, 2);
        if (i === 0) {
          ctx.fillStyle = "#e8dcc0"; // a little spilled flour
          ctx.beginPath();
          ctx.ellipse(cx - 12, bottom + 1, 6, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  },

  // Clay crocks and jars on the floor, lidded, with a painted band.
  crocks(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const base = toScreen(o.x + o.w / 2, o.y + o.h);
      for (const [dx, r, hgt, color] of [[-9, 8, 20, "#b8704a"], [7, 7, 16, "#9a8a6a"], [-1, 5, 11, "#c8905a"]]) {
        const cx = base.x + dx, bottom = base.y - 2 + (r === 5 ? 3 : 0);
        const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
        g.addColorStop(0, shadeColor(color, -30));
        g.addColorStop(0.4, shadeColor(color, 20));
        g.addColorStop(1, shadeColor(color, -34));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, bottom - hgt);
        ctx.quadraticCurveTo(cx - r * 1.3, bottom - hgt * 0.5, cx - r * 0.7, bottom);
        ctx.lineTo(cx + r * 0.7, bottom);
        ctx.quadraticCurveTo(cx + r * 1.3, bottom - hgt * 0.5, cx + r * 0.6, bottom - hgt);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(40, 60, 90, 0.55)"; // the painted band
        ctx.fillRect(cx - r * 0.95, bottom - hgt * 0.6, r * 1.9, 2);
        ctx.fillStyle = shadeColor(color, 32); // the lid
        ctx.beginPath();
        ctx.ellipse(cx, bottom - hgt, r * 0.62, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 245, 230, 0.35)";
        ctx.fillRect(cx - r * 0.5, bottom - hgt * 0.8, 1.2, hgt * 0.35);
      }
    });
  },

  // A wooden support post from floor to beam, with a knee brace.
  post(ctx, o) {
    drawShadow(ctx, o.x, o.y, o.w, o.h);
    cellarOutlined(ctx, () => {
      const p = drawBlock(ctx, o.x, o.y, o.w, o.h, 92, "#6a4c34");
      ctx.fillStyle = "rgba(30, 18, 10, 0.35)"; // grain
      for (let k = 0; k < 4; k++) ctx.fillRect(p.face.x + 3 + (k % 2) * 4, p.face.y + 10 + k * 20, 1, 12);
      ctx.fillStyle = "#2e2016"; // iron straps
      ctx.fillRect(p.face.x, p.face.y + 14, p.face.w, 3);
      ctx.fillRect(p.face.x, p.face.y + p.face.h - 20, p.face.w, 3);
    });
  },

  // The way up: a ladder against the wall, rising to a trapdoor, with
  // warm daylight spilling down it.
  ladderUp(ctx, o) {
    const base = toScreen(o.x + o.w / 2, o.y);
    const x = base.x, bottom = base.y + 6, top = base.y - WALL_HEIGHT - 38;
    const glow = ctx.createLinearGradient(0, top, 0, bottom + 30);
    glow.addColorStop(0, "rgba(255, 230, 170, 0.55)");
    glow.addColorStop(1, "rgba(255, 230, 170, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(x - 16, top);
    ctx.lineTo(x + 16, top);
    ctx.lineTo(x + 30, bottom + 30);
    ctx.lineTo(x - 30, bottom + 30);
    ctx.closePath();
    ctx.fill();
    cellarOutlined(ctx, () => {
      ctx.fillStyle = "#f4dc9a"; // the open hatch
      ctx.fillRect(x - 15, top - 6, 30, 8);
      ctx.fillStyle = "#6a4c34";
      ctx.fillRect(x - 17, top - 8, 34, 3);
      for (const dx of [-11, 8]) {
        ctx.fillStyle = "#7e5a3a"; // the rails
        ctx.fillRect(x + dx, top, 4, bottom - top);
        ctx.fillStyle = "rgba(255, 225, 180, 0.3)";
        ctx.fillRect(x + dx, top, 1.2, bottom - top);
      }
      for (let y = top + 8; y < bottom - 2; y += 11) {
        ctx.fillStyle = "#8a6444"; // the rungs
        ctx.fillRect(x - 9, y, 18, 3);
        ctx.fillStyle = "rgba(255, 225, 180, 0.25)";
        ctx.fillRect(x - 9, y, 18, 1);
      }
    });
  },

  // The way down: a square hole in the floor with a wooden frame, a
  // ladder going down into the dark, and a cold draft of blue.
  ladderDown(ctx, o) {
    const a = toScreen(o.x, o.y), b = toScreen(o.x + o.w, o.y + o.h);
    const w = b.x - a.x, h = b.y - a.y;
    cellarOutlined(ctx, () => {
      ctx.fillStyle = "#4a3424"; // the frame
      ctx.fillRect(a.x - 4, a.y - 4, w + 8, h + 8);
      ctx.fillStyle = "#6a4c34";
      ctx.fillRect(a.x - 4, a.y - 4, w + 8, 3);
      const pit = ctx.createLinearGradient(0, a.y, 0, b.y);
      pit.addColorStop(0, "#0c0a10");
      pit.addColorStop(1, "#1a1a2a");
      ctx.fillStyle = pit;
      ctx.fillRect(a.x, a.y, w, h);
      for (const dx of [w * 0.28, w * 0.66]) {
        const rail = ctx.createLinearGradient(0, a.y, 0, b.y);
        rail.addColorStop(0, "#8a6444");
        rail.addColorStop(1, "rgba(60, 40, 30, 0.1)");
        ctx.fillStyle = rail;
        ctx.fillRect(a.x + dx, a.y - 8, 4, h + 6);
      }
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = `rgba(138, 100, 68, ${0.9 - k * 0.22})`;
        ctx.fillRect(a.x + w * 0.28, a.y + 4 + k * (h / 4.5), w * 0.38 + 4, 3);
      }
      ctx.fillStyle = "rgba(140, 170, 230, 0.12)"; // the draft from below
      ctx.fillRect(a.x, a.y, w, h);
    });
  },

  // Little glowing mushrooms (the deeper floors): a soft light of their own.
  glowcaps(ctx, o) {
    const base = toScreen(o.x + o.w / 2, o.y + o.h);
    const t = performance.now() / 1000;
    for (const [dx, s] of [[-6, 1], [3, 0.8], [9, 0.6]]) {
      const x = base.x + dx, y = base.y - 2;
      ctx.fillStyle = "#d8d0b8";
      ctx.fillRect(x - 1, y - 7 * s, 2, 7 * s);
      ctx.fillStyle = `rgba(140, 230, 210, ${0.8 + Math.sin(t * 2 + dx) * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 7 * s, 5 * s, 3.2 * s, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(x - 2 * s, y - 9 * s, 1.5, 1);
    }
  },
};

// The wine rack (also Nest & Nook's rare cellar find, see DECOR).
function drawWineRack(ctx, o) {
  const r = drawBlock(ctx, o.x, o.y, o.w, o.h, 50, "#5e4230");
  const { face } = r;
  ctx.fillStyle = "#1e140e";
  ctx.fillRect(face.x + 3, face.y + 3, face.w - 6, face.h - 6);
  const cols = Math.max(3, Math.round(face.w / 11)), rowsN = 4;
  const cw = (face.w - 6) / cols, ch = (face.h - 6) / rowsN;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rowsN; j++) {
      const cx = face.x + 3 + cw * (i + 0.5), cy = face.y + 3 + ch * (j + 0.5);
      if (noise(o.x * 3 + i * 1.7 + j * 2.9) < 0.2) continue; // (an empty cubby)
      ctx.fillStyle = noise(i * 5.1 + j * 3.3) > 0.5 ? "#3a1a22" : "#2a3a24";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cw, ch) * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(cx - 1.5, cy - 2, 1.2, 1.2);
    }
  }
  ctx.strokeStyle = "#7a5a3e"; // the lattice
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(face.x + 3 + cw * i, face.y + 3);
    ctx.lineTo(face.x + 3 + cw * i, face.y + face.h - 3);
    ctx.stroke();
  }
  for (let j = 0; j <= rowsN; j++) {
    ctx.beginPath();
    ctx.moveTo(face.x + 3, face.y + 3 + ch * j);
    ctx.lineTo(face.x + face.w - 3, face.y + 3 + ch * j);
    ctx.stroke();
  }
}

// The banner for Cellar Crawl's lobby: a cellar wall with a lantern
// hanging from a beam, barrels and crates, and rats' eyes in the dark.
function paintCellarScene(ctx, w, h, t) {
  const k = h / 250;
  ctx.save();
  ctx.fillStyle = "#16100c";
  ctx.fillRect(0, 0, w, h);
  ctx.scale(k, k);
  const W = w / k; // (the banner's width, in its 250-tall pixels)
  // Grid units: the banner is drawn as a strip of cellar, 5.4 tiles tall.
  ctx.translate(-ORIGIN_X, -ORIGIN_Y);
  const cols = Math.ceil(W / TILE) + 1;
  const map = { open: (x, y) => y >= 2 };
  for (let tx = 0; tx < cols; tx++) {
    for (let ty = 0; ty < 6; ty++) {
      if (ty < 2) drawCellarWallTile(ctx, tx, ty, 0, ty === 1, map);
      else drawCellarFloorTile(ctx, tx, ty, 0);
    }
  }
  drawCobweb(ctx, 0, 2, -1, 1.4);
  drawCobweb(ctx, W / TILE, 2, 1, 1.4);
  const things = [
    { kind: "shelf", x: 1.0, y: 2.0, w: 1.6, h: 0.45 },
    { kind: "wineRack", x: W / TILE - 3.2, y: 2.0, w: 1.6, h: 0.45 },
    { kind: "barrel", x: 3.2, y: 3.1, w: 0.7, h: 0.6 },
    { kind: "barrel", x: 4.0, y: 3.3, w: 0.7, h: 0.6 },
    { kind: "crate", x: W / TILE - 5.2, y: 3.3, w: 0.9, h: 0.65 },
    { kind: "crate", x: W / TILE - 4.1, y: 3.6, w: 0.8, h: 0.6, tint: "#8a6440" },
    { kind: "sacks", x: 0.6, y: 4.1, w: 1.1, h: 0.5 },
    { kind: "crocks", x: W / TILE - 1.8, y: 4.0, w: 0.8, h: 0.5 },
  ].sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const o of things) CELLAR_DRAWERS[o.kind](ctx, o);
  ctx.restore();
  // The lantern's light, and the dark around it.
  const lx = w / 2, ly = h * 0.36;
  const dark = ctx.createRadialGradient(lx, ly, 20 * k, lx, ly, w * 0.55);
  dark.addColorStop(0, "rgba(10, 6, 4, 0)");
  dark.addColorStop(0.5, "rgba(10, 6, 4, 0.45)");
  dark.addColorStop(1, "rgba(10, 6, 4, 0.9)");
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, w, h);
  const flicker = 1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
  const warm = ctx.createRadialGradient(lx, ly, 0, lx, ly, 150 * k * flicker);
  warm.addColorStop(0, "rgba(255, 190, 90, 0.35)");
  warm.addColorStop(1, "rgba(255, 190, 90, 0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  drawLantern(ctx, lx, ly, k * 1.6, t);
  // Rats' eyes, blinking, in the dark corners.
  for (const [ex, ey, ph] of [[0.08, 0.8, 0], [0.93, 0.72, 2], [0.2, 0.55, 4]]) {
    if (Math.sin(t * 1.3 + ph) > 0.85) continue;
    ctx.fillStyle = "#ff8a9a";
    for (const dx of [-3, 3]) {
      ctx.beginPath();
      ctx.arc(w * ex + dx * k, h * ey, 1.6 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A lantern: a brass cap and ring, glass with a flame, a wire cage (and
// a hook up to a beam, when it's hanging).
function drawLantern(ctx, x, y, s, t, hook = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#2a1e14";
  ctx.lineWidth = 1.2;
  if (hook) {
    ctx.beginPath(); // the hook up to the beam
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -16);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -13, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#6a4a1e"; // the cap
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(7, -6);
  ctx.lineTo(3, -11);
  ctx.lineTo(-3, -11);
  ctx.closePath();
  ctx.fill();
  const glass = ctx.createRadialGradient(0, 2, 1, 0, 2, 9);
  glass.addColorStop(0, "rgba(255, 240, 180, 1)");
  glass.addColorStop(1, "rgba(240, 160, 60, 0.85)");
  ctx.fillStyle = glass;
  roundRectPath(ctx, -6, -6, 12, 16, 3);
  ctx.fill();
  const f = 1 + Math.sin(t * 11) * 0.12;
  ctx.fillStyle = "#fff8e0"; // the flame
  ctx.beginPath();
  ctx.ellipse(0, 3, 1.6, 3.2 * f, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2a14"; // the cage
  ctx.lineWidth = 1;
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(dx, -6);
    ctx.lineTo(dx, 10);
    ctx.stroke();
  }
  ctx.fillStyle = "#6a4a1e"; // the base
  ctx.fillRect(-7, 10, 14, 3);
  ctx.restore();
}
