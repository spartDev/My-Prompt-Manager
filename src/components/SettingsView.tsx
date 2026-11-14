import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import manifest from '../../manifest.json';
import { NATURAL_SORT_DIRECTION } from '../constants';
import { AdmissionRefusedError } from '../services/promptAdmission';
import {
  changeSiteSettings,
  defaultSiteSettings,
  onSiteSettingsChanged,
  readSiteSettings,
  type SiteSettings,
  type SiteSettingsChange, 
  sendSiteSettingsToTabs
} from '../services/siteSettings';
import { StorageManager } from '../services/storage';
import type { AppError, Category, CustomSite, Prompt, SortOrder, Settings as UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import type { ShowToast, ToastSettings } from '../types/hooks';
import { formatCount, Logger, toError } from '../utils';

import { ChatGPTIcon, ClaudeIcon, CopilotIcon, GeminiIcon, MistralIcon, PerplexityIcon } from './icons/SiteIcons';
import SectionHeader from './SectionHeader';
import AdvancedSection from './settings/AdvancedSection';
import AppearanceSection from './settings/AppearanceSection';
import DataStorageSection, { type ImportReport } from './settings/DataStorageSection';
import HelpSection from './settings/HelpSection';
import LibrarySection from './settings/LibrarySection';
import NotificationSection from './settings/NotificationSection';
import SiteIntegrationSection from './settings/SiteIntegrationSection';
import type { SiteConfig } from './settings/SupportedSitesList';
import ViewHeader from './ViewHeader';

type Settings = SiteSettings;

interface SettingsViewProps {
  context?: 'popup' | 'sidepanel';
  showToast: ShowToast;
  toastSettings: ToastSettings;
  onToastSettingsChange: (settings: Partial<ToastSettings>) => void;
  /** Opens the storage warning with why storage refused the import */
  onStorageRefused: (reason: string) => void;
  /** Put the keyboard on Import (the empty Library's "Import a backup" opened Settings), then call onImportFocused */
  focusImport?: boolean;
  onImportFocused?: () => void;
}

const SettingsView: FC<SettingsViewProps> = ({ context = 'popup', showToast, toastSettings, onToastSettingsChange, onStorageRefused, focusImport = false, onImportFocused }) => {
  const [settings, setSettings] = useState<Settings>({
    enabledSites: [],
    customSites: [],
    debugMode: false
  });

  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Interface mode states
  const [interfaceMode, setInterfaceMode] = useState<'popup' | 'sidepanel'>(DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel');
  const [interfaceModeChanging, setInterfaceModeChanging] = useState(false);

  // What the last import skipped, or why it stopped, until the user dismisses it
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // Data for import/export
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Set when the last load could not read the Library: it is unknown, not empty, so it is neither
  // counted nor exported (My-Prompt-Manager-spi)
  const [libraryUnavailable, setLibraryUnavailable] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ used: number; total: number } | null>(null);

  const storageManager = useMemo(() => StorageManager.getInstance(), []);

  // The Platforms, in the order the AI sites group lists them
  const siteConfigs: Record<string, SiteConfig> = useMemo(() => ({
    'claude.ai': {
      name: 'Claude',
      icon: (isEnabled: boolean) => <ClaudeIcon disabled={!isEnabled} />
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      icon: (isEnabled: boolean) => <ChatGPTIcon disabled={!isEnabled} />
    },
    'gemini.google.com': {
      name: 'Google Gemini',
      icon: (isEnabled: boolean) => <GeminiIcon disabled={!isEnabled} />
    },
    'chat.mistral.ai': {
      name: 'Mistral AI',
      icon: (isEnabled: boolean) => <MistralIcon disabled={!isEnabled} />
    },
    'www.perplexity.ai': {
      name: 'Perplexity',
      icon: (isEnabled: boolean) => <PerplexityIcon disabled={!isEnabled} />
    },
    'copilot.microsoft.com': {
      name: 'Microsoft Copilot',
      icon: (isEnabled: boolean) => <CopilotIcon disabled={!isEnabled} className="scale-75" />
    }
  }), []);

  // Whether Settings has shown Site settings yet: only its first read falls back to the defaults
  const siteSettingsShown = useRef(false);

  // Counts the changes of the stored Site settings Settings has been told of. A read or a change that
  // was under way when one arrived holds older Site settings than the ones now shown, and is not shown.
  const siteSettingsRevision = useRef(0);
  const showSiteSettingsSince = useCallback((revision: number, siteSettings: SiteSettings) => {
    if (siteSettingsRevision.current === revision) {
      setSettings(siteSettings);
    }
  }, []);

  // Load settings. The Site settings and the Library are read apart, so a Library that fails to load
  // leaves the Site settings shown as storage has them.
  const loadSettings = useCallback(async () => {
    const revision = siteSettingsRevision.current;
    try {
      showSiteSettingsSince(revision, await readSiteSettings());
      siteSettingsShown.current = true;
    } catch (error) {
      Logger.error('Failed to load the Site settings', toError(error), { component: 'SettingsView', operation: 'loadSiteSettings' });
      // A first read that fails shows the defaults. Shown, never saved: a change is applied to what
      // storage holds, and is refused while storage cannot be read. A later read that fails keeps
      // what is shown.
      if (!siteSettingsShown.current) {
        setSettings(defaultSiteSettings());
        siteSettingsShown.current = true;
      }
    }

    try {
      const result = await chrome.storage.local.get(['interfaceMode', 'settings']);

      // Load interface mode
      const savedInterfaceMode = result.interfaceMode as 'popup' | 'sidepanel' | undefined;
      setInterfaceMode(savedInterfaceMode ?? (DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel'));

      // Load user settings (theme, view mode, etc.)
      const savedUserSettings = result.settings as UserSettings | undefined;
      if (savedUserSettings) {
        setUserSettings(savedUserSettings);
      }
    } catch (error) {
      Logger.error('Failed to load settings', toError(error));
    }

    try {
      // Load the Library, for its export and its count
      const [loadedPrompts, loadedCategories] = await Promise.all([
        storageManager.getPrompts(),
        storageManager.getCategories()
      ]);
      setPrompts(loadedPrompts);
      setCategories(loadedCategories);
      setLibraryUnavailable(false);
    } catch (error) {
      Logger.error('Failed to load the Library', toError(error), { component: 'SettingsView', operation: 'loadLibrary' });
      setLibraryUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [storageManager, showSiteSettingsSince]);

  // The storage bar shows what Chrome stores and follows every write, whoever makes it: the default
  // Category written on load, a change of the Site settings, an import, Clear All Data, another
  // surface. The last reading asked for wins, so an older reply never overwrites a newer one.
  const usageReading = useRef(0);
  useEffect(() => {
    const readStorageUsage = async () => {
      const reading = ++usageReading.current;
      try {
        const usage = await storageManager.getStorageUsage();
        if (reading === usageReading.current) {
          setStorageUsage(usage);
        }
      } catch (error) {
        Logger.warn('Failed to read storage usage', { component: 'SettingsView', error: toError(error) });
      }
    };
    const handleStorageChange = (_changes: unknown, areaName: string) => {
      if (areaName === 'local') {
        void readStorageUsage();
      }
    };

    void readStorageUsage();
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => { chrome.storage.onChanged.removeListener(handleStorageChange); };
  }, [storageManager]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // The Site settings follow storage, whoever changes them: this surface, the other one, Clear All Data
  useEffect(() => onSiteSettingsChanged((siteSettings) => {
    siteSettingsRevision.current += 1;
    siteSettingsShown.current = true;
    setSettings(siteSettings);
  }), []);

  /**
   * Makes one change to the Site settings. The module applies it to what storage holds, saves it and
   * tells the tabs; Settings shows the result. A change that fails leaves the switch where storage has
   * it and says so.
   */
  const changeSettings = useCallback(async (change: SiteSettingsChange) => {
    setSaving(true);
    const revision = siteSettingsRevision.current;
    try {
      // The module tells the tabs before it answers. What storage held after the write has already
      // been shown, from storage: this change, or a later one from another surface, which this
      // older answer must not replace
      showSiteSettingsSince(revision, await changeSiteSettings(change));
    } catch (error) {
      Logger.error('Failed to save the Site settings', toError(error), { component: 'SettingsView', operation: 'changeSiteSettings', change: change.type });
      showToast("Couldn't save the setting", 'error');
      try {
        const revisionAtRead = siteSettingsRevision.current;
        showSiteSettingsSince(revisionAtRead, await readSiteSettings());
      } catch {
        // Storage cannot be read either: what is shown stays
      }
    } finally {
      setSaving(false);
    }
  }, [showToast, showSiteSettingsSince]);

  // Handle Library sort change: each sort is saved with its one direction
  const handleSortOrderChange = useCallback((sortOrder: SortOrder) => {
    const sortDirection = NATURAL_SORT_DIRECTION[sortOrder];
    setUserSettings(prev => ({ ...(prev ?? DEFAULT_SETTINGS), sortOrder, sortDirection }));
    storageManager.updateSettings({ sortOrder, sortDirection }).catch((error: unknown) => {
      Logger.error('Failed to save sort order', toError(error), { component: 'SettingsView' });
      showToast("Couldn't save the sort order", 'error');
    });
  }, [storageManager, showToast]);

  // Handle interface mode change
  const handleInterfaceModeChange = useCallback(async (mode: 'popup' | 'sidepanel') => {
    try {
      setSaving(true);
      setInterfaceModeChanging(true);

      await chrome.storage.local.set({ interfaceMode: mode });
      setInterfaceMode(mode);

      setTimeout(() => {
        setInterfaceModeChanging(false);
      }, 3000);
    } catch (error) {
      Logger.error('Failed to save interface mode', toError(error));
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSiteToggle = useCallback((hostname: string, enabled: boolean) => {
    void changeSettings({ type: 'setPlatformEnabled', hostname, enabled });
  }, [changeSettings]);

  const handleCustomSiteToggleCallback = useCallback((hostname: string, enabled: boolean) => {
    void changeSettings({ type: 'setCustomSiteEnabled', hostname, enabled });
  }, [changeSettings]);

  const handleRemoveCustomSiteCallback = useCallback((hostname: string) => {
    void changeSettings({ type: 'removeCustomSite', hostname });
  }, [changeSettings]);

  const handleAddCustomSiteCallback = useCallback((site: Omit<CustomSite, 'dateAdded'>) => {
    void changeSettings({ type: 'addCustomSite', site });
  }, [changeSettings]);

  const handleDebugModeChangeCallback = useCallback((enabled: boolean) => {
    void changeSettings({ type: 'setDebugMode', enabled });
  }, [changeSettings]);

  // Handle import data
  const handleImportData = async (data: { prompts: Prompt[]; categories: Category[] }) => {
    setImportReport(null);
    // An item that is refused at Admission (ADR-001) is skipped and reported; the rest are restored.
    const skipped: ImportReport['skipped'] = [];
    // Counted as they go: an import that stops keeps what it imported before
    const imported = { categories: 0, prompts: 0 };
    // The Categories a restored Prompt names that neither the Backup nor the Library has are created
    // with it (PR #487): they count with the Backup's own
    let createdCategories = 0;

    const importEach = async <T,>(
      items: readonly T[],
      kind: keyof typeof imported,
      id: (item: T) => string,
      label: (item: T) => string,
      importItem: (item: T) => Promise<unknown>
    ): Promise<void> => {
      for (const item of items) {
        try {
          await importItem(item);
          imported[kind] += 1;
        } catch (error) {
          if (!(error instanceof AdmissionRefusedError)) {
            throw error;
          }
          skipped.push({ key: `${kind}:${id(item)}`, label: label(item), reason: error.message });
        }
      }
    };

    try {
      // Import categories first (prompts reference categories)
      await importEach(data.categories, 'categories', (category) => category.id || category.name, (category) => category.name, (category) => storageManager.importCategory(category));
      const namesBefore = new Set((await storageManager.getCategories()).map((category) => category.name));
      await importEach(data.prompts, 'prompts', (prompt) => prompt.id, (prompt) => prompt.title, (prompt) => storageManager.importPrompt(prompt));
      createdCategories = (await storageManager.getCategories()).filter((category) => !namesBefore.has(category.name)).length;
    } catch (error) {
      Logger.error('Import failed', toError(error));
      // Show the Prompts imported before it stopped
      await loadSettings();

      const appError = error as AppError;
      const total = data.prompts.length;
      const count = `${imported.prompts.toString()} of ${formatCount(total, 'prompt was', 'prompts were')}`;
      // Like a refused save, a refusal for storage opens the storage warning (not the file's fault)
      if (appError.type === 'STORAGE_QUOTA_EXCEEDED') {
        onStorageRefused(`The import stopped when storage was full: ${count} imported. ${appError.message}`);
        return;
      }
      // Any other error: the report says how many were imported and why it stopped, which a
      // one-line Notification cannot hold
      const reason = error instanceof Error ? error.message : 'Unknown error occurred';
      setImportReport({ skipped, stopped: { imported: imported.prompts, total, reason } });
      showToast('Import stopped', 'error', { sub: `${count} imported. See Your data.` });
      return;
    }

    // Reload data
    await loadSettings();

    const summary = `${formatCount(imported.prompts, 'prompt', 'prompts')} and ${formatCount(imported.categories + createdCategories, 'category', 'categories')}`;
    if (skipped.length === 0) {
      showToast('Backup imported', 'success', { sub: summary });
    } else {
      // Every skipped title and reason stays in Your data: a Notification shows one line
      setImportReport({ skipped });
      showToast(`Skipped ${skipped.length.toString()}`, 'warning', { sub: `Imported ${summary}. See Your data.` });
    }
  };

  const dismissImportReport = useCallback(() => { setImportReport(null); }, []);

  // Clear All Data leaves no Site settings stored: the defaults. The tabs are told too, since a
  // Platform the user had turned off is on again.
  const handleClearData = async () => {
    try {
      await storageManager.clearAllData();
      // Shown before the reload, so they stay shown when it fails
      setSettings(defaultSiteSettings());
      setInterfaceMode(DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel');
      await sendSiteSettingsToTabs(defaultSiteSettings());
      await loadSettings();
      showToast('All data cleared', 'success');
    } catch (error) {
      Logger.error('Failed to clear data', toError(error));
      throw error;
    }
  };

  // Handle reset settings
  const handleResetSettings = async () => {
    try {
      const revision = siteSettingsRevision.current;
      showSiteSettingsSince(revision, await changeSiteSettings({ type: 'reset' }));
      await chrome.storage.local.set({ interfaceMode: 'popup' });
      setInterfaceMode('popup');

      if (userSettings) {
        const defaultUserSettings: UserSettings = {
          ...userSettings,
          theme: 'system',
          sortOrder: 'updatedAt',
          defaultCategory: 'Uncategorized'
        };
        await storageManager.updateSettings(defaultUserSettings);
      }

      await loadSettings();
      showToast('Settings reset', 'success', { sub: 'Back to defaults' });
    } catch (error) {
      Logger.error('Failed to reset settings', toError(error));
      throw error;
    }
  };

  // Memoized callback wrappers for child components to prevent unnecessary re-renders
  const handleInterfaceModeChangeCallback = useCallback(
    (mode: 'popup' | 'sidepanel') => {
      void handleInterfaceModeChange(mode);
    },
    [handleInterfaceModeChange]
  );

  // Turning Notifications on shows one at once, as a preview of what comes back
  const handleNotificationsChange = useCallback(
    (enabled: boolean) => {
      onToastSettingsChange({ enabled });
      if (enabled) {
        showToast('Notifications on', 'success');
      }
    },
    [onToastSettingsChange, showToast]
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-app">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current text-accent mx-auto mb-4"></div>
          <p className="text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app">
      {/* Section header: the version is the Eyebrow. The side panel keeps its close button */}
      <SectionHeader title="Settings" eyebrow={`My Prompt Manager ${manifest.version}`}>
        {context === 'sidepanel' && (
          <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
        )}
      </SectionHeader>

      {/* Settings groups */}
      <div className="flex-1 overflow-y-auto" data-scroll-container>
        <div className="max-w-2xl mx-auto flex flex-col gap-[18px] p-4">
          <AppearanceSection
            interfaceMode={interfaceMode}
            onInterfaceModeChange={handleInterfaceModeChangeCallback}
            saving={saving}
            interfaceModeChanging={interfaceModeChanging}
          />

          <LibrarySection
            sortOrder={userSettings?.sortOrder ?? DEFAULT_SETTINGS.sortOrder}
            onSortOrderChange={handleSortOrderChange}
          />

          <SiteIntegrationSection
            enabledSites={settings.enabledSites}
            customSites={settings.customSites}
            siteConfigs={siteConfigs}
            interfaceMode={interfaceMode}
            onSiteToggle={handleSiteToggle}
            onCustomSiteToggle={handleCustomSiteToggleCallback}
            onRemoveCustomSite={handleRemoveCustomSiteCallback}
            onAddCustomSite={handleAddCustomSiteCallback}
            saving={saving}
            onShowToast={showToast}
          />

          <DataStorageSection
            prompts={prompts}
            categories={categories}
            libraryUnavailable={libraryUnavailable}
            storageUsage={storageUsage}
            onImport={handleImportData}
            importReport={importReport}
            onDismissImportReport={dismissImportReport}
            focusImport={focusImport}
            onImportFocused={onImportFocused}
            onClearData={handleClearData}
            onShowToast={showToast}
          />

          <NotificationSection
            settings={toastSettings}
            onEnabledChange={handleNotificationsChange}
          />

          <HelpSection />

          <AdvancedSection
            debugMode={settings.debugMode}
            onDebugModeChange={handleDebugModeChangeCallback}
            saving={saving}
            onReset={handleResetSettings}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
