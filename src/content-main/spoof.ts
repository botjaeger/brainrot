/**
 * MAIN-world visibility spoof script.
 * Runs at document_start before site player code to prevent pause-on-tab-switch.
 * Always active — background playback is always enabled.
 */
(() => {
  // Guard: do not apply twice if script re-injected on extension reload
  const MARKER = "__brainrotSpoofActive";
  const win = window as unknown as { [key: string]: unknown };
  if (win[MARKER]) return;
  win[MARKER] = true;

  // Override document.visibilityState and document.hidden
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
})();
