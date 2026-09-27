// Bus trips (the Lake, and the Farm to come). Pick one from Gus's list
// (bus.js) and a themed loading screen covers the view while the bus
// "drives": to the Lake, a dusky lake with a dark lantern at the end of
// its dock and fireflies drifting in toward it; back home, the porch with
// its light and moths (like the first loading screen). The bar fills as
// the bus goes, you're moved to the other stop behind the screen, then
// the light flickers on and the screen fades to show where you've arrived.
import { registerTrip, honk } from "./bus.js";
import { closeNpc } from "./npc.js";
import { playClickSound } from "./audio.js";

let hooks = { arrive: () => {}, notice: () => {} };
let traveling = false;

export function isTraveling() {
  return traveling;
}

// main.js hands over how to move you (arrive(spot) puts you there and
// gets you up if you were sitting or fishing).
export function initTravel(options) {
  hooks = { ...hooks, ...options };
  registerTrip({ id: "lake", name: "Willow Lake", from: YARD_FLOOR, note: "Big water, a long dock and the rarest fish. Otis's bait shack is there.", start: () => travel("lake") });
  registerTrip({ id: "farm", name: "The Farm", from: YARD_FLOOR, note: "Fields, a barn and room to grow. Coming soon!", soon: true, start: () => {} });
  registerTrip({ id: "home", name: "Home", from: LAKE_FLOOR, note: "Back to the house.", start: () => travel("home") });
}

// --- The scenes ---
// Each is a small picture (400 by 300) with a light that comes on as you
// arrive (.lamp and .glow, like the porch), and a group of little flying
// things that drift toward it as the bar fills.
const LAKE_SCENE = `
<svg class="trip-scene" viewBox="0 0 400 300" aria-hidden="true">
  <defs>
    <linearGradient id="lake-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16213d"/>
      <stop offset="0.6" stop-color="#3a3a66"/>
      <stop offset="1" stop-color="#a0667a"/>
    </linearGradient>
    <linearGradient id="lake-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d4f78"/>
      <stop offset="1" stop-color="#15213a"/>
    </linearGradient>
    <radialGradient id="lantern-glow">
      <stop offset="0" stop-color="#ffd98a" stop-opacity="0.9"/>
      <stop offset="0.4" stop-color="#f6b95b" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#f6b95b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" fill="url(#lake-sky)"/>
  <g fill="#fdf6e0" opacity="0.75">
    <circle cx="36" cy="26" r="1.1"/><circle cx="92" cy="54" r="0.8"/><circle cx="150" cy="20" r="1"/><circle cx="210" cy="40" r="0.8"/><circle cx="266" cy="16" r="1.2"/><circle cx="352" cy="44" r="0.9"/><circle cx="378" cy="18" r="0.8"/><circle cx="120" cy="84" r="0.7"/>
  </g>
  <!-- A crescent moon (a circle with a bite taken out). -->
  <mask id="moon-bite"><rect width="400" height="300" fill="#fff"/><circle cx="325" cy="53" r="13" fill="#000"/></mask>
  <circle cx="318" cy="58" r="15" fill="#f4ecd8" mask="url(#moon-bite)"/>
  <!-- The far shore: rows of pines. -->
  <path d="M0 150 L12 124 L24 150 L34 118 L46 150 L58 128 L70 150 L82 112 L96 150 L108 126 L120 150 L132 116 L146 150 L158 130 L170 150 L184 114 L198 150 L210 126 L222 150 L236 110 L250 150 L262 128 L274 150 L288 118 L302 150 L314 126 L326 150 L340 112 L354 150 L366 124 L378 150 L390 118 L400 136 L400 162 L0 162 Z" fill="#1c2a30"/>
  <path d="M0 158 L16 140 L30 158 L46 136 L60 158 L78 142 L92 158 L108 134 L124 158 L140 144 L156 158 L172 138 L190 158 L206 146 L220 158 L238 134 L254 158 L270 144 L284 158 L300 138 L316 158 L332 146 L348 158 L366 136 L382 158 L400 146 L400 166 L0 166 Z" fill="#26383c"/>
  <!-- The water, with the moon's path and slow ripples. -->
  <rect x="0" y="162" width="400" height="138" fill="url(#lake-water)"/>
  <g class="moon-shimmer" fill="#f4ecd8"><rect x="311.0" y="168" width="14" height="1.6" rx="0.8" opacity="0.8"/><rect x="311.0" y="174" width="20" height="1.6" rx="0.8" opacity="0.7"/><rect x="308.0" y="181" width="12" height="1.6" rx="0.8" opacity="0.7"/><rect x="307.0" y="188" width="24" height="1.6" rx="0.8" opacity="0.6"/><rect x="315.0" y="196" width="16" height="1.6" rx="0.8" opacity="0.55"/><rect x="301.0" y="204" width="28" height="1.6" rx="0.8" opacity="0.5"/><rect x="311.0" y="213" width="18" height="1.6" rx="0.8" opacity="0.45"/><rect x="297.0" y="222" width="30" height="1.6" rx="0.8" opacity="0.4"/><rect x="314.0" y="232" width="20" height="1.6" rx="0.8" opacity="0.32"/><rect x="299.0" y="243" width="34" height="1.6" rx="0.8" opacity="0.26"/><rect x="311.0" y="255" width="22" height="1.6" rx="0.8" opacity="0.2"/><rect x="295.0" y="268" width="36" height="1.6" rx="0.8" opacity="0.14"/><rect x="308.0" y="282" width="26" height="1.6" rx="0.8" opacity="0.1"/></g>
  <g stroke="#9fb4d8" stroke-width="1.2" fill="none" opacity="0.35">
    <ellipse class="ripple" cx="90" cy="210" rx="18" ry="3"/>
    <ellipse class="ripple r2" cx="300" cy="240" rx="22" ry="4"/>
    <ellipse class="ripple r3" cx="150" cy="268" rx="26" ry="4"/>
  </g>
  <!-- Lily pads, and reeds at the sides. -->
  <g fill="#2f5a3a"><ellipse cx="60" cy="236" rx="9" ry="3"/><ellipse cx="74" cy="244" rx="7" ry="2.4"/><ellipse cx="342" cy="206" rx="8" ry="2.6"/></g>
  <circle cx="62" cy="234" r="2.2" fill="#e8a8c0"/>
  <g stroke="#1c2a22" stroke-width="2.4" stroke-linecap="round">
    <path d="M14 300 V250 M22 300 V236 M30 300 V256 M38 300 V244"/>
    <path d="M362 300 V246 M370 300 V232 M378 300 V252 M386 300 V240"/>
  </g>
  <g fill="#3a2a22"><ellipse cx="22" cy="240" rx="2.5" ry="6"/><ellipse cx="370" cy="236" rx="2.5" ry="6"/></g>
  <!-- A rowboat, tied up. -->
  <path d="M240 232 Q262 224 290 230 Q286 242 262 243 Q246 242 240 232 Z" fill="#4a2a24"/>
  <path d="M246 232 Q262 228 284 231" stroke="#6a4030" stroke-width="2" fill="none"/>
  <!-- The dock, running out from the bottom toward the lantern. -->
  <path d="M170 300 L186 186 L214 186 L230 300 Z" fill="#4a3428"/>
  <g stroke="#34241c" stroke-width="1.5">
    <path d="M168 290 H232 M171 270 H229 M174 252 H226 M177 236 H223 M179 222 H221 M181 210 H219 M183 199 H217 M185 190 H215"/>
  </g>
  <rect x="166" y="262" width="5" height="38" fill="#2e2018"/><rect x="229" y="262" width="5" height="38" fill="#2e2018"/>
  <!-- The lantern on a post at the dock's end. -->
  <g class="porch-light">
    <circle class="glow" cx="200" cy="164" r="110" fill="url(#lantern-glow)"/>
    <rect x="198" y="168" width="4" height="22" fill="#1a1412"/>
    <path d="M190 150 h20 l-3 -6 h-14 z" fill="#1a1412"/>
    <rect class="lamp" x="192" y="150" width="16" height="18" rx="2" stroke="#1a1412" stroke-width="2.5"/>
    <path d="M191 168 h18 l-2 4 h-14 z" fill="#1a1412"/>
  </g>
  <g class="drifters"></g>
</svg>`;

// A picture from its markup (read the way the page reads its own).
function svgFrom(markup) {
  const holder = document.createElement("template");
  holder.innerHTML = markup.trim();
  return holder.content.firstElementChild;
}

// Fireflies (for the Lake) or moths (for home), each drifting from far
// away toward the light.
function addDrifters(svg, kind, target) {
  const group = svg.querySelector(".drifters") ?? svg.querySelector("#moths");
  group.removeAttribute("id");
  group.innerHTML = "";
  const starts = kind === "fireflies" ? [[40, 80], [360, 110], [330, 250], [70, 200], [120, 140], [290, 90]] : [[30, 60], [380, 40], [360, 230], [60, 210]];
  starts.forEach(([x, y], i) => {
    const body =
      kind === "fireflies"
        ? `<circle r="5" fill="#e8ff9a" opacity="0.25"/><circle r="1.8" fill="#f4ffb8"/>`
        : `<ellipse cx="-3" cy="0" rx="4" ry="2.6" fill="#d9ccb4"/><ellipse cx="3" cy="0" rx="4" ry="2.6" fill="#d9ccb4"/><ellipse cx="0" cy="0" rx="1.2" ry="3" fill="#8a7a64"/>`;
    group.insertAdjacentHTML("beforeend", `<g class="moth-spot" data-x="${x}" data-y="${y}" style="transform: translate(${x}px, ${y}px)"><g class="${kind === "fireflies" ? "firefly" : "moth"}" style="animation-delay:-${i * 0.7}s">${body}</g></g>`);
  });
  return (progress) => {
    for (const spot of group.children) {
      const x = +spot.dataset.x + (target[0] - spot.dataset.x) * progress, y = +spot.dataset.y + (target[1] - spot.dataset.y) * progress;
      spot.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  };
}

const TRIPS = {
  lake: {
    title: "Willow Lake",
    steps: ["Climbing aboard", "Down the country road", "Through the pines", "Parking by the water"],
    arrived: "Welcome to Willow Lake!",
    tips: ["The rarest fish live out in the deep middle of the lake. Cast from the end of the dock.", "Bigger shadows mean bigger fish.", "Otis's bait shack is on the east shore.", "Lamps come on at dusk. Fireflies too, in the warm months.", "The benches face the water. Press E to sit a while."],
    scene: () => svgFrom(LAKE_SCENE),
    drifters: "fireflies",
    light: [200, 158],
    spot: () => ({ ...LAKE_SPAWN }),
  },
  home: {
    title: "Porchlight",
    steps: ["Climbing aboard", "Along the lake road", "Round the last bend", "Home sweet home"],
    arrived: "Welcome home!",
    tips: ["The pond at home is perfect for practice. Rarer fish are at the lake.", "The raccoons are always happy to buy pond junk.", "Press M for the map."],
    // (A copy of the first loading screen's porch, with its own names for
    // its colors so they don't clash with the original's.)
    scene: () => svgFrom(document.querySelector(".porch-scene").outerHTML.replaceAll("night-sky", "trip-night-sky").replaceAll("porch-glow", "trip-porch-glow")),
    drifters: "moths",
    light: [293, 124],
    spot: () => ({ x: BUS_STOP_X + 1.6, y: YARD + 8.7 }),
  },
};

// --- The trip ---
const RIDE_MS = 3600; // how long the bus "drives"

function travel(to) {
  const trip = TRIPS[to];
  if (!trip || traveling) return;
  traveling = true;
  closeNpc();
  playClickSound();
  honk();
  const screen = document.createElement("div");
  screen.className = "trip-screen";
  const scene = trip.scene();
  scene.setAttribute("class", "trip-scene");
  screen.appendChild(scene);
  screen.insertAdjacentHTML("beforeend", `<div class="loading-panel"><h1 class="loading-title"></h1><div class="loading-bar"><span></span></div><p class="loading-step"></p><p class="loading-tip"></p></div>`);
  screen.querySelector(".loading-title").textContent = trip.title;
  screen.querySelector(".loading-tip").textContent = trip.tips[Math.floor(Math.random() * trip.tips.length)];
  const move = addDrifters(scene, trip.drifters, trip.light);
  document.body.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("shown"));
  const bar = screen.querySelector(".loading-bar span"), label = screen.querySelector(".loading-step");
  const start = performance.now();
  let moved = false;
  const tick = () => {
    const k = Math.min(1, (performance.now() - start) / RIDE_MS);
    bar.style.width = `${Math.round(k * 100)}%`;
    label.textContent = k < 1 ? `${trip.steps[Math.min(trip.steps.length - 1, Math.floor(k * trip.steps.length))]}...` : trip.arrived;
    move(k * 0.6);
    // Halfway, behind the screen: you're there.
    if (k > 0.5 && !moved) {
      moved = true;
      hooks.arrive(trip.spot());
    }
    if (k < 1) return requestAnimationFrame(tick);
    // Arrived: the light flickers on, the flying things gather round it,
    // and the screen fades away.
    move(0.86);
    screen.classList.add("lit");
    setTimeout(() => screen.classList.add("gone"), 1100);
    setTimeout(() => {
      screen.remove();
      traveling = false;
    }, 1800);
  };
  requestAnimationFrame(tick);
}
