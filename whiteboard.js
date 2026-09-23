// The Conference Room whiteboard: everyone can draw on it together. Each
// stroke is sent to everyone in the house (not only the Conference Room),
// so everyone keeps a copy of the board. When someone new joins, a friend
// sends them a picture of the board as it is now.
//
// The board is also saved on the house server, so it's still there when
// everyone has logged off: a few seconds after you draw (or clear), your
// copy of the board is uploaded, and it's loaded when you arrive. (The
// "Save picture" button still downloads a copy for you to keep.)
import { sendBoard, onBoard } from "./network.js";
import { unlock } from "./achievements.js";
import { serverApi } from "./account.js";

const BOARD_W = 960; // the board's size in its own pixels (the panel scales it)
const BOARD_H = 400;
const INK = ["#2b2b2b", "#c0554a", "#3f6f9f", "#4f7a48"]; // the pen colors
const ERASER = "eraser";
const MAX_POINTS = 400; // per message, so one message can't be enormous

const panel = document.getElementById("whiteboard-panel");
const board = document.getElementById("whiteboard-canvas");
const ctx = board.getContext("2d");
let confirmClear = async () => true; // main.js swaps in the cozy "are you sure?" card
let pen = INK[0];
let drawing = false;
let lastPoint = null;
let outbox = []; // points drawn since the last send
let hasContent = false;

function wipe() {
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  hasContent = false;
}
wipe();

// Draws a line through the points [x1, y1, x2, y2, ...] in board pixels.
function drawStroke(color, points) {
  if (points.length < 4) return;
  ctx.strokeStyle = color === ERASER ? "white" : color;
  ctx.lineWidth = color === ERASER ? 26 : 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
  hasContent = true;
}

// Where the pointer is, in board pixels.
function boardPoint(e) {
  const r = board.getBoundingClientRect();
  return [Math.round(((e.clientX - r.left) / r.width) * BOARD_W), Math.round(((e.clientY - r.top) / r.height) * BOARD_H)];
}

// Sends what's been drawn since last time. Each batch starts with the
// last point of the one before, so the line has no gaps.
function flush() {
  if (outbox.length >= 4) sendBoard({ type: "stroke", color: pen, points: outbox });
  outbox = lastPoint && drawing ? [...lastPoint] : [];
}
setInterval(flush, 60);

board.addEventListener("pointerdown", (e) => {
  drawing = true;
  board.setPointerCapture(e.pointerId);
  lastPoint = boardPoint(e);
  outbox = [...lastPoint, ...lastPoint];
  drawStroke(pen, outbox); // a dot, if you just click
  unlock("doodle");
});

board.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const point = boardPoint(e);
  drawStroke(pen, [...lastPoint, ...point]);
  outbox.push(...point);
  lastPoint = point;
  if (outbox.length >= MAX_POINTS) flush();
});

const stopDrawing = () => {
  if (!drawing) return;
  drawing = false;
  flush();
  lastPoint = null;
  saveSoon();
};

// --- Saving on the server ---
// Uploads the board a few seconds after your last change (so a burst of
// scribbles is one upload, not dozens).
const SAVE_DELAY = 3000;
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    serverApi("PUT", "/api/whiteboard", { image: board.toDataURL("image/png") }).catch((err) => console.warn("Couldn't save the whiteboard:", err.message));
  }, SAVE_DELAY);
}

// Loads the saved board when you arrive (unless a friend has already sent
// you a fresher one, or you've started drawing).
export async function loadSavedBoard() {
  try {
    const { image } = await serverApi("GET", "/api/whiteboard");
    if (!image || hasContent) return;
    const img = new Image();
    img.onload = () => {
      if (hasContent) return;
      ctx.drawImage(img, 0, 0, BOARD_W, BOARD_H);
      hasContent = true;
    };
    img.src = image;
  } catch (err) {
    console.warn("Couldn't load the saved whiteboard:", err.message);
  }
}
board.addEventListener("pointerup", stopDrawing);
board.addEventListener("pointercancel", stopDrawing);

// Pen color buttons.
for (const button of document.querySelectorAll("#whiteboard-tools .pen")) {
  button.addEventListener("click", () => {
    pen = button.dataset.color;
    document.querySelectorAll("#whiteboard-tools .pen").forEach((b) => b.classList.toggle("active", b === button));
  });
}

document.getElementById("whiteboard-clear").addEventListener("click", async () => {
  if (!(await confirmClear())) return;
  wipe();
  sendBoard({ type: "clear" });
  saveSoon();
});

// Downloads the board as a picture.
document.getElementById("whiteboard-save").addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = board.toDataURL("image/png");
  link.download = "cozy-house-whiteboard.png";
  link.click();
});

document.getElementById("whiteboard-close").addEventListener("click", () => closeWhiteboard());

// Messages from friends. Everything is checked before use, since it comes
// over the network.
onBoard((message) => {
  if (message?.type === "stroke") {
    const color = message.color === ERASER || INK.includes(message.color) ? message.color : null;
    const points = message.points;
    const valid = Array.isArray(points) && points.length <= MAX_POINTS + 2 && points.length % 2 === 0 && points.every((n) => Number.isFinite(n) && n >= -50 && n <= BOARD_W + 50);
    if (color && valid) drawStroke(color, points);
  } else if (message?.type === "clear") {
    wipe();
  } else if (message?.type === "snapshot" && typeof message.image === "string") {
    // A picture of the board from a friend, for when we've just joined.
    if (!message.image.startsWith("data:image/png;base64,") || message.image.length > 3_000_000) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, BOARD_W, BOARD_H);
      hasContent = true;
    };
    img.src = message.image;
  }
});

// Called when a friend joins the house: send them the board so far.
export function sendBoardTo(peerId) {
  if (hasContent) sendBoard({ type: "snapshot", image: board.toDataURL("image/png") }, peerId);
}

// main.js passes in the cozy "are you sure?" card to use for Clear.
export function initWhiteboard({ confirm }) {
  confirmClear = () =>
    confirm({ title: "Clear the whiteboard?", text: "This wipes it for everyone. You can save a picture first if you want to keep it.", yes: "Clear it", no: "Keep it" });
}

export function isWhiteboardOpen() {
  return !panel.hidden;
}

export function openWhiteboard() {
  panel.hidden = false;
}

export function closeWhiteboard() {
  panel.hidden = true;
  stopDrawing();
}
