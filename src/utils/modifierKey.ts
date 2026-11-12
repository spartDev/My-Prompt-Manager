/**
 * The modifier key of the app's shortcuts: Command on Apple devices, Control elsewhere.
 * The shortcuts themselves answer to both, so a wrong guess only mislabels the key.
 */
export const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
