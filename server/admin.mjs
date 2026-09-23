// Small admin tool for the house owner, run on the droplet:
//
//   sudo cozy-admin users          list accounts
//   sudo cozy-admin reset NAME     give NAME a one-time code to set a new password
//   sudo cozy-admin phrase         set (or change) the house phrase
//   sudo cozy-admin remove NAME    delete an account (and its cloud save) for good
//
// It talks to the running server on the droplet itself, using the admin
// token from /etc/cozy-server.env (which only root can read).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const ENV_FILE = "/etc/cozy-server.env";
const envText = readFileSync(ENV_FILE, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);
const base = `http://127.0.0.1:${env.PORT || 3000}`;
const headers = { "Content-Type": "application/json", "X-Admin-Token": env.ADMIN_TOKEN };

const [command, ...rest] = process.argv.slice(2);
const name = rest.join(" ");

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Asks for the new house phrase here on the droplet (so it never goes
// anywhere else), saves it, and restarts the server to use it.
async function setPhrase() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const phrase = (await rl.question("New house phrase (friends type this once): ")).trim().replace(/\s+/g, " ");
  rl.close();
  if (phrase.length < 8) throw new Error("Use at least 8 characters (a few words is best).");
  const kept = envText.split("\n").filter((line) => line && !line.startsWith("HOUSE_PHRASE="));
  writeFileSync(ENV_FILE, [...kept, "HOUSE_PHRASE=" + phrase].join("\n") + "\n", { mode: 0o600 });
  execFileSync("systemctl", ["restart", "cozy-server"]);
  console.log("Saved, and the server restarted. Share the phrase with friends privately (not in the House chat).");
}

try {
  if (command === "users") {
    const { users } = await call("GET", "/admin/users");
    if (!users.length) console.log("No accounts yet.");
    for (const u of users) console.log(`${u.name.padEnd(17)} ${u.member ? "in the house" : "no phrase yet"}   made ${u.created}${u.hasSave ? "   has a cloud save" : ""}`);
  } else if (command === "reset" && name) {
    const r = await call("POST", "/admin/reset", { name });
    console.log(`Reset code for ${r.name}: ${r.code}`);
    console.log(`Send it to them privately. On the Join screen they choose "Forgot password?", enter it, and pick a new password. It works once, for ${r.hours} hours.`);
  } else if (command === "remove" && name) {
    const r = await call("POST", "/admin/remove", { name });
    console.log(`Removed ${r.name}'s account and cloud save.`);
  } else if (command === "phrase") {
    await setPhrase();
  } else {
    console.log("Usage:\n  sudo cozy-admin users\n  sudo cozy-admin reset NAME\n  sudo cozy-admin remove NAME\n  sudo cozy-admin phrase");
  }
} catch (err) {
  console.error("Didn't work:", err.message);
  process.exit(1);
}
