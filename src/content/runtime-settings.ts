export interface ExtensionSettings {
  enabled: boolean;
  debugLogging: boolean;
  backgroundPlayback: boolean;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  debugLogging: false,
  backgroundPlayback: true,
};

type StorageSnapshot = Partial<Record<keyof ExtensionSettings, unknown>>;

type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

type StorageArea = {
  get(...args: unknown[]): unknown;
};

type StorageApi = {
  local: StorageArea;
  onChanged?: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
  };
};

const STORAGE_KEYS: Array<keyof ExtensionSettings> = [
  "enabled",
  "debugLogging",
  "backgroundPlayback",
];

function getStorageApi(): StorageApi | null {
  const globalScope = globalThis as typeof globalThis & {
    browser?: { storage?: StorageApi };
    chrome?: { storage?: StorageApi };
  };

  return globalScope.browser?.storage ?? globalScope.chrome?.storage ?? null;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}

function normalizeSettings(snapshot: StorageSnapshot): ExtensionSettings {
  return {
    enabled:
      typeof snapshot.enabled === "boolean"
        ? snapshot.enabled
        : DEFAULT_EXTENSION_SETTINGS.enabled,
    debugLogging:
      typeof snapshot.debugLogging === "boolean"
        ? snapshot.debugLogging
        : DEFAULT_EXTENSION_SETTINGS.debugLogging,
    backgroundPlayback:
      typeof snapshot.backgroundPlayback === "boolean"
        ? snapshot.backgroundPlayback
        : DEFAULT_EXTENSION_SETTINGS.backgroundPlayback,
  };
}

async function readStorageSnapshot(): Promise<StorageSnapshot> {
  const storage = getStorageApi();

  if (!storage) {
    return {};
  }

  const maybeSnapshot = storage.local.get(STORAGE_KEYS);

  if (isPromiseLike<StorageSnapshot>(maybeSnapshot)) {
    return await maybeSnapshot;
  }

  return await new Promise<StorageSnapshot>((resolve) => {
    storage.local.get(STORAGE_KEYS, (items: StorageSnapshot) => {
      resolve(items);
    });
  });
}

export async function readExtensionSettings(): Promise<ExtensionSettings> {
  return normalizeSettings(await readStorageSnapshot());
}

export function watchExtensionSettings(
  callback: (settings: ExtensionSettings) => void,
): () => void {
  const storage = getStorageApi();

  if (!storage?.onChanged) {
    return () => undefined;
  }

  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (!("enabled" in changes) && !("debugLogging" in changes) && !("backgroundPlayback" in changes)) {
      return;
    }

    void readExtensionSettings()
      .then(callback)
      .catch(() => {
        // Best effort only; the content script still runs with defaults.
      });
  };

  storage.onChanged.addListener(listener);

  return () => {
    storage.onChanged?.removeListener(listener);
  };
}
