// What the house sells and rewards: the raccoons' stock and every
// one-time achievement (with its crumb reward). A plain list, so both the
// page and the house server read it: the server uses it to check prices
// and pay rewards, so nobody can change them in their own browser.
// (The other prices, like fish, seeds, bait and rods, are in config.js;
// Nest & Nook's decor is in world.js. The server reads those too.)
//
// Changing a price here? The house server needs the new copy as well
// (see server/README.md).

// Hats everyone has for free (they're on the Join screen from the start):
// [id, name, height]. A hat's height is how many pixels it reaches above
// the top of your head, so name tags can sit just above it (0 for none).
const SHOP_FREE_HATS = [
  ["none", "No hat", 0],
  ["beanie", "Beanie", 5],
  ["cap", "Cap", 2],
  ["bow", "Bow", 4],
  ["headphones", "Headphones", 3],
  ["flower", "Flower", 2],
];

// The raccoons' stock. `line` is what they say when you buy it. A hat's
// `height` is how far it reaches above your head, in pixels (see FREE_HATS).
const SHOP_CATALOG = [
  { id: "partyHat", type: "hat", name: "Party Hat", price: 15, height: 18, line: "it's always somebody's birthday. probably." },
  { id: "chefHat", type: "hat", name: "Chef Hat", price: 25, height: 17, line: "we found it. near a kitchen. unrelated." },
  { id: "topHat", type: "hat", name: "Top Hat", price: 40, height: 14, line: "very fancy. very legal. extremely legal." },
  { id: "cowboyHat", type: "hat", name: "Cowboy Hat", price: 40, height: 9, line: "yeehaw, as the humans say." },
  { id: "witchHat", type: "hat", name: "Witch Hat", price: 50, height: 20, line: "only slightly cursed. no refunds." },
  { id: "frogHat", type: "hat", name: "Frog Hat", price: 60, height: 6, line: "ribbit. that's the whole sales pitch." },
  { id: "crown", type: "hat", name: "Crown", price: 120, height: 7, line: "fell off a king. we think. don't ask." },
  { id: "halo", type: "hat", name: "Halo", price: 200, height: 22, line: "for when you've been good. very rare." },
  { id: "beret", type: "hat", name: "Beret", price: 20, height: 7, line: "ooh la la. we don't know what that means." },
  { id: "bucketHat", type: "hat", name: "Bucket Hat", price: 20, height: 6, line: "holds a hat's worth of stuff. which is your head." },
  { id: "sproutHat", type: "hat", name: "Head Sprout", price: 25, height: 11, line: "water daily. or don't. it's fake. probably." },
  { id: "catEars", type: "hat", name: "Cat Ears", price: 30, height: 8, line: "meow. that's free. the ears are 30." },
  { id: "flowerCrown", type: "hat", name: "Flower Crown", price: 35, height: 3, line: "picked fresh from someone's garden. not yours. don't check." },
  { id: "strawHat", type: "hat", name: "Straw Hat", price: 35, height: 7, line: "for summer. or for pretending it's summer." },
  { id: "propellerCap", type: "hat", name: "Propeller Cap", price: 40, height: 12, line: "doesn't fly. we tried. bean tried. twice." },
  { id: "mushroomCap", type: "hat", name: "Mushroom Cap", price: 45, height: 5, line: "not the eating kind. please don't eat it." },
  { id: "bunnyEars", type: "hat", name: "Bunny Ears", price: 50, height: 20, line: "one ear's floppy. it's a feature. a cute one." },
  { id: "gradCap", type: "hat", name: "Graduation Cap", price: 55, height: 9, line: "congratulations on graduating. from what? who knows." },
  { id: "santaHat", type: "hat", name: "Santa Hat", price: 60, height: 12, line: "ho ho... we're not allowed to finish that." },
  { id: "pirateHat", type: "hat", name: "Pirate Hat", price: 70, height: 11, line: "arr. we traded a map for it. the map was fake too." },
  { id: "vikingHelmet", type: "hat", name: "Viking Helmet", price: 80, height: 10, line: "horns sold separately. kidding. horns included." },
  { id: "tiara", type: "hat", name: "Tiara", price: 120, height: 9, line: "real diamonds. fake diamonds. same sparkle." },
  { id: "sneakers", type: "shoes", name: "Sneakers", price: 15, line: "zoom zoom. that's a feature." },
  { id: "rainBoots", type: "shoes", name: "Rain Boots", price: 25, line: "puddles fear you now." },
  { id: "bunnySlippers", type: "shoes", name: "Bunny Slippers", price: 30, line: "they're not real bunnies. we checked." },
  { id: "cowboyBoots", type: "shoes", name: "Cowboy Boots", price: 40, line: "pairs well with a hat. we sell hats." },
  { id: "rollerSkates", type: "shoes", name: "Roller Skates", price: 75, line: "wheeee. sorry. professional voice. wheee." },
  { id: "flipFlops", type: "shoes", name: "Flip-Flops", price: 10, line: "flip. flop. that's the sound. that's the name." },
  { id: "balletFlats", type: "shoes", name: "Ballet Flats", price: 25, line: "twirl twice before wearing. house rules." },
  { id: "sockSandals", type: "shoes", name: "Socks & Sandals", price: 25, line: "bold. fearless. a little crunchy." },
  { id: "clogs", type: "shoes", name: "Clogs", price: 30, line: "clip clop. very sturdy. very loud on stairs." },
  { id: "hikingBoots", type: "shoes", name: "Hiking Boots", price: 45, line: "for adventures. or the walk to the kitchen." },
  { id: "moonBoots", type: "shoes", name: "Moon Boots", price: 55, line: "one small step. very puffy." },
  { id: "glowSneakers", type: "shoes", name: "Light-Up Sneakers", price: 65, line: "they blink when you walk. like us when we see crumbs." },
  { id: "rubySlippers", type: "shoes", name: "Ruby Slippers", price: 150, line: "click your heels. results not guaranteed." },
  // Glasses go on your face.
  { id: "roundGlasses", type: "glasses", name: "Round Glasses", price: 20, line: "you look very smart. smarter than us. low bar." },
  { id: "sunglasses", type: "glasses", name: "Sunglasses", price: 25, line: "too cool for the house. but stay anyway." },
  { id: "catEyeGlasses", type: "glasses", name: "Cat-Eye Glasses", price: 35, line: "fancy. a little mysterious. like us." },
  { id: "heartGlasses", type: "glasses", name: "Heart Glasses", price: 40, line: "everything looks lovelier. even bean." },
  { id: "glasses3d", type: "glasses", name: "3D Glasses", price: 40, line: "for the theater. or for everything. your call." },
  { id: "starGlasses", type: "glasses", name: "Star Glasses", price: 50, line: "you're a star. the glasses say so." },
  { id: "goggles", type: "glasses", name: "Goggles", price: 60, line: "for the workshop. safety first. second: style." },
  { id: "monocle", type: "glasses", name: "Monocle", price: 90, line: "one eye fancy. the other eye regular. balance." },
  { id: "squareFrames", type: "glasses", name: "Square Frames", price: 30, line: "for reading. or for looking like you read." },
  { id: "roseGlasses", type: "glasses", name: "Rose-Tinted Glasses", price: 45, line: "everything's fine now. forever. probably." },
  { id: "aviators", type: "glasses", name: "Aviators", price: 55, line: "we can't fly. but you'll look like you can." },
  // Scarves wrap around you, under your face (Update 3).
  { id: "bandana", type: "scarf", name: "Bandana", price: 15, line: "very cowboy. very mysterious. very washable." },
  { id: "knitScarf", type: "scarf", name: "Red Knit Scarf", price: 25, line: "hand knitted. by paws. don't look too close." },
  { id: "stripedScarf", type: "scarf", name: "Striped Scarf", price: 30, line: "stripes are faster. that's science." },
  { id: "plaidScarf", type: "scarf", name: "Plaid Scarf", price: 35, line: "smells faintly of pine. we don't know why." },
  { id: "chunkyScarf", type: "scarf", name: "Chunky Scarf", price: 45, line: "like a hug. but it never wants to talk about it." },
  { id: "featherBoa", type: "scarf", name: "Feather Boa", price: 70, line: "fabulous. a few feathers are ours. don't ask." },
  // Backpacks ride on your back (Update 3).
  { id: "schoolBag", type: "backpack", name: "School Backpack", price: 30, line: "comes with a free half-eaten sandwich. kidding. mostly." },
  { id: "hikingPack", type: "backpack", name: "Hiking Pack", price: 50, line: "for long walks. like to the fridge." },
  { id: "bunnyBag", type: "backpack", name: "Bunny Backpack", price: 60, line: "it's not a real bunny. we asked it." },
  { id: "guitarCase", type: "backpack", name: "Guitar Case", price: 80, line: "there's no guitar in it. just vibes." },
  { id: "jetpack", type: "backpack", name: "Jetpack", price: 150, line: "doesn't fly. does make flames. indoors. careful." },
  // Earrings hang by your face (Update 3).
  { id: "pearlStuds", type: "earrings", name: "Pearl Studs", price: 25, line: "real pearls. from a real... shell. somewhere." },
  { id: "goldHoops", type: "earrings", name: "Gold Hoops", price: 30, line: "shiny. we almost kept them." },
  { id: "cherryEarrings", type: "earrings", name: "Cherry Earrings", price: 35, line: "not for eating. bean tried." },
  { id: "starDangles", type: "earrings", name: "Star Dangles", price: 45, line: "caught two stars. hung them on hooks. easy." },
  { id: "featherEarrings", type: "earrings", name: "Feather Earrings", price: 40, line: "matches the boa. we planned that. we did not."  },
  // Pets follow you around the house (one at a time).
  { id: "duck", type: "pet", name: "Duckling", price: 50, line: "it imprinted on us first. awkward. it's yours now." },
  { id: "frog", type: "pet", name: "Frog", price: 50, line: "ribbit. same pitch as the hat. we're consistent." },
  // Mothman's gifts (Update 8): never for sale; he gives them to friends
  // (config.js night.rewards). `reward` keeps them out of the shop.
  { id: "mothAntennae", type: "hat", name: "Moth Antennae", price: 0, height: 16, reward: "mothman", line: "feathery. they twitch when something's near a lamp." },
  { id: "mothWings", type: "backpack", name: "Moth Wings", price: 0, reward: "mothman", line: "soft, dusty, and exactly the color of dusk." },
  { id: "mothPet", type: "pet", name: "Tiny Moth", price: 0, reward: "mothman", line: "it follows you. and every lamp. mostly lamps." },
  { id: "cat", type: "pet", name: "Cat", price: 60, line: "technically it adopted you. we just did the paperwork." },
  { id: "dog", type: "pet", name: "Pup", price: 60, line: "good boy. very good boy. best boy. okay bye boy." },
  { id: "bunny", type: "pet", name: "Bunny", price: 70, line: "hop hop. mind the cables." },
  { id: "hedgehog", type: "pet", name: "Hedgehog", price: 80, line: "pointy but polite." },
  { id: "fox", type: "pet", name: "Fox", price: 100, line: "what does it say? nobody knows. not even us." },
  { id: "penguin", type: "pet", name: "Penguin", price: 110, line: "formal wear included. no extra charge." },
  { id: "ghost", type: "pet", name: "Ghost", price: 150, line: "found it in the library. it followed us out. boo." },
  { id: "dragon", type: "pet", name: "Baby Dragon", price: 250, line: "small now. keep it away from the curtains." },
  { id: "raccoonKit", type: "pet", name: "Raccoon Kit", price: 300, line: "our cousin. very trustworthy. unlike us." },
  { id: "snail", type: "pet", name: "Snail", price: 40, line: "slow. steady. will get there eventually." },
  { id: "hamster", type: "pet", name: "Hamster", price: 55, line: "cheeks full of snacks. respect." },
  { id: "turtle", type: "pet", name: "Turtle", price: 65, line: "brings its own house. very efficient." },
  { id: "sheep", type: "pet", name: "Sheep", price: 75, line: "fluffy. counts itself to sleep." },
  { id: "owl", type: "pet", name: "Owl", price: 90, line: "wise. or it just looks wise. same thing, really." },
  { id: "bat", type: "pet", name: "Bat", price: 95, line: "spooky season, all season." },
  { id: "capybara", type: "pet", name: "Capybara", price: 120, line: "the calmest creature alive. the orange is included." },
  { id: "axolotl", type: "pet", name: "Axolotl", price: 140, line: "smiles all the time. we're a bit jealous." },
];

// Every moment (one-time achievement). `server` ones are given by the
// house server itself, when it sees them happen (buying, fishing,
// gardening...); the page can't claim those. `secret` ones show as "???" until
// you find them.
// To add one: give it an id here, then call unlock("thatId") from the
// place in the code where it happens.
const ACHIEVEMENT_LIST = [
  // Settling in
  { id: "welcome", name: "Home Sweet Home", desc: "Join the house for the first time.", crumbs: 5 },
  { id: "tour", name: "Grand Tour", desc: "Visit every room, including an office.", crumbs: 20 },
  { id: "office", name: "Corner Office", desc: "Build your own office.", crumbs: 10 },
  { id: "lock", name: "Do Not Disturb", desc: "Lock your office door.", crumbs: 5 },
  { id: "knock", name: "Knock Knock", desc: "Knock on a friend's locked office.", crumbs: 5 },
  { id: "doodle", name: "Doodler", desc: "Draw on the Conference Room whiteboard.", crumbs: 5 },
  { id: "movie", name: "Movie Night", desc: "Play a video in the Theater.", crumbs: 10 },
  { id: "bookworm", name: "Bookworm", desc: "Spend 15 minutes in the Library.", crumbs: 15 },
  { id: "snack", name: "Snack Break", desc: "Spend 10 minutes in the Dinner room.", crumbs: 10 },
  { id: "bedroomMade", name: "A Room of One's Own", desc: "Step into your own bedroom.", crumbs: 10 },
  { id: "goodnight", name: "Goodnight", desc: "Get into bed.", crumbs: 5 },
  { id: "sleepover", name: "Sleepover", desc: "Hang out in a bedroom with a friend.", crumbs: 15 },
  { id: "decorator", name: "Making It Home", desc: "Place something in your bedroom.", crumbs: 10 },
  { id: "designer", name: "Interior Designer", desc: "Have 10 pieces placed in your bedroom.", crumbs: 40 },
  { id: "roomy", name: "Moving On Up", desc: "Buy the Roomy upgrade at Nest & Nook.", crumbs: 30, server: true },
  { id: "penPal", name: "Pen Pal", desc: "Write a letter on your laptop.", crumbs: 10 },
  { id: "gotMail", name: "You've Got Mail", desc: "Receive a letter.", crumbs: 10 },
  { id: "newsReader", name: "Well Informed", desc: "Read the news on your laptop.", crumbs: 5 },

  // Friends
  { id: "hello", name: "Hello There", desc: "Send your first chat message.", crumbs: 5 },
  { id: "roommates", name: "Roommates", desc: "Be in the same room as a friend.", crumbs: 5 },
  { id: "fullHouse", name: "Full House", desc: "Hang out with 3 friends at once.", crumbs: 25 },
  { id: "expressive", name: "Expressive", desc: "Use all five emotes.", crumbs: 10 },
  { id: "jigParty", name: "Dance Party", desc: "Dance at the same time as a friend.", crumbs: 20 },

  // Time in the house
  { id: "nightOwl", name: "Night Owl", desc: "Be in the house between 1 and 4 in the morning.", crumbs: 15 },
  { id: "earlyBird", name: "Early Bird", desc: "Be in the house between 5 and 7 in the morning.", crumbs: 15 },

  // The raccoons, and pets
  { id: "raccoons", name: "Shady Dealings", desc: "Talk to the raccoons in the trenchcoat.", crumbs: 5, server: true },
  { id: "firstBuy", name: "Retail Therapy", desc: "Buy something from the raccoons.", crumbs: 10, server: true },
  { id: "allHats", name: "Mad Hatter", desc: "Own every hat the raccoons sell.", crumbs: 100, server: true },
  { id: "allShoes", name: "Well Heeled", desc: "Own every pair of shoes.", crumbs: 60, server: true },
  { id: "patPat", name: "Pat Pat", desc: "Pet a pet (walk up to one and press E).", crumbs: 5 },
  { id: "pettingZoo", name: "Petting Zoo", desc: "Pet a friend's pet.", crumbs: 10 },
  { id: "hoarder", name: "Crumb Hoarder", desc: "Have 500 crumbs at once.", crumbs: 25, server: true },

  // Outdoors (Update 4)
  { id: "firstSeed", name: "Seed of an Idea", desc: "Plant your first seed in the garden.", crumbs: 5, server: true },
  { id: "rainCheck", name: "Rain Check", desc: "Let the rain water the garden.", crumbs: 10 },
  { id: "farmStand", name: "Farm Stand", desc: "Sell your harvest to Hazel.", crumbs: 10, server: true },
  { id: "greatPumpkin", name: "The Great Pumpkin", desc: "Harvest a pumpkin.", crumbs: 25, server: true },
  { id: "firstCatch", name: "Hooked", desc: "Catch your first fish.", crumbs: 5, server: true },
  { id: "bigOne", name: "The Big One", desc: "Catch an epic fish.", crumbs: 25, server: true },
  { id: "legendCatch", name: "Legend of the Pond", desc: "Catch a legendary fish.", crumbs: 50, server: true },
  { id: "pondScholar", name: "Pond Scholar", desc: "Catch 10 different kinds of fish.", crumbs: 25, server: true },
  { id: "fullTank", name: "Full Tank", desc: "Fill a fish tank in your bedroom.", crumbs: 15, server: true },
  { id: "junkDealer", name: "One Raccoon's Trash", desc: "Sell pond junk to the raccoons.", crumbs: 10, server: true },
  { id: "downTheDrain", name: "Down the Drain", desc: "Climb down the manhole in the yard.", crumbs: 10 },

  // Kitchen & Trade (Update 5)
  { id: "firstDish", name: "Home Cooking", desc: "Cook your first dish.", crumbs: 10, server: true },
  { id: "burntOffering", name: "Burnt Offering", desc: "Cook something that isn't a recipe.", crumbs: 5, server: true },
  { id: "wellFed", name: "Well Fed", desc: "Eat a dish for a boost.", crumbs: 5, server: true },
  { id: "sharing", name: "Sharing Is Caring", desc: "Give a dish to a friend.", crumbs: 15, server: true },
  { id: "fortuneTold", name: "Fortune Told", desc: "Open a fortune cookie.", crumbs: 5, server: true },
  { id: "wishMade", name: "Make a Wish", desc: "Toss a coin in the wishing well.", crumbs: 5, server: true },
  { id: "author", name: "Published", desc: "Write a book for the Library.", crumbs: 15, server: true },
  { id: "cloverFriend", name: "Best Buns", desc: "Reach 10 hearts with Clover.", crumbs: 50, server: true },
  { id: "mortimerFriend", name: "Night Owls", desc: "Reach 10 hearts with Mortimer.", crumbs: 50, server: true },
  { id: "mothmanFriend", name: "Lamp Friends", desc: "Reach 10 hearts with Mothman.", crumbs: 50, server: true },
  { id: "believer", name: "Believer", desc: "Reach 2 hearts with Mothman.", crumbs: 20, server: true },
  { id: "firstSighting", name: "Blurry Photo", desc: "Spot Mothman at night.", crumbs: 10, server: true },
  { id: "porchLight", name: "Porch Light", desc: "Watch the moths gather at the porch light.", crumbs: 10, server: true },
  { id: "fullMoon", name: "Howl", desc: "Be out on a full moon night.", crumbs: 15, server: true },
  { id: "happyToHelp", name: "Happy to Help", desc: "Bring Clover or Mortimer what they asked for.", crumbs: 10, server: true },
  { id: "firstTrade", name: "Open for Business", desc: "Sell something on Porch Swap.", crumbs: 15, server: true },
  { id: "wellTraveled", name: "Well Traveled", desc: "Buy something from the traveling merchant.", crumbs: 15, server: true },
  { id: "cookbook", name: "Cookbook", desc: "Know 10 recipes.", crumbs: 40, server: true },

  // Secrets
  { id: "whoAreYou", name: "Three Raccoons?", desc: "Ask the raccoons who they really are.", crumbs: 10, secret: true },
  { id: "foodComa", name: "Food Coma", desc: "Get sleepy in the Dinner room.", crumbs: 10, secret: true },
  { id: "danceFloor", name: "Dance Floor", desc: "Dance in the Theater.", crumbs: 10, secret: true },
];
