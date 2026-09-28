// The admin panel (🛠️ in the header), only for accounts the house owner
// has made admins (sudo cozy-admin admin NAME).
//
// Six tabs, and a search box that finds any tool:
// - Me: crumbs, unlocking things, achievements, jumping to any room, and
//   "View as player" (hides all this; Ctrl+Shift+A brings it back).
// - Players: everyone in the house. Pick someone to give them crumbs or a
//   thing, go to them, bring them over, unstick them, mute them, reset
//   their daily limits or bedroom, send them out for a while, or make a
//   password reset code. Invite codes (another way in, besides the phrase).
// - World: try out a season, weather or time of day (only you see it: a
//   banner over the house says so, with "Back to real"), and the garden.
// - Events: start the traveling merchant's visit (and, with Update 8, the
//   full moon) for everyone.
// - Server: a backup now, an announcement to everyone, maintenance mode,
//   recent problems, and the admin log (who changed what, and when).
// - Debug: outlines over the house (seat spots, collision boxes, rooms).
//
// Every tool asks the house server, which checks that you really are an
// admin, and anything that touches someone else goes in the admin log.
// Things that can't be undone are red, and ask first.
import { serverApi, isAdmin, accountName, viewingAsPlayer, setViewAsPlayer } from "./account.js";
import { bank } from "./bank.js";
import { unlockAllQuietly, resetAchievements } from "./achievements.js";
import { grantAllDecor, grantRoomy } from "./home.js";
import { playClickSound, playCrumbSound } from "./audio.js";
import { previewSky, previewTime, previewing } from "./weather.js";
import { ripenGardenPreview } from "./garden.js";
import { addFishingXp } from "./fishing.js";
import { refreshMarket } from "./market.js";
import { itemInfo } from "./basket.js";

const button = document.getElementById("admin-button");
const panel = document.getElementById("admin-panel");
const status = document.getElementById("admin-status");
const body = document.getElementById("admin-body");
const tabsRow = document.getElementById("admin-tabs");
const search = document.getElementById("admin-search");

// main.js tells us how to move you, which rooms there are, how to refresh
// the Join screen's outfit lists, how to ask "are you sure?", where you
// are, how to go to a friend, and how to send an admin order.
let hooks = { teleport: () => false, rooms: () => [], refreshLook: () => {}, confirm: async () => false, here: () => ({}), goTo: () => false, sendOrder: () => {}, notice: () => {} };

// Called once you've joined: shows the 🛠️ button if you're an admin.
export function initAdmin(options) {
  hooks = { ...hooks, ...options };
  button.hidden = !isAdmin() || viewingAsPlayer();
}

export function isAdminOpen() {
  return !panel.hidden;
}

const TABS = [
  ["me", "Me"],
  ["players", "Players"],
  ["world", "World"],
  ["events", "Events"],
  ["server", "Server"],
  ["debug", "Debug"],
];
let tab = "me";
let state = null; // from the server: players, invites, events, notices, log, errors
let picked = null; // the friend picked on the Players tab

function setOpen(open) {
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) {
    render();
    loadState();
  }
}

async function loadState() {
  try {
    state = await serverApi("GET", "/api/admin/state");
  } catch (err) {
    say(err.message);
  }
  if (!panel.hidden) render();
}

button.addEventListener("click", () => {
  setOpen(panel.hidden);
  button.blur();
  playClickSound();
});
const confirmOpen = () => !document.getElementById("confirm-dialog").hidden;
document.addEventListener("click", (e) => {
  // (Clicks in the "are you sure?" box don't count as clicking away.)
  // (Nor do clicks on something the panel just redrew away, like a picked chip.)
  if (!e.target.isConnected) return;
  if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target) && !confirmOpen() && !e.target.closest?.("#confirm-dialog")) setOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) setOpen(false);
  // Ctrl+Shift+A: back from "View as player".
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a" && isAdmin()) {
    e.preventDefault();
    setViewAsPlayer(!viewingAsPlayer());
    button.hidden = viewingAsPlayer();
    if (viewingAsPlayer()) setOpen(false);
  }
});

function say(text) {
  status.textContent = text;
}

// --- Building blocks ---
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A button. `danger` ones are red; `confirm` asks first ({ title, text, yes }).
function btn(text, run, { danger, confirm, disabled, title, warm } = {}) {
  const b = make("button", danger ? "danger-button" : warm ? "warm-button" : "soft-button", text);
  b.type = "button";
  b.disabled = !!disabled;
  if (title) b.title = title;
  b.addEventListener("click", async () => {
    b.blur();
    if (confirm && !(await hooks.confirm({ no: "Cancel", ...confirm }))) return;
    playClickSound();
    try {
      const message = await run();
      if (message) say(message);
    } catch (err) {
      say(err.message);
    }
  });
  return b;
}

// A row of choices, one picked: [[value, label], ...].
function seg(choices, current, pick) {
  const box = make("div", "admin-seg");
  for (const [value, label] of choices) {
    const b = make("button", "", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(value === current));
    b.addEventListener("click", () => {
      playClickSound();
      pick(value);
      render();
    });
    box.appendChild(b);
  }
  return box;
}

function numberBox(value, min, max) {
  const input = make("input");
  input.type = "number";
  input.min = min;
  input.max = max;
  input.value = value;
  return input;
}

function textBox(placeholder, max = 160) {
  const input = make("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.maxLength = max;
  return input;
}

function selectBox(options) {
  const select = make("select");
  for (const [value, label] of options) select.add(new Option(label, value));
  return select;
}

// One tool: a label (and maybe a small note under it), then its controls.
function row(label, controls, note) {
  const r = make("div", "admin-row");
  const l = make("span", "admin-label", label);
  if (note) l.appendChild(make("small", "", note));
  const c = make("div", "admin-controls");
  c.append(...controls.filter(Boolean));
  r.append(l, c);
  r.dataset.search = `${label} ${note ?? ""} ${c.textContent}`.toLowerCase();
  return r;
}

const section = (title) => make("div", "admin-section", title);
const noteText = (text) => make("span", "admin-note", text);
const when = (at) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const minutesLeft = (ms) => (ms > 0 ? `${Math.ceil(ms / 60_000)} min left` : "off");

async function admin(path, payload) {
  const r = await serverApi("POST", path, payload);
  loadState();
  return r;
}

// --- Me ---
function meTab() {
  const add = numberBox(250, 1, 100000);
  const rooms = hooks.rooms();
  const byFloor = new Map();
  for (const room of rooms) {
    const floor = floorOf(room.rect.y);
    if (!byFloor.has(floor)) byFloor.set(floor, []);
    byFloor.get(floor).push(room);
  }
  const picker = make("div");
  for (const [floor, list] of [...byFloor].sort(([a], [b]) => a - b)) {
    picker.appendChild(make("div", "admin-floor", floor === FARM_FLOOR ? "The Farm" : floor === ALLEY_FLOOR ? "Back Alley" : floor === LAKE_FLOOR ? "Willow Lake" : floor === YARD_FLOOR ? "Outside" : CONFIG.floors[floor]?.name ?? `Floor ${floor + 1}`));
    const chips = make("div", "admin-chips");
    for (const room of list) {
      const chip = make("button", "admin-chip", room.name);
      chip.type = "button";
      chip.addEventListener("click", () => {
        playClickSound();
        say(hooks.teleport(room.id) ? `Jumped to ${room.name}.` : `Couldn't find a free spot in ${room.name}.`);
      });
      chips.appendChild(chip);
    }
    picker.appendChild(chips);
  }
  return [
    section("Crumbs"),
    row("Crumbs", [
      btn("+100", () => (bank("adminCrumbs", { n: 100 }), "Added 100 crumbs.")),
      btn("+1,000", () => (bank("adminCrumbs", { n: 1000 }), "Added 1,000 crumbs.")),
      add,
      btn("Add", () => {
        const n = Math.floor(Number(add.value));
        if (!(n > 0)) return "Type how many crumbs.";
        bank("adminCrumbs", { n });
        return `Added ${n.toLocaleString()} crumbs.`;
      }),
      btn("Set to 0", () => (bank("adminSetCrumbs", { n: 0 }), "Crumbs set to 0."), { danger: true, confirm: { title: "Set your crumbs to 0?", text: "Your crumbs go to zero. There's no undo (but +1,000 is right there).", yes: "Set to 0" } }),
    ]),
    section("Unlock"),
    row("Things", [
      btn("Hats, shoes & pets", async () => (await bank("adminAllItems"), hooks.refreshLook(), "You own everything the raccoons sell.")),
      btn("Nest & Nook items", () => (grantAllDecor(), "You own one of every Nest & Nook item.")),
      btn("Roomy bedroom", () => (grantRoomy(), "Your bedroom is Roomy now.")),
      btn("Every recipe", () => (bank("adminRecipes"), "Every recipe is in your book.")),
    ]),
    row("Basket", [btn("Fill my basket", () => (bank("adminStock"), playCrumbSound(), "At least 5 of everything is in your basket.")), btn("+200 fishing XP", () => (addFishingXp(200), "+200 fishing XP.")), btn("Redo Otis's lesson", () => (bank("adminLesson"), "Otis is back at the pond with a lesson for you. (Your rods and fish log stay.)")), btn("Redo Hazel's lesson", () => (bank("adminGardenLesson"), "Hazel is back at her yard stand with a lesson for you. (Your seeds and crops stay.)"))]),
    row("Achievements", [
      btn("Unlock all", () => (unlockAllQuietly(), "Every achievement unlocked (quietly: no pop-ups or crumbs).")),
      btn("Reset all", () => (resetAchievements(), "Achievements and their counters reset."), { danger: true, confirm: { title: "Reset all your achievements?", text: "Every achievement, tier and counter (hours, chats, fish...) goes back to nothing. There's no undo.", yes: "Reset all" } }),
    ]),
    row("Resident hearts", [
      btn("+1 heart each", () => (bank("adminHearts"), "One more heart with Clover and Mortimer.")),
      btn("Back to none", () => (bank("adminHearts", { reset: true }), "Friendship with the residents is back to nothing."), { danger: true, confirm: { title: "Reset your friendship with the residents?", text: "Your hearts with Clover and Mortimer go back to none. Recipes you learned and achievements stay.", yes: "Reset" } }),
    ]),
    row("Daily limits", [btn("Reset mine", async () => (await admin("/api/admin/reset-limits", { name: accountName() }), "Today's fortune cookie, the focus bonus, this week's merchant limits and today's resident requests are fresh again."))], "fortune cookie, focus bonus, merchant, residents' requests"),
    section("Go"),
    row("Jump to", [picker]),
    section("You"),
    row("View as player", [
      btn("Hide admin tools", () => {
        setViewAsPlayer(true);
        button.hidden = true;
        setOpen(false);
      }),
      noteText("Hides this panel and your badge. Ctrl+Shift+A brings them back."),
    ]),
  ];
}

// --- Players ---
// Every basket thing and raccoon item, for "Give a thing".
function giftables() {
  const ids = [
    ...CONFIG.crops.flatMap((c) => [`seed:${c.id}`, `crop:${c.id}`]),
    ...CONFIG.fish.map((f) => `fish:${f.id}`),
    ...CONFIG.bait.filter((b) => b.price).map((b) => `bait:${b.id}`),
    ...CONFIG.kitchen.pantry.map((f) => `food:${f.id}`),
    ...CONFIG.kitchen.recipes.map((r) => `dish:${r.id}`),
  ].map((id) => [id, itemInfo(id).name]);
  const shop = SHOP_CATALOG.map((i) => [i.id, i.name]);
  return [...ids.sort((a, b) => a[1].localeCompare(b[1])), ...shop];
}

function playersTab() {
  if (!state) return [noteText("Loading...")];
  const me = (accountName() ?? "").toLowerCase();
  const chips = make("div", "admin-chips");
  for (const p of [...state.players].sort((a, b) => b.online - a.online || a.name.localeCompare(b.name))) {
    const chip = make("button", "admin-chip" + (picked === p.name ? " picked" : ""));
    chip.type = "button";
    chip.append(make("span", "dot" + (p.online ? " on" : "")), `${p.name}${p.admin ? " (admin)" : ""}${p.muted ? " (muted)" : ""}${p.kicked ? " (sent out)" : ""}`);
    chip.title = p.online ? "In the house now" : "Away";
    chip.addEventListener("click", () => {
      playClickSound();
      picked = picked === p.name ? null : p.name;
      render();
    });
    chips.appendChild(chip);
  }
  const out = [section("Everyone"), row("Pick someone", [chips], "green dot: here now")];
  const p = state.players.find((x) => x.name === picked);
  if (p) {
    const isMe = p.name.toLowerCase() === me;
    const crumbs = numberBox(100, 1, 100000);
    const thing = selectBox(giftables());
    const count = numberBox(1, 1, 999);
    const muteFor = selectBox([["10", "10 min"], ["30", "30 min"], ["60", "1 hour"], ["1440", "a day"]]);
    const outFor = selectBox([["10", "10 min"], ["60", "1 hour"], ["1440", "a day"]]);
    const here = hooks.here();
    const order = async (kind, extra = {}) => {
      const { order } = await admin("/api/admin/order", { kind, name: p.name, ...extra });
      hooks.sendOrder(order);
    };
    out.push(
      section(`${p.name}${p.crumbs !== null ? ` · ${p.crumbs.toLocaleString()} crumbs` : ""}`),
      row("Give crumbs", [crumbs, btn("Give", async () => (await admin("/api/admin/give", { name: p.name, crumbs: Math.floor(Number(crumbs.value)) })).what + ` sent to ${p.name}.`)]),
      row("Give a thing", [thing, count, btn("Give", async () => (await admin("/api/admin/give", { name: p.name, item: thing.value, n: Math.floor(Number(count.value)) })).what + ` sent to ${p.name}.`)]),
      row(
        "Where",
        [
          btn("Go to", () => (hooks.goTo(p.name) ? `Went to ${p.name}.` : `Couldn't get to ${p.name} (are they in the house?).`), { disabled: isMe || !p.online }),
          btn("Bring here", async () => (await order("summon", { x: here.x, y: here.y }), `Asked ${p.name}'s page to bring them over.`), { disabled: isMe || !p.online || here.inBedroom, title: here.inBedroom ? "Not from inside a bedroom" : "" }),
          btn("Unstick", async () => (await order("unstick"), `${p.name} goes back to the hallway.`), { disabled: !p.online }),
        ],
        p.online ? "in the house now" : "away right now"
      ),
      row("Voice", p.muted ? [btn("Unmute", async () => (await admin("/api/admin/mute", { name: p.name, minutes: 0 }), `${p.name} can talk again.`))] : [muteFor, btn("Mute", async () => (await admin("/api/admin/mute", { name: p.name, minutes: Number(muteFor.value) }), `${p.name} is muted for everyone.`), { disabled: isMe })]),
      row("Daily limits", [btn("Reset", async () => (await admin("/api/admin/reset-limits", { name: p.name }), `${p.name}'s daily limits are fresh again.`))], "fortune cookie, focus bonus, merchant, residents' requests"),
      row("Password", [
        btn("Reset code", async () => {
          const r = await serverApi("POST", "/api/admin/reset", { name: p.name });
          return `Reset code for ${r.name}: ${r.code} (works once, for ${r.hours} hours). Send it to them privately.`;
        }),
      ]),
      row("Careful", [
        btn("Reset room", async () => (await order("resetRoom"), `${p.name}'s bedroom is back to its starter pieces.`), { danger: true, confirm: { title: `Reset ${p.name}'s bedroom?`, text: `Everything placed in ${p.name}'s bedroom is packed away (they still own it all) and the room goes back to Classic and Open.`, yes: "Reset room" } }),
        outFor,
        btn("Send out", async () => {
          const { order: o } = await admin("/api/admin/kick", { name: p.name, minutes: Number(outFor.value) });
          hooks.sendOrder(o);
          return `${p.name} was sent out of the house.`;
        }, { danger: true, disabled: isMe, confirm: { title: `Send ${p.name} out of the house?`, text: `${p.name} is logged out and can't come back until the time's up. Everyone stops seeing and hearing them.`, yes: "Send out" } }),
      ])
    );
  }
  // Invites.
  const uses = selectBox([["1", "1 use"], ["5", "5 uses"], ["0", "no limit"]]);
  const days = selectBox([["1", "1 day"], ["7", "7 days"], ["30", "30 days"]]);
  days.value = "7";
  const inviteNote = textBox("Who's it for? (optional)", 40);
  out.push(
    section("Invites"),
    row("New invite", [uses, days, inviteNote, btn("Make invite", async () => {
      const { invite } = await admin("/api/admin/invites", { uses: Number(uses.value), days: Number(days.value), note: inviteNote.value });
      navigator.clipboard?.writeText(invite.code).catch(() => {});
      return `New invite: ${invite.code} (copied). A friend types it where the house phrase goes.`;
    }, { warm: true })], "instead of the phrase")
  );
  const list = make("ul", "admin-list");
  for (const inv of state.invites) {
    const li = make("li");
    const open = !inv.cancelled && inv.expires > Date.now() && (!inv.uses || inv.joined.length < inv.uses);
    const what = make("span", "what");
    what.append(make("code", "", inv.code), ` ${inv.note ? `for ${inv.note} · ` : ""}${inv.cancelled ? "cancelled" : !open ? "used up or expired" : `${inv.uses ? `${inv.uses - inv.joined.length} of ${inv.uses} left` : "no limit"}, until ${when(inv.expires)}`}${inv.joined.length ? ` · joined: ${inv.joined.join(", ")}` : ""}`);
    li.append(make("span", "when", when(inv.at)), what);
    if (open) li.appendChild(btn("Cancel", async () => (await admin("/api/admin/invites/cancel", { code: inv.code }), `Invite ${inv.code} cancelled.`), { danger: true, confirm: { title: `Cancel invite ${inv.code}?`, text: "Nobody else can use it to get in. (Anyone who already joined stays.)", yes: "Cancel it" } }));
    list.appendChild(li);
  }
  if (!state.invites.length) list.appendChild(make("li", "", "No invites yet."));
  out.push(row("Made so far", [list]));
  return out;
}

// --- World ---
function worldTab() {
  const now = previewing();
  const hours = selectBox([["1", "1 hour"], ["6", "6 hours"], ["24", "a day"]]);
  return [
    section("Try out (only you see it)"),
    row("Season", [seg([[null, "Real"], ["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"]], seasonPreview, (v) => (previewSeason(v), showBanner()))]),
    row("Weather", [seg([[null, "Real"], ["clear", "Sun"], ["cloudy", "Clouds"], ["fog", "Fog"], ["rain", "Rain"], ["storm", "Storm"], ["snow", "Snow"]], now.sky, (v) => (previewSky(v), showBanner()))]),
    row("Time of day", [seg([[null, "Real"], ["day", "Day"], ["dusk", "Dusk"], ["night", "Night"]], now.time, (v) => (previewTime(v), showBanner()))]),
    section("Garden"),
    row("My beds", [btn("Ripen mine", () => (bank("adminRipen"), ripenGardenPreview(), "Your own beds are ripe now."))]),
    row("Everyone's", [hours, btn("Fast-forward", async () => (await admin("/api/admin/crops", { hours: Number(hours.value) }), `Every crop in the garden grew ${hours.selectedOptions[0].text}.`))], "for everyone"),
  ];
}

// --- Events ---
const EVENT_INFO = [
  { id: "merchant", name: "Juniper's visit", note: "the traveling merchant, by the bus stop", after: () => refreshMarket() },
  { id: "fullMoon", name: "Full moon", note: "what happens on full moons comes with Update 8" },
];
function eventsTab() {
  if (!state) return [noteText("Loading...")];
  return [
    section("For everyone"),
    ...EVENT_INFO.map((ev) =>
      row(
        ev.name,
        [
          noteText(minutesLeft(state.events[ev.id])),
          btn("1 hour", async () => (await admin("/api/admin/event", { id: ev.id, minutes: 60 }), ev.after?.(), `${ev.name}: on for an hour, for everyone.`)),
          btn("Stop", async () => (await admin("/api/admin/event", { id: ev.id, minutes: 0 }), ev.after?.(), `${ev.name}: stopped.`), { disabled: !(state.events[ev.id] > 0) }),
        ],
        ev.note
      )
    ),
  ];
}

// --- Server ---
function serverTab() {
  if (!state) return [noteText("Loading...")];
  const text = textBox("Say something to everyone...", 200);
  const lasts = selectBox([["10", "10 min"], ["30", "30 min"], ["60", "1 hour"]]);
  lasts.value = "30";
  const closing = textBox("Why? (they'll see this)", 160);
  const errors = make("ul", "admin-list");
  for (const e of state.errors) {
    const li = make("li");
    li.append(make("span", "when", when(e.at)), make("span", "what", `${e.where}${e.who ? ` (${e.who})` : ""}: ${e.message}`));
    errors.appendChild(li);
  }
  if (!state.errors.length) errors.appendChild(make("li", "", "No problems since the server last started."));
  const log = make("ul", "admin-list");
  for (const l of state.log) {
    const li = make("li");
    li.append(make("span", "when", when(l.at)), make("span", "what", `${l.by} ${l.action}${l.target ? ` ${l.target}` : ""}${l.detail ? ` (${l.detail})` : ""}`));
    log.appendChild(li);
  }
  if (!state.log.length) log.appendChild(make("li", "", "Nothing yet."));
  const m = state.notices.maintenance;
  return [
    section("Server"),
    row("Backup", [btn("Back up now", async () => `Backed up (in ${(await admin("/api/admin/backup")).folder} on the server).`)]),
    row("Announce", [text, lasts, btn("Send", async () => (text.value.trim() ? (await admin("/api/admin/announce", { text: text.value, minutes: Number(lasts.value) }), "Sent. Everyone sees it within 20 seconds.") : "Type something first."), { warm: true }), state.notices.announcement && btn("Clear", async () => (await admin("/api/admin/announce", { text: "", minutes: 0 }), "Announcement cleared."))], "shows in chat and over the house"),
    row(
      "Maintenance",
      m
        ? [noteText(`Closed: "${m}"`), btn("Open the house", async () => (await admin("/api/admin/maintenance", { on: false }), "The house is open again."), { warm: true })]
        : [closing, btn("Close the house", async () => (await admin("/api/admin/maintenance", { on: true, message: closing.value || "The house is closed for a little while. Back soon!" }), "The house is closed: only admins can get in, and shopping and saving are paused."), { danger: true, confirm: { title: "Close the house?", text: "Nobody but admins can log in, buy, sell or save until you open it again. Friends inside see a notice.", yes: "Close the house" } })],
      m ? "only admins can get in" : "for updates and fixes"
    ),
    section("Recent problems"),
    row("Errors", [errors], "server and pages"),
    section("Admin log"),
    row("Who did what", [log]),
  ];
}

// --- Debug ---
function debugTab() {
  const toggle = (key, label) => {
    const l = make("label", "admin-toggle");
    const box = make("input");
    box.type = "checkbox";
    box.checked = !!DEBUG_OVERLAYS[key];
    box.addEventListener("change", () => (DEBUG_OVERLAYS[key] = box.checked));
    l.append(box, label);
    return l;
  };
  return [
    section("Outlines over the house (only you see them)"),
    row("Seats", [toggle("seats", "Seat spots (where you sit)")]),
    row("Collision", [toggle("solids", "Walls and furniture you bump into")]),
    row("Rooms", [toggle("rooms", "Room edges and names")]),
    row("Grid", [toggle("grid", "Grid spots and object names (for placing things)")]),
  ];
}

// The admin tools for one friend, for the right-click menu (main.js):
// [{ label, run, danger, disabled }]. Empty unless you're an admin (and
// not viewing as a player). `muted` says whether they're muted now.
export function adminActionsFor(name, muted) {
  if (!isAdmin() || viewingAsPlayer()) return [];
  const here = hooks.here();
  const tell = (text) => hooks.notice(text, 5000);
  const run = (work) => async () => {
    try {
      tell(await work());
    } catch (err) {
      tell(err.message);
    }
  };
  const order = async (kind, extra = {}) => {
    const { order: o } = await serverApi("POST", "/api/admin/order", { kind, name, ...extra });
    hooks.sendOrder(o);
  };
  return [
    { icon: "tools", label: "Teleport to", run: () => tell(hooks.goTo(name) ? `Went to ${name}.` : `Couldn't get to ${name}.`) },
    { icon: "tools", label: "Bring here", disabled: here.inBedroom, title: here.inBedroom ? "Not from inside a bedroom" : "", run: run(async () => (await order("summon", { x: here.x, y: here.y }), `Bringing ${name} over.`)) },
    { icon: "tools", label: "Unstick", run: run(async () => (await order("unstick"), `${name} goes back to the hallway.`)) },
    muted
      ? { icon: "tools", label: "Unmute", run: run(async () => (await serverApi("POST", "/api/admin/mute", { name, minutes: 0 }), `${name} can talk again.`)) }
      : { icon: "tools", label: "Mute (10 min)", run: run(async () => (await serverApi("POST", "/api/admin/mute", { name, minutes: 10 }), `${name} is muted for everyone for 10 minutes.`)) },
    {
      icon: "tools", label: "Send out (10 min)",
      danger: true,
      run: run(async () => {
        if (!(await hooks.confirm({ title: `Send ${name} out of the house?`, text: `${name} is logged out and can't come back for 10 minutes. Everyone stops seeing and hearing them.`, yes: "Send out", no: "Cancel" }))) return "";
        const { order: o } = await serverApi("POST", "/api/admin/kick", { name, minutes: 10 });
        hooks.sendOrder(o);
        return `${name} was sent out of the house.`;
      }),
    },
  ];
}

const BUILDERS = { me: meTab, players: playersTab, world: worldTab, events: eventsTab, server: serverTab, debug: debugTab };

// Draws the panel: the current tab, or (while searching) every tool that
// matches, from every tab.
function render() {
  const query = search.value.trim().toLowerCase();
  tabsRow.innerHTML = "";
  tabsRow.classList.toggle("searching", !!query);
  for (const [id, label] of TABS) {
    const t = make("button", id === tab ? "active" : "", label);
    t.type = "button";
    t.setAttribute("role", "tab");
    t.addEventListener("click", () => {
      playClickSound();
      tab = id;
      search.value = "";
      render();
    });
    tabsRow.appendChild(t);
  }
  const scroll = body.scrollTop;
  body.innerHTML = "";
  if (!query) {
    body.append(...BUILDERS[tab]());
    body.scrollTop = scroll;
    return;
  }
  let found = 0;
  for (const [id, label] of TABS) {
    const rows = BUILDERS[id]().filter((n) => n.classList?.contains("admin-row") && n.dataset.search.includes(query));
    if (!rows.length) continue;
    found += rows.length;
    body.append(section(label), ...rows);
  }
  if (!found) body.appendChild(noteText(`Nothing called "${query}".`));
}
search.addEventListener("input", render);

// --- The banner over the house while you're trying something out ---
const banner = document.getElementById("override-banner");
function showBanner() {
  const now = previewing();
  const names = { clear: "sun", cloudy: "clouds" };
  const parts = [seasonPreview, now.sky && (names[now.sky] ?? now.sky), now.time].filter(Boolean);
  banner.hidden = !parts.length;
  document.getElementById("override-text").textContent = `Trying out: ${parts.join(", ")} (only you see this)`;
}
document.getElementById("override-reset").addEventListener("click", () => {
  playClickSound();
  previewSeason(null);
  previewSky(null);
  previewTime(null);
  showBanner();
  if (!panel.hidden) render();
});
