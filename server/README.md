# The Cozy House server

A small program on the DigitalOcean droplet that handles what the static site can't:

- **Accounts:** names and passwords (passwords are stored scrambled, never as plain text).
- **The house phrase:** friends say it once and their account is in the house. The server then gives the page the room name, the room password and the relay login, so those aren't in the public code.
- **Cloud saves:** crumbs, what you own, achievements, your bedroom, letters and your look, kept on your account.
- **The voice relay (coturn):** when two friends' home networks can't connect directly, their voices and movement go through it. The server hands each logged-in friend a relay login that only lasts a day.

It's plain Node.js with no extra packages, behind Caddy (which handles HTTPS) at `https://api.thecozy.world`.

## On the droplet

| What | Where |
|---|---|
| The program | `/opt/cozy-server/server.mjs` (runs as the locked-down `cozy` user) |
| Secrets (house phrase, room, relay login, admin token) | `/etc/cozy-server.env` (only root can read it; never put these in the repo) |
| Accounts and saves | `/var/lib/cozy-server/db.json`, with a copy each day in `backups/` (the last 14 are kept) |
| Service | `cozy-server` (systemd): `sudo systemctl status cozy-server` |
| Web server settings | `/etc/caddy/Caddyfile` |
| Voice relay | service `coturn`, settings in `/etc/turnserver.conf` (made from `turnserver.conf` here, with the secret filled in). Ports 3478 (UDP/TCP), 5349 (TLS) and 50000 to 50500 (UDP) are open in the firewall |
| Relay certificate | copied from Caddy daily by `cozy-turn-certs` (a timer), so it renews along with Caddy's |

## Who can get in

- SSH logins: only the `props` user, only with the key on the house owner's PC (`C:\Users\justk\.ssh\id_ed25519`). Password and root logins are off.
- `props` can run admin commands without a password (`/etc/sudoers.d/90-props-admin`), so Claude Code can maintain the server during a session with the owner. That makes the key file the real lock: keep the PC locked, and don't copy the key anywhere. To require the password again: `sudo rm /etc/sudoers.d/90-props-admin`.
- If the key is ever lost: DigitalOcean website → Droplet → Access → Reset root password → Recovery Console.

## Things you might need

Log in with `ssh props@142.93.3.149`, then:

- **Set or change the house phrase:** `sudo cozy-admin phrase`. Everyone who already entered the old one stays in; new people need the new one.
- **Someone forgot their password:** `sudo cozy-admin reset NAME`. Send them the code privately. On the Join screen they choose "Forgot password?".
- **See who has an account:** `sudo cozy-admin users`
- **Delete an account:** `sudo cozy-admin remove NAME`
- **Check it's running:** `sudo systemctl status cozy-server`, and recent messages with `sudo journalctl -u cozy-server -n 30`
- **Check the relay:** `sudo systemctl status coturn`, and `sudo journalctl -u coturn -n 30`

## Updating the program

Copy the changed files from this folder to `/opt/cozy-server/` and restart it with `sudo systemctl restart cozy-server`. (Claude Code does this for you.)
