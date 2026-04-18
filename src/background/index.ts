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
  const tabs = await chrome.tabs.query({ url: SUPPORTED_URL_PATTERNS });

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
  } catch {
    // Silently fail — static manifest declaration will work on Chrome/Firefox
    // Safari may or may not support world: "MAIN" in registerContentScripts
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void reloadSupportedTabs();
  void registerMainWorldSpoofFallback();
});
