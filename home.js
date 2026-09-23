// Your bedroom as a home: its size, what you've bought at Nest & Nook,
// and where you've put it. Also the Nest & Nook store (shown on the
// laptop) and decorating (moving pieces around your room).
//
// Like crumbs, this is saved in your own browser only. Friends get a copy
// of your decor when they join, and again whenever you change it.
import { sendDecor, onDecor } from "./network.js";
import { spendCrumbs, crumbBalance } from "./shop.js";
import { unlock } from "./achievements.js";
import { playCrumbSound, playClickSound } from "./audio.js";

// --- Saved home ---
// size: "cozy" or "roomy". owned: item id -> how many you've bought.
// placed: [{ item, x, y }], x and y from your room's top-left corner.
const STORAGE_KEY = "cozy-house-home";
let home = { size: "cozy", owned: {}, placed: [] };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    home.size = Object.hasOwn(BEDROOM_SIZES, loaded.size) ? loaded.size : "cozy";
    for (const [id, count] of Object.entries(loaded.owned ?? {})) {
      if (Object.hasOwn(DECOR, id) && Number.isInteger(count) && count > 0) home.owned[id] = Math.min(count, 99);
    }
    // Only keep placed pieces you own (and that fit).
    const counts = {};
    const mine = (Array.isArray(loaded.placed) ? loaded.placed : []).filter((p) => {
      counts[p?.item] = (counts[p?.item] || 0) + 1;
      return counts[p?.item] <= (home.owned[p?.item] || 0);
    });
    home.placed = tidyDecor(home.size, mine);
  }
} catch {
  // Nothing saved yet, or storage is blocked: start with an empty room.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(home));
  } catch {
    // Storage blocked (e.g. a private window): just won't be remembered.
  }
}

// Your room's size and placed decor (main.js puts these in your bedroom).
export function myHome() {
  return home;
}

// --- Sharing decor with friends ---
function shareDecor() {
  sendDecor({ placed: home.placed });
}

// Called when a friend joins, so they see your room as it is.
export function sendMyDecorTo(peerId) {
  sendDecor({ placed: home.placed }, peerId);
}

// Friends' decor, as they sent it, tidied (checked piece by piece) for
// the size their room is right now.
const friendsDecor = {}; // peer id -> { raw, size, clean }
onDecor((message, peerId) => {
  friendsDecor[peerId] = { raw: message?.placed, size: null, clean: [] };
});

export function friendDecor(peerId, size) {
  const d = friendsDecor[peerId];
  if (!d) return [];
  if (d.size !== size) {
    d.size = size;
    d.clean = tidyDecor(size, d.raw);
  }
  return d.clean;
}

export function forgetFriendDecor(peerId) {
  delete friendsDecor[peerId];
}

// --- Connecting to main.js ---
// main.js tells us your color, where your bedroom is right now (its rect,
// or null), and how to show a short message.
let hooks = { color: () => "#e05a47", myRoom: () => null, notice: () => {} };
export function initHome(options) {
  hooks = options;
}

// How many of an item you have that aren't placed (or in your hands).
function spareCount(id) {
  const placed = home.placed.filter((p) => p.item === id).length;
  return (home.owned[id] || 0) - placed - (held?.item === id ? 1 : 0);
}

// --- Nest & Nook ---
const STORE_TABS = [
  ["furniture", "Furniture"],
  ["cozy", "Plants & rugs"],
  ["wall", "Walls"],
  ["upgrades", "Upgrades"],
];
let storeTab = "furniture";

// Draws the store into `page` (a laptop page). `onTab` hears which
// section is showing (the laptop puts it in the address bar).
let tellTab = () => {};
export function renderStore(page, onTab = tellTab) {
  tellTab = onTab;
  tellTab(storeTab);
  page.innerHTML = "";
  const top = document.createElement("div");
  top.className = "nook-top";
  const title = document.createElement("div");
  title.className = "nook-title";
  title.innerHTML = "<strong>Nest &amp; Nook</strong><span>furniture and little comforts</span>";
  const balance = document.createElement("span");
  balance.className = "nook-balance";
  balance.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  balance.append(String(crumbBalance()));
  top.append(title, balance);

  const tabs = document.createElement("div");
  tabs.className = "nook-tabs";
  for (const [id, label] of STORE_TABS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.classList.toggle("active", id === storeTab);
    tab.addEventListener("click", () => {
      storeTab = id;
      playClickSound();
      renderStore(page);
    });
    tabs.appendChild(tab);
  }

  const grid = document.createElement("div");
  grid.className = "nook-grid";
  if (storeTab === "upgrades") {
    grid.appendChild(upgradeCard(page));
  } else {
    for (const [id, item] of Object.entries(DECOR).filter(([, it]) => it.tab === storeTab)) grid.appendChild(itemCard(page, id, item));
  }
  page.append(top, tabs, grid);
}

function card(name, price, note) {
  const el = document.createElement("div");
  el.className = "nook-item";
  const label = document.createElement("div");
  label.className = "nook-name";
  label.textContent = name;
  const cost = document.createElement("div");
  cost.className = "nook-price";
  cost.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  cost.append(String(price));
  const small = document.createElement("div");
  small.className = "nook-note";
  small.textContent = note;
  el.append(label, cost, small);
  return el;
}

function itemCard(page, id, item) {
  const owned = home.owned[id] || 0;
  const el = card(item.name, item.price, owned ? `You have ${owned}` : "");
  const preview = document.createElement("canvas");
  preview.width = 110;
  preview.height = 84;
  drawDecorPreview(preview, item, hooks.color());
  el.prepend(preview);
  const buy = document.createElement("button");
  buy.type = "button";
  buy.className = "warm-button";
  buy.textContent = "Buy";
  buy.addEventListener("click", () => {
    if (!spendCrumbs(item.price)) {
      playClickSound();
      buy.textContent = `${item.price - crumbBalance()} short`;
      return;
    }
    home.owned[id] = Math.min(99, owned + 1);
    store();
    playCrumbSound();
    hooks.notice(`${item.name} is yours! Open Decorate on the laptop to place it.`);
    renderStore(page);
  });
  el.appendChild(buy);
  return el;
}

function upgradeCard(page) {
  const roomy = home.size === "roomy";
  const el = card("Roomy Room", ROOMY_PRICE, roomy ? "Done! Enjoy the space." : "Takes down the partition wall, nearly doubling your bedroom.");
  el.classList.add("wide");
  const icon = document.createElement("div");
  icon.className = "nook-icon";
  icon.textContent = "🔨";
  el.prepend(icon);
  const buy = document.createElement("button");
  buy.type = "button";
  buy.className = roomy ? "soft-button" : "warm-button";
  buy.textContent = roomy ? "Yours" : "Upgrade";
  buy.disabled = roomy;
  buy.addEventListener("click", () => {
    if (!spendCrumbs(ROOMY_PRICE)) {
      playClickSound();
      buy.textContent = `${ROOMY_PRICE - crumbBalance()} short`;
      return;
    }
    home.size = "roomy";
    store();
    playCrumbSound();
    unlock("roomy");
    hooks.notice("Down comes the wall! Your bedroom is roomy now.");
    renderStore(page);
  });
  el.appendChild(buy);
  return el;
}

// --- Decorating ---
// Pick a piece you own (or click one already in your room) and it follows
// the arrow keys or the mouse; Enter or a click puts it down if it fits.
const bar = document.getElementById("decorate-bar");
const barItems = document.getElementById("decorate-items");
const barTip = document.getElementById("decorate-tip");
const STEP = 0.25; // grid units per arrow key press
let decorating = false;
let held = null; // { item, x, y, from } while holding a piece; from is { x, y } if it was already placed

export function isDecorating() {
  return decorating;
}

export function startDecorating() {
  if (!hooks.myRoom()) return;
  decorating = true;
  held = null;
  bar.hidden = false;
  renderBar();
}

export function stopDecorating() {
  if (!decorating) return;
  if (held) cancelHeld();
  decorating = false;
  bar.hidden = true;
}

function renderBar() {
  barTip.textContent = held
    ? "Move it with the arrow keys or the mouse. Enter or click puts it down. Delete puts it away. Escape cancels."
    : "Pick something to place, or click a piece in your room to move it.";
  barItems.innerHTML = "";
  const spare = Object.keys(home.owned).filter((id) => spareCount(id) > 0);
  if (spare.length === 0) {
    const empty = document.createElement("span");
    empty.className = "decorate-empty";
    empty.textContent = home.placed.length ? "Everything you own is placed." : "Nothing to place yet. Shop at Nest & Nook on the laptop.";
    barItems.appendChild(empty);
  }
  for (const id of spare) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "soft-button";
    button.textContent = `${DECOR[id].name} ×${spareCount(id)}`;
    button.addEventListener("click", () => {
      if (held) cancelHeld();
      pickUpNew(id);
      button.blur();
    });
    barItems.appendChild(button);
  }
}

// Starts holding a new piece, in the middle of your room.
function pickUpNew(id) {
  const item = DECOR[id];
  const width = bedroomWidth(home.size);
  held = { item: id, x: snap((width - item.w) / 2), y: item.wall ? 0 : snap((WING_DEPTH - item.h) / 2), from: null };
  playClickSound();
  renderBar();
}

// Picks up a placed piece (by its index in home.placed).
function pickUpPlaced(index) {
  const [piece] = home.placed.splice(index, 1);
  held = { ...piece, from: { x: piece.x, y: piece.y } };
  playClickSound();
  renderBar();
}

function snap(v) {
  return Math.round(v / STEP) * STEP;
}

// Keeps the held piece inside the room.
function clampHeld() {
  const item = DECOR[held.item];
  held.x = Math.min(Math.max(0, held.x), bedroomWidth(home.size) - item.w);
  held.y = item.wall ? 0 : Math.min(Math.max(0, held.y), WING_DEPTH - item.h);
}

function placeHeld() {
  if (!decorFits(home.size, home.placed, held)) {
    playClickSound();
    hooks.notice("That doesn't fit there. Try another spot (it can't block the doorway).");
    return;
  }
  home.placed.push({ item: held.item, x: held.x, y: held.y });
  held = null;
  store();
  shareDecor();
  playCrumbSound();
  unlock("decorator");
  if (home.placed.length >= 10) unlock("designer");
  renderBar();
}

// Escape: a piece that was already placed goes back where it was; a new
// one goes back in the list.
function cancelHeld() {
  if (held.from) home.placed.push({ item: held.item, x: held.from.x, y: held.from.y });
  held = null;
  renderBar();
}

// Delete: the piece goes back in the list (you still own it).
function putAwayHeld() {
  const wasPlaced = !!held.from;
  held = null;
  if (wasPlaced) {
    store();
    shareDecor();
  }
  playClickSound();
  renderBar();
}

// For drawing: the held piece where it would go, and whether it fits.
export function heldPiece() {
  const room = decorating && held ? hooks.myRoom() : null;
  if (!room) return null;
  return { f: decorPiece(held, room.x, room.y, { color: hooks.color(), mine: true }, -1), ok: decorFits(home.size, home.placed, held) };
}

document.getElementById("decorate-done").addEventListener("click", (e) => {
  stopDecorating();
  playClickSound();
  e.currentTarget.blur();
});

window.addEventListener(
  "keydown",
  (e) => {
    if (!decorating || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    // While decorating, keys belong to decorating (so you don't walk off).
    e.stopImmediatePropagation();
    if (key === "escape") {
      e.preventDefault();
      if (held) cancelHeld();
      else stopDecorating();
      return;
    }
    if (!held) return;
    const moves = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
    if (Object.hasOwn(moves, key)) {
      e.preventDefault();
      held.x += moves[key][0] * STEP;
      held.y += moves[key][1] * STEP;
      clampHeld();
    } else if (key === "enter" || key === " ") {
      e.preventDefault();
      placeHeld();
    } else if (key === "delete" || key === "backspace") {
      e.preventDefault();
      putAwayHeld();
    }
  },
  true
);

// The mouse: the held piece follows it, a click puts it down, and
// clicking a placed piece (while not holding one) picks it up.
const canvas = document.getElementById("house");

function roomPoint(e) {
  const room = hooks.myRoom();
  if (!room) return null;
  const r = canvas.getBoundingClientRect();
  const g = screenToGrid(canvas, e.clientX - r.left, e.clientY - r.top);
  return { x: g.x - room.x, y: g.y - room.y };
}

canvas.addEventListener("mousemove", (e) => {
  if (!decorating || !held) return;
  const p = roomPoint(e);
  if (!p) return;
  const item = DECOR[held.item];
  held.x = snap(p.x - item.w / 2);
  held.y = item.wall ? 0 : snap(p.y - item.h / 2);
  clampHeld();
});

canvas.addEventListener("click", (e) => {
  if (!decorating) return;
  const p = roomPoint(e);
  if (!p) return;
  if (held) {
    placeHeld();
    return;
  }
  // Topmost piece under the mouse (wall pieces: the wall above the room).
  for (let i = home.placed.length - 1; i >= 0; i--) {
    const piece = home.placed[i];
    const item = DECOR[piece.item];
    const inX = p.x >= piece.x && p.x <= piece.x + item.w;
    const inY = item.wall ? p.y >= -1.1 && p.y <= 0.1 : p.y >= piece.y - 0.6 && p.y <= piece.y + item.h;
    if (inX && inY) {
      pickUpPlaced(i);
      return;
    }
  }
});
