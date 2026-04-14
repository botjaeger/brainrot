#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chromiumDir = resolve(rootDir, "dist/chromium");
const outFile = resolve(rootDir, "brainrot-chrome.zip");

if (!existsSync(chromiumDir)) {
  console.error("dist/chromium/ not found — run `npm run build` first.");
  process.exit(1);
}

execSync(`rm -f "${outFile}"`);
execSync(`cd "${chromiumDir}" && zip -r "${outFile}" .`);

console.log(`Created ${outFile}`);
