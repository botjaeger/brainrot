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

  const advanceFeed = (trigger: "ended" | "timeupdate"): void => {
    if (!activeVideo || playbackAdvanced) {
      return;
    }

    playbackAdvanced = true;
    const result = adapter.advancePlayback(document, activeVideo);
    onAdvance?.(adapter.siteKey);

    log?.("advance", {
      site: adapter.name,
      trigger,
      method: result.method,
      selector: result.selector || null,
    });
  };

  const onEnded = (): void => {
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

  // Lock the video's loop property so the site's player can't re-enable it.
  // Store the original descriptor so we can restore it on detach.
  let loopDescriptor: PropertyDescriptor | undefined;
  let loopLockedVideo: HTMLVideoElement | null = null;

  const lockLoop = (video: HTMLVideoElement): void => {
    loopDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "loop",
    );
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
    activeVideo = null;
    playbackAdvanced = false;
    maxTimeReached = 0;
  };

  const attachActiveVideo = (video: HTMLVideoElement | null): void => {
    if (video === activeVideo) {
      if (activeVideo) {
        lockLoop(activeVideo);
      }

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
    }
  };

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    clearScheduledRebind();
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
