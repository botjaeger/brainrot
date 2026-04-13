import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(repoRoot, "dist");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function buildBrowserPackages() {
  execFileSync(npmCommand, ["run", "build:all"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function readManifest(packageName: "chromium" | "firefox") {
  const manifestPath = join(distDir, packageName, "manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as {
    browser_specific_settings?: {
      gecko?: {
        id?: string;
      };
    };
    content_scripts?: Array<{
      js?: string[];
      matches?: string[];
    }>;
  };
}

beforeAll(() => {
  buildBrowserPackages();
});

describe("browser packaging", () => {
  it("writes self-contained Chromium and Firefox package roots", () => {
    expect(existsSync(join(distDir, "chromium", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "content", "index.js"))).toBe(
      true,
    );
    expect(existsSync(join(distDir, "firefox", "content", "index.js"))).toBe(
      true,
    );
  });

  it("keeps Chromium free of Firefox-only metadata", () => {
    const chromiumManifest = readManifest("chromium");
    const contentScript = chromiumManifest.content_scripts?.[0];

    expect(chromiumManifest.browser_specific_settings).toBeUndefined();
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual(["https://www.youtube.com/shorts/*"]);
  });

  it("adds Firefox gecko metadata without changing the shared Shorts match", () => {
    const firefoxManifest = readManifest("firefox");
    const contentScript = firefoxManifest.content_scripts?.[0];

    expect(firefoxManifest.browser_specific_settings?.gecko?.id).toBe(
      "auto-youtube-shorts-scroller@example.com",
    );
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual(["https://www.youtube.com/shorts/*"]);
  });
});
