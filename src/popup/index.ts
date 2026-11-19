import { createExtensionSettingsStore } from "../shared/extension-settings.js";
import { readActiveSupportedSite } from "./site-status.js";
import { mountPopup } from "./popup.js";

// The page stays hidden until `is-ready`; a failed mount must not leave it blank.
void mountPopup({
  document,
  store: createExtensionSettingsStore(),
  readActiveSite: readActiveSupportedSite,
})
  .catch(() => undefined)
  .finally(() => {
    document.documentElement.classList.add("is-ready");
  });
