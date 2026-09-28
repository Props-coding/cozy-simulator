// The furniture showroom (admin panel, Debug tab): every object the house
// can draw (furniture, decor, trees and bushes, benches, signs, the
// residents' things...), each numbered and named, so it's easy to say
// "number 42 needs work". Two buttons turn them all a quarter turn at a
// time (-90 and +90 degrees): the front, turned right, the back, turned
// left. Pieces without a look for that direction say so, which is the
// list of what still needs drawing. Drawn with their real settings from the house
// when there are some, like the gallery test (tests/gallery.spec.js).
import { openExtrasPanel } from "./extras.js";

const panel = document.getElementById("extras-panel");
// The four directions, a quarter turn apart (+90 degrees goes down the list).
const VIEWS = ["front", "right", "back", "left"];
const VIEW_NAMES = { front: "the front", right: "turned right", back: "the back", left: "turned left" };
const CELL = 150;

// Every kind, in alphabetical order of the names you see (the numbers
// follow that order). The turned versions ("wardrobeSide") are views of
// their piece, not pieces of their own.
const kinds = () =>
  Object.keys(FURNITURE_DRAWERS)
    .filter((k) => !k.endsWith("Side"))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b));

// A friendly name: its Nest & Nook name if it has one, otherwise its kind
// in words ("picnicTable" becomes "Picnic table").
function nameOf(kind) {
  const decor = Object.values(DECOR).find((d) => d.kind === kind);
  if (decor) return decor.name;
  const words = kind.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

// A sample of one kind to draw: the real one from the house, or its Nest &
// Nook entry, or a plain size.
function sampleOf(kind) {
  const f = { ...(FURNITURE.find((x) => x.kind === kind) ?? Object.values(DECOR).find((d) => d.kind === kind) ?? {}) };
  f.kind = kind;
  f.showroom = true; // (visitors who are away still show here)
  f.x ??= 0;
  f.y ??= 0;
  f.w ??= 1;
  if (f.h === undefined && !f.wall && !FURNITURE.some((x) => x.kind === kind)) f.h = 0.6;
  f.color ??= "#d98a6a";
  f.screen ??= f.color;
  return f;
}

// Draws one piece into a cell, in a view. Returns false if it has no
// turned look (for the left and right views).
function drawCell(canvas, kind, view) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e4dccb";
  ctx.fillRect(0, 0, CELL, CELL);
  let f = sampleOf(kind);
  if (view === "back") return false; // (no piece has a back look yet)
  if (view !== "front") {
    if (!FURNITURE_DRAWERS[kind + "Side"]) return false;
    f = { ...f, kind: kind + "Side", facing: view, w: f.h ?? f.w, h: f.w };
  }
  const foot = toScreen(f.x + f.w / 2, f.y + (f.h ?? 0.6));
  const was = viewFloor;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CELL, CELL);
  ctx.clip();
  ctx.translate(CELL / 2 - foot.x, CELL - 22 - foot.y);
  try {
    viewFloor = floorOf(f.y);
    drawOutlined(ctx, f);
  } catch {
    // (A piece that can't draw here shows as an empty cell.)
  }
  viewFloor = was;
  ctx.restore();
  return true;
}

export function openShowroom() {
  let turn = 0; // (0 the front, 1 turned right, 2 the back, 3 turned left)
  let filter = "";
  panel.classList.add("showroom-open");
  openExtrasPanel("Furniture showroom", (el) => {
    const bar = document.createElement("div");
    bar.className = "showroom-bar";
    const facing = document.createElement("strong");
    const views = [
      ["Turn -90°", -1],
      ["Turn +90°", 1],
    ].map(([label, step]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "soft-button";
      b.textContent = label;
      b.addEventListener("click", () => {
        turn = (turn + step + 4) % 4;
        draw();
      });
      return b;
    });
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Find (name or number)";
    search.addEventListener("input", () => {
      filter = search.value.trim().toLowerCase();
      draw();
    });
    const count = document.createElement("span");
    count.className = "tv-small";
    bar.append(...views, facing, search, count);
    const grid = document.createElement("div");
    grid.className = "showroom-grid";
    el.append(bar, grid);
    const all = kinds();
    const draw = () => {
      const view = VIEWS[turn];
      facing.textContent = `Showing ${VIEW_NAMES[view]}`;
      grid.textContent = "";
      let shown = 0, turnable = 0;
      all.forEach((kind, i) => {
        const n = i + 1, name = nameOf(kind);
        if (filter && !`${n} ${name} ${kind}`.toLowerCase().includes(filter)) return;
        const cell = document.createElement("figure");
        cell.className = "showroom-cell";
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = CELL;
        const drew = drawCell(canvas, kind, view);
        if (!drew) {
          cell.classList.add("no-turn");
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#8a7a6a";
          ctx.font = "600 12px 'Quicksand', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(view === "back" ? "No back look" : "No turned look", CELL / 2, CELL / 2);
        } else if (view !== "front") turnable++;
        const label = document.createElement("figcaption");
        const num = document.createElement("b");
        num.textContent = `${n}. `;
        label.append(num, name);
        label.title = kind;
        cell.append(canvas, label);
        grid.appendChild(cell);
        shown++;
      });
      count.textContent = view === "front" ? `${shown} of ${all.length} pieces` : `${turnable} of ${shown} have a look this way`;
    };
    draw();
    search.focus();
  }, () => panel.classList.remove("showroom-open"));
}
