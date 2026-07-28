import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

const ENABLE_EVENT = "brainrot:visibility-spoof-enable";
const DISABLE_EVENT = "brainrot:visibility-spoof-disable";

function createDom(url = "https://www.youtube.com/shorts/test") {
  return new JSDOM("<!doctype html><html><body></body></html>", { url });
}

async function installSpoof(dom: JSDOM): Promise<void> {
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Event", dom.window.Event);
  vi.resetModules();
  await import("../src/content-main/spoof.js");
}

afterEach(() => {
  const scope = globalThis as typeof globalThis & {
    __brainrotVisibilityControlAbort?: AbortController;
  };
  scope.__brainrotVisibilityControlAbort?.abort();
  delete scope.__brainrotVisibilityControlAbort;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("MAIN-world visibility spoof", () => {
  it("is dormant until enabled and restores native descriptors on disable", async () => {
    const dom = createDom();
    const { document, Event } = dom.window;
    const nativeHidden = document.hidden;
    const nativeVisibilityState = document.visibilityState;

    await installSpoof(dom);

    expect(document.hidden).toBe(nativeHidden);
    expect(document.visibilityState).toBe(nativeVisibilityState);

    document.dispatchEvent(new Event(ENABLE_EVENT));
    expect(document.hidden).toBe(false);
    expect(document.visibilityState).toBe("visible");

    document.dispatchEvent(new Event(DISABLE_EVENT));
    expect(document.hidden).toBe(nativeHidden);
    expect(document.visibilityState).toBe(nativeVisibilityState);
    expect(Object.hasOwn(document, "hidden")).toBe(false);
    expect(Object.hasOwn(document, "visibilityState")).toBe(false);
  });

  it("preserves native visibility outside supported feed routes", async () => {
    const dom = createDom("https://www.youtube.com/watch?v=test");
    const { document, Event } = dom.window;
    const nativeHidden = document.hidden;
    const nativeVisibilityState = document.visibilityState;

    await installSpoof(dom);
    document.dispatchEvent(new Event(ENABLE_EVENT));

    expect(document.hidden).toBe(nativeHidden);
    expect(document.visibilityState).toBe(nativeVisibilityState);

    dom.reconfigure({ url: "https://www.youtube.com/shorts/test" });
    expect(document.hidden).toBe(false);
    expect(document.visibilityState).toBe("visible");
  });

  it("follows stored enabled state and live storage changes", async () => {
    const dom = createDom();
    const { document } = dom.window;
    let onChanged:
      | ((changes: Record<string, { newValue?: unknown }>, area: string) => void)
      | undefined;

    await installSpoof(dom);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(() => Promise.resolve({ enabled: false })),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            onChanged = listener;
          }),
          removeListener: vi.fn(),
        },
      },
    });

    await import("../src/content-main/control.js");
    await vi.waitFor(() => {
      expect(onChanged).toBeDefined();
    });

    expect(document.hidden).toBe(true);

    onChanged?.({ enabled: { newValue: true } }, "local");
    expect(document.hidden).toBe(false);

    onChanged?.({ enabled: { newValue: false } }, "local");
    expect(document.hidden).toBe(true);
  });

  it("supports callback-only storage APIs", async () => {
    const dom = createDom();
    const { document } = dom.window;

    await installSpoof(dom);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(
            (
              _keys: unknown,
              callback?: (snapshot: Record<string, unknown>) => void,
            ) => {
              if (!callback) {
                throw new TypeError("Callback required");
              }
              callback({ enabled: true });
            },
          ),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });

    await import("../src/content-main/control.js");

    await vi.waitFor(() => {
      expect(document.hidden).toBe(false);
    });
  });
});
