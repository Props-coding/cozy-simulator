// A stand-in for Trystero (how friends' browsers find each other) for the
// automated tests: the house loads and runs with nobody else around, and
// no connection goes out to the internet. tests/serve.mjs swaps it in.
export const selfId = "self" + Math.random().toString(36).slice(2, 8);
export function joinRoom() {
  const noop = () => {};
  return {
    makeAction: () => ({ send: noop, onMessage: null }),
    onPeerJoin: noop,
    onPeerLeave: noop,
    onPeerStream: noop,
    onPeerTrack: noop,
    addStream: noop,
    removeStream: noop,
    addTrack: noop,
    removeTrack: noop,
    replaceTrack: noop,
    leave: noop,
    getPeers: () => ({}),
    ping: async () => 0,
  };
}
