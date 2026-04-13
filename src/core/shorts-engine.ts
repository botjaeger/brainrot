export interface ShortsEngineEnvironment {
  document: Document;
  window: Window;
}

export interface ShortsEngineController {
  stop(): void;
  rebind(): void;
}

const noopController: ShortsEngineController = {
  stop() {
    // Intentionally empty.
  },
  rebind() {
    // Intentionally empty.
  },
};

export function startShortsEngine({
  document,
  window,
}: ShortsEngineEnvironment): ShortsEngineController {
  void document;
  void window;
  return noopController;
}
