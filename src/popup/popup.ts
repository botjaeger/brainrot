import {
  DEFAULT_EXTENSION_SETTINGS,
  type ExtensionSettings,
  type ExtensionSettingsStore,
} from "../shared/extension-settings.js";
import type { SupportedSiteStatus } from "./site-status.js";
import { openExtensionPage, readActiveSupportedSite, reloadActiveTab } from "./site-status.js";

const RESET_CONFIRM_MS = 4000;

export interface PopupMountEnvironment {
  document: Document;
  store: ExtensionSettingsStore;
  readActiveSite?: () => Promise<SupportedSiteStatus | null>;
  openPage?: (path: string, base: string) => Promise<void>;
}

function getRequiredElement<T extends Element>(document: Document, selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing popup element: ${selector}`);
  }

  return element;
}

function renderExtensionState(
  document: Document,
  settings: ExtensionSettings,
  siteState: SupportedSiteStatus | null,
  statusChip: HTMLElement,
  statusCopy: HTMLElement,
): void {
  document.documentElement.dataset.enabled = String(settings.enabled);
  document.documentElement.dataset.theme = settings.theme;
  const version = document.documentElement.dataset.version;
  const changelogUnseen = settings.changelogSeenVersion !== version;
  document.documentElement.dataset.changelogUnseen = String(changelogUnseen);
  // The dot is visual only; say it to screen readers too.
  document
    .querySelector("#changelog-link")
    ?.setAttribute("aria-label", `What's new in v${version}${changelogUnseen ? " (unread)" : ""}`);

  document
    .querySelector("#theme-toggle")
    ?.setAttribute(
      "aria-label",
      settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );

  // Rendered only after the tab lookup settled, so null means it failed:
  // say what to do rather than "Checking" forever.
  const supported = siteState?.supported === true;
  document.documentElement.dataset.siteSupported = String(supported);
  statusChip.textContent = supported
    ? `${siteState.label} detected`
    : "Go to a supported feed to activate Brainrot mode";

  statusCopy.textContent = settings.enabled
    ? "No taps. No swipes. Just watch."
    : "Auto scroll paused.";

  // Update Stats counts
  for (const [key, count] of Object.entries(settings.scrollStats ?? {})) {
    const span = document.querySelector(`[data-count="${key}"]`);
    if (span) {
      span.textContent = String(count);
    }
  }

  // Update today total
  const todayStats =
    settings.todayDate === new Date().toLocaleDateString("en-CA")
      ? (settings.todayStats ?? {})
      : {};
  const todayTotal = Object.values(todayStats).reduce((sum, n) => sum + n, 0);
  const todaySpan = document.querySelector("[data-today-count]");
  const todayCopy = document.querySelector("[data-today-copy]");
  const allTimeTotal = Object.values(settings.scrollStats ?? {}).reduce((sum, n) => sum + n, 0);
  const hint = document.querySelector("#first-run-hint");
  if (hint) hint.classList.toggle("hidden", allTimeTotal > 0);

  if (todayTotal === 0) {
    if (todaySpan) todaySpan.textContent = "";
    if (todayCopy) todayCopy.textContent = "Start watching 👀";
  } else {
    if (todaySpan) todaySpan.textContent = String(todayTotal);
    if (todayCopy) {
      todayCopy.textContent =
        todayTotal < 25
          ? "videos watched today"
          : todayTotal < 50
            ? "videos today... nice."
            : "videos. You're in deep now";
    }
  }
}

function renderSiteState(siteState: SupportedSiteStatus | null, statsRows: HTMLElement[]): void {
  const kind = siteState?.kind ?? "checking";

  // Update Stats rows active state
  for (const row of statsRows) {
    const isActive = row.dataset.siteStats === kind;
    if (isActive) {
      row.classList.add("active");
    } else {
      row.classList.remove("active");
    }
  }
}

export async function mountPopup({
  document,
  store,
  readActiveSite = readActiveSupportedSite,
  openPage = openExtensionPage,
}: PopupMountEnvironment): Promise<void> {
  const enabledToggle = getRequiredElement<HTMLInputElement>(document, "#enabled-toggle");
  const themeToggle = getRequiredElement<HTMLElement>(document, "#theme-toggle");

  const statusChip = getRequiredElement<HTMLElement>(document, "[data-status-chip]");
  const statusCopy = getRequiredElement<HTMLElement>(document, "[data-status-copy]");
  const statsRows = Array.from(document.querySelectorAll<HTMLElement>("[data-site-stats]"));
  const statsToggle = getRequiredElement<HTMLElement>(document, "#stats-toggle");
  const statsList = getRequiredElement<HTMLElement>(document, "#stats-list");
  statsToggle.addEventListener("click", () => {
    const isOpen = document.documentElement.dataset.statsOpen === "true";
    const nextOpen = !isOpen;
    document.documentElement.dataset.statsOpen = String(nextOpen);
    statsToggle.setAttribute("aria-expanded", String(nextOpen));
    statsList.toggleAttribute("inert", !nextOpen);
  });

  const [initialSettings, activeSite] = await Promise.all([
    store.read().catch(() => DEFAULT_EXTENSION_SETTINGS),
    readActiveSite().catch(() => null),
  ]);

  let currentSettings = initialSettings;
  const currentSiteState = activeSite;

  const render = (settings: ExtensionSettings): void => {
    enabledToggle.checked = settings.enabled;
    renderExtensionState(document, settings, currentSiteState, statusChip, statusCopy);
  };

  // Render optimistically, persist only the changed keys, roll back on failure.
  const commitSettings = async (patch: Partial<ExtensionSettings>): Promise<void> => {
    const previousSettings = currentSettings;
    currentSettings = { ...currentSettings, ...patch };
    render(currentSettings);

    try {
      await store.write(patch);
    } catch {
      currentSettings = previousSettings;
      render(currentSettings);
    }
  };

  enabledToggle.addEventListener("change", () => {
    void commitSettings({ enabled: enabledToggle.checked });
  });

  const hero = getRequiredElement<HTMLElement>(document, ".hero");
  hero.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("#reload-tab") || target.closest(".switch")) return;
    void commitSettings({ enabled: !currentSettings.enabled });
  });

  themeToggle.addEventListener("click", () => {
    void commitSettings({
      theme: currentSettings.theme === "light" ? "dark" : "light",
    });
  });

  const changelogLink = document.querySelector<HTMLElement>("#changelog-link");
  changelogLink?.addEventListener("click", () => {
    const version = document.documentElement.dataset.version ?? "";
    if (currentSettings.changelogSeenVersion !== version) {
      void commitSettings({ changelogSeenVersion: version });
    }
    void openPage("../changelog/index.html", document.baseURI).catch(() => undefined);
  });

  const reloadBtn = document.querySelector<HTMLElement>("#reload-tab");
  reloadBtn?.addEventListener("click", () => {
    void reloadActiveTab().catch(() => undefined);
  });

  // Wiping every count is not undoable, so the first click only arms it.
  const resetBtn = document.querySelector<HTMLElement>("#reset-stats");
  const resetLabel = resetBtn?.textContent ?? "";
  let resetDisarmTimer: ReturnType<typeof setTimeout> | null = null;
  const disarmReset = (): void => {
    if (resetDisarmTimer !== null) clearTimeout(resetDisarmTimer);
    resetDisarmTimer = null;
    if (!resetBtn) return;
    delete resetBtn.dataset.confirming;
    resetBtn.textContent = resetLabel;
  };
  resetBtn?.addEventListener("blur", disarmReset);
  resetBtn?.addEventListener("click", () => {
    if (resetBtn.dataset.confirming !== "true") {
      resetBtn.dataset.confirming = "true";
      resetBtn.textContent = "Click again to reset all stats";
      resetDisarmTimer = setTimeout(disarmReset, RESET_CONFIRM_MS);
      return;
    }

    disarmReset();
    void commitSettings({
      scrollStats: DEFAULT_EXTENSION_SETTINGS.scrollStats,
      todayDate: DEFAULT_EXTENSION_SETTINGS.todayDate,
      todayStats: DEFAULT_EXTENSION_SETTINGS.todayStats,
    });
  });

  render(currentSettings);
  renderSiteState(currentSiteState, statsRows);

  // Keep counts live — content script increments scrollStats in storage
  // while the popup is open; re-render whenever storage changes.
  store.watch?.((freshSettings) => {
    currentSettings = freshSettings;
    render(currentSettings);
  });

  document.documentElement.classList.add("is-ready");
}
