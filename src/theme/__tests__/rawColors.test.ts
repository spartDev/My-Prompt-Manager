// @vitest-environment node
/**
 * Components moved to the color tokens (epic My-Prompt-Manager-el4) stay on them: no raw Tailwind
 * palette class and no dark: color variant. Each migration ticket adds its files to MIGRATED.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../..');

const MIGRATED = [
  // My-Prompt-Manager-el4.3: app shell and Library
  'App.tsx',
  'components/ViewHeader.tsx',
  'components/SectionHeader.tsx',
  'components/icons/HeaderIcons.tsx',
  'components/TabBar.tsx',
  'components/LibraryView.tsx',
  'components/LibraryFilterBar.tsx',
  'components/SearchBar.tsx',
  'components/PromptCard.tsx',
  // My-Prompt-Manager-el4.4: forms, dialogs and toasts
  'components/PromptEditor.tsx',
  'components/editor/CategoryChips.tsx',
  'components/editor/VariableTextarea.tsx',
  'components/Dropdown.tsx',
  'components/ConfirmDialog.tsx',
  'components/StorageWarning.tsx',
  'components/ToastContainer.tsx',
  'components/ErrorBoundary.tsx',
  // My-Prompt-Manager-el4.5.1: Categories
  'components/CategoryManager.tsx',
  'components/CategorySheet.tsx',
  'components/CategoryBadge.tsx',
  // My-Prompt-Manager-el4.5.2: general Settings sections
  'components/SettingsView.tsx',
  'components/settings/AppearanceSection.tsx',
  'components/settings/LibrarySection.tsx',
  'components/settings/DataStorageSection.tsx',
  'components/settings/NotificationSection.tsx',
  'components/settings/AdvancedSection.tsx',
  // My-Prompt-Manager-el4.5.3: site integration Settings (Platform brand colors stay in config/platforms.ts)
  'constants/brandColors.ts',
  'components/settings/SiteIntegrationSection.tsx',
  'components/settings/SupportedSitesList.tsx',
  'components/settings/CustomSitesList.tsx',
  'components/settings/AddMethodChooser.tsx',
  'components/settings/AddCustomSiteForm.tsx',
  'components/settings/SiteImportDrawer.tsx',
  'components/settings/ImportSection.tsx',
  'components/settings/ConfigurationPreview.tsx',
  // My-Prompt-Manager-7kd: Settings redesigned after Atelier 1C
  'components/settings/SettingsGroup.tsx',
  'components/settings/SettingsRow.tsx',
  'components/settings/SegmentedControl.tsx',
  'components/settings/Switch.tsx',
  'components/settings/SiteRow.tsx',
  'components/settings/HelpSection.tsx',
  'components/settings/rowStyles.ts',
  // My-Prompt-Manager-el4.6: Analytics (the chart colors of theme/chartColors.ts read tokens)
  'components/analytics/AnalyticsTab.tsx',
  'components/analytics/AnalyticsDashboard.tsx',
  'components/analytics/charts/TimeOfDayChart.tsx',
  // My-Prompt-Manager-6k3: Analytics redesigned after Atelier 1C
  'components/analytics/StatsHero.tsx',
  'components/analytics/MostUsedCard.tsx',
  'components/analytics/TidyUpCard.tsx',
  // My-Prompt-Manager-160: the full-page Analytics view after the Analytics tab
  'components/analytics/StatCard.tsx',
  'components/analytics/RankedRows.tsx',
  'components/analytics/charts/DailyUseChart.tsx',
  'components/analytics/charts/ChartTooltip.tsx',
  // My-Prompt-Manager-q9j: the Prompt selector shown on Platforms (plain CSS in a shadow root, on the tokens)
  'content/selector/PickerPopover.tsx',
  'content/selector/PickerTabs.tsx',
  'content/selector/PickerList.tsx',
  'content/selector/PickerFill.tsx',
  // My-Prompt-Manager-q9j.3: confirmation of an Insertion
  'content/selector/InsertionFeedback.tsx'
];

// Agent guidance that prescribes classes follows the same rule, or it steers UI work off the tokens
// (My-Prompt-Manager-192, My-Prompt-Manager-uxu.3). Paths from the repository root.
const GUIDANCE = [
  '.claude/skills/design-system/SKILL.md',
  '.claude/skills/add-platform/SKILL.md',
  'docs/COMPONENTS.md',
  'docs/DESIGN_GUIDELINES.md'
];

const PALETTE = 'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY = 'bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|from|via|to|fill|stroke|divide|placeholder|decoration|shadow|accent|caret';

/** bg-gray-50, hover:text-purple-600, from-white, border-t-purple-500/30, bg-primary-600 (tailwind.config.js)... */
const RAW_PALETTE_CLASS = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:${COLOR_UTILITY})-(?:(?:${PALETTE})(?:-\\d{2,3})?|primary-\\d{2,3})(?:\\/\\d+)?(?![\\w-])`, 'g');
/** dark:bg-card, dark:hover:text-secondary: a token class switches theme by itself */
const DARK_COLOR_VARIANT = new RegExp(`(?<![\\w-])dark:(?:[\\w-]+:)*(?:${COLOR_UTILITY})-[\\w()/-]+`, 'g');

/** A `// Before` or `// Don't` comment line in a code block opens a counter-example */
const COUNTER_EXAMPLE = /^\s*\/\/\s*(?:Before|Don't)\b/i;

/** An `// After` comment line opens the prescribed version, so it ends a counter-example */
const PRESCRIBED_EXAMPLE = /^\s*\/\/\s*After\b/i;

/**
 * Guidance minus the counter-examples it shows on purpose: in a fenced code block, the lines from a
 * `// Before` or `// Don't` comment to the next blank line, `// After` comment or the end of the block.
 */
function withoutCounterExamples(markdown: string): string {
  let inBlock = false;
  let inCounterExample = false;

  return markdown
    .split('\n')
    .filter((line) => {
      if (line.trim().startsWith('```')) {
        inBlock = !inBlock;
        inCounterExample = false;
        return true;
      }
      if (!inBlock) {
        return true;
      }
      if (COUNTER_EXAMPLE.test(line)) {
        inCounterExample = true;
      } else if (line.trim() === '' || PRESCRIBED_EXAMPLE.test(line)) {
        inCounterExample = false;
      }
      return !inCounterExample;
    })
    .join('\n');
}

describe('Components on the color tokens', () => {
  it.each(MIGRATED)('%s uses no raw palette class and no dark: color variant', (file) => {
    const source = readFileSync(path.join(SRC, file), 'utf8');

    expect(source.match(RAW_PALETTE_CLASS) ?? [], 'raw palette classes').toEqual([]);
    expect(source.match(DARK_COLOR_VARIANT) ?? [], 'dark: color variants').toEqual([]);
  });

  it.each(GUIDANCE)('%s prescribes no raw palette class and no dark: color variant', (file) => {
    const source = withoutCounterExamples(readFileSync(path.resolve(SRC, '..', file), 'utf8'));

    expect(source.match(RAW_PALETTE_CLASS) ?? [], 'raw palette classes').toEqual([]);
    expect(source.match(DARK_COLOR_VARIANT) ?? [], 'dark: color variants').toEqual([]);
  });

  it('exempts only the counter-examples of a guide', () => {
    const guide = [
      '```tsx',
      '// Before',
      '<div className="bg-white dark:bg-gray-800">',
      '',
      '// After',
      '<div className="bg-card text-gray-500">',
      "// Don't pair a raw class with a dark: variant",
      '<p className="text-gray-900 dark:text-gray-100">',
      '```',
      '<p className="text-purple-600">'
    ].join('\n');
    const kept = withoutCounterExamples(guide);

    expect(kept.match(RAW_PALETTE_CLASS)).toEqual(['text-gray-500', 'text-purple-600']);
    expect(kept.match(DARK_COLOR_VARIANT)).toBeNull();
  });

  it('ends a counter-example at an `// After` comment, blank line or not', () => {
    const guide = ['```tsx', '// Before', '<div className="bg-white">', '// After', '<div className="bg-card text-gray-500">', '```'].join('\n');

    expect(withoutCounterExamples(guide).match(RAW_PALETTE_CLASS)).toEqual(['text-gray-500']);
  });
});
