import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startShortsEngine } from "../src/core/shorts-engine.js";

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

async function flushMutations(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startShortsEngine", () => {
  it("scrolls to the next Short once when playback ends", () => {
    const dom = loadShortsDom();
    const { document, HTMLMediaElement, Event } = dom.window;
    const addSpy = vi.spyOn(HTMLMediaElement.prototype, "addEventListener");
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    firstVideo.dispatchEvent(new Event("ended"));

    expect(
      addSpy.mock.calls.filter(([type]) => type === "ended"),
    ).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    engine.stop();
  });

  it("rebinds after rerenders without leaving duplicate ended listeners behind", async () => {
    const dom = loadShortsDom();
    const { document, HTMLMediaElement, Event } = dom.window;
    const addSpy = vi.spyOn(HTMLMediaElement.prototype, "addEventListener");
    const removeSpy = vi.spyOn(HTMLMediaElement.prototype, "removeEventListener");
    const firstRenderer = getRendererById(document, "#short-1");
    const nextShort = getRendererById(document, "#short-2");
    const firstVideo = getVideoById(document, "#video-1");
    const scrollIntoView = mockScrollIntoView(nextShort);

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    const rerenderedVideo = document.createElement("video");
    rerenderedVideo.id = "video-1b";
    rerenderedVideo.setAttribute("playsinline", "");
    rerenderedVideo.setAttribute("muted", "");
    firstRenderer.replaceChildren(rerenderedVideo);

    await flushMutations();

    expect(
      addSpy.mock.calls.filter(([type]) => type === "ended"),
    ).toHaveLength(2);
    expect(
      removeSpy.mock.calls.filter(([type]) => type === "ended"),
    ).toHaveLength(1);

    firstVideo.dispatchEvent(new Event("ended"));
    expect(scrollIntoView).toHaveBeenCalledTimes(0);

    rerenderedVideo.dispatchEvent(new Event("ended"));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it("does not activate on non-Shorts pages", () => {
    const dom = loadShortsDom("/watch?v=example");
    const { document, HTMLMediaElement } = dom.window;
    const addSpy = vi.spyOn(HTMLMediaElement.prototype, "addEventListener");

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    expect(
      addSpy.mock.calls.filter(([type]) => type === "ended"),
    ).toHaveLength(0);

    engine.stop();
  });
});
