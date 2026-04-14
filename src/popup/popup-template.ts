import {
  APP_NAME,
  APP_VERSION,
} from "../shared/brand.js";

const iconSunSvg = `
  <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
`.trim();

const iconMoonSvg = `
  <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
`.trim();

const iconTikTok = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="18" r="3"/>
    <path d="M9 18V5l12-2"/>
  </svg>
`.trim();

const iconYouTube = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
    <path d="m10 15 5-3-5-3z"/>
  </svg>
`.trim();

const iconFacebook = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
`.trim();

const iconInstagram = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
`.trim();

const iconCheckSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
`.trim();

const iconArrowUpSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
`.trim();

const iconRefreshSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
  </svg>
`.trim();

const iconTrashSvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
`.trim();

export function createPopupHtml(): string {
  return `<!doctype html>
<html lang="en" data-enabled="true" data-theme="light" data-stats-open="false">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${APP_NAME}</title>
    <style>
      :root {
        --bg: #fcfcf9;
        --card-bg: #f5f5f2;
        --hero-bg: #ffc107;
        --hero-text: #2b2100;
        --ink: #1a1a1a;
        --muted: #6e6e6e;
        --accent-brown: #5c4b18;
        --hero-subtext: #3a2d00;
        --switch-track: #1a1a1a;
        --switch-thumb: #ffffff;
        --status-pill-bg: rgba(0, 0, 0, 0.05);
        --stats-row-bg: var(--card-bg);
        --stats-row-active-bg: #fefcf3;
        --stats-row-active-border: rgba(255, 193, 7, 0.5);
        --stats-glow: none;
        
        --font-main: "Segoe UI", "Segoe UI Variable", system-ui, -apple-system, sans-serif;
        --shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      :root[data-theme="dark"] {
        --bg: #121212;
        --card-bg: #1a1a1a;
        --hero-bg: #ffc20a;
        --hero-text: #1a1a1a;
        --ink: #f0f0f0;
        --muted: #949494;
        --accent-brown: #d1b86e;
        --hero-subtext: #3a2d00;
        --switch-track: #2a2a2a;
        --switch-thumb: #f0f0f0;
        --status-pill-bg: rgba(0, 0, 0, 0.1);
        --stats-row-bg: #1a1a1a;
        --stats-row-active-bg: #1a1a1a;
        --stats-row-active-border: rgba(255, 194, 10, 0.4);
        --stats-glow: 0 0 15px rgba(255, 194, 10, 0.25);
        --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        width: 400px;
        min-width: 320px;
        max-height: 600px;
        overflow-y: auto;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font-main);
        -webkit-font-smoothing: antialiased;
        padding: 16px;
      }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding: 0 4px;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .logo-mascot {
        width: 56px;
        height: 56px;
      }

      .version {
        font-size: 11px;
        font-weight: 500;
        color: var(--muted);
        margin-left: 4px;
        margin-top: 4px;
      }

      .theme-toggle {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--muted);
        border-radius: 50%;
        transition: .2s;
        border: 1px solid transparent;
        background: none;
        padding: 0;
      }

      .theme-toggle:hover {
        background: var(--card-bg);
        color: var(--ink);
      }

      .theme-toggle svg {
        width: 22px;
        height: 22px;
      }

      .icon-moon { display: none; }
      :root[data-theme="dark"] .icon-sun { display: none; }
      :root[data-theme="dark"] .icon-moon { display: block; }

      /* Hero Control */
      .hero {
        background: var(--hero-bg);
        border-radius: 32px;
        padding: 24px;
        margin-bottom: 32px;
        color: var(--hero-text);
        position: relative;
        box-shadow: 0 8px 24px rgba(255, 193, 7, 0.15);
        transition: transform 0.15s ease;
        cursor: pointer;
        user-select: none;
      }

      .hero:active {
        transform: scale(0.98);
      }

      :root[data-theme="dark"] .hero {
        box-shadow: 0 0 30px rgba(255, 194, 10, 0.3);
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .hero-title {
        margin: 0;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }

      .hero-subtitle {
        margin: 4px 0 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--hero-subtext);
      }

      /* Switch */
      .switch {
        position: relative;
        width: 64px;
        height: 36px;
        flex: none;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .track {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: var(--switch-track);
        transition: .3s;
        border-radius: 34px;
      }

      .thumb {
        position: absolute;
        content: "";
        height: 28px;
        width: 28px;
        left: 4px;
        bottom: 4px;
        background-color: var(--switch-thumb);
        transition: .3s;
        border-radius: 50%;
      }

      input:checked + .track .thumb {
        transform: translateX(28px);
      }

      /* Detection Pill */
      .detection-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--status-pill-bg);
        border-radius: 999px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 700;
      }

      .check-icon {
        width: 16px;
        height: 16px;
        min-width: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hero-text);
        color: var(--hero-bg);
        border-radius: 50%;
      }
      
      .check-icon svg {
        width: 10px;
        height: 10px;
      }

      /* Reload Button */
      .reload-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--hero-text);
        opacity: 0.6;
        border-radius: 50%;
        transition: opacity 0.2s, background 0.2s;
      }

      .reload-btn:hover {
        opacity: 1;
        background: var(--status-pill-bg);
      }

      .reload-btn svg {
        width: 14px;
        height: 14px;
      }

      /* Reset Button */
      .reset-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px;
        margin-top: 4px;
        background: none;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        color: var(--muted);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        transition: color 0.2s, text-shadow 0.2s;
      }

      .reset-btn:hover {
        color: #e53935;
        text-shadow: 0 0 12px rgba(229, 57, 53, 0.4);
      }

      /* Stats */
      .stats-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.1em;
        color: var(--muted);
        margin-bottom: 0;
        padding: 4px;
        cursor: pointer;
        user-select: none;
        border-radius: 8px;
        transition: color 0.2s;
        background: none;
        border: none;
        width: 100%;
        font-family: inherit;
      }

      .stats-header:hover {
        color: var(--ink);
      }

      .stats-chevron {
        display: flex;
        align-items: center;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .stats-chevron svg {
        width: 14px;
        height: 14px;
      }

      [data-stats-open="true"] .stats-chevron {
        transform: rotate(180deg);
      }

      .stats-list {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        margin-top: 0;
        transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, margin-top 0.25s ease;
      }

      .stats-list-inner {
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow: hidden;
      }

      [data-stats-open="true"] .stats-list {
        grid-template-rows: 1fr;
        opacity: 1;
        margin-top: 16px;
      }

      .stats-today {
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        color: var(--muted);
        padding: 12px 0;
      }

      .stats-today [data-today-count] {
        color: var(--hero-bg);
        font-size: 20px;
        font-weight: 800;
      }

      .stats-row {
        background: var(--stats-row-bg);
        border: 1px solid transparent;
        border-radius: 28px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .stats-left {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .stats-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .stats-icon svg {
        width: 20px;
        height: 20px;
      }

      .stats-right {
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }

      .stats-row.active {
        background: var(--stats-row-active-bg);
        border-color: var(--stats-row-active-border);
        box-shadow: var(--stats-glow);
      }

      .stats-row.active .stats-right {
        color: var(--hero-bg);
      }

      .active-badge {
        display: none;
        font-size: 11px;
        font-weight: 600;
        color: var(--hero-bg);
        opacity: 0.8;
      }

      .active-badge::before {
        content: "·";
        margin-right: 4px;
      }

      .stats-row.active .active-badge {
        display: inline;
      }

      /* First-run hint */
      .first-run-hint {
        text-align: center;
        font-size: 13px;
        color: var(--muted);
        background: var(--card-bg);
        border-radius: 16px;
        padding: 16px 20px;
        margin-top: 16px;
        line-height: 1.5;
      }

      [data-stats-open="true"] .first-run-hint {
        margin-bottom: 16px;
      }

      .first-run-hint.hidden {
        display: none;
      }

      /* Focus */
      :focus-visible {
        outline: 2px solid var(--hero-bg);
        outline-offset: 3px;
        border-radius: 4px;
      }

      .hero :focus-visible {
        outline-color: var(--hero-text);
      }

      /* Animations */
      .is-ready body {
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">
        <img class="logo-mascot" src="../assets/mascot.png" alt="" />
        <span>${APP_NAME}</span>
        <span class="version">v${APP_VERSION}</span>
      </div>
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme" type="button">
        ${iconSunSvg}
        ${iconMoonSvg}
      </button>
    </div>

    <div class="hero">
      <div class="hero-top">
        <div>
          <h1 class="hero-title" id="hero-title">Brainrot mode</h1>
          <p class="hero-subtitle" data-status-copy>No taps. No swipes. Just watch.</p>
        </div>
        <label class="switch">
          <input type="checkbox" id="enabled-toggle" aria-labelledby="hero-title">
          <span class="track"><span class="thumb"></span></span>
        </label>
      </div>
      <div class="detection-pill">
        <span class="check-icon">${iconCheckSvg}</span>
        <span data-status-chip aria-live="polite">Checking active tab</span>
        <button class="reload-btn" id="reload-tab" type="button" aria-label="Reload page">${iconRefreshSvg}</button>
      </div>
    </div>

    <button class="stats-header" id="stats-toggle" type="button" aria-expanded="false">
      <span>STATS</span>
      <span class="stats-chevron">${iconArrowUpSvg}</span>
    </button>

    <div class="stats-list">
      <div class="stats-list-inner">
      <div class="stats-today">
        <span data-today-count>0</span> <span data-today-copy>videos today</span>
      </div>
      <div class="stats-row" data-site-stats="tiktok">
        <div class="stats-left">
          <div class="stats-icon">${iconTikTok}</div>
          <span>TikTok</span>
          <span class="active-badge">Active now</span>
        </div>
        <div class="stats-right"><span data-count="tiktok">0</span> watched</div>
      </div>
      <div class="stats-row" data-site-stats="youtube-shorts">
        <div class="stats-left">
          <div class="stats-icon">${iconYouTube}</div>
          <span>YouTube Shorts</span>
          <span class="active-badge">Active now</span>
        </div>
        <div class="stats-right"><span data-count="youtube-shorts">0</span> watched</div>
      </div>
      <div class="stats-row" data-site-stats="facebook-reels">
        <div class="stats-left">
          <div class="stats-icon">${iconFacebook}</div>
          <span>Facebook Reels</span>
          <span class="active-badge">Active now</span>
        </div>
        <div class="stats-right"><span data-count="facebook-reels">0</span> watched</div>
      </div>
      <div class="stats-row" data-site-stats="instagram-reels">
        <div class="stats-left">
          <div class="stats-icon">${iconInstagram}</div>
          <span>Instagram Reels</span>
          <span class="active-badge">Active now</span>
        </div>
        <div class="stats-right"><span data-count="instagram-reels">0</span> watched</div>
      </div>
      <button class="reset-btn" id="reset-stats" type="button">Reset stats</button>
      </div>
    </div>

    <div class="first-run-hint" id="first-run-hint">
      Try it:<br>
      Open YouTube Shorts → enable Brainrot mode
    </div>

    <script type="module" src="./popup.js"></script>
  </body>
</html>
`;
}
