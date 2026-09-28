// A stand-in for Trystero (how friends' browsers find each other) for the
// automated tests: the house loads and runs with nobody else around, and
// no connection goes out to the internet. tests/serve.mjs swaps it in.
//
// Friends, for tests that play together (tests/friends.js): when the test
// gives the page a `__meshSend` function, messages go through the test
// itself to the other pages (their `__meshReceive`), so two or three
// windows see each other as if connected. (No voice.)
export const selfId = "self" + Math.random().toString(36).slice(2, 8);
export function joinRoom() {
  const noop = () => {};
  const actions = new Map(); // name -> { onMessage }
  const peers = new Set();
  const mesh = typeof globalThis.__meshSend === "function" ? globalThis.__meshSend : null;
  const room = {
    makeAction: (name) => {
      const action = {
        onMessage: null,
        send(data, options) {
          if (!mesh) return;
          const target = options?.target;
          const to = target === undefined || target === null ? null : [].concat(target);
          mesh({ from: selfId, to, name, data: JSON.parse(JSON.stringify(data ?? null)) });
        },
      };
      actions.set(name, action);
      return action;
    },
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
    getPeers: () => Object.fromEntries([...peers].map((id) => [id, {}])),
    ping: async () => 0,
  };
  if (mesh) {
    globalThis.__meshReceive = (m) => {
      if (m.from === selfId || (m.to && !m.to.includes(selfId))) return;
      if (m.name === "__hello" || !peers.has(m.from)) {
        const known = peers.has(m.from);
        peers.add(m.from);
        if (!known) {
          room.onPeerJoin?.(m.from);
          mesh({ from: selfId, to: [m.from], name: "__hello", data: null });
        }
        if (m.name === "__hello") return;
      }
      if (m.name === "__bye") {
        peers.delete(m.from);
        return room.onPeerLeave?.(m.from);
      }
      actions.get(m.name)?.onMessage?.(m.data, { peerId: m.from });
    };
    setTimeout(() => mesh({ from: selfId, to: null, name: "__hello", data: null }), 50);
  }
  return room;
}
