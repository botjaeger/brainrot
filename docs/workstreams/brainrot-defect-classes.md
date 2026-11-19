# Brainrot defect classes

One row per defect class. Before a sweep, re-run each class's check across the whole repo. A class
is closed only by its guard (a test that fails when a new site skips the rule).

| Class | Rule | Guard | Instances |
|-------|------|-------|-----------|
| Supported-site knowledge duplicated | Every copy (adapters, `getSiteKey`, `site-status`, background `isFeedUrl`/`SUPPORTED_URL_PATTERNS`, spoof `isSupportedFeed`, 3 manifests, `SUPPORTED_SITE_LABELS`, stats defaults, README, site index/privacy) classifies one URL matrix the same way | `tests/supported-sites.test.ts` | None (2026-11-19); guard added |
| Storage shim divergence | Every storage reader handles promise `get`, callback-only `get` that throws without a callback, `browser` before `chrome`, unreadable storage | `tests/storage-shim.test.ts` (READERS table: runtime-settings, scroll-counter, control, popup extension-settings) | runtime-settings, scroll-counter, control, extension-settings (2026-11-19) |
| Stored values used unvalidated | Counts read from storage are non-negative safe integers, otherwise dropped; no DOM selector built from a stored key | `tests/extension-settings.test.ts` "stored counts", `tests/storage-shim.test.ts` "ignores invalid stored counts", `tests/popup.test.ts` corrupt counts, `tests/e2e/pages.spec.ts` corrupt values | popup selector crash, `"5"` + 1 = `"51"` in scroll-counter (2026-11-19) |
| Read-then-write increments overlap | Stats increments in one tab run one at a time | `tests/storage-shim.test.ts` "never overlap" (20 parallel increments) | scroll-counter (2026-11-19). Cross-tab overlap still possible: needs increments routed through the background worker |
| Near-end fallback ignores user intent | A timeupdate-driven advance never fires for a video the user paused | `tests/feed-engine.test.ts` paused-near-end | feed-engine timeupdate path (2026-11-19) |
| Listener/timer leak across rebinds | Rebinding and stop() remove every listener, timer and observer | `tests/feed-engine.test.ts` leak test | None (2026-11-19) |
| Template colour outside tokens | Extension pages take colours only from `THEME_TOKENS_CSS` | `tests/popup.test.ts` "extension page templates" | 3 `rgba` in popup (2026-11-19) |
| Motion without reduced-motion guard | Any extension page with `transition`/`animation` includes `REDUCED_MOTION_CSS`; site motion stops under reduced motion | `tests/popup.test.ts` templates | popup, changelog (2026-11-19) |
| Invisible input without focus ring | A visually hidden input rings its visible sibling | `tests/e2e/pages.spec.ts` focus ring | popup switch (2026-11-19) |
| Content outside landmarks | One `main`; no `aside` inside `main` | `tests/popup.test.ts` main, `tests/site-facts.test.ts` landmarks | popup, site Privacy/Open source cards (2026-11-19) |
| Popup overflow at 320px | No horizontal scroll at 320 and 400px, both themes | `tests/e2e/pages.spec.ts` overflow | popup fixed width (2026-11-19) |
| Site ships unreferenced or heavy files | The site ships only files its pages reference; recordings are mp4, never GIF | `tests/site-facts.test.ts` "ships only what the pages reference" | 33 MB `assets/hero-*` via publicDir, 8.4 MB GIFs (2026-11-19) |
| Site root-absolute or third-party paths | No `/`-rooted or external resource in pages or CSS | `tests/site-facts.test.ts` "no third-party request" | 3 root-absolute srcs (2026-11-19) |
| Site meta missing | Every page has title, description, absolute canonical, og tags; media named | `tests/site-facts.test.ts` pages | canonical/og on 3 pages, 404 page (2026-11-19) |
| Site facts drift from code | Privacy/terms list every stored key, permission, host; store links and Safari state follow `STORE_URLS` | `tests/site-facts.test.ts` "site facts follow the extension" | None (2026-11-19) |
| Workflow write permission | Workflows are read-only at the top level; a job that writes asks for it | `tests/workflows.test.ts` | release.yml `contents: write` for every job (2026-11-19) |
| e2e page opened before onInstalled | e2e fixtures wait for the install handler before opening feed pages | `tests/e2e/extension.ts` serviceWorker fixture | shorts.spec 8/150 under load (2026-11-19) |
