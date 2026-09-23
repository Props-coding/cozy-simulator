// The wardrobe: buy one at Nest & Nook, place it in your bedroom, and
// press E at it to change your color, hat, shoes and pet without going
// back to the Join screen. Changes show right away.
//
// Accounts listed in CONFIG.exaltedNames also get the Exalted look here:
// a hooded robe, a sigil circle, floating candles and rune footsteps, each
// switched on or off separately (drawn in render.js, seen by friends).
import { playClickSound } from "./audio.js";

const panel = document.getElementById("wardrobe-panel");
const colorInput = document.getElementById("wardrobe-color");
const hatSelect = document.getElementById("wardrobe-hat");
const shoesSelect = document.getElementById("wardrobe-shoes");
const petSelect = document.getElementById("wardrobe-pet");
const exaltedBox = document.getElementById("wardrobe-exalted");
const preview = document.getElementById("wardrobe-preview");

const AURA_KEY = "cozy-house-aura";
const AURA_PIECES = ["robe", "sigil", "candles", "runes"];

// main.js tells us how to read and change your look, and what you own.
let hooks = { look: () => ({}), wear: () => {}, choices: () => ({ hats: [], shoes: [], pets: [] }), name: () => "" };
export function initWardrobe(options) {
  hooks = options;
}

// True if this account can wear the Exalted look.
export function isExalted(name) {
  const key = String(name ?? "").trim().toLowerCase();
  return (CONFIG.exaltedNames ?? []).some((n) => n.toLowerCase() === key);
}

// Your Exalted pieces as saved: { robe, sigil, candles, runes } (all off
// by default), or null if your account can't wear it.
let cachedAura = null, cachedFor = null; // (read once, not every frame)
export function myAura() {
  if (cachedFor === hooks.name()) return cachedAura;
  cachedFor = hooks.name();
  cachedAura = isExalted(cachedFor) ? readAura() : null;
  return cachedAura;
}

function readAura() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(AURA_KEY)) ?? {};
  } catch {
    // Nothing saved yet.
  }
  return Object.fromEntries(AURA_PIECES.map((piece) => [piece, saved[piece] === true]));
}

function saveAura(aura) {
  cachedAura = aura;
  try {
    localStorage.setItem(AURA_KEY, JSON.stringify(aura));
  } catch {
    // Storage blocked: it still works until you reload.
  }
}

// A friend's Exalted pieces, as they sent them: only true/false values,
// and only if their name is on the list.
export function cleanAura(aura, name) {
  if (!aura || typeof aura !== "object" || !isExalted(name)) return null;
  return Object.fromEntries(AURA_PIECES.map((piece) => [piece, aura[piece] === true]));
}

function fill(select, choices, chosen) {
  select.innerHTML = "";
  for (const [id, name] of choices) select.add(new Option(name, id));
  select.value = choices.some(([id]) => id === chosen) ? chosen : "none";
}

function drawPreview() {
  const look = hooks.look();
  drawCharacterPreview(preview, look.color, look.hat, look.shoes, myAura());
}

function render() {
  const look = hooks.look();
  const { hats, shoes, pets } = hooks.choices();
  colorInput.value = look.color;
  fill(hatSelect, hats, look.hat);
  fill(shoesSelect, shoes, look.shoes);
  fill(petSelect, pets, look.pet);
  const aura = myAura();
  exaltedBox.hidden = !aura;
  if (aura) {
    for (const box of exaltedBox.querySelectorAll("input[data-piece]")) box.checked = aura[box.dataset.piece];
  }
  drawPreview();
}

const change = (type, value) => {
  hooks.wear(type, value);
  drawPreview();
};
colorInput.addEventListener("input", () => change("color", colorInput.value));
hatSelect.addEventListener("change", () => (change("hat", hatSelect.value || "none"), playClickSound()));
shoesSelect.addEventListener("change", () => (change("shoes", shoesSelect.value || "none"), playClickSound()));
petSelect.addEventListener("change", () => (change("pet", petSelect.value || "none"), playClickSound()));
for (const box of exaltedBox.querySelectorAll("input[data-piece]")) {
  box.addEventListener("change", () => {
    const aura = myAura();
    aura[box.dataset.piece] = box.checked;
    saveAura(aura);
    drawPreview();
    playClickSound();
  });
}

export function openWardrobe() {
  render();
  panel.hidden = false;
  playClickSound();
}

export function closeWardrobe() {
  panel.hidden = true;
}

export function isWardrobeOpen() {
  return !panel.hidden;
}

document.getElementById("wardrobe-close").addEventListener("click", () => {
  closeWardrobe();
  playClickSound();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isWardrobeOpen()) closeWardrobe();
});
