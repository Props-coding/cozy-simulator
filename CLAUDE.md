# Cozy House: Project Guide for Claude Code

A cozy browser hangout for a few friends. Read this whole file before doing anything. Then start at Milestone 1.

## Who you are working with

The user is creative, smart, and a psychologist by trade, but has no coding knowledge. They can follow clear steps and want to end up with something good and efficient. They are not very organized, so keep things tidy for them: small steps, a running checklist, and clear "what to do next" notes.

## Working agreement

1. **Plain language.** No jargon without a one-sentence explanation. Explain each choice in one or two sentences, not paragraphs.
2. **One milestone at a time.** Finish it, show the user how to test it, wait for their result, then move on.
3. **Tell them how to test.** After each milestone, give a short numbered list of exact clicks to verify it works.
4. **Commit to git** after each working milestone with a clear message.
5. **Keep `PROGRESS.md` updated:** what is done, what is next, open questions. Update it at the end of every milestone.
6. **Ask before** installing anything, creating accounts, changing settings, signing up for services, or doing anything hard to undo.
7. **Never ask the user to paste passwords or tokens into chat.** For GitHub login, tell them to run the login step themselves in their own terminal.
8. **Research before choosing.** Library versions and APIs change. Before using Trystero or any other library, read its current README or docs and confirm how it works today. Do not rely on memory.
9. **Keep it simple.** Plain HTML, CSS, and JavaScript. No frameworks and no build step unless truly needed, and ask first if you think one is needed.
10. **Comment the code in plain English** so the user can follow along.
11. **No em dashes** in anything written for the user, including docs, chat replies, and on-screen text.
12. **Be honest about uncertainty.** If something might not work (for example voice on a strict network), say so early rather than hiding it.

## The goal

A browser-based living space for 3 to 4 friends on desktop PCs. Everyone opens a link, picks a name and color, and appears as a character in a shared house. You walk between rooms, and **the room you stand in decides what you hear.** Location is status: nobody needs mute buttons or "brb" messages.

## Hard constraints

- **Hosted on GitHub Pages.** That means static files only. No server code and no backend of our own.
- **Peer to peer.** Use Trystero (serverless WebRTC matchmaking) so friends' browsers find each other. After that, voice and movement data go directly between friends. Confirm the current setup and which matchmaking strategy to use from Trystero's docs.
- **3 to 4 people at once,** desktop browsers (Chrome and Edge first, Firefox if easy).
- **Free to run,** and low maintenance.
- **The site will be public,** so anyone with the link could open it. Use a hard-to-guess room name stored in `config.js`, use Trystero's encryption password option if it is available (verify the current API), and collect no personal data.
- **GitHub Pages is not for commercial use.** This is a private friends project, so that is fine. Do not add anything that sells or charges.

## Room rules (the heart of the design)

| Room | Voice chat | Sound you hear | Notes |
|---|---|---|---|
| Hallway (hub) | Off | Silence | Neutral space between rooms |
| Gaming | On, with others in the room | Friends' voices | Talk freely |
| Study | Off | Lo-fi music, locally | Quiet co-working |
| Dinner | Off | Nothing, all sound muted | Means "I'm away eating". Show a small "eating" badge over the character |

Always keep a visible master mute and a volume control, in case someone needs to override the rules.

## How audio should work

- **Mic permission** is requested once on the Join screen. The Join button click also satisfies the browser rule that audio can only start after a user click.
- **Sending:** the mic is only live while the player stands in a voice room (Gaming for v1). In Study and Dinner the mic track is disabled so nothing leaves their computer.
- **Receiving:** play a friend's voice only if both people are in the same voice room.
- **Lo-fi in Study:** plays locally for each person, not synced. It starts when they enter Study, fades out when they leave, and has its own volume slider.
  - First try embedding a live lo-fi YouTube stream using the official YouTube embed. Embedding is sometimes blocked, so also prepare a backup: a direct audio stream URL.
  - **Do not guess stream URLs.** Find one that works today, confirm it is fine to stream, and put it in `config.js` so it is easy to swap.
- **Dinner:** silences everything, including lo-fi and all friends' voices.

## World and movement

- Top-down 2D on an HTML canvas, one screen. Layout: a hallway in the middle with Gaming, Study, and Dinner rooms around it.
- For v1, colored rectangles with labels are fine. Cozy visuals come later.
- Arrow keys or WASD. Walls with doorways. Smooth movement.
- Each player has a name, color, position, and current room.
- Broadcast position about 10 to 15 times per second and smooth it on the receiving side.
- **Join screen:** name, color choice, and a Join button.
- A small sidebar lists who is in which room.

## Suggested file layout

```
index.html        the page
style.css         looks
main.js           starts everything
world.js          house layout, movement, room detection
network.js        Trystero connection, sharing positions
audio.js          voice rules, lo-fi, mute and volume
config.js         easy settings: room name, password, stream URL, colors, room names
vendor/           a pinned copy of the Trystero file, so the site does not depend on a CDN
CLAUDE.md         this file
PROGRESS.md       running checklist
README.md         short plain-language description
```

Settings the user might want to change should live in `config.js` with comments, so they never have to dig through other files.

## Milestones

Do these in order. Stop after each one for the user to test.

1. **Setup and go live.** Create the project, put a simple "Hello" page on GitHub Pages, and confirm it loads from the public address. Prove deployment first, so problems show up early.
2. **Single player.** House layout, walk around, detect which room you are in, show the room name.
3. **Multiplayer movement.** Two browser windows see each other move in real time.
4. **Voice with room rules.** Talk in Gaming, silent elsewhere.
5. **Lo-fi and Dinner.** Study music and full mute in Dinner, plus the master mute and volume.
6. **Real test with friends** on different networks. Fix problems found.
7. **Polish.** Cozier look, join and leave sounds, nicer characters.

## Testing notes

- You cannot fully test voice alone. Two windows on one PC are enough for movement. For voice, the user should use headphones to avoid feedback.
- The real test is friends on different networks and different home internet.
- If someone cannot connect or cannot hear others, the likely cause is a network that blocks direct connections. The fix is a relay called a TURN server. Add a spot for it in `config.js` (`iceServers`). Research a currently available free-tier option at that time, and ask the user before signing up for anything.

## Deployment (GitHub Pages)

- The repository must be public on a free GitHub account.
- Publish from the main branch. Use the GitHub CLI if it is installed. If not, walk the user through the website clicks one at a time.
- The site address will look like `https://USERNAME.github.io/REPO/`. Confirm it loads in a fresh browser window before calling a milestone done.
- If the user needs to log in to GitHub, have them do it themselves (see working agreement 7).

## Backlog for after v1

Add one at a time and ask the user which to do next.

- **Study body-doubling:** a shared focus timer everyone in Study can see
- **Weather station:** stand on a mood tile so friends can see how you are doing without a word
- **Porch:** a quiet spot for small late-night talks, lower voice volume
- **Theater:** watch parties with screen sharing
- **Bedroom:** white noise and a "goodnight" ritual when leaving
- **Fireplace:** ambient crackle in a room with no agenda
- **Music room:** a shared jukebox
- **Knock or doorbell** before entering a private room
- **Seasonal decorations**
- **Distance-based voice** within a room, where volume fades with distance

## Definition of done for v1

- [ ] Live on a public GitHub Pages address
- [ ] 3 to 4 friends can join from different homes
- [ ] They see each other walking around
- [ ] Gaming room: they can hear each other
- [ ] Study room: lo-fi plays and nobody's voice is heard
- [ ] Dinner room: everything is silent
- [ ] Master mute and volume work
- [ ] Settings are easy to change in `config.js`
- [ ] `README.md` explains in plain language how to update the site

## If peer to peer proves unreliable

Say so plainly and offer options instead of piling on complexity. The main fallback is the free hosted plan of WorkAdventure (an existing product that already does rooms with proximity voice). Another option is adding a tiny signaling or relay service. Let the user decide.
