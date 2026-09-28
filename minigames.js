// Mini games (Update 10, rebuilt in 0.84), behind the doors on the Games
// floor's corridor. Walk into a door (or press E at it) and the house
// fades away to the game's own full-screen scene:
// - The lobby: the game's banner, everyone waiting at the door shown as
//   their real characters, a Ready button each, and Start for the host
//   (whoever got to the door first).
// - A round: everyone in the lobby plays together. The quick games
//   (minigames-classic.js) are the same round from one shared seed, each
//   on their own screen, with everyone's scores in the HUD. Cellar Crawl
//   (cellar.js) is one shared cellar you explore together.
// - The results: everyone's scores, crumbs from the house server, your
//   personal best, then back to the lobby or a fade back to the Games
//   floor, right at the door.
import { bank, myWallet } from "./bank.js";
import { getPeers, sendGames, onGames, myPeerId } from "./network.js";
import { playClickSound, playCrumbSound } from "./audio.js";
import { unlock } from "./achievements.js";
import { seeded, drawHero } from "./game-kit.js";
import { startClassic, CLASSIC_SIZE } from "./minigames-classic.js";

let hooks = { notice: () => {}, name: () => "You", look: () => null };
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
const button = (className, label, onClick) => {
  const b = make("button", className, label);
  b.type = "button";
  b.addEventListener("click", () => {
    playClickSound();
    onClick();
  });
  return b;
};
// Your look, as the house draws you (and a friend's, by their peer id).
const myLook = () => ({ ...(hooks.look("me") ?? {}), name: hooks.name() });
const lookOf = (id) => (id === "me" ? myLook() : hooks.look(id) ?? { name: "A friend", color: "#999999" });

// --- The scene: one full-screen layer over the house ---
const scene = make("div", "mini-scene");
scene.hidden = true;
const canvas = make("canvas", "mini-canvas");
const hudEl = make("div", "mini-hud");
const layer = make("div", "mini-layer"); // (the lobby, results and other cards)
scene.append(canvas, hudEl, layer);
const fader = make("div", "mini-fade");
document.body.append(scene, fader);
const ctx = canvas.getContext("2d");

let open = null; // { game, mode: "lobby" | "round" | "results", ... } while the scene is up
export function isMiniOpen() {
  return !!open;
}

// Fades to dark, runs `middle`, and fades back in.
let fading = false;
function fade(middle) {
  if (fading) return;
  fading = true;
  fader.classList.add("on");
  setTimeout(() => {
    middle();
    requestAnimationFrame(() => {
      fader.classList.remove("on");
      fading = false;
    });
  }, 380);
}

// The canvas fills the window, at the screen's full sharpness.
function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

// --- Keys and clicks ---
// While the scene is up, keys belong to it (the house doesn't walk you
// around behind it). Games read the held keys from `keys`.
const keys = new Set();
const clicks = [];
const pointer = { x: 0, y: 0 };
const GAME_KEYS = ["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d", "e", "shift"];
window.addEventListener(
  "keydown",
  (e) => {
    if (!open) return;
    e.stopImmediatePropagation();
    const k = e.key.toLowerCase();
    if (e.target?.tagName === "INPUT") return;
    if (k === "escape") {
      e.preventDefault();
      return escape();
    }
    if (open.mode !== "round") return;
    if (GAME_KEYS.includes(k)) e.preventDefault();
    keys.add(k);
    open.pressed?.(k);
  },
  { capture: true }
);
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()), { capture: true });
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointermove", (e) => Object.assign(pointer, toGame(e)));
canvas.addEventListener("pointerdown", (e) => {
  const at = toGame(e);
  Object.assign(pointer, at);
  clicks.push(at);
});
// (Screen pixels to the game's own: the quick games have a 480 by 320
// screen, fitted into the window.)
let view = { k: 1, ox: 0, oy: 0 };
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  const dpr = canvas.width / Math.max(1, r.width);
  return { x: ((e.clientX - r.left) * dpr - view.ox) / view.k, y: ((e.clientY - r.top) * dpr - view.oy) / view.k };
}

// --- Opening a door ---
export function portalHint(f) {
  const game = info(f?.game);
  if (!game) return "";
  return game.soon ? `${game.name}: the door is still being painted. Coming soon!` : `Walk in (or press E) for ${game.name}.`;
}

export function openPortal(f) {
  const game = info(f?.game);
  if (!game || open || fading) return;
  if (game.soon) return hooks.notice(`${game.name}: the door is still being painted. Coming soon!`);
  fade(() => {
    scene.hidden = false;
    open = { game, mode: "lobby" };
    showLobby();
  });
}

// Back to the Games floor, at the door you came in by.
export function closeMini() {
  if (!open) return;
  fade(() => {
    stopEverything();
    open = null;
    scene.hidden = true;
    keys.clear();
    layer.textContent = "";
    hudEl.textContent = "";
    document.activeElement?.blur();
  });
}

function stopEverything() {
  if (!open) return;
  open.stopLobby?.();
  open.run?.stop();
  open.stopBackdrop?.();
  clearInterval(open.scoreTimer);
}

// Escape: leave the lobby or the results; in a round, ask first.
function escape() {
  if (!open) return;
  if (open.mode !== "round") return closeMini();
  if (layer.querySelector(".mini-leave")) return (layer.textContent = "");
  const card = make("div", "mini-card mini-leave");
  card.append(make("h3", "", open.game.id === "cellarCrawl" ? "Leave the cellar?" : "Leave this round?"), make("p", "", open.game.id === "cellarCrawl" ? "Whatever you're carrying stays down there. (Take a ladder up to bring it home.)" : "Your score so far still counts."));
  const row = make("div", "mini-buttons");
  row.append(button("soft-button", "Keep playing", () => (layer.textContent = "")), button("warm-button", "Leave", () => {
    layer.textContent = "";
    open.run?.leave?.();
  }));
  card.append(row);
  layer.append(card);
}

// --- Behind the cards: the game's art, filling the screen ---
function paintBanner(c, game, w, h, t) {
  paintGameBanner(c, game, w, h, t);
}
function startBackdrop() {
  open.stopBackdrop?.();
  let frame = 0;
  const tick = () => {
    if (!open || open.mode === "round") return;
    const { w, h } = fitCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paintBanner(ctx, open.game, w, h, performance.now() / 1000);
    ctx.fillStyle = "rgba(24, 16, 10, 0.5)";
    ctx.fillRect(0, 0, w, h);
    frame = requestAnimationFrame(tick);
  };
  tick();
  open.stopBackdrop = () => cancelAnimationFrame(frame);
}

// --- The lobby ---
// Everyone with the lobby open says "here" to the friends on the Games
// floor once a second (which game, whether they're ready, and when they
// got there). peerId -> { game, name, ready, since, at }.
const here = new Map();
const text = (v, fallback) => (typeof v === "string" && v ? v.slice(0, 24) : fallback);
function waiting(game) {
  const now = performance.now();
  return [...here.entries()].filter(([, h]) => h.game === game.id && now - h.at < 2500).map(([id, h]) => ({ id, ...h }));
}
// Everyone in the lobby (you first), and who the host is: whoever got to
// the door first.
function lobbyMembers() {
  const me = { id: "me", peer: myPeerId, name: hooks.name(), ready: open.ready, since: open.since };
  const all = [me, ...waiting(open.game).map((p) => ({ ...p, peer: p.id }))];
  const host = [...all].sort((a, b) => a.since - b.since || String(a.peer).localeCompare(String(b.peer)))[0];
  return all.map((p) => ({ ...p, host: p === host }));
}
function sayHere() {
  const floor = getPeers().filter((p) => floorOf(p.y) === GAMES_FLOOR).map((p) => p.id);
  sendGames({ type: "here", game: open.game.id, name: hooks.name(), ready: open.ready, since: open.since }, floor);
}

function showLobby() {
  const game = open.game;
  open.mode = "lobby";
  open.run = null;
  open.ready = false;
  open.since ??= Date.now();
  hudEl.textContent = "";
  hudEl.hidden = true;
  layer.textContent = "";
  startBackdrop();

  const card = make("div", "mini-card mini-lobby");
  const banner = make("canvas", "mini-banner");
  banner.width = 960;
  banner.height = 250;
  const title = make("h2", "mini-title", game.name);
  const body = make("div", "mini-lobby-body");
  const main = make("div", "mini-lobby-main");
  const players = make("div", "mini-players");
  const best = myWallet().minis?.best?.[game.id];
  const note = make("p", "mini-note", `${best ? `Your best: ${best}. ` : ""}Crumbs for your score, up to ${game.maxCrumbs} a round (and ${CONFIG.minigames.crumbsPerDay} a day from all the games).`);
  const status = make("p", "mini-status");
  const buttons = make("div", "mini-buttons");
  const leave = button("soft-button", "Back to the floor", closeMini);
  const ready = button("soft-button", "Ready", () => {
    open.ready = !open.ready;
    sayHere();
    refresh();
  });
  const start = button("warm-button", "Start", () => {
    const members = lobbyMembers();
    const friends = members.filter((p) => p.id !== "me");
    const round = { id: Math.random().toString(36).slice(2, 10), seed: Math.floor(Math.random() * 1e9), game: game.id, host: myPeerId, hostName: hooks.name() };
    sendGames({ type: "start", ...round, players: friends.map((p) => p.id) }, friends.map((p) => p.id));
    playRound(round, friends.map((p) => ({ id: p.id, name: p.name })));
  });
  buttons.append(leave, ready, start);
  main.append(make("p", "mini-blurb", game.blurb), make("p", "mini-how", game.how), players, status, note, buttons);
  body.append(main);
  card.append(banner, title, body);
  layer.append(card);

  // Everyone's character, redrawn a few times a second (they idle, and
  // friends come and go).
  const tiles = new Map(); // id -> { el, canvas, tag }
  const refresh = () => {
    if (!open || open.mode !== "lobby") return;
    const members = lobbyMembers();
    const me = members[0];
    for (const [id, tile] of tiles) if (!members.some((m) => m.id === id)) (tile.el.remove(), tiles.delete(id));
    for (const m of members) {
      let tile = tiles.get(m.id);
      if (!tile) {
        const el = make("div", "mini-player");
        const c = make("canvas");
        c.width = 150;
        c.height = 170;
        const tag = make("span", "mini-tag");
        el.append(c, tag);
        players.append(el);
        tile = { el, canvas: c, tag };
        tiles.set(m.id, tile);
      }
      tile.el.classList.toggle("ready", m.ready || m.host);
      tile.el.classList.toggle("me", m.id === "me");
      tile.tag.textContent = m.host ? "Host" : m.ready ? "Ready" : "Not ready";
    }
    const others = members.filter((m) => !m.host);
    const everyoneReady = others.every((m) => m.ready);
    ready.hidden = me.host;
    ready.textContent = open.ready ? "Not ready" : "Ready";
    start.hidden = !me.host;
    start.disabled = !everyoneReady;
    const host = members.find((m) => m.host);
    status.textContent = members.length === 1 ? "Just you so far. Friends who walk into this door join you." : me.host ? (everyoneReady ? "Everyone's ready. Start when you like!" : "Waiting for everyone to be ready...") : `Waiting for ${host.name} to start.`;
  };
  refresh();
  sayHere();
  const timer = setInterval(() => {
    sayHere();
    refresh();
  }, 1000);
  let frame = 0;
  const draw = () => {
    if (!open || open.mode !== "lobby") return;
    const t = performance.now() / 1000;
    const b = banner.getContext("2d");
    b.setTransform(1, 0, 0, 1, 0, 0);
    paintBanner(b, game, banner.width, banner.height, t);
    for (const [id, tile] of tiles) {
      const c = tile.canvas.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
      c.fillStyle = "rgba(40, 25, 10, 0.2)";
      c.beginPath();
      c.ellipse(75, 150, 34, 9, 0, 0, Math.PI * 2);
      c.fill();
      drawHero(c, lookOf(id), 75, 150, { scale: 2.1 });
    }
    frame = requestAnimationFrame(draw);
  };
  draw();
  open.lobbyRefresh = refresh;
  open.stopLobby = () => {
    clearInterval(timer);
    cancelAnimationFrame(frame);
  };
}

// Messages from friends' games. (Everything from a friend is checked:
// only the fields we expect, as plain text or numbers.)
onGames((message, peerId) => {
  if (!message || typeof message !== "object" || typeof message.type !== "string") return;
  if (message.type === "here" && typeof message.game === "string") {
    here.set(peerId, { game: message.game, name: text(message.name, "A friend"), ready: message.ready === true, since: Number(message.since) || Date.now(), at: performance.now() });
    if (open?.mode === "lobby") open.lobbyRefresh?.();
  }
  if (message.type === "start" && open?.mode === "lobby" && open.game.id === message.game && typeof message.id === "string") {
    // (The host pressed Start at the door we're waiting at: join their
    // round, with everyone else who was in the lobby.)
    const listed = Array.isArray(message.players) ? message.players : [];
    if (!listed.includes(myPeerId)) return;
    const members = waiting(open.game);
    const others = members.filter((p) => p.id !== peerId && listed.includes(p.id)).map((p) => ({ id: p.id, name: p.name }));
    const hostName = text(message.hostName, "A friend");
    playRound({ id: message.id.slice(0, 16), seed: Number(message.seed) >>> 0, game: open.game.id, host: peerId, hostName }, [{ id: peerId, name: hostName }, ...others]);
  }
  if (!open?.round || message.round !== open.round.id) return;
  const player = open.players.find((p) => p.id === peerId);
  if (!player) return;
  if (message.type === "score") {
    player.score = Math.max(0, Math.floor(Number(message.score) || 0));
  }
  if (message.type === "result") {
    // (Only from the round's own players, one line each.)
    open.results.set(peerId, { name: player.name, score: Math.max(0, Math.floor(Number(message.score) || 0)) });
    if (open.mode === "results") open.showResults?.();
  }
  if (message.type === "game") open.run?.message?.(message.data, peerId);
  if (message.type === "left") {
    player.left = true;
    open.run?.left?.(peerId);
  }
});

// --- A round ---
// `players`: the friends in it ({ id, name }), not counting you.
function playRound(round, players) {
  const game = open.game;
  open.stopLobby?.();
  open.stopBackdrop?.();
  open.mode = "round";
  open.round = round;
  open.players = players.map((p) => ({ ...p, score: 0 }));
  open.results = new Map(); // "me" or a friend's peerId -> { name, score }
  layer.textContent = "";
  keys.clear();
  clicks.length = 0;
  buildHud(game);
  const friendIds = () => open.players.filter((p) => !p.left).map((p) => p.id);

  // The screen the game draws on. The quick games draw on a 480 by 320
  // screen, fitted into the window (with a wooden frame around it); Cellar
  // Crawl draws on the whole window itself.
  const fixed = CLASSIC_SIZE;
  const screen = {
    canvas,
    keys,
    clicks,
    pointer,
    look: myLook(),
    lookOf,
    get w() {
      return fixed ? fixed.w : canvas.width;
    },
    get h() {
      return fixed ? fixed.h : canvas.height;
    },
    begin() {
      const { w, h } = fitCanvas();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!fixed) {
        view = { k: 1, ox: 0, oy: 0 };
        return ctx;
      }
      const k = Math.min(w / fixed.w, (h - 70) / fixed.h);
      view = { k, ox: (w - fixed.w * k) / 2, oy: Math.max(60, (h - fixed.h * k) / 2 + 20) };
      drawFrame(ctx, w, h, view, fixed);
      ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, fixed.w, fixed.h);
      ctx.clip();
      return ctx;
    },
    end() {
      if (fixed) ctx.restore();
    },
    hud: (state) => updateHud(state),
    // For games played together (Cellar Crawl): messages to the others.
    send: (data) => sendGames({ type: "game", round: round.id, data }, friendIds()),
    friends: () => open.players.filter((p) => !p.left),
    isHost: () => hostOf() === "me",
  };
  // The host keeps the shared things (like the cellar's critters) in step.
  // If they leave, the next one along takes over.
  const hostOf = () => {
    const ids = [myPeerId, ...open.players.filter((p) => !p.left).map((p) => p.id)];
    const hostHere = ids.includes(round.host) ? round.host : [...ids].sort()[0];
    return hostHere === myPeerId ? "me" : hostHere;
  };

  // Everyone's live scores go round once a second.
  open.scoreTimer = setInterval(() => {
    const score = open?.run?.score?.();
    if (score !== undefined) sendGames({ type: "score", round: round.id, score }, friendIds());
  }, 1000);

  // The countdown, then go.
  const began = performance.now();
  let frame = 0;
  const countdown = () => {
    if (open?.round !== round) return;
    const left = 3 - Math.floor((performance.now() - began) / 1000);
    const { w, h } = fitCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paintBanner(ctx, game, w, h, performance.now() / 1000);
    ctx.fillStyle = "rgba(24, 16, 10, 0.55)";
    ctx.fillRect(0, 0, w, h);
    hudEl.dataset.count = left > 0 ? String(left) : "Go!";
    if (left > -1) return void (frame = requestAnimationFrame(countdown));
    delete hudEl.dataset.count;
    go();
  };
  open.run = { stop: () => cancelAnimationFrame(frame) };
  countdown();

  const finish = (score, got, extra = {}) => {
    if (open?.round !== round || open.mode !== "round") return;
    open.run?.stop();
    open.results.set("me", { name: hooks.name(), score });
    sendGames({ type: "result", round: round.id, score }, friendIds());
    showResults(got, extra);
  };

  const go = async () => {
    const started = await bank("miniStart", { game: game.id });
    if (open?.round !== round) return;
    const run = startClassic(game.id, screen, seeded(round.seed), game, async (score) => {
      const got = started?.id ? await bank("miniEnd", { id: started.id, score }) : null;
      finish(got?.score ?? score, got);
    });
    open.run = { ...run, leave: () => run.stop() || finishEarly(run) };
    const finishEarly = async (r) => {
      const score = r.score();
      const got = started?.id ? await bank("miniEnd", { id: started.id, score }) : null;
      finish(got?.score ?? score, got);
    };
  };
}

// The wooden frame around a quick game's screen (like the house's panels).
function drawFrame(c, w, h, v, size) {
  c.fillStyle = "#2a1d14";
  c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.7);
  glow.addColorStop(0, "rgba(217, 164, 65, 0.16)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  const x = v.ox, y = v.oy, fw = size.w * v.k, fh = size.h * v.k, b = Math.max(8, v.k * 5);
  c.fillStyle = "#1a120c";
  c.fillRect(x - b - 3, y - b - 3, fw + b * 2 + 6, fh + b * 2 + 6);
  const wood = c.createLinearGradient(0, y - b, 0, y + fh + b);
  wood.addColorStop(0, "#8a6848");
  wood.addColorStop(1, "#5c4530");
  c.fillStyle = wood;
  c.fillRect(x - b, y - b, fw + b * 2, fh + b * 2);
  c.fillStyle = "rgba(255, 230, 190, 0.25)";
  c.fillRect(x - b, y - b, fw + b * 2, 2);
  c.fillStyle = "rgba(0, 0, 0, 0.35)";
  c.fillRect(x - 2, y - 2, fw + 4, fh + 4);
}

// --- The HUD: a house-style bar across the top ---
let hudParts = null;
function buildHud(game) {
  hudEl.textContent = "";
  hudEl.hidden = false;
  const bar = make("div", "mini-hud-bar");
  const name = make("span", "mini-hud-name", game.name);
  const time = make("span", "mini-hud-time");
  const timeFill = make("span", "mini-hud-time-fill");
  time.append(timeFill);
  const extra = make("span", "mini-hud-extra");
  const score = make("span", "mini-hud-score");
  const friends = make("span", "mini-hud-friends");
  bar.append(name, extra, time, score, friends);
  const help = make("div", "mini-hud-help", `${game.how}  Escape to leave.`);
  hudEl.append(bar, help);
  hudParts = { time, timeFill, extra, score, friends, last: {} };
  setTimeout(() => help.classList.add("faded"), 6000);
}
function setText(el, key, value) {
  if (hudParts.last[key] === value) return;
  hudParts.last[key] = value;
  el.textContent = value;
}
// state: { score, time (0 to 1 left), extra: a line of your own (like
// hearts and the bag), extraHtml: a DOM node builder instead }
function updateHud(state) {
  if (!hudParts || !open) return;
  if (state.time !== undefined) hudParts.timeFill.style.width = `${Math.round(state.time * 1000) / 10}%`;
  if (state.score !== undefined) setText(hudParts.score, "score", `${state.scoreLabel ?? "Score"} ${state.score}`);
  if (state.extra !== undefined) setText(hudParts.extra, "extra", state.extra);
  if (state.extraNodes && hudParts.last.extraKey !== state.extraKey) {
    hudParts.last.extraKey = state.extraKey;
    hudParts.extra.textContent = "";
    hudParts.extra.append(...state.extraNodes());
  }
  const friends = open.players.filter((p) => !p.left).map((p) => `${p.name} ${p.score}`).join("   ");
  setText(hudParts.friends, "friends", friends);
}

// --- The results ---
// `got`: what the house server said (crumbs, best, and so on). `extra`:
// a game's own lines (Cellar Crawl's haul).
function showResults(got, extra) {
  const game = open.game;
  const round = open.round;
  open.mode = "results";
  hudEl.hidden = true;
  startBackdrop();
  if (got?.crumbs) playCrumbSound();
  const draw = () => {
    if (!open || open.round !== round || open.mode !== "results") return;
    layer.textContent = "";
    const card = make("div", "mini-card mini-results-card");
    const mine = open.results.get("me")?.score ?? 0;
    card.append(make("h2", "mini-title", extra.title ?? `${game.name}: round over`));
    const cols = make("div", "mini-result-cols");
    const scoreBox = make("div", "mini-big");
    scoreBox.append(make("span", "mini-big-label", extra.scoreLabel ?? "Your score"), make("span", "mini-big-value", String(mine)));
    const crumbBox = make("div", "mini-big crumbs");
    crumbBox.append(make("span", "mini-big-label", "Crumbs earned"), make("span", "mini-big-value", got ? `+${got.crumbs ?? 0}` : "?"));
    const best = myWallet().minis?.best?.[game.id] ?? mine;
    const bestBox = make("div", "mini-big best");
    bestBox.append(make("span", "mini-big-label", "Personal best"), make("span", "mini-big-value", String(Math.max(best, mine))));
    if (got?.best) bestBox.append(make("span", "mini-ribbon", "New best!"));
    cols.append(scoreBox, crumbBox, bestBox);
    card.append(cols);
    const why = !got ? "(No crumbs: the house server didn't answer.)" : got.crumbs ? "" : got.capped ? "That's all the crumbs the games pay today. Play on for fun!" : got.short ? "Too quick for crumbs: play a bit longer next time!" : "";
    if (why) card.append(make("p", "mini-note", why));
    for (const line of extra.lines ?? []) card.append(make("p", "mini-line", line));
    // Everyone's scores, as their characters.
    if (open.players.length) {
      const rows = [...open.results.entries()].sort((a, b) => b[1].score - a[1].score);
      const waitingFor = open.players.length + 1 - rows.length;
      card.append(make("p", "mini-note", waitingFor > 0 ? `This round (waiting for ${waitingFor === 1 ? "one more score" : `${waitingFor} more scores`}):` : "This round:"));
      const board = make("div", "mini-board");
      rows.forEach(([key, r], i) => {
        const row = make("div", `mini-board-row${key === "me" ? " me" : ""}`);
        const c = make("canvas");
        c.width = 60;
        c.height = 64;
        drawHero(c.getContext("2d"), lookOf(key), 30, 58, { scale: 1, tag: false });
        row.append(make("span", "mini-rank", String(i + 1)), c, make("span", "mini-board-name", `${r.name}${key === "me" ? " (you)" : ""}`), make("span", "mini-board-score", String(r.score)));
        board.append(row);
      });
      card.append(board);
      // Champion: everyone's in, and you beat every one of them.
      if (!waitingFor && rows[0][0] === "me" && rows.slice(1).every(([, r]) => r.score < mine)) unlock("miniChampion");
    }
    const buttons = make("div", "mini-buttons");
    buttons.append(button("soft-button", "Back to the Games floor", closeMini), button("warm-button", "Play again", () => {
      open.round = null;
      open.since = Date.now();
      showLobby();
    }));
    card.append(buttons);
    layer.append(card);
  };
  open.showResults = draw;
  draw();
}

// --- Banners for the quick games ---
// Each game's own little scene, drawn in the house style: soft outlines,
// shading away from the light (from above), highlights and texture.
function paintGameBanner(c, game, w, h, t) {
  const k = h / 250; // (drawn for a 250 pixel tall banner, then scaled)
  c.save();
  const sky = c.createLinearGradient(0, 0, 0, h);
  const [top, bottom, ground] = BANNER_COLORS[game.id] ?? ["#40506a", "#6a7a9a", "#3a4a3a"];
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = ground;
  c.fillRect(0, h * 0.72, w, h * 0.28);
  c.fillStyle = "rgba(255, 255, 255, 0.08)";
  c.fillRect(0, h * 0.72, w, 3 * k);
  // Soft texture across the ground.
  for (let i = 0; i < 90; i++) {
    c.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.08)";
    c.fillRect(noise(i * 1.3) * w, h * 0.74 + noise(i * 2.7) * h * 0.25, 4 * k, 2 * k);
  }
  const motif = BANNER_MOTIFS[game.id];
  for (let i = 0; i < 7; i++) {
    const x = ((i + 0.5) / 7) * w + (noise(i * 9.1) - 0.5) * 40 * k;
    const y = h * (0.66 + noise(i * 4.3) * 0.2);
    motif?.(c, x, y, k * (0.8 + noise(i * 7.7) * 0.5), t + i);
  }
  c.restore();
}
const BANNER_COLORS = {
  snowball: ["#b8d4ea", "#e8f2fa", "#f4f8fc"],
  crumbRush: ["#f4e0c0", "#ecd0a4", "#c9a27a"],
  treasureDive: ["#1e4a6a", "#3f8ab0", "#c8b88a"],
  scarecrow: ["#f0c890", "#f8e0b0", "#8aa05a"],
  ghostHunt: ["#1c1a28", "#3a3050", "#4a3a3a"],
  nightMeadow: ["#141a30", "#2a3a5a", "#2e4a34"],
  kitchenRush: ["#f4e6d0", "#e8d4b8", "#b88a5a"],
};
const outlined = (c, draw) => {
  c.save();
  c.filter = "drop-shadow(0 0 1px rgba(35, 22, 12, 0.7))";
  draw();
  c.restore();
};
const blob = (c, x, y, rx, ry, color) => {
  const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, shadeColor(color, 30));
  g.addColorStop(1, shadeColor(color, -18));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
};
const groundShadow = (c, x, y, r) => {
  c.fillStyle = "rgba(20, 10, 4, 0.22)";
  c.beginPath();
  c.ellipse(x, y, r, r * 0.32, 0, 0, Math.PI * 2);
  c.fill();
};
const BANNER_MOTIFS = {
  // Little snowmen with scarves.
  snowball(c, x, y, k, t) {
    const bob = Math.abs(Math.sin(t * 3)) * 3 * k;
    groundShadow(c, x, y, 16 * k);
    outlined(c, () => {
      blob(c, x, y - 14 * k - bob, 16 * k, 15 * k, "#f8fbff");
      blob(c, x, y - 36 * k - bob, 11 * k, 11 * k, "#f8fbff");
      c.fillStyle = "#c0392b";
      c.fillRect(x - 10 * k, y - 28 * k - bob, 20 * k, 4 * k);
      c.fillStyle = "#2a2a30";
      c.fillRect(x - 5 * k, y - 39 * k - bob, 3 * k, 3 * k);
      c.fillRect(x + 2 * k, y - 39 * k - bob, 3 * k, 3 * k);
      c.fillStyle = "#e8883a";
      c.fillRect(x, y - 35 * k - bob, 8 * k, 2.5 * k);
    });
  },
  // Crumbs, and golden crumbs.
  crumbRush(c, x, y, k, t) {
    for (let i = 0; i < 5; i++) {
      const gold = i === 2;
      outlined(c, () => blob(c, x + (i - 2) * 14 * k, y - 4 * k + Math.sin(t * 2 + i) * 2 * k, (gold ? 7 : 5) * k, (gold ? 5 : 4) * k, gold ? "#f2c94c" : "#c8964a"));
    }
  },
  // Coins and pearls on the sand, with bubbles rising.
  treasureDive(c, x, y, k, t) {
    groundShadow(c, x, y, 12 * k);
    outlined(c, () => blob(c, x, y - 6 * k, 10 * k, 7 * k, "#e8c040"));
    c.fillStyle = "rgba(220, 240, 255, 0.5)";
    for (let i = 0; i < 3; i++) {
      const up = ((t * 20 + i * 30) % 90) * k;
      c.beginPath();
      c.arc(x + Math.sin(t + i) * 6 * k, y - 20 * k - up, (2 + i) * k, 0, Math.PI * 2);
      c.fill();
    }
  },
  // Corn stalks and pumpkins.
  scarecrow(c, x, y, k) {
    groundShadow(c, x, y, 14 * k);
    outlined(c, () => {
      blob(c, x, y - 9 * k, 14 * k, 10 * k, "#e08a2a");
      c.fillStyle = "#5a7a2a";
      c.fillRect(x - 1.5 * k, y - 22 * k, 3 * k, 6 * k);
    });
  },
  // Little ghosts floating.
  ghostHunt(c, x, y, k, t) {
    const fy = y - 30 * k + Math.sin(t * 2) * 5 * k;
    c.fillStyle = "rgba(230, 225, 255, 0.85)";
    c.beginPath();
    c.arc(x, fy, 12 * k, Math.PI, 0);
    c.lineTo(x + 12 * k, fy + 16 * k);
    for (let i = 3; i >= 0; i--) c.lineTo(x - 12 * k + i * 8 * k, fy + (i % 2 ? 12 : 16) * k);
    c.fill();
    c.fillStyle = "#2a2440";
    c.fillRect(x - 5 * k, fy - 3 * k, 3 * k, 4 * k);
    c.fillRect(x + 2 * k, fy - 3 * k, 3 * k, 4 * k);
  },
  // Fireflies over the grass.
  nightMeadow(c, x, y, k, t) {
    for (let i = 0; i < 3; i++) {
      const on = Math.sin(t * 2 + i * 2) > 0;
      const fx = x + (i - 1) * 20 * k, fy = y - 40 * k - i * 12 * k + Math.sin(t + i) * 4 * k;
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, 12 * k);
      g.addColorStop(0, on ? "rgba(250, 240, 140, 0.9)" : "rgba(250, 240, 140, 0.15)");
      g.addColorStop(1, "rgba(250, 240, 140, 0)");
      c.fillStyle = g;
      c.fillRect(fx - 12 * k, fy - 12 * k, 24 * k, 24 * k);
    }
    c.strokeStyle = "#3e5a40";
    c.lineWidth = 2 * k;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(x + (i - 2) * 8 * k, y + 20 * k);
      c.quadraticCurveTo(x + (i - 2) * 8 * k + 4 * k, y - 4 * k, x + (i - 2) * 9 * k + 8 * k, y - 14 * k);
      c.stroke();
    }
  },
  // Pots and vegetables.
  kitchenRush(c, x, y, k, t) {
    groundShadow(c, x, y, 18 * k);
    outlined(c, () => {
      blob(c, x, y - 10 * k, 18 * k, 12 * k, "#4a4a52");
      c.fillStyle = "#e8a860";
      c.beginPath();
      c.ellipse(x, y - 18 * k, 14 * k, 4 * k, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      c.arc(x + (i ? 5 : -5) * k, y - 26 * k - ((t * 12 + i * 8) % 16) * k, 3 * k, 0, Math.PI * 2);
      c.fill();
    }
  },
};
