type StorageArea = {
  get(...args: unknown[]): unknown;
  set(...args: unknown[]): unknown;
};

type StorageApi = {
  local: StorageArea;
};

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

interface ScrollStorage {
  scrollStats: Record<string, number>;
  todayDate: string;
  todayStats: Record<string, number>;
}

const SCROLL_KEYS = ["scrollStats", "todayDate", "todayStats"];

async function readScrollStorage(): Promise<ScrollStorage> {
  const storage = getStorageApi();
  if (!storage) return { scrollStats: {}, todayDate: "", todayStats: {} };

  const maybeResult = storage.local.get(SCROLL_KEYS);
  const result: Record<string, unknown> = isPromiseLike<Record<string, unknown>>(maybeResult)
    ? await maybeResult
    : await new Promise<Record<string, unknown>>((resolve) => {
        storage.local.get(SCROLL_KEYS, (items: Record<string, unknown>) => resolve(items));
      });

  const stats = result["scrollStats"];
  const todayStats = result["todayStats"];
  return {
    scrollStats: stats && typeof stats === "object" ? (stats as Record<string, number>) : {},
    todayDate: typeof result["todayDate"] === "string" ? result["todayDate"] as string : "",
    todayStats: todayStats && typeof todayStats === "object" ? (todayStats as Record<string, number>) : {},
  };
}

async function writeScrollStorage(data: ScrollStorage): Promise<void> {
  const storage = getStorageApi();
  if (!storage) return;

  const maybeWrite = storage.local.set(data);
  if (isPromiseLike<void>(maybeWrite)) {
    await maybeWrite;
    return;
  }
  await new Promise<void>((resolve) => {
    storage.local.set(data, () => resolve());
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementScrollStat(siteKey: string): Promise<void> {
  const data = await readScrollStorage();
  const today = todayIso();

  // Reset daily stats on date rollover
  const daily = data.todayDate === today ? { ...data.todayStats } : {};

  await writeScrollStorage({
    scrollStats: { ...data.scrollStats, [siteKey]: (data.scrollStats[siteKey] ?? 0) + 1 },
    todayDate: today,
    todayStats: { ...daily, [siteKey]: (daily[siteKey] ?? 0) + 1 },
  });
}
