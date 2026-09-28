// How the night looks (Update 8): Mothman, a shy, fluffy resident who
// only comes out after dark and sits by lamps; the moths that swarm the
// porch light at nine; tiny wolf ears on everyone on full moon nights; and
// Mothman's gifts (antennae, wings, a tiny moth pet, his lamp and plush).
// Standing upright with a soft shadow, lit from above, like everything else.

// True on a real full moon night (world.js moonPhase), when everyone gets
// tiny wolf ears.
function moonEars() {
  return isFullMoon() && isNightOutside();
}

// Tiny wolf ears poking up from the top of a head.
function drawWolfEars(ctx, cx, cy, r) {
  for (const side of [-1, 1]) {
    const x = cx + side * r * 0.55, y = cy - r * 0.78;
    ctx.fillStyle = "#3a3438";
    ctx.beginPath();
    ctx.moveTo(x - side * 5.5, y + 2);
    ctx.lineTo(x + side * 1.5, y - 9);
    ctx.lineTo(x + side * 5, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7a6a70";
    ctx.beginPath();
    ctx.moveTo(x - side * 5, y + 2);
    ctx.lineTo(x + side * 1.2, y - 8);
    ctx.lineTo(x + side * 4.2, y + 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8b8c0";
    ctx.beginPath();
    ctx.moveTo(x - side * 2.6, y + 1.5);
    ctx.lineTo(x + side * 1, y - 5);
    ctx.lineTo(x + side * 2.6, y + 2);
    ctx.closePath();
    ctx.fill();
  }
}

// Is the porch light swarm on right now (every night, CONFIG.night.porchLight)?
function porchSwarmOn(now = Date.now()) {
  const cfg = CONFIG.night.porchLight;
  const h = hometownHour(now);
  return Math.floor(h) === cfg.hour && (h % 1) * 60 < cfg.minutes;
}

// --- Mothman ---
// Big soft wings folded like a cloak, a fluffy cream ruff, feathery
// antennae, and large glowing red eyes (friendly ones). He hovers a
// little while he drifts, and sits very still by lamps, now and then
// fluttering his wings.
function drawMothman(ctx, s, t) {
  const hover = s.moving ? 6 + Math.sin(t * 5) * 2 : Math.sin(t * 1.5) * 0.8;
  if (!s.noShadow) residentShadow(ctx, s.moving ? 9 : 11, s.moving ? 0.14 : 0.22); // (the plush has its own)
  const back = s.facing === "back";
  if (typeof s.facing === "number" && s.facing < 0) ctx.scale(-1, 1);
  ctx.translate(0, -hover);
  const WING = "#6e5a6e", WING_DARK = "#4e3f52", FUR = "#b8a8b0", RUFF = "#f0e6d8";
  // The wings: folded like a cloak, opening a little now and then.
  const open = s.moving ? 0.5 + Math.sin(t * 10) * 0.35 : Math.max(0, Math.sin(t * 0.7)) ** 8 * 0.6;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 5, -30);
    ctx.rotate(dir * (0.15 + open));
    const wing = ctx.createLinearGradient(0, -6, 0, 30);
    wing.addColorStop(0, "#8a7488");
    wing.addColorStop(1, WING_DARK);
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(dir * 20, 2, dir * 14, 26);
    ctx.quadraticCurveTo(dir * 6, 30, 0, 24);
    ctx.closePath();
    ctx.fill();
    // Wing markings: a pale eyespot and soft bands.
    ctx.fillStyle = "rgba(240, 220, 200, 0.35)";
    ctx.beginPath();
    ctx.ellipse(dir * 9, 10, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30, 20, 30, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dir * 2, 4);
    ctx.quadraticCurveTo(dir * 11, 8, dir * 13, 18);
    ctx.stroke();
    ctx.restore();
  }
  // The body: a soft fuzzy column, lit from above.
  const body = ctx.createLinearGradient(0, -40, 0, 0);
  body.addColorStop(0, "#c8b8c0");
  body.addColorStop(1, "#8a7a84");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -16, 9.5, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 45, 60, 0.35)"; // fuzzy texture
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const y = -26 + i * 3.6;
    ctx.moveTo(-6 + (i % 2) * 2, y);
    ctx.lineTo(-3 + (i % 2) * 2, y + 1.5);
    ctx.moveTo(3 - (i % 2) * 2, y + 1);
    ctx.lineTo(6 - (i % 2) * 2, y + 2.5);
  }
  ctx.stroke();
  // Little feet.
  ctx.fillStyle = WING_DARK;
  for (const dx of [-4, 4]) {
    ctx.beginPath();
    ctx.ellipse(dx, -1, 2.6, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The fluffy ruff round his neck: lots of little puffs.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.05 + (i / 8) * 0.9);
    ctx.fillStyle = i % 2 ? RUFF : "#e2d6c6";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 9.5, -30 + Math.sin(a) * 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-3, -32, 5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // The head.
  const head = ctx.createRadialGradient(-2, -43, 1, 0, -39, 10);
  head.addColorStop(0, "#c8b8c4");
  head.addColorStop(1, FUR);
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(0, -39, 8.5, 0, Math.PI * 2);
  ctx.fill();
  // Feathery antennae.
  ctx.strokeStyle = WING;
  ctx.lineWidth = 1.2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3, -46);
    ctx.quadraticCurveTo(dir * 7, -56, dir * 12, -57 + Math.sin(t * 2 + dir) * 1.2);
    ctx.stroke();
    for (let k = 1; k < 5; k++) {
      const x = dir * (3 + k * 2), y = -47 - k * 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dir * 2, y - 2.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 2.4, y - 1);
      ctx.stroke();
    }
  }
  if (back) return;
  // The eyes: big, red and softly glowing, with a highlight. He blinks.
  const blink = (t * 0.4) % 5 > 4.85;
  for (const dx of [-3.8, 3.8]) {
    const glow = ctx.createRadialGradient(dx, -39.5, 0.5, dx, -39.5, 7);
    glow.addColorStop(0, "rgba(255, 90, 80, 0.55)");
    glow.addColorStop(1, "rgba(255, 90, 80, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(dx - 7, -46.5, 14, 14);
    ctx.fillStyle = "#c8302c";
    ctx.beginPath();
    ctx.ellipse(dx, -39.5, 3.2, blink ? 0.6 : 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = "rgba(255, 240, 230, 0.9)";
      ctx.beginPath();
      ctx.arc(dx - 1, -41, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A shy little blush.
  ctx.fillStyle = "rgba(240, 140, 160, 0.35)";
  for (const dx of [-5.5, 5.5]) {
    ctx.beginPath();
    ctx.ellipse(dx, -35.5, 2, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- The porch light swarm ---
// Little moths circling each porch lantern (drawn over everything, see
// drawOutdoorLight in outdoors.js), during the swarm's minutes.
function drawMothSwarm(ctx) {
  if (!porchSwarmOn()) return;
  const t = performance.now() / 1000;
  for (const lamp of FURNITURE.filter((f) => f.kind === "porchLantern" && floorOf(f.y) === YARD_FLOOR)) {
    const c = toScreen(lamp.x, lamp.y);
    const cx = c.x, cy = c.y - WALL_HEIGHT * 0.55;
    for (let i = 0; i < 14; i++) {
      const a = t * (1.2 + (i % 4) * 0.35) + i * 2.1;
      const rad = 10 + (i % 5) * 5 + Math.sin(t * 2 + i) * 3;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a * 1.3) * rad * 0.6;
      const flap = Math.abs(Math.sin(t * 18 + i));
      ctx.fillStyle = i % 3 ? "rgba(235, 220, 200, 0.9)" : "rgba(200, 180, 170, 0.9)";
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + dir * 1.6, y, 1.8, 1 + flap * 1.2, dir * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(90, 70, 70, 0.9)";
      ctx.fillRect(x - 0.5, y - 1, 1, 2);
    }
  }
}

// --- Mothman's gifts ---
Object.assign(HAT_DRAWERS, {
  // Feathery moth antennae on a thin headband.
  mothAntennae(ctx, cx, cy, r) {
    ctx.strokeStyle = "#5a4a5e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.lineWidth = 1.3;
    for (const dir of [-1, 1]) {
      const bx = cx + dir * r * 0.4, by = cy - r * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + dir * 4, by - 10, bx + dir * 10, by - 13);
      ctx.stroke();
      for (let k = 1; k < 5; k++) {
        const x = bx + dir * k * 2.3, y = by - k * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dir * 2.2, y - 2.4);
        ctx.moveTo(x, y);
        ctx.lineTo(x + dir * 2.6, y - 0.8);
        ctx.stroke();
      }
    }
  },
});

BACKPACK_DRAWERS.mothWings = {
  // Soft dusk-colored moth wings, with pale eyespots.
  back(ctx, cx, cy) {
    for (const dir of [-1, 1]) {
      const wing = ctx.createLinearGradient(0, cy - 14, 0, cy + 16);
      wing.addColorStop(0, "#9a86a0");
      wing.addColorStop(1, "#5e4c64");
      ctx.fillStyle = wing;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 3, cy - 6);
      ctx.quadraticCurveTo(cx + dir * 30, cy - 20, cx + dir * 26, cy + 4);
      ctx.quadraticCurveTo(cx + dir * 22, cy + 18, cx + dir * 4, cy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 28, 44, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(245, 230, 210, 0.55)";
      ctx.beginPath();
      ctx.ellipse(cx + dir * 17, cy - 4, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(60, 40, 60, 0.6)";
      ctx.beginPath();
      ctx.arc(cx + dir * 17, cy - 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  straps: () => {},
};

Object.assign(PET_DRAWERS, {
  // A tiny fluffy moth that flutters beside you.
  mothPet(ctx, t, moving) {
    const lift = 10 + Math.sin(t * 4) * 2;
    ctx.translate(0, -lift);
    const flap = Math.abs(Math.sin(t * (moving ? 20 : 8)));
    for (const dir of [-1, 1]) {
      ctx.fillStyle = "#b8a0b4";
      ctx.beginPath();
      ctx.ellipse(dir * 5, -2, 5, 2.5 + flap * 2.5, dir * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(250, 235, 220, 0.6)";
      ctx.beginPath();
      ctx.arc(dir * 5.5, -2.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    petBlob(ctx, 0, -2, 3, 4.5, "#e6dace");
    ctx.fillStyle = "#c8302c";
    for (const dx of [-1.3, 1.3]) {
      ctx.beginPath();
      ctx.arc(dx, -4.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#6e5a6e";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, -6.5);
    ctx.lineTo(-3.5, -10);
    ctx.moveTo(1, -6.5);
    ctx.lineTo(3.5, -10);
    ctx.stroke();
  },
});

Object.assign(FURNITURE_DRAWERS, {
  // The Mothman lamp: a round paper shade on a thin stand, with a little
  // moth silhouette on the glowing shade.
  mothLamp(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    // A round wooden base (lit on top), and a stand with a lit left edge.
    ctx.fillStyle = "#5e412a";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 3, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a5638";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 4.5, 8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 225, 180, 0.3)";
    ctx.fillRect(b.x - 5, b.y - 6.5, 6, 1);
    ctx.fillStyle = "#4e3f52";
    ctx.fillRect(b.x - 1.5, b.y - 30, 3, 26);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(b.x - 1.5, b.y - 30, 1, 26);
    const glow = ctx.createRadialGradient(b.x, b.y - 36, 2, b.x, b.y - 36, 13);
    glow.addColorStop(0, "#fff4d8");
    glow.addColorStop(1, "#f0c88a");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 36, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 110, 60, 0.4)"; // the paper's ribs
    ctx.lineWidth = 0.8;
    for (const k of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 36, 11, Math.max(1, 11 - Math.abs(k) * 1.2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(78, 63, 82, 0.8)"; // the moth on the shade
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(b.x + dir * 3, b.y - 37, 3, 2.2, dir * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(b.x - 0.6, b.y - 39, 1.2, 4);
  },

  // The Mothman plush: a squashy little version of him, sitting.
  mothPlush(ctx, f) {
    drawShadow(ctx, f.x, f.y, f.w, f.h);
    const b = toScreen(f.x + f.w / 2, f.y + f.h);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(0.55, 0.5);
    drawMothman(ctx, { facing: 0, moving: false, act: "sit", noShadow: true }, 0);
    ctx.restore();
  },
});
