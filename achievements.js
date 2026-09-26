// Achievements: little badges for things you do in the house, each with a
// crumb reward. Unlocking one pops up a card over the house, and tells
// friends in the House chat.
//
// There are two kinds. "Moments" are one-time things (knock on a door,
// talk to the raccoons). "Tiered" achievements keep going: Bronze, Silver,
// Gold and up, with crumbs for every tier (they're listed in config.js,
// CONFIG.tieredAchievements, so it's easy to add more or change goals).
//
// Like crumbs, achievements are saved in this browser only (there's no
// server), so they don't follow you to another computer.
import { playAchievementSound } from "./audio.js";

// Every moment (one-time achievement). `secret` ones show as "???" until
// you find them.
// To add one: give it an id here, then call unlock("thatId") from the
// place in the code where it happens.
export const ACHIEVEMENTS = [
  // Settling in
  { id: "welcome", icon: "🏡", name: "Home Sweet Home", desc: "Join the house for the first time.", crumbs: 5 },
  { id: "tour", icon: "🗺️", name: "Grand Tour", desc: "Visit every room, including an office.", crumbs: 20 },
  { id: "office", icon: "🪴", name: "Corner Office", desc: "Build your own office.", crumbs: 10 },
  { id: "lock", icon: "🔒", name: "Do Not Disturb", desc: "Lock your office door.", crumbs: 5 },
  { id: "knock", icon: "🚪", name: "Knock Knock", desc: "Knock on a friend's locked office.", crumbs: 5 },
  { id: "doodle", icon: "🖍️", name: "Doodler", desc: "Draw on the Conference Room whiteboard.", crumbs: 5 },
  { id: "movie", icon: "🍿", name: "Movie Night", desc: "Play a video in the Theater.", crumbs: 10 },
  { id: "bookworm", icon: "📚", name: "Bookworm", desc: "Spend 15 minutes in the Library.", crumbs: 15 },
  { id: "snack", icon: "🍝", name: "Snack Break", desc: "Spend 10 minutes in the Dinner room.", crumbs: 10 },
  { id: "bedroomMade", icon: "🛏️", name: "A Room of One's Own", desc: "Step into your own bedroom.", crumbs: 10 },
  { id: "goodnight", icon: "🌙", name: "Goodnight", desc: "Get into bed.", crumbs: 5 },
  { id: "sleepover", icon: "🧸", name: "Sleepover", desc: "Hang out in a bedroom with a friend.", crumbs: 15 },
  { id: "decorator", icon: "🪴", name: "Making It Home", desc: "Place something in your bedroom.", crumbs: 10 },
  { id: "designer", icon: "🛋️", name: "Interior Designer", desc: "Have 10 pieces placed in your bedroom.", crumbs: 40 },
  { id: "roomy", icon: "🔨", name: "Moving On Up", desc: "Buy the Roomy upgrade at Nest & Nook.", crumbs: 30 },
  { id: "penPal", icon: "✉️", name: "Pen Pal", desc: "Write a letter on your laptop.", crumbs: 10 },
  { id: "gotMail", icon: "📬", name: "You've Got Mail", desc: "Receive a letter.", crumbs: 10 },
  { id: "newsReader", icon: "📰", name: "Well Informed", desc: "Read the news on your laptop.", crumbs: 5 },

  // Friends
  { id: "hello", icon: "💬", name: "Hello There", desc: "Send your first chat message.", crumbs: 5 },
  { id: "roommates", icon: "🤝", name: "Roommates", desc: "Be in the same room as a friend.", crumbs: 5 },
  { id: "fullHouse", icon: "🎉", name: "Full House", desc: "Hang out with 3 friends at once.", crumbs: 25 },
  { id: "expressive", icon: "🎭", name: "Expressive", desc: "Use all five emotes.", crumbs: 10 },
  { id: "jigParty", icon: "🪩", name: "Dance Party", desc: "Dance at the same time as a friend.", crumbs: 20 },

  // Time in the house
  { id: "nightOwl", icon: "🦉", name: "Night Owl", desc: "Be in the house between 1 and 4 in the morning.", crumbs: 15 },
  { id: "earlyBird", icon: "🐦", name: "Early Bird", desc: "Be in the house between 5 and 7 in the morning.", crumbs: 15 },

  // The raccoons, and pets
  { id: "raccoons", icon: "🦝", name: "Shady Dealings", desc: "Talk to the raccoons in the trenchcoat.", crumbs: 5 },
  { id: "firstBuy", icon: "🛍️", name: "Retail Therapy", desc: "Buy something from the raccoons.", crumbs: 10 },
  { id: "allHats", icon: "🎩", name: "Mad Hatter", desc: "Own every hat the raccoons sell.", crumbs: 100 },
  { id: "allShoes", icon: "👢", name: "Well Heeled", desc: "Own every pair of shoes.", crumbs: 60 },
  { id: "patPat", icon: "🤲", name: "Pat Pat", desc: "Pet a pet (walk up to one and press E).", crumbs: 5 },
  { id: "pettingZoo", icon: "💞", name: "Petting Zoo", desc: "Pet a friend's pet.", crumbs: 10 },
  { id: "hoarder", icon: "🍪", name: "Crumb Hoarder", desc: "Have 500 crumbs at once.", crumbs: 25 },

  // Secrets
  { id: "whoAreYou", icon: "🧥", name: "Three Raccoons?", desc: "Ask the raccoons who they really are.", crumbs: 10, secret: true },
  { id: "foodComa", icon: "😴", name: "Food Coma", desc: "Get sleepy in the Dinner room.", crumbs: 10, secret: true },
  { id: "danceFloor", icon: "🎬", name: "Dance Floor", desc: "Dance in the Theater.", crumbs: 10, secret: true },
];

const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// The groups moments are shown in on profile cards (tiered achievements
// are their own group, "Milestones", first).
export const MOMENT_GROUPS = [
  ["Settling in", ["welcome", "tour", "office", "lock", "knock", "doodle", "movie", "bookworm", "snack", "bedroomMade", "goodnight", "sleepover", "decorator", "designer", "roomy", "penPal", "gotMail", "newsReader"]],
  ["Friends", ["hello", "roommates", "fullHouse", "expressive", "jigParty"]],
  ["Time of day", ["nightOwl", "earlyBird"]],
  ["Raccoons and pets", ["raccoons", "firstBuy", "allHats", "allShoes", "patPat", "pettingZoo", "hoarder"]],
  ["Secrets", ["whoAreYou", "foodComa", "danceFloor"]],
];

// One-time achievements that became tiers (see `was` in config.js). They
// stay in your save, so the tiers know you were already paid for them.
const RETIRED = new Set(tracks().flatMap((t) => t.was ?? []).filter(Boolean));

function tracks() {
  return CONFIG.tieredAchievements ?? [];
}
function tiers() {
  return CONFIG.achievementTiers ?? [];
}

// --- Saved progress ---
// unlocked: id -> when. stats: counters for the "do X times" ones.
// tiers: tiered achievement id -> how many tiers reached (1 is Bronze).
// caughtUp: true once tiers existing progress earned have been given out.
const STORAGE_KEY = "cozy-house-achievements";
// pinned: up to 5 achievement ids (moments or tiered) shown on your profile.
const MAX_PINS = 5;
let save = { unlocked: {}, stats: {}, tiers: {}, caughtUp: false, pinned: [] };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    for (const id of Object.keys(loaded.unlocked ?? {})) if (byId[id] || RETIRED.has(id)) save.unlocked[id] = loaded.unlocked[id];
    for (const [id, n] of Object.entries(loaded.tiers ?? {})) if (tracks().some((t) => t.id === id) && Number.isInteger(n) && n > 0) save.tiers[id] = n;
    save.caughtUp = loaded.caughtUp === true;
    save.pinned = (Array.isArray(loaded.pinned) ? loaded.pinned : []).filter((id) => byId[id] || tracks().some((t) => t.id === id)).slice(0, MAX_PINS);
    for (const [key, value] of Object.entries(loaded.stats ?? {})) {
      if (Number.isFinite(value) || Array.isArray(value)) save.stats[key] = value;
    }
  }
} catch {
  // Nothing saved yet, or storage is blocked: start fresh.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage blocked (e.g. a private window): just won't be remembered.
  }
}

// --- Connecting to main.js ---
// main.js passes in how to give crumbs and how to tell friends.
// For tiered ones it also passes `values` (counts kept elsewhere, like
// { items, pets, roomLevels }), `announceTier` and `rooms` (your room
// levels, for the Rooms tab).
let hooks = { reward: () => {}, announce: () => {}, announceTier: () => {}, values: () => ({}), rooms: () => [] };
export function initAchievements(options) {
  hooks = { ...hooks, ...options };
}

export function hasAchievement(id) {
  return Object.hasOwn(save.unlocked, id);
}

// Unlocks an achievement (does nothing if you already have it).
export function unlock(id) {
  if (!byId[id] || hasAchievement(id)) return;
  save.unlocked[id] = Date.now();
  store();
  showToast({ ...byId[id], label: "Achievement!" });
  hooks.reward(byId[id].crumbs);
  hooks.announce(id);
  renderPanel();
}

// Admin panel helpers (for testing): unlock everything quietly (no
// pop-ups, crumbs or chat lines), or start over from nothing.
export function unlockAllQuietly() {
  for (const a of ACHIEVEMENTS) save.unlocked[a.id] ??= Date.now();
  for (const t of tracks()) save.tiers[t.id] = t.goals.length;
  save.caughtUp = true;
  store();
  renderPanel();
}

export function resetAchievements() {
  save = { unlocked: {}, stats: {}, tiers: {}, caughtUp: false, pinned: [] };
  store();
  renderPanel();
}

// --- Pins: the achievements you show off on your profile ---
export function myPins() {
  return save.pinned;
}

// Pins or unpins one. Returns false if you already have the most pins.
export function togglePin(id) {
  if (save.pinned.includes(id)) save.pinned = save.pinned.filter((p) => p !== id);
  else if (save.pinned.length >= MAX_PINS) return false;
  else save.pinned = [...save.pinned, id];
  store();
  return true;
}
export { MAX_PINS };

// Your counters, like { seconds, chats, room_study, ... } (read only).
export function myStats() {
  return save.stats;
}

// Adds to a counter, and returns the new total.
export function count(stat, amount = 1) {
  save.stats[stat] = (Number.isFinite(save.stats[stat]) ? save.stats[stat] : 0) + amount;
  store();
  return save.stats[stat];
}

// Sets a counter to a value (for things like "the last day you visited").
export function setStat(stat, value) {
  save.stats[stat] = value;
  store();
}

// --- Tiered achievements ---
// How far along you are on one: the number its goals are counted in.
function trackValue(track) {
  return trackValueFrom(track, save.stats, hooks.values());
}

// The same for anyone: from their saved counters (`s`), plus `values`
// for the counts kept elsewhere ({ items, pets, roomLevels }).
export function trackValueFrom(track, s = {}, values = {}) {
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const built = {
    hours: n(s.seconds) / 3600,
    sleepHours: n(s.sleepSeconds) / 3600,
    chats: n(s.chats),
    focusSessions: n(s.focusSessions),
    crumbsEarned: n(s.crumbsEarned),
    emotesUsed: n(s.emotesUsed),
    dances: n(s.dances),
    daysVisited: n(s.daysVisited),
  };
  const v = Object.hasOwn(built, track.stat) ? built[track.stat] : values[track.stat];
  return n(v);
}

// How many tiers you've reached on a tiered achievement (0 for none yet).
export function tierOf(id) {
  return save.tiers[id] ?? 0;
}

// All your tiers, as { id: count } (for titles and your profile).
export function myTiers() {
  return save.tiers;
}

// Checks every tiered achievement for new tiers (main.js calls this every
// few seconds, and right after you join). The very first time, tiers your
// progress already earned are given all at once, with one pop-up.
export function checkTiers() {
  const reached = [];
  let crumbs = 0;
  for (const track of tracks()) {
    const value = trackValue(track);
    let have = tierOf(track.id);
    while (have < track.goals.length && have < tiers().length && value >= track.goals[have]) {
      const tier = tiers()[have];
      const paidBefore = track.was?.[have] && hasAchievement(track.was[have]); // an old one-time achievement already paid for this
      const reward = paidBefore ? 0 : tier.crumbs;
      have++;
      save.tiers[track.id] = have;
      reached.push({ track, have, tier, reward });
      crumbs += reward;
    }
  }
  if (!reached.length && save.caughtUp) return;
  const catchingUp = !save.caughtUp;
  save.caughtUp = true;
  store();
  if (catchingUp) {
    if (reached.length) {
      showToast({ kind: "tier", icon: "🏅", label: "Tiered achievements!", name: `You're already at ${reached.length} tier${reached.length === 1 ? "" : "s"}`, desc: "Open the trophy shelf to see them.", crumbs });
      if (crumbs) hooks.reward(crumbs);
    }
  } else {
    for (const { track, have, tier, reward } of reached) {
      showToast({ kind: "tier", icon: track.icon, label: `${tier.name} tier!`, name: `${track.name} ${tier.icon}`, desc: goalText(track, have - 1), crumbs: reward });
      if (reward) hooks.reward(reward);
      hooks.announceTier(track.id, have);
    }
  }
  renderPanel();
}

// A goal written out, like "Spend 10 hours in the house."
export function goalText(track, index) {
  const goal = track.goals[index];
  return track.desc.replace("{n}", goal < 1 ? String(goal) : goal.toLocaleString());
}

// Adds something to a list (if it isn't there yet), and returns the list.
export function collect(stat, value) {
  const list = Array.isArray(save.stats[stat]) ? save.stats[stat] : [];
  if (!list.includes(value)) {
    list.push(value);
    save.stats[stat] = list;
    store();
  }
  return list;
}

// --- The pop-up card ---
const toast = document.getElementById("achievement-toast");
const toastQueue = [];
let toastShowing = false;

// Shows a pop-up card over the house (after any that are already
// waiting): { icon, label, name, desc, crumbs, kind }. Crumbs of 0 hide the
// reward; `kind` ("level", "tier") gives the card its own color.
export function showToast(card) {
  toastQueue.push(card);
  if (!toastShowing) showNextToast();
}

function showNextToast() {
  const a = toastQueue.shift();
  if (!a) {
    toastShowing = false;
    return;
  }
  toastShowing = true;
  toast.querySelector(".toast-icon").textContent = a.icon;
  toast.querySelector(".toast-label").textContent = a.label ?? "Achievement!";
  toast.querySelector(".toast-reward").hidden = !a.crumbs;
  toast.dataset.kind = a.kind ?? "";
  toast.querySelector(".toast-name").textContent = a.name;
  toast.querySelector(".toast-desc").textContent = a.desc;
  toast.querySelector(".toast-crumbs").textContent = `+${a.crumbs}`;
  // Quicker when several are waiting (like on your first visit).
  const showFor = toastQueue.length > 0 ? 2000 : 4200;
  toast.style.animationDuration = `${showFor}ms`;
  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth; // restart the slide-in animation
  toast.classList.add("show");
  playAchievementSound();
  setTimeout(() => {
    toast.hidden = true;
    showNextToast();
  }, showFor);
}

// --- The trophy shelf (the panel from the trophy button) ---
const trophyButton = document.getElementById("trophy-button");
const trophyPanel = document.getElementById("trophy-panel");
const trophyList = document.getElementById("trophy-list");
const trophyCount = document.getElementById("trophy-count");

// The shelf has three tabs: Tiers (with a bar toward each next tier),
// Rooms (your room levels) and Moments (the one-time ones).
let shelfTab = "tiers";
const trophyTabs = document.getElementById("trophy-tabs");

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A progress bar, `into` of `needed` of the way, with a label under it.
function bar(into, needed, label, color) {
  const wrap = el("span", "trophy-progress");
  const track = el("span", "trophy-bar");
  const fill = el("span");
  fill.style.width = `${needed ? Math.min(100, Math.round((into / needed) * 100)) : 100}%`;
  if (color) fill.style.background = color;
  track.appendChild(fill);
  wrap.append(track, el("span", "trophy-bar-label", label));
  return wrap;
}

const round = (v) => (v < 10 && v % 1 ? Math.floor(v * 10) / 10 : Math.floor(v)).toLocaleString();

function renderTiers() {
  for (const track of tracks()) {
    const have = tierOf(track.id);
    const max = Math.min(track.goals.length, tiers().length);
    const value = trackValue(track);
    const current = have ? tiers()[have - 1] : null;
    const next = have < max ? tiers()[have] : null;
    const li = el("li", "tiered" + (have ? " got" : ""));
    const icon = el("span", "trophy-icon", track.icon);
    const text = el("span", "trophy-text");
    const name = el("strong", "", track.name);
    if (current) {
      const medal = el("span", "trophy-medal", `${current.icon} ${current.name}`);
      medal.style.color = current.color;
      name.append(" ", medal);
    }
    text.append(name);
    if (next) {
      text.append(el("span", "", goalText(track, have)));
      text.append(bar(value - (have ? track.goals[have - 1] : 0), track.goals[have] - (have ? track.goals[have - 1] : 0), `${round(value)} / ${round(track.goals[have])} for ${next.name}`, next.color));
    } else {
      text.append(el("span", "", "Every tier reached. Legendary!"));
    }
    // The row of tier medals: the ones you have, and the ones to come.
    const medals = el("span", "trophy-medals");
    tiers().slice(0, max).forEach((t, i) => {
      const m = el("span", i < have ? "on" : "", t.icon);
      m.title = `${t.name}: ${goalText(track, i)} (+${t.crumbs} crumbs)`;
      medals.appendChild(m);
    });
    text.append(medals);
    const reward = el("span", "trophy-reward", next ? `+${next.crumbs}` : "✓");
    li.append(icon, text, reward);
    trophyList.appendChild(li);
  }
}

function renderRooms() {
  for (const r of hooks.rooms()) {
    const li = el("li", "tiered" + (r.level ? " got" : ""));
    const text = el("span", "trophy-text");
    text.append(el("strong", "", `${r.name} · Lv. ${r.level}`));
    text.append(r.needed ? bar(r.into, r.needed, `${Math.floor(r.into / 60)} / ${Math.round(r.needed / 60)} minutes to Lv. ${r.level + 1}`, "#6f9a5a") : el("span", "", "Top level reached."));
    li.append(el("span", "trophy-icon", r.icon), text);
    trophyList.appendChild(li);
  }
}

function renderMoments() {
  for (const a of ACHIEVEMENTS) {
    const got = hasAchievement(a.id);
    const hidden = a.secret && !got;
    const li = el("li", got ? "got" : "");
    const text = el("span", "trophy-text");
    text.append(el("strong", "", hidden ? "Secret" : a.name), el("span", "", hidden ? "Keep exploring to find this one." : a.desc));
    li.append(el("span", "trophy-icon", hidden ? "❔" : a.icon), text, el("span", "trophy-reward", got ? "✓" : `+${a.crumbs}`));
    trophyList.appendChild(li);
  }
}

function renderPanel() {
  const moments = ACHIEVEMENTS.filter((a) => hasAchievement(a.id)).length;
  const tierCount = Object.values(save.tiers).reduce((sum, n) => sum + n, 0);
  const tierMax = tracks().reduce((sum, t) => sum + Math.min(t.goals.length, tiers().length), 0);
  const counts = { tiers: `${tierCount} / ${tierMax}`, rooms: "", moments: `${moments} / ${ACHIEVEMENTS.length}` };
  trophyCount.textContent = counts[shelfTab];
  for (const b of trophyTabs.querySelectorAll("button")) b.classList.toggle("active", b.dataset.tab === shelfTab);
  trophyList.innerHTML = "";
  if (shelfTab === "tiers") renderTiers();
  else if (shelfTab === "rooms") renderRooms();
  else renderMoments();
}
for (const b of trophyTabs.querySelectorAll("button")) {
  b.addEventListener("click", () => {
    shelfTab = b.dataset.tab;
    renderPanel();
  });
}
renderPanel();

function setPanelOpen(open) {
  if (open) renderPanel(); // (progress bars move all the time, so fresh each time)
  trophyPanel.hidden = !open;
  trophyButton.setAttribute("aria-expanded", String(open));
}

trophyButton.addEventListener("click", () => {
  setPanelOpen(trophyPanel.hidden);
  trophyButton.blur(); // give the keyboard back to walking
});
document.addEventListener("click", (e) => {
  if (!trophyPanel.hidden && !trophyPanel.contains(e.target) && !trophyButton.contains(e.target)) setPanelOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !trophyPanel.hidden) setPanelOpen(false);
});
