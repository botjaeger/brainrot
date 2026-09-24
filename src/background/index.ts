const SUPPORTED_URL_PATTERNS = [
  "https://www.youtube.com/*",
  "https://www.facebook.com/*",
  "https://www.tiktok.com/*",
  "https://www.instagram.com/*",
];

// After extension reload/update the old content script world's chrome.storage
// is invalidated and cannot be restored by executeScript. The only reliable
// way to get a working content script is a page reload, which creates a fresh
// content script world with valid API bindings.
async function reloadSupportedTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: SUPPORTED_URL_PATTERNS });
  } catch {
    // tabs permission not granted or API unavailable — skip reload
    return;
  }

  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.reload(tab.id);
    }
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
    await chrome.scripting.unregisterContentScripts({
      ids: ["brainrot-visibility-spoof"],
    }).catch(() => {
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
  void reloadSupportedTabs();
  void registerMainWorldSpoofFallback();
  void markChangelogSeenOnInstall(details.reason);
});
