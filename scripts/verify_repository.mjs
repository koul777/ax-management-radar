// Read-only publication check. Never prints matched sensitive content.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const staged = process.argv.includes("--staged");
const args = staged
  ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
  : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
const files = [...new Set(execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean))];
assert.ok(files.length, "No public source candidates found");
const forbiddenName = /(?:^|\/)(?:\.env[^/]*|\.vercel|\.agents|\.codex|\.tmp|node_modules|reference-media)(?:\/|$)|\.(?:sav|dta|zip|xlsx?|csv|tsv|pdf|hwpx?|docx?|pem|key|mp4|wav|mp3)$/i;
const knownSecrets = /(?:sk-proj-|sk-ant-|github_pat_|ghp_)[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const privateLocation = /[a-z]:[\\/]+(?:Users[\\/]+[^\\/\s"<>]+|직무자료[^\\/\s"<>]*)/i;
const textFile = /\.(?:[cm]?[jt]sx?|py|json|md|css|html|toml|yml|yaml|txt)$|(?:^|\/)(?:\.gitignore|\.vercelignore)$/i;
const failures = [];
let bytes = 0;
for (const file of files) {
  if (forbiddenName.test(file)) failures.push(`${file}: forbidden publication file type or directory`);
  const content = staged ? execFileSync("git", ["show", `:${file}`], { maxBuffer: 32 * 1024 * 1024 }) : fs.readFileSync(file);
  bytes += content.length;
  if (content.length > 20 * 1024 * 1024) failures.push(`${file}: oversized file requires explicit publication review`);
  if (!textFile.test(file)) continue;
  const text = content.toString("utf8");
  if (knownSecrets.test(text)) failures.push(`${file}: possible credential (value suppressed)`);
  if (privateLocation.test(text)) failures.push(`${file}: private absolute location (value suppressed)`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${files.length} ${staged ? "staged" : "candidate"} public files checked (${(bytes / 1024 / 1024).toFixed(2)} MiB). Known credential/private-path patterns and raw/media file exclusions passed. This is a bounded pattern check, not a privacy guarantee.`);
}
