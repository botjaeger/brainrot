import type { AdvanceOptions, FeedSiteAdapter } from "../core/feed-engine.js";
import {
  findClickableMatch,
  scrollDocumentForward,
} from "../shared/dom.js";

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

function findActiveReelVideo(document: Document): HTMLVideoElement | null {
  // Prefer a video that is actively playing
  for (const selector of FACEBOOK_REELS_VIDEO_SELECTORS) {
    for (const el of document.querySelectorAll<HTMLVideoElement>(selector)) {
      if (el.tagName.toLowerCase() === "video" && !el.paused && !el.ended) {
        return el;
      }
    }
  }

  // Fall back to first found
  for (const selector of FACEBOOK_REELS_VIDEO_SELECTORS) {
    const element = document.querySelector<HTMLVideoElement>(selector);
    if (element?.tagName.toLowerCase() === "video") {
      return element;
    }
  }

  return null;
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
      location.hostname.endsWith("facebook.com") &&
      isFacebookReelsPathname(location.pathname)
    );
  },
  findActiveVideo(document: Document): HTMLVideoElement | null {
    return findActiveReelVideo(document);
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
    _options?: AdvanceOptions,
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

    // Fallback: if the next reel video is already in the DOM (Facebook
    // pre-loads them), scroll it into view directly. Otherwise fall back to
    // generic document-forward scroll.
    const allVideos = Array.from(
      document.querySelectorAll<HTMLVideoElement>("video"),
    );
    const currentIndex = allVideos.indexOf(currentVideo);
    if (currentIndex >= 0 && currentIndex + 1 < allVideos.length) {
      const nextVideo = allVideos[currentIndex + 1];
      nextVideo.scrollIntoView({ behavior: "smooth", block: "center" });
      return { method: "next-video-scroll" };
    }

    scrollDocumentForward(document, currentVideo);
    return {
      method: "scroll-forward",
    };
  },
};
