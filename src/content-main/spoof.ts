/**
 * MAIN-world visibility spoof.
 * Dormant by default; the isolated controller enables it from extension storage.
 */
(() => {
  const ENABLE_EVENT = "brainrot:visibility-spoof-enable";
  const DISABLE_EVENT = "brainrot:visibility-spoof-disable";
  const READY_EVENT = "brainrot:visibility-spoof-ready";
  const MARKER = "__brainrotSpoofActive";
  const win = window as unknown as { [key: string]: unknown };

  if (win[MARKER]) {
    document.dispatchEvent(new Event(READY_EVENT));
    return;
  }

  win[MARKER] = true;

  const ownVisibilityState = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState",
  );
  const ownHidden = Object.getOwnPropertyDescriptor(document, "hidden");

  function findPrototypeDescriptor(
    property: "visibilityState" | "hidden",
  ): PropertyDescriptor | undefined {
    let prototype: object | null = Object.getPrototypeOf(document);

    while (prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
      if (descriptor) return descriptor;
      prototype = Object.getPrototypeOf(prototype);
    }

    return undefined;
  }

  const nativeVisibilityState = findPrototypeDescriptor("visibilityState");
  const nativeHidden = findPrototypeDescriptor("hidden");

  function readDescriptor<T>(
    descriptor: PropertyDescriptor | undefined,
    fallback: T,
  ): T {
    if (!descriptor) return fallback;
    if (descriptor.get) return descriptor.get.call(document) as T;
    return ("value" in descriptor ? descriptor.value : fallback) as T;
  }

  function matchesHostname(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function normalizeTikTokPathname(pathname: string): string {
    const localePrefix = /^\/[a-z]{2}(?:[-_][a-zA-Z0-9]{2,8})?(?=\/|$)/;
    const normalized = pathname.replace(localePrefix, "");
    return normalized.length > 0 ? normalized : "/";
  }

  function isSupportedFeed(): boolean {
    const { hostname, pathname } = window.location;

    if (matchesHostname(hostname, "youtube.com")) {
      return pathname === "/shorts" || pathname.startsWith("/shorts/");
    }

    if (
      matchesHostname(hostname, "facebook.com") ||
      matchesHostname(hostname, "instagram.com")
    ) {
      return (
        pathname === "/reels" ||
        pathname.startsWith("/reels/") ||
        pathname === "/reel" ||
        pathname.startsWith("/reel/")
      );
    }

    if (matchesHostname(hostname, "tiktok.com")) {
      const normalized = normalizeTikTokPathname(pathname);
      return (
        normalized === "/" ||
        normalized === "/foryou" ||
        normalized.startsWith("/foryou/") ||
        normalized === "/following" ||
        normalized.startsWith("/following/") ||
        (normalized.startsWith("/@") && normalized.includes("/video/"))
      );
    }

    return false;
  }

  function restoreProperty(
    property: "visibilityState" | "hidden",
    descriptor: PropertyDescriptor | undefined,
  ): void {
    try {
      if (descriptor) {
        Object.defineProperty(document, property, descriptor);
      } else {
        delete (document as unknown as Record<string, unknown>)[property];
      }
    } catch {
      // Best effort: a page may replace the descriptor with a non-configurable one.
    }
  }

  function enable(): void {
    try {
      Object.defineProperty(document, "visibilityState", {
        get: () =>
          isSupportedFeed()
            ? "visible"
            : readDescriptor(
                ownVisibilityState ?? nativeVisibilityState,
                "visible",
              ),
        configurable: true,
      });
    } catch {
      // Already non-configurable.
    }

    try {
      Object.defineProperty(document, "hidden", {
        get: () =>
          isSupportedFeed()
            ? false
            : readDescriptor(ownHidden ?? nativeHidden, false),
        configurable: true,
      });
    } catch {
      // Already non-configurable.
    }
  }

  function disable(): void {
    restoreProperty("visibilityState", ownVisibilityState);
    restoreProperty("hidden", ownHidden);
  }

  document.addEventListener(ENABLE_EVENT, enable);
  document.addEventListener(DISABLE_EVENT, disable);
  document.dispatchEvent(new Event(READY_EVENT));
})();

export {};
