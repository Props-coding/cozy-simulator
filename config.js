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
  },

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
