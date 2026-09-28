// House extras (Update 7):
// - The wishing well in the yard (press E): one coin a day, and a small
//   surprise the house server picks.
// - The Lounge TV (press E): a cooking channel (a recipe a day, learned by
//   watching), a weather channel (today's weather, and which fish are
//   biting in it), and a news ticker of what's going on in the house.
// - The Library's shelves (press E): books written by friends (stories,
//   guides, lore, poems), kept on the house server. Read them, or write
//   your own.
// - Pixel art: blank canvases, posters and rugs from Nest & Nook's art
//   aisle. Walk up to one in your bedroom and press E to paint it.
// They all open in one panel over the house (#extras-panel).
import { bank, myWallet, applyBank } from "./bank.js";
import { serverApi, accountName, isAdmin } from "./account.js";
import { playClickSound, playCrumbSound, playWaterSound } from "./audio.js";
import { itemInfo } from "./basket.js";
import { showToast } from "./achievements.js";
import { weatherNow, isReallyRaining } from "./weather.js";
import { setPixels, myHome } from "./home.js";

let hooks = { notice: () => {} };
export function initExtras(options) {
  hooks = { ...hooks, ...options };
}

// --- The panel ---
const panel = document.getElementById("extras-panel");
const panelTitle = document.getElementById("extras-title");
const panelBody = document.getElementById("extras-body");
let onClose = null;
let showing = ""; // which one is open: "tv", "library", "paint" or ""

export function isExtrasOpen() {
  return !panel.hidden;
}

function openPanel(title, build, closing = null) {
  onClose?.();
  onClose = closing;
  panelTitle.textContent = title;
  panelBody.textContent = "";
  panel.hidden = false;
  build(panelBody);
}

export function closeExtras() {
  if (panel.hidden) return;
  panel.hidden = true;
  showing = "";
  onClose?.();
  onClose = null;
  document.activeElement?.blur();
}

document.getElementById("extras-close").addEventListener("click", () => {
  playClickSound();
  closeExtras();
});

// While the panel's open, keys belong to it (typing a book shouldn't walk
// you around); Escape closes it.
window.addEventListener("keydown", (e) => {
  if (panel.hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeExtras();
  }
});

const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
const button = (label, run, soft = false) => {
  const b = make("button", soft ? "soft-button" : "warm-button", label);
  b.type = "button";
  b.addEventListener("click", () => {
    playClickSound();
    run();
  });
  return b;
};

// --- The wishing well ---
export function wellHint() {
  const wished = myWallet().wishDay === hometownDayHere();
  return wished ? "The wishing well. You've made today's wish: come back tomorrow." : `Press E to toss a coin in the wishing well (${CONFIG.extras.wishingWell.cost} crumb) and make a wish.`;
}

export async function makeWish() {
  const got = await bank("wish");
  if (!got) return;
  playWaterSound();
  if (got.crumbs) {
    playCrumbSound();
    return showToast({ iconKey: "wishMade", label: "Wishing well", name: "Plink! A wish granted.", desc: `A few coins bubbled back up: ${got.crumbs} crumbs.`, crumbs: got.crumbs });
  }
  const info = itemInfo(got.item);
  showToast({ picture: info.icon, label: "Wishing well", name: "Plink! A wish granted.", desc: `Something floated up: ${info.name}${got.n > 1 ? ` × ${got.n}` : ""}. It's in your basket.`, crumbs: 0 });
}

// The hometown's date as a number like 20260928 (to know if you've wished
// today; the house server has the final say).
function hometownDayHere() {
  const offset = weatherNow()?.utcOffset ?? -new Date().getTimezoneOffset() * 60_000;
  const d = new Date(Date.now() + offset);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// --- The Lounge TV ---
const CHANNELS = [
  ["cooking", "Cooking"],
  ["weather", "Weather"],
  ["news", "News"],
];
let tvChannel = "cooking";

export function openTv() {
  showing = "tv";
  openPanel("The Lounge TV", (el) => {
    const row = make("div", "tv-channels");
    const screen = make("div", "tv-screen");
    for (const [id, label] of CHANNELS) {
      const b = button(label, () => showChannel(id));
      b.dataset.channel = id;
      row.appendChild(b);
    }
    el.append(row, screen);
    showChannel(tvChannel);
  });
}

async function showChannel(id) {
  tvChannel = id;
  const screen = panelBody.querySelector(".tv-screen");
  if (!screen) return;
  for (const b of panelBody.querySelectorAll(".tv-channels button")) b.classList.toggle("active", b.dataset.channel === id);
  screen.textContent = "";
  screen.className = `tv-screen tv-${id}`;
  if (id === "cooking") return cookingChannel(screen);
  if (id === "weather") return weatherChannel(screen);
  return newsChannel(screen);
}

async function cookingChannel(screen) {
  screen.appendChild(make("p", "tv-small", "Tuning in..."));
  const got = await bank("tvCooking");
  if (tvChannel !== "cooking" || !screen.isConnected || showing !== "tv") return;
  screen.textContent = "";
  const recipe = got?.recipe ? CONFIG.kitchen.recipes.find((r) => r.id === got.recipe) : null;
  if (!recipe) {
    screen.appendChild(make("p", "", "Reruns tonight. Try again later!"));
    return;
  }
  screen.appendChild(make("p", "tv-small", "Today on Crumbs in the Kitchen:"));
  screen.appendChild(make("h3", "", recipe.name));
  const list = make("ul", "tv-list");
  for (const id of recipe.ingredients) list.appendChild(make("li", "", id.includes(":") ? itemInfo(id).name : `any ${id}`));
  screen.appendChild(list);
  screen.appendChild(make("p", "tv-small", `"${recipe.hint}" Cook it at the kitchen stove.`));
  screen.appendChild(make("p", "tv-note", got.learned ? "New in your recipe book!" : "You already know this one."));
}

// The weather channel: today's weather in the hometown, and tips that are
// true right now (which fish bite in it; rain waters the garden).
function weatherChannel(screen) {
  const w = weatherNow();
  screen.appendChild(make("p", "tv-small", "The Porchlight weather report"));
  screen.appendChild(make("h3", "", w ? `${w.words ?? "Weather"}, ${Math.round(w.temp)}°` : "The weather van is stuck in traffic."));
  const night = isNightOutside(); // (world.js: the same night the house uses)
  const raining = isReallyRaining();
  const season = typeof yardSeason === "function" ? yardSeason() : null;
  const biting = CONFIG.fish.filter((fish) => {
    const when = fish.when ?? {};
    if (when.night === true && !night) return false;
    if (when.night === false && night) return false;
    if (when.rain && !raining) return false;
    if (when.season && season && !when.season.includes(season)) return false;
    return Object.keys(when).length > 0; // (only the picky ones are news)
  });
  const tips = make("ul", "tv-list");
  const pondMax = CONFIG.fishing.waters?.pond?.maxRarity ?? 5;
  const where = (list) => list.slice(0, 4).map((f) => f.name).join(", ");
  const pond = biting.filter((f) => f.rarity <= pondMax), lake = biting.filter((f) => f.rarity > pondMax);
  tips.appendChild(make("li", "", pond.length ? `Biting in the pond now: ${where(pond)}.` : "No picky fish in the pond right now; the usual crowd is biting."));
  if (lake.length) tips.appendChild(make("li", "", `Out at Willow Lake: ${where(lake)}.`));
  tips.appendChild(make("li", "", raining ? "It's raining right now: the garden beds are getting watered for free." : "It isn't raining right now: remember to water your garden beds."));
  tips.appendChild(make("li", "", night ? "It's night: the big ones come out after dark." : "Daytime: a good time for the pond and the garden."));
  screen.appendChild(tips);
}

// The news: a ticker of what's going on (the biggest fish lately, what's
// up on Porch Swap, the newest Library books).
async function newsChannel(screen) {
  screen.appendChild(make("p", "tv-small", "Porchlight News at the top of the hour"));
  const items = [];
  const [records, market, books] = await Promise.all([
    serverApi("GET", "/api/fish-records").catch(() => null),
    serverApi("GET", "/api/market").catch(() => null),
    serverApi("GET", "/api/books?titles=1").catch(() => null),
  ]);
  if (tvChannel !== "news" || !screen.isConnected || showing !== "tv") return;
  const recs = Object.entries(records?.records ?? {}).sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 3);
  for (const [id, r] of recs) items.push(`${r.name} holds the house record for ${(CONFIG.fish.find((f) => f.id === id)?.name ?? id).toLowerCase()}: ${r.size} cm.`);
  const listings = market?.listings ?? [];
  if (listings.length) items.push(`${listings.length} thing${listings.length === 1 ? "" : "s"} up for trade on Porch Swap, including ${itemInfo(listings[listings.length - 1].item).name.toLowerCase()} from ${listings[listings.length - 1].sellerName}.`);
  const newest = (books?.books ?? []).slice(-2).reverse();
  for (const b of newest) items.push(`New at the Library: "${b.title}" by ${b.author}.`);
  if (!items.length) items.push("A quiet day in the house. The porch light is still on.");
  const ticker = make("div", "tv-ticker");
  const line = make("span", "", items.join("   ·   "));
  ticker.appendChild(line);
  screen.appendChild(ticker);
  const list = make("ul", "tv-list");
  for (const item of items) list.appendChild(make("li", "", item));
  screen.appendChild(list);
}

// --- Library books ---
const KINDS = { story: "Story", guide: "Guide", lore: "Lore", poem: "Poem", diary: "Diary" };

export async function openLibrary() {
  showing = "library";
  openPanel("The Library shelves", (el) => el.appendChild(make("p", "tv-small", "Taking books off the shelf...")));
  const got = await serverApi("GET", "/api/books").catch(() => null);
  if (showing !== "library") return;
  showShelf(got?.books ?? []);
}

function showShelf(books) {
  panelTitle.textContent = "The Library shelves";
  panelBody.textContent = "";
  const top = make("div", "book-top");
  top.append(make("p", "tv-small", "Books written by friends (and a few that were already here)."), button("Write a book", () => writeBook(books)));
  panelBody.appendChild(top);
  const list = make("div", "book-list");
  const all = [...CONFIG.extras.libraryBooks.map((b) => ({ ...b, fixed: true })), ...[...books].reverse()];
  for (const book of all) {
    const row = make("button", "book-row");
    row.type = "button";
    row.append(make("b", "", book.title), make("small", "", `${KINDS[book.kind] ?? "Book"} by ${book.author}`));
    row.addEventListener("click", () => {
      playClickSound();
      readBook(book, books);
    });
    list.appendChild(row);
  }
  panelBody.appendChild(list);
}

function readBook(book, books) {
  panelTitle.textContent = book.title;
  panelBody.textContent = "";
  panelBody.appendChild(make("p", "tv-small", `${KINDS[book.kind] ?? "Book"} by ${book.author}`));
  const page = make("div", "book-page");
  for (const para of book.text.split(/\n{2,}/)) page.appendChild(make("p", "", para));
  panelBody.appendChild(page);
  const row = make("div", "book-top");
  row.appendChild(button("Back to the shelves", () => showShelf(books), true));
  const mine = !book.fixed && (book.by === String(accountName() ?? "").toLowerCase() || isAdmin());
  if (mine) {
    row.appendChild(
      button("Take it back", async () => {
        try {
          await serverApi("POST", "/api/books/remove", { id: book.id });
          hooks.notice(`"${book.title}" is off the shelves.`);
          openLibrary();
        } catch (err) {
          hooks.notice(err.message);
        }
      }, true)
    );
  }
  panelBody.appendChild(row);
}

function writeBook(books) {
  panelTitle.textContent = "Write a book";
  panelBody.textContent = "";
  const form = make("div", "book-form");
  const title = make("input");
  title.maxLength = 60;
  title.placeholder = "Title";
  const kind = make("select");
  for (const [id, label] of Object.entries(KINDS)) kind.add(new Option(label, id));
  const text = make("textarea");
  text.maxLength = CONFIG.extras.bookLength;
  text.rows = 10;
  text.placeholder = "Once upon a time... (a blank line starts a new paragraph)";
  const note = make("p", "tv-small", `Everyone in the house can read it. Up to ${CONFIG.extras.bookLength} letters.`);
  const row = make("div", "book-top");
  row.append(
    button("Back", () => showShelf(books), true),
    button("Put it on the shelf", async () => {
      try {
        applyBank(await serverApi("POST", "/api/books", { title: title.value, kind: kind.value, text: text.value })); // (the Published badge)
        playCrumbSound();
        hooks.notice(`"${title.value.trim()}" is on the Library shelves.`);
        openLibrary();
      } catch (err) {
        note.textContent = err.message;
      }
    })
  );
  form.append(title, kind, text, note, row);
  panelBody.appendChild(form);
  title.focus();
}

// --- Pixel art ---
// f: your canvas, poster or rug (world.js myArtInReach), with its place in
// your room (f.decor.index).
export function openPaint(f) {
  const placed = myHome().placed;
  const index = placedIndex(f, placed);
  showing = "paint";
  const piece = placed[index];
  if (!piece || piece.item !== f.decor.item) return;
  const palette = CONFIG.extras.palette;
  let pixels = (piece.pixels ?? "0".repeat(256)).split("");
  let color = 1;
  let painting = false;
  openPanel(`Paint your ${(DECOR[piece.item]?.name ?? "canvas").replace(/^Blank /, "").toLowerCase()}`, (el) => {
    const grid = make("canvas", "paint-grid");
    grid.width = grid.height = 320;
    const ctx = grid.getContext("2d");
    const draw = () => {
      for (let i = 0; i < 256; i++) {
        ctx.fillStyle = palette[parseInt(pixels[i], 16)];
        ctx.fillRect((i % 16) * 20, Math.floor(i / 16) * 20, 20, 20);
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.beginPath();
      for (let k = 1; k < 16; k++) {
        ctx.moveTo(k * 20 + 0.5, 0);
        ctx.lineTo(k * 20 + 0.5, 320);
        ctx.moveTo(0, k * 20 + 0.5);
        ctx.lineTo(320, k * 20 + 0.5);
      }
      ctx.stroke();
    };
    const paintAt = (e) => {
      const r = grid.getBoundingClientRect();
      const cx = Math.floor(((e.clientX - r.left) / r.width) * 16), cy = Math.floor(((e.clientY - r.top) / r.height) * 16);
      if (cx < 0 || cy < 0 || cx > 15 || cy > 15) return;
      pixels[cy * 16 + cx] = color.toString(16);
      draw();
    };
    grid.addEventListener("pointerdown", (e) => {
      painting = true;
      grid.setPointerCapture(e.pointerId);
      paintAt(e);
    });
    grid.addEventListener("pointermove", (e) => painting && paintAt(e));
    grid.addEventListener("pointerup", () => (painting = false));
    const swatches = make("div", "paint-palette");
    palette.forEach((c, i) => {
      const s = make("button", "paint-swatch" + (i === color ? " active" : ""));
      s.type = "button";
      s.style.background = c;
      s.title = i === 0 ? "Blank (the eraser)" : "Paint with this color";
      s.addEventListener("click", () => {
        color = i;
        for (const other of swatches.children) other.classList.toggle("active", other === s);
      });
      swatches.appendChild(s);
    });
    const row = make("div", "book-top");
    row.append(
      button("Clear", () => {
        pixels = "0".repeat(256).split("");
        draw();
      }, true),
      button("Save", () => {
        setPixels(index, pixels.join(""));
        playCrumbSound();
        hooks.notice("Painted! Everyone who visits your room can see it.");
        closeExtras();
      })
    );
    el.append(grid, swatches, row);
    draw();
  });
}
