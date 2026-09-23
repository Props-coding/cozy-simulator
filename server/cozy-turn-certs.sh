#!/bin/sh
# Copies Caddy's HTTPS certificate for api.thecozy.world to where the voice
# relay (coturn) can read it, and restarts the relay if it changed. Runs
# once a day (cozy-turn-certs.timer), so the relay picks up Caddy's
# automatic renewals. Installed to /usr/local/bin/cozy-turn-certs.
set -e
SRC=/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/api.thecozy.world
DST=/etc/coturn/tls
install -d -m 750 -o root -g turnserver "$DST"
if ! cmp -s "$SRC/api.thecozy.world.crt" "$DST/cert.pem" || ! cmp -s "$SRC/api.thecozy.world.key" "$DST/key.pem"; then
  install -m 640 -o root -g turnserver "$SRC/api.thecozy.world.crt" "$DST/cert.pem"
  install -m 640 -o root -g turnserver "$SRC/api.thecozy.world.key" "$DST/key.pem"
  systemctl restart coturn
  echo "Relay certificate updated."
fi
