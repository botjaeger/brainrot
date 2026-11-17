<p align="center">
  <img src="assets/mascot.png" alt="Brainrot mascot: a yellow brain holding a phone" width="200" />
</p>

# Brainrot - Auto Scroll for Shorts & Reels

Brainrot moves short-form feeds to the next video when the current one ends, so you can watch hands-free.

No tapping. No swiping. Just watch.

- Website: https://botjaeger.github.io/brainrot/
- Chrome Web Store: https://chromewebstore.google.com/detail/brainrot-auto-scroll-for/epnminblfookppcemedaonmnanembgik
- Firefox Add-ons: https://addons.mozilla.org/en-US/firefox/addon/brainrot-auto-scroll/

## Supported sites

- YouTube Shorts
- TikTok
- Facebook Reels
- Instagram Reels

## Features

- **Auto-advance**: moves to the next video when the current one ends, using the site's own "next" button where it has one.
- **Background playback**: the video keeps playing while the tab is in the background, and the feed moves on when you come back.
- **Stats**: videos watched per site, all-time and today (resets at your local midnight).
- **One switch**: turn Brainrot on or off from the popup; it acts only on feed pages.
- **Light and dark themes**.
- **What's new**: click the version number in the popup to see the changelog.
- **Cross-browser**: Chrome, Edge, Brave, Firefox and desktop Safari.

## Getting started

1. Install from the Chrome Web Store or Firefox Add-ons.
2. Open YouTube Shorts, TikTok, or Instagram or Facebook Reels.
3. Make sure Brainrot is switched on in the popup.
4. Sit back and watch.

## Privacy

Brainrot collects no personal data and makes no network requests. Settings and counts stay in your browser. Full policy: https://botjaeger.github.io/brainrot/privacy.html. Terms: https://botjaeger.github.io/brainrot/terms.html.

## Development

Requires Node 22 and pnpm 11.7.0.

```bash
pnpm install            # Dev tools and the pre-commit hook
pnpm check              # Prettier check + ESLint + typecheck + all tests (the gate CI and the pre-commit hook run)
pnpm format             # Apply Prettier
pnpm build              # dist/chromium, dist/firefox, dist/safari
pnpm test:watch         # Tests in watch mode
pnpm dev:site           # Marketing site dev server
```

### Load an unpacked build

- **Chrome / Edge / Brave**: `pnpm build`, open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, pick `dist/chromium/`.
- **Firefox**: `pnpm build`, then `pnpm firefox:run`, or load `dist/firefox/manifest.json` as a temporary add-on in `about:debugging`.
- **Safari (macOS, Xcode)**: `pnpm safari:run`.

### Release

1. Add the version's notes to `src/shared/changelog.ts`.
2. `pnpm release 0.1.5` bumps every version field, runs `pnpm check`, commits, tags `v0.1.5` and pushes.
3. The tag runs `.github/workflows/release.yml`: one gate job, then Chrome Web Store, Firefox Add-ons and the GitHub release as separate jobs.

Pushing to `main` deploys the website only; it never publishes the extension.

## Project structure

```
src/
  background/     Service worker: reloads feed tabs on install/update
  content/        Content script: feed engine startup, stats, SPA navigation
  content-main/   MAIN-world visibility spoof (background playback) and its bridge
  core/           Feed engine (site-agnostic auto-advance)
  sites/          Per-site adapters (YouTube, TikTok, Facebook, Instagram)
  popup/          Popup UI (HTML generated at build time)
  changelog/      "What's new" page (HTML generated at build time)
  shared/         Settings, changelog data, DOM helpers, brand, store links
site/             Marketing website, privacy policy and terms
safari/           Xcode project for the Safari app
scripts/          Packaging, zips and release
tests/            Vitest suite and live-site fixtures
```

## Documentation

- `AGENTS.md`: architecture, conventions, release and CI (also loaded by `CLAUDE.md`).
- `DESIGN.md`: colours, type and component rules for the extension pages and the website.
- `SOURCE_BUILD.md`: reproducible build for Firefox Add-ons review.

## License

MIT. See `LICENSE`.
