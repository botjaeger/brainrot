import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPopupHtml } from "../src/popup/popup-template.js";
import { mountPopup } from "../src/popup/popup.js";
import type { ExtensionSettings, ExtensionSettingsStore } from "../src/shared/extension-settings.js";

function loadPopupDom() {
  return new JSDOM(createPopupHtml({ version: "0.0.0-test" }), {
    pretendToBeVisual: true,
    url: "https://brainrot.test/",
  });
}

function makeSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    enabled: true,
    debugLogging: false,
    loopVideo: false,
    pauseOnHover: true,
    scrollStats: { "youtube-shorts": 0, "facebook-reels": 0, "tiktok": 0, "instagram-reels": 0 },
    todayDate: "",
    todayStats: { "youtube-shorts": 0, "facebook-reels": 0, "tiktok": 0, "instagram-reels": 0 },
    theme: "light",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mountPopup", () => {
  it("renders stored settings, detected site, and controls", async () => {
    const dom = loadPopupDom();
    const write = vi.fn(async () => undefined);
    const readActiveSite = vi.fn(async () => ({
      kind: "facebook-reels" as const,
      supported: true,
      label: "Facebook Reels",
      note: "Brainrot supports this page.",
    }));
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({
        enabled: false,
        scrollStats: { "youtube-shorts": 10, "facebook-reels": 5, "tiktok": 20, "instagram-reels": 3 },
      }),
      write,
    };

    await mountPopup({ document: dom.window.document, store, readActiveSite });

    const doc = dom.window.document;
    const enabledToggle = doc.querySelector<HTMLInputElement>("#enabled-toggle");
    const statusChip = doc.querySelector<HTMLElement>("[data-status-chip]");
    const statusCopy = doc.querySelector<HTMLElement>("[data-status-copy]");

    expect(enabledToggle?.checked).toBe(false);
    expect(statusChip?.textContent).toBe("Facebook Reels detected");
    expect(statusCopy?.textContent).toBe("Auto scroll paused.");
    expect(doc.documentElement.dataset.theme).toBe("light");
    expect(doc.querySelector("[data-count='youtube-shorts']")?.textContent).toBe("10");
    expect(doc.querySelector("[data-count='facebook-reels']")?.textContent).toBe("5");
    expect(doc.querySelector("[data-count='tiktok']")?.textContent).toBe("20");
    expect(doc.querySelector("[data-count='instagram-reels']")?.textContent).toBe("3");
    expect(doc.querySelector("[data-site-stats='facebook-reels']")?.classList.contains("active")).toBe(true);
    expect(doc.querySelector("[data-site-stats='facebook-reels'] .active-badge")).toBeTruthy();
    expect(doc.querySelector("[data-site-stats='tiktok']")?.classList.contains("active")).toBe(false);
    expect(doc.documentElement.classList.contains("is-ready")).toBe(true);
    expect(readActiveSite).toHaveBeenCalledTimes(1);
  });

  it("toggles enabled state and writes to store", async () => {
    const dom = loadPopupDom();
    const write = vi.fn(async () => undefined);
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({ enabled: false }),
      write,
    };

    await mountPopup({ document: dom.window.document, store });

    const doc = dom.window.document;
    const enabledToggle = doc.querySelector<HTMLInputElement>("#enabled-toggle");
    if (!enabledToggle) throw new Error("Missing #enabled-toggle");

    enabledToggle.checked = true;
    enabledToggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    expect(write).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(doc.querySelector<HTMLElement>("[data-status-copy]")?.textContent).toBe("No taps. No swipes. Just watch.");
  });

  it("cycles theme on theme-toggle click and writes to store", async () => {
    const dom = loadPopupDom();
    const write = vi.fn(async () => undefined);
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({ theme: "light" }),
      write,
    };

    await mountPopup({ document: dom.window.document, store });

    dom.window.document.querySelector<HTMLElement>("#theme-toggle")?.click();

    expect(dom.window.document.documentElement.dataset.theme).toBe("dark");
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  it("clicking hero card toggles enabled state", async () => {
    const dom = loadPopupDom();
    const write = vi.fn(async () => undefined);
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({ enabled: false }),
      write,
    };

    await mountPopup({ document: dom.window.document, store });

    const doc = dom.window.document;
    const hero = doc.querySelector<HTMLElement>(".hero")!;
    const enabledToggle = doc.querySelector<HTMLInputElement>("#enabled-toggle")!;

    expect(enabledToggle.checked).toBe(false);

    // Click on the hero card (not the toggle itself)
    hero.click();

    expect(enabledToggle.checked).toBe(true);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("renders today total from todayStats when date matches", async () => {
    const dom = loadPopupDom();
    const today = new Date().toISOString().slice(0, 10);
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({
        todayDate: today,
        todayStats: { "youtube-shorts": 7, "facebook-reels": 3, "tiktok": 5, "instagram-reels": 0 },
      }),
      write: vi.fn(async () => undefined),
    };

    await mountPopup({ document: dom.window.document, store });

    expect(dom.window.document.querySelector("[data-today-count]")?.textContent).toBe("15");
    expect(dom.window.document.querySelector("[data-today-copy]")?.textContent).toBe("videos watched today");
  });

  it("shows personality copy at 50+ videos", async () => {
    const dom = loadPopupDom();
    const today = new Date().toISOString().slice(0, 10);
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({
        todayDate: today,
        todayStats: { "youtube-shorts": 30, "facebook-reels": 10, "tiktok": 15, "instagram-reels": 0 },
      }),
      write: vi.fn(async () => undefined),
    };

    await mountPopup({ document: dom.window.document, store });

    expect(dom.window.document.querySelector("[data-today-copy]")?.textContent).toBe("videos. You're in deep now");
  });

  it("shows zero today total when date is stale", async () => {
    const dom = loadPopupDom();
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings({
        todayDate: "2020-01-01",
        todayStats: { "youtube-shorts": 99, "facebook-reels": 0, "tiktok": 0, "instagram-reels": 0 },
      }),
      write: vi.fn(async () => undefined),
    };

    await mountPopup({ document: dom.window.document, store });

    expect(dom.window.document.querySelector("[data-today-count]")?.textContent).toBe("");
  });

  it("accordion toggle flips data-stats-open", async () => {
    const dom = loadPopupDom();
    const store: ExtensionSettingsStore = {
      read: async () => makeSettings(),
      write: vi.fn(async () => undefined),
    };

    await mountPopup({ document: dom.window.document, store });

    const html = dom.window.document.documentElement;
    expect(html.dataset.statsOpen).toBe("false");

    dom.window.document.querySelector<HTMLElement>("#stats-toggle")?.click();
    expect(html.dataset.statsOpen).toBe("true");

    dom.window.document.querySelector<HTMLElement>("#stats-toggle")?.click();
    expect(html.dataset.statsOpen).toBe("false");
  });

  it.each(["promise", "callback"] as const)(
    "reloads the active tab through the %s tabs API",
    async (apiStyle) => {
      const dom = loadPopupDom();
      const reload = vi.fn();
      const query =
        apiStyle === "promise"
          ? vi.fn(() => Promise.resolve([{ id: 42 }]))
          : vi.fn(
              (
                _options: unknown,
                callback?: (tabs: Array<{ id: number }>) => void,
              ) => {
                if (!callback) {
                  throw new TypeError("Callback required");
                }
                callback([{ id: 42 }]);
              },
            );

      vi.stubGlobal("chrome", { tabs: { query, reload } });

      const store: ExtensionSettingsStore = {
        read: async () => makeSettings(),
        write: vi.fn(async () => undefined),
      };

      await mountPopup({
        document: dom.window.document,
        store,
        readActiveSite: async () => null,
      });

      dom.window.document.querySelector<HTMLElement>("#reload-tab")?.click();

      await vi.waitFor(() => {
        expect(reload).toHaveBeenCalledWith(42);
      });
    },
  );
});
