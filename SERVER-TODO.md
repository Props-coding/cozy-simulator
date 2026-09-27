# Server update waiting (for Claude Code on Brandon's PC)

Written 2026-09-27 by the cloud session, which can't reach the droplet.
The site (builds 0.69 to 0.72) is live on GitHub Pages, but the house
server on the droplet still runs the older code. Until it's updated:

- Casting into Willow Lake fails ("That's not on the pond").
- Otis's fishing lesson never starts (everyone counts as done).
- The pond isn't capped to common and uncommon fish.
- Clover's and Mortimer's daily requests, gifts, hearts and recipes stay hidden (Update 6, 0.69), if that part wasn't deployed already.

## What to do

Do this with Brandon, one step at a time, and tell him what each step does.
Details on the server are in `server/README.md` ("Updating the program").

1. Pull the latest `main` so this folder has the new files.
2. Check they load: `node --check server/server.mjs`.
3. Log in: `ssh props@142.93.3.149`.
4. Back up the save file first:
   `sudo cp /var/lib/cozy-server/db.json /var/lib/cozy-server/db.before-0.72.json`
5. Look at the current files' owner and permissions, so the new copies match:
   `ls -l /opt/cozy-server/ /opt/cozy-server/game/`
6. Copy the new files up (to the home folder first, for example with `scp`), then into place:
   - `server/server.mjs` goes to `/opt/cozy-server/server.mjs`
   - `config.js`, `catalog.js` and `world.js` (from the repo's root) go to `/opt/cozy-server/game/`
   Match the owner and permissions from step 5 if they differ.
7. Restart: `sudo systemctl restart cozy-server`
8. Check it came up: `sudo systemctl status cozy-server` and `sudo journalctl -u cozy-server -n 30`.
   You should see a line starting "Game data:" and no errors.
9. Quick test in the game: take the bus to Willow Lake and cast from the pier (it should work), and talk to Clover (a "Today's request" tab should show).
10. If anything breaks: put the old files back (or restore `db.before-0.72.json`) and restart.

When it's done, delete this file, update PROGRESS.md (remove the "Needs the server deployed" notes for 0.69 and 0.71), and remove the "Waiting" line near the top of CLAUDE.md.
