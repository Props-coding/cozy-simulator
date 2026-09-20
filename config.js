// Settings you might want to change. Comments explain each one.

const CONFIG = {
  // Canvas size (the house view), in pixels.
  canvasWidth: 800,
  canvasHeight: 600,

  // How fast your character walks, in pixels per second.
  playerSpeed: 220,

  // Room names shown on screen. Change these if you want different labels.
  roomNames: {
    hallway: "Hallway",
    gaming: "Gaming",
    study: "Study",
    dinner: "Dinner",
  },

  // Colors for each room's floor.
  roomColors: {
    hallway: "#e8e0d0",
    gaming: "#cfe8d8",
    study: "#d8dcef",
    dinner: "#f0dcd4",
  },

  // --- Multiplayer (Trystero) settings ---
  // Trystero is the library that lets friends' browsers find each other
  // directly, with no server of our own. See network.js for how it's used.

  // A made-up name for this app. Doesn't need to be secret, just unique
  // so we don't accidentally connect to someone else's Trystero app.
  trysteroAppId: "cozy-house-props-coding",

  // The "room" friends need to be in to find each other. Change this to
  // anything else if you want a fresh, empty house (e.g. after sharing
  // the link somewhere you didn't mean to). Note: this repo is public,
  // so this is "hard to stumble onto by accident," not a real secret.
  trysteroRoomId: "cozy-house-e167e5847694",

  // A shared password so only people with this exact value can connect.
  // Everyone's copy of the site must have the same password to talk to
  // each other. Change it any time you want to lock out old links.
  trysteroPassword: "04dbc3b71a7fb3a9",

  // How many times per second we tell friends where we are.
  positionUpdatesPerSecond: 12,
};
