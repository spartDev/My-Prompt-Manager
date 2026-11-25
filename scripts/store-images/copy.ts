/**
 * The text of the store images, as the owner chose it on 2026-11-21 (ticket My-Prompt-Manager-tuh.9),
 * word for word. Each claim is checked against the code in the pull request that made them. The two
 * lists of Platforms are those the images show (platforms.ts): with Copilot shown, they read as the
 * owner wrote them, "Claude, ChatGPT, Gemini, Mistral, Perplexity and Copilot".
 */

import { IMAGE_PLATFORM_LIST } from './platforms';

export interface ImageCopy {
  headline: string;
  subline?: string;
}

export const TRIGGER_COPY: ImageCopy = { headline: 'Stop retyping your prompts', subline: 'Type // and pick one from your Library.' };
export const VARIABLES_COPY: ImageCopy = { headline: 'Write it once. Reuse it everywhere.', subline: 'Variables fill in what changes each time.' };
export const PLATFORMS_COPY: ImageCopy = { headline: 'One Library for every AI chat', subline: `${IMAGE_PLATFORM_LIST}.` };
export const LIBRARY_COPY: ImageCopy = { headline: 'A home for every prompt you write', subline: 'Categories, Pinned and Most Used, always one click away.' };
export const TRUST_LINE = 'Stays on your device. No account, no cloud.';
export const PACKS_COPY: ImageCopy = { headline: 'Not sure where to start? Pick a Pack', subline: 'Ready-made prompts, added in one click.' };
export const TILE_COPY: ImageCopy = { headline: 'Your prompts, one // away' };
export const MARQUEE_COPY: ImageCopy = {
  headline: 'Write it once. Reuse it everywhere.',
  subline: `Your Library, inside ${IMAGE_PLATFORM_LIST}.`
};

export const BRAND_NAME = 'My Prompt Manager';
