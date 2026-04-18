/**
 * MAIN-world visibility spoof script.
 * Runs at document_start before site player code to prevent pause-on-tab-switch.
 * Sources: xjavascript.com, w3tutorials.net visibility API spoof patterns.
 */
(() => {
  // Guard: do not apply twice if script re-injected on extension reload
  const MARKER = "__brainrotSpoofActive";
  const win = window as unknown as { [key: string]: unknown };
  if (win[MARKER]) return;
  win[MARKER] = true;

  // 1. visibilityState: always "visible"
  try {
    Object.defineProperty(document, "visibilityState", {
      get: () => "visible",
      configurable: true,   // was false - enables Phase 7 toggle
    });
  } catch {
    // Already defined non-configurable (second injection) — acceptable
  }

  // 2. hidden: always false
  try {
    Object.defineProperty(document, "hidden", {
      get: () => false,
      configurable: true,   // was false - enables Phase 7 toggle
    });
  } catch {
    // Already defined non-configurable — acceptable
  }

  // Note: visibilitychange events are intentionally NOT suppressed here.
  // The spoofed document.hidden=false and visibilityState="visible" getters
  // already prevent site players from pausing on tab-switch. Suppressing the
  // event via stopImmediatePropagation would also block the feed engine's own
  // onVisibilityChange listener, which handles background-poll and Safari
  // elapsed-time fallback logic.

  // 4. postMessage channel for Phase 7 toggle (no-op in Phase 5)
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string; enabled?: boolean } | null;
    if (data?.type === "brainrot:spoof" && typeof data.enabled === "boolean") {
      // Phase 7 will implement enable/disable here
    }
  });
})();
