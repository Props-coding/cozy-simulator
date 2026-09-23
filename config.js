// Settings you might want to change. Comments explain each one.

// --- Relay (TURN) login, from your free Metered account ---
// Paste the username and password from the Metered dashboard between the
// quote marks below (Dashboard > TURN Server > Show ICE Servers Array).
// Only these two lines need to change; the relay settings further down
// use them automatically.
const TURN_USERNAME = "699927adb612d03f8a3cadf1";
const TURN_PASSWORD = "K9PZnt1CKh6d65PN";

const CONFIG = {
  // How fast your character walks, in grid units per second (a "grid
  // unit" is roughly one floor tile; each room is about 6 units wide).
  playerSpeed: 5,

  // Room names shown on screen. Change these if you want different labels.
  roomNames: {
    hallway: "Hallway",
    theater: "Theater",
    conference: "Conference Room",
    library: "Library",
    study: "Study",
    dinner: "Dinner",
    stairs: "Stairs",
    landing: "Upstairs",
  },

  // Each room's floor: a style ("planks" for wood boards, "carpet", or
  // "checker" for tiles) and a main color.
  roomFloors: {
    hallway: { style: "planks", color: "#d4b48c" },
    theater: { style: "carpet", color: "#5a2833" },
    conference: { style: "carpet", color: "#5f6b7a" },
    library: { style: "planks", color: "#6e4a32" },
    study: { style: "planks", color: "#9c6a45" },
    dinner: { style: "checker", color: "#dcae8c" },
    office: { style: "planks", color: "#b98a5e" }, // used for every office
    stairs: { style: "planks", color: "#b08a64" },
    stairsUp: { style: "planks", color: "#b08a64" },
    landing: { style: "planks", color: "#c9a57e" },
    bedroom: { style: "carpet", color: "#b7a2c4" }, // used for every bedroom
  },

  // The color of the walls you see inside each room.
  roomWallColors: {
    hallway: "#eadbc2",
    theater: "#3d2c3a",
    conference: "#dcd3c4",
    library: "#3f5a4a",
    study: "#6f8a6a",
    dinner: "#f0d9b8",
    office: "#8f7fa3", // used for every office
    stairs: "#e3d2b8",
    stairsUp: "#e3d2b8",
    landing: "#e6d6c6",
    bedroom: "#a9b8cf", // used for every bedroom
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
  // This is the Open Relay Project from Metered (metered.ca): free for
  // 20 GB a month with a free account. (The old no-account shared login
  // stopped working in 2026.) The login comes from TURN_USERNAME and
  // TURN_PASSWORD at the top of this file. Note the site is public, so
  // anyone reading the code could see this login; the worst case is a
  // stranger using some of the free monthly allowance.
  turnServers: [
    { urls: "turn:global.relay.metered.ca:80", username: TURN_USERNAME, credential: TURN_PASSWORD },
    { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: TURN_USERNAME, credential: TURN_PASSWORD },
    { urls: "turn:global.relay.metered.ca:443", username: TURN_USERNAME, credential: TURN_PASSWORD },
    { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: TURN_USERNAME, credential: TURN_PASSWORD },
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

  // Starting volume for the rain in the Library (0 to 1). There's a slider too.
  // Kept low on purpose: it's meant to be a soft background, not a sound.
  defaultRainVolume: 0.35,

  // Starting volume for the soft white noise you hear while asleep in a
  // bed (0 to 1). There's a slider too.
  defaultWhiteNoiseVolume: 0.3,

  // --- Secret office themes (an Easter egg) ---
  // If someone with one of these names builds an office, they get a
  // special themed one instead of the default. Names are matched without
  // caring about capital letters. Themes: "lakehouse", "stalker", "scholar", "cottage".
  officeThemes: {
    props: "lakehouse",
    brightness: "stalker",
    kxiven: "scholar",
    lyss: "cottage",
  },

  // --- Crumbs (the house money) ---
  // You earn crumbs just for hanging out, and spend them at the raccoons'
  // shop in the hallway on hats and shoes.
  crumbsPerMinute: 1,
  focusBonusCrumbs: 10, // extra crumbs for finishing a Study focus session

  // --- Study focus timer ---
  // Press F in the Study to start a shared focus session for everyone.
  // After the focus time there's a short break, then it ends. In minutes.
  focusMinutes: 25,
  breakMinutes: 5,
};
