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

// Admin panel helpers (for testing): one of every Nest & Nook item, and
// the Roomy upgrade.
export function grantAllDecor() {
  for (const id of Object.keys(DECOR)) home.owned[id] = Math.max(home.owned[id] || 0, 1);
  store();
}

export function grantRoomy() {
  home.size = "roomy";
  store();
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
// A little boutique website on the laptop: a striped awning, Wren the
// shopkeeper bird (who picks something special each day and thanks you
// when you buy), a tab for each part of the shop, and item cards.
const STORE_TABS = [
  ["furniture", "🛋️", "Furniture", "Pieces to sit, sleep and stash things on."],
  ["cozy", "🌿", "Plants & rugs", "Green friends, soft rugs and little comforts."],
  ["wall", "🖼️", "Walls", "Windows, pictures and things to hang up."],
  ["upgrades", "✨", "Upgrades", "Make your room itself a little bigger."],
];
// Items added in build 0.40 get a "New!" ribbon.
const NEW_ITEMS = new Set([
  "loveseatSage", "loveseatRose", "coffeeTable", "dresser", "writingDesk", "rockingChair", "recordPlayer", "fishTank", "piano", "arcade", "telescope", "globe", "toyChest",
  "fern", "monstera", "cactus", "snakePlant", "succulents", "fiddleFig", "palm", "lemonTree", "candles", "bookStacks", "floorCushions", "lavaLamp", "roundRugCream", "roundRugTeal",
  "corkBoard", "jarShelf", "pothosShelf", "posterStars", "posterMountains", "posterCat", "worldMap", "neonSign",
]);
const WREN_HELLOS = [
  "Welcome in! Mind the dust bunnies, they're decorative.",
  "Oh, hello! Everything here was hand-picked. By me. With my beak.",
  "Browse all you like. I'll just be here, fluffing.",
  "Looking for something cozy? You've come to the right nook.",
];
const WREN_THANKS = [
  "Lovely choice! It'll look sweet in your room.",
  "Thank you kindly! Wrapped with a bit of string.",
  "Oh, that one's a favorite. Enjoy!",
  "Delivered straight to your bedroom. Free of charge!",
];
const WREN_PICK_LINES = ["I'd put this by a window.", "Everyone's asking about this one.", "Trust me on this.", "It just makes a room, you know?"];
const pickLine = (list) => list[Math.floor(Math.random() * list.length)];

let storeTab = "furniture";
let wrenSays = pickLine(WREN_HELLOS);

// Draws the store into `page` (a laptop page). `onTab` hears which
// section is showing (the laptop puts it in the address bar).
let tellTab = () => {};
export function renderStore(page, onTab = tellTab) {
  tellTab = onTab;
  tellTab(storeTab);
  const scroll = page.scrollTop;
  page.innerHTML = "";
  page.classList.add("nook-page");
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // The shop front: a striped awning, the logo and your crumbs.
  const front = make("header", "nook-front");
  front.appendChild(make("div", "nook-awning"));
  const sign = make("div", "nook-sign");
  sign.innerHTML = '<svg class="nook-logo" aria-hidden="true"><use href="#nook-bird"></use></svg>';
  const words = make("div", "nook-words");
  words.append(make("strong", "", "Nest & Nook"), make("span", "", "little comforts for little rooms"));
  const wallet = make("span", "nook-wallet");
  wallet.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  wallet.append(String(crumbBalance()));
  sign.append(words, wallet);
  front.appendChild(sign);

  // Wren, the shopkeeper, with something to say.
  const wren = make("div", "nook-wren");
  wren.innerHTML = '<svg class="nook-wren-bird" aria-hidden="true"><use href="#nook-bird"></use></svg>';
  wren.appendChild(make("p", "nook-bubble", wrenSays));

  const tabs = make("nav", "nook-tabs");
  for (const [id, icon, label] of STORE_TABS) {
    const tab = make("button", "nook-tab-" + id);
    tab.type = "button";
    tab.append(make("span", "nook-tab-icon", icon), label);
    tab.classList.toggle("active", id === storeTab);
    tab.addEventListener("click", () => {
      storeTab = id;
      playClickSound();
      page.scrollTop = 0;
      renderStore(page);
    });
    tabs.appendChild(tab);
  }

  const [, , label, blurb] = STORE_TABS.find(([id]) => id === storeTab);
  const section = make("section", "nook-section nook-" + storeTab);
  const heading = make("div", "nook-heading");
  heading.append(make("h3", "", label), make("p", "", blurb));
  section.appendChild(heading);

  if (storeTab === "upgrades") {
    section.appendChild(upgradeCard(page));
  } else {
    const items = Object.entries(DECOR).filter(([, it]) => it.tab === storeTab);
    // Wren's pick: a different item each day.
    const day = Math.floor(Date.now() / 86_400_000);
    const [pickId, pick] = items[day % items.length];
    section.appendChild(pickCard(page, pickId, pick));
    const grid = make("div", "nook-grid");
    for (const [id, item] of items) grid.appendChild(itemCard(page, id, item));
    section.appendChild(grid);
  }

  const footer = make("footer", "nook-footer", "Nest & Nook · free delivery to your bedroom · est. 2026 · 🪺");
  page.append(front, wren, tabs, section, footer);
  page.scrollTop = scroll;
}

// Buying something: pay, add it to your home, a heart pops up, and Wren
// says thanks.
function buy(page, id, item, button) {
  if (!spendCrumbs(item.price)) {
    playClickSound();
    button.textContent = `${item.price - crumbBalance()} crumbs short`;
    button.classList.add("short");
    return;
  }
  home.owned[id] = Math.min(99, (home.owned[id] || 0) + 1);
  store();
  playCrumbSound();
  wrenSays = pickLine(WREN_THANKS);
  hooks.notice(`${item.name} is yours! Open Decorate on the laptop to place it.`);
  const rect = button.getBoundingClientRect(), box = page.getBoundingClientRect();
  renderStore(page);
  const heart = document.createElement("span");
  heart.className = "nook-heart";
  heart.textContent = "💖";
  heart.style.left = `${rect.left - box.left + rect.width / 2}px`;
  heart.style.top = `${rect.top - box.top + page.scrollTop}px`;
  page.appendChild(heart);
  setTimeout(() => heart.remove(), 900);
}

function priceTag(price) {
  const tag = document.createElement("span");
  tag.className = "nook-price";
  tag.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  tag.append(String(price));
  return tag;
}

function preview(item, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  drawDecorPreview(canvas, item, hooks.color());
  return canvas;
}

function basketButton(page, id, item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nook-buy";
  button.textContent = "🧺 Add to basket";
  button.addEventListener("click", () => buy(page, id, item, button));
  return button;
}

// The big "Wren's pick of the day" card at the top of a section.
function pickCard(page, id, item) {
  const el = document.createElement("div");
  el.className = "nook-pick";
  const art = document.createElement("div");
  art.className = "nook-pick-art";
  art.appendChild(preview(item, 200, 150));
  const info = document.createElement("div");
  info.className = "nook-pick-info";
  const label = document.createElement("span");
  label.className = "nook-pick-label";
  label.textContent = "✨ Wren's pick of the day";
  const name = document.createElement("h4");
  name.textContent = item.name;
  const line = document.createElement("p");
  line.textContent = `"${WREN_PICK_LINES[Math.floor(Date.now() / 86_400_000) % WREN_PICK_LINES.length]}"`;
  const row = document.createElement("div");
  row.className = "nook-pick-row";
  row.append(priceTag(item.price), basketButton(page, id, item));
  info.append(label, name, line, row);
  el.append(art, info);
  return el;
}

function itemCard(page, id, item) {
  const owned = home.owned[id] || 0;
  const el = document.createElement("div");
  el.className = "nook-item";
  if (NEW_ITEMS.has(id)) {
    const ribbon = document.createElement("span");
    ribbon.className = "nook-new";
    ribbon.textContent = "New!";
    el.appendChild(ribbon);
  }
  if (owned) {
    const have = document.createElement("span");
    have.className = "nook-owned";
    have.textContent = owned > 1 ? `in your home ×${owned}` : "in your home";
    el.appendChild(have);
  }
  const art = document.createElement("div");
  art.className = "nook-art";
  art.appendChild(preview(item, 120, 90));
  const name = document.createElement("div");
  name.className = "nook-name";
  name.textContent = item.name;
  el.append(art, name, priceTag(item.price), basketButton(page, id, item));
  return el;
}

function upgradeCard(page) {
  const roomy = home.size === "roomy";
  const el = document.createElement("div");
  el.className = "nook-pick nook-upgrade";
  const art = document.createElement("div");
  art.className = "nook-pick-art";
  art.textContent = roomy ? "🏡" : "🔨";
  const info = document.createElement("div");
  info.className = "nook-pick-info";
  const name = document.createElement("h4");
  name.textContent = "The Roomy Room";
  const line = document.createElement("p");
  line.textContent = roomy
    ? "Done! The partition wall is gone and your bedroom is roomy. Enjoy the space."
    : "Our builders take down your bedroom's partition wall, making it a good bit wider. Plenty of room for a sofa and a fish tank.";
  const row = document.createElement("div");
  row.className = "nook-pick-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nook-buy";
  button.textContent = roomy ? "Yours! 🎉" : "🔨 Upgrade my room";
  button.disabled = roomy;
  button.addEventListener("click", () => {
    if (!spendCrumbs(ROOMY_PRICE)) {
      playClickSound();
      button.textContent = `${ROOMY_PRICE - crumbBalance()} crumbs short`;
      button.classList.add("short");
      return;
    }
    home.size = "roomy";
    store();
    playCrumbSound();
    unlock("roomy");
    wrenSays = "Down comes the wall! Enjoy all that space.";
    hooks.notice("Down comes the wall! Your bedroom is roomy now.");
    renderStore(page);
  });
  row.append(priceTag(ROOMY_PRICE), button);
  info.append(name, line, row);
  el.append(art, info);
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
  held = { item: id, x: snap((width - item.w) / 2), y: item.wall ? 0 : snap((BEDROOM_DEPTH - item.h) / 2), from: null };
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
  held.y = item.wall ? 0 : Math.min(Math.max(0, held.y), BEDROOM_DEPTH - item.h);
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
