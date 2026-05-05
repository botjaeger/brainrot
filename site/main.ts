// Only allowed imports from src/shared/ — no extension-specific modules
import { STORE_URLS } from "../src/shared/store-urls.js";
import manifest from "../manifest.json";
import { inject } from "@vercel/analytics";

const APP_VERSION = manifest.version;

// --- Theme Toggle ---
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");

if (themeToggle) {
  // Sync aria-pressed with current theme on page load
  const currentTheme = document.documentElement.getAttribute("data-theme") ?? "light";
  themeToggle.setAttribute("aria-pressed", currentTheme === "dark" ? "true" : "false");

  // Handle click to toggle theme
  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    themeToggle.setAttribute("aria-pressed", nextTheme === "dark" ? "true" : "false");
  });
}

// --- Browser Detection ---
function detectBrowser(): "chrome" | "firefox" | null {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("chrome") && !ua.includes("edg")) return "chrome";
  return null;
}

// --- CTA Button State Rendering + Browser-Aware Ordering ---
const ctaRows = document.querySelectorAll<HTMLElement>(".cta-row");
const detectedBrowser = detectBrowser();

ctaRows.forEach((row) => {
  const chromeBtn = row.querySelector<HTMLAnchorElement>('[data-cta-browser="chrome"]');
  const firefoxBtn = row.querySelector<HTMLAnchorElement>('[data-cta-browser="firefox"]');

  if (!chromeBtn || !firefoxBtn) return;

  // Swap order: detected browser first
  if (detectedBrowser === "firefox") {
    row.insertBefore(firefoxBtn, chromeBtn);

    // Swap styles: Firefox becomes primary, Chrome becomes link
    firefoxBtn.className = chromeBtn.className;
    chromeBtn.className = "cta-link";

    // Swap icon sizes
    firefoxBtn.querySelector("img")?.setAttribute("width", "22");
    firefoxBtn.querySelector("img")?.setAttribute("height", "22");
    chromeBtn.querySelector("img")?.setAttribute("width", "16");
    chromeBtn.querySelector("img")?.setAttribute("height", "16");

    // Swap text: Firefox gets primary tagline, Chrome gets simple label
    const chromeText = chromeBtn.querySelector(".cta-text");
    const firefoxText = firefoxBtn.querySelector(".cta-text");
    if (chromeText && firefoxText) {
      const primaryLabel = chromeText.textContent?.replace("Chrome", "Firefox") ?? "Start Rotting — Firefox";
      firefoxText.textContent = primaryLabel;
      chromeText.textContent = "Chrome";
    }
  }
});

// Set hrefs based on store state + add version badge to primary buttons
const ctaButtons = document.querySelectorAll<HTMLAnchorElement>("[data-cta-browser]");

ctaButtons.forEach((btn) => {
  const browser = btn.dataset.ctaBrowser as keyof typeof STORE_URLS;
  const entry = STORE_URLS[browser];

  if (entry.state === "live") {
    btn.href = entry.url;
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.removeAttribute("aria-disabled");

    // Add version badge to primary CTA buttons
    if (btn.classList.contains("cta-primary")) {
      const badge = document.createElement("span");
      badge.className = "cta-version";
      badge.textContent = `v${APP_VERSION}`;
      btn.appendChild(badge);
    }
  }
});

// --- Privacy FAQ: scroll and expand on anchor click ---
document.querySelector('a[href="#privacy"]')?.addEventListener("click", (e) => {
  e.preventDefault();
  const privacyFaq = document.querySelector<HTMLDetailsElement>("#privacy");
  if (privacyFaq) {
    privacyFaq.open = true;
    privacyFaq.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

// --- Vercel Web Analytics ---
inject();
