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
import { playClickSound, playCrumbSound, playWaterSound, playHarvestSound, playAchievementSound } from "./audio.js";
import { crumbBalance } from "./shop.js";
import { registerItems, basketCount, basketItems, itemInfo } from "./basket.js";
import { bank, myWallet } from "./bank.js";
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

// --- Your fishing progress (the bank's latest copy) ---
const mine = () => myWallet().fishing;

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
  if (when.night === true) parts.push("at night");
  if (when.night === false) parts.push("by day");
  if (when.rain) parts.push("in the rain");
  if (when.season) parts.push("in " + when.season.join(" or "));
  return parts.length ? "Only " + parts.join(", ") : "Any time";
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
  bank("cast");
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

// Hooked! The server uses up the bait and decides what's on the line
// (the page only learns how hard it pulls: its rarity).
async function hook() {
  clearTimeout(biteTimer);
  state.phase = "hooking";
  const caught = await bank("hook");
  if (!state) return;
  if (!caught) return stopFishing("It got away!");
  state.phase = "reeling";
  state.catch = caught;
  startReel(caught.rarity);
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
    bank("lose");
    stopFishing(caught.junk ? "Whatever it was, it slipped off the hook." : `The ${RARITY[caught.rarity].toLowerCase()} fish got away! So close.`);
    return;
  }
  stopFishing(null);
  land();
}

// Landed: the server puts it in your basket and says what it was.
async function land() {
  const caught = await bank("land");
  if (!caught) return;
  if (caught.junk) {
    const junk = CONFIG.junk.find((j) => j.id === caught.junk);
    playClickSound();
    hooks.notice(`You reeled in... ${(junk?.name ?? "something").toLowerCase()}. ${caught.junk === "duck" ? "Squeak!" : "Maybe the raccoons want it?"}`);
  } else {
    const fish = FISH[caught.fish];
    playHarvestSound();
    const extra = caught.first ? " New in your fish log!" : caught.record ? " A new record!" : "";
    hooks.notice(`You caught a ${fish.name} (${caught.size} cm, ${RARITY[fish.rarity].toLowerCase()})!${extra}`, 6000);
    if (fish.rarity >= 4) hooks.post?.(`${fish.name} (${caught.size} cm)`, { id: fish.id, size: caught.size }); // (shared in the house chat)
  }
  const levelNow = caught.level;
  if (levelNow > caught.levelBefore) {
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
    hello: Object.keys(mine().log).length === 0 ? "oh, a new face! i'm otis. here's a twig rod, on the house. grab some worms and give it a go!" : OTIS_HELLO,
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
  return next === undefined ? `Fishing level ${level} (the top!)` : `Fishing level ${level}: ${mine().xp} of ${next} XP to level ${level + 1}`;
}

function rodRows() {
  const level = fishingLevel();
  return [
    { icon: "⭐", name: levelNote(), note: "You earn XP for every catch. Higher levels unlock better rods." },
    ...RODS.map((rod) => {
      const owned = mine().rods.includes(rod.id);
      const using = mine().rod === rod.id;
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

function baitRows() {
  const level = fishingLevel();
  return CONFIG.bait.map((bait) => {
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

function logRows() {
  const caught = Object.keys(mine().log).length;
  return [
    { icon: "📖", name: `Your fish log: ${caught} of ${CONFIG.fish.length} kinds`, note: "Some fish only bite at night, in the rain, or in certain seasons." },
    ...[...CONFIG.fish]
      .sort((a, b) => a.rarity - b.rarity)
      .map((fish) => {
        const entry = mine().log[fish.id];
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
