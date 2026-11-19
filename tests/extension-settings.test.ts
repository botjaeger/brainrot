import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXTENSION_SETTINGS,
  readExtensionSettings,
  saveExtensionSettings,
} from "../src/shared/extension-settings.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extension settings storage", () => {
  it("reads callback-based storage", async () => {
    const get = vi.fn(
      (
        _keys: Array<keyof typeof DEFAULT_EXTENSION_SETTINGS>,
        callback?: (items: Record<string, unknown>) => void,
      ) => {
        callback?.({
          enabled: false,
        });
      },
    );
    const set = vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get,
          set,
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });

    const settings = await readExtensionSettings();

    expect(settings).toEqual({
      enabled: false,
      debugLogging: DEFAULT_EXTENSION_SETTINGS.debugLogging,
      scrollStats: DEFAULT_EXTENSION_SETTINGS.scrollStats,
      todayDate: DEFAULT_EXTENSION_SETTINGS.todayDate,
      todayStats: DEFAULT_EXTENSION_SETTINGS.todayStats,
      theme: DEFAULT_EXTENSION_SETTINGS.theme,
      changelogSeenVersion: DEFAULT_EXTENSION_SETTINGS.changelogSeenVersion,
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(set).not.toHaveBeenCalled();
  });

  it("reads and writes promise-based storage", async () => {
    const get = vi.fn(async () => ({
      enabled: true,
      debugLogging: true,
    }));
    const set = vi.fn(async () => undefined);

    vi.stubGlobal("browser", {
      storage: {
        local: {
          get,
          set,
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });

    const settings = await readExtensionSettings();

    expect(settings).toEqual({
      enabled: true,
      debugLogging: true,
      scrollStats: DEFAULT_EXTENSION_SETTINGS.scrollStats,
      todayDate: DEFAULT_EXTENSION_SETTINGS.todayDate,
      todayStats: DEFAULT_EXTENSION_SETTINGS.todayStats,
      theme: DEFAULT_EXTENSION_SETTINGS.theme,
      changelogSeenVersion: DEFAULT_EXTENSION_SETTINGS.changelogSeenVersion,
    });

    await saveExtensionSettings({
      enabled: false,
      debugLogging: true,
      scrollStats: {},
      todayDate: "",
      todayStats: {},
      theme: "light",
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({
      enabled: false,
      debugLogging: true,
      scrollStats: {},
      todayDate: "",
      todayStats: {},
      theme: "light",
    });
  });
});

describe("stored counts", () => {
  function stubStorage(items: Record<string, unknown> | undefined) {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: (_keys: unknown, callback?: (items?: Record<string, unknown>) => void) => {
            callback?.(items);
          },
          set: vi.fn(),
        },
      },
    });
  }

  it("keeps only non-negative safe integers", async () => {
    stubStorage({
      scrollStats: { a: 5, b: "5", c: -1, d: 1.5, e: 1e21, f: null, g: { x: 1 }, h: 0 },
      todayStats: { tiktok: "abc", "youtube-shorts": 3 },
    });

    const settings = await readExtensionSettings();

    expect(settings.scrollStats).toEqual({ a: 5, h: 0 });
    expect(settings.todayStats).toEqual({ "youtube-shorts": 3 });
  });

  it("falls back to the defaults for arrays and other non-objects", async () => {
    stubStorage({ scrollStats: [1, 2], todayStats: "x" });

    const settings = await readExtensionSettings();

    expect(settings.scrollStats).toEqual(DEFAULT_EXTENSION_SETTINGS.scrollStats);
    expect(settings.todayStats).toEqual(DEFAULT_EXTENSION_SETTINGS.todayStats);
  });

  it("reads defaults when a callback-style read fails with no items", async () => {
    stubStorage(undefined);

    expect(await readExtensionSettings()).toEqual(DEFAULT_EXTENSION_SETTINGS);
  });
});
