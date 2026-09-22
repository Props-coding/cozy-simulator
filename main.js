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
const peerList = document.getElementById("peer-list");
const muteToggle = document.getElementById("mute-toggle");
const volumeSlider = document.getElementById("volume-slider");
const lofiVolumeSlider = document.getElementById("lofi-volume-slider");
const lofiPlayerContainer = document.getElementById("lofi-player");

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

  try {
    connectToRoom(myName, myColor);
    const micStream = await requestMic();
    if (micStream) {
      addLocalStream(micStream);
    }
  } catch (err) {
    // Movement still works alone even if connecting to friends fails.
    console.error("Could not connect to other players:", err);
  }
  requestAnimationFrame(tick);
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
    const roomName = CONFIG.roomNames[peer.room] || peer.room;
    rows += peerRow(peer.color, `${peer.name} · ${roomName}${time ? " · " + time : ""}`);
  }
  peerList.innerHTML = rows;
}

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap so a tab-switch pause doesn't teleport the player
  lastTime = now;

  const { dx, dy } = readMovement(dt);
  if (dx !== 0 || dy !== 0) {
    movePlayer(player, dx, dy);
  }

  const currentRoom = getCurrentRoom(player);
  roomLabel.textContent = "You are in: " + currentRoom.name;
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
    broadcastPosition(myName, myColor, player.x, player.y, currentRoom.id, myTimeZone);
  }

  const scenePlayers = getPeers().map((peer) => {
    const shown = getSmoothedPosition(peer, dt);
    return { x: shown.x, y: shown.y, color: peer.color, name: peer.name, badge: peer.room === "dinner" ? "eating" : null };
  });
  scenePlayers.push({ x: player.x, y: player.y, color: myColor, name: myName, badge: currentRoom.id === "dinner" ? "eating" : null });
  drawScene(ctx, scenePlayers);

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}
