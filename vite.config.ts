import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { createChangelogHtml } from "./src/changelog/changelog-template.js";
import { createPopupHtml } from "./src/popup/popup-template.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const iconSizes = [16, 32, 48, 128] as const;

function manifestPlugin(): Plugin {
  return {
    name: "emit-manifest-json",
    generateBundle() {
      const manifest = readFileSync(resolve(rootDir, "manifest.json"), "utf8");
      const { version } = JSON.parse(manifest) as { version: string };
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: manifest,
      });
      this.emitFile({
        type: "asset",
        fileName: "popup/index.html",
        source: createPopupHtml({ version }),
      });
      this.emitFile({
        type: "asset",
        fileName: "changelog/index.html",
        source: createChangelogHtml({ version }),
      });
      for (const size of iconSizes) {
        this.emitFile({
          type: "asset",
          fileName: `assets/icon-${size}.png`,
          source: readFileSync(resolve(rootDir, `assets/icon-${size}.png`)),
        });
      }
      this.emitFile({
        type: "asset",
        fileName: "assets/mascot.png",
        source: readFileSync(resolve(rootDir, "assets/mascot.png")),
      });
    },
  };
}

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        "background/index": resolve(rootDir, "src/background/index.ts"),
        "content/index": resolve(rootDir, "src/content/index.ts"),
        "content-main/control": resolve(rootDir, "src/content-main/control.ts"),
        "content-main/spoof": resolve(rootDir, "src/content-main/spoof.ts"),
        "popup/index": resolve(rootDir, "src/popup/index.ts"),
        "changelog/index": resolve(rootDir, "src/changelog/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  plugins: [manifestPlugin()],
});
