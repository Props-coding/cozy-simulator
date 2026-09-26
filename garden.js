// The shared garden (Update 4): twelve raised beds in the yard, and Hazel
// the hedgehog's seed stand by the garden's west fence.
//
// How it works:
// - Buy seeds from Hazel (press E by her). They go in your basket.
// - Press E at an empty bed to plant one. Crops grow in real time, even
//   while nobody's in the house, through four stages and then ripe.
// - Anyone can water anyone's bed (press E at a dry one: a blue droplet
//   floats over it). A watered crop grows at full speed for a few hours;
//   a dry one grows more slowly. Real rain in the hometown waters every bed.
// - Press E at your ripe bed to harvest. The crop goes in your basket, and
//   Hazel buys crops for crumbs.
//
// The beds live on the house server (so they're still growing when
// everyone's logged off). The server only remembers who planted what, when,
// and when it was watered; how grown a crop is gets worked out here, from
// those times and the crop list in config.js.
import { serverApi, accountName } from "./account.js";
import { sendGardenPing, onGardenPing } from "./network.js";
import { playClickSound, playCrumbSound, playWaterSound, playPlantSound, playHarvestSound } from "./audio.js";
import { unlock, count } from "./achievements.js";
import { addCrumbs, spendCrumbs, crumbBalance } from "./shop.js";
import { registerItems, basketCount, addToBasket, takeFromBasket, basketItems, itemInfo } from "./basket.js";
import { openNpc } from "./npc.js";
import { isReallyRaining } from "./weather.js";

const HOUR = 3_600_000;
const CROPS = Object.fromEntries(CONFIG.crops.map((c) => [c.id, c]));

// "Blueberry seeds", not "Blueberries seeds".
const seedName = (crop) => crop.name.replace(/ies$/, "y").replace(/([^s])s$/, "$1") + " seeds";

// Tell the basket what seeds and crops are.
registerItems(
  Object.fromEntries(
    CONFIG.crops.flatMap((c) => [
      [`seed:${c.id}`, { name: seedName(c), icon: "🌰", sell: 0, group: "Seeds" }],
      [`crop:${c.id}`, { name: c.name, icon: c.icon, sell: c.sell, group: "Harvest" }],
    ])
  )
);

let state = { version: 0, plots: {} };
let clockOffset = 0; // the server's clock minus ours, so everyone agrees how grown things are
let hooks = { color: () => "#999999", notice: () => {} };

const serverNow = () => Date.now() + clockOffset;
const isMine = (plot) => !!plot && plot.owner.toLowerCase() === (accountName() ?? "").toLowerCase();

// --- How grown is it? ---
// Watered time counts in full, dry time counts at CONFIG.garden.dryGrowth.
// Returns { progress (0 to 1), stage (0 to 3 growing, 4 ripe), dry,
// hoursLeft (if kept watered) }.
export function growthOf(plot, now = serverNow()) {
  const crop = CROPS[plot.crop];
  if (!crop) return { progress: 0, stage: 0, dry: false, hoursLeft: 0 };
  const wetFor = CONFIG.garden.waterHours * HOUR;
  const start = plot.plantedAt;
  let wet = 0, until = start;
  for (const w of [...plot.waters].sort((a, b) => a - b)) {
    const from = Math.max(w, until, start), to = Math.min(w + wetFor, now);
    if (to > from) wet += to - from;
    until = Math.max(until, Math.min(w + wetFor, now));
  }
  const total = Math.max(0, now - start);
  const grown = wet + (total - wet) * CONFIG.garden.dryGrowth;
  const progress = Math.min(1, grown / (crop.hours * HOUR));
  const lastWater = Math.max(...plot.waters, start);
  const dry = now - lastWater > wetFor;
  return {
    progress,
    stage: progress >= 1 ? 4 : Math.min(3, Math.floor(progress * 4)),
    dry,
    hoursLeft: ((1 - progress) * crop.hours),
  };
}

// --- Keeping up to date ---
export function startGarden(options) {
  hooks = { ...hooks, ...options };
  refresh();
  setInterval(refresh, 30_000);
  setInterval(updateView, 1000);
  setInterval(reportRain, 60_000);
  onGardenPing(refresh);
  window.addEventListener("weather", () => setTimeout(reportRain, 2000));
}

async function refresh() {
  try {
    apply(await serverApi("GET", "/api/garden"));
  } catch {
    // Offline for a moment, or not logged in: try again next time.
  }
}

function apply(next) {
  if (!next?.plots) return;
  if (Number.isFinite(next.now)) clockOffset = next.now - Date.now();
  state = next;
  // The rain watered one of your beds: that counts as a Rain Check.
  if (Object.values(state.plots).some((p) => isMine(p) && p.wateredBy === "rain")) unlock("rainCheck");
  updateView();
}

// What render.js draws on each bed (see FURNITURE_DRAWERS.gardenPlot).
function updateView() {
  const beds = [];
  for (const f of FURNITURE) {
    if (f.kind !== "gardenPlot") continue;
    const plot = state.plots[f.bed];
    const crop = plot && CROPS[plot.crop];
    if (!crop) {
      beds[f.bed] = null;
      continue;
    }
    const g = growthOf(plot);
    beds[f.bed] = { crop: crop.id, look: crop.look, color: crop.color, stage: g.stage, dry: g.dry, owner: plot.owner, ownerColor: plot.color };
  }
  globalThis.gardenView = { beds };
}

// While it's really raining in the hometown, whoever's in the house tells
// the server, and every bed gets watered (at most once every half hour).
let lastRainReport = 0;
async function reportRain() {
  if (!isReallyRaining() || Date.now() - lastRainReport < 20 * 60_000) return;
  const anyDry = Object.values(state.plots).some((p) => growthOf(p).dry || serverNow() - Math.max(...p.waters) > 30 * 60_000);
  if (!anyDry) return;
  lastRainReport = Date.now();
  await act({ action: "rain" });
}

async function act(body) {
  try {
    const next = await serverApi("POST", "/api/garden", body);
    apply(next);
    sendGardenPing();
    return next.result ?? {};
  } catch (err) {
    hooks.notice(err.message || "The garden didn't answer. Try again in a moment.");
    return null;
  }
}

// --- Pressing E at a bed ---
const myPlotCount = () => Object.values(state.plots).filter(isMine).length;

// "3h 20m" or "12m".
function timeText(hours) {
  const m = Math.max(1, Math.round(hours * 60));
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m}m`;
}

// The hint under the room name while you stand at a bed.
export function gardenHint(bed) {
  const plot = state.plots[bed];
  if (!plot) {
    if (myPlotCount() >= CONFIG.garden.maxPlotsPerPlayer) return `An empty bed. You're already growing in ${CONFIG.garden.maxPlotsPerPlayer} beds, the most at once.`;
    if (basketItems("seed:").length === 0) return "An empty bed. Buy seeds from Hazel, by the garden's west fence, to plant here.";
    return "An empty bed. Press E to plant a seed.";
  }
  const crop = CROPS[plot.crop];
  const g = growthOf(plot);
  const whose = isMine(plot) ? "Your" : `${plot.owner}'s`;
  const name = crop?.name.toLowerCase() ?? plot.crop;
  if (g.stage === 4) return isMine(plot) ? `Your ${name} is ripe! Press E to harvest.` : `${whose} ${name} is ripe and ready for them to pick.`;
  const stage = ["just planted", "sprouting", "growing", "nearly there"][g.stage];
  const left = `about ${timeText(g.hoursLeft)} to go if kept watered`;
  if (g.dry) return `${whose} ${name}: ${stage}, and thirsty. Press E to water it. (${left})`;
  return `${whose} ${name}: ${stage}, watered. (${left})` + (isMine(plot) ? " Press E to dig it up." : "");
}

export async function useGardenBed(bed) {
  const plot = state.plots[bed];
  if (!plot) return openSeedPicker(bed);
  const g = growthOf(plot);
  if (g.stage === 4 && isMine(plot)) return harvest(bed, plot);
  if (g.dry) return water(bed, plot);
  if (isMine(plot)) {
    const yes = await hooks.confirm({ title: "Dig it up?", text: `This pulls up your ${CROPS[plot.crop]?.name.toLowerCase() ?? "crop"} before it's ripe. You won't get anything back.`, yes: "Dig it up", no: "Keep it" });
    if (yes && (await act({ action: "clear", bed }))) playClickSound();
  }
}

async function water(bed, plot) {
  playWaterSound();
  const result = await act({ action: "water", bed });
  if (!result?.watered) return;
  if (!isMine(plot)) {
    count("friendsWatered");
    hooks.notice(`You watered ${plot.owner}'s ${CROPS[plot.crop]?.name.toLowerCase() ?? "crop"}. Neighborly!`);
  }
}

async function harvest(bed, plot) {
  const crop = CROPS[plot.crop];
  const result = await act({ action: "harvest", bed });
  if (!result?.crop || !crop) return;
  const [low, high] = crop.yield;
  const n = low + Math.floor(Math.random() * (high - low + 1));
  addToBasket(`crop:${crop.id}`, n);
  playHarvestSound();
  count("harvests", n);
  if (crop.id === "pumpkin") unlock("greatPumpkin");
  hooks.notice(`You harvested ${n} ${n === 1 ? crop.name.toLowerCase() : plural(crop)}! They're in your basket.`);
}

// "radishes", "strawberries", "tomatoes", "carrots"...
const plural = (crop) => {
  const name = crop.name.toLowerCase();
  if (name.endsWith("s")) return name;
  if (name.endsWith("y")) return name.slice(0, -1) + "ies";
  if (/(sh|ch|x|o)$/.test(name)) return name + "es";
  return name + "s";
};


// --- Picking a seed to plant ---
const picker = document.getElementById("seed-picker");
const pickerList = document.getElementById("seed-picker-list");
let pickerBed = null;

export function isSeedPickerOpen() {
  return !picker.hidden;
}

function openSeedPicker(bed) {
  if (myPlotCount() >= CONFIG.garden.maxPlotsPerPlayer) {
    hooks.notice(`You're already growing in ${CONFIG.garden.maxPlotsPerPlayer} beds. Harvest one first.`);
    return;
  }
  const seeds = basketItems("seed:");
  if (seeds.length === 0) {
    hooks.notice("You don't have any seeds. Hazel sells them, by the garden's west fence.");
    return;
  }
  pickerBed = bed;
  pickerList.innerHTML = "";
  for (const [id, n] of seeds.sort(([a], [b]) => (CROPS[a.slice(5)]?.hours ?? 0) - (CROPS[b.slice(5)]?.hours ?? 0))) {
    const crop = CROPS[id.slice(5)];
    if (!crop) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "seed-choice";
    button.innerHTML = `<span class="seed-icon"></span><b></b><small></small>`;
    button.querySelector(".seed-icon").textContent = crop.icon;
    button.querySelector("b").textContent = `${crop.name} × ${n}`;
    button.querySelector("small").textContent = `Ripe in ${timeText(crop.hours)} (watered)`;
    button.addEventListener("click", () => plant(crop));
    pickerList.appendChild(button);
  }
  picker.hidden = false;
  pickerList.querySelector("button")?.focus();
}

function closeSeedPicker() {
  picker.hidden = true;
  pickerBed = null;
}

async function plant(crop) {
  const bed = pickerBed;
  closeSeedPicker();
  if (!takeFromBasket(`seed:${crop.id}`)) return;
  const result = await act({ action: "plant", bed, crop: crop.id, color: hooks.color() });
  if (!result?.planted) {
    addToBasket(`seed:${crop.id}`); // it didn't go in: give the seed back
    return;
  }
  playPlantSound();
  unlock("firstSeed");
  hooks.notice(`You planted ${crop.name.toLowerCase()}. It's watered for now. Come back to check on it!`);
}

document.getElementById("seed-picker-close").addEventListener("click", () => {
  playClickSound();
  closeSeedPicker();
});
window.addEventListener("keydown", (e) => {
  if (picker.hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeSeedPicker();
  }
  const choice = pickerList.children[Number(e.key) - 1];
  if (choice) {
    e.preventDefault();
    choice.click();
  }
});

// --- Hazel the hedgehog ---
const HAZEL_HELLO = [
  "oh, hello dear! looking for seeds? i've got the good ones.",
  "welcome, welcome. the soil's lovely today.",
  "back again! how's your garden coming along?",
  "mind the snails. they're friends, but they're hungry.",
];
const HAZEL_THANKS = ["plant it somewhere sunny!", "don't forget to water it, dear.", "oh, that one's a favorite of mine.", "grow big, little seed!"];
const HAZEL_BUY_CROP = ["ooh, lovely! these'll go in a pie.", "look at that! you've got a green thumb.", "fresh from the garden. wonderful.", "i'll take those off your paws. thank you!"];

export function talkToHazel() {
  const first = !basketItems("seed:").length && !basketItems("crop:").length;
  openNpc({
    name: "Hazel",
    icon: "🦔",
    color: "#6a9a5a",
    pitch: 440,
    hello: first ? "oh! a new gardener! i'm hazel. seeds are on the counter, and i'll buy whatever you grow." : HAZEL_HELLO,
    tabs: [
      { id: "buy", label: "Buy seeds", items: seedsForSale },
      { id: "sell", label: "Sell harvest", items: cropsToSell, empty: "Nothing to sell yet. Grow something, then bring it here!" },
    ],
  });
}

function seedsForSale() {
  return CONFIG.crops.map((crop) => {
    const have = basketCount(`seed:${crop.id}`);
    const buy = (n) => () => {
      if (!spendCrumbs(crop.seed * n)) return `hmm, that's ${crop.seed * n} crumbs, dear. you have ${crumbBalance()}.`;
      addToBasket(`seed:${crop.id}`, n);
      playCrumbSound();
      return HAZEL_THANKS[Math.floor(Math.random() * HAZEL_THANKS.length)];
    };
    return {
      icon: crop.icon,
      name: seedName(crop),
      note: `Ripe in ${timeText(crop.hours)} watered. Sells for ${crop.sell} each, ${crop.yield[0] === crop.yield[1] ? crop.yield[0] : crop.yield.join(" to ")} per bed.${have ? ` You have ${have}.` : ""}`,
      price: crop.seed,
      actions: [
        { label: "Buy 1", run: buy(1), disabled: crumbBalance() < crop.seed },
        { label: "Buy 5", run: buy(5), soft: true, disabled: crumbBalance() < crop.seed * 5 },
      ],
    };
  });
}

function cropsToSell() {
  return basketItems("crop:").map(([id, n]) => {
    const info = itemInfo(id);
    const sell = (many) => () => {
      const k = many ? basketCount(id) : 1;
      if (!takeFromBasket(id, k)) return null;
      addCrumbs(info.sell * k);
      playCrumbSound();
      unlock("farmStand");
      return HAZEL_BUY_CROP[Math.floor(Math.random() * HAZEL_BUY_CROP.length)] + ` that's ${info.sell * k} crumbs.`;
    };
    return {
      icon: info.icon,
      name: `${info.name} × ${n}`,
      note: `${info.sell} crumbs each`,
      price: info.sell,
      actions: [
        { label: "Sell 1", run: sell(false), soft: true },
        { label: `Sell all (${info.sell * n})`, run: sell(true) },
      ],
    };
  });
}

// Admin panel helper: makes every bed ripe (for testing), by pretending
// each was planted long ago. Only changes what this computer sees.
export function ripenGardenPreview() {
  for (const plot of Object.values(state.plots)) {
    const crop = CROPS[plot.crop];
    if (!crop) continue;
    plot.plantedAt -= crop.hours * HOUR * 3;
    plot.waters = plot.waters.map((w) => w - crop.hours * HOUR * 3);
  }
  updateView();
}
