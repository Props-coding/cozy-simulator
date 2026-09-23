// Updates without anyone pressing Ctrl + F5.
//
// Every minute, the page quietly checks the site for a newer build number.
// When there is one, a banner counts down from 10 and then the page loads
// the new version under a fresh address (so the browser can't hand back an
// old saved copy). Just before, it remembers where you were standing, so
// the new page skips the Join screen and puts you right back.
//
// Browsers don't let a page start sound on its own, so after an automatic
// update there's a "click anywhere" note until your first click.
import { playClickSound } from "./audio.js";

const RESUME_KEY = "cozy-house-resume"; // where you were, just before an update
const CHECK_EVERY = 60_000;
const COUNTDOWN = 10;

const banner = document.getElementById("update-banner");
const bannerText = document.getElementById("update-text");
const nowButton = document.getElementById("update-now");

let hooks = { build: "0", where: () => null, busy: () => false };
let waiting = null; // the newer build we're about to load
let secondsLeft = COUNTDOWN;

// main.js tells us this page's build, where you are, and whether you're in
// the middle of something (so the update waits for you).
export function initUpdater(options) {
  hooks = options;
  setInterval(check, CHECK_EVERY);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

// Newer means a higher number: "0.41" beats "0.40".
const newer = (a, b) => Number(a) > Number(b);

async function check() {
  if (waiting) return;
  try {
    const res = await fetch(`index.html?check=${Date.now()}`, { cache: "no-store" });
    const build = (await res.text()).match(/id="version-tag">build ([\d.]+)</)?.[1];
    if (build && newer(build, hooks.build)) startCountdown(build);
  } catch {
    // Offline for a moment: try again next time.
  }
}

function startCountdown(build) {
  waiting = build;
  secondsLeft = COUNTDOWN;
  banner.hidden = false;
  tick();
}

function tick() {
  if (!waiting) return;
  if (hooks.busy()) {
    bannerText.textContent = "The house got an update! It'll tidy up as soon as you're done here.";
  } else {
    bannerText.textContent = `The house just got an update! Tidying up in ${secondsLeft}...`;
    secondsLeft--;
    if (secondsLeft < 0) return go();
  }
  setTimeout(tick, 1000);
}

function go() {
  const where = hooks.where();
  try {
    if (where) sessionStorage.setItem(RESUME_KEY, JSON.stringify({ ...where, until: Date.now() + 2 * 60_000 }));
  } catch {
    // Can't remember where you were: you'll land on the Join screen instead.
  }
  location.replace(`${location.pathname}?v=${waiting}`);
}

nowButton.addEventListener("click", () => {
  playClickSound();
  go();
});

// After an update: where you were (or null). It's only used once.
export function takeResume() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESUME_KEY));
    sessionStorage.removeItem(RESUME_KEY);
    return saved && saved.until > Date.now() ? saved : null;
  } catch {
    return null;
  }
}
