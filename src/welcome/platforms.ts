/**
 * The Platforms the Welcome's last step names, as a row of pills: the AI chats the extension works
 * on, read from the config (src/config/platforms.ts), so a Platform added there shows without a
 * change here. Terms: CONTEXT.md, "Platform", "Welcome".
 */

import { type PlatformDefinition, SUPPORTED_PLATFORMS } from '../config/platforms';
import { knownPlatformName } from '../utils/formatPlatformName';

/**
 * The name of each supported Platform, highest priority first (the config's order between equals):
 * its short name (formatPlatformName's), or its display name when it has none. Linked Platforms
 * (Copilot and M365 Copilot) are one Platform to the user, and show once, under the first of them.
 */
export const welcomePlatformNames = (
  platforms: Readonly<Record<string, Readonly<PlatformDefinition>>> = SUPPORTED_PLATFORMS
): string[] => {
  const shown = new Set<string>();
  const names: string[] = [];
  // Array.prototype.sort is stable: Platforms of the same priority keep the config's order
  for (const platform of Object.values(platforms).sort((a, b) => b.priority - a.priority)) {
    const group = [platform.id, ...(platform.linkedPlatforms ?? [])];
    if (!group.some((id) => shown.has(id))) {
      names.push(knownPlatformName(platform.id) ?? platform.displayName);
    }
    for (const id of group) {
      shown.add(id);
    }
  }
  return names;
};
