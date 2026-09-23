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
  playPetSound,
  enterLibrary,
  leaveLibrary,
  setRainVolume,
  updateRain,
  enterSleep,
  leaveSleep,
  setWhiteNoiseVolume,
  updateWhiteNoise,
  playGoodnightChime,
  soundIsBlocked,
  resumeAudio,
} from "./audio.js";
import { initTheater, enterTheater, leaveTheater, updateTheater } from "./theater.js";
import { expandAsYouType, expandShortcodes, expandEmoticons } from "./emoji.js";
import { FREE_HATS, ownedHats, ownedShoes, ownedPets, itemName, checkShopAchievements, addCrumbs, startEarningCrumbs, initShop, isShopBusy, talkToRaccoons } from "./shop.js";
import { ACHIEVEMENTS, initAchievements, unlock, count, collect } from "./achievements.js";
import { initHome, myHome, friendDecor, forgetFriendDecor, sendMyDecorTo, isDecorating, heldPiece } from "./home.js";
import { initLaptop, openLaptop, isLaptopOpen, startMail } from "./laptop.js";
import { openProfile, isProfileOpen } from "./profile.js";
import { initAdmin } from "./admin.js";
import { isHouseReady } from "./account.js";
import { initUpdater, takeResume } from "./updater.js";
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
const petInput = document.getElementById("pet-input");
const characterPreview = document.getElementById("character-preview");
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const actionHint = document.getElementById("action-hint");
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");
const volumeSlider = document.getElementById("volume-slider");
const lofiVolumeSlider = document.getElementById("lofi-volume-slider");
const rainVolumeSlider = document.getElementById("rain-volume-slider");
const whiteNoiseSlider = document.getElementById("white-noise-slider");
const lofiPlayerContainer = document.getElementById("lofi-player");
const micStatus = document.getElementById("mic-status");
const confirmDialog = document.getElementById("confirm-dialog");

onPeerStream(handlePeerStream);
onPeerLeave((peerId) => {
  removePeerAudio(peerId);
  delete petTrails[peerId];
  forgetFriendDecor(peerId);
  playLeaveSound();
});
onPeerJoin((peerId) => {
  playJoinSound();
  // Send a friend who just arrived the whiteboard so far.
  sendBoardTo(peerId);
  // Let a friend who just arrived see the Study timer, if one is running.
  if (focusTimer) sendFocus(focusMessage(), peerId);
  // And how your bedroom is decorated.
  sendMyDecorTo(peerId);
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
whiteNoiseSlider.addEventListener("input", () => setWhiteNoiseVolume(parseFloat(whiteNoiseSlider.value)));
whiteNoiseSlider.addEventListener("change", () => playClickSound());
setWhiteNoiseVolume(CONFIG.defaultWhiteNoiseVolume);
whiteNoiseSlider.value = CONFIG.defaultWhiteNoiseVolume;

const canvas = document.getElementById("house");
const ctx = canvas.getContext("2d");

let myName = "Friend";
let myColor = "#e05a47";
let myHat = "none";
let myShoes = "none";
let myPet = "none";

// The hats and shoes you can pick: the free hats, plus whatever you've
// bought from the raccoons.
const hatChoices = () => [...FREE_HATS, ...ownedHats()];
const shoeChoices = () => [["none", "Plain feet"], ...ownedShoes()];
const petChoices = () => [["none", "No pet"], ...ownedPets()];

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
fillSelect(petInput, petChoices(), savedProfile?.pet);

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: myName, color: myColor, hat: myHat, shoes: myShoes, pet: myPet }));
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
  get: () => ({ color: myColor, hat: myHat, shoes: myShoes, pet: myPet }),
  wear: (type, id) => {
    if (type === "hat") myHat = id;
    else if (type === "shoes") myShoes = id;
    else myPet = id;
    saveProfile();
    fillSelect(hatInput, hatChoices(), myHat);
    fillSelect(shoesInput, shoeChoices(), myShoes);
    fillSelect(petInput, petChoices(), myPet);
  },
});

// Starting spot: roughly the middle of the hallway (grid units, not pixels).
const player = { x: 8.7, y: 1.2 };

joinButton.addEventListener("click", async () => {
  if (!isHouseReady()) return; // still logging in (account.js)
  myName = nameInput.value.trim() || "Friend";
  myColor = colorInput.value;
  myHat = hatChoices().some(([id]) => id === hatInput.value) ? hatInput.value : "none";
  myShoes = shoeChoices().some(([id]) => id === shoesInput.value) ? shoesInput.value : "none";
  myPet = petChoices().some(([id]) => id === petInput.value) ? petInput.value : "none";
  saveProfile();
  startEarningCrumbs();
  startMail();
  initAdmin({ teleport, rooms: () => ROOMS.filter((r) => r.rect).sort((a, b) => floorOf(a.rect.y) - floorOf(b.rect.y) || a.name.localeCompare(b.name)), refreshLook });

  joinScreen.hidden = true;
  gameScreen.hidden = false;
  primeSoundEffects();
  playClickSound();

  // Size the house to the window, then start drawing it right away,
  // instead of waiting for you to answer the browser's microphone question.
  fitHouse();
  requestAnimationFrame(tick);
  unlock("welcome");
  checkShopAchievements();
  setInterval(checkTimeAchievements, 5000);

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

// --- Offices and bedrooms ---
// Your own office and bedroom, if you've made them: { since, locked }.
// Your browser remembers them, so they come back each time you join.
// Nobody else stores them: they only exist while you're here.
const KINDS = ["office", "bedroom"];
const STORAGE_KEYS = { office: "cozy-house-office", bedroom: "cozy-house-bedroom" };
const mine = {}; // "office" or "bedroom" -> { since, locked }, or null
for (const kind of KINDS) {
  try {
    mine[kind] = JSON.parse(localStorage.getItem(STORAGE_KEYS[kind]));
  } catch {
    mine[kind] = null;
  }
}

function saveMine(kind) {
  try {
    if (mine[kind]) localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(mine[kind]));
    else localStorage.removeItem(STORAGE_KEYS[kind]);
  } catch {
    // Private windows can block storage; the room just won't be remembered.
  }
}

// What we tell friends about our office or bedroom (or null).
function claimInfo(kind) {
  if (!mine[kind]) return null;
  const info = { since: mine[kind].since, locked: mine[kind].locked };
  if (kind === "bedroom") info.size = myHome().size;
  return info;
}

let privateRooms = { office: [], bedroom: [] }; // everyone's, as passed to buildHouse
let houseSignature = "";

// A message about someone's office or bedroom is only trusted if it looks right.
function isValidClaim(o) {
  return o && typeof o.since === "number" && Number.isFinite(o.since);
}

// Collects everyone's offices (or bedrooms), in the order they were made
// (earliest first), and gives them spots 1, 2, 3... in that order. So when
// one is removed, the ones after it slide over to fill the gap. Every
// browser runs this same rule, so everyone agrees on who is where. If two
// people make the last one at the same moment, whoever was first keeps it.
function gatherClaims(kind, peers) {
  const claims = new Map(); // one each, even if a friend briefly shows up twice after a refresh
  for (const p of peers) {
    if (!isValidClaim(p[kind])) continue;
    const ownerName = String(p.name).slice(0, 16);
    const claim = { since: p[kind].since, locked: !!p[kind].locked, ownerName, ownerId: p.id, color: safeColor(p.color), mine: false };
    if (kind === "bedroom") {
      claim.size = Object.hasOwn(BEDROOM_SIZES, p[kind].size) ? p[kind].size : "cozy";
      claim.decor = friendDecor(p.id, claim.size);
    }
    claims.set(p[kind].since + "|" + ownerName, claim);
  }
  if (mine[kind]) {
    const claim = { since: mine[kind].since, locked: !!mine[kind].locked, ownerName: myName, color: safeColor(myColor), mine: true };
    if (kind === "bedroom") {
      claim.size = myHome().size;
      claim.decor = myHome().placed;
    }
    claims.set(mine[kind].since + "|" + myName, claim);
  }
  const sorted = [...claims.values()].sort((a, b) => a.since - b.since || a.ownerName.localeCompare(b.ownerName));
  const kept = sorted.slice(0, WINGS[kind].slots);
  if (mine[kind] && !kept.some((o) => o.mine)) {
    mine[kind] = null;
    saveMine(kind);
    showNotice(`Someone made the last ${kind} just before you. Try again when one frees up.`);
  }
  return kept.map((o, i) => ({ ...o, slot: i + 1 }));
}

// Where you pop back to if the room you're in disappears: the middle of
// the hallway, or of the landing if you're upstairs.
function spawnPoint(floor) {
  return { x: 8.7, y: floor ? LANDING + 1.2 : 1.2 };
}

// Rebuilds the house if anyone's office or bedroom appeared, disappeared,
// moved or got locked/unlocked since last frame.
function updatePrivateRooms() {
  for (const kind of KINDS) privateRooms[kind] = gatherClaims(kind, getPeers());
  const signature = JSON.stringify(privateRooms);
  if (signature === houseSignature) return;
  houseSignature = signature;
  const before = getCurrentRoom(player);
  buildHouse(privateRooms.office, privateRooms.bedroom);
  // If your room slid over to fill a gap, slide along with it.
  const after = ROOMS.find((r) => r.id === before.id);
  if (before.owned && after) player.x += after.rect.x - before.rect.x;
  // If the room you were standing in just vanished (its owner left), pop
  // back to the middle of the hallway (or landing).
  const box = { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  if (!isInsideARoom(player) || SOLIDS.some((s) => rectsOverlap(box, s))) Object.assign(player, spawnPoint(floorOf(player.y)));
}

// A short message that shows in the prompt line for a few seconds, like
// "Sam is knocking on your office door."
let notice = { text: "", until: 0 };

function showNotice(text) {
  notice = { text, until: performance.now() + 4000 };
}

// Knocks: someone at your locked office or bedroom door. Ignored if you
// don't have that room.
onKnock((peerId, kind) => {
  const which = kind === "bedroom" ? "bedroom" : "office";
  if (!mine[which]) return;
  const name = getPeers().find((p) => p.id === peerId)?.name || "Someone";
  playKnockSound();
  showNotice(`${String(name).slice(0, 16)} is knocking on your ${which} door.`);
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
      const sessions = count("focusSessions");
      unlock("focus");
      if (sessions >= 5) unlock("scholar");
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
// If there's nothing else to say and a pet is close by, it offers a pat.
function actionHintFor(room) {
  const hint = roomHintFor(room);
  if (hint || uiBusy()) return hint;
  const pet = petInReach();
  if (!pet) return "";
  const whose = pet.who === "me" ? "your" : `${pet.ownerName}'s`;
  return `Press E to pet ${whose} ${itemName(pet.kind).toLowerCase()}.`;
}

function roomHintFor(room) {
  if (performance.now() < notice.until) return notice.text;
  if (uiBusy()) return "";
  if (amAsleep) return "Sleeping. Walk out of bed to get up.";
  if (nearestInteraction(player) === "raccoons") return "Press E to talk to the raccoons.";
  if (nearestInteraction(player) === "laptop") return "Press E to open your laptop.";
  const lockedDoor = lockedDoorInFront(player);
  if (lockedDoor) return `${lockedDoor.owned.ownerName}'s ${lockedDoor.owned.kind} is locked. Press K to knock.`;
  if (room.owned?.mine) {
    const kind = room.owned.kind;
    const lock = mine[kind].locked ? "Press L to unlock the door" : "Press L to lock the door";
    const bed = kind === "bedroom" ? " Step into bed to sleep." : "";
    return `Your ${kind}. ${lock}, or R to remove your ${kind}.${bed}`;
  }
  if (room.owned?.kind === "bedroom") return "Step into the bed to sleep.";
  const buildKind = isNearBuildDoor(player);
  if (buildKind) {
    if (mine[buildKind]) return `You already have ${buildKind === "office" ? "an office" : "a bedroom"}.`;
    if (privateRooms[buildKind].length >= WINGS[buildKind].slots) return `All ${WINGS[buildKind].slots} ${buildKind}s are taken right now.`;
    return buildKind === "office" ? "Press E to build your office." : "Press E to make your bedroom.";
  }
  if (room.id === "stairs") return "Walk onto the stairs to go up.";
  if (room.id === "stairsUp") return "Walk onto the stairs to go down.";
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
  if (gameScreen.hidden || e.repeat || dialogOpen || uiBusy() || isTyping(e)) return;
  const key = e.key.toLowerCase();

  if (key === "e" && nearestInteraction(player) === "laptop") {
    for (const k in keysDown) keysDown[k] = false;
    openLaptop();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "raccoons") {
    for (const k in keysDown) keysDown[k] = false; // stop walking while you chat
    talkToRaccoons();
    return;
  }

  // Petting a pet (yours or a friend's), when nothing else is in reach.
  const pet = key === "e" && !nearestInteraction(player) ? petInReach() : null;
  if (pet) {
    pet.trail.pettedAt = performance.now();
    playPetSound();
    unlock("patPat");
    if (pet.who !== "me") unlock("pettingZoo");
  }

  const buildKind = isNearBuildDoor(player);
  if (key === "e" && buildKind && !mine[buildKind] && privateRooms[buildKind].length < WINGS[buildKind].slots) {
    mine[buildKind] = { since: Date.now(), locked: false };
    saveMine(buildKind);
    playClickSound();
    unlock(buildKind === "office" ? "office" : "bedroomMade");
  }

  const here = getCurrentRoom(player).owned;
  if (key === "l" && here?.mine) {
    mine[here.kind].locked = !mine[here.kind].locked;
    saveMine(here.kind);
    playClickSound();
    if (mine[here.kind].locked) unlock("lock");
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
    sendKnock(lockedDoor.owned.ownerId, lockedDoor.owned.kind);
    playKnockSound();
    showNotice(`You knocked. ${lockedDoor.owned.ownerName} will hear it.`);
    unlock("knock");
  }

  // Removing asks first, since it can't be undone (though you can always
  // make a new one). You get moved back to the hallway or landing once
  // it's gone.
  if (key === "r" && here?.mine) {
    const kind = here.kind;
    askConfirm({
      title: `Remove your ${kind}?`,
      text: `Anyone inside will be moved back to the ${kind === "office" ? "hallway" : "landing"}. You can always make a new one at the "+" door.`,
      yes: `Remove ${kind}`,
      no: "Keep it",
    }).then((remove) => {
      if (remove && mine[kind]) {
        mine[kind] = null;
        saveMine(kind);
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
  // Beside the house, the sidebar column is exactly as tall as the house,
  // and the chat's message area fills whatever height is left (scrolling
  // inside itself), so chatting never makes the page longer.
  sideColumn.style.height = stacked ? "" : `${Math.round(h * scale) + FRAME}px`;
}

window.addEventListener("resize", fitHouse);

// --- Theater ---
// Theater messages only go to the people standing in the Theater.
initTheater(() => getPeers().filter((p) => p.room === "theater").map((p) => p.id));

// Clicking the house gives the keyboard back to the game (for example
// after clicking on the Theater's video, which keeps the keys otherwise).
canvas.addEventListener("mousedown", () => document.activeElement?.blur());

// Clicking someone's character opens their profile (not while decorating,
// when clicks move furniture).
let lastScenePlayers = [];
canvas.addEventListener("click", (e) => {
  if (isDecorating() || uiBusy()) return;
  const r = canvas.getBoundingClientRect();
  const g = screenToGrid(canvas, e.clientX - r.left, e.clientY - r.top);
  const hit = lastScenePlayers.find((p) => Math.hypot(g.x - (p.x + PLAYER_SIZE / 2), g.y - (p.y + PLAYER_SIZE - 0.45)) < 0.5);
  if (hit) openProfile(hit.name);
});

// Admin panel: jump to the middle of any room (the nearest free spot).
function teleport(roomId) {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return false;
  const { x, y, w, h } = room.rect;
  const fits = (px, py) => {
    const box = { x: px, y: py, w: PLAYER_SIZE, h: PLAYER_SIZE };
    return px >= x && py >= y && px + PLAYER_SIZE <= x + w && py + PLAYER_SIZE <= y + h && !SOLIDS.some((s) => rectsOverlap(box, s));
  };
  for (let ring = 0; ring < 12; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
        const px = x + w / 2 - PLAYER_SIZE / 2 + dx * 0.3, py = y + h / 2 - PLAYER_SIZE / 2 + dy * 0.3;
        if (fits(px, py)) {
          Object.assign(player, { x: px, y: py });
          for (const k in keysDown) keysDown[k] = false;
          return true;
        }
      }
    }
  }
  return false;
}

// After the admin panel unlocks things: refresh the hat, shoe and pet lists.
function refreshLook() {
  fillSelect(hatInput, hatChoices(), myHat);
  fillSelect(shoesInput, shoeChoices(), myShoes);
  fillSelect(petInput, petChoices(), myPet);
}

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

  // Achievements for emotes.
  const room = getCurrentRoom(player).id;
  if (collect("emotes", id).length >= Object.keys(EMOTE_KEYS).length) unlock("expressive");
  if (id === "sleepy" && room === "dinner") unlock("foodComa");
  if (id === "jig") {
    unlock("jig");
    if (room === "theater") unlock("danceFloor");
    if (Object.values(peerEmotes).some((e) => emoteNow(e)?.id === "jig")) unlock("jigParty");
  }
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
  if (id === "jig" && emoteNow(myEmote)?.id === "jig") unlock("jigParty");
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
const chatNewButton = document.getElementById("chat-new");

let chatTab = "house"; // which tab is showing
let chatLines = []; // { channel: "house" or an office id like "office-2", name, color, text }
const unread = { house: false, office: false };
const bubbles = {}; // "me" or a peer id -> { text, until }
let lastChatSent = 0;
let lastOfficeRoomId = null; // the office you're standing in, if any

// True while you're typing in a text box (chat, or the Theater's link
// box), so letters don't move you or trigger E, F, K, L or R.
// True while the raccoons, the laptop or decorating has the keyboard (the
// game's own keys and walking pause meanwhile).
function uiBusy() {
  return isShopBusy() || isLaptopOpen() || isDecorating() || isProfileOpen();
}

function isTyping(e) {
  return (e.target instanceof HTMLInputElement && e.target.type === "text") || e.target instanceof HTMLTextAreaElement;
}

function bubbleFor(who) {
  const b = bubbles[who];
  return b && performance.now() < b.until ? b.text : null;
}

// True while you're in the middle of writing a chat message (the chat box
// has the cursor and something in it). Friends see a thinking face and
// bouncing dots over your character.
function amTyping() {
  return document.activeElement === chatInput && chatInput.value.trim() !== "";
}

// True if the message area is scrolled all the way down (or nearly).
function chatAtBottom() {
  return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 12;
}

function scrollChatToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
  chatNewButton.hidden = true;
}

// Redraws the messages for the current tab. If you were at the bottom (or
// `toBottom` is set), it stays at the newest message; if you'd scrolled
// up to read, it leaves you where you were, and `newMessage` shows the
// "New messages" button.
function renderChat({ toBottom = false, newMessage = false } = {}) {
  const wasAtBottom = chatAtBottom();
  const scrolledTo = chatLog.scrollTop;
  const channel = chatTab === "house" ? "house" : lastOfficeRoomId;
  const lines = chatLines.filter((l) => l.channel === channel);
  chatLog.innerHTML = "";
  if (lines.length === 0) {
    const empty = document.createElement("li");
    empty.className = "chat-empty";
    empty.textContent = chatTab === "house" ? "Say hi to everyone! Press Enter to start typing. Emoji codes like :joy: and :sob: work too." : "Only people in this room can see this chat.";
    chatLog.appendChild(empty);
  }
  for (const line of lines) {
    // Built with textContent (never innerHTML), since friends' names and
    // messages come over the network.
    const li = document.createElement("li");
    if (line.system) {
      // A note from the house, like "Sam earned an achievement".
      li.className = "chat-system";
      li.textContent = line.text;
      chatLog.appendChild(li);
      continue;
    }
    const name = document.createElement("span");
    name.className = "chat-name";
    name.style.color = safeColor(line.color);
    name.textContent = line.name + ": ";
    li.append(name, document.createTextNode(line.text));
    chatLog.appendChild(li);
  }
  if (toBottom || wasAtBottom) {
    scrollChatToBottom();
  } else {
    chatLog.scrollTop = scrolledTo;
    if (newMessage) chatNewButton.hidden = false;
  }
  chatTabs.house.querySelector(".unread-dot").hidden = !unread.house;
  chatTabs.office.querySelector(".unread-dot").hidden = !unread.office;
}

// Adds a message. Your own messages always jump to the bottom, so you see
// what you just sent.
function addChatLine(line, mine = false) {
  chatLines.push(line);
  if (chatLines.length > 200) chatLines = chatLines.slice(-200); // keep it light
  const tabForLine = line.channel === "house" ? "house" : "office";
  if (tabForLine !== chatTab) unread[tabForLine] = true;
  renderChat({ toBottom: mine, newMessage: tabForLine === chatTab });
}

chatNewButton.addEventListener("click", () => {
  scrollChatToBottom();
  chatInput.blur();
});
chatLog.addEventListener("scroll", () => {
  if (chatAtBottom()) chatNewButton.hidden = true;
});

function switchChatTab(tab) {
  chatTab = tab;
  unread[tab] = false;
  chatTabs.house.classList.toggle("active", tab === "house");
  chatTabs.office.classList.toggle("active", tab === "office");
  renderChat({ toBottom: true });
}

chatTabs.house.addEventListener("click", () => switchChatTab("house"));
chatTabs.office.addEventListener("click", () => switchChatTab("office"));

// Called every frame: the Office tab only works while you're in an office,
// and its label shows which one.
function updateChatTabs(room) {
  const officeId = room.owned ? room.id : null;
  if (officeId === lastOfficeRoomId) return;
  lastOfficeRoomId = officeId;
  chatTabs.office.disabled = !officeId;
  chatTabs.office.title = officeId ? room.name : "Walk into an office or bedroom to chat there";
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
  const sent = count("chats");
  unlock("hello");
  if (sent >= 100) unlock("chatterbox");

  if (chatTab === "office" && lastOfficeRoomId) {
    const inThisOffice = getPeers().filter((p) => p.room === lastOfficeRoomId).map((p) => p.id);
    sendChat({ text, office: lastOfficeRoomId }, inThisOffice);
    addChatLine({ channel: lastOfficeRoomId, name: myName, color: myColor, text }, true);
  } else {
    sendChat({ text });
    addChatLine({ channel: "house", name: myName, color: myColor, text }, true);
  }
  bubbles.me = { text, until: performance.now() + 6000 };
});

// Enter starts typing; Enter sends and goes back to walking; Escape goes
// back to walking without sending.
window.addEventListener("keydown", (e) => {
  if (gameScreen.hidden || dialogOpen || uiBusy()) return;
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
  const peer = getPeers().find((p) => p.id === peerId);
  const peerName = String(peer?.name ?? "Someone").slice(0, 16);
  // A friend unlocked an achievement.
  const earned = ACHIEVEMENTS.find((a) => a.id === message?.achievement);
  if (earned) {
    addChatLine({ channel: "house", system: true, text: `🏆 ${peerName} earned "${earned.name}"` });
    return;
  }
  // A friend went to bed, or got up.
  if (typeof message?.bedtime === "boolean") {
    addChatLine({ channel: "house", system: true, text: message.bedtime ? `🌙 ${peerName} went to bed.` : `☀️ ${peerName} got up.` });
    return;
  }
  if (typeof message?.text !== "string") return;
  const text = clipText(message.text.trim(), CHAT_MAX_LENGTH);
  if (!text) return;
  let channel = "house";
  if (message.office !== undefined) {
    // Office chat: only show it if we're standing in that office right now.
    if (message.office !== getCurrentRoom(player).id) return;
    channel = message.office;
  }
  addChatLine({ channel, name: peerName, color: peer?.color, text });
  bubbles[peerId] = { text, until: performance.now() + 6000 };
  playChatSound();
});

renderChat();

// --- Your bedroom home and its laptop ---
// home.js keeps your room's decor and runs Nest & Nook and decorating;
// laptop.js runs the laptop (mail and news).
initHome({
  color: () => myColor,
  myRoom: () => ROOMS.find((r) => r.owned?.mine && r.owned.kind === "bedroom")?.rect ?? null,
  notice: (text) => showNotice(text),
});
initLaptop({
  name: () => myName,
  color: () => myColor,
  notice: (text) => showNotice(text),
  onLetter: (letter) => {
    showNotice(`📬 A letter from ${letter.from}! Read it on your bedroom laptop.`);
    addChatLine({ channel: "house", system: true, text: `📬 You got a letter from ${letter.from}. Read it on your bedroom laptop.` });
    playChatSound();
  },
});

// --- Sleeping ---
// Step into a bed and you fall asleep: you're drawn tucked in with your
// eyes closed and Z's drifting up, a "sleeping" badge shows over you, your
// mic turns off, you hear nobody, and soft white noise plays (its own
// slider is in the sound settings). Friends see "Sam went to bed." in the
// House chat. Walk out of bed to get up.
let amAsleep = false;
let lastBedtimeNote = -Infinity;

function updateSleep() {
  const asleepNow = !!bedAt(player);
  if (asleepNow === amAsleep) return;
  if (asleepNow) {
    playGoodnightChime(); // before sounds go quiet
    amAsleep = true;
    enterSleep();
    showNotice(`Goodnight, ${myName}. Sleep tight.`);
    unlock("goodnight");
  } else {
    amAsleep = false;
    leaveSleep();
  }
  // Tell friends, but not every time someone hops in and out of bed.
  if (performance.now() - lastBedtimeNote > 10000) {
    lastBedtimeNote = performance.now();
    sendChat({ bedtime: amAsleep });
    addChatLine({ channel: "house", system: true, text: amAsleep ? "🌙 You went to bed." : "☀️ You got up." });
  }
}

// The badge over someone: "eating" in Dinner, "sleeping" in bed.
function statusBadge(roomId, bed) {
  if (bed) return "sleeping";
  return roomId === "dinner" ? "eating" : null;
}

// Where someone asleep is drawn: in the middle of the bed with their head
// on the pillows (wherever they actually stepped in).
function tuckedIn(bed) {
  return { x: bed.x + bed.w / 2 - PLAYER_SIZE / 2, y: bed.y + 0.45 };
}

// The sleepy face and drifting Z's, on a loop, for anyone asleep.
function sleepingEmote() {
  return { id: "sleepy", t: (performance.now() / 1000) % EMOTE_LENGTHS.sleepy };
}

// --- Achievements ---
// Each one gives crumbs, and friends see a line in the House chat.
initAchievements({
  reward: (crumbs) => addCrumbs(crumbs),
  announce: (id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    sendChat({ achievement: id });
    addChatLine({ channel: "house", system: true, text: `🏆 You earned "${a.name}" (+${a.crumbs} crumbs)` });
  },
});

// Every room counts for the Grand Tour (any office will do).
const TOUR_ROOMS = ["hallway", "theater", "study", "dinner", "conference", "library", "office"];

// Checked every 5 seconds while you're in the house: time spent, time of
// day, and who's around.
function checkTimeAchievements() {
  const room = getCurrentRoom(player).id;
  const peers = getPeers();
  const seconds = count("seconds", 5);
  if (seconds >= 60 * 60) unlock("hour");
  if (seconds >= 10 * 60 * 60) unlock("homebody");
  if (seconds >= 50 * 60 * 60) unlock("resident");
  if (room === "library" && count("librarySeconds", 5) >= 15 * 60) unlock("bookworm");
  if (room === "dinner" && count("dinnerSeconds", 5) >= 10 * 60) unlock("snack");
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 4) unlock("nightOwl");
  if (hour >= 5 && hour < 7) unlock("earlyBird");
  if (peers.length >= 3) unlock("fullHouse");
  if (peers.some((p) => p.room === room)) unlock("roommates");
  if (amAsleep && count("sleepSeconds", 5) >= 30 * 60) unlock("wellRested");
  if (room.startsWith("bedroom-") && peers.some((p) => p.room === room)) unlock("sleepover");
}

// --- Pets ---
// Each pet trots along the path its owner walked, so it goes through
// doorways (not walls) just like they did, and sits down once it's close
// enough. Every browser works this out for itself from where people are,
// so pets need no extra messages: only which pet you have is sent.
const PET_GAP = 0.85; // how close a pet likes to stay to its owner (grid units)
const PET_REACH = 1.0; // how close you need to be to pet one
const petTrails = {}; // "me" or a peer id -> { points, x, y, facing, moving, pettedAt }
let petsNow = []; // the pets drawn this frame

// Moves one pet for this frame. (fx, fy) is where the owner's feet are.
function followOwner(who, fx, fy, dt) {
  let trail = petTrails[who];
  if (!trail || Math.hypot(fx - trail.x, fy - trail.y) > 4) {
    // A new pet, or the owner jumped (like popping back to the hallway):
    // start just beside them.
    trail = petTrails[who] = { points: [], x: fx - PET_GAP, y: fy, facing: 1, moving: false, pettedAt: trail?.pettedAt ?? -Infinity };
  }
  const startX = trail.x, startY = trail.y;
  const distance = Math.hypot(fx - trail.x, fy - trail.y);
  if (distance <= PET_GAP) {
    // Close enough: sit, and follow from here next time they walk off.
    trail.points = [{ x: fx, y: fy }];
  } else {
    const last = trail.points.at(-1);
    if (!last || Math.hypot(fx - last.x, fy - last.y) > 0.05) trail.points.push({ x: fx, y: fy });
    // A little faster than walking, and faster still if it's fallen behind.
    let step = CONFIG.playerSpeed * (1.05 + Math.max(0, distance - PET_GAP - 0.6)) * dt;
    while (step > 0 && trail.points.length > 0) {
      const target = trail.points[0];
      const d = Math.hypot(target.x - trail.x, target.y - trail.y);
      if (d <= step) {
        trail.x = target.x;
        trail.y = target.y;
        trail.points.shift();
        step -= d;
      } else {
        trail.x += ((target.x - trail.x) * step) / d;
        trail.y += ((target.y - trail.y) * step) / d;
        step = 0;
      }
      if (Math.hypot(fx - trail.x, fy - trail.y) <= PET_GAP) break;
    }
  }
  const dx = trail.x - startX;
  trail.moving = Math.hypot(dx, trail.y - startY) > 0.001;
  // Face the way it walks, or look at its owner while sitting.
  const look = trail.moving ? dx : fx - trail.x;
  if (Math.abs(look) > 0.001) trail.facing = Math.sign(look);
  return trail;
}

// Works out every pet's spot for this frame, from the players being drawn.
function updatePets(scenePlayers, dt) {
  petsNow = [];
  for (const p of scenePlayers) {
    if (!Object.hasOwn(PET_DRAWERS, p.pet)) continue;
    const trail = followOwner(p.id, p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE, dt);
    petsNow.push({
      who: p.id,
      ownerName: p.name,
      kind: p.pet,
      trail,
      x: trail.x,
      y: trail.y,
      facing: trail.facing,
      moving: trail.moving,
      seed: p.id === "me" ? 0 : (p.id.charCodeAt(0) % 10) * 0.7, // so pets don't blink in step
      petted: (performance.now() - trail.pettedAt) / 1000,
    });
  }
  return petsNow;
}

// The closest pet you could pet right now, or null.
function petInReach() {
  const fx = player.x + PLAYER_SIZE / 2, fy = player.y + PLAYER_SIZE;
  let best = null, bestDistance = PET_REACH;
  for (const pet of petsNow) {
    const d = Math.hypot(pet.x - fx, pet.y - fy);
    if (d < bestDistance) [best, bestDistance] = [pet, d];
  }
  return best;
}

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
// Keys you were holding when you took the stairs: ignored until you let
// go of them, so holding an arrow key doesn't walk you straight back onto
// the stairs on the other floor.
const ignoreUntilUp = new Set();
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (!isTyping(e) && !ignoreUntilUp.has(key)) keysDown[key] = true;
});
window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keysDown[key] = false;
  ignoreUntilUp.delete(key);
});

function readMovement(dt) {
  let dx = 0;
  let dy = 0;
  if (dialogOpen || uiBusy()) return { dx, dy }; // stay put while a pop-up is open
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
function peerRow(color, text, outdated = false, name = "") {
  const tag = outdated ? ' <span class="peer-outdated" title="They\'re on an older version of the house. Ask them to refresh (Ctrl + F5).">needs refresh</span>' : "";
  const who = escapeHtml(String(name));
  return `<li data-name="${who}" title="See ${who}'s profile"><span class="peer-dot" style="background:${safeColor(color)}"></span><span>${escapeHtml(text)}${tag}</span></li>`;
}

// Clicking a name in "Who's here" opens their profile. (The list is
// redrawn every frame, so this listens for the press, not the click.)
peerList.addEventListener("mousedown", (e) => {
  const name = e.target.closest("li[data-name]")?.dataset.name;
  if (name) openProfile(name);
});

// This page's build number (from the little tag in the corner). It's sent
// to friends, so anyone on an older version shows up as "needs refresh".
const MY_BUILD = document.getElementById("version-tag").textContent.replace("build", "").trim();

function updateSidebar(myRoomName) {
  let rows = peerRow(myColor, `${myName} (you) · ${amAsleep ? "💤 " : ""}${myRoomName} · ${formatLocalTime(myTimeZone)}`, false, myName);
  for (const peer of getPeers()) {
    const time = formatLocalTime(peer.tz);
    const roomName = (bedAt(peer) ? "💤 " : "") + roomNameFor(peer.room);
    rows += peerRow(peer.color, `${peer.name} · ${roomName}${time ? " · " + time : ""}`, peer.build !== MY_BUILD, peer.name);
  }
  peerList.innerHTML = rows;
}

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap so a tab-switch pause doesn't teleport the player
  lastTime = now;

  updatePrivateRooms();

  const { dx, dy } = readMovement(dt);
  if (dx !== 0 || dy !== 0) {
    movePlayer(player, dx, dy);
    stopMyEmote(); // walking off ends an emote
    // Walked onto the stairs: arrive on the other floor, standing still
    // until you let go of the keys you were walking with.
    const arrive = stairsDestination(player);
    if (arrive) {
      Object.assign(player, arrive);
      for (const k in keysDown) {
        if (keysDown[k]) ignoreUntilUp.add(k);
        keysDown[k] = false;
      }
    }
  }
  updateSleep();

  const currentRoom = getCurrentRoom(player);
  roomLabel.textContent = "📍 " + currentRoom.name;
  const hint = actionHintFor(currentRoom);
  if (actionHint.textContent !== hint) actionHint.textContent = hint;
  // While you're asleep, you count as "asleep" for sound: no mic, no voices.
  const soundRoom = amAsleep ? "asleep" : currentRoom.id;
  updateMicForRoom(soundRoom);
  updateVoiceRouting(soundRoom, getPeers());

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
    const visited = collect("rooms", currentRoom.owned ? currentRoom.owned.kind : currentRoom.id);
    if (TOUR_ROOMS.every((r) => visited.includes(r))) unlock("tour");
  }
  updateLofi(dt);
  updateTheater();
  updateRain(dt);
  updateWhiteNoise(dt);
  updateFocusTimer(currentRoom.id);

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    broadcastPosition({ name: myName, color: myColor, hat: myHat, shoes: myShoes, pet: myPet, x: player.x, y: player.y, room: currentRoom.id, tz: myTimeZone, office: claimInfo("office"), bedroom: claimInfo("bedroom"), typing: amTyping(), build: MY_BUILD });
  }

  const scenePlayers = getPeers().map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    // A friend's hat name comes over the network, so only accept known hats.
    const hat = Object.hasOwn(HAT_DRAWERS, peer.hat) ? peer.hat : "none";
    const shoes = Object.hasOwn(SHOE_DRAWERS, peer.shoes) ? peer.shoes : "none";
    const pet = Object.hasOwn(PET_DRAWERS, peer.pet) ? peer.pet : "none";
    const bed = bedAt(shown);
    const at = bed ? tuckedIn(bed) : shown;
    return { id: peer.id, pet, x: at.x, y: at.y, moving: shown.moving, color: peer.color, hat, shoes, name: peer.name, badge: statusBadge(peer.room, bed), bubble: bubbleFor(peer.id), emote: bed ? sleepingEmote() : emoteNow(peerEmotes[peer.id]), typing: peer.typing === true, asleep: bed && { color: bed.color } };
  });
  lastScenePlayers = scenePlayers;
  const myBed = bedAt(player);
  const myAt = myBed ? tuckedIn(myBed) : player;
  scenePlayers.push({ id: "me", pet: myPet, x: myAt.x, y: myAt.y, moving: dx !== 0 || dy !== 0, color: myColor, hat: myHat, shoes: myShoes, name: myName, badge: statusBadge(currentRoom.id, myBed), bubble: bubbleFor("me"), emote: myBed ? sleepingEmote() : emoteNow(myEmote), typing: amTyping(), asleep: myBed && { color: myBed.color } });
  updateChatTabs(currentRoom);
  drawScene(ctx, scenePlayers, studySignText(), updatePets(scenePlayers, dt), floorOf(player.y), heldPiece());

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}

// --- Updates without refreshing ---
// updater.js checks for a new build every minute and reloads the page for
// you (after a short countdown, and never while you're typing or have
// something open). Coming back from one of those, you skip the Join screen
// and land where you were.
function inTheMiddleOfSomething() {
  const typingSomething = (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) && document.activeElement.value;
  return dialogOpen || uiBusy() || !!typingSomething;
}

initUpdater({
  build: MY_BUILD,
  where: () => (gameScreen.hidden ? null : { x: player.x, y: player.y }),
  busy: inTheMiddleOfSomething,
});

const resume = takeResume();
if (resume) {
  // Wait until we're logged in and know how to reach the house, then join
  // just like clicking Join, and step back to where you were.
  const started = Date.now();
  const tryJoin = () => {
    if (!isHouseReady()) {
      if (Date.now() - started < 30_000) setTimeout(tryJoin, 200);
      return;
    }
    joinButton.click();
    Object.assign(player, { x: resume.x, y: resume.y });
    if (!isInsideARoom(player)) Object.assign(player, spawnPoint(floorOf(player.y)));
    // The browser holds sound back until you click: say so.
    setTimeout(() => {
      if (!soundIsBlocked()) return;
      const hint = document.getElementById("sound-hint");
      hint.hidden = false;
      const wake = () => {
        resumeAudio();
        hint.hidden = true;
        window.removeEventListener("pointerdown", wake, true);
        window.removeEventListener("keydown", wake, true);
      };
      window.addEventListener("pointerdown", wake, true);
      window.addEventListener("keydown", wake, true);
    }, 1500);
  };
  tryJoin();
}
