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

- Top-down 2D on an HTML canvas, one screen, in a Stardew Valley-style look (see "Stardew-style rendering" below for what that means and how it is built; this replaces an earlier attempt at a rotated isometric view, which was tried in Milestone 7 and looked wrong). Layout: a hallway in the middle with Gaming, Study, and Dinner rooms around it.
- Simple square floor tiles, viewed straight from above. Objects and characters are drawn standing upright on the tiles, not laid flat.
- Arrow keys or WASD. Walls with doorways. Smooth movement.
- Each player has a name, color, position, and current room.
- Broadcast position about 10 to 15 times per second and smooth it on the receiving side.
- **Join screen:** name, color choice, and a Join button.
- A small sidebar lists who is in which room.

## Stardew-style rendering

This section governs the Milestone 7 rewrite. It replaces the earlier "Isometric rendering" approach, which produced a tilted, hard-to-read diamond-shaped room. This is the easier, more forgiving technique actual cozy top-down games use, and it is the checklist for "does the rewrite look right," not just "does it run."

- **The floor stays a simple grid, viewed straight down.** Square tiles, not diamonds. This is what makes rooms read clearly as rooms, and it avoids the rotated-grid math that made the isometric attempt fragile.
- **Objects and characters are drawn standing up, not flat on the floor.** A tree, a table, a person: each is a simple upright shape (or sprite) planted on a tile, tall enough to have a top and a bottom, rather than a flat painted rectangle.
- **A soft shadow under every object and character, right where it touches the floor.** This is the single biggest depth cue in this style, more than any shading trick. Every wall decoration, every piece of furniture, every character needs one.
- **Draw order by vertical screen position, one simple rule: whatever is lower on screen draws in front.** No depth axis to juggle, no two-factor sort. When the character walks below a table, the character overlaps the table's bottom edge; when above it, the table overlaps the character. This one rule does most of the work of "standing in a room" that isometric was trying to achieve with much more math.
- **A little shading on tall objects, but nowhere near full three-face treatment.** A slightly darker band at the base of a tree or piece of furniture, and a slightly lighter top, is enough. No need for separate top, left, and right faces.
- **One consistent light direction for that shading,** same as before: pick one (light from above works fine here) and use it everywhere so shadows and shading agree with each other.
- **Walls stay simple colored panels with a baseboard line,** not standing 3D boxes. A thin darker line where a wall meets the floor is enough to read as a vertical surface without building it as a box.

## Suggested file layout

```
index.html        the page
style.css         looks
main.js           starts everything
world.js          house layout, movement, room detection
render.js         Stardew-style drawing: floor tiles, object shadows and shading, draw-order sort
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
7. **Stardew-style rendering rewrite.** Replace the flat look with the Stardew-style checklist above: simple floor tiles, upright objects with shadows, one light direction, draw order by vertical position, and simple baseboard walls. An earlier attempt at rotated isometric view was tried here and looked wrong, this replaces it. Test by walking the character in front of and behind furniture before calling this done.
8. **Further polish.** Cozier look, join and leave sounds, nicer characters, once the rendering base is solid.

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

Already done: study focus timer (body-doubling), knock on locked offices, personal offices with lock and secret themes, house and office chat.

### Big ideas (added 2026-09-22)

Suggested order, since later ideas build on earlier ones: 1 and 2 first (they reshape the map), then 3 and 4, then 5 to 8 and 10 as one "progression" group. The Library (9) and emotes (10) could come any time, since the Library doesn't depend on anything and the free emotes don't need coins.

1. **Rooms on the north side of the hallway too, and offices that close the gap.** The hallway stays one corridor through the middle of the house, with rooms opening off both sides: the same way Gaming, Study and Dinner hang below it with doors in its bottom wall, new rooms hang above it with doors in its top wall. Offices move to the north side first. When an office is removed, the offices after it slide over to fill its spot instead of leaving a hole, and anyone standing in an office that slides moves with it. Note: the hallway's top wall currently holds the office-building door, coat hooks, paintings, lamps, the side table and the bench, so those get rearranged around the new doorways.
2. **Bedrooms.** Built and owned like offices (one per person, lockable, gone while the owner is offline). Could carry the older bedroom idea: white noise, and a "goodnight" moment when you leave. Needs a decision on where they go (for example north wing next to offices, or their own wing).
3. **Theater (replaces Gaming).** Voice stays on, like Gaming now. A big screen where everyone in the room watches the same YouTube video: play, pause and skipping stay in sync for everyone in the Theater. Each person streams the video from YouTube themselves, so it costs nothing extra. Some videos don't allow embedding and won't play.
4. **Conference room with a whiteboard.** A large conference table, voice on. A whiteboard anyone in the room can draw on together, with a few pen colors and a clear button. Drawings are shared live and sent to people who walk in; they last only while someone is in the house (no server to store them), unless we add a "save as picture" button.
5. **Currency.** Earn coins for time spent in the house (for example a few per minute, maybe a small bonus in Study focus sessions).
6. **Achievements.** Small badges for things like first office built, hours in the house, a finished focus session, first knock.
7. **Character customization with unlockables.** Spend coins to unlock more hats, shoes, and other extras (for example outfits, glasses, name-tag colors, or trails). Picked on the Join screen or in a wardrobe.
   - **The shopkeeper: three raccoons in a trenchcoat.** Items are bought from a shady-but-cozy vendor: three raccoons stacked on top of each other inside one long trenchcoat, drawn in our style (soft shadow, lit from above, upright on the floor). Ideas for the look: the top raccoon's masked face and ears poking out of the collar under a floppy hat, a second pair of eyes peeking out between the coat buttons, little paws at the sleeve ends, and a striped tail or two poking out under the hem. Walk up and press a key to open the shop, which "flashes open the coat" to show the wares. A few shifty lines of dialogue ("psst... hats. you want hats?").
8. **Pets.** A little pet that follows you around (cat, dog, and so on), unlockable with coins, visible to friends.
9. **Library with rain.** A quiet, cozy reading room: tall bookshelves, reading nooks, warm lamps, and rain streaming down the windows. Rain sound plays softly for everyone inside (locally, like the Study's lo-fi, fading in and out as you enter and leave), with its own volume slider. The rain can be generated in code (filtered noise shaped to sound like rain), so there's no sound file to find, license or host. Voice off, like the Study, or quiet voice (decide when building).
10. **Emotes** (suggested by Kxiven). Quick character actions friends can see, like wave, heart, laugh, dance or sleepy, from number keys or a small emote wheel. A few free to start, more unlockable with coins.

**Honest limits for 5 to 8 and 10:** with no server, coins, achievements and unlocks are saved in each person's own browser. That means they don't follow you to another computer or browser, clearing browser data erases them, and a tech-savvy friend could edit their own coins. For a friends project that's usually fine; a "backup code" you can copy and paste back in would protect against losing progress.

### Older ideas still open

- **Weather station:** stand on a mood tile so friends can see how you are doing without a word
- **Porch:** a quiet spot for small late-night talks, lower voice volume
- **Fireplace room:** ambient crackle in a room with no agenda (the Props lake-house office already has a fireplace)
- **Music room:** a shared jukebox
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
- [ ] Rendering reads clearly (shadows, correct draw order, floor tiles, consistent shading)
- [ ] Settings are easy to change in `config.js`
- [ ] `README.md` explains in plain language how to update the site

## If peer to peer proves unreliable

Say so plainly and offer options instead of piling on complexity. The main fallback is the free hosted plan of WorkAdventure (an existing product that already does rooms with proximity voice). Another option is adding a tiny signaling or relay service. Let the user decide.
