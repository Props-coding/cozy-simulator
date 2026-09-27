// Achievements: little badges for things you do in the house, each with a
// crumb reward. Unlocking one pops up a card over the house, and tells
// friends in the House chat.
//
// There are two kinds. "Moments" are one-time things (knock on a door,
// talk to the raccoons). "Tiered" achievements keep going: Bronze, Silver,
// Gold and up, with crumbs for every tier (they're listed in config.js,
// CONFIG.tieredAchievements, so it's easy to add more or change goals).
//
// Which ones you have, your tiers and the counters tiers are counted in
// are kept by the house server (the bank, see bank.js), which pays the
// crumbs. The server gives the ones it sees happen itself (buying,
// fishing, gardening: `server` in catalog.js); the page claims the rest.
import { pictureCanvas } from "./pictures.js";
import { iconCanvas } from "./icons.js";
import { playAchievementSound } from "./audio.js";
import { bank, myWallet, noteStat } from "./bank.js";
import { heartToast } from "./residents.js";

// Every moment (one-time achievement) is listed in catalog.js (shared
// with the house server, which pays the rewards).
export const ACHIEVEMENTS = ACHIEVEMENT_LIST;

const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// The groups moments are shown in on profile cards (tiered achievements
// are their own group, "Milestones", first).
export const MOMENT_GROUPS = [
  ["Settling in", ["welcome", "tour", "office", "lock", "knock", "doodle", "movie", "bookworm", "snack", "bedroomMade", "goodnight", "sleepover", "decorator", "designer", "roomy", "penPal", "gotMail", "newsReader"]],
  ["Friends", ["hello", "roommates", "fullHouse", "expressive", "jigParty"]],
  ["Time of day", ["nightOwl", "earlyBird"]],
  ["Raccoons and pets", ["raccoons", "firstBuy", "allHats", "allShoes", "patPat", "pettingZoo", "hoarder"]],
  ["Outdoors", ["firstSeed", "rainCheck", "farmStand", "greatPumpkin", "firstCatch", "bigOne", "legendCatch", "pondScholar", "fullTank", "junkDealer"]],
  ["Kitchen and trade", ["firstDish", "burntOffering", "wellFed", "sharing", "fortuneTold", "cookbook", "firstTrade", "wellTraveled"]],
  ["Residents", ["happyToHelp", "cloverFriend", "mortimerFriend"]],
  ["Secrets", ["whoAreYou", "foodComa", "danceFloor"]],
];

function tracks() {
  return CONFIG.tieredAchievements ?? [];
}
function tiers() {
  return CONFIG.achievementTiers ?? [];
}

// --- Saved in this browser ---
// stats: this browser's own counters (like minutes in the Library, for
// Bookworm); the ones tiers are counted in live on the server.
// pinned: up to 5 achievement ids (moments or tiered) shown on your profile.
const STORAGE_KEY = "cozy-house-achievements";
const MAX_PINS = 5;
// Counters the server keeps (chats, emotes and dances are sent along with
// the once-a-minute check-in; the rest it counts itself).
const SERVER_STATS = new Set(["seconds", "sleepSeconds", "chats", "focusSessions", "crumbsEarned", "emotesUsed", "dances", "daysVisited", "harvests", "friendsWatered", "fishCaught", "dishesCooked", "lastDay"]);
const serverStat = (stat) => SERVER_STATS.has(stat) || stat.startsWith("room_");
let save = { stats: {}, pinned: [] };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    save.pinned = (Array.isArray(loaded.pinned) ? loaded.pinned : []).filter((id) => byId[id] || tracks().some((t) => t.id === id)).slice(0, MAX_PINS);
    for (const [key, value] of Object.entries(loaded.stats ?? {})) {
      if (!serverStat(key) && (Number.isFinite(value) || Array.isArray(value))) save.stats[key] = value;
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
// main.js passes in how to tell friends.
let hooks = { announce: () => {}, announceTier: () => {} };
export function initAchievements(options) {
  hooks = { ...hooks, ...options };
}

export function hasAchievement(id) {
  return Object.hasOwn(myWallet().unlocked, id);
}

// Claims an achievement the page saw happen (does nothing if you already
// have it, or if it's one the server gives itself). The pop-up comes when
// the server says yes (see showBankEvents).
const claiming = new Set();
export function unlock(id) {
  if (!byId[id] || byId[id].server || hasAchievement(id) || claiming.has(id)) return;
  claiming.add(id);
  bank("achieve", { id }).finally(() => claiming.delete(id));
}

// What the server says you just earned: pop-ups, and a line for friends.
// (Lots of tiers at once, like the first time, get one pop-up.)
export function showBankEvents(events) {
  // A new friendship heart with a resident (Update 6).
  for (const e of events) if (e.type === "hearts") showToast(heartToast(e));
  for (const e of events) {
    if (e.type !== "achievement" || !byId[e.id]) continue;
    showToast({ ...byId[e.id], iconKey: e.id, label: "Achievement!" });
    hooks.announce(e.id);
  }
  const reached = events.filter((e) => e.type === "tier" && tracks().some((t) => t.id === e.id) && tiers()[e.level - 1]);
  if (reached.length > 3) {
    const crumbs = reached.reduce((sum, e) => sum + e.crumbs, 0);
    showToast({ kind: "tier", iconKey: "medal:0", label: "Tiered achievements!", name: `You're already at ${reached.length} tiers`, desc: "See them on your profile (the trophy button).", crumbs });
    return;
  }
  for (const e of reached) {
    const track = tracks().find((t) => t.id === e.id);
    const tier = tiers()[e.level - 1];
    showToast({ kind: "tier", iconKey: track.id, label: `${tier.name} tier!`, name: track.name, desc: goalText(track, e.level - 1), crumbs: e.crumbs });
    hooks.announceTier(e.id, e.level);
  }
}

// Admin panel helpers (for testing): unlock everything quietly (no
// pop-ups, crumbs or chat lines), or start over from nothing.
export function unlockAllQuietly() {
  bank("adminUnlockAll");
}

export function resetAchievements() {
  save = { stats: {}, pinned: [] };
  store();
  bank("adminResetAchievements");
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

// Your counters, like { seconds, chats, room_study, ... } (read only):
// the server's, plus this browser's own.
export function myStats() {
  return { ...save.stats, ...myWallet().stats };
}

// Adds to a counter, and returns the new total. (Chats, emotes and dances
// go to the server with the next check-in; it counts the others itself.)
export function count(stat, amount = 1) {
  if (serverStat(stat)) {
    noteStat(stat, amount);
    return myStats()[stat] ?? 0;
  }
  save.stats[stat] = (Number.isFinite(save.stats[stat]) ? save.stats[stat] : 0) + amount;
  store();
  return save.stats[stat];
}

// Sets one of this browser's counters to a value.
export function setStat(stat, value) {
  save.stats[stat] = value;
  store();
}

// --- Tiered achievements ---
// How far along someone is on one: from their counters (`s`), plus `values`
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
    harvests: n(s.harvests),
    friendsWatered: n(s.friendsWatered),
    fishCaught: n(s.fishCaught),
    dishesCooked: n(s.dishesCooked),
  };
  const v = Object.hasOwn(built, track.stat) ? built[track.stat] : values[track.stat];
  return n(v);
}

// How many tiers you've reached on a tiered achievement (0 for none yet).
export function tierOf(id) {
  return myWallet().tiers[id] ?? 0;
}

// All your tiers, as { id: count } (for titles and your profile).
export function myTiers() {
  return myWallet().tiers;
}

// A goal written out, like "Spend 10 hours in the house."
export function goalText(track, index) {
  const goal = track.goals[index];
  return track.desc.replace("{n}", goal < 1 ? String(goal) : goal.toLocaleString()).replaceAll("{s}", goal === 1 ? "" : "s");
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
  // The picture: a drawing from icons.js (iconKey: an achievement, a
  // room, a medal) or pictures.js (picture), never an emoji.
  const iconEl = toast.querySelector(".toast-icon");
  iconEl.textContent = "";
  const drawn = a.iconKey ? iconCanvas(a.iconKey, 34) : a.picture ? pictureCanvas(a.picture, 34) : null;
  if (drawn) iconEl.appendChild(drawn);
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
