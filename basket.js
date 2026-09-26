// Your basket (Update 4): where seeds, harvested crops, fish, bait and
// anything else you pick up outdoors are kept.
//
// It's a simple list of "how many of each thing", saved in this browser
// and in your cloud save (so it follows you when you log in elsewhere).
// Things are named like "seed:carrot", "crop:carrot" or "fish:perch", and
// whoever makes a kind of thing (garden.js, fishing.js) tells the basket
// its name, picture and price with registerItems.
//
// The 🧺 button in the header opens the basket, to see what you have.
import { playClickSound } from "./audio.js";

const STORAGE_KEY = "cozy-house-basket";
const MAX_STACK = 9999;

let items = {}; // id -> how many
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded?.items && typeof loaded.items === "object") {
    for (const [id, n] of Object.entries(loaded.items)) if (typeof id === "string" && Number.isFinite(n) && n > 0) items[id] = Math.min(MAX_STACK, Math.floor(n));
  }
} catch {
  // Nothing saved yet, or storage is blocked: start with an empty basket.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    // Storage blocked: the basket just won't be remembered.
  }
  window.dispatchEvent(new Event("basket-changed"));
  if (!panel.hidden) renderBasket();
}

// What each kind of thing is called and looks like:
// id -> { name, icon, sell (crumbs, or 0 if it can't be sold), group }.
const KNOWN = {};
export function registerItems(list) {
  Object.assign(KNOWN, list);
}

export function itemInfo(id) {
  return KNOWN[id] ?? { name: id, icon: "❔", sell: 0, group: "Other" };
}

export function basketCount(id) {
  return items[id] ?? 0;
}

export function addToBasket(id, n = 1) {
  items[id] = Math.min(MAX_STACK, (items[id] ?? 0) + n);
  store();
}

// Takes n of something out, if you have that many. True if it went.
export function takeFromBasket(id, n = 1) {
  if ((items[id] ?? 0) < n) return false;
  items[id] -= n;
  if (items[id] <= 0) delete items[id];
  store();
  return true;
}

// Everything you have whose id starts with `prefix` (like "seed:"), as
// [id, count] pairs.
export function basketItems(prefix = "") {
  return Object.entries(items).filter(([id, n]) => id.startsWith(prefix) && n > 0);
}

// Admin panel helper: fills the basket with some of everything known.
export function stockBasket() {
  for (const id of Object.keys(KNOWN)) items[id] = Math.max(items[id] ?? 0, 5);
  store();
}

// --- The basket panel ---
const panel = document.getElementById("basket-panel");
const list = document.getElementById("basket-items");
const button = document.getElementById("basket-button");

export function isBasketOpen() {
  return !panel.hidden;
}

function renderBasket() {
  list.innerHTML = "";
  const all = basketItems().sort(([a], [b]) => itemInfo(a).group.localeCompare(itemInfo(b).group) || itemInfo(a).name.localeCompare(itemInfo(b).name));
  if (all.length === 0) {
    const empty = document.createElement("p");
    empty.className = "basket-empty";
    empty.textContent = "Your basket is empty. Buy seeds from Hazel by the garden, grow something, or go fishing at the pond.";
    list.appendChild(empty);
    return;
  }
  let group = null;
  for (const [id, n] of all) {
    const info = itemInfo(id);
    if (info.group !== group) {
      group = info.group;
      const heading = document.createElement("h4");
      heading.textContent = group;
      list.appendChild(heading);
    }
    const row = document.createElement("div");
    row.className = "basket-row";
    row.innerHTML = `<span class="basket-icon"></span><span class="basket-name"></span><span class="basket-count"></span>`;
    row.querySelector(".basket-icon").textContent = info.icon;
    row.querySelector(".basket-name").textContent = info.name;
    row.querySelector(".basket-count").textContent = "× " + n;
    if (info.sell) row.title = `Sells for ${info.sell} crumbs each`;
    list.appendChild(row);
  }
}

export function openBasket() {
  renderBasket();
  panel.hidden = false;
}

export function closeBasket() {
  panel.hidden = true;
}

button?.addEventListener("click", () => {
  playClickSound();
  if (panel.hidden) openBasket();
  else closeBasket();
  button.blur();
});
document.getElementById("basket-close")?.addEventListener("click", () => {
  playClickSound();
  closeBasket();
});
window.addEventListener("keydown", (e) => {
  if (!panel.hidden && e.key === "Escape") {
    e.preventDefault();
    closeBasket();
  }
});
