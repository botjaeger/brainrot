import {
  startFeedEngine,
  type FeedEngineController,
  type FeedEngineEnvironment,
} from "./feed-engine.js";
import { youtubeShortsSiteAdapter } from "../sites/youtube-shorts.js";

export type ShortsEngineEnvironment = Omit<FeedEngineEnvironment, "adapters">;
export type ShortsEngineController = FeedEngineController;

export function startShortsEngine(
  environment: ShortsEngineEnvironment,
): ShortsEngineController {
  return startFeedEngine({
    ...environment,
    adapters: [youtubeShortsSiteAdapter],
  });
}
