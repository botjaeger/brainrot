export function getSiteKey(location: { hostname: string; pathname: string }): string | null {
  const { hostname, pathname } = location;
  if (hostname.endsWith("youtube.com") && (pathname === "/shorts" || pathname.startsWith("/shorts/"))) return "youtube-shorts";
  if (hostname.endsWith("facebook.com") && (pathname.startsWith("/reels") || pathname.startsWith("/reel"))) return "facebook-reels";
  if (hostname.endsWith("tiktok.com")) return "tiktok";
  if (hostname.endsWith("instagram.com") && (pathname.startsWith("/reels") || pathname.startsWith("/reel"))) return "instagram-reels";
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
