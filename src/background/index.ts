const SUPPORTED_URL_PATTERNS = [
  "https://www.youtube.com/*",
  "https://www.facebook.com/*",
  "https://www.tiktok.com/*",
  "https://www.instagram.com/*",
];

const TIKTOK_LOCALE_PREFIX = /^\/[a-z]{2}(?:[-_][a-zA-Z0-9]{2,8})?(?=\/|$)/;

// Same feed pages as getSiteKey() in src/content/site-key.ts, which this
// classic worker cannot import: the content bundle imports it too, and a
// module shared by two entries becomes an `import`ed chunk.
function isFeedUrl(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const { hostname, pathname } = parsed;
  const isReels = /^\/reels?(\/|$)/.test(pathname);

  if (hostname === "www.youtube.com") return /^\/shorts(\/|$)/.test(pathname);
  if (hostname === "www.facebook.com" || hostname === "www.instagram.com") {
    return isReels;
  }
  if (hostname === "www.tiktok.com") {
    const path = pathname.replace(TIKTOK_LOCALE_PREFIX, "") || "/";
    return (
      path === "/" ||
      /^\/(foryou|following)(\/|$)/.test(path) ||
      (path.startsWith("/@") && path.includes("/video/"))
    );
  }
  return false;
}

// After extension reload/update the old content script world's chrome.storage
// is invalidated and cannot be restored by executeScript. The only reliable
// way to get a working content script is a page reload, which creates a fresh
// content script world with valid API bindings. Only feed tabs are reloaded:
// a Chrome auto-update must not reload a video or a half-written post elsewhere
// on these sites; those tabs pick the new script up on their next page load.
async function reloadFeedTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: SUPPORTED_URL_PATTERNS });
  } catch {
    // tabs permission not granted or API unavailable — skip reload
    return;
  }

  for (const tab of tabs) {
    if (tab.id != null && isFeedUrl(tab.url)) {
      void reloadTab(tab.id);
    }
  }
}

async function reloadTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.reload(tabId);
  } catch {
    // The tab closed or navigated away since the query — nothing to reload.
  }
}

/**
 * Safari fallback: register MAIN-world script dynamically.
 * Chrome/Firefox use static manifest declaration; Safari may need dynamic registration.
 * Silently fails if scripting.registerContentScripts with world: "MAIN" is unsupported.
 */
async function registerMainWorldSpoofFallback(): Promise<void> {
  // Check if scripting API is available (may not be in all browsers/contexts)
  if (typeof chrome?.scripting?.registerContentScripts !== "function") {
    return;
  }

  try {
    // Unregister first to avoid "script already registered" errors on reinstall
    await chrome.scripting
      .unregisterContentScripts({
        ids: ["brainrot-visibility-spoof"],
      })
      .catch(() => {
        // Script not registered yet — this is fine
      });

    await chrome.scripting.registerContentScripts([
      {
        id: "brainrot-visibility-spoof",
        js: ["content-main/spoof.js"],
        matches: SUPPORTED_URL_PATTERNS,
        runAt: "document_start",
        world: "MAIN",
      },
    ]);
  } catch (err) {
    // Only suppress errors that indicate the feature is unsupported.
    // Log unexpected errors so Safari QA can catch registration failures.
    const message = err instanceof Error ? err.message : String(err);
    const SUPPRESSED_FRAGMENTS = [
      "not supported",
      "not implemented",
      "not allowed",
      "not permitted",
    ];
    const lowerMessage = message.toLowerCase();
    const shouldSuppress = SUPPRESSED_FRAGMENTS.some((f) => lowerMessage.includes(f));
    if (!shouldSuppress) {
      console.warn("[Brainrot] registerContentScripts failed:", message);
    }
  }
}

// A fresh install has nothing new to announce: mark the installed version's
// changelog as seen so the popup's "What's new" dot appears only after updates.
// Key shared with `changelogSeenVersion` in src/shared/extension-settings.ts,
// which this classic worker cannot import without a shared chunk.
async function markChangelogSeenOnInstall(reason: string): Promise<void> {
  if (reason !== "install") return;
  try {
    await chrome.storage.local.set({
      changelogSeenVersion: chrome.runtime.getManifest().version,
    });
  } catch {
    // Storage unavailable: the dot shows once, which is harmless.
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  // A browser update restarts the browser, so every tab already has a live
  // content script.
  if (details.reason === "install" || details.reason === "update") {
    void reloadFeedTabs();
  }
  void registerMainWorldSpoofFallback();
  void markChangelogSeenOnInstall(details.reason);
});

export {};
