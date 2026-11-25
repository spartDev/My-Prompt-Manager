/**
 * The Platforms whose composers the store images can show, and the ones they show and name: the
 * composers of screenshot 3 and its subline, and the marquee's subline (copy.ts), in this order. An
 * image names a Platform only while the Release runs where that Platform's users land; `shown`
 * brings one back in one line, its composer and glyphs (composers.ts) still in place.
 */

export const COMPOSER_PLATFORMS = [
  { id: 'claude', name: 'Claude', shown: true },
  { id: 'chatgpt', name: 'ChatGPT', shown: true },
  { id: 'gemini', name: 'Gemini', shown: true },
  { id: 'mistral', name: 'Mistral', shown: true },
  { id: 'perplexity', name: 'Perplexity', shown: true },
  // My-Prompt-Manager-1c88: copilot.microsoft.com redirects to copilot.com, a host 2.0.0 does not run on. True again once 1c88 settles it
  { id: 'copilot', name: 'Copilot', shown: false }
] as const;

/** A Platform the images can show: one with a composer fixture and glyphs */
export type ImagePlatform = (typeof COMPOSER_PLATFORMS)[number]['id'];

/** The Platforms the images show and name, in order */
export const IMAGE_PLATFORMS: readonly ImagePlatform[] = COMPOSER_PLATFORMS.filter((platform) => platform.shown).map((platform) => platform.id);

/** The name a Platform goes by in the images, in text only */
export const platformName = (id: ImagePlatform): string => COMPOSER_PLATFORMS.find((platform) => platform.id === id)?.name ?? id;

/** Names as a sentence lists them: "A, B and C" */
export const listed = (names: readonly string[]): string =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');

/** The Platforms the images name, as a sentence lists them */
export const IMAGE_PLATFORM_LIST = listed(IMAGE_PLATFORMS.map(platformName));
