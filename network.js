// Handles finding friends' browsers and sending/receiving data between
// them, using Trystero. This is the only file that talks to Trystero, so
// if we ever need to change how it works, this is the one file to edit.
//
// Loaded from a pinned CDN link (an exact version number) instead of a
// local copy, because Trystero's built files depend on a couple of other
// small packages that only resolve correctly when served through a CDN
// like esm.sh. Pinning the version means it won't silently change on us.
import { joinRoom } from "https://esm.sh/trystero@0.25.4/nostr";

let room = null;
let positionAction = null;
let localStream = null; // your mic, once you've allowed it
const peers = {}; // peerId -> { name, color, x, y, room }

// Set these before or after connectToRoom, doesn't matter, they're only
// read once a friend's voice stream or leave event actually happens.
let externalOnPeerStream = null;
let externalOnPeerLeave = null;
let externalOnPeerJoin = null;
let externalOnKnock = null;
let knockAction = null;

export function onPeerStream(callback) {
  externalOnPeerStream = callback;
}

export function onPeerLeave(callback) {
  externalOnPeerLeave = callback;
}

export function onPeerJoin(callback) {
  externalOnPeerJoin = callback;
}

// Someone knocked on your office door. callback gets their peer id.
export function onKnock(callback) {
  externalOnKnock = callback;
}

// Knock on one friend's office door (only they get the message).
export function sendKnock(peerId) {
  knockAction?.send(true, { target: peerId });
}

// Sends your mic audio to everyone in the room. Call once, after both
// connectToRoom and mic permission have gone through.
export function addLocalStream(stream) {
  localStream = stream;
  if (room) {
    room.addStream(stream);
  }
}

// Connects to the shared room. Call this once, after the player has
// chosen a name and color on the Join screen.
export function connectToRoom(myName, myColor) {
  room = joinRoom(
    {
      appId: CONFIG.trysteroAppId,
      password: CONFIG.trysteroPassword,
      // Trystero only tries 5 of its ~29 public relays by default, always
      // the same 5 for our app (picked from our appId). If a couple of
      // those happen to be down, we're stuck. Trying more relays makes
      // it much less likely all of them are down at once.
      relayConfig: { redundancy: 12 },
      // A relay (TURN) server for when two friends' home networks can't
      // connect to each other directly. See config.js for where this
      // comes from and how to swap it for a different provider.
      turnConfig: CONFIG.turnServers,
    },
    CONFIG.trysteroRoomId
  );

  // "position" is a custom message type we invented for sending where a
  // player is standing. Trystero lets us make up any name we want here.
  const position = room.makeAction("position");
  positionAction = position.send;

  position.onMessage = (data, { peerId }) => {
    peers[peerId] = { ...peers[peerId], ...data };
  };

  // "knock" carries no information, the message arriving is the knock.
  knockAction = room.makeAction("knock");
  knockAction.onMessage = (_, { peerId }) => externalOnKnock?.(peerId);

  lastKnownPosition = { ...lastKnownPosition, name: myName, color: myColor };

  room.onPeerJoin = (peerId) => {
    // Placeholder spot in the middle of the hallway (grid units), until
    // their first real position message arrives a moment later.
    peers[peerId] = { name: "...", color: "#999", x: 8.7, y: 1.2, room: "hallway" };
    // addLocalStream only reaches friends who were already here, so
    // anyone arriving later needs our mic sent to them directly.
    if (localStream) room.addStream(localStream, { target: peerId });
    // Tell the new friend who we are right away, don't wait for the next tick.
    positionAction(lastKnownPosition);
    externalOnPeerJoin?.(peerId);
  };

  room.onPeerLeave = (peerId) => {
    delete peers[peerId];
    externalOnPeerLeave?.(peerId);
  };

  room.onPeerStream = (stream, peerId) => {
    externalOnPeerStream?.(stream, peerId);
  };
}

let lastKnownPosition = { x: 0, y: 0, room: "hallway" };

// Call this often (see main.js) to tell everyone about yourself: an
// object with name, color, hat, x, y, room, tz (time zone) and office.
export function broadcastPosition(state) {
  lastKnownPosition = state;
  if (positionAction) {
    positionAction(state);
  }
}

// Returns the current list of other players, as an array.
export function getPeers() {
  return Object.entries(peers).map(([id, p]) => ({ id, ...p }));
}
