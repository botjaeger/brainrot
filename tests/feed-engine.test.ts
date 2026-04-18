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

describe("document.hidden guard", () => {
  it("does not advance feed when document.hidden is true on ended event", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    // Make document appear hidden
    Object.defineProperty(document, "hidden", {
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

    let hidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });

    // Set up video as ended
    Object.defineProperty(firstVideo, "ended", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(firstVideo, "paused", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(firstVideo, "duration", {
      configurable: true,
      get: () => 30,
    });
    Object.defineProperty(firstVideo, "currentTime", {
      configurable: true,
      get: () => 30,
    });

    const engine = startFeedEngine({
      document,
      window: dom.window,
    });

    // Simulate tab becoming visible
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));

    // advanceFeed should be deferred — not called yet
    expect(scrollIntoView).not.toHaveBeenCalled();

    // After setTimeout(0) fires, it should advance
    vi.runAllTimers();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    engine.stop();
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
    Object.defineProperty(document, "hidden", {
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
    Object.defineProperty(document, "hidden", {
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
    Object.defineProperty(document, "hidden", {
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
    Object.defineProperty(document, "hidden", {
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
