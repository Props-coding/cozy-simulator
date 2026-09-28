// Fishing at the pond (Update 4), and Otis the otter's bait stand by the dock.
//
// How it works:
// - Stand at the pond's edge (or on the dock) and press E to cast. Your
//   bobber floats out on the water, and friends can see your line.
// - Wait for a bite. When the "!" pops up, press E quickly to hook it.
// - Then a little bar appears with a marker sliding back and forth: press
//   E (or Space) while it's in the green zone to land the fish. Rarer fish
//   move faster; better rods have a wider green zone.
// - Bait decides which fish you can find (pricier bait, pricier fish), and
//   some fish only bite at night, in the rain, or in certain seasons. Now
//   and then you reel in junk instead (the raccoons buy junk).
// - Fish go in your basket. Sell them to Otis, or put them in the fish tank
//   in your bedroom (press E by it).
// - Every catch gives fishing XP. Your fishing level decides which rods
//   Otis will sell you, and each better rod costs a fair bit more.
//
// Your rods, bait choice, XP and fish log are kept by the house server
// (the bank, see bank.js), which also decides what bites, how big it is,
// and how soon a bite can come. All the numbers are in config.js
// (fishing, rods, bait, fish, junk).
import { uiIcon } from "./ui-icons.js";
import { setPicture } from "./pictures.js";
import { playClickSound, playCrumbSound, playWaterSound, playHarvestSound, playAchievementSound } from "./audio.js";
import { crumbBalance, talk, talkChoicesFor, coach } from "./shop.js";
import { registerItems, basketCount, basketItems, itemInfo } from "./basket.js";
import { bank, myWallet } from "./bank.js";
import { serverApi } from "./account.js";
import { recipeShopRows } from "./kitchen.js";
import { openNpc, refreshNpc } from "./npc.js";
import { setTankFish, tankFish } from "./home.js";

const FISH = Object.fromEntries(CONFIG.fish.map((f) => [f.id, f]));
const RODS = CONFIG.rods;
const BAIT = Object.fromEntries(CONFIG.bait.map((b) => [b.id, b]));
const RARITY = ["", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

// Tell the basket what fish, bait and junk are.
registerItems({
  ...Object.fromEntries(CONFIG.fish.map((f) => [`fish:${f.id}`, { name: f.name, icon: `fish:${f.id}`, sell: f.sell, group: "Fish" }])),
  ...Object.fromEntries(CONFIG.bait.filter((b) => b.price > 0).map((b) => [`bait:${b.id}`, { name: b.name, icon: `bait:${b.id}`, sell: 0, group: "Bait" }])),
  ...Object.fromEntries(CONFIG.junk.map((j) => [`junk:${j.id}`, { name: j.name, icon: `junk:${j.id}`, sell: 0, group: "Junk" }])),
});

// --- Your fishing progress (the bank's latest copy) ---
const mine = () => myWallet().fishing;

// --- Otis's lesson ---
// New fishers find Otis at the pond. He lends you his twig rod and talks
// you through your first catch (which, quietly, can't get away), in the
// speech box like the raccoons. Then you hand him the fish, he pays you
// for it, and he's off: after that he's at Willow Lake (for you), and a
// bait box stands in his spot at the pond.
// The server keeps where you are with it: mine().lesson is "none",
// "started", "caught" (the fish is in your basket, waiting for Otis) or
// "done".
const lesson = () => mine().lesson ?? "done";
const inLesson = () => lesson() === "started";
let otisLingers = false; // (he finishes saying goodbye before he goes)
window.addEventListener("bank-changed", () => {
  OTIS.atLake = lesson() === "done" && !otisLingers;
});
const OTIS_VOICE = { name: "Otis", color: "#5a7aa0", pitch: 280 };

// What Otis says while you fish your first fish: in the speech box at the
// top, without stopping you (main.js asks every frame). `spot`: the water
// you're at, if any. A quick word (nudge) wins for a couple of seconds.
// `other`: another teacher's [voice, line] (Hazel's, see garden.js), shown
// when Otis has nothing to say (one tip at a time).
let nudged = { text: "", until: 0 };
let caughtAt = 0;
function nudge(text) {
  nudged = { text, until: performance.now() + 2500 };
}
export function updateLessonCoach(spot, other = null) {
  let line = "";
  if (performance.now() < nudged.until) line = nudged.text;
  else if (inLesson()) {
    if (!state) line = spot ? "right here's good! press E to cast your line." : "";
    else if (state.phase === "waiting") line = "now we wait. see those shadows? one will swim up to your bobber.";
    else if (state.phase === "nibble") line = "easy... that's just a nibble. wait for the big splash!";
    else if (state.phase === "bite") line = "that's a bite! press E!";
    else if (state.phase === "reeling") line = "hold space to reel! if the line bar goes red, ease off a moment.";
  } else if (lesson() === "caught" && performance.now() - caughtAt < 9000) line = "you got one! bring it over here, let's have a look!";
  if (!line && other) return coach(other[0], other[1]);
  coach(OTIS_VOICE, line);
}

// The hint by Otis (main.js).
export function otisHint() {
  if (OTIS.atLake) return "Press E to talk to Otis: rods, bait, selling fish and your fish log.";
  if (lesson() === "caught") return "Press E to show Otis your fish.";
  return "Press E to talk to Otis. He'll teach you to fish.";
}

// Your fishing level (1 and up), from your XP.
export function fishingLevel(xp = mine().xp) {
  let level = 1;
  CONFIG.fishing.levels.forEach((need, i) => {
    if (xp >= need) level = i + 1;
  });
  return level;
}

const myRod = () => RODS.find((r) => r.id === mine().rod) ?? RODS[0];

// The bait you're using, or "none" if you've run out.
function baitInUse() {
  const bait = BAIT[mine().bait];
  if (bait && (bait.price === 0 || basketCount(`bait:${bait.id}`) > 0)) return bait;
  return BAIT.none;
}

// --- Which fish bite when (the house server decides what bites) ---
// "Only at night", "Only in the rain, in winter"...
function whenText(fish) {
  const when = fish.when ?? {};
  const parts = [];
  // (Rarer fish than the pond has only live at Willow Lake.)
  if (fish.rarity > (CONFIG.fishing.waters?.pond?.maxRarity ?? 5)) parts.push("at Willow Lake");
  if (when.night === true) parts.push("at night");
  if (when.night === false) parts.push("by day");
  if (when.rain) parts.push("in the rain");
  if (when.season) parts.push("in " + when.season.join(" or "));
  return parts.length ? "Only " + parts.join(", ") : "Any time";
}

// --- Casting, nibbles, the bite, and the tension reel ---
// Cast (press E at the water, or click the pond to aim), wait for a fish
// shadow to swim up to your bobber, let it nibble (don't strike yet!),
// then press E on the real bite. Then the tension reel: hold Space (or the
// mouse) to reel, let go to give line. Too tight and the line snaps; too
// loose for too long and the fish slips away.
//
// state: null, or { phase: "waiting" | "nibble" | "bite" | "hooking" |
// "reeling", bx, by, castAt, shadow (the shadow that came, or null) }
let state = null;
let hooks = { notice: () => {} };
let timer = null;

export function initFishing(options) {
  hooks = { ...hooks, ...options };
}

export function isFishing() {
  return !!state;
}

export function isReeling() {
  return state?.phase === "reeling";
}

// What friends see: your bobber (twitching on a nibble, dipping on a bite).
export function fishingLine() {
  return state ? { bx: state.bx, by: state.by, bite: ["bite", "hooking", "reeling"].includes(state.phase), nibble: state.phase === "nibble" && performance.now() < (state.twitchUntil ?? 0) } : null;
}

export function fishingHint(spot) {
  if (lesson() === "none") return "You'll need a fishing rod. Otis, the otter by the pond, will lend you one.";
  // (In Otis's lesson, he says it himself: updateLessonCoach.)
  if (inLesson() && state) return "";
  if (!state) {
    const bait = baitInUse();
    const baitText = bait.price ? `${bait.name} ×${basketCount(`bait:${bait.id}`)}` : "no bait";
    const where = spot?.water === "lake" ? "the lake" : "the pond";
    // Fancy bait at the beginners' pond: say where those fish really are.
    const pondMax = CONFIG.fishing.waters?.pond?.maxRarity ?? 5;
    if (spot?.water === "pond" && Math.min(...bait.catches) > pondMax) return `Only common and uncommon fish live in the pond. Your ${bait.name.toLowerCase()} is for rarer fish: take the bus to Willow Lake!`;
    return `Press E to cast your ${myRod().name.toLowerCase()} (${baitText}), or click ${where} to aim at a fish.`;
  }
  if (state.phase === "waiting") return "Waiting for a fish to swim over... (E or walking reels your line back in)";
  if (state.phase === "nibble") return "Something's nibbling... wait for the real bite!";
  if (state.phase === "bite") return "A bite! Press E now!";
  return "";
}

// Press E at the water: cast straight out, strike on a bite, or (too
// soon) spook it.
export function useFishing(spot) {
  if (lesson() === "none") return hooks.notice("You don't have a fishing rod yet. Otis, by the pond, will lend you one.");
  if (!state) return spot && castAt(spot);
  if (state.phase === "bite") return hook();
  // (In the lesson, striking too soon doesn't scare the fish off.)
  if (state.phase === "nibble" && inLesson()) return nudge("not yet! that's only a nibble. wait for the real bite.");
  if (state.phase === "nibble") return stopFishing("Too soon! That was only a nibble, and the fish swam off. Cast again.");
  if (state.phase === "waiting") stopFishing("You reeled your line back in.");
}

// Cast to a spot on the pond ({ bx, by }): E casts straight out; clicking
// the pond (main.js) aims.
export function castAt(spot) {
  const water = waterAt(spot.bx, spot.by);
  if (state || !water) return false;
  state = { phase: "waiting", bx: spot.bx, by: spot.by, water, castAt: Date.now(), shadow: null };
  bank("cast", { bx: spot.bx, by: spot.by });
  playWaterSound();
  clearTimeout(timer);
  timer = setTimeout(watch, 250);
  return true;
}

// Bites come a little faster with a better rod (and the Quick Bites boost).
function biteScale() {
  return myRod().bite * (myWallet().boost?.id === "quickBite" && myWallet().boost.until > Date.now() ? 0.7 : 1);
}

// While waiting: once the soonest bite could come, the first shadow to
// swim within reach of the bobber takes an interest. If none comes by the
// longest wait, a little one bites anyway.
function watch() {
  if (state?.phase !== "waiting") return;
  const [low, high] = CONFIG.fishing.biteSeconds;
  const waited = (Date.now() - state.castAt) / 1000;
  if (waited >= low * biteScale()) {
    const near = waterShadows(state.water, Date.now()).find((s) => Math.hypot(s.x - state.bx, s.y - state.by) <= CONFIG.fishing.shadows.reach);
    if (near || waited >= high * biteScale()) return startNibbles(near ?? null);
  }
  timer = setTimeout(watch, 250);
}

function startNibbles(shadow) {
  state.phase = "nibble";
  state.shadow = shadow?.id ?? null;
  POND_VIEW.locked = { ...(shadow ? { id: shadow.id, size: shadow.size } : { id: -1, size: "small" }), x: state.bx, y: state.by, water: state.water.id };
  const [few, most] = CONFIG.fishing.nibbles;
  let left = few + Math.floor(Math.random() * (most - few + 1));
  const next = () => {
    if (state?.phase !== "nibble") return;
    if (left-- <= 0) return bite();
    state.twitchUntil = performance.now() + 250;
    playWaterSound();
    const [a, b] = CONFIG.fishing.nibbleSeconds;
    timer = setTimeout(next, (a + Math.random() * (b - a)) * 1000);
  };
  const [a, b] = CONFIG.fishing.nibbleSeconds;
  timer = setTimeout(next, (a + Math.random() * (b - a)) * 1000);
}

function bite() {
  if (!state) return;
  state.phase = "bite";
  playTug();
  // (In the lesson, the fish waits for you.)
  if (!inLesson()) timer = setTimeout(() => stopFishing("It got away! Press E faster when the ! pops up."), CONFIG.fishing.hookSeconds * 1000);
}

// Hooked! The server uses up the bait, checks which shadow came to the
// bobber, and decides what's on the line (the page only learns how hard it
// pulls: its rarity and how it fights).
async function hook() {
  clearTimeout(timer);
  state.phase = "hooking";
  const caught = await bank("hook", { shadow: state.shadow });
  if (!state) return;
  if (!caught) return stopFishing("It got away!");
  state.phase = "reeling";
  state.catch = caught;
  startReel(caught);
}

// Stops fishing (walked away, landed it, or it got away), with a message.
export function stopFishing(message) {
  if (!state) return;
  clearTimeout(timer);
  state = null;
  POND_VIEW.locked = null;
  reelBar.hidden = true;
  cancelAnimationFrame(reelFrame);
  reel = null;
  if (message) hooks.notice(message);
}

// A little "plip plip" when something tugs the line.
function playTug() {
  playWaterSound();
  setTimeout(playWaterSound, 180);
}

// --- The tension reel ---
const reelBar = document.getElementById("fishing-bar");
const reelSay = document.getElementById("fishing-say");
const tensionFill = document.getElementById("fishing-tension");
const lineFill = document.getElementById("fishing-line");
const fishMark = document.getElementById("fishing-fish");
let reelFrame = null;
let reel = null; // { progress, tension, slack, pull, strength, nextTug, tugUntil, holding, last }
const PULL_WORDS = { steady: "It's pulling steadily.", darting: "It's darting about!", heavy: "It's heavy! Take it slow." };

function startReel(caught) {
  const R = CONFIG.fishing.reel;
  const pull = CONFIG.fishing.pulls[caught.pull] ? caught.pull : "steady";
  reel = { progress: R.start, tension: 0.3, slack: 0, pull, strength: caught.junk ? 0.6 : 1 + R.rarityPull * (caught.rarity - 1), nextTug: 0, tugUntil: 0, holding: false, last: performance.now(), t: 0 };
  reelSay.textContent = inLesson()
    ? "Otis: \"Hold Space to reel in. If the line gets tight (red), let go for a moment. Keep it green!\""
    : `${caught.junk ? "Something's on the line." : PULL_WORDS[pull]} Hold Space to reel in, let go to give it line.`;
  // Something on the line (you don't know what until it's landed): a
  // fish, or a question mark for junk; a bit bigger for a rare one.
  if (caught.junk) setPicture(fishMark, "unknown", 20);
  else fishMark.innerHTML = uiIcon("fish");
  fishMark.style.fontSize = caught.rarity >= 4 ? "24px" : "18px";
  reelBar.hidden = false;
  reelFrame = requestAnimationFrame(stepReel);
}

function stepReel(now) {
  if (!reel) return;
  const R = CONFIG.fishing.reel;
  const P = CONFIG.fishing.pulls[reel.pull];
  const dt = Math.min(0.05, (now - reel.last) / 1000);
  reel.last = now;
  reel.t += dt;
  // How hard the fish pulls right now: its steady pull, sudden tugs, and
  // (heavy ones) a slow swell.
  let pull = P.pull * reel.strength;
  if (P.tug) {
    if (reel.t >= reel.nextTug) {
      const [a, b] = P.every;
      reel.tugUntil = reel.t + 0.35;
      reel.nextTug = reel.t + a + Math.random() * (b - a);
    }
    if (reel.t < reel.tugUntil) pull += P.tug * reel.strength;
  }
  if (reel.pull === "heavy") pull *= 1 + 0.15 * Math.sin(reel.t * 1.3);
  const ease = 1.25 - myRod().zone; // (a stronger rod takes the strain better)
  if (reel.holding) {
    reel.tension += R.tensionUp * pull * ease * dt;
    reel.progress += R.reelSpeed * (1 - Math.min(0.6, pull * 0.3)) * dt;
  } else {
    reel.tension -= R.tensionDown * dt;
    reel.progress -= R.giveBack * pull * dt;
  }
  reel.tension = Math.max(0, Math.min(1.05, reel.tension));
  reel.slack = reel.tension < R.slackAt ? reel.slack + dt : 0;
  // Your first fish (Otis's lesson) can't get away: the line never quite
  // snaps, never goes slack for long, and the fish can't take all of it.
  if (inLesson()) {
    reel.tension = Math.min(reel.tension, 0.97);
    reel.slack = Math.min(reel.slack, R.slackSeconds * 0.5);
    reel.progress = Math.max(reel.progress, 0.03);
  }
  showReel();
  const what = state.catch.junk ? "Whatever it was" : `The ${RARITY[state.catch.rarity].toLowerCase()} fish`;
  if (reel.tension >= 1) return failReel(`Snap! The line was too tight. ${what} got away.`);
  if (reel.slack >= R.slackSeconds) return failReel(`The line went slack and ${what.toLowerCase()} slipped off the hook.`);
  if (reel.progress <= 0) return failReel(`${what} swam off with the line. So close!`);
  if (reel.progress >= 1) {
    stopFishing(null);
    land();
    return;
  }
  reelFrame = requestAnimationFrame(stepReel);
}

function showReel() {
  tensionFill.style.width = `${Math.min(100, reel.tension * 100)}%`;
  tensionFill.className = reel.tension > 0.85 ? "danger" : reel.tension > 0.6 ? "warn" : reel.tension < CONFIG.fishing.reel.slackAt ? "slack" : "";
  lineFill.style.width = `${Math.max(0, Math.min(100, reel.progress * 100))}%`;
  fishMark.style.left = `${Math.max(0, Math.min(100, reel.progress * 100))}%`;
}

function failReel(message) {
  bank("lose");
  stopFishing(message);
}

// Landed: the server puts it in your basket and says what it was, and how
// it measures up (your best, and the house's best).
async function land() {
  const wasLesson = inLesson();
  const caught = await bank("land");
  if (!caught) return;
  if (wasLesson && caught.fish) caughtAt = performance.now(); // (Otis wants to see it)
  if (caught.junk) {
    const junk = CONFIG.junk.find((j) => j.id === caught.junk);
    playClickSound();
    hooks.notice(`You reeled in... ${(junk?.name ?? "something").toLowerCase()}. ${caught.junk === "duck" ? "Squeak!" : "Maybe the raccoons want it?"}`);
  } else {
    const fish = FISH[caught.fish];
    playHarvestSound();
    const extra = caught.houseRecord ? " A new house record!" : caught.first ? " New in your fish log!" : caught.record ? " Your biggest yet!" : caught.houseBest ? ` (Your best: ${caught.best} cm. House best: ${caught.houseBest.size} cm, ${caught.houseBest.name}.)` : "";
    hooks.notice(`You caught a ${fish.name} (${caught.size} cm, ${RARITY[fish.rarity].toLowerCase()})!${extra}`, 7000);
    // Epic and legendary catches, and house records, go in the house chat.
    if (fish.rarity >= 4 || caught.houseRecord) hooks.post?.(`${fish.name} (${caught.size} cm)${caught.houseRecord ? ", a new house record" : ""}`, { id: fish.id, size: caught.size, record: caught.houseRecord === true });
  }
  const levelNow = caught.level;
  if (levelNow > caught.levelBefore) {
    setTimeout(() => {
      playAchievementSound();
      hooks.notice(`Fishing level ${levelNow}! ${RODS.some((r) => r.level === levelNow) ? "Otis has a new rod for you." : ""}`, 6000);
    }, 2500);
  }
}

// Reeling: hold Space (or press and hold on the bar) to reel; let go to
// give line. Escape lets it go.
const setHolding = (on) => reel && (reel.holding = on);
reelBar.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  setHolding(true);
});
window.addEventListener("pointerup", () => setHolding(false));
window.addEventListener("keydown", (e) => {
  if (!isReeling()) return;
  e.stopImmediatePropagation();
  const key = e.key.toLowerCase();
  if (key === " " || key === "e") {
    e.preventDefault();
    setHolding(true);
  } else if (key === "escape") {
    e.preventDefault();
    // (Not your first fish: Otis won't hear of it.)
    if (inLesson()) return nudge("don't let it go! keep reeling, you've got this.");
    failReel("You let it go.");
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key.toLowerCase() === "e") setHolding(false);
});
window.addEventListener("blur", () => setHolding(false));

// --- Otis the otter ---
const OTIS_HELLO = [
  "ahoy! otis here. rods, bait, and i'll buy whatever you pull out of this lake.",
  "fish are biting today. probably. they usually are.",
  "back for more? the big ones come out at night, you know.",
  "rain's the best time. the eels love it.",
  "the lake's where the real monsters live. the pond's for tiddlers.",
];

export function talkToOtis() {
  const O = OTIS_VOICE;
  // Brand new: he offers to lend you his twig rod and show you how.
  if (lesson() === "none") {
    return talk([
      [O, "oh, a new face! i'm otis. i fish. mostly i fish."],
      [O, "never fished before? here, you can borrow my old twig rod. and a few worms."],
    ], () => talkChoicesFor([
      ["Teach me to fish!", startLesson],
      ["Maybe later", () => talk([[O, "no rush. the fish aren't going anywhere. well, they are, but slowly."]])],
    ]));
  }
  // Mid-lesson: how it goes, again.
  if (inLesson()) {
    return talk([
      [O, "go on, give it a cast! stand at the water's edge, or on the little dock, and press E."],
      [O, "then wait for a shadow to swim up. the bobber twitches when one nibbles. don't strike yet!"],
      [O, "when it splashes and the \"!\" pops up, press E. then hold space to reel it in."],
    ]);
  }
  // Your first fish is in the basket: hand it over.
  if (lesson() === "caught") {
    return talk([[O, "ooh, you caught one! let's see it!"]], () => talkChoicesFor([
      ["Here you go", handOverFish],
      ["Not yet", () => talk([[O, "take your time. i'll be right here. admiring the water."]])],
    ]));
  }
  openNpc({
    name: "Otis",
    portrait: { f: "otis", w: 0.55, h: 0.4 },
    color: O.color,
    pitch: O.pitch,
    hello: OTIS_HELLO,
    tabs: [
      { id: "rods", label: "Rods", items: rodRows },
      { id: "bait", label: "Bait", items: baitRows },
      { id: "sell", label: "Sell fish", items: fishToSell, empty: "No fish to sell yet. Cast a line in the lake!" },
      { id: "log", label: "Fish log", items: logRows, onOpen: loadRecords },
      { id: "recipes", label: "Recipes", items: () => recipeShopRows("otis", "an old otter family secret. don't tell anyone.") },
    ],
  });
}

async function startLesson() {
  if (!(await bank("startLesson"))) return;
  playAchievementSound();
  talk([
    [OTIS_VOICE, "here you go! a twig rod and three worms. keep them."],
    [OTIS_VOICE, "stand at the water's edge (or on the little dock) and press E to cast. you can click the water to aim at a fish, too."],
    [OTIS_VOICE, "i'll be right here, telling you what to do. it's what i'm best at."],
  ]);
}

// You hand Otis your first fish: he pays you for it, says goodbye, and
// heads off to Willow Lake.
async function handOverFish() {
  otisLingers = true;
  const got = await bank("lessonHandIn");
  if (!got) {
    otisLingers = false;
    return talk([[OTIS_VOICE, "hm, no fish in your basket? catch another one and bring it here!"]]);
  }
  playCrumbSound();
  const name = FISH[got.fish]?.name.toLowerCase() ?? "fish";
  talk([
    [OTIS_VOICE, `a ${name}! a fine one, too. here, ${got.crumbs} crumbs for it. and keep the rod.`],
    [OTIS_VOICE, "you're a natural. i'm off to willow lake, where the big ones are."],
    [OTIS_VOICE, "take the bus by the gate and come find me! i've left a bait box here by the pond."],
  ], () => {
    otisLingers = false;
    OTIS.atLake = true;
  });
}

// --- Otis's bait box (at the pond, once he's moved to the lake) ---
// Worms and crickets for beginners, and a slot to sell your fish.
export function openBaitBox() {
  openNpc({
    name: "Otis's bait box",
    portrait: { f: "baitBox", w: 0.6, h: 0.45 },
    color: "#8a6a44",
    pitch: 280,
    hello: ["(a note, in wobbly otter writing) \"gone to the lake! worms and crickets inside. leave your fish in the slot and i'll pay you. -otis\"", "(the note says) \"pond fish only get so big. the lake's got the fancy ones! bus is by the gate. -o\""],
    tabs: [
      { id: "bait", label: "Bait", items: () => baitRows(["none", "worm", "cricket"]) },
      { id: "sell", label: "Sell fish", items: fishToSell, empty: "No fish to sell yet. Cast a line in the pond!" },
    ],
  });
}

function levelNote() {
  const level = fishingLevel();
  const next = CONFIG.fishing.levels[level];
  return next === undefined ? `Fishing level ${level} (the top!)` : `Fishing level ${level}: ${mine().xp} of ${next} XP to level ${level + 1}`;
}

function rodRows() {
  const level = fishingLevel();
  return [
    { icon: "level", name: levelNote(), note: "You earn XP for every catch. Higher levels unlock better rods." },
    ...RODS.map((rod) => {
      const owned = mine().rods.includes(rod.id);
      const using = mine().rod === rod.id;
      const locked = level < rod.level;
      const note = `Line strength ${Math.round(rod.zone * 250)}, bites ${Math.round((1 - rod.bite) * 100)}% quicker, luck +${Math.round(rod.luck * 100)}%.` + (locked ? ` Needs fishing level ${rod.level}.` : "");
      return {
        icon: locked ? "lock" : `rod:${rod.id}`,
        name: rod.name + (using ? " (in hand)" : ""),
        note,
        price: owned ? undefined : rod.price,
        locked,
        actions: owned
          ? using
            ? []
            : [{ label: "Use", soft: true, run: async () => ((await bank("useRod", { id: rod.id })) ? (playClickSound(), "good choice. that one's got spirit.") : null) }]
          : [{ label: "Buy", disabled: locked || crumbBalance() < rod.price, run: () => buyRod(rod) }],
      };
    }),
  ];
}

async function buyRod(rod) {
  if (crumbBalance() < rod.price) return `that one's ${rod.price} crumbs, friend. you've got ${crumbBalance()}.`;
  if (!(await bank("buyRod", { id: rod.id }))) return null;
  playCrumbSound();
  return `the ${rod.name.toLowerCase()}! treat her well and she'll treat you well.`;
}

// (`only`: just these kinds, for the bait box.)
function baitRows(only) {
  const level = fishingLevel();
  // (The traveling merchant's bait only shows once you have some.)
  return CONFIG.bait.filter((bait) => !only || only.includes(bait.id)).filter((bait) => !bait.merchant || basketCount(`bait:${bait.id}`) > 0 || mine().bait === bait.id).map((bait) => {
    const have = bait.price ? basketCount(`bait:${bait.id}`) : null;
    const locked = level < bait.level;
    const using = mine().bait === bait.id;
    const finds = bait.catches.map((r) => RARITY[r].toLowerCase()).join(" and ");
    const buy = (n) => async () => {
      if (crumbBalance() < bait.price * n) return `that's ${bait.price * n} crumbs. you've got ${crumbBalance()}.`;
      if (!(await bank("buyBait", { id: bait.id, n }))) return null;
      playCrumbSound();
      return bait.id === "lure" ? "ooh, the fancy stuff. the legends can't resist it." : "fresh today! well. freshish.";
    };
    const actions = [];
    if (!using) actions.push({ label: "Use", soft: true, disabled: locked || (bait.price > 0 && !have), run: async () => ((await bank("useBait", { id: bait.id })) && playClickSound(), null) });
    if (bait.price && !bait.merchant) {
      actions.push({ label: "Buy 1", disabled: locked || crumbBalance() < bait.price, run: buy(1) });
      actions.push({ label: "Buy 10", soft: true, disabled: locked || crumbBalance() < bait.price * 10, run: buy(10) });
    }
    return {
      icon: locked ? "lock" : `bait:${bait.id}`,
      name: bait.name + (using ? " (using)" : "") + (have !== null ? ` × ${have}` : ""),
      note: `Finds ${finds} fish.` + (locked ? ` Needs fishing level ${bait.level}.` : ""),
      price: bait.price || undefined,
      locked,
      actions,
    };
  });
}

function fishToSell() {
  return basketItems("fish:").map(([id, n]) => {
    const info = itemInfo(id);
    const sell = (many) => async () => {
      const k = many ? basketCount(id) : 1;
      if (!(await bank("sell", { id, n: k }))) return null;
      playCrumbSound();
      return ["a beauty! thanks, friend.", "that'll make a fine supper.", "ooh, look at those scales.", "pleasure doing business!"][Math.floor(Math.random() * 4)] + ` that's ${info.sell * k} crumbs.`;
    };
    return {
      icon: info.icon,
      name: `${info.name} × ${n}`,
      note: `${info.sell} crumbs each`,
      price: info.sell,
      actions: [
        { label: "Sell 1", soft: true, run: sell(false) },
        { label: `Sell all (${info.sell * n})`, run: sell(true) },
      ],
    };
  });
}

// The house's biggest of each fish (from the house server), for the log.
let houseRecords = {};
async function loadRecords() {
  try {
    houseRecords = (await serverApi("GET", "/api/fish-records")).records;
    refreshNpc();
  } catch {
    // (the log shows without them)
  }
}

function logRows() {
  const caught = Object.keys(mine().log).length;
  return [
    { icon: "book", name: `Your fish log: ${caught} of ${CONFIG.fish.length} kinds`, note: "Some fish only bite at night, in the rain, or in certain seasons." },
    ...[...CONFIG.fish]
      .sort((a, b) => a.rarity - b.rarity)
      .map((fish) => {
        const entry = mine().log[fish.id];
        return entry
          ? { icon: `fish:${fish.id}`, name: `${fish.name} (${RARITY[fish.rarity].toLowerCase()})`, note: `Caught ${entry.n}, your biggest ${entry.best} cm${houseRecords[fish.id] ? `, house best ${houseRecords[fish.id].size} cm (${houseRecords[fish.id].name})` : ""}. ${whenText(fish)}.` }
          : { icon: "unknown", name: `??? (${RARITY[fish.rarity].toLowerCase()})`, note: `Not caught yet. ${whenText(fish)}.`, locked: true };
      }),
  ];
}

// --- Your bedroom fish tank ---
export function openFishTank(tank) {
  const index = tank.decor.index;
  openNpc({
    name: "Your fish tank",
    portrait: { f: "fishTank", w: 1.0, h: 0.5 },
    color: "#3f8ab0",
    pitch: 600,
    hello: ["blub.", "blub blub.", "the fish look happy to see you."],
    tabs: [
      { id: "tank", label: "In the tank", items: () => tankRows(index), empty: "Nobody's swimming here yet. Add a fish you've caught!" },
      { id: "add", label: "Add fish", items: () => addRows(index), empty: "No fish in your basket. Go fishing at the pond!" },
    ],
  });
}

function tankRows(index) {
  return tankFish(index).map((id, i) => {
    const fish = FISH[id];
    return {
      icon: fish ? `fish:${fish.id}` : "fish:bluegill",
      name: fish?.name ?? id,
      note: "Swimming happily.",
      actions: [
        {
          label: "Take out",
          soft: true,
          run: () => {
            const now = [...tankFish(index)];
            now.splice(i, 1);
            setTankFish(index, now); // (the house server puts it back in your basket)
            playClickSound();
            return "blub. (bye!)";
          },
        },
      ],
    };
  });
}

function addRows(index) {
  const full = tankFish(index).length >= CONFIG.fishing.tankSize;
  return basketItems("fish:").map(([id, n]) => {
    const info = itemInfo(id);
    return {
      icon: info.icon,
      name: `${info.name} × ${n}`,
      note: full ? `The tank's full (${CONFIG.fishing.tankSize} fish).` : "Put one in your tank.",
      actions: [
        {
          label: "Add",
          disabled: full,
          run: () => {
            if (tankFish(index).length >= CONFIG.fishing.tankSize || !basketCount(id)) return null;
            setTankFish(index, [...tankFish(index), id.slice(5)]); // (the house server takes it from your basket)
            playWaterSound();
            return "splash! blub blub.";
          },
        },
      ],
    };
  });
}

// Admin helper: some XP (for trying out rods).
export async function addFishingXp(n) {
  await bank("adminFishXp", { n });
  refreshNpc();
}
