// The wardrobe: buy one at Nest & Nook, place it in your bedroom, and
// press E at it to change your face, color, hat, shoes and pet without going
// back to the Join screen. Changes show right away.
//
// The Join screen uses this same outfit picker (mountOutfitPicker), so
// the two always look and work the same. The tabs of things to wear come
// from CONFIG.outfitSlots.
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

// An outfit picker: a preview canvas, a row for color swatches, a row for
// tabs and a grid for tiles (given by their element ids), plus which tab
// is open. The wardrobe panel has one and the Join screen has one.
export function mountOutfitPicker(ids) {
  const el = (id) => document.getElementById(id);
  return { preview: el(ids.preview), colors: el(ids.colors), tabs: el(ids.tabs), items: el(ids.items), tab: "hats" };
}
const wardrobeUI = mountOutfitPicker({ preview: "wardrobe-preview", colors: "wardrobe-colors", tabs: "wardrobe-tabs", items: "wardrobe-items" });
// The picker being drawn (only one is ever on screen at a time).
let ui = wardrobeUI;

const AURA_KEY = "cozy-house-aura";
const AURA_PIECES = [
  ["robe", "Hooded robe"],
  ["sigil", "Sigil circle"],
  ["candles", "Floating candles"],
  ["runes", "Rune footsteps"],
];

// main.js tells us how to read and change your look, and what you own.
let hooks = { look: () => ({}), wear: () => {}, choices: () => ({ hats: [], shoes: [], pets: [] }), name: () => "", titles: () => [] };
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
  const preview = ui.preview;
  const ctx = preview.getContext("2d");
  ctx.clearRect(0, 0, preview.width, preview.height);
  const hasPet = look.pet && look.pet !== "none";
  const me = canvas(96, 136);
  drawCharacterPreview(me, look, myAura());
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
  if (Object.hasOwn(TAB_TYPES, tab) && TAB_TYPES[tab] !== "pet") {
    const c = canvas(96, 136);
    drawCharacterPreview(c, { color: look.color, face: look.face, [TAB_TYPES[tab]]: id });
    return c;
  }
  if (TAB_TYPES[tab] === "pet") {
    const c = canvas(88, 92);
    drawPetPreview(c, id);
    return c;
  }
  // Exalted pieces, each drawn by itself (the drawings live in render.js).
  const c = canvas(96, 96);
  const ctx = c.getContext("2d");
  if (id === "robe") {
    const me = canvas(96, 136);
    drawCharacterPreview(me, { color: look.color, face: look.face }, { robe: true });
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
// Each tab of things to wear, and the slot on your look it fills (from
// CONFIG.outfitSlots).
const TAB_TYPES = Object.fromEntries(CONFIG.outfitSlots.map((s) => [s.tab, s.slot]));

function tabsFor() {
  const list = [["face", "🙂 Face"], ...CONFIG.outfitSlots.map((s) => [s.tab, s.label]), ["dances", "🕺 Dances"], ["titles", "🎀 Titles"]];
  if (myAura()) list.push(["exalted", "✦ Exalted"]);
  return list;
}

function renderColors() {
  const look = hooks.look();
  const colorsRow = ui.colors;
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
  const tabsRow = ui.tabs;
  tabsRow.innerHTML = "";
  if (!tabsFor().some(([id]) => id === ui.tab)) ui.tab = "hats";
  for (const [id, label] of tabsFor()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = (id === ui.tab ? "active" : "") + (id === "exalted" ? " exalted" : "");
    button.addEventListener("click", () => {
      ui.tab = id;
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
    badge.textContent = exalted ? "On" : ["dances", "face", "titles"].includes(ui.tab) ? "Chosen" : "Wearing";
    el.appendChild(badge);
  }
  el.addEventListener("click", onClick);
  return el;
}

// A close-up of your face with one part changed, for the Face tab's
// tiles: your character is drawn, then just the head is cut out, bigger.
function facePicture(change) {
  const look = hooks.look();
  const whole = canvas(96, 136);
  drawCharacterPreview(whole, { color: look.color, face: { ...look.face, ...change } });
  const c = canvas(80, 80);
  // (In the preview the head's middle is 85 pixels down, 28 across.)
  c.getContext("2d").drawImage(whole, 48 - 34, 85 - 34, 68, 68, 0, 0, 80, 80);
  return c;
}

// The Face tab: a row each for eyes, mouth and cheeks, and freckles on or
// off. These are free, so everyone has all of them.
function renderFace() {
  const itemsGrid = ui.items;
  const face = hooks.look().face;
  const section = (title) => {
    const h = document.createElement("h4");
    h.className = "wardrobe-section";
    h.textContent = title;
    itemsGrid.appendChild(h);
  };
  const choose = (change) => {
    hooks.wear("face", { ...hooks.look().face, ...change });
    playClickSound();
    render();
  };
  const rows = [
    ["Eyes", "eyes", FACE_EYE_STYLES],
    ["Mouth", "mouth", FACE_MOUTH_STYLES],
    ["Cheeks", "blush", FACE_BLUSH_STYLES],
  ];
  for (const [title, part, styles] of rows) {
    section(title);
    for (const [id, name] of styles) {
      itemsGrid.appendChild(tile(facePicture({ [part]: id }), name, face[part] === id, () => choose({ [part]: id })));
    }
  }
  section("Freckles");
  itemsGrid.appendChild(tile(facePicture({ freckles: false }), "No freckles", !face.freckles, () => choose({ freckles: false })));
  itemsGrid.appendChild(tile(facePicture({ freckles: true }), "Freckles", face.freckles, () => choose({ freckles: true })));
}

// The Titles tab: pick the title under your name tag, or none. Titles you
// haven't earned yet show greyed out, with what earns them.
function renderTitles() {
  const itemsGrid = ui.items;
  const chosen = hooks.look().title ?? "none";
  const titles = hooks.titles();
  const pickTitle = (id) => {
    hooks.wear("title", id);
    playClickSound();
    render();
  };
  const tag = (text) => {
    const t = document.createElement("span");
    t.className = "wardrobe-title-tag";
    const name = document.createElement("span");
    name.className = "wardrobe-title-name";
    name.textContent = hooks.name();
    const line = document.createElement("span");
    line.className = "wardrobe-title-text";
    line.textContent = text || "(no title)";
    t.append(name, line);
    return t;
  };
  itemsGrid.appendChild(tile(tag(""), "No title", chosen === "none" || !titles.some((t) => t.id === chosen && t.earned), () => pickTitle("none")));
  const earned = titles.filter((t) => t.earned);
  const locked = titles.filter((t) => !t.earned);
  for (const t of earned) {
    const card = tile(tag(t.text), t.source, t.id === chosen, () => pickTitle(t.id));
    card.classList.add("wardrobe-title-tile");
    itemsGrid.appendChild(card);
  }
  const h = document.createElement("h4");
  h.className = "wardrobe-section";
  h.textContent = `Still to earn (${locked.length})`;
  if (locked.length) itemsGrid.appendChild(h);
  for (const t of locked) {
    const card = tile(tag(t.text), t.source, false, () => playClickSound());
    card.classList.add("wardrobe-title-tile", "locked");
    card.title = `Earned from ${t.source}`;
    itemsGrid.appendChild(card);
  }
}

function renderItems() {
  const itemsGrid = ui.items, tab = ui.tab;
  itemsGrid.innerHTML = "";
  if (tab === "face") return renderFace();
  if (tab === "titles") return renderTitles();
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
  const type = TAB_TYPES[tab];
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

// Draws a picker (the one given, or the last one drawn) from scratch.
function render(picker = ui) {
  ui = picker;
  renderColors();
  renderTabs();
  renderItems();
  drawPreview();
}
export { render as renderOutfitPicker };

// A random outfit: any color from the swatches, any face, and anything
// you own in each slot (or nothing).
const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];
export function randomOutfit(picker) {
  const choices = hooks.choices();
  hooks.wear("color", pickFrom(CONFIG.wardrobeColors));
  for (const { tab, slot } of CONFIG.outfitSlots) hooks.wear(slot, pickFrom(choices[tab])[0]);
  hooks.wear("face", { eyes: pickFrom(FACE_EYE_STYLES)[0], mouth: pickFrom(FACE_MOUTH_STYLES)[0], blush: pickFrom(FACE_BLUSH_STYLES)[0], freckles: Math.random() < 0.3 });
  playClickSound();
  render(picker);
}
document.getElementById("wardrobe-random").addEventListener("click", () => randomOutfit(wardrobeUI));

export function openWardrobe() {
  render(wardrobeUI);
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
