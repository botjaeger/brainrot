import { describe, expect, it } from "vitest";
import { describeSupportedSiteFromUrl } from "../src/popup/site-status.js";

describe("describeSupportedSiteFromUrl", () => {
  it("detects supported YouTube, Facebook, and TikTok feeds", () => {
    expect(describeSupportedSiteFromUrl("https://www.youtube.com/shorts/example")).toMatchObject({
      kind: "youtube-shorts",
      supported: true,
      label: "YouTube Shorts",
      note: "Brainrot supports this page.",
    });
    expect(describeSupportedSiteFromUrl("https://www.facebook.com/reels/123")).toMatchObject({
      kind: "facebook-reels",
      supported: true,
      label: "Facebook Reels",
      note: "Brainrot supports this page.",
    });
    expect(describeSupportedSiteFromUrl("https://www.tiktok.com/@creator/video/1")).toMatchObject({
      kind: "tiktok",
      supported: true,
      label: "TikTok",
      note: "Brainrot supports this page.",
    });
    expect(describeSupportedSiteFromUrl("https://www.tiktok.com/en/")).toMatchObject({
      kind: "tiktok",
      supported: true,
      label: "TikTok",
      note: "Brainrot supports this page.",
    });
  });

  it("returns a helpful fallback for unsupported pages", () => {
    expect(describeSupportedSiteFromUrl("https://example.com")).toMatchObject({
      kind: "unsupported",
      supported: false,
      label: "No supported social site",
      note: "Open YouTube Shorts, Facebook Reels, TikTok, or Instagram Reels to activate Brainrot.",
    });
  });
});
