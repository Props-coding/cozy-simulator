// Mini games (Update 10), behind the doors on the Games floor's corridor.
//
// Every game plugs into the same frame:
// - The door (press E): the lobby. The game's blurb and how to play, and
//   who's standing at the door with you. Anyone can press Start.
// - A round: everyone in the lobby gets the same 3-2-1 countdown and plays
//   the same round (the same layout, from one shared seed), each on their
//   own screen, for the highest score. Alone, it's just you.
// - The results: everyone's scores for the round, crumbs from the house
//   server (checked against the time played, with a daily cap: config.js
//   minigames), then play again or back to the floor.
// Part 1 has four games: Snowball Arena, Crumb Rush, Treasure Dive and The
// Scarecrow. Each is a small function that draws on the round's canvas
// and calls `done(score)` at the end (see GAMES below).
import { bank, myWallet } from "./bank.js";
import { getPeers, sendGames, onGames } from "./network.js";
import { openExtrasPanel, closeExtras } from "./extras.js";
import { playClickSound, playCrumbSound, playAchievementSound } from "./audio.js";
import { unlock } from "./achievements.js";

let hooks = { notice: () => {}, name: () => "You", color: () => "#e05a47" };
export function initMinigames(options) {
  hooks = { ...hooks, ...options };
}

const info = (id) => CONFIG.minigames.games.find((g) => g.id === id);
const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
const W = 480, H = 320; // (every game's screen, in its own pixels)

// A repeatable random number maker from a seed, so everyone in a round
// gets the same layout.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The lobby ---
let lobby = null; // { game, el, round, players, results, stop }

export function portalHint(f) {
  const game = info(f.game);
  if (!game) return "";
  return game.soon ? `${game.name}: the door is still being painted. Coming soon!` : `Press E for ${game.name}.`;
}

export function openPortal(f) {
  const game = info(f?.game);
  if (!game) return;
  if (game.soon) return hooks.notice(`${game.name}: the door is still being painted. Coming soon!`);
  openExtrasPanel(game.name, (el) => showLobby(el, game), () => {
    lobby?.stop?.();
    lobby = null;
  });
}

// Friends standing at this game's door (on the Games floor, a few steps away).
function friendsAtDoor(game) {
  const door = FURNITURE.find((f) => f.kind === "gamePortal" && f.game === game.id);
  if (!door) return [];
  return getPeers().filter((p) => floorOf(p.y) === GAMES_FLOOR && Math.abs(p.x - (door.x + door.w / 2)) < 2.5 && p.y - door.y < 3);
}

function showLobby(el, game) {
  lobby?.stop?.();
  el.textContent = "";
  const blurb = make("p", "", game.blurb);
  const how = make("p", "tv-small", game.how);
  const who = make("ul", "mini-who");
  const start = make("button", "warm-button", "Start");
  start.type = "button";
  const best = myWallet().minis?.best?.[game.id];
  const note = make("p", "tv-small", `${best ? `Your best: ${best}. ` : ""}Crumbs for your score, up to ${game.maxCrumbs} a round (and ${CONFIG.minigames.crumbsPerDay} a day from all the games).`);
  el.append(blurb, how, make("p", "tv-small", "At the door:"), who, note, start);
  const refresh = () => {
    who.textContent = "";
    who.appendChild(make("li", "", `${hooks.name()} (you)`));
    for (const p of friendsAtDoor(game)) who.appendChild(make("li", "", p.name));
  };
  refresh();
  const timer = setInterval(refresh, 1000);
  lobby = { game, el, stop: () => clearInterval(timer) };
  start.addEventListener("click", () => {
    playClickSound();
    // Everyone at the door plays this round too (they see the countdown
    // if their lobby's open).
    const friends = friendsAtDoor(game);
    const round = { id: Math.random().toString(36).slice(2, 10), seed: Math.floor(Math.random() * 1e9), game: game.id, host: hooks.name() };
    sendGames({ type: "start", ...round }, friends.map((p) => p.id));
    playRound(game, round, friends.map((p) => p.id));
  });
}

// Messages from friends' games.
onGames((message, peerId) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "start" && lobby && !lobby.round && lobby.game.id === message.game) {
    // (A friend pressed Start at the door we're at: join their round.)
    const others = [peerId, ...friendsAtDoor(lobby.game).map((p) => p.id).filter((id) => id !== peerId)];
    playRound(lobby.game, { id: String(message.id), seed: Number(message.seed) >>> 0, game: lobby.game.id, host: String(message.host ?? "a friend").slice(0, 24) }, others);
  }
  if (message.type === "result" && lobby?.round && lobby.round.id === message.round) {
    lobby.results.set(String(message.name ?? "?").slice(0, 24), Math.max(0, Math.floor(Number(message.score) || 0)));
    lobby.showResults?.();
  }
});

// --- A round ---
function playRound(game, round, peerIds) {
  const el = lobby.el;
  lobby.stop?.();
  el.textContent = "";
  const canvas = make("canvas", "mini-screen");
  canvas.width = W;
  canvas.height = H;
  canvas.tabIndex = 0;
  const hud = make("p", "tv-small", round.host === hooks.name() ? "Get ready..." : `${round.host} started a round. Get ready...`);
  el.append(hud, canvas);
  const results = new Map();
  const state = { stopped: false, game: null };
  lobby = { ...lobby, round, players: peerIds, results, stop: () => ((state.stopped = true), state.game?.stop()) };
  const ctx = canvas.getContext("2d");
  // The countdown (and a moment for everything to load).
  const began = performance.now();
  const countdown = () => {
    if (state.stopped) return;
    const left = 3 - Math.floor((performance.now() - began) / 1000);
    ctx.fillStyle = "#1c1a28";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = game.color;
    ctx.font = "800 26px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(game.name.toUpperCase(), W / 2, H / 2 - 30);
    ctx.fillStyle = "#fff7e6";
    ctx.font = "800 56px 'Quicksand', sans-serif";
    ctx.fillText(left > 0 ? String(left) : "GO!", W / 2, H / 2 + 36);
    ctx.textAlign = "left";
    if (left > 0) return void requestAnimationFrame(countdown);
    go();
  };
  const go = async () => {
    const started = await bank("miniStart", { game: game.id });
    if (state.stopped || !canvas.isConnected) return;
    canvas.focus();
    hud.textContent = game.how;
    state.game = GAMES[game.id](canvas, seeded(round.seed), game, async (score) => {
      if (state.stopped) return;
      const got = started?.id ? await bank("miniEnd", { id: started.id, score }) : null;
      results.set(hooks.name(), got?.score ?? score);
      sendGames({ type: "result", round: round.id, name: hooks.name(), score: got?.score ?? score }, peerIds);
      showResults(game, round, got, el);
    });
  };
  countdown();
}

function showResults(game, round, got, el) {
  const draw = () => {
    if (!lobby || lobby.round !== round) return;
    el.textContent = "";
    const mine = lobby.results.get(hooks.name()) ?? 0;
    el.appendChild(make("h3", "mini-score", `Your score: ${mine}`));
    el.appendChild(make("p", "", got ? (got.crumbs ? `+${got.crumbs} crumbs${got.best ? ". A new personal best!" : "."}` : got.capped ? "That's all the crumbs the games pay today. Play on for fun!" : "No crumbs this time. Have another go!") : "(No crumbs: the house server didn't answer.)"));
    const rows = [...lobby.results.entries()].sort((a, b) => b[1] - a[1]);
    if (rows.length > 1 || lobby.players.length) {
      el.appendChild(make("p", "tv-small", "This round:"));
      const list = make("ol", "mini-results");
      for (const [name, score] of rows) list.appendChild(make("li", name === hooks.name() ? "me" : "", `${name}  ${score}`));
      el.appendChild(list);
      if (lobby.players.length && rows.length === lobby.players.length + 1 && rows[0][0] === hooks.name()) {
        unlock("miniChampion");
        playAchievementSound();
      }
    }
    const row = make("div", "book-top");
    const again = make("button", "warm-button", "Play again");
    again.type = "button";
    again.addEventListener("click", () => {
      playClickSound();
      showLobby(el, game);
    });
    const back = make("button", "soft-button", "Back to the floor");
    back.type = "button";
    back.addEventListener("click", () => {
      playClickSound();
      closeExtras();
    });
    row.append(back, again);
    el.appendChild(row);
  };
  lobby.showResults = draw;
  if (got?.crumbs) playCrumbSound();
  draw();
}

// --- Input, shared by the games ---
// Keys held on the game's screen (it has the focus while you play), and
// clicks on it (in the game's own pixels).
function reader(canvas) {
  const down = new Set();
  const clicks = [];
  const on = (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d"].includes(k)) e.preventDefault();
    down.add(k);
  };
  const off = (e) => down.delete(e.key.toLowerCase());
  const click = (e) => {
    const r = canvas.getBoundingClientRect();
    clicks.push({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H });
    canvas.focus();
  };
  canvas.addEventListener("keydown", on);
  canvas.addEventListener("keyup", off);
  canvas.addEventListener("pointerdown", click);
  return {
    down,
    clicks,
    left: () => down.has("arrowleft") || down.has("a"),
    right: () => down.has("arrowright") || down.has("d"),
    up: () => down.has("arrowup") || down.has("w"),
    downKey: () => down.has("arrowdown") || down.has("s"),
    stop() {
      canvas.removeEventListener("keydown", on);
      canvas.removeEventListener("keyup", off);
      canvas.removeEventListener("pointerdown", click);
    },
  };
}

// Runs a game's frames until it says it's over (or the round is stopped).
// `step(dt, t)` moves things and returns true when the game ends; `draw(t)`
// paints. The time bar and score line are drawn on top.
function loop(canvas, game, input, step, draw, score, done) {
  const ctx = canvas.getContext("2d");
  let last = performance.now(), frame = 0, over = false;
  const began = last;
  const tick = (now) => {
    if (over) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - began) / 1000;
    const ended = step(dt, t) || t >= game.seconds;
    draw(ctx, t);
    ctx.fillStyle = "rgba(20, 18, 30, 0.55)";
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = "#fff7e6";
    ctx.font = "700 13px 'Quicksand', sans-serif";
    ctx.fillText(`Score ${score()}`, 10, 15);
    ctx.fillStyle = game.color;
    ctx.fillRect(W - 130, 8, 120 * Math.max(0, 1 - t / game.seconds), 6);
    if (ended) {
      over = true;
      input.stop();
      return done(score());
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    stop() {
      over = true;
      cancelAnimationFrame(frame);
      input.stop();
    },
  };
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
const player = () => myColorHex(); // (your own color, for your little round character)
function myColorHex() {
  const c = hooks.color?.() ?? "#e05a47";
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#e05a47";
}
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
        ball(ctx, me.x, me.y - 10, 11, me.frozen > 0 ? "#a8d8f0" : player());
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
      ball(ctx, me.x, me.y, 11, player());
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },

  // Treasure Dive: swim the deep end for coins (1) and pearls (3). Space or
  // up swims you up, you sink slowly otherwise. Watch your air: the surface
  // and bubbles refill it. Jellyfish sting (and knock off two).
  treasureDive(canvas, rng, game, done) {
    const input = reader(canvas);
    const me = { x: W / 2, y: 40, vy: 0, air: 1, sting: 0 };
    const loot = Array.from({ length: 26 }, (_, i) => ({ x: 20 + rng() * (W - 40), y: 90 + rng() * (H - 110), pearl: i < 6 }));
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
        // (Out of air: back up to the surface, a little dizzy.)
        me.y = 40;
        me.vy = 0;
        me.air = 0.5;
        me.sting = 1;
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
      ball(ctx, me.x, me.y, 11, me.sting > 0 && Math.sin(t * 20) > 0 ? "#f4f0f8" : player());
      ctx.fillStyle = "#cfe6ee"; // goggles
      ctx.fillRect(me.x - 7, me.y - 5, 14, 5);
      // The air bar.
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(10, H - 22, 104, 10);
      ctx.fillStyle = me.air < 0.25 ? "#e05a47" : "#8fd0f0";
      ctx.fillRect(12, H - 20, 100 * Math.max(0, me.air), 6);
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
      }
      if (crow.watching && moving && caught <= 0 && me.y < start.y - 4) {
        caught = 0.8;
        Object.assign(me, start);
      }
      if (me.y < 64 && Math.abs(me.x - W / 2) < 40) {
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
      const x = W / 2 + (crow.warn ? Math.sin(t * 40) * 2 : 0), y = 58;
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
      ctx.fillStyle = crow.watching ? "#e05a47" : crow.warn ? "#f2c94c" : "#6fb86a";
      ctx.font = "800 12px 'Quicksand', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(crow.watching ? "FREEZE!" : crow.warn ? "..." : "SNEAK", x, 88);
      ctx.textAlign = "left";
      shadow(ctx, me.x, me.y + 10, 10);
      ball(ctx, me.x, me.y, 10, caught > 0 ? "#f4f0f8" : player());
    };
    return loop(canvas, game, input, step, draw, () => score, done);
  },
};
