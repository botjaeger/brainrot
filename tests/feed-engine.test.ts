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
