/**
 * MAIN-world visibility spoof script.
 * Runs at document_start before site player code to prevent pause-on-tab-switch.
 * Sources: xjavascript.com, w3tutorials.net visibility API spoof patterns.
 */
(() => {
  // Guard: do not apply twice if script re-injected on extension reload
  const MARKER = "__brainrotSpoofActive";
  const win = window as Window & { [key: string]: unknown };
  if (win[MARKER]) return;
  win[MARKER] = true;

  // 1. visibilityState: always "visible"
  try {
    Object.defineProperty(document, "visibilityState", {
      get: () => "visible",
      configurable: false,
    });
  } catch {
    // Already defined non-configurable (second injection) — acceptable
  }

  // 2. hidden: always false
  try {
    Object.defineProperty(document, "hidden", {
      get: () => false,
      configurable: false,
    });
  } catch {
    // Already defined non-configurable — acceptable
  }

  // 3. Suppress visibilitychange in capture phase before site listeners see it
  document.addEventListener(
    "visibilitychange",
    (e: Event) => {
      e.stopImmediatePropagation();
    },
    { capture: true, passive: false },
  );

  // 4. Also suppress legacy webkitvisibilitychange (some older site implementations)
  document.addEventListener(
    "webkitvisibilitychange",
    (e: Event) => {
      e.stopImmediatePropagation();
    },
    { capture: true, passive: false },
  );

  // 5. postMessage channel for Phase 7 toggle (no-op in Phase 5)
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string; enabled?: boolean } | null;
    if (data?.type === "brainrot:spoof" && typeof data.enabled === "boolean") {
      // Phase 7 will implement enable/disable here
    }
  });
})();
