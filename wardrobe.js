// The wardrobe: buy one at Nest & Nook, place it in your bedroom, and
// press E at it to change your color, hat, shoes and pet without going
// back to the Join screen. Changes show right away.
//
// It looks like the shop: a big preview of you (with your pet beside
// you), color swatches, and tabs of picture tiles. Click a tile to wear
// it, click it again to take it off.
//
// Accounts listed in CONFIG.exaltedNames also get an Exalted tab: a
// hooded robe, a sigil circle, floating candles and rune footsteps, each
// switched on or off separately (drawn in render.js, seen by friends).
import { playClickSound } from "./audio.js";

const panel = document.getElementById("wardrobe-panel");
const preview = document.getElementById("wardrobe-preview");
const colorsRow = document.getElementById("wardrobe-colors");
const tabsRow = document.getElementById("wardrobe-tabs");
const itemsGrid = document.getElementById("wardrobe-items");

const AURA_KEY = "cozy-house-aura";
const AURA_PIECES = [
  ["robe", "Hooded robe"],
  ["sigil", "Sigil circle"],
  ["candles", "Floating candles"],
  ["runes", "Rune footsteps"],
];

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
  return Object.fromEntries(AURA_PIECES.map(([piece]) => [piece, saved[piece] === true]));
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
  return Object.fromEntries(AURA_PIECES.map(([piece]) => [piece, aura[piece] === true]));
}

// --- Your dance ---
// Pressing 4 (or /dance) does your dance. Everyone likes different music,
// so everyone picks their own style here. "Shuffle" picks one at random
// each time.
export const DANCES = [
  ["jig", "🎻", "Jig", "Folk fiddle, bouncy hops"],
  ["headbang", "🔊", "Headbang", "Trap and dubstep, heavy bass"],
  ["glitch", "⚡", "Glitch", "Breakcore, twitchy and chopped"],
  ["sway", "🌙", "Sway", "Ambient, floating slow"],
  ["disco", "🪩", "Disco", "Disco and funk, side-stepping"],
  ["rave", "💚", "Rave", "House and techno, jumping to the beat"],
  ["boombap", "🎤", "Boom Bap", "Hip-hop, a cool head nod"],
  ["mosh", "🤘", "Mosh", "Metal and rock, going wild"],
  ["pop", "💖", "Pop", "Pop and K-pop, bouncy and bright"],
  ["twostep", "🤠", "Two-Step", "Country, stepping side to side"],
  ["reggaeton", "🔥", "Reggaeton", "Latin, hips on the dembow"],
  ["swing", "🎷", "Swing", "Jazz, springy and swung"],
  ["synthwave", "🌆", "Synthwave", "80s neon, a slow cool lean"],
  ["shuffle", "🎲", "Shuffle", "A different one each time"],
];
const DANCE_KEY = "cozy-house-dance";

export function myDance() {
  let chosen = "jig";
  try {
    chosen = JSON.parse(localStorage.getItem(DANCE_KEY)) ?? "jig";
  } catch {
    // Nothing saved yet: the jig.
  }
  if (!DANCES.some(([id]) => id === chosen)) chosen = "jig";
  if (chosen !== "shuffle") return chosen;
  const styles = DANCES.filter(([id]) => id !== "shuffle");
  return styles[Math.floor(Math.random() * styles.length)][0];
}

function savedDance() {
  try {
    return JSON.parse(localStorage.getItem(DANCE_KEY)) ?? "jig";
  } catch {
    return "jig";
  }
}

// --- Drawing ---
const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

// The big preview: you, with your pet sitting beside you.
function drawPreview() {
  const look = hooks.look();
  const ctx = preview.getContext("2d");
  ctx.clearRect(0, 0, preview.width, preview.height);
  const hasPet = look.pet && look.pet !== "none";
  const me = canvas(96, 136);
  drawCharacterPreview(me, look.color, look.hat, look.shoes, myAura());
  ctx.drawImage(me, preview.width / 2 - 48 - (hasPet ? 26 : 0), preview.height - 136);
  if (hasPet) {
    const pet = canvas(88, 92);
    drawPetPreview(pet, look.pet);
    ctx.drawImage(pet, preview.width / 2 + 6, preview.height - 92);
  }
}

// A small picture for a tile: you wearing the hat or shoes, the pet, or
// an Exalted piece.
function tilePicture(tab, id) {
  const look = hooks.look();
  if (tab === "hats" || tab === "shoes") {
    const c = canvas(96, 136);
    drawCharacterPreview(c, look.color, tab === "hats" ? id : "none", tab === "shoes" ? id : "none");
    return c;
  }
  if (tab === "pets") {
    const c = canvas(88, 92);
    drawPetPreview(c, id);
    return c;
  }
  // Exalted pieces, each drawn by itself (the drawings live in render.js).
  const c = canvas(96, 96);
  const ctx = c.getContext("2d");
  if (id === "robe") {
    const me = canvas(96, 136);
    drawCharacterPreview(me, look.color, "none", "none", { robe: true });
    ctx.drawImage(me, 0, -34);
  } else if (id === "sigil") {
    ctx.save();
    ctx.translate(48, 56);
    ctx.scale(1.5, 1.5);
    drawSigil(ctx, 0, 0);
    ctx.restore();
  } else if (id === "candles") {
    ctx.save();
    ctx.scale(1.5, 1.5);
    for (const [x, y] of [[16, 46], [32, 38], [48, 46]]) drawFloatingCandle(ctx, x, y);
    ctx.restore();
  } else {
    drawRuneTrail(ctx);
  }
  return c;
}

// Three glowing runes in a little trail, like footsteps.
function drawRuneTrail(ctx) {
  const glyphs = [
    (c) => (c.moveTo(0, -6), c.lineTo(0, 6), c.moveTo(0, -2), c.lineTo(4, -6), c.moveTo(0, 2), c.lineTo(4, -2)),
    (c) => (c.moveTo(-4, 6), c.lineTo(0, -6), c.lineTo(4, 6), c.moveTo(-2, 1), c.lineTo(2, 1)),
    (c) => (c.arc(0, 0, 4.5, 0, Math.PI * 2), c.moveTo(-4.5, 0), c.lineTo(4.5, 0)),
  ];
  glyphs.forEach((glyph, k) => {
    ctx.save();
    ctx.translate(26 + k * 22, 70 - k * 16);
    ctx.scale(1.5, 0.9);
    ctx.globalAlpha = 1 - k * 0.25;
    ctx.strokeStyle = "#e0405e";
    ctx.shadowColor = "#ff5a7a";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    glyph(ctx);
    ctx.stroke();
    ctx.restore();
  });
}

// --- The panel ---
let tab = "hats";

function tabsFor() {
  const list = [["hats", "🎩 Hats"], ["shoes", "👟 Shoes"], ["pets", "🐾 Pets"], ["dances", "🕺 Dances"]];
  if (myAura()) list.push(["exalted", "✦ Exalted"]);
  return list;
}

function renderColors() {
  const look = hooks.look();
  colorsRow.innerHTML = "";
  const colors = CONFIG.wardrobeColors ?? [];
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  for (const color of colors) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "wardrobe-swatch" + (same(color, look.color) ? " chosen" : "");
    swatch.style.background = color;
    swatch.setAttribute("aria-label", color);
    swatch.addEventListener("click", () => {
      hooks.wear("color", color);
      playClickSound();
      render();
    });
    colorsRow.appendChild(swatch);
  }
  // The custom swatch: a rainbow that opens the full color picker (it
  // shows your color once you've picked one that isn't a swatch).
  const isCustom = !colors.some((c) => same(c, look.color));
  const custom = document.createElement("label");
  custom.className = "wardrobe-swatch custom" + (isCustom ? " chosen" : "");
  custom.title = "Pick any color";
  if (isCustom) custom.style.background = look.color;
  const picker = document.createElement("input");
  picker.type = "color";
  picker.value = look.color;
  picker.setAttribute("aria-label", "Pick any color");
  picker.addEventListener("input", () => {
    hooks.wear("color", picker.value);
    drawPreview();
  });
  picker.addEventListener("change", () => render());
  custom.appendChild(picker);
  colorsRow.appendChild(custom);
}

function renderTabs() {
  tabsRow.innerHTML = "";
  if (!tabsFor().some(([id]) => id === tab)) tab = "hats";
  for (const [id, label] of tabsFor()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = (id === tab ? "active" : "") + (id === "exalted" ? " exalted" : "");
    button.addEventListener("click", () => {
      tab = id;
      playClickSound();
      render();
    });
    tabsRow.appendChild(button);
  }
}

function tile(picture, name, on, onClick, exalted = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "wardrobe-tile" + (on ? " wearing" : "") + (exalted ? " exalted" : "");
  el.setAttribute("aria-pressed", on);
  const art = document.createElement("span");
  art.className = "wardrobe-art";
  art.appendChild(picture);
  const label = document.createElement("span");
  label.className = "wardrobe-name";
  label.textContent = name;
  el.append(art, label);
  if (on) {
    const badge = document.createElement("span");
    badge.className = "wardrobe-badge";
    badge.textContent = exalted ? "On" : tab === "dances" ? "Chosen" : "Wearing";
    el.appendChild(badge);
  }
  el.addEventListener("click", onClick);
  return el;
}

function renderItems() {
  itemsGrid.innerHTML = "";
  if (tab === "dances") {
    const chosen = savedDance();
    for (const [id, icon, name, blurb] of DANCES) {
      const picture = document.createElement("span");
      picture.className = "wardrobe-dance-icon";
      picture.textContent = icon;
      const onClick = () => {
        try {
          localStorage.setItem(DANCE_KEY, JSON.stringify(id));
        } catch {
          // Storage blocked: it just won't be remembered.
        }
        playClickSound();
        render();
      };
      const card = tile(picture, name, id === chosen, onClick);
      card.title = blurb;
      const note = document.createElement("span");
      note.className = "wardrobe-note";
      note.textContent = blurb;
      card.insertBefore(note, card.querySelector(".wardrobe-badge"));
      itemsGrid.appendChild(card);
    }
    const hint = document.createElement("p");
    hint.className = "wardrobe-empty";
    hint.textContent = "Press 4 (or type /dance) to dance. Friends in the room hear your music too.";
    itemsGrid.appendChild(hint);
    return;
  }
  if (tab === "exalted") {
    const aura = myAura();
    for (const [piece, name] of AURA_PIECES) {
      const onClick = () => {
        aura[piece] = !aura[piece];
        saveAura(aura);
        playClickSound();
        render();
      };
      itemsGrid.appendChild(tile(tilePicture("exalted", piece), name, aura[piece], onClick, true));
    }
    return;
  }
  const look = hooks.look();
  const type = { hats: "hat", shoes: "shoes", pets: "pet" }[tab];
  const owned = hooks.choices()[tab].filter(([id]) => id !== "none");
  if (!owned.length) {
    const empty = document.createElement("p");
    empty.className = "wardrobe-empty";
    empty.textContent = `No ${tab} yet. The raccoons in the hallway sell them!`;
    itemsGrid.appendChild(empty);
    return;
  }
  for (const [id, name] of owned) {
    const on = look[type] === id;
    const onClick = () => {
      hooks.wear(type, on ? "none" : id); // click again to take it off
      playClickSound();
      render();
    };
    itemsGrid.appendChild(tile(tilePicture(tab, id), name, on, onClick));
  }
}

function render() {
  renderColors();
  renderTabs();
  renderItems();
  drawPreview();
}

// A random outfit: any color from the swatches, and any hat, shoes and
// pet you own (or none).
const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];
document.getElementById("wardrobe-random").addEventListener("click", () => {
  const { hats, shoes, pets } = hooks.choices();
  hooks.wear("color", pickFrom(CONFIG.wardrobeColors));
  hooks.wear("hat", pickFrom(hats)[0]);
  hooks.wear("shoes", pickFrom(shoes)[0]);
  hooks.wear("pet", pickFrom(pets)[0]);
  playClickSound();
  render();
});

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
