import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "site",
  publicDir: "../assets",
  build: {
    outDir: "../dist/site",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "site/index.html"),
        privacy: resolve(import.meta.dirname, "site/privacy.html"),
        terms: resolve(import.meta.dirname, "site/terms.html"),
      },
    },
  },
});
