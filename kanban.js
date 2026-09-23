// The Workshop's project boards: a light, friendly kanban.
//
// The boards live on the house server, so they're still there when
// everyone logs off. Every change (add a card, claim it, move it...) is
// one small action the server applies in turn, so two people editing at
// once never overwrite each other. After a change, friends get a nudge
// over the network and fetch the new boards right away (and everyone
// checks every 15 seconds anyway).
//
// Press E at the corkboard in the Workshop to open the boards: tabs for
// each project, three columns (To do, Doing, Done), a quick-add box, and
// cards you can click to claim (your face pins on as a thumbtack) and drag
// between columns. Finished cards drop a paper star into the done jar on
// the workbench, and the house chat hears about new and finished cards.
import { serverApi, accountName } from "./account.js";
import { sendKanbanPing, onKanbanPing } from "./network.js";
import { playClickSound, playCardDoneSound } from "./audio.js";

const panel = document.getElementById("kanban-panel");
const tabsRow = document.getElementById("kanban-tabs");
const columnsBox = document.getElementById("kanban-columns");
const editor = document.getElementById("kanban-editor");

const COLUMNS = [
  ["todo", "To do", "#e0a84c"],
  ["doing", "Doing", "#5aa0d8"],
  ["done", "Done", "#7ac07a"],
];
const LABELS = { "": "none", red: "#e8707a", orange: "#f0a060", yellow: "#f2d06a", green: "#8fc27a", blue: "#6fa8dc", purple: "#a98ad8", pink: "#f0a0c8" };
const BOARD_KEY = "cozy-house-kanban-board"; // the board you last looked at

let state = { version: 0, jar: 0, boards: [] };
let showArchived = false;
let hooks = { color: () => "#999999", post: () => {}, confirm: async () => true, notice: () => {} };

let currentId = null;
try {
  currentId = localStorage.getItem(BOARD_KEY);
} catch {
  // Storage blocked: start on the first board.
}

// --- Keeping up to date ---
export function startKanban(options) {
  hooks = options;
  refresh();
  setInterval(refresh, 15_000);
  onKanbanPing(refresh);
}

async function refresh() {
  try {
    apply(await serverApi("GET", "/api/kanban"));
  } catch {
    // Offline for a moment, or not logged in: try again next time.
  }
}

function apply(next) {
  if (!next?.boards) return;
  state = next;
  globalThis.kanbanJar = state.jar; // the done jar on the workbench (render.js)
  const board = currentBoard();
  globalThis.kanbanView = {
    columns: COLUMNS.map(([col]) => (board?.cards ?? []).filter((c) => c.column === col).map((c) => c.claimColor || (c.label && LABELS[c.label]) || "#fff2a8")),
  };
  if (!panel.hidden) render();
}

const visibleBoards = () => state.boards.filter((b) => showArchived || !b.archived);

function currentBoard() {
  const boards = state.boards.filter((b) => !b.archived || showArchived);
  return boards.find((b) => b.id === currentId) || state.boards.find((b) => !b.archived) || boards[0] || null;
}

function choose(id) {
  currentId = id;
  try {
    localStorage.setItem(BOARD_KEY, id);
  } catch {
    // Storage blocked: fine.
  }
  apply(state);
}

// Sends one change to the server, then shows the result, nudges friends,
// and posts in the house chat when a card is added or finished.
async function act(body) {
  try {
    const next = await serverApi("POST", "/api/kanban", body);
    apply(next);
    sendKanbanPing();
    const result = next.result ?? {};
    if (result.added) hooks.post(`📝 ${accountName()} added "${result.added}" to ${result.board}.`, { kind: "added", title: result.added, board: result.board });
    if (result.finished) {
      playCardDoneSound();
      hooks.post(`✅ ${result.claimedBy || accountName()} finished "${result.finished}"!`, { kind: "done", title: result.finished, who: result.claimedBy || accountName() });
    }
    return next;
  } catch (err) {
    hooks.notice(err.message);
    return null;
  }
}

// Names of people with a card in Doing (they get a little hammer over
// their head while they're in the Workshop).
export function busyBuilders() {
  const names = new Set();
  for (const board of state.boards) {
    if (board.archived) continue;
    for (const card of board.cards) if (card.column === "doing" && card.claimedBy) names.add(card.claimedBy.toLowerCase());
  }
  return names;
}

// --- The overlay ---
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// A thumbtack with a tiny face in the claimer's color.
function faceTack(color, name) {
  const c = el("canvas", "kanban-tack");
  c.width = c.height = 24;
  c.title = `Claimed by ${name}`;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(40, 25, 10, 0.25)";
  ctx.beginPath();
  ctx.arc(13, 14, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(12, 12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(9, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(9, 12, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, 12, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(12, 14, 2.5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  return c;
}

function dueText(due) {
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const late = date < today;
  return { text: date.toLocaleDateString([], { month: "short", day: "numeric" }), late };
}

function renderTabs(board) {
  tabsRow.innerHTML = "";
  for (const b of visibleBoards()) {
    const tab = el("button", "kanban-tab" + (b.id === board?.id ? " active" : "") + (b.archived ? " archived" : ""), b.name);
    tab.type = "button";
    tab.addEventListener("click", () => {
      choose(b.id);
      playClickSound();
    });
    tabsRow.appendChild(tab);
  }
  const add = el("button", "kanban-tab add", "+ New board");
  add.type = "button";
  add.addEventListener("click", async () => {
    const next = await act({ op: "addBoard", name: "New project" });
    if (next?.result?.board) {
      choose(next.result.board);
      startRename();
    }
  });
  tabsRow.appendChild(add);
  const tools = el("span", "kanban-tab-tools");
  if (board) {
    const rename = el("button", "kanban-icon", "✎");
    rename.type = "button";
    rename.title = "Rename this board";
    rename.addEventListener("click", startRename);
    const archive = el("button", "kanban-icon", board.archived ? "📤" : "🗄️");
    archive.type = "button";
    archive.title = board.archived ? "Bring this board back" : "Archive this board (it's kept, just tucked away)";
    archive.addEventListener("click", async () => {
      if (!board.archived && !(await hooks.confirm({ title: `Archive "${board.name}"?`, text: "It's tucked away, not deleted. You can bring it back from the archived boards.", yes: "Archive it", no: "Keep it" }))) return;
      await act({ op: "archiveBoard", board: board.id, archived: !board.archived });
    });
    tools.append(rename, archive);
  }
  const archivedCount = state.boards.filter((b) => b.archived).length;
  if (archivedCount) {
    const toggle = el("button", "kanban-icon wide", showArchived ? "Hide archived" : `Archived (${archivedCount})`);
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      showArchived = !showArchived;
      playClickSound();
      render();
    });
    tools.appendChild(toggle);
  }
  tabsRow.appendChild(tools);
}

// Renaming: the active tab turns into a text box.
function startRename() {
  const board = currentBoard();
  const tab = tabsRow.querySelector(".kanban-tab.active");
  if (!board || !tab) return;
  const input = el("input", "kanban-rename");
  input.type = "text";
  input.value = board.name;
  input.maxLength = 30;
  tab.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    if (save && input.value.trim() && input.value.trim() !== board.name) await act({ op: "renameBoard", board: board.id, name: input.value });
    else render();
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

let dragged = null; // the card being dragged

function cardElement(card) {
  const node = el("div", "kanban-card" + (card.claimedBy === accountName() ? " mine" : ""));
  node.draggable = true;
  node.dataset.id = card.id;
  node.style.setProperty("--label", (card.label && LABELS[card.label]) || "transparent");
  if (card.claimedBy) node.appendChild(faceTack(card.claimColor || "#999999", card.claimedBy));
  node.appendChild(el("div", "kanban-card-title", card.title));
  const meta = el("div", "kanban-card-meta");
  if (card.due) {
    const { text, late } = dueText(card.due);
    meta.appendChild(el("span", "kanban-chip" + (late && card.column !== "done" ? " late" : ""), `📅 ${text}`));
  }
  if (card.link) {
    const link = el("a", "kanban-chip link", "🔗 link");
    link.href = card.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.addEventListener("click", (e) => e.stopPropagation());
    meta.appendChild(link);
  }
  if (card.claimedBy) meta.appendChild(el("span", "kanban-chip who", card.claimedBy));
  if (meta.children.length) node.appendChild(meta);
  if (card.note) node.appendChild(el("div", "kanban-card-note", card.note));
  const edit = el("button", "kanban-card-edit", "✎");
  edit.type = "button";
  edit.title = "Edit";
  edit.addEventListener("click", (e) => {
    e.stopPropagation();
    openEditor(card);
  });
  node.appendChild(edit);
  node.title = card.claimedBy === accountName() ? "Click to let go of this card" : card.claimedBy ? `${card.claimedBy} is on this one. Click to take it.` : "Click to claim this card";
  // Click: claim it (or let go). Drag: move it to another column.
  node.addEventListener("click", () => {
    playClickSound();
    act({ op: "claimCard", card: card.id, color: hooks.color() });
  });
  node.addEventListener("dragstart", (e) => {
    dragged = card.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    requestAnimationFrame(() => node.classList.add("dragging"));
  });
  node.addEventListener("dragend", () => {
    dragged = null;
    node.classList.remove("dragging");
  });
  return node;
}

function render() {
  const board = currentBoard();
  renderTabs(board);
  columnsBox.innerHTML = "";
  if (!board) {
    columnsBox.appendChild(el("p", "kanban-empty", "No boards yet. Make one with \"+ New board\"!"));
    return;
  }
  for (const [col, name, color] of COLUMNS) {
    const cards = board.cards.filter((c) => c.column === col);
    const column = el("section", "kanban-column");
    column.style.setProperty("--col", color);
    const head = el("header", "kanban-column-head");
    head.append(el("span", "", name), el("span", "kanban-count", String(cards.length)));
    column.appendChild(head);
    if (col === "todo") {
      // Quick add: type a title, press Enter.
      const add = el("input", "kanban-add");
      add.type = "text";
      add.placeholder = "Add a card, press Enter";
      add.maxLength = 80;
      add.addEventListener("keydown", async (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && add.value.trim()) {
          const title = add.value;
          add.value = "";
          await act({ op: "addCard", board: board.id, title });
          columnsBox.querySelector(".kanban-add")?.focus();
        }
        if (e.key === "Escape") add.blur();
      });
      column.appendChild(add);
    }
    const list = el("div", "kanban-list");
    for (const card of cards) list.appendChild(cardElement(card));
    if (!cards.length) list.appendChild(el("p", "kanban-hint", col === "done" ? "Finished cards land here." : col === "doing" ? "Drag a card here when you start it." : "Nothing to do. Nice!"));
    // Dropping a card: it goes before the card under the pointer (or at the end).
    list.addEventListener("dragover", (e) => {
      if (!dragged) return;
      e.preventDefault();
      column.classList.add("drop");
    });
    list.addEventListener("dragleave", () => column.classList.remove("drop"));
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("drop");
      if (!dragged) return;
      const others = [...list.querySelectorAll(".kanban-card:not(.dragging)")];
      const below = others.find((n) => e.clientY < n.getBoundingClientRect().top + n.offsetHeight / 2);
      act({ op: "moveCard", card: dragged, column: col, before: below?.dataset.id });
    });
    column.appendChild(list);
    columnsBox.appendChild(column);
  }
}

// --- Editing a card: title, color label, due date, note, link ---
let editing = null;
function openEditor(card) {
  editing = card;
  editor.hidden = false;
  editor.querySelector("#kanban-edit-title").value = card.title;
  editor.querySelector("#kanban-edit-due").value = card.due || "";
  editor.querySelector("#kanban-edit-note").value = card.note || "";
  editor.querySelector("#kanban-edit-link").value = card.link || "";
  const labels = editor.querySelector("#kanban-edit-labels");
  labels.innerHTML = "";
  for (const [name, color] of Object.entries(LABELS)) {
    const swatch = el("button", "kanban-label" + ((card.label || "") === name ? " chosen" : "") + (name ? "" : " none"));
    swatch.type = "button";
    swatch.dataset.label = name;
    swatch.title = name || "No label";
    if (name) swatch.style.background = color;
    swatch.addEventListener("click", () => {
      labels.querySelectorAll(".kanban-label").forEach((s) => s.classList.toggle("chosen", s === swatch));
    });
    labels.appendChild(swatch);
  }
  editor.querySelector("#kanban-edit-title").focus();
}

function closeEditor() {
  editor.hidden = true;
  editing = null;
}

editor.addEventListener("keydown", (e) => {
  e.stopPropagation(); // typing here isn't walking
  if (e.key === "Escape") closeEditor();
});
editor.querySelector("#kanban-edit-save").addEventListener("click", async () => {
  if (!editing) return;
  const card = editing;
  closeEditor();
  await act({
    op: "editCard",
    card: card.id,
    title: editor.querySelector("#kanban-edit-title").value,
    label: editor.querySelector(".kanban-label.chosen")?.dataset.label ?? "",
    due: editor.querySelector("#kanban-edit-due").value,
    note: editor.querySelector("#kanban-edit-note").value,
    link: editor.querySelector("#kanban-edit-link").value,
  });
});
editor.querySelector("#kanban-edit-delete").addEventListener("click", async () => {
  if (!editing) return;
  const card = editing;
  if (!(await hooks.confirm({ title: "Delete this card?", text: `"${card.title}" will be gone for everyone.`, yes: "Delete it", no: "Keep it" }))) return;
  closeEditor();
  await act({ op: "deleteCard", card: card.id });
});
editor.querySelector("#kanban-edit-cancel").addEventListener("click", closeEditor);

export function openKanban() {
  panel.hidden = false;
  render();
  playClickSound();
  refresh();
}

export function closeKanban() {
  closeEditor();
  panel.hidden = true;
}

export function isKanbanOpen() {
  return !panel.hidden;
}

document.getElementById("kanban-close").addEventListener("click", () => {
  closeKanban();
  playClickSound();
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || panel.hidden) return;
  if (!editor.hidden) closeEditor();
  else closeKanban();
});
