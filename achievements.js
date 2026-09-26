// Achievements: little badges for things you do in the house, each with a
// crumb reward. Unlocking one pops up a card over the house, and tells
// friends in the House chat.
//
// Like crumbs, achievements are saved in this browser only (there's no
// server), so they don't follow you to another computer.
import { playAchievementSound } from "./audio.js";

// Every achievement. `secret` ones show as "???" until you find them.
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
  { id: "wellRested", icon: "😴", name: "Well Rested", desc: "Sleep for 30 minutes in total.", crumbs: 25 },
  { id: "sleepover", icon: "🧸", name: "Sleepover", desc: "Hang out in a bedroom with a friend.", crumbs: 15 },
  { id: "decorator", icon: "🪴", name: "Making It Home", desc: "Place something in your bedroom.", crumbs: 10 },
  { id: "designer", icon: "🛋️", name: "Interior Designer", desc: "Have 10 pieces placed in your bedroom.", crumbs: 40 },
  { id: "roomy", icon: "🔨", name: "Moving On Up", desc: "Buy the Roomy upgrade at Nest & Nook.", crumbs: 30 },
  { id: "penPal", icon: "✉️", name: "Pen Pal", desc: "Write a letter on your laptop.", crumbs: 10 },
  { id: "gotMail", icon: "📬", name: "You've Got Mail", desc: "Receive a letter.", crumbs: 10 },
  { id: "newsReader", icon: "📰", name: "Well Informed", desc: "Read the news on your laptop.", crumbs: 5 },
  { id: "focus", icon: "⏳", name: "Deep Focus", desc: "Finish a focus session in the Study.", crumbs: 10 },
  { id: "scholar", icon: "🎓", name: "Scholar", desc: "Finish 5 focus sessions.", crumbs: 40 },

  // Friends
  { id: "hello", icon: "💬", name: "Hello There", desc: "Send your first chat message.", crumbs: 5 },
  { id: "chatterbox", icon: "🗣️", name: "Chatterbox", desc: "Send 100 chat messages.", crumbs: 30 },
  { id: "roommates", icon: "🤝", name: "Roommates", desc: "Be in the same room as a friend.", crumbs: 5 },
  { id: "fullHouse", icon: "🎉", name: "Full House", desc: "Hang out with 3 friends at once.", crumbs: 25 },
  { id: "expressive", icon: "🎭", name: "Expressive", desc: "Use all five emotes.", crumbs: 10 },
  { id: "jig", icon: "🕺", name: "Hit the Jig", desc: "Dance (any style).", crumbs: 5 },
  { id: "jigParty", icon: "🪩", name: "Dance Party", desc: "Dance at the same time as a friend.", crumbs: 20 },

  // Time in the house
  { id: "hour", icon: "☕", name: "Regular", desc: "Spend 1 hour in the house.", crumbs: 15 },
  { id: "homebody", icon: "🛋️", name: "Homebody", desc: "Spend 10 hours in the house.", crumbs: 50 },
  { id: "resident", icon: "🔑", name: "Resident", desc: "Spend 50 hours in the house.", crumbs: 150 },
  { id: "nightOwl", icon: "🦉", name: "Night Owl", desc: "Be in the house between 1 and 4 in the morning.", crumbs: 15 },
  { id: "earlyBird", icon: "🐦", name: "Early Bird", desc: "Be in the house between 5 and 7 in the morning.", crumbs: 15 },

  // The raccoons, and pets
  { id: "raccoons", icon: "🦝", name: "Shady Dealings", desc: "Talk to the raccoons in the trenchcoat.", crumbs: 5 },
  { id: "firstBuy", icon: "🛍️", name: "Retail Therapy", desc: "Buy something from the raccoons.", crumbs: 10 },
  { id: "allHats", icon: "🎩", name: "Mad Hatter", desc: "Own every hat the raccoons sell.", crumbs: 100 },
  { id: "allShoes", icon: "👢", name: "Well Heeled", desc: "Own every pair of shoes.", crumbs: 60 },
  { id: "firstPet", icon: "🐾", name: "Best Friend", desc: "Adopt a pet.", crumbs: 15 },
  { id: "menagerie", icon: "🦆", name: "Menagerie", desc: "Adopt 5 pets.", crumbs: 60 },
  { id: "patPat", icon: "🤲", name: "Pat Pat", desc: "Pet a pet (walk up to one and press E).", crumbs: 5 },
  { id: "pettingZoo", icon: "💞", name: "Petting Zoo", desc: "Pet a friend's pet.", crumbs: 10 },
  { id: "hoarder", icon: "🍪", name: "Crumb Hoarder", desc: "Have 500 crumbs at once.", crumbs: 25 },

  // Secrets
  { id: "whoAreYou", icon: "🧥", name: "Three Raccoons?", desc: "Ask the raccoons who they really are.", crumbs: 10, secret: true },
  { id: "foodComa", icon: "😴", name: "Food Coma", desc: "Get sleepy in the Dinner room.", crumbs: 10, secret: true },
  { id: "danceFloor", icon: "🎬", name: "Dance Floor", desc: "Dance in the Theater.", crumbs: 10, secret: true },
];

const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// --- Saved progress ---
// unlocked: id -> when. stats: counters for the "do X times" ones.
const STORAGE_KEY = "cozy-house-achievements";
let save = { unlocked: {}, stats: {} };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    for (const id of Object.keys(loaded.unlocked ?? {})) if (byId[id]) save.unlocked[id] = loaded.unlocked[id];
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
let hooks = { reward: () => {}, announce: () => {} };
export function initAchievements(options) {
  hooks = options;
}

export function hasAchievement(id) {
  return Object.hasOwn(save.unlocked, id);
}

// Unlocks an achievement (does nothing if you already have it).
export function unlock(id) {
  if (!byId[id] || hasAchievement(id)) return;
  save.unlocked[id] = Date.now();
  store();
  toastQueue.push(byId[id]);
  if (!toastShowing) showNextToast();
  hooks.reward(byId[id].crumbs);
  hooks.announce(id);
  renderPanel();
}

// Admin panel helpers (for testing): unlock everything quietly (no
// pop-ups, crumbs or chat lines), or start over from nothing.
export function unlockAllQuietly() {
  for (const a of ACHIEVEMENTS) save.unlocked[a.id] ??= Date.now();
  store();
  renderPanel();
}

export function resetAchievements() {
  save = { unlocked: {}, stats: {} };
  store();
  renderPanel();
}

// Adds to a counter, and returns the new total.
export function count(stat, amount = 1) {
  save.stats[stat] = (Number.isFinite(save.stats[stat]) ? save.stats[stat] : 0) + amount;
  store();
  return save.stats[stat];
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

function showNextToast() {
  const a = toastQueue.shift();
  if (!a) {
    toastShowing = false;
    return;
  }
  toastShowing = true;
  toast.querySelector(".toast-icon").textContent = a.icon;
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

function renderPanel() {
  const have = ACHIEVEMENTS.filter((a) => hasAchievement(a.id)).length;
  trophyCount.textContent = `${have} / ${ACHIEVEMENTS.length}`;
  trophyList.innerHTML = "";
  for (const a of ACHIEVEMENTS) {
    const got = hasAchievement(a.id);
    const hidden = a.secret && !got;
    const li = document.createElement("li");
    li.className = got ? "got" : "";
    const icon = document.createElement("span");
    icon.className = "trophy-icon";
    icon.textContent = hidden ? "❔" : a.icon;
    const text = document.createElement("span");
    text.className = "trophy-text";
    const name = document.createElement("strong");
    name.textContent = hidden ? "Secret" : a.name;
    const desc = document.createElement("span");
    desc.textContent = hidden ? "Keep exploring to find this one." : a.desc;
    text.append(name, desc);
    const reward = document.createElement("span");
    reward.className = "trophy-reward";
    reward.textContent = got ? "✓" : `+${a.crumbs}`;
    li.append(icon, text, reward);
    trophyList.appendChild(li);
  }
}
renderPanel();

function setPanelOpen(open) {
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
