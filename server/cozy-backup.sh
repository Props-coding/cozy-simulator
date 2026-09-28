#!/bin/sh
# The house's nightly backup (run by cozy-backup.timer): everything the
# house server keeps (accounts, wallets, bedrooms, mail, journals, which
# stay encrypted) packed into one file, kept for 30 days. Only root can
# read them. To restore one: stop cozy-server, unpack it over /, start it.
set -eu
DIR=/var/backups/cozy-nightly
mkdir -p "$DIR"
chmod 700 "$DIR"
tar czf "$DIR/cozy-$(date +%Y-%m-%d).tgz" /var/lib/cozy-server 2>/dev/null
chmod 600 "$DIR"/*.tgz
find "$DIR" -name 'cozy-*.tgz' -mtime +30 -delete
