// Friend profiles: click someone in the house (or their name in "Who's
// here") to see their card.
//
// The top of the card is always there: their character and pet, name,
// title, bio (your own card lets you edit it) and one line of stats.
// Below it are four tabs:
//   Overview      up to 5 achievements they pinned, and their top 3 rooms
//   About         facts about their time here: favorite lo-fi and room,
//                 days visited, time asleep, chats, dances and more
//   Levels        every room's level, highest first
//   Achievements  every achievement, grouped, with tiers and progress
//                 (on your own card, open one to pin or unpin it)
//
// The card comes from the house server, which reads each friend's look,
// achievements and hours from their cloud save. Your own progress comes
// straight from this browser, so it's always current.
import { serverApi, accountName } from "./account.js";
import { ACHIEVEMENTS, MOMENT_GROUPS, MAX_PINS, myStats, myTiers, myPins, togglePin, hasAchievement, trackValueFrom, goalText } from "./achievements.js";
import { roomLevels } from "./reputation.js";
import { titleText } from "./titles.js";
import { itemName, ownedCount, ownedPets, petsAmong } from "./shop.js";
import { playClickSound } from "./audio.js";
import { lofiStation } from "./turntable.js";
import { iconCanvas } from "./icons.js";

const card = document.getElementById("profile-card");
const body = document.getElementById("profile-body");

export function isProfileOpen() {
  return !card.hidden;
}

export function closeProfile() {
  card.hidden = true;
  document.activeElement?.blur();
}

document.getElementById("profile-close").addEventListener("click", () => {
  playClickSound();
  closeProfile();
});

// Escape closes the card. While it's open, the game's keys are off (so
// typing a bio doesn't walk you away).
window.addEventListener("keydown", (e) => {
  if (card.hidden) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    e.preventDefault();
    closeProfile();
  }
});

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const tiersList = () => CONFIG.achievementTiers ?? [];
const tracks = () => CONFIG.tieredAchievements ?? [];
// Numbers for progress labels: 2.5 hours, 1,500 crumbs.
const round = (v) => (v < 10 && v % 1 ? Math.floor(v * 10) / 10 : Math.floor(v)).toLocaleString();

// A progress bar, `into` of `needed` of the way, in `color`.
function bar(into, needed, color) {
  const track = el("span", "pf-bar");
  const fill = el("span");
  fill.style.width = `${needed ? Math.max(3, Math.min(100, Math.round((into / needed) * 100))) : 100}%`;
  if (color) fill.style.background = color;
  track.appendChild(fill);
  return track;
}

// A tier chip: its medal and name, in the tier's color.
function tierChip(index) {
  const tier = tiersList()[index];
  const chip = el("span", "pf-tier");
  chip.style.color = tier.color;
  chip.style.borderColor = tier.color;
  chip.append(iconCanvas("medal:" + index, 14), tier.name);
  return chip;
}

// Everything about one person's achievements, ready to show: each one's
// icon, name, whether they have it, its tier and the progress to the next.
function achievementList(p, mine) {
  const stats = mine ? myStats() : { ...p.stats, ...p.rooms };
  const levels = roomLevels(stats);
  const values = {
    items: mine ? ownedCount() : (p.owned ?? []).length,
    pets: mine ? ownedPets().length : petsAmong(p.owned ?? []),
    roomLevels: levels.reduce((sum, r) => sum + r.level, 0),
  };
  const tierCounts = mine ? myTiers() : p.tiers ?? {};
  const earned = (id) => (mine ? hasAchievement(id) : p.achievements.includes(id));
  const tiered = tracks().map((t) => {
    const max = Math.min(t.goals.length, tiersList().length);
    const have = Math.min(tierCounts[t.id] ?? 0, max);
    const value = trackValueFrom(t, stats, values);
    const from = have ? t.goals[have - 1] : 0;
    return {
      id: t.id,
      name: t.name,
      tiered: true,
      earned: have > 0,
      have,
      next: have < max ? { index: have, goal: t.goals[have], into: value - from, needed: t.goals[have] - from, label: `${round(value)} / ${round(t.goals[have])}` } : null,
      hint: goalText(t, Math.min(have, max - 1)),
      goals: t.goals.slice(0, max).map((g, i) => ({ text: goalText(t, i), done: i < have })),
    };
  });
  const moments = ACHIEVEMENTS.map((a) => ({
    id: a.id,
    name: a.secret && !earned(a.id) ? "???" : a.name,
    tiered: false,
    earned: earned(a.id),
    hint: a.secret && !earned(a.id) ? "A secret. Keep exploring the house." : a.desc,
    crumbs: a.crumbs,
  }));
  return { tiered, moments, levels, all: [...tiered, ...moments] };
}

export async function openProfile(name, tab = "overview") {
  card.hidden = false;
  body.innerHTML = "";
  body.appendChild(el("p", "profile-loading", "Looking them up..."));
  playClickSound();
  let p;
  try {
    p = await serverApi("GET", "/api/profile?name=" + encodeURIComponent(name));
  } catch (err) {
    body.innerHTML = "";
    body.appendChild(el("p", "profile-loading", err.status === 404 ? `${name} doesn't have an account yet (they may be on an older version).` : err.message));
    return;
  }
  showProfile(p, tab);
}

function showProfile(p, tab) {
  const mine = !!accountName() && p.name.toLowerCase() === accountName().toLowerCase();
  body.innerHTML = "";
  body.append(header(p, mine));

  const tabs = el("nav", "pf-tabs");
  const page = el("div", "pf-page");
  const show = (id) => {
    tab = id;
    for (const b of tabs.children) b.classList.toggle("active", b.dataset.tab === id);
    page.replaceChildren(...{ overview, about, rooms, achievements }[id](p, mine, () => show(tab)));
  };
  for (const [id, label] of [["overview", "Overview"], ["about", "About"], ["rooms", "Levels"], ["achievements", "Achievements"]]) {
    const b = el("button", "", label);
    b.type = "button";
    b.dataset.tab = id;
    b.addEventListener("click", () => {
      playClickSound();
      show(id);
    });
    tabs.appendChild(b);
  }
  body.append(tabs, page);
  show(tab);
}

// --- The header: character, name, title, bio and stats ---
function header(p, mine) {
  const head = el("div", "pf-header");

  // Their character (and pet), drawn like in the wardrobe.
  const look = el("div", "profile-look");
  const character = el("canvas", "profile-character");
  character.width = 96;
  character.height = 136; // room above the circle for tall hats
  drawCharacterPreview(character, { color: p.color, hat: p.hat ?? "none", shoes: p.shoes ?? "none", glasses: p.glasses ?? "none", face: p.face, scarf: p.scarf ?? "none", backpack: p.backpack ?? "none", earrings: p.earrings ?? "none" });
  look.appendChild(character);
  if (p.pet && Object.hasOwn(PET_DRAWERS, p.pet)) {
    const pet = el("canvas", "profile-pet");
    pet.width = 88;
    pet.height = 92; // room for tall or wide pets
    drawPetPreview(pet, p.pet);
    pet.title = itemName(p.pet);
    look.appendChild(pet);
  }

  const info = el("div", "pf-info");
  const nameTag = el("h2", "profile-name", p.name);
  nameTag.style.color = p.color;
  // (Your own title comes from this browser, so a new pick shows right away.)
  let title = titleText(p.title);
  if (mine) {
    try {
      title = titleText(JSON.parse(localStorage.getItem("cozy-house-profile"))?.title);
    } catch {
      // Keep the one from the server.
    }
  }
  info.append(nameTag);
  if (title) info.append(el("p", "profile-title", title));

  // The bio (and, on your own card, a way to change it).
  const bio = el("p", "profile-bio", p.bio || (mine ? "Write a little about yourself!" : "No bio yet."));
  if (!p.bio) bio.classList.add("empty");
  const bioBox = el("div", "profile-bio-box");
  bioBox.appendChild(bio);
  if (mine) {
    const edit = el("button", "link-button", "Edit bio");
    edit.type = "button";
    edit.addEventListener("click", () => {
      const input = el("textarea", "profile-bio-input");
      input.maxLength = 160;
      input.rows = 3;
      input.value = p.bio;
      input.placeholder = "Up to 160 characters";
      const save = el("button", "warm-button", "Save");
      save.type = "button";
      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          const r = await serverApi("POST", "/api/profile", { bio: input.value });
          p.bio = r.bio;
          openProfile(p.name);
        } catch (err) {
          save.disabled = false;
          save.textContent = err.message;
        }
      });
      bioBox.replaceChildren(input, save);
      input.focus();
    });
    bioBox.appendChild(edit);
  }
  info.append(bioBox);

  // One line of stats: when they joined, and their time in the house.
  // (More facts are in the About tab.)
  const seconds = mine && Number.isFinite(myStats().seconds) ? myStats().seconds : p.seconds;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  const since = new Date(p.since).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const time = hours ? `${hours.toLocaleString()} hour${hours === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  info.append(el("p", "pf-stats", `Joined ${since} · ${time} in the house`));

  head.append(look, info);
  return head;
}

// --- One achievement or room, as a row ---
function achievementRow(a, mine, redraw) {
  const row = el("div", "pf-row pf-ach" + (a.earned ? "" : " locked"));
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-expanded", "false");
  row.title = a.hint;
  const text = el("div", "pf-row-text");
  const top = el("div", "pf-row-top");
  top.append(el("strong", "", a.name));
  if (a.tiered && a.have) top.append(tierChip(a.have - 1));
  else if (!a.tiered && a.earned) top.append(el("span", "pf-earned", "Earned"));
  if (mine && myPins().includes(a.id)) top.append(el("span", "pf-pinned", "Pinned"));
  text.append(top);
  if (a.tiered && a.next) {
    const next = tiersList()[a.next.index];
    const progress = el("div", "pf-progress");
    progress.append(bar(a.next.into, a.next.needed, next.color), el("span", "pf-progress-label", `${a.next.label} for ${next.name}`));
    text.append(progress);
  } else if (a.tiered) {
    text.append(el("span", "pf-hint", "Every tier reached. Legendary!"));
  } else if (!a.earned) {
    text.append(el("span", "pf-hint", a.hint));
  }

  // Details: open it (click, tap, or Enter) for the whole story, and on
  // your own card a button to pin it to your profile.
  const details = el("div", "pf-details");
  details.hidden = true;
  if (a.tiered) {
    const list = el("ul", "pf-goals");
    a.goals.forEach((g, i) => {
      const li = el("li", g.done ? "done" : "");
      li.append(iconCanvas("medal:" + i, 14), `${tiersList()[i].name}: ${g.text}`);
      list.appendChild(li);
    });
    details.append(list);
  } else {
    details.append(el("p", "pf-hint", `${a.hint} (+${a.crumbs} crumbs)`));
  }
  if (mine && a.earned) {
    const pinned = myPins().includes(a.id);
    const pin = el("button", "soft-button pf-pin", pinned ? "Unpin from profile" : "Pin to profile");
    pin.type = "button";
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      playClickSound();
      if (!togglePin(a.id)) {
        pin.textContent = `You can pin ${MAX_PINS}. Unpin one first.`;
        return;
      }
      redraw();
    });
    details.append(pin);
  }
  const toggle = () => {
    details.hidden = !details.hidden;
    row.classList.toggle("open", !details.hidden);
    row.setAttribute("aria-expanded", String(!details.hidden));
  };
  row.addEventListener("click", toggle);
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
  text.append(details);
  row.append(iconCanvas(a.id, 34), text);
  return row;
}

function roomRow(r) {
  const visited = r.seconds > 0;
  const row = el("div", "pf-row pf-room" + (visited ? "" : " locked"));
  const text = el("div", "pf-row-text");
  const top = el("div", "pf-row-top");
  top.append(el("strong", "", r.name), el("span", visited ? "pf-level" : "pf-hint", visited ? `Lv. ${r.level}` : "Not visited yet"));
  text.append(top);
  if (visited) {
    const progress = el("div", "pf-progress");
    const minutes = Math.floor(r.seconds / 60);
    progress.append(
      bar(r.needed ? r.into : 1, r.needed || 1, "#5f8f4a"),
      el("span", "pf-progress-label", r.needed ? `${Math.floor(r.into / 60)} / ${Math.round(r.needed / 60)} min to Lv. ${r.level + 1}` : `Top level · ${minutes.toLocaleString()} min here`)
    );
    text.append(progress);
  }
  row.append(iconCanvas("room:" + r.key, 34), text);
  return row;
}

const byLevel = (a, b) => b.level - a.level || b.seconds - a.seconds;

// --- The tabs ---
function overview(p, mine, redraw) {
  const { all, levels } = achievementList(p, mine);
  const out = [];

  out.push(el("h3", "pf-heading", "Showcase"));
  const pins = (mine ? myPins() : p.pinned ?? []).map((id) => all.find((a) => a.id === id)).filter((a) => a?.earned);
  if (pins.length) {
    const shelf = el("div", "pf-showcase");
    for (const a of pins) {
      const item = el("div", "pf-show");
      item.title = a.hint;
      item.append(iconCanvas(a.id, 44), el("span", "pf-show-name", a.name));
      if (a.tiered) item.append(tierChip(a.have - 1));
      shelf.appendChild(item);
    }
    out.push(shelf);
  } else {
    out.push(el("p", "pf-empty", mine ? `Pin up to ${MAX_PINS} favorites from the Achievements tab (open one and press Pin).` : "Nothing pinned yet."));
  }

  out.push(el("h3", "pf-heading", "Top rooms"));
  const top = levels.filter((r) => r.seconds > 0).sort(byLevel).slice(0, 3);
  if (top.length) {
    const list = el("div", "pf-list");
    for (const r of top) list.appendChild(roomRow(r));
    out.push(list);
  } else {
    out.push(el("p", "pf-empty", "No time in any room yet."));
  }
  return out;
}

// Facts about their time in the house, as little tiles. Counters that
// haven't started yet (0) are left out. (Their joined date and hours are
// in the header, so they aren't repeated here.)
function about(p, mine) {
  const stats = mine ? myStats() : { ...p.stats, ...p.rooms };
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const count = (v, one, many) => `${Math.floor(v).toLocaleString()} ${Math.floor(v) === 1 ? one : many}`;
  const hours = (seconds) => (seconds < 3600 ? count(seconds / 60, "minute", "minutes") : count(seconds / 3600, "hour", "hours"));
  const favorite = roomLevels(stats).filter((r) => r.seconds > 0).sort((a, b) => b.seconds - a.seconds)[0];
  const days = Math.max(1, Math.floor((Date.now() - p.since) / 86_400_000));
  const owned = mine ? ownedCount() : (p.owned ?? []).length;
  const pets = mine ? ownedPets().length : petsAmong(p.owned ?? []);
  const facts = [
    ["lofi", "Favorite lo-fi", lofiStation(p.lofi).name],
    ...(favorite ? [["room:" + favorite.key, "Favorite room", `${favorite.name} · ${hours(favorite.seconds)}`]] : []),
    ["wellRounded", "Member for", count(days, "day", "days")],
    ...(n(stats.daysVisited) ? [["calendar", "Days visited", count(stats.daysVisited, "day", "days")]] : []),
    ...(n(stats.sleepSeconds) ? [["goodnight", "Time asleep", hours(stats.sleepSeconds)]] : []),
    ...(n(stats.chats) ? [["hello", "Chat messages", count(stats.chats, "message", "messages")]] : []),
    ...(n(stats.emotesUsed) ? [["expressive", "Emotes used", count(stats.emotesUsed, "time", "times")]] : []),
    ...(n(stats.dances) ? [["dancer", "Dances", count(stats.dances, "dance", "dances")]] : []),
    ...(n(stats.focusSessions) ? [["focus", "Focus sessions", count(stats.focusSessions, "session", "sessions")]] : []),
    ...(n(stats.crumbsEarned) ? [["crumbs", "Crumbs earned", count(stats.crumbsEarned, "crumb", "crumbs")]] : []),
    ...(owned ? [["collector", "From the raccoons", count(owned, "thing", "things")]] : []),
    ...(pets ? [["menagerie", "Pets adopted", count(pets, "pet", "pets")]] : []),
  ];
  const grid = el("div", "pf-facts");
  for (const [icon, label, value] of facts) {
    const tile = el("div", "pf-fact");
    const text = el("div", "pf-fact-text");
    text.append(el("span", "pf-fact-label", label), el("strong", "", value));
    tile.append(iconCanvas(icon, 30), text);
    grid.appendChild(tile);
  }
  return [grid];
}

function rooms(p, mine) {
  const { levels } = achievementList(p, mine);
  const list = el("div", "pf-list");
  for (const r of [...levels].sort(byLevel)) list.appendChild(roomRow(r));
  return [list];
}

function achievements(p, mine, redraw) {
  const { tiered, moments, all } = achievementList(p, mine);
  const count = all.filter((a) => a.earned).length;
  const tierTotal = tiered.reduce((sum, a) => sum + a.have, 0);
  const out = [el("p", "pf-summary", `${count} achievement${count === 1 ? "" : "s"} · ${tierTotal} tier${tierTotal === 1 ? "" : "s"} earned`)];
  const group = (title, list) => {
    const got = list.filter((a) => a.earned).length;
    out.push(el("h3", "pf-heading", `${title} · ${got} of ${list.length}`));
    const box = el("div", "pf-list");
    // Earned ones first, then the rest, each in their usual order.
    for (const a of [...list.filter((a) => a.earned), ...list.filter((a) => !a.earned)]) box.appendChild(achievementRow(a, mine, redraw));
    out.push(box);
  };
  group("Milestones", tiered);
  for (const [title, ids] of MOMENT_GROUPS) group(title, ids.map((id) => moments.find((a) => a.id === id)).filter(Boolean));
  return out;
}
