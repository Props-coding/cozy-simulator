// Part of the house's drawing code (see render.js for how the pieces fit
// together): name tags, room signs, door tags, lights, the lawn and rain,
// decorating helpers, and drawing a whole frame (drawScene).

// Name tag and optional badge (like "sleeping"). Drawn in a last pass so
// they stay readable even when the player is behind furniture or a wall.
// How far each player's name tag is lifted to clear their hat right now
// (eased, so it glides when they change hats). Keyed by player id.
const tagLifts = {};
let lastTagTime = performance.now();

// How much to lift a name tag for a hat: the name normally has 8 pixels
// of room above the head, so only hats taller than that (plus a small
// gap, which also covers the little bob while walking) push it up. Hat
// heights come from shop.js.
function tagLiftFor(hat) {
  const height = hat === "hood" ? 8 : globalThis.hatHeights?.[hat] ?? 0; // (the Exalted robe's hood is 8 pixels tall)
  return Math.max(0, height + 5 - 8);
}

// How far each player's labels are pushed up this moment to stay clear of
// a nearby friend's labels (eased too, so tags glide apart and back
// together instead of jumping). Keyed by player id.
const tagStacks = {};

// Where each player's labels go this frame. Normally right above their
// head, but when two people stand close, their name tags (plus badge and
// speech bubble) would pile on top of each other. So we place them one
// by one, starting with whoever stands lowest on screen (the one in
// front), and if someone's labels would touch labels already placed,
// they're lifted just above them. Returns a list of { p, cx, headTop }.
function layoutPlayerTags(ctx, players) {
  const now = performance.now();
  const step = Math.min(1, ((now - lastTagTime) / 1000) * 10); // same easing speed for everyone
  lastTagTime = now;
  const tags = players.map((p) => {
    const foot = playerFeet(p);
    const target = Math.max(p.aura?.robe && !p.asleep ? tagLiftFor("hood") : tagLiftFor(p.hat), p.umbrella ? UMBRELLA_LIFT : 0);
    const lift = (tagLifts[p.id] ??= target);
    tagLifts[p.id] = lift + (target - lift) * step;
    // The top of their head plus room for their hat. The name, badge, speech
    // bubbles and emotes all sit above this, so none of them cover the hat.
    const headTop = foot.y - PLAYER_RADIUS * 2 - 10 - tagLifts[p.id] - (p.seatLift ?? 0);
    // How wide and tall their labels are, measured the same way they're drawn.
    ctx.font = "600 11px 'Quicksand', sans-serif";
    let width = ctx.measureText(p.name).width + 12 + (p.admin ? (isHouseOwner(p.name) ? 15 : 13) : 0); // (as in drawPlayerTag)
    let height = 18; // just the name tag
    if (p.title) {
      // (A title adds a line under the name tag, and lifts the rest.)
      ctx.font = "italic 700 9px 'Quicksand', sans-serif";
      width = Math.max(width, ctx.measureText(p.title).width + 10);
      height += 11;
    }
    if (p.badge) {
      ctx.font = "13px sans-serif";
      width = Math.max(width, ctx.measureText(p.badge).width + 16);
      height = 40 + (p.title ? 11 : 0);
    }
    if (p.bubble || p.typing) {
      ctx.font = "600 12px 'Quicksand', sans-serif";
      const bubbleWidth = p.bubble ? ctx.measureText(clipText(p.bubble, 34, "…")).width + 18 : 34;
      width = Math.max(width, bubbleWidth);
      height = (p.badge ? 46 : 26) + 22 + (p.title ? 11 : 0);
    }
    return { p, cx: foot.x, headTop, width, height, top: headTop };
  });

  // Front to back: the person lowest on screen keeps their spot.
  tags.sort((a, b) => b.headTop - a.headTop);
  const GAP = 2; // pixels between stacked labels
  const placed = [];
  for (const t of tags) {
    // The labels run from (top - height) down to (top - 4), the bottom of
    // the name tag. Keep lifting until nothing already placed is in the way.
    let bumped = true;
    while (bumped) {
      bumped = false;
      for (const o of placed) {
        const sideBySide = Math.abs(t.cx - o.cx) >= (t.width + o.width) / 2 + GAP;
        const clear = t.top - 4 + GAP <= o.top - o.height || t.top - t.height >= o.top - 4 + GAP;
        if (!sideBySide && !clear) {
          t.top = o.top - o.height - GAP + 4; // sit just above their labels
          bumped = true;
        }
      }
    }
    placed.push(t);
  }

  // Kept inside the map's edges (someone right at the edge still has their
  // whole name showing).
  const edge = houseBounds();
  return tags.map((t) => {
    const target = t.top - t.headTop; // 0, or how far up it had to go
    const stack = (tagStacks[t.p.id] ??= target);
    tagStacks[t.p.id] = stack + (target - stack) * step;
    const cx = Math.min(Math.max(t.cx, edge.left + t.width / 2 + 4), edge.right - t.width / 2 - 4);
    const headTop = Math.max(t.headTop + tagStacks[t.p.id], edge.top + t.height + 4);
    return { p: t.p, cx, headTop };
  });
}

// Draws one player's labels at the spot layoutPlayerTags picked.
function drawPlayerTag(ctx, { p, cx, headTop }) {

  // A title (like "the Scholar") sits just under the name tag, so the tag,
  // and everything above it, moves up to make room.
  if (p.title) {
    ctx.font = "italic 700 9px 'Quicksand', sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(p.title).width + 10;
    ctx.fillStyle = "rgba(255, 250, 238, 0.75)";
    roundRectPath(ctx, cx - w / 2, headTop - 13, w, 11, 5.5);
    ctx.fill();
    ctx.fillStyle = "#8a5a1e";
    ctx.fillText(p.title, cx, headTop - 4.5);
    headTop -= 11;
  }

  // (Emotes and whispers are placed around the head, so they don't move.)
  const bodyTop = headTop + (p.title ? 11 : 0);
  if (p.emote) drawEmoteFloaters(ctx, p, cx, bodyTop);
  if (p.whisper) drawWhisperSwirl(ctx, cx, bodyTop, p.whisper.dir);

  ctx.font = "600 11px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  // Admins get a little badge before their name (checked with the server's
  // signature, see checkBadge in account.js). The house owner gets a gold
  // crown instead, on a warm golden name tag.
  const owner = p.admin && isHouseOwner(p.name);
  const badgeWidth = owner ? 15 : p.admin ? 13 : 0;
  const tagWidth = ctx.measureText(p.name).width + 12 + badgeWidth;
  ctx.fillStyle = owner ? "rgba(255, 244, 205, 0.92)" : "rgba(255, 255, 255, 0.7)";
  roundRectPath(ctx, cx - tagWidth / 2, headTop - 18, tagWidth, 14, 7);
  ctx.fill();
  if (owner) {
    ctx.strokeStyle = "#d4a02a";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = owner ? "#6b4a0e" : "#333";
  ctx.fillText(p.name, cx + badgeWidth / 2, headTop - 7.5);
  if (owner) {
    drawCreatorCrown(ctx, cx - tagWidth / 2 + 11, headTop - 6.5, 1);
  } else if (p.admin) {
    ctx.font = "9px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
    ctx.fillText(CONFIG.adminBadge, cx - tagWidth / 2 + 10, headTop - 7.5);
  }

  if (p.badge) {
    ctx.font = "13px sans-serif";
    const badgeWidth = ctx.measureText(p.badge).width + 16;
    roundRectPath(ctx, cx - badgeWidth / 2, headTop - 40, badgeWidth, 17, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(p.badge, cx, headTop - 27);
  }

  // While they're typing (and haven't just said something): a little
  // bubble with three dots bouncing one after another.
  if (p.typing && !p.bubble) {
    const bottom = headTop - (p.badge ? 46 : 26);
    const w = 34, h = 18, t = performance.now() / 1000;
    ctx.fillStyle = "rgba(40, 25, 10, 0.15)";
    roundRectPath(ctx, cx - w / 2 + 1, bottom - h + 2, w, h, 9);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, cx - w / 2, bottom - h, w, h, 9);
    ctx.fill();
    ctx.beginPath(); // little tail pointing down at them
    ctx.moveTo(cx - 4, bottom - 1);
    ctx.lineTo(cx + 4, bottom - 1);
    ctx.lineTo(cx, bottom + 4);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const hop = Math.max(0, Math.sin(t * 6 - i * 0.9)) * 3;
      ctx.fillStyle = "#b39c7a";
      ctx.beginPath();
      ctx.arc(cx - 8 + i * 8, bottom - h / 2 - hop, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Speech bubble for a recent chat message, above the name (and badge).
  if (p.bubble) {
    ctx.font = "600 12px 'Quicksand', sans-serif";
    const text = clipText(p.bubble, 34, "…");
    const w = ctx.measureText(text).width + 18, h = 22;
    const bottom = headTop - (p.badge ? 46 : 26);
    ctx.fillStyle = "rgba(40, 25, 10, 0.15)";
    roundRectPath(ctx, cx - w / 2 + 1, bottom - h + 2, w, h, 10);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    roundRectPath(ctx, cx - w / 2, bottom - h, w, h, 10);
    ctx.fill();
    ctx.beginPath(); // little tail pointing down at the speaker
    ctx.moveTo(cx - 5, bottom - 1);
    ctx.lineTo(cx + 5, bottom - 1);
    ctx.lineTo(cx, bottom + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4a3a2c";
    ctx.fillText(text, cx, bottom - 7);
  }
  ctx.textAlign = "left";
}

// A room's sign: a little wooden board hanging over its doorway, all the
// same size. It shows the room's icon (CONFIG.roomIcons), or for an office
// or bedroom its owner's name. Drawn in the same front-to-back order as
// the wall, so people walk in front of or behind it like any wall.
const SIGN_W = 40, SIGN_H = 22;

// Where a room's sign hangs: its middle, in screen pixels.
function signCenter(room) {
  const p = toScreen(room.sign.x, room.sign.y + WALL_THICKNESS / 2); // the wall's front edge
  return { x: p.x, y: p.y - WALL_HEIGHT + 6 };
}

function drawRoomSign(ctx, room) {
  const c = signCenter(room);
  const x = c.x - SIGN_W / 2, y = c.y - SIGN_H / 2;
  ctx.fillStyle = "rgba(40, 25, 10, 0.3)"; // soft shadow on the wall behind
  roundRectPath(ctx, x + 1, y + 3, SIGN_W, SIGN_H, 5);
  ctx.fill();
  roundRectPath(ctx, x, y, SIGN_W, SIGN_H, 5);
  ctx.fillStyle = "#8a5a3c";
  ctx.fill();
  ctx.fillStyle = "rgba(255, 235, 200, 0.18)"; // lit from above
  ctx.fillRect(x + 3, y + 1.5, SIGN_W - 6, 2);
  roundRectPath(ctx, x + 2.5, y + 2.5, SIGN_W - 5, SIGN_H - 5, 3);
  ctx.strokeStyle = "#c9955f";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = "center";
  if (room.owned) {
    // A nameplate: the owner's name, shrunk to fit if it's long.
    let size = 10;
    do {
      ctx.font = `700 ${size}px 'Quicksand', sans-serif`;
    } while (ctx.measureText(room.owned.ownerName).width > SIGN_W - 9 && --size > 6);
    ctx.fillStyle = "#f3e6d0";
    ctx.fillText(room.owned.ownerName, c.x, c.y + size / 2 - 1, SIGN_W - 9);
  } else {
    const icon = CONFIG.roomIcons?.[room.id] || "door";
    ctx.fillStyle = ctx.strokeStyle = "#f3e6d0";
    if (Object.hasOwn(SIGN_ICONS, icon)) SIGN_ICONS[icon](ctx, c.x, c.y);
    else {
      ctx.font = "13px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      ctx.fillText(icon, c.x, c.y + 5);
    }
  }
  ctx.textAlign = "left";
}

// Little cream icons for door signs, each drawn around (cx, cy) in about
// a 16 by 14 pixel box, like they were burned into the wood.
const SIGN_ICONS = {
  film(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c"; // the reel's holes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 3.6, cy + Math.sin(a) * 3.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f3e6d0";
    ctx.fillRect(cx + 4, cy + 5, 6, 1.6); // film trailing off
  },
  pencil(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillRect(-7, -2, 10, 4);
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(7.5, 0);
    ctx.lineTo(3, 2);
    ctx.fill();
    ctx.fillStyle = "#e8a0a0"; // eraser
    ctx.fillRect(-9, -2, 2, 4);
    ctx.restore();
  },
  books(ctx, cx, cy) {
    ctx.fillRect(cx - 7, cy - 5, 3.5, 11);
    ctx.fillRect(cx - 2.5, cy - 7, 3.5, 13);
    ctx.save();
    ctx.translate(cx + 3, cy + 6);
    ctx.rotate(0.3);
    ctx.fillRect(0, -11, 3.5, 11); // one leaning over
    ctx.restore();
  },
  openBook(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.quadraticCurveTo(cx - 4, cy - 6, cx - 8, cy - 5);
    ctx.lineTo(cx - 8, cy + 5);
    ctx.quadraticCurveTo(cx - 4, cy + 4, cx, cy + 6);
    ctx.quadraticCurveTo(cx + 4, cy + 4, cx + 8, cy + 5);
    ctx.lineTo(cx + 8, cy - 5);
    ctx.quadraticCurveTo(cx + 4, cy - 6, cx, cy - 3);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 0.5, cy - 3, 1, 9);
  },
  lamp(ctx, cx, cy) {
    ctx.beginPath(); // the shade
    ctx.moveTo(cx - 3.5, cy - 7);
    ctx.lineTo(cx + 3.5, cy - 7);
    ctx.lineTo(cx + 6.5, cy - 1);
    ctx.lineTo(cx - 6.5, cy - 1);
    ctx.fill();
    ctx.fillRect(cx - 0.8, cy - 1, 1.6, 6);
    ctx.fillRect(cx - 4, cy + 5, 8, 2);
  },
  forkKnife(ctx, cx, cy) {
    for (const dx of [-6, -4, -2]) ctx.fillRect(cx + dx, cy - 7, 1.2, 5); // tines
    ctx.fillRect(cx - 6, cy - 3, 5.2, 1.6);
    ctx.fillRect(cx - 4.2, cy - 2, 1.6, 9);
    ctx.beginPath(); // the knife
    ctx.moveTo(cx + 3, cy - 7);
    ctx.quadraticCurveTo(cx + 7, cy - 4, cx + 5, cy + 1);
    ctx.lineTo(cx + 3, cy + 1);
    ctx.fill();
    ctx.fillRect(cx + 3, cy, 1.8, 7);
  },
  hammer(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.6);
    ctx.fillRect(-1.2, -3, 2.4, 11); // handle
    ctx.fillRect(-6, -7, 12, 4.5); // head
    ctx.fillRect(4, -7, 2.5, 2); // claw
    ctx.restore();
  },
  elevator(ctx, cx, cy) {
    ctx.fillRect(cx - 8, cy - 7, 10, 14); // two doors
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 3.5, cy - 7, 1, 14);
    ctx.fillStyle = "#f3e6d0";
    ctx.beginPath(); // up and down arrows
    ctx.moveTo(cx + 4, cy - 1.5);
    ctx.lineTo(cx + 9, cy - 1.5);
    ctx.lineTo(cx + 6.5, cy - 6);
    ctx.moveTo(cx + 4, cy + 1.5);
    ctx.lineTo(cx + 9, cy + 1.5);
    ctx.lineTo(cx + 6.5, cy + 6);
    ctx.fill();
  },
  stairs(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 6);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(cx - 8 + i * 4, cy + 6 - (i + 1) * 3);
      ctx.lineTo(cx - 8 + (i + 1) * 4, cy + 6 - (i + 1) * 3);
    }
    ctx.lineTo(cx + 8, cy + 6);
    ctx.closePath();
    ctx.fill();
  },
  gamepad(ctx, cx, cy) {
    roundRectPath(ctx, cx - 8, cy - 4.5, 16, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(cx - 5.5, cy - 0.7, 5, 1.4); // the d-pad
    ctx.fillRect(cx - 3.7, cy - 2.5, 1.4, 5);
    for (const [dx, dy] of [[3.5, -1], [5.5, 1]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  music(ctx, cx, cy) {
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy + 4, 3, 2.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 0.4, cy - 7, 1.6, 11);
    ctx.beginPath();
    ctx.moveTo(cx + 1.2, cy - 7);
    ctx.quadraticCurveTo(cx + 6, cy - 5, cx + 5, cy - 1);
    ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 1.2, cy - 4);
    ctx.fill();
  },
  heart(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6);
    ctx.bezierCurveTo(cx - 9, cy, cx - 5, cy - 8, cx, cy - 3);
    ctx.bezierCurveTo(cx + 5, cy - 8, cx + 9, cy, cx, cy + 6);
    ctx.fill();
  },
  leaf(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 6);
    ctx.quadraticCurveTo(cx - 6, cy - 6, cx + 7, cy - 6);
    ctx.quadraticCurveTo(cx + 6, cy + 5, cx - 6, cy + 6);
    ctx.fill();
  },
  moon(ctx, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.beginPath();
    ctx.arc(cx + 3.5, cy - 2.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
  },
  door(ctx, cx, cy) {
    roundRectPath(ctx, cx - 4.5, cy - 7, 9, 14, 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a3c";
    ctx.beginPath();
    ctx.arc(cx + 2, cy, 1, 0, Math.PI * 2);
    ctx.fill();
  },
};

// A room's full name fades in as a small tag under its sign while you're
// near its doorway, and fades out as you walk away.
const signFade = {}; // room id -> how visible its tag is (0 to 1)
let lastFadeTime = 0;
const NEAR_DOOR = 1.7; // grid units from the doorway

function drawDoorTags(ctx, me) {
  const now = performance.now();
  const step = Math.min(0.1, (now - lastFadeTime) / 1000) * 5; // about a fifth of a second to fade
  lastFadeTime = now;
  ctx.font = "700 11px 'Quicksand', sans-serif";
  ctx.textAlign = "center";
  for (const room of ROOMS) {
    if (!room.sign || floorOf(room.sign.y) !== viewFloor) continue;
    const near = me && Math.abs(me.x + PLAYER_SIZE / 2 - room.sign.x) < NEAR_DOOR && Math.abs(me.y + PLAYER_SIZE / 2 - room.sign.y) < NEAR_DOOR;
    const fade = Math.max(0, Math.min(1, (signFade[room.id] || 0) + (near ? step : -step)));
    signFade[room.id] = fade;
    if (fade === 0) continue;
    const c = signCenter(room);
    const w = ctx.measureText(room.name).width + 14, h = 17;
    const x = c.x - w / 2, y = c.y + SIGN_H / 2 + 4;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    roundRectPath(ctx, x + 1, y + 2, w, h, 8);
    ctx.fill();
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(room.name, c.x, y + 12.5);
  }
  // The doors between the house and the yard.
  for (const door of YARD_DOORS) {
    const inYard = viewFloor === YARD_FLOOR;
    if (!inYard && viewFloor !== 0) continue;
    const id = "yard-" + door.id;
    const dx = inYard ? door.yardX : door.house.x, dy = inYard ? YARD_WALL_Y : door.house.top;
    const near = me && Math.abs(me.x + PLAYER_SIZE / 2 - (dx + 0.8)) < NEAR_DOOR && Math.abs(me.y + PLAYER_SIZE / 2 - dy) < NEAR_DOOR;
    const fade = Math.max(0, Math.min(1, (signFade[id] || 0) + (near ? step : -step)));
    signFade[id] = fade;
    if (fade === 0) continue;
    const label = inYard ? "Front door (elevator)" : "Out to the yard";
    const c = toScreen(dx + 0.8, dy);
    const w = ctx.measureText(label).width + 14, h = 17;
    // (In the house the doorway is in the bottom wall, so the tag sits beside it.)
    const x = inYard ? c.x - w / 2 : c.x + 0.8 * TILE + 6, y = inYard ? c.y + 6 : c.y - h - 2;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    roundRectPath(ctx, x + 1, y + 2, w, h, 8);
    ctx.fill();
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    ctx.fillText(label, x + w / 2, y + 12.5);
  }
  // Bedroom doors: whose room, whether you can come in, and their note.
  for (const f of FURNITURE) {
    if (f.kind !== "bedroomDoor" || !f.door || floorOf(f.y) !== viewFloor) continue;
    const id = "door-" + f.door.owner;
    const near = me && Math.abs(me.x + PLAYER_SIZE / 2 - (f.x + f.w / 2)) < NEAR_DOOR && Math.abs(me.y + PLAYER_SIZE / 2 - f.y) < NEAR_DOOR;
    const fade = Math.max(0, Math.min(1, (signFade[id] || 0) + (near ? step : -step)));
    signFade[id] = fade;
    if (fade === 0) continue;
    const status = { open: "Open", knock: "Knock first", private: "Private", party: "Party!" }[f.door.privacy] ?? "Open";
    const lines = [`${f.door.owner}'s room · ${status}${f.door.online ? "" : " · asleep"}`, ...(f.door.note ? [`"${f.door.note}"`] : [])];
    const c = toScreen(f.x + f.w / 2, f.y);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, h = 6 + lines.length * 13;
    const x = c.x - w / 2, y = c.y + 4;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(40, 25, 10, 0.2)";
    roundRectPath(ctx, x + 1, y + 2, w, h, 8);
    ctx.fill();
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#fffaf3";
    ctx.fill();
    ctx.strokeStyle = "#c9955f";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#5c4530";
    lines.forEach((l, i) => ctx.fillText(l, c.x, y + 13 + i * 13));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

// The Study focus timer, shown as a little chalkboard over the study table
// so everyone can see it (even from other rooms).
function drawStudySign(ctx, text) {
  const table = FURNITURE.find((f) => f.kind === "studyTable");
  const p = toScreen(table.x + table.w / 2, table.y);
  ctx.font = "700 14px 'Quicksand', sans-serif";
  const w = ctx.measureText(text).width + 24, h = 26;
  const x = p.x - w / 2, y = p.y - 78;
  // Two strings it hangs from.
  ctx.strokeStyle = "rgba(60, 40, 20, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 16, y - 10);
  ctx.moveTo(x + w - 10, y);
  ctx.lineTo(x + w - 16, y - 10);
  ctx.stroke();
  roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fillStyle = WOOD;
  ctx.fill();
  roundRectPath(ctx, x, y, w, h, 4);
  ctx.fillStyle = "#34473a";
  ctx.fill();
  ctx.fillStyle = "#f3ecd8";
  ctx.textAlign = "center";
  ctx.fillText(text, p.x, y + 18);
  ctx.textAlign = "left";
}



// The open lawn outside, as rectangles in grid units: north of the
// hallway where no room stands, and the garden south of the hallway's
// east end. Rain falls there. (Upper floors are indoors: none.)
function lawnAreas() {
  const t = WALL_THICKNESS, base = viewFloor * UPSTAIRS;
  // In the yard, everything is outside (the porch roof aside).
  if (viewFloor === YARD_FLOOR) return [{ x: -t - 2, y: base + houseTopY - 2, w: HOUSE_WIDTH + 2 * t + 4, h: 20 }];
  if (viewFloor >= 1) return []; // (indoors, rain only shows through windows)
  const taken = ROOMS.filter((r) => r.north && floorOf(r.rect.y) === viewFloor)
    .map((r) => [r.rect.x - t, r.rect.x + r.rect.w + t])
    .sort((a, b) => a[0] - b[0]);
  const areas = [];
  let from = -t;
  for (const [start, end] of taken) {
    if (start > from) areas.push({ x: from, w: start - from });
    from = Math.max(from, end);
  }
  if (from < HOUSE_WIDTH + t) areas.push({ x: from, w: HOUSE_WIDTH + t - from });
  // The lawn north of the hallway, plus the garden below the elevator lobby.
  const north = areas.map((a) => ({ ...a, y: base + houseTopY - 1.5, h: -t - (base + houseTopY - 1.5) }));
  return [...north, { x: 18, y: 7 + t / 2, w: HOUSE_WIDTH + t - 18 + 1, h: 5 }];
}

// --- Decorating helpers ---

// Turns a point on the canvas (in CSS pixels from its top-left corner)
// into a grid position on the floor being drawn.
// The other way: where a grid spot is on the page, in page pixels (for
// placing things like the emote wheel over the house view).
function gridToPage(canvas, gx, gy) {
  const { left, top } = houseBounds();
  const perPixel = canvas.width / canvas.clientWidth / viewScale;
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (ORIGIN_X + gx * TILE - left) / perPixel, y: r.top + (ORIGIN_Y + gy * TILE - top) / perPixel };
}

function screenToGrid(canvas, px, py) {
  const { left, top } = houseBounds();
  const perPixel = canvas.width / canvas.clientWidth / viewScale; // house pixels per CSS pixel
  return { x: (px * perPixel + left - ORIGIN_X) / TILE, y: (py * perPixel + top - ORIGIN_Y) / TILE };
}

// Draws any furniture piece (or rug).
function drawPiece(ctx, f) {
  if (f.kind === "rug") drawRug(ctx, f);
  else if (FURNITURE_DRAWERS[f.kind]) FURNITURE_DRAWERS[f.kind](ctx, f);
}

// While decorating: the piece you're holding, see-through, with its
// footprint outlined in green (fits) or red (doesn't fit there).
function drawHeldPiece(ctx, held) {
  const f = held.f;
  const a = toScreen(f.x, f.y);
  const w = f.w * TILE, h = (f.h ?? 0.2) * TILE;
  ctx.save();
  ctx.fillStyle = held.ok ? "rgba(120, 200, 120, 0.25)" : "rgba(220, 90, 80, 0.3)";
  ctx.strokeStyle = held.ok ? "rgba(70, 150, 70, 0.9)" : "rgba(190, 60, 50, 0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  if (f.h === undefined) {
    // Wall pieces: outline the stretch of wall they'd hang on.
    ctx.fillRect(a.x, a.y - WALL_HEIGHT, w, WALL_HEIGHT);
    ctx.strokeRect(a.x, a.y - WALL_HEIGHT, w, WALL_HEIGHT);
  } else {
    ctx.fillRect(a.x, a.y, w, h);
    ctx.strokeRect(a.x, a.y, w, h);
  }
  // Center line guides: the room's middle (faint) and any center the piece
  // is lined up on (bright).
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  for (const g of held.guides ?? []) {
    const top = toScreen(g.x, g.top), bottom = toScreen(g.x, g.bottom);
    ctx.strokeStyle = g.strong ? "rgba(255, 250, 235, 0.9)" : "rgba(255, 250, 235, 0.3)";
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - WALL_HEIGHT);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  drawPiece(ctx, f);
  ctx.restore();
}

// Draws a piece of decor by itself, fitted into a small canvas (for the
// Nest & Nook store). Wall pieces get a little stretch of wall behind them.
function drawDecorPreview(canvas, item, color) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const f = { ...item, x: 0, y: 0, h: item.wall ? undefined : item.h, color: item.ownerColor ? color : item.color };
  if (item.centered) f.x = item.w / 2;
  const a = toScreen(0, 0);
  const w = item.w * TILE, h = item.wall ? 0 : item.h * TILE;
  const tall = item.wall ? WALL_HEIGHT : item.kind === "rug" ? 0 : 70; // room above the footprint for tall things
  const boxW = w + 16, boxH = h + tall + 16;
  const scale = Math.min(2.2, (canvas.width - 8) / boxW, (canvas.height - 8) / boxH);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(a.x + w / 2), -(a.y + (h - tall) / 2));
  if (item.wall) {
    ctx.fillStyle = CONFIG.roomWallColors.bedroom;
    ctx.fillRect(a.x - 8, a.y - WALL_HEIGHT, w + 16, WALL_HEIGHT);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a.x - 8, a.y - 5, w + 16, 5);
  }
  drawPiece(ctx, f);
  ctx.restore();
}

// Draws the whole house for one frame, scaled to fit the view (see
// setViewScale). `players` is an array of { x, y, color, name, badge },
// including yourself, and `pets` the pets following them (see drawPet).
// Name tags and labels are drawn in the house's own pixels too, so they
// grow and shrink with it.
function drawScene(ctx, players, studySign, pets = [], floor = 0, held = null, me = null) {
  viewFloor = floor;
  players = players.filter((p) => floorOf(p.y) === floor);
  pets = pets.filter((pet) => floorOf(pet.y) === floor);
  ctx.save();
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const { left, top } = houseBounds();
  ctx.translate(-left, -top);

  drawFloors(ctx);
  drawPondShimmer(ctx);
  if (viewFloor !== YARD_FLOOR) drawOutsideWeather(ctx, lawnAreas(), true); // (the yard's is drawn over everything, in drawOutdoorLight)
  dropRuneMarks(players);
  drawRuneMarks(ctx);

  // Walls, furniture and players, sorted so lower on screen draws in front.
  const sprites = [...getStaticSprites()];
  for (const p of players) {
    sprites.push({ sortY: p.sortY ?? p.y + PLAYER_SIZE, draw: (ctx) => drawPlayerBody(ctx, p) }); // (sitting: sorted with the seat)
    // In the yard when it rains, everyone gets an umbrella (see outdoors.js).
    p.umbrella = floor === YARD_FLOOR && OUTDOORS.raining && !p.asleep;
    if (p.umbrella) sprites.push({ sortY: (p.sortY ?? p.y + PLAYER_SIZE) + 0.0001, draw: (ctx) => drawUmbrella(ctx, p) });
    // Fishing at the pond: the rod and line (in front of you) and the
    // bobber out on the water (see outdoors.js).
    if (p.fishing && floor === YARD_FLOOR) {
      sprites.push({ sortY: p.y + PLAYER_SIZE + 0.0002, draw: (ctx) => drawFishingLine(ctx, p) });
      sprites.push({ sortY: p.fishing.by - 0.5, draw: (ctx) => drawBobber(ctx, p) });
    }
  }
  for (const pet of pets) sprites.push({ sortY: pet.y, draw: (ctx) => drawPet(ctx, pet) });
  sprites.push(...residentSprites(floor)); // Clover and Mortimer (render-residents.js)
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const sprite of sprites) sprite.draw(ctx);

  drawLights(ctx);
  if (held) drawHeldPiece(ctx, held);
  if (studySign) drawStudySign(ctx, studySign); // under name tags, so names stay readable
  for (const tag of layoutPlayerTags(ctx, players)) drawPlayerTag(ctx, tag);
  for (const pet of pets) drawPetHearts(ctx, pet);
  drawDoorTags(ctx, me); // on top: it's only there because you walked up to a door
  drawDebugOverlays(ctx);
  ctx.restore();
}

// --- Debug outlines (the admin panel's Debug tab; only on this computer) ---
// Room edges and names (blue), everything you bump into (red), and where
// people sit (green dots, with a line showing which way they face).
const DEBUG_OVERLAYS = { seats: false, solids: false, rooms: false };
function drawDebugOverlays(ctx) {
  if (!DEBUG_OVERLAYS.seats && !DEBUG_OVERLAYS.solids && !DEBUG_OVERLAYS.rooms) return;
  const onFloor = (y) => floorOf(y) === viewFloor;
  const box = (r, color, fill) => {
    const a = toScreen(r.x, r.y), b = toScreen(r.x + r.w, r.y + r.h);
    ctx.fillStyle = fill;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x - 1, b.y - a.y - 1);
  };
  ctx.save();
  ctx.font = "700 9px 'Quicksand', sans-serif";
  if (DEBUG_OVERLAYS.rooms) {
    for (const room of ROOMS.filter((r) => r.rect && onFloor(r.rect.y))) {
      box(room.rect, "rgba(40, 90, 220, 0.9)", "rgba(40, 90, 220, 0.06)");
      const a = toScreen(room.rect.x, room.rect.y);
      ctx.fillStyle = "rgba(40, 90, 220, 0.95)";
      ctx.fillText(room.id, a.x + 3, a.y + 10);
    }
  }
  if (DEBUG_OVERLAYS.solids) for (const s of SOLIDS.filter((s) => onFloor(s.y))) box(s, "rgba(220, 40, 40, 0.85)", "rgba(220, 40, 40, 0.12)");
  if (DEBUG_OVERLAYS.seats) {
    const step = { down: [0, 6], up: [0, -6], left: [-6, 0], right: [6, 0] };
    for (const seat of seatsOnFloor(viewFloor)) {
      const p = toScreen(seat.x, seat.y);
      ctx.fillStyle = "rgba(30, 160, 60, 0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      const [dx, dy] = step[seat.face] ?? [0, 0];
      ctx.strokeStyle = "rgba(30, 160, 60, 0.95)";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dx, p.y + dy);
      ctx.stroke();
    }
  }
  ctx.restore();
}
