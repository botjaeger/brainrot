# AGENTS.md

Guide for coding agents (Codex, Claude Code via `CLAUDE.md`) and contributors. Product overview: `README.md`. Visual rules: `DESIGN.md`.

Brainrot: MV3 browser extension that auto-advances short-form feeds (YouTube Shorts, Facebook Reels, TikTok, Instagram Reels) when a video ends. Targets Chromium, Firefox, and desktop Safari. No backend. The repo also holds the marketing site (`site/`).

Scope stays narrow: auto-advance, background playback, local stats. No filters, block lists, accounts, sync or remote services. Safari is desktop macOS only.

## Commands

```bash
pnpm check              # Gate: typecheck + all tests (tests/global-setup.ts builds dist/ once first)
pnpm release 0.1.5      # Bump, check, commit, tag, push; the tag makes CI publish to the stores
pnpm test               # vitest run
pnpm exec vitest run tests/popup.test.ts   # one file
pnpm exec vitest run -t "theme toggle"     # by test name
pnpm typecheck          # tsc --noEmit
pnpm build              # dist/ + dist/chromium + dist/firefox + dist/safari
pnpm build:base         # Vite only (dist/ root)
pnpm build:chromium     # build:base + dist/chromium (likewise build:firefox, build:safari)
pnpm chrome:zip         # build + brainrot-chrome.zip (likewise firefox:zip)
pnpm firefox:run        # web-ext on dist/firefox
pnpm safari:run         # macOS + Xcode; app builds to /tmp/brainrot-safari
pnpm dev:site           # Marketing site dev server
pnpm build:site         # Marketing site to dist/site
```

`pnpm check` is the whole local gate; CI runs the same command. Node 22, pnpm 11.7.0 (`packageManager`).

## Architecture

### Entry points (`vite.config.ts`)

The input key is the output filename. The manifest and popup HTML reference these paths; renaming a key silently breaks the extension.

| Key | Role |
|-----|------|
| `background/index` | Service worker (Firefox: `background.scripts`). On install or update, reloads open feed tabs and registers the MAIN-world spoof dynamically (Safari fallback). |
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

Each adapter in `src/sites/` owns its advance strategy: usually the site's own "next" button, then a site container scroll, then `scrollDocumentForward()` from `src/shared/dom.ts`. Selectors change without notice; check a new one on the live site before relying on it.

Supported-site knowledge is duplicated. A new site touches all of these:

- `src/sites/<site>.ts` adapter, added to `DEFAULT_FEED_SITES` in `feed-engine.ts`
- `manifest.json`: all three `content_scripts` `matches` arrays
- `SUPPORTED_URL_PATTERNS` and `isFeedUrl()` in `src/background/index.ts` (self-contained; the update reloads only feed tabs)
- `isSupportedFeed()` in `src/content-main/spoof.ts` (self-contained; cannot import)
- `src/content/site-key.ts`, `src/popup/site-status.ts`
- `SUPPORTED_SITE_LABELS` in `src/shared/brand.ts`
- `scrollStats`/`todayStats` defaults in `src/shared/extension-settings.ts`
- user-facing lists: `README.md`, `site/index.html`, `site/privacy.html` (host permissions), `site/terms.html`

### Settings

- `src/shared/extension-settings.ts`: full settings (`enabled`, `debugLogging`, `scrollStats`, `todayDate`, `todayStats`, `theme`, `changelogSeenVersion`). Popup only.
- `src/content/runtime-settings.ts`: `{ enabled, debugLogging }` only. Content script only. Never import `extension-settings.ts` into content code.

Every storage reader (these two, `src/content/scroll-counter.ts`, `src/content-main/control.ts`) uses the same shim: `globalThis.browser?.storage`, then `globalThis.chrome?.storage`, handling both promise and callback `storage.local.get/set`.

A new stored value must also be listed in `site/privacy.html` ("What the extension stores on your device").

### Packaging

`vite build` writes `dist/`. Then:

- `scripts/package-browser-builds.mjs` copies it to `dist/chromium/` (base manifest) and `dist/firefox/` (deep-merged with `manifest.firefox.json`).
- `scripts/package-safari-builds.mjs` writes `dist/safari/` (merged with `manifest.safari.json`); `scripts/build-safari-app.mjs` runs `xcodebuild` on `safari/`.
- `scripts/zip-chrome.mjs` and `scripts/zip-firefox.mjs` write the store zips at the repo root (git-ignored).

Background, content and content-main bundles must stay self-contained (classic scripts, no `import`). Rollup splits any module imported by two entries into a shared chunk, so never import a module into those bundles that a page (popup, changelog) also imports; `tests/browser-packaging.test.ts` fails if a bundle starts with `import`.

Overlay merge: arrays replace wholesale. A `null` value deletes the key in the Firefox merge only; the Safari merge does not handle `null`.

### Marketing site (`site/`)

Static Vite site: `index.html`, `privacy.html`, `terms.html` (all inputs in `vite.site.config.ts`), `style.css`, `main.ts`. `main.ts` may import only from `src/shared/` (store links from `store-urls.ts`, the version from `manifest.json`). It points the primary install buttons at the visitor's browser and the secondary ones at the other.

- Fonts are self-hosted through `@fontsource-variable/*`; the site makes no third-party requests on GitHub Pages.
- Vercel Web Analytics loads only on `*.vercel.app` (and in dev); GitHub Pages would 404 its script.
- Hosts: `.github/workflows/site.yml` deploys every green `main` push to the public repo `botjaeger/brainrot` (GitHub Pages, `https://botjaeger.github.io/brainrot/`, built with `--base /brainrot/`). `vercel.json` builds the same site for Vercel.
- The privacy and terms pages are the store listings' and Google OAuth branding's policy URLs. Keep their facts (permissions, stored values, hosts) true when the code changes.

## Releases and CI

Git tags are `v<semver>` and match the extension version. `pnpm release <version>` (`scripts/release.mjs`, `--dry-run` to preview) bumps all version fields (`manifest.json`, `package.json`, `APP_VERSION` in `src/shared/brand.ts`, both `safari/*/Info.plist`, `SOURCE_BUILD.md`), refuses to run without a `src/shared/changelog.ts` entry for the version and dates it, runs `pnpm check`, commits, tags, and pushes. Pushing to `main` alone never releases.

Workflows:

| Workflow | Trigger | Does |
|----------|---------|------|
| `site.yml` | push to `main`, manual | `pnpm check` + site build, then deploys the site |
| `release.yml` | `v*.*.*` tag | `build` job (version check, `pnpm check`, zips, `git archive` source zip); then `chrome`, `firefox` and `github-release` jobs in parallel |

The store jobs are independent: one store's rejection never skips the other, and a failed job can be re-run alone from the Actions page. A store is skipped with a warning when its secrets (`CHROME_*`, `AMO_JWT_*`) are missing. AMO reviewers rebuild from the source zip with `SOURCE_BUILD.md`. Safari is not automated.

GSD milestones (`vX.Y` in `.planning/MILESTONES.md`) are planning labels, unrelated to semver.

## Testing

Vitest, `environment: "node"`, `globals: true`, `restoreMocks` and `clearMocks` on. Tests build DOMs with `new JSDOM(...)` directly; site fixtures live in `tests/fixtures/*.fixture.html`. Prefer a fixture captured from the live site over a hand-written one.
