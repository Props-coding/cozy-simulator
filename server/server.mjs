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
import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHash, createHmac } from "node:crypto";
import { readFile, writeFile, rename, mkdir, readdir, unlink, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

// --- Settings (from the environment file) ---
const env = process.env;
const PORT = Number(env.PORT || 3000);
const DATA_DIR = env.DATA_DIR || "/var/lib/cozy-server";
const DB_FILE = join(DATA_DIR, "db.json");
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
const TURN_HOST = env.TURN_HOST || "api.thecozy.world";

// --- The data file ---
// users: lowercase name -> { name, salt, hash, createdAt, member, save, reset }
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
  return { user, key: session.user, tokenHash: sha256(token) };
}

const publicUser = (u) => ({ name: u.name, member: !!u.member });

// Used for unknown names, so a wrong name takes as long as a wrong password.
const DUMMY_SALT = randomBytes(16).toString("hex");

const routes = {
  "GET /api/health": async () => ({ ok: true }),

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
  "POST /admin/remove": async (req) => {
    const body = await readJson(req, 10_000);
    const key = String(body.name ?? "").trim().toLowerCase();
    if (!db.users[key]) throw new Oops(404, "No account with that name.");
    const name = db.users[key].name;
    delete db.users[key];
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
await backup();
setInterval(backup, 24 * 3600_000).unref();
server.listen(PORT, "127.0.0.1", () => console.log(`Cozy House server listening on 127.0.0.1:${PORT}`));
