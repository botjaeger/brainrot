const SHORTS_RENDERER_SELECTOR = "ytd-reel-video-renderer";

function isRendererContainer(element: Element | null): element is Element {
  return element?.tagName.toLowerCase() === SHORTS_RENDERER_SELECTOR;
}

function isVideoElement(element: Element | null): element is HTMLVideoElement {
  return element?.tagName.toLowerCase() === "video";
}

export function isShortsPathname(pathname: string): boolean {
  return pathname === "/shorts" || pathname.startsWith("/shorts/");
}

export function findActiveShortsVideo(document: Document): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video"));

  for (const element of videos) {
    if (isVideoElement(element) && element.closest(SHORTS_RENDERER_SELECTOR)) {
      return element;
    }
  }

  return null;
}

export function findNextShortsContainer(
  document: Document,
  currentVideo: HTMLVideoElement,
): Element | null {
  const renderers = Array.from(
    document.querySelectorAll(SHORTS_RENDERER_SELECTOR),
  ).filter(isRendererContainer);

  const currentContainer = currentVideo.closest(SHORTS_RENDERER_SELECTOR);

  if (currentContainer) {
    const currentIndex = renderers.indexOf(currentContainer);

    if (currentIndex >= 0) {
      return renderers[currentIndex + 1] ?? null;
    }
  }

  return renderers[1] ?? null;
}

export function scrollShortsContainerIntoView(container: Element): void {
  if (typeof container.scrollIntoView !== "function") {
    return;
  }

  container.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });
}
