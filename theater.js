// The Theater: watch a YouTube video together. Paste a link and it plays
// for everyone standing in the Theater. Play, pause and skipping stay in
// sync, and anyone who walks in mid-movie jumps to the right spot. Each
// person's browser streams the video from YouTube itself, so it costs
// nothing extra. Only people in the Theater get these messages.
import { sendTheater, onTheater } from "./network.js";
import { loadYouTubeApi, getMasterLevel } from "./audio.js";

const panel = document.getElementById("theater-panel");
const form = document.getElementById("theater-form");
const urlInput = document.getElementById("theater-url");
const note = document.getElementById("theater-note");
const sizeButton = document.getElementById("theater-size");

let getPeerIdsInTheater = () => []; // set by initTheater
let inTheater = false;
let player = null;
let playerReady = false;
let videoId = null;
let pending = null; // { id, time, playing } to start once the player is ready
let quietUntil = 0; // ignore our own player's events while copying a friend's change
let lastHeartbeat = 0;
let lastLevel = -1;

// Pulls the 11-character video id out of a YouTube link (youtube.com/watch,
// youtu.be, shorts, live, or just the id itself). Returns null if it
// isn't one. Everything that reaches the player goes through this, since
// links also arrive from friends over the network.
export function videoIdFrom(text) {
  const t = String(text ?? "").trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const url = new URL(t);
    const host = url.hostname.replace(/^(www|m)\./, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
    }
    return /^[\w-]{11}$/.test(id ?? "") ? id : null;
  } catch {
    return null;
  }
}

// main.js tells us how to find who's in the Theater right now.
export function initTheater(peerIdsInTheater) {
  getPeerIdsInTheater = peerIdsInTheater;
}

function isPlaying() {
  return playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
}

function currentState() {
  return { type: "state", videoId, playing: isPlaying(), time: playerReady ? player.getCurrentTime() : 0 };
}

function share(message, peerIds = getPeerIdsInTheater()) {
  sendTheater(message, peerIds);
}

function showNote(text) {
  note.textContent = text;
}

// Shows a video, starting `time` seconds in, playing or paused.
async function loadVideo(id, time, playing) {
  videoId = id;
  showNote("");
  if (!playerReady) {
    pending = { id, time, playing };
    if (player) return; // already starting up; it'll pick up `pending`
    try {
      await loadYouTubeApi();
    } catch {
      showNote("YouTube couldn't load (an ad blocker or a strict network can block it).");
      return;
    }
    player = new YT.Player("theater-player", {
      videoId: id,
      playerVars: { playsinline: 1, rel: 0 },
      events: { onReady: handleReady, onStateChange: handleStateChange, onError: handleError },
    });
    return;
  }
  quietUntil = performance.now() + 1500;
  if (playing) player.loadVideoById(id, time);
  else player.cueVideoById(id, time);
}

function handleReady() {
  playerReady = true;
  lastLevel = -1;
  const start = pending;
  pending = null;
  if (start) loadVideo(start.id, start.time, start.playing);
}

// When you play, pause or skip, tell everyone else in the Theater.
function handleStateChange(e) {
  if (!inTheater || performance.now() < quietUntil) return;
  if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) share(currentState());
}

function handleError() {
  showNote("This video can't be played here (its owner turned off playing it on other sites). Try another link.");
}

// A friend's play, pause, skip or new video: do the same here.
function applyState(state) {
  const id = videoIdFrom(state.videoId);
  if (!id) return;
  const time = Number.isFinite(state.time) ? Math.max(0, Math.min(state.time, 24 * 3600)) : 0;
  const playing = state.playing === true;
  if (id !== videoId || !playerReady) {
    loadVideo(id, time, playing);
    return;
  }
  quietUntil = performance.now() + 1500;
  if (Math.abs(player.getCurrentTime() - time) > 3) player.seekTo(time, true);
  if (playing && !isPlaying()) player.playVideo();
  if (!playing && isPlaying()) player.pauseVideo();
}

onTheater((message, peerId) => {
  if (!inTheater || !message) return;
  if (message.type === "request") {
    // Someone just walked in: tell them what's on and where we're up to.
    if (videoId) share(currentState(), [peerId]);
  } else if (message.type === "state") {
    applyState(message);
  }
});

// Call once when you walk into the Theater.
export function enterTheater() {
  inTheater = true;
  panel.hidden = false;
  if (!videoId) showNote("Paste a YouTube link to start a video for everyone in the Theater.");
  share({ type: "request" });
}

// Call once when you walk out. Pauses it for you only, not for others.
export function leaveTheater() {
  inTheater = false;
  panel.hidden = true;
  if (playerReady) {
    quietUntil = performance.now() + 1500;
    player.pauseVideo();
  }
}

// Call every frame: keeps the volume matched to the master volume and
// mute, and every few seconds while playing, sends a quick "we're here"
// so everyone's video stays within a few seconds of each other.
export function updateTheater() {
  if (!inTheater || !playerReady) return;
  const level = getMasterLevel();
  if (level !== lastLevel) {
    player.setVolume(Math.round(level * 100));
    lastLevel = level;
  }
  if (isPlaying() && performance.now() - lastHeartbeat > 5000) {
    lastHeartbeat = performance.now();
    share(currentState());
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = videoIdFrom(urlInput.value);
  if (!id) {
    showNote("That doesn't look like a YouTube link. Try copying it from the address bar on YouTube.");
    return;
  }
  urlInput.value = "";
  urlInput.blur();
  loadVideo(id, 0, true);
  share({ type: "state", videoId: id, playing: true, time: 0 });
});

// Big screen over the house, or a small one in the corner so you can see
// the room (the video keeps playing either way).
sizeButton.addEventListener("click", () => {
  const small = panel.classList.toggle("small");
  sizeButton.textContent = small ? "Big screen" : "Shrink screen";
});
