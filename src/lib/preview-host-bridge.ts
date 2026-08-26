/**
 * Guest side of the grok-web ↔ sandbox preview postMessage bridge.
 * Noops when the app is not embedded in a Grok preview iframe.
 */

export type PreviewHostBridgeOptions = {
  navigate?: (path: string) => void;
  getRoutePaths?: () => string[];
};

export function installPreviewHostBridge(
  _options: PreviewHostBridgeOptions = {},
): () => void {
  return () => {};
}

export function collectRoutePathsFromTree(_routeTree: unknown): string[] {
  return ["/"];
}
