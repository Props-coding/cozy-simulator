// Cozy House server: accounts, the house phrase, and cloud saves.
//
// It runs on the droplet behind Caddy (which handles HTTPS), and only
// listens on the droplet itself (127.0.0.1). Everything is plain Node.js,
// with no extra packages. Data lives in one JSON file (a handful of
// friends doesn't need a database), written safely (to a temporary file
// first, then swapped in) and backed up once a day.
//
// Secrets (the house phrase, the room name and password, the relay login)
// come from /etc/cozy-server.env on the droplet, never from the public
// repo. See server/README.md.
import http from "node:http";
import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHash, createHmac, generateKeyPairSync, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFile, writeFile, rename, mkdir, readdir, unlink, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

// --- Settings (from the environment file) ---
const env = process.env;
const PORT = Number(env.PORT || 3000);
const DATA_DIR = env.DATA_DIR || "/var/lib/cozy-server";
const DB_FILE = join(DATA_DIR, "db.json");
const WHITEBOARD_FILE = join(DATA_DIR, "whiteboard.png"); // the Conference Room whiteboard
const BACKUP_DIR = join(DATA_DIR, "backups");
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || "https://props-coding.github.io").split(",").map((s) => s.trim());
for (const name of ["HOUSE_PHRASE", "ROOM_ID", "ROOM_PASSWORD", "ADMIN_TOKEN"]) {
  if (!env[name]) throw new Error(`Missing ${name} in the environment file`);
}

const MAX_USERS = 100;
const MAX_SAVE_BYTES = 300_000;
const SESSION_DAYS = 365;
const RESET_HOURS = 24;
const TURN_HOURS = 24; // how long a relay login lasts
const MAIL_LIMITS = { subject: 60, body: 1000, inbox: 200 };
const TURN_HOST = env.TURN_HOST || "api.thecozy.world";

// --- The data file ---
// users: lowercase name -> { name, salt, hash, createdAt, member, save, reset, inbox, bio }
// kanban: the Workshop's boards (see applyKanban)
// rooms: everyone's bedroom (see ensureRoom)
// sessions: hash of a login token -> { user, createdAt, lastUsed }
let db = { users: {}, sessions: {} };

async function loadDb() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    db = JSON.parse(await readFile(DB_FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err; // a broken file stops the server rather than wiping it
  }
  db.users ??= {};
  db.kanban ??= { version: 1, jar: 0, boards: [{ id: "first", name: "Projects", archived: false, cards: [] }] };
  db.sessions ??= {};
  // Forget logins that haven't been used in a year.
  const cutoff = Date.now() - SESSION_DAYS * 86400_000;
  for (const [key, s] of Object.entries(db.sessions)) if (s.lastUsed < cutoff) delete db.sessions[key];
}

// Saves are queued so two never overlap; each writes a temporary file and
// then swaps it in, so a crash mid-write can't leave a half-written file.
let saving = Promise.resolve();
function saveDb() {
  saving = saving.then(async () => {
    const tmp = DB_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(db), { mode: 0o600 });
    await rename(tmp, DB_FILE);
  });
  return saving;
}

// A copy of the data file once a day, keeping the last 14.
async function backup() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    await copyFile(DB_FILE, join(BACKUP_DIR, `db-${new Date().toISOString().slice(0, 10)}.json`));
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith("db-")).sort();
    for (const old of files.slice(0, -14)) await unlink(join(BACKUP_DIR, old));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Backup failed:", err.message);
  }
}

// --- Passwords, tokens and codes ---
async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString("hex");
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

function sameText(a, b) {
  const x = Buffer.from(sha256(a)), y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

function newSession(userKey) {
  const token = randomBytes(32).toString("base64url");
  db.sessions[sha256(token)] = { user: userKey, createdAt: Date.now(), lastUsed: Date.now() };
  return token;
}

// A login for our voice relay (coturn), good for a day. It's the standard
// "TURN REST API" scheme: the name says when it runs out, and the password
// is that name signed with the secret the relay shares with us.
function relayLogin(userKey) {
  if (!env.TURN_SECRET) return [];
  const username = `${Math.floor(Date.now() / 1000) + TURN_HOURS * 3600}:${userKey.replace(/[^a-z0-9_-]/g, "_")}`;
  const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");
  return [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`, `turns:${TURN_HOST}:5349?transport=tcp`].map((urls) => ({ urls, username, credential }));
}

// The house phrase is compared ignoring capitals and extra spaces.
const normalizePhrase = (text) => String(text).trim().toLowerCase().replace(/\s+/g, " ");

// Names: 2 to 16 letters, numbers, spaces, - or _, and unique regardless of capitals.
function cleanName(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  return /^[A-Za-z0-9 _-]{2,16}$/.test(name) ? name : null;
}

// --- Slowing down guessing ---
// Each address gets a limited number of tries per 15 minutes for things
// like logging in or trying the house phrase.
const buckets = new Map();
function allowed(key, limit) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + 15 * 60_000 };
    buckets.set(key, b);
  }
  b.count++;
  return b.count <= limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.reset < now) buckets.delete(key);
}, 10 * 60_000).unref();

// --- Requests ---
class Oops extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

// Which web pages may talk to this server: the site on GitHub Pages, plus
// copies running on this computer (for testing).
function corsHeaders(origin) {
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin));
  return ok
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "600", Vary: "Origin" }
    : { Vary: "Origin" };
}

async function readJson(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Oops(413, "That's too big.");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Oops(400, "That didn't make sense to the server.");
  }
}

// The logged-in user for a request (from its "Authorization: Bearer" token).
function currentUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const session = token && db.sessions[sha256(token)];
  const user = session && db.users[session.user];
  if (!user) throw new Oops(401, "Please log in again.");
  session.lastUsed = Date.now();
  user.lastSeen = session.lastUsed; // (for "who's online": offline people sleep in their bedrooms)
  return { user, key: session.user, tokenHash: sha256(token) };
}

// --- Admin badges ---
// Admins get a small badge by their name in chat and on their name tag.
// Only this server decides who's an admin, and it proves it with a signed
// "badge pass": { payload: "name|expires", sig }. Everyone's browser checks
// the signature with the server's public key (GET /api/badge-key) before
// showing the badge, so nobody can make one for themselves.
const BADGE_KEY_FILE = join(DATA_DIR, "badge-key.pem");
const BADGE_DAYS = 7;
let badgeKey = null; // the private key, loaded (or made) at startup

async function loadBadgeKey() {
  try {
    badgeKey = createPrivateKey(await readFile(BADGE_KEY_FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    await writeFile(BADGE_KEY_FILE, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    badgeKey = privateKey;
  }
}

function badgeFor(user) {
  if (!user.admin || !badgeKey) return null;
  const payload = `${user.name}|${Date.now() + BADGE_DAYS * 86400_000}`;
  const sig = sign("sha256", Buffer.from(payload), { key: badgeKey, dsaEncoding: "ieee-p1363" }).toString("base64");
  return { payload, sig };
}

const publicUser = (u) => ({ name: u.name, member: !!u.member, admin: !!u.admin, badge: badgeFor(u) });

// Used for unknown names, so a wrong name takes as long as a wrong password.
const DUMMY_SALT = randomBytes(16).toString("hex");

// --- The Workshop's kanban boards ---
// db.kanban: { version, jar, boards: [{ id, name, archived, cards: [card] }] }
// card: { id, title, column ("todo", "doing" or "done"), label, due, note,
//         link, claimedBy (a name), claimColor, addedBy, addedAt, doneAt }
const KANBAN_COLUMNS = ["todo", "doing", "done"];
const KANBAN_LABELS = ["", "red", "orange", "yellow", "green", "blue", "purple", "pink"];
const KANBAN_LIMITS = { boards: 30, cards: 300, name: 30, title: 80, note: 300, link: 300 };

function kanbanState() {
  const k = db.kanban;
  return { version: k.version, jar: k.jar, boards: k.boards };
}

const newId = () => randomBytes(6).toString("hex");
const cleanText = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function findBoard(id) {
  const board = db.kanban.boards.find((b) => b.id === id);
  if (!board) throw new Oops(404, "That board isn't there any more.");
  return board;
}

function findCard(id) {
  for (const board of db.kanban.boards) {
    const index = board.cards.findIndex((c) => c.id === id);
    if (index >= 0) return { board, card: board.cards[index], index };
  }
  throw new Oops(404, "That card isn't there any more.");
}

// The optional card details, checked: a color label, a due date, a short
// note and a web link.
function cardDetails(body, card) {
  if (body.label !== undefined) card.label = KANBAN_LABELS.includes(body.label) ? body.label : "";
  if (body.due !== undefined) card.due = /^\d{4}-\d{2}-\d{2}$/.test(body.due) ? body.due : "";
  if (body.note !== undefined) card.note = cleanText(body.note, KANBAN_LIMITS.note);
  if (body.link !== undefined) {
    const link = String(body.link ?? "").trim().slice(0, KANBAN_LIMITS.link);
    card.link = /^https?:\/\/\S+$/i.test(link) ? link : "";
  }
}

// Applies one change. Returns a little about what happened (so the page
// can post "added" or "finished" in the house chat).
function applyKanban(body, user) {
  const k = db.kanban;
  switch (body.op) {
    case "addBoard": {
      if (k.boards.filter((b) => !b.archived).length >= KANBAN_LIMITS.boards) throw new Oops(400, "That's a lot of boards. Archive one first.");
      const name = cleanText(body.name, KANBAN_LIMITS.name) || "New project";
      const board = { id: newId(), name, archived: false, cards: [] };
      k.boards.push(board);
      return { board: board.id };
    }
    case "renameBoard": {
      const board = findBoard(body.board);
      board.name = cleanText(body.name, KANBAN_LIMITS.name) || board.name;
      return {};
    }
    case "archiveBoard": {
      findBoard(body.board).archived = body.archived !== false;
      return {};
    }
    case "addCard": {
      const board = findBoard(body.board);
      if (board.cards.length >= KANBAN_LIMITS.cards) throw new Oops(400, "This board is full. Clear out some Done cards first.");
      const title = cleanText(body.title, KANBAN_LIMITS.title);
      if (!title) throw new Oops(400, "Give the card a title.");
      const card = { id: newId(), title, column: "todo", label: "", due: "", note: "", link: "", claimedBy: null, claimColor: null, addedBy: user.name, addedAt: Date.now(), doneAt: null };
      cardDetails(body, card);
      board.cards.push(card);
      return { added: title, board: board.name };
    }
    case "editCard": {
      const { card } = findCard(body.card);
      if (body.title !== undefined) card.title = cleanText(body.title, KANBAN_LIMITS.title) || card.title;
      cardDetails(body, card);
      return {};
    }
    case "deleteCard": {
      const { board, index } = findCard(body.card);
      board.cards.splice(index, 1);
      return {};
    }
    case "claimCard": {
      // Claim it for yourself, or let go of it if it's already yours.
      const { card } = findCard(body.card);
      if (card.claimedBy === user.name) {
        card.claimedBy = null;
        card.claimColor = null;
      } else {
        card.claimedBy = user.name;
        card.claimColor = /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#999999";
      }
      return {};
    }
    case "moveCard": {
      // To another column (and a spot in it: before the card `before`, or
      // at the end).
      const { board, card, index } = findCard(body.card);
      if (!KANBAN_COLUMNS.includes(body.column)) throw new Oops(400, "That's not a column.");
      const finished = body.column === "done" && card.column !== "done";
      board.cards.splice(index, 1);
      card.column = body.column;
      card.doneAt = body.column === "done" ? card.doneAt ?? Date.now() : null;
      const at = board.cards.findIndex((c) => c.id === body.before);
      if (at >= 0) board.cards.splice(at, 0, card);
      else board.cards.push(card);
      if (finished) k.jar++;
      return finished ? { finished: card.title, board: board.name, claimedBy: card.claimedBy } : {};
    }
    default:
      throw new Oops(400, "That's not something the board can do.");
  }
}

// --- Bedrooms ---
// Every member has one bedroom, kept here so it's there even when they're
// offline: db.rooms[account key] = { owner, map, style, size, placed,
// privacy, note, deco, audio, migratedAt }. `map` is which bedroom map it
// is (each room is its own little map). The first time a room is needed,
// it's made from that person's saved bedroom (their layout and size), so
// nothing they placed is lost.
const ROOM_PRIVACY = ["open", "knock", "private", "party"];
const DOOR_DECOS = ["none", "wreath", "flowers", "star", "heart", "plant", "pumpkin", "snowflake"];
const ROOM_STYLES = ["classic", "cabin", "apartment", "beachHut", "lakehouse", "stalker", "scholar", "cottage"];
const ROOM_AUDIO = ["voice", "lofi", "silent"];
const ROOM_SIZES = ["cozy", "roomy"];
// The personal themes, only for their owners.
const THEME_OWNERS = { lakehouse: "props", stalker: "brightness", scholar: "kxiven", cottage: "lyss" };
const ONLINE_MS = 90_000; // seen this recently = online (the page checks in every 30 seconds)

function savedData(user, key) {
  try {
    return JSON.parse(user.save?.data?.[key] ?? "null");
  } catch {
    return null;
  }
}

// A placed piece of decor, checked: { item, x, y } and maybe r (turned).
function cleanPiece(p) {
  if (!p || typeof p.item !== "string" || p.item.length > 40 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const piece = { item: p.item, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 };
  if (p.r === 1 || p.r === 3) piece.r = p.r;
  return piece;
}

function ensureRoom(key, user) {
  db.rooms ??= {};
  let room = db.rooms[key];
  if (!room) {
    const home = savedData(user, "cozy-house-home") ?? {};
    const maps = Object.values(db.rooms).map((r) => r.map);
    const theme = Object.keys(THEME_OWNERS).find((t) => THEME_OWNERS[t] === key);
    room = {
      owner: user.name,
      map: maps.length ? Math.max(...maps) + 1 : 0,
      style: theme ?? "classic",
      size: home.size === "roomy" ? "roomy" : "cozy",
      placed: (Array.isArray(home.placed) ? home.placed : []).slice(0, 80).map(cleanPiece).filter(Boolean),
      privacy: "open",
      note: "",
      deco: "none",
      audio: "voice",
      migratedAt: Date.now(),
    };
    db.rooms[key] = room;
    roomsChanged = true;
  }
  room.owner = user.name; // (follows a name change)
  return room;
}
let roomsChanged = false;

// Whether `viewerKey` may be in `key`'s room right now: the owner always;
// anyone while it's open (or a party); with "knock first", only people the
// owner let in (for a little while after); a private room, nobody else at
// all (admins included).
const LET_IN_MS = 10 * 60_000; // how long a let-in lasts to walk in
function mayEnter(room, key, viewerKey) {
  if (viewerKey === key) return true;
  if (room.privacy === "open" || room.privacy === "party") return true;
  if (room.privacy === "knock") return (room.allowed?.[viewerKey] ?? 0) > Date.now();
  return false;
}

// Whether `viewerKey` may see inside right now: anyone who may walk in,
// plus people already let in to a "knock first" room who haven't left
// yet (room.inside, cleared when they walk out, or a few minutes after
// their browser stops checking in).
function maySee(room, key, viewerKey) {
  if (mayEnter(room, key, viewerKey)) return true;
  return room.privacy === "knock" && (room.inside?.[viewerKey] ?? 0) > Date.now();
}

// A room pass: the server's signature on "room|owner|visitor|peer id|expires",
// which everyone's browser checks before they show (or talk to) someone
// inside a bedroom. Signed with the badge key, so nobody can make their own.
const PASS_HOURS = 12;
// A let-in visitor stays welcome while their browser keeps checking in;
// if they just close the page, they need to knock again after this long.
const INSIDE_MS = 3 * 60_000;
function roomPass(ownerKey, visitorKey, peerId) {
  const payload = `room|${ownerKey}|${visitorKey}|${peerId}|${Date.now() + PASS_HOURS * 3600_000}`;
  return { payload, sig: sign("sha256", Buffer.from(payload), { key: badgeKey, dsaEncoding: "ieee-p1363" }).toString("base64") };
}

// Scrambled (encrypted) text from the journal, as base64, or null.
const sealed = (v, max) => (typeof v === "string" && v.length <= max && /^[A-Za-z0-9+/=]+$/.test(v) ? v : null);

// A short piece of text from a save, or null.
const shortText = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);

// Someone's face (eyes, mouth, blush, freckles) from their saved look:
// short words only (the page checks them against its own list).
function faceOf(look) {
  const f = look?.face;
  if (!f || typeof f !== "object") return null;
  return { eyes: shortText(f.eyes, 20), mouth: shortText(f.mouth, 20), blush: shortText(f.blush, 20), freckles: f.freckles === true };
}

// What everyone sees of a room from the hallway: the door (and, if
// they're allowed in, what's inside).
function doorInfo(key, user, viewerKey = key) {
  const room = ensureRoom(key, user);
  const look = savedData(user, "cozy-house-profile") ?? {};
  return {
    owner: user.name,
    map: room.map,
    color: /^#[0-9a-fA-F]{6}$/.test(look.color) ? look.color : "#999999",
    privacy: room.privacy,
    note: room.note,
    deco: room.deco,
    style: room.style,
    size: room.size,
    audio: room.audio,
    placed: maySee(room, key, viewerKey) ? room.placed : [], // what's inside (only if you may go in)
    // How they look, so they can be shown asleep in bed while they're away.
    look: { hat: shortText(look.hat, 30), shoes: shortText(look.shoes, 30), glasses: shortText(look.glasses, 30), pet: shortText(look.pet, 30), face: faceOf(look), scarf: shortText(look.scarf, 30), backpack: shortText(look.backpack, 30), earrings: shortText(look.earrings, 30) },
    online: Date.now() - (user.lastSeen ?? 0) < ONLINE_MS,
  };
}

const routes = {
  "GET /api/health": async () => ({ ok: true }),

  // The public half of the badge key, for checking admin badges.
  "GET /api/badge-key": async () => ({ key: createPublicKey(badgeKey).export({ type: "spki", format: "der" }).toString("base64") }),

  "POST /api/signup": async (req, ip) => {
    if (!allowed("signup:" + ip, 10)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const name = cleanName(body.name);
    if (!name) throw new Oops(400, "Names are 2 to 16 letters or numbers (spaces, - and _ are OK too).");
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 200) throw new Oops(400, "Passwords need at least 8 characters.");
    const key = name.toLowerCase();
    if (db.users[key]) throw new Oops(409, "That name is taken. Try another.");
    if (Object.keys(db.users).length >= MAX_USERS) throw new Oops(403, "The house is full of accounts right now.");
    const salt = randomBytes(16).toString("hex");
    db.users[key] = { name, salt, hash: await hashPassword(password, salt), createdAt: Date.now(), member: false, save: null, reset: null };
    const token = newSession(key);
    await saveDb();
    return { token, user: publicUser(db.users[key]) };
  },

  "POST /api/login": async (req, ip) => {
    if (!allowed("login:" + ip, 20)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const key = String(body.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const user = db.users[key];
    if (key && !allowed("login-name:" + key, 10)) throw new Oops(429, "Too many tries for that name. Please wait a few minutes.");
    const hash = await hashPassword(String(body.password ?? ""), user ? user.salt : DUMMY_SALT);
    if (!user || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"))) throw new Oops(401, "That name and password don't match.");
    const token = newSession(key);
    await saveDb();
    return { token, user: publicUser(user) };
  },

  "POST /api/logout": async (req) => {
    const { tokenHash } = currentUser(req);
    delete db.sessions[tokenHash];
    await saveDb();
    return { ok: true };
  },

  "GET /api/me": async (req) => ({ user: publicUser(currentUser(req).user) }),

  // The house phrase: say it once and your account is in the house.
  "POST /api/join": async (req, ip) => {
    const { user } = currentUser(req);
    if (!allowed("join:" + ip, 10)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    if (!sameText(normalizePhrase(body.phrase ?? ""), normalizePhrase(env.HOUSE_PHRASE))) throw new Oops(403, "That's not the house phrase. Check with a friend.");
    user.member = true;
    await saveDb();
    return { user: publicUser(user) };
  },

  // How to reach the house: the room name and password, and the relay login.
  "GET /api/house": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return { roomId: env.ROOM_ID, password: env.ROOM_PASSWORD, turn: relayLogin(key) };
  },

  // --- Mail: letters kept on the server, so they arrive even when the
  // friend you wrote to isn't in the house. Each account has an inbox.
  "GET /api/mail": async (req) => {
    const { user } = currentUser(req);
    return { inbox: user.inbox ?? [] };
  },

  "POST /api/mail": async (req, ip) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("mail:" + ip, 40)) throw new Oops(429, "That's a lot of letters! Please wait a few minutes.");
    const body = await readJson(req, 20_000);
    const to = db.users[String(body.to ?? "").trim().replace(/\s+/g, " ").toLowerCase()];
    if (!to || !to.member) throw new Oops(404, "There's nobody in the house by that name.");
    if (to === user) throw new Oops(400, "That's you! Write to a friend instead.");
    const text = String(body.body ?? "").trim().slice(0, MAIL_LIMITS.body);
    if (!text) throw new Oops(400, "Write something first.");
    const letter = {
      id: randomBytes(9).toString("base64url"),
      from: user.name,
      color: /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#999999",
      subject: String(body.subject ?? "").trim().slice(0, MAIL_LIMITS.subject),
      body: text,
      sentAt: Date.now(),
      read: false,
    };
    to.inbox = [letter, ...(to.inbox ?? [])].slice(0, MAIL_LIMITS.inbox);
    await saveDb();
    return { sent: true, to: to.name };
  },

  "POST /api/mail/read": async (req) => {
    const { user } = currentUser(req);
    const body = await readJson(req, 2_000);
    const letter = (user.inbox ?? []).find((l) => l.id === body.id);
    if (letter && !letter.read) {
      letter.read = true;
      await saveDb();
    }
    return { ok: true };
  },

  "POST /api/mail/delete": async (req) => {
    const { user } = currentUser(req);
    const body = await readJson(req, 2_000);
    user.inbox = (user.inbox ?? []).filter((l) => l.id !== body.id);
    await saveDb();
    return { ok: true };
  },

  // Letters from before mail lived on the server (kept in the browser):
  // brought over once, into your own inbox.
  "POST /api/mail/import": async (req) => {
    const { user } = currentUser(req);
    const body = await readJson(req, 200_000);
    const have = new Set((user.inbox ?? []).map((l) => l.id));
    const brought = (Array.isArray(body.letters) ? body.letters : [])
      .filter((l) => l && typeof l.id === "string" && l.id.length <= 40 && !have.has(l.id) && typeof l.from === "string" && typeof l.body === "string")
      .slice(0, MAIL_LIMITS.inbox)
      .map((l) => ({
        id: l.id,
        from: l.from.trim().slice(0, 16) || "Someone",
        color: /^#[0-9a-fA-F]{6}$/.test(l.color) ? l.color : "#999999",
        subject: String(l.subject ?? "").slice(0, MAIL_LIMITS.subject),
        body: l.body.slice(0, MAIL_LIMITS.body),
        sentAt: Number.isFinite(l.sentAt) ? l.sentAt : Date.now(),
        read: l.read === true,
      }));
    user.inbox = [...(user.inbox ?? []), ...brought].sort((a, b) => b.sentAt - a.sentAt).slice(0, MAIL_LIMITS.inbox);
    await saveDb();
    return { imported: brought.length };
  },

  // Everyone in the house (for the To box).
  "GET /api/names": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return { names: Object.values(db.users).filter((u) => u.member).map((u) => u.name).sort((a, b) => a.localeCompare(b)) };
  },

  // --- The Conference Room whiteboard: a picture of it, saved so it's
  // still there when everyone has logged off. Whoever draws uploads the
  // latest picture a moment after they stop (it already has everyone's
  // strokes on it, since strokes are shared live).
  "GET /api/whiteboard": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    try {
      const png = await readFile(WHITEBOARD_FILE);
      return { image: "data:image/png;base64," + png.toString("base64") };
    } catch (err) {
      if (err.code === "ENOENT") return { image: null };
      throw err;
    }
  },

  "PUT /api/whiteboard": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("whiteboard:" + key, 400)) throw new Oops(429, "That's a lot of drawing! Please wait a few minutes.");
    const body = await readJson(req, 2_500_000);
    const prefix = "data:image/png;base64,";
    if (typeof body.image !== "string" || !body.image.startsWith(prefix)) throw new Oops(400, "That doesn't look like a picture of the board.");
    const png = Buffer.from(body.image.slice(prefix.length), "base64");
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (png.length > 1_800_000 || !png.subarray(0, 8).equals(signature)) throw new Oops(400, "That doesn't look like a picture of the board.");
    const tmp = WHITEBOARD_FILE + ".tmp";
    await writeFile(tmp, png, { mode: 0o600 });
    await rename(tmp, WHITEBOARD_FILE);
    return { ok: true };
  },

  // --- The Workshop's boards (kanban). Every change is one small action,
  // applied here one at a time, so two people editing at once never
  // overwrite each other. Each action returns the whole (small) state.
  "GET /api/kanban": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return kanbanState();
  },

  "POST /api/kanban": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("kanban:" + key, 600)) throw new Oops(429, "Lots of changes! Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const result = applyKanban(body, user);
    db.kanban.version++;
    await saveDb();
    return { ...kanbanState(), result };
  },

  // --- Bedrooms: everyone's door (for the bedroom hallway) ---
  "GET /api/rooms": async (req) => {
    const { user: me, key: myKey } = currentUser(req);
    if (!me.member) throw new Oops(403, "Enter the house phrase first.");
    const doors = Object.entries(db.users)
      .filter(([, u]) => u.member)
      .map(([key, u]) => doorInfo(key, u, myKey))
      .sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
    if (roomsChanged) {
      roomsChanged = false;
      await saveDb();
    }
    return { doors };
  },

  // Your own door: who can come in, a short note, and a decoration.
  "PUT /api/room/door": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 5_000);
    const room = ensureRoom(key, user);
    if (body.privacy !== undefined) {
      if (!ROOM_PRIVACY.includes(body.privacy)) throw new Oops(400, "That's not a door setting.");
      room.privacy = body.privacy;
      // Going private sends everyone else out (their browsers see it).
      if (room.privacy === "private") room.allowed = room.inside = {};
    }
    if (body.note !== undefined) room.note = String(body.note).replace(/\s+/g, " ").trim().slice(0, 40);
    if (body.deco !== undefined) {
      if (!DOOR_DECOS.includes(body.deco)) throw new Oops(400, "That's not a door decoration.");
      room.deco = body.deco;
    }
    if (body.audio !== undefined) {
      if (!ROOM_AUDIO.includes(body.audio)) throw new Oops(400, "That's not a room sound.");
      room.audio = body.audio;
    }
    if (body.style !== undefined) {
      if (!ROOM_STYLES.includes(body.style)) throw new Oops(400, "That's not a room style.");
      if (THEME_OWNERS[body.style] && THEME_OWNERS[body.style] !== key) throw new Oops(403, "That style belongs to someone else.");
      room.style = body.style;
    }
    await saveDb();
    return { door: doorInfo(key, user) };
  },

  // Going into someone's bedroom (or your own): a pass if you may.
  "POST /api/room/enter": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 2_000);
    const ownerKey = String(body.owner ?? "").trim().toLowerCase();
    const peerId = String(body.peerId ?? "");
    const room = db.rooms?.[ownerKey];
    if (!room || !db.users[ownerKey]?.member) throw new Oops(404, "There's no room like that.");
    if (!/^[\w-]{1,64}$/.test(peerId)) throw new Oops(400, "That doesn't look right.");
    if (!maySee(room, ownerKey, key)) {
      if (room.privacy === "knock") throw new Oops(403, "knock");
      throw new Oops(403, "private");
    }
    const pass = roomPass(ownerKey, key, peerId);
    if (key !== ownerKey && room.privacy === "knock") {
      // A let-in is used up once you're in; you stay welcome until you leave.
      if (room.allowed) delete room.allowed[key];
      room.inside ??= {};
      room.inside[key] = Date.now() + INSIDE_MS; // (their browser checks in every minute while inside)
      await saveDb();
    }
    return { pass };
  },

  // Walking back out of someone's bedroom (so a "knock first" room needs
  // a new knock next time).
  "POST /api/room/leave": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 2_000);
    const room = db.rooms?.[String(body.owner ?? "").trim().toLowerCase()];
    if (room?.inside?.[key]) {
      delete room.inside[key];
      await saveDb();
    }
    return { ok: true };
  },

  // The owner lets someone who knocked come in.
  "POST /api/room/let-in": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 2_000);
    const visitorKey = String(body.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!db.users[visitorKey]?.member) throw new Oops(404, "There's nobody by that name.");
    const room = ensureRoom(key, user);
    room.allowed = Object.fromEntries(Object.entries(room.allowed ?? {}).filter(([, until]) => until > Date.now()));
    room.allowed[visitorKey] = Date.now() + LET_IN_MS;
    await saveDb();
    return { ok: true };
  },

  // What's in your own room (from your decorating), and its size.
  "PUT /api/room/home": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 20_000);
    const room = ensureRoom(key, user);
    if (!Array.isArray(body.placed) || !ROOM_SIZES.includes(body.size)) throw new Oops(400, "That doesn't look like a room.");
    room.placed = body.placed.slice(0, 80).map(cleanPiece).filter(Boolean);
    room.size = body.size;
    await saveDb();
    return { ok: true };
  },

  // --- The bedroom journal ---
  // Locked in your own browser before it ever gets here: the server (and
  // anyone who can read its files, admins included) only keeps scrambled
  // text. db.journals[account] = { lock: { salt, iv, data }, entries:
  // { "2026-09-26": { iv, data } } }. The lock is the journal's key,
  // itself locked with your password; only your browser can open it.
  "GET /api/journal": async (req) => {
    const { key } = currentUser(req);
    const journal = db.journals?.[key];
    return { lock: journal?.lock ?? null, entries: journal?.entries ?? {} };
  },
  "PUT /api/journal/lock": async (req) => {
    const { key } = currentUser(req);
    const body = await readJson(req, 5_000);
    const lock = { salt: sealed(body.salt, 64), iv: sealed(body.iv, 64), data: sealed(body.data, 200) };
    if (!lock.salt || !lock.iv || !lock.data) throw new Oops(400, "That lock doesn't look right.");
    db.journals ??= {};
    const journal = (db.journals[key] ??= { lock: null, entries: {} });
    // A new lock only replaces an old one on purpose (after a password change).
    if (journal.lock && body.replace !== true) throw new Oops(409, "Your journal already has a lock.");
    journal.lock = lock;
    await saveDb();
    return { ok: true };
  },
  "PUT /api/journal/entry": async (req) => {
    const { key } = currentUser(req);
    const body = await readJson(req, 40_000);
    const journal = db.journals?.[key];
    if (!journal?.lock) throw new Oops(400, "Your journal isn't set up yet.");
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Oops(400, "That's not a date.");
    if (body.data === null) delete journal.entries[date];
    else {
      const entry = { iv: sealed(body.iv, 64), data: sealed(body.data, 30_000) };
      if (!entry.iv || !entry.data) throw new Oops(400, "That entry doesn't look right.");
      if (!journal.entries[date] && Object.keys(journal.entries).length >= 5000) throw new Oops(403, "Your journal is full.");
      journal.entries[date] = entry;
    }
    await saveDb();
    return { ok: true };
  },

  // --- Profiles: what friends see when they click on you. Your look,
  // achievements and hours come from your cloud save; the bio you write.
  "GET /api/profile": async (req) => {
    const { user: me, key: myKey } = currentUser(req);
    if (!me.member) throw new Oops(403, "Enter the house phrase first.");
    const name = new URL(req.url, "http://x").searchParams.get("name") ?? "";
    const user = db.users[name.trim().replace(/\s+/g, " ").toLowerCase()];
    if (!user || !user.member) throw new Oops(404, "There's nobody in the house by that name.");
    const saved = (key) => {
      try {
        return JSON.parse(user.save?.data?.[key] ?? "null");
      } catch {
        return null;
      }
    };
    const look = saved("cozy-house-profile") ?? {};
    const progress = saved("cozy-house-achievements") ?? {};
    const text = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);
    return {
      name: user.name,
      since: user.createdAt,
      bio: user.bio ?? "",
      color: /^#[0-9a-fA-F]{6}$/.test(look.color) ? look.color : "#999999",
      hat: text(look.hat, 30),
      shoes: text(look.shoes, 30),
      pet: text(look.pet, 30),
      glasses: text(look.glasses, 30),
      face: faceOf(look),
      scarf: text(look.scarf, 30),
      backpack: text(look.backpack, 30),
      earrings: text(look.earrings, 30),
      lofi: text(saved("cozy-house-lofi"), 30), // their Study station (turntable.js)
      achievements: Object.keys(progress.unlocked ?? {}).slice(0, 200),
      seconds: Number.isFinite(progress.stats?.seconds) ? progress.stats.seconds : 0,
      // Seconds spent in each room, for room levels ("room_study": 5400).
      rooms: Object.fromEntries(Object.entries(progress.stats ?? {}).filter(([k, v]) => /^room_[a-z]{1,20}$/.test(k) && Number.isFinite(v)).slice(0, 30)),
    };
  },

  "POST /api/profile": async (req) => {
    const { user } = currentUser(req);
    const body = await readJson(req, 5_000);
    user.bio = String(body.bio ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
    await saveDb();
    return { bio: user.bio };
  },

  // --- The admin panel in the game (only for admin accounts) ---
  "GET /api/admin/users": async (req) => {
    const { user } = currentUser(req);
    if (!user.admin) throw new Oops(403, "Admins only.");
    return {
      users: Object.values(db.users).map((u) => ({ name: u.name, member: !!u.member, admin: !!u.admin, since: u.createdAt, savedAt: u.save?.updatedAt ?? null, letters: (u.inbox ?? []).length })),
    };
  },
  "POST /api/admin/reset": async (req) => {
    const { user: me, key: myKey } = currentUser(req);
    if (!me.admin) throw new Oops(403, "Admins only.");
    const body = await readJson(req, 2_000);
    const user = db.users[String(body.name ?? "").trim().toLowerCase()];
    if (!user) throw new Oops(404, "No account with that name.");
    const code = randomBytes(5).toString("hex").toUpperCase();
    user.reset = { code, expires: Date.now() + RESET_HOURS * 3600_000 };
    await saveDb();
    return { name: user.name, code, hours: RESET_HOURS };
  },

  // Cloud saves: crumbs, what you own, achievements, your bedroom, letters.
  "GET /api/save": async (req) => {
    const { user } = currentUser(req);
    return { save: user.save };
  },

  "PUT /api/save": async (req) => {
    const { user } = currentUser(req);
    const body = await readJson(req, MAX_SAVE_BYTES);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new Oops(400, "That save doesn't look right.");
    user.save = { data: body.data, updatedAt: Date.now() };
    await saveDb();
    return { updatedAt: user.save.updatedAt };
  },

  // Account settings: change your name (checked with your password).
  "POST /api/account/name": async (req, ip) => {
    const { user, key } = currentUser(req);
    if (!allowed("account:" + ip, 10)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const hash = await hashPassword(String(body.password ?? ""), user.salt);
    if (!timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"))) throw new Oops(401, "That password isn't right.");
    const name = cleanName(body.name);
    if (!name) throw new Oops(400, "Names are 2 to 16 letters or numbers (spaces, - and _ are OK too).");
    const newKey = name.toLowerCase();
    if (newKey !== key && db.users[newKey]) throw new Oops(409, "That name is taken. Try another.");
    user.name = name;
    if (newKey !== key) {
      db.users[newKey] = user;
      delete db.users[key];
      for (const s of Object.values(db.sessions)) if (s.user === key) s.user = newKey;
      if (db.rooms?.[key]) {
        db.rooms[newKey] = db.rooms[key]; // your bedroom comes with you
        delete db.rooms[key];
      }
      if (db.journals?.[key]) {
        db.journals[newKey] = db.journals[key]; // and your journal
        delete db.journals[key];
      }
    }
    await saveDb();
    return { user: publicUser(user) };
  },

  // Account settings: change your password (logs you out everywhere else).
  "POST /api/account/password": async (req, ip) => {
    const { user, key, tokenHash } = currentUser(req);
    if (!allowed("account:" + ip, 10)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const hash = await hashPassword(String(body.current ?? ""), user.salt);
    if (!timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"))) throw new Oops(401, "Your current password isn't right.");
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 200) throw new Oops(400, "Passwords need at least 8 characters.");
    user.salt = randomBytes(16).toString("hex");
    user.hash = await hashPassword(password, user.salt);
    for (const [k, s] of Object.entries(db.sessions)) if (s.user === key && k !== tokenHash) delete db.sessions[k];
    await saveDb();
    return { ok: true };
  },

  // Forgot your password: the house owner gives you a one-time code
  // (see admin.mjs), and you pick a new password with it.
  "POST /api/reset": async (req, ip) => {
    if (!allowed("reset:" + ip, 10)) throw new Oops(429, "Too many tries. Please wait a few minutes.");
    const body = await readJson(req, 10_000);
    const key = String(body.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const user = db.users[key];
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!user?.reset || user.reset.expires < Date.now() || !sameText(code, user.reset.code)) throw new Oops(403, "That reset code doesn't work. Ask for a new one.");
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 200) throw new Oops(400, "Passwords need at least 8 characters.");
    user.salt = randomBytes(16).toString("hex");
    user.hash = await hashPassword(password, user.salt);
    user.reset = null;
    for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k]; // log out everywhere else
    const token = newSession(key);
    await saveDb();
    return { token, user: publicUser(user) };
  },
};

// Admin requests only come from admin.mjs on the droplet itself (Caddy
// only passes on /api/ addresses), and must carry the admin token.
const adminRoutes = {
  "GET /admin/users": async () => ({
    users: Object.values(db.users).map((u) => ({ name: u.name, member: !!u.member, created: new Date(u.createdAt).toISOString().slice(0, 10), hasSave: !!u.save })),
  }),
  "POST /admin/reset": async (req) => {
    const body = await readJson(req, 10_000);
    const user = db.users[String(body.name ?? "").trim().toLowerCase()];
    if (!user) throw new Oops(404, "No account with that name.");
    const code = randomBytes(5).toString("hex").toUpperCase();
    user.reset = { code, expires: Date.now() + RESET_HOURS * 3600_000 };
    await saveDb();
    return { name: user.name, code, hours: RESET_HOURS };
  },
  "POST /admin/promote": async (req) => {
    const body = await readJson(req, 10_000);
    const user = db.users[String(body.name ?? "").trim().toLowerCase()];
    if (!user) throw new Oops(404, "No account with that name.");
    user.admin = body.admin !== false;
    await saveDb();
    return { name: user.name, admin: user.admin };
  },
  "POST /admin/remove": async (req) => {
    const body = await readJson(req, 10_000);
    const key = String(body.name ?? "").trim().toLowerCase();
    if (!db.users[key]) throw new Oops(404, "No account with that name.");
    const name = db.users[key].name;
    delete db.users[key];
    delete db.rooms?.[key]; // and their bedroom
    delete db.journals?.[key]; // and their journal
    for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
    await saveDb();
    return { name };
  },
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = corsHeaders(origin);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const path = new URL(req.url, "http://x").pathname;
    const routeKey = `${req.method} ${path}`;
    // Caddy tells us who's really asking (everything else looks like 127.0.0.1).
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim();
    if (adminRoutes[routeKey]) {
      const given = String(req.headers["x-admin-token"] || "");
      if (req.headers["x-forwarded-for"] || !given || !sameText(given, env.ADMIN_TOKEN)) throw new Oops(403, "No.");
      return send(res, 200, await adminRoutes[routeKey](req));
    }
    const handler = routes[routeKey];
    if (!handler) throw new Oops(404, "Nothing here.");
    send(res, 200, await handler(req, ip), cors);
  } catch (err) {
    if (!(err instanceof Oops)) console.error(err);
    send(res, err.status || 500, { error: err instanceof Oops ? err.message : "Something went wrong on the server." }, cors);
  }
});

await loadDb();
await loadBadgeKey();
await backup();
setInterval(backup, 24 * 3600_000).unref();
server.listen(PORT, "127.0.0.1", () => console.log(`Cozy House server listening on 127.0.0.1:${PORT}`));
