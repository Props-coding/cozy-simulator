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

## Next
- Milestone 6: real test with friends on different networks. This will also settle the pinned voice issue below.

## Open questions
- **Pinned: voice in Gaming still not confirmed working**, even after fixing two real bugs (relay redundancy, a missing `.play()` call). All the basic checks came back clean (not muted, volume up, tab not muted, system mixer not zeroed). Most likely explanation is that testing two windows on one PC, sharing one mic and one set of speakers, just isn't a reliable way to test voice (the project's own testing notes flagged this from the start). Real signal will come from testing with an actual friend on their own computer in Milestone 6. If it still fails there, the next move is a self-hosted relay or TURN server (e.g. a small DigitalOcean droplet), which is a real fix for real connectivity problems, but costs money and needs an account, so we'd decide that together only if needed.
- Trystero library is loaded from a pinned CDN link (esm.sh) rather than a local copy, because its build files need a CDN to resolve some internal pieces. If that CDN ever has an outage, movement/voice would pause until it's back (rest of the site stays up). You approved this tradeoff already.
- Room name and password for matchmaking are in `config.js`, randomly generated. Since the GitHub repo is public, anyone who reads the source could see them, this is "hard to stumble onto by accident," not a real secret. Fine for a private friends project with nothing sensitive shared, per the project's own rules.
