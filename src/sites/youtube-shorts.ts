import type { ActiveFeedItem, FeedSiteAdapter } from "../core/feed-engine.js";
import { advanceShortsPlayback, findActiveShortsVideo, isShortsPathname } from "../shared/dom.js";
import { matchesSiteHostname } from "../shared/site-host.js";

export function isYouTubeShortsPathname(pathname: string): boolean {
  return isShortsPathname(pathname);
}

export const youtubeShortsSiteAdapter: FeedSiteAdapter = {
  name: "YouTube Shorts",
  siteKey: "youtube-shorts",
  matches(location: Location): boolean {
    return (
      matchesSiteHostname(location.hostname, "youtube.com") &&
      isYouTubeShortsPathname(location.pathname)
    );
  },
  findActiveItem(document: Document): ActiveFeedItem | null {
    const video = findActiveShortsVideo(document);
    if (!video) return null;

    return {
      video,
      key: video.closest("ytd-reel-video-renderer") ?? video,
    };
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    return advanceShortsPlayback(document, currentVideo);
  },
};
