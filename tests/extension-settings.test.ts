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
    const set = vi.fn(
      (
        _items: Record<string, unknown>,
        callback?: () => void,
      ) => {
        callback?.();
      },
    );

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
      loopVideo: DEFAULT_EXTENSION_SETTINGS.loopVideo,
      pauseOnHover: DEFAULT_EXTENSION_SETTINGS.pauseOnHover,
      backgroundPlayback: DEFAULT_EXTENSION_SETTINGS.backgroundPlayback,
      scrollStats: DEFAULT_EXTENSION_SETTINGS.scrollStats,
      todayDate: DEFAULT_EXTENSION_SETTINGS.todayDate,
      todayStats: DEFAULT_EXTENSION_SETTINGS.todayStats,
      theme: DEFAULT_EXTENSION_SETTINGS.theme,
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
      loopVideo: DEFAULT_EXTENSION_SETTINGS.loopVideo,
      pauseOnHover: DEFAULT_EXTENSION_SETTINGS.pauseOnHover,
      backgroundPlayback: DEFAULT_EXTENSION_SETTINGS.backgroundPlayback,
      scrollStats: DEFAULT_EXTENSION_SETTINGS.scrollStats,
      todayDate: DEFAULT_EXTENSION_SETTINGS.todayDate,
      todayStats: DEFAULT_EXTENSION_SETTINGS.todayStats,
      theme: DEFAULT_EXTENSION_SETTINGS.theme,
    });

    await saveExtensionSettings({
      enabled: false,
      debugLogging: true,
      loopVideo: false,
      pauseOnHover: true,
      backgroundPlayback: true,
      scrollStats: {},
      todayDate: "",
      todayStats: {},
      theme: "light",
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({
      enabled: false,
      debugLogging: true,
      loopVideo: false,
      pauseOnHover: true,
      backgroundPlayback: true,
      scrollStats: {},
      todayDate: "",
      todayStats: {},
      theme: "light",
    });
  });
});
