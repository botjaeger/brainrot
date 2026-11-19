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

  // Callback-only implementations throw when called without a callback.
  let maybeResult: unknown;
  try {
    maybeResult = storage.local.get(SCROLL_KEYS);
  } catch {
    maybeResult = undefined;
  }
  const result: Record<string, unknown> = isPromiseLike<Record<string, unknown>>(maybeResult)
    ? await maybeResult
    : await new Promise<Record<string, unknown>>((resolve) => {
        storage.local.get(SCROLL_KEYS, (items: Record<string, unknown>) => resolve(items));
      });

  return {
    scrollStats: normalizeCounts(result["scrollStats"]),
    todayDate: typeof result["todayDate"] === "string" ? result["todayDate"] : "",
    todayStats: normalizeCounts(result["todayStats"]),
  };
}

// Same rule as normalizeCounts in src/shared/extension-settings.ts (cannot be imported:
// a shared chunk would become an `import` in the content bundle).
function normalizeCounts(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return counts;
  }
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) {
      counts[key] = count;
    }
  }
  return counts;
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

// Increments run one at a time: two overlapping read-then-write calls would
// both read the same count and one increment would be lost.
let pending: Promise<void> = Promise.resolve();

export function incrementScrollStat(siteKey: string): Promise<void> {
  const next = pending.then(() => applyIncrement(siteKey));
  pending = next.catch(() => undefined);
  return next;
}

async function applyIncrement(siteKey: string): Promise<void> {
  const data = await readScrollStorage();
  // en-CA formats as YYYY-MM-DD in local time, so "today" rolls over at local midnight.
  const today = new Date().toLocaleDateString("en-CA");

  // Reset daily stats on date rollover
  const daily = data.todayDate === today ? { ...data.todayStats } : {};

  await writeScrollStorage({
    scrollStats: { ...data.scrollStats, [siteKey]: (data.scrollStats[siteKey] ?? 0) + 1 },
    todayDate: today,
    todayStats: { ...daily, [siteKey]: (daily[siteKey] ?? 0) + 1 },
  });
}
