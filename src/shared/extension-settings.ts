export interface ExtensionSettings {
  enabled: boolean;
  debugLogging: boolean;
  loopVideo: boolean;
  pauseOnHover: boolean;
  backgroundPlayback: boolean;
  scrollStats: Record<string, number>;
  todayDate: string;
  todayStats: Record<string, number>;
  theme: "light" | "dark";
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  debugLogging: false,
  loopVideo: false,
  pauseOnHover: true,
  backgroundPlayback: true,
  scrollStats: {
    "facebook-reels": 0,
    "instagram-reels": 0,
    "tiktok": 0,
    "youtube-shorts": 0,
  },
  todayDate: "",
  todayStats: {
    "facebook-reels": 0,
    "instagram-reels": 0,
    "tiktok": 0,
    "youtube-shorts": 0,
  },
  theme: "light",
};

export interface ExtensionSettingsStore {
  read(): Promise<ExtensionSettings>;
  write(settings: ExtensionSettings): Promise<void>;
  watch?(callback: (settings: ExtensionSettings) => void): () => void;
}

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
  set(...args: unknown[]): unknown;
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
  "loopVideo",
  "pauseOnHover",
  "backgroundPlayback",
  "scrollStats",
  "todayDate",
  "todayStats",
  "theme",
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
    loopVideo:
      typeof snapshot.loopVideo === "boolean"
        ? snapshot.loopVideo
        : DEFAULT_EXTENSION_SETTINGS.loopVideo,
    pauseOnHover:
      typeof snapshot.pauseOnHover === "boolean"
        ? snapshot.pauseOnHover
        : DEFAULT_EXTENSION_SETTINGS.pauseOnHover,
    backgroundPlayback:
      typeof snapshot.backgroundPlayback === "boolean"
        ? snapshot.backgroundPlayback
        : DEFAULT_EXTENSION_SETTINGS.backgroundPlayback,
    scrollStats:
      snapshot.scrollStats && typeof snapshot.scrollStats === "object"
        ? (snapshot.scrollStats as Record<string, number>)
        : DEFAULT_EXTENSION_SETTINGS.scrollStats,
    todayDate:
      typeof snapshot.todayDate === "string"
        ? snapshot.todayDate
        : DEFAULT_EXTENSION_SETTINGS.todayDate,
    todayStats:
      snapshot.todayStats && typeof snapshot.todayStats === "object"
        ? (snapshot.todayStats as Record<string, number>)
        : DEFAULT_EXTENSION_SETTINGS.todayStats,
    theme:
      snapshot.theme === "light" || snapshot.theme === "dark"
        ? snapshot.theme
        : DEFAULT_EXTENSION_SETTINGS.theme,
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

async function writeStorageSnapshot(
  settings: ExtensionSettings,
): Promise<void> {
  const storage = getStorageApi();

  if (!storage) {
    return;
  }

  const snapshot: StorageSnapshot = {
    enabled: settings.enabled,
    debugLogging: settings.debugLogging,
    loopVideo: settings.loopVideo,
    pauseOnHover: settings.pauseOnHover,
    backgroundPlayback: settings.backgroundPlayback,
    scrollStats: settings.scrollStats,
    todayDate: settings.todayDate,
    todayStats: settings.todayStats,
    theme: settings.theme,
  };

  // Use callback form first - works for both promise and callback APIs.
  // In MV3 Chrome/Firefox, this returns a Promise AND calls the callback.
  // We primarily await the Promise when available; callback is fallback.
  return new Promise<void>((resolve, reject) => {
    const maybePromise = storage.local.set(snapshot, () => {
      // Callback for older APIs or as fallback
      const g = globalThis as typeof globalThis & {
        chrome?: { runtime?: { lastError?: { message?: string } } };
      };
      const lastError = g.chrome?.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? "Storage write failed"));
      } else {
        resolve();
      }
    });

    // If the API returns a promise (MV3), prefer it over callback
    if (isPromiseLike<void>(maybePromise)) {
      maybePromise.then(resolve).catch(reject);
    }
  });
}

export async function readExtensionSettings(): Promise<ExtensionSettings> {
  return normalizeSettings(await readStorageSnapshot());
}

export async function saveExtensionSettings(
  settings: ExtensionSettings,
): Promise<void> {
  await writeStorageSnapshot(settings);
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

    if (
      !("enabled" in changes) &&
      !("debugLogging" in changes) &&
      !("loopVideo" in changes) &&
      !("pauseOnHover" in changes) &&
      !("backgroundPlayback" in changes) &&
      !("scrollStats" in changes) &&
      !("todayDate" in changes) &&
      !("todayStats" in changes) &&
      !("theme" in changes)
    ) {
      return;
    }

    void readExtensionSettings()
      .then(callback)
      .catch(() => {
        // Storage updates are best-effort for the popup and content script.
      });
  };

  storage.onChanged.addListener(listener);

  return () => {
    storage.onChanged?.removeListener(listener);
  };
}

export function createExtensionSettingsStore(): ExtensionSettingsStore {
  return {
    read: readExtensionSettings,
    write: saveExtensionSettings,
    watch: watchExtensionSettings,
  };
}
