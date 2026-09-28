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
import { readFile, writeFile, rename, mkdir, readdir, unlink, copyFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
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

// A full copy of the house's data once a day (the data file, the
// whiteboard picture and the badge signing key), each day in its own
// folder ("daily-2026-09-27"), keeping the last 14 days. To restore one,
// stop the server, copy the folder's files back into the data folder, and
// start it again. (Older single-file copies, "db-...json", are tidied away
// the same way.)
const BACKUP_FILES = ["db.json", "whiteboard.png", "badge-key.pem"];
async function backup() {
  try {
    const day = join(BACKUP_DIR, `daily-${new Date().toISOString().slice(0, 10)}`);
    await mkdir(day, { recursive: true, mode: 0o700 });
    for (const file of BACKUP_FILES) {
      try {
        await copyFile(join(DATA_DIR, file), join(day, file));
      } catch (err) {
        if (err.code !== "ENOENT") throw err; // (no whiteboard yet is fine)
      }
    }
    const all = await readdir(BACKUP_DIR);
    for (const old of all.filter((f) => f.startsWith("daily-")).sort().slice(0, -14)) await rm(join(BACKUP_DIR, old), { recursive: true, force: true });
    for (const old of all.filter((f) => f.startsWith("db-2")).sort().slice(0, -14)) await unlink(join(BACKUP_DIR, old));
  } catch (err) {
    console.error("Backup failed:", err.message);
  }
}

// --- Keeping saves believable ---
// Progress lives in each person's browser and is copied here, so someone
// could edit their browser to hand themselves crumbs, items or
// achievements. These checks catch the obvious cases by comparing a new
// save with the last one: crumbs can only go up so fast (plenty for
// selling a big catch), and only a few new items, achievements or tier
// steps can appear at once. Anything past that is trimmed back in the
// account's save (what friends see, and what comes back on the next
// login). Admins are left alone (the admin panel hands things out for
// testing). It's not airtight: someone patient could still creep their
// numbers up slowly.
const BANK_KEYS = ["cozy-house-crumbs", "cozy-house-basket", "cozy-house-fishing"];
const SAVE_LIMITS = { crumbsBurst: 4000, crumbsPerMinute: 100, newItems: 10, newAchievements: 10, tierSteps: 3 };

function parseSaved(data, key) {
  try {
    return JSON.parse(data?.[key] ?? "null");
  } catch {
    return null;
  }
}

function keepSaveBelievable(old, data) {
  const minutes = Math.max(0, (Date.now() - old.updatedAt) / 60_000);
  const before = parseSaved(old.data, "cozy-house-crumbs"), after = parseSaved(data, "cozy-house-crumbs");
  if (before && after && typeof after === "object") {
    const room = SAVE_LIMITS.crumbsBurst + SAVE_LIMITS.crumbsPerMinute * minutes;
    if (Number.isFinite(after.crumbs) && Number.isFinite(before.crumbs) && after.crumbs > before.crumbs + room) after.crumbs = Math.floor(before.crumbs + room);
    if (Array.isArray(after.owned) && Array.isArray(before.owned)) {
      const added = after.owned.filter((id) => !before.owned.includes(id));
      if (added.length > SAVE_LIMITS.newItems) after.owned = [...before.owned, ...added.slice(0, SAVE_LIMITS.newItems)];
    }
    data["cozy-house-crumbs"] = JSON.stringify(after);
  }
  const was = parseSaved(old.data, "cozy-house-achievements"), now = parseSaved(data, "cozy-house-achievements");
  if (was && now && typeof now === "object") {
    const oldUnlocked = was.unlocked ?? {}, newUnlocked = now.unlocked ?? {};
    const added = Object.keys(newUnlocked).filter((id) => !(id in oldUnlocked));
    if (added.length > SAVE_LIMITS.newAchievements) {
      for (const id of added.slice(SAVE_LIMITS.newAchievements)) delete newUnlocked[id];
    }
    for (const [id, n] of Object.entries(now.tiers ?? {})) {
      const had = Number.isInteger(was.tiers?.[id]) ? was.tiers[id] : 0;
      if (!Number.isInteger(n) || n > had + SAVE_LIMITS.tierSteps) now.tiers[id] = had + SAVE_LIMITS.tierSteps;
    }
    data["cozy-house-achievements"] = JSON.stringify(now);
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

// --- The shared garden (Update 4) ---
const GARDEN_BEDS = 24; // the most beds the page can have (it has 12 now)
const GARDEN_MAX_PER_PERSON = 6; // a safety cap (the page's own limit is in config.js)
const WATER_GAP = 30 * 60_000; // waterings closer together than this count once
const MAX_WATERS = 200;

function gardenState() {
  db.garden ??= { version: 1, plots: {} };
  return { version: db.garden.version, plots: db.garden.plots, now: Date.now() };
}

function waterPlot(plot, when, by) {
  const last = plot.waters.at(-1) ?? 0;
  if (when - last < WATER_GAP) return false;
  plot.waters.push(when);
  if (plot.waters.length > MAX_WATERS) plot.waters.shift();
  plot.wateredBy = by;
  return true;
}

// One gardening action: { action, bed, crop }. "plant" (an empty bed,
// with a seed from your basket), "water" (anyone's bed), "rain" (every
// bed, only while it's really raining), "harvest" (your own ripe bed: the
// crop goes in your basket) or "clear" (your own bed, dug up).
function applyGarden(body, user, w, ev) {
  gardenState();
  const plots = db.garden.plots;
  const now = Date.now();
  if (body.action === "rain") {
    let watered = 0;
    if (sky.raining) for (const plot of Object.values(plots)) if (waterPlot(plot, now, "rain")) watered++;
    return { watered };
  }
  const bed = Number(body.bed);
  if (!Number.isInteger(bed) || bed < 0 || bed >= GARDEN_BEDS) throw new Oops(400, "That's not a garden bed.");
  const plot = plots[bed];
  const mine = plot && plot.owner.toLowerCase() === user.name.toLowerCase();
  if (body.action === "plant") {
    if (plot) throw new Oops(409, `${plot.owner} is already growing something there.`);
    const crop = String(body.crop ?? "");
    if (!Object.hasOwn(GAME.CROPS, crop)) throw new Oops(400, "That's not a seed.");
    // New gardeners start with Hazel's lesson (she hands out the first seed).
    if (w && w.gardenLesson === "none") throw new Oops(409, "Say hello to Hazel first! She's by her seed stand in the yard.");
    // The yard's starter beds only grow quick beginner crops; everything grows at the Farm.
    if (GAME.GARDEN_BEDS?.[bed]?.place === "yard" && !GAME.CROPS[crop].starter) throw new Oops(409, `${GAME.CROPS[crop].name} won't grow in the starter patch. Take the bus to the Farm for that one!`);
    const count = Object.values(plots).filter((p) => p.owner.toLowerCase() === user.name.toLowerCase()).length;
    if (count >= Math.min(GARDEN_MAX_PER_PERSON, GAME.CONFIG.garden.maxPlotsPerPlayer)) throw new Oops(409, "You're already growing plenty!");
    if (w) {
      takeOut(w, `seed:${crop}`, 1);
      grant(w, "firstSeed", ev);
    }
    // Your color (for the little name stake), as the page sends it.
    const color = /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#999999";
    // Your lesson's radish: it starts dry (Hazel shows you how to water it),
    // then grows in a few minutes.
    const lesson = w?.gardenLesson === "started" && crop === "radish" && !Object.values(plots).some((p) => p.lesson && p.owner.toLowerCase() === user.name.toLowerCase());
    plots[bed] = lesson ? { owner: user.name, color, crop, plantedAt: now, waters: [], wateredBy: null, lesson: true } : { owner: user.name, color, crop, plantedAt: now, waters: [now], wateredBy: user.name };
    return { planted: crop, lesson };
  }
  if (!plot) throw new Oops(404, "Nothing's growing there.");
  if (body.action === "water") {
    const watered = waterPlot(plot, now, user.name);
    if (w && watered && !mine) addStat(w, "friendsWatered", 1);
    return { watered };
  }
  if (body.action === "harvest" || body.action === "clear") {
    if (!mine) throw new Oops(403, `That's ${plot.owner}'s bed.`);
    const crop = GAME.CROPS[plot.crop];
    if (body.action === "harvest" && w) {
      if (!crop || growthOf(plot, now) < 1) throw new Oops(409, "That's not ripe yet.");
      const [low, high] = crop.yield;
      const n = low + Math.floor(Math.random() * (high - low + 1)) + (boosted(w, "greenThumb") ? 1 : 0);
      delete plots[bed];
      putIn(w, `crop:${crop.id}`, n);
      addStat(w, "harvests", n);
      if (crop.id === "pumpkin") grant(w, "greatPumpkin", ev);
      // Your lesson's first harvest: now show it to Hazel.
      if (plot.lesson && w.gardenLesson === "started") w.gardenLesson = "harvested";
      return { crop: plot.crop, n, lesson: !!plot.lesson };
    }
    delete plots[bed];
    return { crop: plot.crop };
  }
  throw new Oops(400, "That's not something you can do in the garden.");
}

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
// (The personal office themes, like the Lake house, stay in offices: bedrooms have their own styles.)
const ROOM_STYLES = ["classic", "cabin", "apartment", "beachHut"];
const ROOM_AUDIO = ["voice", "lofi", "silent"];
const ROOM_SIZES = ["cozy", "roomy"];
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
  // Pixel art painted on a canvas, poster or rug (Update 7): 16 by 16
  // squares, each a palette color from 0 to f.
  if (["artCanvas", "artPoster", "artRug"].includes(p.item) && typeof p.pixels === "string" && /^[0-9a-f]{256}$/.test(p.pixels)) piece.pixels = p.pixels;
  // The fish swimming in a fish tank (Update 4): a few fish names.
  if (Array.isArray(p.fish)) {
    const fish = p.fish.filter((id) => typeof id === "string" && /^[a-zA-Z]{1,24}$/.test(id)).slice(0, 12);
    if (fish.length) piece.fish = fish;
  }
  return piece;
}

function ensureRoom(key, user) {
  db.rooms ??= {};
  let room = db.rooms[key];
  if (!room) {
    const home = savedData(user, "cozy-house-home") ?? {};
    const maps = Object.values(db.rooms).map((r) => r.map);
    room = {
      owner: user.name,
      map: maps.length ? Math.max(...maps) + 1 : 0,
      style: "classic",
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
  // A bedroom made while bedrooms could borrow an office theme goes back to Classic.
  if (!ROOM_STYLES.includes(room.style)) {
    room.style = "classic";
    roomsChanged = true;
  }
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
    look: { hat: shortText(look.hat, 30), shoes: shortText(look.shoes, 30), glasses: shortText(look.glasses, 30), pet: shortText(look.pet, 30), face: faceOf(look), scarf: shortText(look.scarf, 30), backpack: shortText(look.backpack, 30), earrings: shortText(look.earrings, 30), title: shortText(look.title, 30) },
    online: Date.now() - (user.lastSeen ?? 0) < ONLINE_MS,
    resetAt: room.resetAt ?? 0, // (an admin cleared it: the owner's page clears its copy too)
  };
}

// --- The bank (build 0.63) ---
// The server keeps everyone's crumbs and everything they own: the
// raccoons' items, their basket (seeds, crops, fish, bait, junk), fishing
// progress, Nest & Nook furniture and achievements. The page only shows
// what the server says. Every way of earning or spending is one small
// action (buy this, sell that, reel this in), checked here against the
// server's own records and prices, so changing things in your own browser
// changes nothing. Dice are rolled here too (which fish bites, how big it
// is, how many carrots a bed gives).
//
// user.wallet = { crumbs, owned: [raccoon item ids], met, basket: { id: n },
//   fishing: { rods, rod, bait, xp, log, castAt, pending },
//   home: { owned: { decor id: n }, size }, unlocked: { id: when },
//   tiers: { id: n }, stats: { seconds, chats, room_study, ... },
//   activeMs, lastTick, lastFocus, movedAt }
//
// The prices and lists come from the site's own files (config.js,
// catalog.js and world.js), read once when the server starts, so there's
// only one copy of every price. They live in GAME_DIR (see README.md).
const GAME_DIR = env.GAME_DIR || join(dirname(fileURLToPath(import.meta.url)), "game");
let GAME = null;

async function loadGame() {
  const files = ["config.js", "catalog.js", "world.js"];
  const code = (await Promise.all(files.map((f) => readFile(join(GAME_DIR, f), "utf8")))).join("\n;\n");
  const g = vm.runInNewContext(code + "\n;({ CONFIG, DECOR, ROOMY_PRICE, SHOP_CATALOG, ACHIEVEMENT_LIST, pondShadows, inPond, waterAt, waterShadows, waterById, GARDEN_BEDS, isFullMoon })", {}, { timeout: 5000 });
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  GAME = {
    CONFIG: g.CONFIG,
    DECOR: g.DECOR,
    ROOMY_PRICE: g.ROOMY_PRICE,
    SHOP: byId(g.SHOP_CATALOG),
    ACH: byId(g.ACHIEVEMENT_LIST),
    FISH: byId(g.CONFIG.fish),
    RODS: g.CONFIG.rods,
    BAIT: byId(g.CONFIG.bait),
    CROPS: byId(g.CONFIG.crops),
    JUNK: byId(g.CONFIG.junk),
    FOOD: byId(g.CONFIG.kitchen.pantry),
    RECIPES: byId(g.CONFIG.kitchen.recipes),
    pondShadows: g.pondShadows,
    inPond: g.inPond,
    waterAt: g.waterAt, // (the pond or the Lake, from world.js)
    waterShadows: g.waterShadows,
    waterById: g.waterById,
    GARDEN_BEDS: g.GARDEN_BEDS, // (where each bed is: "yard" or "farm", from world.js)
    isFullMoon: g.isFullMoon, // (the real moon, from world.js)
    NIGHT: byId(g.CONFIG.night.items),
    TRACKS: g.CONFIG.tieredAchievements ?? [],
    TIERS: g.CONFIG.achievementTiers ?? [],
  };
  // One-time achievements that became tiers (kept, so tiers know they were paid).
  GAME.RETIRED = new Set(GAME.TRACKS.flatMap((t) => t.was ?? []).filter(Boolean));
  console.log(`Game data: ${Object.keys(GAME.SHOP).length} raccoon items, ${Object.keys(GAME.DECOR).length} decor, ${Object.keys(GAME.ACH).length} achievements`);
}

const MAX_STACK = 9999;
const STARTERS = { starterDesk: 1, starterMattress: 1, starterNightstand: 1, starterPhone: 1 };
// Counters the server keeps (the tiered achievements are counted in these).
const SERVER_STATS = ["seconds", "sleepSeconds", "chats", "focusSessions", "crumbsEarned", "emotesUsed", "dances", "daysVisited", "harvests", "friendsWatered", "fishCaught", "dishesCooked", "requestsDone"];

const whole = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

// Whether a basket id is a real thing ("fish:perch", "seed:carrot"...).
function knownItem(id) {
  const [kind, name] = String(id).split(":");
  if (kind === "fish") return Object.hasOwn(GAME.FISH, name);
  if (kind === "junk") return Object.hasOwn(GAME.JUNK, name) || name === GAME.CONFIG.kitchen.burnt.id;
  if (kind === "food") return Object.hasOwn(GAME.FOOD, name);
  if (kind === "dish") return Object.hasOwn(GAME.RECIPES, name);
  if (kind === "bait") return Object.hasOwn(GAME.BAIT, name) && GAME.BAIT[name].price > 0;
  if (kind === "seed" || kind === "crop") return Object.hasOwn(GAME.CROPS, name);
  if (kind === "night") return Object.hasOwn(GAME.NIGHT, name);
  return false;
}

// A wallet, made the first time it's needed from that person's cloud save
// (everything they had before the bank), so nothing is lost.
function ensureWallet(user, key) {
  if (user.wallet) return fillWallet(user.wallet);
  const shop = savedData(user, "cozy-house-crumbs") ?? {};
  const basket = savedData(user, "cozy-house-basket")?.items ?? {};
  const fishing = savedData(user, "cozy-house-fishing") ?? {};
  const home = savedData(user, "cozy-house-home") ?? {};
  const progress = savedData(user, "cozy-house-achievements") ?? {};
  const room = db.rooms?.[key];
  const w = {
    crumbs: whole(shop.crumbs),
    owned: [...new Set(Array.isArray(shop.owned) ? shop.owned : [])].filter((id) => Object.hasOwn(GAME.SHOP, id)),
    met: shop.met === true,
    basket: {},
    fishing: { rods: ["twig"], rod: "twig", bait: "worm", xp: whole(fishing.xp), log: {}, castAt: 0, pending: null },
    home: { owned: { ...STARTERS }, size: room?.size === "roomy" || home.size === "roomy" ? "roomy" : "cozy" },
    unlocked: {},
    tiers: {},
    stats: {},
    activeMs: 0,
    lastTick: 0,
    lastFocus: 0,
    movedAt: Date.now(),
  };
  for (const [id, n] of Object.entries(basket && typeof basket === "object" ? basket : {})) if (knownItem(id) && whole(n) > 0) w.basket[id] = whole(n, MAX_STACK);
  const f = w.fishing;
  for (const id of Array.isArray(fishing.rods) ? fishing.rods : []) if (GAME.RODS.some((r) => r.id === id) && !f.rods.includes(id)) f.rods.push(id);
  if (f.rods.includes(fishing.rod)) f.rod = fishing.rod;
  if (Object.hasOwn(GAME.BAIT, fishing.bait)) f.bait = fishing.bait;
  for (const [id, e] of Object.entries(fishing.log ?? {})) if (Object.hasOwn(GAME.FISH, id) && whole(e?.n) > 0) f.log[id] = { n: whole(e.n), best: whole(e.best) };
  for (const [id, n] of Object.entries(home.owned ?? {})) if (Object.hasOwn(GAME.DECOR, id) && whole(n) > 0) w.home.owned[id] = Math.max(w.home.owned[id] ?? 0, whole(n, 99));
  // Anything already placed in their bedroom counts as owned (so nothing
  // placed ever disappears when the bank starts checking).
  const placedCounts = {};
  for (const p of room?.placed ?? []) placedCounts[p.item] = (placedCounts[p.item] ?? 0) + 1;
  for (const [id, n] of Object.entries(placedCounts)) if (Object.hasOwn(GAME.DECOR, id)) w.home.owned[id] = Math.max(w.home.owned[id] ?? 0, Math.min(n, 99));
  for (const [id, when] of Object.entries(progress.unlocked ?? {})) if (Object.hasOwn(GAME.ACH, id) || GAME.RETIRED.has(id)) w.unlocked[id] = Number.isFinite(when) ? when : Date.now();
  for (const [id, n] of Object.entries(progress.tiers ?? {})) {
    const track = GAME.TRACKS.find((t) => t.id === id);
    if (track && Number.isInteger(n) && n > 0) w.tiers[id] = Math.min(n, track.goals.length);
  }
  for (const [stat, v] of Object.entries(progress.stats ?? {})) {
    if ((SERVER_STATS.includes(stat) || /^room_[a-z]{1,20}$/.test(stat)) && Number.isFinite(v)) w.stats[stat] = whole(v);
  }
  if (Number.isFinite(progress.stats?.lastDay)) w.stats.lastDay = progress.stats.lastDay;
  user.wallet = w;
  return fillWallet(w);
}

// Parts of the wallet added later (Update 5): the recipe book, the boost
// from the last dish you ate, the day of your last fortune cookie, and what
// you've bought from the traveling merchant this week.
function fillWallet(w) {
  w.recipes ??= [];
  w.boost ??= null;
  w.cookieDay ??= 0;
  w.wishDay ??= 0; // (the day of your last wish at the well, Update 7)
  // Night & Mothman (Update 8): your sightings (blurry photos), and what
  // you've done tonight (fireflies caught, the porch light watched).
  w.night ??= {};
  w.night.sightings ??= [];
  w.night.sightDay ??= 0;
  w.night.fireflyDay ??= 0;
  w.night.fireflies ??= 0;
  w.night.lastFirefly ??= 0;
  w.night.porchDay ??= 0;
  // The Arcade (Update 9): your tickets, today's winnings and cash-ins,
  // your capsule pins, and the play that's going on (if any).
  w.arcade ??= {};
  w.arcade.tickets ??= 0;
  w.arcade.day ??= 0;
  w.arcade.won ??= 0;
  w.arcade.cashed ??= 0;
  w.arcade.pins ??= {};
  w.arcade.play ??= null;
  w.merchant ??= { week: 0, bought: {} };
  w.residents ??= { seed: Math.floor(Math.random() * 1e9), day: 0, done: {} }; // (Update 6: today's requests)
  w.residents.hearts ??= {}; // friendship points with each resident
  w.residents.chatDay ??= {}; // the last day you chatted with each (the first chat of a day counts)
  w.residents.giftDay ??= {}; // the last day you gave each a gift
  // Otis's fishing lesson: "none" (no rod yet), "started" (he gave you
  // one) or "done" (you've landed your first fish). Anyone who has caught
  // a fish before counts as done.
  w.fishing.lesson ??= Object.keys(w.fishing.log ?? {}).length ? "done" : "none";
  // Hazel's gardening lesson (Update 8), the same way: "none", "started"
  // (she gave you a radish seed), "harvested" (your radishes are in your
  // basket, waiting to show her) or "done". Anyone who has gardened before
  // counts as done.
  w.gardenLesson ??= (w.stats?.harvests ?? 0) > 0 || !!w.unlocked?.firstSeed || Object.keys(w.basket ?? {}).some((id) => /^(seed|crop):/.test(id)) ? "done" : "none";
  return w;
}

// --- Residents' requests (Update 6) ---
// Each day, each resident asks each person for one thing from their list
// in config.js (residents.requests). Which one comes from the day, the
// resident and a number kept in the person's wallet, so everyone gets a
// different mix. Returns { clover: { index, done }, ... } for today.
function todaysRequests(w) {
  const day = hometownDay();
  const out = {};
  for (const [id, list] of Object.entries(GAME.CONFIG.residents?.requests ?? {})) {
    let h = (w.residents.seed ^ Math.imul(day, 2654435761)) >>> 0;
    for (const ch of id) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0);
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    out[id] = { index: h % list.length, done: w.residents.day === day && !!w.residents.done[id] };
  }
  return out;
}

// Friendship with the residents: points, hearts, and what's done today.
function friendships(w) {
  const day = hometownDay();
  const h = GAME.CONFIG.residents?.hearts;
  const out = {};
  for (const id of Object.keys(GAME.CONFIG.residents?.requests ?? {})) {
    const points = w.residents.hearts[id] ?? 0;
    out[id] = { points, hearts: Math.floor(points / h.pointsPerHeart), chatted: w.residents.chatDay[id] === day, gifted: w.residents.giftDay[id] === day };
  }
  return out;
}

// Adds (or, for a disliked gift, takes away) friendship points, and tells
// the page when a new heart is reached. Ten hearts earns an achievement.
function addFriendship(w, id, n, ev) {
  const h = GAME.CONFIG.residents.hearts;
  const before = w.residents.hearts[id] ?? 0;
  const after = Math.max(0, Math.min(h.maxHearts * h.pointsPerHeart, before + n));
  w.residents.hearts[id] = after;
  const was = Math.floor(before / h.pointsPerHeart), now = Math.floor(after / h.pointsPerHeart);
  if (now > was) ev.push({ type: "hearts", id, hearts: now });
  if (now >= h.maxHearts) grant(w, id + "Friend", ev);
  if (id === "mothman") mothGifts(w, now, ev);
}

// Mothman's gifts to friends (config.js night.rewards): each once, when
// you reach its hearts.
function mothGifts(w, hearts, ev) {
  for (const r of GAME.CONFIG.night.rewards) {
    if (hearts < r.hearts) continue;
    if (r.achievement) grant(w, r.achievement, ev);
    if (r.owned && !w.owned.includes(r.owned)) {
      w.owned.push(r.owned);
      ev.push({ type: "mothGift", item: r.owned });
    }
    if (r.decor && !(w.home.owned[r.decor] > 0)) {
      w.home.owned[r.decor] = 1;
      ev.push({ type: "mothGift", item: "decor:" + r.decor });
    }
  }
}

// What a resident thinks of a gift: "loved", "liked", "neutral" or
// "disliked" (config.js: residents.tastes).
function tasteOf(id, item) {
  const t = GAME.CONFIG.residents.tastes?.[id] ?? {};
  for (const kind of ["loved", "liked", "disliked"]) if ((t[kind] ?? []).includes(item)) return kind;
  const prefix = item.split(":")[0] + ":";
  for (const kind of ["loved", "liked", "disliked"]) if ((t[kind] ?? []).includes(prefix)) return kind;
  return "neutral";
}

// What the page gets to see (the server's own bookkeeping left out).
function publicWallet(w) {
  const { rods, rod, bait, xp, log, lesson } = w.fishing;
  return { crumbs: w.crumbs, owned: w.owned, met: w.met, basket: w.basket, fishing: { rods, rod, bait, xp, log, lesson }, gardenLesson: w.gardenLesson, home: w.home, unlocked: w.unlocked, tiers: w.tiers, stats: w.stats, recipes: w.recipes, boost: boostOf(w), cookieDay: w.cookieDay, wishDay: w.wishDay, night: { sightings: w.night.sightings, sightDay: w.night.sightDay, fireflyDay: w.night.fireflyDay, fireflies: w.night.fireflies, porchDay: w.night.porchDay }, arcade: { tickets: w.arcade.tickets, won: arcadeToday(w).won, cashed: arcadeToday(w).cashed, pins: w.arcade.pins }, merchant: w.merchant, requests: todaysRequests(w), friends: friendships(w) };
}

const addStat = (w, stat, n) => (w.stats[stat] = whole((w.stats[stat] ?? 0) + n));

// Gives an achievement (and its crumbs) once. `ev` collects what happened,
// so the page can show the pop-ups.
function grant(w, id, ev) {
  const a = GAME.ACH[id];
  if (!a || w.unlocked[id]) return;
  w.unlocked[id] = Date.now();
  ev.push({ type: "achievement", id, crumbs: a.crumbs });
  earn(w, a.crumbs, ev);
}

function earn(w, n, ev) {
  if (!(n > 0)) return;
  w.crumbs = whole(w.crumbs + n);
  addStat(w, "crumbsEarned", n);
  if (w.crumbs >= 500) grant(w, "hoarder", ev);
}

function spend(w, n) {
  if (w.crumbs < n) throw new Oops(409, `That's ${n} crumbs, and you have ${w.crumbs}.`);
  w.crumbs -= n;
}

const have = (w, id) => w.basket[id] ?? 0;
function putIn(w, id, n) {
  w.basket[id] = Math.min(MAX_STACK, have(w, id) + n);
}
function takeOut(w, id, n) {
  if (have(w, id) < n) throw new Oops(409, "You don't have that many.");
  w.basket[id] -= n;
  if (w.basket[id] <= 0) delete w.basket[id];
}

// A whole number from the page, within limits (or a 400).
function amount(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Oops(400, "That's not a number that works here.");
  return n;
}

// --- Tiered achievements, counted from the server's own numbers ---
function levelFor(seconds) {
  const steps = GAME.CONFIG.roomLevels?.minutesForLevel ?? [];
  let level = 0;
  while (level < steps.length && seconds >= steps[level] * 60) level++;
  return level;
}

function trackValue(track, w) {
  const s = w.stats;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const values = {
    hours: n(s.seconds) / 3600,
    sleepHours: n(s.sleepSeconds) / 3600,
    items: w.owned.length,
    pets: w.owned.filter((id) => GAME.SHOP[id]?.type === "pet").length,
    roomLevels: Object.keys(GAME.CONFIG.roomLevels?.rooms ?? {}).reduce((sum, key) => sum + levelFor(n(s["room_" + key])), 0),
  };
  return n(Object.hasOwn(values, track.stat) ? values[track.stat] : s[track.stat]);
}

function checkTiers(w, ev) {
  // (Crumbs from one tier can reach a Crumb Collector tier, so look again.)
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const track of GAME.TRACKS) {
      const value = trackValue(track, w);
      let got = w.tiers[track.id] ?? 0;
      while (got < track.goals.length && got < GAME.TIERS.length && value >= track.goals[got]) {
        const paidBefore = track.was?.[got] && w.unlocked[track.was[got]];
        const reward = paidBefore ? 0 : GAME.TIERS[got].crumbs;
        got++;
        w.tiers[track.id] = got;
        ev.push({ type: "tier", id: track.id, level: got, crumbs: reward });
        earn(w, reward, ev);
        changed = true;
      }
    }
    if (!changed) return;
  }
}

// --- The sky over the hometown (for which fish bite, and rain in the garden) ---
const sky = { raining: false, night: null, offset: 0 };
async function checkSky() {
  const { latitude, longitude } = GAME.CONFIG.weather.hometown;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code,is_day&timezone=auto&forecast_days=1`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const code = data.current?.weather_code;
    sky.raining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    sky.night = data.current?.is_day === 0;
    sky.offset = (data.utc_offset_seconds ?? 0) * 1000;
    // Real rain waters every bed in the garden.
    if (sky.raining && db.garden) {
      let watered = 0;
      for (const plot of Object.values(db.garden.plots)) if (waterPlot(plot, Date.now(), "rain")) watered++;
      if (watered) {
        db.garden.version++;
        await saveDb();
      }
    }
  } catch (err) {
    console.warn("Couldn't get the weather:", err.message);
  }
}

// Today's arcade winnings and cash-ins (Update 9), started afresh each day.
function arcadeToday(w) {
  const day = hometownDay();
  if (w.arcade.day !== day) Object.assign(w.arcade, { day, won: 0, cashed: 0 });
  return w.arcade;
}

// A night's date (Update 8): the evening's date, so the small hours after
// midnight still count as the same night.
const nightDay = () => {
  const d = new Date(Date.now() + sky.offset - 12 * 3_600_000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
};
// Out on a full moon night: the Howl badge.
function moonBadge(w, ev) {
  if (isNight() && GAME.isFullMoon()) grant(w, "fullMoon", ev);
}

// The hometown's clock: its date (as 20260926) and hour.
const hometown = () => new Date(Date.now() + sky.offset);
const hometownDay = () => {
  const d = hometown();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
};
function isNight() {
  if (sky.night !== null) return sky.night;
  const hour = hometown().getUTCHours();
  const { nightFrom, nightTo } = GAME.CONFIG.outdoors;
  return hour >= nightFrom || hour < nightTo;
}
function season() {
  if (["spring", "summer", "autumn", "winter"].includes(GAME.CONFIG.season)) return GAME.CONFIG.season;
  const month = hometown().getUTCMonth();
  return month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
}

// --- Fishing ---
function fishingLevel(xp) {
  let level = 1;
  GAME.CONFIG.fishing.levels.forEach((need, i) => {
    if (xp >= need) level = i + 1;
  });
  return level;
}
const rodOf = (w) => GAME.RODS.find((r) => r.id === w.fishing.rod) ?? GAME.RODS[0];
function baitInUse(w) {
  const bait = GAME.BAIT[w.fishing.bait];
  return bait && (bait.price === 0 || have(w, `bait:${bait.id}`) > 0) ? bait : GAME.BAIT.none;
}
function fishBiting(fish) {
  const when = fish.when ?? {};
  if (when.night === true && !isNight()) return false;
  if (when.night === false && isNight()) return false;
  if (when.rain && !sky.raining) return false;
  if (when.season && !when.season.includes(season())) return false;
  if (when.fullMoon && !(isNight() && GAME.isFullMoon())) return false;
  return true;
}
// What bites, from the bait, the rod and the shadow that came to the
// bobber ("small", "medium" or "large": bigger shadows bring the rarer of
// the bait's fish more often).
function pickCatch(bait, rod, shadow = "small", maxRarity = 5, noJunk = false) {
  const junk = GAME.CONFIG.junk;
  if (!noJunk && Math.random() < GAME.CONFIG.fishing.junkChance) return { junk: junk[Math.floor(Math.random() * junk.length)].id };
  const rarer = GAME.CONFIG.fishing.shadows[shadow]?.rarer ?? 0;
  // Only fish that live in this water (the pond at home tops out at
  // uncommon; Willow Lake has everything).
  let tiers = [...bait.catches].sort((a, b) => a - b).filter((t) => t <= maxRarity);
  if (!tiers.length) tiers = [Math.min(maxRarity, Math.min(...bait.catches))];
  const weights = tiers.map((_, i) => (i === 0 ? 1 : 0.35 + rod.luck + rarer));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let tier = tiers[0];
  for (let i = 0; i < tiers.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      tier = tiers[i];
      break;
    }
  }
  for (const t of [tier, ...tiers.filter((x) => x !== tier).reverse()]) {
    const pool = GAME.CONFIG.fish.filter((f) => f.rarity === t && fishBiting(f));
    if (pool.length) return { fish: pool[Math.floor(Math.random() * pool.length)].id };
  }
  return { junk: junk[0].id };
}

// Which shadow the page says came to the bobber, if it really did: the
// server works out where that shadow swam between the cast and now, and
// it has to have come within reach of where the bobber landed. Otherwise
// (or with no shadow) it's a small fish.
function shadowAtBobber(id, spot, from, to) {
  if (!spot || !Number.isInteger(id)) return "small";
  const reach = GAME.CONFIG.fishing.shadows.reach + 0.35; // (a little slack for timing)
  const water = GAME.waterById(spot.water ?? "pond") ?? GAME.waterById("pond");
  for (let t = from; t <= to; t += 250) {
    const s = GAME.waterShadows(water, t).find((x) => x.id === id);
    if (s && Math.hypot(s.x - spot.bx, s.y - spot.by) <= reach) return s.size;
  }
  return "small";
}

// --- The garden: how grown a crop is (the same sums the page does) ---
function growthOf(plot, now = Date.now()) {
  const crop = GAME.CROPS[plot.crop];
  if (!crop) return 0;
  const HOUR = 3_600_000;
  // Hazel's lesson radish: nothing until it's watered, then quick.
  if (plot.lesson) {
    if (!plot.waters.length) return 0;
    return Math.min(1, (now - plot.waters[0]) / ((GAME.CONFIG.garden.lessonMinutes ?? 3) * 60_000));
  }
  const wetFor = GAME.CONFIG.garden.waterHours * HOUR;
  const start = plot.plantedAt;
  let wet = 0, until = start;
  for (const t of [...plot.waters].sort((a, b) => a - b)) {
    const from = Math.max(t, until, start), to = Math.min(t + wetFor, now);
    if (to > from) wet += to - from;
    until = Math.max(until, Math.min(t + wetFor, now));
  }
  const total = Math.max(0, now - start);
  return Math.min(1, (wet + (total - wet) * GAME.CONFIG.garden.dryGrowth) / (crop.hours * HOUR));
}

// --- The kitchen, the trading post and the merchant (Update 5) ---
const QUICK_BITE = 0.7; // how much sooner fish bite with the Quick Bites boost

function boostOf(w) {
  return w.boost && w.boost.until > Date.now() ? w.boost : null;
}
const boosted = (w, id) => boostOf(w)?.id === id;

// Whether 2 to 4 basket things are this recipe's ingredients (in any
// order; "fish" is any fish).
function recipeMatches(recipe, items) {
  if (recipe.ingredients.length !== items.length) return false;
  const left = [...items];
  for (const need of [...recipe.ingredients].sort((a, b) => (a === "fish") - (b === "fish"))) {
    const i = left.findIndex((id) => (need === "fish" ? id.startsWith("fish:") : id === need));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

// A basket thing's name, for letters ("Rainbow Trout", "Pumpkin Pie").
function itemLabel(id) {
  const [kind, name] = id.split(":");
  const list = { fish: GAME.FISH, crop: GAME.CROPS, food: GAME.FOOD, dish: GAME.RECIPES, bait: GAME.BAIT, junk: GAME.JUNK }[kind];
  if (kind === "seed") return (GAME.CROPS[name]?.name ?? name) + " seeds";
  if (id === `junk:${GAME.CONFIG.kitchen.burnt.id}`) return GAME.CONFIG.kitchen.burnt.name;
  return list?.[name]?.name ?? name;
}

// A letter in someone's mailbox (from a friend, or from the Trading Post).
function sendLetter(user, { from, subject, body }) {
  const letter = { id: randomBytes(9).toString("base64url"), from, color: "#c98f3c", subject: subject.slice(0, MAIL_LIMITS.subject), body: body.slice(0, MAIL_LIMITS.body), sentAt: Date.now(), read: false };
  user.inbox = [letter, ...(user.inbox ?? [])].slice(0, MAIL_LIMITS.inbox);
}

// The trading post's stall. Listings older than listingDays go back to
// whoever listed them (with a note).
function marketState() {
  db.market ??= { listings: [] };
  const old = Date.now() - GAME.CONFIG.tradingPost.listingDays * 86_400_000;
  for (const l of db.market.listings.filter((x) => x.at < old)) {
    const sellerUser = db.users[l.seller];
    if (sellerUser) {
      putIn(ensureWallet(sellerUser, l.seller), l.item, l.n);
      sendLetter(sellerUser, { from: "Porch Swap", subject: `Back from Porch Swap: ${l.n} × ${itemLabel(l.item)}`, body: `Nobody took your ${l.n} × ${itemLabel(l.item)} this week, so it's back in your basket.` });
    }
  }
  db.market.listings = db.market.listings.filter((x) => x.at >= old);
  return db.market;
}

// Is the merchant here, and what did she bring this week? (A different
// mix each week, the same for everyone.)
function merchantState() {
  const m = GAME.CONFIG.merchant;
  const dayNumber = Math.floor((Date.now() + sky.offset) / 86_400_000);
  const week = Math.floor((dayNumber + 3) / 7); // (weeks start on Monday)
  const here = hometown().getUTCDay() === m.day || eventOn("merchant");
  // A shuffle that's the same all week: a little random-number maker seeded with the week.
  let seed = week * 2654435761 >>> 0;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const goods = [...m.goods];
  for (let i = goods.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [goods[i], goods[j]] = [goods[j], goods[i]];
  }
  return { here, week, stock: goods.slice(0, m.stockSize) };
}

// --- Every bank action: (wallet, what the page sent, events, who) ---
const BANK = {
  // Once a minute while you're in the house: time in the house (and in
  // the room you're in), and a crumb a minute while you're really here.
  // Time only counts at the speed of the clock, however often it's asked.
  tick(w, b, ev) {
    const now = Date.now();
    const gap = w.lastTick ? now - w.lastTick : 60_000;
    if (gap < 20_000) return { early: true };
    w.lastTick = now;
    const counted = Math.min(gap, 60_000);
    const secs = Math.round(counted / 1000);
    addStat(w, "seconds", secs);
    if (Object.hasOwn(GAME.CONFIG.roomLevels?.rooms ?? {}, b.room)) addStat(w, "room_" + b.room, secs);
    if (b.asleep === true) addStat(w, "sleepSeconds", secs);
    // Chats, emotes and dances since the last tick (only so many a minute).
    for (const [stat, most] of [["chats", 30], ["emotesUsed", 30], ["dances", 10]]) {
      const n = Math.floor(Number(b[stat]));
      if (n > 0) addStat(w, stat, Math.min(n, most));
    }
    const day = hometownDay();
    if (w.stats.lastDay !== day) {
      w.stats.lastDay = day;
      addStat(w, "daysVisited", 1);
    }
    if (b.active === true) {
      w.activeMs = Math.min((w.activeMs ?? 0) + counted, 120_000);
      while (w.activeMs >= 60_000) {
        w.activeMs -= 60_000;
        earn(w, GAME.CONFIG.crumbsPerMinute * (boosted(w, "cozy") ? 2 : 1), ev);
      }
    }
    return {};
  },

  // The Study's focus timer: a bonus, at most once per session length.
  focus(w, b, ev) {
    const now = Date.now();
    if (now - (w.lastFocus ?? 0) < GAME.CONFIG.focusMinutes * 60_000 * 0.9) throw new Oops(409, "It's too soon for another focus bonus.");
    w.lastFocus = now;
    addStat(w, "focusSessions", 1);
    earn(w, GAME.CONFIG.focusBonusCrumbs, ev);
    return { crumbs: GAME.CONFIG.focusBonusCrumbs };
  },

  // A one-time achievement the page saw happen (not the ones the server
  // gives itself).
  achieve(w, b, ev) {
    const a = GAME.ACH[b.id];
    if (!a || a.server) throw new Oops(400, "That's not an achievement you can claim.");
    grant(w, a.id, ev);
    return {};
  },

  // --- The raccoons ---
  meet(w, b, ev) {
    w.met = true;
    grant(w, "raccoons", ev);
    return {};
  },
  buy(w, b, ev) {
    const item = GAME.SHOP[b.id];
    if (!item || item.reward) throw new Oops(400, "The raccoons don't sell that."); // (Mothman's gifts and arcade prizes aren't for sale)
    if (w.owned.includes(item.id)) throw new Oops(409, "You already have that one.");
    spend(w, item.price);
    w.owned.push(item.id);
    grant(w, "firstBuy", ev);
    const ownsAll = (type) => Object.values(GAME.SHOP).filter((i) => i.type === type && !i.reward).every((i) => w.owned.includes(i.id));
    if (ownsAll("hat")) grant(w, "allHats", ev);
    if (ownsAll("shoes")) grant(w, "allShoes", ev);
    return {};
  },
  sellJunk(w, b, ev) {
    const junk = Object.keys(w.basket).filter((id) => id.startsWith("junk:"));
    const n = junk.reduce((sum, id) => sum + have(w, id), 0);
    if (!n) return { sold: 0, crumbs: 0, ids: [] };
    for (const id of junk) delete w.basket[id];
    const crumbs = n * (GAME.CONFIG.junkPrice ?? 3);
    earn(w, crumbs, ev);
    grant(w, "junkDealer", ev);
    return { sold: n, crumbs, ids: junk };
  },

  // --- Hazel's gardening lesson (Update 8) ---
  // It begins: she gives you a radish seed to plant in the starter patch.
  startGardenLesson(w) {
    if (w.gardenLesson !== "none") return {};
    w.gardenLesson = "started";
    putIn(w, "seed:radish", 1);
    return {};
  },

  // You show Hazel your first harvest: she buys a radish, pays you, and
  // heads off to her farm.
  gardenLessonHandIn(w, b, ev) {
    if (w.gardenLesson !== "harvested") throw new Oops(409, "Hazel is waiting for your first harvest.");
    const id = have(w, "crop:radish") ? "radish" : Object.keys(w.basket).find((k) => k.startsWith("crop:"))?.slice(5);
    if (!id) throw new Oops(409, "You'll need something you grew to show Hazel. Plant another!");
    takeOut(w, `crop:${id}`, 1);
    const crumbs = GAME.CONFIG.garden.lessonReward ?? 15;
    earn(w, crumbs, ev);
    w.gardenLesson = "done";
    ev.push({ type: "gardenLesson" });
    return { crop: id, crumbs };
  },

  // --- Otis and the pond ---
  // Otis's lesson begins: he lends you his old twig rod (and a few worms).
  startLesson(w) {
    const f = w.fishing;
    if (f.lesson !== "none") return {};
    f.lesson = "started";
    if (!f.rods.includes("twig")) f.rods.push("twig");
    f.rod = "twig";
    putIn(w, "bait:worm", 3);
    return {};
  },
  // Your first fish, handed to Otis: he takes it (that one, or any fish if
  // it's gone), pays you for it, and heads off to Willow Lake.
  lessonHandIn(w, b, ev) {
    const f = w.fishing;
    if (f.lesson !== "caught") throw new Oops(409, "Otis is waiting for your first fish.");
    const id = have(w, `fish:${f.lessonFish}`) ? f.lessonFish : Object.keys(w.basket).find((k) => k.startsWith("fish:"))?.slice(5);
    if (!id) throw new Oops(409, "You'll need a fish to show Otis. Catch another!");
    takeOut(w, `fish:${id}`, 1);
    const crumbs = GAME.CONFIG.fishing.lessonReward ?? 25;
    earn(w, crumbs, ev);
    f.lesson = "done";
    delete f.lessonFish;
    ev.push({ type: "lesson" });
    return { fish: id, crumbs };
  },
  useRod(w, b) {
    if (!w.fishing.rods.includes(b.id)) throw new Oops(409, "You don't have that rod.");
    w.fishing.rod = b.id;
    return {};
  },
  buyRod(w, b) {
    const rod = GAME.RODS.find((r) => r.id === b.id);
    if (!rod) throw new Oops(400, "Otis doesn't have that rod.");
    if (w.fishing.rods.includes(rod.id)) throw new Oops(409, "You already have that rod.");
    if (fishingLevel(w.fishing.xp) < rod.level) throw new Oops(409, `That rod needs fishing level ${rod.level}.`);
    spend(w, rod.price);
    w.fishing.rods.push(rod.id);
    w.fishing.rod = rod.id;
    return {};
  },
  useBait(w, b) {
    const bait = GAME.BAIT[b.id];
    if (!bait || fishingLevel(w.fishing.xp) < bait.level) throw new Oops(409, "You can't use that bait yet.");
    w.fishing.bait = bait.id;
    return {};
  },
  buyBait(w, b) {
    const bait = GAME.BAIT[b.id];
    const n = amount(b.n, 1, 50);
    if (!bait || !bait.price || bait.merchant) throw new Oops(400, "Otis doesn't sell that.");
    if (fishingLevel(w.fishing.xp) < bait.level) throw new Oops(409, `That bait needs fishing level ${bait.level}.`);
    spend(w, bait.price * n);
    putIn(w, `bait:${bait.id}`, n);
    w.fishing.bait = bait.id;
    return {};
  },
  // Casting, then (after a bite) hooking, then landing it. A bite can't
  // come sooner than the quickest bite the rod allows, so nobody can
  // fish faster than the pond does.
  // Where the bobber landed (out on the pond) is remembered, so the
  // shadow that bites is the one that really swam up to it.
  cast(w, b) {
    const bx = Number(b.bx), by = Number(b.by);
    const water = Number.isFinite(bx) && Number.isFinite(by) ? GAME.waterAt(bx, by) : null;
    if (!water) throw new Oops(400, "That's not on the water.");
    if (w.fishing.lesson === "none") throw new Oops(409, "You don't have a fishing rod yet. Otis, by the pond, will lend you one.");
    w.fishing.castAt = Date.now();
    w.fishing.castSpot = { bx, by, water: water.id };
    w.fishing.pending = null;
    return {};
  },
  hook(w, b) {
    const f = w.fishing;
    const now = Date.now();
    const soonest = GAME.CONFIG.fishing.biteSeconds[0] * rodOf(w).bite * (boosted(w, "quickBite") ? QUICK_BITE : 1) * 1000 - 1000;
    if (!f.castAt || now - f.castAt < soonest) throw new Oops(409, "Nothing's biting yet.");
    const castAt = f.castAt;
    f.castAt = 0;
    const bait = baitInUse(w);
    if (bait.price) takeOut(w, `bait:${bait.id}`, 1);
    const rod = rodOf(w);
    const shadow = shadowAtBobber(b.shadow, f.castSpot, castAt, now);
    const maxRarity = GAME.CONFIG.fishing.waters?.[f.castSpot?.water ?? "pond"]?.maxRarity ?? 5;
    // Your very first catch (Otis's lesson) is always a common fish, never junk.
    const caught = f.lesson === "started" ? pickCatch(GAME.BAIT.none, rod, "small", 1, true) : pickCatch(bait, boosted(w, "lucky") ? { ...rod, luck: rod.luck + 0.3 } : rod, shadow, maxRarity);
    f.pending = { ...caught, shadow, at: now };
    const fish = caught.fish ? GAME.FISH[caught.fish] : null;
    return { rarity: fish ? fish.rarity : 1, junk: !!caught.junk, pull: fish?.pull ?? "steady", shadow };
  },
  land(w, b, ev, { user }) {
    const f = w.fishing;
    const p = f.pending;
    // (Your first fish, in Otis's lesson, waits as long as you need.)
    if (!p || Date.now() - p.at > (f.lesson === "started" ? 600_000 : 60_000)) throw new Oops(409, "It got away.");
    f.pending = null;
    if (f.lesson === "started" && p.fish) {
      f.lesson = "caught"; // (now you hand it to Otis: lessonHandIn)
      f.lessonFish = p.fish;
    }
    const levelBefore = fishingLevel(f.xp);
    if (p.junk) {
      putIn(w, `junk:${p.junk}`, 1);
      f.xp += 1;
      return { junk: p.junk, levelBefore, level: fishingLevel(f.xp) };
    }
    const fish = GAME.FISH[p.fish];
    const [small, big] = fish.size;
    // The shadow's size picks the part of the fish's size range.
    const [from, to] = GAME.CONFIG.fishing.shadows[p.shadow]?.sizes ?? [0, 1];
    const size = Math.round(small + (from + (to - from) * Math.random() ** 1.3) * (big - small));
    // The house's biggest of each fish (everyone's).
    db.fishRecords ??= {};
    const best = db.fishRecords[fish.id];
    const houseRecord = !best || size > best.size;
    if (houseRecord) db.fishRecords[fish.id] = { name: user.name, size, at: Date.now() };
    const first = !f.log[fish.id];
    const entry = (f.log[fish.id] ??= { n: 0, best: 0 });
    entry.n++;
    const record = size > entry.best && !first;
    entry.best = Math.max(entry.best, size);
    f.xp += GAME.CONFIG.fishing.xp[fish.rarity - 1] ?? 5;
    putIn(w, `fish:${fish.id}`, 1);
    addStat(w, "fishCaught", 1);
    grant(w, "firstCatch", ev);
    if (fish.rarity >= 4) grant(w, "bigOne", ev);
    if (fish.rarity >= 5) grant(w, "legendCatch", ev);
    if (Object.keys(f.log).length >= 10) grant(w, "pondScholar", ev);
    return { fish: fish.id, size, first, record, best: entry.best, houseRecord, houseBest: houseRecord ? null : best, levelBefore, level: fishingLevel(f.xp) };
  },
  lose(w) {
    w.fishing.pending = null;
    w.fishing.castAt = 0;
    return {};
  },

  // --- Selling fish (to Otis) and crops (to Hazel) ---
  sell(w, b, ev) {
    const id = String(b.id ?? "");
    const [kind, name] = id.split(":");
    const price = kind === "fish" ? GAME.FISH[name]?.sell : kind === "crop" ? GAME.CROPS[name]?.sell : kind === "dish" ? GAME.RECIPES[name]?.sell : null;
    if (!price) throw new Oops(400, "Nobody buys that.");
    const n = amount(b.n, 1, MAX_STACK);
    takeOut(w, id, n);
    earn(w, price * n, ev);
    if (kind === "crop") grant(w, "farmStand", ev);
    return { crumbs: price * n };
  },

  // --- Hazel's seeds ---
  buySeed(w, b) {
    const crop = GAME.CROPS[b.id];
    const n = amount(b.n, 1, 20);
    if (!crop || crop.merchant) throw new Oops(400, "Hazel doesn't have those seeds.");
    spend(w, crop.seed * n);
    putIn(w, `seed:${crop.id}`, n);
    return {};
  },

  // --- Nest & Nook ---
  buyDecor(w, b) {
    const item = Object.hasOwn(GAME.DECOR, b.id) ? GAME.DECOR[b.id] : null;
    if (!item || !item.tab || !(item.price > 0)) throw new Oops(400, "Nest & Nook doesn't sell that.");
    if ((w.home.owned[b.id] ?? 0) >= 99) throw new Oops(409, "That's plenty of those.");
    spend(w, item.price);
    w.home.owned[b.id] = (w.home.owned[b.id] ?? 0) + 1;
    return {};
  },
  buyRoomy(w, b, ev, { user, key }) {
    if (w.home.size === "roomy") throw new Oops(409, "Your room is already roomy.");
    spend(w, GAME.ROOMY_PRICE);
    w.home.size = "roomy";
    ensureRoom(key, user).size = "roomy";
    grant(w, "roomy", ev);
    return {};
  },

  // --- The kitchen (Update 5) ---
  // Basics from the fridge and pantry.
  buyFood(w, b) {
    const food = GAME.FOOD[b.id];
    const n = amount(b.n, 1, 20);
    if (!food) throw new Oops(400, "That's not in the kitchen.");
    spend(w, food.price * n);
    putIn(w, `food:${food.id}`, n);
    return {};
  },
  // Cooking 2 to 4 things from your basket. A known mix (or any recipe
  // that isn't the merchant's) makes the dish and goes in your recipe
  // book; anything else burns.
  cook(w, b, ev) {
    const items = Array.isArray(b.items) ? b.items.map(String) : [];
    if (items.length < 2 || items.length > 4) throw new Oops(400, "Put 2 to 4 things in the pot.");
    const need = {};
    for (const id of items) need[id] = (need[id] ?? 0) + 1;
    for (const [id, n] of Object.entries(need)) {
      if (!/^(crop|food|fish):/.test(id) || have(w, id) < n) throw new Oops(409, "You don't have all of that.");
    }
    const recipe = Object.values(GAME.RECIPES).find((r) => (r.learn !== "merchant" || w.recipes.includes(r.id)) && recipeMatches(r, items));
    for (const [id, n] of Object.entries(need)) takeOut(w, id, n);
    if (!recipe) {
      putIn(w, `junk:${GAME.CONFIG.kitchen.burnt.id}`, 1);
      grant(w, "burntOffering", ev);
      return { burnt: true };
    }
    putIn(w, `dish:${recipe.id}`, 1);
    const learned = !w.recipes.includes(recipe.id);
    if (learned) w.recipes.push(recipe.id);
    addStat(w, "dishesCooked", 1);
    grant(w, "firstDish", ev);
    if (w.recipes.length >= 10) grant(w, "cookbook", ev);
    return { dish: recipe.id, learned };
  },
  // Eating a dish: its boost, for a while (one at a time).
  eat(w, b, ev) {
    const id = String(b.id ?? "");
    const recipe = GAME.RECIPES[id.slice(5)];
    if (!id.startsWith("dish:") || !recipe) throw new Oops(400, "You can't eat that.");
    takeOut(w, id, 1);
    w.boost = { id: recipe.boost, until: Date.now() + GAME.CONFIG.kitchen.boostMinutes * 60_000 };
    grant(w, "wellFed", ev);
    return { boost: recipe.boost };
  },
  // Giving a dish to a friend: it goes straight into their basket, with a
  // note in their mailbox.
  gift(w, b, ev, { user }) {
    const id = String(b.id ?? "");
    if (!id.startsWith("dish:") || !knownItem(id)) throw new Oops(400, "Only dishes can be gifted.");
    const toKey = String(b.to ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const friend = db.users[toKey];
    if (!friend?.member) throw new Oops(404, "There's nobody in the house by that name.");
    if (friend === user) throw new Oops(400, "That's you! Treat yourself by eating it instead.");
    takeOut(w, id, 1);
    putIn(ensureWallet(friend, toKey), id, 1);
    const dish = GAME.RECIPES[id.slice(5)];
    grant(w, "sharing", ev);
    sendLetter(friend, { from: user.name, subject: `A gift: ${dish.name} ${dish.icon}`, body: `${user.name} made you ${dish.name}! It's in your basket. Eat it for a boost, or keep it for later.` });
    return { to: friend.name };
  },
  // Recipes Hazel and Otis sell.
  buyRecipe(w, b, ev) {
    const recipe = GAME.RECIPES[b.id];
    if (!recipe || !["hazel", "otis"].includes(recipe.learn) || recipe.learn !== b.from) throw new Oops(400, "They don't have that recipe.");
    if (w.recipes.includes(recipe.id)) throw new Oops(409, "You already know that one.");
    spend(w, recipe.price);
    w.recipes.push(recipe.id);
    if (w.recipes.length >= 10) grant(w, "cookbook", ev);
    return {};
  },
  // Bringing a resident what they asked for today (Update 6).
  residentRequest(w, b, ev) {
    const id = String(b.id ?? "");
    const list = GAME.CONFIG.residents?.requests?.[id];
    if (!list) throw new Oops(400, "Nobody by that name is asking for anything.");
    const today = todaysRequests(w)[id];
    if (today.done) throw new Oops(409, "You've already helped with today's request. Come back tomorrow!");
    const want = list[today.index];
    takeOut(w, want.item, want.n);
    const day = hometownDay();
    if (w.residents.day !== day) w.residents = { ...w.residents, day, done: {} };
    w.residents.done[id] = true;
    earn(w, want.crumbs, ev);
    addFriendship(w, id, GAME.CONFIG.residents.hearts.request, ev);
    addStat(w, "requestsDone", 1);
    grant(w, "happyToHelp", ev);
    return { crumbs: want.crumbs };
  },
  // The first chat of the day with a resident (a little friendship).
  residentChat(w, b, ev) {
    const id = String(b.id ?? "");
    if (!GAME.CONFIG.residents?.requests?.[id]) throw new Oops(400, "Nobody by that name lives here.");
    const day = hometownDay();
    if (w.residents.chatDay[id] === day) return {};
    w.residents.chatDay[id] = day;
    addFriendship(w, id, GAME.CONFIG.residents.hearts.chat, ev);
    return {};
  },
  // One gift a day to each resident: any one thing from your basket.
  residentGift(w, b, ev) {
    const id = String(b.id ?? "");
    const item = String(b.item ?? "");
    if (!GAME.CONFIG.residents?.requests?.[id]) throw new Oops(400, "Nobody by that name lives here.");
    if (!knownItem(item)) throw new Oops(400, "That's not something you can give.");
    const day = hometownDay();
    if (w.residents.giftDay[id] === day) throw new Oops(409, "You've already given them a gift today. Come back tomorrow!");
    takeOut(w, item, 1);
    w.residents.giftDay[id] = day;
    const taste = tasteOf(id, item);
    addFriendship(w, id, GAME.CONFIG.residents.hearts.gift[taste] ?? 0, ev);
    return { taste };
  },
  // A recipe a resident teaches, once you're friends enough.
  buyResidentRecipe(w, b, ev) {
    const from = String(b.from ?? "");
    const entry = (GAME.CONFIG.residents?.recipes?.[from] ?? []).find((r) => r.id === b.id);
    const recipe = entry && GAME.RECIPES[entry.id];
    if (!recipe) throw new Oops(400, "They don't know that recipe.");
    const h = GAME.CONFIG.residents.hearts;
    const hearts = Math.floor((w.residents.hearts[from] ?? 0) / h.pointsPerHeart);
    if (hearts < h.recipesAt) throw new Oops(403, "Become better friends first.");
    if (w.recipes.includes(recipe.id)) throw new Oops(409, "You already know that one.");
    spend(w, hearts >= h.discountAt ? Math.round(entry.price * (1 - h.discount)) : entry.price);
    w.recipes.push(recipe.id);
    if (w.recipes.length >= 10) grant(w, "cookbook", ev);
    return {};
  },
  // A fortune cookie: one a day (the hometown's day), now and then with a
  // little something inside.
  fortune(w, b, ev) {
    const day = hometownDay();
    if (w.cookieDay === day) throw new Oops(409, "You've had today's fortune cookie. Come back tomorrow!");
    w.cookieDay = day;
    grant(w, "fortuneTold", ev);
    const k = GAME.CONFIG.kitchen;
    const text = k.fortunes[Math.floor(Math.random() * k.fortunes.length)];
    if (Math.random() >= k.fortuneBonusChance) return { text };
    if (Math.random() < 0.5) {
      const [low, high] = k.fortuneBonusCrumbs;
      const crumbs = low + Math.floor(Math.random() * (high - low + 1));
      earn(w, crumbs, ev);
      return { text, crumbs };
    }
    const crops = GAME.CONFIG.crops.filter((c) => !c.merchant);
    const crop = crops[Math.floor(Math.random() * crops.length)];
    putIn(w, `seed:${crop.id}`, 1);
    return { text, seed: crop.id };
  },

  // --- The Arcade (Update 9) ---
  // A cabinet play starts: the house server notes the game and the time,
  // so the score at the end can be checked against how long it took.
  arcadeStart(w, b) {
    const game = GAME.CONFIG.arcade.games.find((g) => g.id === b.game);
    if (!game) throw new Oops(400, "There's no cabinet like that.");
    w.arcade.play = { game: game.id, at: Date.now(), id: newId() };
    return { id: w.arcade.play.id };
  },
  // The play ends: the score (no more than the time allows), tickets for
  // it (within today's cap), and the high score board.
  arcadeEnd(w, b, ev, { user }) {
    const play = w.arcade.play;
    if (!play || play.id !== b.id) throw new Oops(409, "That game isn't running.");
    w.arcade.play = null;
    const game = GAME.CONFIG.arcade.games.find((g) => g.id === play.game);
    const seconds = Math.min(600, (Date.now() - play.at) / 1000);
    const most = Math.floor(game.base + seconds * game.maxPerSecond);
    const score = Math.max(0, Math.min(most, Math.floor(Number(b.score) || 0)));
    const today = arcadeToday(w);
    const tickets = Math.max(0, Math.min(Math.floor(score * game.ticketsPerPoint), game.maxTickets, GAME.CONFIG.arcade.ticketsPerDay - today.won));
    today.won += tickets;
    w.arcade.tickets = whole(w.arcade.tickets + tickets);
    if (tickets > 0) grant(w, "firstTickets", ev);
    // The high score board: the top ten, one line per person (their best).
    db.arcadeScores ??= {};
    const board = (db.arcadeScores[game.id] ??= []);
    const mine = board.find((e) => e.name === user.name);
    if (score > 0 && (!mine || score > mine.score)) {
      if (mine) board.splice(board.indexOf(mine), 1);
      board.push({ name: user.name, score, at: Date.now() });
      board.sort((a, c) => c.score - a.score || a.at - c.at);
      board.length = Math.min(board.length, 10);
    }
    const top = board[0]?.name === user.name && board[0]?.score === score;
    if (top) grant(w, "highScore", ev);
    return { score, tickets, top, board };
  },
  // Tickets into crumbs, up to the day's cap.
  arcadeCashIn(w, b, ev) {
    const cfg = GAME.CONFIG.arcade;
    const today = arcadeToday(w);
    const room = cfg.crumbsPerDay - today.cashed;
    if (room <= 0) throw new Oops(409, "That's all the cashing in for today. Come back tomorrow!");
    const crumbs = Math.min(room, Math.floor(w.arcade.tickets / cfg.ticketsPerCrumb), amount(b.crumbs ?? room, 1, cfg.crumbsPerDay));
    if (crumbs <= 0) throw new Oops(409, `You need ${cfg.ticketsPerCrumb} tickets for a crumb.`);
    w.arcade.tickets -= crumbs * cfg.ticketsPerCrumb;
    today.cashed += crumbs;
    earn(w, crumbs, ev);
    return { crumbs };
  },
  // A prize from the counter, for tickets.
  arcadePrize(w, b) {
    const prize = GAME.CONFIG.arcade.prizes.find((p) => p.id === b.id);
    if (!prize) throw new Oops(400, "That's not behind the counter.");
    if (prize.owned && w.owned.includes(prize.owned)) throw new Oops(409, "You already have that one.");
    if (w.arcade.tickets < prize.tickets) throw new Oops(409, `That's ${prize.tickets} tickets, and you have ${w.arcade.tickets}.`);
    w.arcade.tickets -= prize.tickets;
    if (prize.owned) w.owned.push(prize.owned);
    if (prize.decor) w.home.owned[prize.decor] = Math.min(99, (w.home.owned[prize.decor] ?? 0) + 1);
    return { got: prize.owned ?? "decor:" + prize.decor };
  },
  // The claw machine: crumbs for a go; the house server decides.
  arcadeClaw(w, b, ev) {
    const claw = GAME.CONFIG.arcade.claw;
    spend(w, claw.cost);
    if (Math.random() >= claw.winChance) return { won: false };
    const plush = claw.plushies[Math.floor(Math.random() * claw.plushies.length)];
    w.home.owned[plush] = Math.min(99, (w.home.owned[plush] ?? 0) + 1);
    grant(w, "clawWin", ev);
    return { won: true, got: "decor:" + plush };
  },
  // The capsule machine: crumbs for a random pin.
  arcadeCapsule(w, b, ev) {
    const cap = GAME.CONFIG.arcade.capsule;
    spend(w, cap.cost);
    const pin = cap.pins[Math.floor(Math.random() * cap.pins.length)];
    const fresh = !w.arcade.pins[pin.id];
    w.arcade.pins[pin.id] = Math.min(999, (w.arcade.pins[pin.id] ?? 0) + 1);
    if (cap.pins.every((p) => w.arcade.pins[p.id])) grant(w, "allPins", ev);
    return { pin: pin.id, fresh };
  },

  // --- Night & Mothman (Update 8) ---
  // Lightbulbs and lanterns, from the Workshop's toolbox.
  buyNightItem(w, b) {
    const item = GAME.NIGHT[b.id];
    if (!item || !(item.price > 0)) throw new Oops(400, "The toolbox doesn't have that.");
    const n = amount(b.n ?? 1, 1, 20); // (one, unless it says)
    spend(w, item.price * n);
    putIn(w, `night:${item.id}`, n);
    return {};
  },
  // A firefly in a jar: outdoors, at night, one every so often, a few a
  // night (the page only asks from the yard or the Lake).
  catchFirefly(w, b, ev) {
    const cfg = GAME.CONFIG.night;
    if (!isNight()) throw new Oops(409, "The fireflies only come out at night.");
    const day = nightDay();
    if (w.night.fireflyDay !== day) w.night = { ...w.night, fireflyDay: day, fireflies: 0 };
    if (w.night.fireflies >= cfg.firefliesPerNight) throw new Oops(409, "You've caught plenty tonight. Let the rest glow!");
    if (Date.now() - w.night.lastFirefly < cfg.fireflyEvery * 1000) throw new Oops(409, "They're quick! Give it a moment.");
    w.night.fireflies++;
    w.night.lastFirefly = Date.now();
    putIn(w, "night:firefly", 1);
    moonBadge(w, ev);
    return { caught: w.night.fireflies };
  },
  // Spotting Mothman: one blurry photo a night for the scrapbook.
  mothSighting(w, b, ev) {
    if (!isNight()) throw new Oops(409, "He only comes out at night.");
    const day = nightDay();
    if (w.night.sightDay === day) return {};
    const where = ["porch", "campfire", "bedroom", "steps"].includes(b.where) ? b.where : "porch";
    w.night.sightDay = day;
    w.night.sightings = [...w.night.sightings, { day, where, moon: GAME.isFullMoon() }].slice(-40);
    grant(w, "firstSighting", ev);
    moonBadge(w, ev);
    return { where };
  },
  // The porch light: the moths gather every night for a little while, with
  // Mothman leading. Watching it pays once a night.
  porchSwarm(w, b, ev) {
    const cfg = GAME.CONFIG.night.porchLight;
    const now = hometown();
    if (!(now.getUTCHours() === cfg.hour && now.getUTCMinutes() < cfg.minutes)) throw new Oops(409, "The moths aren't gathering right now. Try the porch around nine at night.");
    const day = hometownDay();
    if (w.night.porchDay === day) throw new Oops(409, "You've watched the moths tonight. They'll be back tomorrow.");
    w.night.porchDay = day;
    earn(w, cfg.crumbs, ev);
    grant(w, "porchLight", ev);
    addFriendship(w, "mothman", 10, ev);
    moonBadge(w, ev);
    return { crumbs: cfg.crumbs };
  },

  // --- House extras (Update 7) ---
  // The wishing well: one coin a day, and a small surprise (the house
  // server rolls it, from CONFIG.extras.wishingWell).
  wish(w, b, ev) {
    const cfg = GAME.CONFIG.extras.wishingWell;
    const day = hometownDay();
    if (w.wishDay === day) throw new Oops(409, "You've made today's wish. The well needs a day to think about it.");
    spend(w, cfg.cost);
    w.wishDay = day;
    grant(w, "wishMade", ev);
    let roll = Math.random() * cfg.rewards.reduce((sum, r) => sum + r.weight, 0);
    const reward = cfg.rewards.find((r) => (roll -= r.weight) < 0) ?? cfg.rewards[0];
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    if (reward.kind === "crumbs") {
      const crumbs = reward.min + Math.floor(Math.random() * (reward.max - reward.min + 1));
      earn(w, crumbs, ev);
      return { crumbs };
    }
    const item = reward.kind === "seed" ? `seed:${pick(GAME.CONFIG.crops.filter((c) => !c.merchant)).id}` : reward.kind === "bait" ? `bait:${reward.id}` : `food:${pick(GAME.CONFIG.kitchen.pantry).id}`;
    const n = reward.n ?? 1;
    putIn(w, item, n);
    return { item, n };
  },
  // The Lounge TV's cooking channel: one recipe a day (the same show for
  // everyone), from the ones you'd otherwise find by experimenting.
  // Watching it puts it in your recipe book.
  tvCooking(w, b, ev) {
    const pool = Object.values(GAME.RECIPES).filter((r) => !r.learn);
    if (!pool.length) return { recipe: null };
    const recipe = pool[hometownDay() % pool.length];
    const learned = !w.recipes.includes(recipe.id);
    if (learned) {
      w.recipes.push(recipe.id);
      if (w.recipes.length >= 10) grant(w, "cookbook", ev);
    }
    return { recipe: recipe.id, learned };
  },

  // --- The trading post (Update 5) ---
  // Listing something: it leaves your basket and waits at the stall.
  tradeList(w, b, ev, { user, key }) {
    const item = String(b.item ?? "");
    const n = amount(b.n, 1, MAX_STACK);
    if (!knownItem(item)) throw new Oops(400, "That can't be traded.");
    const market = marketState();
    if (market.listings.filter((l) => l.seller === key).length >= GAME.CONFIG.tradingPost.maxListings) throw new Oops(409, `You can have ${GAME.CONFIG.tradingPost.maxListings} things up on Porch Swap at once.`);
    let price = null, want = null;
    if (b.want) {
      want = { item: String(b.want.item ?? ""), n: amount(b.want.n, 1, MAX_STACK) };
      if (!knownItem(want.item)) throw new Oops(400, "You can't ask for that.");
    } else price = amount(b.price, 1, 100_000);
    // A direct offer to one friend (from the right-click menu): only they
    // can take it, and a note tells them about it.
    let forKey = null;
    if (b.for) {
      const friend = memberNamed(b.for);
      if (friend.key === key) throw new Oops(400, "That's you!");
      forKey = friend.key;
    }
    takeOut(w, item, n);
    market.listings.push({ id: newId(), seller: key, sellerName: user.name, item, n, price, want, at: Date.now(), ...(forKey ? { for: forKey, forName: db.users[forKey].name } : {}) });
    if (forKey) {
      const ask = price !== null ? `${price} crumbs` : `${want.n} × ${itemLabel(want.item)}`;
      sendLetter(db.users[forKey], { from: user.name, subject: `A trade offer: ${n} × ${itemLabel(item)}`, body: `${user.name} offered you ${n} × ${itemLabel(item)} for ${ask}. It's waiting for you on Porch Swap (the website on the laptop in your bedroom), marked "For you".` });
    }
    return {};
  },
  tradeCancel(w, b, ev, { key }) {
    const market = marketState();
    const listing = market.listings.find((l) => l.id === b.id && l.seller === key);
    if (!listing) throw new Oops(404, "That's not up for trade any more.");
    market.listings = market.listings.filter((l) => l !== listing);
    putIn(w, listing.item, listing.n);
    return {};
  },
  tradeBuy(w, b, ev, { user, key }) {
    const market = marketState();
    const listing = market.listings.find((l) => l.id === b.id);
    if (!listing) throw new Oops(404, "Someone got there first.");
    if (listing.seller === key) throw new Oops(400, "That's yours! Take it back from Your things instead.");
    if (listing.for && listing.for !== key) throw new Oops(403, "That offer is for someone else.");
    const sellerUser = db.users[listing.seller];
    if (!sellerUser) throw new Oops(404, "Whoever listed that has left the house.");
    const seller = ensureWallet(sellerUser, listing.seller);
    let paid;
    if (listing.price !== null) {
      spend(w, listing.price);
      seller.crumbs = whole(seller.crumbs + listing.price);
      grant(seller, "firstTrade", []); // (no pop-up for them: they may be away. It shows on their profile.)
      paid = `${listing.price} crumbs`;
    } else {
      takeOut(w, listing.want.item, listing.want.n);
      putIn(seller, listing.want.item, listing.want.n);
      grant(seller, "firstTrade", []);
      paid = `${listing.want.n} × ${itemLabel(listing.want.item)}`;
    }
    market.listings = market.listings.filter((l) => l !== listing);
    putIn(w, listing.item, listing.n);
    sendLetter(sellerUser, { from: "Porch Swap", subject: `Sold: ${listing.n} × ${itemLabel(listing.item)}`, body: `${user.name} took your ${listing.n} × ${itemLabel(listing.item)} and paid ${paid}. It's already yours.` });
    return { got: listing.item, n: listing.n };
  },

  // --- The traveling merchant (Update 5) ---
  merchantBuy(w, b, ev) {
    const shop = merchantState();
    if (!shop.here) throw new Oops(409, `${GAME.CONFIG.merchant.name} isn't here right now.`);
    const good = shop.stock.find((g) => g.id === b.id);
    if (!good) throw new Oops(400, "That's not in this week's pack.");
    if (w.merchant.week !== shop.week) w.merchant = { week: shop.week, bought: {} };
    if ((w.merchant.bought[good.id] ?? 0) >= good.limit) throw new Oops(409, "That's all of those you can have this week.");
    if (good.kind === "recipe" && w.recipes.includes(good.ref)) throw new Oops(409, "You already know that one.");
    spend(w, good.price);
    w.merchant.bought[good.id] = (w.merchant.bought[good.id] ?? 0) + 1;
    grant(w, "wellTraveled", ev);
    if (good.kind === "seed") putIn(w, `seed:${good.ref}`, 1);
    else if (good.kind === "bait") putIn(w, `bait:${good.ref}`, 1);
    else if (good.kind === "recipe") {
      w.recipes.push(good.ref);
      if (w.recipes.length >= 10) grant(w, "cookbook", ev);
    }
    else if (good.kind === "decor") w.home.owned[good.ref] = Math.min(99, (w.home.owned[good.ref] ?? 0) + 1);
    return {};
  },

  // --- The admin panel's helpers (admins only, for testing) ---
  adminCrumbs(w, b) {
    w.crumbs = whole(w.crumbs + amount(b.n, -1e6, 1e6));
    return {};
  },
  adminSetCrumbs(w, b) {
    w.crumbs = amount(b.n, 0, 1e6);
    return {};
  },
  adminAllItems(w) {
    w.owned = Object.keys(GAME.SHOP);
    return {};
  },
  adminAllDecor(w) {
    for (const [id, item] of Object.entries(GAME.DECOR)) if (item.tab) w.home.owned[id] = Math.max(w.home.owned[id] ?? 0, 1);
    return {};
  },
  adminRoomy(w, b, ev, { user, key }) {
    w.home.size = "roomy";
    ensureRoom(key, user).size = "roomy";
    return {};
  },
  adminStock(w) {
    const ids = [
      ...Object.keys(GAME.FISH).map((id) => `fish:${id}`),
      ...Object.keys(GAME.JUNK).map((id) => `junk:${id}`),
      ...Object.keys(GAME.BAIT).map((id) => `bait:${id}`),
      ...Object.keys(GAME.CROPS).flatMap((id) => [`seed:${id}`, `crop:${id}`]),
      ...Object.keys(GAME.FOOD).map((id) => `food:${id}`),
      ...Object.keys(GAME.RECIPES).map((id) => `dish:${id}`),
    ].filter(knownItem);
    for (const id of ids) w.basket[id] = Math.max(have(w, id), 5);
    return {};
  },
  // Your own garden beds, ripe right now.
  adminRipen(w, b, ev, { user }) {
    for (const plot of Object.values(db.garden?.plots ?? {})) {
      const crop = GAME.CROPS[plot.crop];
      if (!crop || plot.owner.toLowerCase() !== user.name.toLowerCase()) continue;
      const back = crop.hours * 3_600_000 * 3;
      plot.plantedAt -= back;
      plot.waters = plot.waters.map((t) => t - back);
    }
    if (db.garden) db.garden.version++;
    return {};
  },
  // (Testing) Hazel's lesson again, from the start.
  adminGardenLesson(w) {
    w.gardenLesson = "none";
    return {};
  },
  // (Testing) Otis's lesson again, from the start.
  adminLesson(w) {
    w.fishing.lesson = "none";
    return {};
  },
  adminFishXp(w, b) {
    w.fishing.xp = whole(w.fishing.xp + amount(b.n, 0, 100_000));
    return {};
  },
  // Friendship with every resident: one more heart, or back to none.
  adminHearts(w, b, ev) {
    const h = GAME.CONFIG.residents.hearts;
    for (const id of Object.keys(GAME.CONFIG.residents.requests)) {
      if (b.reset) w.residents.hearts[id] = 0;
      else addFriendship(w, id, h.pointsPerHeart, ev);
    }
    return {};
  },
  // Every achievement and tier, quietly (no crumbs).
  adminUnlockAll(w) {
    for (const id of Object.keys(GAME.ACH)) w.unlocked[id] ??= Date.now();
    for (const t of GAME.TRACKS) w.tiers[t.id] = Math.min(t.goals.length, GAME.TIERS.length);
    return {};
  },
  // The traveling merchant comes for an hour (for everyone), whatever the day.
  adminMerchant() {
    db.events ??= {};
    db.events.merchant = Date.now() + 3_600_000;
    return {};
  },
  adminRecipes(w) {
    w.recipes = Object.keys(GAME.RECIPES);
    return {};
  },
  adminResetAchievements(w) {
    w.unlocked = {};
    w.tiers = {};
    w.stats = {};
    return {};
  },
};

// A bedroom layout from the page, checked against the wallet: only
// furniture you own (as many as you own). Fish going into a tank come out
// of your basket; fish taken out (or in a tank that's put away) go back.
function checkPlaced(w, before, after, ev) {
  const counts = {};
  const kept = after.filter((p) => {
    if (!Object.hasOwn(GAME.DECOR, p.item)) return false;
    counts[p.item] = (counts[p.item] ?? 0) + 1;
    return counts[p.item] <= (w.home.owned[p.item] ?? 0);
  });
  const old = {};
  for (const p of before) for (const id of p.fish ?? []) old[id] = (old[id] ?? 0) + 1;
  const stayed = {};
  const size = GAME.CONFIG.fishing.tankSize;
  for (const p of kept) {
    if (!p.fish) continue;
    if (GAME.DECOR[p.item].kind !== "fishTank") {
      delete p.fish;
      continue;
    }
    p.fish = p.fish.filter((id) => Object.hasOwn(GAME.FISH, id)).slice(0, size).filter((id) => {
      if ((stayed[id] ?? 0) < (old[id] ?? 0)) {
        stayed[id] = (stayed[id] ?? 0) + 1;
        return true;
      }
      if (have(w, `fish:${id}`) > 0) {
        takeOut(w, `fish:${id}`, 1);
        return true;
      }
      return false;
    });
    if (!p.fish.length) delete p.fish;
    else if (p.fish.length >= size) grant(w, "fullTank", ev);
  }
  for (const [id, n] of Object.entries(old)) if (n > (stayed[id] ?? 0) && Object.hasOwn(GAME.FISH, id)) putIn(w, `fish:${id}`, n - (stayed[id] ?? 0));
  return kept;
}

// --- The admin panel's tools (build 0.64) ---
// Everything here is for admin accounts only (checked on every request),
// and every change is written in the admin log: who did what, to whom, when.
//
// Some tools need a friend's own browser to do something (come to you,
// get unstuck, leave the house, clear their room). Those go out through
// the house as an "admin order": the server signs it with the badge key,
// and every browser checks the signature before doing anything, so nobody
// can send a fake one.

const LOG_SIZE = 300;
const ERROR_SIZE = 60;
const ORDER_MINUTES = 5; // how long an order stays valid

function requireAdmin(req) {
  const who = currentUser(req);
  if (!who.user.admin) throw new Oops(403, "Admins only.");
  return who;
}

function adminLog(by, action, target = "", detail = "") {
  db.adminLog ??= [];
  db.adminLog.unshift({ at: Date.now(), by: by.name, action, target, detail: String(detail).slice(0, 200) });
  db.adminLog.length = Math.min(db.adminLog.length, LOG_SIZE);
}

// Recent problems: the server's own, and ones friends' pages report.
const recentErrors = [];
function noteError(where, message, who = "") {
  recentErrors.unshift({ at: Date.now(), where, message: String(message).slice(0, 300), who });
  recentErrors.length = Math.min(recentErrors.length, ERROR_SIZE);
}

// A member by name (case doesn't matter), or a 404.
function memberNamed(name) {
  const key = String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const user = db.users[key];
  if (!user?.member) throw new Oops(404, "There's nobody in the house by that name.");
  return { user, key };
}

// An admin order: "admin|kind|target|data|expires", signed with the badge key.
function signOrder(kind, target, data = {}) {
  const payload = `admin|${kind}|${target}|${JSON.stringify(data)}|${Date.now() + ORDER_MINUTES * 60_000}`;
  return { payload, sig: sign("sha256", Buffer.from(payload), { key: badgeKey, dsaEncoding: "ieee-p1363" }).toString("base64") };
}

// What every browser needs to know about the house's admin state (sent
// with the bedroom doors, which everyone checks every 20 seconds).
function houseNotices() {
  const now = Date.now();
  const names = (list) => Object.entries(list ?? {}).filter(([, until]) => until > now).map(([key]) => db.users[key]?.name).filter(Boolean);
  const a = db.announcement;
  return {
    muted: names(db.mutes),
    kicked: names(db.kicks),
    announcement: a && a.until > now ? { id: a.id, text: a.text, by: a.by } : null,
    maintenance: db.maintenance?.on ? db.maintenance.message || "The house is closed for a little while." : null,
  };
}

// Events an admin can start (the merchant's visit; the full moon comes
// with Update 8). Each lasts `minutes` for everyone.
const EVENTS = ["merchant", "fullMoon"];
function eventOn(id) {
  return (db.events?.[id] ?? 0) > Date.now();
}

// Invite codes: another way into the house, besides the house phrase.
// Each can be used `uses` times (0 for no limit) until it expires.
function inviteCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "COZY-" + Array.from(randomBytes(5), (b) => letters[b % letters.length]).join("");
}
function inviteUsable(inv) {
  return !inv.cancelled && inv.expires > Date.now() && (!inv.uses || inv.joined.length < inv.uses);
}

const adminTools = {
  // Everything the panel shows, in one go.
  "GET /api/admin/state": async (req) => {
    requireAdmin(req);
    const now = Date.now();
    return {
      events: Object.fromEntries(EVENTS.map((id) => [id, Math.max(0, (db.events?.[id] ?? 0) - now)])),
      notices: houseNotices(),
      invites: (db.invites ?? []).slice(0, 50),
      log: (db.adminLog ?? []).slice(0, 120),
      errors: recentErrors,
      players: Object.entries(db.users)
        .filter(([, u]) => u.member)
        .map(([key, u]) => ({ name: u.name, admin: !!u.admin, online: now - (u.lastSeen ?? 0) < ONLINE_MS, crumbs: u.wallet?.crumbs ?? null, muted: (db.mutes?.[key] ?? 0) > now, kicked: (db.kicks?.[key] ?? 0) > now })),
    };
  },

  // Giving someone crumbs or a thing (with a note in their mailbox).
  "POST /api/admin/give": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const { user, key } = memberNamed(body.name);
    const w = ensureWallet(user, key);
    let what;
    if (body.crumbs !== undefined) {
      const n = amount(body.crumbs, 1, 100_000);
      w.crumbs = whole(w.crumbs + n);
      what = `${n} crumbs`;
    } else {
      const item = String(body.item ?? "");
      const n = amount(body.n ?? 1, 1, 999);
      if (Object.hasOwn(GAME.SHOP, item)) {
        if (!w.owned.includes(item)) w.owned.push(item);
        what = GAME.SHOP[item].name;
      } else if (knownItem(item)) {
        putIn(w, item, n);
        what = `${n} × ${itemLabel(item)}`;
      } else throw new Oops(400, "That's not something that can be given.");
    }
    sendLetter(user, { from: me.name, subject: `A gift: ${what}`, body: `${me.name} sent you ${what}. It's already yours.` });
    adminLog(me, "gave", user.name, what);
    await saveDb();
    return { ok: true, what };
  },

  // An order for someone's own browser: come here (x, y), get unstuck,
  // or clear their bedroom. Kicking and muting are below.
  "POST /api/admin/order": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const { user, key } = memberNamed(body.name);
    const kind = String(body.kind ?? "");
    let data = {};
    if (kind === "summon") {
      if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) throw new Oops(400, "Where to?");
      data = { x: body.x, y: body.y };
    } else if (kind === "resetRoom") {
      const room = ensureRoom(key, user);
      room.placed = [];
      room.style = "classic";
      room.privacy = "open";
      room.resetAt = Date.now(); // (their page clears its copy when it next sees the doors)
    } else if (kind !== "unstick") throw new Oops(400, "That's not an order.");
    adminLog(me, { summon: "brought over", unstick: "unstuck", resetRoom: "reset the room of" }[kind], user.name);
    await saveDb();
    return { order: signOrder(kind, user.name, data) };
  },

  // Mute someone for everyone (minutes, or 0 to unmute).
  "POST /api/admin/mute": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const { user, key } = memberNamed(body.name);
    const minutes = amount(body.minutes, 0, 24 * 60);
    db.mutes ??= {};
    if (minutes) db.mutes[key] = Date.now() + minutes * 60_000;
    else delete db.mutes[key];
    adminLog(me, minutes ? "muted" : "unmuted", user.name, minutes ? `${minutes} min` : "");
    await saveDb();
    return { ok: true };
  },

  // Sending someone out of the house: logged out everywhere, can't come
  // back for `minutes`, and everyone's browser stops showing them.
  "POST /api/admin/kick": async (req) => {
    const { user: me, key: myKey } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const { user, key } = memberNamed(body.name);
    if (key === myKey) throw new Oops(400, "That's you!");
    const minutes = amount(body.minutes ?? 10, 1, 24 * 60);
    db.kicks ??= {};
    db.kicks[key] = Date.now() + minutes * 60_000;
    for (const [k, s] of Object.entries(db.sessions)) if (s.user === key) delete db.sessions[k];
    adminLog(me, "sent out", user.name, `${minutes} min`);
    await saveDb();
    return { order: signOrder("kick", user.name, { minutes }) };
  },

  // Today's fortune cookie, the focus bonus and this week's merchant
  // limits, fresh again (for one person).
  "POST /api/admin/reset-limits": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const { user, key } = memberNamed(body.name);
    const w = ensureWallet(user, key);
    w.cookieDay = 0;
    w.lastFocus = 0;
    w.merchant = { week: 0, bought: {} };
    w.residents.done = {};
    w.residents.chatDay = {};
    w.residents.giftDay = {};
    adminLog(me, "reset daily limits for", user.name);
    await saveDb();
    return { ok: true };
  },

  // --- Invites ---
  "POST /api/admin/invites": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const uses = amount(body.uses ?? 1, 0, 50);
    const days = amount(body.days ?? 7, 1, 60);
    db.invites ??= [];
    const invite = { code: inviteCode(), by: me.name, at: Date.now(), expires: Date.now() + days * 86_400_000, uses, joined: [], cancelled: false, note: cleanText(body.note, 40) };
    db.invites.unshift(invite);
    db.invites.length = Math.min(db.invites.length, 100);
    adminLog(me, "made an invite", invite.code, `${uses || "unlimited"} use${uses === 1 ? "" : "s"}, ${days} days`);
    await saveDb();
    return { invite };
  },
  "POST /api/admin/invites/cancel": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const invite = (db.invites ?? []).find((i) => i.code === body.code);
    if (!invite) throw new Oops(404, "No invite with that code.");
    invite.cancelled = true;
    adminLog(me, "cancelled an invite", invite.code);
    await saveDb();
    return { ok: true };
  },

  // --- Events and time ---
  "POST /api/admin/event": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    if (!EVENTS.includes(body.id)) throw new Oops(400, "That's not an event.");
    const minutes = amount(body.minutes, 0, 24 * 60);
    db.events ??= {};
    db.events[body.id] = minutes ? Date.now() + minutes * 60_000 : 0;
    adminLog(me, minutes ? "started an event" : "stopped an event", body.id, minutes ? `${minutes} min` : "");
    await saveDb();
    return { ok: true };
  },
  // Every crop in the garden grows as if `hours` had passed (watered).
  "POST /api/admin/crops": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const hours = amount(body.hours, 1, 240);
    const back = hours * 3_600_000;
    for (const plot of Object.values(db.garden?.plots ?? {})) {
      plot.plantedAt -= back;
      plot.waters = plot.waters.map((t) => t - back);
    }
    if (db.garden) db.garden.version++;
    adminLog(me, "fast-forwarded the garden", "", `${hours} h`);
    await saveDb();
    return { ok: true };
  },

  // --- The server ---
  "POST /api/admin/backup": async (req) => {
    const { user: me } = requireAdmin(req);
    await saveDb();
    await backup();
    adminLog(me, "made a backup");
    return { ok: true, folder: `daily-${new Date().toISOString().slice(0, 10)}` };
  },
  "POST /api/admin/announce": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    const text = cleanText(body.text, 200);
    const minutes = amount(body.minutes ?? 30, 0, 24 * 60);
    db.announcement = text && minutes ? { id: newId(), text, by: me.name, until: Date.now() + minutes * 60_000 } : null;
    adminLog(me, text && minutes ? "announced" : "cleared the announcement", "", text);
    await saveDb();
    return { ok: true };
  },
  "POST /api/admin/maintenance": async (req) => {
    const { user: me } = requireAdmin(req);
    const body = await readJson(req, 2_000);
    db.maintenance = { on: body.on === true, message: cleanText(body.message, 160) };
    adminLog(me, db.maintenance.on ? "closed the house for maintenance" : "opened the house again", "", db.maintenance.message);
    await saveDb();
    return { ok: true };
  },
};

// What pages send when something goes wrong on them (for the Server tab).
const errorRoute = {
  "POST /api/errors": async (req) => {
    const { user, key } = currentUser(req);
    if (!allowed("errors:" + key, 30)) return { ok: true };
    const body = await readJson(req, 4_000);
    noteError(`page ${cleanText(body.build, 12)}`, `${cleanText(body.message, 200)} (${cleanText(body.where, 80)})`, user.name);
    return { ok: true };
  },
};

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
    const kickedFor = Math.ceil(((db.kicks?.[key] ?? 0) - Date.now()) / 60_000);
    if (kickedFor > 0) throw new Oops(403, `An admin sent you out of the house for a little while. Try again in ${kickedFor} minute${kickedFor === 1 ? "" : "s"}.`);
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
    // The house phrase, or an invite code from an admin.
    const code = String(body.phrase ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const invite = (db.invites ?? []).find((i) => i.code === code && inviteUsable(i));
    if (!invite && !sameText(normalizePhrase(body.phrase ?? ""), normalizePhrase(env.HOUSE_PHRASE))) throw new Oops(403, "That's not the house phrase (or an invite code). Check with a friend.");
    if (invite && !user.member) invite.joined.push(user.name);
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

  // --- The bank: your crumbs and everything you own ---
  "GET /api/bank": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const w = ensureWallet(user, key);
    const ev = [];
    checkTiers(w, ev); // (tiers already reached when the bank started are paid out here)
    await saveDb();
    return { wallet: publicWallet(w), events: ev };
  },

  "POST /api/bank": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("bank:" + key, 900)) throw new Oops(429, "That's a lot of shopping! Please wait a few minutes.");
    const body = await readJson(req, 4_000);
    const action = String(body.action ?? "");
    if (!Object.hasOwn(BANK, action)) throw new Oops(400, "The bank doesn't know how to do that.");
    if (action.startsWith("admin") && !user.admin) throw new Oops(403, "Admins only.");
    if (action === "achieve" && !allowed("achieve:" + key, 60)) throw new Oops(429, "Lots of achievements! Please wait a few minutes.");
    const w = ensureWallet(user, key);
    const ev = [];
    const result = BANK[action](w, body, ev, { user, key });
    if (action.startsWith("admin")) adminLog(user, "used a tool on themselves", "", action);
    checkTiers(w, ev);
    await saveDb();
    return { wallet: publicWallet(w), events: ev, result };
  },

  // The Arcade's high score boards (Update 9): the top ten for each cabinet.
  "GET /api/arcade/scores": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return { boards: db.arcadeScores ?? {} };
  },

  // --- Library books written by friends (Update 7) ---
  // Everyone in the house can read them; anyone can write one (a few
  // limits keep it tidy); the author (or an admin) can take it back.
  "GET /api/books": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    // (?titles=1: just the titles and authors, for the TV's news.)
    if (new URL(req.url, "http://x").searchParams.get("titles")) return { books: (db.books ?? []).map(({ text, ...rest }) => rest) };
    return { books: db.books ?? [] };
  },
  "POST /api/books": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("book:" + key, 10)) throw new Oops(429, "That's a lot of writing! Please wait a few minutes.");
    const body = await readJson(req, 40_000);
    // (Strips invisible control characters, keeping line breaks and tabs.)
    // eslint-disable-next-line no-control-regex
    const clean = (v, most) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, most);
    const title = clean(body.title, 60), text = clean(body.text, GAME.CONFIG.extras.bookLength);
    const kind = ["story", "guide", "lore", "poem", "diary"].includes(body.kind) ? body.kind : "story";
    if (!title || !text) throw new Oops(400, "A book needs a title and some words.");
    db.books ??= [];
    if (db.books.filter((b) => b.by === key).length >= GAME.CONFIG.extras.booksEach) throw new Oops(409, `You have ${GAME.CONFIG.extras.booksEach} books on the shelves already. Take one back to make room.`);
    if (db.books.length >= 300) throw new Oops(409, "The Library's shelves are full.");
    const book = { id: newId(), title, kind, text, author: user.name, by: key, at: Date.now() };
    db.books.push(book);
    const w = ensureWallet(user, key);
    const ev = [];
    grant(w, "author", ev);
    checkTiers(w, ev);
    await saveDb();
    return { book, wallet: publicWallet(w), events: ev };
  },
  "POST /api/books/remove": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const body = await readJson(req, 2_000);
    const book = (db.books ?? []).find((b) => b.id === body.id);
    if (!book) throw new Oops(404, "That book isn't on the shelves.");
    if (book.by !== key && !user.admin) throw new Oops(403, "Only its author can take a book back.");
    db.books = db.books.filter((b) => b !== book);
    if (book.by !== key) adminLog(user, "took a book off the Library shelves", book.author, book.title);
    await saveDb();
    return {};
  },

  // The biggest of each fish anyone in the house has caught.
  "GET /api/fish-records": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return { records: db.fishRecords ?? {} };
  },

  // --- The trading post's stall, and whether the merchant's here (Update 5) ---
  "GET /api/market": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    const before = db.market?.listings.length ?? 0;
    const market = marketState();
    if (market.listings.length !== before) await saveDb(); // (some went home)
    const { here, week, stock } = merchantState();
    // (Offers for one friend only show to them, and to whoever made them.)
    const visible = market.listings.filter((l) => !l.for || l.for === key || l.seller === key);
    return { listings: visible.map(({ seller, for: forKey, ...l }) => ({ ...l, forMe: forKey === key })), mine: visible.filter((l) => l.seller === key).map((l) => l.id), merchant: { here, week, stock } };
  },

  // --- The shared garden (Update 4) ---
  // db.garden.plots: bed number -> { owner (their name), color, crop,
  // plantedAt, waters: [times], wateredBy }. How fast crops grow is worked
  // out by each page from those times (the crop list is in config.js), so
  // the server only keeps who planted what, when, and when it was watered.
  "GET /api/garden": async (req) => {
    const { user } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    return gardenState();
  },

  "POST /api/garden": async (req) => {
    const { user, key } = currentUser(req);
    if (!user.member) throw new Oops(403, "Enter the house phrase first.");
    if (!allowed("garden:" + key, 600)) throw new Oops(429, "Lots of gardening! Please wait a few minutes.");
    const body = await readJson(req, 2_000);
    // (A page from before the bank, with no wallet yet, gardens the old way.)
    const w = user.wallet ? fillWallet(user.wallet) : null;
    const ev = [];
    const result = applyGarden(body, user, w, ev);
    if (w) checkTiers(w, ev);
    db.garden.version++;
    await saveDb();
    return { ...gardenState(), result, ...(w ? { wallet: publicWallet(w), events: ev } : {}) };
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
    return { doors, house: houseNotices() };
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
    const body = await readJson(req, 80_000); // (room for pixel art on every piece)
    const room = ensureRoom(key, user);
    if (!Array.isArray(body.placed) || !ROOM_SIZES.includes(body.size)) throw new Oops(400, "That doesn't look like a room.");
    const placed = body.placed.slice(0, 80).map(cleanPiece).filter(Boolean);
    const w = user.wallet;
    if (!w) {
      // (A page from before the bank: the old way.)
      room.placed = placed;
      room.size = body.size;
      await saveDb();
      return { ok: true };
    }
    const ev = [];
    room.placed = checkPlaced(w, room.placed, placed, ev);
    room.size = w.home.size;
    checkTiers(w, ev);
    await saveDb();
    return { ok: true, wallet: publicWallet(w), events: ev };
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
    // Achievements, counters and what they own: from the bank (or, for
    // someone who hasn't been in since the bank opened, their old save).
    const progress = user.wallet ?? saved("cozy-house-achievements") ?? {};
    const owned = user.wallet?.owned ?? saved("cozy-house-crumbs")?.owned;
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
      title: text(look.title, 30),
      lofi: text(saved("cozy-house-lofi"), 30), // their Study station (turntable.js)
      achievements: Object.keys(progress.unlocked ?? {}).slice(0, 200),
      seconds: Number.isFinite(progress.stats?.seconds) ? progress.stats.seconds : 0,
      // Seconds spent in each room, for room levels ("room_study": 5400).
      // Tiered achievements: how many tiers of each ("homebody": 3).
      tiers: Object.fromEntries(Object.entries(progress.tiers ?? {}).filter(([k, v]) => /^[a-zA-Z]{1,30}$/.test(k) && Number.isInteger(v) && v > 0 && v <= 20).slice(0, 50)),
      rooms: Object.fromEntries(Object.entries(progress.stats ?? {}).filter(([k, v]) => /^room_[a-z]{1,20}$/.test(k) && Number.isFinite(v)).slice(0, 30)),
      // The achievements they pinned to show off (up to 5).
      pinned: (Array.isArray(saved("cozy-house-achievements")?.pinned) ? saved("cozy-house-achievements").pinned : []).filter((id) => typeof id === "string" && /^[a-zA-Z]{1,30}$/.test(id)).slice(0, 5),
      // The counters their tiers are counted in, for "progress to the next tier".
      stats: Object.fromEntries(
        ["seconds", "sleepSeconds", "chats", "focusSessions", "crumbsEarned", "emotesUsed", "dances", "daysVisited", "harvests", "friendsWatered", "fishCaught", "dishesCooked"]
          .filter((k) => Number.isFinite(progress.stats?.[k]))
          .map((k) => [k, progress.stats[k]])
      ),
      // What they own from the raccoons (the page counts items and pets from it).
      owned: (Array.isArray(owned) ? owned : []).filter((id) => typeof id === "string" && /^[a-zA-Z0-9]{1,30}$/.test(id)).slice(0, 300),
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
    // (Crumbs, the basket and fishing live in the bank now: pages don't
    // keep them, so they aren't sent back. Otherwise the page's copy never
    // matches and it keeps reloading to catch up.)
    if (!user.save) return { save: null };
    const data = { ...user.save.data };
    for (const k of BANK_KEYS) delete data[k];
    return { save: { ...user.save, data } };
  },

  "PUT /api/save": async (req) => {
    const { user, key } = currentUser(req);
    if (!allowed("save:" + key, 200)) throw new Oops(429, "Saving a lot! Please wait a few minutes.");
    const body = await readJson(req, MAX_SAVE_BYTES);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new Oops(400, "That save doesn't look right.");
    // `base` is the save this one was built on (its updatedAt). If a newer
    // save has come in since (from another computer), this one would undo
    // it, so it's refused and the page stops saving and says why.
    if (Number.isFinite(body.base) && user.save && user.save.updatedAt > body.base) throw new Oops(409, "Your account saved newer progress somewhere else.");
    // Once the bank has someone's wallet, crumbs, the basket and fishing
    // live there, not in the save (a page from before the bank still
    // sends them; they're dropped). Before that, the old checks apply.
    if (user.wallet) for (const k of BANK_KEYS) delete body.data[k];
    else if (user.save) {
      // (A page from after the bank doesn't send them: the last ones are
      // kept, so the bank can start from them.)
      for (const k of BANK_KEYS) if (!Object.hasOwn(body.data, k) && Object.hasOwn(user.save.data ?? {}, k)) body.data[k] = user.save.data[k];
      if (!user.admin) keepSaveBelievable(user.save, body.data);
    }
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

Object.assign(routes, adminTools, errorRoute);

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
  // Only on the automated tests' throwaway server (TEST_SEED=1, set by
  // tests/house-server.mjs), never the real one: sets up the test account
  // with things already in it ({ name, wallet: { crumbs, basket: {...},
  // fishing: { lesson }... } }). Each part given replaces what they had
  // (a basket given is their whole basket), except fishing, which is
  // merged (so setting the lesson keeps their rods).
  ...(env.TEST_SEED === "1" && {
    "POST /admin/test-seed": async (req) => {
      const body = await readJson(req, 100_000);
      const key = String(body.name ?? "").trim().toLowerCase();
      if (!db.users[key]) throw new Oops(404, "No account with that name.");
      const w = ensureWallet(db.users[key], key);
      for (const [k, v] of Object.entries(body.wallet ?? {})) w[k] = k === "fishing" ? { ...w.fishing, ...v } : v;
      await saveDb();
      return { wallet: w };
    },
    // (Also test-only: night or day, and the hometown's clock, so the
    // night's things can be tested at any hour. { night, offset }.)
    "POST /admin/test-sky": async (req) => {
      const body = await readJson(req, 1_000);
      if (typeof body.night === "boolean" || body.night === null) sky.night = body.night;
      if (Number.isFinite(body.offset)) sky.offset = body.offset;
      return { sky };
    },
  }),
};

const MAINTENANCE_OPEN = new Set(["GET /api/health", "GET /api/badge-key", "POST /api/login", "GET /api/me", "POST /api/logout", "GET /api/rooms", "POST /api/errors"]);

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
    // While the house is closed for maintenance, only admins get in (the
    // doors still answer, so everyone inside sees the notice).
    if (db.maintenance?.on && !MAINTENANCE_OPEN.has(routeKey)) {
      let admin = false;
      try {
        admin = currentUser(req).user.admin === true;
      } catch {
        // (not logged in)
      }
      if (!admin) throw new Oops(503, db.maintenance.message || "The house is closed for a little while. Try again soon!");
    }
    send(res, 200, await handler(req, ip), cors);
  } catch (err) {
    if (!(err instanceof Oops)) {
      console.error(err);
      noteError("server", err.message);
    }
    send(res, err.status || 500, { error: err instanceof Oops ? err.message : "Something went wrong on the server." }, cors);
  }
});

await loadDb();
await loadBadgeKey();
await loadGame();
checkSky();
setInterval(checkSky, 15 * 60_000).unref();
await backup();
setInterval(backup, 24 * 3600_000).unref();
server.listen(PORT, "127.0.0.1", () => console.log(`Cozy House server listening on 127.0.0.1:${PORT}`));
