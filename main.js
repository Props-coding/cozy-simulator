// Starts the game: Join screen, then the move-and-draw loop, plus
// sending your position to friends and drawing where they are.
import { connectToRoom, broadcastPosition, getPeers } from "./network.js";

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const nameInput = document.getElementById("name-input");
const colorInput = document.getElementById("color-input");
const joinButton = document.getElementById("join-button");
const roomLabel = document.getElementById("room-label");
const peerList = document.getElementById("peer-list");

const canvas = document.getElementById("house");
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;
const ctx = canvas.getContext("2d");

let myName = "Friend";
let myColor = "#e05a47";

const player = { x: 380, y: 70 };

joinButton.addEventListener("click", () => {
  myName = nameInput.value.trim() || "Friend";
  myColor = colorInput.value;

  joinScreen.hidden = true;
  gameScreen.hidden = false;

  try {
    connectToRoom(myName, myColor);
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

function updateSidebar(myRoomName) {
  const rows = [`${myName} (you) — ${myRoomName}`];
  for (const peer of getPeers()) {
    rows.push(`${peer.name} — ${CONFIG.roomNames[peer.room] || peer.room}`);
  }
  peerList.innerHTML = rows.map((r) => `<li>${r}</li>`).join("");
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

  timeSinceLastBroadcast += dt;
  if (timeSinceLastBroadcast >= broadcastInterval) {
    timeSinceLastBroadcast = 0;
    broadcastPosition(myName, myColor, player.x, player.y, currentRoom.id);
  }

  drawWorld(ctx);
  for (const peer of getPeers()) {
    const shown = getSmoothedPosition(peer, dt);
    drawPlayer(ctx, shown.x, shown.y, peer.color, peer.name);
  }
  drawPlayer(ctx, player.x, player.y, myColor, myName);

  updateSidebar(currentRoom.name);

  requestAnimationFrame(tick);
}
