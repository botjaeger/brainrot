import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(rootDir, "dist");
const baseManifestPath = join(distDir, "manifest.json");
const firefoxOverlayPath = join(rootDir, "manifest.firefox.json");

const target = process.argv[2] ?? "all";
const packageTargets = {
  chromium: join(distDir, "chromium"),
  firefox: join(distDir, "firefox"),
};
const packageTargetNames = new Set(Object.keys(packageTargets));

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(baseValue, overlayValue) {
  if (Array.isArray(baseValue) && Array.isArray(overlayValue)) {
    return overlayValue.slice();
  }

  if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
    const merged = { ...baseValue };

    for (const [key, value] of Object.entries(overlayValue)) {
      if (value === null) {
        delete merged[key];
      } else {
        merged[key] = key in baseValue ? mergeDeep(baseValue[key], value) : value;
      }
    }

    return merged;
  }

  return overlayValue;
}

async function ensureSourceArtifacts() {
  const [manifest, overlay] = await Promise.all([
    readFile(baseManifestPath, "utf8"),
    readFile(firefoxOverlayPath, "utf8"),
  ]);

  return {
    manifest: JSON.parse(manifest),
    overlay: JSON.parse(overlay),
  };
}

async function writePackage(packageName, manifest) {
  const outputDir = packageTargets[packageName];

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const entries = await readdir(distDir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === "manifest.json" ||
      packageTargetNames.has(entry.name) ||
      entry.name === "site"
    ) {
      continue;
    }

    await cp(join(distDir, entry.name), join(outputDir, entry.name), {
      recursive: true,
    });
  }

  await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function run() {
  const { manifest: baseManifest, overlay } = await ensureSourceArtifacts();

  if (target !== "chromium" && target !== "firefox" && target !== "all") {
    throw new Error(`Unknown package target "${target}". Use chromium, firefox, or all.`);
  }

  if (target === "chromium" || target === "all") {
    await writePackage("chromium", baseManifest);
    console.log("Wrote dist/chromium");
  }

  if (target === "firefox" || target === "all") {
    await writePackage("firefox", mergeDeep(baseManifest, overlay));
    console.log("Wrote dist/firefox");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
