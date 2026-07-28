import type {
  ActiveFeedItem,
  FeedSiteAdapter,
} from "../core/feed-engine.js";
import {
  findClickableMatch,
  getViewportOverlapRatio,
  scrollDocumentForward,
} from "../shared/dom.js";
import { matchesSiteHostname } from "../shared/site-host.js";

const FACEBOOK_REELS_VIDEO_SELECTORS = [
  "[data-pagelet*='Reels'] video",
  "[aria-label*='Reels' i] video",
  "[role='main'] video",
  "main video",
  "video",
];

const FACEBOOK_REELS_SCOPE_SELECTORS = [
  "[data-pagelet*='Reels']",
  "[aria-label*='Reels' i]",
  "[role='main']",
  "main",
];

const FACEBOOK_REELS_NEXT_BUTTON_SELECTORS = [
  "[data-pagelet*='Reels'] [aria-label*='Next' i]",
  "[data-pagelet*='Reels'] [role='button'][aria-label*='Next' i]",
  "[aria-label='Next reel']",
  "[aria-label='Next video']",
  "[aria-label*='Next reel' i]",
  "[aria-label*='Next video' i]",
  "[aria-label*='next' i][role='button']",
  "button[aria-label*='Next' i]",
  "[role='button'][aria-label*='Next' i]",
];

function isClickableElementActive(element: HTMLElement): boolean {
  const maybeDisabled = element as HTMLButtonElement & {
    disabled?: boolean;
  };

  return maybeDisabled.disabled !== true && element.getAttribute("aria-disabled") !== "true";
}

function getFacebookReelItem(video: HTMLVideoElement): Element {
  return (
    video.closest(
      "[data-pagelet*='ReelUnit'], article, [aria-label*='Reel' i], [role='dialog']",
    ) ?? video
  );
}

function findActiveReelVideo(document: Document): HTMLVideoElement | null {
  const candidates: HTMLVideoElement[] = [];
  const seen = new Set<HTMLVideoElement>();

  for (const selector of FACEBOOK_REELS_VIDEO_SELECTORS) {
    for (const el of document.querySelectorAll<HTMLVideoElement>(selector)) {
      if (el.tagName.toLowerCase() === "video" && !seen.has(el)) {
        seen.add(el);
        candidates.push(el);
      }
    }
  }

  return (
    candidates.find(
      (video) =>
        !video.paused &&
        !video.ended &&
        getViewportOverlapRatio(video) >= 0.5,
    ) ??
    candidates.find((video) => !video.paused && !video.ended) ??
    candidates.find((video) => getViewportOverlapRatio(video) >= 0.5) ??
    candidates[0] ??
    null
  );
}

function getFacebookReelItems(document: Document): Element[] {
  const items: Element[] = [];
  const seen = new Set<Element>();

  for (const video of document.querySelectorAll<HTMLVideoElement>("video")) {
    const item = getFacebookReelItem(video);
    if (!seen.has(item)) {
      seen.add(item);
      items.push(item);
    }
  }

  return items;
}

export function isFacebookReelsPathname(pathname: string): boolean {
  return (
    pathname === "/reels" ||
    pathname.startsWith("/reels/") ||
    pathname === "/reel" ||
    pathname.startsWith("/reel/")
  );
}

export const facebookReelsSiteAdapter: FeedSiteAdapter = {
  name: "Facebook Reels",
  siteKey: "facebook-reels",
  matches(location: Location): boolean {
    return (
      matchesSiteHostname(location.hostname, "facebook.com") &&
      isFacebookReelsPathname(location.pathname)
    );
  },
  findActiveItem(document: Document): ActiveFeedItem | null {
    const video = findActiveReelVideo(document);
    return video ? { video, key: getFacebookReelItem(video) } : null;
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    const nextButton = findClickableMatch(
      document,
      FACEBOOK_REELS_NEXT_BUTTON_SELECTORS,
      {
        scopeSelectors: FACEBOOK_REELS_SCOPE_SELECTORS,
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

    const items = getFacebookReelItems(document);
    const currentIndex = items.indexOf(getFacebookReelItem(currentVideo));
    const nextItem = currentIndex >= 0 ? items[currentIndex + 1] : null;
    if (nextItem && typeof nextItem.scrollIntoView === "function") {
      nextItem.scrollIntoView({ behavior: "smooth", block: "center" });
      return { method: "next-reel-scroll" };
    }

    scrollDocumentForward(document, currentVideo);
    return {
      method: "scroll-forward",
    };
  },
};
