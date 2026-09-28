// The seven quick mini games (Update 10): Snowball Arena, Crumb Rush,
// Treasure Dive, The Scarecrow, Ghost Hunt, Night Meadow and Kitchen
// Rush. Each is a small function that draws on its own 480 by 320 "screen"
// (the frame in minigames.js stretches it to fill the whole window) and
// calls `done(score)` at the end. You play as your real character.
// (Cellar Crawl is bigger and lives in cellar.js.)
import { myWallet } from "./bank.js";
import { itemInfo } from "./basket.js";
import { drawHero } from "./game-kit.js";

const W = 480, H = 320; // (every quick game's screen, in its own pixels)

// --- Input, shared by the games ---
// Keys held while you play, and clicks (in the game's own pixels). The
// frame (minigames.js) collects them: `screen.keys`, `screen.clicks`,
// `screen.pointer`.
function reader(screen) {
  const down = screen.keys;
  return {
    down,
    clicks: screen.clicks,
    pointer: screen.pointer,
    left: () => down.has("arrowleft") || down.has("a"),
    right: () => down.has("arrowright") || down.has("d"),
    up: () => down.has("arrowup") || down.has("w"),
    downKey: () => down.has("arrowdown") || down.has("s"),
    stop() {},
  };
}

// Runs a game's frames until it says it's over (or the round is stopped).
// `step(dt, t)` moves things and returns true when the game ends; `draw(t)`
// paints. The score and time left go to the HUD (the house-style bar
// along the top of the screen).
function loop(screen, game, input, step, draw, score, done) {
  let last = performance.now(), frame = 0, over = false;
  const began = last;
  const tick = (now) => {
    if (over) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - began) / 1000;
    const ended = step(dt, t) || t >= game.seconds;
    const ctx = screen.begin();
    draw(ctx, t);
    screen.end();
    screen.hud({ score: score(), time: Math.max(0, 1 - t / game.seconds) });
    if (ended) {
      over = true;
      return done(score());
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    score,
    stop() {
      over = true;
      cancelAnimationFrame(frame);
    },
  };
}

// You, as your real character, with your feet at (x, y). `blink` makes
// you flicker (just hit), `tint` washes you in a color (frozen).
let screenLook = null;
function hero(ctx, x, y, { moving = false, blink = false, scale = 0.8, facing = 1 } = {}) {
  if (!screenLook) return;
  const t = performance.now() / 1000;
  drawHero(ctx, screenLook, x, y, { scale, moving, alpha: blink && Math.sin(t * 20) > 0 ? 0.35 : 1, facing });
}

// Little drawing helpers for the games: a soft shadow, and a round thing
// with a darker outline, lit from above.
function shadow(ctx, x, y, r) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}
function ball(ctx, x, y, r, color) {
  ctx.fillStyle = shadeColor(color, -60);
  ctx.beginPath();
  ctx.arc(x, y + 0.5, r + 1.2, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, shadeColor(color, 30));
  g.addColorStop(1, shadeColor(color, -15));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
// Walking (any arrow key held), for the walking bounce.
const walking = (input) => input.left() || input.right() || input.up() || input.downKey();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// A snow critter (Snowball Arena): a little bouncing snowman with coal
// eyes, a carrot nose and a scarf.
function snowCritter(ctx, c, t) {
  const bob = Math.abs(Math.sin(t * 5 + c.wob)) * 3;
  shadow(ctx, c.x, c.y, 12);
  ball(ctx, c.x, c.y - 9 - bob, 11, "#f8fbff");
  ball(ctx, c.x, c.y - 24 - bob, 8, "#f8fbff");
  ctx.fillStyle = "#c0392b"; // the scarf
  ctx.fillRect(c.x - 7, c.y - 18 - bob, 14, 3);
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(c.x - 4, c.y - 27 - bob, 2, 2);
  ctx.fillRect(c.x + 2, c.y - 27 - bob, 2, 2);
  ctx.fillStyle = "#e8883a";
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 24 - bob);
  ctx.lineTo(c.x + 7, c.y - 23 - bob);
  ctx.lineTo(c.x, c.y - 22 - bob);
  ctx.fill();
}

// --- The games ---
const GAMES = {
  // Snowball Arena: walk about a snowy courtyard, click to throw
  // snowballs at the snow critters. They lob snowballs back: a hit freezes
  // you for a moment.
  snowball(canvas, rng, game, done) {
    const input = reader(canvas);
    const me = { x: W / 2, y: H / 2, frozen: 0 };
    const critters = [];
    const shots = [];
    const drifts = Array.from({ length: 14 }, () => ({ x: rng() * W, y: 30 + rng() * (H - 40), r: 8 + rng() * 14 }));
    let score = 0, spawn = 0;
    const addCritter = () => {
      const side = Math.floor(rng() * 4);
      critters.push({ x: side === 0 ? -10 : side === 1 ? W + 10 : rng() * W, y: side === 2 ? 20 : side === 3 ? H + 10 : 30 + rng() * (H - 40), throwIn: 1.5 + rng() * 2, wob: rng() * 6 });
    };
    for (let i = 0; i < 3; i++) addCritter();
    const step = (dt, t) => {
      if (me.frozen > 0) me.frozen -= dt;
      else {
        const sp = 150 * dt;
        if (input.left()) me.x -= sp;
        if (input.right()) me.x += sp;
        if (input.up()) me.y -= sp;
        if (input.downKey()) me.y += sp;
      }
      me.x = Math.max(12, Math.min(W - 12, me.x));
      me.y = Math.max(34, Math.min(H - 10, me.y));
      for (const c of input.clicks.splice(0)) {
        const a = Math.atan2(c.y - me.y, c.x - me.x);
        shots.push({ x: me.x, y: me.y - 8, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, mine: true, life: 1.4 });
      }
      spawn -= dt;
      if (spawn <= 0 && critters.length < 3 + Math.floor(t / 15)) {
        addCritter();
        spawn = 1.2;
      }
      for (const c of critters) {
        const a = Math.atan2(me.y - c.y, me.x - c.x) + Math.sin(t * 2 + c.wob) * 0.8;
        const far = dist(c, me) > 120;
        c.x += Math.cos(a) * (far ? 45 : -20) * dt;
        c.y += Math.sin(a) * (far ? 45 : -20) * dt;
        // (Once they've walked in, they stay on the screen.)
        if (c.x > 14 && c.x < W - 14) c.inX = true;
        if (c.y > 40 && c.y < H - 10) c.inY = true;
        if (c.inX) c.x = Math.max(14, Math.min(W - 14, c.x));
        if (c.inY) c.y = Math.max(40, Math.min(H - 10, c.y));
        c.throwIn -= dt;
        if (c.throwIn <= 0) {
          const aim = Math.atan2(me.y - c.y, me.x - c.x);
          shots.push({ x: c.x, y: c.y - 10, vx: Math.cos(aim) * 150, vy: Math.sin(aim) * 150, mine: false, life: 3 });
          c.throwIn = 2.2 + rng() * 2.5;
        }
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        let hit = false;
        if (s.mine) {
          const c = critters.find((c) => dist(c, { x: s.x, y: s.y + 8 }) < 16);
          if (c) {
            critters.splice(critters.indexOf(c), 1);
            score++;
            hit = true;
          }
        } else if (me.frozen <= 0 && dist(me, { x: s.x, y: s.y + 8 }) < 13) {
          me.frozen = 0.9;
          hit = true;
        }
        if (hit || s.life <= 0) shots.splice(i, 1);
      }
      return false;
    };
    const draw = (ctx, t) => {
      ctx.fillStyle = "#e8f0f6";
      ctx.fillRect(0, 0, W, H);
      for (const d of drifts) {
        ctx.fillStyle = "rgba(170, 195, 215, 0.35)";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 3, d.r, d.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r, d.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const things = [...critters.map((c) => ({ y: c.y, draw: () => snowCritter(ctx, c, t) })), { y: me.y, draw: () => {
        shadow(ctx, me.x, me.y, 11);
        hero(ctx, me.x, me.y, { moving: me.frozen <= 0 && walking(input) });
        if (me.frozen > 0) {
          // Frozen: a frosty shell for a moment.
          ctx.fillStyle = "rgba(190, 228, 248, 0.55)";
          ctx.strokeStyle = "rgba(120, 180, 220, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(me.x, me.y - 16, 14, 19, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } }];
      things.sort((a, b) => a.y - b.y).forEach((x) => x.draw());
      for (const s of shots) {
        shadow(ctx, s.x, s.y + 10, 4);
        ball(ctx, s.x, s.y, 4, "#ffffff");
      }
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Crumb Rush: race round the kitchen floor picking up crumbs (golden ones
  // are worth three) while the robot vacuum hunts you down.
  crumbRush(canvas, rng, game, done) {
    const input = reader(canvas);
    const me = { x: 60, y: H - 50 };
    const vac = { x: W - 60, y: 60, bump: 0 };
    const crumbs = Array.from({ length: 40 }, (_, i) => ({ x: 20 + rng() * (W - 40), y: 40 + rng() * (H - 60), gold: i < 5 }));
    let score = 0;
    const step = (dt, t) => {
      const sp = 165 * dt;
      if (input.left()) me.x -= sp;
      if (input.right()) me.x += sp;
      if (input.up()) me.y -= sp;
      if (input.downKey()) me.y += sp;
      me.x = Math.max(12, Math.min(W - 12, me.x));
      me.y = Math.max(34, Math.min(H - 10, me.y));
      for (let i = crumbs.length - 1; i >= 0; i--) {
        if (dist(crumbs[i], me) < 14) {
          score += crumbs[i].gold ? 3 : 1;
          crumbs.splice(i, 1);
        }
      }
      if (vac.bump > 0) vac.bump -= dt;
      else {
        const a = Math.atan2(me.y - vac.y, me.x - vac.x) + Math.sin(t * 1.3) * 0.4;
        vac.x += Math.cos(a) * (70 + t * 1.5) * dt;
        vac.y += Math.sin(a) * (70 + t * 1.5) * dt;
        // (It hoovers up any crumbs it rolls over, too.)
        for (let i = crumbs.length - 1; i >= 0; i--) if (dist(crumbs[i], vac) < 18) crumbs.splice(i, 1);
        if (dist(vac, me) < 24) {
          score = Math.max(0, score - 2);
          vac.bump = 1.2;
          me.x += me.x < vac.x ? -40 : 40;
        }
      }
      return crumbs.length === 0;
    };
    const draw = (ctx, t) => {
      for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) {
        ctx.fillStyle = (x / 40 + y / 40) % 2 ? "#e8d4b8" : "#f4e6d0";
        ctx.fillRect(x, y, 40, 40);
      }
      for (const c of crumbs) {
        shadow(ctx, c.x, c.y + 3, 4);
        ball(ctx, c.x, c.y, c.gold ? 5 : 3.5, c.gold ? "#f2c94c" : "#c98f3c");
      }
      // The robot vacuum: a flat round disc with a bumper and a blinking light.
      shadow(ctx, vac.x, vac.y + 8, 18);
      ball(ctx, vac.x, vac.y, 17, "#5a5f6a");
      ctx.fillStyle = vac.bump > 0 ? "#e05a47" : Math.sin(t * 6) > 0 ? "#6fd8c8" : "#2e5a54";
      ctx.beginPath();
      ctx.arc(vac.x, vac.y - 6, 3, 0, Math.PI * 2);
      ctx.fill();
      shadow(ctx, me.x, me.y + 10, 11);
      hero(ctx, me.x, me.y + 10, { moving: walking(input) });
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Treasure Dive: swim the deep end for coins (1) and pearls (3). Space or
  // up swims you up, you sink slowly otherwise. Watch your air: the surface
  // and bubbles refill it. Jellyfish sting (and knock off two).
  treasureDive(canvas, rng, game, done) {
    const input = reader(canvas);
    const me = { x: W / 2, y: 40, vy: 0, air: 1, sting: 0 };
    const loot = Array.from({ length: 26 }, (_, i) => ({ x: 20 + rng() * (W - 40), y: 90 + rng() * (H - 120), pearl: i < 6 }));
    const jellies = Array.from({ length: 5 }, () => ({ x: rng() * W, y: 100 + rng() * (H - 140), v: (rng() < 0.5 ? -1 : 1) * (30 + rng() * 30), ph: rng() * 6 }));
    const bubbles = [];
    let score = 0, bubbleIn = 0;
    const step = (dt, t) => {
      if (input.up() || input.down.has(" ")) me.vy -= 360 * dt;
      me.vy += 110 * dt;
      me.vy = Math.max(-160, Math.min(90, me.vy));
      me.y += me.vy * dt;
      if (input.left()) me.x -= 130 * dt;
      if (input.right()) me.x += 130 * dt;
      me.x = Math.max(12, Math.min(W - 12, me.x));
      if (me.y < 40) (me.y = 40), (me.vy = Math.max(0, me.vy));
      if (me.y > H - 14) (me.y = H - 14), (me.vy = 0);
      me.air = me.y < 48 ? Math.min(1, me.air + dt * 0.6) : me.air - dt * 0.07;
      if (me.air <= 0) {
        // (Out of air: dropped three points, and back up to the surface,
        // dizzy for a couple of seconds.)
        score = Math.max(0, score - 3);
        me.y = 40;
        me.vy = 0;
        me.air = 0.5;
        me.sting = 2;
      }
      if (me.sting > 0) me.sting -= dt;
      for (let i = loot.length - 1; i >= 0; i--) {
        if (dist(loot[i], me) < 15) {
          score += loot[i].pearl ? 3 : 1;
          loot.splice(i, 1);
        }
      }
      for (const j of jellies) {
        j.x += j.v * dt;
        if (j.x < -20) j.x = W + 20;
        if (j.x > W + 20) j.x = -20;
        const jy = j.y + Math.sin(t * 1.5 + j.ph) * 12;
        if (me.sting <= 0 && dist({ x: j.x, y: jy }, me) < 18) {
          score = Math.max(0, score - 2);
          me.sting = 1.2;
        }
      }
      bubbleIn -= dt;
      if (bubbleIn <= 0) {
        bubbles.push({ x: 20 + rng() * (W - 40), y: H + 10 });
        bubbleIn = 2.5 + rng() * 2;
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        bubbles[i].y -= 40 * dt;
        if (dist(bubbles[i], me) < 16) {
          me.air = Math.min(1, me.air + 0.35);
          bubbles.splice(i, 1);
        } else if (bubbles[i].y < 40) bubbles.splice(i, 1);
      }
      return loot.length === 0;
    };
    const draw = (ctx, t) => {
      const sea = ctx.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, "#5ab0d0");
      sea.addColorStop(1, "#1a3a5a");
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(0, 36, W, 2);
      ctx.fillStyle = "#c8b48a"; // the sandy bottom
      ctx.fillRect(0, H - 8, W, 8);
      for (const l of loot) {
        if (l.pearl) {
          ball(ctx, l.x, l.y, 5, "#f4f0f8");
        } else ball(ctx, l.x, l.y, 4.5, "#f2c94c");
      }
      for (const b of bubbles) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const j of jellies) {
        const jy = j.y + Math.sin(t * 1.5 + j.ph) * 12;
        ctx.fillStyle = "rgba(230, 150, 210, 0.8)";
        ctx.beginPath();
        ctx.arc(j.x, jy, 11, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(230, 150, 210, 0.7)";
        ctx.lineWidth = 1.5;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(j.x + k * 4, jy);
          ctx.quadraticCurveTo(j.x + k * 4 + Math.sin(t * 4 + k) * 3, jy + 9, j.x + k * 4, jy + 16);
          ctx.stroke();
        }
      }
      hero(ctx, me.x, me.y + 12, { blink: me.sting > 0, moving: true });
      ctx.fillStyle = "#cfe6ee"; // goggles
      ctx.fillRect(me.x - 7, me.y - 5, 14, 5);
      // The air bar.
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(10, 26, 104, 10);
      ctx.fillStyle = me.air < 0.25 ? "#e05a47" : "#8fd0f0";
      ctx.fillRect(12, 28, 100 * Math.max(0, me.air), 6);
      ctx.fillStyle = "#fff7e6";
      ctx.font = "700 9px 'Quicksand', sans-serif";
      ctx.fillText("AIR", 118, 35);
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // The Scarecrow: sneak across the field while it looks away. It wobbles
  // just before it turns; if it sees you move, back to the start. Every
  // time you reach it is a point.
  scarecrow(canvas, rng, game, done) {
    const input = reader(canvas);
    const start = { x: W / 2, y: H - 24 };
    const me = { ...start };
    const crow = { watching: false, next: 2 + rng() * 2, warn: false };
    let score = 0, caught = 0;
    const step = (dt) => {
      const moving = input.left() || input.right() || input.up() || input.downKey();
      if (caught > 0) caught -= dt;
      else {
        const sp = 90 * dt;
        if (input.left()) me.x -= sp;
        if (input.right()) me.x += sp;
        if (input.up()) me.y -= sp;
        if (input.downKey()) me.y += sp;
      }
      me.x = Math.max(14, Math.min(W - 14, me.x));
      me.y = Math.max(40, Math.min(H - 14, me.y));
      crow.next -= dt;
      crow.warn = !crow.watching && crow.next < 0.45;
      if (crow.next <= 0) {
        crow.watching = !crow.watching;
        crow.next = crow.watching ? 1.2 + rng() * 1.6 : 1.4 + rng() * 2.6;
        crow.grace = crow.watching ? 0.25 : 0; // (a moment to let go of the keys)
      }
      if (crow.grace > 0) crow.grace -= dt;
      if (crow.watching && crow.grace <= 0 && moving && caught <= 0 && me.y < start.y - 4) {
        caught = 0.8;
        Object.assign(me, start);
      }
      if (me.y < 100 && Math.abs(me.x - W / 2) < 40) {
        score++;
        Object.assign(me, start);
      }
      return false;
    };
    const draw = (ctx, t) => {
      ctx.fillStyle = "#a8c878";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(90, 120, 60, 0.4)";
      ctx.lineWidth = 2;
      for (let y = 50; y < H; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // The scarecrow at the top: facing away (a straw back) or watching
      // (a stitched face), and wobbling just before it turns.
      // (Watching: the whole field goes a little red.)
      if (crow.watching) {
        ctx.fillStyle = "rgba(224, 90, 71, 0.18)";
        ctx.fillRect(0, 0, W, H);
      }
      const x = W / 2 + (crow.warn ? Math.sin(t * 40) * 3 : 0), y = 84;
      shadow(ctx, x, y + 4, 16);
      ctx.fillStyle = "#6b4a30";
      ctx.fillRect(x - 2, y - 34, 4, 38);
      ctx.fillRect(x - 22, y - 26, 44, 4);
      ball(ctx, x, y - 20, 10, "#c0392b"); // its shirt
      ball(ctx, x, y - 38, 9, "#e8d4a0"); // its sack head
      ctx.fillStyle = "#c9a45a"; // the hat
      ctx.fillRect(x - 13, y - 47, 26, 4);
      ctx.fillRect(x - 7, y - 55, 14, 9);
      if (crow.watching) {
        ctx.fillStyle = "#2a1a10";
        ctx.fillRect(x - 5, y - 40, 3, 3);
        ctx.fillRect(x + 2, y - 40, 3, 3);
        ctx.fillRect(x - 4, y - 34, 8, 1.5);
      }
      const label = crow.watching ? "FREEZE!" : crow.warn ? "IT'S TURNING!" : "SNEAK";
      ctx.font = "800 18px 'Quicksand', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(30, 20, 10, 0.6)";
      ctx.strokeText(label, W / 2, 124);
      ctx.fillStyle = crow.watching ? "#ff6a50" : crow.warn ? "#ffd84a" : "#e8ffd0";
      ctx.fillText(label, W / 2, 124);
      ctx.textAlign = "left";
      shadow(ctx, me.x, me.y + 10, 10);
      hero(ctx, me.x, me.y + 10, { blink: caught > 0, moving: walking(input) });
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Ghost Hunt: a dark parlor. Your flashlight follows the mouse; ghosts
  // only show in its beam. Hold the light on one until it's caught. Some
  // are jumpy (red eyes): catch those in the light too long and they give
  // you a fright (two points off).
  ghostHunt(canvas, rng, game, done) {
    const input = reader(canvas);
    const ghosts = [];
    let score = 0, fright = 0, spawn = 0;
    const add = () => ghosts.push({ x: 40 + rng() * (W - 80), y: 60 + rng() * (H - 100), vx: (rng() - 0.5) * 50, vy: (rng() - 0.5) * 40, lit: 0, jumpy: rng() < 0.25, ph: rng() * 6 });
    for (let i = 0; i < 4; i++) add();
    const furniture = Array.from({ length: 6 }, () => ({ x: 20 + rng() * (W - 80), y: 70 + rng() * (H - 120), w: 40 + rng() * 40, h: 20 + rng() * 20 }));
    const inBeam = (g) => dist(g, input.pointer) < 60;
    const step = (dt, t) => {
      if (fright > 0) fright -= dt;
      spawn -= dt;
      if (spawn <= 0 && ghosts.length < 4 + Math.floor(t / 20)) {
        add();
        spawn = 1.5;
      }
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i];
        g.x += (g.vx + Math.sin(t * 1.3 + g.ph) * 25) * dt;
        g.y += (g.vy + Math.cos(t * 1.1 + g.ph) * 18) * dt;
        if (g.x < 20 || g.x > W - 20) g.vx *= -1;
        if (g.y < 40 || g.y > H - 20) g.vy *= -1;
        g.x = Math.max(20, Math.min(W - 20, g.x));
        g.y = Math.max(40, Math.min(H - 20, g.y));
        if (fright <= 0 && inBeam(g)) g.lit += dt;
        else g.lit = Math.max(0, g.lit - dt * 0.5);
        if (g.jumpy && g.lit > 0.7) {
          ghosts.splice(i, 1);
          score = Math.max(0, score - 2);
          fright = 1.2;
        } else if (!g.jumpy && g.lit > 0.9) {
          ghosts.splice(i, 1);
          score++;
        } else if (g.jumpy && g.lit > 0.35 && input.clicks.length) {
          // (Click a jumpy one while it's lit to catch it before it jumps.)
          ghosts.splice(i, 1);
          score++;
        }
      }
      for (const c of input.clicks) Object.assign(input.pointer, c);
      input.clicks.length = 0;
      return false;
    };
    const draw = (ctx, t) => {
      ctx.fillStyle = "#2a2233";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3a2e40"; // the old wallpaper's stripes
      for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 12, 60);
      for (const f of furniture) {
        shadow(ctx, f.x + f.w / 2, f.y + f.h + 2, f.w / 2 + 2);
        ctx.fillStyle = "#1a141e";
        ctx.fillRect(f.x - 1, f.y - 1, f.w + 2, f.h + 2);
        ctx.fillStyle = "#4a3a4e";
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(f.x, f.y + f.h * 0.6, f.w, f.h * 0.4);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(f.x, f.y, f.w, 2);
      }
      // The ghosts (only in the beam).
      for (const g of ghosts) {
        const seen = Math.max(0, 1 - dist(g, input.pointer) / 90);
        if (seen <= 0) continue;
        ctx.globalAlpha = seen;
        const bob = Math.sin(t * 3 + g.ph) * 3;
        ctx.fillStyle = "#f0f0fa";
        ctx.beginPath();
        ctx.arc(g.x, g.y - 6 + bob, 13, Math.PI, 0);
        ctx.lineTo(g.x + 13, g.y + 10 + bob);
        for (let k = 0; k < 4; k++) ctx.lineTo(g.x + 13 - (k + 0.5) * 6.5, g.y + (k % 2 ? 10 : 5) + bob);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(90, 80, 120, 0.6)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = g.jumpy ? "#e05a47" : "#2a2438";
        ctx.fillRect(g.x - 5, g.y - 8 + bob, 3, 4);
        ctx.fillRect(g.x + 2, g.y - 8 + bob, 3, 4);
        // The meter: yellow fills to a catch; red (a jumpy one) fills to a
        // fright, and says CLICK! while a click would catch it.
        ctx.fillStyle = g.jumpy ? "#e05a47" : "#f2c94c";
        ctx.fillRect(g.x - 12, g.y - 26 + bob, 24 * Math.min(1, g.lit / (g.jumpy ? 0.7 : 0.9)), 3);
        if (g.jumpy && g.lit > 0.35) {
          ctx.fillStyle = "#ffd84a";
          ctx.font = "800 11px 'Quicksand', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("CLICK!", g.x, g.y - 32 + bob);
          ctx.textAlign = "left";
        }
        ctx.globalAlpha = 1;
      }
      // Darkness everywhere but the beam.
      const beam = ctx.createRadialGradient(input.pointer.x, input.pointer.y, 30, input.pointer.x, input.pointer.y, 110);
      beam.addColorStop(0, "rgba(10, 8, 16, 0)");
      beam.addColorStop(1, "rgba(10, 8, 16, 0.8)");
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, W, H);
      // You, at the bottom of the parlor, holding the flashlight.
      const hx = W / 2, hy = H - 6;
      ctx.strokeStyle = "rgba(255, 240, 190, 0.12)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(hx + 8, hy - 18);
      ctx.lineTo(input.pointer.x, input.pointer.y);
      ctx.stroke();
      hero(ctx, hx, hy, { scale: 0.9, facing: input.pointer.x < hx ? -1 : 1 });
      if (fright > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${fright * 0.4})`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#e05a47";
        ctx.font = "800 26px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("BOO!", W / 2, H / 2);
        ctx.textAlign = "left";
      }
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Night Meadow: fireflies drift over tall grass, blinking on and off.
  // Click one while it's glowing to net it; now and then a golden moth
  // flutters by, worth three.
  nightMeadow(canvas, rng, game, done) {
    const input = reader(canvas);
    let heroX = W / 2;
    const flies = [];
    const grass = Array.from({ length: 60 }, () => ({ x: rng() * W, h: 20 + rng() * 40, lean: rng() - 0.5 }));
    let score = 0, spawn = 0, nets = [];
    const add = (gold = false) => flies.push({ x: rng() * W, y: 60 + rng() * (H - 120), vx: (rng() - 0.5) * 40, vy: (rng() - 0.5) * 20, ph: rng() * 6, rate: 1.2 + rng() * 1.5, gold });
    for (let i = 0; i < 8; i++) add();
    const lit = (f, t) => f.gold || Math.sin(t * f.rate + f.ph) > 0.1;
    const step = (dt, t) => {
      spawn -= dt;
      if (spawn <= 0 && flies.length < 12) {
        add(rng() < 0.08);
        spawn = 0.8;
      }
      for (const f of flies) {
        f.x += (f.vx + Math.sin(t + f.ph) * 15) * dt * (f.gold ? 2 : 1);
        f.y += (f.vy + Math.cos(t * 0.8 + f.ph) * 10) * dt;
        if (f.x < 10 || f.x > W - 10) f.vx *= -1;
        if (f.y < 40 || f.y > H - 50) f.vy *= -1;
        f.x = Math.max(10, Math.min(W - 10, f.x));
        f.y = Math.max(40, Math.min(H - 50, f.y));
      }
      for (const c of input.clicks.splice(0)) {
        nets.push({ x: c.x, y: c.y, at: t });
        const hit = flies.find((f) => lit(f, t) && dist(f, c) < 22);
        if (hit) {
          flies.splice(flies.indexOf(hit), 1);
          score += hit.gold ? 3 : 1;
        }
      }
      nets = nets.filter((n) => t - n.at < 0.3);
      return false;
    };
    const draw = (ctx, t) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#141a33");
      sky.addColorStop(1, "#2a3a4a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f4f0dc"; // the moon
      ctx.beginPath();
      ctx.arc(W - 60, 60, 18, 0, Math.PI * 2);
      ctx.fill();
      for (const f of flies) {
        const on = lit(f, t);
        if (on) {
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.gold ? 18 : 12);
          g.addColorStop(0, f.gold ? "rgba(255, 210, 90, 0.9)" : "rgba(220, 255, 120, 0.9)");
          g.addColorStop(1, "rgba(220, 255, 120, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(f.x - 18, f.y - 18, 36, 36);
        }
        ctx.fillStyle = f.gold ? "#e8b43a" : on ? "#f0ff9a" : "#3a4a3a";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.gold ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // You, wading through the grass with your net (following the mouse).
      heroX += (Math.max(20, Math.min(W - 20, input.pointer.x)) - heroX) * 0.08;
      hero(ctx, heroX, H - 8, { scale: 0.9, moving: Math.abs(input.pointer.x - heroX) > 6, facing: input.pointer.x < heroX ? -1 : 1 });
      ctx.strokeStyle = "#2e4a34"; // the tall grass in front
      ctx.lineWidth = 2;
      for (const g of grass) {
        ctx.beginPath();
        ctx.moveTo(g.x, H);
        ctx.quadraticCurveTo(g.x + g.lean * 10, H - g.h / 2, g.x + g.lean * 16 + Math.sin(t + g.x) * 2, H - g.h);
        ctx.stroke();
      }
      for (const n of nets) {
        ctx.strokeStyle = `rgba(240, 230, 210, ${1 - (t - n.at) / 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Kitchen Rush: orders for dishes from your own recipe book (or the
  // simplest ones, if your book is thin). Click what each one needs into
  // the pot, in any order; a wrong ingredient spills it. Points: the
  // ingredients in each dish you finish.
  kitchenRush(canvas, rng, game, done) {
    const input = reader(canvas);
    const all = CONFIG.kitchen.recipes;
    const known = new Set(myWallet().recipes ?? []);
    let book = all.filter((r) => known.has(r.id));
    if (book.length < 3) book = [...book, ...[...all].sort((a, b) => a.ingredients.length - b.ingredients.length).filter((r) => !known.has(r.id))].slice(0, 5);
    const nameOf = (id) => (id === "fish" ? "Any fish" : itemInfo(id).name);
    let order = null, pot = [], score = 0, spill = 0, served = 0;
    let bins = [];
    const nextOrder = () => {
      order = book[Math.floor(rng() * book.length)];
      pot = [];
      // The bins: what it needs, plus a few things it doesn't.
      const anyFish = order.ingredients.includes("fish");
      const decoys = [...new Set(all.flatMap((r) => r.ingredients))].filter((id) => !order.ingredients.includes(id) && !(anyFish && id.startsWith("fish:")) && !(id === "fish" && order.ingredients.some((x) => x.startsWith("fish:"))));
      const pick = [...new Set(order.ingredients)];
      while (pick.length < 6 && decoys.length) pick.push(decoys.splice(Math.floor(rng() * decoys.length), 1)[0]);
      pick.sort(() => rng() - 0.5);
      bins = pick.map((id, i) => ({ id, x: 16 + (i % 3) * 152, y: 190 + Math.floor(i / 3) * 62, w: 144, h: 54 }));
    };
    nextOrder();
    const step = (dt) => {
      if (spill > 0) spill -= dt;
      if (served > 0) served -= dt;
      for (const c of input.clicks.splice(0)) {
        const bin = bins.find((b) => c.x > b.x && c.x < b.x + b.w && c.y > b.y && c.y < b.y + b.h);
        if (!bin || spill > 0) continue;
        const needed = order.ingredients.filter((id) => id === bin.id).length;
        const inPot = pot.filter((id) => id === bin.id).length;
        if (inPot < needed) {
          pot.push(bin.id);
          if (pot.length === order.ingredients.length) {
            score += order.ingredients.length;
            served = 0.8;
            nextOrder();
          }
        } else {
          spill = 0.8;
          pot = [];
        }
      }
      return false;
    };
    const draw = (ctx) => {
      ctx.fillStyle = "#f4e6d0";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e8d4b8";
      for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, 180);
      // The order ticket.
      ctx.fillStyle = "rgba(60, 40, 20, 0.15)";
      ctx.fillRect(19, 36, 220, 140);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(16, 32, 220, 140);
      ctx.strokeStyle = "#a8906a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16.5, 32.5, 219, 139);
      ctx.fillStyle = "#6a4a30";
      ctx.font = "800 15px 'Quicksand', sans-serif";
      ctx.fillText(order.name, 28, 56);
      ctx.font = "600 12px 'Quicksand', sans-serif";
      order.ingredients.forEach((id, i) => {
        const have = pot.filter((x) => x === id).length > order.ingredients.slice(0, i).filter((x) => x === id).length;
        // (A filled green dot once it's in the pot, an empty one before.)
        ctx.strokeStyle = have ? "#5fa052" : "#a08a6a";
        ctx.fillStyle = "#5fa052";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(34, 76 + i * 18, 4, 0, Math.PI * 2);
        if (have) ctx.fill();
        ctx.stroke();
        ctx.fillStyle = have ? "#5fa052" : "#6a4a30";
        ctx.fillText(nameOf(id), 44, 80 + i * 18);
      });
      // The pot, and you, the cook, beside it.
      const px = 340, py = 110;
      hero(ctx, px + 78, py + 28, { scale: 1 });
      shadow(ctx, px, py + 30, 54);
      ctx.fillStyle = spill > 0 ? "#8a4a3a" : "#4a4a52";
      ctx.beginPath();
      ctx.ellipse(px, py + 10, 56, 34, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#6a6a72";
      ctx.beginPath();
      ctx.ellipse(px, py + 10, 56, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spill > 0 ? "#c8603a" : served > 0 ? "#f2c94c" : pot.length ? "#e8a860" : "#3a3a42";
      ctx.beginPath();
      ctx.ellipse(px, py + 10, 48, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a4a30";
      ctx.font = "800 13px 'Quicksand', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(spill > 0 ? "Spilled! Start again." : served > 0 ? "Order up!" : `${pot.length} of ${order.ingredients.length} in`, px, py + 64);
      ctx.textAlign = "left";
      // The bins.
      for (const b of bins) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(b.x + 2, b.y + 4, b.w, b.h);
        ctx.fillStyle = "#c9a27a";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "rgba(90, 60, 30, 0.25)"; // the bin's shaded lower half
        ctx.fillRect(b.x, b.y + b.h * 0.6, b.w, b.h * 0.4);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(b.x, b.y, b.w, 2);
        ctx.strokeStyle = "#8a6444";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x + 0.75, b.y + 0.75, b.w - 1.5, b.h - 1.5);
        ctx.fillStyle = "#3a2a1c";
        ctx.font = "700 12px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(nameOf(b.id), b.x + b.w / 2, b.y + b.h / 2 + 4);
        ctx.textAlign = "left";
      }
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },
};

// Starts one of the quick games on the frame's screen. Returns { stop,
// score } (or null for a game that isn't here).
export function startClassic(id, screen, rng, game, done) {
  if (!Object.hasOwn(GAMES, id)) return null;
  screenLook = screen.look;
  return GAMES[id](screen, rng, game, done);
}
export const CLASSIC_SIZE = { w: W, h: H };
