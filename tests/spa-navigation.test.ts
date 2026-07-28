import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteKey, watchSpaNavigation } from "../src/content/site-key.js";

describe("getSiteKey", () => {
  const loc = (hostname: string, pathname: string) => ({ hostname, pathname });

  it("returns youtube-shorts for Shorts URLs", () => {
    expect(getSiteKey(loc("www.youtube.com", "/shorts"))).toBe("youtube-shorts");
    expect(getSiteKey(loc("www.youtube.com", "/shorts/abc123"))).toBe("youtube-shorts");
  });

  it("returns facebook-reels for Facebook Reels URLs", () => {
    expect(getSiteKey(loc("www.facebook.com", "/reels"))).toBe("facebook-reels");
    expect(getSiteKey(loc("www.facebook.com", "/reels/123"))).toBe("facebook-reels");
    expect(getSiteKey(loc("www.facebook.com", "/reel/456"))).toBe("facebook-reels");
  });

  it("returns tiktok only for supported TikTok feed URLs", () => {
    expect(getSiteKey(loc("www.tiktok.com", "/"))).toBe("tiktok");
    expect(getSiteKey(loc("www.tiktok.com", "/@user/video/123"))).toBe("tiktok");
    expect(getSiteKey(loc("www.tiktok.com", "/foryou"))).toBe("tiktok");
    expect(getSiteKey(loc("www.tiktok.com", "/search"))).toBeNull();
    expect(getSiteKey(loc("www.tiktok.com", "/@user"))).toBeNull();
  });

  it("returns instagram-reels for Instagram Reels URLs", () => {
    expect(getSiteKey(loc("www.instagram.com", "/reels"))).toBe("instagram-reels");
    expect(getSiteKey(loc("www.instagram.com", "/reels/abc"))).toBe("instagram-reels");
    expect(getSiteKey(loc("www.instagram.com", "/reel/abc"))).toBe("instagram-reels");
  });

  it("returns null for non-feed pages", () => {
    expect(getSiteKey(loc("www.youtube.com", "/watch"))).toBeNull();
    expect(getSiteKey(loc("www.youtube.com", "/"))).toBeNull();
    expect(getSiteKey(loc("www.facebook.com", "/profile.php"))).toBeNull();
    expect(getSiteKey(loc("www.instagram.com", "/p/abc"))).toBeNull();
    expect(getSiteKey(loc("www.facebook.com", "/reelsettings"))).toBeNull();
    expect(getSiteKey(loc("www.instagram.com", "/reelsarchive"))).toBeNull();
    expect(getSiteKey(loc("evilyoutube.com", "/shorts/abc"))).toBeNull();
    expect(getSiteKey(loc("www.example.com", "/shorts/abc"))).toBeNull();
  });
});

describe("watchSpaNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createLocation(hostname: string, pathname: string) {
    const loc = { hostname, pathname };
    return {
      current: loc,
      navigate(h: string, p: string) {
        loc.hostname = h;
        loc.pathname = p;
      },
    };
  }

  it("calls onSiteKeyChange when navigating from feed to non-feed", () => {
    const loc = createLocation("www.youtube.com", "/shorts/abc");
    const onChange = vi.fn();
    const abort = new AbortController();

    watchSpaNavigation(() => loc.current, onChange, abort.signal);

    loc.navigate("www.youtube.com", "/watch");
    vi.advanceTimersByTime(1000);

    expect(onChange).toHaveBeenCalledTimes(1);
    abort.abort();
  });

  it("calls onSiteKeyChange when navigating back to feed", () => {
    const loc = createLocation("www.youtube.com", "/shorts/abc");
    const onChange = vi.fn();
    const abort = new AbortController();

    watchSpaNavigation(() => loc.current, onChange, abort.signal);

    // Leave feed
    loc.navigate("www.youtube.com", "/watch");
    vi.advanceTimersByTime(1000);

    // Return to feed
    loc.navigate("www.youtube.com", "/shorts/def");
    vi.advanceTimersByTime(1000);

    expect(onChange).toHaveBeenCalledTimes(2);
    abort.abort();
  });

  it("does not fire for within-feed URL changes (same site key)", () => {
    const loc = createLocation("www.youtube.com", "/shorts/abc");
    const onChange = vi.fn();
    const abort = new AbortController();

    watchSpaNavigation(() => loc.current, onChange, abort.signal);

    loc.navigate("www.youtube.com", "/shorts/def");
    vi.advanceTimersByTime(1000);

    loc.navigate("www.youtube.com", "/shorts/ghi");
    vi.advanceTimersByTime(1000);

    expect(onChange).not.toHaveBeenCalled();
    abort.abort();
  });

  it("stops polling when abort signal fires", () => {
    const loc = createLocation("www.youtube.com", "/shorts/abc");
    const onChange = vi.fn();
    const abort = new AbortController();

    watchSpaNavigation(() => loc.current, onChange, abort.signal);
    abort.abort();

    loc.navigate("www.youtube.com", "/watch");
    vi.advanceTimersByTime(1000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("works across all supported sites", () => {
    const sites: Array<{ feed: [string, string]; nonFeed: [string, string] }> = [
      { feed: ["www.youtube.com", "/shorts/a"], nonFeed: ["www.youtube.com", "/watch"] },
      { feed: ["www.facebook.com", "/reels/1"], nonFeed: ["www.facebook.com", "/profile"] },
      { feed: ["www.instagram.com", "/reels/a"], nonFeed: ["www.instagram.com", "/p/a"] },
    ];

    for (const { feed, nonFeed } of sites) {
      const loc = createLocation(feed[0], feed[1]);
      const onChange = vi.fn();
      const abort = new AbortController();

      watchSpaNavigation(() => loc.current, onChange, abort.signal);

      // Leave feed
      loc.navigate(nonFeed[0], nonFeed[1]);
      vi.advanceTimersByTime(1000);

      // Return to feed
      loc.navigate(feed[0], feed[1]);
      vi.advanceTimersByTime(1000);

      expect(onChange).toHaveBeenCalledTimes(2);
      abort.abort();
    }
  });
});
