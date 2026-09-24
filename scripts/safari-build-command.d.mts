export const SAFARI_PROJECT_PATH: string;
export const SAFARI_SCHEME: string;
export const SAFARI_CONFIGURATION: string;
export const SAFARI_DERIVED_DATA_PATH: string;

export function buildSafariXcodebuildArgs(options?: {
  signed?: boolean;
  developmentTeam?: string;
}): string[];
