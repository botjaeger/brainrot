// Only allowed imports from src/shared/ — no extension-specific modules
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/schibsted-grotesk";
import { STORE_URLS } from "../src/shared/store-urls.js";
import manifest from "../manifest.json";
import { inject } from "@vercel/analytics";

type Browser = "chrome" | "firefox";

const LABELS: Record<Browser, { primary: string; secondary: string }> = {
  chrome: { primary: "Add to Chrome", secondary: "Get it for Chrome" },
  firefox: { primary: "Add to Firefox", secondary: "Get it for Firefox" },
};

function detectBrowser(): Browser {
  return navigator.userAgent.toLowerCase().includes("firefox") ? "firefox" : "chrome";
}

// Primary buttons point at the visitor's browser, secondary links at the other.
const primary = detectBrowser();
const secondary: Browser = primary === "firefox" ? "chrome" : "firefox";

for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-cta]")) {
  const browser = link.dataset.cta === "primary" ? primary : secondary;
  const entry = STORE_URLS[browser];
  if (entry.state === "live") link.href = entry.url;

  const label = link.querySelector("[data-cta-label]") ?? link;
  const text = LABELS[browser][link.dataset.cta === "primary" ? "primary" : "secondary"];
  label.textContent = `${text}${link.dataset.ctaSuffix ?? ""}`;
}

// Per-browser buttons ("Get Brainrot" cards) always point at their own store.
for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-store]")) {
  const browser = link.dataset.store;
  if (browser !== "chrome" && browser !== "firefox") continue;
  const entry = STORE_URLS[browser];
  if (entry.state === "live") link.href = entry.url;
}

for (const el of document.querySelectorAll("[data-version]")) {
  el.textContent = `v${manifest.version}`;
}

// --- Vercel Web Analytics ---
// Its script is served only by Vercel; other hosts (GitHub Pages) would 404.
if (import.meta.env.MODE === "development" || location.hostname.endsWith(".vercel.app")) {
  inject({
    mode: import.meta.env.MODE === "development" ? "development" : "production",
  });
}
