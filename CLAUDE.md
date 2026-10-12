# CLAUDE.md

Brainrot: MV3 browser extension that auto-advances short-form feeds (YouTube Shorts, Facebook Reels, TikTok, Instagram Reels) when a video ends. Targets Chromium, Firefox, and desktop Safari. No backend.

## Commands

```bash
pnpm check              # Gate: typecheck + all tests (tests/global-setup.ts builds dist/ once first)
pnpm release 0.1.4      # Bump, check, commit, tag, push; CI publishes to stores
pnpm test               # vitest run
pnpm exec vitest run tests/popup.test.ts   # one file
pnpm exec vitest run -t "theme toggle"     # by test name
pnpm typecheck          # tsc --noEmit
pnpm build              # dist/ + dist/chromium + dist/firefox + dist/safari
pnpm build:base         # Vite only (dist/ root)
pnpm build:firefox      # Also build:chromium, build:safari
pnpm firefox:run        # web-ext on dist/firefox
pnpm safari:run         # macOS + Xcode; app builds to /tmp/brainrot-safari
pnpm dev:site           # Marketing site (site/, vite.site.config.ts, deployed by Vercel)
```

## Architecture

### Entry points (`vite.config.ts`)

The input key is the output filename. The manifest and popup HTML reference these paths; renaming a key silently breaks the extension.

| Key | Role |
|-----|------|
| `background/index` | Service worker (Firefox: `background.scripts`). On install, reloads supported tabs and registers the MAIN-world spoof dynamically (Safari fallback). |
| `content/index` | Isolated content script. Starts the feed engine, counts scroll stats, follows SPA navigation. |
| `content-main/spoof` | MAIN-world script. Overrides `document.hidden`/`visibilityState` on supported feeds so playback continues in background tabs. Dormant until enabled. |
| `content-main/control` | Isolated bridge. Reads `enabled` from storage and toggles the spoof through `brainrot:visibility-spoof-*` DOM events. |
| `popup/index` | Popup UI. The version number opens the changelog; a dot flags an unseen one (`changelogSeenVersion`). |
| `changelog/index` | "What's new" page. Only applies the stored theme; the content is static HTML. |

`manifestPlugin` in `vite.config.ts` also emits `manifest.json`, the icons, `popup/index.html` from `createPopupHtml({ version })` in `src/popup/popup-template.ts`, and `changelog/index.html` from `createChangelogHtml({ version })` in `src/changelog/changelog-template.ts`. No static HTML exists; tests render the same functions. Both pages share colour tokens and `escapeHtml` from `src/shared/page-html.ts`.

Release notes live in `src/shared/changelog.ts`, newest first. The page lists only versions up to the installed one, so notes for the next version can be written ahead. The popup and changelog pages are ES modules and share the `extension-settings.js` chunk at the dist root.

### Feed engine and site adapters

`startFeedEngine()` in `src/core/feed-engine.ts` picks a `FeedSiteAdapter` by URL, binds to the active video, rebinds on DOM mutation, and calls `adapter.advancePlayback()` on `ended` or within 0.25 s of the end. It reads the real visibility through the prototype chain (`getRealHidden`) because the spoof masks `document.hidden`.

The content script runs in an isolated world: property overrides on DOM objects (e.g. `Object.defineProperty(video, "loop", …)`) are invisible to the page. To affect the page, act on the DOM itself: the engine keeps sites from looping the active video by observing and stripping its `loop` attribute. A looping video never fires `ended`, which caused the "works only after reload" reports. `src/core/shorts-engine.ts` is a YouTube-only wrapper used by tests.

Each adapter in `src/sites/` owns its advance strategy: usually a "next" button, then a site container scroll, then `scrollDocumentForward()` from `src/shared/dom.ts`.

Supported-site knowledge is duplicated. A new site touches all of these:

- `src/sites/<site>.ts` adapter, added to `DEFAULT_FEED_SITES` in `feed-engine.ts`
- `manifest.json`: all three `content_scripts` `matches` arrays
- `SUPPORTED_URL_PATTERNS` and `isFeedUrl()` in `src/background/index.ts` (self-contained; the update reloads only feed tabs)
- `isSupportedFeed()` in `src/content-main/spoof.ts` (self-contained; cannot import)
- `src/content/site-key.ts`, `src/popup/site-status.ts`
- `SUPPORTED_SITE_LABELS` in `src/shared/brand.ts`
- `scrollStats`/`todayStats` defaults in `src/shared/extension-settings.ts`

### Settings

- `src/shared/extension-settings.ts`: full settings (`theme`, `loopVideo`, `pauseOnHover`, stats, …). Popup only.
- `src/content/runtime-settings.ts`: `{ enabled, debugLogging }` only. Content script only. Never import `extension-settings.ts` into content code.

Every storage reader (these two, `src/content/scroll-counter.ts`, `src/content-main/control.ts`) uses the same shim: `globalThis.browser?.storage`, then `globalThis.chrome?.storage`, handling both promise and callback `storage.local.get/set`.

### Packaging

`vite build` writes `dist/`. Then:

- `scripts/package-browser-builds.mjs` copies it to `dist/chromium/` (base manifest) and `dist/firefox/` (deep-merged with `manifest.firefox.json`).
- `scripts/package-safari-builds.mjs` writes `dist/safari/` (merged with `manifest.safari.json`); `scripts/build-safari-app.mjs` runs `xcodebuild` on `safari/`.

Background, content and content-main bundles must stay self-contained (classic scripts, no `import`). Rollup splits any module imported by two entries into a shared chunk, so never import a module into those bundles that a page (popup, changelog) also imports; `tests/browser-packaging.test.ts` fails if a bundle starts with `import`.

Overlay merge: arrays replace wholesale. A `null` value deletes the key in the Firefox merge only; the Safari merge does not handle `null`.

## Versioning

Git tags are `v<semver>` and match the extension version. `pnpm release <version>` (`scripts/release.mjs`, `--dry-run` to preview) bumps all version fields (`manifest.json`, `package.json`, `APP_VERSION` in `src/shared/brand.ts`, both `safari/*/Info.plist`, `SOURCE_BUILD.md`), refuses to run without a `src/shared/changelog.ts` entry for the version and dates it, runs `pnpm check`, commits, tags, and pushes. The tag triggers `.github/workflows/release.yml`: it publishes to the Chrome Web Store and addons.mozilla.org (with a `git archive` source upload for AMO review) and creates a GitHub release. A store is skipped with a warning when its secrets (`CHROME_*`, `AMO_JWT_*`) are missing. Safari is not automated. GSD milestones (`vX.Y` in `.planning/MILESTONES.md`) are planning labels, unrelated to semver.

## Testing

Vitest, `environment: "node"`, `globals: true`, `restoreMocks` and `clearMocks` on. Tests build DOMs with `new JSDOM(...)` directly; site fixtures live in `tests/fixtures/*.fixture.html`.
