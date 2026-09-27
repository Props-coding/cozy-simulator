// Bedrooms, the hallway side: everyone's bedroom door on the upstairs
// suite floor (the bedroom hallway), kept up to date from the house server,
// and the little card for changing your own door (press E at it).
//
// The house server keeps one bedroom for every member (see server.mjs:
// ensureRoom), so doors stay put even when their owners are offline.
import { uiIcon } from "./ui-icons.js";
import { serverApi, accountName } from "./account.js";
import { sendRoomsPing, onRoomsPing } from "./network.js";
import { playClickSound } from "./audio.js";

let doors = []; // [{ owner, map, color, privacy, note, deco, style, size, online }]
let lastSignature = "";
let hooks = { changed: () => {}, notice: () => {} };

// Starts keeping the doors up to date: now, every so often, and right
// away when a friend changes theirs.
export function startRooms(options) {
  hooks = options;
  refreshRooms();
  setInterval(refreshRooms, CONFIG.bedrooms.pollSeconds * 1000);
  onRoomsPing(refreshRooms);
}

export async function refreshRooms() {
  try {
    const { doors: latest, house } = await serverApi("GET", "/api/rooms");
    hooks.house?.(house); // (who's muted or sent out, announcements, maintenance: main.js)
    const signature = JSON.stringify(latest);
    if (signature === lastSignature) return;
    lastSignature = signature;
    doors = latest;
    hooks.changed();
  } catch {
    // Offline for a moment: try again next time.
  }
}

export function bedroomDoors() {
  return doors;
}

// --- Going in and out ---
// The house server decides who may go in. Asking for a pass returns
// { pass } if you may, or { refused: "knock" or "private" } if not. The
// pass goes out with your position, so friends' browsers can check it.
export async function askToEnter(owner, peerId) {
  try {
    return await serverApi("POST", "/api/room/enter", { owner, peerId });
  } catch (err) {
    if (err.message === "knock" || err.message === "private") return { refused: err.message };
    return { refused: "error", message: err.message };
  }
}

export function leftRoom(owner) {
  serverApi("POST", "/api/room/leave", { owner }).catch(() => {});
}

// You (the owner) let a friend who knocked come in, for a few minutes.
export async function letIn(name) {
  await serverApi("POST", "/api/room/let-in", { name });
}

const isMine = (door) => door.owner.toLowerCase() === String(accountName() ?? "").toLowerCase();

// --- Your door's settings ---
// Who can come in (the light over the door), a short note, and a little
// decoration. Saved on the server, so friends see it even when you're away.
const PRIVACY = [
  ["open", { light: "#5cbf6a" }, "Open", "Anyone can come in."],
  ["knock", { light: "#f0a53a" }, "Knock first", "Friends knock, you let them in."],
  ["private", { light: "#d9504a" }, "Private", "Only you."],
  ["party", { light: "#e98ac0" }, "Party!", "Open, with a balloon on the door."],
];
// What you hear inside (the same rules as the house's rooms).
const AUDIO = [
  ["voice", { svg: "mic" }, "Voice", "Talk with whoever is in here."],
  ["lofi", { svg: "headphones" }, "Lo-fi", "Your own lo-fi pick, no voice (like the Study)."],
  ["silent", { svg: "quiet" }, "Silent", "No voice, no music."],
];
// The little decoration on your door (drawn like it is on the door).
const DECOS = ["none", "wreath", "flowers", "star", "heart", "plant", "pumpkin", "snowflake"].map((id) => [id, { deco: id }, id === "none" ? "None" : id[0].toUpperCase() + id.slice(1)]);
// How your room looks inside. (The personal office themes, like the Lake
// house, stay in offices.)
const STYLES = [
  ["classic", null, "Classic"],
  ["cabin", null, "Cabin"],
  ["apartment", null, "Apartment"],
  ["beachHut", null, "Beach hut"],
];

// A choice's little picture: a colored light, one of the drawn icons, or
// the door decoration itself.
function choicePicture(pic) {
  const span = document.createElement("span");
  span.className = "door-choice-icon";
  if (pic.light) {
    span.classList.add("light");
    span.style.setProperty("--light", pic.light);
  } else if (pic.svg) span.innerHTML = uiIcon(pic.svg);
  else if (pic.deco) {
    const c = Object.assign(document.createElement("canvas"), { width: 44, height: 44, className: "item-picture" });
    c.style.width = c.style.height = "22px";
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    if (pic.deco === "none") {
      ctx.strokeStyle = "#b8a68e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(11, 11, 6, 0, Math.PI * 2);
      ctx.moveTo(6.8, 15.2);
      ctx.lineTo(15.2, 6.8);
      ctx.stroke();
    } else drawDoorDeco(ctx, pic.deco, 11, 11);
    span.appendChild(c);
  }
  return span;
}

export const DOOR_STATUS = Object.fromEntries(PRIVACY.map(([id, , label]) => [id, label]));

const panel = document.getElementById("door-panel");
const privacyRow = document.getElementById("door-privacy");
const decoRow = document.getElementById("door-decos");
const audioRow = document.getElementById("door-audio");
const styleRow = document.getElementById("door-styles");
const noteInput = document.getElementById("door-note");

async function save(change) {
  try {
    await serverApi("PUT", "/api/room/door", change);
    await refreshRooms();
    sendRoomsPing();
  } catch (err) {
    hooks.notice(err.message);
  }
}

function choiceButtons(row, choices, current, onPick) {
  row.innerHTML = "";
  for (const [id, pic, label, hint] of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "door-choice" + (id === current ? " chosen" : "");
    button.title = hint ?? label;
    if (pic) button.append(choicePicture(pic));
    button.append(label);
    button.addEventListener("click", () => {
      playClickSound();
      onPick(id);
    });
    row.appendChild(button);
  }
}

function renderPanel() {
  const door = doors.find(isMine);
  if (!door) return;
  choiceButtons(privacyRow, PRIVACY, door.privacy, async (id) => {
    await save({ privacy: id });
    renderPanel();
  });
  choiceButtons(audioRow, AUDIO, door.audio ?? "voice", async (id) => {
    await save({ audio: id });
    renderPanel();
  });
  choiceButtons(decoRow, DECOS, door.deco, async (id) => {
    await save({ deco: id });
    renderPanel();
  });
  choiceButtons(styleRow, STYLES, door.style, async (id) => {
    await save({ style: id });
    renderPanel();
  });
  if (document.activeElement !== noteInput) noteInput.value = door.note;
}

noteInput.addEventListener("keydown", (e) => {
  e.stopPropagation(); // typing here isn't walking
  if (e.key === "Enter") noteInput.blur();
});
noteInput.addEventListener("change", () => save({ note: noteInput.value }));

export function openDoorPanel() {
  renderPanel();
  panel.hidden = false;
  playClickSound();
}

export function closeDoorPanel() {
  if (!panel.hidden && noteInput.value !== (doors.find(isMine)?.note ?? "")) save({ note: noteInput.value });
  panel.hidden = true;
}

export function isDoorPanelOpen() {
  return !panel.hidden;
}

document.getElementById("door-close").addEventListener("click", () => {
  closeDoorPanel();
  playClickSound();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isDoorPanelOpen()) closeDoorPanel();
});
