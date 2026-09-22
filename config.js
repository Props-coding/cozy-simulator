// Settings you might want to change. Comments explain each one.

const CONFIG = {
  // Canvas size (the house view), in pixels.
  canvasWidth: 1000,
  canvasHeight: 620,

  // How fast your character walks, in grid units per second (a "grid
  // unit" is roughly one floor tile; each room is about 6 units wide).
  playerSpeed: 5,

  // Room names shown on screen. Change these if you want different labels.
  roomNames: {
    hallway: "Hallway",
    gaming: "Gaming",
    study: "Study",
    dinner: "Dinner",
  },

  // Each room's floor: a style ("planks" for wood boards, "carpet", or
  // "checker" for tiles) and a main color.
  roomFloors: {
    hallway: { style: "planks", color: "#d4b48c" },
    gaming: { style: "carpet", color: "#39455e" },
    study: { style: "planks", color: "#9c6a45" },
    dinner: { style: "checker", color: "#dcae8c" },
  },

  // The color of the walls you see inside each room.
  roomWallColors: {
    hallway: "#eadbc2",
    gaming: "#56617a",
    study: "#6f8a6a",
    dinner: "#f0d9b8",
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

  // A relay server (called TURN) that steps in when two friends' home
  // networks can't connect directly to each other. Without this, some
  // pairs of friends may not see or hear each other at all.
  // This is a free, shared relay from the Open Relay Project (metered.ca)
  // that anyone can use, no account needed. If it's ever slow or full
  // (since it's shared with other projects worldwide), switch to a
  // personal free account at metered.ca and put your own values here.
  turnServers: [
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],

  // --- Study room lo-fi music ---
  // Plays locally for each person (not synced) while standing in Study.
  // Primary: the official Lofi Girl 24/7 livestream, embedded via YouTube.
  // Confirmed embeddable and it's the channel's own intended live stream.
  lofiYouTubeVideoId: "rFZHOHl-L8A",

  // Backup, in case the YouTube embed is ever blocked (e.g. strict
  // network or ad blocker): a direct radio stream from SomaFM, a free
  // internet radio station meant for exactly this kind of listening.
  lofiBackupStreamUrl: "https://ice2.somafm.com/fluid-128-mp3",

  // Starting volume for the Study music (0 to 1). There's a slider too.
  defaultLofiVolume: 0.5,
};
