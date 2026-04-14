import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { createPopupHtml } from "./src/popup/popup-template.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const iconSizes = [16, 32, 48, 128] as const;

function manifestPlugin(): Plugin {
  return {
    name: "emit-manifest-json",
    generateBundle() {
      const manifest = readFileSync(resolve(rootDir, "manifest.json"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: manifest,
      });
      this.emitFile({
        type: "asset",
        fileName: "popup/index.html",
        source: createPopupHtml(),
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
        "popup/popup": resolve(rootDir, "src/popup/index.ts"),
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
