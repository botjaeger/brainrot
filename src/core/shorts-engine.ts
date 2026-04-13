import {
  findActiveShortsVideo,
  findNextShortsContainer,
  isShortsPathname,
  scrollShortsContainerIntoView,
} from "../shared/dom.js";

export interface ShortsEngineEnvironment {
  document: Document;
  window: Window;
}

export interface ShortsEngineController {
  stop(): void;
  rebind(): void;
}

const noopController: ShortsEngineController = {
  stop() {
    // Intentionally empty.
  },
  rebind() {
    // Intentionally empty.
  },
};

export function startShortsEngine({
  document,
  window,
}: ShortsEngineEnvironment): ShortsEngineController {
  if (!isShortsPathname(window.location.pathname)) {
    return noopController;
  }

  const observationTarget = document.body ?? document.documentElement;

  if (!observationTarget) {
    return noopController;
  }

  let activeVideo: HTMLVideoElement | null = null;
  let observer: MutationObserver | null = null;
  let stopped = false;

  const onEnded = (): void => {
    if (!activeVideo) {
      return;
    }

    const nextContainer = findNextShortsContainer(document, activeVideo);

    if (!nextContainer) {
      return;
    }

    scrollShortsContainerIntoView(nextContainer);
  };

  const detachActiveVideo = (): void => {
    if (!activeVideo) {
      return;
    }

    activeVideo.removeEventListener("ended", onEnded);
    activeVideo = null;
  };

  const attachActiveVideo = (video: HTMLVideoElement | null): void => {
    if (video === activeVideo) {
      return;
    }

    detachActiveVideo();

    activeVideo = video;

    if (activeVideo) {
      activeVideo.addEventListener("ended", onEnded);
    }
  };

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    observer?.disconnect();
    observer = null;
    detachActiveVideo();
  };

  const rebind = (): void => {
    if (stopped) {
      return;
    }

    if (!isShortsPathname(window.location.pathname)) {
      stop();
      return;
    }

    attachActiveVideo(findActiveShortsVideo(document));
  };

  observer = new window.MutationObserver(() => {
    rebind();
  });

  observer.observe(observationTarget, {
    childList: true,
    subtree: true,
  });

  rebind();

  return {
    stop,
    rebind,
  };
}
