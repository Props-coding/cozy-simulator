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
const peers = {}; // peerId -> { name, color, x, y, room }

// Set these before or after connectToRoom, doesn't matter, they're only
// read once a friend's voice stream or leave event actually happens.
let externalOnPeerStream = null;
let externalOnPeerLeave = null;
let externalOnPeerJoin = null;

export function onPeerStream(callback) {
  externalOnPeerStream = callback;
}

export function onPeerLeave(callback) {
  externalOnPeerLeave = callback;
}

export function onPeerJoin(callback) {
  externalOnPeerJoin = callback;
}

// Sends your mic audio to everyone in the room. Call once, after both
// connectToRoom and mic permission have gone through.
export function addLocalStream(stream) {
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

  room.onPeerJoin = (peerId) => {
    peers[peerId] = { name: "...", color: "#999", x: 400, y: 300, room: "hallway" };
    // Tell the new friend who we are right away, don't wait for the next tick.
    positionAction({ name: myName, color: myColor, ...lastKnownPosition });
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

// Call this often (see main.js) to tell everyone where we are.
export function broadcastPosition(name, color, x, y, roomId, timeZone) {
  lastKnownPosition = { x, y, room: roomId, tz: timeZone };
  if (positionAction) {
    positionAction({ name, color, x, y, room: roomId, tz: timeZone });
  }
}

// Returns the current list of other players, as an array.
export function getPeers() {
  return Object.entries(peers).map(([id, p]) => ({ id, ...p }));
}
