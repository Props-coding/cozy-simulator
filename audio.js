// Handles the microphone and playing friends' voices, following the
// room rules: your mic is only live while you stand in a voice room,
// and you only hear a friend if you're both in the same voice room.

// Rooms where voice chat is on: the Theater and the Conference Room, plus
// every office and bedroom (where you only hear the people in that same
// room). main.js passes "asleep" as the room while you're in bed, which
// isn't a voice room: your mic is off and you hear nobody.
const VOICE_ROOMS = ["theater", "conference", "workshop"];

function isVoiceRoom(roomId) {
  return VOICE_ROOMS.includes(roomId) || roomId.startsWith("office-") || roomId.startsWith("bedroom-");
}

// Dinner ("away eating") and being asleep: no sounds at all, not even
// little chimes.
function isSilentSpot() {
  return currentRoomId === "dinner" || currentRoomId === "asleep";
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
  if (!toneContext || isSilentSpot()) return;
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
  library: [440, 523.25], // A4, C5: hushed
  study: [493.88, 587.33], // B4, D5: softer, calmer
  dinner: [440, 554.37], // A4, C#5: warm, settling in
  workshop: [523.25, 698.46], // C5, F5: busy and cheerful
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
  if (!toneContext || isSilentSpot() || masterMuted) return;
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
  if (!toneContext || isSilentSpot() || masterMuted) return;
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

// The elevator arriving: a soft two-note "ding-dong".
export function playElevatorDing() {
  playTone(1046.5, 0, { gain: 0.08, duration: 0.5, type: "sine" });
  playTone(830.61, 260, { gain: 0.08, duration: 0.8, type: "sine" });
}

// The hallway clock's hourly chime: the first line of the Westminster
// chimes, softly, then one low bong for each hour (if turned on).
export function playHourlyChime(hour) {
  const { volume, strikes } = CONFIG.hourlyChime;
  const tune = [415.3, 369.99, 329.63, 246.94]; // G#4 F#4 E4 B3
  tune.forEach((f, i) => playTone(f, i * 650, { gain: volume, duration: 1.4, type: "sine" }));
  if (!strikes) return;
  const count = hour % 12 || 12;
  for (let i = 0; i < count; i++) playTone(164.81, 3200 + i * 1300, { gain: volume * 1.2, duration: 1.8, type: "sine" });
}

// A card moved to Done in the Workshop: a bright little "ding-ding!".
export function playCardDoneSound() {
  playTone(783.99, 0, { gain: 0.08, duration: 0.15, type: "triangle" });
  playTone(1174.66, 90, { gain: 0.08, duration: 0.35, type: "triangle" });
}

// A happy little "cha-ching" for buying something (or earning crumbs).
export function playCrumbSound() {
  playTone(987.77, 0, { gain: 0.07, duration: 0.09, type: "triangle" });
  playTone(1318.51, 80, { gain: 0.07, duration: 0.16, type: "triangle" });
}

// A little "ta-da!" for unlocking an achievement: four bright notes
// climbing up, the last one ringing out.
export function playAchievementSound() {
  playTone(523.25, 0, { gain: 0.08, duration: 0.14, type: "triangle" });
  playTone(659.25, 110, { gain: 0.08, duration: 0.14, type: "triangle" });
  playTone(783.99, 220, { gain: 0.08, duration: 0.14, type: "triangle" });
  playTone(1046.5, 330, { gain: 0.09, duration: 0.6, type: "triangle" });
}

// A soft, happy chirp for petting a pet.
export function playPetSound() {
  playTone(1046.5, 0, { gain: 0.05, duration: 0.08, type: "sine" });
  playTone(1396.91, 70, { gain: 0.05, duration: 0.12, type: "sine" });
}

// A short, jaunty fiddle jig for the "jig" emote: a buzzy sawtooth note,
// softened a little, with a touch of wobble like a bow on a string.
function playFiddleNote(freq, delayMs, duration) {
  if (!toneContext || isSilentSpot() || currentRoomId === "library" || masterMuted) return;
  const start = toneContext.currentTime + delayMs / 1000;
  const osc = toneContext.createOscillator();
  const vibrato = toneContext.createOscillator();
  const vibratoDepth = toneContext.createGain();
  const filter = toneContext.createBiquadFilter();
  const gain = toneContext.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  vibrato.frequency.value = 6;
  vibratoDepth.gain.value = freq * 0.006;
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(osc.frequency);
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.045 * masterVolume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(danceOut());
  osc.start(start);
  vibrato.start(start);
  osc.stop(start + duration + 0.05);
  vibrato.stop(start + duration + 0.05);
}

// About three seconds of a lively jig in D (six notes to a bar).
export function playJigTune() {
  const D5 = 587.33, E5 = 659.25, Fs5 = 739.99, G5 = 783.99, A5 = 880, B5 = 987.77, Cs5 = 554.37, A4 = 440, D6 = 1174.66;
  const notes = [D5, Fs5, A5, D6, A5, Fs5, G5, B5, G5, E5, Cs5, A4, D5, Fs5, A5, B5, A5, Fs5, E5, Cs5, A4, D5];
  const step = 140; // milliseconds per note
  notes.forEach((freq, i) => playFiddleNote(freq, i * step, i === notes.length - 1 ? 0.5 : 0.16));
}

// --- Dance tunes (one for each dance style, see DANCES in main.js) ---
// Short, quiet sketches made in code, like the jig: a taste of the genre,
// not a whole song.
function canPlayDanceTune() {
  return toneContext && !isSilentSpot() && currentRoomId !== "library" && !masterMuted;
}

// A short burst of noise (for drums).
function noiseHit(start, duration, { gain = 0.1, highpass = 2000 } = {}) {
  const buffer = toneContext.createBuffer(1, Math.ceil(toneContext.sampleRate * duration), toneContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = toneContext.createBufferSource();
  src.buffer = buffer;
  const filter = toneContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const g = toneContext.createGain();
  g.gain.value = gain * masterVolume;
  src.connect(filter);
  filter.connect(g);
  g.connect(danceOut());
  src.start(start);
}

// A kick drum: a quick low "thump".
function kick(start, gain = 0.35) {
  const osc = toneContext.createOscillator();
  const g = toneContext.createGain();
  osc.frequency.setValueAtTime(120, start);
  osc.frequency.exponentialRampToValueAtTime(40, start + 0.15);
  g.gain.setValueAtTime(gain * masterVolume, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
  osc.connect(g);
  g.connect(danceOut());
  osc.start(start);
  osc.stop(start + 0.32);
}

// Headbang (trap and dubstep): heavy kicks, a clap, and a wobbling bass.
export function playHeadbangTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, beat = 60 / 140; // 140 BPM, half-time feel
  for (let b = 0; b < 6; b++) {
    kick(now + b * beat * 2);
    noiseHit(now + b * beat * 2 + beat, 0.12, { gain: 0.08, highpass: 1500 }); // clap
    for (let h = 0; h < 4; h++) noiseHit(now + b * beat * 2 + h * beat * 0.5, 0.03, { gain: 0.03, highpass: 7000 }); // hats
  }
  const osc = toneContext.createOscillator(); // the wobble bass
  const filter = toneContext.createBiquadFilter();
  const lfo = toneContext.createOscillator();
  const lfoDepth = toneContext.createGain();
  const g = toneContext.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 49; // G1
  filter.type = "lowpass";
  filter.frequency.value = 400;
  filter.Q.value = 8;
  lfo.frequency.value = (140 / 60) * 2; // wub wub, on the eighth notes
  lfoDepth.gain.value = 350;
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.frequency);
  const end = now + beat * 12;
  g.gain.setValueAtTime(0.0001, now + beat * 2);
  g.gain.linearRampToValueAtTime(0.09 * masterVolume, now + beat * 2.1);
  g.gain.setValueAtTime(0.09 * masterVolume, end - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(filter);
  filter.connect(g);
  g.connect(danceOut());
  osc.start(now + beat * 2);
  lfo.start(now + beat * 2);
  osc.stop(end + 0.05);
  lfo.stop(end + 0.05);
}

// Glitch (breakcore): fast, chopped-up drums that stutter and skip.
export function playGlitchTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 180 / 4; // 180 BPM sixteenths
  for (let i = 0; i < 64; i++) {
    const t = now + i * step;
    const roll = Math.random();
    if (i % 8 === 0 || roll < 0.12) kick(t, 0.25);
    else if (i % 8 === 4 || roll < 0.35) noiseHit(t, 0.06, { gain: 0.09, highpass: 1200 }); // snare
    else if (roll < 0.8) noiseHit(t, 0.02, { gain: 0.03, highpass: 6000 }); // hat
    if (roll > 0.93) for (let k = 1; k < 4; k++) noiseHit(t + (k * step) / 4, 0.02, { gain: 0.06, highpass: 1500 }); // stutter
  }
}

// Sway (ambient): a slow, soft chord that swells and fades.
export function playSwayTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02;
  const chords = [[261.63, 329.63, 392, 493.88], [220, 261.63, 329.63, 392]]; // Cmaj7, Am7
  chords.forEach((chord, c) => {
    const start = now + c * 2.6;
    for (const freq of chord) {
      const osc = toneContext.createOscillator();
      const g = toneContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.018 * masterVolume, start + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, start + 3.2);
      osc.connect(g);
      g.connect(danceOut());
      osc.start(start);
      osc.stop(start + 3.3);
    }
  });
}

// A single synth note (for bass lines, melodies and chords).
function synthNote(freq, start, duration, { type = "sawtooth", gain = 0.05, cutoff = 1800, attack = 0.01 } = {}) {
  const osc = toneContext.createOscillator();
  const filter = toneContext.createBiquadFilter();
  const g = toneContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain * masterVolume, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter);
  filter.connect(g);
  g.connect(danceOut());
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// A drum pattern: `pattern` is a string of steps ("k" kick, "s" snare,
// "h" hat, "o" open hat, "." rest), played `bars` times at `step` seconds
// per step, starting at `now`. `swing` delays every other step a little.
function drums(now, pattern, step, bars = 2, swing = 0) {
  for (let bar = 0; bar < bars; bar++) {
    [...pattern].forEach((hit, i) => {
      const t = now + (bar * pattern.length + i) * step + (i % 2 ? swing * step : 0);
      if (hit === "k") kick(t, 0.3);
      else if (hit === "s") noiseHit(t, 0.12, { gain: 0.08, highpass: 1200 });
      else if (hit === "h") noiseHit(t, 0.03, { gain: 0.03, highpass: 7000 });
      else if (hit === "o") noiseHit(t, 0.12, { gain: 0.03, highpass: 6000 });
    });
  }
}

// Disco and funk: four on the floor, open hats, and an octave-jumping bass.
export function playDiscoTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 118 / 4;
  drums(now, "k.o.k.o.k.o.k.o.", step, 3);
  const bass = [82.41, 164.81, 82.41, 164.81, 98, 196, 98, 196]; // E and G, jumping octaves
  for (let i = 0; i < 24; i++) synthNote(bass[i % bass.length], now + i * step * 2, step * 1.8, { gain: 0.06, cutoff: 900 });
}

// House and techno: a pounding kick, offbeat hats, and bright chord stabs.
export function playRaveTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 128 / 4;
  drums(now, "k.h.k.h.k.h.k.h.", step, 3);
  for (let b = 0; b < 12; b++) {
    const t = now + (b * 4 + 2) * step; // on the offbeat
    for (const f of [440, 523.25, 659.25]) for (const detune of [0.995, 1.005]) synthNote(f * detune, t, 0.18, { gain: 0.012, cutoff: 3000 });
  }
}

// Hip-hop boom bap: a laid-back swung beat and a mellow bass.
export function playBoomBapTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 90 / 4;
  drums(now, "k.h.s.h.h.k.s.h.", step, 2, 0.3);
  [[55, 0], [55, 6], [65.41, 8], [49, 12], [55, 16], [55, 22], [65.41, 24], [73.42, 28]].forEach(([f, s]) =>
    synthNote(f, now + s * step, step * 3, { type: "sine", gain: 0.12, attack: 0.02 })
  );
}

// Metal: a fast double kick and chugging, crunchy power chords.
export function playMoshTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 180 / 4;
  drums(now, "kkkskkkskkkskkks", step, 2);
  const crunch = toneContext.createWaveShaper(); // distortion
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 6);
  }
  crunch.curve = curve;
  const out = toneContext.createGain();
  out.gain.value = 0.05 * masterVolume;
  crunch.connect(out);
  out.connect(danceOut());
  for (let i = 0; i < 16; i++) {
    const t = now + i * step * 2;
    for (const f of [82.41, 123.47]) { // E5 power chord
      const osc = toneContext.createOscillator();
      const g = toneContext.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.8);
      osc.connect(g);
      g.connect(crunch);
      osc.start(t);
      osc.stop(t + step * 2);
    }
  }
}

// Pop: a bright, bouncy melody over a kick and clap.
export function playPopTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 120 / 4;
  drums(now, "k...s...k.k.s...", step, 3);
  const melody = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25, 0, 783.99, 880, 987.77, 880, 783.99, 659.25, 783.99, 0];
  melody.forEach((f, i) => f && synthNote(f, now + i * step * 2, step * 1.8, { type: "square", gain: 0.02, cutoff: 3500 }));
}

// Country two-step: a boom-chick bass and chord, and a banjo-ish pluck.
export function playTwoStepTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, beat = 60 / 100;
  for (let b = 0; b < 6; b++) {
    synthNote(b % 2 ? 73.42 : 98, now + b * beat, beat * 0.5, { type: "triangle", gain: 0.12 }); // boom
    for (const f of [392, 493.88, 587.33]) synthNote(f, now + b * beat + beat / 2, 0.15, { type: "triangle", gain: 0.02 }); // chick
  }
  const pluck = [587.33, 783.99, 987.77, 783.99, 587.33, 659.25, 783.99, 659.25];
  for (let i = 0; i < 24; i++) synthNote(pluck[i % pluck.length], now + (i * beat) / 4, 0.12, { type: "triangle", gain: 0.03, cutoff: 4000 });
}

// Reggaeton: the dembow beat and a low bass.
export function playReggaetonTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 95 / 4;
  drums(now, "k..sk.s.k..sk.s.", step, 3);
  for (let b = 0; b < 12; b++) synthNote(b % 4 < 2 ? 55 : 49, now + b * step * 4, step * 3, { type: "sine", gain: 0.1 });
}

// Swing jazz: a walking bass and a swung ride cymbal.
export function playSwingTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, beat = 60 / 160;
  const walk = [98, 110, 123.47, 130.81, 146.83, 130.81, 123.47, 110, 98, 116.54, 123.47, 146.83];
  walk.forEach((f, i) => {
    synthNote(f, now + i * beat, beat * 0.9, { type: "sine", gain: 0.12, attack: 0.02 });
    noiseHit(now + i * beat, 0.08, { gain: 0.025, highpass: 8000 }); // ride
    if (i % 2) noiseHit(now + i * beat + beat * 0.66, 0.05, { gain: 0.02, highpass: 8000 }); // the swung "and"
  });
}

// Synthwave: a gated snare and a glowing arpeggio.
export function playSynthwaveTune() {
  if (!canPlayDanceTune()) return;
  const now = toneContext.currentTime + 0.02, step = 60 / 100 / 4;
  drums(now, "k...s...k...s...", step, 3);
  const arp = [220, 261.63, 329.63, 392, 329.63, 261.63]; // A minor
  for (let i = 0; i < 48; i++) synthNote(arp[i % arp.length] * (i >= 24 ? 0.89 : 1), now + i * step, step * 1.5, { gain: 0.02, cutoff: 2400 });
}

// Dance tunes all play through one volume knob (a "bus"), so a friend's
// dance can sound quieter the further away they are. `volume` is 0 to 1;
// main.js works it out from the distance (see CONFIG.danceSoundRange).
let danceBus = null;
function danceOut() {
  return danceBus ?? toneContext.destination;
}

const DANCE_TUNES = {
  jig: playJigTune, headbang: playHeadbangTune, glitch: playGlitchTune, sway: playSwayTune,
  disco: playDiscoTune, rave: playRaveTune, boombap: playBoomBapTune, mosh: playMoshTune, pop: playPopTune,
  twostep: playTwoStepTune, reggaeton: playReggaetonTune, swing: playSwingTune, synthwave: playSynthwaveTune,
};

// True if this emote is one of the dances.
export function isDanceId(id) {
  return Object.hasOwn(DANCE_TUNES, id);
}

export function playDanceTune(id, volume = 1) {
  if (!isDanceId(id) || !toneContext || !(volume > 0)) return;
  danceBus = toneContext.createGain();
  danceBus.gain.value = Math.min(1, volume);
  danceBus.connect(toneContext.destination);
  try {
    DANCE_TUNES[id]();
  } finally {
    danceBus = null;
  }
}

// --- Rain for the Library ---
// A real recording: "Rain" by ezwa, public domain (from pdsounds.org, via
// Wikimedia Commons), stored in sounds/. It's a soft, steady patter with no
// sudden splats (picked for being the least distracting of several). It's
// played slightly muffled, the way rain sounds through a window from a
// warm room, and loops with a slow crossfade so you never hear where it
// starts over. Plays for you while you're in the Library, fading in and
// out like the Study's lo-fi, with its own volume slider.
const RAIN_FILE = "sounds/soft-rain.ogg";
const RAIN_CROSSFADE = 4; // seconds each loop overlaps the next
let rainRecording = null; // the decoded recording, loaded the first time
let rain = null; // the playing sound, or null when stopped
let inLibrary = false;
let rainUserVolume = 0.5;
let rainLevel = 0; // what's actually applied right now (eases toward the target)

async function loadRainRecording() {
  if (!rainRecording) {
    const response = await fetch(RAIN_FILE);
    rainRecording = await toneContext.decodeAudioData(await response.arrayBuffer());
  }
  return rainRecording;
}

// Smooth "equal power" fade curves, so the crossfade doesn't dip in volume.
function fadeCurve(fadingIn) {
  const curve = new Float32Array(64);
  for (let i = 0; i < 64; i++) {
    const x = (i / 63) * (Math.PI / 2);
    curve[i] = fadingIn ? Math.sin(x) : Math.cos(x);
  }
  return curve;
}

async function startRain() {
  if (rain || !toneContext) return;
  const out = toneContext.createGain();
  out.gain.value = 0;
  // "Through the glass": soften the hiss on top and the rumble underneath.
  const muffle = toneContext.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 1700;
  muffle.Q.value = 0.5;
  const trim = toneContext.createBiquadFilter();
  trim.type = "highpass";
  trim.frequency.value = 140;
  out.connect(muffle);
  muffle.connect(trim);
  trim.connect(toneContext.destination);
  const playing = { out, sources: [], timer: null, stopped: false };
  rain = playing;
  playing.stop = () => {
    playing.stopped = true;
    clearTimeout(playing.timer);
    for (const src of playing.sources) {
      try {
        src.stop();
      } catch {
        // Already finished.
      }
    }
    out.disconnect();
    muffle.disconnect();
    trim.disconnect();
  };

  let recording;
  try {
    recording = await loadRainRecording();
  } catch (err) {
    console.warn("Couldn't load the rain sound:", err);
    return;
  }
  if (playing.stopped) return;

  // Plays the recording once from `when`, fading in at the start and out at
  // the end, and books the next copy to start as this one begins fading.
  const length = recording.duration;
  const playFrom = (when) => {
    if (playing.stopped) return;
    const src = toneContext.createBufferSource();
    src.buffer = recording;
    const gain = toneContext.createGain();
    gain.gain.setValueCurveAtTime(fadeCurve(true), when, RAIN_CROSSFADE);
    gain.gain.setValueCurveAtTime(fadeCurve(false), when + length - RAIN_CROSSFADE, RAIN_CROSSFADE);
    src.connect(gain);
    gain.connect(out);
    src.start(when);
    src.stop(when + length);
    playing.sources.push(src);
    src.onended = () => (playing.sources = playing.sources.filter((s) => s !== src));
    const next = when + length - RAIN_CROSSFADE;
    playing.timer = setTimeout(() => playFrom(next), Math.max(0, (next - toneContext.currentTime - 1) * 1000));
  };
  playFrom(toneContext.currentTime + 0.05);
}

// Call once when you walk into the Library, and once when you leave.
export function enterLibrary() {
  inLibrary = true;
  startRain();
}

export function leaveLibrary() {
  inLibrary = false;
}

export function setRainVolume(vol) {
  rainUserVolume = vol;
}

// Call every frame: fades the rain toward where it should be, and stops it
// completely once it has faded out after you leave.
export function updateRain(dt) {
  if (!rain || !rain.out) return;
  const target = inLibrary && !masterMuted ? rainUserVolume * masterVolume : 0;
  rainLevel += (target - rainLevel) * (1 - Math.pow(0.02, dt));
  if (Math.abs(target - rainLevel) < 0.001) rainLevel = target;
  rain.out.gain.value = rainLevel;
  if (!inLibrary && rainLevel === 0) {
    rain.stop();
    rain = null;
  }
}

// --- White noise while you sleep ---
// A soft, deep "shhh" (brown noise, made in code, so there's no file),
// gently muffled, like a fan across the room. Fades in when you get into
// bed and out when you get up, with its own volume slider.
let whiteNoise = null; // { out, stop } while playing
let asleep = false;
let whiteNoiseLevel = 0;
let whiteNoiseUserVolume = 0.3;

function startWhiteNoise() {
  if (!toneContext || whiteNoise) return;
  const rate = toneContext.sampleRate;
  const seconds = 8;
  const buffer = toneContext.createBuffer(1, rate * seconds, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise: each sample drifts from the last
    data[i] = last * 3.5;
  }
  // Blend the last half second into the start, so the loop has no seam.
  const blend = Math.floor(rate * 0.5);
  for (let i = 0; i < blend; i++) {
    const k = i / blend;
    data[i] = data[i] * k + data[data.length - blend + i] * (1 - k);
  }
  const source = toneContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopEnd = seconds - 0.5;
  const muffle = toneContext.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 900;
  const out = toneContext.createGain();
  out.gain.value = 0;
  source.connect(muffle);
  muffle.connect(out);
  out.connect(toneContext.destination);
  source.start();
  whiteNoise = { out, stop: () => source.stop() };
}

export function enterSleep() {
  asleep = true;
  startWhiteNoise();
}

export function leaveSleep() {
  asleep = false;
}

export function setWhiteNoiseVolume(vol) {
  whiteNoiseUserVolume = vol;
}

// Call every frame: fades the white noise toward where it should be, and
// stops it once it has faded out after you get up.
export function updateWhiteNoise(dt) {
  if (!whiteNoise) return;
  const target = asleep && !masterMuted ? whiteNoiseUserVolume * masterVolume : 0;
  whiteNoiseLevel += (target - whiteNoiseLevel) * (1 - Math.pow(0.05, dt));
  if (Math.abs(target - whiteNoiseLevel) < 0.001) whiteNoiseLevel = target;
  whiteNoise.out.gain.value = whiteNoiseLevel;
  if (!asleep && whiteNoiseLevel === 0) {
    whiteNoise.stop();
    whiteNoise = null;
  }
}

// Three soft notes drifting down: "goodnight", as you get into bed.
export function playGoodnightChime() {
  playTone(659.25, 0, { gain: 0.07, duration: 0.6, type: "sine" });
  playTone(523.25, 260, { gain: 0.07, duration: 0.6, type: "sine" });
  playTone(392, 520, { gain: 0.07, duration: 1.2, type: "sine" });
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

// After an automatic update, the page came back without a click, so the
// browser may be holding sound back. True until the first click.
export function soundIsBlocked() {
  return toneContext?.state === "suspended" || Object.values(peerAudioElements).some((el) => el.paused);
}

// Called on the first click after that: lets sound (and friends' voices) play.
export function resumeAudio() {
  toneContext?.resume();
  for (const el of Object.values(peerAudioElements)) el.play().catch(() => {});
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
let lofiVideoId = null; // the station you picked (see setLofiStation)

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
      videoId: lofiVideoId,
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

// Switches the Study music to another YouTube stream (your pick at the
// turntable). If the player is already going, it changes right away.
export function setLofiStation(videoId) {
  if (videoId === lofiVideoId) return;
  lofiVideoId = videoId;
  if (ytPlayer && ytPlayerReady) {
    if (inStudy) ytPlayer.loadVideoById(videoId);
    else ytPlayer.cueVideoById(videoId);
  }
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
