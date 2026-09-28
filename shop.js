// Crumbs (the house money) and the raccoons' shop.
//
// You earn crumbs just for being in the house (see config.js), and spend
// them on hats, shoes, glasses, scarves, backpacks, earrings and pets sold by three raccoons in a trenchcoat who lurk
// in the back alley, through a hidden door at the hallway's east end (they
// lived in the hallway until Update 4, then by the yard's bins until Update 7).
// They also buy junk you fish out of the pond. Talking to them opens a chatty speech box: their words
// type out letter by letter with a babbling voice. Then the coat swings
// open to show the wares.
//
// Crumbs and what you own are kept by the house server (the bank, see
// bank.js), which checks every purchase.
import { playCoatWhoosh, playCrumbSound, playClickSound } from "./audio.js";
import { typeWithBabble } from "./npc.js";
import { unlock } from "./achievements.js";
import { basketItems } from "./basket.js";
import { myWallet, bank } from "./bank.js";

// --- The raccoons ---
// Three voices: `pitch` is how high their babble sounds.
const RACCOONS = {
  reginald: { name: "Reginald", color: "#8a6ab0", pitch: 330 }, // top: fancy, does the talking
  pip: { name: "Pip", color: "#d9a441", pitch: 520 }, // middle: jittery, peeks out between buttons
  bean: { name: "Bean", color: "#5f8f6a", pitch: 185 }, // bottom: deep voice, very few words
};

// --- What's for sale ---
// The free hats and the raccoons' stock live in catalog.js (shared with
// the house server, which checks prices).
export const FREE_HATS = SHOP_FREE_HATS;
const CATALOG = SHOP_CATALOG;

// --- What you own ---
// Your crumbs and what you own live in the bank (bank.js); myWallet() is
// the server's latest copy.

// Every hat's height, for drawing name tags above hats (render.js).
globalThis.hatHeights = Object.fromEntries([
  ...FREE_HATS.map(([id, , height]) => [id, height]),
  ...CATALOG.filter((item) => item.type === "hat").map((item) => [item.id, item.height]),
]);

// The hats and shoes you own, as [id, name] lists (for the Join screen).
export function ownedHats() {
  return CATALOG.filter((item) => item.type === "hat" && myWallet().owned.includes(item.id)).map((item) => [item.id, item.name]);
}

export function ownedShoes() {
  return CATALOG.filter((item) => item.type === "shoes" && myWallet().owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// An item's name, like "Baby Dragon" for "dragon".
export function itemName(id) {
  return CATALOG.find((item) => item.id === id)?.name ?? id;
}

export function ownedGlasses() {
  return CATALOG.filter((item) => item.type === "glasses" && myWallet().owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// What you own of any one kind ("scarf", "backpack", "earrings", ...), as
// [id, name] pairs.
export function ownedOfType(type) {
  return CATALOG.filter((item) => item.type === type && myWallet().owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// How many of a list of item ids (like a friend's) are pets.
export function petsAmong(ids) {
  return CATALOG.filter((item) => item.type === "pet" && ids.includes(item.id)).length;
}

// How many things you own from the raccoons, and what they cost in all.
export function ownedCount() {
  return myWallet().owned.length;
}

export function ownedValue() {
  return CATALOG.filter((item) => myWallet().owned.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
}

export function ownedPets() {
  return CATALOG.filter((item) => item.type === "pet" && myWallet().owned.includes(item.id)).map((item) => [item.id, item.name]);
}

// --- Crumbs ---
const crumbPill = document.getElementById("crumb-pill");
const crumbCount = document.getElementById("crumb-count");
const shopCrumbs = document.getElementById("shop-crumbs");

function showCrumbs() {
  crumbCount.textContent = myWallet().crumbs;
  shopCrumbs.textContent = myWallet().crumbs;
  // Anything else showing crumbs (like Nest & Nook) listens for this.
  window.dispatchEvent(new Event("crumbs-changed"));
}
showCrumbs();

// Whenever the bank changes: the new count, with a little bounce if it went up.
window.addEventListener("bank-changed", (e) => {
  showCrumbs();
  if (!e.detail?.gained) return;
  crumbPill.classList.remove("bump");
  void crumbPill.offsetWidth; // restart the bounce animation
  crumbPill.classList.add("bump");
});

export function crumbBalance() {
  return myWallet().crumbs;
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

// True while the talking box (a conversation, not just a tip) or the shop
// is open (the game pauses your walking and game keys meanwhile).
export function isShopBusy() {
  return (!talkBox.hidden && !talkBox.classList.contains("passive")) || !shopPanel.hidden;
}

// A speaker: one of the raccoons by name, or anyone else as
// { name, color, pitch } (Otis uses the box too, see fishing.js).
const voiceOf = (speaker) => RACCOONS[speaker] ?? speaker;

// Types `text` into `el` a letter at a time, babbling in `speaker`'s voice.
function typeOut(el, speaker, text, onDone) {
  typing?.stop();
  typing = typeWithBabble(el, voiceOf(speaker).pitch, text, () => {
    typing = null;
    onDone?.();
  });
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
  talkName.textContent = voiceOf(speaker).name;
  talkName.style.setProperty("--speaker", voiceOf(speaker).color);
  talkNext.hidden = true;
  typeOut(talkText, speaker, text, () => (talkNext.hidden = false));
}

// Queues up some lines, and what to do when they're done. (Also used by
// other characters: exported as talk.)
function say(newLines, then = null) {
  talkBox.classList.remove("passive");
  coaching = "";
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
  talkBox.classList.remove("passive");
  coaching = "";
}

// For other characters: a conversation in the speech box (lines of
// [speaker, text], then what happens next), and answer buttons.
export const talk = say;
export const talkChoicesFor = offerChoices;

// A tip in the same speech box that doesn't stop you playing (no arrow,
// no clicking, your keys still work): Otis coaching you while you fish.
// An empty text puts it away. A real conversation always wins.
let coaching = "";
export function coach(speaker, text) {
  const passive = talkBox.classList.contains("passive");
  if (!talkBox.hidden && !passive) return;
  if (!text) {
    if (passive) closeTalk();
    return;
  }
  if (text === coaching) return;
  coaching = text;
  talkBox.classList.add("passive");
  talkBox.hidden = false;
  talkChoices.innerHTML = "";
  talkNext.hidden = true;
  talkName.textContent = voiceOf(speaker).name;
  talkName.style.setProperty("--speaker", voiceOf(speaker).color);
  typeOut(talkText, speaker, text);
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
    ["Why the alley?", () => {
      say([
        ["reginald", "the yard had too much... daylight."],
        ["pip", "and a hedgehog kept asking to see our business license."],
        ["reginald", "we are not a business. it says so on the dumpster."],
        ["bean", "the cat lets us stay."],
      ], mainChoices);
    }],
    ["Want some pond junk?", sellJunk],
    ["Never mind", () => say(pick(GOODBYES))],
  ]);
}

// Junk from the pond (old boots, tin cans...): the raccoons love it, and
// pay CONFIG.junkPrice crumbs a piece (Update 4).
async function sellJunk() {
  if (basketItems("junk:").length === 0) {
    say([["pip", "junk? JUNK?? you have no junk!"], ["reginald", "come back when you've fished up something... unwanted."], ["bean", "boots."]], mainChoices);
    return;
  }
  const sold = await bank("sellJunk");
  if (!sold?.sold) return;
  playCrumbSound();
  say([
    ["pip", sold.sold > 1 ? `ooh ooh ooh! ${sold.sold} treasures!` : "ooh! a treasure!"],
    ["reginald", `we'll take it all. ${sold.crumbs} crumbs, and no questions asked.`],
    ["bean", sold.ids.includes("junk:duck") ? "...duck. mine." : "nice."],
  ], mainChoices);
}

// Start a conversation (main.js calls this when you press E by them).
export function talkToRaccoons() {
  if (isShopBusy()) return;
  const intro = myWallet().met ? pick(INTROS) : FIRST_MEETING;
  if (!myWallet().met) bank("meet");
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
    const owned = myWallet().owned.includes(item.id);
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

let buying = false;
async function buy(item) {
  if (myWallet().owned.includes(item.id) || buying) return;
  if (myWallet().crumbs < item.price) {
    playClickSound();
    quip("pip", `ooh, ${item.price - myWallet().crumbs} crumbs short, pal. come back later!`);
    return;
  }
  buying = true;
  const bought = await bank("buy", { id: item.id });
  buying = false;
  if (!bought) return;
  playCrumbSound();
  wearItem(item, true, false);
  quip(pick(["reginald", "pip", "bean"]), item.line);
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
