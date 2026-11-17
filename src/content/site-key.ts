import { matchesSiteHostname } from "../shared/site-host.js";
import { isFacebookReelsPathname } from "../sites/facebook-reels.js";
import { isInstagramReelsPathname } from "../sites/instagram-reels.js";
import { isTikTokPathname } from "../sites/tiktok.js";
import { isYouTubeShortsPathname } from "../sites/youtube-shorts.js";

export function getSiteKey(location: { hostname: string; pathname: string }): string | null {
  const { hostname, pathname } = location;

  if (matchesSiteHostname(hostname, "youtube.com") && isYouTubeShortsPathname(pathname)) {
    return "youtube-shorts";
  }

  if (matchesSiteHostname(hostname, "facebook.com") && isFacebookReelsPathname(pathname)) {
    return "facebook-reels";
  }

  if (matchesSiteHostname(hostname, "tiktok.com") && isTikTokPathname(pathname)) {
    return "tiktok";
  }

  if (matchesSiteHostname(hostname, "instagram.com") && isInstagramReelsPathname(pathname)) {
    return "instagram-reels";
  }

  return null;
}

export function watchSpaNavigation(
  getLocation: () => { hostname: string; pathname: string },
  onSiteKeyChange: () => void,
  signal: AbortSignal,
): void {
  let lastNavSiteKey = getSiteKey(getLocation());
  const navPollInterval = setInterval(() => {
    const currentSiteKey = getSiteKey(getLocation());
    if (currentSiteKey === lastNavSiteKey) return;
    lastNavSiteKey = currentSiteKey;
    onSiteKeyChange();
  }, 1000);
  signal.addEventListener("abort", () => {
    clearInterval(navPollInterval);
  });
}
