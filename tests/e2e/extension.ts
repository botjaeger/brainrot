// Playwright fixtures: headless Chromium with the built extension (dist/chromium) loaded,
// and YouTube Shorts served from tests/e2e/fixtures so no test touches the network.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const extensionDir = path.join(root, "dist/chromium");
const shortsHtml = readFileSync(path.join(import.meta.dirname, "fixtures/shorts.html"));
const clip = readFileSync(path.join(import.meta.dirname, "fixtures/clip.webm"));

export const SHORTS_URL = "https://www.youtube.com/shorts/e2e";

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured first argument.
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), "brainrot-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });
    await context.route("https://www.youtube.com/**", (route) => {
      const { pathname } = new URL(route.request().url());
      return pathname.endsWith(".webm")
        ? route.fulfill({ body: clip, contentType: "video/webm" })
        : route.fulfill({ body: shortsHtml, contentType: "text/html" });
    });
    await use(context);
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

/** Writes extension storage from the service worker, as the popup would. */
export function setStorage(worker: Worker, values: Record<string, unknown>): Promise<void> {
  return worker.evaluate((v) => chrome.storage.local.set(v), values);
}

export function getStorage(worker: Worker): Promise<Record<string, unknown>> {
  return worker.evaluate(() => chrome.storage.local.get(null));
}
