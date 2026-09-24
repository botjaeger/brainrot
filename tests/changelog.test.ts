import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createChangelogHtml } from "../src/changelog/changelog-template.js";
import { CHANGELOG, compareVersions } from "../src/shared/changelog.js";

const manifestVersion = (
  JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

function render(version: string, entries = CHANGELOG) {
  return new JSDOM(createChangelogHtml({ version, entries })).window.document;
}

describe("changelog data", () => {
  it("lists versions newest first without duplicates", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
    }
  });

  it("has dated notes for every released version, including the manifest's", () => {
    const released = CHANGELOG.filter(
      (entry) => compareVersions(entry.version, manifestVersion) <= 0,
    );

    expect(released[0]?.version).toBe(manifestVersion);
    for (const entry of released) {
      expect(entry.date, entry.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.changes.length, entry.version).toBeGreaterThan(0);
    }
  });
});

describe("createChangelogHtml", () => {
  it("lists only versions up to the installed one and marks it installed", () => {
    const doc = render("0.1.3");
    const versions = [...doc.querySelectorAll("[data-release]")].map(
      (el) => el.getAttribute("data-release"),
    );

    expect(versions).toEqual(["0.1.3", "0.1.2", "0.1.1"]);
    expect(doc.querySelector(".is-installed")?.getAttribute("data-release")).toBe("0.1.3");
    expect(doc.querySelector(".is-installed .installed-badge")?.textContent).toBe("Installed");
    expect(doc.querySelector(".is-installed time")?.getAttribute("datetime")).toBe("2026-07-28");
    expect(doc.querySelector(".is-installed time")?.textContent).toBe("Jul 28, 2026");
  });

  it("labels each change by kind and escapes note text", () => {
    const doc = render("1.0.0", [
      {
        version: "1.0.0",
        date: "2026-01-02",
        changes: [
          { kind: "new", text: "<b>bold</b> & more" },
          { kind: "fixed", text: "A fix" },
        ],
      },
    ]);

    const changes = [...doc.querySelectorAll(".change")];
    expect(changes.map((el) => el.querySelector(".kind")?.textContent)).toEqual(["New", "Fixed"]);
    expect(changes[0].querySelector(".change-text")?.textContent).toBe("<b>bold</b> & more");
    expect(changes[0].querySelector("b")).toBeNull();
  });
});
