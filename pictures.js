// Item pictures (no emoji): every crop, seed packet, fish, bait, rod, bit
// of junk, pantry food and dish, drawn in the house's style: soft shapes
// lit from above (a lighter top, a darker bottom), a darker outline and a
// little shine. Things are named by their basket id, like "crop:carrot",
// "fish:perch", "dish:jam" or "food:egg", plus a few extras ("rod:twig",
// "boost:lucky", "decor:" plus a Nest & Nook item, and plain pictures
// like "book", "scroll", "lock").
//
// pictureCanvas(key, size) gives a finished canvas; setPicture(el, key)
// puts one into an element (anything that isn't a known picture is shown
// as plain text, so older data never breaks).

import { portraitCanvas } from "./icons.js";

// --- Little helpers ---
// Everything is drawn in a 32 by 32 box centered on 0, 0.

const shade = (c, n) => shadeColor(c, n);

// Fills the current path with `color`, lighter at the top and darker at
// the bottom, with a darker outline.
function paint(ctx, color, { top = -14, bottom = 14, outline = true, width = 1.3 } = {}) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, shade(color, 28));
  g.addColorStop(1, shade(color, -22));
  ctx.fillStyle = g;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = shade(color, -70);
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}
function flat(ctx, color) {
  ctx.fillStyle = color;
  ctx.fill();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
// A small white shine (the light comes from above).
function shine(ctx, x, y, w = 3, h = 1.6, a = 0.75) {
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ellipse(ctx, x, y, w, h, -0.4);
  ctx.fill();
}
function line(ctx, color, width, ...pts) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
function leaf(ctx, x, y, len, angle, color = "#6aa84a") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.35, -len * 0.45, 0, -len);
  ctx.quadraticCurveTo(-len * 0.35, -len * 0.45, 0, 0);
  paint(ctx, color, { top: -len, bottom: 0, width: 1 });
  ctx.restore();
}
function star(ctx, x, y, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// --- Crops ---
function berryLeaves(ctx, x, y, n = 5, len = 5, color = "#5a9a3a") {
  for (let i = 0; i < n; i++) leaf(ctx, x, y, len, -1.2 + (i * 2.4) / (n - 1), color);
}
const CROPS = {
  radish(ctx) {
    for (const a of [-0.5, 0, 0.5]) leaf(ctx, 0, -5, 11, a);
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.bezierCurveTo(-10, -7, 10, -7, 9, 1);
    ctx.bezierCurveTo(8, 8, 2, 10, 0, 15);
    ctx.bezierCurveTo(-2, 10, -8, 8, -9, 1);
    paint(ctx, "#d9485a");
    shine(ctx, -4, -2);
  },
  lettuce(ctx) {
    for (const [x, y, r, c] of [[-6, 3, 8, "#7ab050"], [6, 3, 8, "#7ab050"], [0, 6, 9, "#8fc06a"], [0, -2, 8, "#a8d47e"]]) {
      circle(ctx, x, y, r);
      paint(ctx, c);
    }
    line(ctx, "#6a9a44", 1, 0, 12, 0, 0, -3, -6);
    shine(ctx, -3, -5);
  },
  carrot(ctx) {
    for (const a of [-0.45, 0, 0.45]) leaf(ctx, 3, -8, 10, a + 0.3);
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.quadraticCurveTo(8, -12, 9, -4);
    ctx.lineTo(-10, 14);
    ctx.quadraticCurveTo(-12, 13, -10, 10);
    ctx.closePath();
    paint(ctx, "#e8883a");
    line(ctx, "#b8601e", 1, -1, 0, 2, 2);
    line(ctx, "#b8601e", 1, -5, 5, -2, 7);
    shine(ctx, 2, -6);
  },
  strawberry(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.bezierCurveTo(-13, 4, -12, -8, 0, -6);
    ctx.bezierCurveTo(12, -8, 13, 4, 0, 14);
    paint(ctx, "#e0404a");
    ctx.fillStyle = "#f8e08a";
    for (const [x, y] of [[-5, -1], [0, 1], [5, -1], [-3, 5], [3, 5], [0, 9], [-6, 3], [6, 3]]) {
      ellipse(ctx, x, y, 0.8, 1.1);
      ctx.fill();
    }
    berryLeaves(ctx, 0, -6, 5, 6);
    shine(ctx, -5, -3);
  },
  tomato(ctx) {
    ellipse(ctx, 0, 3, 12, 10.5);
    paint(ctx, "#e0503a");
    star(ctx, 0, -6, 6, 5, 0.35);
    paint(ctx, "#5a9a3a", { width: 1 });
    line(ctx, "#4a7a2a", 1.6, 0, -6, 1, -11);
    shine(ctx, -6, -1, 3.5, 2);
  },
  sunflower(ctx) {
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 6);
      ellipse(ctx, 0, -10, 3, 6);
      paint(ctx, "#f2c230", { top: -16, bottom: -4, width: 1 });
      ctx.restore();
    }
    circle(ctx, 0, 0, 7);
    paint(ctx, "#7a4a24");
    ctx.fillStyle = "#4a2a14";
    for (let i = 0; i < 9; i++) {
      circle(ctx, Math.cos(i * 2.4) * (i % 3) * 2, Math.sin(i * 2.4) * (i % 3) * 2, 0.8);
      ctx.fill();
    }
  },
  corn(ctx) {
    ctx.save();
    ctx.rotate(0.35);
    ellipse(ctx, 0, -1, 6.5, 13);
    paint(ctx, "#f0d25a");
    ctx.strokeStyle = "rgba(170, 120, 30, 0.55)";
    ctx.lineWidth = 0.8;
    for (let y = -10; y <= 8; y += 3) {
      ctx.beginPath();
      ctx.moveTo(-5.5, y);
      ctx.lineTo(5.5, y);
      ctx.stroke();
    }
    for (const x of [-2.2, 2.2]) {
      ctx.beginPath();
      ctx.moveTo(x, -12);
      ctx.lineTo(x, 11);
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.quadraticCurveTo(side * 12, 6, side * 7, -6);
      ctx.quadraticCurveTo(side * 5, 6, 0, 15);
      paint(ctx, "#7ab050", { width: 1 });
    }
    ctx.restore();
  },
  pumpkin(ctx) {
    for (const [x, rx] of [[-6, 7], [6, 7], [0, 7.5]]) {
      ellipse(ctx, x, 3, rx, 10);
      paint(ctx, "#e8883a");
    }
    rrect(ctx, -1.5, -11, 3.5, 5, 1.2);
    paint(ctx, "#6a5a2a", { width: 1 });
    leaf(ctx, 1, -8, 6, 1.2, "#6aa84a");
    shine(ctx, -2, -3);
  },
  blueberry(ctx) {
    for (const [x, y, r] of [[-5, 4, 6.5], [5, 4, 6.5], [0, -4, 6.5]]) {
      circle(ctx, x, y, r);
      paint(ctx, "#4a5ab8");
      star(ctx, x, y - r * 0.55, 1.8, 5, 0.4);
      flat(ctx, "#2a3478");
      shine(ctx, x - 2.5, y - 1.5, 1.6, 1);
    }
  },
  starfruit(ctx) {
    star(ctx, 0, 1, 14, 5, 0.5);
    paint(ctx, "#f2d24a");
    star(ctx, 0, 1, 5, 5, 0.5);
    flat(ctx, "rgba(255, 250, 220, 0.8)");
    shine(ctx, -4, -5);
  },
  moonflower(ctx) {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    glow.addColorStop(0, "rgba(220, 225, 255, 0.9)");
    glow.addColorStop(1, "rgba(220, 225, 255, 0)");
    ctx.fillStyle = glow;
    circle(ctx, 0, 0, 16);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 5);
      ellipse(ctx, 0, -7, 5, 8);
      paint(ctx, "#e8ecff", { top: -15, bottom: 0, width: 1 });
      ctx.restore();
    }
    circle(ctx, 0, 0, 3.2);
    paint(ctx, "#f2e28a", { width: 0.8 });
  },
};

// A paper seed packet with a little picture of the crop on the front.
function seedPacket(ctx, crop) {
  ctx.save();
  ctx.rotate(-0.08);
  rrect(ctx, -10, -13, 20, 27, 2);
  paint(ctx, "#f2e2c0");
  ctx.fillStyle = "#d8b882";
  ctx.fillRect(-10, -13, 20, 4);
  ctx.beginPath();
  for (let x = -10; x <= 10; x += 2.5) ctx.lineTo(x, -13 + (Math.round((x + 10) / 2.5) % 2 ? 1.2 : 0));
  ctx.strokeStyle = "#a88a5a";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, 3);
  ctx.scale(0.5, 0.5);
  CROPS[crop]?.(ctx);
  ctx.restore();
  ctx.fillStyle = "#8a6a4a";
  for (const dx of [-5, 0, 5]) {
    ellipse(ctx, dx, 11, 1.2, 0.8);
    ctx.fill();
  }
  ctx.restore();
}

// --- Fish ---
// Most fish are one body shape in their own color; a few are special.
const FISH_LOOK = {
  sunfish: { round: true },
  koi: { spots: "#f8f0e8" },
  goldenCarp: { shiny: true },
  ghostKoi: { spots: "#f0b0b0", pale: true },
  rainbowKoi: { rainbow: true },
  moonfish: { round: true, glow: "#e8e4ff" },
  pike: { long: true },
  icePike: { long: true, glow: "#d8f0ff" },
  sturgeon: { long: true, ridge: true },
  catfish: { whiskers: true },
  whiskers: { whiskers: true, big: true },
  trout: { spots: "#6a4a4a" },
  perch: { stripes: "#6a5a2a" },
  bass: { stripes: "#3a5a2a" },
};
function drawFish(ctx, color, look = {}) {
  if (look.glow) {
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 17);
    g.addColorStop(0, look.glow);
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    circle(ctx, 0, 0, 17);
    ctx.fill();
  }
  const len = look.long ? 15 : look.round ? 10 : 13;
  const h = look.long ? 5.5 : look.round ? 9.5 : look.big ? 8.5 : 7.5;
  ctx.save();
  if (look.long || !look.round) ctx.rotate(-0.12);
  // Tail.
  ctx.beginPath();
  ctx.moveTo(len - 3, 0);
  ctx.lineTo(len + 5, -h * 0.8);
  ctx.quadraticCurveTo(len + 2, 0, len + 5, h * 0.8);
  ctx.closePath();
  paint(ctx, shade(color, -10));
  // A fin on top.
  ctx.beginPath();
  ctx.moveTo(-3, -h + 1);
  ctx.quadraticCurveTo(2, -h - 5, 6, -h + 2);
  paint(ctx, shade(color, -15), { width: 1 });
  // Body.
  ellipse(ctx, 0, 0, len, h);
  if (look.rainbow) {
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    ["#e86a6a", "#f2b24a", "#f2e06a", "#7ac86a", "#6aa8e8", "#a86ae8"].forEach((c, i) => g.addColorStop(i / 5, c));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#6a4a7a";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  } else paint(ctx, color, { top: -h, bottom: h });
  // Belly.
  ctx.save();
  ellipse(ctx, 0, 0, len, h);
  ctx.clip();
  ellipse(ctx, 0, h * 0.8, len, h * 0.5);
  flat(ctx, "rgba(255, 250, 235, 0.35)");
  if (look.stripes) for (let x = -6; x <= 6; x += 4) line(ctx, look.stripes + "88", 2, x, -h, x - 1, h * 0.4);
  if (look.spots) {
    ctx.fillStyle = look.spots;
    for (const [x, y, r] of [[-2, -3, 2.2], [4, 1, 1.8], [-6, 2, 1.5], [7, -3, 1.3]]) {
      circle(ctx, x, y, r);
      ctx.fill();
    }
  }
  if (look.ridge) for (let x = -10; x <= 8; x += 4) line(ctx, "#4a4a50", 1, x, -h + 1, x + 1.5, -h + 2.5);
  ctx.restore();
  // Eye, gill and shine.
  circle(ctx, -len + 4.5, -1.5, 1.7);
  flat(ctx, "#1e1a24");
  circle(ctx, -len + 4.1, -2, 0.6);
  flat(ctx, "#ffffff");
  ctx.strokeStyle = shade(color, -50);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(-len + 8, 0, h * 0.55, -1, 1);
  ctx.stroke();
  if (look.whiskers) {
    line(ctx, "#3a3430", 0.9, -len + 1, 1, -len - 5, 3);
    line(ctx, "#3a3430", 0.9, -len + 1, 2, -len - 4, 6);
  }
  shine(ctx, -2, -h * 0.55, 4, 1.4, look.shiny ? 0.95 : 0.6);
  if (look.shiny) {
    ctx.fillStyle = "#fff8c0";
    star(ctx, 8, -h - 2, 2.5, 4, 0.35);
    ctx.fill();
  }
  ctx.restore();
}
const SPECIAL_FISH = {
  crayfish(ctx) {
    ctx.save();
    ctx.rotate(-0.5);
    for (const side of [-1, 1]) {
      line(ctx, "#a8402a", 2, side * 3, -6, side * 7, -11);
      ellipse(ctx, side * 8, -13, 3.2, 4.5, side * 0.4);
      paint(ctx, "#d05a3a");
    }
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, 0, -4 + i * 4.5, 5.5 - i * 0.6, 3);
      paint(ctx, "#d05a3a", { top: -6, bottom: 12 });
    }
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(0, 16);
    ctx.lineTo(4, 12);
    paint(ctx, "#c04a2a");
    line(ctx, "#8a3020", 0.7, -1.5, -8, -6, -16);
    line(ctx, "#8a3020", 0.7, 1.5, -8, 6, -16);
    for (const dx of [-2, 2]) {
      circle(ctx, dx, -6, 0.9);
      flat(ctx, "#1a1a1a");
    }
    ctx.restore();
  },
  eel(ctx) {
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.bezierCurveTo(-6, -12, -2, 6, 6, -2);
    ctx.bezierCurveTo(10, -6, 14, 2, 15, 6);
    ctx.strokeStyle = "#2a2a22";
    ctx.lineWidth = 7.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "#5a5a44";
    ctx.lineWidth = 5.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 220, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    circle(ctx, -13, -5, 1.2);
    flat(ctx, "#f2e28a");
  },
  turtle(ctx) {
    for (const [x, y] of [[-10, -6], [10, -6], [-10, 7], [10, 7]]) {
      ellipse(ctx, x, y, 3.5, 2.5);
      paint(ctx, "#8aa86a");
    }
    ellipse(ctx, 0, -12, 4, 3.5);
    paint(ctx, "#8aa86a");
    ellipse(ctx, 0, 0.5, 11, 10);
    paint(ctx, "#5a6a3a");
    ctx.strokeStyle = "#3a4a24";
    ctx.lineWidth = 1;
    for (const [x, y] of [[0, 0], [-6, -4], [6, -4], [-6, 5], [6, 5]]) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) ctx.lineTo(x + Math.cos(i * 1.047) * 3.2, y + Math.sin(i * 1.047) * 3.2);
      ctx.closePath();
      ctx.stroke();
    }
    shine(ctx, -4, -6);
  },
};

// --- Bait and rods ---
const BAIT = {
  none(ctx) {
    ctx.strokeStyle = "#8a929a";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(2, -13);
    ctx.lineTo(2, 6);
    ctx.arc(-3, 6, 5, 0, Math.PI, false);
    ctx.lineTo(-8, 1);
    ctx.stroke();
    circle(ctx, 2, -14, 2);
    ctx.stroke();
  },
  worm(ctx) {
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.bezierCurveTo(-8, -6, -2, 12, 3, 0);
    ctx.bezierCurveTo(6, -7, 11, -6, 13, -2);
    ctx.strokeStyle = "#a84a5a";
    ctx.lineWidth = 6.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "#e0848a";
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    circle(ctx, 12, -3, 0.9);
    flat(ctx, "#3a1a1a");
  },
  cricket(ctx) {
    line(ctx, "#4a3a1a", 1.4, 4, 2, 10, -6, 14, 6);
    line(ctx, "#4a3a1a", 1.2, -2, 4, -5, 10);
    line(ctx, "#4a3a1a", 1.2, 2, 4, 3, 10);
    ellipse(ctx, 0, 0, 11, 5.5);
    paint(ctx, "#7a6a2a");
    ellipse(ctx, -10, -2, 4.5, 4);
    paint(ctx, "#6a5a24");
    line(ctx, "#4a3a1a", 0.8, -12, -5, -16, -14);
    line(ctx, "#4a3a1a", 0.8, -11, -5, -10, -15);
    circle(ctx, -12, -3, 1);
    flat(ctx, "#1a1a1a");
    shine(ctx, -2, -3);
  },
  minnow(ctx) {
    ctx.scale(0.75, 0.75);
    drawFish(ctx, "#c0c8d4", { shiny: false });
  },
  lure(ctx) {
    ctx.save();
    ctx.rotate(0.5);
    ellipse(ctx, 0, -2, 6, 11);
    paint(ctx, "#f2c230");
    ellipse(ctx, 0, -4, 3, 6);
    flat(ctx, "rgba(255, 250, 200, 0.7)");
    line(ctx, "#8a929a", 1.6, 0, 9, 0, 13, -3, 15);
    ctx.restore();
    ctx.fillStyle = "#fff8c0";
    star(ctx, 9, -10, 3, 4, 0.35);
    ctx.fill();
  },
  glowworm(ctx) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    g.addColorStop(0, "rgba(190, 255, 150, 0.8)");
    g.addColorStop(1, "rgba(190, 255, 150, 0)");
    ctx.fillStyle = g;
    circle(ctx, 0, 0, 16);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      circle(ctx, -9 + i * 4.5, Math.sin(i * 1.3) * 3, 4 - i * 0.2);
      paint(ctx, "#9ae06a", { width: 1 });
    }
    circle(ctx, -10, -1, 0.9);
    flat(ctx, "#1a2a1a");
  },
};
const ROD_COLORS = { twig: "#8a6440", bamboo: "#a8b85a", fiberglass: "#e8eef2", carbon: "#3a3a40", golden: "#e8b84a" };
function drawRod(ctx, id) {
  const c = ROD_COLORS[id] ?? "#8a6440";
  line(ctx, "#5a4a3a", 4, -13, 14, -9, 10); // handle
  line(ctx, shade(c, -60), 3, -9, 10, 13, -13);
  line(ctx, c, 1.8, -9, 10, 13, -13);
  if (id === "bamboo") for (let t = 0.2; t < 1; t += 0.2) line(ctx, "#6a7a30", 2.6, -9 + 22 * t - 0.6, 10 - 23 * t + 0.6, -9 + 22 * t + 0.6, 10 - 23 * t - 0.6);
  circle(ctx, -6, 7, 3.2);
  paint(ctx, "#b8bec4", { width: 1 }); // reel
  ctx.strokeStyle = "rgba(90, 90, 100, 0.7)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(13, -13);
  ctx.quadraticCurveTo(15, 0, 11, 11);
  ctx.stroke();
  if (id === "golden") {
    ctx.fillStyle = "#fff4b0";
    star(ctx, 6, -10, 3, 4, 0.35);
    ctx.fill();
  }
}

// --- Junk ---
const JUNK = {
  boot(ctx) {
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(4, -13);
    ctx.lineTo(4, 3);
    ctx.quadraticCurveTo(13, 3, 13, 9);
    ctx.lineTo(13, 12);
    ctx.lineTo(-7, 12);
    ctx.closePath();
    paint(ctx, "#7a5a3a");
    rrect(ctx, -8, 10, 22, 3.5, 1.5);
    paint(ctx, "#4a3a2a", { width: 1 });
    line(ctx, "#5a4028", 1, -4, -8, 2, -8);
    line(ctx, "#5a4028", 1, -4, -4, 2, -4);
    ctx.fillStyle = "rgba(110, 160, 90, 0.8)";
    ellipse(ctx, 6, 5, 2.5, 1.5, 0.4);
    ctx.fill();
    shine(ctx, -2, -10, 2, 1.2);
  },
  can(ctx) {
    ctx.save();
    ctx.rotate(0.2);
    rrect(ctx, -8, -11, 16, 22, 2);
    paint(ctx, "#a8b0b8");
    ctx.fillStyle = "#c9574a";
    ctx.fillRect(-8, -5, 16, 10);
    ellipse(ctx, 0, -11, 8, 2.5);
    paint(ctx, "#c8d0d8", { width: 1 });
    ctx.fillStyle = "rgba(160, 90, 40, 0.6)";
    ellipse(ctx, 4, 7, 2.5, 1.5);
    ctx.fill();
    ctx.restore();
  },
  weeds(ctx) {
    for (const [x, a, l, c] of [[-4, -0.5, 14, "#4a8a5a"], [0, 0.1, 17, "#5a9a64"], [4, 0.6, 13, "#3a7a4a"], [-1, -0.25, 11, "#6aaa6a"]]) leaf(ctx, x, 12, l, a, c);
    ctx.fillStyle = "rgba(90, 140, 170, 0.5)";
    circle(ctx, 8, -8, 1.5);
    ctx.fill();
    circle(ctx, -7, -4, 1);
    ctx.fill();
  },
  letter(ctx) {
    ctx.save();
    ctx.rotate(-0.15);
    rrect(ctx, -13, -8, 26, 17, 2);
    paint(ctx, "#e8e0c8");
    line(ctx, "#a89a7a", 1.2, -12, -7, 0, 2, 12, -7);
    circle(ctx, 0, 2, 2.6);
    paint(ctx, "#b8574a", { width: 0.8 });
    ctx.fillStyle = "rgba(90, 130, 160, 0.3)";
    ellipse(ctx, -6, 4, 5, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(110, 160, 200, 0.7)";
    ellipse(ctx, 10, 11, 1.2, 2);
    ctx.fill();
  },
  duck(ctx) {
    ellipse(ctx, 1, 5, 12, 8);
    paint(ctx, "#f2d24a");
    circle(ctx, -5, -6, 6.5);
    paint(ctx, "#f2d24a");
    ellipse(ctx, -12, -4, 4, 2);
    paint(ctx, "#e8883a", { width: 1 });
    circle(ctx, -6, -8, 1.2);
    flat(ctx, "#1a1a1a");
    ctx.beginPath();
    ctx.moveTo(4, 3);
    ctx.quadraticCurveTo(10, -2, 11, 6);
    ctx.strokeStyle = "#c9a22a";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    shine(ctx, -3, -10, 2, 1.2);
  },
  burnt(ctx) {
    ellipse(ctx, 0, 5, 12, 7.5);
    paint(ctx, "#3a2a24");
    ctx.fillStyle = "#6a4a34";
    for (const [x, y] of [[-4, 3], [3, 6], [6, 2]]) {
      circle(ctx, x, y, 1.6);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(150, 150, 150, 0.7)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const dx of [-4, 3]) {
      ctx.beginPath();
      ctx.moveTo(dx, -2);
      ctx.bezierCurveTo(dx - 4, -6, dx + 4, -9, dx, -14);
      ctx.stroke();
    }
  },
};

// --- Pantry food ---
function sack(ctx, color, label) {
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.quadraticCurveTo(-12, 4, -10, 13);
  ctx.lineTo(10, 13);
  ctx.quadraticCurveTo(12, 4, 9, -8);
  ctx.closePath();
  paint(ctx, color);
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.lineTo(-6, -14);
  ctx.lineTo(0, -10);
  ctx.lineTo(6, -14);
  ctx.lineTo(9, -8);
  paint(ctx, shade(color, -12), { width: 1 });
  line(ctx, "#8a6a3a", 1.4, -8, -8, 8, -8);
  label?.(ctx);
}
function jar(ctx, glass, fill, lid = "#c9574a") {
  rrect(ctx, -9, -8, 18, 21, 4);
  paint(ctx, fill);
  rrect(ctx, -9, -8, 18, 21, 4);
  flat(ctx, glass);
  rrect(ctx, -10, -13, 20, 6, 2);
  paint(ctx, lid);
  shine(ctx, -5, -3, 1.5, 4, 0.7);
}
const FOOD = {
  flour(ctx) {
    sack(ctx, "#f2ead8", (ctx) => {
      for (const a of [-0.4, 0, 0.4]) leaf(ctx, 0, 8, 9, a, "#d8b45a");
    });
  },
  sugar(ctx) {
    for (const [x, y] of [[-6, 4], [5, 4], [-1, -5]]) {
      ctx.save();
      ctx.translate(x, y);
      rrect(ctx, -6, -6, 12, 12, 1.5);
      paint(ctx, "#fbf8f2", { top: -6, bottom: 6 });
      ctx.fillStyle = "rgba(200, 190, 180, 0.6)";
      ctx.fillRect(-6, 2, 12, 4);
      ctx.restore();
    }
  },
  rice(ctx) {
    sack(ctx, "#e8dcc0", (ctx) => {
      ctx.fillStyle = "#ffffff";
      for (const [x, y] of [[-3, 3], [2, 5], [0, 0], [4, 1], [-4, 7]]) {
        ellipse(ctx, x, y, 1.6, 0.9, 0.5);
        ctx.fill();
      }
    });
  },
  honey(ctx) {
    jar(ctx, "rgba(255, 255, 255, 0.15)", "#e8a830", "#b8844e");
    line(ctx, "#d89a20", 3, -4, -8, -4, -2);
  },
  salt(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7, 13);
    ctx.lineTo(-8, -4);
    ctx.quadraticCurveTo(0, -8, 8, -4);
    ctx.lineTo(7, 13);
    ctx.closePath();
    paint(ctx, "#f4f4f4");
    ellipse(ctx, 0, -6, 7, 5);
    paint(ctx, "#b8bec4");
    ctx.fillStyle = "#6a7078";
    for (const [x, y] of [[-2, -7], [2, -7], [0, -5]]) {
      circle(ctx, x, y, 0.8);
      ctx.fill();
    }
    shine(ctx, -4, 2, 1.4, 4, 0.8);
  },
  egg(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.bezierCurveTo(10, -13, 11, 12, 0, 12);
    ctx.bezierCurveTo(-11, 12, -10, -13, 0, -13);
    paint(ctx, "#f4e8d4");
    shine(ctx, -4, -5, 2, 3.5, 0.9);
  },
  milk(ctx) {
    ctx.beginPath();
    ctx.moveTo(-4, -13);
    ctx.lineTo(4, -13);
    ctx.lineTo(4, -8);
    ctx.quadraticCurveTo(9, -5, 9, 1);
    ctx.lineTo(9, 11);
    ctx.quadraticCurveTo(9, 14, 6, 14);
    ctx.lineTo(-6, 14);
    ctx.quadraticCurveTo(-9, 14, -9, 11);
    ctx.lineTo(-9, 1);
    ctx.quadraticCurveTo(-9, -5, -4, -8);
    ctx.closePath();
    paint(ctx, "#fbfaf6");
    rrect(ctx, -5, -15, 10, 4, 1.5);
    paint(ctx, "#5a8ac0", { width: 1 });
    ctx.fillStyle = "#8ab4dc";
    ctx.fillRect(-9, 2, 18, 5);
    shine(ctx, -5, -1, 1.4, 3, 0.9);
  },
  butter(ctx) {
    ellipse(ctx, 0, 7, 14, 5);
    paint(ctx, "#e8eef2");
    ctx.beginPath();
    ctx.moveTo(-9, 4);
    ctx.lineTo(-7, -4);
    ctx.lineTo(9, -4);
    ctx.lineTo(9, 4);
    ctx.closePath();
    paint(ctx, "#f4d86a");
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(-4, -8);
    ctx.lineTo(11, -8);
    ctx.lineTo(9, -4);
    ctx.closePath();
    paint(ctx, "#fbe89a", { width: 1 });
  },
  cheese(ctx) {
    ctx.beginPath();
    ctx.moveTo(-13, 9);
    ctx.lineTo(13, 9);
    ctx.lineTo(13, -2);
    ctx.lineTo(-13, 3);
    ctx.closePath();
    paint(ctx, "#f2c64a");
    ctx.beginPath();
    ctx.moveTo(-13, 3);
    ctx.lineTo(13, -2);
    ctx.lineTo(6, -8);
    ctx.closePath();
    paint(ctx, "#f8dc84", { width: 1 });
    ctx.fillStyle = "#d8a42a";
    for (const [x, y, r] of [[-5, 6, 1.8], [4, 4, 2.2], [9, 6, 1.3]]) {
      circle(ctx, x, y, r);
      ctx.fill();
    }
  },
};

// --- Dishes ---
function plate(ctx, color = "#f4f0e8") {
  ellipse(ctx, 0, 7, 15, 6);
  paint(ctx, color, { top: 1, bottom: 13 });
  ellipse(ctx, 0, 6.5, 10, 3.8);
  flat(ctx, "rgba(200, 190, 175, 0.35)");
}
function bowl(ctx, soup, color = "#e8e0d0") {
  ellipse(ctx, 0, -1, 14, 5);
  paint(ctx, soup, { top: -6, bottom: 4 });
  ctx.beginPath();
  ctx.moveTo(-14, -1);
  ctx.quadraticCurveTo(-13, 13, 0, 13);
  ctx.quadraticCurveTo(13, 13, 14, -1);
  ctx.quadraticCurveTo(0, 5, -14, -1);
  paint(ctx, color, { top: -1, bottom: 13 });
  shine(ctx, -8, 3, 1.4, 2.4, 0.7);
}
function steam(ctx, xs = [-4, 3]) {
  ctx.strokeStyle = "rgba(170, 160, 150, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const x of xs) {
    ctx.beginPath();
    ctx.moveTo(x, -7);
    ctx.bezierCurveTo(x - 3, -10, x + 3, -12, x, -16);
    ctx.stroke();
  }
}
function pancakeStack(ctx, topping) {
  plate(ctx);
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, 0, 4 - i * 4, 11, 4);
    paint(ctx, "#e0a860", { top: -8, bottom: 8 });
  }
  ctx.beginPath();
  ctx.ellipse(0, -4.5, 8, 2.8, 0, 0, Math.PI * 2);
  flat(ctx, "#b8702a");
  line(ctx, "#b8702a", 2, 6, -4, 7, 1);
  topping?.(ctx);
}
function cup(ctx, drink, color = "#f4f0e8") {
  ctx.beginPath();
  ctx.arc(10, 2, 4.5, -1.2, 1.2);
  ctx.strokeStyle = shade(color, -60);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(10, -4);
  ctx.quadraticCurveTo(10, 11, 0, 11);
  ctx.quadraticCurveTo(-10, 11, -10, -4);
  paint(ctx, color, { top: -4, bottom: 11 });
  ellipse(ctx, 0, -4, 10, 2.8);
  paint(ctx, drink, { top: -7, bottom: -1, width: 1 });
  ellipse(ctx, 0, 13, 13, 3);
  paint(ctx, color, { top: 10, bottom: 16, width: 1 });
}
function pieSlice(ctx, filling) {
  plate(ctx);
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.lineTo(10, 6);
  ctx.lineTo(4, -6);
  ctx.closePath();
  paint(ctx, filling);
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.lineTo(10, 6);
  ctx.lineTo(12, 4);
  ctx.lineTo(6, -8);
  ctx.closePath();
  paint(ctx, "#d8a05a", { width: 1 });
}
const DISHES = {
  pancakes: (ctx) => pancakeStack(ctx, (ctx) => {
    rrect(ctx, -3, -8, 6, 3.5, 1);
    paint(ctx, "#fbe89a", { width: 0.8 });
  }),
  blueberryPancakes: (ctx) => pancakeStack(ctx, (ctx) => {
    for (const [x, y] of [[-3, -6], [2, -7], [4, -4], [-1, -3]]) {
      circle(ctx, x, y, 1.8);
      paint(ctx, "#4a5ab8", { width: 0.6 });
    }
  }),
  honeyToast(ctx) {
    plate(ctx);
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.lineTo(-9, -4);
    ctx.bezierCurveTo(-12, -14, 12, -14, 9, -4);
    ctx.lineTo(9, 6);
    ctx.closePath();
    paint(ctx, "#d8a05a");
    ctx.beginPath();
    ctx.moveTo(-7, 5);
    ctx.lineTo(-7, -3);
    ctx.bezierCurveTo(-9, -11, 9, -11, 7, -3);
    ctx.lineTo(7, 5);
    ctx.closePath();
    flat(ctx, "#f2d8a4");
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.quadraticCurveTo(0, -8, 5, -4);
    ctx.quadraticCurveTo(4, 2, 1, 1);
    ctx.lineTo(0, 5);
    ctx.lineTo(-1, 1);
    ctx.quadraticCurveTo(-4, 1, -5, -4);
    flat(ctx, "#e8a830");
    shine(ctx, -2, -4, 1.6, 0.8);
  },
  omelette(ctx) {
    plate(ctx);
    ctx.beginPath();
    ctx.moveTo(-11, 5);
    ctx.bezierCurveTo(-10, -9, 10, -9, 11, 5);
    ctx.closePath();
    paint(ctx, "#f2d24a");
    ctx.fillStyle = "#6aa84a";
    for (const [x, y] of [[-4, -1], [2, -3], [5, 1]]) {
      circle(ctx, x, y, 0.9);
      ctx.fill();
    }
    shine(ctx, -4, -4);
  },
  pickles(ctx) {
    jar(ctx, "rgba(220, 240, 220, 0.25)", "#b8cc88", "#6a8a4a");
    for (const [x, r] of [[-4, 0.2], [3, -0.2]]) {
      ellipse(ctx, x, 4, 2.6, 7, r);
      paint(ctx, "#6a9a3a", { width: 0.8 });
    }
  },
  salad(ctx) {
    bowl(ctx, "#8fc06a", "#f4f0e8");
    for (const [x, y, c] of [[-6, -4, "#7ab050"], [5, -5, "#a8d47e"], [0, -6, "#8fc06a"]]) leaf(ctx, x, y + 3, 7, x * 0.1, c);
    circle(ctx, 3, -2, 2.4);
    paint(ctx, "#e0503a", { width: 0.8 });
    circle(ctx, -3, -1, 1.8);
    paint(ctx, "#e8883a", { width: 0.8 });
  },
  carrotCake(ctx) {
    plate(ctx);
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-10, -4);
    ctx.lineTo(8, -8);
    ctx.lineTo(10, 6);
    ctx.closePath();
    paint(ctx, "#c8844a");
    for (const y of [-3, 2]) line(ctx, "#f8f0e0", 1.8, -10, y, 9, y - 3 + (y + 3) * 0.4);
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(8, -8);
    ctx.lineTo(5, -11);
    ctx.lineTo(-12, -7);
    ctx.closePath();
    paint(ctx, "#fbf4e4", { width: 1 });
    ellipse(ctx, -2, -9, 1.3, 2.6, 1.2);
    paint(ctx, "#e8883a", { width: 0.6 });
  },
  jam(ctx) {
    jar(ctx, "rgba(255, 255, 255, 0.12)", "#c8304a", "#f4f0e8");
    ctx.fillStyle = "#c9574a";
    for (let x = -8; x <= 8; x += 4) {
      ctx.fillRect(x, -13, 2, 2);
      ctx.fillRect(x + 2, -11, 2, 2);
    }
  },
  smoothie(ctx) {
    line(ctx, "#e86a8a", 2.2, 3, -8, 7, -16);
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.lineTo(8, -9);
    ctx.lineTo(6, 13);
    ctx.lineTo(-6, 13);
    ctx.closePath();
    paint(ctx, "#b86aa8");
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(-8, -9, 16, 3);
    circle(ctx, -6, -9, 3);
    paint(ctx, "#e0404a", { width: 0.8 });
    shine(ctx, -3, 2, 1.2, 4, 0.5);
  },
  tomatoSoup(ctx) {
    bowl(ctx, "#d8503a");
    steam(ctx);
    circle(ctx, 3, -2, 1.5);
    flat(ctx, "#f4f0e0");
  },
  chowder(ctx) {
    bowl(ctx, "#f0e2c0");
    ctx.fillStyle = "#f2d24a";
    for (const [x, y] of [[-5, -2], [0, -1], [4, -2.5], [6, 0], [-2, 0.5]]) {
      circle(ctx, x, y, 1.2);
      ctx.fill();
    }
    steam(ctx);
  },
  popcorn(ctx) {
    for (const [x, y] of [[-6, -9], [0, -12], [6, -9], [-3, -6], [4, -5], [-8, -4], [8, -4]]) {
      circle(ctx, x, y, 3.6);
      paint(ctx, "#fbf4dc", { top: -15, bottom: -2, width: 0.9 });
    }
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(10, -5);
    ctx.lineTo(7, 14);
    ctx.lineTo(-7, 14);
    ctx.closePath();
    paint(ctx, "#f4f0e8");
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#d9484a";
    for (let x = -9; x < 10; x += 6) ctx.fillRect(x, -6, 3, 21);
    ctx.restore();
  },
  sunflowerSeeds(ctx) {
    bowl(ctx, "#8a7a5a", "#c89a6a");
    for (const [x, y, r] of [[-5, -3, 0.4], [0, -4, -0.3], [5, -3, 0.6], [-2, -1, 1], [3, -1, -0.8]]) {
      ellipse(ctx, x, y, 1.4, 2.6, r);
      paint(ctx, "#5a4a3a", { width: 0.5 });
      line(ctx, "#e8e0d0", 0.5, x, y - 2, x, y + 2);
    }
  },
  pumpkinPie: (ctx) => pieSlice(ctx, "#e0883a"),
  starfruitTart(ctx) {
    plate(ctx);
    ellipse(ctx, 0, 0, 12, 6);
    paint(ctx, "#d8a05a");
    ellipse(ctx, 0, -1, 9.5, 4.5);
    flat(ctx, "#f8e8b0");
    for (const x of [-4.5, 0, 4.5]) {
      star(ctx, x, -1.5, 3.2, 5, 0.5);
      paint(ctx, "#f2d24a", { width: 0.6 });
    }
  },
  pumpkinSoup(ctx) {
    bowl(ctx, "#e8883a");
    ctx.fillStyle = "#f4f0e0";
    ctx.beginPath();
    ctx.arc(0, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [[-6, -2], [5, -1]]) {
      ellipse(ctx, x, y, 1.1, 1.8, 0.5);
      flat(ctx, "#6a8a3a");
    }
    steam(ctx);
  },
  risotto(ctx) {
    bowl(ctx, "#f4ecd4");
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 10; i++) {
      ellipse(ctx, -8 + (i % 5) * 4, -2.5 + Math.floor(i / 5) * 2, 1.4, 0.8, i);
      ctx.fill();
    }
    ctx.fillStyle = "#e8883a";
    for (const [x, y] of [[-3, -2], [4, -1]]) ctx.fillRect(x, y, 2, 2);
    steam(ctx, [0]);
  },
  grilledFish(ctx) {
    plate(ctx);
    line(ctx, "#a8784a", 1.6, -14, 5, 14, -6);
    ctx.save();
    ctx.translate(0, -1);
    ctx.rotate(-0.38);
    ctx.scale(0.8, 0.8);
    drawFish(ctx, "#b8844e");
    ctx.restore();
    for (const x of [-4, 0, 4]) line(ctx, "#5a3a1a", 1.2, x - 1, -4, x + 1, 2);
  },
  sushi(ctx) {
    plate(ctx, "#2a2a30");
    for (const [x, c] of [[-6, "#f08a6a"], [6, "#e8e0d8"]]) {
      rrect(ctx, x - 5, -2, 10, 7, 3);
      paint(ctx, "#fbf8f0", { width: 0.9 });
      ctx.beginPath();
      ctx.moveTo(x - 6, 0);
      ctx.quadraticCurveTo(x, -8, x + 6, 0);
      ctx.quadraticCurveTo(x, -3, x - 6, 0);
      paint(ctx, c, { width: 0.9 });
      if (c === "#f08a6a") for (const dx of [-2, 1]) line(ctx, "#fbd0c0", 0.8, x + dx, -4, x + dx + 2, -1.5);
    }
  },
  fishTacos(ctx) {
    plate(ctx);
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.bezierCurveTo(-12, -14, 12, -14, 12, 4);
    ctx.closePath();
    paint(ctx, "#f2d48a");
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.bezierCurveTo(-7, -7, 7, -7, 9, 1);
    flat(ctx, "#8fc06a");
    ctx.fillStyle = "#d8b07a";
    ctx.fillRect(-5, -4, 10, 3);
    ctx.fillStyle = "#e0503a";
    for (const x of [-4, 2]) ctx.fillRect(x, -5, 2, 2);
  },
  fishStew(ctx) {
    bowl(ctx, "#b8744a");
    ctx.fillStyle = "#f4ecd8";
    for (const [x, y] of [[-5, -2], [3, -1]]) {
      rrect(ctx, x, y - 1, 4, 2.5, 1);
      ctx.fill();
    }
    ctx.fillStyle = "#e8883a";
    ctx.fillRect(-1, -3, 2, 2);
    steam(ctx);
  },
  carpCurry(ctx) {
    ellipse(ctx, 0, 1, 14, 5);
    paint(ctx, "#e8b84a", { top: -4, bottom: 6 });
    ellipse(ctx, -5, 0, 5, 2.8);
    flat(ctx, "#fbf8f0");
    ctx.beginPath();
    ctx.moveTo(-14, 1);
    ctx.quadraticCurveTo(-13, 13, 0, 13);
    ctx.quadraticCurveTo(13, 13, 14, 1);
    ctx.quadraticCurveTo(0, 7, -14, 1);
    paint(ctx, "#5a8ac0", { top: 1, bottom: 13 });
    steam(ctx, [4]);
  },
  moonTea(ctx) {
    const g = ctx.createRadialGradient(0, 2, 2, 0, 2, 16);
    g.addColorStop(0, "rgba(220, 225, 255, 0.7)");
    g.addColorStop(1, "rgba(220, 225, 255, 0)");
    ctx.fillStyle = g;
    circle(ctx, 0, 2, 16);
    ctx.fill();
    cup(ctx, "#dce4ff", "#8a9ad0");
    ctx.fillStyle = "#fbf4c0";
    ctx.beginPath();
    ctx.arc(0, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    steam(ctx, [-2, 3]);
  },
};

// --- Boosts, and a few plain pictures ---
const OTHER = {
  "boost:cozy"(ctx) {
    cup(ctx, "#8a5a3a", "#d9785f");
    steam(ctx, [-3, 3]);
  },
  "boost:quickBite": (ctx) => BAIT.none(ctx),
  "boost:lucky"(ctx) {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + 0.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-8, -4, -6, -13, 0, -8);
      ctx.bezierCurveTo(6, -13, 8, -4, 0, 0);
      paint(ctx, "#6aa84a", { top: -12, bottom: 0, width: 1 });
      ctx.restore();
    }
    line(ctx, "#4a7a2a", 1.6, 0, 0, 3, 14);
  },
  "boost:greenThumb"(ctx) {
    ellipse(ctx, 0, 10, 10, 3.5);
    paint(ctx, "#8a5a3a", { top: 6, bottom: 14 });
    line(ctx, "#4a8a2a", 1.6, 0, 9, 0, -2);
    leaf(ctx, 0, -1, 10, -0.9);
    leaf(ctx, 0, -1, 10, 0.9);
  },
  book(ctx) {
    rrect(ctx, -11, -13, 22, 26, 2.5);
    paint(ctx, "#6a8a5a");
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(8, -11, 2.5, 22);
    rrect(ctx, -6, -7, 12, 6, 1);
    paint(ctx, "#f2e2c0", { width: 0.8 });
    line(ctx, "#c9a040", 1.2, -11, 8, 8, 8);
  },
  scroll(ctx) {
    rrect(ctx, -10, -11, 20, 22, 1.5);
    paint(ctx, "#f2e2c0");
    for (const y of [-11, 11]) {
      rrect(ctx, -12, y - 2.5, 24, 5, 2.5);
      paint(ctx, "#d8b882", { width: 1 });
    }
    for (const y of [-5, -1, 3]) line(ctx, "#a89070", 1, -6, y, 6, y);
    circle(ctx, 5, 7, 2.4);
    paint(ctx, "#c9574a", { width: 0.7 });
  },
  lock(ctx) {
    ctx.strokeStyle = "#8a929a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -4, 6, Math.PI, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(-6, 0);
    ctx.lineTo(-6, -4);
    ctx.stroke();
    rrect(ctx, -9, -1, 18, 14, 3);
    paint(ctx, "#e0ad4a");
    circle(ctx, 0, 5, 1.8);
    flat(ctx, "#6b4a2e");
  },
  unknown(ctx) {
    circle(ctx, 0, 0, 12);
    paint(ctx, "#e8dcc8");
    ctx.fillStyle = "#9a8a70";
    ctx.font = "bold 16px Quicksand, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, 1);
  },
  level(ctx) {
    star(ctx, 0, 1, 13, 5, 0.5);
    paint(ctx, "#f2c64a");
    shine(ctx, -4, -4);
  },
  pot(ctx) {
    ellipse(ctx, 0, -4, 13, 4);
    paint(ctx, "#6a6a70");
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-11, 9);
    ctx.quadraticCurveTo(0, 14, 11, 9);
    ctx.lineTo(12, -4);
    paint(ctx, "#8a8a92");
    for (const s of [-1, 1]) line(ctx, "#4a4a50", 2.2, s * 12, -2, s * 15, -1);
    steam(ctx, [-3, 3]);
  },
  basket(ctx) {
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.strokeStyle = "#8a5a2e";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-13, -2);
    ctx.lineTo(13, -2);
    ctx.lineTo(10, 12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    paint(ctx, "#c9924e");
    for (const y of [3, 8]) line(ctx, "#8a5a2e", 1, -11, y, 11, y);
  },
  bus(ctx) {
    rrect(ctx, -14, -9, 28, 18, 4);
    paint(ctx, "#f2ead8");
    ctx.fillStyle = "#3f8a86";
    ctx.fillRect(-14, 2, 28, 4);
    for (const x of [-10, -3, 4]) {
      rrect(ctx, x, -6, 5.5, 5, 1);
      flat(ctx, "#a8d0e0");
    }
    for (const x of [-8, 8]) {
      circle(ctx, x, 10, 3.2);
      paint(ctx, "#3a3a40");
    }
  },
};

// A few more pictures, for achievements and pop-ups.
Object.assign(OTHER, {
  raincloud(ctx) {
    ctx.beginPath();
    ctx.arc(-6, -2, 6, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(1, -6, 7.5, Math.PI, Math.PI * 1.9);
    ctx.arc(8, -1, 5.5, Math.PI * 1.4, Math.PI * 0.5);
    ctx.closePath();
    paint(ctx, "#dfe4ea");
    for (const x of [-6, 0, 6]) line(ctx, "#5a8ac0", 2, x, 7, x - 2, 13);
  },
  fortune(ctx) {
    ctx.beginPath();
    ctx.moveTo(-13, 3);
    ctx.bezierCurveTo(-12, -12, 12, -12, 13, 3);
    ctx.quadraticCurveTo(6, 0, 0, 8);
    ctx.quadraticCurveTo(-6, 0, -13, 3);
    paint(ctx, "#e8b464");
    rrect(ctx, -2, 3, 12, 4, 0.8);
    paint(ctx, "#fbf8f0", { width: 0.8 });
    line(ctx, "#c9574a", 0.9, 1, 5, 7, 5);
    shine(ctx, -5, -5);
  },
  gift(ctx) {
    rrect(ctx, -11, -3, 22, 16, 2);
    paint(ctx, "#6a9ab4");
    rrect(ctx, -12, -8, 24, 6, 2);
    paint(ctx, "#80b0c8");
    ctx.fillStyle = "#e8938a";
    ctx.fillRect(-2, -8, 4, 21);
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 5, -11, 5, 3, side * 0.5);
      paint(ctx, "#e8938a", { width: 1 });
    }
  },
  watering(ctx) {
    ctx.beginPath();
    ctx.arc(-2, -6, 6, Math.PI, 0);
    ctx.strokeStyle = "#5a7a8a";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    line(ctx, "#5a7a8a", 3, 7, 3, 14, -5);
    rrect(ctx, -11, -4, 18, 16, 3);
    paint(ctx, "#7aa0b8");
    ctx.fillStyle = "#7ab4e0";
    for (const [x, y] of [[15, -1], [13, 3], [16, 4]]) {
      ellipse(ctx, x, y, 1, 1.5);
      ctx.fill();
    }
    shine(ctx, -6, 0);
  },
  heart(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(-15, 2, -13, -12, -5, -11);
    ctx.bezierCurveTo(-2, -11, 0, -8, 0, -6);
    ctx.bezierCurveTo(0, -8, 2, -11, 5, -11);
    ctx.bezierCurveTo(13, -12, 15, 2, 0, 12);
    paint(ctx, "#e0506a");
    shine(ctx, -6, -6);
  },
  ribbon(ctx) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 2, 2);
      ctx.lineTo(side * 8, 15);
      ctx.lineTo(side * 4, 13);
      ctx.lineTo(side * 2, 16);
      ctx.lineTo(side * -1, 3);
      paint(ctx, "#c9574a", { width: 1 });
    }
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 6);
      ellipse(ctx, 0, -8.5, 3, 4);
      paint(ctx, "#e8b84a", { top: -13, bottom: -4, width: 0.8 });
      ctx.restore();
    }
    circle(ctx, 0, -2, 7);
    paint(ctx, "#f2d06a");
    circle(ctx, 0, -2, 4.5);
    flat(ctx, "#fbe8a8");
  },
});

// --- Putting it together ---
function drawPicture(ctx, key) {
  const [kind, id] = key.includes(":") ? key.split(":") : [null, key];
  if (OTHER[key]) return OTHER[key](ctx), true;
  if (!kind) return OTHER[id] ? (OTHER[id](ctx), true) : false;
  if (kind === "crop" && CROPS[id]) return CROPS[id](ctx), true;
  if (kind === "seed" && CROPS[id]) return seedPacket(ctx, id), true;
  if (kind === "fish") {
    if (SPECIAL_FISH[id]) return SPECIAL_FISH[id](ctx), true;
    const fish = CONFIG.fish.find((f) => f.id === id);
    if (fish) return drawFish(ctx, fish.color ?? "#6a8ab8", FISH_LOOK[id]), true;
  }
  if (kind === "bait" && BAIT[id]) return BAIT[id](ctx), true;
  if (kind === "rod") return drawRod(ctx, id), true;
  if (kind === "junk" && JUNK[id]) return JUNK[id](ctx), true;
  if (kind === "food" && FOOD[id]) return FOOD[id](ctx), true;
  if (kind === "dish" && DISHES[id]) return DISHES[id](ctx), true;
  return false;
}

export function hasPicture(key) {
  if (typeof key !== "string") return false;
  const test = document.createElement("canvas").getContext("2d");
  return drawPicture(test, key);
}

const cache = new Map();
// A picture as a canvas, `size` CSS pixels across (drawn sharp), or null
// if there's no picture by that name.
export function pictureCanvas(key, size = 24) {
  // Nest & Nook pieces are drawn with the house's own furniture drawings.
  if (key.startsWith("decor:") && DECOR[key.slice(6)]) {
    const d = DECOR[key.slice(6)];
    return portraitCanvas({ f: d.kind, w: d.w, h: d.h ?? 0.5, wall: d.wall, color: d.color }, size);
  }
  const id = key + "|" + size;
  let done = cache.get(id);
  if (done === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    const ctx = c.getContext("2d");
    ctx.translate(size, size);
    ctx.scale((size * 2) / 36, (size * 2) / 36);
    done = drawPicture(ctx, key) ? c : null;
    cache.set(id, done);
  }
  if (!done) return null;
  const out = document.createElement("canvas");
  out.width = out.height = size * 2;
  out.className = "item-picture";
  out.style.width = out.style.height = size + "px";
  out.getContext("2d").drawImage(done, 0, 0);
  return out;
}

// Puts a picture into `el` (emptying it first), or `key` as text if it
// isn't a picture.
export function setPicture(el, key, size = 24) {
  el.textContent = "";
  const c = typeof key === "string" ? pictureCanvas(key, size) : null;
  if (c) el.appendChild(c);
  else if (key) el.textContent = key;
}
