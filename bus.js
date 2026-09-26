// The bus stop (Update 4): a little bus pulls up by the road on a
// schedule, waits a while, and drives off (drawn in outdoors.js, where
// busState works out where it is from the time of day, so everyone sees
// it at the same moment). Gus the bear drives it.
//
// Trips aren't built yet: talking to Gus shows "Trips coming soon". When
// they are, each trip plugs in with registerTrip (a destination or a mini
// game), and shows up in Gus's list with a "Go" button. For example:
//
//   registerTrip({ id: "beach", name: "The Beach", icon: "🏖️",
//     note: "Sand, waves and a shell hunt.", start: () => { ... } });
import { playBusHorn } from "./audio.js";
import { openNpc } from "./npc.js";

const trips = [];
let hooks = { outside: () => false };

// main.js tells us whether you're outside (to hear the bus's horn).
export function initBus(options) {
  hooks = options;
}

// Adds a trip to the bus's list (see the example above).
export function registerTrip(trip) {
  if (!trips.some((t) => t.id === trip.id)) trips.push(trip);
}

// The hint while you're at the bus stop.
export function busHint(nearBus) {
  const bus = busState();
  if (bus.phase === "waiting") return nearBus ? `The bus is here! Press E to talk to ${CONFIG.bus.driver}. (It leaves in ${Math.ceil(bus.leavesIn)}s.)` : "The bus is waiting at the stop.";
  if (bus.phase === "arriving") return "Here comes the bus!";
  const minutes = Math.max(1, Math.ceil(bus.untilNext / 60));
  return `The next bus comes in about ${minutes} minute${minutes === 1 ? "" : "s"}. Trips coming soon!`;
}

// True while the bus is waiting and you're standing by its door.
export function nearWaitingBus(player) {
  const bus = busState();
  if (bus.phase !== "waiting" || floorOf(player.y) !== YARD_FLOOR) return false;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return cx > bus.x - 0.3 && cx < bus.x + BUS_LENGTH + 0.3 && cy > YARD + 8.9;
}

export function talkToDriver() {
  openNpc({
    name: CONFIG.bus.driver,
    icon: "🐻",
    color: "#3f6f9f",
    pitch: 200,
    hello: trips.length ? "all aboard! where to today?" : ["howdy! no trips yet, i'm afraid. still planning the routes.", "trips coming soon! i'm just doing laps for now.", "hop on any time. well. soon."],
    tabs: [
      {
        id: "trips",
        label: "Trips",
        empty: "Trips coming soon! Gus is still planning where the bus will go.",
        items: () => trips.map((trip) => ({ icon: trip.icon, name: trip.name, note: trip.note ?? "", actions: [{ label: "Go", run: () => trip.start() }] })),
      },
    ],
  });
}

// A friendly two-note horn when the bus pulls in (if you're outside).
let lastPhase = null;
setInterval(() => {
  const phase = busState().phase;
  if (phase === "waiting" && lastPhase === "arriving" && hooks.outside()) playBusHorn();
  lastPhase = phase;
}, 500);
