// Part of the house's drawing code (see render.js for how the pieces fit
// together): players (bodies, hats, shoes, glasses), pets, the raccoons'
// stock, the Exalted look, accessories, faces, emotes and dances.

// --- Characters ---
const PLAYER_RADIUS = 14; // screen pixels

// Where a player's feet touch the floor, in screen pixels.
function playerFeet(p) {
  return toScreen(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE);
}

// Hats you can pick on the Join screen. Each draws on top of a round body
// with its center at (cx, cy) and radius r. "none" draws nothing.
const HAT_DRAWERS = {
  none() {},

  // A knitted beanie with a folded band and a pompom.
  beanie(ctx, cx, cy, r) {
    ctx.fillStyle = "#c0554a";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.08, Math.PI * 1.92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a8473a";
    roundRectPath(ctx, cx - r + 1, cy - r * 0.55, r * 2 - 2, 5, 2);
    ctx.fill();
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A baseball cap with the brim pointing off to the side.
  cap(ctx, cx, cy, r) {
    ctx.fillStyle = "#4a90a4";
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a7384";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.75, cy - r * 0.5, 8, 2.8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // A big bow on top.
  bow(ctx, cx, cy, r) {
    const bx = cx + 5, by = cy - r + 1;
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 9, by - 6);
    ctx.lineTo(bx - 9, by + 5);
    ctx.closePath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 9, by - 6);
    ctx.lineTo(bx + 9, by + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c95a84";
    ctx.beginPath();
    ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
    ctx.fill();
  },

  // Chunky headphones: a band over the top and a cup on each side.
  headphones(ctx, cx, cy, r) {
    ctx.strokeStyle = "#3a3a40";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#3a3a40";
      roundRectPath(ctx, cx + side * (r + 1) - 3.5, cy - 5, 7, 11, 3);
      ctx.fill();
      ctx.fillStyle = "#e0a84c";
      ctx.fillRect(cx + side * (r + 1) - 1, cy - 3, 2, 7);
    }
  },

  // A little flower tucked behind one ear.
  flower(ctx, cx, cy, r) {
    const fx = cx - r * 0.6, fy = cy - r * 0.75;
    ctx.fillStyle = "#fbf3e4";
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * 3.6, fy + Math.sin(angle) * 3.6, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  },
};

// Hats sold by the raccoons (see shop.js for names and prices). Each draws
// on top of a round body with its center at (cx, cy) and radius r.
Object.assign(HAT_DRAWERS, {
  // A striped party cone with a pompom, tipped at a jaunty angle.
  partyHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.moveTo(cx - 8, base);
    ctx.lineTo(cx + 7, base);
    ctx.lineTo(cx + 3, base - 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = 2;
    for (const t of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(cx - 8 + 11 * t, base - 18 * t);
      ctx.lineTo(cx + 7 - 4 * t, base - 18 * t);
      ctx.stroke();
    }
    ctx.fillStyle = "#6fc8ff";
    ctx.beginPath();
    ctx.arc(cx + 3, base - 19, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  // A tall puffy white chef's hat.
  chefHat(ctx, cx, cy, r) {
    const base = cy - r + 4;
    ctx.fillStyle = "#f7f4ee";
    for (const [dx, dy, rr] of [[-6, -12, 6], [0, -15, 7], [6, -12, 6]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, base + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(cx - 9, base - 10, 18, 8);
    ctx.fillStyle = "#e3ddd2";
    ctx.fillRect(cx - 10, base - 3, 20, 5);
  },

  // A classic black top hat with a red band.
  topHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#2b2b2f";
    ctx.beginPath();
    ctx.ellipse(cx, base, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 9, base - 18, 18, 18);
    ctx.fillStyle = "#b8322a";
    ctx.fillRect(cx - 9, base - 5, 18, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(cx - 7, base - 17, 3, 11);
  },

  // A wide-brimmed cowboy hat.
  cowboyHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.ellipse(cx, base, 19, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRectPath(ctx, cx - 9, base - 13, 18, 13, 5);
    ctx.fill();
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(cx - 9, base - 4, 18, 2.5);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, base - 13);
    ctx.lineTo(cx, base - 8);
    ctx.stroke();
  },

  // A pointy purple witch's hat with a gold buckle.
  witchHat(ctx, cx, cy, r) {
    const base = cy - r + 3;
    ctx.fillStyle = "#5b3f7a";
    ctx.beginPath();
    ctx.ellipse(cx, base, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 10, base);
    ctx.lineTo(cx + 10, base);
    ctx.quadraticCurveTo(cx + 4, base - 16, cx + 10, base - 24);
    ctx.quadraticCurveTo(cx - 2, base - 18, cx - 10, base);
    ctx.fill();
    ctx.fillStyle = "#3f2a57";
    ctx.fillRect(cx - 10, base - 5, 20, 3.5);
    ctx.strokeStyle = "#e0b84c";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 3, base - 6, 6, 5);
  },

  // A green frog hat with two googly eyes on top.
  frogHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#6fb05a";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      const ex = cx + side * 6, ey = cy - r - 2;
      ctx.fillStyle = "#6fb05a";
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.arc(ex + side * 0.8, ey - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e37aa0"; // little blush on the frog
    ctx.beginPath();
    ctx.arc(cx - 9, cy - r * 0.45, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - r * 0.45, 1.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A little golden crown with three gems.
  crown(ctx, cx, cy, r) {
    const base = cy - r + 4;
    ctx.fillStyle = "#e0b84c";
    ctx.beginPath();
    ctx.moveTo(cx - 10, base);
    ctx.lineTo(cx - 10, base - 10);
    ctx.lineTo(cx - 5, base - 5);
    ctx.lineTo(cx, base - 12);
    ctx.lineTo(cx + 5, base - 5);
    ctx.lineTo(cx + 10, base - 10);
    ctx.lineTo(cx + 10, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7e08a";
    ctx.fillRect(cx - 10, base - 2, 20, 2);
    for (const [gx, color] of [[-6, "#c0554a"], [0, "#3f6f9f"], [6, "#4f7a48"]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + gx, base - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A glowing golden halo floating above the head.
  halo(ctx, cx, cy, r) {
    const hy = cy - r - 7 + Math.sin(performance.now() / 500) * 1.2;
    drawGlow(ctx, cx, hy, 16, "rgba(255, 230, 140, 0.55)");
    ctx.strokeStyle = "#f2d06b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, hy, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
});

// Shoes sold by the raccoons. Each draws one foot at (x, y) (its center),
// replacing the plain little foot. "side" is -1 for left, 1 for right.
const SHOE_DRAWERS = {
  none: null, // plain feet in your own color

  sneakers(ctx, x, y, side) {
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x - 3, y - 1, 6, 1.4);
    ctx.fillStyle = "#b9b3a8";
    ctx.fillRect(x - 4.4, y + 1.5, 8.8, 1.3);
  },

  rainBoots(ctx, x, y, side) {
    ctx.fillStyle = "#f2c94c";
    roundRectPath(ctx, x - 3.8, y - 6, 7.6, 9, 2.5);
    ctx.fill();
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x - 3.8, y + 1.8, 7.6, 1.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(x - 2.6, y - 5, 1.2, 5);
  },

  bunnySlippers(ctx, x, y, side) {
    ctx.fillStyle = "#f5c6d6";
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const ear of [-1.6, 1.6]) {
      ctx.beginPath();
      ctx.ellipse(x + ear, y - 4, 1.2, 3, ear * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(x - 1.8, y - 1, 1, 1);
    ctx.fillRect(x + 0.8, y - 1, 1, 1);
  },

  cowboyBoots(ctx, x, y, side) {
    ctx.fillStyle = "#8b5e3c";
    roundRectPath(ctx, x - 3.5, y - 7, 7, 9, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + side * 1.5, y + 1, 4.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3a22";
    ctx.fillRect(x - side * 3 - 1, y + 1, 2.5, 2.2); // heel
    ctx.fillStyle = "#e0b84c";
    ctx.fillRect(x - 0.8, y - 5, 1.6, 1.6); // a little star stitch
  },

  rollerSkates(ctx, x, y, side) {
    ctx.fillStyle = "#c0554a";
    roundRectPath(ctx, x - 4, y - 5, 8, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#f7f4ee";
    ctx.fillRect(x - 4, y + 0.5, 8, 1.5);
    ctx.fillStyle = "#6fc8ff";
    for (const wx of [-2.5, 2.5]) {
      ctx.beginPath();
      ctx.arc(x + wx, y + 3.4, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// --- Pets ---
// Little companions sold by the raccoons. Each drawer draws its pet
// facing right with its feet at (0, 0); drawPet moves it into place,
// flips it to face the way it's walking, and adds the shadow. `t` is the
// time in seconds, `moving` is true while it's trotting after its owner,
// and `blink` is true for the split second its eyes close.

// A round body shape, lit from above like everything else: lighter on
// top, darker underneath, with a soft darker outline.
function petBlob(ctx, x, y, rx, ry, color) {
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, shadeColor(color, 30));
  g.addColorStop(1, shadeColor(color, -25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -55);
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A small shiny eye (or a closed line when blinking).
function petEye(ctx, x, y, blink, size = 1.4) {
  if (blink) {
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - size * 0.2, y - size * 0.7, size * 0.6, size * 0.6);
}

// Pink blush on a cheek.
function petCheek(ctx, x, y) {
  ctx.fillStyle = "rgba(240, 120, 120, 0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y, 1.8, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Two little legs that take turns while walking.
function petLegs(ctx, color, t, moving, xs = [-3.5, 3.5]) {
  ctx.fillStyle = shadeColor(color, -40);
  xs.forEach((x, i) => {
    const lift = moving ? Math.max(0, Math.sin(t * 14 + i * Math.PI)) * 1.5 : 0;
    ctx.beginPath();
    ctx.ellipse(x, -1.2 - lift, 1.8, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// A pointy triangle ear.
function petEar(ctx, x, y, w, h, color, inner) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  if (inner) {
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(x - w / 4, y);
    ctx.lineTo(x, y - h * 0.6);
    ctx.lineTo(x + w / 4, y);
    ctx.closePath();
    ctx.fill();
  }
}

const PET_DRAWERS = {
  // An orange tabby with a curly tail.
  cat(ctx, t, moving, blink) {
    const c = "#e8a15a";
    ctx.strokeStyle = shadeColor(c, -20);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.quadraticCurveTo(-13, -10, -10 + Math.sin(t * 3) * 2, -16);
    ctx.stroke();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 7.5, 5, c);
    ctx.fillStyle = shadeColor(c, -25);
    for (const x of [-4, -1, 2]) ctx.fillRect(x, -10.5, 1.4, 3);
    petEar(ctx, 3.5, -14, 4, 5, c, "#f3b8b8");
    petEar(ctx, 8.5, -14, 4, 5, c, "#f3b8b8");
    petBlob(ctx, 6, -12, 5, 4.3, c);
    petEye(ctx, 4.8, -12.5, blink, 1.1);
    petEye(ctx, 8.4, -12.5, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(6.2, -10.8, 1.2, 0.9);
    petCheek(ctx, 9.8, -10.6);
  },

  // A happy pup with floppy ears and a very waggy tail.
  dog(ctx, t, moving, blink) {
    const c = "#c99a64";
    ctx.strokeStyle = shadeColor(c, -15);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(-11 + Math.sin(t * 16) * 2, -12);
    ctx.stroke();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 7.5, 5, c);
    petBlob(ctx, 6, -12, 5, 4.5, c);
    ctx.fillStyle = "#f3e2c6"; // snout
    ctx.beginPath();
    ctx.ellipse(9, -10.5, 2.6, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(10.6, -11.2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -45); // floppy ear
    ctx.beginPath();
    ctx.ellipse(3, -12.5, 1.8, 3.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 6.5, -13.5, blink, 1.1);
    if (!moving) {
      ctx.fillStyle = "#e37aa0"; // tongue out while sitting
      ctx.fillRect(8.5, -9, 1.5, 2);
    }
  },

  // A round bunny that hops instead of walking.
  bunny(ctx, t, moving, blink) {
    const c = "#f2ece2";
    const hop = moving ? Math.abs(Math.sin(t * 9)) * 3 : 0;
    ctx.translate(0, -hop);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-7, -5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, -1, -5.5, 7, 5.5, c);
    for (const [x, lean] of [[3.5, -0.15], [6.5, 0.15]]) {
      ctx.save();
      ctx.translate(x, -14);
      ctx.rotate(lean + Math.sin(t * 2 + x) * 0.05);
      petBlob(ctx, 0, -5, 1.7, 5, c);
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.ellipse(0, -5, 0.8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    petBlob(ctx, 5, -11.5, 4.5, 4, c);
    petEye(ctx, 6.8, -12, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(8.6, -10.8, 1.1, 0.9);
    petCheek(ctx, 7, -9.8);
  },

  // A fluffy yellow duckling that waddles.
  duck(ctx, t, moving, blink) {
    const c = "#f6d55c";
    if (moving) ctx.rotate(Math.sin(t * 12) * 0.12);
    ctx.fillStyle = "#e8913a";
    for (const x of [-3, 2]) {
      ctx.beginPath();
      ctx.ellipse(x, -1, 2.4, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    petBlob(ctx, -1, -6, 6.5, 5, c);
    ctx.fillStyle = shadeColor(c, -15); // wing
    ctx.beginPath();
    ctx.ellipse(-2, -6, 3.5, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 4, -12, 4.2, 4, c);
    ctx.fillStyle = "#e8913a"; // beak
    ctx.beginPath();
    ctx.ellipse(8.4, -11.4, 2.3, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 5.6, -13, blink, 1);
    petCheek(ctx, 5, -10.4);
  },

  // A little green frog that hops, with big eyes on top.
  frog(ctx, t, moving, blink) {
    const c = "#79b85b";
    const hop = moving ? Math.abs(Math.sin(t * 8)) * 3.5 : 0;
    ctx.translate(0, -hop);
    petBlob(ctx, 0, -5, 8, 5, c);
    ctx.fillStyle = "#e6f0c8"; // pale belly
    ctx.beginPath();
    ctx.ellipse(1, -3, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [-2, 4]) {
      petBlob(ctx, x, -10, 2.8, 2.8, c);
      petEye(ctx, x + 0.4, -10.3, blink, 1.2);
    }
    ctx.strokeStyle = shadeColor(c, -50);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(2, -6.5, 3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    petCheek(ctx, -3, -5.5);
    petCheek(ctx, 7, -5.5);
  },

  // A hedgehog: a spiky round back and a little pointed face.
  hedgehog(ctx, t, moving, blink) {
    const c = "#8a6a4c";
    petLegs(ctx, "#c9a987", t, moving);
    ctx.fillStyle = shadeColor(c, -20); // spikes
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (1.05 + i * 0.11);
      const x = -1 + Math.cos(a) * 7.5, y = -6 + Math.sin(a) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 1.6, y + 1);
      ctx.lineTo(-1 + Math.cos(a) * 10.5, -6 + Math.sin(a) * 9);
      ctx.lineTo(x + 1.6, y + 1);
      ctx.closePath();
      ctx.fill();
    }
    petBlob(ctx, -1, -6, 7.5, 5.5, c);
    ctx.fillStyle = "#e6cfae"; // face
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.quadraticCurveTo(10, -8, 11, -5);
    ctx.quadraticCurveTo(7, -2, 4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(11, -5.2, 1, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 6.5, -7, blink, 1);
    petCheek(ctx, 6.5, -4.6);
  },

  // A fox with a big bushy white-tipped tail.
  fox(ctx, t, moving, blink) {
    const c = "#e27b3c";
    ctx.save();
    ctx.translate(-6, -6);
    ctx.rotate(-0.5 + Math.sin(t * 2.5) * 0.15);
    petBlob(ctx, -4, 0, 6, 3.2, c);
    ctx.fillStyle = "#fbf3e6";
    ctx.beginPath();
    ctx.ellipse(-8.5, 0, 2.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    petLegs(ctx, "#5a3a2a", t, moving);
    petBlob(ctx, 0, -6, 6.5, 4.5, c);
    ctx.fillStyle = "#fbf3e6"; // white chest
    ctx.beginPath();
    ctx.ellipse(4, -5, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, 3.5, -14, 3.6, 5, c, "#5a3a2a");
    petEar(ctx, 8, -14, 3.6, 5, c, "#5a3a2a");
    petBlob(ctx, 6, -11.5, 4.5, 3.8, c);
    ctx.fillStyle = "#fbf3e6";
    ctx.beginPath();
    ctx.moveTo(6, -11);
    ctx.lineTo(11.5, -10.5);
    ctx.lineTo(7, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(11.3, -10.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 7, -12.6, blink, 1);
  },

  // A penguin standing up tall, waddling side to side.
  penguin(ctx, t, moving, blink) {
    const c = "#3a3f4a";
    if (moving) ctx.rotate(Math.sin(t * 12) * 0.14);
    ctx.fillStyle = "#e8913a";
    for (const x of [-2.5, 2.5]) {
      ctx.beginPath();
      ctx.ellipse(x, -0.8, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    petBlob(ctx, 0, -9, 6, 8.5, c);
    ctx.fillStyle = "#f7f4ee"; // white front
    ctx.beginPath();
    ctx.ellipse(1.5, -7.5, 3.8, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -15); // flipper
    ctx.beginPath();
    ctx.ellipse(-4.5, -8, 1.6, 4, 0.3 + (moving ? Math.sin(t * 12) * 0.3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8913a";
    ctx.beginPath();
    ctx.moveTo(4, -14);
    ctx.lineTo(8, -13);
    ctx.lineTo(4, -12);
    ctx.closePath();
    ctx.fill();
    petEye(ctx, 2.8, -15, blink, 1);
    petCheek(ctx, 3.5, -11.5);
  },

  // A friendly little ghost that floats (so it gets a fainter shadow).
  ghost(ctx, t, moving, blink) {
    const float = 6 + Math.sin(t * 2.5) * 2;
    ctx.translate(0, -float);
    ctx.globalAlpha *= 0.88;
    const g = ctx.createLinearGradient(0, -16, 0, 0);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#dfe3f0");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -9, 6.5, Math.PI, 0);
    ctx.lineTo(6.5, 0);
    for (let i = 0; i < 4; i++) {
      const x = 6.5 - (i + 1) * 3.25;
      ctx.quadraticCurveTo(x + 1.6, 2.5 + Math.sin(t * 6 + i) * 0.8, x, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha /= 0.88;
    petEye(ctx, 1, -9.5, blink, 1.2);
    petEye(ctx, 4.5, -9.5, blink, 1.2);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.ellipse(2.8, -6, 1.1, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    petCheek(ctx, -0.8, -7.2);
    petCheek(ctx, 6.3, -7.2);
  },

  // A tiny dragon with flapping wings and little horns.
  dragon(ctx, t, moving, blink) {
    const c = "#6fae8e";
    ctx.strokeStyle = c; // tail
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(-11, -3, -12, -7 + Math.sin(t * 3) * 1.5);
    ctx.stroke();
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.moveTo(-12, -9 + Math.sin(t * 3) * 1.5);
    ctx.lineTo(-14.5, -6.5 + Math.sin(t * 3) * 1.5);
    ctx.lineTo(-11, -5.5 + Math.sin(t * 3) * 1.5);
    ctx.closePath();
    ctx.fill();
    const flap = Math.sin(t * (moving ? 14 : 4)) * 0.35;
    ctx.save(); // wing
    ctx.translate(-2, -10);
    ctx.rotate(-0.6 + flap);
    ctx.fillStyle = "#b286c9";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-3, -8);
    ctx.lineTo(-7, -5);
    ctx.lineTo(-6, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 6.5, 5, c);
    ctx.fillStyle = "#e9e0b0"; // belly
    ctx.beginPath();
    ctx.ellipse(2, -5, 3, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 5, -12, 4.8, 4.2, c);
    ctx.fillStyle = "#f3e6c0"; // horns
    for (const x of [2.5, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(x - 1, -15.5);
      ctx.lineTo(x - 1.6, -19);
      ctx.lineTo(x + 1, -15.8);
      ctx.closePath();
      ctx.fill();
    }
    petEye(ctx, 6.5, -12.8, blink, 1.2);
    petCheek(ctx, 8, -10.5);
  },

  // A baby raccoon (the shopkeepers' cousin), with a mask and a stripy tail.
  raccoonKit(ctx, t, moving, blink) {
    const c = "#9a9aa2";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#3a3a40" : c;
      ctx.beginPath();
      ctx.arc(-7 - i * 1.8, -5 - i * 1.6 + Math.sin(t * 3) * i * 0.3, 2.6 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    petLegs(ctx, "#4a4a52", t, moving);
    petBlob(ctx, -1, -6, 7, 5, c);
    petEar(ctx, 3.5, -14.5, 3.8, 4, c, "#3a3a40");
    petEar(ctx, 8.5, -14.5, 3.8, 4, c, "#3a3a40");
    petBlob(ctx, 6, -12, 5, 4.2, c);
    ctx.fillStyle = "#f2f0ea"; // white face patch
    ctx.beginPath();
    ctx.ellipse(7, -11, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a40"; // the mask
    ctx.beginPath();
    ctx.ellipse(6.2, -12.5, 3.8, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 5, -12.5, blink, 0.9);
    petEye(ctx, 8.4, -12.5, blink, 0.9);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(10.8, -10.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  },
};

const PET_SCALE = 1.45; // pets are drawn small, then scaled up to sit nicely beside a character

// Draws one pet: `pet` is { kind, x, y, facing, moving } where x, y is the
// spot on the floor (grid units) its feet touch.
// --- More of the raccoons' stock (build 0.49) ---
// Hats are drawn around the head at (cx, cy) with radius r (the top of the
// head is cy - r); shoes around each foot at (x, y); glasses on the face
// (eyes at cx ± 4, cy - 2); pets standing at (0, 0), facing right.

Object.assign(HAT_DRAWERS, {
  // A French beret, tilted, with a little stalk.
  beret(ctx, cx, cy, r) {
    ctx.fillStyle = "#b8323a";
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - r + 1, r + 2, 5.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r - 1, r - 3, 2.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a2430";
    ctx.fillRect(cx + 1, cy - r - 7, 2, 4);
  },

  // A soft bucket hat with a wide floppy brim.
  bucketHat(ctx, cx, cy, r) {
    const brimY = cy - r * 0.6; // the brim sits on the forehead, above the eyes
    ctx.fillStyle = "#c9b27a";
    ctx.beginPath();
    ctx.ellipse(cx, brimY, r + 5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9c38a";
    ctx.beginPath();
    ctx.moveTo(cx - r + 2, brimY);
    ctx.quadraticCurveTo(cx - r + 3, cy - r - 6, cx, cy - r - 6);
    ctx.quadraticCurveTo(cx + r - 3, cy - r - 6, cx + r - 2, brimY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6a3a"; // band
    ctx.fillRect(cx - r + 3, brimY - 3.5, r * 2 - 6, 2.5);
  },

  // Cat ears on a headband.
  catEars(ctx, cx, cy, r) {
    for (const side of [-1, 1]) {
      const ex = cx + side * (r * 0.55);
      ctx.fillStyle = "#3a3440";
      ctx.beginPath();
      ctx.moveTo(ex - 5, cy - r + 3);
      ctx.lineTo(ex + side * 2, cy - r - 8);
      ctx.lineTo(ex + 5, cy - r + 3);
      ctx.fill();
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, cy - r + 2);
      ctx.lineTo(ex + side * 1.5, cy - r - 4);
      ctx.lineTo(ex + 2.5, cy - r + 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#3a3440";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },

  // Tall bunny ears, one flopped over.
  bunnyEars(ctx, cx, cy, r) {
    ctx.strokeStyle = "#f2ede4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    const ear = (x, angle) => {
      ctx.save();
      ctx.translate(x, cy - r + 2);
      ctx.rotate(angle);
      ctx.fillStyle = "#f7f3ec";
      ctx.beginPath();
      ctx.ellipse(0, -10, 4, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3b8c8";
      ctx.beginPath();
      ctx.ellipse(0, -10, 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    ear(cx - 5, -0.15);
    ear(cx + 5, 0.9);
  },

  // A crown of little flowers and leaves.
  flowerCrown(ctx, cx, cy, r) {
    const colors = ["#f2a0b8", "#fff2a8", "#c8b0e8", "#f7c68a", "#f2a0b8", "#a8d8e8", "#fff2a8"];
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.12 + i * 0.127);
      const x = cx + Math.cos(a) * (r - 1), y = cy + Math.sin(a) * (r - 1);
      drawLeaf(ctx, x, y, a + Math.PI / 2 + 0.5, 5, 2, "#6aa05a", null);
      ctx.fillStyle = colors[i];
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(pa) * 1.8, y + Math.sin(pa) * 1.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e0a83a";
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
  },

  // A red mushroom cap with white spots.
  mushroomCap(ctx, cx, cy, r) {
    // A dome that sits down over the top of the head, like a real cap.
    const rimY = cy - r * 0.4;
    ctx.fillStyle = "#efe4cf"; // the frilly underside, peeking out at the rim
    ctx.beginPath();
    ctx.ellipse(cx, rimY, r + 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8423a";
    ctx.beginPath();
    ctx.ellipse(cx, rimY - 0.5, r + 4, 14, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // lit from above
    ctx.beginPath();
    ctx.ellipse(cx - 4, rimY - 10, 6, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7f1e6";
    for (const [dx, dy, s] of [[-8, -5, 2.2], [1, -11, 2.6], [8, -6, 2], [-2, -4, 1.5], [5, -12, 1.3]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, rimY + dy, s, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A striped beanie with a spinning propeller on top.
  propellerCap(ctx, cx, cy, r) {
    // Colored panels on the top of the head only (clipped above the eyes).
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r - 3, cy - r - 4, r * 2 + 6, r * 0.55 + 4);
    ctx.clip();
    const stripes = ["#e04a5a", "#f2c94c", "#5aa0d8", "#7ac07a"];
    stripes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1);
      ctx.arc(cx, cy - 1, r + 1, Math.PI * (1 + i * 0.25), Math.PI * (1 + (i + 1) * 0.25));
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
    ctx.fillStyle = "#3a5f80"; // the band along the bottom edge
    ctx.fillRect(cx - r + 1, cy - r * 0.45 - 2, r * 2 - 2, 2.5);
    ctx.fillStyle = "#6b6b70";
    ctx.fillRect(cx - 0.8, cy - r - 6, 1.6, 6);
    const spin = performance.now() / 70;
    ctx.fillStyle = "#e04a5a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r - 6, Math.abs(Math.cos(spin)) * 8 + 1, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // A black pirate hat with gold trim and a tiny skull.
  pirateHat(ctx, cx, cy, r) {
    // A black pirate hat whose bottom edge curves over the head, so it sits
    // on it rather than floating above.
    const rimY = cy - r * 0.35;
    ctx.fillStyle = "#26222a";
    ctx.beginPath();
    ctx.moveTo(cx - r - 5, rimY);
    ctx.quadraticCurveTo(cx - r + 1, cy - r - 8, cx, cy - r - 11);
    ctx.quadraticCurveTo(cx + r - 1, cy - r - 8, cx + r + 5, rimY);
    ctx.quadraticCurveTo(cx, cy - r * 1.05, cx - r - 5, rimY);
    ctx.fill();
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - r - 4, rimY - 0.5);
    ctx.quadraticCurveTo(cx, cy - r * 1.05 - 1, cx + r + 4, rimY - 0.5);
    ctx.stroke();
    ctx.fillStyle = "#f7f1e6"; // skull
    ctx.beginPath();
    ctx.arc(cx, cy - r - 4, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#26222a";
    ctx.fillRect(cx - 1.5, cy - r - 4.6, 1.1, 1.1);
    ctx.fillRect(cx + 0.4, cy - r - 4.6, 1.1, 1.1);
  },

  // A viking helmet with horns.
  vikingHelmet(ctx, cx, cy, r) {
    // Horns first (behind the helmet): ivory with a darker outline and
    // shading, so they show up on any background.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (r - 2), cy - r * 0.5);
      ctx.quadraticCurveTo(cx + side * (r + 10), cy - r * 0.55, cx + side * (r + 7), cy - r - 9);
      ctx.quadraticCurveTo(cx + side * (r + 3), cy - r * 0.95, cx + side * (r - 3), cy - r * 0.95);
      ctx.closePath();
      const horn = ctx.createLinearGradient(cx + side * r, cy - r - 9, cx + side * r, cy - r * 0.5);
      horn.addColorStop(0, "#fdf8ee");
      horn.addColorStop(1, "#d9c7a0");
      ctx.fillStyle = horn;
      ctx.fill();
      ctx.strokeStyle = "#8a7550";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = "#8a8f96";
    ctx.beginPath();
    ctx.arc(cx, cy - 1, r + 1, Math.PI * 1.06, Math.PI * 1.94);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - r + 2, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6f75"; // the rim, with rivets
    ctx.fillRect(cx - r, cy - r * 0.5, r * 2, 3);
    ctx.fillStyle = "#c9ccd0";
    for (const dx of [-8, 0, 8]) ctx.fillRect(cx + dx - 0.6, cy - r * 0.5 + 0.8, 1.2, 1.2);
  },

  // A graduation cap with a swinging tassel.
  gradCap(ctx, cx, cy, r) {
    ctx.fillStyle = "#26222a";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r + 2, r - 2, 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath(); // the flat board, seen at an angle
    ctx.moveTo(cx - r - 4, cy - r - 2);
    ctx.lineTo(cx, cy - r - 7);
    ctx.lineTo(cx + r + 4, cy - r - 2);
    ctx.lineTo(cx, cy - r + 3);
    ctx.closePath();
    ctx.fill();
    const sway = Math.sin(performance.now() / 500) * 1.5;
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 2);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx + r + sway, cy - r + 7);
    ctx.stroke();
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(cx + r - 1 + sway, cy - r + 6, 2, 4);
  },

  // A floppy santa hat with a white trim and pompom.
  santaHat(ctx, cx, cy, r) {
    ctx.fillStyle = "#c0303a";
    ctx.beginPath();
    ctx.moveTo(cx - r + 1, cy - r * 0.45);
    ctx.quadraticCurveTo(cx - 2, cy - r - 16, cx + r + 6, cy - r - 4);
    ctx.lineTo(cx + r - 1, cy - r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7f3ec";
    roundRectPath(ctx, cx - r, cy - r * 0.6, r * 2, 5, 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r + 6, cy - r - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // A little sprout growing out of the top of your head.
  sproutHat(ctx, cx, cy, r) {
    ctx.strokeStyle = "#5a8a3a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 1);
    ctx.quadraticCurveTo(cx - 1, cy - r - 4, cx, cy - r - 7);
    ctx.stroke();
    const wiggle = Math.sin(performance.now() / 700) * 0.15;
    drawLeaf(ctx, cx, cy - r - 6, -1.1 + wiggle, 8, 3.5, "#7ac05a", null);
    drawLeaf(ctx, cx, cy - r - 6, 1.1 + wiggle, 8, 3.5, "#8fd06a", null);
  },

  // A sparkly silver tiara with gems.
  tiara(ctx, cx, cy, r) {
    ctx.fillStyle = "#dfe3e8";
    ctx.beginPath();
    ctx.moveTo(cx - r + 2, cy - r + 3);
    for (const [dx, dy] of [[-8, -4], [-5, -2], [-2, -7], [0, -3], [2, -7], [5, -2], [8, -4]]) ctx.lineTo(cx + dx, cy - r + dy);
    ctx.lineTo(cx + r - 2, cy - r + 3);
    ctx.quadraticCurveTo(cx, cy - r + 1, cx - r + 2, cy - r + 3);
    ctx.fill();
    ctx.fillStyle = "#e37aa0";
    ctx.beginPath();
    ctx.arc(cx, cy - r - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fb8e8";
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy - r + 0.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (Math.sin(performance.now() / 300) > 0.6) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx + 1.5, cy - r - 8, 1, 3);
      ctx.fillRect(cx + 0.5, cy - r - 7, 3, 1);
    }
  },

  // A wide straw sun hat with a ribbon.
  strawHat(ctx, cx, cy, r) {
    const brimY = cy - r * 0.6; // above the eyes
    ctx.fillStyle = "#e3c27a";
    ctx.beginPath();
    ctx.ellipse(cx, brimY, r + 8, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 110, 40, 0.3)";
    ctx.lineWidth = 0.6;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, brimY, r + 8 - k * 3, 3.6 - k * 0.8, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "#edd08e";
    ctx.beginPath();
    ctx.ellipse(cx, brimY - 1, r - 3, 7, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#e8607a";
    ctx.fillRect(cx - r + 3, brimY - 4, r * 2 - 6, 2.5);
  },
});

// Glasses, drawn over the face (eyes at cx ± 4, cy - 2).
const GLASSES_DRAWERS = {
  none: null,

  // Thick black square frames.
  squareFrames(ctx, cx, cy) {
    ctx.strokeStyle = "#22201e";
    ctx.lineWidth = 1.6;
    for (const ex of [cx - 4.4, cx + 4.4]) {
      roundRectPath(ctx, ex - 3.3, cy - 4.8, 6.6, 5.4, 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1.1, cy - 2.6);
    ctx.lineTo(cx + 1.1, cy - 2.6);
    ctx.stroke();
  },

  // Aviators: gold wire and dark teardrop lenses.
  aviators(ctx, cx, cy) {
    ctx.fillStyle = "rgba(40, 50, 60, 0.85)";
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 0.9;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 1.2, cy - 4.5);
      ctx.lineTo(cx + side * 7.8, cy - 4.5);
      ctx.quadraticCurveTo(cx + side * 8, cy + 1.5, cx + side * 4.5, cy + 1.2);
      ctx.quadraticCurveTo(cx + side * 1.2, cy + 1, cx + side * 1.2, cy - 4.5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1.2, cy - 4.5);
    ctx.lineTo(cx + 1.2, cy - 4.5);
    ctx.stroke();
  },

  // Round, rose-tinted lenses: everything looks cozier.
  roseGlasses(ctx, cx, cy) {
    ctx.fillStyle = "rgba(240, 140, 170, 0.45)";
    ctx.strokeStyle = "#d87a9a";
    ctx.lineWidth = 1;
    for (const ex of [cx - 4.2, cx + 4.2]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 2.5);
    ctx.lineTo(cx + 1, cy - 2.5);
    ctx.stroke();
  },

  roundGlasses(ctx, cx, cy) {
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.2;
    for (const ex of [cx - 4.2, cx + 4.2]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 2.5);
    ctx.lineTo(cx + 1, cy - 2.5);
    ctx.stroke();
  },

  sunglasses(ctx, cx, cy) {
    ctx.fillStyle = "#1e1c22";
    for (const ex of [cx - 4.4, cx + 4.4]) {
      roundRectPath(ctx, ex - 3.6, cy - 4.5, 7.2, 5, 2);
      ctx.fill();
    }
    ctx.fillRect(cx - 1, cy - 3.6, 2, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (const ex of [cx - 5.5, cx + 3.3]) ctx.fillRect(ex, cy - 3.8, 1.2, 2.5);
  },

  heartGlasses(ctx, cx, cy) {
    for (const ex of [cx - 4.4, cx + 4.4]) {
      ctx.fillStyle = "#f06a9a";
      ctx.beginPath();
      ctx.moveTo(ex, cy + 1.5);
      ctx.bezierCurveTo(ex - 5, cy - 1.5, ex - 3, cy - 6, ex, cy - 3.5);
      ctx.bezierCurveTo(ex + 3, cy - 6, ex + 5, cy - 1.5, ex, cy + 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(ex - 2, cy - 3.5, 1, 1.5);
    }
    ctx.fillStyle = "#f06a9a";
    ctx.fillRect(cx - 1, cy - 3, 2, 1);
  },

  starGlasses(ctx, cx, cy) {
    for (const ex of [cx - 4.6, cx + 4.6]) {
      ctx.fillStyle = "#f2c94c";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? 2 : 4.5, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(ex + Math.cos(a) * rr, cy - 2 + Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(90, 60, 20, 0.6)";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  monocle(ctx, cx, cy) {
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx + 4.2, cy - 2, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(200, 225, 240, 0.35)";
    ctx.fill();
    ctx.lineWidth = 0.7; // its little chain
    ctx.beginPath();
    ctx.moveTo(cx + 7.6, cy - 1);
    ctx.quadraticCurveTo(cx + 10, cy + 5, cx + 6, cy + 9);
    ctx.stroke();
  },

  glasses3d(ctx, cx, cy) {
    ctx.fillStyle = "#f7f3ec";
    roundRectPath(ctx, cx - 9, cy - 5, 18, 6, 1.5);
    ctx.fill();
    ctx.fillStyle = "rgba(230, 60, 70, 0.85)";
    ctx.fillRect(cx - 8, cy - 4, 6.5, 4);
    ctx.fillStyle = "rgba(60, 170, 230, 0.85)";
    ctx.fillRect(cx + 1.5, cy - 4, 6.5, 4);
  },

  catEyeGlasses(ctx, cx, cy) {
    ctx.fillStyle = "#26222a";
    for (const side of [-1, 1]) {
      const ex = cx + side * 4.4;
      ctx.beginPath();
      ctx.moveTo(ex - side * 3.5, cy - 1);
      ctx.quadraticCurveTo(ex - side * 3.5, cy - 4.5, ex, cy - 4.5);
      ctx.lineTo(ex + side * 5, cy - 6.5); // the flick at the corner
      ctx.quadraticCurveTo(ex + side * 4, cy + 0.5, ex, cy + 0.5);
      ctx.quadraticCurveTo(ex - side * 3.5, cy + 0.5, ex - side * 3.5, cy - 1);
      ctx.fill();
      ctx.fillStyle = "rgba(200, 225, 240, 0.55)";
      ctx.beginPath();
      ctx.ellipse(ex, cy - 2, 2.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#26222a";
    }
  },

  goggles(ctx, cx, cy) {
    ctx.strokeStyle = "#6b4630"; // the strap
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy - 2);
    ctx.lineTo(cx + 13, cy - 2);
    ctx.stroke();
    for (const ex of [cx - 4.5, cx + 4.5]) {
      ctx.fillStyle = "#b8904a";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(240, 180, 80, 0.8)";
      ctx.beginPath();
      ctx.arc(ex, cy - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(ex - 1.8, cy - 3.8, 1, 1.5);
    }
  },
};

Object.assign(SHOE_DRAWERS, {
  flipFlops(ctx, x, y) {
    ctx.fillStyle = "#6fc2d4";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 4.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 1);
    ctx.lineTo(x, y - 1.5);
    ctx.lineTo(x + 3, y + 1);
    ctx.stroke();
  },

  clogs(ctx, x, y) {
    ctx.fillStyle = "#c49a5c";
    roundRectPath(ctx, x - 4.5, y - 3, 9, 5.5, 2.5);
    ctx.fill();
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(x - 4.5, y + 1.3, 9, 1.4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x - 3, y - 2.3, 4, 1);
  },

  moonBoots(ctx, x, y) {
    ctx.fillStyle = "#e8e6ee";
    roundRectPath(ctx, x - 4.5, y - 7, 9, 10, 3.5);
    ctx.fill();
    ctx.fillStyle = "#b8b4c8";
    for (let k = 0; k < 3; k++) ctx.fillRect(x - 4.5, y - 5 + k * 2.6, 9, 0.8);
    ctx.fillStyle = "#8a86a0";
    ctx.fillRect(x - 4.5, y + 1.6, 9, 1.5);
  },

  rubySlippers(ctx, x, y) {
    ctx.fillStyle = "#c0203a";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const t = performance.now() / 200;
    ctx.fillStyle = "#ffd0d8";
    for (let k = 0; k < 3; k++) {
      if (Math.sin(t + k * 2.1 + x) > 0.3) ctx.fillRect(x - 3 + k * 2.5, y - 1.5 + (k % 2), 1, 1);
    }
    ctx.fillStyle = "#e84a60";
    ctx.beginPath();
    ctx.arc(x + 1, y - 1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  },

  hikingBoots(ctx, x, y) {
    ctx.fillStyle = "#8a5a3a";
    roundRectPath(ctx, x - 4, y - 6, 8, 8.5, 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a22"; // chunky sole
    ctx.fillRect(x - 4.6, y + 1.5, 9.2, 2);
    ctx.strokeStyle = "#e0b84c"; // laces
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x - 1.5, y - 4.5 + k * 2);
      ctx.lineTo(x + 1.5, y - 3.5 + k * 2);
      ctx.stroke();
    }
  },

  balletFlats(ctx, x, y) {
    ctx.fillStyle = "#f2b8c8";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(x - 1.8, y - 2.2, 1.6, 1.4);
    ctx.fillRect(x + 0.2, y - 2.2, 1.6, 1.4);
  },

  sockSandals(ctx, x, y) {
    ctx.fillStyle = "#f7f4ee"; // the socks
    roundRectPath(ctx, x - 3.4, y - 6, 6.8, 8, 2.5);
    ctx.fill();
    ctx.fillStyle = "#c0554a";
    ctx.fillRect(x - 3.4, y - 5.5, 6.8, 1.2);
    ctx.fillStyle = "#6b4630"; // sandal sole and straps
    ctx.fillRect(x - 4.4, y + 1.2, 8.8, 1.6);
    ctx.fillRect(x - 3.6, y - 1.5, 7.2, 1.3);
  },

  glowSneakers(ctx, x, y) {
    ctx.fillStyle = "#f7f4ee";
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const hue = (performance.now() / 8 + x * 10) % 360;
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.fillRect(x - 4.4, y + 1.4, 8.8, 1.6);
    ctx.fillStyle = "#5a5a66";
    ctx.fillRect(x - 3, y - 1, 6, 1.2);
  },
});

Object.assign(PET_DRAWERS, {
  // A round little owl with big eyes and ear tufts.
  owl(ctx, t, moving, blink) {
    const c = "#9a7456";
    petLegs(ctx, "#e0a84c", t, moving, [-2.5, 2.5]);
    petBlob(ctx, 0, -9, 7.5, 8.5, c);
    ctx.fillStyle = "#e8d7bf"; // belly
    ctx.beginPath();
    ctx.ellipse(0.5, -6, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, -4, -16, 3, 5, c, c);
    petEar(ctx, 4, -16, 3, 5, c, c);
    for (const ex of [-2.8, 2.8]) {
      ctx.fillStyle = "#fffaf3";
      ctx.beginPath();
      ctx.arc(ex, -12, 2.8, 0, Math.PI * 2);
      ctx.fill();
      petEye(ctx, ex, -12, blink, 1.5);
    }
    ctx.fillStyle = "#e0a84c";
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.lineTo(1, -10);
    ctx.lineTo(0, -8);
    ctx.fill();
    const flap = moving ? Math.sin(t * 16) * 0.3 : 0;
    ctx.fillStyle = shadeColor(c, -20);
    ctx.beginPath();
    ctx.ellipse(-7, -8, 2.2, 4.5, 0.2 + flap, 0, Math.PI * 2);
    ctx.fill();
  },

  // A pink axolotl with frilly gills and a sweet smile.
  axolotl(ctx, t, moving, blink) {
    const c = "#f4a6bd";
    ctx.strokeStyle = shadeColor(c, -10);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(-11, -6, -13, -4 + Math.sin(t * 5) * 1.5);
    ctx.stroke();
    petLegs(ctx, c, t, moving, [-4, -1, 2, 5]);
    petBlob(ctx, -1, -5, 7, 3.8, c);
    petBlob(ctx, 6, -8, 5, 4.2, c);
    ctx.strokeStyle = "#e0608a"; // gills
    ctx.lineWidth = 1.4;
    for (const [dx, dy, a] of [[3, -12, -2.2], [4.5, -13, -1.8], [6, -13.2, -1.3]]) {
      ctx.beginPath();
      ctx.moveTo(dx, dy + 2);
      ctx.lineTo(dx + Math.cos(a) * 4, dy + Math.sin(a) * 4);
      ctx.stroke();
    }
    petEye(ctx, 7.5, -9, blink, 1.1);
    ctx.strokeStyle = "#8a3a50";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(8.5, -7, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    petCheek(ctx, 10, -7.5);
  },

  // A calm capybara, with a little orange balanced on its head.
  capybara(ctx, t, moving, blink) {
    const c = "#a47a54";
    petLegs(ctx, c, t, moving);
    petBlob(ctx, -1, -6, 8.5, 5.5, c);
    ctx.fillStyle = c; // the blocky head
    roundRectPath(ctx, 3, -14, 9, 7, 3);
    ctx.fill();
    ctx.fillStyle = shadeColor(c, -20);
    ctx.fillRect(10, -11, 2, 2.5); // nose
    petEar(ctx, 4.5, -14, 2.5, 2.5, c, shadeColor(c, -20));
    ctx.strokeStyle = "#2b2b2b"; // half-closed, very relaxed eyes
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6.5, -11.5);
    ctx.lineTo(8.5, -11.5);
    ctx.stroke();
    ctx.fillStyle = "#f0a040"; // the orange
    ctx.beginPath();
    ctx.arc(6.5, -16.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a8a3a";
    ctx.fillRect(6.2, -19.5, 1, 1.5);
  },

  // A little turtle with a patterned shell.
  turtle(ctx, t, moving, blink) {
    const skin = "#8fb86a";
    petLegs(ctx, skin, t, moving, [-4, 4]);
    petBlob(ctx, 8, -5, 3.5, 3, skin); // head
    petEye(ctx, 9.5, -5.5, blink, 1);
    const shell = "#5f8a4a";
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, -5, 8, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shadeColor(shell, 25);
    for (const [x, y] of [[-3.5, -7], [0, -9], [3.5, -7], [0, -5.5]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shadeColor(shell, -25);
    ctx.fillRect(-8, -5.5, 16, 1.5);
  },

  // A tiny bat that flutters beside you instead of walking.
  bat(ctx, t, moving, blink) {
    const hover = Math.sin(t * 4) * 1.5 - 10;
    const flap = Math.sin(t * 18) * 0.5;
    ctx.save();
    ctx.translate(0, hover);
    ctx.fillStyle = "#4a3a52";
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(flap);
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(8, -8, 11, -3);
      ctx.quadraticCurveTo(9, -2, 8, 0);
      ctx.quadraticCurveTo(6, -1, 5, 1);
      ctx.quadraticCurveTo(3, 0, 2, 1);
      ctx.fill();
      ctx.restore();
    }
    petBlob(ctx, 0, -1, 3.8, 4, "#5a4a62");
    petEar(ctx, -2, -5, 2, 3, "#5a4a62", "#c8a0b8");
    petEar(ctx, 2, -5, 2, 3, "#5a4a62", "#c8a0b8");
    petEye(ctx, -1.3, -1.5, blink, 0.9);
    petEye(ctx, 1.3, -1.5, blink, 0.9);
    ctx.fillStyle = "#fffaf3"; // tiny fangs
    ctx.fillRect(-0.9, 0.8, 0.6, 1);
    ctx.fillRect(0.3, 0.8, 0.6, 1);
    ctx.restore();
  },

  // A round golden hamster with stuffed cheeks.
  hamster(ctx, t, moving, blink) {
    const c = "#e0a860";
    petLegs(ctx, "#f3c8b0", t, moving, [-2.5, 2.5]);
    petBlob(ctx, 0, -6, 7.5, 6, c);
    ctx.fillStyle = "#fbeede"; // white belly and cheeks
    ctx.beginPath();
    ctx.ellipse(2.5, -4, 4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5.5, -6.5, 2.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    petEar(ctx, -1.5, -11.5, 2.5, 2.5, c, "#f3b8b8");
    petEar(ctx, 3, -11.5, 2.5, 2.5, c, "#f3b8b8");
    petEye(ctx, 3.5, -8.5, blink, 1.1);
    ctx.fillStyle = "#e37aa0";
    ctx.fillRect(6.8, -8, 1, 0.8);
    petCheek(ctx, 5.5, -6);
  },

  // A slow, happy snail.
  snail(ctx, t, moving, blink) {
    const body = "#d9c4a0";
    const stretch = moving ? Math.sin(t * 6) * 0.8 : 0;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(1 + stretch, -1.5, 9 + stretch, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = body; // eye stalks
    ctx.lineWidth = 1;
    for (const dx of [7, 9]) {
      ctx.beginPath();
      ctx.moveTo(dx - 1, -3);
      ctx.lineTo(dx + 0.5, -9);
      ctx.stroke();
      petEye(ctx, dx + 0.5, -9.5, blink, 1);
    }
    ctx.fillStyle = "#c0785a"; // the shell
    ctx.beginPath();
    ctx.arc(-1, -7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a4a3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const rr = 5.2 - a * 0.32;
      ctx.lineTo(-1 + Math.cos(a) * rr, -7 + Math.sin(a) * rr);
    }
    ctx.stroke();
  },

  // A fluffy sheep: a little cloud on legs.
  sheep(ctx, t, moving, blink) {
    petLegs(ctx, "#3a3440", t, moving);
    ctx.fillStyle = "#f7f3ec";
    for (const [x, y, rr] of [[-5, -7, 4], [-1, -9, 4.5], [3, -8, 4], [-3, -4.5, 4], [2, -4.5, 4]]) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.beginPath();
    ctx.ellipse(-1, -4, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    petBlob(ctx, 7, -10, 3.5, 4, "#3a3440"); // face
    petEar(ctx, 5, -13, 2, 2.5, "#3a3440", "#3a3440");
    ctx.fillStyle = "#f7f3ec"; // a tuft of wool on top
    ctx.beginPath();
    ctx.arc(6.5, -13.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.beginPath();
    ctx.arc(8.3, -10.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    petEye(ctx, 8.3, -10.5, blink, 0.8);
  },
});

function drawPet(ctx, pet) {
  const drawer = Object.hasOwn(PET_DRAWERS, pet.kind) ? PET_DRAWERS[pet.kind] : null;
  if (!drawer) return;
  const at = toScreen(pet.x, pet.y);
  const t = performance.now() / 1000 + (pet.seed ?? 0); // so two pets don't blink in step
  const bob = pet.moving ? Math.abs(Math.sin(t * 14)) * 1.2 : 0;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(PET_SCALE, PET_SCALE);
  ctx.fillStyle = pet.kind === "ghost" ? "rgba(40, 25, 10, 0.12)" : "rgba(40, 25, 10, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -bob);
  ctx.scale(pet.facing < 0 ? -1 : 1, 1);
  drawer(ctx, t, pet.moving, t % 4.3 < 0.13);
  ctx.restore();
}

// Hearts floating up from a pet that was just petted (drawn with the name
// tags, so they're never hidden). `pet.petted` is seconds since petting.
function drawPetHearts(ctx, pet) {
  if (pet.petted === null || pet.petted === undefined || pet.petted > 1.6) return;
  const at = toScreen(pet.x, pet.y);
  ctx.save();
  ctx.textAlign = "center";
  for (let i = 0; i < 2; i++) {
    const tt = pet.petted - i * 0.35;
    if (tt <= 0 || tt >= 1.2) continue;
    ctx.globalAlpha = 1 - tt / 1.2;
    fxHeart(ctx, at.x + (i ? 6 : -5) + Math.sin(tt * 6) * 3, at.y - 36 - tt * 18, 10, i ? "#f08aa8" : "#e0506a");
  }
  ctx.restore();
}

// Draws a pet by itself, big, in a small canvas (for the shop).
function drawPetPreview(canvas, kind) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 16);
  ctx.scale(1.8, 1.8);
  const origin = toScreen(0, 0);
  ctx.translate(-origin.x, -origin.y);
  drawPet(ctx, { kind, x: 0, y: 0, facing: 1, moving: false });
  ctx.restore();
}

// --- The Exalted look (see CONFIG.exaltedNames and wardrobe.js) ---
// A look only certain accounts can wear, picked piece by piece in the
// wardrobe: a hooded crimson robe with glowing eyes, a slowly turning
// sigil circle on the floor, candles floating around them, and runes
// left glowing where they walk. p.aura is { robe, sigil, candles, runes }.

// A turning ring of runes on the floor, under their feet.
function drawSigil(ctx, x, y) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.38); // lying flat on the floor
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 30);
  glow.addColorStop(0, "rgba(200, 40, 70, 0.28)");
  glow.addColorStop(1, "rgba(200, 40, 70, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = "rgba(230, 70, 90, 0.75)";
  ctx.lineWidth = 1.4;
  for (const r of [24, 19]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); // a seven-pointed star inside
  for (let k = 0; k <= 7; k++) {
    const a = (k * 3 * Math.PI * 2) / 7;
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 200, 150, 0.8)"; // little runes around the ring
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(a) * 21.5, Math.sin(a) * 21.5);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillRect(-0.5, -1.8, 1, 3.6);
    ctx.fillRect(-1.6, k % 2 ? -1.8 : 0.6, 3.2, 0.9);
    ctx.restore();
  }
  ctx.restore();
}

// The candles floating around them: where each one is right now, and
// whether it's behind them (drawn first) or in front.
function candleSpots(cx, cy) {
  const t = performance.now() / 1000;
  return [0, 1, 2].map((k) => {
    const a = t * 0.9 + (k / 3) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 25, y: cy + 5 + Math.sin(a) * 6 + Math.sin(t * 2 + k) * 2, behind: Math.sin(a) < 0 }; // (low enough to pass below the face)
  });
}

function drawFloatingCandle(ctx, x, y) {
  const t = performance.now() / 1000;
  const glow = ctx.createRadialGradient(x, y - 9, 1, x, y - 9, 10);
  glow.addColorStop(0, "rgba(255, 210, 120, 0.55)");
  glow.addColorStop(1, "rgba(255, 210, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 9, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe4cf"; // the candle, with a drip
  ctx.fillRect(x - 2, y - 6, 4, 8);
  ctx.fillStyle = "#d8cbb2";
  ctx.fillRect(x + 1, y - 6, 1, 8);
  ctx.fillStyle = "#efe4cf";
  ctx.fillRect(x - 2.4, y - 6, 1.2, 3);
  const flick = Math.sin(t * 12 + x) * 0.6;
  ctx.fillStyle = "#ffb347"; // the flame
  ctx.beginPath();
  ctx.ellipse(x + flick * 0.4, y - 9, 1.6, 2.8 + flick * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath();
  ctx.ellipse(x + flick * 0.4, y - 8.4, 0.7, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A hooded crimson robe with gold trim over the body; inside the hood,
// shadow and two glowing eyes.
function drawRobe(ctx, cx, cy, r) {
  const robe = ctx.createLinearGradient(0, cy - r - 8, 0, cy + r + 4);
  robe.addColorStop(0, "#8a2438");
  robe.addColorStop(1, "#4a1020");
  ctx.fillStyle = robe;
  ctx.beginPath(); // the cloak, from the hood's point down to a flared hem
  ctx.moveTo(cx, cy - r - 8);
  ctx.quadraticCurveTo(cx + r + 2, cy - r + 2, cx + r + 1, cy + 2);
  ctx.lineTo(cx + r + 4, cy + r + 2);
  ctx.quadraticCurveTo(cx, cy + r + 6, cx - r - 4, cy + r + 2);
  ctx.lineTo(cx - r - 1, cy + 2);
  ctx.quadraticCurveTo(cx - r - 2, cy - r + 2, cx, cy - r - 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // lit from above
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - r - 1, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0a10"; // the dark opening of the hood
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d9a441"; // gold trim around the hood and down the front
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, r * 0.62 + 1, r * 0.55 + 1, 0, 0, Math.PI * 2);
  ctx.moveTo(cx, cy + r * 0.55);
  ctx.lineTo(cx, cy + r + 4);
  ctx.stroke();
  const t = performance.now() / 1000;
  ctx.fillStyle = `rgba(255, 207, 110, ${0.75 + Math.sin(t * 2) * 0.2})`; // glowing eyes
  for (const ex of [cx - 3.2, cx + 3.2]) {
    ctx.beginPath();
    ctx.ellipse(ex, cy - 2, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rune footsteps: little glowing marks left where they walk, fading away.
const runeMarks = []; // { x, y (grid, at their feet), born, glyph }
const lastRuneAt = {}; // player id -> where the last mark was dropped

function dropRuneMarks(players) {
  const now = performance.now();
  for (const p of players) {
    if (!p.aura?.runes || !p.moving || p.asleep) continue;
    const fx = p.x + PLAYER_SIZE / 2, fy = p.y + PLAYER_SIZE;
    const last = lastRuneAt[p.id];
    if (!last || Math.hypot(fx - last.x, fy - last.y) > 0.5) {
      runeMarks.push({ x: fx, y: fy, born: now, glyph: runeMarks.length % 4 });
      lastRuneAt[p.id] = { x: fx, y: fy };
    }
  }
  while (runeMarks.length && now - runeMarks[0].born > 1600) runeMarks.shift();
}

function drawRuneMarks(ctx) {
  const now = performance.now();
  for (const m of runeMarks) {
    if (floorOf(m.y) !== viewFloor) continue;
    const p = toScreen(m.x, m.y);
    const fade = 1 - (now - m.born) / 1600;
    ctx.save();
    ctx.translate(p.x, p.y - 2);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.strokeStyle = "#ff5a7a";
    ctx.shadowColor = "#ff5a7a";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (m.glyph === 0) { // a few simple rune shapes, taking turns
      ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(0, -2); ctx.lineTo(4, -6); ctx.moveTo(0, 2); ctx.lineTo(4, -2);
    } else if (m.glyph === 1) {
      ctx.moveTo(-4, 6); ctx.lineTo(0, -6); ctx.lineTo(4, 6); ctx.moveTo(-2, 1); ctx.lineTo(2, 1);
    } else if (m.glyph === 2) {
      ctx.moveTo(-4, -5); ctx.lineTo(4, 5); ctx.moveTo(4, -5); ctx.lineTo(-4, 5); ctx.moveTo(0, -6); ctx.lineTo(0, 6);
    } else {
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.moveTo(-4.5, 0); ctx.lineTo(4.5, 0);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Draws one player's body (used for yourself and everyone else): a soft
// shadow, two little feet, and a round body lit from above (lighter on
// top, darker underneath) like everything else, with their hat on top.
// While walking (p.moving), the body bobs and the feet take turns lifting.

// --- Accessories (Update 3): scarves, backpacks and earrings ---
// All drawn around the body at (cx, cy), radius r (see drawPlayerBody).
// Scarves wrap the lower part of the body, under the mouth; backpacks sit
// behind the body (peeking out at the sides), with little straps in
// front; earrings hang at the sides of the head, below headphones if
// you wear them. None of them reach above your head, so hats always fit.

// A soft band around the lower body, in `color`, with an optional pattern
// drawn inside it, and a tail hanging down one side.
function scarfBand(ctx, cx, cy, r, color, pattern = null, tail = true) {
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(cx - r + 0.5, cy + 5.5);
    ctx.quadraticCurveTo(cx, cy + 11.5, cx + r - 0.5, cy + 5.5);
    ctx.lineTo(cx + r - 2, cy + 10.5);
    ctx.quadraticCurveTo(cx, cy + 16.5, cx - r + 2, cy + 10.5);
    ctx.closePath();
  };
  if (tail) {
    ctx.fillStyle = shadeColor(color, -12);
    roundRectPath(ctx, cx + 3.5, cy + 10, 5.5, 10, 1.5);
    ctx.fill();
  }
  ctx.save();
  band();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  if (pattern) pattern();
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)"; // lit from above
  ctx.fillRect(cx - r, cy + 5, r * 2, 2.5);
  ctx.restore();
  band();
  ctx.strokeStyle = shadeColor(color, -40);
  ctx.lineWidth = 1;
  ctx.stroke();
}

const SCARF_DRAWERS = {
  none: null,
  // A red knit scarf with ribbed lines and a fringed tail.
  knitScarf(ctx, cx, cy, r) {
    scarfBand(ctx, cx, cy, r, "#c8423a", () => {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      for (let x = cx - r; x < cx + r; x += 3) {
        ctx.beginPath();
        ctx.moveTo(x, cy + 4);
        ctx.lineTo(x + 1, cy + 17);
        ctx.stroke();
      }
    });
    ctx.fillStyle = "#e07a6a";
    for (let k = 0; k < 4; k++) ctx.fillRect(cx + 3.8 + k * 1.4, cy + 20, 0.9, 2.2);
  },
  // Cream and teal stripes.
  stripedScarf(ctx, cx, cy, r) {
    scarfBand(ctx, cx, cy, r, "#f2ead8", () => {
      ctx.fillStyle = "#4f9a8a";
      for (let x = cx - r - 4; x < cx + r; x += 6) ctx.fillRect(x, cy + 3, 3, 16);
    });
    ctx.fillStyle = "#4f9a8a";
    ctx.fillRect(cx + 3.5, cy + 13, 5.5, 2);
    ctx.fillRect(cx + 3.5, cy + 17, 5.5, 2);
  },
  // Green tartan.
  plaidScarf(ctx, cx, cy, r) {
    scarfBand(ctx, cx, cy, r, "#3f7a4a", () => {
      ctx.fillStyle = "rgba(200, 60, 50, 0.55)";
      for (let x = cx - r; x < cx + r; x += 5) ctx.fillRect(x, cy + 3, 1.4, 16);
      ctx.fillRect(cx - r, cy + 9, r * 2, 1.4);
      ctx.fillStyle = "rgba(240, 210, 110, 0.5)";
      ctx.fillRect(cx - r, cy + 12, r * 2, 0.8);
    });
  },
  // A thick, chunky cream scarf, no tail, snug around the neck.
  chunkyScarf(ctx, cx, cy, r) {
    scarfBand(ctx, cx, cy, r, "#efe2c8", () => {
      ctx.fillStyle = "rgba(160, 130, 90, 0.25)";
      for (let x = cx - r; x < cx + r; x += 4.5) {
        ctx.beginPath();
        ctx.ellipse(x, cy + 10, 1.6, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, false);
  },
  // A blue bandana, tied with the point hanging down in front.
  bandana(ctx, cx, cy, r) {
    ctx.fillStyle = "#3f6fae";
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 7.5);
    ctx.quadraticCurveTo(cx, cy + 10.5, cx + 8, cy + 7.5);
    ctx.lineTo(cx, cy + 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2c4f80";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const [dx, dy] of [[-4, 9.5], [0, 11], [4, 9.5], [-1.5, 13.5], [1.5, 13.5]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // A fluffy pink feather boa: a chain of soft puffs.
  featherBoa(ctx, cx, cy, r) {
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const x = cx - r + 1 + t * (r * 2 - 2);
      const y = cy + 8 + Math.sin(t * Math.PI) * 4.5;
      ctx.fillStyle = k % 2 ? "#f29ac4" : "#e878b0";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k % 2 ? "#e878b0" : "#f29ac4";
      ctx.beginPath();
      ctx.arc(cx + 7 + k * 0.6, cy + 14 + k * 3, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Backpacks: `back` is drawn behind the body, `straps` in front of it.
// Someone sitting with their back to you shows the whole pack instead.
function packBox(ctx, x, y, w, h, color) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shadeColor(color, 20));
  g.addColorStop(1, shadeColor(color, -25));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -50);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function packStraps(ctx, cx, cy, color) {
  ctx.strokeStyle = shadeColor(color, -20);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 12.2, cy - 2);
    ctx.quadraticCurveTo(cx + side * 10.6, cy + 6, cx + side * 11.6, cy + 11);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

const BACKPACK_DRAWERS = {
  none: null,
  // A classic school backpack with a front pocket.
  schoolBag: {
    back(ctx, cx, cy) {
      packBox(ctx, cx - 16, cy - 8, 32, 21, "#d9825b");
      packBox(ctx, cx - 17.5, cy + 2, 6, 9, "#c46e48"); // side pockets
      packBox(ctx, cx + 11.5, cy + 2, 6, 9, "#c46e48");
    },
    straps: (ctx, cx, cy) => packStraps(ctx, cx, cy, "#b8603e"),
  },
  // A tall hiking pack with a rolled-up sleeping mat on top.
  hikingPack: {
    back(ctx, cx, cy) {
      packBox(ctx, cx - 15, cy - 5, 30, 18, "#4f7a5a");
      ctx.fillStyle = "#c9a45a"; // the rolled mat, poking out both sides
      roundRectPath(ctx, cx - 19, cy - 7, 38, 5.5, 2.75);
      ctx.fill();
      ctx.strokeStyle = "#8a6a34";
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    straps: (ctx, cx, cy) => packStraps(ctx, cx, cy, "#3a5a42"),
  },
  // A fluffy bunny backpack: long ears poke up over your shoulders.
  bunnyBag: {
    back(ctx, cx, cy) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#f4eee6";
        ctx.beginPath();
        ctx.ellipse(cx + side * 9, cy - 14, 3.2, 8, side * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f2b8c6";
        ctx.beginPath();
        ctx.ellipse(cx + side * 9, cy - 14, 1.5, 5.5, side * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      packBox(ctx, cx - 15.5, cy - 6, 31, 19, "#f4eee6");
    },
    straps: (ctx, cx, cy) => packStraps(ctx, cx, cy, "#f2b8c6"),
  },
  // A shiny jetpack with two tanks. Little flames puff out while walking.
  jetpack: {
    back(ctx, cx, cy, moving) {
      for (const side of [-1, 1]) {
        const x = cx + side * 13 - 4;
        packBox(ctx, x, cy - 8, 8, 20, "#b8c0c8");
        ctx.fillStyle = "#d8403a";
        ctx.fillRect(x, cy - 5, 8, 2);
        if (moving) {
          const flick = 3 + Math.sin(performance.now() / 50 + side) * 1.5;
          ctx.fillStyle = "#f2b84a";
          ctx.beginPath();
          ctx.moveTo(x + 1.5, cy + 12);
          ctx.lineTo(x + 6.5, cy + 12);
          ctx.lineTo(x + 4, cy + 12 + flick * 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    straps: (ctx, cx, cy) => packStraps(ctx, cx, cy, "#6a727a"),
  },
  // A guitar in its case, slung across your back.
  guitarCase: {
    back(ctx, cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.6);
      ctx.fillStyle = "#3a2c28";
      roundRectPath(ctx, -2.5, -30, 5, 24, 2); // the neck, over your shoulder
      ctx.fill();
      ctx.beginPath(); // the body
      ctx.ellipse(0, 6, 10, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(0, -6, 7.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(-3, -33, 6, 4); // tuning pegs
      ctx.restore();
    },
    straps(ctx, cx, cy) {
      ctx.strokeStyle = "#6b4a2e";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); // one strap, across the chest
      ctx.moveTo(cx - 12.5, cy + 2);
      ctx.quadraticCurveTo(cx - 4, cy + 12, cx + 10.5, cy + 10);
      ctx.stroke();
    },
  },
};

// Earrings hang at the sides of the head. `y` is where they hook on.
const EARRING_DRAWERS = {
  none: null,
  goldHoops(ctx, x, y) {
    ctx.strokeStyle = "#e0b040";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y + 3, 2.8, 0, Math.PI * 2);
    ctx.stroke();
  },
  pearlStuds(ctx, x, y) {
    ctx.fillStyle = "#fbf6ee";
    ctx.beginPath();
    ctx.arc(x, y + 1, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 100, 80, 0.5)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 0.9, y, 0.8, 0.8);
  },
  starDangles(ctx, x, y) {
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 3);
    ctx.stroke();
    ctx.fillStyle = "#f2c84a";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 === 0 ? 2.6 : 1.1;
      ctx.lineTo(x + Math.cos(a) * rr, y + 5 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  },
  cherryEarrings(ctx, x, y) {
    ctx.strokeStyle = "#4f7a3a";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y + 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.5, y + 4);
    ctx.stroke();
    ctx.fillStyle = "#d8303a";
    for (const dx of [-1.6, 1.6]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  featherEarrings(ctx, x, y) {
    ctx.fillStyle = "#5aa0a8";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2f5f66";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 9);
    ctx.stroke();
  },
};

// Hats that cover the ears: earrings hang just below them instead.
const EAR_COVERING_HATS = new Set(["headphones"]);

// --- Faces (the wardrobe's Face tab) ---
// Everyone picks eyes, a mouth, cheeks and freckles. Each style draws on
// a face centered at (cx, cy): eyes sit at cx ± 4, cy - 2, the mouth
// around cy + 2 to cy + 5. Emotes (laughing, sleepy, dancing...) still
// swap in their own eyes and mouth while they last.
// [id, name] lists, in the order the wardrobe shows them.
const FACE_EYE_STYLES = [["dot", "Classic"], ["sparkly", "Sparkly"], ["happy", "Happy"], ["sleepy", "Sleepy"], ["lashes", "Lashes"], ["wink", "Wink"], ["starry", "Starry"], ["hearts", "Lovestruck"]];
const FACE_MOUTH_STYLES = [["smile", "Classic"], ["grin", "Big grin"], ["cat", "Cat"], ["flat", "Calm"], ["surprised", "Oh!"], ["smirk", "Smirk"], ["silly", "Silly"], ["fang", "Fang"]];
const FACE_BLUSH_STYLES = [["soft", "Soft blush"], ["rosy", "Rosy"], ["none", "No blush"]];
const DEFAULT_FACE = { eyes: "dot", mouth: "smile", blush: "soft", freckles: false };

// A face as sent by a friend (or saved), with anything unknown swapped
// for the classic look, so a bad value can't break the drawing.
function cleanFace(face) {
  const pick = (list, v, fallback) => (list.some(([id]) => id === v) ? v : fallback);
  if (!face || typeof face !== "object") return DEFAULT_FACE;
  return {
    eyes: pick(FACE_EYE_STYLES, face.eyes, "dot"),
    mouth: pick(FACE_MOUTH_STYLES, face.mouth, "smile"),
    blush: pick(FACE_BLUSH_STYLES, face.blush, "soft"),
    freckles: face.freckles === true,
  };
}

// A tiny heart centered at (x, y), `s` pixels across.
function heartPath(ctx, x, y, s) {
  const h = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.9);
  ctx.bezierCurveTo(x - h * 1.3, y, x - h * 0.9, y - h * 1.1, x, y - h * 0.35);
  ctx.bezierCurveTo(x + h * 0.9, y - h * 1.1, x + h * 1.3, y, x, y + h * 0.9);
  ctx.closePath();
}

const FACE_EYES = {
  // Two little dots (the original look).
  dot(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  },
  // Big round eyes with a white shine, like a cartoon.
  sparkly(ctx, cx, cy) {
    for (const ex of [cx - 4.5, cx + 4.5]) {
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.ellipse(ex, cy - 2, 2.4, 2.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex + 0.8, cy - 3.2, 0.95, 0, Math.PI * 2);
      ctx.arc(ex - 0.8, cy - 1, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2b2b2b";
  },
  // Always-smiling eyes, like ^ ^.
  happy(ctx, cx, cy) {
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 1, 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  },
  // Relaxed, half-closed eyes: a dot under a heavy lid.
  sleepy(ctx, cx, cy) {
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 1.4, 1.5, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, cy - 1.8);
      ctx.lineTo(ex + 2.4, cy - 1.8);
      ctx.stroke();
    }
  },
  // Dots with two little lashes flicking out on each side.
  lashes(ctx, cx, cy) {
    FACE_EYES.dot(ctx, cx, cy);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const ex = cx + side * 4;
      ctx.moveTo(ex + side * 1.3, cy - 3.2);
      ctx.lineTo(ex + side * 3, cy - 4.6);
      ctx.moveTo(ex + side * 1.6, cy - 2.2);
      ctx.lineTo(ex + side * 3.4, cy - 2.8);
    }
    ctx.stroke();
    ctx.lineWidth = 1.5;
  },
  // One eye open, one eye winking.
  wink(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 2.6);
    ctx.lineTo(cx + 5.5, cy - 1.6);
    ctx.lineTo(cx + 2, cy - 0.6);
    ctx.stroke();
  },
  // Little four-pointed stars.
  starry(ctx, cx, cy) {
    for (const ex of [cx - 4.2, cx + 4.2]) {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 === 0 ? 3 : 1;
        ctx.lineTo(ex + Math.cos(a) * rr, cy - 2 + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  },
  // Tiny red hearts.
  hearts(ctx, cx, cy) {
    ctx.fillStyle = "#e8405a";
    ctx.lineWidth = 0.8;
    for (const ex of [cx - 4.3, cx + 4.3]) {
      heartPath(ctx, ex, cy - 2, 5);
      ctx.fill();
      ctx.stroke(); // a thin dark edge, so they show on any color
    }
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#2b2b2b";
  },
};

const FACE_MOUTHS = {
  // A small, gentle smile (the original look).
  smile(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  },
  // A wide open grin with a pink tongue.
  grin(ctx, cx, cy) {
    ctx.fillStyle = "#6b2a2a";
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 2.2);
    ctx.quadraticCurveTo(cx, cy + 2.8, cx + 4, cy + 2.2);
    ctx.quadraticCurveTo(cx + 3.6, cy + 7.4, cx, cy + 7.4);
    ctx.quadraticCurveTo(cx - 3.6, cy + 7.4, cx - 4, cy + 2.2);
    ctx.fill();
    ctx.fillStyle = "#e88a8a";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6.2, 2, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
  },
  // A cat mouth, like :3.
  cat(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx - 1.6, cy + 3, 1.6, 0.1 * Math.PI, 0.95 * Math.PI);
    ctx.moveTo(cx + 3.2, cy + 3.2);
    ctx.arc(cx + 1.6, cy + 3, 1.6, 0.05 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  },
  // A calm straight line.
  flat(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, cy + 4);
    ctx.lineTo(cx + 2.5, cy + 4);
    ctx.stroke();
  },
  // A little round "oh!".
  surprised(ctx, cx, cy) {
    ctx.fillStyle = "#6b2a2a";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4.2, 1.7, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
  },
  // A lopsided smile, pulled up on one side.
  smirk(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, cy + 4.2);
    ctx.quadraticCurveTo(cx + 1, cy + 5, cx + 3.5, cy + 2.6);
    ctx.stroke();
  },
  // A smile with the tongue poking out.
  silly(ctx, cx, cy) {
    ctx.fillStyle = "#e0707a";
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 5.2, 1.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    FACE_MOUTHS.smile(ctx, cx, cy);
  },
  // A smile with one little white fang.
  fang(ctx, cx, cy) {
    FACE_MOUTHS.smile(ctx, cx, cy);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx + 0.4, cy + 4.6);
    ctx.lineTo(cx + 2.4, cy + 4.3);
    ctx.lineTo(cx + 1.5, cy + 6.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#2b2b2b";
  },
};

// Cheeks and freckles. How strong each blush is lives in config.js
// (CONFIG.faces), so it's easy to make softer or stronger.
function drawCheeks(ctx, cx, cy, face) {
  const strength = CONFIG.faces?.blush?.[face.blush] ?? { none: 0, soft: 0.35, rosy: 0.6 }[face.blush] ?? 0.35;
  if (strength > 0) {
    ctx.fillStyle = `rgba(240, 120, 120, ${strength})`;
    ctx.beginPath();
    ctx.ellipse(cx - 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 7, cy + 2, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (face.freckles) {
    ctx.fillStyle = CONFIG.faces?.freckleColor ?? "rgba(95, 50, 25, 0.7)";
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (const [fx, fy] of [[5.6, 0.4], [7.6, 1], [6.4, 2.4], [8.6, 2.6]]) {
        ctx.moveTo(cx + side * fx + 0.7, cy + fy);
        ctx.arc(cx + side * fx, cy + fy, 0.7, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
  ctx.fillStyle = "#2b2b2b";
}

// Someone asleep in a bed that's turned to face a side wall lies along
// it: the whole character is turned on its side around their head, so
// the head rests on the pillow by the headboard and the blanket runs
// toward the foot of the bed. Everyone else is drawn standing up.
function drawPlayerBody(ctx, p) {
  const facing = p.asleep?.facing;
  if (facing !== "left" && facing !== "right") return drawUprightBody(ctx, p);
  const foot = playerFeet(p);
  const head = { x: foot.x, y: foot.y - PLAYER_RADIUS - 5 };
  ctx.save();
  ctx.translate(head.x, head.y);
  // A bed facing left has its headboard on the right, so the body points left (and the other way round).
  ctx.rotate(facing === "left" ? Math.PI / 2 : -Math.PI / 2);
  ctx.translate(-head.x, -head.y);
  drawUprightBody(ctx, p);
  ctx.restore();
}

function drawUprightBody(ctx, p) {
  const foot = playerFeet(p);
  const r = PLAYER_RADIUS;
  const emote = p.emote?.id, et = p.emote?.t ?? 0; // which emote, and seconds since it started
  let step = p.moving ? Math.sin(performance.now() / 1000 * 12) : 0;
  let bob = Math.abs(step) * 2.5;
  let sway = 0, tilt = 0, kick = 0;
  if (emote === "jig") {
    // Hitting the jig: big bouncy hops, swaying side to side, feet kicking out.
    step = Math.sin(et * 9);
    bob = Math.abs(step) * 6;
    sway = Math.sin(et * 4.5) * 4;
    kick = 3.5;
  } else if (emote === "headbang") {
    // Headbanging to trap or dubstep: a hard nod forward on every beat
    // (140 BPM), sinking into it, feet planted.
    const hit = Math.pow(Math.abs(Math.sin(et * Math.PI * (140 / 60))), 4);
    step = 0;
    bob = -hit * 3;
    tilt = hit * 0.18;
  } else if (emote === "glitch") {
    // Glitching to breakcore: jumpy, twitchy jitter that jumps every 60ms.
    const n = Math.floor(et * 16);
    sway = (noise(n * 1.7) - 0.5) * 7;
    bob = noise(n * 2.3 + 5) * 5;
    tilt = (noise(n * 3.1 + 9) - 0.5) * 0.25;
    step = noise(n) > 0.5 ? 1 : -1;
  } else if (emote === "sway") {
    // Swaying to ambient: floating slowly up and down, drifting side to side.
    step = 0;
    sway = Math.sin(et * 1.3) * 4;
    bob = (Math.sin(et * 2.6) + 1) * 2.5;
    tilt = Math.sin(et * 1.3) * 0.07;
  } else if (p.whisper) {
    tilt = p.whisper.dir * 0.2; // leaning in toward the person they're whispering to
  } else if (DANCE_MOVES[emote]) {
    ({ step, bob, sway, tilt, kick } = { step: 0, bob: 0, sway: 0, tilt: 0, kick: 0, ...DANCE_MOVES[emote](et) });
  } else if (emote === "wave") {
    tilt = Math.sin(et * 8) * 0.12; // rocking side to side while waving
  } else if (emote === "laugh") {
    sway = Math.sin(et * 40) * 1.5; // shaking with laughter
  } else if (emote === "sleepy") {
    bob = (Math.sin(et * 1.5) + 1) * 0.8; // slow, sleepy breathing
  }
  const cx = foot.x + sway;
  // Sitting (p.seated is the way they face): lower, feet tucked, and
  // facing the way the seat does.
  const seated = p.seated;
  const speaking = p.speaking && !p.whisper && !p.asleep;
  const speechBob = speaking ? Math.abs(Math.sin((performance.now() / 1000) * 9)) * 2 : 0; // bouncing gently while talking
  const cy = foot.y - r - 5 - bob - speechBob - (p.seatLift ?? 0); // (sitting, you're up on the seat's surface: see SEATS in world.js)

  // Talking (p.speaking, while their mic hears them): a soft glow behind
  // them and a gentle bounce. (Not while whispering: that has its own look.)
  if (speaking) {
    const glow = ctx.createRadialGradient(cx, cy, PLAYER_RADIUS * 0.6, cx, cy, PLAYER_RADIUS * 1.9);
    glow.addColorStop(0, "rgba(255, 245, 200, 0.55)");
    glow.addColorStop(1, "rgba(255, 245, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_RADIUS * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // The Exalted look's sigil circle (on the floor) and any floating
  // candles that are behind them right now.
  const aura = p.asleep ? null : p.aura;
  if (aura?.sigil) drawSigil(ctx, foot.x, foot.y);
  const candles = aura?.candles ? candleSpots(cx, cy) : [];
  for (const c of candles) if (c.behind) drawFloatingCandle(ctx, c.x, c.y);

  // (Someone asleep is tucked into bed: no shadow or feet, and a blanket
  // over their lower half, drawn further down.)
  if (!p.asleep) {
    ctx.fillStyle = "rgba(40, 25, 10, 0.25)";
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y, r * 0.85 - bob * 0.6, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Feet, peeking out under the body (or shoes, if they're wearing some).
  const shoe = Object.hasOwn(SHOE_DRAWERS, p.shoes) ? SHOE_DRAWERS[p.shoes] : null;
  const liftSize = emote === "jig" ? 6 : 3;
  const facingAway = seated === "up" || seated === "upTall";
  const feet = p.asleep || facingAway ? [] : seated ? [[-1, 0], [1, 0]] : [[-1, Math.max(0, step) * liftSize], [1, Math.max(0, -step) * liftSize]];
  for (const [side, lift] of feet) {
    let fx = foot.x + side * (5.5 + (lift > 0 ? kick : 0)), fy = foot.y - 2.5 - lift;
    if (seated === "down") fy = foot.y + 0.5; // feet out in front
    if (seated === "left" || seated === "right") {
      fx = foot.x + (seated === "right" ? 7 : -7) + side * 2.5; // pointing the way they face
      fy = foot.y - 1 + side;
    }
    if (shoe) {
      shoe(ctx, fx, fy, side);
    } else {
      ctx.fillStyle = shadeColor(p.color, -70);
      ctx.beginPath();
      ctx.ellipse(fx, fy, 4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  if (tilt) {
    ctx.translate(foot.x, foot.y);
    ctx.rotate(tilt);
    ctx.translate(-foot.x, -foot.y);
  }

  // A backpack sits behind the body (unless they're tucked into bed, or
  // under the Exalted robe). Facing away, it's drawn in front instead.
  const pack = !p.asleep && !aura?.robe && Object.hasOwn(BACKPACK_DRAWERS, p.backpack) ? BACKPACK_DRAWERS[p.backpack] : null;
  if (pack && !facingAway) pack.back(ctx, cx, cy, p.moving);

  const body = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  body.addColorStop(0, shadeColor(p.color, 35));
  body.addColorStop(1, shadeColor(p.color, -30));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(p.color, -50);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sitting facing away shows the back of the head; facing sideways moves
  // the face that way.
  const faceShift = seated === "left" ? -3.5 : seated === "right" ? 3.5 : 0;
  if (facingAway) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r - 3, 0, Math.PI);
    ctx.fill();
  }
  // Backpack straps, then the scarf wrapped over them (the robe hides both).
  if (pack) (facingAway ? pack.back(ctx, cx, cy + 3, p.moving) : pack.straps(ctx, cx, cy));
  if (!aura?.robe && Object.hasOwn(SCARF_DRAWERS, p.scarf) && SCARF_DRAWERS[p.scarf]) SCARF_DRAWERS[p.scarf](ctx, cx, cy, r);
  ctx.save();
  ctx.translate(faceShift, 0);
  if (facingAway) ctx.globalAlpha = 0; // (the face is on the other side)
  // Face: eyes, rosy cheeks and a mouth, which change with some emotes.
  // (When no emote is changing them, they're the ones picked in the
  // wardrobe's Face tab.)
  const face = cleanFace(p.face);
  ctx.strokeStyle = "#2b2b2b";
  ctx.fillStyle = "#2b2b2b";
  ctx.lineWidth = 1.5;
  if (emote === "idleYawn") {
    // A big yawn: eyes squeezed shut, mouth opening wide and closing.
    const open = Math.sin(Math.min(1, et / 2.8) * Math.PI);
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 3, 2, Math.PI * 0.15, Math.PI * 0.85); // closed, relaxed eyes
      ctx.stroke();
    }
    ctx.fillStyle = "#6b2a2a";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3.5, 2 + open * 1.5, 1 + open * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === "idleLook") {
    // Looking around: eyes glancing one way, then the other.
    const look = Math.sin(et * 2) * 2.5;
    ctx.beginPath();
    ctx.arc(cx - 4 + look, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 4 + look, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (emote === "sleepy" || emote === "sway" || emote === "idleSeated") {
    // Closed eyes: sleepy, lost in the music, or resting in a seat.
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 1.5);
    ctx.lineTo(cx - 2, cy - 1.5);
    ctx.moveTo(cx + 2, cy - 1.5);
    ctx.lineTo(cx + 6, cy - 1.5);
    ctx.stroke();
  } else if (emote === "laugh" || emote === "jig" || emote === "headbang" || emote === "glitch" || emote === "idleStretch" || HAPPY_DANCES.has(emote)) {
    // Happy squinting eyes, like ^ ^.
    for (const ex of [cx - 4, cx + 4]) {
      ctx.beginPath();
      ctx.arc(ex, cy - 1, 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else if (p.typing && !emote) {
    // Thinking while typing: eyes glancing up and to the side, and one
    // eyebrow raised.
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 2.5, cy - 7.5);
    ctx.quadraticCurveTo(cx + 5, cy - 9, cx + 7.5, cy - 7.5);
    ctx.stroke();
  } else {
    // Their own eyes, picked in the wardrobe's Face tab (see FACE_EYES).
    (FACE_EYES[face.eyes] ?? FACE_EYES.dot)(ctx, cx, cy);
  }
  // Cheeks (soft, rosy or none) and freckles, from the Face tab too.
  drawCheeks(ctx, cx, cy, face);
  if (emote === "idleYawn") {
    // (the yawning mouth is drawn with the eyes)
  } else if (emote === "laugh") {
    ctx.fillStyle = "#6b2a2a"; // wide open laughing mouth
    ctx.beginPath();
    ctx.arc(cx, cy + 2.5, 3.5, 0, Math.PI);
    ctx.fill();
  } else if (p.typing && !emote) {
    ctx.beginPath(); // a small "hmm" mouth
    ctx.moveTo(cx - 1.5, cy + 4);
    ctx.lineTo(cx + 2.5, cy + 3.3);
    ctx.stroke();
  } else {
    (FACE_MOUTHS[face.mouth] ?? FACE_MOUTHS.smile)(ctx, cx, cy);
  }

  // Glasses go on the face (a robe's hood hides them).
  if (!aura?.robe && Object.hasOwn(GLASSES_DRAWERS, p.glasses) && GLASSES_DRAWERS[p.glasses]) GLASSES_DRAWERS[p.glasses](ctx, cx, cy);
  ctx.restore();
  // A robe's hood takes the place of a hat. (On a full moon night, tiny
  // wolf ears poke up under the hat: render-night.js.)
  if (aura?.robe) drawRobe(ctx, cx, cy, r);
  else {
    if (moonEars()) drawWolfEars(ctx, cx, cy, r);
    (Object.hasOwn(HAT_DRAWERS, p.hat) ? HAT_DRAWERS[p.hat] : HAT_DRAWERS.none)(ctx, cx, cy, r);
  }
  // Earrings, at the sides of the head (after the hat, so a hat never
  // hides them; under headphones they hang just below the ear cups).
  if (!aura?.robe && Object.hasOwn(EARRING_DRAWERS, p.earrings) && EARRING_DRAWERS[p.earrings]) {
    const hookY = cy + (EAR_COVERING_HATS.has(p.hat) ? 6 : 2);
    for (const side of [-1, 1]) EARRING_DRAWERS[p.earrings](ctx, cx + side * (r - 0.5) + faceShift * 0.3, hookY);
  }
  for (const c of candles) if (!c.behind) drawFloatingCandle(ctx, c.x, c.y);

  if (p.asleep) {
    // Tucked in: the bed's blanket pulled up over their lower half.
    const blanket = ctx.createLinearGradient(0, cy + 2, 0, foot.y + 4);
    blanket.addColorStop(0, shadeColor(p.asleep.color, 30));
    blanket.addColorStop(1, shadeColor(p.asleep.color, -10));
    ctx.fillStyle = blanket;
    roundRectPath(ctx, cx - r - 6, cy + 2, r * 2 + 12, foot.y + 4 - cy - 2, 5);
    ctx.fill();
    ctx.fillStyle = shadeColor(p.asleep.color, 55); // the folded-back cuff
    ctx.fillRect(cx - r - 6, cy + 2, r * 2 + 12, 5);
  }

  if (p.typing && !emote) {
    // A little hand resting thoughtfully on the chin.
    ctx.fillStyle = shadeColor(p.color, 20);
    ctx.strokeStyle = shadeColor(p.color, -50);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy + r - 2.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (emote === "wave") {
    // A little waving hand beside the body.
    ctx.fillStyle = shadeColor(p.color, 20);
    ctx.strokeStyle = shadeColor(p.color, -50);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + r + 2, cy - 5 + Math.sin(et * 14) * 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Someone whispering: a little curl of air and a "psst" by their head, on
// the side of the person they're whispering to. Everyone can see a whisper
// is happening; only that one person hears it.
function drawWhisperSwirl(ctx, cx, headTop, dir) {
  const t = performance.now() / 1000;
  const x = cx + dir * 17, y = headTop + 20;
  ctx.save();
  ctx.strokeStyle = "rgba(120, 140, 170, 0.75)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 3; a += 0.25) {
    const rr = 1 + a * 1.1;
    ctx.lineTo(x + dir * Math.cos(a + t * 3) * rr, y + Math.sin(a + t * 3) * rr * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(90, 105, 135, 0.9)";
  ctx.font = "italic 700 9px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
  ctx.fillText("psst", x + dir * 6, y - 10);
  ctx.restore();
}

// How long each emote lasts, in seconds (walking stops one early).
const EMOTE_LENGTHS = {
  wave: 2.5, heart: 3, laugh: 3, sleepy: 5,
  jig: 6, headbang: 6, glitch: 5, sway: 6.5,
  idleStretch: 2.6, idleYawn: 2.8, idleLook: 3.2, idleSeated: 3.5, // idle animations (not picked by you)
  disco: 6, rave: 6, boombap: 6, mosh: 5, pop: 6, twostep: 6, reggaeton: 6, swing: 5, synthwave: 7,
};

// How each of the newer dances moves: given seconds since it started,
// the body's hop (bob), side-to-side (sway), lean (tilt) and feet (step,
// kick). Each is timed to its music's tempo.
const beats = (t, bpm) => t * (bpm / 60);
const DANCE_MOVES = {
  // Idle animations (they share this table with the dances).
  idleStretch: (t) => { const up = Math.sin(Math.min(1, t / 2.6) * Math.PI); return { bob: up * 5, tilt: Math.sin(t * 5) * 0.04 * up }; },
  idleYawn: (t) => ({ tilt: -Math.sin(Math.min(1, t / 2.8) * Math.PI) * 0.08 }),
  idleLook: () => ({}),
  idleSeated: (t) => ({ bob: (Math.sin(t * 1.8) + 1) * 0.8 }),
  disco: (t) => { const b = beats(t, 118); return { sway: Math.sin(b * Math.PI) * 5, bob: Math.abs(Math.sin(b * Math.PI * 2)) * 3, tilt: Math.sin(b * Math.PI) * 0.1, step: Math.sin(b * Math.PI * 2) }; },
  rave: (t) => { const b = beats(t, 128); return { bob: Math.pow(Math.abs(Math.sin(b * Math.PI)), 2) * 7, step: Math.sin(b * Math.PI * 2), kick: 2 }; },
  boombap: (t) => { const b = beats(t, 90); return { sway: 2, bob: Math.abs(Math.sin(b * Math.PI)) * 2, tilt: 0.06 + Math.pow(Math.abs(Math.sin(b * Math.PI)), 3) * 0.12 }; },
  mosh: (t) => { const b = beats(t, 180), n = Math.floor(t * 12); return { sway: (noise(n * 1.3) - 0.5) * 9, bob: Math.abs(Math.sin(b * Math.PI)) * 8, tilt: (noise(n * 2.7) - 0.5) * 0.4, step: Math.sin(b * Math.PI * 2), kick: 3 }; },
  pop: (t) => { const b = beats(t, 120); return { bob: Math.abs(Math.sin(b * Math.PI)) * 6, sway: Math.sin(b * Math.PI / 2) * 2, tilt: Math.sin(b * Math.PI / 2) * 0.08, step: Math.sin(b * Math.PI * 2) }; },
  twostep: (t) => { const b = beats(t, 100); return { sway: Math.sin(b * Math.PI / 2) * 7, bob: Math.abs(Math.sin(b * Math.PI)) * 2, step: Math.sin(b * Math.PI), kick: 2 }; },
  reggaeton: (t) => { const b = beats(t, 95); return { sway: Math.sin(b * Math.PI * 2) * 3, tilt: Math.sin(b * Math.PI * 2) * 0.14, bob: Math.abs(Math.sin(b * Math.PI * 2)) * 1.5 }; },
  swing: (t) => { const b = beats(t, 160); return { bob: Math.abs(Math.sin(b * Math.PI)) * 5, tilt: Math.sin(b * Math.PI) * 0.1, step: Math.sin(b * Math.PI), kick: 3 }; },
  synthwave: (t) => { const b = beats(t, 100); return { sway: Math.sin(b * Math.PI / 2) * 3, tilt: Math.sin(b * Math.PI / 2) * 0.08, bob: 1 }; },
};
// Dances with the happy squinting eyes (the rest keep a cool open look).
const HAPPY_DANCES = new Set(["disco", "rave", "mosh", "pop", "twostep", "reggaeton", "swing"]);

// The little things floating above someone doing an emote: hearts, notes,
// --- Little drawn effects (no emoji): hearts, a waving hand, lightning,
// a speaker, a microphone, a cowboy hat, flames and a saxophone, each
// centered on x, y and about `size` pixels tall, lit from above.
function fxHeart(ctx, x, y, size, color = "#e0506a") {
  const k = size / 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-7, 0, -7, -6, -3, -6);
  ctx.bezierCurveTo(-1, -6, 0, -4, 0, -3);
  ctx.bezierCurveTo(0, -4, 1, -6, 3, -6);
  ctx.bezierCurveTo(7, -6, 7, 0, 0, 5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -60);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.ellipse(-3, -3.2, 1.4, 0.9, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function fxHand(ctx, x, y, size, tilt = 0) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(k, k);
  ctx.fillStyle = "#f2c9a0";
  ctx.strokeStyle = "#b8845a";
  ctx.lineWidth = 1;
  for (const [fx, len] of [[-4.5, 7], [-1.5, 9], [1.5, 9], [4.5, 7.5]]) {
    ctx.beginPath();
    ctx.roundRect(fx - 1.4, -4 - len, 2.8, len + 2, 1.4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(6.5, 1, 1.6, 4, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-6, -5, 12, 11, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(-4, -4, 5, 1.5);
  ctx.restore();
}
function fxBolt(ctx, x, y, size, color = "#f2c94e") {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(2, -8);
  ctx.lineTo(-5, 1);
  ctx.lineTo(-0.5, 1);
  ctx.lineTo(-3, 8);
  ctx.lineTo(5, -2);
  ctx.lineTo(0.5, -2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeColor(color, -80);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
function fxSpeaker(ctx, x, y, size) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.roundRect(-5, -7, 10, 14, 2);
  ctx.fillStyle = "#4a4458";
  ctx.fill();
  for (const [cy, r] of [[-3.2, 2], [2.4, 3.2]]) {
    ctx.beginPath();
    ctx.arc(0, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#8a82a0";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, cy, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2434";
    ctx.fill();
  }
  ctx.restore();
}
function fxMic(ctx, x, y, size) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.35);
  ctx.scale(k, k);
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(-1.6, -1, 3.2, 9);
  ctx.beginPath();
  ctx.arc(0, -4, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = "#b8bec6";
  ctx.fill();
  ctx.strokeStyle = "#6a7078";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3.6, -4);
  ctx.lineTo(3.6, -4);
  ctx.moveTo(0, -8);
  ctx.lineTo(0, -0.2);
  ctx.stroke();
  ctx.restore();
}
function fxCowboyHat(ctx, x, y, size) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = "#a0703e";
  ctx.strokeStyle = "#6a4424";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.quadraticCurveTo(0, 7, 9, 2);
  ctx.quadraticCurveTo(0, 4, -9, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.lineTo(-4, -5);
  ctx.quadraticCurveTo(0, -3, 4, -5);
  ctx.lineTo(5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6a4424";
  ctx.fillRect(-4.8, 0, 9.6, 1.6);
  ctx.restore();
}
function fxFlame(ctx, x, y, size) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-7, 7, -7, -1, -2, -8);
  ctx.bezierCurveTo(-2, -3, 1, -3, 1, -5);
  ctx.bezierCurveTo(6, -1, 7, 7, 0, 8);
  ctx.fillStyle = "#f07a2a";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-3.5, 6, -3, 1, 0, -2);
  ctx.bezierCurveTo(3, 1, 3.5, 6, 0, 7);
  ctx.fillStyle = "#f8d25a";
  ctx.fill();
  ctx.restore();
}
function fxSax(ctx, x, y, size) {
  const k = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = "#c9962e";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(-1, 3);
  ctx.quadraticCurveTo(0, 8, 4, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(4.5, 3.5, 2.8, 1.6, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "#e8b84a";
  ctx.fill();
  ctx.strokeStyle = "#8a6420";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#8a6420";
  for (const dy of [-4, -1, 2]) {
    ctx.beginPath();
    ctx.arc(-1.5, dy, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(-3.2, -10, 2.2, 2.4);
  ctx.restore();
}

// A dance style's little picture for the wardrobe (no emoji), drawn in a
// 24 by 24 box.
function drawDanceIcon(ctx, id) {
  const note = (x, y, color, glyph = "♫") => {
    ctx.fillStyle = color;
    ctx.font = "700 14px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(glyph, x, y);
  };
  if (id === "jig") {
    note(8, 17, "#c0554a");
    note(17, 12, "#3f6f9f", "♪");
  } else if (id === "headbang") fxSpeaker(ctx, 12, 12, 18);
  else if (id === "glitch") {
    const blocks = [[3, 5, 9, 3, "#00d8f0"], [11, 10, 10, 3, "#ff28c8"], [5, 15, 7, 3, "#ff28c8"], [13, 18, 8, 2.5, "#00d8f0"]];
    for (const [x, y, w, h, c] of blocks) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    }
  } else if (id === "sway") {
    for (const [x, y, c] of [[8, 14, "170, 200, 255"], [15, 9, "220, 180, 255"], [16, 17, "180, 240, 220"]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
      g.addColorStop(0, `rgba(${c}, 1)`);
      g.addColorStop(1, `rgba(${c}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === "disco") {
    ctx.strokeStyle = "rgba(90, 80, 70, 0.7)";
    ctx.beginPath();
    ctx.moveTo(12, 1);
    ctx.lineTo(12, 5);
    ctx.stroke();
    ctx.fillStyle = "#cfd6de";
    ctx.beginPath();
    ctx.arc(12, 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a929a";
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let k = 0; k < 9; k++) ctx.fillRect(7.5 + (k % 3) * 3.3, 7.5 + Math.floor(k / 3) * 3.3, 1.8, 1.8);
  } else if (id === "rave") {
    ctx.lineWidth = 2;
    ["rgb(80, 220, 150)", "rgb(255, 60, 200)", "rgb(80, 170, 255)"].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(12, 21);
      ctx.lineTo(4 + i * 8, 3);
      ctx.stroke();
    });
  } else if (id === "boombap") fxMic(ctx, 12, 12, 20);
  else if (id === "mosh") fxBolt(ctx, 12, 12, 20);
  else if (id === "pop") fxHeart(ctx, 12, 13, 18, "#ff8fb8");
  else if (id === "twostep") fxCowboyHat(ctx, 12, 12, 20);
  else if (id === "reggaeton") fxFlame(ctx, 12, 12, 20);
  else if (id === "swing") fxSax(ctx, 12, 13, 20);
  else if (id === "synthwave") {
    const sun = ctx.createLinearGradient(0, 4, 0, 16);
    sun.addColorStop(0, "#ffd36f");
    sun.addColorStop(1, "#ff4f9a");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(12, 16, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    for (let k = 0; k < 3; k++) ctx.fillRect(3, 11 + k * 2, 18, 0.9 + k * 0.4);
    ctx.strokeStyle = "#5ad8ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1, 18);
    ctx.lineTo(23, 18);
    ctx.stroke();
  }
}

// Z's, hearts, notes and other little drawings. Drawn with the name tags,
// so they're never hidden.
function drawEmoteFloaters(ctx, p, cx, headTop) {
  const { id, t } = p.emote;
  ctx.save();
  ctx.textAlign = "center";
  if (id === "heart") {
    for (let i = 0; i < 3; i++) {
      const tt = t - i * 0.5;
      if (tt <= 0 || tt >= 2) continue;
      ctx.globalAlpha = 1 - tt / 2;
      fxHeart(ctx, cx + Math.sin(tt * 3 + i * 2) * 9, headTop - 30 - tt * 16, 13);
    }
  } else if (id === "wave") {
    fxHand(ctx, cx + 19, headTop - 8, 15, Math.sin(t * 10) * 0.35);
  } else if (id === "laugh") {
    // "ha ha", bouncing, with tears of joy flying off.
    ctx.fillStyle = "#c9794a";
    ctx.font = "700 11px 'Quicksand', sans-serif";
    ctx.fillText("ha ha", cx, headTop - 26 + Math.sin(t * 12) * 2);
    ctx.fillStyle = "#7ab4e0";
    for (let i = 0; i < 2; i++) {
      const tt = (t * 1.6 + i / 2) % 1;
      ctx.globalAlpha = 1 - tt;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + side * (10 + tt * 10), headTop + 6 - tt * 6 + tt * tt * 12, 1.6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (id === "sleepy") {
    ctx.fillStyle = "#5f6b7a";
    for (let i = 0; i < 3; i++) {
      const tt = (t * 0.7 + i / 3) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.font = `700 ${Math.round(9 + tt * 8)}px 'Quicksand', sans-serif`;
      ctx.fillText("z", cx + 12 + tt * 14, headTop - 4 - tt * 22);
    }
  } else if (id === "headbang") {
    // Bass rings pulsing out on the beat, and a lightning bolt now and then.
    const beat = (t * (140 / 60)) % 1;
    ctx.strokeStyle = `rgba(150, 80, 220, ${0.7 * (1 - beat)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, headTop + 44, 12 + beat * 20, 4 + beat * 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (Math.floor(t * (140 / 60)) % 2 === 0) fxBolt(ctx, cx + 22, headTop + 16, 14);
    fxSpeaker(ctx, cx - 22, headTop + 18 + Math.sin(t * 15) * 1.5, 14);
  } else if (id === "glitch") {
    // Flickering cyan and magenta glitch blocks around their head.
    const n = Math.floor(t * 14);
    for (let i = 0; i < 6; i++) {
      if (noise(n * 7 + i) < 0.45) continue;
      ctx.fillStyle = i % 2 ? "rgba(0, 230, 255, 0.75)" : "rgba(255, 40, 200, 0.75)";
      const x = cx + (noise(n * 3 + i * 5) - 0.5) * 44, y = headTop - 4 + (noise(n * 11 + i) - 0.5) * 34;
      ctx.fillRect(x, y, 3 + noise(i + n) * 10, 2 + noise(i * 2 + n) * 3);
    }
  } else if (id === "sway") {
    // Soft glowing orbs drifting slowly upward.
    const colors = ["rgba(170, 200, 255, ", "rgba(220, 180, 255, ", "rgba(180, 240, 220, "];
    for (let i = 0; i < 5; i++) {
      const tt = (t * 0.25 + i / 5) % 1;
      const x = cx + Math.sin(t * 0.8 + i * 1.9) * 20, y = headTop + 20 - tt * 40;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
      glow.addColorStop(0, colors[i % 3] + (0.95 * (1 - tt)) + ")");
      glow.addColorStop(0.4, colors[i % 3] + (0.6 * (1 - tt)) + ")");
      glow.addColorStop(1, colors[i % 3] + "0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === "idleYawn") {
    ctx.fillStyle = "#8a7560"; // a little sleepy "~"
    ctx.font = "700 11px 'Quicksand', sans-serif";
    ctx.globalAlpha = Math.sin(Math.min(1, t / 2.8) * Math.PI);
    ctx.fillText("~", cx + 14, headTop + 16 - t * 3);
  } else if (id === "idleStretch") {
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 10px 'Quicksand', sans-serif";
    ctx.globalAlpha = Math.sin(Math.min(1, t / 2.6) * Math.PI);
    ctx.fillText("✧", cx - 14, headTop + 10);
    ctx.fillText("✧", cx + 14, headTop + 10);
  } else if (id === "disco") {
    // A tiny mirror ball above them, throwing colorful sparkles.
    const bx = cx, by = headTop - 34;
    ctx.strokeStyle = "rgba(90, 80, 70, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by - 12);
    ctx.lineTo(bx, by - 6);
    ctx.stroke();
    ctx.fillStyle = "#cfd6de";
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let k = 0; k < 6; k++) ctx.fillRect(bx - 4 + (k % 3) * 3, by - 3 + Math.floor(k / 3) * 3, 1.6, 1.6);
    const colors = ["#ff6fa8", "#6fd8ff", "#ffe36f", "#b58cff"];
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + i;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 + i * 2);
      ctx.fillStyle = colors[i % 4];
      ctx.fillText("✦", cx + Math.cos(a) * 26, headTop + 10 + Math.sin(a * 1.3) * 16);
    }
  } else if (id === "rave") {
    // Laser beams sweeping out from above their head.
    const colors = ["rgba(80, 255, 170, 0.6)", "rgba(255, 60, 200, 0.6)", "rgba(80, 180, 255, 0.6)"];
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + Math.sin(t * 2.2 + i * 2.1) * 1.1;
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(cx, headTop - 26);
      ctx.lineTo(cx + Math.cos(a) * 60, headTop - 26 + Math.sin(a) * 60);
      ctx.stroke();
    }
  } else if (id === "boombap") {
    fxMic(ctx, cx + 22, headTop + 14, 14);
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    const tt = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - tt;
    ctx.fillText("♪", cx - 20, headTop + 10 - tt * 22);
  } else if (id === "mosh") {
    // Lightning flashing on either side, in time.
    const flip = Math.floor(t * 3) % 2;
    fxBolt(ctx, cx + (flip ? 22 : -22), headTop + 10 + Math.sin(t * 18) * 2, 15, "#e0e4ec");
  } else if (id === "pop") {
    // Hearts and stars bubbling up in pastel colors.
    const shapes = ["♥", "★", "♥", "★", "✦"];
    const colors = ["#ff8fb8", "#ffd36f", "#b58cff", "#7fd8ff", "#ff8fb8"];
    ctx.font = "700 13px 'Quicksand', sans-serif";
    for (let i = 0; i < 5; i++) {
      const tt = (t * 0.7 + i / 5) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = colors[i];
      ctx.fillText(shapes[i], cx + Math.sin(t * 2 + i * 1.7) * 22, headTop + 16 - tt * 30);
    }
  } else if (id === "twostep") {
    fxCowboyHat(ctx, cx - 22, headTop + 12, 15);
    ctx.fillStyle = "#a0703e";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    const tt = (t * 0.8) % 1;
    ctx.globalAlpha = 1 - tt;
    ctx.fillText("♫", cx + 20, headTop + 10 - tt * 22);
  } else if (id === "reggaeton") {
    for (let i = 0; i < 2; i++) {
      const tt = (t * 0.7 + i / 2) % 1;
      ctx.globalAlpha = 1 - tt;
      fxFlame(ctx, cx + (i ? 20 : -20), headTop + 16 - tt * 20, 14);
    }
  } else if (id === "swing") {
    fxSax(ctx, cx + 22, headTop + 12 + Math.sin(t * 6) * 2, 16);
    ctx.fillStyle = "#d9a441";
    ctx.font = "700 14px 'Quicksand', sans-serif";
    for (let i = 0; i < 2; i++) {
      const tt = (t * 0.9 + i / 2) % 1;
      ctx.globalAlpha = 1 - tt;
      ctx.fillText(i ? "♪" : "♫", cx - 18 - tt * 6, headTop + 12 - tt * 24);
    }
  } else if (id === "synthwave") {
    // A little neon sunset floating above them, with scan lines.
    const sx = cx, sy = headTop - 30;
    const sun = ctx.createLinearGradient(0, sy - 9, 0, sy + 3);
    sun.addColorStop(0, "#ffd36f");
    sun.addColorStop(1, "#ff4f9a");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sx, sy + 3, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(40, 20, 60, 0.9)";
    for (let k = 0; k < 3; k++) ctx.fillRect(sx - 10, sy - 2 + k * 2.5, 20, 0.9 + k * 0.4);
    ctx.strokeStyle = `rgba(90, 220, 255, ${0.5 + Math.sin(t * 3) * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 16, sy + 4);
    ctx.lineTo(sx + 16, sy + 4);
    ctx.stroke();
  } else if (id === "jig") {
    const colors = ["#c0554a", "#3f6f9f", "#d9a441", "#4f7a48"];
    ctx.font = "700 15px 'Quicksand', sans-serif";
    for (let i = 0; i < 4; i++) {
      const tt = (t * 0.9 + i / 4) % 1;
      const angle = t * 3 + i * 1.6;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = colors[i];
      ctx.fillText(i % 2 ? "♪" : "♫", cx + Math.cos(angle) * 22, headTop + 12 - tt * 26);
    }
  }
  ctx.restore();
}

// Draws a character by itself, centered in a small canvas, for the
// preview on the Join screen.
// It takes a look: { color, hat, shoes, glasses, face, and so on }. (The
// older way, drawCharacterPreview(canvas, color, hat, shoes, aura,
// glasses), still works too.)
function drawCharacterPreview(canvas, look, hatOrAura, shoes, aura = null, glasses = "none") {
  if (typeof look === "string") look = { color: look, hat: hatOrAura, shoes, glasses };
  else aura = hatOrAura ?? null;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const p = { hat: "none", shoes: "none", glasses: "none", ...look, x: 0, y: 0, moving: false, aura: aura && { robe: aura.robe } }; // (just the robe: the rest wouldn't fit)
  const foot = playerFeet(p);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 13);
  ctx.scale(2, 2); // drawn at double size so it's easy to see
  ctx.translate(-foot.x, -foot.y);
  drawPlayerBody(ctx, p);
  ctx.restore();
}
