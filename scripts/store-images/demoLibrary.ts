/**
 * The demo Library the store images show: English Prompts in four Categories (Product,
 * Engineering, Writing, Hiring), two of them Pinned, most of them used, two with Variables. Made up
 * for the images: no person, company or account is named.
 */

import type { Category, Prompt, Settings } from '../../src/types';
import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../src/types';
import { WELCOME_KEY, type WelcomeRecord } from '../../src/welcome/storage';
import { WHATS_NEW_KEY, type WhatsNewRecord } from '../../src/whatsNew/storage';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Colors of PRESET_COLORS (src/constants/colors.ts), the ones a user picks a Category's color from */
export const DEMO_CATEGORIES: readonly Category[] = [
  { id: 'demo-product', name: 'Product', color: '#2563EB' },
  { id: 'demo-engineering', name: 'Engineering', color: '#0F766E' },
  { id: 'demo-writing', name: 'Writing', color: '#D97706' },
  { id: 'demo-hiring', name: 'Hiring', color: '#DB2777' },
  { id: 'demo-uncategorized', name: DEFAULT_CATEGORY }
];

interface DemoPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  usageCount: number;
  pinned?: true;
}

/** In the order the Prompt selector lists them (Pinned first) and the Library sorts them (latest first) */
const PROMPTS: readonly DemoPrompt[] = [
  {
    id: 'demo-status-update',
    title: 'Weekly status update',
    content: 'Turn my notes into a status update for {{audience}} covering {{period}}. Lead with risks, then wins, then next steps.',
    category: 'Product',
    usageCount: 31,
    pinned: true
  },
  {
    id: 'demo-code-review',
    title: 'Code review checklist',
    content: 'Review this diff for correctness, naming, error handling and missing tests. List the issues, most serious first, each with a suggested fix.\n\nDiff:',
    category: 'Engineering',
    usageCount: 18,
    pinned: true
  },
  {
    id: 'demo-tighten',
    title: 'Tighten this paragraph',
    content: 'Rewrite the paragraph below so it is clearer and shorter. Keep every fact and cut every filler word.\n\nParagraph:',
    category: 'Writing',
    usageCount: 12
  },
  {
    id: 'demo-thread-summary',
    title: 'Summarize a long thread',
    content: 'Summarize the thread below in five bullets, then list the open questions and who should answer each.\n\nThread:',
    category: 'Writing',
    usageCount: 9
  },
  {
    id: 'demo-user-story',
    title: 'User story from feedback',
    content: 'Turn this customer feedback into a user story with three acceptance criteria in Given/When/Then form.\n\nFeedback:',
    category: 'Product',
    usageCount: 7
  },
  {
    id: 'demo-scorecard',
    title: 'Interview scorecard',
    content: 'Draft a scorecard for the {{role}} interview: four signals to probe, a question for each, and what a strong answer sounds like.',
    category: 'Hiring',
    usageCount: 4
  },
  {
    id: 'demo-explain-error',
    title: 'Explain this error',
    content: 'Explain what this error means, its three most likely causes, and how to check each one.\n\nError:',
    category: 'Engineering',
    usageCount: 3
  },
  {
    id: 'demo-job-post',
    title: 'Job post for a new role',
    content: 'Write a job post for the role described below: what the team does, what the person will own in their first six months, and what we look for.\n\nRole:',
    category: 'Hiring',
    usageCount: 0
  }
];

/** The Prompt the Variables image fills in, with the values typed for its two Variables */
export const VARIABLES_PROMPT = { id: 'demo-status-update', title: 'Weekly status update', values: { audience: 'the leadership team', period: 'this week' } } as const;

/** The demo Prompts, dated back from `now` so that the newest is a few days old and the last use a few hours ago */
export const demoPrompts = (now: number): Prompt[] =>
  PROMPTS.map(({ usageCount, pinned, ...prompt }, index) => {
    const createdAt = now - (40 + index * 3) * DAY;
    const updatedAt = now - (2 + index) * DAY;
    return {
      ...prompt,
      createdAt,
      updatedAt,
      usageCount,
      lastUsedAt: usageCount > 0 ? now - (1 + index) * HOUR : createdAt,
      ...(pinned ? { pinned } : {})
    };
  });

export type DemoTheme = 'light' | 'dark';

/** What `chrome.storage.local` holds for the images: the demo Library, the Welcome finished and the Release seen */
export const demoStore = (now: number, theme: DemoTheme, version: string): Record<string, unknown> => {
  const settings: Settings = { ...DEFAULT_SETTINGS, theme, interfaceMode: 'sidepanel' };
  const welcome: WelcomeRecord = { status: 'done' };
  const whatsNew: WhatsNewRecord = { installedVersion: version, lastSeenVersion: version };
  return {
    prompts: demoPrompts(now),
    categories: DEMO_CATEGORIES,
    settings,
    interfaceMode: settings.interfaceMode,
    [WELCOME_KEY]: welcome,
    [WHATS_NEW_KEY]: whatsNew
  };
};

/** A first install at the Welcome's last step, the Packs: an empty Library, the Welcome pending there */
export const packsStore = (theme: DemoTheme, version: string): Record<string, unknown> => {
  const settings: Settings = { ...DEFAULT_SETTINGS, theme, interfaceMode: 'popup' };
  const welcome: WelcomeRecord = { status: 'pending', step: 2 };
  const whatsNew: WhatsNewRecord = { installedVersion: version };
  return { settings, interfaceMode: settings.interfaceMode, [WELCOME_KEY]: welcome, [WHATS_NEW_KEY]: whatsNew };
};
