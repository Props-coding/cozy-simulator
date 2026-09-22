// Handles the microphone and playing friends' voices, following the
// room rules: your mic is only live while you stand in a voice room,
// and you only hear a friend if you're both in the same voice room.

// Rooms where voice chat is on: Gaming, plus every office (where you
// only hear the people in that same office).
const VOICE_ROOMS = ["gaming"];

function isVoiceRoom(roomId) {
  return VOICE_ROOMS.includes(roomId) || roomId.startsWith("office-");
}

let localTrack = null;
let currentRoomId = "hallway"; // kept up to date by updateMicForRoom
let masterMuted = false;
let masterVolume = 1;
const peerAudioElements = {}; // peerId -> <audio> element playing their voice

// --- Join/leave sounds ---
// Short tones generated in code, so we don't need to find or host a
// sound file for something this small.

let toneContext = null;

// Call once, from inside the Join button's click handler (a real user
// gesture), so the browser allows audio to start later without a click.
export function primeSoundEffects() {
  toneContext = new (window.AudioContext || window.webkitAudioContext)();
  if (toneContext.state === "suspended") toneContext.resume();
}

// gain: how loud (0 to 1). duration: how long the tone rings out, in
// seconds. type: the waveform shape, which changes the character of the
// sound (sine = smooth and mellow, triangle = a bit softer and rounder).
function playTone(freq, delayMs, { gain = 0.15, duration = 0.15, type = "sine" } = {}) {
  // Dinner means "away eating": no sounds at all, not even little chimes.
  if (!toneContext || currentRoomId === "dinner") return;
  setTimeout(() => {
    const osc = toneContext.createOscillator();
    const gainNode = toneContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(masterMuted ? 0 : gain * masterVolume, toneContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, toneContext.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(toneContext.destination);
    osc.start();
    osc.stop(toneContext.currentTime + duration);
  }, delayMs);
}

export function playJoinSound() {
  playTone(660, 0);
  playTone(880, 100);
}

export function playLeaveSound() {
  playTone(440, 0);
  playTone(330, 100);
}

// A pair of notes for each room, so walking into a different one has its
// own gentle little "arrival" feel. Kept quiet and quick on purpose, it's
// a texture, not an announcement.
const ROOM_CHIME_NOTES = {
  hallway: [523.25, 659.25], // C5, E5: light and neutral
  gaming: [659.25, 783.99], // E5, G5: a little brighter
  study: [493.88, 587.33], // B4, D5: softer, calmer
  dinner: [440, 554.37], // A4, C#5: warm, settling in
};

export function playRoomChangeSound(roomId) {
  const [a, b] = ROOM_CHIME_NOTES[roomId] || ROOM_CHIME_NOTES.hallway;
  playTone(a, 0, { gain: 0.07, duration: 0.12, type: "triangle" });
  playTone(b, 60, { gain: 0.07, duration: 0.12, type: "triangle" });
}

// A soft wooden knock-knock, for knocking on an office door.
export function playKnockSound() {
  playTone(170, 0, { gain: 0.3, duration: 0.08, type: "triangle" });
  playTone(150, 180, { gain: 0.3, duration: 0.08, type: "triangle" });
}

// A tiny, soft click for buttons and toggles.
export function playClickSound() {
  playTone(600, 0, { gain: 0.06, duration: 0.05, type: "triangle" });
}

// Asks for mic access. Must be called from inside the Join button's
// click handler, since browsers only allow this right after a click.
export async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localTrack = stream.getAudioTracks()[0];
    localTrack.enabled = false; // stays silent until you're in a voice room
    return stream;
  } catch (err) {
    console.warn("No microphone access, voice chat will be off:", err);
    return null;
  }
}

// Turns your mic on or off depending on which room you're standing in.
// Called every frame, so it also keeps track of your room for the chimes.
export function updateMicForRoom(roomId) {
  currentRoomId = roomId;
  if (localTrack) {
    localTrack.enabled = isVoiceRoom(roomId);
  }
}

// Called when a friend's voice stream arrives, so we can play it.
export function handlePeerStream(stream, peerId) {
  const audioEl = document.createElement("audio");
  audioEl.srcObject = stream;
  audioEl.muted = true; // updateVoiceRouting unmutes it once room rules allow
  document.body.appendChild(audioEl); // some browsers won't reliably autoplay a detached element
  audioEl.play().catch((err) => console.warn("Couldn't play a friend's voice:", err));
  peerAudioElements[peerId] = audioEl;
}

export function removePeerAudio(peerId) {
  peerAudioElements[peerId]?.remove();
  delete peerAudioElements[peerId];
}

// Call every frame with your current room and the list of peers, to
// mute or unmute each friend's voice according to the room rules.
export function updateVoiceRouting(myRoomId, peers) {
  const iAmInVoiceRoom = isVoiceRoom(myRoomId);
  for (const peer of peers) {
    const audioEl = peerAudioElements[peer.id];
    if (!audioEl) continue;
    const sameVoiceRoom = iAmInVoiceRoom && peer.room === myRoomId;
    audioEl.muted = masterMuted || !sameVoiceRoom;
    audioEl.volume = masterVolume;
  }
}

export function setMasterMuted(muted) {
  masterMuted = muted;
}

export function setMasterVolume(vol) {
  masterVolume = vol;
}

// --- Lo-fi music for the Study room ---
// Plays locally, not synced with friends. Fades in when you enter Study,
// fades out when you leave (or when Dinner/master mute silences it).

let inStudy = false;
let lofiUserVolume = 1; // this room's own volume slider, 0 to 1
let lofiCurrentVolume = 0; // what's actually applied right now (eases toward target)
let lofiMode = "youtube"; // or "backup", if the embed fails
let ytPlayer = null;
let ytPlayerReady = false;
let backupAudioEl = null;

function loadYouTubeApi() {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = reject; // e.g. an ad blocker stopped YouTube from loading at all
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = resolve;
  });
}

function startBackupStream() {
  if (!backupAudioEl) {
    backupAudioEl = new Audio(CONFIG.lofiBackupStreamUrl);
    backupAudioEl.loop = true;
  }
  backupAudioEl.volume = 0;
  backupAudioEl.play().catch((err) => console.warn("Backup lo-fi stream blocked:", err));
}

function switchToBackup() {
  console.warn("Lo-fi YouTube embed failed, switching to the backup stream.");
  lofiMode = "backup";
  startBackupStream();
}

function startYouTubeStream(containerEl) {
  if (ytPlayer) {
    if (ytPlayerReady) ytPlayer.playVideo();
    return;
  }
  loadYouTubeApi().catch(switchToBackup).then(() => {
    if (lofiMode === "backup") return;
    ytPlayer = new YT.Player(containerEl, {
      videoId: CONFIG.lofiYouTubeVideoId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: () => {
          ytPlayerReady = true;
          ytPlayer.setVolume(0);
          ytPlayer.playVideo();
        },
        onError: switchToBackup,
      },
    });
  });
}

// Call once, when you walk into Study. containerEl is an empty element
// the YouTube player can take over (only used the first time).
export function enterStudy(containerEl) {
  inStudy = true;
  if (lofiMode === "youtube") {
    startYouTubeStream(containerEl);
  } else {
    startBackupStream();
  }
}

// Call once, when you walk out of Study (to anywhere, including Dinner).
export function leaveStudy() {
  inStudy = false;
}

export function setLofiVolume(vol) {
  lofiUserVolume = vol;
}

// Call every frame. Eases the actual volume toward where it should be,
// so entering/leaving Study fades instead of snapping.
export function updateLofi(dt) {
  const target = inStudy && !masterMuted ? lofiUserVolume * masterVolume : 0;
  const ease = 1 - Math.pow(0.001, dt);
  lofiCurrentVolume += (target - lofiCurrentVolume) * ease;
  if (Math.abs(target - lofiCurrentVolume) < 0.002) {
    lofiCurrentVolume = target;
  }

  if (lofiMode === "youtube" && ytPlayerReady) {
    ytPlayer.setVolume(Math.round(lofiCurrentVolume * 100));
    if (lofiCurrentVolume <= 0.002 && !inStudy) ytPlayer.pauseVideo();
  } else if (backupAudioEl) {
    backupAudioEl.volume = lofiCurrentVolume;
    if (lofiCurrentVolume <= 0.002 && !inStudy) backupAudioEl.pause();
  }
}
