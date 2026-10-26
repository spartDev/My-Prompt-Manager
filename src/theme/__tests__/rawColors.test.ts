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
  'components/icons/HeaderIcons.tsx',
  'components/TabBar.tsx',
  'components/LibraryView.tsx',
  'components/LibraryFilterBar.tsx',
  'components/SearchBar.tsx',
  'components/PromptCard.tsx',
  // My-Prompt-Manager-el4.4: forms, dialogs and toasts
  'components/AddPromptForm.tsx',
  'components/EditPromptForm.tsx',
  'components/Dropdown.tsx',
  'components/ConfirmDialog.tsx',
  'components/StorageWarning.tsx',
  'components/ToastContainer.tsx',
  'components/ErrorBoundary.tsx',
  // My-Prompt-Manager-el4.5.1: Categories
  'components/CategoryManager.tsx',
  'components/ColorPicker.tsx',
  'components/CategoryBadge.tsx',
  // My-Prompt-Manager-el4.5.2: general Settings sections
  'components/SettingsView.tsx',
  'components/settings/SettingsSection.tsx',
  'components/settings/ToggleSwitch.tsx',
  'components/settings/AppearanceSection.tsx',
  'components/InterfaceModeSelector.tsx',
  'components/ThemeToggle.tsx',
  'components/settings/LibrarySection.tsx',
  'components/settings/DataStorageSection.tsx',
  'components/settings/NotificationSection.tsx',
  'components/settings/AdvancedSection.tsx',
  'components/settings/AboutSection.tsx',
  // My-Prompt-Manager-el4.5.3: site integration Settings (Platform brand colors stay in config/platforms.ts)
  'constants/brandColors.ts',
  'components/settings/SiteIntegrationSection.tsx',
  'components/settings/SupportedSitesList.tsx',
  'components/settings/CustomSitesList.tsx',
  'components/settings/SiteCard.tsx',
  'components/settings/ExportButton.tsx',
  'components/settings/AddCustomSiteCard.tsx',
  'components/settings/EmptyCustomSitesState.tsx',
  'components/settings/AddMethodChooser.tsx',
  'components/settings/AddCustomSiteForm.tsx',
  'components/settings/SiteImportDrawer.tsx',
  'components/settings/ImportSection.tsx',
  'components/settings/ConfigurationPreview.tsx'
];

const PALETTE = 'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY = 'bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|from|via|to|fill|stroke|divide|placeholder|decoration|shadow|accent|caret';

/** bg-gray-50, hover:text-purple-600, from-white, border-t-purple-500/30, bg-primary-600 (tailwind.config.js)... */
const RAW_PALETTE_CLASS = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:${COLOR_UTILITY})-(?:(?:${PALETTE})(?:-\\d{2,3})?|primary-\\d{2,3})(?:\\/\\d+)?(?![\\w-])`, 'g');
/** dark:bg-card, dark:hover:text-secondary: a token class switches theme by itself */
const DARK_COLOR_VARIANT = new RegExp(`(?<![\\w-])dark:(?:[\\w-]+:)*(?:${COLOR_UTILITY})-[\\w()/-]+`, 'g');

describe('Components on the color tokens', () => {
  it.each(MIGRATED)('%s uses no raw palette class and no dark: color variant', (file) => {
    const source = readFileSync(path.join(SRC, file), 'utf8');

    expect(source.match(RAW_PALETTE_CLASS) ?? [], 'raw palette classes').toEqual([]);
    expect(source.match(DARK_COLOR_VARIANT) ?? [], 'dark: color variants').toEqual([]);
  });
});
