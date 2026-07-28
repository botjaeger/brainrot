const SHORTS_RENDERER_SELECTOR = "ytd-reel-video-renderer";
const SHORTS_CONTAINER_SELECTORS = ["#shorts-container", "ytd-shorts"];
const SHORTS_NEXT_BUTTON_SELECTORS = [
  "#navigation-button-down button",
  "ytd-reel-video-renderer[is-active] button[aria-label*='next' i]",
  "ytd-reel-video-renderer.is-active button[aria-label*='next' i]",
  "button[aria-label*='next' i]",
  "button[title*='next' i]",
];
const ACTIVE_SHORTS_VIDEO_SELECTORS = [
  "ytd-reel-video-renderer[is-active] video.video-stream.html5-main-video",
  "ytd-reel-video-renderer.is-active video.video-stream.html5-main-video",
  "ytd-reel-video-renderer[is-active] video",
  "ytd-reel-video-renderer.is-active video",
  "ytd-reel-video-renderer video.video-stream.html5-main-video",
  "ytd-reel-video-renderer video",
  "video.video-stream.html5-main-video",
  "video",
];

function isRendererContainer(element: Element | null): element is Element {
  return element?.tagName.toLowerCase() === SHORTS_RENDERER_SELECTOR;
}

function isVideoElement(element: Element | null): element is HTMLVideoElement {
  return element?.tagName.toLowerCase() === "video";
}

function isButtonElement(element: Element | null): element is HTMLButtonElement {
  return element?.tagName.toLowerCase() === "button";
}

function isInsideShortsUi(element: Element): boolean {
  return element.closest("ytd-shorts, #shorts-container") !== null;
}

function isInsideAnyScope(element: Element, selectors: readonly string[]): boolean {
  return selectors.some((selector) => element.closest(selector) !== null);
}

export function getViewportOverlapRatio(element: Element): number {
  const view = element.ownerDocument.defaultView;
  if (!view) return 0;

  const rect = element.getBoundingClientRect();
  const viewportHeight =
    view.innerHeight || element.ownerDocument.documentElement.clientHeight;
  const overlap =
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

  return rect.height > 0 ? Math.max(0, overlap) / rect.height : 0;
}

function isScrollableElement(element: Element): boolean {
  const view = element.ownerDocument.defaultView;

  if (!view) {
    return false;
  }

  const style = view.getComputedStyle(element);
  const overflow = `${style.overflowY} ${style.overflow}`;

  return (
    element.scrollHeight - element.clientHeight > 4 &&
    /(auto|scroll|overlay)/i.test(overflow)
  );
}

function findScrollableAncestor(element: Element | null): HTMLElement | null {
  let current: Element | null = element;

  while (current) {
    if (isScrollableElement(current)) {
      return current as HTMLElement;
    }

    current = current.parentElement;
  }

  return null;
}

export interface ClickableMatch {
  element: HTMLElement;
  selector: string;
}

export interface ClickableMatchOptions {
  scopeSelectors?: readonly string[];
  isAllowed?: (element: HTMLElement) => boolean;
}

export function findClickableMatch(
  document: Document,
  selectors: readonly string[],
  options: ClickableMatchOptions = {},
): ClickableMatch | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (!element || typeof (element as { click?: unknown }).click !== "function") {
      continue;
    }

    if (
      options.scopeSelectors &&
      options.scopeSelectors.length > 0 &&
      !isInsideAnyScope(element, options.scopeSelectors)
    ) {
      continue;
    }

    if (options.isAllowed && !options.isAllowed(element as HTMLElement)) {
      continue;
    }

    return {
      element: element as HTMLElement,
      selector,
    };
  }

  return null;
}

export function scrollDocumentForward(
  document: Document,
  startElement?: Element | null,
): void {
  const ancestor = findScrollableAncestor(startElement ?? null);

  if (ancestor) {
    const scrollAmount = Math.max(
      1,
      Math.floor((ancestor.clientHeight || 1) * 0.9),
    );
    ancestor.scrollTop += scrollAmount;
    return;
  }

  const scrollTarget =
    document.scrollingElement ?? document.documentElement ?? document.body;

  if (scrollTarget && "scrollTop" in scrollTarget) {
    const target = scrollTarget as HTMLElement;
    const scrollAmount = Math.max(
      1,
      Math.floor((target.clientHeight || 1) * 0.9),
    );

    target.scrollTop += scrollAmount;
    return;
  }

  document.defaultView?.scrollBy({
    behavior: "smooth",
    top: 1,
  });
}

export type ShortsAdvanceMethod =
  | "next-button"
  | "shorts-container-scroll"
  | "renderer-scroll"
  | "window-scroll";

export interface ShortsAdvanceResult {
  method: ShortsAdvanceMethod;
  selector?: string;
}

export interface ShortsNextButtonMatch {
  button: HTMLButtonElement;
  selector: string;
}

export function isShortsPathname(pathname: string): boolean {
  return pathname === "/shorts" || pathname.startsWith("/shorts/");
}

export function findActiveShortsVideo(document: Document): HTMLVideoElement | null {
  const candidates: HTMLVideoElement[] = [];
  const seen = new Set<HTMLVideoElement>();

  for (const selector of ACTIVE_SHORTS_VIDEO_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (
        isVideoElement(element) &&
        element.closest(SHORTS_RENDERER_SELECTOR) &&
        !seen.has(element)
      ) {
        seen.add(element);
        candidates.push(element);
      }
    }
  }

  candidates.sort((left, right) => {
    const score = (video: HTMLVideoElement): number => {
      const renderer = video.closest(SHORTS_RENDERER_SELECTOR);
      const active =
        renderer?.hasAttribute("is-active") ||
        renderer?.classList.contains("is-active");
      return (
        (active ? 8 : 0) +
        (!video.paused && !video.ended ? 4 : 0) +
        (getViewportOverlapRatio(video) >= 0.5 ? 2 : 0)
      );
    };

    return score(right) - score(left);
  });

  return candidates[0] ?? null;
}

export function findShortsContainer(document: Document): HTMLElement | null {
  for (const selector of SHORTS_CONTAINER_SELECTORS) {
    const element = document.querySelector<HTMLElement>(selector);

    if (element) {
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

export function findShortsNextButton(
  document: Document,
): ShortsNextButtonMatch | null {
  const match = findClickableMatch(document, SHORTS_NEXT_BUTTON_SELECTORS, {
    scopeSelectors: ["ytd-shorts", "#shorts-container"],
    isAllowed: (element) =>
      isButtonElement(element) ? !element.disabled : false,
  });

  if (match && isButtonElement(match.element)) {
    return {
      button: match.element,
      selector: match.selector,
    };
  }

  return null;
}

export function scrollShortsFeedForward(
  document: Document,
  currentVideo: HTMLVideoElement,
): ShortsAdvanceResult {
  const nextContainer = findNextShortsContainer(document, currentVideo);

  if (nextContainer) {
    scrollShortsContainerIntoView(nextContainer);
    return {
      method: "renderer-scroll",
    };
  }

  const shortsContainer = findShortsContainer(document);

  if (shortsContainer) {
    shortsContainer.scrollTop += 1;
    return {
      method: "shorts-container-scroll",
    };
  }

  document.defaultView?.scrollBy({
    behavior: "smooth",
    top: 1,
  });
  return {
    method: "window-scroll",
  };
}

export function advanceShortsPlayback(
  document: Document,
  currentVideo: HTMLVideoElement,
): ShortsAdvanceResult {
  const nextButton = findShortsNextButton(document);

  if (nextButton) {
    nextButton.button.click();
    return {
      method: "next-button",
      selector: nextButton.selector,
    };
  }

  return scrollShortsFeedForward(document, currentVideo);
}
