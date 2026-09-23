// Settings you might want to change. Comments explain each one.

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
    elevator: "Elevator",
    landing: "Upstairs",
  },

  // The color swatches in the wardrobe (there's also a "custom" one that
  // opens the full color picker).
  wardrobeColors: ["#e05a47", "#e8883a", "#e8b84a", "#8fb86a", "#4f9a8a", "#5aa0d8", "#7a6bc8", "#c86bb0", "#e98ac0", "#a0703e", "#6b5a4a", "#f2ede4"],

  // Accounts that can wear the Exalted look (a hooded robe, sigil circle,
  // floating candles and rune footsteps), switched on in their wardrobe.
  exaltedNames: ["Props"],

  // Seasonal decorations in the shared rooms: "auto" follows the calendar
  // (spring Mar to May, summer Jun to Aug, autumn Sep to Nov, winter Dec
  // to Feb), or pick one: "spring", "summer", "autumn" or "winter".
  season: "auto",

  // The little wooden sign over each room's doorway shows an icon. Keyed
  // by room id. Built-in icons (drawn to match the house): "film",
  // "pencil", "books", "openBook", "lamp", "forkKnife", "elevator", "stairs",
  // "gamepad", "music", "heart", "leaf", "moon", "door". Anything else is
  // shown as written (an emoji works). A new room without one gets a door.
  // Offices and bedrooms show their owner's name instead of an icon.
  roomIcons: {
    theater: "film",
    conference: "pencil",
    library: "books",
    study: "lamp",
    dinner: "forkKnife",
    elevator: "elevator",
    elevatorUp: "elevator",
  },

  // Each room's floor: a style ("planks" for wood boards, "carpet",
  // "cinema" for carpet with little gold stars, or "checker" for tiles)
  // and a main color.
  roomFloors: {
    hallway: { style: "planks", color: "#d4b48c" },
    theater: { style: "cinema", color: "#5a2833" },
    conference: { style: "carpet", color: "#5f6b7a" },
    library: { style: "planks", color: "#6e4a32" },
    study: { style: "planks", color: "#9c6a45" },
    dinner: { style: "checker", color: "#dcae8c" },
    office: { style: "planks", color: "#b98a5e" }, // used for every office
    elevator: { style: "checker", color: "#d9cbb4" },
    elevatorUp: { style: "checker", color: "#d9cbb4" },
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
    elevator: "#d8c3a0",
    elevatorUp: "#d8c3a0",
    landing: "#e6d6c6",
    bedroom: "#a9b8cf", // used for every bedroom
  },

  // --- Multiplayer (Trystero) settings ---
  // Trystero is the library that lets friends' browsers find each other
  // directly, with no server of our own. See network.js for how it's used.

  // A made-up name for this app. Doesn't need to be secret, just unique
  // so we don't accidentally connect to someone else's Trystero app.
  trysteroAppId: "cozy-house-props-coding",

  // The house server (on the droplet). After you log in and enter the
  // house phrase, it tells the page which room to join, the room's
  // password and the relay login, so those secrets aren't in this public
  // file any more. To change the house phrase, run "sudo cozy-admin phrase"
  // on the droplet.
  serverUrl: "https://api.thecozy.world",

  // How many times per second we tell friends where we are.
  positionUpdatesPerSecond: 12,

  // The room, its password and the relay (TURN) login are filled in here
  // by account.js, from the house server, once you've logged in.
  trysteroRoomId: null,
  trysteroPassword: null,
  turnServers: [],

  // --- Study room lo-fi music ---
  // Plays locally for each person (not synced) while standing in Study.
  // Everyone picks their own station at the Study's turntable (press E),
  // and it's remembered. These are Lofi Girl's official 24/7 radio
  // streams on YouTube, all checked as allowed to embed (2026-09-23).
  // id: a short name (saved with your choice), name: the lo-fi type shown on screen,
  // videoId: the part after "watch?v=" in the YouTube link, color: the
  // record sleeve. To add one, copy a line and change it.
  lofiStations: [
    { id: "hiphop", name: "Hip-Hop", videoId: "rFZHOHl-L8A", color: "#d9825b" },
    { id: "house", name: "House", videoId: "3PFJ9SETS4M", color: "#7a6bc8" },
    { id: "jazz", name: "Jazz", videoId: "E2vONfzoyRI", color: "#3f6f9f" },
    { id: "summer", name: "Summer", videoId: "0muHFBSiybw", color: "#f2b84a" },
    { id: "sad", name: "Sad", videoId: "CwPCy1GLS38", color: "#6f8aa8" },
    { id: "asian", name: "Asian", videoId: "1Tl2FtV06qo", color: "#e07a8a" },
    { id: "christmas", name: "Christmas", videoId: "XSXEaikz0Bc", color: "#3f7a4a" },
    { id: "medieval", name: "Medieval", videoId: "IxPANmjPaek", color: "#8a6a3e" },
  ],
  defaultLofiStation: "hiphop",

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
