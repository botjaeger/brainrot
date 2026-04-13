import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(repoRoot, "dist");
const safariProjectPath = resolve(
  repoRoot,
  "safari/AutoYouTubeShortsScroller.xcodeproj/project.pbxproj",
);
const safariExtensionInfoPlist = resolve(
  repoRoot,
  "safari/AutoYouTubeShortsScrollerExtension/Info.plist",
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function buildSafariPackage() {
  execFileSync(npmCommand, ["run", "build:safari"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function readSafariManifest() {
  const manifestPath = join(distDir, "safari", "manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as {
    browser_specific_settings?: {
      gecko?: {
        id?: string;
      };
      safari?: {
        strict_min_version?: string;
      };
    };
    content_scripts?: Array<{
      js?: string[];
      matches?: string[];
    }>;
  };
}

beforeAll(() => {
  buildSafariPackage();
});

describe("safari packaging", () => {
  it("writes the staged Safari bundle", () => {
    expect(existsSync(join(distDir, "safari", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "safari", "content", "index.js"))).toBe(
      true,
    );
  });

  it("keeps Safari compatibility metadata isolated", () => {
    const safariManifest = readSafariManifest();
    const contentScript = safariManifest.content_scripts?.[0];

    expect(
      safariManifest.browser_specific_settings?.safari?.strict_min_version,
    ).toBe("14.0");
    expect(safariManifest.browser_specific_settings?.gecko).toBeUndefined();
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual(["https://www.youtube.com/shorts/*"]);
  });

  it("points the Xcode project at the staged Safari bundle", () => {
    const pbxproj = readFileSync(safariProjectPath, "utf8");
    const extensionInfoPlist = readFileSync(safariExtensionInfoPlist, "utf8");

    expect(pbxproj).toContain("../dist/safari/manifest.json");
    expect(pbxproj).toContain("../dist/safari/content/index.js");
    expect(pbxproj).toContain("SafariWebExtensionHandler.swift");
    expect(extensionInfoPlist).toContain("com.apple.Safari.web-extension");
    expect(extensionInfoPlist).toContain("SafariWebExtensionHandler");
  });
});
