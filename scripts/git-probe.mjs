import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    return `ERR: ${(e.stderr || e.message || "").toString().trim().slice(0, 120)}`;
  }
};

console.log("=== GIT PROBE (Vercel build env) ===");
console.log("cwd:", root);
console.log(".git present:", existsSync(join(root, ".git")));
console.log("git version:", run("git --version"));
console.log("is-shallow:", run("git rev-parse --is-shallow-repository"));
console.log("commit count:", run("git rev-list --count HEAD"));
console.log("HEAD sha:", run("git rev-parse HEAD"));
console.log("add-date next-voice-cloning-app:", run("git log --diff-filter=A --format=%ct --reverse -- demos/next-voice-cloning-app | head -1"));
console.log("add-date audiobook-pipeline:", run("git log --diff-filter=A --format=%ct --reverse -- demos/audiobook-pipeline | head -1"));
console.log("VERCEL_GIT_COMMIT_SHA:", process.env.VERCEL_GIT_COMMIT_SHA || "(unset)");
console.log("=== END GIT PROBE ===");
