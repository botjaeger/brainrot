import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";
import manifestFirefox from "../manifest.firefox.json";
import { DEFAULT_EXTENSION_SETTINGS } from "../src/shared/extension-settings.js";
import { STORE_URLS } from "../src/shared/store-urls.js";

// Class guards for the marketing site (site/). The privacy and terms pages are the store
// listings' policy URLs, so their facts must follow the code; the pages must also work
// under the GitHub Pages sub-path (/brainrot/) and make no third-party requests.

const readText = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const PAGES = ["index", "privacy", "terms", "404"] as const;
const html = (name: string) => readText(`site/${name}.html`);

// Every stored key must be described by the policy's "What it stores" list. A new key fails
// here until it is mapped to the sentence in privacy.html that discloses it.
const DISCLOSURE: Record<keyof typeof DEFAULT_EXTENSION_SETTINGS, RegExp> = {
  enabled: /whether Brainrot is switched on/,
  theme: /light or dark theme/,
  scrollStats: /all-time/,
  todayStats: /for today/,
  todayDate: /today's date/,
  changelogSeenVersion: /last version whose "What's new" page/,
  debugLogging: /debug logging switch/,
};

describe("site facts follow the extension", () => {
  it("privacy.html discloses every stored value", () => {
    const keys = Object.keys(DEFAULT_EXTENSION_SETTINGS).sort();
    expect(Object.keys(DISCLOSURE).sort()).toEqual(keys);
    const privacy = html("privacy").replace(/\s+/g, " ");
    for (const key of keys) {
      expect(privacy, `stored key ${key}`).toMatch(DISCLOSURE[key as keyof typeof DISCLOSURE]);
    }
  });

  it("privacy.html lists every permission and every host the extension runs on", () => {
    const privacy = html("privacy");
    for (const permission of manifest.permissions) {
      expect(privacy, `permission ${permission}`).toContain(`<dt>${permission}</dt>`);
    }
    const hosts = new Set(
      manifest.content_scripts.flatMap((script) =>
        script.matches.map((match) => new URL(match.replace("/*", "/")).host),
      ),
    );
    expect(hosts.size).toBeGreaterThan(0);
    for (const host of hosts) expect(privacy, `host ${host}`).toContain(host);
    expect(manifestFirefox.browser_specific_settings.gecko.data_collection_permissions).toEqual({
      required: ["none"],
    });
    expect(privacy).toContain("Nothing.");
  });

  it("store buttons match STORE_URLS and Safari's state", () => {
    const index = html("index");
    for (const browser of ["chrome", "firefox"] as const) {
      const entry = STORE_URLS[browser];
      expect(entry.state).toBe("live");
      if (entry.state !== "live") continue;
      expect(index.replace(/\s+/g, " "), `${browser} data-store link`).toContain(
        `data-store="${browser}" href="${entry.url}"`,
      );
    }
    expect(STORE_URLS.safari.state === "coming_soon").toBe(
      index.includes('class="soon">Coming soon'),
    );
  });
});

describe("site pages", () => {
  it("every page has a title, description, absolute canonical and named media", () => {
    for (const name of PAGES) {
      const page = html(name);
      expect(page, `${name} title`).toMatch(/<title>[^<]{5,}<\/title>/);
      if (name === "404") {
        expect(page).toContain('name="robots" content="noindex"');
      } else {
        expect(page, `${name} description`).toMatch(
          /<meta\s+name="description"\s+content="[^"]{20,}"/,
        );
        const path = name === "index" ? "" : `${name}.html`;
        expect(page, `${name} canonical`).toContain(
          `<link rel="canonical" href="https://botjaeger.github.io/brainrot/${path}" />`,
        );
      }
      for (const tag of page.match(/<img\b[^>]*>/g) ?? []) {
        expect(tag, `${name} img alt`).toMatch(/\salt="/);
      }
      for (const tag of page.match(/<video\b[^>]*>/g) ?? []) {
        expect(tag, `${name} video label`).toMatch(/\saria-label="[^"]+"/);
        expect(tag, `${name} video must be muted`).toMatch(/\smuted\s/);
      }
    }
  });

  it("makes no third-party request and no root-absolute path that breaks under /brainrot/", () => {
    for (const name of PAGES) {
      const page = html(name);
      for (const tag of page.match(/<(?:img|video|source|script|link)\b[^>]*>/g) ?? []) {
        for (const [, url] of tag.matchAll(/\s(?:src|href|poster)="([^"]+)"/g)) {
          // The canonical link is a pointer, not a request.
          if (tag.includes('rel="canonical"')) continue;
          expect(url, `${name} ${tag}`).not.toMatch(/^(?:https?:)?\/\//);
          expect(url, `${name} ${tag}`).not.toMatch(/^\/(?!\/)/);
        }
      }
      expect(page, `${name} root-absolute internal link`).not.toMatch(/<a\b[^>]*\shref="\/(?!\/)/);
    }
    expect(readText("site/style.css")).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//);
    expect(readText("site/style.css")).not.toMatch(/@import/);
  });

  it("ships only what the pages reference (no shared publicDir, no gifs, no missing files)", () => {
    expect(readText("site/vite.config.ts")).toContain("publicDir: false");
    expect(
      readdirSync(new URL("../site", import.meta.url)).filter((f) => f.endsWith(".gif")),
    ).toEqual([]);
    for (const name of PAGES) {
      for (const [, url] of html(name).matchAll(/\s(?:src|href|poster)="(\.{1,2}\/[^"#]+)"/g)) {
        if (url.endsWith(".html") || url === "./") continue;
        expect(existsSync(new URL(`../site/${url}`, import.meta.url)), `site/${url}`).toBe(true);
      }
    }
  });

  it("keeps the site's copies of shared icons identical to assets/", () => {
    for (const file of ["icon-32.png", "safari.svg", "chrome.svg", "firefox.svg"]) {
      const site = readFileSync(new URL(`../site/${file}`, import.meta.url));
      const shared = readFileSync(new URL(`../assets/${file}`, import.meta.url));
      expect(site.equals(shared), `site/${file} matches assets/${file}`).toBe(true);
    }
  });

  it("uses landmarks axe accepts: no complementary inside main", () => {
    for (const name of PAGES) {
      const main = /<main\b[\s\S]*<\/main>/.exec(html(name))?.[0] ?? "";
      expect(main, `${name} aside in main`).not.toMatch(/<aside\b/);
    }
  });

  it("shows the manifest version and imports only shared modules (main.ts)", () => {
    const main = readText("site/main.ts");
    expect(main).toContain("manifest.version");
    for (const [, spec] of main.matchAll(/(?:from|import) "(\.[^"]+)"/g)) {
      expect(spec, "main.ts import").toMatch(/^\.\.\/(?:src\/shared\/|manifest\.json)/);
    }
  });
});
