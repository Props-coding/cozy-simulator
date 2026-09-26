// Accounts, the house phrase, and cloud saves.
//
// Before the Join screen: log in (or create an account), and the first
// time, enter the house phrase a friend gave you. The server then tells
// this page how to reach the house (the room name, its password and the
// relay login), so none of that is in the public code any more.
//
// Cloud saves: crumbs, what you own, achievements, your bedroom, letters
// and your look are copied to your account on the server every so often,
// and brought back when you log in on any computer.
const SERVER = CONFIG.serverUrl;
const ACCOUNT_KEY = "cozy-house-account"; // { token, name }
const SYNCED_KEY = "cozy-house-synced-at"; // when the cloud save we have was made
// Everything that's saved in the browser and should follow your account.
const SAVE_KEYS = ["cozy-house-profile", "cozy-house-crumbs", "cozy-house-achievements", "cozy-house-home", "cozy-house-mail", "cozy-house-office", "cozy-house-bedroom", "cozy-house-lofi", "cozy-house-aura", "cozy-house-dance"];

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: you'll need to log in each visit.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};

let account = null;
try {
  account = JSON.parse(storage.get(ACCOUNT_KEY));
} catch {
  account = null;
}

// --- Talking to the server ---
// `keepalive` lets a request finish even as the page is closing or
// reloading (browsers only allow small ones, about 64 KB).
async function api(method, path, body, { keepalive = false } = {}) {
  let res;
  try {
    res = await fetch(SERVER + path, {
      method,
      keepalive,
      headers: { "Content-Type": "application/json", ...(account?.token ? { Authorization: "Bearer " + account.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Can't reach the house server. Check your internet and try again."), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
  return data;
}

// --- The screens ---
const accountScreen = document.getElementById("account-screen");
const loginCard = document.getElementById("account-login");
const phraseCard = document.getElementById("account-phrase");
const joinScreen = document.getElementById("join-screen");
const form = document.getElementById("account-form");
const nameInput = document.getElementById("account-name");
const passwordInput = document.getElementById("account-password");
const confirmRow = document.getElementById("account-confirm-row");
const confirmInput = document.getElementById("account-confirm");
const codeRow = document.getElementById("account-code-row");
const codeInput = document.getElementById("account-code");
const note = document.getElementById("account-note");
const submit = document.getElementById("account-submit");
const forgot = document.getElementById("account-forgot");
const tabs = document.querySelectorAll("#account-login .account-tabs button");
const phraseForm = document.getElementById("phrase-form");
const phraseInput = document.getElementById("phrase-input");
const phraseNote = document.getElementById("phrase-note");
const phraseHello = document.getElementById("phrase-hello");

let mode = "login"; // "login", "signup" or "reset"

const settingsCard = document.getElementById("account-settings");

function showCard(card) {
  document.getElementById("account-loading").hidden = true;
  accountScreen.hidden = card === null;
  loginCard.hidden = card !== loginCard;
  phraseCard.hidden = card !== phraseCard;
  settingsCard.hidden = card !== settingsCard;
  joinScreen.hidden = card !== null;
}

function setMode(next) {
  mode = next;
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  confirmRow.hidden = mode === "login";
  codeRow.hidden = mode !== "reset";
  forgot.hidden = mode !== "login";
  passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
  submit.textContent = { login: "Log in", signup: "Create account", reset: "Set new password" }[mode];
  note.textContent =
    mode === "reset" ? "Ask the house owner for a reset code, then choose a new password." : mode === "signup" ? "Your name is what friends see over your character." : "";
  note.classList.remove("error");
}

for (const tab of tabs) tab.addEventListener("click", () => setMode(tab.dataset.mode));
forgot.addEventListener("click", () => setMode("reset"));

function showError(el, message) {
  el.textContent = message;
  el.classList.add("error");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const password = passwordInput.value;
  if (mode !== "login" && password !== confirmInput.value) return showError(note, "The two passwords don't match.");
  submit.disabled = true;
  try {
    const path = { login: "/api/login", signup: "/api/signup", reset: "/api/reset" }[mode];
    const result = await api("POST", path, { name, password, code: codeInput.value });
    account = { token: result.token, name: result.user.name };
    storage.set(ACCOUNT_KEY, JSON.stringify(account));
    passwordInput.value = confirmInput.value = codeInput.value = "";
    await afterLogin(result.user);
  } catch (err) {
    showError(note, err.message);
  } finally {
    submit.disabled = false;
  }
});

phraseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = phraseForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const result = await api("POST", "/api/join", { phrase: phraseInput.value });
    phraseInput.value = "";
    await afterLogin(result.user);
  } catch (err) {
    showError(phraseNote, err.message);
  } finally {
    button.disabled = false;
  }
});

for (const button of document.querySelectorAll(".account-logout")) button.addEventListener("click", () => logOut());

// --- Account settings (from the Join screen) ---
const renameForm = document.getElementById("rename-form");
const renameName = document.getElementById("rename-name");
const renamePassword = document.getElementById("rename-password");
const renameNote = document.getElementById("rename-note");
const passwordForm = document.getElementById("password-form");
const passwordNote = document.getElementById("password-note");

function showOk(el, message) {
  el.textContent = message;
  el.classList.remove("error");
  el.classList.add("ok");
}

document.getElementById("account-open-settings").addEventListener("click", () => {
  renameName.value = account?.name ?? "";
  showCard(settingsCard);
});
document.getElementById("account-settings-done").addEventListener("click", () => showCard(null));

renameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = renameForm.querySelector("button");
  button.disabled = true;
  try {
    const { user } = await api("POST", "/api/account/name", { name: renameName.value, password: renamePassword.value });
    renamePassword.value = "";
    account.name = user.name;
    storage.set(ACCOUNT_KEY, JSON.stringify(account));
    document.getElementById("name-input").value = user.name;
    document.getElementById("account-who").textContent = user.name;
    showOk(renameNote, `You're ${user.name} now.`);
  } catch (err) {
    showError(renameNote, err.message);
  } finally {
    button.disabled = false;
  }
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const [current, next, again] = ["password-current", "password-new", "password-again"].map((id) => document.getElementById(id));
  if (next.value !== again.value) return showError(passwordNote, "The two new passwords don't match.");
  const button = passwordForm.querySelector("button");
  button.disabled = true;
  try {
    await api("POST", "/api/account/password", { current: current.value, password: next.value });
    current.value = next.value = again.value = "";
    showOk(passwordNote, "Password changed.");
  } catch (err) {
    showError(passwordNote, err.message);
  } finally {
    button.disabled = false;
  }
});

// --- Cloud saves ---
function collectSave() {
  const data = {};
  for (const key of SAVE_KEYS) {
    const value = storage.get(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

let lastUploaded = null;

// Sends your save to the server if anything changed since last time.
async function uploadSave() {
  if (!account) return;
  const data = collectSave();
  const text = JSON.stringify(data);
  if (text === lastUploaded) return;
  try {
    const result = await api("PUT", "/api/save", { data });
    lastUploaded = text;
    storage.set(SYNCED_KEY, String(result.updatedAt));
  } catch (err) {
    if (err.status === 401) logOut(false); // logged out elsewhere (like a password reset)
    // Otherwise try again next time (maybe the internet blipped).
  }
}

// Brings the cloud save into this browser if it's newer than what's here.
// Returns true if the page needs to reload to use it.
async function downloadSave() {
  const { save } = await api("GET", "/api/save");
  if (!save) {
    // No cloud save yet: the progress already in this browser becomes the
    // account's. (That's how everyone's progress from before accounts
    // carries over. Logging out clears the browser, so the next person
    // never inherits someone else's.)
    await uploadSave();
    return false;
  }
  const syncedAt = Number(storage.get(SYNCED_KEY) || 0);
  const same = JSON.stringify(save.data) === JSON.stringify(collectSave());
  if (same) storage.set(SYNCED_KEY, String(save.updatedAt));
  if (same || save.updatedAt <= syncedAt) return false;
  for (const key of SAVE_KEYS) {
    if (Object.hasOwn(save.data, key) && typeof save.data[key] === "string") storage.set(key, save.data[key]);
    else storage.remove(key);
  }
  storage.set(SYNCED_KEY, String(save.updatedAt));
  return true;
}

// Every 30 seconds while you're here, and when you leave the page.
setInterval(uploadSave, 30_000);
window.addEventListener("pagehide", () => {
  if (!account) return;
  const data = collectSave();
  const text = JSON.stringify({ data });
  if (JSON.stringify(data) === lastUploaded || text.length > 60_000) return;
  fetch(SERVER + "/api/save", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json", Authorization: "Bearer " + account.token }, body: text }).catch(() => {});
});

// --- Logging in and out ---
let houseReady = false;

// True once we know how to reach the house (the Join button waits for this).
export function isHouseReady() {
  return houseReady;
}

// For other parts of the game (mail, profiles, the admin panel): talk to
// the house server as the logged-in account.
export function serverApi(method, path, body, options) {
  return api(method, path, body, options);
}

// --- Admin badges ---
// The server gives each admin a signed "badge pass" ({ payload:
// "name|expires", sig }). It's shared with friends, and everyone checks
// the signature with the server's public key before showing the badge, so
// nobody can give themselves one.
export function myBadge() {
  return account?.badge ?? null;
}

let badgeKeyPromise = null;
function badgeKey() {
  badgeKeyPromise ??= fetch(SERVER + "/api/badge-key")
    .then((res) => res.json())
    .then(({ key }) => crypto.subtle.importKey("spki", Uint8Array.from(atob(key), (c) => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]))
    .catch(() => {
      badgeKeyPromise = null; // try again later
      return null;
    });
  return badgeKeyPromise;
}

const badgeChecks = new Map(); // "payload|sig" -> true, false, or "checking"

// True if `badge` is a real, unexpired admin pass for `name`. Checking
// takes a moment the first time, so it says false until it knows.
export function checkBadge(badge, name) {
  if (!badge || typeof badge.payload !== "string" || !name) return false;
  const parts = badge.payload.split("|");
  if (parts.length !== 2) return false; // (so a room pass can't pass for a badge)
  const [who, expires] = parts;
  if (who.toLowerCase() !== String(name).toLowerCase() || !(Number(expires) > Date.now())) return false;
  return checkSigned(badge);
}

// True if `pass` is a real, unexpired room pass (see POST /api/room/enter
// on the server) letting this friend (their name and peer id) be in
// `ownerKey`'s bedroom.
export function checkRoomPass(pass, ownerKey, name, peerId) {
  if (!pass || typeof pass.payload !== "string") return false;
  const [kind, owner, visitor, peer, expires, extra] = pass.payload.split("|");
  if (kind !== "room" || extra !== undefined || owner !== ownerKey || visitor !== String(name).toLowerCase() || peer !== peerId || !(Number(expires) > Date.now())) return false;
  return checkSigned(pass);
}

// True once the server's signature on a pass has been checked and is real.
function checkSigned(badge) {
  if (typeof badge.sig !== "string") return false;
  const key = badge.payload + "|" + badge.sig;
  const known = badgeChecks.get(key);
  if (known === true || known === false) return known;
  if (!known) {
    if (badgeChecks.size > 300) badgeChecks.clear(); // (old passes pile up over a long visit)
    badgeChecks.set(key, "checking");
    badgeKey().then(async (publicKey) => {
      if (!publicKey) return badgeChecks.delete(key);
      try {
        const sig = Uint8Array.from(atob(badge.sig), (c) => c.charCodeAt(0));
        const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sig, new TextEncoder().encode(badge.payload));
        badgeChecks.set(key, ok);
      } catch {
        badgeChecks.set(key, false);
      }
    });
  }
  return false;
}

// True if this account is an admin (sees the 🛠️ panel).
export function isAdmin() {
  return !!account?.admin;
}

export function accountName() {
  return account?.name ?? null;
}

async function afterLogin(user) {
  account.name = user.name;
  account.admin = !!user.admin;
  account.badge = user.badge ?? null; // an admin's signed badge pass (see checkBadge)
  storage.set(ACCOUNT_KEY, JSON.stringify(account));
  if (!user.member) {
    phraseHello.textContent = `Hi ${user.name}! Enter the house phrase a friend gave you. You only need to do this once.`;
    phraseNote.textContent = "";
    phraseNote.classList.remove("error");
    showCard(phraseCard);
    phraseInput.focus();
    return;
  }
  if (await downloadSave()) {
    location.reload(); // start again with your cloud save
    return;
  }
  const house = await api("GET", "/api/house");
  CONFIG.trysteroRoomId = house.roomId;
  CONFIG.trysteroPassword = house.password;
  CONFIG.turnServers = house.turn;
  houseReady = true;
  document.getElementById("name-input").value = user.name;
  document.getElementById("account-who").textContent = user.name;
  showCard(null);
}

// Logs out: saves your progress to the account first (unless the server
// has already logged you out), then clears this browser for the next person.
async function logOut(saveFirst = true) {
  if (saveFirst) await uploadSave();
  api("POST", "/api/logout").catch(() => {});
  account = null;
  storage.remove(ACCOUNT_KEY);
  storage.remove(SYNCED_KEY);
  for (const key of SAVE_KEYS) storage.remove(key); // the next person here starts clean
  location.reload();
}

// --- Starting up ---
async function start() {
  setMode("login");
  if (!account?.token) {
    showCard(loginCard);
    return;
  }
  try {
    const { user } = await api("GET", "/api/me");
    await afterLogin(user);
  } catch (err) {
    if (err.status === 401) {
      account = null;
      storage.remove(ACCOUNT_KEY);
      showCard(loginCard);
      showError(note, "Please log in again.");
    } else {
      showCard(loginCard);
      nameInput.value = account.name;
      showError(note, err.message);
    }
  }
}
start();
