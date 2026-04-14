import { createExtensionSettingsStore } from "../shared/extension-settings.js";
import { readActiveSupportedSite } from "./site-status.js";
import { mountPopup } from "./popup.js";

void mountPopup({
  document,
  store: createExtensionSettingsStore(),
  readActiveSite: readActiveSupportedSite,
});
