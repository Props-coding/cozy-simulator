// The mistake checker (ESLint): run `npm run lint`. It reads the code
// without running it and flags slips like using a name that doesn't exist
// (a typo, or a function that was never written) or using something before
// it's set up (which would stop the page loading).
//
// The site's older-style scripts (the plain <script> tags in index.html:
// config.js, world.js, render.js and friends) share their top-level names
// with each other and with the newer module files. So this file reads
// index.html, finds those scripts, and collects the names each one makes,
// so the checker knows they're real. It also reports a name made in two of
// those scripts (the second one would break the page as it loads).
import { readFileSync } from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import * as espree from "espree";
import { defineConfig } from "eslint/config";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const sharedScripts = [...html.matchAll(/<script src="([\w-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map((m) => m[1]);

// The top-level names one script makes (functions, const, let, var, class).
function topLevelNames(file) {
  const tree = espree.parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8"), { ecmaVersion: "latest", sourceType: "script" });
  const names = [];
  const collect = (pattern) => {
    if (!pattern) return;
    if (pattern.type === "Identifier") names.push(pattern.name);
    else if (pattern.type === "ObjectPattern") pattern.properties.forEach((p) => collect(p.value ?? p.argument));
    else if (pattern.type === "ArrayPattern") pattern.elements.forEach(collect);
    else if (pattern.type === "RestElement") collect(pattern.argument);
    else if (pattern.type === "AssignmentPattern") collect(pattern.left);
  };
  for (const node of tree.body) {
    if (node.type === "VariableDeclaration") node.declarations.forEach((d) => collect(d.id));
    if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id) names.push(node.id.name);
  }
  return names;
}

const namesByScript = Object.fromEntries(sharedScripts.map((file) => [file, topLevelNames(file)]));
const shared = Object.fromEntries(Object.values(namesByScript).flat().map((name) => [name, "writable"]));
// Also: the loading screen (a small script inside index.html itself), and
// YouTube's player (the Theater and the Study's lo-fi load it from YouTube).
shared.Loading = "readonly";
shared.YT = "readonly";

// A name made in two shared scripts is a real error (reported when you lint).
const madeIn = {};
for (const [file, names] of Object.entries(namesByScript)) for (const name of names) (madeIn[name] ??= []).push(file);
const twice = Object.entries(madeIn).filter(([, files]) => files.length > 1);
if (twice.length) {
  console.error("Made in more than one shared script (the page would stop loading):");
  for (const [name, files] of twice) console.error(`  ${name}: ${files.join(", ")}`);
  process.exitCode = 1;
}

// Each shared script sees everyone else's names (not its own: those it declares).
const othersFor = (file) => {
  const own = new Set(namesByScript[file]);
  return Object.fromEntries(Object.keys(shared).filter((name) => !own.has(name)).map((name) => [name, "writable"]));
};

const rules = {
  // Using something before it's set up, where that would fail as the file
  // loads. (Using it later, inside a function, is fine.)
  "no-use-before-define": ["error", { functions: false, classes: false, variables: false }],
  // Leftovers aren't mistakes: shown as warnings only.
  "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
  "no-empty": ["warn", { allowEmptyCatch: true }],
};

export default defineConfig([
  { ignores: ["node_modules/", "test-results/", "playwright-report/", "tests/.data/"] },
  // The newer module files (main.js, fishing.js...): they can use the shared names too.
  {
    files: ["**/*.js"],
    ignores: [...sharedScripts, "sw.js", "eslint.config.js", "playwright.config.js", "tests/**", "server/**"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { sourceType: "module", globals: { ...globals.browser, ...shared } },
    rules,
  },
  // The shared scripts themselves.
  ...sharedScripts.map((file) => ({
    files: [file],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, ...othersFor(file) } },
    // (Their top-level names are used by the other files, so only local leftovers count.)
    rules: { ...rules, "no-redeclare": "off", "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }] },
  })),
  // The service worker (keeps the site working offline and updating).
  { files: ["sw.js"], plugins: { js }, extends: ["js/recommended"], languageOptions: { sourceType: "script", globals: globals.serviceworker }, rules },
  // The house server and the test setup (run by Node, not the browser).
  // (The tests also hand bits of code to the page, so they know its names too.)
  {
    files: ["tests/**/*.js", "tests/**/*.mjs"],
    ignores: ["tests/fake-trystero.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser, ...shared } },
    rules,
  },
  {
    files: ["server/**/*.mjs", "server/**/*.js", "eslint.config.js", "playwright.config.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
    rules,
  },
]);
