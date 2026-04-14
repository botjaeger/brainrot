import { describe, expect, it } from "vitest";
import {
  buildSafariXcodebuildArgs,
  SAFARI_CONFIGURATION,
  SAFARI_DERIVED_DATA_PATH,
  SAFARI_PROJECT_PATH,
  SAFARI_SCHEME,
} from "../scripts/safari-build-command.js";

describe("buildSafariXcodebuildArgs", () => {
  it("builds the unsigned debug command by default", () => {
    expect(buildSafariXcodebuildArgs()).toEqual([
      "-project",
      SAFARI_PROJECT_PATH,
      "-scheme",
      SAFARI_SCHEME,
      "-configuration",
      SAFARI_CONFIGURATION,
      "-derivedDataPath",
      SAFARI_DERIVED_DATA_PATH,
      "CODE_SIGNING_ALLOWED=NO",
      "CODE_SIGNING_REQUIRED=NO",
      "build",
    ]);
  });

  it("requires a development team for signed builds", () => {
    expect(() =>
      buildSafariXcodebuildArgs({
        signed: true,
      }),
    ).toThrow(/DEVELOPMENT_TEAM/);
  });

  it("adds DEVELOPMENT_TEAM for signed builds", () => {
    expect(
      buildSafariXcodebuildArgs({
        signed: true,
        developmentTeam: "ABCDE12345",
      }),
    ).toEqual([
      "-project",
      SAFARI_PROJECT_PATH,
      "-scheme",
      SAFARI_SCHEME,
      "-configuration",
      SAFARI_CONFIGURATION,
      "-derivedDataPath",
      SAFARI_DERIVED_DATA_PATH,
      "DEVELOPMENT_TEAM=ABCDE12345",
      "build",
    ]);
  });
});
