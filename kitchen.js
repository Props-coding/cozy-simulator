// The kitchen (Update 5), in the Dinner room.
//
// - The fridge (press E there): eggs, milk, butter and cheese, and a
//   pantry of flour, sugar, rice, honey and spices, for a few crumbs.
//   Everything else you cook with comes from your garden and the pond.
// - The stove (press E there): cook a recipe you know, or experiment:
//   put 2 to 4 things in the pot and see what happens. A known mix makes
//   the dish and adds it to your recipe book; anything else makes a Burnt
//   Mystery (the raccoons buy it, as junk). Recipes you haven't found yet
//   show as "???" with a hint. Hazel and Otis sell a few recipes too, and
//   Juniper the traveling merchant brings rare ones.
// - Dishes go in your basket: eat one there for a 30-minute boost (shown in
//   the boost bar by your crumbs: hover it to see what it does), give it
//   to a friend, or sell it to Hazel.
// - The cookie jar: one fortune cookie a day each.
//
// The house server does the cooking (the bank, see bank.js): it checks you
// have the ingredients, and knows every recipe. All the lists are in
// config.js (CONFIG.kitchen).
import { setPicture } from "./pictures.js";
import { bank, myWallet } from "./bank.js";
import { uiIcon } from "./ui-icons.js";
import { registerItems, basketCount, basketItems, itemInfo } from "./basket.js";
import { openNpc } from "./npc.js";
import { crumbBalance } from "./shop.js";
import { showToast } from "./achievements.js";
import { serverApi, accountName } from "./account.js";
import { playClickSound, playCrumbSound, playHarvestSound } from "./audio.js";

const K = CONFIG.kitchen;
const RECIPES = Object.fromEntries(K.recipes.map((r) => [r.id, r]));

let hooks = { notice: () => {} };
export function initKitchen(options) {
  hooks = { ...hooks, ...options };
}

// Tell the basket what ingredients and dishes are (dishes can be eaten or
// given away from the basket).
registerItems({
  ...Object.fromEntries(K.pantry.map((f) => [`food:${f.id}`, { name: f.name, icon: `food:${f.id}`, sell: 0, group: "Kitchen" }])),
  ...Object.fromEntries(
    K.recipes.map((r) => [
      `dish:${r.id}`,
      {
        name: r.name,
        icon: `dish:${r.id}`,
        sell: r.sell,
        group: "Dishes",
        actions: (id) => [
          { label: "Eat", title: `${K.boosts[r.boost].name}: ${K.boosts[r.boost].desc}`, run: () => eat(id) },
          { label: "Give", soft: true, title: "Give it to a friend", run: () => openGift(id) },
        ],
      },
    ])
  ),
  [`junk:${K.burnt.id}`]: { name: K.burnt.name, icon: `junk:${K.burnt.id}`, sell: 0, group: "Junk" },
});

// "Eggs", "Carrot", "any fish".
function ingredientName(token) {
  if (token === "fish") return "any fish";
  return itemInfo(token).name;
}
const known = () => myWallet().recipes ?? [];

// --- The fridge and pantry ---
export function openFridge() {
  const rows = (shelf) => () =>
    K.pantry
      .filter((f) => f.shelf === shelf)
      .map((f) => {
        const buy = (n) => async () => {
          if (crumbBalance() < f.price * n) return `That's ${f.price * n} crumbs, and you have ${crumbBalance()}.`;
          if (!(await bank("buyFood", { id: f.id, n }))) return null;
          playCrumbSound();
          return pick(["Stocked up!", "Into the basket it goes.", "Fresh as can be."]);
        };
        const have = basketCount(`food:${f.id}`);
        return {
          icon: `food:${f.id}`,
          name: f.name + (have ? ` × ${have}` : ""),
          note: `${f.price} crumbs each`,
          price: f.price,
          actions: [
            { label: "Buy 1", run: buy(1), disabled: crumbBalance() < f.price },
            { label: "Buy 5", soft: true, run: buy(5), disabled: crumbBalance() < f.price * 5 },
          ],
        };
      });
  openNpc({
    name: "Fridge & pantry",
    portrait: { f: "fridge", w: 0.8, h: 0.6 },
    color: "#5a8aa8",
    pitch: 520,
    hello: ["*hmmmm* (the fridge hums)", "Everything you can't grow yourself.", "Mind the door, it sticks."],
    tabs: [
      { id: "fridge", label: "Fridge", items: rows("fridge") },
      { id: "pantry", label: "Pantry", items: rows("pantry") },
    ],
  });
}

// --- The stove ---
let pot = []; // what's in the pot for an experiment (basket ids)

export function openStove() {
  openNpc({
    name: "The stove",
    portrait: { f: "stove", w: 1.7, h: 0.6 },
    color: "#c0554a",
    pitch: 240,
    hello: ["*sizzle*", "What's cooking?", "The pan's warm. Let's make something.", "Pick a recipe, or throw things in and see."],
    tabs: [
      { id: "cook", label: "Cook", items: cookRows, empty: "You don't know any recipes yet. Try the Experiment tab, or buy one from Hazel or Otis!" },
      { id: "experiment", label: "Experiment", items: experimentRows },
      { id: "book", label: "Recipe book", items: bookRows },
    ],
  });
}

// What you have of an ingredient, not counting what's already in the pot.
function spare(id) {
  return basketCount(id) - pot.filter((p) => p === id).length;
}

// Basket things that fit a recipe's ingredients (a fish for "fish"), or
// null if something's missing.
function pickIngredients(recipe) {
  const used = {};
  const take = (id) => (used[id] = (used[id] ?? 0) + 1);
  const left = (id) => basketCount(id) - (used[id] ?? 0);
  const chosen = [];
  for (const need of [...recipe.ingredients].sort((a, b) => (a === "fish") - (b === "fish"))) {
    const id = need === "fish" ? basketItems("fish:").map(([f]) => f).sort((a, b) => itemInfo(a).sell - itemInfo(b).sell).find((f) => left(f) > 0) : left(need) > 0 ? need : null;
    if (!id) return null;
    take(id);
    chosen.push(id);
  }
  return chosen;
}

async function cook(items) {
  const done = await bank("cook", { items });
  if (!done) return null;
  if (done.burnt) {
    playClickSound();
    return "Oh no. It's... something. A Burnt Mystery. (The raccoons might want it.)";
  }
  const r = RECIPES[done.dish];
  playHarvestSound();
  return `${r.name}! It's in your basket.` + (done.learned ? " A new recipe for your book!" : "");
}

function cookRows() {
  return known()
    .map((id) => RECIPES[id])
    .filter(Boolean)
    .map((r) => {
      const chosen = pickIngredients(r);
      return {
        icon: `dish:${r.id}`,
        name: r.name + (basketCount(`dish:${r.id}`) ? ` (you have ${basketCount(`dish:${r.id}`)})` : ""),
        note: `${r.ingredients.map(ingredientName).join(" + ")}. Eat for ${K.boosts[r.boost].name}.`,
        actions: [{ label: "Cook", disabled: !chosen, run: () => cook(chosen) }],
      };
    });
}

function experimentRows() {
  const cookable = basketItems().filter(([id]) => /^(crop|food|fish):/.test(id));
  const potRow = {
    icon: "🥘",
    name: pot.length ? `In the pot: ${pot.map((id) => itemInfo(id).name).join(", ")}` : "The pot is empty",
    note: pot.length < 2 ? "Add 2 to 4 things, then cook." : "Ready when you are!",
    actions: [
      {
        label: "Cook it!",
        disabled: pot.length < 2,
        run: async () => {
          const items = pot;
          pot = [];
          return cook(items);
        },
      },
      { label: "Empty", soft: true, disabled: !pot.length, run: () => ((pot = []), null) },
    ],
  };
  if (!cookable.length) return [potRow, { icon: "basket", name: "Nothing to cook with", note: "Grow something, catch a fish, or stock up at the fridge.", locked: true }];
  return [
    potRow,
    ...cookable.map(([id]) => ({
      icon: itemInfo(id).icon,
      name: `${itemInfo(id).name} × ${spare(id)}`,
      note: itemInfo(id).group,
      actions: [{ label: "Add", soft: true, disabled: pot.length >= 4 || spare(id) <= 0, run: () => (pot.push(id), playClickSound(), null) }],
    })),
  ];
}

function bookRows() {
  const have = known();
  return [
    { icon: "book", name: `Your recipe book: ${have.length} of ${K.recipes.length}`, note: "Find recipes by experimenting at the stove. Hazel and Otis sell a few, and the traveling merchant brings rare ones." },
    ...K.recipes.map((r) =>
      have.includes(r.id)
        ? { icon: `dish:${r.id}`, name: r.name, note: `${r.ingredients.map(ingredientName).join(" + ")}. ${K.boosts[r.boost].name}. Hazel pays ${r.sell}.` }
        : { icon: "unknown", name: "???", note: r.hint + (r.learn === "merchant" ? " (Only from the traveling merchant.)" : ""), locked: true }
    ),
  ];
}

// Rows for Hazel's and Otis's recipe tabs.
export function recipeShopRows(from, sayThanks) {
  return K.recipes
    .filter((r) => r.learn === from)
    .map((r) => {
      const have = known().includes(r.id);
      return {
        icon: have ? `dish:${r.id}` : "scroll",
        name: r.name + (have ? " (in your book)" : ""),
        note: `${r.ingredients.map(ingredientName).join(" + ")}. ${K.boosts[r.boost].name}.`,
        price: have ? undefined : r.price,
        actions: have
          ? []
          : [
              {
                label: "Buy",
                disabled: crumbBalance() < r.price,
                run: async () => {
                  if (!(await bank("buyRecipe", { id: r.id, from }))) return null;
                  playCrumbSound();
                  return sayThanks;
                },
              },
            ],
      };
    });
}

// Dishes Hazel buys (for her Sell tab).
export function dishesToSell(sayThanks) {
  return basketItems("dish:").map(([id, n]) => {
    const info = itemInfo(id);
    const sell = (many) => async () => {
      const k = many ? basketCount(id) : 1;
      if (!(await bank("sell", { id, n: k }))) return null;
      playCrumbSound();
      return `${sayThanks} that's ${info.sell * k} crumbs.`;
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

// --- Eating, and the boost bar ---
async function eat(id) {
  const r = RECIPES[id.slice(5)];
  const done = await bank("eat", { id });
  if (!done) return;
  const boost = K.boosts[done.boost];
  playHarvestSound();
  hooks.notice(`Mmm, ${r.name.toLowerCase()}! ${boost.name} for ${K.boostMinutes} minutes: ${boost.desc}`, 6000);
}

const boostBar = document.getElementById("boost-bar");
function showBoost() {
  const b = myWallet().boost;
  const left = b ? Math.ceil((b.until - Date.now()) / 60_000) : 0;
  if (left <= 0 || !K.boosts[b.id]) {
    boostBar.hidden = true;
    return;
  }
  const boost = K.boosts[b.id];
  boostBar.hidden = false;
  boostBar.tabIndex = 0;
  boostBar.setAttribute("aria-label", `${boost.name}: ${boost.desc} ${left} minutes left.`);
  boostBar.innerHTML = `<span class="boost-icon"></span><span class="boost-left"></span><span class="boost-tip"><b></b><span></span></span>`;
  setPicture(boostBar.querySelector(".boost-icon"), `boost:${b.id}`, 18);
  boostBar.querySelector(".boost-left").textContent = `${left}m`;
  boostBar.querySelector(".boost-tip b").textContent = boost.name;
  boostBar.querySelector(".boost-tip span").textContent = `${boost.desc} ${left} minute${left === 1 ? "" : "s"} left.`;
}
window.addEventListener("bank-changed", showBoost);
setInterval(showBoost, 20_000);

// --- Giving a dish ---
const giftPanel = document.getElementById("gift-panel");
const giftTo = document.getElementById("gift-to");
const giftNote = document.getElementById("gift-note");
let giftId = null;

export function isGiftOpen() {
  return !giftPanel.hidden;
}

async function openGift(id) {
  giftId = id;
  const giftTitle = document.getElementById("gift-title");
  giftTitle.innerHTML = uiIcon("gift");
  giftTitle.append(` Give ${itemInfo(id).name}`);
  giftNote.hidden = true;
  giftTo.innerHTML = "";
  giftPanel.hidden = false;
  try {
    const { names } = await serverApi("GET", "/api/names");
    const me = (accountName() ?? "").toLowerCase();
    for (const name of names.filter((n) => n.toLowerCase() !== me)) giftTo.add(new Option(name, name));
  } catch {
    // (the list stays empty: the note below says so)
  }
  if (!giftTo.options.length) {
    giftNote.textContent = "Nobody else is in the house yet.";
    giftNote.hidden = false;
  }
}

function closeGift() {
  giftPanel.hidden = true;
  giftId = null;
}

document.getElementById("gift-send").addEventListener("click", async () => {
  if (!giftId || !giftTo.value) return;
  const done = await bank("gift", { id: giftId, to: giftTo.value });
  if (!done) return;
  playCrumbSound();
  hooks.notice(`You gave ${done.to} ${itemInfo(giftId).name.toLowerCase()}. It's in their basket, with a note in their mailbox.`, 6000);
  closeGift();
});
document.getElementById("gift-close").addEventListener("click", () => {
  playClickSound();
  closeGift();
});
window.addEventListener("keydown", (e) => {
  if (giftPanel.hidden || e.key !== "Escape") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closeGift();
});

// --- The fortune cookie jar ---
export async function openCookieJar() {
  const got = await bank("fortune");
  if (!got) return;
  playClickSound();
  const extra = got.crumbs ? "There was something else in there!" : got.seed ? `There was a ${itemInfo(`seed:${got.seed}`).name.toLowerCase()} packet inside too!` : "See you tomorrow for another.";
  showToast({ icon: "🥠", label: "Fortune cookie", name: `"${got.text}"`, desc: extra, crumbs: got.crumbs ?? 0 });
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
