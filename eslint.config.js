// ESLint for the extension (src/), the website (site/), tests, build scripts and configs.
// Types are checked separately by `tsc --noEmit` (pnpm typecheck); both run in `pnpm check`.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Modules a page (popup, changelog) imports. Rollup moves a module imported by a page and by a
// classic-script bundle into a shared chunk, and the bundle then starts with `import` and breaks.
const PAGE_MODULES = [
  "**/popup/**",
  "**/changelog/**",
  "**/shared/brand*",
  "**/shared/changelog*",
  "**/shared/extension-settings*",
  "**/shared/page-html*",
];

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "web-ext-artifacts/**",
      "safari/**",
      "node_modules/**",
      "scripts/*.js",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // ignoreRestSiblings: `const { omitted, ...rest } = value` keeps `omitted` off the spread.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // `x != null` (null or undefined) stays allowed.
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "array-callback-return": ["error", { checkForEach: true }],
      "no-promise-executor-return": "error",
    },
  },
  // Type-aware rules for every TypeScript file (all of them are in tsconfig.json).
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
  // Extension code and the website run in the browser.
  {
    files: ["src/**/*.ts", "site/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  // The service worker and the MAIN-world scripts are self-contained classic scripts.
  {
    files: ["src/background/**/*.ts", "src/content-main/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration, ImportExpression, ExportAllDeclaration, ExportNamedDeclaration[source]",
          message:
            "This bundle must stay self-contained (classic script): inline the code instead of importing it.",
        },
      ],
    },
  },
  // The content script may import shared code, but never a module a page also imports.
  {
    files: ["src/content/**/*.ts", "src/core/**/*.ts", "src/sites/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: PAGE_MODULES,
              message:
                "Content code must not import page modules (shared chunk); use src/content/runtime-settings.ts for settings.",
            },
          ],
        },
      ],
    },
  },
  // Build scripts, configs and tests run in Node; tests also build DOMs with jsdom.
  {
    files: ["scripts/**/*.{mjs,mts}", "tests/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
  },
);
