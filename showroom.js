// The furniture showroom (admin panel, Debug tab): every object the house
// can draw (furniture, decor, trees and bushes, benches, signs, the
// residents' things...), each numbered and named, so it's easy to say
// "number 42 needs work". Two buttons turn them all a quarter turn at a
// time (-90 and +90 degrees): the front, turned right, the back, turned
// left. Pieces without a look for that direction say so, which is the
// list of what still needs drawing. Drawn with their real settings from the house
// when there are some, like the gallery test (tests/gallery.spec.js).
//
// Also: day or night, any season, click a piece for a big view, and
// "Needs work" marks with a note, kept on this computer, that copy out as
// one list to paste to Claude.
import { openExtrasPanel } from "./extras.js";

const panel = document.getElementById("extras-panel");
// The four directions, a quarter turn apart (+90 degrees goes down the list).
const VIEWS = ["front", "right", "back", "left"];
const VIEW_NAMES = { front: "the front", right: "turned right", back: "the back", left: "turned left" };
const CELL = 150;
const ZOOM = 3; // (how much bigger the big view is)
const SEASON_CHOICES = [null, ...SEASONS]; // (null: the real season)

// The "Needs work" marks: { kind: "the note" }, kept in this browser.
const MARKS_KEY = "porchlight.showroomMarks";
function loadMarks() {
  try {
    return JSON.parse(localStorage.getItem(MARKS_KEY)) ?? {};
  } catch {
    return {};
  }
}
function saveMarks(marks) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks));
  } catch {
    // (Storage blocked: the marks last until the page closes.)
  }
}

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

// Draws one piece into a canvas, in a view, by day or night, in a season
// (`look`), `scale` times bigger. Returns false if it has no look that way.
function drawCell(canvas, kind, view, look, scale = 1) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = look.night ? "#6a7090" : "#e4dccb";
  ctx.fillRect(0, 0, CELL, CELL);
  let f = sampleOf(kind);
  const turned = view === "left" || view === "right";
  if ((view === "back" && !MODELS[kind]) || (turned && !FURNITURE_DRAWERS[kind + "Side"])) {
    ctx.restore();
    return false; // (only pieces built as models have a back look: render-models.js)
  }
  if (turned) f = { ...f, kind: kind + "Side", facing: view, w: f.h ?? f.w, h: f.w };
  const foot = toScreen(f.x + f.w / 2, f.y + (f.h ?? 0.6));
  const toPiece = () => ctx.translate(CELL / 2 - foot.x, CELL - 22 - foot.y);
  // (The house's own settings, swapped in just while this one draws.)
  const was = { floor: viewFloor, night: OUTDOORS.night, season: seasonPreview };
  ctx.beginPath();
  ctx.rect(0, 0, CELL, CELL);
  ctx.clip();
  try {
    viewFloor = floorOf(f.y);
    OUTDOORS.night = look.night;
    seasonPreview = look.season;
    ctx.save();
    toPiece();
    if (view === "back") drawModelBack(ctx, f);
    else drawOutlined(ctx, f);
    ctx.restore();
    // Night: the dark over it, then its own light (a lamp, the campfire).
    if (look.night) {
      ctx.fillStyle = "rgba(20, 28, 60, 0.3)";
      ctx.fillRect(0, 0, CELL, CELL);
      const glow = f.glow?.(f);
      if (glow?.[2]) {
        const [gx, gy, r, strength] = glow;
        toPiece();
        const p = toScreen(gx, gy);
        const light = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        light.addColorStop(0, `rgba(255, 185, 95, ${0.55 * strength})`);
        light.addColorStop(1, "rgba(255, 185, 95, 0)");
        ctx.fillStyle = light;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
  } catch {
    // (A piece that can't draw here shows as an empty cell.)
  }
  viewFloor = was.floor;
  OUTDOORS.night = was.night;
  seasonPreview = was.season;
  ctx.restore();
  return true;
}

// A small button for the bars.
function button(label, run) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "soft-button";
  b.textContent = label;
  b.addEventListener("click", run);
  return b;
}

export function openShowroom() {
  let turn = 0; // (0 the front, 1 turned right, 2 the back, 3 turned left)
  let filter = "";
  let onlyMarked = false;
  const look = { night: false, season: null };
  const marks = loadMarks();
  panel.classList.add("showroom-open");
  openExtrasPanel("Furniture showroom", (el) => {
    const all = kinds();
    const bar = document.createElement("div");
    bar.className = "showroom-bar";
    const facing = document.createElement("strong");
    const time = button("By day", () => {
      look.night = !look.night;
      time.textContent = look.night ? "By night" : "By day";
      draw();
    });
    const season = button("Season: now", () => {
      look.season = SEASON_CHOICES[(SEASON_CHOICES.indexOf(look.season) + 1) % SEASON_CHOICES.length];
      season.textContent = `Season: ${look.season ?? "now"}`;
      draw();
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
    bar.append(
      button("Turn -90°", () => ((turn = (turn + 3) % 4), draw())),
      button("Turn +90°", () => ((turn = (turn + 1) % 4), draw())),
      facing, time, season, search, count,
    );

    // The marks: show only them, copy them out as one list, or clear them.
    const markBar = document.createElement("div");
    markBar.className = "showroom-bar";
    const markCount = document.createElement("span");
    markCount.className = "tv-small";
    const countMarks = () => (markCount.textContent = `${Object.keys(marks).length} marked "Needs work"`);
    const only = button("Show only marked", () => {
      onlyMarked = !onlyMarked;
      only.classList.toggle("active", onlyMarked);
      draw();
    });
    const copy = button("Copy the list", async () => {
      const list = all
        .map((kind, i) => (kind in marks ? `${i + 1}. ${nameOf(kind)} (${kind})${marks[kind] ? `: ${marks[kind]}` : ""}` : null))
        .filter(Boolean)
        .join("\n");
      try {
        await navigator.clipboard.writeText(list || "(nothing marked)");
        copy.textContent = "Copied! Paste it to Claude";
      } catch {
        copy.textContent = "Couldn't copy";
      }
      setTimeout(() => (copy.textContent = "Copy the list"), 2000);
    });
    const clear = button("Clear marks", () => {
      if (!Object.keys(marks).length || !confirm("Clear every Needs work mark and note?")) return;
      for (const k in marks) delete marks[k];
      saveMarks(marks);
      draw();
    });
    markBar.append(markCount, only, copy, clear);

    const grid = document.createElement("div");
    grid.className = "showroom-grid";
    // The big view of one piece (click a piece; click the big view to close).
    const big = document.createElement("div");
    big.className = "showroom-big";
    big.hidden = true;
    big.addEventListener("click", () => (big.hidden = true));
    el.append(bar, markBar, grid, big);

    const zoom = (kind, n, view) => {
      big.textContent = "";
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = CELL * ZOOM;
      drawCell(canvas, kind, view, look, ZOOM);
      const label = document.createElement("p");
      label.textContent = `${n}. ${nameOf(kind)} (click to close)`;
      big.append(canvas, label);
      big.hidden = false;
    };

    const draw = () => {
      const view = VIEWS[turn];
      facing.textContent = `Showing ${VIEW_NAMES[view]}`;
      grid.textContent = "";
      let shown = 0, turnable = 0;
      all.forEach((kind, i) => {
        const n = i + 1, name = nameOf(kind);
        if (onlyMarked && !(kind in marks)) return;
        if (filter && !`${n} ${name} ${kind}`.toLowerCase().includes(filter)) return;
        const cell = document.createElement("figure");
        cell.className = "showroom-cell";
        cell.classList.toggle("marked", kind in marks);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = CELL;
        if (!drawCell(canvas, kind, view, look)) {
          cell.classList.add("no-turn");
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = look.night ? "#c8c0d8" : "#8a7a6a";
          ctx.font = "600 12px 'Quicksand', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(view === "back" ? "No back look" : "No turned look", CELL / 2, CELL / 2);
        } else {
          if (view !== "front") turnable++;
          canvas.title = "Click for a big view";
          canvas.addEventListener("click", () => zoom(kind, n, view));
        }
        const label = document.createElement("figcaption");
        const num = document.createElement("b");
        num.textContent = `${n}. `;
        label.append(num, name);
        label.title = kind;
        // Needs work: a tick box, and a note once it's ticked.
        const mark = document.createElement("label");
        mark.className = "showroom-mark";
        const tick = document.createElement("input");
        tick.type = "checkbox";
        tick.checked = kind in marks;
        mark.append(tick, " Needs work");
        const note = document.createElement("input");
        note.type = "text";
        note.placeholder = "What's wrong? (optional)";
        note.value = marks[kind] ?? "";
        note.hidden = !tick.checked;
        tick.addEventListener("change", () => {
          if (tick.checked) marks[kind] = note.value;
          else delete marks[kind];
          note.hidden = !tick.checked;
          cell.classList.toggle("marked", tick.checked);
          saveMarks(marks);
          countMarks();
          if (tick.checked) note.focus();
        });
        note.addEventListener("input", () => {
          marks[kind] = note.value;
          saveMarks(marks);
        });
        cell.append(canvas, label, mark, note);
        grid.appendChild(cell);
        shown++;
      });
      count.textContent = view === "front" ? `${shown} of ${all.length} pieces` : `${turnable} of ${shown} have a look this way`;
      countMarks();
    };
    draw();
    search.focus();
  }, () => panel.classList.remove("showroom-open"));
}
