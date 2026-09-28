// The shared garden (Update 4): raised beds anyone can grow in, and Hazel
// the hedgehog, who sells seeds and buys what you grow. Since Update 8 the
// big garden is at the Farm (sixteen beds, a bus trip away), and the yard
// keeps a starter patch of three beds for quick beginner crops. New
// gardeners meet Hazel by her seed stand in the yard for a lesson; after
// that she's at her farm, and her yard stand is a self-serve seed box.
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
import { setPicture } from "./pictures.js";
import { serverApi, accountName } from "./account.js";
import { sendGardenPing, onGardenPing } from "./network.js";
import { playClickSound, playCrumbSound, playWaterSound, playPlantSound, playHarvestSound } from "./audio.js";
import { unlock } from "./achievements.js";
import { playAchievementSound } from "./audio.js";
import { crumbBalance } from "./shop.js";
import { registerItems, basketCount, basketItems, itemInfo } from "./basket.js";
import { bank, applyBank, myWallet } from "./bank.js";
import { recipeShopRows, dishesToSell } from "./kitchen.js";
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
      [`seed:${c.id}`, { name: seedName(c), icon: `seed:${c.id}`, sell: 0, group: "Seeds" }],
      [`crop:${c.id}`, { name: c.name, icon: `crop:${c.id}`, sell: c.sell, group: "Harvest" }],
    ])
  )
);

let state = { version: 0, plots: {} };
let clockOffset = 0; // the server's clock minus ours, so everyone agrees how grown things are
let hooks = { color: () => "#999999", notice: () => {} };

const serverNow = () => Date.now() + clockOffset;

// --- Hazel's lesson (Update 8) ---
// "none" (not met her yet), "started" (she gave you a radish seed) or
// "done" (you've harvested). The house server keeps it. (An older server
// doesn't say: then everyone counts as done.)
const lesson = () => myWallet().gardenLesson ?? "done";
const inLesson = () => lesson() === "started";
window.addEventListener("bank-changed", () => {
  HAZEL.atFarm = lesson() === "done";
});
// Which beds are where ("yard" or "farm"), and what grows in each.
const bedPlace = (bed) => GARDEN_BEDS[bed]?.place ?? "yard";
const growsIn = (crop, bed) => bedPlace(bed) === "farm" || !!crop.starter;
const isMine = (plot) => !!plot && plot.owner.toLowerCase() === (accountName() ?? "").toLowerCase();

// --- How grown is it? ---
// Watered time counts in full, dry time counts at CONFIG.garden.dryGrowth.
// Returns { progress (0 to 1), stage (0 to 3 growing, 4 ripe), dry,
// hoursLeft (if kept watered) }.
export function growthOf(plot, now = serverNow()) {
  const crop = CROPS[plot.crop];
  if (!crop) return { progress: 0, stage: 0, dry: false, hoursLeft: 0 };
  // Hazel's lesson radish: waiting for its first water, then quick.
  if (plot.lesson) {
    const minutes = CONFIG.garden.lessonMinutes ?? 3;
    const progress = plot.waters.length ? Math.min(1, (now - plot.waters[0]) / (minutes * 60_000)) : 0;
    return { progress, stage: progress >= 1 ? 4 : Math.min(3, Math.floor(progress * 4)), dry: !plot.waters.length, hoursLeft: ((1 - progress) * minutes) / 60 };
  }
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
    applyBank(next); // (seeds out of your basket, a harvest in)
    sendGardenPing();
    return next.result ?? {};
  } catch (err) {
    hooks.notice(err.message || "The garden didn't answer. Try again in a moment.");
    return null;
  }
}

// --- Pressing E at a bed ---
const myPlotCount = () => Object.values(state.plots).filter(isMine).length;
const myLessonPlot = () => Object.values(state.plots).find((p) => p.lesson && isMine(p)) ?? null;

// "3h 20m" or "12m".
function timeText(hours) {
  const m = Math.max(1, Math.round(hours * 60));
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m}m`;
}

// The hint under the room name while you stand at a bed.
export function gardenHint(bed) {
  const plot = state.plots[bed];
  if (lesson() === "none") return "An empty bed. Hazel, by her seed stand just west of here, will show you how to garden.";
  if (inLesson()) {
    // Hazel's lesson, step by step.
    if (!plot) return myLessonPlot() ? "" : "Hazel: \"That's the one! Press E to plant your radish seed.\"";
    if (plot.lesson && isMine(plot)) {
      const g = growthOf(plot);
      if (g.dry) return "Hazel: \"Now it needs a drink. Press E to water it.\"";
      if (g.stage < 4) return `Hazel: "Lovely! Now we wait. It'll be ready in about ${timeText(g.hoursLeft)}. (Real crops take longer!)"`;
      return "Hazel: \"It's ripe! Press E to pull it up.\"";
    }
  }
  if (!plot) {
    if (myPlotCount() >= CONFIG.garden.maxPlotsPerPlayer) return `An empty bed. You're already growing in ${CONFIG.garden.maxPlotsPerPlayer} beds, the most at once.`;
    if (basketItems("seed:").length === 0) return bedPlace(bed) === "farm" ? "An empty bed. Hazel sells seeds at her farm stand, up by the barn." : "An empty bed. Seeds are at Hazel's stand, just west of here.";
    return bedPlace(bed) === "farm" ? "An empty bed. Press E to plant a seed." : "An empty starter bed: radishes, lettuce and carrots grow here. Press E to plant.";
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
  if (lesson() === "none") return hooks.notice("Say hello to Hazel first! She's by her seed stand, just west of the starter patch.");
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
    hooks.notice(`You watered ${plot.owner}'s ${CROPS[plot.crop]?.name.toLowerCase() ?? "crop"}. Neighborly!`);
  }
}

async function harvest(bed, plot) {
  const crop = CROPS[plot.crop];
  // The server checks it's ripe, and puts the harvest in your basket.
  const result = await act({ action: "harvest", bed });
  if (!result?.crop || !crop) return;
  const n = result.n;
  playHarvestSound();
  hooks.notice(`You harvested ${n} ${n === 1 ? crop.name.toLowerCase() : plural(crop)}! They're in your basket.`);
  if (result.lesson) setTimeout(lessonDone, 2600);
}

// Your first harvest: Hazel cheers, and heads off to her farm.
function lessonDone() {
  playAchievementSound();
  hooks.notice("Hazel: \"Your very first harvest! You're a natural. I'm heading back to my farm, where the big fields are: take the bus by the gate and come see me. My seed stand here is self-serve now, for radishes, lettuce and carrots.\"", 12000);
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
    hooks.notice(bedPlace(bed) === "farm" ? "You don't have any seeds. Hazel sells them at her farm stand, up by the barn." : "You don't have any seeds. Hazel's seed stand is just west of the starter patch.");
    return;
  }
  // (The starter patch only grows the quick beginner crops.)
  const here = seeds.filter(([id]) => CROPS[id.slice(5)] && growsIn(CROPS[id.slice(5)], bed));
  if (here.length === 0) {
    hooks.notice("Only radishes, lettuce and carrots grow in the starter patch. Your seeds need the Farm: take the bus by the gate!");
    return;
  }
  pickerBed = bed;
  pickerList.innerHTML = "";
  for (const [id, n] of here.sort(([a], [b]) => (CROPS[a.slice(5)]?.hours ?? 0) - (CROPS[b.slice(5)]?.hours ?? 0))) {
    const crop = CROPS[id.slice(5)];
    if (!crop) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "seed-choice";
    button.innerHTML = `<span class="seed-icon"></span><b></b><small></small>`;
    setPicture(button.querySelector(".seed-icon"), `seed:${crop.id}`, 26);
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
  if (!basketCount(`seed:${crop.id}`)) return;
  const result = await act({ action: "plant", bed, crop: crop.id, color: hooks.color() }); // (the seed comes out of your basket)
  if (!result?.planted) return;
  playPlantSound();
  if (result.lesson) return hooks.notice("Hazel: \"Well done! See the little droplet? It's thirsty. Press E on the bed to water it.\"", 7000);
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

// The lesson's steps, as rows in Hazel's window.
const LESSON_STEPS = [
  { icon: "seed:radish", name: "1. Plant", note: "Walk into the starter patch (the little fenced garden next to Hazel) and press E at an empty bed. Pick your radish seed." },
  { icon: "watering", name: "2. Water", note: "A droplet over a bed means it's thirsty. Press E on it to water. Anyone can water anyone's bed, and real rain waters them all." },
  { icon: "crop:radish", name: "3. Wait", note: "Your lesson radish grows in a few minutes. Real crops take from an hour (radishes) to two days (blueberries)." },
  { icon: "basket", name: "4. Harvest", note: "When it sparkles, it's ripe: press E to pull it up. Crops go in your basket; Hazel buys them." },
];

export function talkToHazel() {
  const base = { name: "Hazel", portrait: { f: "hazel", w: 0.55, h: 0.4 }, color: "#6a9a5a", pitch: 440 };
  // Brand new: she gives you a seed and starts the lesson.
  if (lesson() === "none") {
    return openNpc({
      ...base,
      hello: "oh! a new gardener! i'm hazel. never grown anything before? here, take this radish seed. i'll show you how.",
      tabs: [
        {
          id: "lesson",
          label: "Gardening lesson",
          items: () => [{ icon: "seed:radish", name: "A radish seed, from Hazel", note: "Free! Hazel will walk you through planting, watering and your first harvest.", actions: [{ label: "Take it", run: startLesson }] }],
        },
      ],
    });
  }
  if (inLesson()) {
    return openNpc({
      ...base,
      hello: ["go on, dear, the starter patch is right there!", "don't forget to water it. everything's thirstier than you'd think.", "radishes are the quickest. perfect for a first try."],
      tabs: [{ id: "lesson", label: "Lesson", items: () => LESSON_STEPS }],
    });
  }
  openNpc({
    ...base,
    hello: HAZEL_HELLO,
    tabs: [
      { id: "buy", label: "Buy seeds", items: () => seedsForSale() },
      { id: "sell", label: "Sell harvest", items: () => [...cropsToSell(), ...dishesToSell("ooh, home cooking! lovely.")], empty: "Nothing to sell yet. Grow something (or cook something), then bring it here!" },
      { id: "recipes", label: "Recipes", items: () => recipeShopRows("hazel", "a family recipe. cook it with love, dear.") },
    ],
  });
}

async function startLesson() {
  if (!(await bank("startGardenLesson"))) return null;
  playAchievementSound();
  hooks.notice("Hazel gave you a radish seed. Plant it in the starter patch: walk up to an empty bed and press E.", 7000);
  setTimeout(talkToHazel, 0); // (her window now shows the lesson's steps)
  return null;
}

// Hazel's seed stand in the yard, once she's moved to her farm: a
// self-serve box of beginner seeds, and a basket to leave crops for her.
export function openSeedBox() {
  openNpc({
    name: "Hazel's seed stand",
    portrait: { f: "seedStand", w: 1.45, h: 0.6 },
    color: "#6a9a5a",
    pitch: 440,
    hello: ["(a note, in neat little handwriting) \"self serve! beginner seeds here. the rest are at my farm, a short bus ride away. love, hazel\"", "(the note says) \"leave your crops in the basket and i'll pay you. water your neighbors' beds! -h\""],
    tabs: [
      { id: "buy", label: "Buy seeds", items: () => seedsForSale((crop) => crop.starter) },
      { id: "sell", label: "Sell harvest", items: () => cropsToSell(), empty: "Nothing to sell yet. Grow something, then bring it here!" },
    ],
  });
}

// (`only`: just some crops, like the seed box's beginner ones.)
function seedsForSale(only = () => true) {
  return CONFIG.crops.filter((crop) => !crop.merchant && only(crop)).map((crop) => {
    const have = basketCount(`seed:${crop.id}`);
    const buy = (n) => async () => {
      if (crumbBalance() < crop.seed * n) return `hmm, that's ${crop.seed * n} crumbs, dear. you have ${crumbBalance()}.`;
      if (!(await bank("buySeed", { id: crop.id, n }))) return null;
      playCrumbSound();
      return HAZEL_THANKS[Math.floor(Math.random() * HAZEL_THANKS.length)];
    };
    return {
      icon: `seed:${crop.id}`,
      name: seedName(crop),
      note: `Ripe in ${timeText(crop.hours)} watered. Sells for ${crop.sell} each, ${crop.yield[0] === crop.yield[1] ? crop.yield[0] : crop.yield.join(" to ")} per bed.${crop.starter ? "" : " Farm only."}${have ? ` You have ${have}.` : ""}`,
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
    const sell = (many) => async () => {
      const k = many ? basketCount(id) : 1;
      if (!(await bank("sell", { id, n: k }))) return null;
      playCrumbSound();
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
