import type {
  ActiveFeedItem,
  FeedSiteAdapter,
} from "../core/feed-engine.js";
import {
  collectFeedItems,
  findActiveFeedVideo,
  findClickableMatch,
  isClickableElementActive,
  scrollDocumentForward,
} from "../shared/dom.js";
import { isReelsPathname, matchesSiteHostname } from "../shared/site-host.js";

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
  // Feed's down arrow beside the reel (checked live 2026-10-12). The broad
  // "next" selectors below first hit an unrelated "Next items" carousel.
  "[role='button'][aria-label='Next Card']",
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

function getFacebookReelItem(video: HTMLVideoElement): Element {
  return (
    video.closest(
      "[data-pagelet*='ReelUnit'], article, [aria-label*='Reel' i], [role='dialog']",
    ) ?? video
  );
}

export const isFacebookReelsPathname = isReelsPathname;

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
    const video = findActiveFeedVideo(document, FACEBOOK_REELS_VIDEO_SELECTORS);
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

    const items = collectFeedItems(document, getFacebookReelItem);
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
