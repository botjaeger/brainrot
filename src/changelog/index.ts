import {
  readExtensionSettings,
  watchExtensionSettings,
  type ExtensionSettings,
} from "../shared/extension-settings.js";

// The changelog is static HTML; this only follows the theme chosen in the popup.
function applyTheme(settings: ExtensionSettings): void {
  document.documentElement.dataset.theme = settings.theme;
}

void readExtensionSettings()
  .then(applyTheme)
  .catch(() => undefined)
  .finally(() => {
    document.documentElement.classList.add("is-ready");
  });

watchExtensionSettings(applyTheme);
