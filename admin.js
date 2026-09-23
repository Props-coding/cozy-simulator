// The admin panel (🛠️ in the header), only for accounts the house owner
// has made admins (sudo cozy-admin admin NAME). Tools for testing: crumbs,
// unlocking things, achievements, jumping to any room, and the accounts
// list with password reset codes.
//
// The crumb and unlock tools only change your own save (like everything
// else in your browser). The accounts tools ask the server, which checks
// that you really are an admin.
import { serverApi, isAdmin } from "./account.js";
import { addCrumbs, setCrumbs, grantAllShopItems } from "./shop.js";
import { unlockAllQuietly, resetAchievements } from "./achievements.js";
import { grantAllDecor, grantRoomy } from "./home.js";
import { playClickSound, playCrumbSound } from "./audio.js";

const button = document.getElementById("admin-button");
const panel = document.getElementById("admin-panel");
const status = document.getElementById("admin-status");

// main.js tells us how to move you, which rooms there are, and how to
// refresh the Join screen's hat/shoe/pet lists.
let hooks = { teleport: () => {}, rooms: () => [], refreshLook: () => {} };

// Called once you've joined: shows the 🛠️ button if you're an admin.
export function initAdmin(options) {
  hooks = options;
  button.hidden = !isAdmin();
}

export function isAdminOpen() {
  return !panel.hidden;
}

function setOpen(open) {
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) {
    fillRooms();
    loadUsers();
  }
}

button.addEventListener("click", () => {
  setOpen(panel.hidden);
  button.blur();
  playClickSound();
});
document.addEventListener("click", (e) => {
  if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) setOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) setOpen(false);
});

function say(text) {
  status.textContent = text;
}

// Each tool button says what it does in data-tool.
const TOOLS = {
  "crumbs-100": () => (addCrumbs(100), "Added 100 crumbs."),
  "crumbs-1000": () => (addCrumbs(1000), "Added 1,000 crumbs."),
  "crumbs-zero": () => (setCrumbs(0), "Crumbs set to 0."),
  "shop-all": () => (grantAllShopItems(), hooks.refreshLook(), "You own every hat, pair of shoes and pet."),
  "decor-all": () => (grantAllDecor(), "You own one of every Nest & Nook item. Place them with Decorate."),
  roomy: () => (grantRoomy(), "Your bedroom is Roomy now."),
  "achievements-all": () => (unlockAllQuietly(), "Every achievement unlocked (quietly: no pop-ups or crumbs)."),
  "achievements-reset": () => (resetAchievements(), "Achievements and their counters reset to nothing."),
};

for (const tool of panel.querySelectorAll("[data-tool]")) {
  tool.addEventListener("click", () => {
    say(TOOLS[tool.dataset.tool]());
    playCrumbSound();
    tool.blur();
  });
}

// --- Jump to a room ---
const roomSelect = document.getElementById("admin-room");

function fillRooms() {
  roomSelect.innerHTML = "";
  for (const room of hooks.rooms()) roomSelect.add(new Option(room.name, room.id));
}

document.getElementById("admin-go").addEventListener("click", (e) => {
  const name = roomSelect.selectedOptions[0]?.text;
  if (hooks.teleport(roomSelect.value)) say(`Jumped to ${name}.`);
  else say(`Couldn't find a free spot in ${name}.`);
  playClickSound();
  e.currentTarget.blur();
});

// --- Accounts ---
const userList = document.getElementById("admin-users");

async function loadUsers() {
  userList.innerHTML = "<li>Loading...</li>";
  try {
    const { users } = await serverApi("GET", "/api/admin/users");
    userList.innerHTML = "";
    for (const u of users) {
      const li = document.createElement("li");
      const who = document.createElement("span");
      const saved = u.savedAt ? "saved " + new Date(u.savedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "no save yet";
      who.textContent = `${u.name}${u.admin ? " 🛠️" : ""} · ${u.member ? "in the house" : "no phrase yet"} · ${saved} · ${u.letters} letter${u.letters === 1 ? "" : "s"}`;
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "soft-button";
      reset.textContent = "Reset code";
      reset.title = `Make a one-time code ${u.name} can use to set a new password`;
      reset.addEventListener("click", async () => {
        try {
          const r = await serverApi("POST", "/api/admin/reset", { name: u.name });
          say(`Reset code for ${r.name}: ${r.code} (works once, for ${r.hours} hours). Send it to them privately.`);
        } catch (err) {
          say(err.message);
        }
      });
      li.append(who, reset);
      userList.appendChild(li);
    }
  } catch (err) {
    userList.innerHTML = "";
    say(err.message);
  }
}
