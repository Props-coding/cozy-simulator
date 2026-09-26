// The bedroom journal: a private diary on the nightstand in your bedroom.
// Press E at your nightstand to open it. One page a day, with an optional
// mood, and arrows to flip back through earlier days.
//
// Only you can read it. Each page is locked (encrypted) here in your
// browser before it's sent, so the house server only ever keeps scrambled
// text; nobody else, admins included, can read it from there. The key
// that unlocks it is itself locked with your password. So:
// - The first time on a computer, you type your password to open it.
//   After that this browser remembers the key until you log out.
// - Changing your password in Account settings keeps your journal.
// - If you forget your password and use a reset code, your old pages
//   can't be opened any more (that's the price of nobody else being able to).
import { serverApi, accountName, onPasswordChange } from "./account.js";
import { playClickSound } from "./audio.js";

const KEY_STORAGE = "cozy-house-journal-key"; // { account, key } (the unlocked key, on this computer only)
const MOODS = [
  ["great", "😄", "Great"],
  ["good", "🙂", "Good"],
  ["okay", "😐", "Okay"],
  ["low", "😔", "Low"],
  ["rough", "😢", "Rough"],
];
const MAX_TEXT = 4000; // characters per day

const panel = document.getElementById("journal-panel");
const lockView = document.getElementById("journal-lock");
const lockNote = document.getElementById("journal-lock-note");
const passwordInput = document.getElementById("journal-password");
const pageView = document.getElementById("journal-page");
const dateLabel = document.getElementById("journal-date");
const prevButton = document.getElementById("journal-prev");
const nextButton = document.getElementById("journal-next");
const moodRow = document.getElementById("journal-moods");
const textArea = document.getElementById("journal-text");
const status = document.getElementById("journal-status");

let journalKey = null; // the unlocked key (a CryptoKey), or null
let lock = null; // the locked key, from the server
let pages = {}; // date -> { iv, data }, still locked
let opened = {}; // date -> { text, mood }, unlocked
let day = today();
let dirty = false;

// --- Dates, in your own time zone ---
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return date === today() ? `Today, ${label}` : label;
}

// --- Locking and unlocking (the browser's built-in Web Crypto) ---
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// A key made from your password (slow on purpose, so guessing is slow too).
async function passwordKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function seal(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: toB64(iv), data: toB64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes)) };
}

async function unseal(key, { iv, data }) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(data)));
}

const importJournalKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);

// Locks the journal's key with a password, for the server to keep.
async function lockWith(password, raw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), ...(await seal(await passwordKey(password, salt), raw)) };
}

function rememberKey(raw) {
  try {
    localStorage.setItem(KEY_STORAGE, JSON.stringify({ account: String(accountName()).toLowerCase(), key: toB64(raw) }));
  } catch {
    // Storage blocked: you'll type your password each time.
  }
}

async function rememberedKey() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_STORAGE));
    if (saved?.account !== String(accountName()).toLowerCase()) return null;
    return await importJournalKey(fromB64(saved.key));
  } catch {
    return null;
  }
}

// When you change your password, the journal's key gets locked with the
// new one (if this browser has it unlocked).
onPasswordChange(async (newPassword) => {
  const key = journalKey ?? (await rememberedKey());
  if (!key) return;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  await serverApi("PUT", "/api/journal/lock", { ...(await lockWith(newPassword, raw)), replace: true });
});

// --- Opening ---
export async function openJournal() {
  panel.hidden = false;
  playClickSound();
  status.textContent = "Opening…";
  lockView.hidden = pageView.hidden = true;
  try {
    ({ lock, entries: pages } = await serverApi("GET", "/api/journal"));
  } catch (err) {
    status.textContent = err.message;
    return;
  }
  opened = {};
  journalKey = journalKey ?? (await rememberedKey());
  if (journalKey && lock) return showDay(today());
  showLock();
}

function showLock() {
  lockView.hidden = false;
  pageView.hidden = true;
  status.textContent = "";
  lockNote.textContent = lock
    ? "Type your password to open your journal on this computer."
    : "Pick your journal's lock: type your password. Only you will ever be able to read it.";
  passwordInput.value = "";
  passwordInput.focus();
}

async function unlock() {
  const password = passwordInput.value;
  if (!password) return;
  lockNote.textContent = "Opening…";
  try {
    let raw;
    if (lock) {
      raw = await unseal(await passwordKey(password, fromB64(lock.salt)), lock);
    } else {
      // A brand new journal: make its key, and lock it with your password.
      raw = crypto.getRandomValues(new Uint8Array(32));
      lock = await lockWith(password, raw);
      await serverApi("PUT", "/api/journal/lock", lock);
    }
    journalKey = await importJournalKey(raw);
    rememberKey(raw);
    showDay(today());
  } catch (err) {
    lockNote.textContent = err instanceof DOMException
      ? "That didn't open it. If you changed your password on another computer, try your old one."
      : err.message;
  }
}

// --- A day's page ---
async function showDay(date) {
  await saveNow();
  day = date;
  lockView.hidden = true;
  pageView.hidden = false;
  dateLabel.textContent = prettyDate(date);
  if (!opened[date]) {
    opened[date] = { text: "", mood: null };
    if (pages[date]) {
      try {
        opened[date] = JSON.parse(new TextDecoder().decode(await unseal(journalKey, pages[date])));
      } catch {
        opened[date] = { text: "", mood: null, broken: true };
      }
    }
  }
  const page = opened[date];
  textArea.value = page.text ?? "";
  textArea.disabled = !!page.broken;
  status.textContent = page.broken ? "This page was locked with a key this browser doesn't have." : "Only you can read this.";
  renderMoods();
  const dates = Object.keys(pages).sort();
  prevButton.disabled = !dates.some((d) => d < date);
  nextButton.disabled = date >= today();
  if (date === today()) textArea.focus();
}

function renderMoods() {
  moodRow.innerHTML = "";
  const page = opened[day];
  for (const [id, icon, label] of MOODS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "journal-mood" + (page.mood === id ? " chosen" : "");
    button.title = label;
    button.textContent = icon;
    button.disabled = !!page.broken;
    button.addEventListener("click", () => {
      page.mood = page.mood === id ? null : id; // tap again to clear it
      dirty = true;
      renderMoods();
      saveSoon();
    });
    moodRow.appendChild(button);
  }
}

// Earlier or later days that have a page (and always today).
function flip(direction) {
  const dates = [...new Set([...Object.keys(pages), today()])].sort();
  const target = direction < 0 ? dates.filter((d) => d < day).pop() : dates.find((d) => d > day);
  if (target) showDay(target);
  playClickSound();
}

// --- Saving (a moment after you stop typing, and when you close it) ---
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  clearTimeout(saveTimer);
  if (!dirty || !journalKey) return;
  dirty = false;
  const date = day;
  const page = opened[date];
  const empty = !page.text.trim() && !page.mood;
  try {
    if (empty) {
      await serverApi("PUT", "/api/journal/entry", { date, data: null });
      delete pages[date];
    } else {
      const sealedPage = await seal(journalKey, new TextEncoder().encode(JSON.stringify({ text: page.text, mood: page.mood })));
      await serverApi("PUT", "/api/journal/entry", { date, ...sealedPage });
      pages[date] = sealedPage;
    }
    if (date === day) status.textContent = "Saved. Only you can read this.";
  } catch (err) {
    dirty = true; // try again next time
    status.textContent = err.message;
  }
}

textArea.addEventListener("input", () => {
  opened[day].text = textArea.value.slice(0, MAX_TEXT);
  dirty = true;
  status.textContent = "…";
  saveSoon();
});
textArea.maxLength = MAX_TEXT;

// Typing in here isn't walking.
for (const input of [textArea, passwordInput]) input.addEventListener("keydown", (e) => e.stopPropagation());
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
  if (e.key === "Escape") closeJournal();
});
textArea.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeJournal();
});
document.getElementById("journal-unlock").addEventListener("click", unlock);
prevButton.addEventListener("click", () => flip(-1));
nextButton.addEventListener("click", () => flip(1));
document.getElementById("journal-close").addEventListener("click", closeJournal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isJournalOpen()) closeJournal();
});
window.addEventListener("beforeunload", () => saveNow());

export function closeJournal() {
  saveNow();
  panel.hidden = true;
  playClickSound();
}

export function isJournalOpen() {
  return !panel.hidden;
}
