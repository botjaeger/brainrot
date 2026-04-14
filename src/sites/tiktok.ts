import type { FeedSiteAdapter } from "../core/feed-engine.js";
import {
  findClickableMatch,
  scrollDocumentForward,
} from "../shared/dom.js";

const TIKTOK_LOCALE_PREFIX = /^\/[a-z]{2}(?:[-_][a-zA-Z0-9]{2,8})?(?=\/|$)/;

const TIKTOK_VIDEO_SELECTORS = [
  "[data-e2e='feed-active-video'] video",
  "[data-e2e='recommend-list-item-container'] video",
  "[data-e2e='feed-video'] video",
  ".swiper-slide.swiper-slide-active video",
  ".swiper-slide-active video",
  "[data-e2e='recommend-list'] video",
  "[data-e2e='feed-item-container'] video",
  "main video",
  "video",
];

const TIKTOK_CONTAINER_SELECTORS = [
  "[data-e2e='feed-active-video']",
  "[data-e2e='recommend-list-item-container']",
  "[data-e2e='feed-video']",
  ".swiper-slide.swiper-slide-active",
  ".swiper-slide-active",
  "[data-e2e='recommend-list']",
  "[data-e2e='feed-item-container']",
];

const TIKTOK_BUTTON_SCOPE_SELECTORS = [
  "[data-e2e='feed-active-video']",
  "[data-e2e='recommend-list-item-container']",
  "[data-e2e='feed-video']",
  "div.swiper-slide.swiper-slide-active",
  "div.swiper-slide-active",
  "[data-e2e='recommend-list']",
  "[data-e2e='feed-item-container']",
  "main",
];

const TIKTOK_NEXT_BUTTON_SELECTORS = [
  "[data-e2e='feed-active-video'] .xgplayer-playswitch .xgplayer-playswitch-next",
  "[data-e2e='feed-active-video'] .xgplayer-playswitch-next",
  "[data-e2e='feed-active-video'] [data-e2e='xgplayer-next']",
  ".swiper-slide.swiper-slide-active .xgplayer-playswitch .xgplayer-playswitch-next",
  ".swiper-slide.swiper-slide-active .xgplayer-playswitch-next",
  ".swiper-slide.swiper-slide-active [data-e2e='xgplayer-next']",
  "button[data-e2e='arrow-right']",
  "[data-e2e='arrow-right'] button",
  "[role='button'][data-e2e='arrow-right']",
  "[data-e2e='arrow-right']",
  "button[data-e2e='arrow-down']",
  "[data-e2e='arrow-down'] button",
  "[role='button'][data-e2e='arrow-down']",
  "[data-e2e='arrow-down']",
  "[aria-label*='Next video' i]",
  "[aria-label*='Next' i]",
  "[aria-label*='next' i]",
];

function isClickableElementActive(element: HTMLElement): boolean {
  const maybeDisabled = element as HTMLButtonElement & {
    disabled?: boolean;
  };

  return maybeDisabled.disabled !== true && element.getAttribute("aria-disabled") !== "true";
}

function normalizeTikTokPathname(pathname: string): string {
  const normalized = pathname.replace(TIKTOK_LOCALE_PREFIX, "");

  return normalized.length > 0 ? normalized : "/";
}

export function isTikTokPathname(pathname: string): boolean {
  const normalizedPathname = normalizeTikTokPathname(pathname);

  return (
    normalizedPathname === "/" ||
    normalizedPathname === "/foryou" ||
    normalizedPathname.startsWith("/foryou/") ||
    normalizedPathname === "/following" ||
    normalizedPathname.startsWith("/following/") ||
    (normalizedPathname.startsWith("/@") &&
      normalizedPathname.includes("/video/"))
  );
}

function findActiveTikTokVideo(document: Document): HTMLVideoElement | null {
  // Prefer the currently playing video — querySelector returns DOM order (first),
  // which is wrong when the user has scrolled past earlier videos.
  for (const selector of TIKTOK_VIDEO_SELECTORS) {
    for (const el of document.querySelectorAll<HTMLVideoElement>(selector)) {
      if (el.tagName.toLowerCase() === "video" && !el.paused && !el.ended) {
        return el;
      }
    }
  }

  // Fall back to first found
  for (const selector of TIKTOK_VIDEO_SELECTORS) {
    const element = document.querySelector<HTMLVideoElement>(selector);
    if (element?.tagName.toLowerCase() === "video") {
      return element;
    }
  }

  return null;
}

function getTikTokContainers(document: Document): Element[] {
  const containers: Element[] = [];
  const seen = new Set<Element>();

  for (const selector of TIKTOK_CONTAINER_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (seen.has(element)) {
        continue;
      }

      seen.add(element);
      containers.push(element);
    }
  }

  return containers;
}

function findNextTikTokContainer(
  document: Document,
  currentVideo: HTMLVideoElement,
): Element | null {
  const containers = getTikTokContainers(document);
  const currentContainer = currentVideo.closest(
    TIKTOK_CONTAINER_SELECTORS.join(", "),
  );

  if (currentContainer) {
    const currentIndex = containers.indexOf(currentContainer);

    if (currentIndex >= 0) {
      return containers[currentIndex + 1] ?? null;
    }
  }

  return containers[1] ?? null;
}

function scrollTikTokFeedForward(
  document: Document,
  currentVideo: HTMLVideoElement,
): { method: string } {
  const nextContainer = findNextTikTokContainer(document, currentVideo);

  if (nextContainer && typeof nextContainer.scrollIntoView === "function") {
    nextContainer.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    return {
      method: "container-scroll",
    };
  }

  scrollDocumentForward(document, currentVideo);
  return {
    method: "document-scroll",
  };
}

export const tiktokSiteAdapter: FeedSiteAdapter = {
  name: "TikTok",
  siteKey: "tiktok",
  matches(location: Location): boolean {
    return (
      location.hostname.endsWith("tiktok.com") &&
      isTikTokPathname(location.pathname)
    );
  },
  findActiveVideo(document: Document): HTMLVideoElement | null {
    return findActiveTikTokVideo(document);
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    const nextButton = findClickableMatch(
      document,
      TIKTOK_NEXT_BUTTON_SELECTORS,
      {
        scopeSelectors: TIKTOK_BUTTON_SCOPE_SELECTORS,
        isAllowed: isClickableElementActive,
      },
    );

    if (nextButton) {
      nextButton.element.click();
      return {
        method: "next-button",
        selector: nextButton.selector,
      };
    }

    return scrollTikTokFeedForward(document, currentVideo);
  },
};
