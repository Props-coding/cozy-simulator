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
  audioEl.autoplay = true;
  audioEl.srcObject = stream;
  peerAudioElements[peerId] = audioEl;
}

export function removePeerAudio(peerId) {
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
