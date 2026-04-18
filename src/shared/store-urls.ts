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
  chrome: { state: "coming_soon" },
  firefox: { state: "coming_soon" },
  safari: { state: "coming_soon" },
};
