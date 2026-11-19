import { defineConfig } from "vite";
import { resolve } from "node:path";

// Static multi-page site: home, privacy policy, terms, 404. Everything it serves lives in site/
// (no publicDir: assets/ holds files the extension, not the site, uses). Store links and the version
// come from the extension (../src/shared, ../manifest.json).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
        terms: resolve(import.meta.dirname, "terms.html"),
        notFound: resolve(import.meta.dirname, "404.html"),
      },
    },
  },
});
