import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { facebookReelsSiteAdapter, isFacebookReelsPathname } from "../src/sites/facebook-reels.js";
import { instagramReelsSiteAdapter } from "../src/sites/instagram-reels.js";
import { isTikTokPathname, tiktokSiteAdapter } from "../src/sites/tiktok.js";

function loadFixture(name: string, url: string) {
  const html = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

  return new JSDOM(html, {
    pretendToBeVisual: true,
    url,
  });
}

function getVideoById(document: Document, id: string): HTMLVideoElement {
  const video = document.querySelector<HTMLVideoElement>(id);

  if (!video) {
    throw new Error(`Missing fixture element: ${id}`);
  }

  return video;
}

function getButtonById(document: Document, id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(id);

  if (!button) {
    throw new Error(`Missing fixture element: ${id}`);
  }

  return button;
}

function getElementById<T extends Element>(document: Document, id: string): T {
  const element = document.querySelector<T>(id);

  if (!element) {
    throw new Error(`Missing fixture element: ${id}`);
  }

  return element;
}

function mockScrollIntoView(element: Element) {
  const scrollIntoView = vi.fn();

  Object.defineProperty(element, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  return scrollIntoView;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("facebookReelsSiteAdapter", () => {
  it("matches explicit reels routes and ignores unsupported routes", () => {
    const reelsDom = loadFixture(
      "facebook-reels.fixture.html",
      "https://www.facebook.com/reels/123",
    );
    const reelsRootDom = loadFixture(
      "facebook-reels.fixture.html",
      "https://www.facebook.com/reels",
    );
    const reelDom = loadFixture("facebook-reels.fixture.html", "https://www.facebook.com/reel/123");
    const reelRootDom = loadFixture("facebook-reels.fixture.html", "https://www.facebook.com/reel");
    const unsupportedDom = loadFixture(
      "facebook-reels.fixture.html",
      "https://www.facebook.com/watch?v=123",
    );
    const lookalikeHostDom = loadFixture(
      "facebook-reels.fixture.html",
      "https://evilfacebook.com/reels/123",
    );

    expect(isFacebookReelsPathname(reelsDom.window.location.pathname)).toBe(true);
    expect(isFacebookReelsPathname(reelsRootDom.window.location.pathname)).toBe(true);
    expect(isFacebookReelsPathname(reelDom.window.location.pathname)).toBe(true);
    expect(isFacebookReelsPathname(reelRootDom.window.location.pathname)).toBe(true);
    expect(facebookReelsSiteAdapter.matches(reelsDom.window.location)).toBe(true);
    expect(facebookReelsSiteAdapter.matches(reelsRootDom.window.location)).toBe(true);
    expect(facebookReelsSiteAdapter.matches(reelDom.window.location)).toBe(true);
    expect(facebookReelsSiteAdapter.matches(reelRootDom.window.location)).toBe(true);
    expect(facebookReelsSiteAdapter.matches(unsupportedDom.window.location)).toBe(false);
    expect(facebookReelsSiteAdapter.matches(lookalikeHostDom.window.location)).toBe(false);
  });

  it("clicks the next reel control and falls back to scroll when button is absent", async () => {
    vi.useFakeTimers();

    const dom = loadFixture("facebook-reels.fixture.html", "https://www.facebook.com/reels/123");
    const { document } = dom.window;
    const video = getVideoById(document, "#facebook-reel-video");
    const button = getButtonById(document, "#facebook-next-reel");
    const nextItem = getElementById<HTMLElement>(document, "#facebook-next-reel-item");
    const onClick = vi.fn();
    const scrollIntoView = mockScrollIntoView(nextItem);

    button.addEventListener("click", onClick);

    const clickedResult = facebookReelsSiteAdapter.advancePlayback(document, video);

    expect(clickedResult.method).toBe("next-button");
    expect(onClick).toHaveBeenCalledTimes(1);

    button.remove();

    const scrollResult = facebookReelsSiteAdapter.advancePlayback(document, video);

    expect(scrollResult.method).toBe("next-reel-scroll");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("clicks the feed's own Next Card arrow past an unrelated Next control", () => {
    const dom = loadFixture(
      "facebook-reels-live.fixture.html",
      "https://www.facebook.com/reel/123",
    );
    const { document } = dom.window;
    const video = getVideoById(document, "#facebook-live-video");
    const nextCard = getElementById<HTMLElement>(document, "#facebook-next-card");
    const nextItems = getElementById<HTMLElement>(document, "#facebook-next-items");
    const nextCardClick = vi.fn();
    const nextItemsClick = vi.fn();
    nextCard.addEventListener("click", nextCardClick);
    nextItems.addEventListener("click", nextItemsClick);

    expect(facebookReelsSiteAdapter.advancePlayback(document, video)).toEqual({
      method: "next-button",
      selector: "[role='button'][aria-label='Next Card']",
    });
    expect(nextCardClick).toHaveBeenCalledTimes(1);
    expect(nextItemsClick).not.toHaveBeenCalled();
  });
});

describe("tiktokSiteAdapter", () => {
  it("matches desktop feed routes and ignores unsupported routes", () => {
    const feedDom = loadFixture("tiktok-feed.fixture.html", "https://www.tiktok.com/en/");
    const videoDom = loadFixture(
      "tiktok-feed.fixture.html",
      "https://www.tiktok.com/en/@creator/video/123",
    );
    const unsupportedDom = loadFixture(
      "tiktok-feed.fixture.html",
      "https://www.tiktok.com/en/about",
    );
    const lookalikeHostDom = loadFixture("tiktok-feed.fixture.html", "https://eviltiktok.com/en/");

    expect(isTikTokPathname(feedDom.window.location.pathname)).toBe(true);
    expect(isTikTokPathname(videoDom.window.location.pathname)).toBe(true);
    expect(tiktokSiteAdapter.matches(feedDom.window.location)).toBe(true);
    expect(tiktokSiteAdapter.matches(videoDom.window.location)).toBe(true);
    expect(tiktokSiteAdapter.matches(unsupportedDom.window.location)).toBe(false);
    expect(tiktokSiteAdapter.matches(lookalikeHostDom.window.location)).toBe(false);
  });

  it("clicks the feed's own next arrow, skipping it once disabled", () => {
    const dom = loadFixture("tiktok-feed.fixture.html", "https://www.tiktok.com/foryou");
    const { document } = dom.window;
    const video = getVideoById(document, "#tiktok-video");
    const feedNext = getButtonById(document, "#tiktok-feed-navigation-next");
    const xgplayerNext = getElementById<HTMLElement>(document, "#tiktok-xgplayer-next");
    const feedNextClick = vi.fn();
    const xgplayerClick = vi.fn();
    feedNext.addEventListener("click", feedNextClick);
    xgplayerNext.addEventListener("click", xgplayerClick);

    expect(tiktokSiteAdapter.advancePlayback(document, video)).toEqual({
      method: "next-button",
      selector: "button[data-e2e='feed-navigation-next']",
    });
    expect(feedNextClick).toHaveBeenCalledTimes(1);
    expect(xgplayerClick).not.toHaveBeenCalled();

    // End of the feed: TikTok disables the arrow.
    feedNext.disabled = true;
    tiktokSiteAdapter.advancePlayback(document, video);
    expect(feedNextClick).toHaveBeenCalledTimes(1);
    expect(xgplayerClick).toHaveBeenCalledTimes(1);
  });

  it("clicks the next video control and delays fallback scroll", async () => {
    const dom = loadFixture(
      "tiktok-feed.fixture.html",
      "https://www.tiktok.com/en/@creator/video/123",
    );
    const { document } = dom.window;
    document.querySelector("#tiktok-feed-navigation")?.remove();
    const activeVideo = tiktokSiteAdapter.findActiveItem(document)?.video;
    const video = getVideoById(document, "#tiktok-video");
    const nextContainer = getElementById<HTMLElement>(document, "#tiktok-next-container");
    const xgplayerNext = getElementById<HTMLElement>(document, "#tiktok-xgplayer-next");
    const button = getButtonById(document, "#tiktok-arrow-right");
    const xgplayerClick = vi.fn();
    const buttonClick = vi.fn();
    const scrollIntoView = mockScrollIntoView(nextContainer);

    xgplayerNext.addEventListener("click", xgplayerClick);
    button.addEventListener("click", buttonClick);

    expect(activeVideo).toBe(video);

    const clickedResult = tiktokSiteAdapter.advancePlayback(document, video);

    expect(clickedResult.method).toBe("next-button");
    expect(xgplayerClick).toHaveBeenCalledTimes(1);
    expect(buttonClick).toHaveBeenCalledTimes(0);

    xgplayerNext.remove();
    button.remove();

    const scrolledResult = tiktokSiteAdapter.advancePlayback(document, video);

    expect(scrolledResult.method).toBe("container-scroll");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });
});

describe("instagramReelsSiteAdapter", () => {
  it("targets the next reel item and ignores unrelated Next controls", () => {
    const dom = loadFixture("instagram-reels.fixture.html", "https://www.instagram.com/reels/123");
    const { document } = dom.window;
    const activeVideo = getVideoById(document, "#instagram-active-video");
    const nextItem = getElementById<HTMLElement>(document, "#instagram-next-item");
    const unrelatedNext = getButtonById(document, "#instagram-unrelated-next");
    const unrelatedClick = vi.fn();
    const scrollIntoView = mockScrollIntoView(nextItem);

    Object.defineProperty(activeVideo, "paused", {
      configurable: true,
      get: () => false,
    });
    unrelatedNext.addEventListener("click", unrelatedClick);

    const activeItem = instagramReelsSiteAdapter.findActiveItem(document);
    expect(activeItem?.video).toBe(activeVideo);
    expect(activeItem?.key).toBe(document.querySelector("#instagram-active-item"));

    const result = instagramReelsSiteAdapter.advancePlayback(document, activeVideo);

    expect(result.method).toBe("next-reel-scroll");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    expect(unrelatedClick).not.toHaveBeenCalled();
  });
});
