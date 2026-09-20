// Handles the microphone and playing friends' voices, following the
// room rules: your mic is only live while you stand in a voice room,
// and you only hear a friend if you're both in the same voice room.

// Rooms where voice chat is on. For v1, just Gaming.
const VOICE_ROOMS = ["gaming"];

let localTrack = null;
let masterMuted = false;
let masterVolume = 1;
const peerAudioElements = {}; // peerId -> <audio> element playing their voice

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
export function updateMicForRoom(roomId) {
  if (localTrack) {
    localTrack.enabled = VOICE_ROOMS.includes(roomId);
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
  const iAmInVoiceRoom = VOICE_ROOMS.includes(myRoomId);
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
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
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

function startYouTubeStream(containerEl) {
  if (ytPlayer) {
    if (ytPlayerReady) ytPlayer.playVideo();
    return;
  }
  loadYouTubeApi().then(() => {
    ytPlayer = new YT.Player(containerEl, {
      videoId: CONFIG.lofiYouTubeVideoId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: () => {
          ytPlayerReady = true;
          ytPlayer.setVolume(0);
          ytPlayer.playVideo();
        },
        onError: () => {
          console.warn("Lo-fi YouTube embed failed, switching to the backup stream.");
          lofiMode = "backup";
          startBackupStream();
        },
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
