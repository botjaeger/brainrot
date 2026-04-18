/**
 * Store URL configuration with typed states.
 * All URLs default to coming_soon until store listings are confirmed.
 */

export type StoreUrlState =
  | { state: "coming_soon" }
  | { state: "live"; url: string };

export interface BrowserStoreUrls {
  chrome: StoreUrlState;
  firefox: StoreUrlState;
  safari: StoreUrlState;
}

export const STORE_URLS: BrowserStoreUrls = {
  chrome: {
    state: "live",
    url: "https://chromewebstore.google.com/detail/brainrot-auto-scroll-for/epnminblfookppcemedaonmnanembgik",
  },
  firefox: {
    state: "live",
    url: "https://addons.mozilla.org/en-US/firefox/addon/brainrot-auto-scroll/",
  },
  safari: { state: "coming_soon" },
};
