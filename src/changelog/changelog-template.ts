import { APP_NAME } from "../shared/brand.js";
import {
  CHANGELOG,
  compareVersions,
  type ChangeKind,
  type ChangelogEntry,
} from "../shared/changelog.js";
import { escapeHtml, REDUCED_MOTION_CSS, THEME_TOKENS_CSS } from "../shared/page-html.js";

const KIND_LABELS: Record<ChangeKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderRelease(entry: ChangelogEntry, installed: string): string {
  const isInstalled = entry.version === installed;
  const date = entry.date
    ? `<time datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>`
    : "";
  const changes = entry.changes
    .map(
      (change) => `
          <li class="change">
            <span class="kind kind-${change.kind}">${KIND_LABELS[change.kind]}</span>
            <span class="change-text">${escapeHtml(change.text)}</span>
          </li>`,
    )
    .join("");

  return `
      <li class="release${isInstalled ? " is-installed" : ""}" data-release="${escapeHtml(entry.version)}">
        <div class="release-meta">
          <h2 class="release-version">v${escapeHtml(entry.version)}</h2>
          ${date}
          ${isInstalled ? '<span class="installed-badge">Installed</span>' : ""}
        </div>
        <ul class="changes">${changes}
        </ul>
      </li>`;
}

/**
 * Builds changelog/index.html. Only versions up to the installed one are
 * listed, so notes written ahead of a release stay hidden until it ships.
 */
export function createChangelogHtml({
  version,
  entries = CHANGELOG,
}: {
  version: string;
  entries?: readonly ChangelogEntry[];
}): string {
  const releases = entries
    .filter((entry) => compareVersions(entry.version, version) <= 0)
    .map((entry) => renderRelease(entry, version))
    .join("");

  return `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>What's new · ${escapeHtml(APP_NAME)}</title>
    <link rel="icon" href="../assets/icon-32.png" />
    <style>${THEME_TOKENS_CSS}
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font-main);
        -webkit-font-smoothing: antialiased;
        line-height: 1.5;
      }

      /* Hidden until the stored theme is applied, so dark users see no flash. */
      html:not(.is-ready) body {
        opacity: 0;
      }

      .is-ready body {
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 56px 24px 80px;
      }

      .masthead {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 48px;
      }

      .masthead img {
        width: 72px;
        height: 72px;
        flex: none;
      }

      .eyebrow {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
      }

      h1 {
        margin: 2px 0 0;
        font-size: 40px;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.05;
      }

      .releases {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .release {
        display: grid;
        grid-template-columns: 148px minmax(0, 1fr);
        gap: 24px;
        padding: 28px 0;
        border-top: 1px solid var(--card-bg);
      }

      .release:first-child {
        border-top: none;
        padding-top: 0;
      }

      .release.is-installed {
        border-top: none;
        margin: 0 -24px;
        padding: 24px;
        background: var(--card-bg);
        border-radius: 28px;
      }

      .release.is-installed + .release {
        border-top: none;
      }

      .release-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .release-version {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      time {
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }

      .installed-badge {
        margin-top: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--hero-bg);
        color: var(--hero-text);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .changes {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .change {
        display: flex;
        align-items: baseline;
        gap: 12px;
        font-size: 15px;
      }

      .kind {
        flex: none;
        min-width: 84px;
        padding: 1px 0;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-align: center;
        text-transform: uppercase;
      }

      .kind-new {
        background: var(--hero-bg);
        color: var(--hero-text);
      }

      .kind-improved {
        border-color: var(--accent-ink);
        color: var(--accent-ink);
      }

      .kind-fixed {
        border-color: var(--muted);
        color: var(--muted);
      }

      @media (max-width: 560px) {
        .page {
          padding-top: 32px;
        }

        h1 {
          font-size: 32px;
        }

        .release {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
        }

        .release-meta {
          flex-direction: row;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 4px 12px;
        }

        .release.is-installed {
          margin: 0 -12px;
          padding: 20px 12px;
        }

        .installed-badge {
          margin-top: 0;
        }
      }
${REDUCED_MOTION_CSS}    </style>
  </head>
  <body>
    <main class="page">
      <header class="masthead">
        <img src="../assets/mascot.png" alt="" />
        <div>
          <p class="eyebrow">${escapeHtml(APP_NAME)} v${escapeHtml(version)}</p>
          <h1>What's new</h1>
        </div>
      </header>
      <ol class="releases">${releases}
      </ol>
    </main>
    <script type="module" src="./index.js"></script>
  </body>
</html>
`;
}
