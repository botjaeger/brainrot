import { facebookReelsSiteAdapter } from "../sites/facebook-reels.js";
import { instagramReelsSiteAdapter } from "../sites/instagram-reels.js";
import { tiktokSiteAdapter } from "../sites/tiktok.js";
import { youtubeShortsSiteAdapter } from "../sites/youtube-shorts.js";

export interface FeedAdvanceResult {
  method: string;
  selector?: string;
}

export interface FeedSiteAdapter {
  name: string;
  siteKey: string;
  matches(location: Location): boolean;
  findActiveVideo(document: Document): HTMLVideoElement | null;
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): FeedAdvanceResult;
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
  let playbackAdvanced = false;
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

    return (
      Number.isFinite(duration) &&
      duration > 0 &&
      video.currentTime >= duration - 0.25
    );
  };

  const resetPlaybackAdvanceState = (): void => {
    if (!activeVideo) {
      return;
    }

    if (activeVideo.currentTime < 1) {
      playbackAdvanced = false;
    }
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
    if (!activeVideo || playbackAdvanced) {
      return;
    }

    // Never invoke DOM actions while hidden — they silently fail
    if (document.hidden) {
      return;
    }

    playbackAdvanced = true;
    let result: FeedAdvanceResult;
    try {
      result = adapter.advancePlayback(document, activeVideo);
    } catch (err) {
      playbackAdvanced = false; // allow retry on next trigger
      log?.("advance-error", { error: String(err) });
      return;
    }
    onAdvance?.(adapter.siteKey);

    log?.("advance", {
      site: adapter.name,
      trigger,
      method: result.method,
      selector: result.selector || null,
    });
  };

  const onEnded = (): void => {
    if (document.hidden) {
      videoEndedWhileHidden = true;
      log?.("ended-while-hidden: deferring to visibility-return");
      return;
    }
    advanceFeed("ended");
  };

  const onPlaybackProgress = (): void => {
    resetPlaybackAdvanceState();

    if (!activeVideo || playbackAdvanced || !isPlaybackNearEnd(activeVideo)) {
      return;
    }

    advanceFeed("timeupdate");
  };

  // Detect player-managed loops: the video seeks from near-end back to start
  // without firing "ended" (common in TikTok's xgplayer and YouTube Shorts).
  // Track the max time reached so a loop-seek doesn't erase our knowledge
  // that the video was near the end.
  let maxTimeReached = 0;
  const onSeeked = (): void => {
    if (!activeVideo || playbackAdvanced) return;
    const duration = activeVideo.duration;
    if (
      Number.isFinite(duration) && duration > 0 &&
      maxTimeReached >= duration - 0.25 &&
      activeVideo.currentTime < 1
    ) {
      advanceFeed("ended");
    }
  };

  const trackTime = (): void => {
    if (activeVideo && activeVideo.currentTime > maxTimeReached) {
      maxTimeReached = activeVideo.currentTime;
    }
  };

  // Pause handler: distinguish user-initiated pause (foreground) from site-driven
  // pause (while hidden). Only resume site-driven pauses.
  const onPause = (): void => {
    if (!activeVideo || playbackAdvanced) return;
    if (!document.hidden) {
      // Foreground pause = user-initiated
      userPaused = true;
      return;
    }
    // Hidden pause: only resume if user did not pause intentionally
    if (!userPaused && !activeVideo.ended) {
      log?.("pause-while-hidden: resuming");
      activeVideo.play().catch(() => { /* best effort */ });
    }
  };

  // Play handler: user resumed, reset userPaused flag
  const onPlay = (): void => {
    userPaused = false;
  };

  // Visibility change handler: snapshot state on hide, check for completion on return
  const onVisibilityChange = (): void => {
    if (stopped) return;

    if (document.hidden) {
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

      const shouldAdvance = videoEndedWhileHidden ||
        (activeVideo && wasPlayingBeforeHidden && (
          activeVideo.ended ||
          (lastKnownDuration > 0 && activeVideo.currentTime >= lastKnownDuration - 0.25) ||
          (lastKnownDuration > 0 && lastKnownTime >= lastKnownDuration - 0.25 && activeVideo.currentTime < 1) ||
          // Safari elapsed-time fallback: enough real time has passed for the video to
          // have finished. Only apply when remaining time was > 500 ms at hide time,
          // so a brief tab-switch near the end does not trigger a spurious advance.
          (hideTimestamp > 0 && lastKnownDuration > 0 && lastKnownTime > 0 &&
           remainingMs > 500 && elapsedMs >= remainingMs - 500)
        ));

      videoEndedWhileHidden = false;

      if (shouldAdvance) {
        // Defer one tick so document.hidden is reliably false when advanceFeed checks it
        setTimeout(() => {
          if (!stopped) advanceFeed("visibility-return");
        }, 0);
      } else if (activeVideo && wasPlayingBeforeHidden && activeVideo.paused && !activeVideo.ended && !userPaused) {
        activeVideo.play().catch(() => { /* best effort */ });
      }
    }
  };

  // Lock the video's loop property so the site's player can't re-enable it.
  // Store the original descriptor so we can restore it on detach.
  let loopDescriptor: PropertyDescriptor | undefined;
  let loopLockedVideo: HTMLVideoElement | null = null;

  const lockLoop = (video: HTMLVideoElement): void => {
    let proto: object | null = Object.getPrototypeOf(video);
    while (proto && !Object.getOwnPropertyDescriptor(proto, "loop")) {
      proto = Object.getPrototypeOf(proto);
    }
    loopDescriptor = proto
      ? Object.getOwnPropertyDescriptor(proto, "loop")
      : undefined;
    video.loop = false;
    video.removeAttribute("loop");
    Object.defineProperty(video, "loop", {
      get() { return false; },
      set() { /* blocked */ },
      configurable: true,
    });
    loopLockedVideo = video;
  };

  const unlockLoop = (): void => {
    if (loopLockedVideo && loopDescriptor) {
      Object.defineProperty(loopLockedVideo, "loop", loopDescriptor);
    }
    loopLockedVideo = null;
    loopDescriptor = undefined;
  };

  const detachActiveVideo = (): void => {
    if (!activeVideo) {
      return;
    }

    unlockLoop();
    activeVideo.removeEventListener("ended", onEnded);
    activeVideo.removeEventListener("timeupdate", onPlaybackProgress);
    activeVideo.removeEventListener("timeupdate", trackTime);
    activeVideo.removeEventListener("seeked", onSeeked);
    activeVideo.removeEventListener("pause", onPause);
    activeVideo.removeEventListener("play", onPlay);
    activeVideo = null;
    playbackAdvanced = false;
    maxTimeReached = 0;
    userPaused = false;
  };

  const attachActiveVideo = (video: HTMLVideoElement | null): void => {
    if (video === activeVideo) {
      // Already tracking this video — nothing to do.
      return;
    }

    detachActiveVideo();

    activeVideo = video;
    playbackAdvanced = false;

    if (activeVideo) {
      lockLoop(activeVideo);
      // Seed with current position so we can detect the first loop
      maxTimeReached = activeVideo.currentTime;
      activeVideo.addEventListener("ended", onEnded);
      activeVideo.addEventListener("timeupdate", onPlaybackProgress);
      activeVideo.addEventListener("timeupdate", trackTime);
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

    if (!adapter.matches(window.location)) {
      stop();
      return;
    }

    attachActiveVideo(adapter.findActiveVideo(document));
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
    if (event.target instanceof HTMLVideoElement) {
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
