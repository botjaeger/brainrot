import { defineConfig } from "@playwright/test";

// End-to-end tests of the built extension (dist/chromium) in headless Chromium: pnpm e2e.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
});
