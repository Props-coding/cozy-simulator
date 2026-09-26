// Friendly shopkeepers outdoors (Update 4): Hazel the hedgehog by the
// garden (seeds), and later Otis the otter by the pond (rods and bait).
//
// This file is the shop window they share: their face and name at the top,
// what they say typing out letter by letter in their own babbling voice,
// your crumbs, tabs (like "Buy" and "Sell"), and a list of things with a
// button each. Each shopkeeper (garden.js, fishing.js) describes itself and
// its tabs, and this file does the rest.
import { playBabble, playClickSound } from "./audio.js";
import { crumbBalance } from "./shop.js";

const panel = document.getElementById("npc-panel");
const face = document.getElementById("npc-face");
const nameTag = document.getElementById("npc-name");
const talk = document.getElementById("npc-text");
const tabsRow = document.getElementById("npc-tabs");
const list = document.getElementById("npc-items");
const crumbs = document.getElementById("npc-crumbs");

let npc = null; // who's open: { name, icon, color, pitch, hello, bye, tabs: [{ id, label, items() }] }
let tab = null;
let typing = null;

export function isNpcOpen() {
  return !panel.hidden;
}

// Types a line out, babbling in the shopkeeper's voice.
export function npcSay(text) {
  if (!npc) return;
  clearInterval(typing);
  talk.textContent = "";
  let i = 0;
  typing = setInterval(() => {
    const letter = text[i];
    talk.textContent += letter;
    if (i % 2 === 0 && /[a-z0-9]/i.test(letter)) playBabble(npc.pitch, letter);
    i++;
    if (i >= text.length) clearInterval(typing);
  }, 28);
}

const pick = (lines) => (Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines);

// Opens a shopkeeper's window.
export function openNpc(who) {
  npc = who;
  tab = who.tabs[0].id;
  face.textContent = who.icon;
  face.style.setProperty("--npc", who.color);
  nameTag.textContent = who.name;
  nameTag.style.setProperty("--npc", who.color);
  tabsRow.innerHTML = "";
  for (const t of who.tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t.label;
    button.dataset.tab = t.id;
    button.addEventListener("click", () => {
      tab = t.id;
      playClickSound();
      t.onOpen?.();
      refreshNpc();
    });
    tabsRow.appendChild(button);
  }
  panel.hidden = false;
  refreshNpc();
  npcSay(pick(who.hello));
}

export function closeNpc() {
  if (!npc) return;
  clearInterval(typing);
  panel.hidden = true;
  npc = null;
}

// Redraws the list (after buying or selling something, say).
export function refreshNpc() {
  if (!npc) return;
  crumbs.textContent = crumbBalance();
  for (const b of tabsRow.children) b.classList.toggle("active", b.dataset.tab === tab);
  list.innerHTML = "";
  const current = npc.tabs.find((t) => t.id === tab);
  const items = current.items();
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "npc-empty";
    empty.textContent = current.empty ?? "Nothing here right now.";
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "npc-item" + (item.locked ? " locked" : "");
    row.innerHTML = `<span class="npc-icon"></span><span class="npc-words"><b></b><small></small></span><span class="shop-price"><svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg><span></span></span>`;
    row.querySelector(".npc-icon").textContent = item.icon;
    row.querySelector("b").textContent = item.name;
    row.querySelector("small").textContent = item.note ?? "";
    row.querySelector(".shop-price span").textContent = item.price ?? "";
    if (item.price === undefined) row.querySelector(".shop-price").hidden = true;
    for (const action of item.actions ?? []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.soft ? "soft-button" : "warm-button";
      button.textContent = action.label;
      button.disabled = !!action.disabled;
      button.addEventListener("click", () => {
        const line = action.run();
        if (line) npcSay(line);
        refreshNpc();
      });
      row.appendChild(button);
    }
    list.appendChild(row);
  }
}

window.addEventListener("crumbs-changed", () => {
  if (npc) crumbs.textContent = crumbBalance();
});

document.getElementById("npc-bye").addEventListener("click", () => {
  playClickSound();
  closeNpc();
});

// While a shop is open, keys belong to it: Escape (or E) says goodbye.
window.addEventListener("keydown", (e) => {
  if (!npc) return;
  if (e.target instanceof HTMLInputElement) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape" || e.key.toLowerCase() === "e") {
    e.preventDefault();
    closeNpc();
  }
});
