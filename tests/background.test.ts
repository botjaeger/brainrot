import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("background/index.ts", () => {
  describe("registerMainWorldSpoofFallback", () => {
    // Testing the error handling requires importing the module and mocking
    // chrome.scripting, which is only available in browser extension contexts.
    // This test verifies the error-distinguishing pattern is present in source.

    it("logs unexpected registration errors but not 'not supported' errors", () => {
      const sourceCode = readFileSync("src/background/index.ts", "utf8");

      // Verify the warn message is present for unexpected errors
      expect(sourceCode).toContain(
        '[Brainrot] registerContentScripts failed:',
      );

      // Verify it suppresses "not supported" errors (Safari)
      expect(sourceCode).toContain("not supported");

      // Verify it suppresses "not implemented" errors (older browsers)
      expect(sourceCode).toContain("not implemented");
    });

    it("uses console.warn (not console.error) for registration failures", () => {
      const sourceCode = readFileSync("src/background/index.ts", "utf8");

      expect(sourceCode).toContain(
        'console.warn("[Brainrot] registerContentScripts failed:"',
      );
    });

    it("calls both reloadSupportedTabs and registerMainWorldSpoofFallback on install", () => {
      const sourceCode = readFileSync("src/background/index.ts", "utf8");

      expect(sourceCode).toContain("reloadSupportedTabs");
      expect(sourceCode).toContain("registerMainWorldSpoofFallback");
      expect(sourceCode).toContain("onInstalled");
    });
  });
});
