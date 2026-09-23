// The Study's turntable: pick which lo-fi station plays for you there.
//
// Walk up to it and press E to open a crate of records, one per station
// (CONFIG.lofiStations). Your pick only changes the music on your own
// computer, so everyone in the Study can listen to their favorite. It's
// remembered (and saved to your account, so friends see it on your
// profile).
import { setLofiStation, playClickSound } from "./audio.js";

const STORAGE_KEY = "cozy-house-lofi";
const panel = document.getElementById("turntable-panel");
const list = document.getElementById("turntable-records");
const nowPlaying = document.getElementById("turntable-now");

// A station by its id (or the default one, if it's unknown).
export function lofiStation(id) {
  const stations = CONFIG.lofiStations;
  return stations.find((s) => s.id === id) || stations.find((s) => s.id === CONFIG.defaultLofiStation) || stations[0];
}

// Your pick, as saved (read fresh each time, since a cloud save can
// change it after you log in).
export function myLofiStation() {
  try {
    return lofiStation(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return lofiStation(null);
  }
}

// Tells the music player about your pick (call on joining).
export function applyMyLofi() {
  const station = myLofiStation();
  setLofiStation(station.videoId);
  globalThis.myLofiColor = station.color; // the record's label on the turntable (render.js)
}

function choose(id) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
  } catch {
    // Storage blocked: it still plays, just won't be remembered.
  }
  applyMyLofi();
  playClickSound();
  render();
}

function render() {
  const mine = myLofiStation();
  nowPlaying.textContent = `Now playing: ${mine.name}`;
  list.innerHTML = "";
  // Alphabetical, with the default one marked.
  const stations = [...CONFIG.lofiStations].sort((a, b) => a.name.localeCompare(b.name));
  for (const station of stations) {
    const record = document.createElement("button");
    record.type = "button";
    record.className = "turntable-record" + (station.id === mine.id ? " playing" : "");
    record.style.setProperty("--sleeve", station.color);
    const disc = document.createElement("span");
    disc.className = "turntable-disc";
    const name = document.createElement("span");
    name.className = "turntable-name";
    name.textContent = station.id === CONFIG.defaultLofiStation ? `${station.name} (default)` : station.name;
    record.append(disc, name);
    record.addEventListener("click", () => choose(station.id));
    list.appendChild(record);
  }
}

export function openTurntable() {
  render();
  panel.hidden = false;
  playClickSound();
}

export function closeTurntable() {
  panel.hidden = true;
}

export function isTurntableOpen() {
  return !panel.hidden;
}

document.getElementById("turntable-close").addEventListener("click", () => {
  closeTurntable();
  playClickSound();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isTurntableOpen()) closeTurntable();
});
