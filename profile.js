// Friend profiles: click someone in the house (or their name in "Who's
// here") to see their card: their character and pet, a short bio, when
// they joined, their hours in the house, and the achievements they've
// earned. Your own card lets you write your bio.
//
// The card comes from the house server, which reads each friend's look,
// achievements and hours from their cloud save.
import { serverApi, accountName } from "./account.js";
import { ACHIEVEMENTS, myStats } from "./achievements.js";
import { roomLevels } from "./reputation.js";
import { itemName } from "./shop.js";
import { playClickSound } from "./audio.js";
import { lofiStation } from "./turntable.js";

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

export async function openProfile(name) {
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
  const mine = accountName() && p.name.toLowerCase() === accountName().toLowerCase();
  body.innerHTML = "";

  // Their character (and pet), drawn like on the Join screen.
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

  const head = el("div", "profile-head");
  const nameTag = el("h2", "profile-name", p.name);
  nameTag.style.color = p.color;
  const hours = Math.floor(p.seconds / 3600), minutes = Math.floor((p.seconds % 3600) / 60);
  const since = new Date(p.since).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  head.append(
    nameTag,
    el("p", "profile-meta", `In the house since ${since}`),
    el("p", "profile-meta", hours ? `${hours} hour${hours === 1 ? "" : "s"} in the house` : `${minutes} minute${minutes === 1 ? "" : "s"} in the house`),
    el("p", "profile-meta", `🎧 Favorite lo-fi: ${lofiStation(p.lofi).name}`)
  );

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

  // Achievements: the ones they've earned, as a row of icons.
  const earned = ACHIEVEMENTS.filter((a) => p.achievements.includes(a.id));
  const trophies = el("div", "profile-trophies");
  trophies.appendChild(el("h3", "", `Achievements · ${earned.length} of ${ACHIEVEMENTS.length}`));
  const row = el("div", "profile-trophy-row");
  for (const a of earned) {
    const icon = el("span", "profile-trophy", a.icon);
    icon.title = a.name + ": " + a.desc;
    row.appendChild(icon);
  }
  if (!earned.length) row.appendChild(el("span", "profile-meta", "None yet."));
  trophies.appendChild(row);

  // Room levels: a little tile per room, with a bar toward the next level.
  // (Your own come straight from this browser, so they're always current;
  // friends' come from their cloud save.)
  const levels = roomLevels(mine ? myStats() : p.rooms ?? {});
  const rooms = el("div", "profile-rooms");
  rooms.appendChild(el("h3", "", "Room levels"));
  const grid = el("div", "profile-room-grid");
  for (const r of levels) {
    const tile = el("div", "profile-room" + (r.level ? "" : " unranked"));
    tile.title = r.level ? `${r.name}: ${Math.floor(r.seconds / 60)} minutes spent here` : `${r.name}: not ranked yet`;
    tile.append(el("span", "profile-room-icon", r.icon), el("span", "profile-room-name", r.name), el("span", "profile-room-level", `Lv. ${r.level}`));
    const bar = el("span", "profile-room-bar");
    const fill = el("span");
    fill.style.width = r.needed ? `${Math.round((r.into / r.needed) * 100)}%` : "100%";
    bar.appendChild(fill);
    tile.appendChild(bar);
    grid.appendChild(tile);
  }
  rooms.appendChild(grid);

  body.append(look, head, bioBox, rooms, trophies);
}
