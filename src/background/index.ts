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

chrome.runtime.onInstalled.addListener(() => {
  void reloadSupportedTabs();
});
