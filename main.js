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
  onFocus,
  sendFocus,
  onChat,
  sendChat,
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
  playTimerChime,
  playChatSound,
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
const hatInput = document.getElementById("hat-input");
const characterPreview = document.getElementById("character-preview");
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const actionHint = document.getElementById("action-hint");
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");
const volumeSlider = document.getElementById("volume-slider");
const lofiVolumeSlider = document.getElementById("lofi-volume-slider");
const lofiPlayerContainer = document.getElementById("lofi-player");
const micStatus = document.getElementById("mic-status");
const confirmDialog = document.getElementById("confirm-dialog");

onPeerStream(handlePeerStream);
onPeerLeave((peerId) => {
  removePeerAudio(peerId);
  playLeaveSound();
});
onPeerJoin((peerId) => {
  playJoinSound();
  // Let a friend who just arrived see the Study timer, if one is running.
  if (focusTimer) sendFocus(focusMessage(), peerId);
});

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
let myHat = "none";

// The Join screen remembers your name, color and hat from last time.
const PROFILE_STORAGE_KEY = "cozy-house-profile";
try {
  const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));
  if (saved) {
    nameInput.value = saved.name || "";
    if (/^#[0-9a-fA-F]{6}$/.test(saved.color)) colorInput.value = saved.color;
    if (HAT_DRAWERS[saved.hat]) hatInput.value = saved.hat;
  }
} catch {
  // Nothing saved yet, or storage is blocked: start with the defaults.
}

const updatePreview = () => drawCharacterPreview(characterPreview, colorInput.value, hatInput.value);
colorInput.addEventListener("input", updatePreview);
hatInput.addEventListener("change", updatePreview);
updatePreview();

// Starting spot: roughly the middle of the hallway (grid units, not pixels).
const player = { x: 8.7, y: 1.2 };

joinButton.addEventListener("click", async () => {
  myName = nameInput.value.trim() || "Friend";
  myColor = colorInput.value;
  myHat = HAT_DRAWERS[hatInput.value] ? hatInput.value : "none";
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: myName, color: myColor, hat: myHat }));
  } catch {
    // Storage blocked (e.g. private window): just won't be remembered.
  }

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

// --- Study focus timer ---
// Shared by everyone: when someone starts or stops it, a message goes to
// all friends. Each browser then counts down on its own clock, and moves
// from focus to break to done by itself, so no more messages are needed.
// focusTimer is { phase: "focus" or "break", endsAt } or null.
let focusTimer = null;

function focusMessage() {
  return focusTimer ? { phase: focusTimer.phase, remainingMs: focusTimer.endsAt - performance.now() } : { phase: null };
}

function setFocusFromMessage(message) {
  const validPhase = message?.phase === "focus" || message?.phase === "break";
  const validTime = typeof message?.remainingMs === "number" && message.remainingMs > 0 && message.remainingMs < 3 * 60 * 60 * 1000;
  focusTimer = validPhase && validTime ? { phase: message.phase, endsAt: performance.now() + message.remainingMs } : null;
}

onFocus(setFocusFromMessage);

// Called every frame: moves focus on to break, and break on to done,
// with a chime for anyone in the Study.
function updateFocusTimer(roomId) {
  if (!focusTimer || performance.now() < focusTimer.endsAt) return;
  if (focusTimer.phase === "focus") {
    focusTimer = { phase: "break", endsAt: focusTimer.endsAt + CONFIG.breakMinutes * 60 * 1000 };
  } else {
    focusTimer = null;
  }
  if (roomId === "study") playTimerChime();
}

// "18:42" style time left on the timer.
function focusTimeLeft() {
  const seconds = Math.max(0, Math.ceil((focusTimer.endsAt - performance.now()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function studySignText() {
  if (!focusTimer) return null;
  return (focusTimer.phase === "focus" ? "Focus " : "Break ") + focusTimeLeft();
}

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
  if (room.id === "study") {
    if (!focusTimer) return `Press F to start a ${CONFIG.focusMinutes} minute focus session for everyone in the Study.`;
    const what = focusTimer.phase === "focus" ? "Focus time" : "Break time";
    return `${what}: ${focusTimeLeft()} left. Press F to stop the timer.`;
  }
  return "";
}

window.addEventListener("keydown", (e) => {
  if (gameScreen.hidden || e.repeat || dialogOpen || isTypingInChat(e)) return;
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

  // Start or stop the shared Study focus timer.
  if (key === "f" && getCurrentRoom(player).id === "study") {
    focusTimer = focusTimer ? null : { phase: "focus", endsAt: performance.now() + CONFIG.focusMinutes * 60 * 1000 };
    sendFocus(focusMessage());
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
    askConfirm({
      title: "Remove your office?",
      text: "Anyone inside will be moved back to the hallway. You can always build a new one at the west door.",
      yes: "Remove office",
      no: "Keep it",
    }).then((remove) => {
      if (remove && myOffice) {
        myOffice = null;
        saveMyOffice();
      }
    });
  }
});

// --- Chat ---
// Two channels: "house" (everyone) and office chat (only people standing
// in the same office). Messages aren't saved anywhere: you see what's
// said while you're here. New messages also pop up as a speech bubble
// over the speaker for a few seconds.
const CHAT_MAX_LENGTH = 200;
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");
const chatTabs = { house: document.getElementById("chat-tab-house"), office: document.getElementById("chat-tab-office") };

let chatTab = "house"; // which tab is showing
let chatLines = []; // { channel: "house" or an office id like "office-2", name, color, text }
const unread = { house: false, office: false };
const bubbles = {}; // "me" or a peer id -> { text, until }
let lastChatSent = 0;
let lastOfficeRoomId = null; // the office you're standing in, if any

// True while you're typing a chat message, so letters don't move you or
// trigger E, F, K, L or R.
function isTypingInChat(e) {
  return e.target === chatInput;
}

function bubbleFor(who) {
  const b = bubbles[who];
  return b && performance.now() < b.until ? b.text : null;
}

function renderChat() {
  const channel = chatTab === "house" ? "house" : lastOfficeRoomId;
  const lines = chatLines.filter((l) => l.channel === channel);
  chatLog.innerHTML = "";
  if (lines.length === 0) {
    const empty = document.createElement("li");
    empty.className = "chat-empty";
    empty.textContent = chatTab === "house" ? "Say hi to everyone! Press Enter to start typing." : "Only people in this office can see this chat.";
    chatLog.appendChild(empty);
  }
  for (const line of lines) {
    // Built with textContent (never innerHTML), since friends' names and
    // messages come over the network.
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "chat-name";
    name.style.color = safeColor(line.color);
    name.textContent = line.name + ": ";
    li.append(name, document.createTextNode(line.text));
    chatLog.appendChild(li);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
  chatTabs.house.querySelector(".unread-dot").hidden = !unread.house;
  chatTabs.office.querySelector(".unread-dot").hidden = !unread.office;
}

function addChatLine(line) {
  chatLines.push(line);
  if (chatLines.length > 200) chatLines = chatLines.slice(-200); // keep it light
  const tabForLine = line.channel === "house" ? "house" : "office";
  if (tabForLine !== chatTab) unread[tabForLine] = true;
  renderChat();
}

function switchChatTab(tab) {
  chatTab = tab;
  unread[tab] = false;
  chatTabs.house.classList.toggle("active", tab === "house");
  chatTabs.office.classList.toggle("active", tab === "office");
  renderChat();
}

chatTabs.house.addEventListener("click", () => switchChatTab("house"));
chatTabs.office.addEventListener("click", () => switchChatTab("office"));

// Called every frame: the Office tab only works while you're in an office,
// and its label shows which one.
function updateChatTabs(room) {
  const officeId = room.office ? room.id : null;
  if (officeId === lastOfficeRoomId) return;
  lastOfficeRoomId = officeId;
  chatTabs.office.disabled = !officeId;
  chatTabs.office.title = officeId ? room.name : "Walk into an office to chat there";
  unread.office = false;
  if (!officeId && chatTab === "office") switchChatTab("house");
  else renderChat();
}

document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = clipText(chatInput.value.trim(), CHAT_MAX_LENGTH);
  chatInput.blur(); // sending takes you straight back to walking
  if (!text || performance.now() - lastChatSent < 400) return;
  lastChatSent = performance.now();
  chatInput.value = "";

  if (chatTab === "office" && lastOfficeRoomId) {
    const inThisOffice = getPeers().filter((p) => p.room === lastOfficeRoomId).map((p) => p.id);
    sendChat({ text, office: lastOfficeRoomId }, inThisOffice);
    addChatLine({ channel: lastOfficeRoomId, name: myName, color: myColor, text });
  } else {
    sendChat({ text });
    addChatLine({ channel: "house", name: myName, color: myColor, text });
  }
  bubbles.me = { text, until: performance.now() + 6000 };
});

// Enter starts typing; Enter sends and goes back to walking; Escape goes
// back to walking without sending.
window.addEventListener("keydown", (e) => {
  if (gameScreen.hidden || dialogOpen) return;
  if (e.key === "Enter" && e.target !== chatInput) {
    e.preventDefault();
    for (const k in keysDown) keysDown[k] = false; // stop walking while typing
    chatInput.focus();
  } else if (e.target === chatInput && (e.key === "Escape" || (e.key === "Enter" && !chatInput.value.trim()))) {
    e.preventDefault();
    chatInput.blur();
  }
});

// The 😊 button: a small grid of emoji. Clicking one puts it where your
// cursor is in the chat box and keeps you typing. (Windows key + period
// opens Windows' own emoji picker too.)
const emojiButton = document.getElementById("emoji-button");
const emojiPicker = document.getElementById("emoji-picker");

emojiButton.addEventListener("click", () => {
  emojiPicker.hidden = !emojiPicker.hidden;
});

emojiPicker.addEventListener("click", (e) => {
  const emoji = e.target.closest("button")?.textContent;
  if (!emoji) return;
  const start = chatInput.selectionStart ?? chatInput.value.length;
  const end = chatInput.selectionEnd ?? start;
  chatInput.value = chatInput.value.slice(0, start) + emoji + chatInput.value.slice(end);
  chatInput.focus();
  chatInput.setSelectionRange(start + emoji.length, start + emoji.length);
  emojiPicker.hidden = true;
});

// Clicking anywhere else closes the emoji grid.
document.addEventListener("click", (e) => {
  if (!emojiPicker.hidden && !emojiPicker.contains(e.target) && e.target !== emojiButton) emojiPicker.hidden = true;
});

onChat((message, peerId) => {
  if (typeof message?.text !== "string") return;
  const text = clipText(message.text.trim(), CHAT_MAX_LENGTH);
  if (!text) return;
  let channel = "house";
  if (message.office !== undefined) {
    // Office chat: only show it if we're standing in that office right now.
    if (message.office !== getCurrentRoom(player).id) return;
    channel = message.office;
  }
  const peer = getPeers().find((p) => p.id === peerId);
  addChatLine({ channel, name: String(peer?.name ?? "Someone").slice(0, 16), color: peer?.color, text });
  bubbles[peerId] = { text, until: performance.now() + 6000 };
  playChatSound();
});

renderChat();

// --- In-game "are you sure?" card ---
// Shows the cozy card over the house and resolves to true or false.
// While it's open, your character stays put and game keys are ignored.
// Escape (or the soft button) means no.
let dialogOpen = false;

function askConfirm({ title, text, yes, no }) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-text").textContent = text;
  const yesButton = document.getElementById("confirm-yes");
  const noButton = document.getElementById("confirm-no");
  yesButton.textContent = yes;
  noButton.textContent = no;
  dialogOpen = true;
  confirmDialog.hidden = false;
  noButton.focus(); // the safe choice is the one Enter picks

  return new Promise((resolve) => {
    const finish = (answer) => {
      confirmDialog.hidden = true;
      dialogOpen = false;
      document.activeElement?.blur();
      confirmDialog.onkeydown = null;
      playClickSound();
      resolve(answer);
    };
    yesButton.onclick = () => finish(true);
    noButton.onclick = () => finish(false);
    confirmDialog.onkeydown = (e) => {
      if (e.key === "Escape") finish(false);
    };
  });
}

// Tracks which movement keys are currently held down.
const keysDown = {};
window.addEventListener("keydown", (e) => {
  if (!isTypingInChat(e)) keysDown[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => (keysDown[e.key.toLowerCase()] = false));

function readMovement(dt) {
  let dx = 0;
  let dy = 0;
  if (dialogOpen) return { dx, dy }; // stay put while the pop-up card is open
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
  const stepX = (peer.x - shown.x) * ease;
  const stepY = (peer.y - shown.y) * ease;
  shown.x += stepX;
  shown.y += stepY;
  // Counts as walking if they moved more than a little this frame (used
  // for the walking bounce).
  shown.moving = dt > 0 && Math.hypot(stepX, stepY) / dt > 0.5;
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
  roomLabel.textContent = "📍 " + currentRoom.name;
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
  updateFocusTimer(currentRoom.id);

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    const officeInfo = myOffice ? { slot: myOffice.slot, since: myOffice.since, locked: myOffice.locked } : null;
    broadcastPosition({ name: myName, color: myColor, hat: myHat, x: player.x, y: player.y, room: currentRoom.id, tz: myTimeZone, office: officeInfo });
  }

  const scenePlayers = getPeers().map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    // A friend's hat name comes over the network, so only accept known hats.
    const hat = HAT_DRAWERS[peer.hat] ? peer.hat : "none";
    return { x: shown.x, y: shown.y, moving: shown.moving, color: peer.color, hat, name: peer.name, badge: peer.room === "dinner" ? "eating" : null, bubble: bubbleFor(peer.id) };
  });
  scenePlayers.push({ x: player.x, y: player.y, moving: dx !== 0 || dy !== 0, color: myColor, hat: myHat, name: myName, badge: currentRoom.id === "dinner" ? "eating" : null, bubble: bubbleFor("me") });
  updateChatTabs(currentRoom);
  drawScene(ctx, scenePlayers, player, studySignText());

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}
