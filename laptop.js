// The laptop on your bedroom desk (press E there). It's a little web
// browser: a start page with shortcuts to Mail (letters to friends), The
// Cozy Times (what's new in the house), Nest & Nook (the furniture store,
// see home.js), and Decorate. Back, Forward and Reload work, and the
// address bar shows where you are.
//
// Mail is kept on the house server, so letters arrive even when the
// friend you wrote to is offline.
import { getPeers, sendMail, onMail } from "./network.js";
import { NEWS } from "./news.js";
import { renderStore, startDecorating } from "./home.js";
import { unlock } from "./achievements.js";
import { playClickSound } from "./audio.js";
import { serverApi, accountName } from "./account.js";

const laptop = document.getElementById("laptop");
const title = document.getElementById("laptop-title");
const favicon = document.getElementById("browser-favicon");
const address = document.getElementById("browser-url");
const backButton = document.getElementById("browser-back");
const forwardButton = document.getElementById("browser-forward");
const pages = {
  home: document.getElementById("laptop-home"),
  mail: document.getElementById("laptop-mail"),
  news: document.getElementById("laptop-news"),
  store: document.getElementById("laptop-store"),
};
const mailBadge = document.getElementById("mail-badge");

// --- Connecting to main.js ---
// main.js tells us your name and color, and what to do when a letter
// arrives (a notice and a chat line).
let hooks = { name: () => "Friend", color: () => "#e05a47", onLetter: () => {}, notice: () => {} };
export function initLaptop(options) {
  hooks = options;
}

export function isLaptopOpen() {
  return !laptop.hidden;
}

export function openLaptop() {
  laptop.hidden = false;
  history = [];
  ahead = [];
  show("home");
  playClickSound();
}

export function closeLaptop() {
  if (laptop.hidden) return;
  laptop.hidden = true;
  document.activeElement?.blur();
}

// --- The browser ---
// Each "site" has a tab title, a little icon and an address. The address
// bar only shows where you are (it isn't for typing).
const SITES = {
  home: { title: "New tab", icon: "🏠", url: "https://start.cozy" },
  mail: { title: "Mail", icon: "✉️", url: "https://mail.cozy/inbox" },
  news: { title: "The Cozy Times", icon: "📰", url: "https://news.cozy" },
  store: { title: "Nest & Nook", icon: "🪺", url: "https://nestandnook.cozy/furniture" },
};
let current = "home";
let history = []; // pages before this one (for Back)
let ahead = []; // pages after it (for Forward)

// Shows a different address (and tab title) without leaving the page,
// like when you open a letter or switch store sections.
function setAddress(url, tabTitle) {
  address.textContent = url;
  title.textContent = tabTitle ?? SITES[current].title;
}

function show(name) {
  current = name;
  for (const [id, el] of Object.entries(pages)) el.hidden = id !== name;
  favicon.textContent = SITES[name].icon;
  setAddress(SITES[name].url);
  if (name === "home") renderStart();
  if (name === "mail") showInbox();
  if (name === "news") renderNews();
  if (name === "store") renderStore(pages.store, (tab) => setAddress("https://nestandnook.cozy/" + tab));
  pages[name].scrollTop = 0;
  backButton.disabled = history.length === 0;
  forwardButton.disabled = ahead.length === 0;
  updateBadge();
}

// Goes to a page, remembering where you were for Back.
function visit(name) {
  if (!laptop.hidden && current && name !== current && pages[current] && !pages[current].hidden) history.push(current);
  ahead = [];
  show(name);
}

backButton.addEventListener("click", () => {
  if (!history.length) return;
  playClickSound();
  ahead.push(current);
  show(history.pop());
});
forwardButton.addEventListener("click", () => {
  if (!ahead.length) return;
  playClickSound();
  history.push(current);
  show(ahead.pop());
});
document.getElementById("browser-reload").addEventListener("click", () => {
  playClickSound();
  show(current);
});
document.getElementById("browser-home").addEventListener("click", () => {
  playClickSound();
  visit("home");
});
document.getElementById("laptop-close").addEventListener("click", () => {
  playClickSound();
  closeLaptop();
});

for (const app of document.querySelectorAll("#laptop-home .app")) {
  app.addEventListener("click", () => {
    playClickSound();
    if (app.dataset.app === "decorate") {
      closeLaptop();
      startDecorating();
    } else {
      visit(app.dataset.app);
    }
  });
}

// The start page: a greeting for the time of day, and the clock.
function renderStart() {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("start-greeting").textContent = `${part}, ${hooks.name()}!`;
  document.getElementById("start-clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Escape closes the laptop (or goes back a page). While it's open, the
// game's keys are off, so typing a letter doesn't walk you away.
window.addEventListener("keydown", (e) => {
  if (laptop.hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    if (history.length) backButton.click();
    else closeLaptop();
  }
});

// --- News ---
function renderNews() {
  unlock("newsReader");
  pages.news.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "news-list";
  for (const entry of NEWS) {
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "news-head";
    const tag = document.createElement("span");
    tag.className = "news-build";
    tag.textContent = "build " + entry.build;
    const h = document.createElement("strong");
    h.textContent = entry.title;
    head.append(h, tag);
    const p = document.createElement("p");
    p.textContent = entry.text;
    li.append(head, p);
    list.appendChild(li);
  }
  pages.news.appendChild(list);
}

// --- Mail ---
// Letters live on the house server, so they reach friends even when
// they're not in the house. Your inbox is fetched every minute while you're
// here (and right away if the friend who wrote to you is here too, since
// their laptop gives yours a little nudge).
const LIMITS = { name: 16, subject: 60, body: 1000 };
let inbox = [];
let names = []; // everyone in the house, for the To box
let loaded = false;

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function updateBadge() {
  const unread = inbox.filter((l) => !l.read).length;
  mailBadge.hidden = unread === 0;
  mailBadge.textContent = unread;
}

// Fetches your inbox. New unread letters since last time get a notice.
async function refreshInbox() {
  if (!accountName()) return;
  try {
    const { inbox: fresh } = await serverApi("GET", "/api/mail");
    const known = new Set(inbox.map((l) => l.id));
    const arrived = loaded ? fresh.filter((l) => !l.read && !known.has(l.id)) : [];
    inbox = fresh;
    loaded = true;
    updateBadge();
    for (const letter of arrived) {
      unlock("gotMail");
      hooks.onLetter(letter);
    }
    if (!pages.mail.hidden && !laptop.hidden && address.textContent.endsWith("/inbox")) showInbox();
  } catch {
    // The server's unreachable for a moment: try again next time.
  }
}

async function refreshNames() {
  try {
    ({ names } = await serverApi("GET", "/api/names"));
  } catch {
    // Keep the old list.
  }
}

// Letters from before mail lived on the server were kept in the browser.
// Bring them over once (and send anything that was still waiting to go).
async function bringOverOldMail() {
  let old = null;
  try {
    old = JSON.parse(localStorage.getItem("cozy-house-mail"));
  } catch {
    return;
  }
  if (!old || old.moved) return;
  try {
    if (Array.isArray(old.inbox) && old.inbox.length) await serverApi("POST", "/api/mail/import", { letters: old.inbox });
    for (const letter of Array.isArray(old.outbox) ? old.outbox : []) {
      await serverApi("POST", "/api/mail", { to: letter.to, subject: letter.subject, body: letter.body, color: hooks.color() }).catch(() => {});
    }
    localStorage.setItem("cozy-house-mail", JSON.stringify({ moved: true }));
  } catch {
    // Try again next visit.
  }
}

// Called by main.js once you've joined the house.
export async function startMail() {
  await bringOverOldMail();
  await refreshInbox();
  refreshNames();
  setInterval(refreshInbox, 60_000);
}

// A nudge from a friend's laptop: they just sent you something.
onMail((message) => {
  if (message?.type === "nudge") refreshInbox();
});

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function when(ms) {
  return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function showInbox() {
  setAddress("https://mail.cozy/inbox", "Mail · Inbox");
  const page = pages.mail;
  page.innerHTML = "";
  const write = el("button", "warm-button mail-write", "✏️ Write a letter");
  write.type = "button";
  write.addEventListener("click", () => {
    playClickSound();
    showCompose();
  });
  page.appendChild(write);

  page.appendChild(el("h3", "mail-heading", "Inbox"));
  if (inbox.length === 0) page.appendChild(el("p", "mail-empty", loaded ? "No letters yet." : "Checking for letters..."));
  const list = el("ul", "mail-list");
  for (const letter of inbox) {
    const li = el("li", letter.read ? "" : "unread");
    const from = el("span", "mail-from", letter.from);
    from.style.color = letter.color;
    li.append(from, el("span", "mail-subject", letter.subject || "(no subject)"), el("span", "mail-when", when(letter.sentAt)));
    li.addEventListener("click", () => {
      playClickSound();
      showLetter(letter);
    });
    list.appendChild(li);
  }
  page.appendChild(list);
}

function showLetter(letter) {
  setAddress("https://mail.cozy/letter/" + letter.id, "Mail · " + (letter.subject || "(no subject)"));
  if (!letter.read) {
    letter.read = true;
    updateBadge();
    serverApi("POST", "/api/mail/read", { id: letter.id }).catch(() => {});
  }
  const page = pages.mail;
  page.innerHTML = "";
  const paper = el("div", "letter-paper");
  const from = el("div", "letter-from", "From " + letter.from);
  from.style.color = letter.color;
  paper.append(from, el("div", "letter-when", when(letter.sentAt)), el("h3", "letter-subject", letter.subject || "(no subject)"), el("p", "letter-body", letter.body));
  const buttons = el("div", "mail-buttons");
  const back = el("button", "soft-button", "Back");
  back.type = "button";
  back.addEventListener("click", () => {
    playClickSound();
    showInbox();
  });
  const reply = el("button", "warm-button", "Reply");
  reply.type = "button";
  reply.addEventListener("click", () => {
    playClickSound();
    showCompose(letter.from, letter.subject.startsWith("Re: ") ? letter.subject : "Re: " + letter.subject);
  });
  const remove = el("button", "soft-button", "Delete");
  remove.type = "button";
  remove.addEventListener("click", () => {
    playClickSound();
    inbox = inbox.filter((l) => l !== letter);
    serverApi("POST", "/api/mail/delete", { id: letter.id }).catch(() => {});
    showInbox();
  });
  buttons.append(back, remove, reply);
  page.append(paper, buttons);
}

function showCompose(to = "", subject = "") {
  setAddress("https://mail.cozy/new", "Mail · New letter");
  refreshNames();
  const page = pages.mail;
  page.innerHTML = "";
  const form = el("form", "mail-compose");
  form.autocomplete = "off";

  const toInput = el("input");
  toInput.type = "text";
  toInput.maxLength = LIMITS.name;
  toInput.placeholder = "A friend's name";
  toInput.value = to;
  toInput.setAttribute("list", "mail-contacts");
  const contacts = el("datalist");
  contacts.id = "mail-contacts";
  for (const name of names) if (!sameName(name, hooks.name())) contacts.appendChild(new Option(name));

  const subjectInput = el("input");
  subjectInput.type = "text";
  subjectInput.maxLength = LIMITS.subject;
  subjectInput.placeholder = "Subject";
  subjectInput.value = subject;

  const body = el("textarea");
  body.maxLength = LIMITS.body;
  body.rows = 8;
  body.placeholder = "Dear friend...";

  const note = el("p", "mail-note", "It'll be waiting in their inbox, even if they're not in the house right now.");
  const buttons = el("div", "mail-buttons");
  const cancel = el("button", "soft-button", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    playClickSound();
    showInbox();
  });
  const send = el("button", "warm-button", "Send");
  send.type = "submit";
  buttons.append(cancel, send);

  const label = (text, input) => {
    const l = el("label", "mail-field");
    l.append(el("span", "", text), input);
    return l;
  };
  form.append(label("To", toInput), contacts, label("Subject", subjectInput), body, note, buttons);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = toInput.value.trim();
    if (!name || !body.value.trim()) {
      note.textContent = "Add who it's to, and write something first.";
      return;
    }
    send.disabled = true;
    try {
      const result = await serverApi("POST", "/api/mail", { to: name, subject: subjectInput.value.trim(), body: body.value.trim(), color: hooks.color() });
      playClickSound();
      unlock("penPal");
      // If they're in the house right now, tell their laptop to check.
      const peer = getPeers().find((p) => typeof p.name === "string" && sameName(p.name, result.to));
      if (peer) sendMail({ type: "nudge" }, peer.id);
      hooks.notice(`Your letter to ${result.to} is in their mailbox.`);
      showInbox();
    } catch (err) {
      note.textContent = err.message;
      send.disabled = false;
    }
  });
  page.appendChild(form);
  (to ? body : toInput).focus();
}
