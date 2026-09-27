// The trading post and the traveling merchant (Update 5), out in the yard.
//
// - The trading post (the stall below the garden, press E): put basket
//   things out for crumbs, or ask for a swap. They wait at the stall, even
//   while you're away, and anyone can take them: you get paid straight
//   away (with a note in your mailbox). Nothing taken within a week comes
//   back to you. Each person can have a few things out at once.
// - Juniper the fox, the traveling merchant, comes on the bus once a week
//   (on her day, in the hometown) with rare seeds, bait, recipes and decor.
//   What she brings changes each week; each person can buy a few of each.
//
// - A direct offer to one friend (right-click them, then Trade): it waits
//   at the stall under "For you", only they can take it, and a note in
//   their mailbox tells them.
//
// The house server keeps the stall and does every trade (the bank, see
// bank.js). Settings are in config.js (tradingPost, merchant).
import { serverApi } from "./account.js";
import { bank, myWallet } from "./bank.js";
import { basketCount, basketItems, itemInfo } from "./basket.js";
import { openNpc, refreshNpc } from "./npc.js";
import { crumbBalance } from "./shop.js";
import { playClickSound, playCrumbSound } from "./audio.js";

let hooks = { notice: () => {} };
export function initMarket(options) {
  hooks = { ...hooks, ...options };
}

// The stall and Juniper's pack, from the house server (refreshed now and then).
let market = { listings: [], mine: [], merchant: { here: false, week: 0, stock: [] } };

export async function refreshMarket() {
  try {
    market = await serverApi("GET", "/api/market");
    MERCHANT.here = market.merchant.here; // (world.js: she's drawn by the bus stop)
    refreshNpc();
  } catch {
    // Offline for a moment: keep what we had.
  }
}

// Checks every couple of minutes (main.js starts this when you join).
export function startMarket() {
  refreshMarket();
  setInterval(refreshMarket, 2 * 60_000);
}

const label = (id, n) => `${n} × ${itemInfo(id).name}`;

// --- The trading post ---
export async function openTradingPost() {
  await refreshMarket();
  openNpc({
    name: "Trading post",
    portrait: { f: "tradingPost", w: 1.9, h: 0.6 },
    color: "#c98f3c",
    pitch: 380,
    hello: ["Swap, sell, or just have a look.", "One friend's pond boot is another friend's treasure.", "Everything here waits for the right person."],
    tabs: [
      { id: "browse", label: "At the stall", items: browseRows, empty: "Nothing out right now. Be the first to put something out!", onOpen: refreshMarket },
      { id: "mine", label: "Your things", items: myRows, empty: "You haven't put anything out. Pick something in \"Put out\"." },
      { id: "sell", label: "Put out", items: sellRows, empty: "Your basket is empty." },
    ],
  });
}

function browseRows() {
  return market.listings
    .filter((l) => !market.mine.includes(l.id))
    .sort((a, b) => b.forMe - a.forMe) // (offers made just for you first)
    .map((l) => {
      const info = itemInfo(l.item);
      const forText = l.price !== null ? `${l.price} crumbs` : label(l.want.item, l.want.n);
      const canPay = l.price !== null ? crumbBalance() >= l.price : basketCount(l.want.item) >= l.want.n;
      return {
        icon: info.icon,
        name: label(l.item, l.n),
        note: `${l.forMe ? "For you! " : ""}From ${l.sellerName}, for ${forText}.`,
        price: l.price ?? undefined,
        actions: [
          {
            label: l.price !== null ? "Buy" : "Swap",
            disabled: !canPay,
            run: async () => {
              const got = await bank("tradeBuy", { id: l.id });
              await refreshMarket();
              if (!got) return null;
              playCrumbSound();
              return `A deal! ${label(got.got, got.n)} is in your basket.`;
            },
          },
        ],
      };
    });
}

function myRows() {
  return market.listings
    .filter((l) => market.mine.includes(l.id))
    .map((l) => ({
      icon: itemInfo(l.item).icon,
      name: label(l.item, l.n),
      note: `${l.forName ? `Offered to ${l.forName}, f` : "F"}or ${l.price !== null ? `${l.price} crumbs` : label(l.want.item, l.want.n)}. Put out ${daysAgo(l.at)}; it comes home after ${CONFIG.tradingPost.listingDays} days.`,
      actions: [
        {
          label: "Take back",
          soft: true,
          run: async () => {
            const done = await bank("tradeCancel", { id: l.id });
            await refreshMarket();
            return done ? "Back in your basket." : null;
          },
        },
      ],
    }));
}

function daysAgo(at) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function sellRows() {
  const full = market.mine.length >= CONFIG.tradingPost.maxListings;
  return basketItems().map(([id, n]) => ({
    icon: itemInfo(id).icon,
    name: `${itemInfo(id).name} × ${n}`,
    note: full ? `You have ${CONFIG.tradingPost.maxListings} things out already.` : itemInfo(id).group,
    actions: [{ label: "Put out…", soft: true, disabled: full, run: () => (openTradeDialog(id), null) }],
  }));
}

// The little form for putting something out: how many, and for crumbs or a swap.
const dialog = document.getElementById("trade-dialog");
const nInput = document.getElementById("trade-n");
const priceInput = document.getElementById("trade-price");
const wantSelect = document.getElementById("trade-want");
const wantN = document.getElementById("trade-want-n");
const note = document.getElementById("trade-note");
const itemRow = document.getElementById("trade-item-row");
const itemSelect = document.getElementById("trade-item");
let listing = null;
let offerTo = null; // a friend's name, for a direct offer (or null for the stall)

export function isTradeDialogOpen() {
  return !dialog.hidden;
}

// A direct offer to one friend (the right-click menu's Trade): pick what
// to offer, then crumbs or a swap, like at the stall.
export function offerTradeTo(name) {
  const things = basketItems();
  if (!things.length) return false;
  offerTo = name;
  itemSelect.innerHTML = "";
  for (const [id, n] of things) itemSelect.add(new Option(`${itemInfo(id).icon} ${itemInfo(id).name} (you have ${n})`, id));
  itemSelect.onchange = () => {
    listing = itemSelect.value;
    nInput.max = basketCount(listing);
    nInput.value = 1;
    priceInput.value = Math.max(1, itemInfo(listing).sell || 10);
  };
  openTradeDialog(things[0][0], name);
  return true;
}

function openTradeDialog(id, forName = null) {
  listing = id;
  offerTo = forName;
  itemRow.hidden = !forName;
  document.getElementById("trade-title").textContent = forName ? `Offer something to ${forName}` : `Put out ${itemInfo(id).name}`;
  nInput.max = basketCount(id);
  nInput.value = 1;
  priceInput.value = Math.max(1, itemInfo(id).sell || 10);
  // Anything can be asked for in a swap: everything with a name.
  wantSelect.innerHTML = "";
  for (const [wid, info] of allKnownThings()) if (wid !== id) wantSelect.add(new Option(`${info.icon} ${info.name}`, wid));
  document.querySelector('input[name="trade-kind"][value="crumbs"]').checked = true;
  showKind();
  note.hidden = true;
  dialog.hidden = false;
  nInput.focus();
}

// Every kind of basket thing (for asking in a swap), sorted by group and name.
function allKnownThings() {
  const ids = [
    ...CONFIG.crops.flatMap((c) => [`crop:${c.id}`, `seed:${c.id}`]),
    ...CONFIG.fish.map((f) => `fish:${f.id}`),
    ...CONFIG.bait.filter((b) => b.price).map((b) => `bait:${b.id}`),
    ...CONFIG.kitchen.pantry.map((f) => `food:${f.id}`),
    ...CONFIG.kitchen.recipes.map((r) => `dish:${r.id}`),
  ];
  return ids.map((id) => [id, itemInfo(id)]).sort(([, a], [, b]) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

function showKind() {
  const swap = document.querySelector('input[name="trade-kind"]:checked').value === "swap";
  document.getElementById("trade-price-row").hidden = swap;
  document.getElementById("trade-swap-row").hidden = !swap;
}
for (const radio of document.querySelectorAll('input[name="trade-kind"]')) radio.addEventListener("change", showKind);

function closeTradeDialog() {
  dialog.hidden = true;
  listing = null;
}

document.getElementById("trade-list").addEventListener("click", async () => {
  const n = Math.floor(Number(nInput.value));
  const swap = document.querySelector('input[name="trade-kind"]:checked').value === "swap";
  const fail = (text) => {
    note.textContent = text;
    note.hidden = false;
  };
  if (!(n >= 1 && n <= basketCount(listing))) return fail(`You have ${basketCount(listing)} of those.`);
  const extra = swap ? { want: { item: wantSelect.value, n: Math.floor(Number(wantN.value)) } } : { price: Math.floor(Number(priceInput.value)) };
  if (swap ? !(extra.want.n >= 1) : !(extra.price >= 1)) return fail(swap ? "Ask for at least 1." : "Ask for at least 1 crumb.");
  const done = await bank("tradeList", { item: listing, n, ...extra, ...(offerTo ? { for: offerTo } : {}) });
  if (!done) return;
  playCrumbSound();
  if (offerTo) hooks.notice(`Offered to ${offerTo}. It's waiting at the trading post, and a note tells them.`);
  closeTradeDialog();
  await refreshMarket();
});
document.getElementById("trade-close").addEventListener("click", () => {
  playClickSound();
  closeTradeDialog();
});
window.addEventListener("keydown", (e) => {
  if (dialog.hidden) return;
  e.stopImmediatePropagation(); // (typing numbers here shouldn't move you or pick emotes)
  if (e.key === "Escape") {
    e.preventDefault();
    closeTradeDialog();
  }
});

// --- Juniper, the traveling merchant ---
export function nearMerchantHint() {
  return `Press E to talk to ${CONFIG.merchant.name}, the traveling merchant. She's only here today!`;
}

export async function talkToJuniper() {
  await refreshMarket();
  if (!market.merchant.here) return;
  openNpc({
    name: CONFIG.merchant.name,
    portrait: { f: "juniper", w: 0.55, h: 0.4 },
    color: "#d9702e",
    pitch: 460,
    hello: ["Fresh off the bus! Have a look, have a look.", "I've been all over. Brought a few things back.", "Only here today, then off down the road again.", "Rare seeds, strange bait... and a recipe or two."],
    tabs: [{ id: "pack", label: "This week's pack", items: packRows }],
  });
}

// What a good is: its name, picture and a note.
function describe(good) {
  if (good.kind === "seed") return { icon: "🌰", name: itemInfo(`seed:${good.ref}`).name, note: "Seeds you can't get from Hazel." };
  if (good.kind === "bait") return { icon: itemInfo(`bait:${good.ref}`).icon, name: itemInfo(`bait:${good.ref}`).name, note: "Finds rare, epic and legendary fish, at any fishing level." };
  if (good.kind === "recipe") {
    const r = CONFIG.kitchen.recipes.find((x) => x.id === good.ref);
    return { icon: "📜", name: `Recipe: ${r.name}`, note: "A traveler's recipe, for your book." };
  }
  const d = DECOR[good.ref];
  return { icon: "🧳", name: d.name, note: "For your bedroom (it'll be in Decorate on your laptop)." };
}

function packRows() {
  const w = myWallet();
  const bought = w.merchant?.week === market.merchant.week ? w.merchant.bought : {};
  return market.merchant.stock.map((good) => {
    const { icon, name, note } = describe(good);
    const left = good.limit - (bought[good.id] ?? 0);
    const knownRecipe = good.kind === "recipe" && (w.recipes ?? []).includes(good.ref);
    return {
      icon,
      name,
      note: `${note} ${knownRecipe ? "Already in your book." : left > 0 ? `${left} left for you this week.` : "That's all of those for you this week."}`,
      price: good.price,
      locked: left <= 0 || knownRecipe,
      actions: [
        {
          label: "Buy",
          disabled: left <= 0 || knownRecipe || crumbBalance() < good.price,
          run: async () => {
            if (!(await bank("merchantBuy", { id: good.id }))) return null;
            playCrumbSound();
            return ["A fine choice!", "You won't find that anywhere else.", "Pleasure doing business!", "Treat it well. It's come a long way."][Math.floor(Math.random() * 4)];
          },
        },
      ],
    };
  });
}
