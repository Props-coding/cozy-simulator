// Room reputation: every room keeps count of how long you've spent in it,
// and levels up (Lv. 1 to 10) the more time you spend there. Reaching a
// new level pops up a little card. Your levels show on your profile card
// (and on friends' cards, for theirs).
//
// Which rooms have levels, and how many minutes each level takes, are in
// config.js (CONFIG.roomLevels). The time is counted by the house server
// (as "room_study" and so on, see bank.js: the page says which room you're
// in once a minute).
import { myStats, showToast } from "./achievements.js";

const settings = () => CONFIG.roomLevels ?? { rooms: {}, minutesForLevel: [] };

// The key a room's time is counted under: offices and bedrooms all count
// together ("office", "bedroom"), whoever's they are. Null for rooms with
// no levels (like the hallway).
export function roomLevelKey(room) {
  const key = room?.owned ? room.owned.kind : room?.id;
  return Object.hasOwn(settings().rooms, key) ? key : null;
}

// The level for this many seconds in a room (0 before Lv. 1).
export function levelFor(seconds) {
  const steps = settings().minutesForLevel;
  let level = 0;
  while (level < steps.length && seconds >= steps[level] * 60) level++;
  return level;
}

// Every room's level from a set of saved stats (yours, or a friend's from
// their profile): [{ key, name, icon, level, seconds, into, needed }],
// where `into` of `needed` seconds is the progress toward the next level
// (both 0 at the top level).
export function roomLevels(stats = {}) {
  const steps = settings().minutesForLevel;
  return Object.entries(settings().rooms).map(([key, { name, icon }]) => {
    const seconds = Number.isFinite(stats["room_" + key]) ? stats["room_" + key] : 0;
    const level = levelFor(seconds);
    const from = level === 0 ? 0 : steps[level - 1] * 60;
    const to = level < steps.length ? steps[level] * 60 : null;
    return { key, name, icon, level, seconds, into: to ? seconds - from : 0, needed: to ? to - from : 0 };
  });
}

// Whenever the server's counts come in: a card for any room that just
// reached a new level. (Not the first time: that's just where you are.)
let lastLevels = null;
window.addEventListener("bank-changed", () => {
  const levels = Object.fromEntries(roomLevels(myStats()).map((r) => [r.key, r.level]));
  const before = lastLevels;
  lastLevels = levels;
  if (!before) return;
  for (const [key, level] of Object.entries(levels)) {
    if (level <= (before[key] ?? 0)) continue;
    const { name, icon } = settings().rooms[key];
    showToast({ kind: "level", icon, label: "Level up!", name: `${name} Lv. ${level}`, desc: level === settings().minutesForLevel.length ? "The top level. This room is yours." : "You've been spending time here.", crumbs: 0 });
    window.dispatchEvent(new CustomEvent("room-level", { detail: { key, level } }));
  }
});
