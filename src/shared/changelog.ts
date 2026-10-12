// User-facing release notes, newest first. Rendered at build time into
// changelog/index.html. `pnpm release <version>` requires an entry for the
// version it ships and stamps its date.

export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD; absent until `pnpm release` ships the version. */
  date?: string;
  changes: ReadonlyArray<{ kind: ChangeKind; text: string }>;
}

/** Negative, zero or positive, like a sort comparator, for x.y.z versions. */
export function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: "0.1.4",
    date: "2026-10-12",
    changes: [
      { kind: "new", text: "This changelog. Open it from the version number in the popup." },
      { kind: "fixed", text: "Auto-scroll works on the first page load. YouTube could keep looping the first video, so it never ended until you reloaded." },
      { kind: "fixed", text: "Changing a setting no longer overwrites the videos counted while the popup was open." },
      { kind: "fixed", text: "“Today” stats reset at your local midnight instead of midnight UTC." },
      { kind: "improved", text: "Less work on busy feeds: fewer page scans while videos load and scroll." },
      { kind: "improved", text: "Reset stats asks for a second click before wiping your counts." },
      { kind: "improved", text: "TikTok and Facebook Reels move on with their own next-video arrows instead of scrolling the page." },
      { kind: "fixed", text: "Updating Brainrot reloads only open Shorts, Reels and TikTok feeds, not every YouTube, Facebook, Instagram or TikTok tab." },
      { kind: "fixed", text: "Keyboard users no longer tab onto the hidden stats when the list is collapsed." },
    ],
  },
  {
    version: "0.1.3",
    date: "2026-07-28",
    changes: [
      { kind: "new", text: "Reload button in the popup to restart the current tab." },
      { kind: "improved", text: "Background playback follows the on/off switch." },
      { kind: "improved", text: "Brainrot acts only on Shorts, Reels and TikTok feed pages, not the rest of each site." },
      { kind: "fixed", text: "A video that rewinds as it ends no longer skips two videos." },
    ],
  },
  {
    version: "0.1.2",
    date: "2026-04-18",
    changes: [
      { kind: "new", text: "Background playback: the video keeps playing while the tab is in the background, and the feed moves on when you come back." },
      { kind: "improved", text: "A video you pause stays paused." },
      { kind: "fixed", text: "Videos that loop on their own while the tab is hidden now advance when you return." },
    ],
  },
  {
    version: "0.1.1",
    date: "2026-04-14",
    changes: [
      { kind: "new", text: "First release: auto-advance on YouTube Shorts, TikTok, Facebook Reels and Instagram Reels." },
      { kind: "new", text: "Popup with the on/off switch, light and dark themes, and videos watched per site." },
    ],
  },
];
