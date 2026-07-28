import type {
  ActiveFeedItem,
  FeedSiteAdapter,
} from "../core/feed-engine.js";
import {
  getViewportOverlapRatio,
  scrollDocumentForward,
} from "../shared/dom.js";
import { matchesSiteHostname } from "../shared/site-host.js";

const INSTAGRAM_VIDEO_SELECTORS = [
  "article video",
  "div[role='dialog'] video",
  "video[playsinline]",
  "video",
];

export function isInstagramReelsPathname(pathname: string): boolean {
  return (
    pathname === "/reels" ||
    pathname.startsWith("/reels/") ||
    pathname === "/reel" ||
    pathname.startsWith("/reel/")
  );
}

function findActiveInstagramVideo(document: Document): HTMLVideoElement | null {
  const candidates: HTMLVideoElement[] = [];
  const seen = new Set<HTMLVideoElement>();

  for (const selector of INSTAGRAM_VIDEO_SELECTORS) {
    for (const video of document.querySelectorAll<HTMLVideoElement>(selector)) {
      if (!seen.has(video)) {
        seen.add(video);
        candidates.push(video);
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

function getInstagramReelItem(video: HTMLVideoElement): Element {
  return video.closest("article, div[role='dialog']") ?? video;
}

function getInstagramReelItems(document: Document): Element[] {
  const items: Element[] = [];
  const seen = new Set<Element>();

  for (const video of document.querySelectorAll<HTMLVideoElement>("video")) {
    const item = getInstagramReelItem(video);
    if (!seen.has(item)) {
      seen.add(item);
      items.push(item);
    }
  }

  return items;
}

export const instagramReelsSiteAdapter: FeedSiteAdapter = {
  name: "Instagram Reels",
  siteKey: "instagram-reels",
  nativeTransitionGraceMs: 100,
  matches(location: Location): boolean {
    return (
      matchesSiteHostname(location.hostname, "instagram.com") &&
      isInstagramReelsPathname(location.pathname)
    );
  },
  findActiveItem(document: Document): ActiveFeedItem | null {
    const video = findActiveInstagramVideo(document);
    return video ? { video, key: getInstagramReelItem(video) } : null;
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    const items = getInstagramReelItems(document);
    const currentIndex = items.indexOf(getInstagramReelItem(currentVideo));
    const nextItem = currentIndex >= 0 ? items[currentIndex + 1] : null;

    if (nextItem && typeof nextItem.scrollIntoView === "function") {
      nextItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      return { method: "next-reel-scroll" };
    }

    scrollDocumentForward(document, currentVideo);
    return { method: "document-scroll" };
  },
};
