import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(repoRoot, "dist");
function readManifest(packageName: "chromium" | "firefox") {
  const manifestPath = join(distDir, packageName, "manifest.json");
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
    };
    content_scripts?: Array<{
      js?: string[];
      matches?: string[];
      world?: string;
      run_at?: string;
    }>;
  };
}

function readContentScript(packageName: "chromium" | "firefox") {
  return readFileSync(join(distDir, packageName, "content", "index.js"), "utf8");
}

function readVisibilityScript(
  packageName: "chromium" | "firefox",
  scriptName: "control" | "spoof",
) {
  return readFileSync(join(distDir, packageName, "content-main", `${scriptName}.js`), "utf8");
}

function readPopupHtml(packageName: "chromium" | "firefox") {
  return readFileSync(join(distDir, packageName, "popup", "index.html"), "utf8");
}

describe("browser packaging", () => {
  it("writes self-contained Chromium and Firefox package roots", () => {
    expect(existsSync(join(distDir, "chromium", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "manifest.json"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "background", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "content", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "popup", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "background", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "content", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "popup", "index.js"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "popup", "index.html"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "popup", "index.html"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "content-main", "spoof.js"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "content-main", "spoof.js"))).toBe(true);
    expect(existsSync(join(distDir, "chromium", "content-main", "control.js"))).toBe(true);
    expect(existsSync(join(distDir, "firefox", "content-main", "control.js"))).toBe(true);
    expect(readContentScript("chromium")).toBe(readContentScript("firefox"));
  });

  it("keeps Chromium free of Firefox-only metadata", () => {
    const chromiumManifest = readManifest("chromium");
    const contentScript = chromiumManifest.content_scripts?.[0];
    const contentBundle = readContentScript("chromium");
    const popupHtml = readPopupHtml("chromium");

    expect(chromiumManifest.name).toBe("Brainrot");
    expect(chromiumManifest.action?.default_popup).toBe("popup/index.html");
    expect(chromiumManifest.browser_specific_settings).toBeUndefined();
    expect(chromiumManifest.permissions).toEqual(["storage", "tabs", "scripting"]);
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual([
      "https://www.youtube.com/*",
      "https://www.facebook.com/*",
      "https://www.tiktok.com/*",
      "https://www.instagram.com/*",
    ]);
    const mainWorldScript = chromiumManifest.content_scripts?.find(
      (cs: { world?: string }) => cs.world === "MAIN",
    );
    expect(mainWorldScript).toBeDefined();
    expect(mainWorldScript?.js).toEqual(["content-main/spoof.js"]);
    expect(mainWorldScript?.run_at).toBe("document_start");
    const controlScript = chromiumManifest.content_scripts?.find((cs) =>
      cs.js?.includes("content-main/control.js"),
    );
    expect(controlScript?.run_at).toBe("document_start");
    expect(controlScript?.world).toBeUndefined();
    expect(popupHtml).toContain("Brainrot");

    expect(popupHtml).toContain('<h1 class="hero-title" id="hero-title">Brainrot mode</h1>');
    expect(popupHtml).toContain("./index.js");
    expect(popupHtml).toContain("min-width: 320px;");
    expect(contentBundle.trimStart().startsWith("import")).toBe(false);
    expect(readVisibilityScript("chromium", "control").trimStart().startsWith("import")).toBe(
      false,
    );
    expect(readVisibilityScript("chromium", "spoof").trimStart().startsWith("import")).toBe(false);
  });

  it("adds Firefox gecko metadata without changing the shared Shorts match", () => {
    const firefoxManifest = readManifest("firefox");
    const contentScript = firefoxManifest.content_scripts?.[0];
    const contentBundle = readContentScript("firefox");
    const popupHtml = readPopupHtml("firefox");

    expect(firefoxManifest.name).toBe("Brainrot");
    expect(firefoxManifest.action?.default_popup).toBe("popup/index.html");
    expect(firefoxManifest.browser_specific_settings?.gecko?.id).toBe("brainrot@brainrot.app");
    expect(firefoxManifest.permissions).toEqual(["storage", "tabs", "scripting"]);
    expect(contentScript?.js).toEqual(["content/index.js"]);
    expect(contentScript?.matches).toEqual([
      "https://www.youtube.com/*",
      "https://www.facebook.com/*",
      "https://www.tiktok.com/*",
      "https://www.instagram.com/*",
    ]);
    const mainWorldScript = firefoxManifest.content_scripts?.find(
      (cs: { world?: string }) => cs.world === "MAIN",
    );
    expect(mainWorldScript).toBeDefined();
    expect(mainWorldScript?.js).toEqual(["content-main/spoof.js"]);
    expect(mainWorldScript?.run_at).toBe("document_start");
    const controlScript = firefoxManifest.content_scripts?.find((cs) =>
      cs.js?.includes("content-main/control.js"),
    );
    expect(controlScript?.run_at).toBe("document_start");
    expect(controlScript?.world).toBeUndefined();
    expect(popupHtml).toContain("Brainrot");

    expect(popupHtml).toContain('<h1 class="hero-title" id="hero-title">Brainrot mode</h1>');
    expect(popupHtml).toContain("./index.js");
    expect(popupHtml).toContain("min-width: 320px;");
    expect(contentBundle.trimStart().startsWith("import")).toBe(false);
    expect(readVisibilityScript("firefox", "control").trimStart().startsWith("import")).toBe(false);
    expect(readVisibilityScript("firefox", "spoof").trimStart().startsWith("import")).toBe(false);
  });
});
