import type { ActiveFeedItem, FeedSiteAdapter } from "../core/feed-engine.js";
import { collectFeedItems, findActiveFeedVideo, scrollDocumentForward } from "../shared/dom.js";
import { isReelsPathname, matchesSiteHostname } from "../shared/site-host.js";

const INSTAGRAM_VIDEO_SELECTORS = [
  "article video",
  "div[role='dialog'] video",
  "video[playsinline]",
  "video",
];

export const isInstagramReelsPathname = isReelsPathname;

function getInstagramReelItem(video: HTMLVideoElement): Element {
  return video.closest("article, div[role='dialog']") ?? video;
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
    const video = findActiveFeedVideo(document, INSTAGRAM_VIDEO_SELECTORS);
    return video ? { video, key: getInstagramReelItem(video) } : null;
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    const items = collectFeedItems(document, getInstagramReelItem);
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
