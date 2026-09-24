#!/usr/bin/env node
// Bumps every version field, dates the version's changelog entry (which must
// exist in src/shared/changelog.ts), runs the local gate, commits, tags v<version>,
// and pushes. The tag push triggers .github/workflows/release.yml, which
// publishes to the Chrome Web Store and addons.mozilla.org.
//
// Usage: pnpm release <version> [--dry-run]

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((arg) => !arg.startsWith("--"));

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(command) {
  console.log(`$ ${command}`);
  execSync(command, { cwd: rootDir, stdio: "inherit" });
}

function output(command) {
  return execSync(command, { cwd: rootDir, encoding: "utf8" }).trim();
}

function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail("usage: pnpm release <major.minor.patch> [--dry-run]");
}

const manifestPath = resolve(rootDir, "manifest.json");
const current = JSON.parse(readFileSync(manifestPath, "utf8")).version;

if (compareSemver(version, current) <= 0) {
  fail(`${version} is not greater than the current version ${current}`);
}

if (!dryRun && output("git status --porcelain") !== "") {
  fail("working tree is not clean; commit or stash first");
}

if (!dryRun) {
  run("git fetch --quiet origin");
  const behind = output("git rev-list --count HEAD..@{upstream}");
  if (behind !== "0") {
    fail(`branch is ${behind} commit(s) behind its upstream; pull first`);
  }
}

// Each pattern must match exactly once, so a moved or renamed field fails
// loudly instead of silently shipping a stale version.
const escaped = current.replaceAll(".", "\\.");
const bumps = [
  ["manifest.json", new RegExp(`("version": ")${escaped}(")`)],
  ["package.json", new RegExp(`("version": ")${escaped}(")`)],
  ["src/shared/brand.ts", new RegExp(`(APP_VERSION = ")${escaped}(")`)],
  [
    "safari/AutoYouTubeShortsScroller/Info.plist",
    new RegExp(`(<key>CFBundleShortVersionString</key>\\s*<string>)${escaped}(</string>)`),
  ],
  [
    "safari/AutoYouTubeShortsScrollerExtension/Info.plist",
    new RegExp(`(<key>CFBundleShortVersionString</key>\\s*<string>)${escaped}(</string>)`),
  ],
  ["SOURCE_BUILD.md", new RegExp(`(Brainrot )${escaped}()`)],
  ["SOURCE_BUILD.md", new RegExp(`(brainrot-)${escaped}(\\.zip)`)],
];

const files = new Map();
for (const [file, pattern] of bumps) {
  const path = resolve(rootDir, file);
  const text = files.get(path) ?? readFileSync(path, "utf8");
  const matches = text.match(new RegExp(pattern.source, "g")) ?? [];
  if (matches.length !== 1) {
    fail(`${file}: expected 1 match for ${pattern}, found ${matches.length}`);
  }
  files.set(path, text.replace(pattern, (_, before, after) => `${before}${version}${after}`));
  console.log(`${file}: ${current} -> ${version}`);
}

// Release notes must exist before shipping; stamp today's date on them.
const changelogPath = resolve(rootDir, "src/shared/changelog.ts");
const changelog = readFileSync(changelogPath, "utf8");
const entryPattern = new RegExp(
  `^(\\s*)version: "${version.replaceAll(".", "\\.")}",\\n(\\s*date: "[^"]*",\\n)?`,
  "m",
);
const entry = changelog.match(entryPattern);
if (!entry) {
  fail(`src/shared/changelog.ts has no entry for ${version}; write the release notes first`);
}
if (!entry[2]) {
  const today = new Date().toLocaleDateString("en-CA");
  files.set(
    changelogPath,
    changelog.replace(entryPattern, (match, indent) => `${match}${indent}date: "${today}",\n`),
  );
  console.log(`src/shared/changelog.ts: dated ${version} ${today}`);
}

if (dryRun) {
  console.log("dry run: no files written, nothing committed or pushed");
  process.exit(0);
}

for (const [path, text] of files) {
  writeFileSync(path, text);
}

run("pnpm check");

const tag = `v${version}`;
run(`git commit -am "chore(release): ${version}"`);
run(`git tag ${tag}`);
run("git push origin HEAD");
run(`git push origin ${tag}`);

console.log(`Pushed ${tag}. Store publishing runs in GitHub Actions.`);
