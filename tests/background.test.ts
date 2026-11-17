import { afterEach, describe, expect, it, vi } from "vitest";

type InstalledListener = (details: { reason: string }) => void;

const OPEN_TABS = [
  { id: 1, url: "https://www.youtube.com/shorts/abc123" },
  { id: 2, url: "https://www.youtube.com/watch?v=abc123" },
  { id: 3, url: "https://www.facebook.com/reel/987" },
  { id: 4, url: "https://www.facebook.com/messages/t/1" },
  { id: 5, url: "https://www.instagram.com/reels/xyz/" },
  { id: 6, url: "https://www.instagram.com/direct/inbox/" },
  { id: 7, url: "https://www.tiktok.com/" },
  { id: 8, url: "https://www.tiktok.com/en/foryou" },
  { id: 9, url: "https://www.tiktok.com/@someone/video/42" },
  { id: 10, url: "https://www.tiktok.com/upload" },
  { id: 11 },
];

async function loadBackground(registerContentScripts = vi.fn().mockResolvedValue(undefined)) {
  let onInstalled: InstalledListener | undefined;
  const chromeStub = {
    tabs: {
      query: vi.fn().mockResolvedValue(OPEN_TABS),
      reload: vi.fn(),
    },
    scripting: {
      registerContentScripts,
      unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
    },
    storage: { local: { set: vi.fn().mockResolvedValue(undefined) } },
    runtime: {
      getManifest: () => ({ version: "9.9.9" }),
      onInstalled: {
        addListener: (listener: InstalledListener) => {
          onInstalled = listener;
        },
      },
    },
  };
  vi.stubGlobal("chrome", chromeStub);
  vi.resetModules();
  await import("../src/background/index.js");

  const install = async (reason: string) => {
    onInstalled?.({ reason });
    // Every stub settles immediately; one macrotask flushes the handlers.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  };

  return { chromeStub, install };
}

const reloadedIds = (reload: ReturnType<typeof vi.fn>) =>
  reload.mock.calls.map(([id]) => id as number).sort((a, b) => a - b);

describe("background/index.ts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads only feed tabs on install, never other pages of the same sites", async () => {
    const { chromeStub, install } = await loadBackground();

    await install("install");

    expect(reloadedIds(chromeStub.tabs.reload)).toEqual([1, 3, 5, 7, 8, 9]);
  });

  it("reloads feed tabs on an extension update", async () => {
    const { chromeStub, install } = await loadBackground();

    await install("update");

    expect(reloadedIds(chromeStub.tabs.reload)).toEqual([1, 3, 5, 7, 8, 9]);
  });

  it("keeps reloading the other feed tabs when one reload rejects (tab closed meanwhile)", async () => {
    const { chromeStub, install } = await loadBackground();
    // A plain function, not vi.fn(): a mock attaches its own handler to every promise it returns,
    // which would hide an unhandled rejection.
    const reloaded: number[] = [];
    Object.assign(chromeStub.tabs, {
      reload: (id: number) => {
        reloaded.push(id);
        return id === 3 ? Promise.reject(new Error("No tab with id: 3")) : Promise.resolve();
      },
    });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    try {
      await install("update");
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    } finally {
      process.off("unhandledRejection", unhandled);
    }

    expect(reloaded.sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 8, 9]);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("reloads nothing on a browser update", async () => {
    const { chromeStub, install } = await loadBackground();

    await install("chrome_update");

    expect(chromeStub.tabs.reload).not.toHaveBeenCalled();
  });

  it("marks the installed changelog as seen on install only", async () => {
    const { chromeStub, install } = await loadBackground();

    await install("update");
    expect(chromeStub.storage.local.set).not.toHaveBeenCalled();

    await install("install");
    expect(chromeStub.storage.local.set).toHaveBeenCalledWith({
      changelogSeenVersion: "9.9.9",
    });
  });

  it("warns on unexpected spoof registration errors and stays quiet when unsupported", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unsupported = await loadBackground(
      vi.fn().mockRejectedValue(new Error("world MAIN is not supported")),
    );
    await unsupported.install("install");
    expect(warn).not.toHaveBeenCalled();

    const broken = await loadBackground(
      vi.fn().mockRejectedValue(new Error("Duplicate script ID")),
    );
    await broken.install("install");
    expect(warn).toHaveBeenCalledWith(
      "[Brainrot] registerContentScripts failed:",
      "Duplicate script ID",
    );
  });
});
