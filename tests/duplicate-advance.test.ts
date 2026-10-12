import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  startFeedEngine,
  type FeedSiteAdapter,
} from "../src/core/feed-engine.js";
import { facebookReelsSiteAdapter } from "../src/sites/facebook-reels.js";
import { instagramReelsSiteAdapter } from "../src/sites/instagram-reels.js";
import { tiktokSiteAdapter } from "../src/sites/tiktok.js";
import { youtubeShortsSiteAdapter } from "../src/sites/youtube-shorts.js";

interface DuplicateCase {
  name: string;
  fixture: string;
  url: string;
  adapter: FeedSiteAdapter;
  activeVideoSelector: string;
  prepareAdvanceSpy(document: Document): ReturnType<typeof vi.fn>;
}

function loadFixture(testCase: DuplicateCase): JSDOM {
  const html = readFileSync(
    new URL(`./fixtures/${testCase.fixture}`, import.meta.url),
    "utf8",
  );
  return new JSDOM(html, {
    pretendToBeVisual: true,
    url: testCase.url,
  });
}

function mockScrollIntoView(element: Element): ReturnType<typeof vi.fn> {
  const spy = vi.fn();
  Object.defineProperty(element, "scrollIntoView", {
    configurable: true,
    value: spy,
  });
  return spy;
}

const cases: DuplicateCase[] = [
  {
    name: "YouTube Shorts",
    fixture: "shorts-page.fixture.html",
    url: "https://www.youtube.com/shorts/test",
    adapter: youtubeShortsSiteAdapter,
    activeVideoSelector: "#video-1",
    prepareAdvanceSpy(document) {
      return mockScrollIntoView(document.querySelector("#short-2")!);
    },
  },
  {
    name: "Facebook Reels",
    fixture: "facebook-reels.fixture.html",
    url: "https://www.facebook.com/reels/123",
    adapter: facebookReelsSiteAdapter,
    activeVideoSelector: "#facebook-reel-video",
    prepareAdvanceSpy(document) {
      const spy = vi.fn();
      document.querySelector("#facebook-next-reel")?.addEventListener("click", spy);
      return spy;
    },
  },
  {
    name: "TikTok",
    fixture: "tiktok-feed.fixture.html",
    url: "https://www.tiktok.com/en/@creator/video/123",
    adapter: tiktokSiteAdapter,
    activeVideoSelector: "#tiktok-video",
    prepareAdvanceSpy(document) {
      const spy = vi.fn();
      document.querySelector("#tiktok-feed-navigation-next")?.addEventListener("click", spy);
      return spy;
    },
  },
  {
    name: "Instagram Reels",
    fixture: "instagram-reels.fixture.html",
    url: "https://www.instagram.com/reels/123",
    adapter: instagramReelsSiteAdapter,
    activeVideoSelector: "#instagram-active-video",
    prepareAdvanceSpy(document) {
      return mockScrollIntoView(document.querySelector("#instagram-next-item")!);
    },
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(cases)("$name duplicate prevention", (testCase) => {
  it("advances once for near-end, rewind, seeked, and ended", () => {
    vi.useFakeTimers();
    const dom = loadFixture(testCase);
    const { document, Event } = dom.window;
    const video = document.querySelector<HTMLVideoElement>(
      testCase.activeVideoSelector,
    )!;
    const advanceSpy = testCase.prepareAdvanceSpy(document);

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 10,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 9.9,
      writable: true,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
      adapters: [testCase.adapter],
    });

    video.dispatchEvent(new Event("timeupdate"));
    video.currentTime = 0;
    video.dispatchEvent(new Event("timeupdate"));
    video.dispatchEvent(new Event("seeked"));
    video.dispatchEvent(new Event("ended"));
    vi.runAllTimers();

    expect(advanceSpy).toHaveBeenCalledTimes(1);
    engine.stop();
  });
});
