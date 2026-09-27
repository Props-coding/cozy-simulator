// The bus stop (Update 4): a little bus, always parked at the stop (it
// used to run on a schedule), with Gus the bear at the wheel. Talk to Gus
// and pick a trip: the Lake (and the Farm, coming soon), or home again
// from there. Each trip plugs in with registerTrip (travel.js adds them):
//
//   registerTrip({ id: "lake", name: "The Lake", from: YARD_FLOOR,
//     note: "Big fish, a long dock.", start: () => { ... } });
//
// `from` is the floor the trip leaves from; `soon` lists it greyed out.
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

// The bus parked on your floor (the yard's, or the Lake's), or null.
function busHere(player) {
  return FURNITURE.find((f) => f.kind === "bus" && floorOf(f.y) === floorOf(player.y)) ?? null;
}

// The hint while you're at the bus stop.
export function busHint(nearBus) {
  return nearBus ? `Press E to talk to ${CONFIG.bus.driver} and pick a trip.` : "The bus is parked at the stop. Walk up to its door to take a trip.";
}

// True while you're standing by the bus's door.
export function nearWaitingBus(player) {
  const bus = busHere(player);
  if (!bus) return false;
  const x0 = bus.stopX ?? BUS_STOP_X;
  const cx = player.x + PLAYER_SIZE / 2, cy = player.y + PLAYER_SIZE / 2;
  return cx > x0 - 0.3 && cx < x0 + BUS_LENGTH + 0.3 && cy > bus.y - 1.8;
}

export function talkToDriver(player) {
  const floor = floorOf(player.y);
  const here = trips.filter((t) => t.from === floor);
  openNpc({
    name: CONFIG.bus.driver,
    portrait: { glyph: "gus" },
    color: "#3f6f9f",
    pitch: 200,
    hello: floor === YARD_FLOOR ? ["all aboard! where to today?", "morning! or evening. i lose track. where to?", "hop on! the lake's lovely this time of day."] : ["ready to head home?", "all aboard for home!", "good day out? hop on whenever you're ready."],
    tabs: [
      {
        id: "trips",
        label: "Trips",
        empty: "The Lake and the Farm are coming soon! Gus is still painting the signs.",
        items: () =>
          here.map((trip) => ({
            icon: trip.icon,
            name: trip.name,
            note: trip.note ?? "",
            locked: !!trip.soon,
            actions: trip.soon ? [] : [{ label: "Go", run: () => (trip.start(), null) }],
          })),
      },
    ],
  });
}

// A friendly two-note horn as the bus sets off (travel.js plays it).
export function honk() {
  if (hooks.outside()) playBusHorn();
}
