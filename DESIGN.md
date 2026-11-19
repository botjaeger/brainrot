# DESIGN.md

Visual rules for Brainrot's two surfaces. Code is the source of truth: when a value here and the CSS disagree, fix this file.

| Surface | Files | Tokens |
|---------|-------|--------|
| Extension pages (popup, "What's new") | `src/popup/popup-template.ts`, `src/changelog/changelog-template.ts` | `THEME_TOKENS_CSS` in `src/shared/page-html.ts` |
| Website (landing, privacy, terms) | `site/*.html`, `site/style.css` | `:root` in `site/style.css` |

Both share the brand: a warm yellow accent on a near-black ink, the mascot (`assets/mascot.png`), and short, plain copy.

## Voice

- Short, warm, plain. "Just watch." beats "Seamless automated content progression".
- One term per thing: "videos", "feed", "switch on/off", "What's new".
- Say what happens, not how it is built. No jargon in user-facing text.
- Never claim more than the code does. Privacy and permission statements must match `manifest.json` and the stored settings.

## Extension pages

Colours come only from `THEME_TOKENS_CSS`; never hard-code a colour in a template. Light is the default; `data-theme="dark"` on `<html>` selects the dark set, from the stored `theme`.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#fcfcf9` | `#121212` | Page background |
| `--card-bg` | `#f5f5f2` | `#1a1a1a` | Cards, rows |
| `--hero-bg` | `#ffc107` | `#ffc20a` | Popup hero block |
| `--hero-text` / `--hero-subtext` | `#2b2100` / `#3a2d00` | `#1a1a1a` / `#3a2d00` | Text on the hero |
| `--ink` | `#1a1a1a` | `#f0f0f0` | Body text |
| `--muted` | `#6e6e6e` | `#949494` | Secondary text |
| `--accent-ink` | `#5c4b18` | `#ffc20a` | Accent as text or outline |
| `--danger-ink` | `#c62828` | `#ff7a75` | Destructive actions (reset) |
| `--hero-glow` | gold shadow, 0.15 | gold glow, 0.3 | Hero block shadow |
| `--danger-glow` | red glow, 0.4 | red glow, 0.4 | Armed reset text |

- Font: the system UI stack (`--font-main`). Extension pages load no web fonts.
- Popup width 400px, minimum 320px.
- Gold (`--hero-bg`) is a fill, never text on the light ground: it fails contrast there. Use `--accent-ink` for accent text.
- Destructive actions take two steps (Reset stats asks for a second click).
- Collapsed content is `inert`, so keyboard focus never lands on hidden controls.
- Motion stops under `prefers-reduced-motion: reduce` (`REDUCED_MOTION_CSS`).
- Icon-only buttons carry an `aria-label`; toggles expose their state (`aria-pressed`, `aria-expanded`, or a real checkbox).

## Website

Cream, yellow and charcoal, with a bold grotesque display face.

| Token | Value | Use |
|-------|-------|-----|
| `--cream` | `#f7f1e3` | Page background |
| `--sand` | `#efe5cf` | Alternate band (Get Brainrot), inline code |
| `--paper` | `#fffdf6` | Cards on cream |
| `--ink` / `--ink-2` / `--muted` | `#17150f` / `#36322b` / `#4f4a41` | Headings / body / secondary text |
| `--line` | `rgba(23, 21, 15, 0.12)` | Dividers |
| `--accent` / `--on-accent` | `#ffc20a` / `#1a1400` | Primary buttons, tiles, highlights |
| `--accent-ink` | `#5c4b18` | Accent as text on cream or sand ("Coming soon", "Last updated") |
| `--sticker` | `#ff6b3d` | The hero sticker and the pill dot only |
| `--night*` | `#17150f`, `#26231d`, `#f7f1e3`, `#cfc6b2` | Recordings band, the Open source card |

- Type: `--display` Bricolage Grotesque (800, tight tracking) for headings; `--body` Schibsted Grotesk for text, 17px/1.55. Both self-hosted via `@fontsource-variable`; never add a font CDN.
- Layout: content width `--wrap` 1200px with 24px side padding. Radius `--radius` 24px for cards, 999px for buttons and pills.
- Landing sections, in order: hero (the YouTube recording in a phone frame, the popup's Brainrot mode card, the Hands free sticker), the Works on strip, three numbered steps, the recordings band (one per supported site, 9:14 frames), What it does (a replica of the popup beside the four features), Get Brainrot (one card per browser), questions with the Privacy and Open source cards, the final call to action.
- The popup replica uses the extension's light tokens (`THEME_TOKENS_CSS`), not the website's; its counts are example numbers.
- Legal pages: a yellow "short version" box, then an "On this page" list beside a 760px text column; each `h2` sits in a `section` with an id the list links to.
- Buttons: `.btn-accent` (yellow) for the primary install action, `.btn-ink` for secondary, `.link-cta` for text links. The primary button targets the visitor's browser (`data-cta="primary"`), the secondary the other; the Get Brainrot cards keep their own store (`data-store`) (`main.ts`).
- Links hover to `#7a5c00`; focus is a 3px ink outline (`:focus-visible`), never removed.
- Motion: the bobbing phone, the caption's progress bar and hover lifts only. Everything stops under `prefers-reduced-motion: reduce`.
- Recordings are muted looping mp4 with a jpg poster in `site/media/`, never GIFs. They play only while on screen; under reduced motion they hold the poster and show native controls (`main.ts`).
- The site ships only files its pages reference (`publicDir: false`); `assets/` belongs to the extension. `404.html` links back home.
- Phone breakpoint at 560px: header nav links hide, section padding drops from 112px to 72px.

## Rules for both

- Every standalone link, button and summary is at least 44px tall; links inside running text are exempt. Exception: the popup is dense, so its controls are at least 24px in both dimensions (WCAG 2.2 target size).
- Text contrast at least 4.5:1, icons and outlines 3:1, in both themes.
- No horizontal scroll at 320px wide.
- No third-party requests: no font CDNs, no trackers. The website's only exception is Vercel Web Analytics, and only on `*.vercel.app`.
- Third-party names (YouTube, TikTok, Instagram, Facebook) appear only to say where Brainrot works; never their logos or styling.
