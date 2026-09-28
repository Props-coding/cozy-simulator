# Porchlight

A small browser hangout for a few friends. Everyone opens a link, picks a name and color, and walks around a shared house. The room you're standing in decides what you hear (voice chat, music, or silence).

## How to update the site

1. Make changes to the files (ask Claude Code for help).
2. Commit and push the changes to the `main` branch on GitHub.
3. GitHub Pages updates automatically within a minute or two.
4. Refresh the site address to see your changes.

## Automatic checks (the safety net)

Every change pushed to GitHub is checked automatically (the "Checks" tab on GitHub, or a green tick or red X next to each change):

1. **The mistake checker** looks through the code for slips, like using a name that doesn't exist or using something before it's set up.
2. **The house test** opens the house in a hidden browser with a test account, visits every floor (house, yard, Willow Lake, the alley), and fails if anything goes wrong. It also reports how long each floor takes to draw.

A red X means something broke: ask Claude Code to look at it before going live.

Claude also keeps a **picture of every floor** and compares it after each change, to catch things that moved or changed by accident.

None of this changes the site itself. The tools live in `package.json` (developer tools only), `eslint.config.js`, `playwright.config.js`, the `tests/` folder and `.github/workflows/checks.yml`. To run them on a computer with Node.js: `npm install` once, then `npm run lint`, `npm test` and `npm run test:pictures`.

## Settings

Things you might want to change (room name, colors, music link) live in `config.js`, with comments explaining each one.

## Credits

- Library rain sound: "Rain" by ezwa, public domain (from pdsounds.org, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Rain_(1).ogg).
