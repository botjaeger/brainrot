/**
 * MAIN-world visibility spoof script.
 * Runs at document_start before site player code to prevent pause-on-tab-switch.
 * Implements toggle via postMessage from content script.
 */
(() => {
  // Guard: do not apply twice if script re-injected on extension reload
  const MARKER = "__brainrotSpoofActive";
  const win = window as unknown as { [key: string]: unknown };
  if (win[MARKER]) return;
  win[MARKER] = true;

  // State: spoof starts enabled (default backgroundPlayback: true)
  let spoofEnabled = true;

  // Apply spoof: override document.visibilityState and document.hidden
  function applySpoofOverrides(): void {
    try {
      Object.defineProperty(document, "visibilityState", {
        get: () => "visible",
        configurable: true,
      });
    } catch {
      // Already defined non-configurable — acceptable
    }
    try {
      Object.defineProperty(document, "hidden", {
        get: () => false,
        configurable: true,
      });
    } catch {
      // Already defined non-configurable — acceptable
    }
  }

  // Remove spoof: delete own properties to restore Document.prototype getters
  function removeSpoofOverrides(): void {
    try {
      delete (document as unknown as Record<string, unknown>)["visibilityState"];
    } catch {
      // Non-configurable — acceptable
    }
    try {
      delete (document as unknown as Record<string, unknown>)["hidden"];
    } catch {
      // Non-configurable — acceptable
    }
  }

  // Apply spoof on initial load (before content script sends first postMessage)
  applySpoofOverrides();

  // Listen for toggle messages from ISOLATED-world content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string; enabled?: boolean } | null;
    if (data?.type !== "brainrot:spoof" || typeof data.enabled !== "boolean") return;

    if (data.enabled && !spoofEnabled) {
      applySpoofOverrides();
      spoofEnabled = true;
    } else if (!data.enabled && spoofEnabled) {
      removeSpoofOverrides();
      spoofEnabled = false;
    }
  });
})();
