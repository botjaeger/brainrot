export const SAFARI_PROJECT_PATH = "safari/AutoYouTubeShortsScroller.xcodeproj";
export const SAFARI_SCHEME = "AutoYouTubeShortsScroller";
export const SAFARI_CONFIGURATION = "Debug";
export const SAFARI_DERIVED_DATA_PATH = "/tmp/brainrot-safari";

function isValidAppleTeamId(value) {
  return /^[A-Z0-9]{10}$/.test(value);
}

export function buildSafariXcodebuildArgs({ signed = false, developmentTeam } = {}) {
  const args = [
    "-project",
    SAFARI_PROJECT_PATH,
    "-scheme",
    SAFARI_SCHEME,
    "-configuration",
    SAFARI_CONFIGURATION,
    "-derivedDataPath",
    SAFARI_DERIVED_DATA_PATH,
  ];

  if (signed) {
    if (!developmentTeam) {
      throw new Error("Set DEVELOPMENT_TEAM before running the signed Safari build.");
    }

    if (!isValidAppleTeamId(developmentTeam)) {
      throw new Error(
        "DEVELOPMENT_TEAM must be your 10-character Apple Team ID, such as ABCDE12345, not your Apple ID username or email.",
      );
    }

    args.push(`DEVELOPMENT_TEAM=${developmentTeam}`);
  } else {
    args.push("CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO");
  }

  args.push("build");

  return args;
}
