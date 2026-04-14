import { execFileSync } from "node:child_process";
import { buildSafariXcodebuildArgs } from "./safari-build-command.js";

function parseArgs(argv) {
  return {
    signed: argv.includes("--signed"),
  };
}

function run() {
  const { signed } = parseArgs(process.argv.slice(2));
  const developmentTeam = process.env.DEVELOPMENT_TEAM;

  const args = buildSafariXcodebuildArgs({
    signed,
    developmentTeam,
  });

  execFileSync("xcodebuild", args, {
    stdio: "inherit",
    env: process.env,
  });
}

run();
