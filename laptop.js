// The laptop on your bedroom desk (press E there). Its home screen has
// four apps: Mail (letters to friends), News (what's new in the house),
// Nest & Nook (the furniture store, see home.js) and Decorate.
//
// Mail with no server: a letter waits in your outbox until you and that
// friend are in the house at the same time, then it's handed over and
// their laptop says thanks, and it leaves your outbox. Letters are saved
// in each person's own browser.
import { getPeers, sendMail, onMail } from "./network.js";
import { NEWS } from "./news.js";
import { renderStore, startDecorating } from "./home.js";
import { unlock } from "./achievements.js";
import { playClickSound } from "./audio.js";

const laptop = document.getElementById("laptop");
const title = document.getElementById("laptop-title");
const backButton = document.getElementById("laptop-back");
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
let hooks = { name: () => "Friend", color: () => "#e05a47", onLetter: () => {} };
export function initLaptop(options) {
  hooks = options;
}

export function isLaptopOpen() {
  return !laptop.hidden;
}

export function openLaptop() {
  laptop.hidden = false;
  showPage("home");
  playClickSound();
}

export function closeLaptop() {
  if (laptop.hidden) return;
  laptop.hidden = true;
  document.activeElement?.blur();
}

const TITLES = { home: "Home", mail: "Mail", news: "News", store: "Nest & Nook" };

function showPage(name) {
  for (const [id, el] of Object.entries(pages)) el.hidden = id !== name;
  title.textContent = TITLES[name];
  backButton.hidden = name === "home";
  if (name === "mail") showInbox();
  if (name === "news") renderNews();
  if (name === "store") renderStore(pages.store);
  updateBadge();
}

for (const app of document.querySelectorAll("#laptop-home .app")) {
  app.addEventListener("click", () => {
    playClickSound();
    if (app.dataset.app === "decorate") {
      closeLaptop();
      startDecorating();
    } else {
      showPage(app.dataset.app);
    }
  });
}
backButton.addEventListener("click", () => {
  playClickSound();
  showPage("home");
});
document.getElementById("laptop-close").addEventListener("click", () => {
  playClickSound();
  closeLaptop();
});

// Escape closes the laptop (or goes back to its home screen). While it's
// open, the game's keys are off, so typing a letter doesn't walk you away.
window.addEventListener("keydown", (e) => {
  if (laptop.hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    if (!pages.home.hidden) closeLaptop();
    else showPage("home");
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

// --- Mail: saved letters ---
// inbox: [{ id, from, color, subject, body, sentAt, read }]
// outbox: [{ id, to, subject, body, sentAt }]
// contacts: names of friends you've seen in the house.
const STORAGE_KEY = "cozy-house-mail";
const LIMITS = { name: 16, subject: 60, body: 1000, inbox: 100, outbox: 30 };
let mail = { inbox: [], outbox: [], contacts: [] };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    mail.inbox = (Array.isArray(loaded.inbox) ? loaded.inbox : []).map(cleanLetter).filter(Boolean);
    mail.outbox = (Array.isArray(loaded.outbox) ? loaded.outbox : []).filter((l) => l && typeof l.id === "string" && typeof l.to === "string");
    mail.contacts = (Array.isArray(loaded.contacts) ? loaded.contacts : []).filter((n) => typeof n === "string").slice(0, 50);
  }
} catch {
  // Nothing saved yet, or storage is blocked: start with empty mail.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mail));
  } catch {
    // Storage blocked: letters just won't be remembered.
  }
}

// A letter from the network (or storage), checked and trimmed, or null.
function cleanLetter(l) {
  if (!l || typeof l.id !== "string" || l.id.length > 40 || typeof l.from !== "string" || typeof l.body !== "string") return null;
  return {
    id: l.id,
    from: l.from.trim().slice(0, LIMITS.name) || "Someone",
    color: /^#[0-9a-fA-F]{6}$/.test(l.color) ? l.color : "#999999",
    subject: String(l.subject ?? "").slice(0, LIMITS.subject),
    body: l.body.slice(0, LIMITS.body),
    sentAt: Number.isFinite(l.sentAt) ? l.sentAt : Date.now(),
    read: l.read === true,
  };
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function updateBadge() {
  const unread = mail.inbox.filter((l) => !l.read).length;
  mailBadge.hidden = unread === 0;
  mailBadge.textContent = unread;
}
updateBadge();

// --- Mail: delivery ---
// Every few seconds: remember the names of friends who are here (for the
// To box), and hand over any waiting letters to friends who are here.
const lastTry = {}; // letter id -> when we last tried (so we don't flood them)
setInterval(() => {
  const peers = getPeers();
  let changed = false;
  for (const peer of peers) {
    const name = String(peer.name ?? "").trim().slice(0, LIMITS.name);
    if (name && !mail.contacts.some((c) => sameName(c, name))) {
      mail.contacts.push(name);
      changed = true;
    }
  }
  if (changed) store();
  for (const letter of mail.outbox) {
    const peer = peers.find((p) => typeof p.name === "string" && sameName(p.name, letter.to));
    if (!peer || Date.now() - (lastTry[letter.id] || 0) < 15000) continue;
    lastTry[letter.id] = Date.now();
    sendMail({ type: "letter", id: letter.id, from: hooks.name(), color: hooks.color(), subject: letter.subject, body: letter.body, sentAt: letter.sentAt }, peer.id);
  }
}, 3000);

onMail((message, peerId) => {
  if (message?.type === "letter") {
    const letter = cleanLetter({ ...message, read: false });
    if (!letter) return;
    sendMail({ type: "got", id: letter.id }, peerId); // "arrived, thanks"
    if (mail.inbox.some((l) => l.id === letter.id)) return; // already have it
    mail.inbox.unshift(letter);
    mail.inbox = mail.inbox.slice(0, LIMITS.inbox);
    store();
    updateBadge();
    unlock("gotMail");
    hooks.onLetter(letter);
    if (!pages.mail.hidden && !laptop.hidden) showInbox();
  } else if (message?.type === "got" && typeof message.id === "string") {
    const before = mail.outbox.length;
    mail.outbox = mail.outbox.filter((l) => l.id !== message.id);
    if (mail.outbox.length !== before) {
      store();
      if (!pages.mail.hidden && !laptop.hidden) showInbox();
    }
  }
});

// --- Mail: screens ---
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
  if (mail.inbox.length === 0) page.appendChild(el("p", "mail-empty", "No letters yet."));
  const list = el("ul", "mail-list");
  for (const letter of mail.inbox) {
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

  if (mail.outbox.length) {
    page.appendChild(el("h3", "mail-heading", "Waiting to deliver"));
    const out = el("ul", "mail-list outbox");
    for (const letter of mail.outbox) {
      const li = el("li");
      li.append(el("span", "mail-from", "To " + letter.to), el("span", "mail-subject", letter.subject || "(no subject)"), el("span", "mail-when", "when you're both here"));
      out.appendChild(li);
    }
    page.appendChild(out);
  }
}

function showLetter(letter) {
  letter.read = true;
  store();
  updateBadge();
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
    mail.inbox = mail.inbox.filter((l) => l !== letter);
    store();
    showInbox();
  });
  buttons.append(back, remove, reply);
  page.append(paper, buttons);
}

function showCompose(to = "", subject = "") {
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
  for (const name of mail.contacts) contacts.appendChild(new Option(name));

  const subjectInput = el("input");
  subjectInput.type = "text";
  subjectInput.maxLength = LIMITS.subject;
  subjectInput.placeholder = "Subject";
  subjectInput.value = subject;

  const body = el("textarea");
  body.maxLength = LIMITS.body;
  body.rows = 7;
  body.placeholder = "Dear friend...";

  const note = el("p", "mail-note", "It'll be delivered the next time you're both in the house.");
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
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = toInput.value.trim();
    if (!name || !body.value.trim()) {
      note.textContent = "Add who it's to, and write something first.";
      return;
    }
    if (sameName(name, hooks.name())) {
      note.textContent = "That's you! Write to a friend instead.";
      return;
    }
    if (mail.outbox.length >= LIMITS.outbox) {
      note.textContent = "Your outbox is full. Wait for some letters to be delivered first.";
      return;
    }
    mail.outbox.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), to: name, subject: subjectInput.value.trim(), body: body.value.trim(), sentAt: Date.now() });
    store();
    playClickSound();
    unlock("penPal");
    showInbox();
  });
  page.appendChild(form);
  (to ? body : toInput).focus();
}
