import type { AdvanceOptions, FeedSiteAdapter } from "../core/feed-engine.js";
import { scrollDocumentForward } from "../shared/dom.js";

const INSTAGRAM_VIDEO_SELECTORS = [
  "article video",
  "div[role='dialog'] video",
  "video[playsinline]",
  "video",
];

const INSTAGRAM_NEXT_BUTTON_SELECTORS = [
  "[aria-label='Next']",
  "button[aria-label*='Next' i]",
  "[role='button'][aria-label*='Next' i]",
];

function isInstagramReelsPathname(pathname: string): boolean {
  return (
    pathname === "/reels" ||
    pathname.startsWith("/reels/") ||
    pathname === "/reel" ||
    pathname.startsWith("/reel/")
  );
}

function findActiveInstagramVideo(document: Document): HTMLVideoElement | null {
  for (const selector of INSTAGRAM_VIDEO_SELECTORS) {
    for (const el of document.querySelectorAll<HTMLVideoElement>(selector)) {
      if (!el.paused && !el.ended) return el;
    }
  }
  for (const selector of INSTAGRAM_VIDEO_SELECTORS) {
    const el = document.querySelector<HTMLVideoElement>(selector);
    if (el) return el;
  }
  return null;
}

export const instagramReelsSiteAdapter: FeedSiteAdapter = {
  name: "Instagram Reels",
  siteKey: "instagram-reels",
  matches(location: Location): boolean {
    return (
      location.hostname.endsWith("instagram.com") &&
      isInstagramReelsPathname(location.pathname)
    );
  },
  findActiveVideo(document: Document): HTMLVideoElement | null {
    return findActiveInstagramVideo(document);
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
    _options?: AdvanceOptions,
  ): { method: string; selector?: string } {
    for (const selector of INSTAGRAM_NEXT_BUTTON_SELECTORS) {
      const btn = document.querySelector<HTMLElement>(selector);
      if (btn) {
        btn.click();
        return { method: "next-button", selector };
      }
    }
    scrollDocumentForward(document, currentVideo);
    return { method: "document-scroll" };
  },
};
