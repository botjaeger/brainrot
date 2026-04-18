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
    name?: string;
    permissions?: string[];
    action?: {
      default_popup?: string;
    };
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
      world?: string;
      run_at?: string;
    }>;
  };
}

function readSafariContentScript() {
  return readFileSync(join(distDir, "safari", "content", "index.js"), "utf8");
}

function readSafariPopupHtml() {
  return readFileSync(join(distDir, "safari", "popup", "index.html"), "utf8");
}

beforeAll(() => {
  buildSafariPackage();
});

describe("safari packaging", () => {
  it("writes the staged Safari bundle", () => {
    const contentBundle = readSafariContentScript();
    const popupHtml = readSafariPopupHtml();

    expect(existsSync(join(distDir, "safari", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "safari", "content", "index.js"))).toBe(
      true,
    );
    expect(existsSync(join(distDir, "safari", "popup", "popup.js"))).toBe(true);
    expect(existsSync(join(distDir, "safari", "popup", "index.html"))).toBe(
      true,
    );
    expect(existsSync(join(distDir, "safari", "content-main", "spoof.js"))).toBe(true);
    expect(popupHtml).toContain("Brainrot");

    expect(popupHtml).toContain('<h1 class="hero-title" id="hero-title">Brainrot mode</h1>');
    expect(popupHtml).toContain("./popup.js");
    expect(popupHtml).toContain("min-width: 320px;");
    expect(contentBundle.trimStart().startsWith("import")).toBe(false);
  });

  it("keeps Safari compatibility metadata isolated", () => {
    const safariManifest = readSafariManifest();
    const contentScript = safariManifest.content_scripts?.[0];

    expect(safariManifest.name).toBe("Brainrot");
    expect(safariManifest.action?.default_popup).toBe("popup/index.html");
    expect(safariManifest.permissions).toEqual(["storage", "tabs", "scripting"]);
    expect(
      safariManifest.browser_specific_settings?.safari?.strict_min_version,
    ).toBe("14.0");
    expect(safariManifest.browser_specific_settings?.gecko).toBeUndefined();
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual([
      "https://www.youtube.com/*",
      "https://www.facebook.com/*",
      "https://www.tiktok.com/*",
      "https://www.instagram.com/*",
    ]);
    const mainWorldScript = safariManifest.content_scripts?.find(
      (cs: { world?: string }) => cs.world === "MAIN"
    );
    expect(mainWorldScript).toBeDefined();
    expect(mainWorldScript?.js).toEqual(["content-main/spoof.js"]);
    expect(readSafariPopupHtml()).toContain("./popup.js");
    expect(readSafariPopupHtml()).toContain("min-width: 320px;");
  });

  it("points the Xcode project at the staged Safari bundle", () => {
    const pbxproj = readFileSync(safariProjectPath, "utf8");
    const extensionInfoPlist = readFileSync(safariExtensionInfoPlist, "utf8");

    expect(pbxproj).toContain("../dist/safari");
    expect(pbxproj).toContain("lastKnownFileType = folder");
    expect(pbxproj).toContain("Brainrot.app");
    expect(pbxproj).toContain("BrainrotExtension.appex");
    expect(pbxproj).toContain("com.botjaeger.brainrot");
    expect(pbxproj).toContain("com.botjaeger.brainrot.extension");
    expect(pbxproj).toContain(
      "100000000000000000000018 /* BrainrotExtension.appex in Embed App Extensions */",
    );
    expect(pbxproj).toContain("10000000000000000000001A /* PBXTargetDependency */");
    expect(pbxproj).toContain("SafariWebExtensionHandler.swift");
    expect(extensionInfoPlist).toContain("com.apple.Safari.web-extension");
    expect(extensionInfoPlist).toContain("SafariWebExtensionHandler");
  });
});
