// Settings you might want to change. Comments explain each one.

const CONFIG = {
  // How fast your character walks, in grid units per second (a "grid
  // unit" is roughly one floor tile; each room is about 6 units wide).
  playerSpeed: 5,

  // Tips and fun lines on the loading screen (a new one every few
  // seconds). Add as many as you like.
  loadingTips: [
    "Tip: the room you stand in decides who you hear.",
    "Tip: press E near almost anything to use it.",
    "Tip: step into bed to sleep. Friends see a little moon.",
    "Tip: rain in the hometown waters everyone's garden.",
    "Tip: the big fish come out at night. Bring good bait.",
    "Tip: experiment at the stove. Burnt things still sell (to raccoons).",
    "Tip: Juniper the fox comes on the bus every Friday.",
    "Tip: the fortune cookie jar in the Dinner room has one for you every day.",
    "Tip: hold 1 to 5 for a quick emote.",
    "Tip: knock before walking into a friend's room.",
    "Tip: eat a dish for a 30-minute boost. Hover the bubble by your crumbs to see it.",
    "Tip: put things up on Porch Swap (the laptop in your bedroom), even while you're away.",
    "The raccoons would like you to know they are three raccoons. (They are.)",
    "Otis says the fish are biting. Otis always says that.",
    "Hazel has watered 4,000 plants. None of them have said thank you.",
    "The moths are regulars here. They come for the light.",
    "Someone left the porch light on for you.",
    "Fluffing the pillows...",
    "Sweeping the porch...",
    "Checking under the bed for dust bunnies...",
  ],

  // --- Art ---
  // outlines: a soft darker outline around every object (the detail
  // standard). Computers that struggle turn them off for themselves;
  // false turns them off for everyone.
  art: {
    outlines: true,
  },

  // --- Voices ---
  // Voice chat is on in every room except the Study. Inside a room, the
  // further away a friend stands, the quieter they sound: full volume
  // within `fullWithin` steps, fading down to `quietest` (0 = silent,
  // 1 = no fading at all) by `fadeTo` steps away. (A step is one floor tile.)
  voice: {
    fullWithin: 3,
    fadeTo: 12,
    quietest: 0.2,
  },

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
    lounge: "Lounge",
    games: "Games Floor",
    arcade: "Arcade",
    suite: "Suite Floor",
    workshop: "Workshop",
    // Outside (Update 4)
    yard: "Yard",
    porch: "Porch",
    garden: "Garden",
    pond: "Pond",
    campfire: "Campfire",
    busStop: "Bus Stop",
    lake: "Willow Lake",
    alley: "Back Alley",
    farm: "The Farm",
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
    maxPlotsPerPlayer: 4, // beds each person can grow in at once (the yard's three and the Farm's sixteen are shared)
    waterHours: 6,
    dryGrowth: 0.4,
    // Hazel's lesson (Update 8): the radish you plant with her grows in
    // this many minutes, once watered, so you see it through in one visit.
    lessonMinutes: 3,
    lessonReward: 15, // crumbs Hazel pays when you show her your first harvest
  },

  // The crops. hours: how long it takes to grow when kept watered (it
  // shows four stages on the way: seed, sprout, growing, flowering, then
  // ripe). seed: what Hazel charges for a seed. sell: crumbs Hazel pays for
  // each one you harvest. yield: how many you harvest, [fewest, most].
  // look: how it's drawn ("root", "leafy", "berry", "vine", "flower",
  // "stalk" or "pumpkin"). color: the crop's own color. starter: grows in
  // the yard's starter patch too (everything grows at the Farm).
  crops: [
    { id: "radish", name: "Radish", hours: 1, seed: 4, sell: 6, yield: [2, 3], look: "root", color: "#d9485a", starter: true },
    { id: "lettuce", name: "Lettuce", hours: 2, seed: 5, sell: 5, yield: [3, 4], look: "leafy", color: "#8fc06a", starter: true },
    { id: "carrot", name: "Carrot", hours: 3, seed: 6, sell: 8, yield: [2, 4], look: "root", color: "#e8883a", starter: true },
    { id: "strawberry", name: "Strawberry", hours: 6, seed: 12, sell: 6, yield: [4, 7], look: "berry", color: "#e0404a" },
    { id: "tomato", name: "Tomato", hours: 10, seed: 15, sell: 8, yield: [4, 7], look: "vine", color: "#e0503a" },
    { id: "sunflower", name: "Sunflower", hours: 12, seed: 10, sell: 30, yield: [1, 1], look: "flower", color: "#f2c230" },
    { id: "corn", name: "Corn", hours: 16, seed: 14, sell: 12, yield: [3, 5], look: "stalk", color: "#f0d25a" },
    { id: "pumpkin", name: "Pumpkin", hours: 24, seed: 25, sell: 90, yield: [1, 1], look: "pumpkin", color: "#e8883a" },
    { id: "blueberry", name: "Blueberries", hours: 48, seed: 30, sell: 10, yield: [9, 13], look: "berry", color: "#4a5ab8" },
    // Only from the traveling merchant (Update 5): `merchant` seeds aren't at Hazel's.
    { id: "starfruit", name: "Starfruit", hours: 20, seed: 45, sell: 40, yield: [2, 3], look: "vine", color: "#f2d24a", merchant: true },
    { id: "moonflower", name: "Moonflower", hours: 18, seed: 40, sell: 55, yield: [1, 1], look: "flower", color: "#dfe4ff", merchant: true },
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
    lessonReward: 25, // crumbs Otis pays for your very first fish (you hand it to him)
    biteSeconds: [8, 18],
    hookSeconds: 1.3,
    junkChance: 0.08,
    xp: [5, 10, 20, 40, 80], // XP for a catch of each rarity (junk gives 1)
    levels: [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1500, 2000, 2600, 3300, 4100, 5000],
    tankSize: 6, // how many fish fit in a bedroom fish tank
    castReach: 4.5, // how far you can aim a cast (click the pond), in steps

    // Where the fish are. The pond at home is for beginners: only fish up
    // to `maxRarity` (1 common, 2 uncommon, 3 rare, 4 epic, 5 legendary)
    // live there. Willow Lake (by bus) has every fish, more shadows, and
    // bigger ones (`bigger` makes large shadows more common).
    waters: {
      pond: { maxRarity: 2, shadowCount: 5 },
      lake: { maxRarity: 5, shadowCount: 11, bigger: 0.18 },
    },

    // Fish shadows swimming in the pond (the same for everyone). Cast
    // near one: a bigger shadow is a better, bigger fish. `reach` is how
    // close (in steps) a shadow has to come to your bobber to bite. With no
    // shadow near, a small fish bites after the longest wait. Each size:
    // how often it shows up (`chance`), how much more often the rarer of
    // your bait's fish bite (`rarer`), which part of a fish's size range it
    // gives (`sizes`, 0 smallest to 1 biggest) and how big it's drawn.
    shadows: {
      count: 5,
      reach: 0.9,
      small: { chance: 0.55, rarer: 0, sizes: [0, 0.5], scale: 0.7 },
      medium: { chance: 0.32, rarer: 0.35, sizes: [0.25, 0.8], scale: 1 },
      large: { chance: 0.13, rarer: 0.9, sizes: [0.55, 1], scale: 1.45 },
    },

    // Nibbles before the real bite: the bobber twitches this many times
    // ([fewest, most]), `nibbleSeconds` apart. Pressing E on a nibble
    // spooks the fish (cast again; no bait is used).
    nibbles: [1, 3],
    nibbleSeconds: [0.7, 1.4],

    // The tension reel. Hold Space (or the mouse) to reel in, let go to
    // give line. Tension rises while you reel (faster the harder the fish
    // pulls) and falls when you let go. At 1 the line snaps; below
    // `slackAt` for `slackSeconds` the fish slips away. Reeling brings the
    // fish in by `reelSpeed` a second (a full line is 1); giving line lets
    // it swim back out a little. Rarer fish pull harder (`rarityPull` more
    // per rarity), and better rods take the strain better.
    reel: {
      start: 0.25, // how far in the fish starts (0 to 1)
      reelSpeed: 0.22,
      giveBack: 0.08,
      tensionUp: 0.55,
      tensionDown: 0.7,
      slackAt: 0.08,
      slackSeconds: 1.5,
      rarityPull: 0.14,
    },
    // How each kind of fish pulls (fish below say which): steady (an even
    // pull), darting (sudden hard tugs), heavy (a strong, slow pull).
    pulls: {
      steady: { pull: 0.9, tug: 0, every: [0, 0] },
      darting: { pull: 0.7, tug: 1.1, every: [0.8, 1.8] },
      heavy: { pull: 1.25, tug: 0.25, every: [2.5, 4] },
    },
  },

  // Rods, from Otis the otter by the dock. level: the fishing level you need
  // before he'll sell it. zone: how well it takes the strain while reeling
  // (0.2 to 0.4: a stronger rod's tension rises more slowly).
  // bite: how long bites take (0.6 is 40% quicker). luck: how often you
  // catch the rarer of the fish your bait can find (0 is never extra).
  rods: [
    { id: "twig", name: "Twig Rod", level: 1, price: 0, zone: 0.2, bite: 1, luck: 0 },
    { id: "bamboo", name: "Bamboo Rod", level: 3, price: 150, zone: 0.25, bite: 0.9, luck: 0.1 },
    { id: "fiberglass", name: "Fiberglass Rod", level: 6, price: 500, zone: 0.3, bite: 0.8, luck: 0.2 },
    { id: "carbon", name: "Carbon Rod", level: 10, price: 1500, zone: 0.35, bite: 0.7, luck: 0.3 },
    { id: "golden", name: "Golden Rod", level: 14, price: 4000, zone: 0.4, bite: 0.6, luck: 0.4 },
  ],

  // Bait decides which fish you can catch: `catches` lists the rarities
  // (1 common, 2 uncommon, 3 rare, 4 epic, 5 legendary). Pricier bait
  // finds pricier fish. price: crumbs for one. level: fishing level needed.
  bait: [
    { id: "none", name: "No bait", price: 0, level: 1, catches: [1] },
    { id: "worm", name: "Worms", price: 2, level: 1, catches: [1, 2] },
    { id: "cricket", name: "Crickets", price: 5, level: 2, catches: [2, 3] },
    { id: "minnow", name: "Minnows", price: 12, level: 5, catches: [3, 4] },
    { id: "lure", name: "Golden Lure", price: 30, level: 9, catches: [4, 5] },
    // Only from the traveling merchant (Update 5): finds rare to legendary fish at any level.
    { id: "glowworm", name: "Glow Worms", price: 35, level: 1, catches: [3, 4, 5], merchant: true },
  ],

  // The fish. rarity: 1 (common) to 5 (legendary). sell: crumbs from Otis.
  // (Prices were halved after the audit: steady fishing paid 1,100 to 2,000
  // crumbs an hour, against 60 an hour for time in the house. Now about
  // 450 to 800.)
  // size: [smallest, biggest] in cm. Optional `when`: night (true: only at
  // night, false: only by day), rain (only while it rains), season (only in
  // these seasons). color: for fish tanks.
  fish: [
    { id: "bluegill", name: "Bluegill", rarity: 1, sell: 3, size: [8, 20], pull: "steady", color: "#6a8ab8" },
    { id: "perch", name: "Perch", rarity: 1, sell: 3, size: [10, 25], pull: "darting", color: "#c8b050" },
    { id: "sunfish", name: "Sunfish", rarity: 1, sell: 4, size: [8, 18], pull: "steady", color: "#f0a040", when: { night: false } },
    { id: "shiner", name: "Moon Shiner", rarity: 1, sell: 4, size: [6, 14], pull: "darting", color: "#c8d0e0", when: { night: true } },
    { id: "carp", name: "Carp", rarity: 2, sell: 6, size: [25, 60], pull: "heavy", color: "#a08050" },
    { id: "crayfish", name: "Crayfish", rarity: 2, sell: 6, size: [7, 15], pull: "darting", color: "#d05a3a" },
    { id: "trout", name: "Rainbow Trout", rarity: 2, sell: 8, size: [20, 50], pull: "darting", color: "#e08aa0", when: { season: ["spring", "autumn"] } },
    { id: "catfish", name: "Catfish", rarity: 2, sell: 8, size: [30, 80], pull: "heavy", color: "#6a6058", when: { night: true } },
    { id: "bass", name: "Largemouth Bass", rarity: 3, sell: 12, size: [25, 60], pull: "darting", color: "#5a8a4a" },
    { id: "pike", name: "Pike", rarity: 3, sell: 14, size: [40, 100], pull: "darting", color: "#7a9a5a" },
    { id: "koi", name: "Koi", rarity: 3, sell: 18, size: [30, 70], pull: "steady", color: "#f07a3a", when: { night: false } },
    { id: "eel", name: "Eel", rarity: 3, sell: 16, size: [40, 110], pull: "darting", color: "#4a4a3a", when: { rain: true } },
    // (Update 8) Only on full moon nights, at Willow Lake.
    { id: "moonfish", name: "Moonfish", rarity: 4, sell: 60, size: [30, 70], pull: "darting", color: "#c8d4ec", when: { night: true, fullMoon: true } },
    { id: "sturgeon", name: "Sturgeon", rarity: 4, sell: 30, size: [80, 180], pull: "heavy", color: "#7a7a80" },
    { id: "turtle", name: "Snapping Turtle", rarity: 4, sell: 35, size: [25, 45], pull: "heavy", color: "#5a6a3a", when: { season: ["summer"] } },
    { id: "goldenCarp", name: "Golden Carp", rarity: 4, sell: 38, size: [30, 60], pull: "steady", color: "#f2c230", when: { season: ["spring", "summer"] } },
    { id: "moonfish", name: "Moonfish", rarity: 4, sell: 40, size: [20, 40], pull: "darting", color: "#d8d0f0", when: { night: true } },
    { id: "ghostKoi", name: "Ghost Koi", rarity: 5, sell: 75, size: [40, 80], pull: "steady", color: "#f4f4f8" },
    { id: "rainbowKoi", name: "Rainbow Koi", rarity: 5, sell: 90, size: [40, 80], pull: "darting", color: "#c86bb0", when: { rain: true } },
    { id: "icePike", name: "Ice Pike", rarity: 5, sell: 90, size: [60, 120], pull: "darting", color: "#a8d8f0", when: { season: ["winter"] } },
    { id: "whiskers", name: "Old Whiskers", rarity: 5, sell: 125, size: [120, 200], pull: "heavy", color: "#4a4a44", when: { night: true, rain: true } },
  ],

  // Junk you might reel in instead. The raccoons buy it for `junkPrice`
  // crumbs a piece (talk to them in the back alley).
  junkPrice: 3,
  junk: [
    { id: "boot", name: "Old Boot" },
    { id: "can", name: "Tin Can" },
    { id: "weeds", name: "Pond Weeds" },
    { id: "letter", name: "Soggy Letter" },
    { id: "duck", name: "Rubber Duck" },
  ],

  // --- The kitchen (Update 5) ---
  // Cook at the Dinner room's stove (press E there). Crops and fish come
  // from your own garden and the pond; the basics that can't be grown come
  // from the fridge and pantry (press E at the fridge), for `price` crumbs.
  // Put 2 to 4 things in the pot and cook: a known mix makes that dish
  // (and it's added to your recipe book); anything else makes a Burnt
  // Mystery (the raccoons will buy it, as junk).
  // --- Mini games (Update 10) ---
  // Each has a door on the Games floor's corridor. `seconds`: how long a
  // round lasts. Crumbs for a round: `crumbsPerPoint` of your score, up to
  // `maxCrumbs`, and up to `crumbsPerDay` in all a day. (The house server
  // checks the score against the time played: no more than `maxPerSecond`
  // points a second, plus `base`.) `color`: the door's paint.
  minigames: {
    crumbsPerDay: 60,
    games: [
      { id: "snowball", name: "Snowball Arena", color: "#8fd0f0", seconds: 60, maxPerSecond: 1.5, base: 3, crumbsPerPoint: 0.5, maxCrumbs: 15, blurb: "A snowy courtyard full of cheeky snow critters. Hit them before they hit you!", how: "WASD or arrow keys to move, click to throw a snowball." },
      { id: "crumbRush", name: "Crumb Rush", color: "#e8b84a", seconds: 45, maxPerSecond: 3, base: 3, crumbsPerPoint: 0.25, maxCrumbs: 15, blurb: "The kitchen floor is covered in crumbs. Grab them all before the robot vacuum does!", how: "WASD or arrow keys to move. Golden crumbs are worth three. Don't get vacuumed." },
      { id: "treasureDive", name: "Treasure Dive", color: "#3f8ab0", seconds: 60, maxPerSecond: 2, base: 3, crumbsPerPoint: 0.3, maxCrumbs: 15, blurb: "Dive the pond's deep end for coins and pearls. Mind the jellyfish, and come up for air.", how: "Space (or up) to swim up, left and right to steer. Bubbles refill your air." },
      { id: "scarecrow", name: "The Scarecrow", color: "#c9a45a", seconds: 60, maxPerSecond: 0.4, base: 1, crumbsPerPoint: 2, maxCrumbs: 15, blurb: "Sneak across the field to the scarecrow. Freeze when it turns around!", how: "Arrow keys or WASD to sneak. If it sees you move, back to the start." },
      { id: "ghostHunt", name: "Ghost Hunt", color: "#b8a8d8", soon: true },
      { id: "nightMeadow", name: "Night Meadow", color: "#3a4a6a", soon: true },
      { id: "kitchenRush", name: "Kitchen Rush", color: "#e05a47", soon: true },
      { id: "cellarCrawl", name: "Cellar Crawl", color: "#6a5a4a", soon: true },
    ],
  },

  // --- The Arcade (Update 9) ---
  arcade: {
    // The cabinets. Tickets for a play: `ticketsPerPoint` of your score, up
    // to `maxTickets`. (The house server checks a play took real time: no
    // score higher than `maxPerSecond` points a second, plus `base`, over
    // at most `maxSeconds`.)
    games: [
      { id: "snake", name: "Crumb Snake", ticketsPerPoint: 1, maxTickets: 40, maxPerSecond: 1.2, base: 3, maxSeconds: 300, how: "Arrow keys (or WASD) to steer. Eat the crumbs, don't bite your tail." },
      { id: "moths", name: "Moth Catcher", ticketsPerPoint: 1, maxTickets: 40, maxPerSecond: 1.5, base: 3, maxSeconds: 46, how: "Left and right (or A and D) to move the jar. Catch the moths, let the leaves fall." },
    ],
    ticketsPerDay: 300, // the most tickets the cabinets pay in a day
    // Tickets into crumbs at the prize counter: `ticketsPerCrumb` tickets
    // make a crumb, up to `crumbsPerDay` crumbs a day.
    ticketsPerCrumb: 10,
    crumbsPerDay: 30,
    // Prizes at the counter, for tickets (arcade-only: never sold anywhere
    // else). decor: a Nest & Nook piece for your room; owned: a raccoon
    // catalog item (a hat).
    prizes: [
      { id: "plushFrog", decor: "plushFrog", tickets: 150 },
      { id: "plushOtter", decor: "plushOtter", tickets: 200 },
      { id: "plushRaccoon", decor: "plushRaccoon", tickets: 250 },
      { id: "neonStar", decor: "neonStar", tickets: 300 },
      { id: "prizeCrown", owned: "prizeCrown", tickets: 500 },
      { id: "miniArcade", decor: "miniArcade", tickets: 800 },
    ],
    // The claw machine: `cost` crumbs a go, and a `winChance` (0 to 1)
    // chance of one of the plushies.
    claw: { cost: 5, winChance: 0.3, plushies: ["plushFrog", "plushOtter", "plushRaccoon"] },
    // The capsule machine: `cost` crumbs for a random enamel pin (collect
    // all eight).
    capsule: {
      cost: 3,
      pins: [
        { id: "moth", name: "Moth Pin", color: "#8a7488" },
        { id: "leaf", name: "Leaf Pin", color: "#5fa052" },
        { id: "fish", name: "Fish Pin", color: "#3f8ab0" },
        { id: "mask", name: "Raccoon Mask Pin", color: "#5a5a64" },
        { id: "star", name: "Star Pin", color: "#e8b43a" },
        { id: "crumb", name: "Crumb Pin", color: "#c98f3c" },
        { id: "moon", name: "Moon Pin", color: "#c8d4ec" },
        { id: "house", name: "Porch Light Pin", color: "#e05a47" },
      ],
    },
  },

  // --- Night & Mothman (Update 8) ---
  night: {
    // Things for Mothman (basket items "night:<id>"). Lightbulbs and
    // lanterns are sold at the Workshop's toolbox for `price` crumbs;
    // fireflies are caught outdoors at night (price 0: never sold).
    items: [
      { id: "lightbulb", name: "Lightbulb", price: 6 },
      { id: "lantern", name: "Paper Lantern", price: 15 },
      { id: "firefly", name: "Firefly in a Jar", price: 0 },
    ],
    // Catching fireflies (yard or Willow Lake, at night): one every
    // `fireflyEvery` seconds, `firefliesPerNight` a night.
    fireflyEvery: 30,
    firefliesPerNight: 8,
    // The porch light: every night from `hour`:00 for `minutes` minutes
    // (hometown time), moths swarm the porch lanterns with Mothman leading.
    // Watching pays `crumbs` once a night.
    porchLight: { hour: 21, minutes: 20, crumbs: 15 },
    // Lamp visits: the chance (0 to 1) that Mothman is sitting by your
    // bedside lamp when you arrive at night.
    lampVisitChance: 0.35,
    // What Mothman gives friends, at so many hearts: a title (through an
    // achievement), a raccoon-catalog item (hat, backpack, pet) or a
    // Nest & Nook piece.
    rewards: [
      { hearts: 2, achievement: "believer" },
      { hearts: 4, owned: "mothAntennae" },
      { hearts: 6, owned: "mothWings" },
      { hearts: 8, owned: "mothPet" },
      { hearts: 10, decor: "mothPlush" },
    ],
  },

  // --- House extras (Update 7) ---
  extras: {
    // The wishing well in the yard: one coin (crumb) a day, and a small
    // surprise. Each reward's `weight` is how likely it is compared with the
    // others; crumbs rewards give between `min` and `max`.
    wishingWell: {
      cost: 1,
      rewards: [
        { kind: "crumbs", min: 2, max: 12, weight: 50 },
        { kind: "seed", weight: 20 },
        { kind: "bait", id: "worm", n: 3, weight: 15 },
        { kind: "food", weight: 10 },
        { kind: "crumbs", min: 20, max: 30, weight: 5 },
      ],
    },
    // Pixel art (canvases, posters and rugs from Nest & Nook's art aisle):
    // 16 by 16 squares, painted from these 16 colors (the first is the
    // blank canvas).
    palette: ["#f4ecdc", "#2e2a2a", "#7a5c3e", "#c8a27a", "#e05a47", "#f0a05a", "#f2c94c", "#8fc06a", "#3f7a42", "#7fc4d8", "#3a6ea5", "#8a6ab0", "#e89ab8", "#ffffff", "#9a958c", "#5a3a2a"],
    // Library books: how long a book can be, and how many one person can
    // have on the shelves.
    bookLength: 6000,
    booksEach: 20,
    // A few books that are always on the Library's shelves.
    libraryBooks: [
      {
        title: "A Short History of This House",
        author: "Unknown (the handwriting is very neat)",
        kind: "lore",
        text: "Nobody remembers who built the house. The deed in the attic lists the owner as \"whoever is home\", which the town clerk accepted, apparently without questions.\n\nThe porch light has never been switched off. Not once. There is no switch.\n\nEvery few years someone finds a new room. Usually it is a closet. Once it was an elevator. Nobody asks where the elevator goes when nobody is in it.",
      },
      {
        title: "Fishing for Beginners",
        author: "Otis",
        kind: "guide",
        text: "hello! otis here.\n\n1. stand at the water's edge and press E. or click the water to aim at a shadow.\n2. wait. the bobber twitches when a fish nibbles. do NOT strike on a nibble. i cannot stress this enough.\n3. big splash and a \"!\"? press E!\n4. hold space to reel. line bar going red? let go a moment.\n\nthe big ones come out at night. the eels love rain. the lake has the fancy fish. the pond has tiddlers and boots.\n\n-o",
      },
      {
        title: "Totally Normal Trash: A Memoir",
        author: "R. (a tall gentleman)",
        kind: "story",
        text: "I have always been a tall gentleman. Ask anyone. Ask my legs.\n\nWe moved to the alley for the atmosphere. The yard had too much daylight and a hedgehog who kept asking about licenses. The alley has a cat, a neon sign, and a dumpster that is, legally speaking, not a shop.\n\nIf you find a note that says \"Moved\", it was probably me. I move a lot. For business reasons. Which I do not have. Because I am not a business.",
      },
    ],
  },

  kitchen: {
    pantry: [
      { id: "flour", name: "Flour", price: 3, shelf: "pantry" },
      { id: "sugar", name: "Sugar", price: 3, shelf: "pantry" },
      { id: "rice", name: "Rice", price: 4, shelf: "pantry" },
      { id: "honey", name: "Honey", price: 6, shelf: "pantry" },
      { id: "salt", name: "Salt & Spices", price: 2, shelf: "pantry" },
      { id: "egg", name: "Eggs", price: 3, shelf: "fridge" },
      { id: "milk", name: "Milk", price: 3, shelf: "fridge" },
      { id: "butter", name: "Butter", price: 4, shelf: "fridge" },
      { id: "cheese", name: "Cheese", price: 6, shelf: "fridge" },
    ],
    burnt: { id: "burnt", name: "Burnt Mystery" },

    // Eating a dish gives its boost for `boostMinutes` (one boost at a
    // time: a new one replaces the old). The boosts:
    boostMinutes: 30,
    boosts: {
      cozy: { name: "Cozy", desc: "An extra crumb every minute you're in the house." },
      quickBite: { name: "Quick Bites", desc: "Fish bite sooner (about 30% quicker)." },
      lucky: { name: "Lucky", desc: "Rarer fish bite more often." },
      greenThumb: { name: "Green Thumb", desc: "One extra crop from every harvest." },
    },

    // The recipes. ingredients: "crop:tomato" (from the garden),
    // "food:egg" (from the fridge or pantry), "fish" (any fish) or
    // "fish:goldenCarp" (that fish). sell: what Hazel pays for one.
    // boost: what eating it does. learn: how you can learn it besides
    // cooking it by chance: "hazel" or "otis" (they sell the recipe for
    // `price`), or "merchant" (only from the traveling merchant, and it
    // can't be found by chance). hint: shown before you know it.
    recipes: [
      { id: "pancakes", name: "Pancakes", ingredients: ["food:flour", "food:egg", "food:milk"], sell: 18, boost: "cozy", hint: "A breakfast stack: from the pantry and fridge." },
      { id: "honeyToast", name: "Honey Toast", ingredients: ["food:flour", "food:butter", "food:honey"], sell: 20, boost: "cozy", hint: "Golden and sticky." },
      { id: "omelette", name: "Cheese Omelette", ingredients: ["food:egg", "food:egg", "food:cheese"], sell: 18, boost: "quickBite", hint: "Two of one thing, and something from the fridge." },
      { id: "pickles", name: "Radish Pickles", ingredients: ["crop:radish", "crop:radish", "food:salt"], sell: 20, boost: "greenThumb", hint: "Something quick-growing, in a jar." },
      { id: "salad", name: "Garden Salad", ingredients: ["crop:lettuce", "crop:tomato", "crop:carrot"], sell: 40, boost: "greenThumb", hint: "Three things from the garden, nothing else.", learn: "hazel", price: 40 },
      { id: "carrotCake", name: "Carrot Cake", ingredients: ["crop:carrot", "food:flour", "food:sugar", "food:egg"], sell: 45, boost: "cozy", hint: "A cake with a vegetable in it.", learn: "hazel", price: 50 },
      { id: "jam", name: "Strawberry Jam", ingredients: ["crop:strawberry", "crop:strawberry", "food:sugar"], sell: 32, boost: "cozy", hint: "Berries, twice, and something sweet." },
      { id: "smoothie", name: "Berry Smoothie", ingredients: ["crop:strawberry", "crop:blueberry", "food:milk"], sell: 30, boost: "lucky", hint: "Two kinds of berry, blended." },
      { id: "blueberryPancakes", name: "Blueberry Pancakes", ingredients: ["food:flour", "food:egg", "food:milk", "crop:blueberry"], sell: 36, boost: "lucky", hint: "A breakfast stack, with something blue." },
      { id: "tomatoSoup", name: "Tomato Soup", ingredients: ["crop:tomato", "crop:tomato", "food:butter"], sell: 30, boost: "quickBite", hint: "Red, warm, and buttery." },
      { id: "chowder", name: "Corn Chowder", ingredients: ["crop:corn", "food:milk", "food:butter"], sell: 36, boost: "cozy", hint: "Something yellow from the garden, made creamy." },
      { id: "popcorn", name: "Popcorn", ingredients: ["crop:corn", "food:butter", "food:salt"], sell: 26, boost: "cozy", hint: "The Theater's favorite." },
      { id: "sunflowerSeeds", name: "Roasted Sunflower Seeds", ingredients: ["crop:sunflower", "food:salt"], sell: 40, boost: "lucky", hint: "A tall flower, salted." },
      { id: "pumpkinPie", name: "Pumpkin Pie", ingredients: ["crop:pumpkin", "food:flour", "food:sugar", "food:egg"], sell: 130, boost: "greenThumb", hint: "The biggest thing in the garden, baked.", learn: "hazel", price: 90 },
      { id: "pumpkinSoup", name: "Pumpkin Soup", ingredients: ["crop:pumpkin", "food:milk", "food:butter"], sell: 115, boost: "cozy", hint: "The biggest thing in the garden, as soup." },
      { id: "risotto", name: "Veggie Risotto", ingredients: ["food:rice", "crop:carrot", "food:cheese", "food:butter"], sell: 40, boost: "greenThumb", hint: "Creamy rice, with something orange." },
      { id: "grilledFish", name: "Grilled Fish", ingredients: ["fish", "food:salt"], sell: 18, boost: "quickBite", hint: "Any fish, simply done.", learn: "otis", price: 25 },
      { id: "sushi", name: "Sushi", ingredients: ["fish", "food:rice"], sell: 26, boost: "lucky", hint: "Any fish, with something from the pantry.", learn: "otis", price: 35 },
      { id: "fishTacos", name: "Fish Tacos", ingredients: ["fish", "crop:corn", "crop:tomato"], sell: 45, boost: "lucky", hint: "Any fish, and two things from the garden." },
      { id: "fishStew", name: "Fisherman's Stew", ingredients: ["fish", "fish", "crop:carrot", "food:salt"], sell: 50, boost: "quickBite", hint: "Two fish, and something orange.", learn: "otis", price: 45 },
      // Only from the traveling merchant:
      { id: "carpCurry", name: "Golden Carp Curry", ingredients: ["fish:goldenCarp", "food:rice", "food:salt"], sell: 90, boost: "lucky", hint: "A traveler's recipe.", learn: "merchant", price: 80 },
      { id: "starfruitTart", name: "Starfruit Tart", ingredients: ["crop:starfruit", "food:flour", "food:sugar", "food:butter"], sell: 110, boost: "cozy", hint: "A traveler's recipe.", learn: "merchant", price: 80 },
      { id: "moonTea", name: "Moonflower Tea", ingredients: ["crop:moonflower", "food:honey"], sell: 95, boost: "quickBite", hint: "A traveler's recipe.", learn: "merchant", price: 70 },
    ],

    // Fortune cookies: one a day each from the jar on the kitchen counter
    // (the day changes at midnight in the hometown). `bonusChance` of them
    // hide a little extra (bonusCrumbs [fewest, most], or a seed).
    fortuneBonusChance: 0.12,
    fortuneBonusCrumbs: [10, 30],
    fortunes: [
      "You will find a sock you thought was lost forever.",
      "A raccoon is thinking about you right now. Maybe too much.",
      "Water your plants. They know when you forget.",
      "Today is a good day to sit in a comfy chair.",
      "The fish are plotting something. Stay alert.",
      "Someone in this house thinks you're great.",
      "Your next snack will be exactly what you needed.",
      "Beware of stairs. Take the elevator.",
      "A small kindness today comes back tomorrow.",
      "You will laugh at something that isn't even that funny.",
      "The pond knows your secrets.",
      "Good news arrives by bus.",
      "You are one nap away from greatness.",
      "Hazel says hi. She always says hi.",
      "An old boot holds untold treasure. Probably not, though.",
      "Your plants are proud of you.",
      "Help! I'm trapped in a fortune cookie factory! (Just kidding.)",
      "Rest is productive too.",
      "The best seat in the house is the one you're in.",
      "Someone will ask you to watch a video. Say yes.",
      "A lucky catch is in your future. Bring bait.",
      "Tea solves most things.",
      "You'll remember the name of that song at 3 in the morning.",
      "The raccoons are not three raccoons. (They are.)",
      "Wear the hat. You know the one.",
    ],
  },

  // --- Porch Swap, the trading website (Update 5; was a stall in the yard) ---
  // On the bedroom laptop: friends trade basket things. List something
  // for crumbs, or ask for a swap. Listed things wait there (even
  // while you're away) and come back to you if nobody takes them within
  // `listingDays`. Each person can have `maxListings` at once.
  tradingPost: {
    maxListings: 5,
    listingDays: 7,
  },

  // --- The traveling merchant (Update 5) ---
  // Juniper the fox comes on the bus every `day` (0 Sunday to 6 Saturday,
  // in the hometown) and stays all day, with a few things you can't get
  // anywhere else. Each week she brings `stockSize` of the things below
  // (a different mix each week), and each person can buy up to `limit` of
  // each. kind: "seed" (a crop), "bait", "recipe" or "decor" (Nest & Nook).
  merchant: {
    name: "Juniper",
    day: 5,
    stockSize: 5,
    goods: [
      { id: "starfruitSeed", kind: "seed", ref: "starfruit", price: 45, limit: 3 },
      { id: "moonflowerSeed", kind: "seed", ref: "moonflower", price: 40, limit: 3 },
      { id: "glowworms", kind: "bait", ref: "glowworm", price: 35, limit: 5 },
      { id: "curryRecipe", kind: "recipe", ref: "carpCurry", price: 80, limit: 1 },
      { id: "tartRecipe", kind: "recipe", ref: "starfruitTart", price: 80, limit: 1 },
      { id: "teaRecipe", kind: "recipe", ref: "moonTea", price: 70, limit: 1 },
      { id: "travelRug", kind: "decor", ref: "travelRug", price: 70, limit: 1 },
      { id: "brassGlobe", kind: "decor", ref: "brassGlobe", price: 90, limit: 1 },
      { id: "spyglass", kind: "decor", ref: "spyglass", price: 120, limit: 1 },
    ],
  },

  // --- The camera ---
  // The view is `zoom` times closer than the whole ground floor and
  // follows you around (`follow` is how quickly it catches up each frame:
  // 0.05 lazy, 0.3 snappy). Press `mapKey` for the map, the whole floor at
  // once. Bedrooms always show whole. zoom: 1 turns the close-up off.
  camera: {
    zoom: 1.8,
    follow: 0.12,
    mapKey: "m",
  },

  // --- Residents' requests (Update 6) ---
  // Each day (the hometown's day), Clover and Mortimer each ask everyone
  // for one thing from this list (a different pick for each person, and
  // each day). Bring it and they pay `crumbs` (a bit more than selling it
  // would). item: a basket item, like "crop:carrot", "fish:trout",
  // "dish:jam" or "junk:letter"; n: how many; line: how they ask.
  residents: {
    // Friendship hearts (step 3): each person's friendship with each
    // resident, kept by the house server. `pointsPerHeart` points make a
    // heart, up to `maxHearts`. Points come from the first chat of the
    // day, finishing today's request, and one gift a day (how much depends
    // on whether they love it, like it, don't mind it or dislike it; see
    // `tastes` below). At `recipesAt` hearts a resident teaches you
    // recipes (their Recipes tab), at `discountAt` hearts those are
    // `discount` cheaper (0.25 is a quarter off), and the extra chat
    // topics in `stories` open at the hearts they say.
    hearts: {
      pointsPerHeart: 100,
      maxHearts: 10,
      chat: 15,
      request: 50,
      gift: { loved: 80, liked: 40, neutral: 20, disliked: -20 },
      recipesAt: 3,
      discountAt: 6,
      discount: 0.25,
    },
    // What each resident thinks of gifts. An exact item ("crop:pumpkin")
    // or a whole kind ("fish:" for any fish). Exact items win over kinds;
    // anything not listed is "neutral".
    tastes: {
      clover: {
        loved: ["crop:blueberry", "crop:strawberry", "crop:pumpkin", "dish:pumpkinPie", "dish:carrotCake", "dish:starfruitTart"],
        liked: ["crop:", "dish:", "food:honey"],
        disliked: ["junk:", "fish:eel", "fish:catfish"],
      },
      mortimer: {
        loved: ["fish:trout", "fish:eel", "dish:sushi", "dish:moonTea", "junk:letter", "junk:duck"],
        liked: ["fish:", "dish:", "crop:sunflower"],
        disliked: ["crop:radish", "crop:lettuce", "junk:can", "junk:weeds"],
      },
      mothman: {
        loved: ["night:lantern", "night:lightbulb", "night:firefly", "dish:moonTea", "crop:moonflower"],
        liked: ["night:", "food:honey", "crop:sunflower", "dish:"],
        disliked: ["fish:", "junk:"],
      },
    },
    // The recipes each resident teaches (at `recipesAt` hearts), and their
    // price before any discount. These are recipes you can also find by
    // experimenting at the stove.
    recipes: {
      clover: [
        { id: "honeyToast", price: 30 },
        { id: "jam", price: 40 },
        { id: "blueberryPancakes", price: 45 },
        { id: "pumpkinSoup", price: 80 },
      ],
      mortimer: [
        { id: "tomatoSoup", price: 40 },
        { id: "chowder", price: 45 },
        { id: "risotto", price: 50 },
        { id: "fishTacos", price: 55 },
      ],
    },
    // Extra chat topics that open with friendship: a bit more of each
    // resident's story at `hearts` hearts.
    stories: {
      clover: [
        { hearts: 2, name: "Tell me about Doug", line: "doug is my sourdough starter. my gran gave him to me the day i left home. 'feed him, talk to him, and he'll never let you down.' twelve years, and he never has. well. once he ate a spoon. we don't talk about it." },
        { hearts: 5, name: "Why did you come here?", line: "honest truth? my old bakery closed. i sat at a bus stop with doug and a suitcase, and gus said, 'there's a house up the road that smells like it needs bread.' he was right. it did." },
        { hearts: 8, name: "What do you dream about?", line: "a little shop window. a bell over the door. warm loaves stacked up, and everyone in the house stopping by in the morning. oh. wait. that's... that's kind of just this. huh." },
      ],
      mothman: [
        { hearts: 2, name: "How long have you been coming here?", line: "...since the porch light. it was on the first night i came. there wasn't a porch yet. just the light. i waited. the house grew around it." },
        { hearts: 5, name: "The owl in the library", line: "the owl leaves the lamp on for me. every night. we have never spoken. i tap twice to say thank you. he taps back once. it is a good friendship." },
        { hearts: 8, name: "Why lamps?", line: "...a lamp means someone is home. someone is awake. someone might need company. i am not good at company. but i am good at sitting nearby. that counts. doesn't it?" },
      ],
      mortimer: [
        { hearts: 2, name: "Why the spectacles?", line: "i don't need them. owls see perfectly well. but a librarian without spectacles is simply an owl in a room full of books, and that's a different thing altogether." },
        { hearts: 5, name: "How long have you been here?", line: "before the house had a hallway, there was a library. before the library, a shelf. before the shelf, there was me, and a book i hadn't finished. i still haven't. it's very long." },
        { hearts: 8, name: "The tapping at the window", line: "i'll tell you, because you're a friend. the tapping. it's a moth. a very large, very polite moth. it never comes in. it just looks at the lamp. and at me. i think it's lonely. so i leave the lamp on." },
      ],
    },
    requests: {
      mothman: [
        { item: "night:lightbulb", n: 1, crumbs: 12, line: "...a lightbulb. just one. the warm kind. if it's not too much trouble." },
        { item: "night:lightbulb", n: 3, crumbs: 30, line: "three lightbulbs? for the long nights. i'll... i'll look at them. that's all. promise." },
        { item: "night:lantern", n: 1, crumbs: 35, line: "a paper lantern. they glow so softly. like a moon you can hold." },
        { item: "night:firefly", n: 2, crumbs: 30, line: "two fireflies. to talk to. they don't say much either. we get along." },
        { item: "night:firefly", n: 3, crumbs: 45, line: "three fireflies, in jars. i'll let them go at dawn. it's the polite thing." },
        { item: "food:honey", n: 1, crumbs: 20, line: "...honey? moths like sweet things. that's not a secret. it is a little embarrassing." },
      ],
      clover: [
        { item: "crop:carrot", n: 3, crumbs: 45, line: "i'm making carrot muffins. well, i'm trying to. could you spare three carrots?" },
        { item: "crop:strawberry", n: 4, crumbs: 45, line: "strawberry tarts need strawberries. it's the law. four, please?" },
        { item: "crop:blueberry", n: 2, crumbs: 40, line: "blueberry muffins! i dream of them. two handfuls of blueberries would make my week." },
        { item: "crop:radish", n: 5, crumbs: 50, line: "five radishes, for a spring salad to go with the bread. crunchy!" },
        { item: "crop:tomato", n: 3, crumbs: 45, line: "tomato and herb loaf today. i just need three nice tomatoes." },
        { item: "crop:corn", n: 3, crumbs: 65, line: "cornbread! three ears of corn and i'm in business." },
        { item: "crop:sunflower", n: 1, crumbs: 55, line: "a sunflower for the kitchen window? the seeds go on the rolls after. nothing wasted!" },
        { item: "crop:pumpkin", n: 1, crumbs: 150, line: "i have a very ambitious pumpkin bread planned. i need a whole pumpkin. a big one, ideally." },
        { item: "fish:trout", n: 1, crumbs: 22, line: "otis says trout and bread go together. i'm skeptical. bring me one and i'll find out." },
      ],
      mortimer: [
        { item: "fish:bluegill", n: 2, crumbs: 18, line: "i find a small supper helps the reading. two bluegill, if you'd be so kind." },
        { item: "fish:perch", n: 2, crumbs: 18, line: "perch. two. for a light midnight snack. don't look at me like that." },
        { item: "fish:trout", n: 1, crumbs: 22, line: "a trout would be most welcome. a well-read owl is a well-fed owl." },
        { item: "fish:catfish", n: 1, crumbs: 22, line: "a catfish, please. the irony of an owl eating a catfish is not lost on me." },
        { item: "fish:eel", n: 1, crumbs: 35, line: "an eel. i know. it's a delicacy where i'm from. which is here." },
        { item: "dish:sushi", n: 1, crumbs: 45, line: "i've read about sushi in four different books. i'd like to try it, finally." },
        { item: "junk:letter", n: 1, crumbs: 25, line: "the pond keeps swallowing letters. if you fish one up, bring it. i keep them in the archive, unread. mostly." },
        { item: "junk:duck", n: 1, crumbs: 20, line: "a rubber duck floated past my window once. i think about it often. if you find one..." },
        { item: "crop:sunflower", n: 1, crumbs: 55, line: "a sunflower for the reading table. it faces the lamp all night. very loyal." },
      ],
    },
  },

  // --- The bus stop (Update 4) ---
  // A little bus pulls up at the stop by the road every `everyMinutes`
  // (on the same clock for everyone), waits `waitSeconds`, and drives off.
  // Trips (destinations and mini games) plug in later: see bus.js.
  bus: {
    everyMinutes: 8,
    waitSeconds: 40,
    driver: "Gus",
  },

  // The floors the elevator goes to, bottom to top, and what's on each
  // (shown on the elevator's buttons).
  floors: [
    { name: "Ground floor", rooms: "Hallway, Theater, Study, Dinner, Library" },
    { name: "Business floor", rooms: "Offices, Conference Room, Workshop, Lounge" },
    { name: "Suite floor", rooms: "Everyone's bedroom" },
    { name: "Games floor", rooms: "The Arcade (and soon, mini games)" },
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
    { tab: "hats", slot: "hat", label: "Hats", none: "No hat" },
    { tab: "shoes", slot: "shoes", label: "Shoes", none: "Plain feet" },
    { tab: "glasses", slot: "glasses", label: "Glasses", none: "No glasses" },
    { tab: "scarves", slot: "scarf", label: "Scarves", none: "None" },
    { tab: "backpacks", slot: "backpack", label: "Backpacks", none: "None" },
    { tab: "earrings", slot: "earrings", label: "Earrings", none: "None" },
    { tab: "pets", slot: "pet", label: "Pets", none: "No pet" },
  ],

  wardrobeColors: ["#e05a47", "#e8883a", "#e8b84a", "#8fb86a", "#4f9a8a", "#5aa0d8", "#7a6bc8", "#c86bb0", "#e98ac0", "#a0703e", "#6b5a4a", "#f2ede4"],

  // The grandfather clock in the hallway chimes softly on every hour (your
  // own local time). It follows the master volume and mute, is silent
  // while you're asleep, and can be turned off in Settings.
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

  // Bedrooms: everyone's door is on the suite floor (the bedroom
  // hallway). Doors are checked with the house server every `pollSeconds`
  // (and right away when a friend changes theirs). The suite floor's wall
  // is split evenly into `doorSpots` spots, each with a door (or a window,
  // until someone new moves in), with a lamp between each pair.
  bedrooms: { pollSeconds: 20, doorSpots: 8 },

  // Sitting: press E within this many tiles of a free seat to sit down.
  sit: { reach: 1.0 },

  // Idle animations: after this many seconds with no keys or mouse, your
  // character starts stretching, yawning and looking around (with a
  // random pause of gapMin to gapMax seconds between them). Sitting
  // characters do a gentler one.
  idle: { afterSeconds: 25, gapMin: 3, gapMax: 8 },


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
  // "gamepad", "music", "heart", "leaf", "moon", "door". (Please use one of
  // these, not an emoji.) A new room without one gets a door.
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
    lounge: "gamepad",
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
    elevatorGames: { style: "checker", color: "#c9c0d8" },
    games: { style: "planks", color: "#8a7a9a" },
    arcade: { style: "carpet", color: "#2e2848" },
    workshop: { style: "planks", color: "#b88a5a" },
    business: { style: "planks", color: "#b9a58c" },
    lounge: { style: "carpet", color: "#a8876a" },
    suite: { style: "planks", color: "#c9a57e" },
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
    elevatorGames: "#b8aac8",
    games: "#5a4a7a",
    arcade: "#3a2f5a",
    workshop: "#c9b28a",
    business: "#dcd6cc",
    lounge: "#c7b49a",
    suite: "#e6d6c6",
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
  // room has a name (its picture for the level-up card and profile cards
  // is drawn in icons.js).
  // Offices count together, and so do bedrooms. `minutesForLevel` is the
  // total minutes in a room needed for Lv. 1, Lv. 2, ... Lv. 10 (so Lv. 10
  // takes 20 hours in that room). Add or remove numbers to change how
  // many levels there are.
  roomLevels: {
    rooms: {
      study: { name: "Study" },
      library: { name: "Library" },
      theater: { name: "Theater" },
      conference: { name: "Conference Room" },
      dinner: { name: "Dinner" },
      workshop: { name: "Workshop" },
      office: { name: "Office" },
      bedroom: { name: "Bedroom" },
      // Outside (Update 4)
      garden: { name: "Garden" },
      pond: { name: "Pond" },
      lake: { name: "Willow Lake" },
      campfire: { name: "Campfire" },
      porch: { name: "Porch" },
    },
    minutesForLevel: [10, 30, 60, 120, 210, 330, 480, 660, 900, 1200],
  },

  // --- Tiered achievements (Update 3) ---
  // Achievements that keep going: each one has tiers, from Bronze up to
  // Legend, and every tier you reach pays crumbs. `crumbs` is the reward
  // for reaching that tier.
  achievementTiers: [
    { name: "Bronze", color: "#b87a4a", crumbs: 10 },
    { name: "Silver", color: "#9aa4ae", crumbs: 25 },
    { name: "Gold", color: "#d9a441", crumbs: 50 },
    { name: "Platinum", color: "#5aa0b8", crumbs: 100 },
    { name: "Diamond", color: "#6a8ad8", crumbs: 200 },
    { name: "Legend", color: "#c86bb0", crumbs: 400 },
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
    { id: "homebody", name: "Homebody", stat: "hours", desc: "Spend {n} hour{s} in the house.", goals: [1, 10, 25, 50, 100, 250], was: ["hour", "homebody", null, "resident"] },
    { id: "visitor", name: "Frequent Visitor", stat: "daysVisited", desc: "Visit the house on {n} different day{s}.", goals: [3, 7, 30, 100, 200, 365] },
    { id: "wellRounded", name: "Well-Rounded", stat: "roomLevels", desc: "Reach {n} room level{s} in total.", goals: [5, 15, 30, 50, 65, 80] },
    { id: "crumbs", name: "Crumb Collector", stat: "crumbsEarned", desc: "Earn {n} crumb{s}.", goals: [100, 500, 1500, 5000, 15000, 50000] },
    { id: "collector", name: "Collector", stat: "items", desc: "Own {n} thing{s} from the raccoons.", goals: [3, 10, 20, 35, 55, 80] },
    { id: "menagerie", name: "Menagerie", stat: "pets", desc: "Adopt {n} pet{s}.", goals: [1, 3, 5, 10, 15, 19], was: ["firstPet", null, "menagerie"] },
    { id: "chatterbox", name: "Chatterbox", stat: "chats", desc: "Send {n} chat message{s}.", goals: [10, 100, 500, 1500, 5000, 15000], was: [null, "chatterbox"] },
    { id: "emotes", name: "Emote-ional", stat: "emotesUsed", desc: "Use emotes {n} time{s}.", goals: [10, 50, 200, 500, 1500, 5000] },
    { id: "dancer", name: "Dance Machine", stat: "dances", desc: "Dance {n} time{s}.", goals: [1, 25, 100, 300, 1000, 3000], was: ["jig"] },
    { id: "focus", name: "Deep Focus", stat: "focusSessions", desc: "Finish {n} Study focus session{s}.", goals: [1, 5, 15, 40, 100, 250], was: ["focus", "scholar"] },
    { id: "rested", name: "Well Rested", stat: "sleepHours", desc: "Sleep {n} hour{s} in bed.", goals: [0.5, 3, 10, 30, 100, 250], was: ["wellRested"] },
    // Outdoors (Update 4)
    { id: "harvester", name: "Green Thumb", stat: "harvests", desc: "Harvest {n} crop{s} from the garden.", goals: [1, 10, 40, 120, 300, 750] },
    { id: "angler", name: "Angler", stat: "fishCaught", desc: "Catch {n} fish at the pond.", goals: [1, 10, 40, 120, 300, 750] },
    { id: "chef", name: "Chef", stat: "dishesCooked", desc: "Cook {n} meal{s} at the stove.", goals: [1, 10, 30, 80, 200, 500] },
    { id: "goodNeighbor", name: "Good Neighbor", stat: "friendsWatered", desc: "Water a friend's garden bed {n} time{s}.", goals: [1, 10, 30, 80, 200, 500] },
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
    { id: "believer", text: "the Believer", achievement: "believer" },
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
    { id: "cloverFavorite", text: "Clover's Favorite", achievement: "cloverFriend" },
    { id: "libraryFriend", text: "Friend of the Library", achievement: "mortimerFriend" },
    { id: "angler", text: "the Angler", tier: "angler", level: 3 },
    { id: "masterAngler", text: "the Master Angler", tier: "angler", level: 6 },
    { id: "fishWhisperer", text: "the Fish Whisperer", achievement: "legendCatch" },
    { id: "treasureHunter", text: "the Treasure Hunter", achievement: "junkDealer" },
    { id: "nightOwl", text: "the Night Owl", achievement: "nightOwl" },
    { id: "earlyBird", text: "the Early Bird", achievement: "earlyBird" },
  ],

  // --- Crumbs (the house money) ---
  // You earn crumbs just for hanging out, and spend them at the raccoons'
  // shop in the hallway on hats and shoes. Only while you're really here:
  // the house's tab is showing, and you've pressed a key, clicked or moved
  // the mouse in the last `crumbsActiveMinutes` minutes (so leaving it
  // open all night doesn't pile up crumbs).
  crumbsPerMinute: 1,
  crumbsActiveMinutes: 10,
  focusBonusCrumbs: 10, // extra crumbs for finishing a Study focus session

  // --- Study focus timer ---
  // Press F in the Study to start a shared focus session for everyone.
  // After the focus time there's a short break, then it ends. In minutes.
  focusMinutes: 25,
  breakMinutes: 5,
};
