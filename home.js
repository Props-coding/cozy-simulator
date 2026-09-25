// Your bedroom as a home: its size, what you've bought at Nest & Nook,
// and where you've put it. Also the Nest & Nook store (shown on the
// laptop) and decorating (moving pieces around your room).
//
// Like crumbs, what you own is saved in your own browser (and your cloud
// save). What's placed, and the room's size, also go to the house server
// whenever they change, so friends can visit your room even while you're
// away.
import { serverApi } from "./account.js";
import { sendRoomsPing } from "./network.js";
import { spendCrumbs, crumbBalance } from "./shop.js";
import { unlock } from "./achievements.js";
import { playCrumbSound, playClickSound } from "./audio.js";

// --- Saved home ---
// size: "cozy" or "roomy". owned: item id -> how many you've bought.
// placed: [{ item, x, y }], x and y from your room's top-left corner.
const STORAGE_KEY = "cozy-house-home";
let home = { size: "cozy", owned: { starterDesk: 1, starterMattress: 1 }, placed: [] };
try {
  const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (loaded && typeof loaded === "object") {
    home.size = Object.hasOwn(BEDROOM_SIZES, loaded.size) ? loaded.size : "cozy";
    for (const [id, count] of Object.entries(loaded.owned ?? {})) {
      if (Object.hasOwn(DECOR, id) && Number.isInteger(count) && count > 0) home.owned[id] = Math.min(count, 99);
    }
    // Only keep placed pieces you own (and that fit).
    const counts = {};
    const mine = (Array.isArray(loaded.placed) ? loaded.placed : []).filter((p) => {
      counts[p?.item] = (counts[p?.item] || 0) + 1;
      return counts[p?.item] <= (home.owned[p?.item] || 0);
    });
    home.placed = mine;
  }
} catch {
  // Nothing saved yet, or storage is blocked: start with a bare room.
}
// Every bedroom comes with a laptop desk and a plain mattress (they can be
// moved like anything else). Rooms from before they could be moved get them
// in their old spots.
home.placed = tidyDecor(home.size, home.placed);

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(home));
  } catch {
    // Storage blocked (e.g. a private window): just won't be remembered.
  }
  hooks.changed();
  shareMyRoom();
}

// Sends your room (what's placed, and its size) to the house server.
// Also called once when you join, so it's up to date.
export function shareMyRoom() {
  serverApi("PUT", "/api/room/home", { placed: home.placed, size: home.size })
    .then(() => sendRoomsPing()) // friends fetch it right away
    .catch(() => {
      // Offline for a moment: it goes up with your next change.
    });
}

// Admin panel helpers (for testing): one of every Nest & Nook item, and
// the Roomy upgrade.
export function grantAllDecor() {
  for (const id of Object.keys(DECOR)) if (DECOR[id].tab) home.owned[id] = Math.max(home.owned[id] || 0, 1);
  store();
}

export function grantRoomy() {
  home.size = "roomy";
  store();
}

// Your room's size and placed decor (main.js puts these in your bedroom).
export function myHome() {
  return home;
}

// --- Connecting to main.js ---
// main.js tells us your color, where your bedroom is right now (its rect,
// or null), how to show a short message, and what to do when your room
// changes (redraw it).
let hooks = { color: () => "#e05a47", myRoom: () => null, notice: () => {}, changed: () => {} };
export function initHome(options) {
  hooks = options;
}

// How many of an item you have that aren't placed (or in your hands).
function spareCount(id) {
  const placed = home.placed.filter((p) => p.item === id).length;
  return (home.owned[id] || 0) - placed - (held?.item === id ? 1 : 0);
}

// When your crumbs change while the store is open (earning them for
// time in the house, say), redraw it so the wallet and the "crumbs short"
// buttons stay right.
window.addEventListener("crumbs-changed", () => {
  if (storePage?.isConnected && storePage.getClientRects().length > 0) renderStore(storePage); // only while it's showing
});

// --- Nest & Nook ---
// A little boutique website on the laptop: a striped awning, Wren the
// shopkeeper bird (who picks something special each day and thanks you
// when you buy), a tab for each part of the shop, and item cards.
const STORE_TABS = [
  ["furniture", "🛋️", "Furniture", "Beds, sofas, chairs and tables to fill your room."],
  ["plants", "🪴", "Plants", "Leafy friends, flowers in vases and plants that trail from shelves."],
  ["shelves", "📚", "Shelves", "Somewhere to put books, candles, crystals and mugs."],
  ["decor", "🕯️", "Decor", "Rugs, lamps, mirrors, lights and things for your walls."],
  ["upgrades", "✨", "Upgrades", "Make your room itself a little bigger."],
];
// Items added in builds 0.42 and 0.44 get a "New!" ribbon.
const NEW_ITEMS = new Set([
  "monsteraAdansonii", "hoyaFinlaysonii", "anthuriumRed", "anthuriumPink", "hoyaCompacta", "hoyaPolyneura",
  "canopyBed", "vanity", "clothesRack", "cloudSofa", "papasanChair", "eggChair", "poufCream", "poufPink", "mushroomStool", "sideTable", "aestheticDesk", "barCart", "catTree",
  "birdOfParadise", "oliveTree", "rubberPlant", "moneyTree", "zzPlant", "alocasia", "calathea", "peaceLily", "pilea", "philodendron", "spiderPlant", "jadePlant", "aloeVera",
  "orchid", "lavenderPot", "herbGarden", "terrarium", "pampasVase", "tulipVase", "sunflowerVase", "eucalyptusVase", "cherryBlossom", "macramePothos", "stringOfPearls", "hangingFern", "airPlants",
  "libraryShelf", "cubeShelf", "ladderShelf", "recordCrate", "floatingBooks", "candleShelf", "crystalShelf", "teaShelf",
  "heartRug", "checkerRug", "fluffyRug", "mushroomLamp", "moonLamp", "discoBall", "wavyMirror", "archMirror", "teddyBear", "blanketBasket", "fairyCurtain", "polaroidWall", "tapestry", "heartNeon",
]);
const WREN_HELLOS = [
  "Welcome in! Mind the dust bunnies, they're decorative.",
  "Oh, hello! Everything here was hand-picked. By me. With my beak.",
  "Browse all you like. I'll just be here, fluffing.",
  "Looking for something cozy? You've come to the right nook.",
];
const WREN_THANKS = [
  "Lovely choice! It'll look sweet in your room.",
  "Thank you kindly! Wrapped with a bit of string.",
  "Oh, that one's a favorite. Enjoy!",
  "Delivered straight to your bedroom. Free of charge!",
];
// What Wren says about each item: shown when you hover over its card, and
// on the "Wren's pick" card when it's the pick of the day.
const WREN_NOTES = {
  quiltBed: "Hand-stitched quilt in your own color. Sleep like a loaf.",
  canopyBed: "Gauzy drapes and tiny lights. You'll feel like royalty.",
  nightstand: "A little lamp for late-night reading. Glows so softly.",
  wardrobe: "Room for every sweater. Press E at it to change your outfit anytime.",
  dresser: "Drawers for socks, secrets and spare hair ties.",
  vanity: "Bulb mirror for getting ready like a movie star.",
  clothesRack: "Show off your favorite outfits. Very boutique of you.",
  cloudSofa: "Like sitting on a cloud, but it holds your tea.",
  loveseatSage: "A sage little sofa for two, or one plus a cat.",
  loveseatRose: "Rosy and plush, made for long phone calls.",
  armchair: "Deep cushions for losing whole afternoons to a book.",
  velvetChair: "Velvet chair. The cat came with it. She stays.",
  papasanChair: "A big round nest. You'll never want to get up.",
  eggChair: "Hang out, literally. Swings ever so gently.",
  rockingChair: "Rock, knit, repeat. Grandma approved.",
  beanbag: "Flop right in. It catches you every time.",
  poufCream: "Chunky knit pouf. A footrest, a seat, a vibe.",
  poufPink: "The pink one. Soft as a strawberry milkshake.",
  mushroomStool: "Straight from the forest. No gnomes were harmed.",
  bench: "Cushioned bench for pulling on boots.",
  coffeeTable: "For mugs, magazines and mid-game snacks.",
  sideTable: "Small, round, and exactly where your drink should go.",
  writingDesk: "For letters, journaling and the occasional doodle.",
  aestheticDesk: "The desk from your mood board, now in real life.",
  teaCart: "Roll the tea to wherever the cozy is.",
  barCart: "Gold and glam. Holds lemonade beautifully.",
  fireplace: "A crackling fire for your very own room. Toasty!",
  recordPlayer: "Spins your favorite records, crackles and all.",
  piano: "Plays soft melodies. Chopsticks counts.",
  fishTank: "Little fish, big personality. They wave at you.",
  arcade: "One more game. Okay, one more. Okay, one more.",
  telescope: "For stargazing and spotting the neighbor's cat.",
  globe: "Spin it and pick your next daydream.",
  toyChest: "Keep the clutter hidden and the fun close.",
  catBed: "A plush bed. A cat is already asleep in it.",
  catTree: "A tower for climbing. The cat is in charge now.",
  plant: "A cheerful little plant. Good starter friend.",
  monstera: "Big, dramatic split leaves. The queen of plants.",
  monsteraAdansonii: "Swiss cheese vine, holes and all, climbing a moss pole.",
  hoyaFinlaysonii: "Netted leaves and tiny pink stars. A collector's darling.",
  hoyaCompacta: "Curly Hindu rope vines. Twisty, waxy and so charming.",
  anthuriumRed: "Glossy hearts and waxy red blooms. So romantic.",
  anthuriumPink: "The pink anthurium: a whole valentine in a pot.",
  fiddleFig: "Tall, leafy and a little fussy. Worth it.",
  birdOfParadise: "Huge paddle leaves for tropical vibes indoors.",
  oliveTree: "Silvery leaves that make any corner feel Mediterranean.",
  rubberPlant: "Shiny, dark leaves and zero drama.",
  moneyTree: "A braided trunk. Said to bring good fortune.",
  palm: "A graceful palm for a sunny spot.",
  lemonTree: "Real lemons! Well, pretend ones. Still smells nice.",
  snakePlant: "Nearly unkillable. Perfect if you forget to water.",
  zzPlant: "Glossy and tough. Thrives on neglect, honestly.",
  alocasia: "Elephant-ear leaves with bold white veins.",
  calathea: "Painted leaves that fold up at night. Sleepy plant!",
  peaceLily: "White blooms that bring calm to a room.",
  pilea: "Round pancake leaves. Everyone's favorite gift plant.",
  philodendron: "Heart-shaped leaves, trailing just so.",
  spiderPlant: "Sprouts little babies you can share with friends.",
  fern: "Lush and feathery. Loves a bit of humidity.",
  ivyPlant: "Trailing ivy for a dark cottage feel.",
  bamboo: "Lucky bamboo stalks. Calm, green and tidy.",
  bonsai: "A tiny tree with a very old soul.",
  jadePlant: "Chubby little leaves. A symbol of good luck.",
  aloeVera: "Soothing, spiky and very practical.",
  cactus: "Tall and proud. Please don't hug it.",
  succulents: "A dish of tiny succulents. Cute in any light.",
  orchid: "Elegant pink orchid. Very fancy, very calm.",
  lavenderPot: "Smells like a summer field in France.",
  herbGarden: "Basil, mint and thyme, right in your room.",
  terrarium: "A whole tiny world under glass.",
  pampasVase: "Fluffy pampas grass. Boho in a vase.",
  tulipVase: "A cheerful bunch of spring tulips.",
  sunflowerVase: "A jug of sunflowers. Instant sunshine.",
  eucalyptusVase: "Fresh eucalyptus. Smells like a spa day.",
  cherryBlossom: "A branch of spring blossoms. Blink and it's gone.",
  macramePothos: "Golden pothos in a hand-knotted macramé hanger.",
  stringOfPearls: "Little green pearls spilling down the wall.",
  hangingFern: "A fern hanging from the wall, feathery and green.",
  hoyaPolyneura: "The fishtail hoya, trailing from the wall. Look at those veins!",
  pothosShelf: "A wall shelf with pothos trailing over the edge.",
  airPlants: "Air plants on a rack. No soil needed, just vibes.",
  driedHerbs: "Bundles of drying herbs. Very witchy kitchen.",
  bookshelf: "A sturdy shelf for your favorite stories.",
  libraryShelf: "Tall enough for a whole series and then some.",
  cubeShelf: "Cubbies and woven baskets for tidy storage.",
  ladderShelf: "Leaning shelves for plants, books and knick-knacks.",
  recordCrate: "A crate of vinyl to flip through on slow nights.",
  floatingBooks: "Books that seem to float on the wall.",
  candleShelf: "Candles in a row, glowing gently.",
  crystalShelf: "Amethyst, quartz and good energy.",
  teaShelf: "Your mug collection, on proud display.",
  jarShelf: "Jars of beans, pasta and pickled things.",
  rugBerry: "A warm berry rug to wiggle your toes on.",
  rugSage: "Soft sage green. Calm as a meadow.",
  rugHoney: "Golden honey tones. Like a sunny afternoon.",
  rugPlum: "Deep plum for a moody, cozy room.",
  roundRugCream: "A round cream rug. Soft and simple.",
  roundRugTeal: "A round teal rug. A pop of color underfoot.",
  heartRug: "A heart-shaped rug. Say it with the floor.",
  checkerRug: "Soft green checks. Very cottage chic.",
  fluffyRug: "Fluffy like a cloud. Toes will thank you.",
  floorLamp: "A tall lamp for a warm, cozy corner.",
  mushroomLamp: "A glowing little mushroom. Fairy approved.",
  moonLamp: "A tiny moon for your nightstand.",
  lavaLamp: "Blobs that float and wobble forever. Groovy.",
  candles: "A cluster of candles for a warm glow.",
  discoBall: "A little disco ball. Throws sparkles around.",
  wavyMirror: "A wavy mirror for your best angles.",
  archMirror: "A tall arched mirror. Outfit checks, perfected.",
  teddyBear: "A big, huggable teddy with a bow.",
  blanketBasket: "Throw blankets rolled up and ready.",
  yarnBasket: "Yarn for knitting. Or for the cat to steal.",
  bookStacks: "Piles of books you'll totally read someday.",
  floorCushions: "Big cushions for sitting on the floor with friends.",
  pumpkins: "Pumpkins and a candle. Autumn all year long.",
  rainWindow: "A window with rain tapping on the glass.",
  lakeWindow: "A window onto a calm lake at sunset.",
  moonWindow: "A round window with the moon peeking through.",
  leafWindow: "Autumn leaves drifting past the window.",
  stringLights: "Warm fairy lights strung across the wall.",
  fairyCurtain: "A curtain of twinkling lights. Pure magic.",
  polaroidWall: "Polaroids on a string. Memories on display.",
  tapestry: "A boho sunset tapestry for your wall.",
  neonSign: "A glowing \"cozy\" sign. Says it all.",
  heartNeon: "A pink neon heart. Glows all night.",
  paintingFlowers: "A cheerful painting of blooms in a vase.",
  paintingSea: "A little boat on a calm blue sea.",
  paintingHills: "Rolling hills and a sleepy sunset.",
  posterStars: "A starry night sky for dreamy nights.",
  posterMountains: "Mountains to remind you of the fresh air.",
  posterCat: "A very serious cat. Watching you. Lovingly.",
  worldMap: "A map for planning adventures.",
  corkBoard: "Pin up notes, doodles and to-do lists.",
  clock: "A wall clock. Tells time and looks nice doing it.",
  mirror: "A simple mirror for a quick hello to yourself.",
  scroll: "A calligraphy scroll. Calm, wise words.",
};
const pickLine = (list) => list[Math.floor(Math.random() * list.length)];

let storeTab = "furniture";
let storeQuery = ""; // what's typed in the search bar ("" when browsing a tab)

// The items matching a search: every word you type has to appear in the
// item's name, Wren's note about it, or its section's name.
function searchDecor(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tabNames = Object.fromEntries(STORE_TABS.map(([id, , label]) => [id, label]));
  return Object.entries(DECOR).filter(([id, item]) => {
    if (!item.tab) return false; // the starter desk and mattress aren't sold
    const text = `${item.name} ${WREN_NOTES[id] ?? ""} ${tabNames[item.tab]}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
let wrenSays = pickLine(WREN_HELLOS);

// Draws the store into `page` (a laptop page). `onTab` hears which
// section is showing (the laptop puts it in the address bar).
let tellTab = () => {};
let storePage = null; // where the store was last drawn
export function renderStore(page, onTab = tellTab) {
  storePage = page;
  tellTab = onTab;
  const hadFocus = document.activeElement?.classList.contains("nook-search-input"); // (checked before the redraw clears it)
  tellTab(storeQuery ? "search?q=" + encodeURIComponent(storeQuery) : storeTab);
  const scroll = page.scrollTop;
  page.innerHTML = "";
  page.classList.add("nook-page");
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // The shop front: a striped awning, the logo and your crumbs.
  const front = make("header", "nook-front");
  front.appendChild(make("div", "nook-awning"));
  const sign = make("div", "nook-sign");
  sign.innerHTML = '<svg class="nook-logo" aria-hidden="true"><use href="#nook-bird"></use></svg>';
  const words = make("div", "nook-words");
  words.append(make("strong", "", "Nest & Nook"), make("span", "", "little comforts for little rooms"));
  const wallet = make("span", "nook-wallet");
  wallet.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  wallet.append(String(crumbBalance()));
  sign.append(words, wallet);
  front.appendChild(sign);

  // Wren, the shopkeeper, with something to say.
  const wren = make("div", "nook-wren");
  wren.innerHTML = '<svg class="nook-wren-bird" aria-hidden="true"><use href="#nook-bird"></use></svg>';
  wren.appendChild(make("p", "nook-bubble", wrenSays));

  // The search bar. Typing only redraws the results below it, so the box
  // keeps its place and you can keep typing.
  const search = make("label", "nook-search");
  search.appendChild(make("span", "nook-search-icon", "🔍"));
  const input = make("input", "nook-search-input");
  input.type = "text";
  input.placeholder = "Search Nest & Nook (try \"pink\", \"lamp\" or \"hoya\")";
  input.value = storeQuery;
  input.setAttribute("aria-label", "Search Nest & Nook");
  const clear = make("button", "nook-search-clear", "✕");
  clear.type = "button";
  clear.title = "Clear the search";
  clear.hidden = !storeQuery;
  search.append(input, clear);

  const tabs = make("nav", "nook-tabs");
  for (const [id, icon, label] of STORE_TABS) {
    const tab = make("button", "nook-tab-" + id);
    tab.type = "button";
    tab.append(make("span", "nook-tab-icon", icon), label);
    tab.classList.toggle("active", !storeQuery && id === storeTab);
    tab.addEventListener("click", () => {
      storeTab = id;
      storeQuery = ""; // picking a section ends the search
      playClickSound();
      page.scrollTop = 0;
      renderStore(page);
    });
    tabs.appendChild(tab);
  }

  let section = storeSection(page, make);
  const showResults = () => {
    const fresh = storeSection(page, make);
    section.replaceWith(fresh);
    section = fresh;
    clear.hidden = !storeQuery;
    for (const tab of tabs.children) tab.classList.toggle("active", !storeQuery && tab.className.includes("nook-tab-" + storeTab));
    tellTab(storeQuery ? "search?q=" + encodeURIComponent(storeQuery) : storeTab);
  };
  input.addEventListener("input", () => {
    storeQuery = input.value.trim();
    showResults();
  });
  clear.addEventListener("click", () => {
    storeQuery = "";
    input.value = "";
    playClickSound();
    showResults();
    input.focus();
  });

  const footer = make("footer", "nook-footer", "Nest & Nook · free delivery to your bedroom · est. 2026 · 🪺");
  page.append(front, wren, search, tabs, section, footer);
  page.scrollTop = scroll;
  if (hadFocus) {
    input.focus(); // a redraw (like crumbs arriving) shouldn't interrupt your typing
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

// What's below the tabs: search results, or the current section.
function storeSection(page, make) {
  if (storeQuery) {
    const results = searchDecor(storeQuery);
    const section = make("section", "nook-section nook-results");
    const heading = make("div", "nook-heading");
    heading.append(
      make("h3", "", `Results for "${storeQuery}"`),
      make("p", "", results.length ? `${results.length} thing${results.length === 1 ? "" : "s"} found.` : "Hmm, nothing by that name. Try \"plant\", \"rug\" or \"lamp\"!")
    );
    section.appendChild(heading);
    const grid = make("div", "nook-grid");
    for (const [id, item] of results) grid.appendChild(itemCard(page, id, item));
    section.appendChild(grid);
    return section;
  }
  const [, , label, blurb] = STORE_TABS.find(([id]) => id === storeTab);
  const section = make("section", "nook-section nook-" + storeTab);
  const heading = make("div", "nook-heading");
  heading.append(make("h3", "", label), make("p", "", blurb));
  section.appendChild(heading);

  if (storeTab === "upgrades") {
    section.appendChild(upgradeCard(page));
  } else {
    const items = Object.entries(DECOR).filter(([, it]) => it.tab === storeTab);
    // Wren's pick: a different item each day.
    const day = Math.floor(Date.now() / 86_400_000);
    const [pickId, pick] = items[day % items.length];
    section.appendChild(pickCard(page, pickId, pick));
    const grid = make("div", "nook-grid");
    for (const [id, item] of items) grid.appendChild(itemCard(page, id, item));
    section.appendChild(grid);
  }
  return section;
}

// Buying something: pay, add it to your home, a heart pops up, and Wren
// says thanks.
function buy(page, id, item, button) {
  // Where the button is, for the heart pop (measured first: spending
  // crumbs redraws the store).
  const rect = button.getBoundingClientRect(), box = page.getBoundingClientRect();
  if (!spendCrumbs(item.price)) {
    playClickSound();
    button.textContent = `${item.price - crumbBalance()} crumbs short`;
    button.classList.add("short");
    return;
  }
  home.owned[id] = Math.min(99, (home.owned[id] || 0) + 1);
  store();
  playCrumbSound();
  wrenSays = pickLine(WREN_THANKS);
  hooks.notice(`${item.name} is yours! Open Decorate on the laptop to place it.`);
  renderStore(page);
  const heart = document.createElement("span");
  heart.className = "nook-heart";
  heart.textContent = "💖";
  heart.style.left = `${rect.left - box.left + rect.width / 2}px`;
  heart.style.top = `${rect.top - box.top + page.scrollTop}px`;
  page.appendChild(heart);
  setTimeout(() => heart.remove(), 900);
}

function priceTag(price) {
  const tag = document.createElement("span");
  tag.className = "nook-price";
  tag.innerHTML = '<svg class="crumb-icon" aria-hidden="true"><use href="#crumb-icon"></use></svg>';
  tag.append(String(price));
  return tag;
}

function preview(item, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  drawDecorPreview(canvas, item, hooks.color());
  return canvas;
}

function basketButton(page, id, item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nook-buy";
  button.textContent = "🧺 Add to basket";
  button.addEventListener("click", () => buy(page, id, item, button));
  return button;
}

// The big "Wren's pick of the day" card at the top of a section.
function pickCard(page, id, item) {
  const el = document.createElement("div");
  el.className = "nook-pick";
  const art = document.createElement("div");
  art.className = "nook-pick-art";
  art.appendChild(preview(item, 200, 150));
  const info = document.createElement("div");
  info.className = "nook-pick-info";
  const label = document.createElement("span");
  label.className = "nook-pick-label";
  label.textContent = "✨ Wren's pick of the day";
  const name = document.createElement("h4");
  name.textContent = item.name;
  const line = document.createElement("p");
  line.textContent = `"${WREN_NOTES[id] ?? "One of my very favorites."}"`;
  const row = document.createElement("div");
  row.className = "nook-pick-row";
  row.append(priceTag(item.price), basketButton(page, id, item));
  info.append(label, name, line, row);
  el.append(art, info);
  return el;
}

function itemCard(page, id, item) {
  const owned = home.owned[id] || 0;
  const el = document.createElement("div");
  el.className = "nook-item";
  if (NEW_ITEMS.has(id)) {
    const ribbon = document.createElement("span");
    ribbon.className = "nook-new";
    ribbon.textContent = "New!";
    el.appendChild(ribbon);
  }
  if (owned) {
    const have = document.createElement("span");
    have.className = "nook-owned";
    have.textContent = owned > 1 ? `in your home ×${owned}` : "in your home";
    el.appendChild(have);
  }
  const art = document.createElement("div");
  art.className = "nook-art";
  art.appendChild(preview(item, 120, 90));
  if (WREN_NOTES[id]) {
    // Wren's note about it, shown over the picture when you hover.
    const note = document.createElement("p");
    note.className = "nook-note";
    note.textContent = WREN_NOTES[id];
    art.appendChild(note);
  }
  const name = document.createElement("div");
  name.className = "nook-name";
  name.textContent = item.name;
  el.append(art, name, priceTag(item.price), basketButton(page, id, item));
  return el;
}

function upgradeCard(page) {
  const roomy = home.size === "roomy";
  const el = document.createElement("div");
  el.className = "nook-pick nook-upgrade";
  const art = document.createElement("div");
  art.className = "nook-pick-art";
  art.textContent = roomy ? "🏡" : "🔨";
  const info = document.createElement("div");
  info.className = "nook-pick-info";
  const name = document.createElement("h4");
  name.textContent = "The Roomy Room";
  const line = document.createElement("p");
  line.textContent = roomy
    ? "Done! Your bedroom is roomy now. Enjoy the space."
    : "Our builders knock through into the next room, making your bedroom half as wide again. Plenty of room for a sofa and a fish tank.";
  const row = document.createElement("div");
  row.className = "nook-pick-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nook-buy";
  button.textContent = roomy ? "Yours! 🎉" : "🔨 Upgrade my room";
  button.disabled = roomy;
  button.addEventListener("click", () => {
    if (!spendCrumbs(ROOMY_PRICE)) {
      playClickSound();
      button.textContent = `${ROOMY_PRICE - crumbBalance()} crumbs short`;
      button.classList.add("short");
      return;
    }
    home.size = "roomy";
    store();
    playCrumbSound();
    unlock("roomy");
    wrenSays = "Down comes the wall! Enjoy all that space.";
    hooks.notice("Down comes the wall! Your bedroom is roomy now.");
    renderStore(page);
  });
  row.append(priceTag(ROOMY_PRICE), button);
  info.append(name, line, row);
  el.append(art, info);
  return el;
}

// --- Decorating ---
// Pick a piece you own (or click one already in your room) and it follows
// the arrow keys or the mouse; Enter or a click puts it down if it fits.
const bar = document.getElementById("decorate-bar");
const barItems = document.getElementById("decorate-items");
const barTip = document.getElementById("decorate-tip");
const STEP = 0.25; // grid units per arrow key press
let decorating = false;
let held = null; // { item, x, y, from } while holding a piece; from is { x, y } if it was already placed

export function isDecorating() {
  return decorating;
}

export function startDecorating() {
  if (!hooks.myRoom()) return;
  decorating = true;
  held = null;
  bar.hidden = false;
  renderBar();
}

export function stopDecorating() {
  if (!decorating) return;
  if (held) cancelHeld();
  decorating = false;
  bar.hidden = true;
}

function renderBar() {
  barTip.textContent = held
    ? `Move it with the arrow keys or the mouse. ${DECOR[held.item].turn ? "R turns it to face another way. " : ""}Enter or click puts it down. Delete puts it away. Escape cancels.`
    : "Pick something to place, or click a piece in your room to move it.";
  barItems.innerHTML = "";
  const spare = Object.keys(home.owned).filter((id) => spareCount(id) > 0);
  if (spare.length === 0) {
    const empty = document.createElement("span");
    empty.className = "decorate-empty";
    empty.textContent = home.placed.length ? "Everything you own is placed." : "Nothing to place yet. Shop at Nest & Nook on the laptop.";
    barItems.appendChild(empty);
  }
  for (const id of spare) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "soft-button";
    button.textContent = `${DECOR[id].name} ×${spareCount(id)}`;
    button.addEventListener("click", () => {
      if (held) cancelHeld();
      pickUpNew(id);
      button.blur();
    });
    barItems.appendChild(button);
  }
}

// Starts holding a new piece, in the middle of your room.
function pickUpNew(id) {
  held = { item: id, x: 0, y: 0, from: null };
  moveHeldCenter(bedroomWidth(home.size) / 2, BEDROOM_DEPTH / 2);
  playClickSound();
  renderBar();
}

// Picks up a placed piece (by its index in home.placed).
function pickUpPlaced(index) {
  const [piece] = home.placed.splice(index, 1);
  held = { ...piece, from: { x: piece.x, y: piece.y, r: piece.r } };
  hooks.changed();
  playClickSound();
  renderBar();
}

// Pieces snap by their center, on a grid lined up with the middle of your
// room, so any two pieces (whatever their widths) can share a center line,
// and so can a piece and the room itself. Snapping by the left edge used
// to make that impossible: a 1.8-wide bed and a 1.5-wide bench always
// ended up with their centers a little apart.
const MAGNET = 0.15; // how close a center has to be to another to click onto it
const round3 = (v) => Math.round(v * 1000) / 1000; // tidy numbers for saving

// The center lines a piece can line up with: the room's middle, and the
// middles of the pieces already placed (floor and wall alike).
function centerLines() {
  return [bedroomWidth(home.size) / 2, ...home.placed.map((p) => p.x + decorSize(p).w / 2)];
}

// Puts the held piece's center at (cx, cy): snapped to the grid, pulled
// onto a nearby center line, and kept inside the room.
function moveHeldCenter(cx, cy) {
  const item = DECOR[held.item];
  const { w, h } = decorSize(held);
  const mid = bedroomWidth(home.size) / 2;
  let x = mid + Math.round((cx - mid) / STEP) * STEP;
  const near = centerLines().find((line) => Math.abs(line - cx) < MAGNET);
  if (near !== undefined) x = near;
  held.x = round3(Math.min(Math.max(0, x - w / 2), bedroomWidth(home.size) - w));
  if (item.wall) {
    held.y = 0;
  } else {
    const y = Math.round(cy / STEP) * STEP;
    held.y = round3(Math.min(Math.max(0, y - h / 2), BEDROOM_DEPTH - h));
  }
}

function heldCenter() {
  const { w, h } = decorSize(held);
  return { x: held.x + w / 2, y: held.y + (DECOR[held.item].wall ? 0 : h / 2) };
}

// R: turns the held piece (if it can turn) to face the next way: forward,
// then right (for the left wall), then left (for the right wall). It
// turns around its middle.
function turnHeld() {
  if (!DECOR[held.item].turn) {
    hooks.notice("This one only faces forward.");
    return;
  }
  const c = heldCenter();
  held.r = { 0: 1, 1: 3, 3: 0 }[held.r ?? 0];
  if (!held.r) delete held.r;
  moveHeldCenter(c.x, c.y);
  playClickSound();
}

function placeHeld() {
  if (!decorFits(home.size, home.placed, held)) {
    playClickSound();
    hooks.notice("That doesn't fit there. Try another spot (it can't block the doorway).");
    return;
  }
  home.placed.push({ item: held.item, x: held.x, y: held.y, ...(held.r ? { r: held.r } : {}) });
  held = null;
  store();
  playCrumbSound();
  unlock("decorator");
  if (home.placed.length >= 12) unlock("designer");
  renderBar();
}

// Escape: a piece that was already placed goes back where it was; a new
// one goes back in the list.
function cancelHeld() {
  if (held.from) home.placed.push({ item: held.item, x: held.from.x, y: held.from.y, ...(held.from.r ? { r: held.from.r } : {}) });
  held = null;
  hooks.changed();
  renderBar();
}

// Delete: the piece goes back in the list (you still own it). Not the
// laptop desk, though: without it you couldn't get back to decorating.
function putAwayHeld() {
  if (DECOR[held.item].keep) {
    playClickSound();
    hooks.notice("Your laptop desk has to stay in your room, but you can move it anywhere.");
    return;
  }
  const wasPlaced = !!held.from;
  held = null;
  if (wasPlaced) store();
  playClickSound();
  renderBar();
}

// For drawing: the held piece where it would go, and whether it fits.
export function heldPiece() {
  const room = decorating && held ? hooks.myRoom() : null;
  if (!room) return null;
  // Guides: the room's center line (faint), made bright when the held
  // piece is right on it, plus any other piece's center it lines up with.
  const cx = heldCenter().x, mid = bedroomWidth(home.size) / 2;
  const onLine = (line) => Math.abs(line - cx) < 0.001;
  const lines = [...new Set(centerLines().map(round3))];
  const guides = lines.filter((line) => line === round3(mid) || onLine(line)).map((line) => ({ x: room.x + line, top: room.y, bottom: room.y + BEDROOM_DEPTH, strong: onLine(line) }));
  return { f: decorPiece(held, room.x, room.y, { color: hooks.color(), mine: true }, -1), ok: decorFits(home.size, home.placed, held), guides };
}

document.getElementById("decorate-done").addEventListener("click", (e) => {
  stopDecorating();
  playClickSound();
  e.currentTarget.blur();
});

window.addEventListener(
  "keydown",
  (e) => {
    if (!decorating || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    // While decorating, keys belong to decorating (so you don't walk off).
    e.stopImmediatePropagation();
    if (key === "escape") {
      e.preventDefault();
      if (held) cancelHeld();
      else stopDecorating();
      return;
    }
    if (!held) return;
    const moves = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
    if (Object.hasOwn(moves, key)) {
      e.preventDefault();
      const c = heldCenter();
      moveHeldCenter(c.x + moves[key][0] * STEP * 1.01, c.y + moves[key][1] * STEP); // (a hair past a step, so the magnet can't hold it back)
    } else if (key === "enter" || key === " ") {
      e.preventDefault();
      placeHeld();
    } else if (key === "delete" || key === "backspace") {
      e.preventDefault();
      putAwayHeld();
    } else if (key === "r") {
      e.preventDefault();
      turnHeld();
    }
  },
  true
);

// The mouse: the held piece follows it, a click puts it down, and
// clicking a placed piece (while not holding one) picks it up.
const canvas = document.getElementById("house");

function roomPoint(e) {
  const room = hooks.myRoom();
  if (!room) return null;
  const r = canvas.getBoundingClientRect();
  const g = screenToGrid(canvas, e.clientX - r.left, e.clientY - r.top);
  return { x: g.x - room.x, y: g.y - room.y };
}

canvas.addEventListener("mousemove", (e) => {
  if (!decorating || !held) return;
  const p = roomPoint(e);
  if (!p) return;
  moveHeldCenter(p.x, p.y);
});

canvas.addEventListener("click", (e) => {
  if (!decorating) return;
  const p = roomPoint(e);
  if (!p) return;
  if (held) {
    placeHeld();
    return;
  }
  // Topmost piece under the mouse (wall pieces: the wall above the room).
  for (let i = home.placed.length - 1; i >= 0; i--) {
    const piece = home.placed[i];
    const item = DECOR[piece.item];
    const { w, h } = decorSize(piece);
    const inX = p.x >= piece.x && p.x <= piece.x + w;
    const inY = item.wall ? p.y >= -1.1 && p.y <= 0.1 : p.y >= piece.y - 0.6 && p.y <= piece.y + h;
    if (inX && inY) {
      pickUpPlaced(i);
      return;
    }
  }
});
