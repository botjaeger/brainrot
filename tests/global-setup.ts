import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Build every browser package once before any test file runs. The packaging
// tests read dist/; building from each file raced two builds into the same
// emptied output directory.
export default function setup(): void {
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "build:all"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "inherit",
  });
}
