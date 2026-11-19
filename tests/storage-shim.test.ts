import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Class guard: every storage reader in the content-side bundles (runtime-settings,
// scroll-counter, control) uses the same shim: `browser` before `chrome`, promise or
// callback `storage.local.get`, and an implementation that throws when `get` is called
// without a callback must still be read. A new reader must be added to READERS.
// src/shared/extension-settings.ts is the popup's copy of the shim and is listed too.

type Snapshot = Record<string, unknown>;
type GetStub = (keys: unknown, callback?: (items: Snapshot) => void) => unknown;

interface StorageFlavor {
  name: string;
  get: (values: Snapshot) => GetStub;
}

const FLAVORS: StorageFlavor[] = [
  { name: "promise", get: (values) => () => Promise.resolve(values) },
  {
    name: "callback-only (throws without a callback)",
    get: (values) => (_keys, callback) => {
      if (!callback) throw new TypeError("Callback required");
      callback(values);
      return undefined;
    },
  },
  {
    name: "callback that also returns undefined",
    get: (values) => (_keys, callback) => {
      callback?.(values);
      return undefined;
    },
  },
];

interface Reader {
  name: string;
  run: (get: GetStub, set: ReturnType<typeof vi.fn>) => Promise<void>;
  // Values the reader is given, and the check that proves it read them.
  values: Snapshot;
  check: (set: ReturnType<typeof vi.fn>, dom: JSDOM, events: string[]) => void;
}

const set = () =>
  vi.fn((_data: unknown, callback?: () => void) => {
    callback?.();
    return Promise.resolve();
  });

const READERS: Reader[] = [
  {
    name: "runtime-settings",
    values: { enabled: false, debugLogging: true },
    run: async (get, setFn) => {
      vi.stubGlobal("chrome", { storage: { local: { get, set: setFn } } });
      const { readExtensionSettings } = await import("../src/content/runtime-settings.js");
      expect(await readExtensionSettings()).toEqual({ enabled: false, debugLogging: true });
    },
    check: () => undefined,
  },
  {
    name: "scroll-counter",
    values: { scrollStats: { tiktok: 4 }, todayDate: "1999-01-01", todayStats: { tiktok: 2 } },
    run: async (get, setFn) => {
      vi.stubGlobal("chrome", { storage: { local: { get, set: setFn } } });
      const { incrementScrollStat } = await import("../src/content/scroll-counter.js");
      await incrementScrollStat("tiktok");
    },
    check: (setFn) => {
      const written = setFn.mock.calls[0]?.[0] as { scrollStats: Record<string, number> };
      expect(written.scrollStats).toEqual({ tiktok: 5 });
    },
  },
  {
    name: "popup extension-settings",
    values: { enabled: false, theme: "dark", scrollStats: { tiktok: 3 } },
    run: async (get, setFn) => {
      vi.stubGlobal("chrome", { storage: { local: { get, set: setFn } } });
      const { readExtensionSettings } = await import("../src/shared/extension-settings.js");
      const settings = await readExtensionSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.theme).toBe("dark");
      expect(settings.scrollStats.tiktok).toBe(3);
    },
    check: () => undefined,
  },
  {
    name: "content-main/control",
    values: { enabled: false },
    run: async (get, setFn) => {
      void setFn;
      vi.stubGlobal("chrome", { storage: { local: { get } } });
      await import("../src/content-main/control.js");
      await vi.waitFor(() => {
        expect(lastEvents.length).toBeGreaterThan(0);
      });
    },
    check: (_set, _dom, events) => {
      expect(events).toEqual(["brainrot:visibility-spoof-disable"]);
    },
  },
];

let lastEvents: string[] = [];

afterEach(() => {
  const scope = globalThis as typeof globalThis & {
    __brainrotVisibilityControlAbort?: AbortController;
  };
  scope.__brainrotVisibilityControlAbort?.abort();
  delete scope.__brainrotVisibilityControlAbort;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("storage shim is the same in every reader", () => {
  for (const reader of READERS) {
    for (const flavor of FLAVORS) {
      it(`${reader.name} reads ${flavor.name} storage`, async () => {
        const dom = new JSDOM("<!doctype html><html><body></body></html>", {
          url: "https://www.youtube.com/shorts/x",
        });
        lastEvents = [];
        for (const type of [
          "brainrot:visibility-spoof-enable",
          "brainrot:visibility-spoof-disable",
        ]) {
          dom.window.document.addEventListener(type, () => lastEvents.push(type));
        }
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("window", dom.window);
        vi.resetModules();

        const setFn = set();
        await reader.run(flavor.get(reader.values), setFn);
        reader.check(setFn, dom, lastEvents);
      });
    }

    it(`${reader.name} prefers browser.storage over chrome.storage`, async () => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://www.youtube.com/shorts/x",
      });
      lastEvents = [];
      dom.window.document.addEventListener("brainrot:visibility-spoof-disable", () =>
        lastEvents.push("brainrot:visibility-spoof-disable"),
      );
      vi.stubGlobal("document", dom.window.document);
      vi.stubGlobal("window", dom.window);
      vi.resetModules();
      const chromeGet = vi.fn(() => Promise.resolve({}));
      const setFn = set();
      const get = FLAVORS[0].get(reader.values);
      vi.stubGlobal("browser", { storage: { local: { get, set: setFn } } });
      // `chrome` must not be consulted when `browser` exists.
      const originalRun = reader.run;
      await originalRun(chromeGet, setFn);
      expect(chromeGet).not.toHaveBeenCalled();
    });
  }
});

describe("control bridge with unreadable storage", () => {
  it("stays dormant without an unhandled rejection", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "https://www.youtube.com/shorts/x",
    });
    const events: string[] = [];
    for (const type of ["brainrot:visibility-spoof-enable", "brainrot:visibility-spoof-disable"]) {
      dom.window.document.addEventListener(type, () => events.push(type));
    }
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => {
            throw new Error("Extension context invalidated.");
          },
        },
      },
    });
    vi.resetModules();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      await import("../src/content-main/control.js");
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    } finally {
      process.off("unhandledRejection", unhandled);
    }
    expect(unhandled).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe("scroll-counter ignores invalid stored counts", () => {
  it("treats {tiktok: '5'}, negatives, floats and arrays as empty", async () => {
    const set = vi.fn(() => Promise.resolve());
    const today = new Date().toLocaleDateString("en-CA");
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () =>
            Promise.resolve({
              scrollStats: { tiktok: "5", youtube: -1, facebook: 1.5, instagram: 3 },
              todayDate: today,
              todayStats: [7],
            }),
          set,
        },
      },
    });
    vi.resetModules();
    const { incrementScrollStat } = await import("../src/content/scroll-counter.js");
    await incrementScrollStat("tiktok");
    expect(set).toHaveBeenCalledWith({
      scrollStats: { instagram: 3, tiktok: 1 },
      todayDate: today,
      todayStats: { tiktok: 1 },
    });
  });
});

describe("scroll-counter increments in one tab never overlap", () => {
  it("counts every one of 20 increments fired at once", async () => {
    let stored: Record<string, unknown> = {};
    // A storage area whose reads and writes resolve on a later tick, like the real one.
    const tick = () =>
      new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async () => {
            await tick();
            return structuredClone(stored);
          },
          set: async (data: Record<string, unknown>) => {
            await tick();
            stored = { ...stored, ...structuredClone(data) };
          },
        },
      },
    });
    vi.resetModules();
    const { incrementScrollStat } = await import("../src/content/scroll-counter.js");
    await Promise.all(Array.from({ length: 20 }, () => incrementScrollStat("tiktok")));
    expect(stored.scrollStats).toEqual({ tiktok: 20 });
    expect(stored.todayStats).toEqual({ tiktok: 20 });
  });
});
