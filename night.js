// Night & Mothman (Update 8). What happens after dark:
// - Mothman, a shy, fluffy resident who only comes out at night and sits
//   by lamps (his rounds are in world.js RESIDENTS; he talks in the speech
//   box, see residents.js). Friendship hearts like Clover and Mortimer,
//   and gifts at so many hearts (config.js night.rewards, given by the
//   house server).
// - His requests: lightbulbs and paper lanterns (sold at the Workshop's
//   toolbox) and fireflies (caught outdoors at night, press E).
// - A scrapbook of blurry photos: the first time you spot him each night.
// - Lamp visits: some nights he's sitting by your bedside lamp when you
//   arrive.
// - The porch light: every night at nine, moths swarm the porch lanterns
//   with Mothman leading. Watch it once a night for a few crumbs.
// - Full moons (the real moon): tiny wolf ears on everyone at night, and a
//   rare Moonfish at Willow Lake.
import { bank, myWallet } from "./bank.js";
import { registerItems } from "./basket.js";
import { openNpc } from "./npc.js";
import { playCrumbSound } from "./audio.js";
import { openExtrasPanel } from "./extras.js";

let hooks = { notice: () => {} };
export function initNight(options) {
  hooks = { ...hooks, ...options };
}

// Mothman's things, as basket items ("night:lightbulb"...).
registerItems(Object.fromEntries(CONFIG.night.items.map((i) => [`night:${i.id}`, { name: i.name, icon: `night:${i.id}`, sell: 0, group: "Night things" }])));

// --- The Workshop's toolbox: lightbulbs and lanterns ---
export function openToolbox() {
  openNpc({
    name: "The toolbox",
    portrait: { f: "toolbox", w: 0.8, h: 0.5 },
    color: "#c0554a",
    pitch: 420,
    hello: ["(spare parts, string, and a drawer someone has labeled \"for the moth\".)", "(a note inside the lid: \"take what you need, leave a crumb.\")"],
    tabs: [
      {
        id: "lights",
        label: "Lights",
        items: () =>
          CONFIG.night.items
            .filter((i) => i.price > 0)
            .map((i) => ({
              icon: `night:${i.id}`,
              name: i.name,
              note: i.id === "lantern" ? "A soft paper lantern. Somebody out there loves these." : "A warm-white bulb. Somebody out there collects these.",
              price: i.price,
              actions: [
                {
                  label: "Buy",
                  disabled: myWallet().crumbs < i.price,
                  run: async () => {
                    if (!(await bank("buyNightItem", { id: i.id }))) return null;
                    playCrumbSound();
                    return `(you take a ${i.name.toLowerCase()} and leave the crumbs in the tin.)`;
                  },
                },
              ],
            })),
      },
    ],
  });
}

// --- Fireflies ---
export async function catchFirefly() {
  const got = await bank("catchFirefly");
  if (!got) return;
  hooks.notice(`You caught a firefly in a jar! (${got.caught} tonight.) It glows softly in your basket.`);
}

// --- The porch light swarm ---
// Near the porch lanterns while the moths are gathering.
export function nearSwarm(player) {
  if (!porchSwarmOn() || floorOf(player.y) !== YARD_FLOOR) return false;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return FURNITURE.some((f) => f.kind === "porchLantern" && Math.hypot(f.x - cx, f.y + 0.6 - cy) < 3);
}

export async function watchSwarm() {
  const got = await bank("porchSwarm");
  if (!got) return;
  playCrumbSound();
  hooks.notice(`You watch the moths circle the porch light, Mothman at their head. Something about it feels like being welcomed home. (+${got.crumbs} crumbs)`, 9000);
}

// --- Sightings ---
// The first time each night you're near Mothman (the same floor, within
// a dozen steps), a blurry photo goes in your scrapbook. Checked every few
// seconds (main.js calls this every frame).
let lastCheck = 0;
let askedAt = 0;
export function checkMothSighting(player) {
  const now = performance.now();
  if (now - lastCheck < 3000) return;
  lastCheck = now;
  if (!isNightOutside() || myWallet().night?.sightDay === nightDay() || now - askedAt < 10 * 60_000) return;
  const mothman = RESIDENTS.find((r) => r.id === "mothman");
  const state = mothman && residentState(mothman);
  if (!state || floorOf(state.y) !== floorOf(player.y) || Math.hypot(state.x - player.x, state.y - player.y) > 12) return;
  askedAt = now;
  const where = state.visit ? "bedroom" : { lamp: "porch", fire: "campfire", look: "steps" }[state.act] ?? "porch";
  bank("mothSighting", { where }).then((got) => {
    if (got?.where) hooks.notice("Was that... a very large moth? You got a (blurry) photo for your scrapbook.", 7000);
  });
}

// The night's date the way the house server counts it: the evening's date,
// so the small hours after midnight are still the same night.
function nightDay() {
  const offset = OUTDOORS.utcOffset ?? -new Date().getTimezoneOffset() * 60_000;
  const d = new Date(Date.now() + offset - 12 * 3_600_000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// --- Lamp visits ---
// When you arrive at night, now and then Mothman is sitting by your
// bedside lamp for a few minutes.
export function maybeLampVisit() {
  if (!isNightOutside() || Math.random() >= CONFIG.night.lampVisitChance) return;
  const lamp = FURNITURE.find((f) => f.kind === "nightstand" && f.mine);
  if (!lamp) return;
  setMothVisit({ x: lamp.x + lamp.w + 0.35, y: lamp.y + lamp.h + 0.15, until: Date.now() + 5 * 60_000 }); // (world.js)
  hooks.notice("Someone is sitting quietly by your bedside lamp...", 8000);
}

// --- Full moons ---
export function fullMoonHello() {
  if (moonEars()) hooks.notice("It's a full moon tonight. You feel... fluffier. (Something rare is biting at Willow Lake.)", 9000);
}

// --- The scrapbook ---
const PLACES = { porch: "by the porch lantern", campfire: "near the campfire", bedroom: "by your bedside lamp", steps: "on the porch steps" };
export function openScrapbook() {
  const sightings = [...(myWallet().night?.sightings ?? [])].reverse();
  openExtrasPanel("Cryptid scrapbook", (el) => {
    const intro = document.createElement("p");
    intro.className = "tv-small";
    intro.textContent = sightings.length ? `${sightings.length} sighting${sightings.length === 1 ? "" : "s"}. All of them blurry. All of them definitely real.` : "No sightings yet. He only comes out at night, and he likes lamps. Keep your eyes open.";
    const grid = document.createElement("div");
    grid.className = "scrapbook";
    sightings.forEach((s, i) => grid.appendChild(polaroid(s, sightings.length - i)));
    el.append(intro, grid);
  });
}

// One blurry photo: a dark night, a lamp's glow, a smudge of wings and two
// red eyes; the date and place written underneath. (Now and then the
// camera's date stamp says something odd.)
function polaroid(s, n) {
  const card = document.createElement("figure");
  card.className = "polaroid";
  const c = document.createElement("canvas");
  c.width = 120;
  c.height = 96;
  const ctx = c.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 96);
  sky.addColorStop(0, "#1a1a2e");
  sky.addColorStop(1, "#2e2a3a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 120, 96);
  const lx = 30 + (n * 17) % 60;
  const glow = ctx.createRadialGradient(lx, 30, 1, lx, 30, 34);
  glow.addColorStop(0, "rgba(255, 220, 150, 0.9)");
  glow.addColorStop(1, "rgba(255, 220, 150, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 120, 96);
  if (s.moon) {
    ctx.fillStyle = "#f4f0dc";
    ctx.beginPath();
    ctx.arc(100, 16, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "blur(2.5px)";
  ctx.fillStyle = "rgba(90, 70, 90, 0.95)";
  const mx = lx + 18 - (n % 3) * 12;
  ctx.beginPath();
  ctx.ellipse(mx - 10, 52, 12, 18, -0.3, 0, Math.PI * 2);
  ctx.ellipse(mx + 10, 52, 12, 18, 0.3, 0, Math.PI * 2);
  ctx.ellipse(mx, 58, 6, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "blur(1px)";
  ctx.fillStyle = "#ff4a40";
  for (const dx of [-3, 3]) {
    ctx.beginPath();
    ctx.arc(mx + dx, 44, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "none";
  const date = String(s.day);
  const when = new Date(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)));
  const odd = n % 5 === 0;
  ctx.fillStyle = "rgba(255, 160, 60, 0.85)";
  ctx.font = "700 8px monospace";
  ctx.fillText(odd ? "'74 10 31" : `'${date.slice(2, 4)} ${date.slice(4, 6)} ${date.slice(6, 8)}`, 72, 90);
  const caption = document.createElement("figcaption");
  caption.textContent = `${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${PLACES[s.where] ?? "somewhere near a lamp"}${s.moon ? " (full moon)" : ""}${odd ? ". The camera's date stamp is wrong. The camera is new." : ""}`;
  card.append(c, caption);
  return card;
}

// A gift from Mothman arrived (the house server sends "mothGift" events).
export function mothGiftToast(e) {
  const decor = e.item.startsWith("decor:") ? DECOR[e.item.slice(6)] : null;
  const item = decor ?? SHOP_CATALOG.find((i) => i.id === e.item);
  return {
    label: "A gift from Mothman",
    iconKey: "mothmanFriend",
    name: item?.name ?? "Something soft",
    desc: decor ? "He left it by your door, wrapped in a leaf. Find it in your room's decorating box." : "He left it where you'd find it. Wear it from your wardrobe.",
    crumbs: 0,
  };
}
