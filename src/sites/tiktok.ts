import type { ActiveFeedItem, FeedSiteAdapter } from "../core/feed-engine.js";
import {
  collectFeedItems,
  findActiveFeedVideo,
  findClickableMatch,
  isClickableElementActive,
  scrollDocumentForward,
} from "../shared/dom.js";
import { matchesSiteHostname } from "../shared/site-host.js";

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

const TIKTOK_ITEM_SELECTORS = [
  "[data-e2e='recommend-list-item-container']",
  "[data-e2e='feed-item-container']",
  ".swiper-slide.swiper-slide-active",
  ".swiper-slide-active",
  ".swiper-slide",
  "[data-e2e='feed-video']",
  "[data-e2e='feed-active-video']",
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
  // Feed's down arrow beside the player (checked live 2026-10-12); disabled at the end.
  "button[data-e2e='feed-navigation-next']",
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
    (normalizedPathname.startsWith("/@") && normalizedPathname.includes("/video/"))
  );
}

function getTikTokItem(video: HTMLVideoElement): Element {
  for (const selector of TIKTOK_ITEM_SELECTORS) {
    const item = video.closest(selector);
    if (item) return item;
  }

  return video;
}

function findNextTikTokContainer(
  document: Document,
  currentVideo: HTMLVideoElement,
): Element | null {
  const items = collectFeedItems(document, getTikTokItem);
  const currentIndex = items.indexOf(getTikTokItem(currentVideo));
  return currentIndex >= 0 ? (items[currentIndex + 1] ?? null) : null;
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
      matchesSiteHostname(location.hostname, "tiktok.com") && isTikTokPathname(location.pathname)
    );
  },
  findActiveItem(document: Document): ActiveFeedItem | null {
    const video = findActiveFeedVideo(document, TIKTOK_VIDEO_SELECTORS);
    return video ? { video, key: getTikTokItem(video) } : null;
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    const nextButton = findClickableMatch(document, TIKTOK_NEXT_BUTTON_SELECTORS, {
      scopeSelectors: TIKTOK_BUTTON_SCOPE_SELECTORS,
      isAllowed: isClickableElementActive,
    });

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
