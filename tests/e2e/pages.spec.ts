import type { Page } from "@playwright/test";
import { expect, getStorage, setStorage, test } from "./extension.js";

// The popup and the "What's new" page in a real browser: what jsdom cannot show
// (focus rings, layout at narrow widths, storage events between two pages).

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("requestfailed", (r) => problems.push(`failed: ${r.url()}`));
  return problems;
}

test("a fresh install shows no unread dot, and the version link opens the changelog", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const popup = await context.newPage();
  const problems = collectProblems(popup);
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(popup.locator("html.is-ready")).toHaveCount(1);
  await expect(popup.locator("html")).toHaveAttribute("data-changelog-unseen", "false");

  await setStorage(serviceWorker, { changelogSeenVersion: "0.0.1" });
  await expect(popup.locator("html")).toHaveAttribute("data-changelog-unseen", "true");
  await expect(popup.locator(".new-dot")).toBeVisible();

  const opened = context.waitForEvent("page");
  await popup.locator("#changelog-link").click();
  const changelog = await opened;
  expect(changelog.url()).toBe(`chrome-extension://${extensionId}/changelog/index.html`);
  await expect(popup.locator("html")).toHaveAttribute("data-changelog-unseen", "false");
  expect((await getStorage(serviceWorker)).changelogSeenVersion).not.toBe("0.0.1");
  expect(problems).toEqual([]);
});

test("the theme chosen in the popup persists and reaches an open changelog page", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const popup = await context.newPage();
  const changelog = await context.newPage();
  const problems = [...collectProblems(popup), ...collectProblems(changelog)];
  await changelog.goto(`chrome-extension://${extensionId}/changelog/index.html`);
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(changelog.locator("html")).toHaveAttribute("data-theme", "light");

  await popup.locator("#theme-toggle").click();
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(changelog.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await getStorage(serviceWorker)).theme).toBe("dark");

  const reopened = await context.newPage();
  await reopened.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(reopened.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(problems).toEqual([]);
});

test("corrupt stored values leave the popup usable", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  await setStorage(serviceWorker, {
    enabled: "yes",
    theme: "purple",
    scrollStats: { 'a"]b': 1, tiktok: "abc", "youtube-shorts": -4, "facebook-reels": 7 },
    todayDate: 5,
    todayStats: [1, 2],
  });
  const popup = await context.newPage();
  const problems = collectProblems(popup);
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(popup.locator("html.is-ready")).toHaveCount(1);
  await expect(popup.locator("#enabled-toggle")).toBeChecked();
  await expect(popup.locator("[data-count='tiktok']")).toHaveText("0");
  await expect(popup.locator("[data-count='youtube-shorts']")).toHaveText("0");
  await expect(popup.locator("[data-count='facebook-reels']")).toHaveText("7");
  expect(problems).toEqual([]);
});

test("the switch shows a focus ring for keyboard users and toggles with Space", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.locator("#changelog-link").focus();
  await popup.keyboard.press("Tab");
  await popup.keyboard.press("Tab");
  await expect(popup.locator("#enabled-toggle")).toBeFocused();
  // The input itself is invisible, so the ring must be on its track.
  await expect(popup.locator(".track")).toHaveCSS("outline-style", "solid");
  await expect(popup.locator("#enabled-toggle")).toHaveAttribute("role", "switch");

  await popup.keyboard.press("Space");
  await expect(popup.locator("#enabled-toggle")).not.toBeChecked();
  await expect.poll(async () => (await getStorage(serviceWorker)).enabled).toBe(false);
});

for (const width of [400, 320]) {
  for (const theme of ["light", "dark"]) {
    test(`popup and changelog have no horizontal overflow at ${width}px, ${theme}`, async ({
      context,
      serviceWorker,
      extensionId,
    }) => {
      await setStorage(serviceWorker, {
        theme,
        scrollStats: { tiktok: 1234567, "youtube-shorts": 99999, "instagram-reels": 8888888 },
      });
      for (const path of ["popup/index.html", "changelog/index.html"]) {
        const page = await context.newPage();
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`chrome-extension://${extensionId}/${path}`);
        await expect(page.locator("html.is-ready")).toHaveCount(1);
        if (path.startsWith("popup")) await page.locator("#stats-toggle").click();
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, path).toBeLessThanOrEqual(width);
        await page.close();
      }
    });
  }
}
