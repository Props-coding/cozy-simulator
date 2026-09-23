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
  onEmote,
  sendEmote,
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
  playJigTune,
  enterLibrary,
  leaveLibrary,
  setRainVolume,
  updateRain,
} from "./audio.js";
import { initTheater, enterTheater, leaveTheater, updateTheater } from "./theater.js";
import { expandAsYouType, expandShortcodes, expandEmoticons } from "./emoji.js";
import { FREE_HATS, ownedHats, ownedShoes, addCrumbs, startEarningCrumbs, initShop, isShopBusy, talkToRaccoons } from "./shop.js";
import { initWhiteboard, openWhiteboard, closeWhiteboard, isWhiteboardOpen, sendBoardTo } from "./whiteboard.js";

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
const shoesInput = document.getElementById("shoes-input");
const characterPreview = document.getElementById("character-preview");
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const actionHint = document.getElementById("action-hint");
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");
const volumeSlider = document.getElementById("volume-slider");
const lofiVolumeSlider = document.getElementById("lofi-volume-slider");
const rainVolumeSlider = document.getElementById("rain-volume-slider");
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
  // Send a friend who just arrived the whiteboard so far.
  sendBoardTo(peerId);
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
rainVolumeSlider.addEventListener("input", () => setRainVolume(parseFloat(rainVolumeSlider.value)));
rainVolumeSlider.addEventListener("change", () => playClickSound());
setRainVolume(CONFIG.defaultRainVolume);
rainVolumeSlider.value = CONFIG.defaultRainVolume;

const canvas = document.getElementById("house");
const ctx = canvas.getContext("2d");

let myName = "Friend";
let myColor = "#e05a47";
let myHat = "none";
let myShoes = "none";

// The hats and shoes you can pick: the free hats, plus whatever you've
// bought from the raccoons.
const hatChoices = () => [...FREE_HATS, ...ownedHats()];
const shoeChoices = () => [["none", "Plain feet"], ...ownedShoes()];

function fillSelect(select, choices, chosen) {
  select.innerHTML = "";
  for (const [id, name] of choices) select.add(new Option(name, id));
  select.value = choices.some(([id]) => id === chosen) ? chosen : "none";
}

// The Join screen remembers your name, color, hat and shoes from last time.
const PROFILE_STORAGE_KEY = "cozy-house-profile";
let savedProfile = null;
try {
  savedProfile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));
} catch {
  // Nothing saved yet, or storage is blocked: start with the defaults.
}
if (savedProfile) {
  nameInput.value = savedProfile.name || "";
  if (/^#[0-9a-fA-F]{6}$/.test(savedProfile.color)) colorInput.value = savedProfile.color;
}
fillSelect(hatInput, hatChoices(), savedProfile?.hat);
fillSelect(shoesInput, shoeChoices(), savedProfile?.shoes);

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: myName, color: myColor, hat: myHat, shoes: myShoes }));
  } catch {
    // Storage blocked (e.g. private window): just won't be remembered.
  }
}

const updatePreview = () => drawCharacterPreview(characterPreview, colorInput.value, hatInput.value, shoesInput.value);
colorInput.addEventListener("input", updatePreview);
hatInput.addEventListener("change", updatePreview);
shoesInput.addEventListener("change", updatePreview);
updatePreview();

// The raccoons' shop can read and change what you're wearing.
initShop({
  get: () => ({ color: myColor, hat: myHat, shoes: myShoes }),
  wear: (type, id) => {
    if (type === "hat") myHat = id;
    else myShoes = id;
    saveProfile();
    fillSelect(hatInput, hatChoices(), myHat);
    fillSelect(shoesInput, shoeChoices(), myShoes);
  },
});

// Starting spot: roughly the middle of the hallway (grid units, not pixels).
const player = { x: 8.7, y: 1.2 };

joinButton.addEventListener("click", async () => {
  myName = nameInput.value.trim() || "Friend";
  myColor = colorInput.value;
  myHat = hatChoices().some(([id]) => id === hatInput.value) ? hatInput.value : "none";
  myShoes = shoeChoices().some(([id]) => id === shoesInput.value) ? shoesInput.value : "none";
  saveProfile();
  startEarningCrumbs();

  joinScreen.hidden = true;
  gameScreen.hidden = false;
  primeSoundEffects();
  playClickSound();

  // Size the house to the window, then start drawing it right away,
  // instead of waiting for you to answer the browser's microphone question.
  fitHouse();
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
// Your own office, if you've built one: { since, locked }. Your
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
  return o && typeof o.since === "number" && Number.isFinite(o.since);
}

// Collects everyone's offices, in the order they were built (earliest
// first), and gives them spots 1, 2, 3 in that order. So when one is
// removed, the ones after it slide over to fill the gap. Every browser
// runs this same rule, so everyone agrees on who is where. If two people
// build the last spot at the same moment, whoever was first keeps it.
function gatherOffices(peers) {
  const claims = new Map(); // one per office, even if a friend briefly shows up twice after a refresh
  for (const p of peers) {
    if (!isValidOffice(p.office)) continue;
    const ownerName = String(p.name).slice(0, 16);
    claims.set(p.office.since + "|" + ownerName, { since: p.office.since, locked: !!p.office.locked, ownerName, ownerId: p.id, color: safeColor(p.color), mine: false });
  }
  if (myOffice) {
    claims.set(myOffice.since + "|" + myName, { since: myOffice.since, locked: !!myOffice.locked, ownerName: myName, color: safeColor(myColor), mine: true });
  }
  const sorted = [...claims.values()].sort((a, b) => a.since - b.since || a.ownerName.localeCompare(b.ownerName));
  const kept = sorted.slice(0, OFFICE_SLOTS);
  if (myOffice && !kept.some((o) => o.mine)) {
    myOffice = null;
    saveMyOffice();
    showNotice("Someone built the last office just before you. Try again when one frees up.");
  }
  return kept.map((o, i) => ({ ...o, slot: i + 1 }));
}

// Rebuilds the house if anyone's office appeared, disappeared, moved or
// got locked/unlocked since last frame.
function updateOffices() {
  offices = gatherOffices(getPeers());
  const signature = JSON.stringify(offices);
  if (signature === officeSignature) return;
  officeSignature = signature;
  const before = getCurrentRoom(player);
  buildHouse(offices);
  // If your office slid over to fill a gap, slide along with it.
  const after = ROOMS.find((r) => r.id === before.id);
  if (before.office && after) player.x += after.rect.x - before.rect.x;
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
    // A crumb bonus for anyone who stuck it out in the Study.
    if (roomId === "study") {
      addCrumbs(CONFIG.focusBonusCrumbs);
      showNotice(`Focus session done! +${CONFIG.focusBonusCrumbs} crumbs. Time for a break.`);
    }
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
  if (isShopBusy()) return "";
  if (nearestInteraction(player) === "raccoons") return "Press E to talk to the raccoons.";
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
  if (room.id === "conference") {
    return isWhiteboardOpen() ? "Draw on the whiteboard together. Press B or Escape to close it." : "Press B to open the whiteboard.";
  }
  if (room.id === "study") {
    if (!focusTimer) return `Press F to start a ${CONFIG.focusMinutes} minute focus session for everyone in the Study.`;
    const what = focusTimer.phase === "focus" ? "Focus time" : "Break time";
    return `${what}: ${focusTimeLeft()} left. Press F to stop the timer.`;
  }
  return "";
}

window.addEventListener("keydown", (e) => {
  if (gameScreen.hidden || e.repeat || dialogOpen || isShopBusy() || isTyping(e)) return;
  const key = e.key.toLowerCase();

  if (key === "e" && nearestInteraction(player) === "raccoons") {
    for (const k in keysDown) keysDown[k] = false; // stop walking while you chat
    talkToRaccoons();
    return;
  }

  if (key === "e" && !myOffice && isNearBuildDoor(player) && offices.length < OFFICE_SLOTS) {
    myOffice = { since: Date.now(), locked: false };
    saveMyOffice();
    playClickSound();
  }

  if (key === "l" && getCurrentRoom(player).office?.mine) {
    myOffice.locked = !myOffice.locked;
    saveMyOffice();
    playClickSound();
  }

  // Number keys 1 to 5: emotes.
  if (Object.hasOwn(EMOTE_KEYS, key)) startEmote(EMOTE_KEYS[key]);

  // Open or close the whiteboard in the Conference Room.
  if (key === "b" && getCurrentRoom(player).id === "conference") {
    if (isWhiteboardOpen()) closeWhiteboard();
    else openWhiteboard();
    playClickSound();
  }
  if (key === "escape" && isWhiteboardOpen()) closeWhiteboard();

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

// --- Sound settings ---
// The cog in the header opens a little card with all the volume controls.
// Clicking anywhere else, or pressing Escape, closes it.
const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");

function setSettingsOpen(open) {
  settingsPanel.hidden = !open;
  settingsButton.setAttribute("aria-expanded", String(open));
}

settingsButton.addEventListener("click", () => {
  setSettingsOpen(settingsPanel.hidden);
  settingsButton.blur(); // give the keyboard back to walking
  playClickSound();
});
document.addEventListener("click", (e) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) setSettingsOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsPanel.hidden) setSettingsOpen(false);
});

// --- Fitting the house to the window ---
// The house is scaled up (or down) so the whole thing fits beside the
// sidebar and under the header with no scrolling, and redrawn at the
// screen's real resolution so it stays sharp. Runs again whenever the
// window changes size (including zooming the page).
const houseWrap = document.getElementById("house-wrap");
const houseColumn = document.getElementById("house-column");
const sideColumn = document.getElementById("side-column");
const STACK_BELOW = 900; // narrower windows put the sidebar under the house (matches style.css)
const SIDEBAR_SPACE = 230 + 20; // sidebar width plus the gap
const FRAME = 8; // the house frame's border, both sides together

function fitHouse() {
  if (gameScreen.hidden) return;
  const { w, h } = houseViewSize();
  const stacked = window.innerWidth < STACK_BELOW;
  const availW = window.innerWidth - 32 - FRAME - (stacked ? 0 : SIDEBAR_SPACE);
  const top = houseWrap.getBoundingClientRect().top + window.scrollY;
  const below = houseColumn.offsetHeight - houseWrap.offsetHeight; // the prompt and controls lines
  const availH = window.innerHeight - top - below - FRAME - 8;
  let scale = Math.min(availW / w, availH / h);
  // Whole-number sizes (1x, 2x...) when that only costs a little space.
  if (scale >= 1 && Math.floor(scale) / scale >= 0.9) scale = Math.floor(scale);
  scale = Math.max(0.4, scale);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${Math.round(w * scale)}px`;
  canvas.style.height = `${Math.round(h * scale)}px`;
  canvas.width = Math.round(w * scale * dpr);
  canvas.height = Math.round(h * scale * dpr);
  setViewScale(canvas.width / w);
  // Beside the house, the sidebar column is as tall as the house, and the
  // chat box stretches to fill the extra height.
  sideColumn.style.minHeight = stacked ? "" : `${Math.round(h * scale) + FRAME}px`;
}

window.addEventListener("resize", fitHouse);

// --- Theater ---
// Theater messages only go to the people standing in the Theater.
initTheater(() => getPeers().filter((p) => p.room === "theater").map((p) => p.id));

// Clicking the house gives the keyboard back to the game (for example
// after clicking on the Theater's video, which keeps the keys otherwise).
canvas.addEventListener("mousedown", () => document.activeElement?.blur());

// --- Emotes ---
// Wave, heart, laugh, jig and sleepy: press 1 to 5, click the buttons in
// the sidebar, or type /wave, /heart, /laugh, /jig (or /hit the jig) or
// /sleepy in chat. Friends see them too. Walking stops yours early.
const EMOTE_KEYS = { 1: "wave", 2: "heart", 3: "laugh", 4: "jig", 5: "sleepy" };
const EMOTE_COMMANDS = {
  "/wave": "wave", "/heart": "heart", "/laugh": "laugh", "/lol": "laugh",
  "/jig": "jig", "/hit the jig": "jig", "/hitthejig": "jig", "/sleepy": "sleepy", "/sleep": "sleepy", "/zzz": "sleepy",
};
let myEmote = null; // { id, start }
const peerEmotes = {}; // peer id -> { id, start }

function startEmote(id) {
  if (!Object.hasOwn(EMOTE_LENGTHS, id)) return;
  myEmote = { id, start: performance.now() };
  sendEmote(id);
  if (id === "jig") playJigTune();
}

function stopMyEmote() {
  if (!myEmote) return;
  myEmote = null;
  sendEmote(null);
}

// An emote in the form the drawing code wants ({ id, t } with t in
// seconds), or null once it has run its course.
function emoteNow(emote) {
  if (!emote) return null;
  const t = (performance.now() - emote.start) / 1000;
  return t < EMOTE_LENGTHS[emote.id] ? { id: emote.id, t } : null;
}

onEmote((id, peerId) => {
  if (id === null) {
    delete peerEmotes[peerId];
    return;
  }
  if (typeof id !== "string" || !Object.hasOwn(EMOTE_LENGTHS, id)) return;
  peerEmotes[peerId] = { id, start: performance.now() };
  // A friend hitting the jig in the same room as you: you hear the tune too.
  const peer = getPeers().find((p) => p.id === peerId);
  if (id === "jig" && peer?.room === getCurrentRoom(player).id) playJigTune();
});

for (const button of document.querySelectorAll("#emote-bar button")) {
  button.addEventListener("click", () => {
    startEmote(button.dataset.emote);
    button.blur(); // give the keyboard back to walking
  });
}

// --- Whiteboard ---
initWhiteboard({ confirm: (options) => askConfirm(options) });

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

// True while you're typing in a text box (chat, or the Theater's link
// box), so letters don't move you or trigger E, F, K, L or R.
function isTyping(e) {
  return e.target instanceof HTMLInputElement && e.target.type === "text";
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
    empty.textContent = chatTab === "house" ? "Say hi to everyone! Press Enter to start typing. Emoji codes like :joy: and :sob: work too." : "Only people in this office can see this chat.";
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
  const typed = chatInput.value.trim();
  chatInput.blur(); // sending takes you straight back to walking
  // Emote commands like /jig do the emote instead of sending a message.
  const command = typed.toLowerCase().replace(/\s+/g, " ");
  if (Object.hasOwn(EMOTE_COMMANDS, command)) {
    chatInput.value = "";
    startEmote(EMOTE_COMMANDS[command]);
    return;
  }
  const text = clipText(expandEmoticons(expandShortcodes(typed)), CHAT_MAX_LENGTH);
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
  if (gameScreen.hidden || dialogOpen || isShopBusy()) return;
  if (e.key === "Enter" && !isTyping(e)) {
    e.preventDefault();
    for (const k in keysDown) keysDown[k] = false; // stop walking while typing
    chatInput.focus();
  } else if (isTyping(e) && (e.key === "Escape" || (e.key === "Enter" && e.target === chatInput && !chatInput.value.trim()))) {
    e.preventDefault();
    e.target.blur();
  }
});

// Emoji codes like :joy: turn into 😂 as you type.
chatInput.addEventListener("input", () => expandAsYouType(chatInput));

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
  if (!isTyping(e)) keysDown[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => (keysDown[e.key.toLowerCase()] = false));

function readMovement(dt) {
  let dx = 0;
  let dy = 0;
  if (dialogOpen || isShopBusy()) return { dx, dy }; // stay put while a pop-up is open
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
    stopMyEmote(); // walking off ends an emote
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
    if (previousRoomId === "theater") leaveTheater();
    if (previousRoomId === "library") leaveLibrary();
    if (currentRoom.id === "library") enterLibrary();
    if (previousRoomId === "conference") closeWhiteboard();
    if (currentRoom.id === "theater") enterTheater();
    if (previousRoomId !== null) playRoomChangeSound(currentRoom.id);
    previousRoomId = currentRoom.id;
  }
  updateLofi(dt);
  updateTheater();
  updateRain(dt);
  updateFocusTimer(currentRoom.id);

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    const officeInfo = myOffice ? { since: myOffice.since, locked: myOffice.locked } : null;
    broadcastPosition({ name: myName, color: myColor, hat: myHat, shoes: myShoes, x: player.x, y: player.y, room: currentRoom.id, tz: myTimeZone, office: officeInfo });
  }

  const scenePlayers = getPeers().map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    // A friend's hat name comes over the network, so only accept known hats.
    const hat = Object.hasOwn(HAT_DRAWERS, peer.hat) ? peer.hat : "none";
    const shoes = Object.hasOwn(SHOE_DRAWERS, peer.shoes) ? peer.shoes : "none";
    return { x: shown.x, y: shown.y, moving: shown.moving, color: peer.color, hat, shoes, name: peer.name, badge: peer.room === "dinner" ? "eating" : null, bubble: bubbleFor(peer.id), emote: emoteNow(peerEmotes[peer.id]) };
  });
  scenePlayers.push({ x: player.x, y: player.y, moving: dx !== 0 || dy !== 0, color: myColor, hat: myHat, shoes: myShoes, name: myName, badge: currentRoom.id === "dinner" ? "eating" : null, bubble: bubbleFor("me"), emote: emoteNow(myEmote) });
  updateChatTabs(currentRoom);
  drawScene(ctx, scenePlayers, studySignText());

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}
