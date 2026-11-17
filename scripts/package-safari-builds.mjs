import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(rootDir, "dist");
const baseManifestPath = join(distDir, "manifest.json");
const safariOverlayPath = join(rootDir, "manifest.safari.json");

const target = process.argv[2] ?? "all";
const packageTargets = {
  safari: join(distDir, "safari"),
};

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
      merged[key] = key in baseValue ? mergeDeep(baseValue[key], value) : value;
    }

    return merged;
  }

  return overlayValue;
}

async function ensureSourceArtifacts() {
  const [manifest, overlay] = await Promise.all([
    readFile(baseManifestPath, "utf8"),
    readFile(safariOverlayPath, "utf8"),
  ]);

  return {
    manifest: JSON.parse(manifest),
    overlay: JSON.parse(overlay),
  };
}

async function writePackage(manifest) {
  const outputDir = packageTargets.safari;

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const entries = await readdir(distDir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === "manifest.json" ||
      entry.name === "safari" ||
      entry.name === "chromium" ||
      entry.name === "firefox"
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

  if (target !== "safari" && target !== "all") {
    throw new Error(`Unknown package target "${target}". Use safari or all.`);
  }

  await writePackage(mergeDeep(baseManifest, overlay));
  console.log("Wrote dist/safari");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
