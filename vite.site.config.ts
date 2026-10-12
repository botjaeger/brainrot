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
        main: resolve(__dirname, "site/index.html"),
        privacy: resolve(__dirname, "site/privacy.html"),
        terms: resolve(__dirname, "site/terms.html"),
      },
    },
  },
});
