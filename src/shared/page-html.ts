// Build-time helpers shared by the extension pages generated as HTML strings
// (popup, changelog). `data-theme` on <html> selects the dark token set.
export const THEME_TOKENS_CSS = `
      :root {
        --bg: #fcfcf9;
        --card-bg: #f5f5f2;
        --hero-bg: #ffc107;
        --hero-text: #2b2100;
        --ink: #1a1a1a;
        --muted: #6e6e6e;
        /* Accent as text or outline: gold fails contrast on the light ground. */
        --accent-ink: #5c4b18;
        --hero-subtext: #3a2d00;
        --danger-ink: #c62828;
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
        --accent-ink: #ffc20a;
        --hero-subtext: #3a2d00;
        --danger-ink: #ff7a75;
        --switch-track: #2a2a2a;
        --switch-thumb: #f0f0f0;
        --status-pill-bg: rgba(0, 0, 0, 0.1);
        --stats-row-bg: #1a1a1a;
        --stats-row-active-bg: #1a1a1a;
        --stats-row-active-border: rgba(255, 194, 10, 0.4);
        --stats-glow: 0 0 15px rgba(255, 194, 10, 0.25);
        --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
`;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
