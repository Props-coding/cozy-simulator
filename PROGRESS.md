# Progress

## Done
- Milestone 1: Setup and go live. Site confirmed working at https://props-coding.github.io/cozy-simulator/
- Milestone 2: single player. House with Hallway, Gaming, Study, Dinner. Walk with arrow keys or WASD, walls block you, doorways let you through, current room name shown on screen. Confirmed working.

- Milestone 3: multiplayer movement. Added a Join screen (name and color), friends' browsers find each other with Trystero, everyone sees each other walk around, sidebar shows who's in which room.
- Fixed two bugs found during testing: (1) the Join screen wasn't actually hiding after clicking Join, a CSS mistake on my part; (2) the Trystero connection code was calling two functions the wrong way (using an older version of Trystero's API than the one we're actually using), which silently broke the whole house view and the sidebar. Also added a small "build N" version number in the bottom corner of the page so you can tell when you're looking at the latest push vs. an old cached page.

## Next
- Confirm Milestone 3 works now: open the site in two browser windows (hard refresh both), join in each, and check they see each other move.
- Then Milestone 4: voice with room rules (talk in Gaming, silent elsewhere).

## Open questions
- Trystero library is loaded from a pinned CDN link (esm.sh) rather than a local copy, because its build files need a CDN to resolve some internal pieces. If that CDN ever has an outage, movement/voice would pause until it's back (rest of the site stays up). You approved this tradeoff already.
- Room name and password for matchmaking are in `config.js`, randomly generated. Since the GitHub repo is public, anyone who reads the source could see them, this is "hard to stumble onto by accident," not a real secret. Fine for a private friends project with nothing sensitive shared, per the project's own rules.
