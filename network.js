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

// Connects to the shared room. Call this once, after the player has
// chosen a name and color on the Join screen.
export function connectToRoom(myName, myColor) {
  room = joinRoom(
    { appId: CONFIG.trysteroAppId, password: CONFIG.trysteroPassword },
    CONFIG.trysteroRoomId
  );

  // "position" is a custom message type we invented for sending where a
  // player is standing. Trystero lets us make up any name we want here.
  const [sendPosition, receivePosition] = room.makeAction("position");
  positionAction = sendPosition;

  receivePosition((data, peerId) => {
    peers[peerId] = { ...peers[peerId], ...data };
  });

  room.onPeerJoin((peerId) => {
    peers[peerId] = { name: "...", color: "#999", x: 400, y: 300, room: "hallway" };
    // Tell the new friend who we are right away, don't wait for the next tick.
    positionAction({ name: myName, color: myColor, ...lastKnownPosition });
  });

  room.onPeerLeave((peerId) => {
    delete peers[peerId];
  });
}

let lastKnownPosition = { x: 0, y: 0, room: "hallway" };

// Call this often (see main.js) to tell everyone where we are.
export function broadcastPosition(name, color, x, y, roomId) {
  lastKnownPosition = { x, y, room: roomId };
  if (positionAction) {
    positionAction({ name, color, x, y, room: roomId });
  }
}

// Returns the current list of other players, as an array.
export function getPeers() {
  return Object.entries(peers).map(([id, p]) => ({ id, ...p }));
}
