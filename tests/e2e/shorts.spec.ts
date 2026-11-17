import { SHORTS_URL, expect, getStorage, setStorage, test } from "./extension.js";

declare global {
  interface Window {
    nextClicks: number;
  }
}

const ownHiddenDescriptor = () => Object.getOwnPropertyDescriptor(document, "hidden") !== undefined;

test("advances each short when it ends, through the site's next button, and counts it", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(SHORTS_URL);

  // The 1 s clips loop, as on YouTube, so the advance comes from the extension, never the page.
  await expect.poll(() => page.evaluate(() => window.nextClicks), { timeout: 10_000 }).toBe(2);
  expect(await page.locator("ytd-reel-video-renderer").nth(2).getAttribute("is-active")).toBe("");

  // Background playback: the MAIN-world spoof is installed on the feed.
  expect(await page.evaluate(ownHiddenDescriptor)).toBe(true);

  // All three shorts were watched to the end; the last has no next one to move to.
  const watched = async () =>
    ((await getStorage(serviceWorker)).scrollStats as Record<string, number> | undefined)?.[
      "youtube-shorts"
    ];
  await expect.poll(watched, { timeout: 5_000 }).toBe(3);
  await page.waitForTimeout(1_500);
  expect(await watched()).toBe(3);
  expect(await page.evaluate(() => window.nextClicks)).toBe(2);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(popup.locator("[data-count='youtube-shorts']")).toHaveText("3");
});

test("does nothing while switched off, and starts when switched on in the popup", async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  await setStorage(serviceWorker, { enabled: false });
  const page = await context.newPage();
  await page.goto(SHORTS_URL);

  // Three clip lengths: a working engine would have advanced twice by now.
  await page.waitForTimeout(3_000);
  expect(await page.evaluate(() => window.nextClicks)).toBe(0);
  expect(await page.locator("video").first().getAttribute("loop")).toBe("");
  expect(await page.evaluate(ownHiddenDescriptor)).toBe(false);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const toggle = popup.locator("#enabled-toggle");
  await expect(toggle).not.toBeChecked();
  await popup.locator("label.switch").click();
  await expect(toggle).toBeChecked();
  expect((await getStorage(serviceWorker)).enabled).toBe(true);

  await expect.poll(() => page.evaluate(() => window.nextClicks), { timeout: 10_000 }).toBe(2);
  expect(await page.evaluate(ownHiddenDescriptor)).toBe(true);
});
