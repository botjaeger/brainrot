export const PUBLISH_TYPES: string[];

export function tagProblem(tag: string | undefined, version: string): string | null;

export function credentials(
  env: Record<string, string | undefined>,
): { token: string; refresh?: undefined } | { token?: undefined; refresh: URLSearchParams };

export function uploadOutcome(state: string | undefined): "done" | "wait" | "failed";
