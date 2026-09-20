// Starts the game: sets up the canvas, reads keyboard input, and runs
// the move-and-draw loop.

const canvas = document.getElementById("house");
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;
const ctx = canvas.getContext("2d");

const roomLabel = document.getElementById("room-label");

const player = {
  x: 380,
  y: 70,
  color: "#e05a47",
};

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

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap so a tab-switch pause doesn't teleport the player
  lastTime = now;

  const { dx, dy } = readMovement(dt);
  if (dx !== 0 || dy !== 0) {
    movePlayer(player, dx, dy);
  }

  drawWorld(ctx);
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, 24, 24);

  const room = getCurrentRoom(player);
  roomLabel.textContent = "You are in: " + room.name;

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
