// Crumbs (the house money) and the raccoons' shop.
//
// You earn crumbs just for being in the house (see config.js), and spend
// them on hats, shoes and pets sold by three raccoons in a trenchcoat who lurk
// in the hallway. Talking to them opens a chatty speech box: their words
// type out letter by letter with a babbling voice. Then the coat swings
// open to show the wares.
//
// Crumbs and what you own are saved in this browser only (there's no
// server), so they don't follow you to another computer.
import { playBabble, playCoatWhoosh, playCrumbSound, playClickSound } from "./audio.js";
import { unlock } from "./achievements.js";

// --- The raccoons ---
// Three voices: `pitch` is how high their babble sounds.
const RACCOONS = {
  reginald: { name: "Reginald", color: "#8a6ab0", pitch: 330 }, // top: fancy, does the talking
  pip: { name: "Pip", color: "#d9a441", pitch: 520 }, // middle: jittery, peeks out between buttons
  bean: { name: "Bean", color: "#5f8f6a", pitch: 185 }, // bottom: deep voice, very few words
};

// --- What's for sale ---
// Hats everyone has for free (they're on the Join screen from the start):
// [id, name, height]. A hat's height is how many pixels it reaches above
// the top of your head, so name tags can sit just above it (0 for none).
export const FREE_HATS = [
  ["none", "No hat", 0],
  ["beanie", "Beanie", 5],
  ["cap", "Cap", 2],
  ["bow", "Bow", 4],
  ["headphones", "Headphones", 3],
  ["flower", "Flower", 2],
];

// The raccoons' stock. `line` is what they say when you buy it. A hat's
// `height` is how far it reaches above your head, in pixels (see FREE_HATS).
const CATALOG = [
  { id: "partyHat", type: "hat", name: "Party Hat", price: 15, height: 18, line: "it's always somebody's birthday. probably." },
  { id: "chefHat", type: "hat", name: "Chef Hat", price: 25, height: 17, line: "we found it. near a kitchen. unrelated." },
  { id: "topHat", type: "hat", name: "Top Hat", price: 40, height: 14, line: "very fancy. very legal. extremely legal." },
  { id: "cowboyHat", type: "hat", name: "Cowboy Hat", price: 40, height: 9, line: "yeehaw, as the humans say." },
  { id: "witchHat", type: "hat", name: "Witch Hat", price: 50, height: 20, line: "only slightly cursed. no refunds." },
  { id: "frogHat", type: "hat", name: "Frog Hat", price: 60, height: 6, line: "ribbit. that's the whole sales pitch." },
  { id: "crown", type: "hat", name: "Crown", price: 120, height: 7, line: "fell off a king. we think. don't ask." },
  { id: "halo", type: "hat", name: "Halo", price: 200, height: 22, line: "for when you've been good. very rare." },
  { id: "beret", type: "hat", name: "Beret", price: 20, height: 7, line: "ooh la la. we don't know what that means." },
  { id: "bucketHat", type: "hat", name: "Bucket Hat", price: 20, height: 6, line: "holds a hat's worth of stuff. which is your head." },
  { id: "sproutHat", type: "hat", name: "Head Sprout", price: 25, height: 11, line: "water daily. or don't. it's fake. probably." },
  { id: "catEars", type: "hat", name: "Cat Ears", price: 30, height: 8, line: "meow. that's free. the ears are 30." },
  { id: "flowerCrown", type: "hat", name: "Flower Crown", price: 35, height: 3, line: "picked fresh from someone's garden. not yours. don't check." },
  { id: "strawHat", type: "hat", name: "Straw Hat", price: 35, height: 7, line: "for summer. or for pretending it's summer." },
  { id: "propellerCap", type: "hat", name: "Propeller Cap", price: 40, height: 12, line: "doesn't fly. we tried. bean tried. twice." },
  { id: "mushroomCap", type: "hat", name: "Mushroom Cap", price: 45, height: 5, line: "not the eating kind. please don't eat it." },
  { id: "bunnyEars", type: "hat", name: "Bunny Ears", price: 50, height: 20, line: "one ear's floppy. it's a feature. a cute one." },
  { id: "gradCap", type: "hat", name: "Graduation Cap", price: 55, height: 9, line: "congratulations on graduating. from what? who knows." },
  { id: "santaHat", type: "hat", name: "Santa Hat", price: 60, height: 12, line: "ho ho... we're not allowed to finish that." },
  { id: "pirateHat", type: "hat", name: "Pirate Hat", price: 70, height: 11, line: "arr. we traded a map for it. the map was fake too." },
  { id: "vikingHelmet", type: "hat", name: "Viking Helmet", price: 80, height: 10, line: "horns sold separately. kidding. horns included." },
  { id: "tiara", type: "hat", name: "Tiara", price: 120, height: 9, line: "real diamonds. fake diamonds. same sparkle." },
  { id: "sneakers", type: "shoes", name: "Sneakers", price: 15, line: "zoom zoom. that's a feature." },
  { id: "rainBoots", type: "shoes", name: "Rain Boots", price: 25, line: "puddles fear you now." },
  { id: "bunnySlippers", type: "shoes", name: "Bunny Slippers", price: 30, line: "they're not real bunnies. we checked." },
  { id: "cowboyBoots", type: "shoes", name: "Cowboy Boots", price: 40, line: "pairs well with a hat. we sell hats." },
  { id: "rollerSkates", type: "shoes", name: "Roller Skates", price: 75, line: "wheeee. sorry. professional voice. wheee." },
  { id: "flipFlops", type: "shoes", name: "Flip-Flops", price: 10, line: "flip. flop. that's the sound. that's the name." },
  { id: "balletFlats", type: "shoes", name: "Ballet Flats", price: 25, line: "twirl twice before wearing. house rules." },
  { id: "sockSandals", type: "shoes", name: "Socks & Sandals", price: 25, line: "bold. fearless. a little crunchy." },
  { id: "clogs", type: "shoes", name: "Clogs", price: 30, line: "clip clop. very sturdy. very loud on stairs." },
  { id: "hikingBoots", type: "shoes", name: "Hiking Boots", price: 45, line: "for adventures. or the walk to the kitchen." },
  { id: "moonBoots", type: "shoes", name: "Moon Boots", price: 55, line: "one small step. very puffy." },
  { id: "glowSneakers", type: "shoes", name: "Light-Up Sneakers", price: 65, line: "they blink when you walk. like us when we see crumbs." },
  { id: "rubySlippers", type: "shoes", name: "Ruby Slippers", price: 150, line: "click your heels. results not guaranteed." },
  // Glasses go on your face.
  { id: "roundGlasses", type: "glasses", name: "Round Glasses", price: 20, line: "you look very smart. smarter than us. low bar." },
  { id: "sunglasses", type: "glasses", name: "Sunglasses", price: 25, line: "too cool for the house. but stay anyway." },
  { id: "catEyeGlasses", type: "glasses", name: "Cat-Eye Glasses", price: 35, line: "fancy. a little mysterious. like us." },
  { id: "heartGlasses", type: "glasses", name: "Heart Glasses", price: 40, line: "everything looks lovelier. even bean." },
  { id: "glasses3d", type: "glasses", name: "3D Glasses", price: 40, line: "for the theater. or for everything. your call." },
  { id: "starGlasses", type: "glasses", name: "Star Glasses", price: 50, line: "you're a star. the glasses say so." },
  { id: "goggles", type: "glasses", name: "Goggles", price: 60, line: "for the workshop. safety first. second: style." },
  { id: "monocle", type: "glasses", name: "Monocle", price: 90, line: "one eye fancy. the other eye regular. balance." },
  // Pets follow you around the house (one at a time).
  { id: "duck", type: "pet", name: "Duckling", price: 50, line: "it imprinted on us first. awkward. it's yours now." },
  { id: "frog", type: "pet", name: "Frog", price: 50, line: "ribbit. same pitch as the hat. we're consistent." },
  { id: "cat", type: "pet", name: "Cat", price: 60, line: "technically it adopted you. we just did the paperwork." },
  { id: "dog", type: "pet", name: "Pup", price: 60, line: "good boy. very good boy. best boy. okay bye boy." },
  { id: "bunny", type: "pet", name: "Bunny", price: 70, line: "hop hop. mind the cables." },
  { id: "hedgehog", type: "pet", name: "Hedgehog", price: 80, line: "pointy but polite." },
  { id: "fox", type: "pet", name: "Fox", price: 100, line: "what does it say? nobody knows. not even us." },
  { id: "penguin", type: "pet", name: "Penguin", price: 110, line: "formal wear included. no extra charge." },
  { id: "ghost", type: "pet", name: "Ghost", price: 150, line: "found it in the library. it followed us out. boo." },
  { id: "dragon", type: "pet", name: "Baby Dragon", price: 250, line: "small now. keep it away from the curtains." },
  { id: "raccoonKit", type: "pet", name: "Raccoon Kit", price: 300, line: "our cousin. very trustworthy. unlike us." },
  { id: "snail", type: "pet", name: "Snail", price: 40, line: "slow. steady. will get there eventually." },
  { id: "hamster", type: "pet", name: "Hamster", price: 55, line: "cheeks full of snacks. respect." },
  { id: "turtle", type: "pet", name: "Turtle", price: 65, line: "brings its own house. very efficient." },
  { id: "sheep", type: "pet", name: "Sheep", price: 75, line: "fluffy. counts itself to sleep." },
  { id: "owl", type: "pet", name: "Owl", price: 90, line: "wise. or it just looks wise. same thing, really." },
  { id: "bat", type: "pet", name: "Bat", price: 95, line: "spooky season, all season." },
  { id: "capybara", type: "pet", name: "Capybara", price: 120, line: "the calmest creature alive. the orange is included." },
  { id: "axolotl", type: "pet", name: "Axolotl", price: 140, line: "smiles all the time. we're a bit jealous." },
];

// --- Saved progress ---
const STORAGE_KEY = "cozy-house-crumbs";
let save = { crumbs: 0, owned: [], met: false };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && Number.isFinite(loaded.crumbs)) {
    save = {
      crumbs: Math.max(0, Math.floor(loaded.crumbs)),
      owned: Array.isArray(loaded.owned) ? loaded.owned.filter((id) => CATALOG.some((item) => item.id === id)) : [],
      met: loaded.met === true,
    };
  }
} catch {
  // Nothing saved yet, or storage is blocked: start from zero.
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage blocked (e.g. a private window): crumbs just won't be remembered.
  }
}

// Every hat's height, for drawing name tags above hats (render.js).
globalThis.hatHeights = Object.fromEntries([
  ...FREE_HATS.map(([id, , height]) => [id, height]),
  ...CATALOG.filter((item) => item.type === "hat").map((item) => [item.id, item.height]),
]);

// The hats and shoes you own, as [id, name] lists (for the Join screen).
export function ownedHats() {
  return CATALOG.filter((item) => item.type === "hat" && save.owned.includes(item.id)).map((item) => [item.id, item.name]);
}

export function ownedShoes() {
  return CATALOG.filter((item) => item.type === "shoes" && save.owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// An item's name, like "Baby Dragon" for "dragon".
export function itemName(id) {
  return CATALOG.find((item) => item.id === id)?.name ?? id;
}

export function ownedGlasses() {
  return CATALOG.filter((item) => item.type === "glasses" && save.owned.includes(item.id)).map((item) => [item.id, item.name]);
}

export function ownedPets() {
  return CATALOG.filter((item) => item.type === "pet" && save.owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// --- Crumbs ---
const crumbPill = document.getElementById("crumb-pill");
const crumbCount = document.getElementById("crumb-count");
const shopCrumbs = document.getElementById("shop-crumbs");

function showCrumbs() {
  crumbCount.textContent = save.crumbs;
  shopCrumbs.textContent = save.crumbs;
  // Anything else showing crumbs (like Nest & Nook) listens for this.
  window.dispatchEvent(new Event("crumbs-changed"));
}
showCrumbs();

// Adds crumbs, with a little bounce on the counter.
export function addCrumbs(amount) {
  save.crumbs += amount;
  store();
  showCrumbs();
  if (save.crumbs >= 500) unlock("hoarder");
  crumbPill.classList.remove("bump");
  void crumbPill.offsetWidth; // restart the bounce animation
  crumbPill.classList.add("bump");
}

// Spends crumbs if you have enough (for Nest & Nook). Returns true if it
// went through.
export function spendCrumbs(amount) {
  if (save.crumbs < amount) return false;
  save.crumbs -= amount;
  store();
  showCrumbs();
  return true;
}

// Admin panel helpers (for testing).
export function setCrumbs(amount) {
  save.crumbs = Math.max(0, Math.floor(amount));
  store();
  showCrumbs();
}

export function grantAllShopItems() {
  save.owned = CATALOG.map((item) => item.id);
  store();
}

export function crumbBalance() {
  return save.crumbs;
}

// Starts earning crumbs for time spent in the house. Call once, on joining.
let earning = null;
export function startEarningCrumbs() {
  earning ??= setInterval(() => addCrumbs(CONFIG.crumbsPerMinute), 60 * 1000);
}

// --- Connecting to main.js ---
// main.js tells us how to read and change what you're wearing.
let look = { get: () => ({ color: "#e05a47", hat: "none", shoes: "none", pet: "none" }), wear: () => {} };
export function initShop(options) {
  look = options;
}

// --- The talking box ---
const talkBox = document.getElementById("talk-box");
const talkName = document.getElementById("talk-name");
const talkText = document.getElementById("talk-text");
const talkNext = document.getElementById("talk-next");
const talkChoices = document.getElementById("talk-choices");
const shopPanel = document.getElementById("shop-panel");

let lines = []; // what's left to say: [speaker, text] pairs
let afterLines = null; // what happens once they've finished talking
let typing = null; // the typewriter currently running, if any

// True while the talking box or the shop is open (the game pauses your
// walking and game keys meanwhile).
export function isShopBusy() {
  return !talkBox.hidden || !shopPanel.hidden;
}

// Types `text` into `el` a letter at a time, babbling in `speaker`'s voice.
function typeOut(el, speaker, text, onDone) {
  typing?.stop();
  el.textContent = "";
  let i = 0;
  const timer = setInterval(() => {
    const letter = text[i];
    el.textContent += letter;
    if (i % 2 === 0 && /[a-z0-9]/i.test(letter)) playBabble(RACCOONS[speaker].pitch, letter);
    i++;
    if (i >= text.length) finish();
  }, 30);
  const finish = () => {
    clearInterval(timer);
    el.textContent = text;
    typing = null;
    onDone?.();
  };
  typing = { stop: () => clearInterval(timer), finish };
}

// Shows the next line in the queue (or runs what comes after).
function nextLine() {
  talkChoices.innerHTML = "";
  if (lines.length === 0) {
    const then = afterLines;
    afterLines = null;
    if (then) then();
    else closeTalk();
    return;
  }
  const [speaker, text] = lines.shift();
  talkName.textContent = RACCOONS[speaker].name;
  talkName.style.setProperty("--speaker", RACCOONS[speaker].color);
  talkNext.hidden = true;
  typeOut(talkText, speaker, text, () => (talkNext.hidden = false));
}

// Queues up some lines, and what to do when they're done.
function say(newLines, then = null) {
  talkBox.hidden = false;
  lines = [...newLines];
  afterLines = then;
  nextLine();
}

// Click, E, Enter or Space: finish the current line, or go to the next.
function advance() {
  if (talkChoices.childElementCount > 0) return; // waiting for you to pick
  if (typing) typing.finish();
  else nextLine();
}

// Shows answer buttons under the last line.
function offerChoices(choices) {
  talkNext.hidden = true;
  talkChoices.innerHTML = "";
  choices.forEach(([label, action], i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      playClickSound();
      talkChoices.innerHTML = "";
      action();
    });
    talkChoices.appendChild(button);
    if (i === 0) setTimeout(() => button.focus(), 0);
  });
}

function closeTalk() {
  typing?.stop();
  typing = null;
  lines = [];
  talkChoices.innerHTML = "";
  talkBox.hidden = true;
}

talkBox.addEventListener("click", advance);

// --- Conversations ---
const INTROS = [
  [["pip", "oh! a customer! act normal act normal act normal"], ["reginald", "good evening. welcome to our... establishment."], ["bean", "hats."]],
  [["bean", "..."], ["reginald", "ahem. what my, er, legs mean to say is: welcome back."], ["pip", "we got new stuff! maybe! we forget!"]],
  [["reginald", "ah. you again. splendid."], ["pip", "they came back! i TOLD you they'd come back!"], ["bean", "shoes too."]],
];
const FIRST_MEETING = [
  ["reginald", "psst. hey. you."],
  ["pip", "yeah, YOU."],
  ["bean", "...hi."],
  ["reginald", "we are one (1) perfectly normal person. in a coat."],
  ["reginald", "and this normal person happens to sell hats. and shoes. for crumbs."],
];
const GOODBYES = [
  [["pip", "come back with crumbs! lots of crumbs!"]],
  [["reginald", "a pleasure doing business. or not doing it. either way."]],
  [["bean", "bye."]],
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function mainChoices() {
  offerChoices([
    ["Show me the goods", openShop],
    ["Who are you, really?", () => {
      unlock("whoAreYou");
      say([
        ["reginald", "a tall gentleman. obviously."],
        ["pip", "definitely NOT three raccoons."],
        ["bean", "...three raccoons."],
        ["reginald", "BEAN."],
      ], mainChoices);
    }],
    ["Never mind", () => say(pick(GOODBYES))],
  ]);
}

// Start a conversation (main.js calls this when you press E by them).
export function talkToRaccoons() {
  if (isShopBusy()) return;
  const intro = save.met ? pick(INTROS) : FIRST_MEETING;
  unlock("raccoons");
  save.met = true;
  store();
  say(intro, mainChoices);
}

// --- The shop ---
const shopItems = document.getElementById("shop-items");
const shopQuipName = document.getElementById("shop-quip-name");
const shopQuipText = document.getElementById("shop-quip-text");
let shopTab = "hat";

// A raccoon remark at the top of the shop.
function quip(speaker, text) {
  shopQuipName.textContent = RACCOONS[speaker].name + ":";
  shopQuipName.style.color = RACCOONS[speaker].color;
  typeOut(shopQuipText, speaker, text);
}

function openShop() {
  talkBox.hidden = true;
  shopPanel.hidden = false;
  shopPanel.classList.remove("opening");
  void shopPanel.offsetWidth; // restart the coat-opening animation
  shopPanel.classList.add("opening");
  playCoatWhoosh();
  showCrumbs();
  renderShop();
  quip("reginald", pick(["behold. the wares.", "everything's one of a kind. mostly.", "no touching unless buying."]));
}

function closeShop() {
  typing?.stop();
  typing = null;
  shopPanel.hidden = true;
  say(pick(GOODBYES));
}

// Draws the item tags for the current tab.
function renderShop() {
  shopItems.innerHTML = "";
  const current = look.get();
  for (const item of CATALOG.filter((i) => i.type === shopTab).sort((a, b) => a.price - b.price)) {
    const owned = save.owned.includes(item.id);
    const wearing = current[item.type] === item.id;
    const tag = document.createElement("div");
    tag.className = "shop-item" + (wearing ? " wearing" : "");

    // A little preview of you wearing it. The canvas is taller than the
    // round backdrop at its bottom (see style.css), so tall hats, the halo
    // and big pets can poke out above the circle instead of being cut off.
    const preview = document.createElement("canvas");
    preview.width = 88;
    preview.height = 132;
    if (item.type === "pet") drawPetPreview(preview, item.id);
    else drawCharacterPreview(preview, { ...current, [item.type]: item.id });

    const name = document.createElement("div");
    name.className = "shop-item-name";
    name.textContent = item.name;

    const price = document.createElement("div");
    price.className = "shop-price";
    price.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
    price.append(owned ? "Yours!" : String(item.price));

    const button = document.createElement("button");
    button.type = "button";
    if (wearing) {
      button.className = "soft-button";
      button.textContent = item.type === "pet" ? "Send home" : "Take off";
      button.addEventListener("click", () => wearItem(item, false));
    } else if (owned) {
      button.className = "soft-button";
      button.textContent = item.type === "pet" ? "Bring along" : "Wear";
      button.addEventListener("click", () => wearItem(item, true));
    } else {
      button.className = "warm-button";
      button.textContent = "Buy";
      button.addEventListener("click", () => buy(item));
    }

    tag.append(preview, name, price, button);
    shopItems.appendChild(tag);
  }
}

function buy(item) {
  if (save.owned.includes(item.id)) return;
  if (save.crumbs < item.price) {
    playClickSound();
    quip("pip", `ooh, ${item.price - save.crumbs} crumbs short, pal. come back later!`);
    return;
  }
  save.crumbs -= item.price;
  save.owned.push(item.id);
  store();
  showCrumbs();
  playCrumbSound();
  wearItem(item, true, false);
  quip(pick(["reginald", "pip", "bean"]), item.line);
  checkShopAchievements();
}

// Achievements for what you own. Also run on joining, so things bought
// before achievements existed still count.
export function checkShopAchievements() {
  const ownsAll = (type) => CATALOG.filter((i) => i.type === type).every((i) => save.owned.includes(i.id));
  if (save.owned.length > 0) unlock("firstBuy");
  if (ownedPets().length >= 1) unlock("firstPet");
  if (ownedPets().length >= 5) unlock("menagerie");
  if (ownsAll("hat")) unlock("allHats");
  if (ownsAll("shoes")) unlock("allShoes");
  if (save.met) unlock("raccoons");
  if (save.crumbs >= 500) unlock("hoarder");
}

function wearItem(item, on, withSound = true) {
  look.wear(item.type, on ? item.id : "none");
  if (withSound) playClickSound();
  renderShop();
}

for (const tab of document.querySelectorAll("#shop-panel .shop-tabs button")) {
  tab.addEventListener("click", () => {
    shopTab = tab.dataset.tab;
    document.querySelectorAll("#shop-panel .shop-tabs button").forEach((b) => b.classList.toggle("active", b === tab));
    playClickSound();
    renderShop();
  });
}
document.getElementById("shop-bye").addEventListener("click", () => {
  playClickSound();
  closeShop();
});

// Keys while talking or shopping: E, Enter or Space moves the talk along,
// number keys pick an answer, and Escape leaves.
window.addEventListener("keydown", (e) => {
  if (!isShopBusy()) return;
  // While talking or shopping, keys belong to the raccoons only (so the E
  // that ends a conversation doesn't start a new one, and so on).
  e.stopImmediatePropagation();
  const key = e.key.toLowerCase();
  if (key === "escape") {
    e.preventDefault();
    if (!shopPanel.hidden) closeShop();
    else closeTalk();
    return;
  }
  if (!talkBox.hidden) {
    const choice = talkChoices.children[Number(e.key) - 1];
    if (choice) {
      e.preventDefault();
      choice.click();
    } else if ((key === "e" || key === " " || key === "enter") && talkChoices.childElementCount === 0) {
      e.preventDefault();
      advance();
    }
  }
});
