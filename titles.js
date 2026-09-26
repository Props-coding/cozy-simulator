// Titles: a few words shown under your name tag, like "the Scholar". You
// earn them from room levels, tiered achievements and some one-time
// achievements (the list, and what earns each one, is CONFIG.titles in
// config.js). Pick one, or none, in your wardrobe's Titles tab.
//
// Friends only send the title's id; the words come from config.js, so a
// title always reads the same for everyone.
import { tierOf, hasAchievement, myStats, collect, showToast } from "./achievements.js";
import { levelFor } from "./reputation.js";

const allTitles = () => CONFIG.titles ?? [];

// The words for a title id, or "" for none (or an id we don't know).
export function titleText(id) {
  return allTitles().find((t) => t.id === id)?.text ?? "";
}

// What earns a title, written out, like "Study Lv. 10".
export function titleSource(title) {
  if (title.room) return `${CONFIG.roomLevels?.rooms?.[title.room]?.name ?? title.room} Lv. ${title.level}`;
  if (title.tier) {
    const track = (CONFIG.tieredAchievements ?? []).find((t) => t.id === title.tier);
    return `${track?.name ?? title.tier}: ${CONFIG.achievementTiers?.[title.level - 1]?.name ?? "tier " + title.level}`;
  }
  if (title.achievement) return "A secret";
  return "";
}

// True if you've earned this title.
export function hasTitle(title) {
  if (title.room) return levelFor(myStats()["room_" + title.room] ?? 0) >= title.level;
  if (title.tier) return tierOf(title.tier) >= title.level;
  if (title.achievement) return hasAchievement(title.achievement);
  return false;
}

// Every title, each with `earned` true or false, in config order.
export function titleList() {
  return allTitles().map((t) => ({ ...t, earned: hasTitle(t), source: titleSource(t) }));
}

// Pops up a card for each title earned since last time (main.js calls
// this every few seconds). The first time ever, titles you already have
// are just noted, without pop-ups.
export function checkNewTitles() {
  const firstTime = !Array.isArray(myStats().titlesSeen);
  if (firstTime) collect("titlesSeen", "");
  for (const t of allTitles()) {
    if (!hasTitle(t) || myStats().titlesSeen.includes(t.id)) continue;
    collect("titlesSeen", t.id);
    if (!firstTime) showToast({ kind: "tier", icon: "🎀", label: "New title!", name: `"${t.text}"`, desc: "Wear it from your wardrobe's Titles tab.", crumbs: 0 });
  }
}
