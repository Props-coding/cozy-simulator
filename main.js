// Starts the game: Join screen, then the move-and-draw loop, plus
// sending your position to friends and drawing where they are.
import {
  connectToRoom,
  broadcastPosition,
  getPeers,
  addLocalStream,
  onPeerStream,
  onPeerLeave,
  onPeerJoin,
  onKnock,
  sendKnock,
} from "./network.js";
import {
  requestMic,
  updateMicForRoom,
  handlePeerStream,
  removePeerAudio,
  updateVoiceRouting,
  setMasterMuted,
  setMasterVolume,
  enterStudy,
  leaveStudy,
  setLofiVolume,
  updateLofi,
  primeSoundEffects,
  playJoinSound,
  playLeaveSound,
  playRoomChangeSound,
  playClickSound,
  playKnockSound,
} from "./audio.js";

const myTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatLocalTime(tz) {
  if (!tz) return "";
  try {
    return new Date().toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const nameInput = document.getElementById("name-input");
const colorInput = document.getElementById("color-input");
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const actionHint = document.getElementById("action-hint");
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");
const volumeSlider = document.getElementById("volume-slider");
const lofiVolumeSlider = document.getElementById("lofi-volume-slider");
const lofiPlayerContainer = document.getElementById("lofi-player");
const micStatus = document.getElementById("mic-status");

onPeerStream(handlePeerStream);
onPeerLeave((peerId) => {
  removePeerAudio(peerId);
  playLeaveSound();
});
onPeerJoin(() => playJoinSound());

muteToggle.addEventListener("change", () => {
  setMasterMuted(muteToggle.checked);
  playClickSound();
});
volumeSlider.addEventListener("input", () => setMasterVolume(parseFloat(volumeSlider.value)));
volumeSlider.addEventListener("change", () => playClickSound());
lofiVolumeSlider.addEventListener("input", () => setLofiVolume(parseFloat(lofiVolumeSlider.value)));
lofiVolumeSlider.addEventListener("change", () => playClickSound());
setLofiVolume(CONFIG.defaultLofiVolume);
lofiVolumeSlider.value = CONFIG.defaultLofiVolume;

const canvas = document.getElementById("house");
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;
const ctx = canvas.getContext("2d");

let myName = "Friend";
let myColor = "#e05a47";

// Starting spot: roughly the middle of the hallway (grid units, not pixels).
const player = { x: 8.7, y: 1.2 };

joinButton.addEventListener("click", async () => {
  myName = nameInput.value.trim() || "Friend";
  myColor = colorInput.value;

  joinScreen.hidden = true;
  gameScreen.hidden = false;
  primeSoundEffects();
  playClickSound();

  // Start drawing the house right away, instead of waiting for you to
  // answer the browser's microphone question.
  requestAnimationFrame(tick);

  try {
    connectToRoom(myName, myColor);
    const micStream = await requestMic();
    if (micStream) {
      addLocalStream(micStream);
    } else {
      micStatus.hidden = false;
    }
  } catch (err) {
    // Movement still works alone even if connecting to friends fails.
    console.error("Could not connect to other players:", err);
  }
});

// --- Offices ---
// Your own office, if you've built one: { slot, since, locked }. Your
// browser remembers it, so it comes back each time you join. Nobody else
// stores it: it only exists while you're here.
const OFFICE_STORAGE_KEY = "cozy-house-office";

function loadMyOffice() {
  try {
    return JSON.parse(localStorage.getItem(OFFICE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveMyOffice() {
  try {
    if (myOffice) localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(myOffice));
    else localStorage.removeItem(OFFICE_STORAGE_KEY);
  } catch {
    // Private windows can block storage; the office just won't be remembered.
  }
}

let myOffice = loadMyOffice();
let offices = []; // everyone's offices right now, as passed to buildHouse
let officeSignature = "";

// An office message from a friend is only trusted if it looks right.
function isValidOffice(o) {
  return o && Number.isInteger(o.slot) && o.slot >= 1 && o.slot <= OFFICE_SLOTS && typeof o.since === "number";
}

function firstFreeSlot(taken) {
  for (let slot = 1; slot <= OFFICE_SLOTS; slot++) {
    if (!taken.has(slot)) return slot;
  }
  return null;
}

// Collects everyone's offices. If two people ever claim the same slot
// (say, both built one at the same moment), whoever built first keeps it
// and the other moves to a free slot, or loses theirs if all are taken.
// Every browser runs this same rule, so everyone ends up agreeing.
function gatherOffices(peers) {
  const claims = peers
    .filter((p) => isValidOffice(p.office))
    .map((p) => ({ slot: p.office.slot, since: p.office.since, locked: !!p.office.locked, ownerName: String(p.name).slice(0, 16), ownerId: p.id, color: safeColor(p.color), mine: false }));
  claims.sort((a, b) => a.since - b.since || a.ownerName.localeCompare(b.ownerName));

  const taken = new Map();
  for (const claim of claims) {
    if (!taken.has(claim.slot)) taken.set(claim.slot, claim);
  }

  if (myOffice) {
    const holder = taken.get(myOffice.slot);
    const theyWereFirst = holder && (holder.since < myOffice.since || (holder.since === myOffice.since && holder.ownerName.localeCompare(myName) < 0));
    if (theyWereFirst) {
      const free = firstFreeSlot(taken);
      if (free) myOffice.slot = free;
      else myOffice = null;
      saveMyOffice();
    }
    if (myOffice) {
      taken.set(myOffice.slot, { slot: myOffice.slot, since: myOffice.since, locked: myOffice.locked, ownerName: myName, color: safeColor(myColor), mine: true });
    }
  }
  return [...taken.values()].sort((a, b) => a.slot - b.slot);
}

// Rebuilds the house if anyone's office appeared, disappeared or got
// locked/unlocked since last frame.
function updateOffices() {
  offices = gatherOffices(getPeers());
  const signature = JSON.stringify(offices);
  if (signature === officeSignature) return;
  officeSignature = signature;
  buildHouse(offices);
  // If the office you were standing in just vanished (its owner left),
  // pop back to the middle of the hallway.
  const box = { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  if (!isInsideARoom(player) || SOLIDS.some((s) => rectsOverlap(box, s))) {
    player.x = 8.7;
    player.y = 1.2;
  }
}

// A short message that shows in the prompt line for a few seconds, like
// "Sam is knocking on your office door."
let notice = { text: "", until: 0 };

function showNotice(text) {
  notice = { text, until: performance.now() + 4000 };
}

// Knocks: someone at your locked door. Ignored if you have no office.
onKnock((peerId) => {
  if (!myOffice) return;
  const name = getPeers().find((p) => p.id === peerId)?.name || "Someone";
  playKnockSound();
  showNotice(`${String(name).slice(0, 16)} is knocking on your office door.`);
});

let lastKnockTime = 0;

// The short prompt under the room name, like "Press E to build your office".
function actionHintFor(room) {
  if (performance.now() < notice.until) return notice.text;
  const lockedDoor = lockedDoorInFront(player);
  if (lockedDoor) return `${lockedDoor.office.ownerName}'s office is locked. Press K to knock.`;
  if (room.office?.mine) {
    const lock = myOffice.locked ? "Press L to unlock the door" : "Press L to lock the door";
    return `Your office. ${lock}, or R to remove your office.`;
  }
  if (isNearBuildDoor(player)) {
    if (myOffice) return "You already have an office.";
    if (offices.length >= OFFICE_SLOTS) return "All three offices are taken right now.";
    return "Press E to build your office.";
  }
  return "";
}

window.addEventListener("keydown", (e) => {
  if (gameScreen.hidden || e.repeat) return;
  const key = e.key.toLowerCase();

  if (key === "e" && !myOffice && isNearBuildDoor(player)) {
    const slot = firstFreeSlot(new Map(offices.map((o) => [o.slot, o])));
    if (slot) {
      myOffice = { slot, since: Date.now(), locked: false };
      saveMyOffice();
      playClickSound();
    }
  }

  if (key === "l" && getCurrentRoom(player).office?.mine) {
    myOffice.locked = !myOffice.locked;
    saveMyOffice();
    playClickSound();
  }

  // Knock, at most once every 2 seconds so nobody gets spammed.
  const lockedDoor = lockedDoorInFront(player);
  if (key === "k" && lockedDoor && performance.now() - lastKnockTime > 2000) {
    lastKnockTime = performance.now();
    sendKnock(lockedDoor.office.ownerId);
    playKnockSound();
    showNotice(`You knocked. ${lockedDoor.office.ownerName} will hear it.`);
  }

  // Removing asks first, since it can't be undone (though you can always
  // build a new one). You get moved back to the hallway once it's gone.
  if (key === "r" && getCurrentRoom(player).office?.mine) {
    if (window.confirm("Remove your office? Anyone inside will be moved to the hallway.")) {
      myOffice = null;
      saveMyOffice();
      playClickSound();
    }
    // The confirm box swallows key releases, so forget any held keys to
    // stop your character walking on by itself afterwards.
    for (const k in keysDown) keysDown[k] = false;
  }
});

// Tracks which movement keys are currently held down.
const keysDown = {};
window.addEventListener("keydown", (e) => (keysDown[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keysDown[e.key.toLowerCase()] = false));

function readMovement(dt) {
  let dx = 0;
  let dy = 0;
  const dist = CONFIG.playerSpeed * dt;

  if (keysDown["arrowleft"] || keysDown["a"]) dx -= dist;
  if (keysDown["arrowright"] || keysDown["d"]) dx += dist;
  if (keysDown["arrowup"] || keysDown["w"]) dy -= dist;
  if (keysDown["arrowdown"] || keysDown["s"]) dy += dist;

  return { dx, dy };
}

let lastTime = performance.now();
let timeSinceLastBroadcast = 0;
const broadcastInterval = 1 / CONFIG.positionUpdatesPerSecond;
let previousRoomId = null;

// Friends' positions only arrive ~12 times a second, which looks choppy
// if drawn directly. Instead we ease each friend's drawn position toward
// their latest known position a little every frame, so movement looks
// smooth in between updates.
const displayPositions = {}; // peerId -> { x, y }

function getSmoothedPosition(peer, dt) {
  const shown = (displayPositions[peer.id] ??= { x: peer.x, y: peer.y });
  const ease = 1 - Math.pow(0.001, dt); // fraction of the gap to close this frame
  shown.x += (peer.x - shown.x) * ease;
  shown.y += (peer.y - shown.y) * ease;
  return shown;
}

// Friends' names and colors come over the network from their own
// browsers, so we treat them as untrusted text before putting them on
// the page (a friend's name shouldn't be able to break the page layout).
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Only accept a real "#rrggbb" color, otherwise fall back to a neutral
// gray, since this value goes straight into a style attribute.
function safeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#999999";
}

// Turns a color and a line of text into one sidebar row, with a small
// dot in the player's color so the list matches who you see on screen.
function peerRow(color, text) {
  return `<li><span class="peer-dot" style="background:${safeColor(color)}"></span>${escapeHtml(text)}</li>`;
}

function updateSidebar(myRoomName) {
  let rows = peerRow(myColor, `${myName} (you) · ${myRoomName} · ${formatLocalTime(myTimeZone)}`);
  for (const peer of getPeers()) {
    const time = formatLocalTime(peer.tz);
    const roomName = roomNameFor(peer.room);
    rows += peerRow(peer.color, `${peer.name} · ${roomName}${time ? " · " + time : ""}`);
  }
  peerList.innerHTML = rows;
}

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap so a tab-switch pause doesn't teleport the player
  lastTime = now;

  updateOffices();

  const { dx, dy } = readMovement(dt);
  if (dx !== 0 || dy !== 0) {
    movePlayer(player, dx, dy);
  }

  const currentRoom = getCurrentRoom(player);
  roomLabel.textContent = "You are in: " + currentRoom.name;
  const hint = actionHintFor(currentRoom);
  if (actionHint.textContent !== hint) actionHint.textContent = hint;
  updateMicForRoom(currentRoom.id);
  updateVoiceRouting(currentRoom.id, getPeers());

  if (currentRoom.id !== previousRoomId) {
    if (currentRoom.id === "study") enterStudy(lofiPlayerContainer);
    if (previousRoomId === "study") leaveStudy();
    if (previousRoomId !== null) playRoomChangeSound(currentRoom.id);
    previousRoomId = currentRoom.id;
  }
  updateLofi(dt);

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    const officeInfo = myOffice ? { slot: myOffice.slot, since: myOffice.since, locked: myOffice.locked } : null;
    broadcastPosition(myName, myColor, player.x, player.y, currentRoom.id, myTimeZone, officeInfo);
  }

  const scenePlayers = getPeers().map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    return { x: shown.x, y: shown.y, color: peer.color, name: peer.name, badge: peer.room === "dinner" ? "eating" : null };
  });
  scenePlayers.push({ x: player.x, y: player.y, color: myColor, name: myName, badge: currentRoom.id === "dinner" ? "eating" : null });
  drawScene(ctx, scenePlayers, player);

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}
