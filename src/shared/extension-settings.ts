export interface ExtensionSettings {
  enabled: boolean;
  debugLogging: boolean;
  scrollStats: Record<string, number>;
  todayDate: string;
  todayStats: Record<string, number>;
  theme: "light" | "dark";
  /** Version whose changelog the user has seen; the popup flags newer ones.
   *  Also written by src/background/index.ts on install. */
  changelogSeenVersion: string;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
  debugLogging: false,
  scrollStats: {
    "facebook-reels": 0,
    "instagram-reels": 0,
    tiktok: 0,
    "youtube-shorts": 0,
  },
  todayDate: "",
  todayStats: {
    "facebook-reels": 0,
    "instagram-reels": 0,
    tiktok: 0,
    "youtube-shorts": 0,
  },
  theme: "light",
  changelogSeenVersion: "",
};

export interface ExtensionSettingsStore {
  read(): Promise<ExtensionSettings>;
  write(settings: Partial<ExtensionSettings>): Promise<void>;
  watch?(callback: (settings: ExtensionSettings) => void): () => void;
}

type StorageSnapshot = Partial<Record<keyof ExtensionSettings, unknown>>;

type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

type StorageChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void;

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
  "scrollStats",
  "todayDate",
  "todayStats",
  "theme",
  "changelogSeenVersion",
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
      typeof snapshot.enabled === "boolean" ? snapshot.enabled : DEFAULT_EXTENSION_SETTINGS.enabled,
    debugLogging:
      typeof snapshot.debugLogging === "boolean"
        ? snapshot.debugLogging
        : DEFAULT_EXTENSION_SETTINGS.debugLogging,
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
    changelogSeenVersion:
      typeof snapshot.changelogSeenVersion === "string"
        ? snapshot.changelogSeenVersion
        : DEFAULT_EXTENSION_SETTINGS.changelogSeenVersion,
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

// Writes only the given keys, so a popup toggle never overwrites stats the
// content script incremented after the popup last read them.
async function writeStorageSnapshot(snapshot: Partial<ExtensionSettings>): Promise<void> {
  const storage = getStorageApi();

  if (!storage) {
    return;
  }

  const maybeWrite = storage.local.set(snapshot);

  if (isPromiseLike<void>(maybeWrite)) {
    await maybeWrite;
    return;
  }

  await new Promise<void>((resolve) => {
    storage.local.set(snapshot, () => {
      resolve();
    });
  });
}

export async function readExtensionSettings(): Promise<ExtensionSettings> {
  return normalizeSettings(await readStorageSnapshot());
}

export async function saveExtensionSettings(settings: Partial<ExtensionSettings>): Promise<void> {
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

    if (!STORAGE_KEYS.some((key) => key in changes)) {
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
