import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startFeedEngine } from "../src/core/feed-engine.js";

function loadShortsDom(pathname = "/shorts/fixture") {
  const html = readFileSync(
    new URL("./fixtures/shorts-page.fixture.html", import.meta.url),
    "utf8",
  );

  return new JSDOM(html, {
    pretendToBeVisual: true,
    url: `https://www.youtube.com${pathname}`,
  });
}

function mockScrollIntoView(element: Element) {
  const scrollIntoView = vi.fn();

  Object.defineProperty(element, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  return scrollIntoView;
}

function getVideoById(document: Document, id: string): HTMLVideoElement {
  const video = document.querySelector<HTMLVideoElement>(id);

  if (!video) {
    throw new Error(`Missing fixture element: ${id}`);
  }

  return video;
}

function getRendererById(document: Document, id: string): Element {
  const renderer = document.querySelector(id);

  if (!renderer) {
    throw new Error(`Missing fixture element: ${id}`);
  }

  return renderer;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startFeedEngine", () => {
  it("does not activate on unsupported pages", () => {
    const dom = loadShortsDom("/watch?v=example");
    const { document, HTMLMediaElement } = dom.window;
    const addSpy = vi.spyOn(HTMLMediaElement.prototype, "addEventListener");

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    expect(engine.isRunning()).toBe(false);
    expect(
      addSpy.mock.calls.filter((call) => call[0] === "ended"),
    ).toHaveLength(0);

    engine.stop();
  });

  it("selects the Shorts adapter on Shorts pages", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    expect(engine.isRunning()).toBe(true);

    firstVideo.dispatchEvent(new Event("ended"));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    engine.stop();
  });
});

describe("getRealHidden spoof bypass", () => {
  it("uses real document.hidden from prototype even when instance property spoofed to false", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    // Simulate spoof: instance-level property always returns false ("not hidden")
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });

    // Simulate real browser state: prototype getter returns true ("actually hidden")
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => true,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // Feed engine reads real visibility via prototype, so it sees hidden=true
    // and should NOT advance even though the spoof instance property says false
    firstVideo.dispatchEvent(new Event("ended"));

    expect(scrollIntoView).not.toHaveBeenCalled();

    engine.stop();
  });

  it("advances feed when prototype getter returns false (real foreground) even if instance property not set", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    // Prototype getter says not hidden (real foreground)
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => false,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    firstVideo.dispatchEvent(new Event("ended"));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    engine.stop();
  });
});

describe("document.hidden guard", () => {
  it("does not advance feed when document.hidden is true on ended event", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    // Make document appear hidden
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => true,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    firstVideo.dispatchEvent(new Event("ended"));

    // Should NOT have advanced because document is hidden
    expect(scrollIntoView).not.toHaveBeenCalled();

    engine.stop();
  });

  it("advances feed after visibility-return via setTimeout defer", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    vi.useFakeTimers();

    let hidden = false;
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => hidden,
    });

    let videoEnded = false;
    let videoPaused = false;
    Object.defineProperty(firstVideo, "ended", {
      configurable: true,
      get: () => videoEnded,
    });
    Object.defineProperty(firstVideo, "paused", {
      configurable: true,
      get: () => videoPaused,
    });
    Object.defineProperty(firstVideo, "duration", {
      configurable: true,
      get: () => 30,
    });
    Object.defineProperty(firstVideo, "currentTime", {
      configurable: true,
      get: () => videoEnded ? 30 : 5,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // Simulate tab going hidden while video is playing
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));

    // Simulate video ending while hidden
    videoEnded = true;
    firstVideo.dispatchEvent(new Event("ended"));

    // Simulate tab returning to foreground
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));

    // advanceFeed is deferred via setTimeout(0) — not called yet
    expect(scrollIntoView).not.toHaveBeenCalled();

    // After the deferred setTimeout fires, advance should occur
    vi.runAllTimers();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    engine.stop();
  });
});

describe("background-aware behavior", () => {
  describe("document.hidden guard", () => {
    it("advanceFeed does not invoke adapter when document.hidden is true", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const nextShort = getRendererById(document, "#short-2");
      const scrollIntoView = mockScrollIntoView(nextShort);

      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => true,
      });

      const advanceSpy = vi.fn();
      const engine = startFeedEngine({
        document,
        window: dom.window,
        onAdvance: advanceSpy,
      });

      firstVideo.dispatchEvent(new Event("ended"));

      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(advanceSpy).not.toHaveBeenCalled();

      engine.stop();
    });

    it("advanceFeed invokes adapter when document.hidden is false", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const nextShort = getRendererById(document, "#short-2");
      const scrollIntoView = mockScrollIntoView(nextShort);

      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => false,
      });

      const advanceSpy = vi.fn();
      const engine = startFeedEngine({
        document,
        window: dom.window,
        onAdvance: advanceSpy,
      });

      firstVideo.dispatchEvent(new Event("ended"));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(advanceSpy).toHaveBeenCalledTimes(1);

      engine.stop();
    });
  });

  describe("userPaused flag (UX-01)", () => {
    it("sets userPaused=true when video paused in foreground, prevents resume on hidden pause", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      const playSpy = vi.fn(() => Promise.resolve());
      Object.defineProperty(firstVideo, "play", {
        configurable: true,
        value: playSpy,
      });
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => false,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // Foreground pause → userPaused = true
      firstVideo.dispatchEvent(new Event("pause"));

      // Now tab goes hidden, site tries to pause
      hidden = true;
      firstVideo.dispatchEvent(new Event("pause"));

      // play() should NOT be called — userPaused=true
      expect(playSpy).not.toHaveBeenCalled();

      engine.stop();
    });

    it("resumes video when userPaused=false and site pauses video while tab is hidden", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      const playSpy = vi.fn(() => Promise.resolve());
      Object.defineProperty(firstVideo, "play", {
        configurable: true,
        value: playSpy,
      });
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => false,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // Tab hidden — site drives a pause, no user action
      hidden = true;
      firstVideo.dispatchEvent(new Event("pause"));

      // play() SHOULD be called — site-driven pause, userPaused=false
      expect(playSpy).toHaveBeenCalledTimes(1);

      engine.stop();
    });

    it("resets userPaused on play event", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      const playSpy = vi.fn(() => Promise.resolve());
      Object.defineProperty(firstVideo, "play", {
        configurable: true,
        value: playSpy,
      });
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => false,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // User pauses in foreground → userPaused = true
      firstVideo.dispatchEvent(new Event("pause"));
      // User resumes → play event → userPaused = false
      firstVideo.dispatchEvent(new Event("play"));

      // Tab hides, site pauses — should resume now since userPaused=false
      hidden = true;
      firstVideo.dispatchEvent(new Event("pause"));

      expect(playSpy).toHaveBeenCalledTimes(1);

      engine.stop();
    });

    it("resets userPaused on video detach (rebind to new video)", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const secondVideo = getVideoById(document, "#video-2");

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      const playSpy = vi.fn(() => Promise.resolve());
      for (const v of [firstVideo, secondVideo]) {
        Object.defineProperty(v, "play", {
          configurable: true,
          value: playSpy,
        });
        Object.defineProperty(v, "ended", {
          configurable: true,
          get: () => false,
        });
      }

      // Custom adapter that switches from video-1 to video-2 on rebind
      let activeVideoForAdapter: HTMLVideoElement = firstVideo;
      const customAdapter = {
        name: "test",
        siteKey: "test",
        matches: () => true,
        findActiveVideo: () => activeVideoForAdapter,
        advancePlayback: () => ({ method: "scroll" }),
      };

      const engine = startFeedEngine({
        document,
        window: dom.window,
        adapters: [customAdapter],
      });

      // User pauses first video in foreground → userPaused = true
      firstVideo.dispatchEvent(new Event("pause"));

      // Switch adapter to return second video, then rebind
      // detachActiveVideo (called inside attachActiveVideo) resets userPaused
      activeVideoForAdapter = secondVideo;
      engine.rebind();

      // Now tab hides, site pauses second video — should resume since userPaused reset
      hidden = true;
      secondVideo.dispatchEvent(new Event("pause"));

      expect(playSpy).toHaveBeenCalledTimes(1);

      engine.stop();
    });
  });

  describe("Safari elapsed-time fallback (BG-03)", () => {
    it("advances when elapsed time >= remaining video time on visibility return", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const nextShort = getRendererById(document, "#short-2");
      const scrollIntoView = mockScrollIntoView(nextShort);

      vi.useFakeTimers();
      let nowMs = 0;
      vi.spyOn(Date, "now").mockImplementation(() => nowMs);

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      Object.defineProperty(firstVideo, "duration", {
        configurable: true,
        get: () => 10,
      });
      let currentTime = 8;
      Object.defineProperty(firstVideo, "currentTime", {
        configurable: true,
        get: () => currentTime,
      });
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(firstVideo, "paused", {
        configurable: true,
        get: () => false,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // Video at 8s of 10s (2s remaining), tab goes hidden
      nowMs = 1000;
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));

      // Simulate 3 seconds elapsed (2s remaining - 500ms buffer = 1500ms needed)
      // elapsed 3000ms >= remaining 2000ms - 500ms = 1500ms
      nowMs = 4000; // 3000ms elapsed
      currentTime = 8; // video position unchanged (WKWebView froze)

      // Tab returns to foreground
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));

      // Advance is deferred via setTimeout(0)
      expect(scrollIntoView).not.toHaveBeenCalled();
      vi.runAllTimers();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
      engine.stop();
    });

    it("does NOT advance when elapsed time < remaining video time on visibility return", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const nextShort = getRendererById(document, "#short-2");
      const scrollIntoView = mockScrollIntoView(nextShort);

      vi.useFakeTimers();
      let nowMs = 0;
      vi.spyOn(Date, "now").mockImplementation(() => nowMs);

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      Object.defineProperty(firstVideo, "duration", {
        configurable: true,
        get: () => 10,
      });
      Object.defineProperty(firstVideo, "currentTime", {
        configurable: true,
        get: () => 5, // 5s of 10s, 5s remaining
      });
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(firstVideo, "paused", {
        configurable: true,
        get: () => false,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // Video at 5s of 10s (5s remaining), tab goes hidden
      nowMs = 1000;
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));

      // Only 2 seconds elapsed (< 5s - 0.5s = 4.5s buffer)
      nowMs = 3000; // 2000ms elapsed

      // Tab returns to foreground
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));

      vi.runAllTimers();

      // Should NOT have advanced — not enough time elapsed
      expect(scrollIntoView).not.toHaveBeenCalled();

      vi.useRealTimers();
      engine.stop();
    });
  });

  describe("visibility-return defer", () => {
    it("calls advanceFeed via setTimeout(0) not synchronously", () => {
      const dom = loadShortsDom();
      const { document, Event } = dom.window;
      const firstVideo = getVideoById(document, "#video-1");
      const nextShort = getRendererById(document, "#short-2");
      const scrollIntoView = mockScrollIntoView(nextShort);

      vi.useFakeTimers();

      let hidden = false;
      Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
        configurable: true,
        get: () => hidden,
      });

      let videoEnded = false;
      Object.defineProperty(firstVideo, "ended", {
        configurable: true,
        get: () => videoEnded,
      });
      Object.defineProperty(firstVideo, "paused", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(firstVideo, "duration", {
        configurable: true,
        get: () => 10,
      });
      Object.defineProperty(firstVideo, "currentTime", {
        configurable: true,
        get: () => videoEnded ? 10 : 5,
      });

      const engine = startFeedEngine({
        document,
        window: dom.window,
      });

      // Hide tab while video is playing
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));

      // Video ends while hidden
      videoEnded = true;
      firstVideo.dispatchEvent(new Event("ended"));

      // Show tab — advance should be deferred
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));

      // Not called synchronously
      expect(scrollIntoView).not.toHaveBeenCalled();

      // Called after setTimeout fires
      vi.runAllTimers();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
      engine.stop();
    });
  });
});

describe("userPaused flag", () => {
  it("sets userPaused when pause fires while document is visible (foreground pause)", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    // Document is NOT hidden (foreground)
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => false,
    });

    // Mock video.play so we can spy on it
    const playSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(firstVideo, "play", {
      configurable: true,
      value: playSpy,
    });
    Object.defineProperty(firstVideo, "ended", {
      configurable: true,
      get: () => false,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // User pauses in foreground
    firstVideo.dispatchEvent(new Event("pause"));

    // Now simulate hidden state where site tries to trigger another pause
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => true,
    });
    firstVideo.dispatchEvent(new Event("pause"));

    // play() should NOT have been called — userPaused=true prevents resume
    expect(playSpy).not.toHaveBeenCalled();
    // And advance should not have occurred either
    expect(scrollIntoView).not.toHaveBeenCalled();

    engine.stop();
  });

  it("does not resume video while hidden when userPaused is false (site-driven pause)", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");

    let hidden = false;
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => hidden,
    });

    const playSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(firstVideo, "play", {
      configurable: true,
      value: playSpy,
    });
    Object.defineProperty(firstVideo, "ended", {
      configurable: true,
      get: () => false,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // Switch to hidden state — site pauses video (no user action)
    hidden = true;
    firstVideo.dispatchEvent(new Event("pause"));

    // play() SHOULD be called (site-driven pause while hidden, userPaused is false)
    expect(playSpy).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it("resets userPaused to false on play event", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");

    let hidden = false;
    Object.defineProperty(Object.getPrototypeOf(document), "hidden", {
      configurable: true,
      get: () => hidden,
    });

    const playSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(firstVideo, "play", {
      configurable: true,
      value: playSpy,
    });
    Object.defineProperty(firstVideo, "ended", {
      configurable: true,
      get: () => false,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // User pauses in foreground → userPaused = true
    firstVideo.dispatchEvent(new Event("pause"));

    // User resumes → play event fires → userPaused = false
    firstVideo.dispatchEvent(new Event("play"));

    // Now switch to hidden and site pauses — should resume since userPaused=false
    hidden = true;
    firstVideo.dispatchEvent(new Event("pause"));

    // play() was called from: the site-driven resume (userPaused is now false)
    expect(playSpy).toHaveBeenCalledTimes(1);

    engine.stop();
  });
});
