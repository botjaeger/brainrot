import { startFeedEngine, type FeedEngineController } from "../core/feed-engine.js";
import {
  DEFAULT_EXTENSION_SETTINGS,
  readExtensionSettings,
  watchExtensionSettings,
  type ExtensionSettings,
} from "./runtime-settings.js";
import { incrementScrollStat } from "./scroll-counter.js";
import { getSiteKey, watchSpaNavigation } from "./site-key.js";

let engine: FeedEngineController | null = null;
let currentSettings: ExtensionSettings = DEFAULT_EXTENSION_SETTINGS;

// Shared cooldown so engine-driven advances and DOM-detected advances
// never double-count the same transition (both can fire within milliseconds).
let lastCountMs = 0;
const COUNT_COOLDOWN_MS = 800;

function countScrollStat(siteKey: string): void {
  const now = Date.now();
  if (now - lastCountMs < COUNT_COOLDOWN_MS) return;
  lastCountMs = now;
  void incrementScrollStat(siteKey).catch(() => undefined);
}

function stopEngine(): void {
  engine?.stop();
  engine = null;
}

function startEngineIfNeeded(): void {
  if (!currentSettings.enabled) {
    return;
  }

  if (engine?.isRunning()) {
    return;
  }

  engine = null;

  engine = startFeedEngine({
    document,
    window,
    debugEnabled: currentSettings.debugLogging,
    // Count every engine-driven advance directly — most reliable for sites
    // that use transforms/virtual scroll (Facebook, Instagram).
    onAdvance: (siteKey) => {
      countScrollStat(siteKey);
    },
  });
}

function applySettings(nextSettings: ExtensionSettings): void {
  const settingsChanged =
    currentSettings.enabled !== nextSettings.enabled ||
    currentSettings.debugLogging !== nextSettings.debugLogging;

  currentSettings = nextSettings;

  if (!settingsChanged && engine?.isRunning()) {
    return;
  }

  stopEngine();
  startEngineIfNeeded();
}

function isVideoInViewport(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  const viewH = window.innerHeight || document.documentElement.clientHeight;
  const overlap = Math.min(rect.bottom, viewH) - Math.max(rect.top, 0);
  return rect.height > 0 && overlap / rect.height >= 0.5;
}

function setupScrollCounting(signal: AbortSignal): void {
  let lastSrc: string | null = null;
  let lastVideoElement: HTMLVideoElement | null = null;

  // DOM-strategy counter: deduplicate by video element AND src, skip the
  // initial page load, and skip if the engine already counted this
  // transition (cooldown).
  function record(video: HTMLVideoElement): void {
    if (signal.aborted) return;
    const src = video.currentSrc || video.src;
    const elementChanged = video !== lastVideoElement;
    const srcChanged = Boolean(src) && src !== lastSrc;
    if (!elementChanged && !srcChanged) return;
    const isFirstLoad = lastSrc === null && lastVideoElement === null;
    if (src) lastSrc = src;
    lastVideoElement = video;
    if (isFirstLoad) return;
    const siteKey = getSiteKey(window.location);
    if (siteKey) countScrollStat(siteKey);
  }

  // Strategy 1: play event — only count when the video is currently visible.
  // Avoids counting preloaded off-screen videos (Facebook loads next reel early).
  // Facebook uses CSS transforms for reel transitions; the play event fires
  // before the animation finishes, so the video may not be in viewport yet.
  // A delayed recheck catches these transform-driven transitions.
  document.addEventListener(
    "play",
    (event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      const video = event.target;
      if (isVideoInViewport(video)) {
        record(video);
      } else {
        setTimeout(() => {
          if (!signal.aborted && isVideoInViewport(video)) {
            record(video);
          }
        }, 600);
      }
    },
    { capture: true, signal },
  );

  // Strategy 2: IntersectionObserver — catches videos that are already playing
  // when the user scrolls them into view (Facebook Reels preload pattern).
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (
          entry.intersectionRatio >= 0.8 &&
          entry.target instanceof HTMLVideoElement
        ) {
          record(entry.target);
        }
      }
    },
    { threshold: [0.8] },
  );

  function observeAllVideos(): void {
    if (signal.aborted) return;
    for (const video of document.querySelectorAll<HTMLVideoElement>("video")) {
      intersectionObserver.observe(video);
    }
  }

  observeAllVideos();

  const mutationObserver = new MutationObserver(observeAllVideos);
  mutationObserver.observe(
    document.body ?? document.documentElement,
    { childList: true, subtree: true },
  );

  // Strategy 3: scroll event — catches manual scroll on sites where play
  // events don't re-fire (video preloaded) and IntersectionObserver may not
  // trigger reliably (CSS transforms, scroll-snap containers).
  let scrollDebounce: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener(
    "scroll",
    () => {
      if (scrollDebounce !== null) clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        scrollDebounce = null;
        if (signal.aborted) return;
        for (const video of document.querySelectorAll<HTMLVideoElement>(
          "video",
        )) {
          if (!video.paused && isVideoInViewport(video)) {
            record(video);
            break;
          }
        }
      }, 300);
    },
    { capture: true, signal },
  );

  // Disconnect observers when this injection is superseded.
  signal.addEventListener("abort", () => {
    intersectionObserver.disconnect();
    mutationObserver.disconnect();
    if (scrollDebounce !== null) clearTimeout(scrollDebounce);
  });
}

async function initializeContentScript(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    __brainrotAbort?: AbortController;
    __brainrotStopEngine?: () => void;
  };

  // Tear down any previous injection — handles both duplicate injection
  // (declarative + executeScript on same page load) and re-injection after
  // extension reload/update where the old chrome.storage context is dead.
  // Note: stopEngine() only sees this module's `engine` var — the old
  // injection's engine lives in a separate IIFE scope, so we call the
  // stored teardown to reach it.
  if (g.__brainrotAbort) {
    g.__brainrotAbort.abort();
    g.__brainrotStopEngine?.();
  }

  const abort = new AbortController();
  g.__brainrotAbort = abort;
  g.__brainrotStopEngine = stopEngine;

  try {
    currentSettings = await readExtensionSettings();
  } catch {
    currentSettings = DEFAULT_EXTENSION_SETTINGS;
  }

  // Another injection may have started during the async gap above.
  if (abort.signal.aborted) return;

  startEngineIfNeeded();
  if (getSiteKey(window.location)) {
    setupScrollCounting(abort.signal);
  }

  const unwatchSettings = watchExtensionSettings((nextSettings) => {
    if (abort.signal.aborted) return;
    applySettings(nextSettings);
  });

  abort.signal.addEventListener("abort", () => {
    unwatchSettings();
  });

  // Detect SPA navigations. These social sites use pushState; the content
  // script stays alive but the feed engine stops itself when the URL no
  // longer matches. Poll for URL changes and re-initialize when the user
  // navigates between feed and non-feed pages (or between different feeds).
  watchSpaNavigation(
    () => window.location,
    () => void initializeContentScript().catch(() => undefined),
    abort.signal,
  );
}

void initializeContentScript().catch(() => {
  // Keep the page working even if extension wiring fails late in startup.
});
