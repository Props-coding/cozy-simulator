# Server update waiting (for Claude Code on Brandon's PC)

Written 2026-09-28 by the cloud session, which can't reach the droplet.
Build 0.751 (the Farm and Hazel's gardening lesson) changes the house
server. Deploy it at the same time as 0.751 goes live. Until then:

- Hazel's lesson never starts (everyone counts as done, so Hazel is at the Farm for everyone).
- The yard's starter beds accept any crop (the server doesn't know about the starter patch yet).
- People can grow in 3 beds at once instead of 4 (the server uses its own copy of config.js).

## What to do

Do this with Brandon, one step at a time, and tell him what each step does.
Details on the server are in `server/README.md` ("Updating the program").

1. Pull the latest `main` so this folder has the new files.
2. Run the checks: `npm install` once, then `npm run lint` and `npm test` (both must pass).
3. Log in: `ssh props@142.93.3.149`.
4. Back up the save file first:
   `sudo cp /var/lib/cozy-server/db.json /var/lib/cozy-server/db.before-0.751.json`
5. Look at the current files' owner and permissions, so the new copies match:
   `ls -l /opt/cozy-server/ /opt/cozy-server/game/`
6. Copy the new files up (to the home folder first, for example with `scp`), then into place:
   - `server/server.mjs` goes to `/opt/cozy-server/server.mjs`
   - `config.js`, `catalog.js` and `world.js` (from the repo's root) go to `/opt/cozy-server/game/`
   Match the owner and permissions from step 5 if they differ.
7. Restart: `sudo systemctl restart cozy-server`
8. Check it came up: `sudo systemctl status cozy-server` and `sudo journalctl -u cozy-server -n 30`.
   You should see a line starting "Game data:" and no errors.
9. Quick test in the game: the admin panel's "Redo Hazel's lesson" (Me tab), then talk to Hazel by her yard stand: she should offer a radish seed.
10. If anything breaks: put the old files back (or restore `db.before-0.751.json`) and restart.

When it's done, delete this file, update PROGRESS.md (remove the "Needs the server deployed" note for 0.751 and the line under "Next"), and remove the "Waiting" line near the top of CLAUDE.md.
