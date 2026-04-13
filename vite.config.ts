import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function manifestPlugin() {
  return {
    name: "emit-manifest-json",
    generateBundle() {
      const manifest = readFileSync(resolve(rootDir, "manifest.json"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: manifest,
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
        "content/index": resolve(rootDir, "src/content/index.ts"),
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
