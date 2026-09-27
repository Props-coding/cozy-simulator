// The bank: your crumbs and everything you own (the raccoons' items, your
// basket, fishing progress, Nest & Nook furniture, achievements) live on
// the house server, which checks every earn and spend against its own
// prices (see "The bank" in server/server.mjs). This file keeps the
// server's latest copy, for showing, and sends each action there.
// Changing numbers in your own browser changes nothing: the next answer
// from the server puts them back.
import { serverApi } from "./account.js";

// The server's latest copy of your wallet (empty until it arrives).
let wallet = {
  crumbs: 0,
  owned: [],
  met: false,
  basket: {},
  fishing: { rods: ["twig"], rod: "twig", bait: "worm", xp: 0, log: {} },
  home: { owned: {}, size: "cozy" },
  unlocked: {},
  tiers: {},
  stats: {},
};

let hooks = { events: () => {}, error: () => {}, state: () => ({}) };
export function initBank(options) {
  hooks = { ...hooks, ...options };
}

export function myWallet() {
  return wallet;
}

// Takes in a server answer that carries your wallet (from the bank, the
// garden or your bedroom), and tells the rest of the page.
export function applyBank(answer) {
  if (!answer?.wallet) return;
  const before = wallet.crumbs;
  wallet = answer.wallet;
  window.dispatchEvent(new CustomEvent("bank-changed", { detail: { gained: wallet.crumbs > before } }));
  window.dispatchEvent(new Event("crumbs-changed"));
  window.dispatchEvent(new Event("basket-changed"));
  if (answer.events?.length) hooks.events(answer.events);
}

// Fetches your wallet (account.js calls this when you log in).
export async function loadBank() {
  applyBank(await serverApi("GET", "/api/bank"));
}

// One bank action, like bank("buy", { id: "crown" }). Returns what the
// server says happened, or null if it said no (the reason is shown).
export async function bank(action, extra = {}) {
  try {
    const answer = await serverApi("POST", "/api/bank", { action, ...extra });
    applyBank(answer);
    return answer.result ?? {};
  } catch (err) {
    hooks.error(err.message);
    return null;
  }
}

// --- Time in the house ---
// Once a minute: which room you're in, whether you're asleep, and whether
// you're really here (the tab is showing and you've done something in the
// last few minutes). The server counts the time and gives a crumb a minute.
// Chats, emotes and dances since last time go along too (for their tiers).
const pending = { chats: 0, emotesUsed: 0, dances: 0 };
export function noteStat(stat, n = 1) {
  if (Object.hasOwn(pending, stat)) pending[stat] += n;
}

let lastActive = Date.now();
for (const type of ["keydown", "pointerdown", "pointermove", "wheel"]) window.addEventListener(type, () => (lastActive = Date.now()), { capture: true, passive: true });

let ticking = null;
export function startTicking() {
  ticking ??= setInterval(async () => {
    const active = document.visibilityState === "visible" && Date.now() - lastActive < CONFIG.crumbsActiveMinutes * 60_000;
    const counts = { ...pending };
    for (const k of Object.keys(pending)) pending[k] = 0;
    const result = await bank("tick", { ...hooks.state(), active, ...counts });
    if (result === null) for (const [k, n] of Object.entries(counts)) pending[k] += n; // try again next minute
  }, 60_000);
}
