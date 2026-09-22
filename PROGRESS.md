# Progress

## Done
- Milestone 1: Setup and go live. Site confirmed working at https://props-coding.github.io/cozy-simulator/
- Milestone 2: single player. House with Hallway, Gaming, Study, Dinner. Walk with arrow keys or WASD, walls block you, doorways let you through, current room name shown on screen. Confirmed working.

- Milestone 3: multiplayer movement. Added a Join screen (name and color), friends' browsers find each other with Trystero, everyone sees each other walk around, sidebar shows who's in which room.
- Fixed two bugs found during testing: (1) the Join screen wasn't actually hiding after clicking Join, a CSS mistake on my part; (2) the Trystero connection code was calling two functions the wrong way (using an older version of Trystero's API than the one we're actually using), which silently broke the whole house view and the sidebar. Also added a small "build N" version number in the bottom corner of the page so you can tell when you're looking at the latest push vs. an old cached page.
- Confirmed working, but friends' movement looked choppy (we only get their position ~12 times a second). Fixed by smoothing: your own screen now eases friends toward their latest known spot each frame instead of snapping. Milestone 3 fully confirmed.

- Milestone 4: voice with room rules. Mic only live in Gaming, you only hear someone if you're both in Gaming, plus a mute-all checkbox and volume slider. Confirmed working.

- Milestone 5: lo-fi music in Study, fades in/out, own volume slider. Uses the official Lofi Girl YouTube livestream (confirmed embeddable), with a SomaFM internet radio stream as an automatic backup if the embed ever gets blocked. Dinner comes out silent automatically (it was never a voice room, and leaving Study fades the music out no matter where you walk to). Added a small "eating" badge over anyone standing in Dinner. Confirmed working.
- Voice in Gaming briefly stopped working. First suspected the public relay servers being flaky (real, and fixed with more redundancy), but voice still failed with no errors even once movement kept working fine. Found the real bug: the code that plays a friend's voice never actually pressed play, it only set an "autoplay" property on an element that wasn't even added to the page. Some browsers won't autoplay something like that. Fixed by attaching it properly and explicitly starting playback.

- Milestone 6: real test with a friend on a different network. Movement and voice in Gaming both confirmed working. This also resolves the previously pinned voice issue, it really was just the single-PC test setup being unreliable, not a code bug.

- Milestone 8 (polish, done early), first pieces: local time next to each name in the sidebar (using each browser's own clock, no outside service needed), and short join/leave chimes (generated in code, not sound files). Confirmed working.

- Milestone 8 (polish), cozier visuals: wood-look walls with rounded corners, textured floors, simple furniture per room (couch and TV in Gaming, bookshelf and desk in Study, dining table and chairs in Dinner, a rug and plant in the Hallway), a warm gradient background, and a cozy rounded font (Quicksand, from Google Fonts). Characters are now round with a little face and a soft shadow, name tags are readable pill badges instead of plain text. Confirmed working. (One deploy briefly got stuck "queued" on GitHub's side after a couple of quick pushes in a row cancelled each other's in-progress deploys, not a bug, just needed a few extra minutes.)

- Fixed a connection bug found testing with two friends: you could see Friend #1, Friend #1 could see both of you, but you and Friend #2 couldn't see or hear each other. Cause: some pairs of home networks can't connect directly to each other, and we had no fallback for that case. Added a free relay server (TURN, from the Open Relay Project, no account needed) as a backup path. Settings are in `config.js` under `turnServers` if we ever need to swap providers. Retested with the same three friends, all three could see and hear each other. Confirmed fixed.

- Milestone 8 (polish), round 3: richer furniture in every room (shaded couch cushions, a TV with a soft glow and a little game console, a bookshelf with two shelves, a curtained window and desk lamp in Study, a hanging pendant light and fruit bowl over the dinner table, a wall mirror and coat hooks in the Hallway), all with soft drop shadows so they look like they're sitting on the floor. Deepened the color palette (a honey-amber accent instead of the previous orange, a soft lamp-glow behind the page). Restyled the mute checkbox as a round toggle switch and the volume sliders with a matching look. Added gentle sound effects: a soft chime when you walk into a different room (a different little tune per room), and a quiet click on the Join button, mute switch, and sliders, all built the same way as the existing join/leave chimes (no sound files, so nothing to license or host). Sidebar now shows a small color dot next to each name matching their character. Confirmed working.
- Milestone 7, isometric rewrite (tried, then dropped, see below): switched the view from flat top-down to isometric (the classic "diamond-shaped floor tiles" game look). New file `render.js` holds all the isometric drawing (moved out of `world.js`, which now only holds the house layout and movement rules). Rooms, walls, and the player's position are now tracked in "grid units" instead of pixels, and only get turned into screen pixels at the moment something is drawn. Every wall and piece of furniture is a shaded 3D-looking box with its own floor shadow, floors are a grid of individual tiles instead of one flat color, and everything is drawn in the right front-to-back order so your character correctly appears in front of or behind furniture and walls depending on where you're standing. Canvas is bigger now (1000x620) since isometric needs more room. Needs your look in the browser, especially: does movement feel OK (pressing an arrow key now moves you diagonally on screen, since we kept the controls simple rather than rotating them to match the view), and does draw order look right if you walk in front of and behind furniture/walls.
- Decided the isometric look was wrong (tilted and hard to read). Milestone 7 is now a Stardew-style rewrite instead: square floor tiles seen from above, furniture and characters standing upright with soft shadows, and whatever is lower on screen drawn in front. The plan is in `CLAUDE.md`. The code still shows the isometric version until the rewrite is done.

- Bug fixes (build 0.16), found in a full review of the code:
  - Friends who joined after you couldn't hear you. Your mic was only sent to people already in the house when you joined. Now it is also sent to each new arrival (this is what Trystero's docs say to do).
  - A newly joined friend briefly flew in from off-screen, because their starting spot was still in old pixel units. They now start in the hallway.
  - If an ad blocker stopped YouTube from loading at all, Study stayed silent. It now switches to the backup radio stream in that case too.
  - Removed the long dashes from the sidebar text.
  - Confirmed working on the live site.

- State/Country display is on hold (would need a third-party IP lookup service).

- Milestone 7, Stardew-style rewrite (build 0.17): the house is now seen straight from above with square floor tiles, and walls, furniture and characters stand upright with a lighter top, a darker base, and a soft shadow right underneath (one light, from above). Whatever stands lower on screen is drawn in front, so you can walk behind the couch or the dinner table and be partly hidden, or in front and overlap it. Furniture is now solid, you walk around it instead of through it. Walls are simple cream panels with a wood baseboard. Arrow keys move straight up/down/left/right on screen again. Furniture positions are listed in `world.js` (FURNITURE), how each piece looks is in `render.js`. Names and "eating" badges always stay visible on top, even behind furniture. Needs your look in the browser.

- Gaming room turned into a LAN room (build 0.18): four computer desks in two rows, each with a glowing monitor (a different game color on each), a PC tower with a light strip, keyboard and mouse, and a stool in front. Stand on a stool to "sit" at a computer. A mini fridge and a snack table with chips and sodas at the back. The old couch and TV are gone (the couch was also facing the wrong way).

- Cozier rooms (build 0.19): each room has its own floor (light wood boards in the Hallway, soft navy carpet in Gaming, warm dark wood in Study, small warm tiles in Dinner) and its own wall color. Computer desks in Gaming are wood now. Study redone as a proper cozy study spot: a big red rug with a shared study table (open books, mugs of tea, a lamp) and three cushions to sit at it, a reading armchair and floor lamp by the window, string lights along the walls, a beanbag, plants, and a soft golden glow over the whole room. Plants redrawn so they actually look like plants (the old one in the Study corner didn't read as anything). Floors are now painted once and reused, so all the extra detail doesn't slow the game down. Floor styles and colors, and wall colors, are in `config.js` (roomFloors, roomWallColors).

- Moved the fridge from Gaming to Dinner, and turned the Study armchair around to face the window.

- Offices (build 0.20): a door at the far west end of the hallway. Stand by it and press E to build your own office (one per person, up to three). Each new office extends the hallway west, with the office below it, named after its owner ("Sam's Office"), with a desk whose screen and stool match your color. Voice is on inside an office, but only between people in that same office. The owner can press L inside to lock the door: nobody else can walk in, but anyone already inside can still walk out. Your browser remembers your office so it comes back each time you join; while you're offline it's gone. The view now scrolls to follow you once the house is wider than the screen. If two people build at the exact same moment, whoever was first keeps the spot and the other moves to the next free one.

- Build 0.21: fixed the house shifting sideways when you walk into your office (the sidebar grew wider with the longer room name; it now has a fixed width and wraps long lines). Added a way to remove your office: press R inside it, and confirm.

- Not pushed yet (waiting for more changes): redrew the office-building door (proper frame, carved panels, brass knob and sign, welcome mat) and the locked office door (double doors with a padlock, and the wall top now runs unbroken above it). Moved the Hallway label so it doesn't sit on the new mat.

- Not pushed yet: Dinner is now fully silent (no chimes either), the house appears right away instead of waiting for you to answer the mic question, and if the mic is blocked the sidebar says so and explains how to allow it.

- Not pushed yet: knocking. Stand in front of someone's locked office and press K. They hear a knock-knock and see "Sam is knocking on your office door." (You can knock once every 2 seconds.)

- Not pushed yet: Dinner makeover. A little kitchen along the back wall (counter with a stove, pot and bread under a kitchen window, a sink, the fridge), a warm rug under the table, a table runner with plates at every seat and two glowing candles, a sideboard with stacked plates and a teapot, a plant, and the same soft golden glow as the Study.

- Not pushed yet: nicer characters. Little feet, rosy cheeks, and a bouncy walk (feet take turns lifting). Pick a hat on the Join screen (beanie, cap, bow, headphones, flower, or none) with a live preview of how you'll look. The Join screen now remembers your name, color and hat from last time.

- Not pushed yet: Study focus timer. In the Study, press F to start a shared 25 minute focus session for everyone (press F again to stop it). A little chalkboard over the study table counts down, visible from anywhere in the house. When focus ends, a gentle chime starts a 5 minute break, then another chime when the break is over. Friends who join mid-session see the timer too. Lengths are in `config.js` (focusMinutes, breakMinutes).

## Next
- Push the "Not pushed yet" batch above as build 0.22 when you're ready, then test the multiplayer parts with friends: knocking, the shared focus timer, and seeing each other's hats. These were tested alone in a browser but not yet with two people.

## Open questions
- Trystero library is loaded from a pinned CDN link (esm.sh) rather than a local copy, because its build files need a CDN to resolve some internal pieces. If that CDN ever has an outage, movement/voice would pause until it's back (rest of the site stays up). You approved this tradeoff already.
- Room name and password for matchmaking are in `config.js`, randomly generated. Since the GitHub repo is public, anyone who reads the source could see them, this is "hard to stumble onto by accident," not a real secret. Fine for a private friends project with nothing sensitive shared, per the project's own rules.
