import { DEFAULT_EXTENSION_SETTINGS, type ExtensionSettings, type ExtensionSettingsStore } from "../shared/extension-settings.js";
import type { SupportedSiteStatus } from "./site-status.js";
import { readActiveSupportedSite, reloadActiveTab } from "./site-status.js";

export interface PopupMountEnvironment {
  document: Document;
  store: ExtensionSettingsStore;
  readActiveSite?: () => Promise<SupportedSiteStatus | null>;
}

function getRequiredElement<T extends Element>(
  document: Document,
  selector: string,
): T {
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

  if (!siteState) {
    statusChip.textContent = "Checking active tab";
  } else {
    statusChip.textContent = siteState.supported
      ? `${siteState.label} detected`
      : "Go to a supported feed to activate Brainrot mode";
  }

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
  const today = new Date().toISOString().slice(0, 10);
  const todayStats = settings.todayDate === today ? settings.todayStats ?? {} : {};
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
        todayTotal < 25 ? "videos watched today"
        : todayTotal < 50 ? "videos today... nice."
        : "videos. You're in deep now";
    }
  }
}

function renderSiteState(
  siteState: SupportedSiteStatus | null,
  statsRows: HTMLElement[],
): void {
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

async function writeNextSettings(
  store: ExtensionSettingsStore,
  document: Document,
  nextSettings: ExtensionSettings,
  previousSettings: ExtensionSettings,
  siteState: SupportedSiteStatus | null,
  statusChip: HTMLElement,
  statusCopy: HTMLElement,
): Promise<void> {
  renderExtensionState(
    document,
    nextSettings,
    siteState,
    statusChip,
    statusCopy,
  );

  try {
    await store.write(nextSettings);
  } catch {
    renderExtensionState(
      document,
      previousSettings,
      siteState,
      statusChip,
      statusCopy,
    );
  }
}

export async function mountPopup({
  document,
  store,
  readActiveSite = readActiveSupportedSite,
}: PopupMountEnvironment): Promise<void> {
  const enabledToggle = getRequiredElement<HTMLInputElement>(
    document,
    "#enabled-toggle",
  );
  const themeToggle = getRequiredElement<HTMLElement>(
    document,
    "#theme-toggle",
  );

  const statusChip = getRequiredElement<HTMLElement>(
    document,
    "[data-status-chip]",
  );
  const statusCopy = getRequiredElement<HTMLElement>(
    document,
    "[data-status-copy]",
  );
  const statsRows = Array.from(
    document.querySelectorAll<HTMLElement>("[data-site-stats]"),
  );
  const statsToggle = getRequiredElement<HTMLElement>(document, "#stats-toggle");
  statsToggle.addEventListener("click", () => {
    const isOpen = document.documentElement.dataset.statsOpen === "true";
    const nextOpen = !isOpen;
    document.documentElement.dataset.statsOpen = String(nextOpen);
    statsToggle.setAttribute("aria-expanded", String(nextOpen));
  });

  const [initialSettings, activeSite] = await Promise.all([
    store.read().catch(() => DEFAULT_EXTENSION_SETTINGS),
    readActiveSite().catch(() => null),
  ]);

  let currentSettings = initialSettings;
  let currentSiteState = activeSite;

  const commitSettings = async (
    nextSettings: ExtensionSettings,
  ): Promise<void> => {
    const previousSettings = currentSettings;
    currentSettings = nextSettings;

    await writeNextSettings(
      store,
      document,
      nextSettings,
      previousSettings,
      currentSiteState,
      statusChip,
      statusCopy,
    );
  };

  enabledToggle.checked = currentSettings.enabled;
  enabledToggle.addEventListener("change", () => {
    void commitSettings({
      ...currentSettings,
      enabled: enabledToggle.checked,
    });
  });

  const hero = getRequiredElement<HTMLElement>(document, ".hero");
  hero.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("#reload-tab") || target.closest(".switch")) return;
    enabledToggle.checked = !enabledToggle.checked;
    void commitSettings({
      ...currentSettings,
      enabled: enabledToggle.checked,
    });
  });

  themeToggle.addEventListener("click", () => {
    void commitSettings({
      ...currentSettings,
      theme: currentSettings.theme === "light" ? "dark" : "light",
    });
  });

  const reloadBtn = document.querySelector<HTMLElement>("#reload-tab");
  reloadBtn?.addEventListener("click", () => {
    void reloadActiveTab().catch(() => undefined);
  });

  const resetBtn = document.querySelector<HTMLElement>("#reset-stats");
  resetBtn?.addEventListener("click", () => {
    void commitSettings({
      ...currentSettings,
      scrollStats: {
        "facebook-reels": 0,
        "instagram-reels": 0,
        "tiktok": 0,
        "youtube-shorts": 0,
      },
      todayDate: "",
      todayStats: {
        "facebook-reels": 0,
        "instagram-reels": 0,
        "tiktok": 0,
        "youtube-shorts": 0,
      },
    });
  });

  renderExtensionState(
    document,
    currentSettings,
    currentSiteState,
    statusChip,
    statusCopy,
  );
  renderSiteState(currentSiteState, statsRows);

  // Keep counts live — content script increments scrollStats in storage
  // while the popup is open; re-render whenever storage changes.
  store.watch?.((freshSettings) => {
    currentSettings = freshSettings;
    renderExtensionState(
      document,
      freshSettings,
      currentSiteState,
      statusChip,
      statusCopy,
    );
    renderSiteState(currentSiteState, statsRows);
  });

  document.documentElement.classList.add("is-ready");
}
