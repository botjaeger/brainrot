// Only allowed imports from src/shared/ — no extension-specific modules
import { STORE_URLS } from "../src/shared/store-urls.js";

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

// --- CTA Button State Rendering ---
const ctaButtons = document.querySelectorAll<HTMLAnchorElement>("[data-cta-browser]");

ctaButtons.forEach((btn) => {
  const browser = btn.dataset.ctaBrowser as keyof typeof STORE_URLS;
  const entry = STORE_URLS[browser];

  if (entry.state === "live") {
    // Live state: make interactive link
    btn.href = entry.url;
    btn.classList.add("is-live");
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("tabindex");
    // Update button text to "Add to {Browser}"
    const browserName = browser.charAt(0).toUpperCase() + browser.slice(1);
    btn.textContent = `Add to ${browserName}`;
  }
  // coming_soon state: keep defaults from HTML (aria-disabled, tabindex, no href)
});
