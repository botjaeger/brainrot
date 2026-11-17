import { defineConfig } from "vite";
import { resolve } from "node:path";

// Static multi-page site: home, privacy policy, terms. Shares the extension's icons and images
// (../assets) and imports store links and the version from the extension (../src/shared, ../manifest.json).
export default defineConfig({
  publicDir: "../assets",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
        terms: resolve(import.meta.dirname, "terms.html"),
      },
    },
  },
});
