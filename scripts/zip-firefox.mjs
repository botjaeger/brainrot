#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const firefoxDir = resolve(rootDir, "dist/firefox");
const outFile = resolve(rootDir, "brainrot-firefox.zip");

if (!existsSync(firefoxDir)) {
  console.error("dist/firefox/ not found — run `pnpm build` first.");
  process.exit(1);
}

execSync(`rm -f "${outFile}"`);
execSync(`cd "${firefoxDir}" && zip -r "${outFile}" .`);

console.log(`Created ${outFile}`);
