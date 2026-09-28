// Little tools every mini game shares (minigames.js, minigames-classic.js
// and cellar.js): a repeatable random number maker, and drawing a player
// as their real character (outfit, hat, accessories and name tag), using
// the house's own character drawing (render-characters.js).

// A repeatable random number maker from a seed, so everyone in a round
// gets the same layout.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws a player standing with their feet at (x, y) on `ctx`.
// `look` is a player as the house draws them (name, color, hat, shoes,
// glasses, face, scarf, backpack, earrings, title, admin). Options:
//   scale   how big (1 is house size)
//   moving  true for the walking bounce
//   tag     false to leave out the name tag
//   alpha   see-through (for a knocked-out or blinking player)
//   facing  -1 to face left (the body flips; the name tag doesn't)
export function drawHero(ctx, look, x, y, { scale = 1, moving = false, tag = true, alpha = 1, facing = 1 } = {}) {
  const p = { hat: "none", shoes: "none", glasses: "none", pet: "none", name: "", ...look, id: look?.id ?? "hero", x: 0, y: 0, moving, emote: null, bubble: null, typing: false, badge: null, asleep: null, seated: null, seatLift: 0, speaking: false, whisper: null, fishing: null, aura: null };
  const foot = playerFeet(p);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);
  ctx.translate(-foot.x, -foot.y);
  drawPlayerBody(ctx, p);
  ctx.restore();
  if (!tag || !p.name) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-foot.x, -foot.y);
  const headTop = foot.y - PLAYER_RADIUS * 2 - 10 - tagLiftFor(p.hat);
  drawPlayerTag(ctx, { p, cx: foot.x, headTop });
  ctx.restore();
}

// A soft shadow on the ground under something (x, y is where it touches).
export function softShadow(ctx, x, y, r) {
  ctx.fillStyle = "rgba(20, 10, 4, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}
