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

function setVideoPlaybackState(
  video: HTMLVideoElement,
  duration: number,
  currentTime: number,
) {
  Object.defineProperty(video, "duration", {
    configurable: true,
    value: duration,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    value: currentTime,
    writable: true,
  });
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

function appendNextButton(document: Document): HTMLButtonElement {
  const shortsRoot = document.createElement("ytd-shorts");
  const wrapper = document.createElement("div");
  wrapper.id = "navigation-button-down";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Next short");

  wrapper.appendChild(button);
  shortsRoot.appendChild(wrapper);
  document.body.appendChild(shortsRoot);

  return button;
}

async function flushMutations(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
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

    firstVideo.loop = true;

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    expect(firstVideo.loop).toBe(false);

    firstVideo.dispatchEvent(new Event("ended"));

    expect(
      addSpy.mock.calls.filter((call) => call[0] === "ended"),
    ).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    engine.stop();
  });

  it("scrolls when playback reaches the end even if ended does not fire", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextShort = getRendererById(document, "#short-2");
    const scrollIntoView = mockScrollIntoView(nextShort);

    setVideoPlaybackState(firstVideo, 10, 9.9);

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    firstVideo.dispatchEvent(new Event("timeupdate"));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it("clicks the Shorts next button when it is available", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextButton = appendNextButton(document);
    const onClick = vi.fn();

    nextButton.addEventListener("click", onClick);

    const engine = startShortsEngine({
      document,
      window: dom.window,
    });

    firstVideo.dispatchEvent(new Event("ended"));

    expect(onClick).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it("logs the advance path when diagnostics are enabled", () => {
    const dom = loadShortsDom();
    const { document, Event } = dom.window;
    const firstVideo = getVideoById(document, "#video-1");
    const nextButton = appendNextButton(document);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    nextButton.addEventListener("click", () => undefined);

    const engine = startShortsEngine({
      document,
      window: dom.window,
      debugEnabled: true,
    });

    firstVideo.dispatchEvent(new Event("ended"));

    expect(
      infoSpy.mock.calls.find(
        (call) =>
          call[0] === "[Brainrot]" &&
          call[1] === "advance" &&
          call[2]?.method === "next-button" &&
          call[2]?.selector === "#navigation-button-down button",
      ),
    ).toBeDefined();

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
      addSpy.mock.calls.filter((call) => call[0] === "ended"),
    ).toHaveLength(2);
    expect(
      removeSpy.mock.calls.filter((call) => call[0] === "ended"),
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
      addSpy.mock.calls.filter((call) => call[0] === "ended"),
    ).toHaveLength(0);

    engine.stop();
  });
});
