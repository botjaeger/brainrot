import { facebookReelsSiteAdapter } from "../sites/facebook-reels.js";
import { instagramReelsSiteAdapter } from "../sites/instagram-reels.js";
import { tiktokSiteAdapter } from "../sites/tiktok.js";
import { youtubeShortsSiteAdapter } from "../sites/youtube-shorts.js";

export interface FeedAdvanceResult {
  method: string;
  selector?: string;
}

export interface ActiveFeedItem {
  video: HTMLVideoElement;
  key: Element;
}

export interface FeedSiteAdapter {
  name: string;
  siteKey: string;
  nativeTransitionGraceMs?: number;
  matches(location: Location): boolean;
  findActiveItem(document: Document): ActiveFeedItem | null;
  advancePlayback(document: Document, currentVideo: HTMLVideoElement): FeedAdvanceResult;
}

export interface FeedEngineEnvironment {
  document: Document;
  window: {
    location: Location;
    MutationObserver?: typeof MutationObserver;
  };
  adapters?: readonly FeedSiteAdapter[];
  debugEnabled?: boolean;
  onAdvance?: (siteKey: string) => void;
}

export interface FeedEngineController {
  stop(): void;
  rebind(): void;
  isRunning(): boolean;
}

const noopController: FeedEngineController = {
  stop() {
    // Intentionally empty.
  },
  rebind() {
    // Intentionally empty.
  },
  isRunning() {
    return false;
  },
};

const LOG_PREFIX = "[Brainrot]";
const END_FALLBACK_DELAY_MS = 350;
const LOOP_WRAP_WINDOW_S = 1;

/**
 * Returns the real visibility state of the document, bypassing any instance-level
 * property override set by the MAIN-world visibility spoof (src/content-main/spoof.ts).
 *
 * The spoof overrides `document.hidden` on the document instance to always return false.
 * Walking the prototype chain to find the `hidden` property descriptor bypasses that
 * instance override and returns the genuine browser visibility state. Falls back to
 * `doc.hidden` in environments where no getter is found on the prototype chain
 * (e.g. minimal test stubs that define `hidden` directly on the object).
 *
 * Avoids referencing the global `Document` directly so this works in Node.js/JSDOM
 * test environments where `Document` is not a global.
 */
function getRealHidden(doc: Document): boolean {
  let proto = Object.getPrototypeOf(doc) as object | null;
  while (proto !== null) {
    const desc = Object.getOwnPropertyDescriptor(proto, "hidden");
    if (desc) {
      return (desc.get?.call(doc) as boolean | undefined) ?? doc.hidden;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return doc.hidden;
}

const DEFAULT_FEED_SITES: readonly FeedSiteAdapter[] = [
  youtubeShortsSiteAdapter,
  facebookReelsSiteAdapter,
  tiktokSiteAdapter,
  instagramReelsSiteAdapter,
];

function createDiagnosticLogger(
  enabled: boolean,
): ((message: string, details?: Record<string, unknown>) => void) | null {
  if (!enabled) {
    return null;
  }

  return (message: string, details?: Record<string, unknown>) => {
    if (details && Object.keys(details).length > 0) {
      console.info(LOG_PREFIX, message, details);
      return;
    }

    console.info(LOG_PREFIX, message);
  };
}

function selectAdapter(
  location: Location,
  adapters: readonly FeedSiteAdapter[],
): FeedSiteAdapter | null {
  for (const adapter of adapters) {
    if (adapter.matches(location)) {
      return adapter;
    }
  }

  return null;
}

export function startFeedEngine({
  document,
  window,
  adapters = DEFAULT_FEED_SITES,
  debugEnabled = false,
  onAdvance,
}: FeedEngineEnvironment): FeedEngineController {
  const adapter = selectAdapter(window.location, adapters);

  if (!adapter) {
    return noopController;
  }

  const observationTarget = document.body ?? document.documentElement;

  if (!observationTarget) {
    return noopController;
  }

  let activeVideo: HTMLVideoElement | null = null;
  let observer: MutationObserver | null = null;
  let stopped = false;
  let rebindTimer: ReturnType<typeof setTimeout> | null = null;
  let endFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let visibilityAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeItemKey: Element | null = null;
  let activeSource = "";
  let playbackGeneration = 0;
  let advancedGeneration: number | null = null;
  let removePlayListener: (() => void) | null = null;
  const mutationObserverCtor = window.MutationObserver;
  const log = createDiagnosticLogger(debugEnabled);

  // Background / visibility tracking state
  let lastKnownTime = 0;
  let lastKnownDuration = 0;
  let wasPlayingBeforeHidden = false;
  let videoEndedWhileHidden = false;
  let userPaused = false;
  let hideTimestamp = 0;
  let backgroundPollTimer: ReturnType<typeof setInterval> | null = null;

  const isPlaybackNearEnd = (video: HTMLVideoElement): boolean => {
    const duration = video.duration;

    return Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.25;
  };

  const getVideoSource = (video: HTMLVideoElement): string => {
    return video.currentSrc || video.src || "";
  };

  const clearScheduledRebind = (): void => {
    if (rebindTimer === null) {
      return;
    }

    clearTimeout(rebindTimer);
    rebindTimer = null;
  };

  const scheduleRebind = (): void => {
    if (stopped || rebindTimer !== null) {
      return;
    }

    rebindTimer = setTimeout(() => {
      rebindTimer = null;
      rebind();
    }, 0);
  };

  const clearEndFallback = (): void => {
    if (endFallbackTimer === null) return;
    clearTimeout(endFallbackTimer);
    endFallbackTimer = null;
  };

  const clearVisibilityAdvance = (): void => {
    if (visibilityAdvanceTimer === null) return;
    clearTimeout(visibilityAdvanceTimer);
    visibilityAdvanceTimer = null;
  };

  const isCurrentIdentity = (
    generation: number,
    video: HTMLVideoElement,
    itemKey: Element,
    source: string,
  ): boolean => {
    if (!(
      playbackGeneration === generation &&
      activeVideo === video &&
      activeItemKey === itemKey &&
      getVideoSource(video) === source
    )) {
      return false;
    }

    const detectedItem = adapter.findActiveItem(document);
    return (
      detectedItem?.video === video &&
      detectedItem.key === itemKey &&
      getVideoSource(detectedItem.video) === source
    );
  };

  const clearBackgroundPoll = (): void => {
    if (backgroundPollTimer !== null) {
      clearInterval(backgroundPollTimer);
      backgroundPollTimer = null;
    }
  };

  const startBackgroundPoll = (): void => {
    // Always clear first to prevent duplicate intervals
    clearBackgroundPoll();

    if (!wasPlayingBeforeHidden) {
      return;
    }

    backgroundPollTimer = setInterval(() => {
      if (stopped) {
        clearBackgroundPoll();
        return;
      }

      if (!activeVideo || videoEndedWhileHidden) {
        return;
      }

      if (activeVideo.ended || isPlaybackNearEnd(activeVideo)) {
        videoEndedWhileHidden = true;
        log?.("background-poll: video ended while hidden");
      }
    }, 500);
  };

  const advanceFeed = (trigger: "ended" | "timeupdate" | "visibility-return"): void => {
    if (!activeVideo || !activeItemKey || advancedGeneration === playbackGeneration) {
      return;
    }

    if (getRealHidden(document)) {
      return;
    }

    clearEndFallback();
    advancedGeneration = playbackGeneration;
    let result: FeedAdvanceResult;
    try {
      result = adapter.advancePlayback(document, activeVideo);
    } catch (err) {
      log?.("advance-error", {
        error: String(err),
        generation: playbackGeneration,
      });
      return;
    }
    onAdvance?.(adapter.siteKey);

    log?.("advance", {
      site: adapter.name,
      trigger,
      generation: playbackGeneration,
      method: result.method,
      selector: result.selector || null,
    });
  };

  const scheduleIdentityBoundAdvance = (
    trigger: "ended" | "timeupdate",
    delayMs: number,
    requireNearEnd: boolean,
  ): void => {
    if (
      !activeVideo ||
      !activeItemKey ||
      advancedGeneration === playbackGeneration ||
      endFallbackTimer !== null
    ) {
      return;
    }

    const generation = playbackGeneration;
    const video = activeVideo;
    const itemKey = activeItemKey;
    const source = activeSource;
    if (delayMs <= 0) {
      if (isCurrentIdentity(generation, video, itemKey, source)) {
        advanceFeed(trigger);
      } else {
        scheduleRebind();
      }
      return;
    }

    endFallbackTimer = setTimeout(() => {
      endFallbackTimer = null;
      if (
        stopped ||
        !isCurrentIdentity(generation, video, itemKey, source) ||
        (requireNearEnd && (userPaused || !isPlaybackNearEnd(video)))
      ) {
        scheduleRebind();
        return;
      }

      advanceFeed(trigger);
    }, delayMs);
  };

  const onEnded = (): void => {
    clearEndFallback();
    if (getRealHidden(document)) {
      videoEndedWhileHidden = true;
      log?.("ended-while-hidden: deferring to visibility-return");
      return;
    }
    scheduleIdentityBoundAdvance("ended", adapter.nativeTransitionGraceMs ?? 0, false);
  };

  const onPlaybackProgress = (): void => {
    if (!activeVideo) return;

    if (activeVideo.currentTime > maxTimeReached) {
      maxTimeReached = activeVideo.currentTime;
    }

    if (
      advancedGeneration === playbackGeneration ||
      !isPlaybackNearEnd(activeVideo) ||
      // Pausing fires `timeupdate`: a video the user stopped near the end stays.
      userPaused ||
      getRealHidden(document)
    ) {
      return;
    }

    scheduleIdentityBoundAdvance("timeupdate", END_FALLBACK_DELAY_MS, true);
  };

  // Detect player-managed loops: the video seeks from near-end back to start
  // without firing "ended" (common in TikTok's xgplayer and YouTube Shorts).
  // Track the max time reached so a loop-seek doesn't erase our knowledge
  // that the video was near the end. The window is wider than the near-end
  // threshold because timeupdate fires only every ~250 ms (slower in the
  // background), so the last sample before a wrap can land outside 0.25 s.
  let maxTimeReached = 0;
  const onSeeked = (): void => {
    if (!activeVideo || advancedGeneration === playbackGeneration) return;
    const duration = activeVideo.duration;
    if (
      Number.isFinite(duration) &&
      duration > 0 &&
      maxTimeReached >= duration - LOOP_WRAP_WINDOW_S &&
      activeVideo.currentTime < 1
    ) {
      clearEndFallback();
      if (getRealHidden(document)) {
        videoEndedWhileHidden = true;
        log?.("loop-seek-while-hidden: deferring to visibility-return");
        return;
      }
      scheduleIdentityBoundAdvance("ended", adapter.nativeTransitionGraceMs ?? 0, false);
    }
  };

  // Pause handler: distinguish user-initiated pause (foreground) from site-driven
  // pause (while hidden). Only resume site-driven pauses.
  const onPause = (): void => {
    if (!activeVideo || advancedGeneration === playbackGeneration) return;
    if (!getRealHidden(document)) {
      // Foreground pause = user-initiated
      userPaused = true;
      return;
    }
    // Hidden pause: resume if user did not pause intentionally
    if (!userPaused && !activeVideo.ended) {
      log?.("pause-while-hidden: resuming");
      activeVideo.play().catch(() => {
        /* best effort */
      });
    }
  };

  // Play handler: user resumed, reset userPaused flag
  const onPlay = (): void => {
    userPaused = false;
  };

  // Visibility change handler: snapshot state on hide, check for completion on return
  const onVisibilityChange = (): void => {
    if (stopped) return;

    if (getRealHidden(document)) {
      clearVisibilityAdvance();
      // Tab going to background — snapshot current state
      if (activeVideo) {
        wasPlayingBeforeHidden = !activeVideo.paused;
        lastKnownTime = activeVideo.currentTime;
        lastKnownDuration = activeVideo.duration || 0;
      } else {
        wasPlayingBeforeHidden = false;
      }
      videoEndedWhileHidden = false;
      hideTimestamp = Date.now();

      if (wasPlayingBeforeHidden) {
        startBackgroundPoll();
      }
    } else {
      // Tab returning to foreground
      clearBackgroundPoll();

      const elapsedMs = Date.now() - hideTimestamp;
      const remainingMs = (lastKnownDuration - lastKnownTime) * 1000;

      const shouldAdvance =
        videoEndedWhileHidden ||
        (activeVideo &&
          wasPlayingBeforeHidden &&
          (activeVideo.ended ||
            (lastKnownDuration > 0 && activeVideo.currentTime >= lastKnownDuration - 0.25) ||
            (lastKnownDuration > 0 &&
              lastKnownTime >= lastKnownDuration - 0.25 &&
              activeVideo.currentTime < 1) ||
            // Safari elapsed-time fallback: enough real time has passed for the video to
            // have finished. Only apply when remaining time was > 200 ms at hide time,
            // so a brief tab-switch near the end does not trigger a spurious advance.
            // 200 ms covers realistic currentTime sampling jitter without false-positives.
            (hideTimestamp > 0 &&
              lastKnownDuration > 0 &&
              lastKnownTime > 0 &&
              remainingMs > 200 &&
              elapsedMs >= remainingMs - 200)));

      videoEndedWhileHidden = false;

      if (shouldAdvance) {
        // Defer one tick so document.hidden is reliably false when advanceFeed checks it
        clearVisibilityAdvance();
        if (!activeVideo || !activeItemKey) return;
        const generation = playbackGeneration;
        const video = activeVideo;
        const itemKey = activeItemKey;
        const source = activeSource;
        visibilityAdvanceTimer = setTimeout(() => {
          visibilityAdvanceTimer = null;
          if (!stopped && isCurrentIdentity(generation, video, itemKey, source)) {
            advanceFeed("visibility-return");
          }
        }, 0);
      } else if (
        activeVideo &&
        wasPlayingBeforeHidden &&
        activeVideo.paused &&
        !activeVideo.ended &&
        !userPaused
      ) {
        activeVideo.play().catch(() => {
          /* best effort */
        });
      }
    }
  };

  // Keep the site's player from looping the active video, so it fires "ended".
  // A property override would only exist in the content script's isolated
  // world; the page sets `loop` through its own wrapper, which reflects to the
  // `loop` attribute. Watching that attribute works across worlds.
  let loopObserver: MutationObserver | null = null;

  const lockLoop = (video: HTMLVideoElement): void => {
    video.loop = false;
    if (!mutationObserverCtor) return;
    loopObserver = new mutationObserverCtor(() => {
      if (video.hasAttribute("loop")) video.loop = false;
    });
    loopObserver.observe(video, { attributes: true, attributeFilter: ["loop"] });
  };

  const unlockLoop = (): void => {
    loopObserver?.disconnect();
    loopObserver = null;
  };

  const detachActiveVideo = (): void => {
    if (!activeVideo) {
      return;
    }

    clearBackgroundPoll();
    clearEndFallback();
    clearVisibilityAdvance();
    unlockLoop();
    activeVideo.removeEventListener("ended", onEnded);
    activeVideo.removeEventListener("timeupdate", onPlaybackProgress);
    activeVideo.removeEventListener("seeked", onSeeked);
    activeVideo.removeEventListener("pause", onPause);
    activeVideo.removeEventListener("play", onPlay);
    activeVideo = null;
    activeItemKey = null;
    activeSource = "";
    advancedGeneration = null;
    maxTimeReached = 0;
    userPaused = false;
  };

  const beginPlaybackGeneration = (source: string): void => {
    clearEndFallback();
    clearVisibilityAdvance();
    clearBackgroundPoll();
    playbackGeneration += 1;
    advancedGeneration = null;
    activeSource = source;
    maxTimeReached = activeVideo?.currentTime ?? 0;
    videoEndedWhileHidden = false;
  };

  const attachActiveItem = (item: ActiveFeedItem | null): void => {
    if (!item) {
      detachActiveVideo();
      return;
    }

    const source = getVideoSource(item.video);
    if (item.video === activeVideo && item.key === activeItemKey) {
      if (source !== activeSource) {
        beginPlaybackGeneration(source);
      }
      return;
    }

    detachActiveVideo();

    activeVideo = item.video;
    activeItemKey = item.key;
    beginPlaybackGeneration(source);

    if (activeVideo) {
      lockLoop(activeVideo);
      // Seed with current position so we can detect the first loop
      maxTimeReached = activeVideo.currentTime;
      activeVideo.addEventListener("ended", onEnded);
      activeVideo.addEventListener("timeupdate", onPlaybackProgress);
      activeVideo.addEventListener("seeked", onSeeked);
      activeVideo.addEventListener("pause", onPause);
      activeVideo.addEventListener("play", onPlay);
    }
  };

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    clearScheduledRebind();
    clearBackgroundPoll();
    clearEndFallback();
    clearVisibilityAdvance();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    observer?.disconnect();
    observer = null;
    detachActiveVideo();
    removePlayListener?.();
    removePlayListener = null;
  };

  const rebind = (): void => {
    if (stopped) {
      return;
    }

    // Sites rewrite the URL while hydrating, so a mismatch may be transient.
    // Detach instead of stopping; the content script stops the engine when
    // SPA navigation really leaves the feed.
    if (!adapter.matches(window.location)) {
      detachActiveVideo();
      return;
    }

    attachActiveItem(adapter.findActiveItem(document));
  };

  // Register visibility change listener for background handling
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (!mutationObserverCtor) {
    rebind();
    return {
      stop,
      rebind,
      isRunning: () => !stopped,
    };
  }

  const mutationObserver = new mutationObserverCtor(() => {
    scheduleRebind();
  });

  mutationObserver.observe(observationTarget, {
    childList: true,
    subtree: true,
  });
  observer = mutationObserver;

  // Rebind when any video starts playing — catches cases where the site
  // swaps the active video without mutating the DOM (e.g. TikTok scroll).
  const onDocumentPlay = (event: Event): void => {
    const VideoElement = document.defaultView?.HTMLVideoElement;
    if (VideoElement && event.target instanceof VideoElement) {
      scheduleRebind();
    }
  };
  document.addEventListener("play", onDocumentPlay, true);
  removePlayListener = () => document.removeEventListener("play", onDocumentPlay, true);

  rebind();

  return {
    stop,
    rebind,
    isRunning: () => !stopped,
  };
}
