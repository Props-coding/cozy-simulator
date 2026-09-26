// The bedroom phone: the red phone on your bedroom wall. Press E there to
// call a friend who's in the house (their phone rings wherever they are,
// with a pop-up to answer), or to leave a message for someone who's away
// (it arrives as a letter, which they see when they log in).
//
// A call uses the same private line as whispering (see audio.js): your
// voice goes to that one friend only, from any room or floor, and your
// normal room voice is off while you're on the phone. Hang up with E, the
// Hang up button, or (if you made the call) by walking away from the phone.
import { sendPhone, onPhone } from "./network.js";
import { serverApi } from "./account.js";
import { playClickSound, playPhoneRing, playHangUp } from "./audio.js";

const RING_SECONDS = 30; // how long it rings before giving up
const RING_EVERY_MS = 3000;

// call: null, or { peerId, name, state: "calling", "ringing" or "talking", mine: true if we called }
let call = null;
let ringTimer = null;
let giveUpTimer = null;
let hooks = {};

const panel = document.getElementById("phone-panel");
const friendList = document.getElementById("phone-friends");
const messageForm = document.getElementById("phone-message");
const messageTo = document.getElementById("phone-message-to");
const messageText = document.getElementById("phone-message-text");
const popup = document.getElementById("phone-popup");
const popupText = document.getElementById("phone-popup-text");
const popupButtons = document.getElementById("phone-popup-buttons");

// hooks: peers() (friends in the house), doors() (everyone's bedroom
// door), isAway() (asleep or at Dinner: can't take calls), startLine(peerId)
// and stopLine() (the private voice line), color(), notice(text, ms).
export function initPhone(options) {
  hooks = options;
}

export function inCall() {
  return !!call && call.state === "talking";
}

export function phoneBusy() {
  return !!call;
}

// --- The phone panel (press E at your phone) ---
export function openPhonePanel() {
  if (call) return hangUp();
  messageForm.hidden = true;
  friendList.innerHTML = "";
  const here = new Map();
  for (const peer of hooks.peers()) here.set(String(peer.name).toLowerCase(), peer);
  const rows = [];
  for (const peer of here.values()) rows.push({ name: peer.name, peer });
  for (const door of hooks.doors()) {
    if (!door.mine && !here.has(door.owner.toLowerCase())) rows.push({ name: door.owner, away: true });
  }
  if (!rows.length) friendList.innerHTML = "<p class='phone-empty'>Nobody to call yet.</p>";
  for (const row of rows.sort((a, b) => !!a.away - !!b.away || a.name.localeCompare(b.name))) {
    const li = document.createElement("div");
    li.className = "phone-row";
    li.append(Object.assign(document.createElement("span"), { textContent: row.away ? `${row.name} · 🌙 away` : `${row.name} · in the house` }));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "warm-button";
    button.textContent = row.away ? "Leave a message" : "Call";
    button.addEventListener("click", () => (row.away ? showMessageForm(row.name) : dial(row.peer)));
    li.append(button);
    friendList.append(li);
  }
  panel.hidden = false;
  playClickSound();
}

export function closePhonePanel() {
  panel.hidden = true;
}

export function isPhonePanelOpen() {
  return !panel.hidden;
}

function showMessageForm(name) {
  panel.hidden = false;
  messageForm.hidden = false;
  messageTo.textContent = name;
  messageText.value = "";
  messageText.focus();
}

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = messageText.value.trim();
  if (!body) return;
  try {
    await serverApi("POST", "/api/mail", { to: messageTo.textContent, subject: "📞 Phone message", body, color: hooks.color() });
    hooks.notice(`Message left for ${messageTo.textContent}. They'll see it when they come in.`);
    closePhonePanel();
  } catch (err) {
    hooks.notice(err.message);
  }
});
messageText.addEventListener("keydown", (e) => e.stopPropagation()); // typing here isn't walking
document.getElementById("phone-close").addEventListener("click", () => {
  closePhonePanel();
  playClickSound();
});

// --- Calling ---
function dial(peer) {
  closePhonePanel();
  call = { peerId: peer.id, name: String(peer.name).slice(0, 16), state: "calling", mine: true };
  sendPhone(peer.id, { t: "ring" });
  playPhoneRing();
  ringTimer = setInterval(playPhoneRing, RING_EVERY_MS);
  giveUpTimer = setTimeout(() => {
    sendPhone(call.peerId, { t: "cancel" });
    endCall(`${call.name} didn't pick up.`, call.name);
  }, RING_SECONDS * 1000);
  showPopup(`Calling ${call.name}...`, [["Hang up", hangUp]]);
}

function answer() {
  if (call?.state !== "ringing") return;
  sendPhone(call.peerId, { t: "answer" });
  startTalking();
}

function decline() {
  if (call?.state !== "ringing") return;
  sendPhone(call.peerId, { t: "decline" });
  endCall("");
}

function startTalking() {
  stopRinging();
  if (!hooks.startLine(call.peerId)) {
    sendPhone(call.peerId, { t: "hangup" });
    return endCall("Phone calls need your microphone.");
  }
  call.state = "talking";
  showPopup(`📞 On the phone with ${call.name}`, [["Hang up", hangUp]]);
}

export function hangUp() {
  if (!call) return;
  sendPhone(call.peerId, { t: call.state === "ringing" ? "decline" : call.state === "calling" ? "cancel" : "hangup" });
  endCall("You hung up.");
}

// Ends the call on our side. If `messageFor` is a name, offers to leave
// them a message instead.
function endCall(why, messageFor = null) {
  const wasTalking = call?.state === "talking";
  stopRinging();
  call = null;
  if (wasTalking) hooks.stopLine();
  popup.hidden = true;
  if (wasTalking || why) playHangUp();
  if (why) hooks.notice(why, 5000);
  if (messageFor) showMessageForm(messageFor);
}

function stopRinging() {
  clearInterval(ringTimer);
  clearTimeout(giveUpTimer);
  ringTimer = giveUpTimer = null;
  globalThis.phoneRinging = false;
}

function showPopup(text, buttons) {
  popupText.textContent = text;
  popupButtons.innerHTML = "";
  for (const [label, action] of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "warm-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      playClickSound();
      action();
    });
    popupButtons.append(button);
  }
  popup.hidden = false;
}

// --- Messages from friends' phones ---
const FROM_CALLER = ["cancel", "hangup"];
onPhone((message, peerId) => {
  const t = message?.t;
  const peer = hooks.peers().find((p) => p.id === peerId);
  if (!peer || typeof t !== "string") return;
  const name = String(peer.name).slice(0, 16);

  if (t === "ring") {
    if (call) return sendPhone(peerId, { t: "busy" });
    if (hooks.isAway()) return sendPhone(peerId, { t: "away" });
    call = { peerId, name, state: "ringing", mine: false };
    globalThis.phoneRinging = true;
    playPhoneRing();
    ringTimer = setInterval(playPhoneRing, RING_EVERY_MS);
    giveUpTimer = setTimeout(() => endCall(`You missed a call from ${name}.`), (RING_SECONDS + 2) * 1000);
    showPopup(`📞 ${name} is calling your bedroom phone!`, [["Answer", answer], ["Decline", decline]]);
    return;
  }

  // Everything else is about the call we're in, from the friend we're in it with.
  if (!call || call.peerId !== peerId) return;
  if (t === "answer" && call.state === "calling") return startTalking();
  if (["decline", "busy", "away"].includes(t) && call.state === "calling") {
    const why = { decline: `${name} can't talk right now.`, busy: `${name} is on another call.`, away: `${name} is asleep or away.` }[t];
    return endCall(`${why} You can leave a message.`, name);
  }
  if (FROM_CALLER.includes(t) && call.state === "ringing") return endCall(`You missed a call from ${name}.`);
  if (t === "hangup" && call.state === "talking") return endCall(`${name} hung up.`);
});

// Called every frame by main.js: ends the call if the friend left the
// house, you went to bed or to Dinner, or (for the one who called) you
// walked away from the phone.
export function checkCall(atMyPhone) {
  if (!call) return;
  if (!hooks.peers().some((p) => p.id === call.peerId)) return endCall(`${call.name} left the house. The call ended.`);
  if (call.state === "talking" && hooks.isAway()) return hangUp();
  if (call.mine && !atMyPhone) {
    sendPhone(call.peerId, { t: call.state === "calling" ? "cancel" : "hangup" });
    endCall("You walked away from the phone. The call ended.");
  }
}

// Which friend we're talking to on the phone (their peer id), or null.
export function callPeer() {
  return inCall() ? call.peerId : null;
}
