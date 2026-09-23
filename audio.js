// Handles the microphone and playing friends' voices, following the
// room rules: your mic is only live while you stand in a voice room,
// and you only hear a friend if you're both in the same voice room.

// Rooms where voice chat is on: the Theater and the Conference Room, plus
// every office (where you only hear the people in that same office).
const VOICE_ROOMS = ["theater", "conference"];

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
  theater: [659.25, 783.99], // E5, G5: a little brighter
  conference: [587.33, 739.99], // D5, F#5: bright and businesslike
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

// Three gentle rising notes: the Study focus timer moving on to a break,
// or the break ending.
export function playTimerChime() {
  playTone(523.25, 0, { gain: 0.1, duration: 0.5, type: "sine" });
  playTone(659.25, 220, { gain: 0.1, duration: 0.5, type: "sine" });
  playTone(783.99, 440, { gain: 0.1, duration: 0.7, type: "sine" });
}

// A soft little blip when a chat message comes in.
export function playChatSound() {
  playTone(880, 0, { gain: 0.05, duration: 0.08, type: "sine" });
  playTone(1174.66, 70, { gain: 0.05, duration: 0.1, type: "sine" });
}

// One "syllable" of a raccoon talking: a short, slightly hoarse blip at a
// wobbly pitch. Played for each letter as their words type out, so it
// sounds like chattering in a made-up language. `pitch` sets the voice
// (high for Pip, middle for Reginald, low for Bean).
export function playBabble(pitch, letter) {
  if (!toneContext || currentRoomId === "dinner" || masterMuted) return;
  const vowel = "aeiouy".includes(letter.toLowerCase());
  const freq = pitch * (vowel ? 1.18 : 1) * (0.88 + Math.random() * 0.24);
  const now = toneContext.currentTime;
  const osc = toneContext.createOscillator();
  const filter = toneContext.createBiquadFilter();
  const gain = toneContext.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.linearRampToValueAtTime(freq * (vowel ? 1.08 : 0.94), now + 0.05);
  filter.type = "lowpass";
  filter.frequency.value = pitch * 3.2; // softens the buzzy square wave
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.05 * masterVolume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(toneContext.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

// A soft "fwoosh" of fabric, for the raccoons flinging their coat open.
export function playCoatWhoosh() {
  if (!toneContext || currentRoomId === "dinner" || masterMuted) return;
  const now = toneContext.currentTime;
  const length = Math.floor(toneContext.sampleRate * 0.35);
  const buffer = toneContext.createBuffer(1, length, toneContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / length);
  const noise = toneContext.createBufferSource();
  noise.buffer = buffer;
  const filter = toneContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.exponentialRampToValueAtTime(1800, now + 0.3);
  const gain = toneContext.createGain();
  gain.gain.value = 0.12 * masterVolume;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(toneContext.destination);
  noise.start(now);
}

// A happy little "cha-ching" for buying something (or earning crumbs).
export function playCrumbSound() {
  playTone(987.77, 0, { gain: 0.07, duration: 0.09, type: "triangle" });
  playTone(1318.51, 80, { gain: 0.07, duration: 0.16, type: "triangle" });
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

// How loud other things (like the Theater's video) should be right now,
// from 0 to 1, following the master mute and volume.
export function getMasterLevel() {
  return masterMuted ? 0 : masterVolume;
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

// Loads YouTube's player code once, however many things ask for it (the
// Study's lo-fi and the Theater both use it).
let youTubeApiPromise = null;

export function loadYouTubeApi() {
  youTubeApiPromise ??= new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = resolve;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      youTubeApiPromise = null; // let a later try have another go
      reject(new Error("YouTube player code couldn't load"));
    };
    document.head.appendChild(tag);
  });
  return youTubeApiPromise;
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
