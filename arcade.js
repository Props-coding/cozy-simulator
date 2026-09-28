// The Arcade (Update 9), on the Games floor: solo cabinets you can play
// any time (even when nobody else is on), tickets for your score, a high
// score board for each cabinet, the prize counter (arcade-only prizes, or
// tickets into crumbs), the claw machine and the capsule machine. The
// house server decides everything that counts: tickets (checked against
// how long you played), prizes, the claw and the capsules (see
// config.js arcade).
import { bank, myWallet } from "./bank.js";
import { serverApi } from "./account.js";
import { openNpc } from "./npc.js";
import { playClickSound, playCrumbSound, playAchievementSound } from "./audio.js";
import { openExtrasPanel } from "./extras.js";

let hooks = { notice: () => {} };
export function initArcade(options) {
  hooks = { ...hooks, ...options };
}

const A = () => CONFIG.arcade;
const gameInfo = (id) => A().games.find((g) => g.id === id);
const make = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

// --- The cabinets ---
let running = null; // the game being played: { stop() }

export function openCabinet(f) {
  const game = gameInfo(f.game);
  if (!game) return;
  openExtrasPanel(game.name, (el) => {
    const top = make("div", "arcade-top");
    top.append(make("p", "tv-small", game.how), make("span", "arcade-tickets", `${myWallet().arcade?.tickets ?? 0} tickets`));
    const screen = make("canvas", "arcade-screen");
    screen.width = 320;
    screen.height = 240;
    screen.tabIndex = 0;
    const row = make("div", "book-top");
    const start = make("button", "warm-button", "Start");
    start.type = "button";
    const board = make("ol", "arcade-board");
    row.append(start, make("span", "tv-small", "High scores"));
    el.append(top, screen, row, board);
    showBoard(board, game.id);
    drawAttract(screen, game);
    start.addEventListener("click", () => {
      playClickSound();
      start.disabled = true;
      play(game, screen, (result) => {
        start.disabled = false;
        start.textContent = "Play again";
        top.querySelector(".arcade-tickets").textContent = `${myWallet().arcade?.tickets ?? 0} tickets`;
        if (result) showBoard(board, game.id, result.board);
      });
    });
  }, stopArcadeGame);
}

// The title screen, before you press Start.
function drawAttract(canvas, game) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14121e";
  ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = "#f2d45c";
  ctx.font = "700 22px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(game.name.toUpperCase(), 160, 110);
  ctx.fillStyle = "#9ff5ea";
  ctx.font = "600 12px 'Quicksand', sans-serif";
  ctx.fillText("Press Start", 160, 140);
  ctx.textAlign = "left";
}

async function showBoard(list, id, fresh = null) {
  const boards = fresh ? { [id]: fresh } : (await serverApi("GET", "/api/arcade/scores").catch(() => null))?.boards ?? {};
  list.textContent = "";
  const rows = boards[id] ?? [];
  if (!rows.length) list.appendChild(make("p", "tv-small", "No scores yet. Be the first!"));
  for (const r of rows.slice(0, 5)) list.appendChild(make("li", "", `${r.name}  ${r.score}`));
}

// Plays one game on the canvas; `done(result)` at the end (result: what
// the house server said, or null if it couldn't be reached).
async function play(game, canvas, done) {
  running?.stop();
  const started = await bank("arcadeStart", { game: game.id });
  canvas.focus();
  const finish = async (score) => {
    running = null;
    let result = null;
    if (started?.id) result = await bank("arcadeEnd", { id: started.id, score });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(20, 18, 30, 0.8)";
    ctx.fillRect(0, 80, 320, 80);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f2d45c";
    ctx.font = "700 20px 'Quicksand', sans-serif";
    ctx.fillText(`GAME OVER  ·  ${result?.score ?? score}`, 160, 115);
    ctx.fillStyle = "#9ff5ea";
    ctx.font = "600 13px 'Quicksand', sans-serif";
    ctx.fillText(result ? `+${result.tickets} tickets${result.top ? "  ·  NEW HIGH SCORE!" : ""}` : "(no tickets: the house server didn't answer)", 160, 140);
    ctx.textAlign = "left";
    if (result?.top) playAchievementSound();
    else if (result?.tickets) playCrumbSound();
    done(result);
  };
  running = game.id === "snake" ? snake(canvas, finish) : mothCatcher(canvas, finish);
}

// Keys held down on the cabinet's screen (it has the focus while you play).
function keyReader(canvas) {
  const down = new Set();
  const on = (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(k)) e.preventDefault();
    down.add(k);
  };
  const off = (e) => down.delete(e.key.toLowerCase());
  canvas.addEventListener("keydown", on);
  canvas.addEventListener("keyup", off);
  return { down, stop: () => (canvas.removeEventListener("keydown", on), canvas.removeEventListener("keyup", off)) };
}

// Crumb Snake: steer round a 16 by 12 board, eat crumbs, grow; biting your
// tail or the wall ends it. Speeds up a little with every crumb.
function snake(canvas, finish) {
  const ctx = canvas.getContext("2d");
  const W = 16, H = 12, C = 20;
  let body = [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
  let dir = { x: 1, y: 0 }, next = dir;
  let crumb = { x: 11, y: 6 };
  let score = 0, alive = true, last = performance.now(), frame = 0;
  const keys = keyReader(canvas);
  const turn = (e) => {
    const k = e.key.toLowerCase();
    const want = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
    if (want && !(want[0] === -dir.x && want[1] === -dir.y)) next = { x: want[0], y: want[1] };
  };
  canvas.addEventListener("keydown", turn);
  const placeCrumb = () => {
    do crumb = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
    while (body.some((p) => p.x === crumb.x && p.y === crumb.y));
  };
  const draw = () => {
    ctx.fillStyle = "#14121e";
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if ((x + y) % 2) ctx.fillRect(x * C, y * C, C, C);
    ctx.fillStyle = "#e8b84a"; // the crumb
    ctx.beginPath();
    ctx.arc(crumb.x * C + 10, crumb.y * C + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c98f3c";
    ctx.fillRect(crumb.x * C + 8, crumb.y * C + 7, 2, 2);
    body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#9ff5ea" : i % 2 ? "#5fc8b8" : "#6fd8c8";
      ctx.fillRect(p.x * C + 2, p.y * C + 2, C - 4, C - 4);
    });
    ctx.fillStyle = "#f2d45c";
    ctx.font = "700 12px monospace";
    ctx.fillText(`SCORE ${score}`, 8, 16);
  };
  const loop = (now) => {
    if (!alive) return;
    const step = Math.max(70, 150 - score * 4);
    if (now - last >= step) {
      last = now;
      dir = next;
      const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H || body.some((p) => p.x === head.x && p.y === head.y)) {
        alive = false;
        keys.stop();
        canvas.removeEventListener("keydown", turn);
        draw();
        return finish(score);
      }
      body.unshift(head);
      if (head.x === crumb.x && head.y === crumb.y) {
        score++;
        placeCrumb();
      } else body.pop();
      draw();
    }
    frame = requestAnimationFrame(loop);
  };
  draw();
  frame = requestAnimationFrame(loop);
  return {
    stop() {
      alive = false;
      cancelAnimationFrame(frame);
      keys.stop();
      canvas.removeEventListener("keydown", turn);
    },
  };
}

// Moth Catcher: slide the jar left and right; catch the moths, let the
// leaves fall (three leaves in the jar and it's over), 45 seconds.
function mothCatcher(canvas, finish) {
  const ctx = canvas.getContext("2d");
  const keys = keyReader(canvas);
  let jar = 160, score = 0, lives = 3, alive = true, frame = 0;
  const things = [];
  const began = performance.now();
  let last = began, nextDrop = began;
  const draw = (now) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, "#1a1a30");
    sky.addColorStop(1, "#2e2a44");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 320, 240);
    const glow = ctx.createRadialGradient(160, 10, 2, 160, 10, 90);
    glow.addColorStop(0, "rgba(255, 220, 150, 0.45)");
    glow.addColorStop(1, "rgba(255, 220, 150, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 320, 120);
    for (const t of things) {
      if (t.moth) {
        const flap = Math.abs(Math.sin(now / 60 + t.x));
        ctx.fillStyle = "#e6d6c8";
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(t.x + d * 4, t.y, 5, 2 + flap * 3, d * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#6e5a6e";
        ctx.fillRect(t.x - 1, t.y - 3, 2, 6);
      } else {
        ctx.fillStyle = "#d9822b";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y, 6, 3.5, t.x, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The jar.
    ctx.fillStyle = "rgba(200, 230, 240, 0.5)";
    ctx.fillRect(jar - 18, 206, 36, 28);
    ctx.strokeStyle = "#cfe6ee";
    ctx.lineWidth = 2;
    ctx.strokeRect(jar - 18, 206, 36, 28);
    ctx.fillStyle = "#8a6444";
    ctx.fillRect(jar - 20, 202, 40, 5);
    ctx.fillStyle = "#f2d45c";
    ctx.font = "700 12px monospace";
    ctx.fillText(`SCORE ${score}   ${"♥".repeat(lives)}   ${Math.max(0, Math.ceil(45 - (now - began) / 1000))}s`, 8, 16);
  };
  const loop = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (keys.down.has("arrowleft") || keys.down.has("a")) jar = Math.max(20, jar - 220 * dt);
    if (keys.down.has("arrowright") || keys.down.has("d")) jar = Math.min(300, jar + 220 * dt);
    const elapsed = (now - began) / 1000;
    if (now >= nextDrop) {
      things.push({ x: 15 + Math.random() * 290, y: -8, v: 55 + elapsed * 2 + Math.random() * 30, moth: Math.random() < 0.72 });
      nextDrop = now + Math.max(320, 900 - elapsed * 14);
    }
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i];
      t.y += t.v * dt;
      if (t.moth) t.x += Math.sin(now / 300 + i) * 20 * dt;
      if (t.y > 200 && t.y < 214 && Math.abs(t.x - jar) < 20) {
        things.splice(i, 1);
        if (t.moth) score++;
        else lives--;
      } else if (t.y > 250) things.splice(i, 1);
    }
    draw(now);
    if (lives <= 0 || elapsed >= 45) {
      alive = false;
      keys.stop();
      return finish(score);
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return {
    stop() {
      alive = false;
      cancelAnimationFrame(frame);
      keys.stop();
    },
  };
}

// (Closing the panel stops whatever's playing.)
function stopArcadeGame() {
  running?.stop();
  running = null;
}

// --- The prize counter ---
const prizeName = (p) => (p.decor ? DECOR[p.decor]?.name : SHOP_CATALOG.find((i) => i.id === p.owned)?.name) ?? p.id;

export function openPrizeCounter() {
  openNpc({
    name: "Prize counter",
    portrait: { f: "prizeCounter", w: 3.6, h: 0.9 },
    color: "#8a6ab0",
    pitch: 470,
    hello: ["(a sign on the counter: \"tickets only. no haggling. the frog is not for eating.\")", "(behind the glass: plushies, a crown, and a tiny arcade cabinet that really lights up.)"],
    tabs: [
      {
        id: "prizes",
        label: "Prizes",
        items: () =>
          A().prizes.map((p) => {
            const have = p.owned && myWallet().owned.includes(p.owned);
            const tickets = myWallet().arcade?.tickets ?? 0;
            return {
              icon: p.decor ? `decor:${p.decor}` : undefined,
              name: prizeName(p) + (have ? " (yours)" : ""),
              note: `${p.tickets} tickets. You have ${tickets}.`,
              actions: have
                ? []
                : [
                    {
                      label: "Get it",
                      disabled: tickets < p.tickets,
                      run: async () => {
                        if (!(await bank("arcadePrize", { id: p.id }))) return null;
                        playAchievementSound();
                        return p.decor ? `(the ${prizeName(p).toLowerCase()} is yours. it'll be in your room's decorating box.)` : "(the crown fits perfectly. try it on in your wardrobe.)";
                      },
                    },
                  ],
            };
          }),
      },
      {
        id: "cash",
        label: "Tickets into crumbs",
        items: () => {
          const w = myWallet().arcade ?? {};
          const left = A().crumbsPerDay - (w.cashed ?? 0);
          const can = Math.min(left, Math.floor((w.tickets ?? 0) / A().ticketsPerCrumb));
          return [
            {
              name: `${A().ticketsPerCrumb} tickets make a crumb`,
              note: `You have ${w.tickets ?? 0} tickets. Up to ${A().crumbsPerDay} crumbs a day (${Math.max(0, left)} left today).`,
              actions: [
                {
                  label: can > 0 ? `Cash in for ${can}` : "Cash in",
                  disabled: can <= 0,
                  run: async () => {
                    const got = await bank("arcadeCashIn");
                    if (!got) return null;
                    playCrumbSound();
                    return `(${got.crumbs} crumbs, counted out in tiny paper cups.)`;
                  },
                },
              ],
            },
          ];
        },
      },
      { id: "pins", label: "Your pins", items: pinRows, empty: "No pins yet. The capsule machine has eight to collect." },
    ],
  });
}

function pinRows() {
  const mine = myWallet().arcade?.pins ?? {};
  return A().capsule.pins.map((p) => ({
    icon: undefined,
    name: mine[p.id] ? `${p.name}${mine[p.id] > 1 ? ` × ${mine[p.id]}` : ""}` : "???",
    note: mine[p.id] ? "On your jacket, in spirit." : "Still in a capsule somewhere.",
    locked: !mine[p.id],
  }));
}

// --- The claw machine ---
export async function useClaw() {
  const got = await bank("arcadeClaw");
  if (!got) return;
  playClickSound();
  if (!got.won) return hooks.notice(pickLine(["The claw grabs... and lets go. Of course it does.", "So close! It slipped right out of the claw.", "The claw gives the plushie a gentle pat and leaves it there."]));
  playAchievementSound();
  hooks.notice(`You won a ${DECOR[got.got.slice(6)]?.name.toLowerCase() ?? "plush"}! It's in your room's decorating box.`, 7000);
}

// --- The capsule machine ---
export async function useCapsule() {
  const got = await bank("arcadeCapsule");
  if (!got) return;
  playCrumbSound();
  const pin = A().capsule.pins.find((p) => p.id === got.pin);
  hooks.notice(`Clunk! A capsule rolls out: the ${pin?.name ?? "pin"}${got.fresh ? " (new!)" : " (a spare)"}.`, 6000);
}

const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];
