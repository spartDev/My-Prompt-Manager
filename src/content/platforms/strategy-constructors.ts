/**
 * Strategy class name to constructor mapping: the strategyClass names of platforms.ts to the
 * strategies. Its own module, with no import of the manager's, so `npm run composers:capture`
 * reads the strategies' editor selectors from it under Node.
 */

import type { PlatformStrategy } from './base-strategy';
import { ChatGPTStrategy } from './chatgpt-strategy';
import { ClaudeStrategy } from './claude-strategy';
import { CopilotStrategy } from './copilot-strategy';
import { DefaultStrategy } from './default-strategy';
import { GeminiStrategy } from './gemini-strategy';
import { M365CopilotStrategy } from './m365copilot-strategy';
import { MistralStrategy } from './mistral-strategy';
import { PerplexityStrategy } from './perplexity-strategy';

export const STRATEGY_CONSTRUCTORS: Record<string, new (hostname?: string) => PlatformStrategy> = {
  'ClaudeStrategy': ClaudeStrategy,
  'ChatGPTStrategy': ChatGPTStrategy,
  'CopilotStrategy': CopilotStrategy,
  'GeminiStrategy': GeminiStrategy,
  'M365CopilotStrategy': M365CopilotStrategy,
  'MistralStrategy': MistralStrategy,
  'PerplexityStrategy': PerplexityStrategy,
  'DefaultStrategy': DefaultStrategy
};
