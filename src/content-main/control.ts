/**
 * Isolated-world bridge for the MAIN-world visibility spoof.
 * Reads the master enabled setting and communicates through DOM events.
 */
(() => {
  const ENABLE_EVENT = "brainrot:visibility-spoof-enable";
  const DISABLE_EVENT = "brainrot:visibility-spoof-disable";
  const READY_EVENT = "brainrot:visibility-spoof-ready";
  const globalScope = globalThis as typeof globalThis & {
    __brainrotVisibilityControlAbort?: AbortController;
    browser?: { storage?: StorageApi };
    chrome?: { storage?: StorageApi };
  };

  type StorageChange = { newValue?: unknown };
  type StorageChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void;
  type StorageApi = {
    local: { get(...args: unknown[]): unknown };
    onChanged?: {
      addListener(listener: StorageChangeListener): void;
      removeListener(listener: StorageChangeListener): void;
    };
  };

  globalScope.__brainrotVisibilityControlAbort?.abort();
  const abort = new AbortController();
  globalScope.__brainrotVisibilityControlAbort = abort;

  const storage = globalScope.browser?.storage ?? globalScope.chrome?.storage ?? null;
  let enabled: boolean | null = null;

  function dispatchState(): void {
    if (enabled === null || abort.signal.aborted) return;
    const event = document.createEvent("Event");
    event.initEvent(enabled ? ENABLE_EVENT : DISABLE_EVENT, false, false);
    document.dispatchEvent(event);
  }

  function isPromiseLike<T>(value: unknown): value is Promise<T> {
    return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
  }

  async function readEnabled(): Promise<boolean> {
    if (!storage) return true;

    let maybeSnapshot: unknown;
    try {
      maybeSnapshot = storage.local.get(["enabled"]);
    } catch {
      maybeSnapshot = undefined;
    }

    if (isPromiseLike<Record<string, unknown>>(maybeSnapshot)) {
      const snapshot = await maybeSnapshot;
      return typeof snapshot.enabled === "boolean" ? snapshot.enabled : true;
    }

    return await new Promise<boolean>((resolve) => {
      storage.local.get(["enabled"], (snapshot: Record<string, unknown>) => {
        resolve(typeof snapshot.enabled === "boolean" ? snapshot.enabled : true);
      });
    });
  }

  const onReady = (): void => dispatchState();
  const onChanged: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local" || !("enabled" in changes)) return;
    const nextEnabled = changes.enabled?.newValue;
    enabled = typeof nextEnabled === "boolean" ? nextEnabled : true;
    dispatchState();
  };

  document.addEventListener(READY_EVENT, onReady);
  storage?.onChanged?.addListener(onChanged);

  abort.signal.addEventListener("abort", () => {
    document.removeEventListener(READY_EVENT, onReady);
    storage?.onChanged?.removeListener(onChanged);
  });

  void readEnabled().then((nextEnabled) => {
    if (abort.signal.aborted) return;
    enabled = nextEnabled;
    dispatchState();
  });
})();

export {};
