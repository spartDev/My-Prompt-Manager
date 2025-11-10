/**
 * Platform Strategy Constants
 *
 * Centralized constants shared across platform strategies
 */

/**
 * Maximum content length limits for different platforms (in characters)
 *
 * These limits are safety measures to prevent excessive content insertion
 * that could cause performance issues or exceed platform-specific limits.
 */
export const MAX_CONTENT_LENGTHS = {
  /**
   * Default maximum content length for platforms without specific limits
   * ~50K characters (approximately 50-100KB depending on character encoding)
   */
  DEFAULT: 50000,

  /**
   * Microsoft Copilot maximum content length
   * Platform typically has ~4000 character limit, but we set a higher safety limit
   * ~50K characters (approximately 50-100KB depending on character encoding)
   */
  COPILOT: 50000,

  /**
   * Claude.ai maximum content length
   * Platform supports larger prompts
   * ~100K characters (approximately 100-200KB depending on character encoding)
   */
  CLAUDE: 100000,

  /**
   * ChatGPT maximum content length
   * ~50K characters (approximately 50-100KB depending on character encoding)
   */
  CHATGPT: 50000,

  /**
   * Perplexity maximum content length
   * ~50K characters (approximately 50-100KB depending on character encoding)
   */
  PERPLEXITY: 50000
} as const;

/**
 * Type for MAX_CONTENT_LENGTHS keys
 */
export type ContentLengthPlatform = keyof typeof MAX_CONTENT_LENGTHS;
