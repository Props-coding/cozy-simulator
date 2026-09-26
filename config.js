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
    business: "Business Floor",
    landing: "Bedroom Hall",
    workshop: "Workshop",
    // Outside (Update 4)
    yard: "Yard",
    porch: "Porch",
    garden: "Garden",
    pond: "Pond",
    campfire: "Campfire",
    busStop: "Bus Stop",
  },

  // --- Outdoors (Update 4) ---
  // Night outside, until the live weather has told us when the sun really
  // sets and rises over the hometown: from this hour (24-hour clock) to
  // that one, on your own computer's clock.
  outdoors: {
    nightFrom: 20,
    nightTo: 6,
  },

  // Live weather: the real sky over the house's hometown shows in the yard
  // and through the windows (from Open-Meteo, free, no account needed).
  // PLACEHOLDER: the hometown below is only a stand-in until Brandon picks
  // the real one. To change it, put in the town's name and its latitude and
  // longitude (search "<town> latitude longitude"; west and south are
  // negative numbers). units: "F" or "C". refreshMinutes: how often each
  // browser checks for new weather.
  weather: {
    hometown: { name: "Seattle (placeholder)", latitude: 47.61, longitude: -122.33 },
    units: "F",
    refreshMinutes: 15,
  },

  // --- The shared garden (Update 4) ---
  // Twelve raised beds inside the garden's fence. Anyone can plant in an
  // empty bed (up to `maxPlotsPerPlayer` at once) with seeds from Hazel,
  // the gardener by the garden gate. Crops grow in real time, even while
  // nobody's in the house. Watering keeps a crop growing at full speed for
  // `waterHours`; dry, it grows at `dryGrowth` of full speed (0.4 is 40%).
  // Anyone can water anyone's bed, and rain waters every bed (while
  // someone is in the house to see it rain). Nothing ever wilts or dies.
  garden: {
    maxPlotsPerPlayer: 3,
    waterHours: 6,
    dryGrowth: 0.4,
  },

  // The crops. hours: how long it takes to grow when kept watered (it
  // shows four stages on the way: seed, sprout, growing, flowering, then
  // ripe). seed: what Hazel charges for a seed. sell: crumbs Hazel pays for
  // each one you harvest. yield: how many you harvest, [fewest, most].
  // look: how it's drawn ("root", "leafy", "berry", "vine", "flower",
  // "stalk" or "pumpkin"). color: the crop's own color.
  crops: [
    { id: "radish", name: "Radish", icon: "🌱", hours: 1, seed: 4, sell: 6, yield: [2, 3], look: "root", color: "#d9485a" },
    { id: "lettuce", name: "Lettuce", icon: "🥬", hours: 2, seed: 5, sell: 5, yield: [3, 4], look: "leafy", color: "#8fc06a" },
    { id: "carrot", name: "Carrot", icon: "🥕", hours: 3, seed: 6, sell: 8, yield: [2, 4], look: "root", color: "#e8883a" },
    { id: "strawberry", name: "Strawberry", icon: "🍓", hours: 6, seed: 12, sell: 6, yield: [4, 7], look: "berry", color: "#e0404a" },
    { id: "tomato", name: "Tomato", icon: "🍅", hours: 10, seed: 15, sell: 8, yield: [4, 7], look: "vine", color: "#e0503a" },
    { id: "sunflower", name: "Sunflower", icon: "🌻", hours: 12, seed: 10, sell: 30, yield: [1, 1], look: "flower", color: "#f2c230" },
    { id: "corn", name: "Corn", icon: "🌽", hours: 16, seed: 14, sell: 12, yield: [3, 5], look: "stalk", color: "#f0d25a" },
    { id: "pumpkin", name: "Pumpkin", icon: "🎃", hours: 24, seed: 25, sell: 90, yield: [1, 1], look: "pumpkin", color: "#e8883a" },
    { id: "blueberry", name: "Blueberries", icon: "🫐", hours: 48, seed: 30, sell: 10, yield: [9, 13], look: "berry", color: "#4a5ab8" },
  ],

  // --- Fishing at the pond (Update 4) ---
  // Stand at the pond's edge (or on the dock) and press E to cast. Wait for
  // a bite (biteSeconds, [shortest, longest]; better rods get bites
  // sooner), press E within hookSeconds when the "!" pops up, then press E
  // again while the moving marker is in the green zone to land it.
  // junkChance: how often you reel in junk instead (0.08 is 8%).
  // Every catch gives fishing XP; `levels` is the total XP for each level
  // (level 1 starts at 0). Your level decides which rods Otis will sell you.
  fishing: {
    biteSeconds: [5, 14],
    hookSeconds: 1.3,
    junkChance: 0.08,
    xp: [5, 10, 20, 40, 80], // XP for a catch of each rarity (junk gives 1)
    levels: [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1500, 2000, 2600, 3300, 4100, 5000],
    tankSize: 6, // how many fish fit in a bedroom fish tank
  },

  // Rods, from Otis the otter by the dock. level: the fishing level you need
  // before he'll sell it. zone: how wide the green "catch" zone is (0 to 1).
  // bite: how long bites take (0.6 is 40% quicker). luck: how often you
  // catch the rarer of the fish your bait can find (0 is never extra).
  rods: [
    { id: "twig", name: "Twig Rod", icon: "🎣", level: 1, price: 0, zone: 0.2, bite: 1, luck: 0 },
    { id: "bamboo", name: "Bamboo Rod", icon: "🎋", level: 3, price: 150, zone: 0.25, bite: 0.9, luck: 0.1 },
    { id: "fiberglass", name: "Fiberglass Rod", icon: "🎣", level: 6, price: 500, zone: 0.3, bite: 0.8, luck: 0.2 },
    { id: "carbon", name: "Carbon Rod", icon: "🎣", level: 10, price: 1500, zone: 0.35, bite: 0.7, luck: 0.3 },
    { id: "golden", name: "Golden Rod", icon: "✨", level: 14, price: 4000, zone: 0.4, bite: 0.6, luck: 0.4 },
  ],

  // Bait decides which fish you can catch: `catches` lists the rarities
  // (1 common, 2 uncommon, 3 rare, 4 epic, 5 legendary). Pricier bait
  // finds pricier fish. price: crumbs for one. level: fishing level needed.
  bait: [
    { id: "none", name: "No bait", icon: "🪝", price: 0, level: 1, catches: [1] },
    { id: "worm", name: "Worms", icon: "🪱", price: 3, level: 1, catches: [1, 2] },
    { id: "cricket", name: "Crickets", icon: "🦗", price: 10, level: 2, catches: [2, 3] },
    { id: "minnow", name: "Minnows", icon: "🐟", price: 25, level: 5, catches: [3, 4] },
    { id: "lure", name: "Golden Lure", icon: "🌟", price: 60, level: 9, catches: [4, 5] },
  ],

  // The fish. rarity: 1 (common) to 5 (legendary). sell: crumbs from Otis.
  // size: [smallest, biggest] in cm. Optional `when`: night (true: only at
  // night, false: only by day), rain (only while it rains), season (only in
  // these seasons). color: for fish tanks.
  fish: [
    { id: "bluegill", name: "Bluegill", icon: "🐟", rarity: 1, sell: 5, size: [8, 20], color: "#6a8ab8" },
    { id: "perch", name: "Perch", icon: "🐟", rarity: 1, sell: 6, size: [10, 25], color: "#c8b050" },
    { id: "sunfish", name: "Sunfish", icon: "🐠", rarity: 1, sell: 7, size: [8, 18], color: "#f0a040", when: { night: false } },
    { id: "shiner", name: "Moon Shiner", icon: "🐟", rarity: 1, sell: 7, size: [6, 14], color: "#c8d0e0", when: { night: true } },
    { id: "carp", name: "Carp", icon: "🐟", rarity: 2, sell: 12, size: [25, 60], color: "#a08050" },
    { id: "crayfish", name: "Crayfish", icon: "🦞", rarity: 2, sell: 13, size: [7, 15], color: "#d05a3a" },
    { id: "trout", name: "Rainbow Trout", icon: "🐟", rarity: 2, sell: 15, size: [20, 50], color: "#e08aa0", when: { season: ["spring", "autumn"] } },
    { id: "catfish", name: "Catfish", icon: "🐟", rarity: 2, sell: 16, size: [30, 80], color: "#6a6058", when: { night: true } },
    { id: "bass", name: "Largemouth Bass", icon: "🐟", rarity: 3, sell: 24, size: [25, 60], color: "#5a8a4a" },
    { id: "pike", name: "Pike", icon: "🐟", rarity: 3, sell: 28, size: [40, 100], color: "#7a9a5a" },
    { id: "koi", name: "Koi", icon: "🐠", rarity: 3, sell: 35, size: [30, 70], color: "#f07a3a", when: { night: false } },
    { id: "eel", name: "Eel", icon: "🐍", rarity: 3, sell: 32, size: [40, 110], color: "#4a4a3a", when: { rain: true } },
    { id: "sturgeon", name: "Sturgeon", icon: "🐟", rarity: 4, sell: 60, size: [80, 180], color: "#7a7a80" },
    { id: "turtle", name: "Snapping Turtle", icon: "🐢", rarity: 4, sell: 70, size: [25, 45], color: "#5a6a3a", when: { season: ["summer"] } },
    { id: "goldenCarp", name: "Golden Carp", icon: "🐠", rarity: 4, sell: 75, size: [30, 60], color: "#f2c230", when: { season: ["spring", "summer"] } },
    { id: "moonfish", name: "Moonfish", icon: "🐡", rarity: 4, sell: 80, size: [20, 40], color: "#d8d0f0", when: { night: true } },
    { id: "ghostKoi", name: "Ghost Koi", icon: "🐠", rarity: 5, sell: 150, size: [40, 80], color: "#f4f4f8" },
    { id: "rainbowKoi", name: "Rainbow Koi", icon: "🌈", rarity: 5, sell: 180, size: [40, 80], color: "#c86bb0", when: { rain: true } },
    { id: "icePike", name: "Ice Pike", icon: "🧊", rarity: 5, sell: 180, size: [60, 120], color: "#a8d8f0", when: { season: ["winter"] } },
    { id: "whiskers", name: "Old Whiskers", icon: "🐋", rarity: 5, sell: 250, size: [120, 200], color: "#4a4a44", when: { night: true, rain: true } },
  ],

  // Junk you might reel in instead. The raccoons buy it for `junkPrice`
  // crumbs a piece (talk to them by the bins).
  junkPrice: 3,
  junk: [
    { id: "boot", name: "Old Boot", icon: "👢" },
    { id: "can", name: "Tin Can", icon: "🥫" },
    { id: "weeds", name: "Pond Weeds", icon: "🌿" },
    { id: "letter", name: "Soggy Letter", icon: "✉️" },
    { id: "duck", name: "Rubber Duck", icon: "🦆" },
  ],

  // The floors the elevator goes to, bottom to top, and what's on each
  // (shown on the elevator's buttons).
  floors: [
    { name: "Ground floor", rooms: "Hallway, Theater, Study, Dinner, Library" },
    { name: "Business floor", rooms: "Offices, Conference Room, Workshop" },
    { name: "Bedrooms", rooms: "Everyone's bedroom" },
  ],

  // Faces (the wardrobe's Face tab). How strong each cheek blush is (0 is
  // invisible, 1 is solid pink), and the color of freckles.
  faces: {
    blush: { none: 0, soft: 0.35, rosy: 0.6 },
    freckleColor: "rgba(95, 50, 25, 0.7)",
  },

  // The color swatches in the wardrobe (there's also a "custom" one that
  // opens the full color picker).
  // The things you can wear, in the order their tabs show in the wardrobe
  // and on the Join screen (both are built from this list, so a slot added
  // here shows up on both). tab: the tab's id. slot: which part of your
  // look it fills (and the raccoons' item type). label: the tab's name.
  // none: what "nothing" is called. (A brand new slot also needs its
  // drawing in render.js and items in the raccoons' shop.)
  outfitSlots: [
    { tab: "hats", slot: "hat", label: "🎩 Hats", none: "No hat" },
    { tab: "shoes", slot: "shoes", label: "👟 Shoes", none: "Plain feet" },
    { tab: "glasses", slot: "glasses", label: "👓 Glasses", none: "No glasses" },
    { tab: "scarves", slot: "scarf", label: "🧣 Scarves", none: "None" },
    { tab: "backpacks", slot: "backpack", label: "🎒 Backpacks", none: "None" },
    { tab: "earrings", slot: "earrings", label: "💎 Earrings", none: "None" },
    { tab: "pets", slot: "pet", label: "🐾 Pets", none: "No pet" },
  ],

  wardrobeColors: ["#e05a47", "#e8883a", "#e8b84a", "#8fb86a", "#4f9a8a", "#5aa0d8", "#7a6bc8", "#c86bb0", "#e98ac0", "#a0703e", "#6b5a4a", "#f2ede4"],

  // The grandfather clock in the hallway chimes softly on every hour (your
  // own local time). It follows the master volume and mute, is silent in
  // Dinner, and can be turned off in Settings.
  hourlyChime: {
    on: true, // the starting setting for someone who hasn't chosen yet
    volume: 0.06, // how loud (0 to 1, before the master volume)
    strikes: true, // after the little tune, one low "bong" per hour (1 to 12)
    checkSeconds: 15, // how often to check whether the hour has changed
  },

  // Emotes. Hold the wheel key to open a wheel of emotes around your
  // character; point at one with the mouse and let go. `radius` is how far
  // the emotes sit from the middle, in pixels.
  emoteWheel: { key: "q", radius: 70 },

  // After you dance, the dance is unavailable for this many seconds
  // (counted from when it starts; dances last 5 to 7 seconds).
  danceCooldownSeconds: 12,

  // A friend's dance music fades with distance and is silent this many
  // tiles away (and from another floor). Everyone can still see dances.
  danceSoundRange: 10,

  // Speaking: while your mic hears you (louder than `threshold`, 0 to 1),
  // your character bounces gently and glows, so friends can see who's
  // talking. `holdMs` keeps it going through tiny pauses between words.
  // Only the yes/no is shared, never the sound, and only while your mic
  // is live.
  speaking: { threshold: 0.02, holdMs: 300 },

  // Whispering: stand within `range` tiles of a friend and hold `key` to
  // whisper to only them (in any room). It ends if you drift more than
  // `endRange` tiles apart.
  whisper: { key: "v", range: 1.3, endRange: 1.8 },

  // Bedrooms: everyone's door is on the upstairs landing (the bedroom
  // hallway). Doors are checked with the house server every `pollSeconds`
  // (and right away when a friend changes theirs). Doors are `doorSpacing`
  // tiles apart, starting `firstDoorX` tiles from the west wall.
  bedrooms: { pollSeconds: 20, doorSpacing: 2.8, firstDoorX: 1 },

  // Sitting: press E within this many tiles of a free seat to sit down.
  sit: { reach: 1.0 },

  // Idle animations: after this many seconds with no keys or mouse, your
  // character starts stretching, yawning and looking around (with a
  // random pause of gapMin to gapMax seconds between them). Sitting
  // characters do a gentler one.
  idle: { afterSeconds: 25, gapMin: 3, gapMax: 8 },

  // The little badge shown before an admin's name in chat and on their name
  // tag. (Who's an admin is decided by the house server, not here.)
  adminBadge: "🛡️",

  // The house owner and creator of the game. When this account is also an
  // admin (checked by the server, so nobody can fake it by picking the
  // name), they get a hand-drawn gold crown instead of the shield, and a
  // golden name tag and chat name.
  ownerName: "Props",

  // Accounts that can wear the Exalted look (a hooded robe, sigil circle,
  // floating candles and rune footsteps), switched on in their wardrobe.
  exaltedNames: ["Props"],

  // Seasonal decorations in the shared rooms: "auto" follows the calendar
  // (spring Mar to May, summer Jun to Aug, autumn Sep to Nov, winter Dec
  // to Feb), or pick one: "spring", "summer", "autumn" or "winter".
  season: "auto",

  // The little wooden sign over each room's doorway shows an icon. Keyed
  // by room id. Built-in icons (drawn to match the house): "film",
  // "pencil", "books", "openBook", "lamp", "forkKnife", "elevator", "stairs", "hammer",
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
    elevatorTop: "elevator",
    workshop: "hammer",
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
    elevatorTop: { style: "checker", color: "#d9cbb4" },
    workshop: { style: "planks", color: "#b88a5a" },
    business: { style: "planks", color: "#b9a58c" },
    landing: { style: "planks", color: "#c9a57e" },
    bedroom: { style: "carpet", color: "#b7a2c4" }, // used for every bedroom
    porch: { style: "planks", color: "#a88258" }, // (the rest of the yard is grass)
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
    elevatorTop: "#d8c3a0",
    workshop: "#c9b28a",
    business: "#dcd6cc",
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

  // --- Room reputation (Update 3) ---
  // Rooms level up (Lv. 1 to 10) the more time you spend in them. Each
  // room has a name and an icon for the level-up card and profile cards.
  // Offices count together, and so do bedrooms. `minutesForLevel` is the
  // total minutes in a room needed for Lv. 1, Lv. 2, ... Lv. 10 (so Lv. 10
  // takes 20 hours in that room). Add or remove numbers to change how
  // many levels there are.
  roomLevels: {
    rooms: {
      study: { name: "Study", icon: "📖" },
      library: { name: "Library", icon: "📚" },
      theater: { name: "Theater", icon: "🍿" },
      conference: { name: "Conference Room", icon: "🖍️" },
      dinner: { name: "Dinner", icon: "🍝" },
      workshop: { name: "Workshop", icon: "🔨" },
      office: { name: "Office", icon: "💼" },
      bedroom: { name: "Bedroom", icon: "🛏️" },
      // Outside (Update 4)
      garden: { name: "Garden", icon: "🌱" },
      pond: { name: "Pond", icon: "🎣" },
      campfire: { name: "Campfire", icon: "🔥" },
      porch: { name: "Porch", icon: "🪑" },
    },
    minutesForLevel: [10, 30, 60, 120, 210, 330, 480, 660, 900, 1200],
  },

  // --- Tiered achievements (Update 3) ---
  // Achievements that keep going: each one has tiers, from Bronze up to
  // Legend, and every tier you reach pays crumbs. `crumbs` is the reward
  // for reaching that tier.
  achievementTiers: [
    { name: "Bronze", icon: "🥉", color: "#b87a4a", crumbs: 10 },
    { name: "Silver", icon: "🥈", color: "#9aa4ae", crumbs: 25 },
    { name: "Gold", icon: "🥇", color: "#d9a441", crumbs: 50 },
    { name: "Platinum", icon: "💠", color: "#5aa0b8", crumbs: 100 },
    { name: "Diamond", icon: "💎", color: "#6a8ad8", crumbs: 200 },
    { name: "Legend", icon: "🌟", color: "#c86bb0", crumbs: 400 },
  ],

  // Each tiered achievement: `goals` is what you need for each tier, in
  // order (one number per tier above), and `desc` describes a goal, with
  // {n} standing in for the number and {s} for an "s" that's left off
  // when the number is 1 ("1 hour", "10 hours"). `stat` is what's counted:
  //   hours        hours in the house       crumbsEarned  crumbs ever earned
  //   chats        chat messages sent       focusSessions Study focus sessions finished
  //   items        things owned from the raccoons    pets  pets adopted
  //   emotesUsed   emotes used              dances        dances danced
  //   daysVisited  different days visited   sleepHours    hours asleep in bed
  //   roomLevels   all your room levels added together
  // (`was` lists older one-time achievements that turned into a tier, so
  // nobody is paid twice for the same thing. Leave it alone.)
  tieredAchievements: [
    { id: "homebody", icon: "🛋️", name: "Homebody", stat: "hours", desc: "Spend {n} hour{s} in the house.", goals: [1, 10, 25, 50, 100, 250], was: ["hour", "homebody", null, "resident"] },
    { id: "visitor", icon: "📅", name: "Frequent Visitor", stat: "daysVisited", desc: "Visit the house on {n} different day{s}.", goals: [3, 7, 30, 100, 200, 365] },
    { id: "wellRounded", icon: "🏘️", name: "Well-Rounded", stat: "roomLevels", desc: "Reach {n} room level{s} in total.", goals: [5, 15, 30, 50, 65, 80] },
    { id: "crumbs", icon: "🍪", name: "Crumb Collector", stat: "crumbsEarned", desc: "Earn {n} crumb{s}.", goals: [100, 500, 1500, 5000, 15000, 50000] },
    { id: "collector", icon: "🛍️", name: "Collector", stat: "items", desc: "Own {n} thing{s} from the raccoons.", goals: [3, 10, 20, 35, 55, 80] },
    { id: "menagerie", icon: "🐾", name: "Menagerie", stat: "pets", desc: "Adopt {n} pet{s}.", goals: [1, 3, 5, 10, 15, 19], was: ["firstPet", null, "menagerie"] },
    { id: "chatterbox", icon: "💬", name: "Chatterbox", stat: "chats", desc: "Send {n} chat message{s}.", goals: [10, 100, 500, 1500, 5000, 15000], was: [null, "chatterbox"] },
    { id: "emotes", icon: "🎭", name: "Emote-ional", stat: "emotesUsed", desc: "Use emotes {n} time{s}.", goals: [10, 50, 200, 500, 1500, 5000] },
    { id: "dancer", icon: "🕺", name: "Dance Machine", stat: "dances", desc: "Dance {n} time{s}.", goals: [1, 25, 100, 300, 1000, 3000], was: ["jig"] },
    { id: "focus", icon: "⏳", name: "Deep Focus", stat: "focusSessions", desc: "Finish {n} Study focus session{s}.", goals: [1, 5, 15, 40, 100, 250], was: ["focus", "scholar"] },
    { id: "rested", icon: "😴", name: "Well Rested", stat: "sleepHours", desc: "Sleep {n} hour{s} in bed.", goals: [0.5, 3, 10, 30, 100, 250], was: ["wellRested"] },
    // Outdoors (Update 4)
    { id: "harvester", icon: "🥕", name: "Green Thumb", stat: "harvests", desc: "Harvest {n} crop{s} from the garden.", goals: [1, 10, 40, 120, 300, 750] },
    { id: "angler", icon: "🎣", name: "Angler", stat: "fishCaught", desc: "Catch {n} fish at the pond.", goals: [1, 10, 40, 120, 300, 750] },
    { id: "goodNeighbor", icon: "💧", name: "Good Neighbor", stat: "friendsWatered", desc: "Water a friend's garden bed {n} time{s}.", goals: [1, 10, 30, 80, 200, 500] },
  ],

  // --- Titles (Update 3) ---
  // A title shows under your name tag, like "the Scholar". You earn them
  // from room levels, tiers and a few one-time achievements, and pick one
  // (or none) in your wardrobe's Titles tab. To add one, copy a line: give
  // it a new `id`, the `text` to show, and what earns it, one of:
  //   room: "study", level: 10          (a room level, see roomLevels)
  //   tier: "homebody", level: 3        (a tier, 1 Bronze ... 6 Legend)
  //   achievement: "whoAreYou"          (a one-time achievement)
  titles: [
    { id: "studious", text: "the Studious", room: "study", level: 5 },
    { id: "scholar", text: "the Scholar", room: "study", level: 10 },
    { id: "bookworm", text: "the Bookworm", room: "library", level: 5 },
    { id: "librarian", text: "the Librarian", room: "library", level: 10 },
    { id: "filmBuff", text: "the Film Buff", room: "theater", level: 5 },
    { id: "critic", text: "the Critic", room: "theater", level: 10 },
    { id: "doodler", text: "the Doodler", room: "conference", level: 5 },
    { id: "chair", text: "the Chairperson", room: "conference", level: 10 },
    { id: "foodie", text: "the Foodie", room: "dinner", level: 5 },
    { id: "gourmet", text: "the Gourmet", room: "dinner", level: 10 },
    { id: "tinkerer", text: "the Tinkerer", room: "workshop", level: 5 },
    { id: "builder", text: "the Builder", room: "workshop", level: 10 },
    { id: "hardWorker", text: "the Hard Worker", room: "office", level: 5 },
    { id: "workaholic", text: "the Workaholic", room: "office", level: 10 },
    { id: "napper", text: "the Napper", room: "bedroom", level: 5 },
    { id: "dreamer", text: "the Dreamer", room: "bedroom", level: 10 },
    { id: "greenThumb", text: "the Green Thumb", room: "garden", level: 5 },
    { id: "groundskeeper", text: "the Groundskeeper", room: "garden", level: 10 },
    { id: "pondside", text: "the Pondside Dreamer", room: "pond", level: 5 },
    { id: "lakeLegend", text: "Legend of the Pond", room: "pond", level: 10 },
    { id: "firesideTeller", text: "the Fireside Storyteller", room: "campfire", level: 5 },
    { id: "fireKeeper", text: "the Fire Keeper", room: "campfire", level: 10 },
    { id: "porchSitter", text: "the Porch Sitter", room: "porch", level: 5 },
    { id: "porchPhilosopher", text: "the Porch Philosopher", room: "porch", level: 10 },
    { id: "homebody", text: "the Homebody", tier: "homebody", level: 3 },
    { id: "resident", text: "the Resident", tier: "homebody", level: 5 },
    { id: "hearthKeeper", text: "the Hearth Keeper", tier: "homebody", level: 6 },
    { id: "regular", text: "the Regular", tier: "visitor", level: 3 },
    { id: "faithful", text: "the Faithful", tier: "visitor", level: 6 },
    { id: "wellTraveled", text: "the Well-Traveled", tier: "wellRounded", level: 4 },
    { id: "houseMaster", text: "Master of the House", tier: "wellRounded", level: 6 },
    { id: "crumbBaron", text: "the Crumb Baron", tier: "crumbs", level: 4 },
    { id: "crumbTycoon", text: "the Crumb Tycoon", tier: "crumbs", level: 6 },
    { id: "fashionista", text: "the Fashionista", tier: "collector", level: 4 },
    { id: "petWhisperer", text: "the Pet Whisperer", tier: "menagerie", level: 3 },
    { id: "zookeeper", text: "the Zookeeper", tier: "menagerie", level: 6 },
    { id: "chatterbox", text: "the Chatterbox", tier: "chatterbox", level: 3 },
    { id: "storyteller", text: "the Storyteller", tier: "chatterbox", level: 5 },
    { id: "expressive", text: "the Expressive", tier: "emotes", level: 4 },
    { id: "dancer", text: "the Dancer", tier: "dancer", level: 3 },
    { id: "danceLegend", text: "the Dance Legend", tier: "dancer", level: 6 },
    { id: "focused", text: "the Focused", tier: "focus", level: 3 },
    { id: "zenMaster", text: "the Zen Master", tier: "focus", level: 6 },
    { id: "sleepyhead", text: "the Sleepyhead", tier: "rested", level: 3 },
    { id: "snoozer", text: "the Snoozer Supreme", tier: "rested", level: 6 },
    { id: "raccoonFriend", text: "Friend of Raccoons", achievement: "whoAreYou" },
    { id: "gardener", text: "the Gardener", tier: "harvester", level: 3 },
    { id: "harvestMoon", text: "the Harvest Moon", tier: "harvester", level: 6 },
    { id: "goodNeighbor", text: "the Good Neighbor", tier: "goodNeighbor", level: 3 },
    { id: "rainmaker", text: "the Rainmaker", tier: "goodNeighbor", level: 6 },
    { id: "pumpkinChampion", text: "the Pumpkin Champion", achievement: "greatPumpkin" },
    { id: "angler", text: "the Angler", tier: "angler", level: 3 },
    { id: "masterAngler", text: "the Master Angler", tier: "angler", level: 6 },
    { id: "fishWhisperer", text: "the Fish Whisperer", achievement: "legendCatch" },
    { id: "treasureHunter", text: "the Treasure Hunter", achievement: "junkDealer" },
    { id: "nightOwl", text: "the Night Owl", achievement: "nightOwl" },
    { id: "earlyBird", text: "the Early Bird", achievement: "earlyBird" },
  ],

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
