// The right-click menu over the house (instead of the browser's own menu,
// which is turned off on the house itself; chat and text boxes keep the
// normal one, for copy and paste). main.js decides what's in it:
// - on a friend: Trade (and, for admins, the admin tools);
// - on furniture: Sit, Inspect, and in your own room Move or Store;
// - on empty floor: nothing.
// It closes when you click somewhere else or press Escape.
import { uiIcon } from "./ui-icons.js";
import { playClickSound } from "./audio.js";

const menu = document.getElementById("house-menu");
const title = document.getElementById("house-menu-title");
const list = document.getElementById("house-menu-items");
const info = document.getElementById("house-menu-info");

export function isMenuOpen() {
  return !menu.hidden;
}

export function closeMenu() {
  menu.hidden = true;
}

// Opens at `at` ({ x, y } inside the house view), kept on screen.
// items: [{ label, icon, run, danger, disabled, title }] (icon: one of the
// drawn interface icons, see ui-icons.js); or `lines` for an
// Inspect card (a few lines of text instead of buttons).
export function openMenu(at, heading, items = [], lines = []) {
  title.textContent = heading;
  list.innerHTML = "";
  for (const item of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "house-menu-item" + (item.danger ? " danger" : "");
    b.textContent = item.label;
    if (item.icon) b.insertAdjacentHTML("afterbegin", uiIcon(item.icon) + " ");
    b.disabled = !!item.disabled;
    if (item.title) b.title = item.title;
    b.addEventListener("click", () => {
      playClickSound();
      closeMenu();
      item.run();
    });
    list.appendChild(b);
  }
  info.innerHTML = "";
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    info.appendChild(p);
  }
  info.hidden = !lines.length;
  menu.hidden = false;
  // Keep it inside the house view.
  const box = menu.parentElement.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = `${Math.max(6, Math.min(at.x, box.width - w - 6))}px`;
  menu.style.top = `${Math.max(6, Math.min(at.y, box.height - h - 6))}px`;
  list.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
}

document.addEventListener("pointerdown", (e) => {
  if (!menu.hidden && !menu.contains(e.target)) closeMenu();
});
window.addEventListener(
  "keydown",
  (e) => {
    if (menu.hidden || e.key !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeMenu();
  },
  { capture: true } // (first, so Escape only closes the menu)
);
