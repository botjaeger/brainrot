import type { FeedSiteAdapter } from "../core/feed-engine.js";
import {
  advanceShortsPlayback,
  findActiveShortsVideo,
  isShortsPathname,
} from "../shared/dom.js";

export function isYouTubeShortsPathname(pathname: string): boolean {
  return isShortsPathname(pathname);
}

export const youtubeShortsSiteAdapter: FeedSiteAdapter = {
  name: "YouTube Shorts",
  siteKey: "youtube-shorts",
  matches(location: Location): boolean {
    return isYouTubeShortsPathname(location.pathname);
  },
  findActiveVideo(document: Document): HTMLVideoElement | null {
    return findActiveShortsVideo(document);
  },
  advancePlayback(
    document: Document,
    currentVideo: HTMLVideoElement,
  ): { method: string; selector?: string } {
    return advanceShortsPlayback(document, currentVideo);
  },
};
