# Firefox Source Build

These instructions reproduce the Firefox package for Brainrot 0.1.4 from the
submitted source archive.

## Environment

- macOS or Linux
- Node.js 22 LTS (the release was built with Node.js 22.15.0)
- pnpm 11.7.0
- Internet access to the official npm registry for dependency installation

No environment variables, credentials, backend services, or proprietary tools
are required.

## Build

From the source archive root:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm build:firefox
pnpm exec web-ext build --source-dir dist/firefox --overwrite-dest
```

The unpacked Firefox extension is written to `dist/firefox`.

The uploadable archive is written to
`web-ext-artifacts/brainrot-0.1.4.zip`.

`pnpm build:firefox` runs Vite and applies the Firefox manifest overlay. The
final `web-ext build` command packages those generated files without changing
their contents.
