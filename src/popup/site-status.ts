import { APP_NAME, SUPPORTED_SITE_LABELS } from "../shared/brand.js";

export type SupportedSiteKind =
  | "youtube-shorts"
  | "facebook-reels"
  | "tiktok"
  | "instagram-reels"
  | "unsupported";

export interface SupportedSiteStatus {
  kind: SupportedSiteKind;
  supported: boolean;
  label: string;
  note: string;
}

type TabsQueryTab = {
  id?: number;
  url?: string | null;
};

type TabsQueryOptions = {
  active: boolean;
  currentWindow: boolean;
};

type TabsApi = {
  query: (
    queryInfo: TabsQueryOptions,
    callback?: (tabs: TabsQueryTab[]) => void,
  ) => unknown;
  reload?: (tabId?: number) => unknown;
  create?: (createProperties: { url: string }) => unknown;
};

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}

function getTabsApi(): TabsApi | null {
  const globalScope = globalThis as typeof globalThis & {
    browser?: { tabs?: TabsApi };
    chrome?: { tabs?: TabsApi };
  };

  return globalScope.browser?.tabs ?? globalScope.chrome?.tabs ?? null;
}

function firstTabUrl(tabs: TabsQueryTab[]): string | null {
  return tabs.find((tab) => typeof tab.url === "string" && tab.url.length > 0)
    ?.url ?? null;
}

function formatSiteList(items: readonly string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} or ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function isYouTubeShortsPathname(pathname: string): boolean {
  return pathname === "/shorts" || pathname.startsWith("/shorts/");
}

function isFacebookReelsPathname(pathname: string): boolean {
  return (
    pathname === "/reels" ||
    pathname.startsWith("/reels/") ||
    pathname === "/reel" ||
    pathname.startsWith("/reel/")
  );
}

const TIKTOK_LOCALE_PREFIX = /^\/[a-z]{2}(?:[-_][a-zA-Z0-9]{2,8})?(?=\/|$)/;

function normalizeTikTokPathname(pathname: string): string {
  const normalized = pathname.replace(TIKTOK_LOCALE_PREFIX, "");

  return normalized.length > 0 ? normalized : "/";
}

function isTikTokPathname(pathname: string): boolean {
  const normalizedPathname = normalizeTikTokPathname(pathname);

  return (
    normalizedPathname === "/" ||
    normalizedPathname === "/foryou" ||
    normalizedPathname.startsWith("/foryou/") ||
    normalizedPathname === "/following" ||
    normalizedPathname.startsWith("/following/") ||
    (normalizedPathname.startsWith("/@") &&
      normalizedPathname.includes("/video/"))
  );
}

function matchesHostname(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function describeSupportedSiteFromUrl(
  urlInput: string | URL,
): SupportedSiteStatus {
  const url = typeof urlInput === "string" ? new URL(urlInput) : urlInput;

  if (
    matchesHostname(url.hostname, "youtube.com") &&
    isYouTubeShortsPathname(url.pathname)
  ) {
    return {
      kind: "youtube-shorts",
      supported: true,
      label: "YouTube Shorts",
      note: `${APP_NAME} supports this page.`,
    };
  }

  if (
    matchesHostname(url.hostname, "facebook.com") &&
    isFacebookReelsPathname(url.pathname)
  ) {
    return {
      kind: "facebook-reels",
      supported: true,
      label: "Facebook Reels",
      note: `${APP_NAME} supports this page.`,
    };
  }

  if (
    matchesHostname(url.hostname, "tiktok.com") &&
    isTikTokPathname(url.pathname)
  ) {
    return {
      kind: "tiktok",
      supported: true,
      label: "TikTok",
      note: `${APP_NAME} supports this page.`,
    };
  }

  if (
    matchesHostname(url.hostname, "instagram.com") &&
    (url.pathname === "/reels" || url.pathname.startsWith("/reels/") ||
     url.pathname === "/reel" || url.pathname.startsWith("/reel/"))
  ) {
    return {
      kind: "instagram-reels",
      supported: true,
      label: "Instagram Reels",
      note: `${APP_NAME} supports this page.`,
    };
  }

  return {
    kind: "unsupported",
    supported: false,
    label: "No supported social site",
    note: `Open ${formatSiteList(SUPPORTED_SITE_LABELS)} to activate ${APP_NAME}.`,
  };
}

async function queryActiveTabs(): Promise<TabsQueryTab[]> {
  const tabs = getTabsApi();

  if (!tabs) {
    return [];
  }

  let maybeTabs: unknown;
  try {
    maybeTabs = tabs.query({
      active: true,
      currentWindow: true,
    });
  } catch {
    maybeTabs = undefined;
  }

  if (isPromiseLike<TabsQueryTab[]>(maybeTabs)) {
    return await maybeTabs;
  }

  return await new Promise<TabsQueryTab[]>((resolve) => {
    tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (activeTabs) => {
        resolve(activeTabs);
      },
    );
  });
}

export async function readActiveSupportedSite(): Promise<SupportedSiteStatus | null> {
  try {
    const activeTabs = await queryActiveTabs();
    const url = firstTabUrl(activeTabs);

    if (!url) {
      return null;
    }

    return describeSupportedSiteFromUrl(url);
  } catch {
    return null;
  }
}

// Opens an extension page in a new tab. The URL is resolved against the
// popup's own location because browsers disagree on relative tabs.create URLs.
export async function openExtensionPage(path: string, base: string): Promise<void> {
  const url = new URL(path, base).href;
  const tabs = getTabsApi();
  if (!tabs?.create) {
    globalThis.open?.(url, "_blank");
    return;
  }

  const maybeCreate = tabs.create({ url });
  if (isPromiseLike<unknown>(maybeCreate)) {
    await maybeCreate;
  }
}

export async function reloadActiveTab(): Promise<void> {
  const tabs = getTabsApi();
  if (!tabs?.reload) return;

  const [activeTab] = await queryActiveTabs();
  if (activeTab?.id == null) return;

  const maybeReload = tabs.reload(activeTab.id);
  if (isPromiseLike<void>(maybeReload)) {
    await maybeReload;
  }
}
