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
// Your rods, bait choice, XP and fish log are saved in this browser and in
// your cloud save. All the numbers are in config.js (fishing, rods, bait,
// fish, junk).
import { playClickSound, playCrumbSound, playWaterSound, playHarvestSound, playAchievementSound } from "./audio.js";
import { unlock, count } from "./achievements.js";
import { addCrumbs, spendCrumbs, crumbBalance } from "./shop.js";
import { registerItems, basketCount, addToBasket, takeFromBasket, basketItems, itemInfo } from "./basket.js";
import { openNpc, refreshNpc } from "./npc.js";
import { setTankFish, tankFish } from "./home.js";

const FISH = Object.fromEntries(CONFIG.fish.map((f) => [f.id, f]));
const RODS = CONFIG.rods;
const BAIT = Object.fromEntries(CONFIG.bait.map((b) => [b.id, b]));
const RARITY = ["", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

// Tell the basket what fish, bait and junk are.
registerItems({
  ...Object.fromEntries(CONFIG.fish.map((f) => [`fish:${f.id}`, { name: f.name, icon: f.icon, sell: f.sell, group: "Fish" }])),
  ...Object.fromEntries(CONFIG.bait.filter((b) => b.price > 0).map((b) => [`bait:${b.id}`, { name: b.name, icon: b.icon, sell: 0, group: "Bait" }])),
  ...Object.fromEntries(CONFIG.junk.map((j) => [`junk:${j.id}`, { name: j.name, icon: j.icon, sell: 0, group: "Junk" }])),
});

// --- Saved progress ---
const STORAGE_KEY = "cozy-house-fishing";
let save = { rod: "twig", rods: ["twig"], bait: "worm", xp: 0, log: {} };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    save.rods = Array.isArray(loaded.rods) ? loaded.rods.filter((id) => RODS.some((r) => r.id === id)) : ["twig"];
    if (!save.rods.includes("twig")) save.rods.unshift("twig");
    save.rod = save.rods.includes(loaded.rod) ? loaded.rod : "twig";
    save.bait = Object.hasOwn(BAIT, loaded.bait) ? loaded.bait : "worm";
    save.xp = Number.isFinite(loaded.xp) ? Math.max(0, Math.floor(loaded.xp)) : 0;
    for (const [id, entry] of Object.entries(loaded.log ?? {})) if (FISH[id] && Number.isFinite(entry?.n)) save.log[id] = { n: entry.n, best: Number(entry.best) || 0 };
  }
} catch {
  // Nothing saved yet, or storage is blocked: start fresh.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage blocked: fishing progress just won't be remembered.
  }
}

// Your fishing level (1 and up), from your XP.
export function fishingLevel(xp = save.xp) {
  let level = 1;
  CONFIG.fishing.levels.forEach((need, i) => {
    if (xp >= need) level = i + 1;
  });
  return level;
}

const myRod = () => RODS.find((r) => r.id === save.rod) ?? RODS[0];

// The bait you're using, or "none" if you've run out.
function baitInUse() {
  const bait = BAIT[save.bait];
  if (bait && (bait.price === 0 || basketCount(`bait:${bait.id}`) > 0)) return bait;
  return BAIT.none;
}

// --- Which fish is biting? ---
function fishAvailable(fish) {
  const when = fish.when ?? {};
  if (when.night === true && !isNightOutside()) return false;
  if (when.night === false && isNightOutside()) return false;
  if (when.rain && !OUTDOORS.raining) return false;
  if (when.season && !when.season.includes(currentSeason())) return false;
  return true;
}

// "Only at night", "Only in the rain, in winter"...
function whenText(fish) {
  const when = fish.when ?? {};
  const parts = [];
  if (when.night === true) parts.push("at night");
  if (when.night === false) parts.push("by day");
  if (when.rain) parts.push("in the rain");
  if (when.season) parts.push("in " + when.season.join(" or "));
  return parts.length ? "Only " + parts.join(", ") : "Any time";
}

function pickCatch(bait) {
  if (Math.random() < CONFIG.fishing.junkChance) {
    const junk = CONFIG.junk[Math.floor(Math.random() * CONFIG.junk.length)];
    return { junk };
  }
  // The rarer of the bait's rarities comes up less often, more with a better rod.
  const tiers = [...bait.catches].sort((a, b) => a - b);
  const weights = tiers.map((_, i) => (i === 0 ? 1 : 0.35 + myRod().luck));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let tier = tiers[0];
  for (let i = 0; i < tiers.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      tier = tiers[i];
      break;
    }
  }
  // If nothing of that rarity is biting right now, try the others.
  for (const t of [tier, ...tiers.filter((x) => x !== tier).reverse()]) {
    const pool = CONFIG.fish.filter((f) => f.rarity === t && fishAvailable(f));
    if (pool.length) return { fish: pool[Math.floor(Math.random() * pool.length)] };
  }
  return { junk: CONFIG.junk[0] };
}

// --- Casting, biting and reeling ---
// state: null, or { phase: "waiting" | "bite" | "reeling", bx, by, biteAt, catch }
let state = null;
let hooks = { notice: () => {} };
let biteTimer = null;

export function initFishing(options) {
  hooks = { ...hooks, ...options };
}

export function isFishing() {
  return !!state;
}

export function isReeling() {
  return state?.phase === "reeling";
}

// What friends see: your bobber (and whether a fish is biting).
export function fishingLine() {
  return state ? { bx: state.bx, by: state.by, bite: state.phase !== "waiting" } : null;
}

export function fishingHint() {
  if (!state) {
    const bait = baitInUse();
    const baitText = bait.price ? `${bait.name} ×${basketCount(`bait:${bait.id}`)}` : "no bait";
    return `Press E to cast your ${myRod().name.toLowerCase()} (${baitText}).`;
  }
  if (state.phase === "waiting") return "Waiting for a bite... (E or walking reels your line back in)";
  if (state.phase === "bite") return "A bite! Press E now!";
  return "";
}

// Press E at the water.
export function useFishing(spot) {
  if (!state) return cast(spot);
  if (state.phase === "bite") return hook();
  if (state.phase === "waiting") stopFishing("You reeled your line back in.");
}

function cast(spot) {
  const [low, high] = CONFIG.fishing.biteSeconds;
  const wait = (low + Math.random() * (high - low)) * myRod().bite * 1000;
  state = { phase: "waiting", bx: spot.bx, by: spot.by };
  playWaterSound();
  clearTimeout(biteTimer);
  biteTimer = setTimeout(bite, wait);
}

function bite() {
  if (!state) return;
  state.phase = "bite";
  playTug();
  biteTimer = setTimeout(() => stopFishing("It got away! Press E faster when the ! pops up."), CONFIG.fishing.hookSeconds * 1000);
}

function hook() {
  clearTimeout(biteTimer);
  const bait = baitInUse();
  if (bait.price) takeFromBasket(`bait:${bait.id}`);
  state.phase = "reeling";
  state.catch = pickCatch(bait);
  startReel(state.catch.fish?.rarity ?? 1);
}

// Stops fishing (walked away, reeled in, or it got away), with a message.
export function stopFishing(message) {
  if (!state) return;
  clearTimeout(biteTimer);
  state = null;
  reelBar.hidden = true;
  cancelAnimationFrame(reelFrame);
  if (message) hooks.notice(message);
}

// A little "plip plip" when something tugs the line.
function playTug() {
  playWaterSound();
  setTimeout(playWaterSound, 180);
}

// --- The reeling bar ---
const reelBar = document.getElementById("fishing-bar");
const reelZone = document.getElementById("fishing-zone");
const reelMarker = document.getElementById("fishing-marker");
let reelFrame = null;
let reel = null; // { zoneStart, zoneWidth, speed, started }

function startReel(rarity) {
  const zoneWidth = Math.max(0.08, myRod().zone * (1 - (rarity - 1) * 0.12));
  reel = { zoneStart: 0.15 + Math.random() * (0.7 - zoneWidth), zoneWidth, speed: 0.55 + rarity * 0.22, started: performance.now() };
  reelZone.style.left = reel.zoneStart * 100 + "%";
  reelZone.style.width = reel.zoneWidth * 100 + "%";
  reelBar.hidden = false;
  const move = () => {
    reelMarker.style.left = markerAt() * 100 + "%";
    reelFrame = requestAnimationFrame(move);
  };
  move();
}

// Where the marker is (0 to 1), bouncing back and forth.
function markerAt() {
  const t = ((performance.now() - reel.started) / 1000) * reel.speed;
  const p = t % 2;
  return p < 1 ? p : 2 - p;
}

function tryLand() {
  const at = markerAt();
  const inZone = at >= reel.zoneStart && at <= reel.zoneStart + reel.zoneWidth;
  const caught = state.catch;
  if (!inZone) {
    stopFishing(caught.junk ? "Whatever it was, it slipped off the hook." : `The ${RARITY[caught.fish.rarity].toLowerCase()} fish got away! So close.`);
    return;
  }
  stopFishing(null);
  land(caught);
}

function land(caught) {
  const levelBefore = fishingLevel();
  if (caught.junk) {
    addToBasket(`junk:${caught.junk.id}`);
    save.xp += 1;
    store();
    playClickSound();
    hooks.notice(`You reeled in... ${caught.junk.name.toLowerCase()}. ${caught.junk.id === "duck" ? "Squeak!" : "Maybe the raccoons want it?"}`);
  } else {
    const fish = caught.fish;
    const [small, big] = fish.size;
    const size = Math.round(small + Math.random() ** 1.6 * (big - small));
    const first = !save.log[fish.id];
    const entry = (save.log[fish.id] ??= { n: 0, best: 0 });
    entry.n++;
    const record = size > entry.best && !first;
    entry.best = Math.max(entry.best, size);
    save.xp += CONFIG.fishing.xp[fish.rarity - 1] ?? 5;
    store();
    addToBasket(`fish:${fish.id}`);
    count("fishCaught");
    unlock("firstCatch");
    if (fish.rarity >= 4) unlock("bigOne");
    if (fish.rarity >= 5) unlock("legendCatch");
    if (Object.keys(save.log).length >= 10) unlock("pondScholar");
    playHarvestSound();
    const extra = first ? " New in your fish log!" : record ? " A new record!" : "";
    hooks.notice(`You caught a ${fish.name} (${size} cm, ${RARITY[fish.rarity].toLowerCase()})!${extra}`, 6000);
    if (fish.rarity >= 4) hooks.post?.(`${fish.name} (${size} cm)`, { id: fish.id, size }); // (shared in the house chat)
  }
  const levelNow = fishingLevel();
  if (levelNow > levelBefore) {
    setTimeout(() => {
      playAchievementSound();
      hooks.notice(`Fishing level ${levelNow}! ${RODS.some((r) => r.level === levelNow) ? "Otis has a new rod for you." : ""}`, 6000);
    }, 2500);
  }
}

reelBar.addEventListener("click", () => isReeling() && tryLand());

// While reeling, E, Space or a click lands the fish, and Escape lets go.
window.addEventListener("keydown", (e) => {
  if (!isReeling()) return;
  e.stopImmediatePropagation();
  const key = e.key.toLowerCase();
  if (e.repeat) return;
  if (key === "e" || key === " " || key === "enter") {
    e.preventDefault();
    tryLand();
  } else if (key === "escape") {
    e.preventDefault();
    stopFishing("You let it go.");
  }
});

// --- Otis the otter ---
const OTIS_HELLO = [
  "ahoy! otis here. rods, bait, and i'll buy whatever you pull out of that pond.",
  "fish are biting today. probably. they usually are.",
  "back for more? the big ones come out at night, you know.",
  "rain's the best time. the eels love it.",
];

export function talkToOtis() {
  openNpc({
    name: "Otis",
    icon: "🦦",
    color: "#5a7aa0",
    pitch: 280,
    hello: Object.keys(save.log).length === 0 ? "oh, a new face! i'm otis. here's a twig rod, on the house. grab some worms and give it a go!" : OTIS_HELLO,
    tabs: [
      { id: "rods", label: "Rods", items: rodRows },
      { id: "bait", label: "Bait", items: baitRows },
      { id: "sell", label: "Sell fish", items: fishToSell, empty: "No fish to sell yet. Cast a line at the pond!" },
      { id: "log", label: "Fish log", items: logRows },
    ],
  });
}

function levelNote() {
  const level = fishingLevel();
  const next = CONFIG.fishing.levels[level];
  return next === undefined ? `Fishing level ${level} (the top!)` : `Fishing level ${level}: ${save.xp} of ${next} XP to level ${level + 1}`;
}

function rodRows() {
  const level = fishingLevel();
  return [
    { icon: "⭐", name: levelNote(), note: "You earn XP for every catch. Higher levels unlock better rods." },
    ...RODS.map((rod) => {
      const owned = save.rods.includes(rod.id);
      const using = save.rod === rod.id;
      const locked = level < rod.level;
      const note = `Catch zone ${Math.round(rod.zone * 100)}%, bites ${Math.round((1 - rod.bite) * 100)}% quicker, luck +${Math.round(rod.luck * 100)}%.` + (locked ? ` Needs fishing level ${rod.level}.` : "");
      return {
        icon: locked ? "🔒" : rod.icon,
        name: rod.name + (using ? " (in hand)" : ""),
        note,
        price: owned ? undefined : rod.price,
        locked,
        actions: owned
          ? using
            ? []
            : [{ label: "Use", soft: true, run: () => ((save.rod = rod.id), store(), playClickSound(), "good choice. that one's got spirit.") }]
          : [{ label: "Buy", disabled: locked || crumbBalance() < rod.price, run: () => buyRod(rod) }],
      };
    }),
  ];
}

function buyRod(rod) {
  if (!spendCrumbs(rod.price)) return `that one's ${rod.price} crumbs, friend. you've got ${crumbBalance()}.`;
  save.rods.push(rod.id);
  save.rod = rod.id;
  store();
  playCrumbSound();
  return `the ${rod.name.toLowerCase()}! treat her well and she'll treat you well.`;
}

function baitRows() {
  const level = fishingLevel();
  return CONFIG.bait.map((bait) => {
    const have = bait.price ? basketCount(`bait:${bait.id}`) : null;
    const locked = level < bait.level;
    const using = save.bait === bait.id;
    const finds = bait.catches.map((r) => RARITY[r].toLowerCase()).join(" and ");
    const buy = (n) => () => {
      if (!spendCrumbs(bait.price * n)) return `that's ${bait.price * n} crumbs. you've got ${crumbBalance()}.`;
      addToBasket(`bait:${bait.id}`, n);
      save.bait = bait.id;
      store();
      playCrumbSound();
      return bait.id === "lure" ? "ooh, the fancy stuff. the legends can't resist it." : "fresh today! well. freshish.";
    };
    const actions = [];
    if (!using) actions.push({ label: "Use", soft: true, disabled: locked || (bait.price > 0 && !have), run: () => ((save.bait = bait.id), store(), playClickSound(), null) });
    if (bait.price) {
      actions.push({ label: "Buy 1", disabled: locked || crumbBalance() < bait.price, run: buy(1) });
      actions.push({ label: "Buy 10", soft: true, disabled: locked || crumbBalance() < bait.price * 10, run: buy(10) });
    }
    return {
      icon: locked ? "🔒" : bait.icon,
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
    const sell = (many) => () => {
      const k = many ? basketCount(id) : 1;
      if (!takeFromBasket(id, k)) return null;
      addCrumbs(info.sell * k);
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

function logRows() {
  const caught = Object.keys(save.log).length;
  return [
    { icon: "📖", name: `Your fish log: ${caught} of ${CONFIG.fish.length} kinds`, note: "Some fish only bite at night, in the rain, or in certain seasons." },
    ...[...CONFIG.fish]
      .sort((a, b) => a.rarity - b.rarity)
      .map((fish) => {
        const entry = save.log[fish.id];
        return entry
          ? { icon: fish.icon, name: `${fish.name} (${RARITY[fish.rarity].toLowerCase()})`, note: `Caught ${entry.n}, biggest ${entry.best} cm. ${whenText(fish)}.` }
          : { icon: "❔", name: `??? (${RARITY[fish.rarity].toLowerCase()})`, note: `Not caught yet. ${whenText(fish)}.`, locked: true };
      }),
  ];
}

// --- Your bedroom fish tank ---
export function openFishTank(tank) {
  const index = tank.decor.index;
  openNpc({
    name: "Your fish tank",
    icon: "🐠",
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
      icon: fish?.icon ?? "🐟",
      name: fish?.name ?? id,
      note: "Swimming happily.",
      actions: [
        {
          label: "Take out",
          soft: true,
          run: () => {
            const now = [...tankFish(index)];
            now.splice(i, 1);
            setTankFish(index, now);
            addToBasket(`fish:${id}`);
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
            if (tankFish(index).length >= CONFIG.fishing.tankSize || !takeFromBasket(id)) return null;
            setTankFish(index, [...tankFish(index), id.slice(5)]);
            playWaterSound();
            if (tankFish(index).length >= CONFIG.fishing.tankSize) unlock("fullTank");
            return "splash! blub blub.";
          },
        },
      ],
    };
  });
}

// Admin helper: some XP (for trying out rods).
export function addFishingXp(n) {
  save.xp += n;
  store();
  refreshNpc();
}
