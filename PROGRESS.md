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

- State/Country display is on hold (would need a third-party IP lookup service).

## Next
- Milestone 7: Stardew-style rendering rewrite.
- Small things noticed in review, not yet fixed: chimes still play in Dinner (should be fully silent), you can walk through furniture, the screen stays blank until you answer the mic prompt, and there's no message if you deny the mic.

## Open questions
- Trystero library is loaded from a pinned CDN link (esm.sh) rather than a local copy, because its build files need a CDN to resolve some internal pieces. If that CDN ever has an outage, movement/voice would pause until it's back (rest of the site stays up). You approved this tradeoff already.
- Room name and password for matchmaking are in `config.js`, randomly generated. Since the GitHub repo is public, anyone who reads the source could see them, this is "hard to stumble onto by accident," not a real secret. Fine for a private friends project with nothing sensitive shared, per the project's own rules.
