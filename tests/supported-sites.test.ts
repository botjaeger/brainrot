import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteKey } from "../src/content/site-key.js";
import { describeSupportedSiteFromUrl } from "../src/popup/site-status.js";
import { SUPPORTED_SITE_LABELS } from "../src/shared/brand.js";
import { DEFAULT_EXTENSION_SETTINGS } from "../src/shared/extension-settings.js";
import { facebookReelsSiteAdapter } from "../src/sites/facebook-reels.js";
import { instagramReelsSiteAdapter } from "../src/sites/instagram-reels.js";
import { tiktokSiteAdapter } from "../src/sites/tiktok.js";
import { youtubeShortsSiteAdapter } from "../src/sites/youtube-shorts.js";

// Class guard: "supported-site knowledge is duplicated" (AGENTS.md). Every copy of
// the site list is driven through one URL matrix, so adding a site to some copies
// and not others fails here.

const ADAPTERS = [
  youtubeShortsSiteAdapter,
  facebookReelsSiteAdapter,
  tiktokSiteAdapter,
  instagramReelsSiteAdapter,
];

const SITES = [
  {
    key: "youtube-shorts",
    label: "YouTube Shorts",
    host: "www.youtube.com",
    feeds: ["/shorts", "/shorts/abc123", "/shorts/abc123?feature=share"],
    others: ["/", "/watch?v=abc", "/shortsfoo", "/feed/subscriptions"],
  },
  {
    key: "facebook-reels",
    label: "Facebook Reels",
    host: "www.facebook.com",
    feeds: ["/reel/987", "/reels", "/reels/987"],
    others: ["/", "/messages/t/1", "/reelsfoo", "/watch"],
  },
  {
    key: "tiktok",
    label: "TikTok",
    host: "www.tiktok.com",
    feeds: ["/", "/en", "/foryou", "/en/foryou", "/following", "/@u/video/1", "/en-US/@u/video/1"],
    others: ["/upload", "/@u", "/explore", "/foryoufoo", "/search?q=a"],
  },
  {
    key: "instagram-reels",
    label: "Instagram Reels",
    host: "www.instagram.com",
    feeds: ["/reel/xyz/", "/reels/", "/reels/xyz/"],
    others: ["/", "/direct/inbox/", "/p/abc/", "/reelsfoo"],
  },
] as const;

const FOREIGN = [
  "https://www.example.com/shorts/1",
  "https://www.example.com/reels/1",
  "https://evil-youtube.com/shorts/1",
  "https://notfacebook.com/reel/1",
  "https://www.youtube.com.evil.test/shorts/1",
];

interface Case {
  url: string;
  expected: string | null;
}

const CASES: Case[] = [
  ...SITES.flatMap((site) => [
    ...site.feeds.map((path) => ({ url: `https://${site.host}${path}`, expected: site.key })),
    ...site.others.map((path) => ({ url: `https://${site.host}${path}`, expected: null })),
  ]),
  ...FOREIGN.map((url) => ({ url, expected: null })),
];

const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;
const readText = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("supported sites: every copy of the list agrees", () => {
  it("content getSiteKey, adapters and popup status classify every URL alike", () => {
    for (const { url, expected } of CASES) {
      const parsed = new URL(url);
      expect(getSiteKey(parsed), `getSiteKey ${url}`).toBe(expected);

      const adapterKeys = ADAPTERS.filter((adapter) =>
        adapter.matches(parsed as unknown as Location),
      ).map((adapter) => adapter.siteKey);
      expect(adapterKeys, `adapters ${url}`).toEqual(expected ? [expected] : []);

      const status = describeSupportedSiteFromUrl(url);
      expect(status.supported, `site-status ${url}`).toBe(expected !== null);
      expect(status.kind, `site-status kind ${url}`).toBe(expected ?? "unsupported");
    }
  });

  it("background reloads exactly the feed tabs", async () => {
    let onInstalled: ((details: { reason: string }) => void) | undefined;
    const tabs = CASES.map(({ url }, id) => ({ id, url }));
    const reload = vi.fn();
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue(tabs), reload },
      scripting: {
        registerContentScripts: vi.fn().mockResolvedValue(undefined),
        unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
      },
      storage: { local: { set: vi.fn().mockResolvedValue(undefined) } },
      runtime: {
        getManifest: () => ({ version: "9.9.9" }),
        onInstalled: {
          addListener: (listener: typeof onInstalled) => {
            onInstalled = listener;
          },
        },
      },
    });
    vi.resetModules();
    await import("../src/background/index.js");
    onInstalled?.({ reason: "update" });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    const reloaded = reload.mock.calls.map(([id]) => id as number).sort((a, b) => a - b);
    const expected = CASES.flatMap(({ expected }, id) => (expected ? [id] : []));
    expect(reloaded).toEqual(expected);
  });

  it("MAIN-world spoof applies on exactly the feed URLs", async () => {
    for (const { url, expected } of CASES) {
      const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
      // jsdom reports hidden: true natively, so a false reading means the spoof is active.
      expect(dom.window.document.hidden).toBe(true);
      vi.stubGlobal("window", dom.window);
      vi.stubGlobal("document", dom.window.document);
      vi.stubGlobal("Event", dom.window.Event);
      vi.resetModules();
      await import("../src/content-main/spoof.js");
      dom.window.document.dispatchEvent(new dom.window.Event("brainrot:visibility-spoof-enable"));
      expect(dom.window.document.hidden, `spoof ${url}`).toBe(expected === null);
    }
  });

  it("manifest and background host patterns are exactly the supported hosts", async () => {
    const patterns = SITES.map((site) => `https://${site.host}/*`);
    const manifest = readJson("manifest.json") as {
      content_scripts: { matches: string[] }[];
      host_permissions?: string[];
    };
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(patterns);
    }
    expect(manifest.host_permissions ?? []).toEqual([]);

    // The overlays must not widen or replace host access.
    for (const overlay of ["manifest.firefox.json", "manifest.safari.json"]) {
      const keys = Object.keys(readJson(overlay));
      expect(keys, overlay).not.toContain("content_scripts");
      expect(keys, overlay).not.toContain("host_permissions");
      expect(keys, overlay).not.toContain("permissions");
    }

    const registerContentScripts = vi.fn().mockResolvedValue(undefined);
    let onInstalled: ((details: { reason: string }) => void) | undefined;
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue([]), reload: vi.fn() },
      scripting: {
        registerContentScripts,
        unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
      },
      storage: { local: { set: vi.fn().mockResolvedValue(undefined) } },
      runtime: {
        getManifest: () => ({ version: "9.9.9" }),
        onInstalled: {
          addListener: (listener: typeof onInstalled) => {
            onInstalled = listener;
          },
        },
      },
    });
    vi.resetModules();
    await import("../src/background/index.js");
    onInstalled?.({ reason: "update" });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    const [[registered]] = registerContentScripts.mock.calls as [[{ matches: string[] }[]]];
    expect(registered[0].matches).toEqual(patterns);
  });

  it("labels, stored per-site stats and user-facing lists name every site", () => {
    expect([...SUPPORTED_SITE_LABELS]).toEqual(SITES.map((site) => site.label));
    expect(ADAPTERS.map((adapter) => adapter.name)).toEqual(SITES.map((site) => site.label));
    expect(ADAPTERS.map((adapter) => adapter.siteKey)).toEqual(SITES.map((site) => site.key));

    const keys = SITES.map((site) => site.key).sort();
    expect(Object.keys(DEFAULT_EXTENSION_SETTINGS.scrollStats).sort()).toEqual(keys);
    expect(Object.keys(DEFAULT_EXTENSION_SETTINGS.todayStats).sort()).toEqual(keys);

    for (const site of SITES) {
      expect(describeSupportedSiteFromUrl(`https://${site.host}${site.feeds[0]}`).label).toBe(
        site.label,
      );
      expect(readText("README.md"), `README ${site.label}`).toContain(site.label);
      expect(readText("site/index.html"), `site/index.html ${site.label}`).toContain(site.label);
      expect(readText("site/privacy.html"), `privacy ${site.host}`).toContain(site.host);
    }
  });
});
