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
  myPeerId,
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
  playElevatorDing,
  playHourlyChime,
  playKnockSound,
  playTimerChime,
  playChatSound,
  playDanceTune,
  isDanceId,
  isSpeaking,
  setWhisperTarget,
  whisperTarget,
  playPetSound,
  enterLibrary,
  leaveLibrary,
  setOutsideRain,
  setCampfireSound,
  updateCampfireSound,
  setRainVolume,
  updateRain,
  enterSleep,
  leaveSleep,
  setWhiteNoiseVolume,
  updateWhiteNoise,
  playGoodnightChime,
  soundIsBlocked,
  resumeAudio,
  setBedroomAudioLookup,
} from "./audio.js";
import { initTheater, enterTheater, leaveTheater, updateTheater } from "./theater.js";
import { expandAsYouType, expandShortcodes, expandEmoticons } from "./emoji.js";
import { FREE_HATS, ownedHats, ownedShoes, ownedPets, ownedGlasses, ownedOfType, ownedCount, ownedValue, crumbBalance, itemName, checkShopAchievements, addCrumbs, startEarningCrumbs, initShop, isShopBusy, talkToRaccoons } from "./shop.js";
import { ACHIEVEMENTS, initAchievements, unlock, count, collect, setStat, myStats, checkTiers } from "./achievements.js";
import { initHome, myHome, shareMyRoom, isDecorating, heldPiece } from "./home.js";
import { openTurntable, isTurntableOpen, applyMyLofi, myLofiStation } from "./turntable.js";
import { addRoomTime, roomLevels } from "./reputation.js";
import { titleText, titleList, checkNewTitles } from "./titles.js";
import { initWardrobe, openWardrobe, isWardrobeOpen, myAura, cleanAura, myDance, mountOutfitPicker, renderOutfitPicker, randomOutfit } from "./wardrobe.js";
import { startKanban, openKanban, isKanbanOpen, busyBuilders } from "./kanban.js";
import { startRooms, refreshRooms, bedroomDoors, openDoorPanel, isDoorPanelOpen, askToEnter, leftRoom, letIn } from "./rooms.js";
import { initLaptop, openLaptop, isLaptopOpen, startMail } from "./laptop.js";
import { openJournal, isJournalOpen } from "./journal.js";
import { initPhone, openPhonePanel, closePhonePanel, isPhonePanelOpen, hangUp, inCall, phoneBusy, checkCall } from "./phone.js";
import { openProfile, isProfileOpen } from "./profile.js";
import { initAdmin } from "./admin.js";
import { isHouseReady, myBadge, checkBadge, checkRoomPass } from "./account.js";
import { initUpdater, takeResume } from "./updater.js";
import { startWeather } from "./weather.js";
import { startGarden, gardenHint, useGardenBed, talkToHazel, isSeedPickerOpen } from "./garden.js";
import { isNpcOpen } from "./npc.js";
import { initFishing, isFishing, isReeling, fishingHint, useFishing, stopFishing, fishingLine, talkToOtis, openFishTank } from "./fishing.js";
import { isBasketOpen } from "./basket.js";
import { initWhiteboard, openWhiteboard, closeWhiteboard, isWhiteboardOpen, sendBoardTo, loadSavedBoard } from "./whiteboard.js";

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
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const actionHint = document.getElementById("action-hint");
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");

// --- The hallway clock's hourly chime ---
// Checks every few seconds whether your local hour has changed, and if so
// chimes (unless you've turned it off in Settings). The setting is
// remembered in this browser.
const chimeToggle = document.getElementById("chime-toggle");
const CHIME_KEY = "cozy-house-chime";
try {
  const saved = localStorage.getItem(CHIME_KEY);
  chimeToggle.checked = saved === null ? CONFIG.hourlyChime.on : saved === "on";
} catch {
  chimeToggle.checked = CONFIG.hourlyChime.on;
}
chimeToggle.addEventListener("change", () => {
  try {
    localStorage.setItem(CHIME_KEY, chimeToggle.checked ? "on" : "off");
  } catch {
    // Storage blocked: it just won't be remembered.
  }
});
let lastChimeHour = new Date().getHours();
setInterval(() => {
  const hour = new Date().getHours();
  if (hour === lastChimeHour) return;
  lastChimeHour = hour;
  if (chimeToggle.checked && !gameScreen.hidden) playHourlyChime(hour);
}, CONFIG.hourlyChime.checkSeconds * 1000);
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
let myGlasses = "none";
let myFace = cleanFace(null); // eyes, mouth, blush and freckles (the wardrobe's Face tab)
// Scarf, backpack and earrings (Update 3), and any other slot added to
// CONFIG.outfitSlots later: each an item id, or "none".
const ACCESSORY_SLOTS = CONFIG.outfitSlots.map((s) => s.slot).filter((slot) => !["hat", "shoes", "glasses", "pet"].includes(slot));
const myAccessories = Object.fromEntries(ACCESSORY_SLOTS.map((slot) => [slot, "none"]));
let myTitle = "none"; // the title under your name tag (titles.js), or "none"
const accessoryChoices = (slot) => [["none", "None"], ...ownedOfType(slot)];
// Only accessories you own (anything else is taken off).
const ownedAccessory = (slot, id) => (accessoryChoices(slot).some(([owned]) => owned === id) ? id : "none");

// The hats and shoes you can pick: the free hats, plus whatever you've
// bought from the raccoons.
const hatChoices = () => [...FREE_HATS, ...ownedHats()];
const shoeChoices = () => [["none", "Plain feet"], ...ownedShoes()];
const petChoices = () => [["none", "No pet"], ...ownedPets()];
const glassesChoices = () => [["none", "No glasses"], ...ownedGlasses()];
// What you can pick in each outfit slot (CONFIG.outfitSlots), by its tab.
const outfitChoices = () =>
  Object.fromEntries(CONFIG.outfitSlots.map(({ tab, slot, none }) => [tab, slot === "hat" ? hatChoices() : [["none", none], ...ownedOfType(slot)]]));
// An item id if it's one of your choices, otherwise "none".
const ownedOr = (choices, id) => (choices.some(([owned]) => owned === id) ? id : "none");

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
  if (/^#[0-9a-fA-F]{6}$/.test(savedProfile.color)) myColor = savedProfile.color;
}
myHat = ownedOr(hatChoices(), savedProfile?.hat);
myShoes = ownedOr(shoeChoices(), savedProfile?.shoes);
myPet = ownedOr(petChoices(), savedProfile?.pet);
myGlasses = ownedOr(glassesChoices(), savedProfile?.glasses);
myFace = cleanFace(savedProfile?.face);
for (const slot of ACCESSORY_SLOTS) myAccessories[slot] = ownedAccessory(slot, savedProfile?.[slot]);
myTitle = typeof savedProfile?.title === "string" ? savedProfile.title : "none";

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: myName, color: myColor, hat: myHat, shoes: myShoes, pet: myPet, glasses: myGlasses, face: myFace, ...myAccessories, title: myTitle }));
  } catch {
    // Storage blocked (e.g. private window): just won't be remembered.
  }
}

// The wardrobe (wardrobe.js) changes your look from your bedroom, and
// its outfit picker is on the Join screen too (see below).
initWardrobe({
  name: () => nameInput.value.trim() || myName, // (on the Join screen, your account's name)
  look: () => ({ color: myColor, hat: myHat, shoes: myShoes, pet: myPet, glasses: myGlasses, face: myFace, ...myAccessories, title: myTitle }),
  titles: () => titleList(),
  choices: outfitChoices,
  wear: (type, id) => {
    if (type === "color") myColor = id;
    else if (type === "hat") myHat = id;
    else if (type === "shoes") myShoes = id;
    else if (type === "glasses") myGlasses = id;
    else if (type === "face") myFace = cleanFace(id); // (here `id` is the whole face)
    else if (ACCESSORY_SLOTS.includes(type)) myAccessories[type] = id;
    else if (type === "title") myTitle = id;
    else myPet = id;
    saveProfile();
  },
});

// --- The Join screen's outfit ---
// "Quick join": just you (and your pet) and the Join button. "Edit outfit"
// opens the same picker as the wardrobe: colors, tabs and tiles.
const joinPicker = mountOutfitPicker({ preview: "join-preview", colors: "join-colors", tabs: "join-tabs", items: "join-items" });
const joinOutfit = document.getElementById("join-outfit");
const editOutfitButton = document.getElementById("join-edit-outfit");
editOutfitButton.addEventListener("click", () => {
  const open = joinOutfit.hidden;
  joinOutfit.hidden = !open;
  joinScreen.classList.toggle("editing", open);
  editOutfitButton.textContent = open ? "✓ Done" : "✏️ Edit outfit";
  renderOutfitPicker(joinPicker);
  playClickSound();
});
document.getElementById("join-random").addEventListener("click", () => randomOutfit(joinPicker));
renderOutfitPicker(joinPicker);
// Drawn again whenever the Join screen appears (by then your account's
// name is known, which decides the Exalted look).
new MutationObserver(() => {
  if (!joinScreen.hidden) renderOutfitPicker(joinPicker);
}).observe(joinScreen, { attributes: true, attributeFilter: ["hidden"] });

// A friend's scarf, backpack and earrings, as they sent them (anything we
// don't know how to draw is left off).
function peerAccessories(peer) {
  const drawers = { scarf: SCARF_DRAWERS, backpack: BACKPACK_DRAWERS, earrings: EARRING_DRAWERS };
  return Object.fromEntries(ACCESSORY_SLOTS.map((slot) => [slot, drawers[slot] && Object.hasOwn(drawers[slot], peer[slot]) ? peer[slot] : "none"]));
}

// The raccoons' shop can read and change what you're wearing.
initShop({
  get: () => ({ color: myColor, hat: myHat, shoes: myShoes, pet: myPet, glasses: myGlasses, face: myFace, ...myAccessories }),
  wear: (type, id) => {
    if (type === "hat") myHat = id;
    else if (type === "shoes") myShoes = id;
    else if (type === "glasses") myGlasses = id;
    else if (ACCESSORY_SLOTS.includes(type)) myAccessories[type] = id;
    else myPet = id;
    saveProfile();
    refreshLook();
  },
});

// Starting spot: roughly the middle of the hallway (grid units, not pixels).
const player = { x: 8.7, y: 1.2 };

joinButton.addEventListener("click", async () => {
  if (!resume) wakeInBed = true; // (an automatic update puts you back where you were instead)
  if (!isHouseReady()) return; // still logging in (account.js)
  myName = nameInput.value.trim() || "Friend";
  myHat = ownedOr(hatChoices(), myHat);
  myShoes = ownedOr(shoeChoices(), myShoes);
  myPet = ownedOr(petChoices(), myPet);
  myGlasses = ownedOr(glassesChoices(), myGlasses);
  for (const slot of ACCESSORY_SLOTS) myAccessories[slot] = ownedAccessory(slot, myAccessories[slot]);
  if (!titleList().some((t) => t.id === myTitle && t.earned)) myTitle = "none"; // (only titles you've earned)
  saveProfile();
  // Crumbs earned so far, for the Crumb Collector tiers. From before it was
  // counted, the best guess is what you have plus what you've bought.
  if (!Number.isFinite(myStats().crumbsEarned)) setStat("crumbsEarned", crumbBalance() + ownedValue());
  startEarningCrumbs();
  applyMyLofi(); // your Study station (it may have come with your cloud save)
  loadSavedBoard(); // the Conference Room whiteboard, as it was left
  // Everyone's bedroom door on the landing, from the house server.
  // (And your own room, as it is in this browser, goes up to the server.)
  shareMyRoom();
  startRooms({ changed: () => (houseSignature = ""), notice: (text) => showNotice(text) });
  // The Workshop's project boards: kept up to date, and new or finished
  // cards announced in the house chat.
  startKanban({
    color: () => myColor,
    confirm: (options) => askConfirm(options),
    notice: (text) => showNotice(text),
    post: (text, kanban) => {
      sendChat({ kanban });
      addChatLine({ channel: "house", system: true, text });
    },
  });
  startMail();
  startWeather(); // the hometown's real sky, outside and through the windows
  // The shared garden in the yard (beds kept on the house server).
  // Fishing at the pond: big catches are shared in the house chat.
  initFishing({
    notice: (text, ms = 5000) => showNotice(text, ms),
    post: (text, bigCatch) => {
      sendChat({ bigCatch });
      addChatLine({ channel: "house", system: true, text: `🎣 You caught a ${text}!` });
    },
  });
  startGarden({ color: () => myColor, notice: (text) => showNotice(text, 5000), confirm: (options) => askConfirm(options) });
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
  checkTiers(); // (the first time, this hands out tiers you'd already earned)
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

// --- Offices (and the old bedroom claims) ---
// Your own office, if you've made one: { since, locked }. Your browser
// remembers it, so it comes back each time you join. Nobody else stores
// it: it only exists while you're here.
// (Bedrooms used to work the same way; now every member has one kept on
// the house server, see rooms.js. The old bedroom claim is left in your
// save, unused, in case we ever need to go back.)
const KINDS = ["office"];
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

// What we tell friends about our office (or null).
function claimInfo(kind) {
  if (!mine[kind]) return null;
  return { since: mine[kind].since, locked: mine[kind].locked };
}

let privateRooms = { office: [] }; // everyone's offices, as passed to buildHouse
let houseSignature = "";

// A message about someone's office or bedroom is only trusted if it looks right.
function isValidClaim(o) {
  return o && typeof o.since === "number" && Number.isFinite(o.since);
}

// Collects everyone's offices, in the order they were made
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
    claims.set(p[kind].since + "|" + ownerName, claim);
  }
  if (mine[kind]) {
    const claim = { since: mine[kind].since, locked: !!mine[kind].locked, ownerName: myName, color: safeColor(myColor), mine: true };
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
// your floor's corridor (the bedroom hall, if you were in a bedroom).
function spawnPoint(floor) {
  if (floor === YARD_FLOOR) return { ...YARD_SPAWN };
  return { x: 8.7, y: [0, BUSINESS, LANDING][Math.min(floor, 2)] + 1.2 };
}

// Everyone's bedroom door (and room) as buildHouse wants them: yours
// straight from your own decorating, so changes show right away.
function doorsForHouse() {
  return bedroomDoors().map((door) => (isMe(door.owner) ? { ...door, mine: true, placed: myHome().placed, size: myHome().size } : door));
}
const isMe = (name) => String(name).toLowerCase() === String(myName).toLowerCase();

// Rebuilds the house if anyone's office appeared, disappeared, moved or
// got locked/unlocked since last frame, or a bedroom changed (then
// houseSignature is cleared).
function updatePrivateRooms() {
  for (const kind of KINDS) privateRooms[kind] = gatherClaims(kind, getPeers());
  const signature = JSON.stringify(privateRooms);
  if (signature === houseSignature) return;
  houseSignature = signature;
  const before = getCurrentRoom(player);
  buildHouse(privateRooms.office, doorsForHouse());
  // If your room slid over to fill a gap, slide along with it.
  const after = ROOMS.find((r) => r.id === before.id);
  if (before.owned && after) player.x += after.rect.x - before.rect.x;
  // If the room you were standing in just vanished (its owner left), pop
  // back to the middle of the hallway (or landing).
  const box = { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  // (Sitting on a bench, log or swing overlaps it on purpose, so that's fine.)
  if (!isInsideARoom(player) || (!mySeat && SOLIDS.some((s) => rectsOverlap(box, s)))) Object.assign(player, spawnPoint(floorOf(player.y)));
}

// A short message that shows in the prompt line for a few seconds, like
// "Sam is knocking on your office door."
let notice = { text: "", until: 0 };

function showNotice(text, ms = 4000) {
  notice = { text, until: performance.now() + ms };
}

// Knocks: someone at your locked office or bedroom door. Ignored if you
// don't have that room.
onKnock((peerId, kind) => {
  const name = String(getPeers().find((p) => p.id === peerId)?.name || "Someone").slice(0, 16);
  // Bedrooms: every member has one, so a knock is always for us. We can
  // let them in with Y (see letInKnocker).
  if (kind === "bedroom") {
    lastKnocker = { peerId, name, until: performance.now() + KNOCK_ANSWER_MS };
    playKnockSound();
    showNotice(`${name} is knocking on your bedroom door. Press Y to let them in.`, KNOCK_ANSWER_MS);
    return;
  }
  // The owner of a bedroom let us in: we can go in now.
  if (kind === "welcome") {
    playClickSound();
    showNotice(`${name} let you in. Press E at their door to go in.`, 8000);
    return;
  }
  if (kind !== "office" || !mine.office) return;
  playKnockSound();
  showNotice(`${name} is knocking on your office door.`);
});

// The last friend who knocked on your bedroom door, for a little while.
const KNOCK_ANSWER_MS = 20000;
let lastKnocker = null; // { peerId, name, until }

async function letInKnocker() {
  const knocker = lastKnocker;
  lastKnocker = null;
  try {
    await letIn(knocker.name);
    sendKnock(knocker.peerId, "welcome");
    showNotice(`You let ${knocker.name} in.`);
  } catch (err) {
    showNotice(err.message);
  }
}

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
      count("focusSessions"); // (for the Deep Focus tiers)
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
  if (nearestInteraction(player) === "hazel") return "Press E to talk to Hazel: seeds for sale, and she buys your harvest.";
  if (nearestInteraction(player) === "gardenBed") return gardenHint(gardenBedInReach(player));
  if (nearestInteraction(player) === "otis") return "Press E to talk to Otis: rods, bait, selling fish and your fish log.";
  if (nearestInteraction(player) === "fishTank") return "Your fish tank. Press E to add or take out fish.";
  if (isFishing() || nearestInteraction(player) === "fishing") return fishingHint();
  if (nearestInteraction(player) === "wardrobe") return "Press E to open your wardrobe.";
  if (nearestInteraction(player) === "kanban") return "Press E to open the Workshop boards.";
  if (nearestInteraction(player) === "bedroomDoor") {
    const door = bedroomDoorInReach(player).door;
    if (isMe(door.owner)) return "Your door. Press E to go in, or C to change your door, sound and room style.";
    if (door.privacy === "private") return `${door.owner}'s room is private right now.`;
    if (door.privacy === "knock") return `${door.owner}'s room: knock first. Press K to knock, E to try the door.`;
    return `${door.owner}'s room. Press E to go in.`;
  }
  if (nearestInteraction(player) === "turntable") return `Press E to choose your lo-fi type. (Now playing: ${myLofiStation().name})`;
  if (nearestInteraction(player) === "laptop") return "Press E to open your laptop.";
  if (nearestInteraction(player) === "phone") return inCall() ? "Press E to hang up." : "Press E to use your phone: call a friend, or leave a message.";
  if (nearestInteraction(player) === "journal") return "Press E to open your journal. Only you can read it.";
  if (mySeat) return "Sitting. Move (or press E) to get up.";
  if (!nearestInteraction(player) && nearestFreeSeat()) return "Press E to sit.";
  const lockedDoor = lockedDoorInFront(player);
  if (lockedDoor) return `${lockedDoor.owned.ownerName}'s ${lockedDoor.owned.kind} is locked. Press K to knock.`;
  if (room.owned?.mine && room.owned.kind === "bedroom") return "Your bedroom. Your laptop has Nest & Nook and decorating. Step into bed to sleep.";
  if (room.owned?.mine) {
    const kind = room.owned.kind;
    const lock = mine[kind].locked ? "Press L to unlock the door" : "Press L to lock the door";
    return `Your ${kind}. ${lock}, or R to remove your ${kind}.`;
  }
  if (room.owned?.kind === "bedroom") return "Step into the bed to sleep.";
  const buildKind = isNearBuildDoor(player);
  if (buildKind) {
    if (mine[buildKind]) return "You already have an office.";
    if (privateRooms[buildKind].length >= WINGS[buildKind].slots) return `All ${WINGS[buildKind].slots} offices are taken right now.`;
    return "Press E to build your office.";
  }
  if (ride) return "";
  if (nearestInteraction(player) === "elevator") return "Press E to call the elevator.";
  const yardDoor = yardDoorNear(player);
  if (yardDoor) return floorOf(player.y) === YARD_FLOOR ? `Walk through the ${yardDoor.name.toLowerCase()} to go back inside.` : "Walk through the door to go out to the yard.";
  if (room.id.startsWith("elevator")) return "Walk up to the elevator doors.";
  if (room.id === "campfire") return campfireLit() ? "The campfire's crackling. Voice is on around the fire. Press E by a log to sit." : "The campfire lights itself at night. Voice is on around it.";
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

  if (key === "e" && nearestInteraction(player) === "phone") {
    for (const k in keysDown) keysDown[k] = false;
    openPhonePanel(); // (or hangs up, if you're on a call)
    return;
  }

  // On the phone (someone called you): E hangs up.
  if (key === "e" && phoneBusy() && !nearestInteraction(player)) {
    hangUp();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "journal") {
    for (const k in keysDown) keysDown[k] = false;
    openJournal();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "laptop") {
    for (const k in keysDown) keysDown[k] = false;
    openLaptop();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "elevator" && !ride) {
    for (const k in keysDown) keysDown[k] = false;
    openElevatorPanel(elevatorInReach(player));
    return;
  }

  if (key === "e" && nearestInteraction(player) === "bedroomDoor") {
    for (const k in keysDown) keysDown[k] = false;
    enterBedroom(bedroomDoorInReach(player).door);
    return;
  }

  if (key === "c" && nearestInteraction(player) === "bedroomDoor" && isMe(bedroomDoorInReach(player).door.owner)) {
    for (const k in keysDown) keysDown[k] = false;
    openDoorPanel();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "kanban") {
    for (const k in keysDown) keysDown[k] = false;
    openKanban();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "wardrobe") {
    for (const k in keysDown) keysDown[k] = false;
    openWardrobe();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "turntable") {
    for (const k in keysDown) keysDown[k] = false;
    openTurntable();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "hazel") {
    for (const k in keysDown) keysDown[k] = false;
    talkToHazel();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "gardenBed") {
    for (const k in keysDown) keysDown[k] = false;
    useGardenBed(gardenBedInReach(player));
    return;
  }

  if (key === "e" && nearestInteraction(player) === "otis") {
    for (const k in keysDown) keysDown[k] = false;
    stopFishing(null);
    talkToOtis();
    return;
  }

  if (key === "e" && nearestInteraction(player) === "fishTank") {
    for (const k in keysDown) keysDown[k] = false;
    openFishTank(myFishTankInReach(player));
    return;
  }

  if (key === "e" && (isFishing() || nearestInteraction(player) === "fishing")) {
    for (const k in keysDown) keysDown[k] = false;
    const spot = fishingSpot(player);
    if (spot || isFishing()) useFishing(spot);
    return;
  }

  if (key === "e" && nearestInteraction(player) === "raccoons") {
    for (const k in keysDown) keysDown[k] = false; // stop walking while you chat
    talkToRaccoons();
    return;
  }

  // Sitting down (or getting up), when nothing else is in reach.
  if (key === "e" && !nearestInteraction(player)) {
    if (mySeat) {
      standUp();
      return;
    }
    const seat = nearestFreeSeat();
    if (seat) {
      sitDown(seat);
      return;
    }
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
    unlock("office");
  }

  const here = getCurrentRoom(player).owned;
  if (key === "l" && here?.mine && here.kind === "office") {
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

  // Let in whoever just knocked on your bedroom door.
  if (key === "y" && lastKnocker && performance.now() < lastKnocker.until) {
    letInKnocker();
    return;
  }

  // Knock on a "knock first" bedroom door (its owner has to be in the house).
  if (key === "k" && nearestInteraction(player) === "bedroomDoor" && performance.now() - lastKnockTime > 2000) {
    const door = bedroomDoorInReach(player).door;
    if (!isMe(door.owner) && door.privacy === "knock") {
      lastKnockTime = performance.now();
      const owner = getPeers().find((p) => isSameName(p.name, door.owner));
      playKnockSound();
      if (owner) {
        sendKnock(owner.id, "bedroom");
        showNotice(`You knocked. ${door.owner} will hear it.`);
        unlock("knock");
      } else {
        showNotice(`${door.owner} isn't in the house right now, so nobody can let you in.`);
      }
      return;
    }
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
  if (key === "r" && here?.mine && here.kind === "office") {
    const kind = here.kind;
    askConfirm({
      title: `Remove your ${kind}?`,
      text: `Anyone inside will be moved back to the corridor. You can always make a new one at the "+" door.`,
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

let lastDrawnFloor = 0;
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
  if (room.bedroom) {
    const door = bedroomDoors().find((d) => d.owner === room.owned.ownerName);
    if (door) enterBedroom(door);
    return !!door;
  }
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

// After the admin panel unlocks things (or the raccoons dress you): redraw
// the Join screen's outfit picker, if it's showing.
function refreshLook() {
  if (!joinScreen.hidden) renderOutfitPicker(joinPicker);
}

// --- Emotes ---
// Wave, heart, laugh, dance and sleepy: press 1 to 5, click the buttons
// in the sidebar, or type /wave, /heart, /laugh, /dance or /sleepy in
// chat. Friends see them too. Walking stops yours early.
// "dance" is your own dance style, picked in your wardrobe (jig, headbang,
// glitch or sway, or shuffle for a random one); /jig, /headbang, /glitch
// and /sway (and the other dance names, like /disco or /mosh) do a particular one.
const EMOTE_KEYS = { 1: "wave", 2: "heart", 3: "laugh", 4: "dance", 5: "sleepy" };
const EMOTE_COMMANDS = {
  "/wave": "wave", "/heart": "heart", "/laugh": "laugh", "/lol": "laugh", "/dance": "dance",
  "/jig": "jig", "/hit the jig": "jig", "/hitthejig": "jig", "/headbang": "headbang", "/glitch": "glitch", "/sway": "sway",
  "/disco": "disco", "/rave": "rave", "/boombap": "boombap", "/mosh": "mosh", "/pop": "pop", "/twostep": "twostep", "/reggaeton": "reggaeton", "/swing": "swing", "/synthwave": "synthwave",
  "/sleepy": "sleepy", "/sleep": "sleepy", "/zzz": "sleepy",
};
// Each dance plays a little tune (see audio.js). You hear a friend's too,
// quieter the further away they are, and not from another floor.
const isDance = (id) => isDanceId(id);
let myEmote = null; // { id, start }
const peerEmotes = {}; // peer id -> { id, start }

// Dancing has a cooldown (CONFIG.danceCooldownSeconds, counted from when
// the dance starts). Presses during it are ignored, not saved for later.
// Everyone checks friends' dances against it too, so a changed browser
// can't spam dances at the rest of the house.
const DANCE_COOLDOWN_MS = CONFIG.danceCooldownSeconds * 1000;
let myLastDance = -Infinity;
const peerLastDance = {}; // peer id -> when their last dance started
function danceCooldownLeft() {
  return Math.max(0, 1 - (performance.now() - myLastDance) / DANCE_COOLDOWN_MS); // 1 just danced, 0 ready
}

// How loud a friend's dance music is for you: full up close, fading to
// nothing at CONFIG.danceSoundRange tiles away, and silent from another
// floor.
function danceVolumeFor(peer) {
  if (!peer || floorOf(peer.y) !== floorOf(player.y)) return 0;
  const distance = Math.hypot(peer.x - player.x, peer.y - player.y);
  return Math.max(0, 1 - distance / CONFIG.danceSoundRange);
}

function startEmote(id) {
  if (id === "dance") {
    if (danceCooldownLeft() > 0) return; // still cooling down
    id = myDance();
  }
  stopIdle();
  if (!Object.hasOwn(EMOTE_LENGTHS, id)) return;
  if (isDance(id)) {
    if (danceCooldownLeft() > 0) return;
    myLastDance = performance.now();
  }
  myEmote = { id, start: performance.now() };
  sendEmote(id);
  if (isDance(id)) playDanceTune(id);

  // Achievements for emotes (any dance counts as one).
  const room = getCurrentRoom(player).id;
  if (collect("emotes", isDance(id) ? "dance" : id).length >= Object.keys(EMOTE_KEYS).length) unlock("expressive");
  count("emotesUsed"); // (for the Emote-ional tiers)
  if (id === "sleepy" && room === "dinner") unlock("foodComa");
  if (isDance(id)) {
    count("dances"); // (for the Dance Machine tiers)
    if (room === "theater") unlock("danceFloor");
    if (Object.values(peerEmotes).some((e) => isDance(emoteNow(e)?.id))) unlock("jigParty");
  }
}

function stopMyEmote() {
  if (!myEmote) return;
  myEmote = null;
  sendEmote(null);
}

// --- Idle animations ---
// After CONFIG.idle.afterSeconds with no keys or mouse, your character
// stretches, yawns or looks around now and then (a gentler one while
// sitting). Friends see them too (they're sent like emotes). Any input
// stops them straight away, and they never start during an emote.
const IDLE_MOVES = ["idleStretch", "idleYawn", "idleLook"];
let lastInput = performance.now();
let nextIdleAt = 0;
const isIdleEmote = (id) => id?.startsWith("idle");

function stopIdle() {
  if (isIdleEmote(myEmote?.id)) stopMyEmote();
}

function noteInput() {
  lastInput = performance.now();
  nextIdleAt = 0;
  stopIdle();
}
window.addEventListener("keydown", noteInput, true);
window.addEventListener("mousedown", noteInput, true);
window.addEventListener("mousemove", noteInput, true);
window.addEventListener("wheel", noteInput, true);

function updateIdle() {
  const now = performance.now();
  if (gameScreen.hidden || amAsleep || now - lastInput < CONFIG.idle.afterSeconds * 1000) return;
  if (emoteNow(myEmote)) return; // one's already playing (an emote, or an idle one)
  const gap = () => (CONFIG.idle.gapMin + Math.random() * (CONFIG.idle.gapMax - CONFIG.idle.gapMin)) * 1000;
  if (!nextIdleAt) nextIdleAt = now + gap();
  if (now < nextIdleAt) return;
  const id = isSeated() ? "idleSeated" : IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)];
  myEmote = { id, start: now };
  sendEmote(id);
  nextIdleAt = now + EMOTE_LENGTHS[id] * 1000 + gap();
}

// --- Sitting ---
// Chairs, sofas, benches, beds and more have seat spots (SEATS in
// world.js). Press E near a free one to sit; moving (or E again) gets you
// up, back where you were standing. One person per spot: friends' seats
// come with their position, and if two people grab the same spot at the
// same moment, the name that comes first alphabetically keeps it.
let mySeat = null; // { key, x, y, face, from: { x, y } } while sitting
let mySpeaking = false; // is your mic hearing you right now (see audio.js)

// --- Whispering ---
// Hold CONFIG.whisper.key (V) right next to a friend to whisper to only
// them, in any room. Your whisper's sound goes only to them (see
// audio.js); everyone nearby just sees you lean in with a little "psst".
// It ends when you let go, or if you drift apart.
function nearestFriendFor(range) {
  let best = null, bestDistance = range;
  for (const peer of getPeers()) {
    if (floorOf(peer.y) !== floorOf(player.y)) continue;
    const d = Math.hypot(peer.x - player.x, peer.y - player.y);
    if (d < bestDistance) {
      best = peer;
      bestDistance = d;
    }
  }
  return best;
}

function startWhisper() {
  if (whisperTarget() || phoneBusy()) return;
  const friend = nearestFriendFor(CONFIG.whisper.range);
  if (!friend) {
    showNotice("Stand right next to someone to whisper to them.");
    return;
  }
  if (!setWhisperTarget(friend.id)) {
    showNotice("Whispering needs your microphone.");
    return;
  }
  showNotice(`Whispering to ${friend.name}... (let go of ${CONFIG.whisper.key.toUpperCase()} to stop)`);
}

function stopWhisper(why) {
  if (!whisperTarget() || inCall()) return;
  setWhisperTarget(null);
  if (why) showNotice(why);
}

// Ends the whisper if the two of you drifted apart (or they left).
function checkWhisper() {
  const to = whisperTarget();
  if (!to || inCall()) return;
  const friend = getPeers().find((p) => p.id === to);
  if (!friend || floorOf(friend.y) !== floorOf(player.y) || Math.hypot(friend.x - player.x, friend.y - player.y) > CONFIG.whisper.endRange) {
    stopWhisper("The whisper ended: you moved apart.");
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === CONFIG.whisper.key && !e.repeat && !isTyping(e) && !gameScreen.hidden && !uiBusy() && !dialogOpen) startWhisper();
});
window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === CONFIG.whisper.key) stopWhisper();
});
window.addEventListener("blur", () => stopWhisper());

// Which way someone whispering is leaning: -1 left, 1 right, toward the
// person they're whispering to (their peer id, or ours).
function whisperLean(fromX, toId) {
  const to = toId === myPeerId ? player : getPeers().find((p) => p.id === toId);
  if (!to) return null;
  return { dir: to.x >= fromX ? 1 : -1 };
}
const SEAT_FACES = ["up", "upTall", "down", "left", "right"];

function isSeated() {
  return !!mySeat;
}

function takenSeats() {
  return new Set(getPeers().map((p) => p.seat?.key).filter(Boolean));
}

function nearestFreeSeat() {
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  const taken = takenSeats();
  let best = null, bestDistance = CONFIG.sit.reach;
  for (const seat of seatsOnFloor(floorOf(player.y))) {
    const d = Math.hypot(seat.x - cx, seat.y - cy);
    if (d < bestDistance && !taken.has(seat.key)) {
      best = seat;
      bestDistance = d;
    }
  }
  return best;
}

function sitDown(seat) {
  stopMyEmote();
  mySeat = { ...seat, from: { x: player.x, y: player.y } };
  player.x = seat.x - PLAYER_SIZE / 2;
  player.y = seat.y - PLAYER_SIZE / 2;
  for (const k in keysDown) keysDown[k] = false;
  playClickSound();
}

function standUp() {
  if (!mySeat) return;
  Object.assign(player, mySeat.from);
  mySeat = null;
  stopIdle();
}

// Stand up if the seat went away (a friend's bedroom closed) or someone
// else got it first.
function checkMySeat() {
  if (!mySeat) return;
  const stillThere = seatsOnFloor(floorOf(player.y)).some((s) => s.key === mySeat.key);
  const rival = getPeers().find((p) => p.seat?.key === mySeat.key && String(p.name) < myName);
  if (!stillThere || rival) standUp();
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
  if (isDance(id)) {
    // A dance before their cooldown is over is ignored (with a little
    // leeway for network timing).
    const now = performance.now();
    if (now - (peerLastDance[peerId] ?? -Infinity) < DANCE_COOLDOWN_MS - 750) return;
    peerLastDance[peerId] = now;
  }
  peerEmotes[peerId] = { id, start: performance.now() };
  if (isDance(id) && isDance(emoteNow(myEmote)?.id)) unlock("jigParty");
  // A friend dancing: you hear their music, quieter the further away.
  const peer = getPeers().find((p) => p.id === peerId);
  if (isDance(id)) playDanceTune(id, danceVolumeFor(peer));
});

for (const button of document.querySelectorAll("#emote-bar button")) {
  button.addEventListener("click", () => {
    startEmote(button.dataset.emote);
    button.blur(); // give the keyboard back to walking
  });
}

// --- The emote wheel ---
// Hold CONFIG.emoteWheel.key (Q) to open a wheel of emotes around your
// character, point the mouse at one, and let go to do it. (The buttons
// and number keys still work too.) Escape closes it without choosing.
const wheel = document.getElementById("emote-wheel");
const WHEEL_EMOTES = [...document.querySelectorAll("#emote-bar button")].map((b) => ({ id: b.dataset.emote, icon: b.firstChild.textContent, title: b.title }));
let wheelChoice = null;
let wheelCenter = { x: 0, y: 0 };
const wheelSlots = WHEEL_EMOTES.map(({ id, icon, title }, i) => {
  const slot = document.createElement("div");
  slot.className = "emote-slot" + (id === "dance" ? " dance-slot" : "");
  slot.textContent = icon;
  slot.title = title;
  const angle = (i / WHEEL_EMOTES.length) * Math.PI * 2 - Math.PI / 2;
  slot.style.left = `${Math.cos(angle) * CONFIG.emoteWheel.radius}px`;
  slot.style.top = `${Math.sin(angle) * CONFIG.emoteWheel.radius}px`;
  wheel.appendChild(slot);
  return { id, angle, slot };
});

function openWheel() {
  if (!wheel.hidden) return;
  const at = gridToPage(canvas, player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
  wheelCenter = at;
  wheel.style.left = `${at.x}px`;
  wheel.style.top = `${at.y}px`;
  wheelChoice = null;
  wheelSlots.forEach((s) => s.slot.classList.remove("chosen"));
  wheel.hidden = false;
}

function closeWheel(play) {
  if (wheel.hidden) return;
  wheel.hidden = true;
  if (play && wheelChoice) startEmote(wheelChoice);
  wheelChoice = null;
}

window.addEventListener("mousemove", (e) => {
  if (wheel.hidden) return;
  const dx = e.clientX - wheelCenter.x, dy = e.clientY - wheelCenter.y;
  // Pointing: the slot nearest the direction of the mouse (not too close
  // to the middle, so a tiny nudge doesn't pick anything).
  let best = null;
  if (Math.hypot(dx, dy) > 18) {
    const angle = Math.atan2(dy, dx);
    const gap = (s) => Math.abs(Math.atan2(Math.sin(angle - s.angle), Math.cos(angle - s.angle)));
    best = wheelSlots.reduce((a, b) => (gap(a) < gap(b) ? a : b));
  }
  wheelChoice = best?.id ?? null;
  wheelSlots.forEach((s) => s.slot.classList.toggle("chosen", s === best));
});
wheelSlots.forEach((s) =>
  s.slot.addEventListener("mousedown", (e) => {
    e.preventDefault();
    wheelChoice = s.id;
    closeWheel(true);
  })
);
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === CONFIG.emoteWheel.key && !e.repeat && !isTyping(e) && !gameScreen.hidden && !uiBusy() && !dialogOpen) openWheel();
  if (e.key === "Escape") closeWheel(false);
});
window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === CONFIG.emoteWheel.key) closeWheel(true);
});

// The dance slot (in the wheel and the sidebar) shows the cooldown as a
// ring filling back up.
const danceButton = document.querySelector('#emote-bar button[data-emote="dance"]');
function showDanceCooldown() {
  const left = danceCooldownLeft();
  const fill = `${Math.round((1 - left) * 360)}deg`;
  for (const el of [danceButton, wheel.querySelector(".dance-slot")]) {
    el?.style.setProperty("--cooldown", fill);
    el?.classList.toggle("cooling", left > 0);
  }
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
// A friend's fishing line, as it comes over the network: only a bobber
// close to them (and numbers that make sense) gets drawn.
function cleanFishing(f, at) {
  if (!f || !Number.isFinite(f.bx) || !Number.isFinite(f.by)) return null;
  if (Math.hypot(f.bx - at.x, f.by - at.y) > 4) return null;
  return { bx: f.bx, by: f.by, bite: f.bite === true };
}

function uiBusy() {
  return isShopBusy() || isNpcOpen() || isReeling() || isSeedPickerOpen() || isBasketOpen() || isLaptopOpen() || isDecorating() || isProfileOpen() || isTurntableOpen() || isWardrobeOpen() || isKanbanOpen() || isDoorPanelOpen() || isJournalOpen() || isPhonePanelOpen() || !elevatorPanel.hidden || !!ride;
}

// Going into a bedroom (E at its door on the landing), and out again
// (walk out through its doorway).
// The house server says who may go in: you get a signed pass, which goes
// out with your position so friends' browsers know you're allowed there
// (see peerAllowed). Without one, friends don't show you or talk to you.
let myPass = null; // { owner: their account name in lowercase, pass, expires }
let askingForPass = false;
let nextPassTry = 0; // after a hiccup, wait a little before asking again
let nextCheckIn = 0; // in someone's "knock first" room: tell the server we're still here every minute

async function getPass(owner) {
  askingForPass = true;
  const answer = await askToEnter(owner, myPeerId);
  askingForPass = false;
  if (answer.pass) myPass = { owner: owner.toLowerCase(), pass: answer.pass, expires: Number(answer.pass.payload.split("|")[4]) };
  return answer;
}

async function enterBedroom(door) {
  if (askingForPass || !ROOMS.some((r) => r.bedroom && r.owned.ownerName === door.owner)) return;
  const answer = await getPass(door.owner);
  if (!answer.pass) {
    if (answer.refused === "knock") showNotice(`${door.owner} asks visitors to knock first. Press K to knock.`);
    else if (answer.refused === "private") showNotice(`${door.owner}'s room is private right now.`);
    else showNotice(answer.message || "The door didn't open. Try again.");
    return;
  }
  // What's inside a "knock first" room only comes once you're let in.
  if (!isMe(door.owner)) await refreshRooms();
  const fresh = bedroomDoors().find((d) => d.owner === door.owner) ?? door;
  Object.assign(player, bedroomEntry(fresh));
  notice.until = 0; // (an old "let you in" note isn't needed any more)
  playClickSound();
  if (isMe(door.owner)) unlock("bedroomMade");
}

// Back out to the landing, in front of the door.
function leaveBedroom(owner) {
  Object.assign(player, bedroomExit(owner));
  if (owner && !isMe(owner)) leftRoom(owner);
  myPass = null;
  playClickSound();
}

function checkLeftBedroom() {
  if (floorOf(player.y) < 3 || isInsideARoom(player)) return;
  const room = ROOMS.find((r) => r.bedroom && floorOf(r.rect.y) === floorOf(player.y));
  leaveBedroom(room?.owned.ownerName);
}

// While you're in a bedroom: keep a pass for it (after a refresh you come
// back without one, and a pass runs out after a while), and walk out if
// its owner makes it private.
function checkMyPass(room) {
  if (!room.bedroom || askingForPass || performance.now() < nextPassTry) return;
  const owner = room.owned.ownerName;
  const door = bedroomDoors().find((d) => d.owner === owner);
  if (door && !isMe(owner) && door.privacy === "private") {
    leaveBedroom(owner);
    showNotice(`${owner} made their room private.`);
    return;
  }
  const soon = Date.now() + 30 * 60_000;
  const checkIn = !isMe(owner) && door?.privacy === "knock" && performance.now() > nextCheckIn;
  if (myPass?.owner === owner.toLowerCase() && myPass.expires > soon && !checkIn) return;
  nextCheckIn = performance.now() + 60_000;
  getPass(owner).then((answer) => {
    if (answer.pass) return;
    if (answer.refused === "error") return void (nextPassTry = performance.now() + 10000); // (a hiccup: try again soon)
    if (getCurrentRoom(player).owned?.ownerName !== owner) return;
    leaveBedroom(owner);
    showNotice(answer.refused === "knock" ? `${owner} asks visitors to knock first.` : `${owner}'s room is private right now.`);
  });
}

// Whether a friend may be where they are: anywhere outside the bedrooms;
// in a bedroom only with a real pass for it (and never in a private room
// unless it's theirs). Friends who aren't allowed aren't shown, heard or
// listed.
const isSameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
function peerAllowed(peer) {
  if (typeof peer.room !== "string" || !peer.room.startsWith("bedroom-")) return true;
  const ownerKey = peer.room.slice("bedroom-".length);
  const door = bedroomDoors().find((d) => d.owner.toLowerCase() === ownerKey);
  if (!door) return false;
  if (door.privacy === "private" && !isSameName(peer.name, ownerKey)) return false;
  return checkRoomPass(peer.pass, ownerKey, peer.name, peer.id);
}

// A bedroom's sound, picked by its owner: "voice", "lofi" or "silent".
function bedroomAudioFor(roomId) {
  if (typeof roomId !== "string" || !roomId.startsWith("bedroom-")) return null;
  const door = bedroomDoors().find((d) => "bedroom-" + d.owner.toLowerCase() === roomId);
  return door?.audio ?? "voice";
}
setBedroomAudioLookup(bedroomAudioFor);

// The elevator's buttons: press E at its doors and pick a floor (from
// CONFIG.floors). The floor you're on is marked "You're here".
const elevatorPanel = document.getElementById("elevator-panel");
const elevatorFloors = document.getElementById("elevator-floors");

function openElevatorPanel(here) {
  elevatorFloors.innerHTML = "";
  CONFIG.floors.forEach((floor, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "elevator-floor" + (i === here ? " here" : "");
    button.disabled = i === here;
    const number = document.createElement("span");
    number.className = "elevator-number";
    number.textContent = i + 1;
    const text = document.createElement("span");
    text.className = "elevator-text";
    const name = document.createElement("strong");
    name.textContent = floor.name + (i === here ? " · You're here" : "");
    const rooms = document.createElement("span");
    rooms.textContent = floor.rooms;
    text.append(name, rooms);
    button.append(number, text);
    button.addEventListener("click", () => {
      closeElevatorPanel();
      ride = { from: here, to: i, t: 0, arrived: false };
      playClickSound();
    });
    elevatorFloors.appendChild(button);
  });
  elevatorPanel.hidden = false;
  playClickSound();
  elevatorFloors.querySelector("button:not(:disabled)")?.focus();
}

function closeElevatorPanel() {
  elevatorPanel.hidden = true;
}

document.getElementById("elevator-close").addEventListener("click", () => {
  closeElevatorPanel();
  playClickSound();
});
window.addEventListener("keydown", (e) => {
  if (elevatorPanel.hidden) return;
  if (e.key === "Escape") closeElevatorPanel();
  // Number keys pick a floor too.
  const pick = elevatorFloors.children[Number(e.key) - 1];
  if (pick && !pick.disabled) pick.click();
});

// Riding the elevator: the doors slide open, you step in, and they open
// again on the floor you picked (with a ding) and close behind you. You
// can't walk while it's moving.
const DOORS_OPEN = 0.45, STEP_IN = 0.6, DOORS_CLOSE = 0.7; // seconds
let ride = null; // { from: floor, to: floor, t: seconds so far, arrived }
function updateElevator(dt) {
  if (!ride) return;
  ride.t += dt;
  const to = ride.to;
  if (!ride.arrived) {
    ELEVATOR_OPEN[ride.from] = Math.min(1, ride.t / DOORS_OPEN);
    if (ride.t >= STEP_IN) {
      Object.assign(player, elevatorArrival(to));
      ride.arrived = true;
      ride.t = 0;
      ELEVATOR_OPEN[ride.from] = 0;
      ELEVATOR_OPEN[to] = 1;
      playElevatorDing();
    }
    return;
  }
  ELEVATOR_OPEN[to] = Math.max(0, 1 - ride.t / DOORS_CLOSE);
  if (ride.t >= DOORS_CLOSE) ride = null;
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
    if (line.admin && isHouseOwner(line.name)) {
      // The house owner: a gold crown (drawn in render.js) and a golden name.
      const crown = document.createElement("img");
      crown.className = "owner-crown";
      crown.src = creatorCrownURL();
      crown.alt = "👑";
      crown.title = "Creator of the Cozy House";
      name.classList.add("owner-name");
      name.prepend(crown);
    } else if (line.admin) {
      const badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.textContent = CONFIG.adminBadge;
      badge.title = "House admin";
      name.prepend(badge);
    }
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
  count("chats"); // (for the Chatterbox tiers)
  unlock("hello");

  if (chatTab === "office" && lastOfficeRoomId) {
    const inThisOffice = getPeers().filter((p) => p.room === lastOfficeRoomId).map((p) => p.id);
    sendChat({ text, office: lastOfficeRoomId }, inThisOffice);
    addChatLine({ channel: lastOfficeRoomId, name: myName, color: myColor, text, admin: checkBadge(myBadge(), myName) }, true);
  } else {
    sendChat({ text });
    addChatLine({ channel: "house", name: myName, color: myColor, text, admin: checkBadge(myBadge(), myName) }, true);
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
  // A friend reached a new tier.
  const reached = message?.tier !== undefined && tierInfo(message.tier, message.level);
  if (reached) {
    addChatLine({ channel: "house", system: true, text: `${reached.tier.icon} ${peerName} reached ${reached.tier.name} in "${reached.track.name}"` });
    return;
  }
  // A friend added or finished a card on the Workshop boards.
  const k = message?.kanban;
  if (k && (k.kind === "added" || k.kind === "done") && typeof k.title === "string") {
    const title = clipText(k.title, 80);
    const text = k.kind === "added" ? `📝 ${peerName} added "${title}" to ${clipText(String(k.board ?? "a board"), 30)}.` : `✅ ${clipText(String(k.who ?? peerName), 16)} finished "${title}"!`;
    addChatLine({ channel: "house", system: true, text });
    return;
  }
  // A friend landed an epic or legendary fish.
  const fish = CONFIG.fish.find((f) => f.id === message?.bigCatch?.id);
  if (fish) {
    const size = Math.round(Number(message.bigCatch.size)) || "?";
    addChatLine({ channel: "house", system: true, text: `🎣 ${peerName} caught a ${fish.name} (${size} cm)!` });
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
    if (!peer || !peerAllowed(peer) || peer.room !== message.office) return; // (only from people really in there)
    channel = message.office;
  }
  addChatLine({ channel, name: peerName, color: peer?.color, text, admin: checkBadge(peer?.badge, peer?.name) });
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
  changed: () => (houseSignature = ""), // redraw your room with the change
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

// --- The bedroom phone (phone.js) ---
initPhone({
  peers: () => visiblePeers,
  doors: () => bedroomDoors().map((d) => ({ ...d, mine: isMe(d.owner) })),
  isAway: () => amAsleep || getCurrentRoom(player).id === "dinner",
  startLine: (peerId) => setWhisperTarget(peerId),
  stopLine: () => setWhisperTarget(null),
  color: () => myColor,
  notice: (text, ms) => showNotice(text, ms),
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPhonePanelOpen()) closePhonePanel();
});

// --- Offline sleeping ---
// While you're away, you sleep in your own bed: friends who can see into
// your room see you tucked in with a "zzz", and your door shows a moon.
// When you come back, you wake up right there.
let wakeInBed = false;

// Your bed (the first thing you can sleep in, in your own room), or null.
function bedIn(room) {
  if (!room) return null;
  const r = room.rect;
  return FURNITURE.find((f) => f.sleep && f.x >= r.x - 0.01 && f.y >= r.y - 0.01 && f.x + f.w <= r.x + r.w + 0.01 && f.y + f.h <= r.y + r.h + 0.01) ?? null;
}

function checkWakeUp() {
  if (!wakeInBed) return;
  const room = ROOMS.find((r) => r.bedroom && r.owned.mine);
  if (!room) return; // (the doors haven't arrived yet)
  wakeInBed = false;
  const bed = bedIn(room);
  if (!bed) return;
  Object.assign(player, tuckedIn(bed));
  // Already asleep, so no "goodnight": you're waking up.
  amAsleep = true;
  enterSleep();
  lastBedtimeNote = performance.now();
  showNotice(`Good morning, ${myName}! Walk out of bed to get up.`, 8000);
}

// Friends who are away, asleep in their beds: only in rooms you can see
// into (the server doesn't send a private room's furniture), and never
// someone who's actually in the house.
function sleepers() {
  const list = [];
  for (const door of bedroomDoors()) {
    if (door.online || isMe(door.owner) || getPeers().some((p) => isSameName(p.name, door.owner))) continue;
    const bed = bedIn(ROOMS.find((r) => r.bedroom && r.owned.ownerName === door.owner));
    if (bed) list.push({ door, bed });
  }
  return list;
}

function sleeperScenePlayer({ door, bed }) {
  const at = tuckedIn(bed);
  const look = door.look ?? {};
  const known = (drawers, id) => (Object.hasOwn(drawers, id) ? id : "none");
  return { id: "asleep-" + door.owner, pet: known(PET_DRAWERS, look.pet), x: at.x, y: at.y, moving: false, color: door.color, hat: known(HAT_DRAWERS, look.hat), shoes: known(SHOE_DRAWERS, look.shoes), glasses: known(GLASSES_DRAWERS, look.glasses), face: cleanFace(look.face), scarf: known(SCARF_DRAWERS, look.scarf), backpack: known(BACKPACK_DRAWERS, look.backpack), earrings: known(EARRING_DRAWERS, look.earrings), title: titleText(look.title), name: door.owner, badge: "sleeping", bubble: null, emote: sleepingEmote(), typing: false, asleep: { color: bed.color, facing: bed.facing }, aura: null, admin: false, seated: null, speaking: false, whisper: null };
}

function updateSleep() {
  const asleepNow = !mySeat && !!bedAt(player); // (sitting on the edge of a bed isn't bedtime)
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
function statusBadge(roomId, bed, name) {
  if (bed) return "sleeping";
  if (roomId === "workshop" && busyBuilders().has(String(name ?? "").toLowerCase())) return "🔨"; // working on a card in Doing
  return roomId === "dinner" ? "eating" : null;
}

// Where someone asleep is drawn: in the middle of the bed with their head
// on the pillows (wherever they actually stepped in).
function tuckedIn(bed) {
  // Head on the pillow: by the headboard, which is at the side of a turned bed.
  if (bed.facing === "right") return { x: bed.x + 0.35, y: bed.y + bed.h / 2 - PLAYER_SIZE / 2 };
  if (bed.facing === "left") return { x: bed.x + bed.w - 0.35 - PLAYER_SIZE, y: bed.y + bed.h / 2 - PLAYER_SIZE / 2 };
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
  // Tiered achievements: counts kept outside achievements.js, and telling
  // friends when you reach a tier.
  values: () => ({ items: ownedCount(), pets: ownedPets().length, roomLevels: roomLevels(myStats()).reduce((sum, r) => sum + r.level, 0) }),
  rooms: () => roomLevels(myStats()),
  announceTier: (id, level) => {
    const t = tierInfo(id, level);
    if (!t) return;
    sendChat({ tier: id, level });
    addChatLine({ channel: "house", system: true, text: `${t.tier.icon} You reached ${t.tier.name} in "${t.track.name}" (+${t.tier.crumbs} crumbs)` });
  },
});

// A tiered achievement and one of its tiers, or null if either is unknown.
function tierInfo(id, level) {
  const track = (CONFIG.tieredAchievements ?? []).find((t) => t.id === id);
  const tier = Number.isInteger(level) ? CONFIG.achievementTiers?.[level - 1] : null;
  return track && tier && level <= track.goals.length ? { track, tier } : null;
}

// Every room counts for the Grand Tour (any office will do).
const TOUR_ROOMS = ["hallway", "theater", "study", "dinner", "conference", "library", "office"];

// Checked every 5 seconds while you're in the house: time spent, time of
// day, and who's around.
function checkTimeAchievements() {
  const room = getCurrentRoom(player).id;
  const peers = getPeers();
  count("seconds", 5); // (for the Homebody tiers)
  // A new day in the house (your own calendar), for the Frequent Visitor tiers.
  const now = new Date();
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  if (myStats().lastDay !== today) {
    setStat("lastDay", today);
    count("daysVisited");
  }
  if (room === "library" && count("librarySeconds", 5) >= 15 * 60) unlock("bookworm");
  if (room === "dinner" && count("dinnerSeconds", 5) >= 10 * 60) unlock("snack");
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 4) unlock("nightOwl");
  if (hour >= 5 && hour < 7) unlock("earlyBird");
  if (peers.length >= 3) unlock("fullHouse");
  if (peers.some((p) => p.room === room)) unlock("roommates");
  if (amAsleep) count("sleepSeconds", 5); // (for the Well Rested tiers)
  if (room.startsWith("bedroom-") && peers.some((p) => p.room === room)) unlock("sleepover");
  addRoomTime(getCurrentRoom(player), 5); // room reputation (reputation.js)
  checkTiers();
  checkNewTitles();
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
window.addEventListener("keydown", (e) => {
  if (!isTyping(e)) keysDown[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  keysDown[e.key.toLowerCase()] = false;
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
  for (const peer of visiblePeers) {
    const time = formatLocalTime(peer.tz);
    const roomName = (bedAt(peer) ? "💤 " : "") + roomNameFor(peer.room);
    rows += peerRow(peer.color, `${peer.name} · ${roomName}${time ? " · " + time : ""}`, peer.build !== MY_BUILD, peer.name);
  }
  for (const { door } of sleepers()) rows += peerRow(door.color, `${door.owner} · 💤 asleep in their room`, false, door.owner);
  peerList.innerHTML = rows;
}

let visiblePeers = []; // friends you're allowed to see (see peerAllowed), updated each frame
let lofiPlaying = false;

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap so a tab-switch pause doesn't teleport the player
  lastTime = now;

  updatePrivateRooms();

  const { dx, dy } = readMovement(dt);
  if ((dx !== 0 || dy !== 0) && mySeat) {
    standUp(); // moving gets you up (back where you were)
  } else if (dx !== 0 || dy !== 0) {
    if (isFishing()) stopFishing("You reeled your line back in.");
    movePlayer(player, dx, dy);
    stopMyEmote(); // walking off ends an emote
  }
  checkMySeat();
  // Walking through a door between the house and the yard.
  const crossing = doorwayCrossing(player);
  if (crossing) {
    Object.assign(player, crossing.to);
    playClickSound();
  }
  updateElevator(dt);
  checkLeftBedroom();
  visiblePeers = getPeers().filter(peerAllowed);
  showDanceCooldown();
  checkWhisper();
  checkCall(!!myPhoneInReach(player));
  mySpeaking = isSpeaking();
  updateIdle();
  checkWakeUp();
  updateSleep();

  const currentRoom = getCurrentRoom(player);
  checkMyPass(currentRoom);
  roomLabel.textContent = "📍 " + currentRoom.name;
  const hint = actionHintFor(currentRoom);
  if (actionHint.textContent !== hint) actionHint.textContent = hint;
  // While you're asleep, you count as "asleep" for sound: no mic, no voices.
  const soundRoom = amAsleep ? "asleep" : currentRoom.id;
  updateMicForRoom(soundRoom);
  updateVoiceRouting(soundRoom, getPeers(), peerAllowed);

  if (currentRoom.id !== previousRoomId) {
    if (previousRoomId === "theater") leaveTheater();
    if (previousRoomId === "library") leaveLibrary();
    if (currentRoom.id === "library") enterLibrary();
    if (previousRoomId === "conference") closeWhiteboard();
    if (currentRoom.id === "theater") enterTheater();
    // (No chime walking between the yard's areas: it's all one outdoors.)
    const outdoorsBoth = currentRoom.outdoor && ROOMS.find((r) => r.id === previousRoomId)?.outdoor;
    if (previousRoomId !== null && !outdoorsBoth) playRoomChangeSound(currentRoom.id);
    previousRoomId = currentRoom.id;
    const visited = collect("rooms", currentRoom.owned ? currentRoom.owned.kind : currentRoom.id);
    if (TOUR_ROOMS.every((r) => visited.includes(r))) unlock("tour");
  }
  // Lo-fi plays in the Study, and in bedrooms whose owner picked it.
  const lofiHere = currentRoom.id === "study" || bedroomAudioFor(currentRoom.id) === "lofi";
  if (lofiHere !== lofiPlaying) {
    lofiPlaying = lofiHere;
    if (lofiHere) enterStudy(lofiPlayerContainer);
    else leaveStudy();
  }
  updateLofi(dt);
  updateTheater();
  setOutsideRain(currentRoom.outdoor && OUTDOORS.raining ? 0.4 + 0.6 * OUTDOORS.rain : 0);
  updateRain(dt);
  // The campfire crackles at night: loud at the fire, faint elsewhere outside.
  setCampfireSound(floorOf(player.y) === YARD_FLOOR && campfireLit() ? (currentRoom.id === "campfire" ? 1 : 0.2) : 0);
  updateCampfireSound(dt);
  updateWhiteNoise(dt);
  updateFocusTimer(currentRoom.id);

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    const pass = currentRoom.bedroom && myPass?.owner === currentRoom.owned.ownerName.toLowerCase() ? myPass.pass : null;
    broadcastPosition({ pass, name: myName, color: myColor, hat: myHat, shoes: myShoes, pet: myPet, glasses: myGlasses, face: myFace, ...myAccessories, title: myTitle, x: player.x, y: player.y, room: currentRoom.id, tz: myTimeZone, office: claimInfo("office"), typing: amTyping(), build: MY_BUILD, aura: myAura(), badge: myBadge(), seat: mySeat ? { key: mySeat.key, face: mySeat.face } : null, speaking: mySpeaking, whisper: inCall() ? null : whisperTarget(), phone: inCall(), fishing: fishingLine() });
  }

  // The porch swing sways while anyone's sitting on it (and them with it).
  const swingSeats = new Set(FURNITURE.filter((f) => f.kind === "porchSwing").flatMap(seatSpots).map((s) => s.key));
  const onSwing = (key) => !!key && swingSeats.has(key);
  globalThis.porchSwingBusy = onSwing(mySeat?.key) || visiblePeers.some((peer) => onSwing(peer.seat?.key));
  const swingY = porchSwingSway();
  const scenePlayers = visiblePeers.map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    // A friend's hat name comes over the network, so only accept known hats.
    const hat = Object.hasOwn(HAT_DRAWERS, peer.hat) ? peer.hat : "none";
    const shoes = Object.hasOwn(SHOE_DRAWERS, peer.shoes) ? peer.shoes : "none";
    const pet = Object.hasOwn(PET_DRAWERS, peer.pet) ? peer.pet : "none";
    const glasses = Object.hasOwn(GLASSES_DRAWERS, peer.glasses) ? peer.glasses : "none";
    const bed = peer.seat ? null : bedAt(shown);
    const at = bed ? tuckedIn(bed) : onSwing(peer.seat?.key) ? { x: shown.x, y: shown.y + swingY } : shown;
    return { id: peer.id, pet, x: at.x, y: at.y, moving: shown.moving, color: peer.color, hat, shoes, glasses, face: cleanFace(peer.face), ...peerAccessories(peer), title: titleText(peer.title), name: peer.name, badge: peer.phone === true ? "📞" : statusBadge(peer.room, bed, peer.name), bubble: bubbleFor(peer.id), emote: bed ? sleepingEmote() : emoteNow(peerEmotes[peer.id]), typing: peer.typing === true, asleep: bed && { color: bed.color, facing: bed.facing }, aura: cleanAura(peer.aura, peer.name), admin: checkBadge(peer.badge, peer.name), seated: SEAT_FACES.includes(peer.seat?.face) ? peer.seat.face : null, speaking: peer.speaking === true, whisper: typeof peer.whisper === "string" ? whisperLean(peer.x, peer.whisper) : null, fishing: cleanFishing(peer.fishing, shown) };
  });
  scenePlayers.push(...sleepers().map(sleeperScenePlayer));
  lastScenePlayers = scenePlayers;
  const myBed = mySeat ? null : bedAt(player);
  const myAt = myBed ? tuckedIn(myBed) : onSwing(mySeat?.key) ? { x: player.x, y: player.y + swingY } : player;
  scenePlayers.push({ id: "me", pet: myPet, x: myAt.x, y: myAt.y, moving: dx !== 0 || dy !== 0, color: myColor, hat: myHat, shoes: myShoes, glasses: myGlasses, face: myFace, ...myAccessories, title: titleText(myTitle), name: myName, badge: inCall() ? "📞" : statusBadge(currentRoom.id, myBed, myName), bubble: bubbleFor("me"), emote: myBed ? sleepingEmote() : emoteNow(myEmote), typing: amTyping(), asleep: myBed && { color: myBed.color, facing: myBed.facing }, aura: myAura(), admin: checkBadge(myBadge(), myName), seated: mySeat?.face ?? null, speaking: mySpeaking, whisper: whisperTarget() ? whisperLean(player.x, whisperTarget()) : null, fishing: fishingLine() });
  updateChatTabs(currentRoom);
  drawScene(ctx, scenePlayers, studySignText(), updatePets(scenePlayers, dt), floorOf(player.y), heldPiece(), player);
  // Walked into (or out of) a bedroom: its view is zoomed in, so fit it to the window again.
  if (floorOf(player.y) !== lastDrawnFloor) {
    lastDrawnFloor = floorOf(player.y);
    fitHouse();
  }

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
