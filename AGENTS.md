<!-- GSD:project-start source:PROJECT.md -->
## Project

**Brainrot**

A browser extension that automatically advances supported short-form feeds to the next item when the current one reaches the end of playback. It targets Chrome, Microsoft Edge, Firefox, Brave, and desktop Safari on macOS.

This project is intentionally narrow for v1. The goal is to ship the core auto-scroll behavior across the major desktop browsers without adding filters, block lists, account sync, or other extra feature surface.

**Core Value:** Keep supported short-form feeds moving automatically across the major desktop browsers with as little manual interaction as possible.

### Constraints

- **Platform**: Desktop Safari only on macOS - Safari mobile is out of scope by request.
- **Architecture**: One shared extension core with browser-specific packaging - reduces duplication and keeps behavior aligned.
- **Runtime**: No backend or remote services - the extension should work entirely in the browser.
- **Scope**: Core auto-scroll only - avoids turning the project into a general YouTube automation tool.
- **Compatibility**: Must tolerate browser API and manifest differences across Chromium, Firefox, and Safari.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.x | Shared extension logic and typed browser APIs | Keeps one codebase portable across browser-specific packaging while reducing runtime bugs |
| Manifest V3 WebExtension | current | Extension manifest and runtime model | Chrome and Edge docs align on the MV3/WebExtensions path; Firefox supports MV3; Safari can convert web extensions from other browsers |
| Vite | 6.x | Bundles content scripts, background code, and assets | Fast, simple build pipeline without forcing a heavy application framework into a small extension |
| Internal browser API adapter | n/a | Normalizes `chrome` and `browser` API differences | Avoids hard-coding a single browser namespace and makes shared code easier to port |
| Xcode Safari Web Extension template | current | Packages and signs the macOS Safari target | Safari distribution relies on an app-based wrapper, so this is the canonical path for desktop Safari support |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| web-ext | current | Build, test, and package Firefox extensions | Use for Firefox validation and packaging during development |
| ESLint | 9.x | Static linting | Use to keep shared extension code consistent and easier to review |
| @types/chrome | current | Type definitions for extension APIs | Use if the implementation leans on the `chrome` namespace directly in TypeScript |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js LTS | Build toolchain | Use a current LTS release for repeatable builds and tool compatibility |
| Browser devtools | Extension debugging | Test in Chrome, Edge, Firefox, Brave, and Safari-specific inspection tools |
| Xcode | Safari packaging | Required on macOS for the Safari web extension wrapper and signing flow |
## Installation
# Representative setup for the extension toolchain
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite + thin compatibility layer | Full extension framework | Use a framework only if the project later needs more scaffolding than control over packaging |
| Shared WebExtension core | Separate per-browser codebases | Only if browser-specific divergence becomes too large to manage cleanly |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Manifest V2 | Deprecated path and not the modern default for Chrome/Edge | Manifest V3 WebExtensions |
| Backend/server sync | Unnecessary for a local utility and adds failure modes | Local browser storage only, if any state is needed |
| iPhone/iPad Safari support in v1 | The user explicitly scoped desktop macOS Safari only | Desktop Safari package only |
| Heavy runtime frameworks in the content script | Adds bundle weight and DOM complexity without helping the core feature | Small DOM-first content scripts and shared helpers |
## Stack Patterns by Variant
- Use the same MV3 bundle with browser-specific manifest values.
- Keep the content script and playback logic shared.
- Keep the shared source, but validate API differences and manifest specifics with Firefox packaging tools.
- Watch for differences in extension metadata and API behavior.
- Package through Xcode and test on macOS Safari only.
- Treat Safari as a packaging variant of the shared extension core, not a separate product.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Chrome/Edge/Brave MV3 build | Shared WebExtension source | Chromium browsers can share the same core code and manifest shape with minor packaging differences |
| Firefox MV3 build | Shared WebExtension source | Firefox supports Manifest V3 and WebExtensions, but extension metadata and API behavior still need validation |
| Safari web extension wrapper | Shared WebExtension source | Safari can convert Chrome, Firefox, or Edge extensions into a Safari web extension, but macOS packaging is required |
## Sources
- Chrome Extensions docs - https://developer.chrome.com/docs/extensions
- Chrome Extensions API reference - https://developer.chrome.com/docs/extensions/reference/api
- Microsoft Edge porting guide - https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension
- Microsoft Edge API support - https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support
- Mozilla MDN WebExtensions - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
- Firefox 109 release notes - https://developer.mozilla.org/en-US/Firefox/Releases/109
- Safari Services documentation - https://developer.apple.com/documentation/safariservices/
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
