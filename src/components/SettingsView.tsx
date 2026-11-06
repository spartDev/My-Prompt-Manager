import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import manifest from '../../manifest.json';
import { getDefaultEnabledPlatforms, getLinkedPlatformHostnames } from '../config/platforms';
import { NATURAL_SORT_DIRECTION } from '../constants';
import { AdmissionRefusedError } from '../services/promptAdmission';
import { StorageManager } from '../services/storage';
import type { AppError, Category, CustomSite as ImportedCustomSite, Prompt, SortOrder, Settings as UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import type { ToastType } from '../types/components';
import type { ToastSettings } from '../types/hooks';
import { formatCount, Logger, toError } from '../utils';

import { ChatGPTIcon, ClaudeIcon, CopilotIcon, GeminiIcon, MistralIcon, PerplexityIcon } from './icons/SiteIcons';
import AboutSection from './settings/AboutSection';
import AdvancedSection from './settings/AdvancedSection';
import AppearanceSection from './settings/AppearanceSection';
import DataStorageSection, { type ImportReport } from './settings/DataStorageSection';
import LibrarySection from './settings/LibrarySection';
import NotificationSection from './settings/NotificationSection';
import SiteIntegrationSection from './settings/SiteIntegrationSection';
import ViewHeader from './ViewHeader';

interface SiteConfig {
  name: string;
  description: string;
  icon: (isEnabled: boolean) => ReactNode;
}

interface CustomSite {
  hostname: string;
  displayName: string;
  icon?: string;
  enabled: boolean;
  dateAdded: number;
  positioning?: {
    mode: 'custom';
    selector: string;
    placement: 'before' | 'after' | 'inside-start' | 'inside-end';
    offset?: { x: number; y: number };
    zIndex?: number;
    description?: string;
  };
}

interface Settings {
  enabledSites: string[];
  customSites: CustomSite[];
  debugMode: boolean;
  floatingFallback: boolean;
}

interface SettingsViewProps {
  context?: 'popup' | 'sidepanel';
  showToast: (message: string, type?: ToastType) => void;
  toastSettings: ToastSettings;
  onToastSettingsChange: (settings: Partial<ToastSettings>) => void;
  /** Opens the storage warning with why storage refused the import */
  onStorageRefused: (reason: string) => void;
}

const SectionSeparator: FC = () => <hr className="border-default" />;

const SettingsView: FC<SettingsViewProps> = ({ context = 'popup', showToast, toastSettings, onToastSettingsChange, onStorageRefused }) => {
  const [settings, setSettings] = useState<Settings>({
    enabledSites: [],
    customSites: [],
    debugMode: false,
    floatingFallback: true
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

  // The site settings as storage and the tabs have them, null until Settings has loaded them.
  // Only settings that differ from them are saved and sent to the tabs.
  const storedSettings = useRef<Settings | null>(null);

  const siteConfigs: Record<string, SiteConfig> = useMemo(() => ({
    'www.perplexity.ai': {
      name: 'Perplexity',
      description: 'AI-powered search engine',
      icon: (isEnabled: boolean) => <PerplexityIcon disabled={!isEnabled} />
    },
    'claude.ai': {
      name: 'Claude',
      description: 'Anthropic\'s AI assistant',
      icon: (isEnabled: boolean) => <ClaudeIcon disabled={!isEnabled} />
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      description: 'OpenAI\'s conversational AI',
      icon: (isEnabled: boolean) => <ChatGPTIcon disabled={!isEnabled} />
    },
    'gemini.google.com': {
      name: 'Google Gemini',
      description: 'Google\'s AI assistant',
      icon: (isEnabled: boolean) => <GeminiIcon disabled={!isEnabled} />
    },
    'chat.mistral.ai': {
      name: 'Mistral AI',
      description: 'Mistral\'s conversational AI',
      icon: (isEnabled: boolean) => <MistralIcon disabled={!isEnabled} />
    },
    'copilot.microsoft.com': {
      name: 'Microsoft Copilot',
      description: 'Microsoft\'s AI assistant',
      icon: (isEnabled: boolean) => <CopilotIcon disabled={!isEnabled} className="scale-75" />
    }
  }), []);

  const defaultSettings: Settings = useMemo(() => ({
    enabledSites: getDefaultEnabledPlatforms(),
    customSites: [],
    debugMode: false,
    floatingFallback: true
  }), []);

  // Load settings. The site settings and the Library are read apart: a Library that fails to load
  // leaves the site settings as storage has them, so the defaults are never saved over them.
  const loadSettings = useCallback(async () => {
    try {
      // Load extension settings
      const result = await chrome.storage.local.get(['promptLibrarySettings', 'interfaceMode', 'settings']);
      const savedSettings = result.promptLibrarySettings as Partial<Settings> | undefined;
      const loadedSettings: Settings = {
        ...defaultSettings,
        ...(savedSettings ?? {})
      };
      // The first load is what storage and the tabs already have: opening Settings changes nothing.
      // A later load (after an import, Clear All Data or a reset) is still sent if it differs.
      storedSettings.current ??= loadedSettings;
      setSettings(loadedSettings);

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
      // A first load that fails shows the defaults. Shown, not saved: only a change the user makes to
      // them is saved. A later load that fails keeps the settings shown: an import leaves the site
      // settings as they were, and the defaults would be saved over them (My-Prompt-Manager-4ax)
      if (storedSettings.current === null) {
        storedSettings.current = defaultSettings;
        setSettings(defaultSettings);
        setInterfaceMode(DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel');
      }
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
  }, [defaultSettings, storageManager]);

  // The storage bar shows what Chrome stores and follows every write, whoever makes it: the default
  // Category written on load, the site settings saved after it, an import, Clear All Data, another
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

  /**
   * Persists settings to chrome.storage.local and notifies all content scripts of changes.
   * Broadcasts a 'settingsUpdated' message to all HTTP/HTTPS tabs so they can update their behavior.
   * @param newSettings - The complete settings object to save
   */
  const saveSettings = useCallback(async (newSettings: Settings) => {
    setSaving(true);
    try {
      await chrome.storage.local.set({
        promptLibrarySettings: newSettings
      });
      storedSettings.current = newSettings;

      // Notify content scripts of changes in parallel
      const tabs = await chrome.tabs.query({});
      const httpTabs = tabs.filter(
        (tab): tab is chrome.tabs.Tab & { id: number } =>
          tab.id !== undefined && tab.url !== undefined &&
          (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
      );

      await Promise.allSettled(
        httpTabs.map(tab => chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: newSettings
        }))
      );
    } catch (error) {
      Logger.error('Failed to save settings', toError(error));
    } finally {
      setSaving(false);
    }
  }, []);

  // Debounced persistence: save settings after user stops making changes
  useEffect(() => {
    // Nothing to save before the settings are loaded. A timer armed then would hold the empty settings
    // Settings starts with: firing after the load and before its re-render, it would save them and
    // disable every Platform (My-Prompt-Manager-ds8)
    if (storedSettings.current === null) {
      return;
    }

    // Debounce: wait 150ms after last change before saving
    const timeoutId = setTimeout(() => {
      // Nothing to save when storage already has them
      if (JSON.stringify(settings) === JSON.stringify(storedSettings.current)) {
        return;
      }
      saveSettings(settings).catch((err: unknown) => {
        Logger.error('Failed to save settings', toError(err), {
          component: 'SettingsView',
          operation: 'persist'
        });
      });
    }, 150);

    // Cleanup: cancel pending save if settings change again
    return () => {
      clearTimeout(timeoutId);
    };
  }, [settings, saveSettings]);


  // Handle Library sort change: each sort is saved with its one direction
  const handleSortOrderChange = useCallback((sortOrder: SortOrder) => {
    const sortDirection = NATURAL_SORT_DIRECTION[sortOrder];
    setUserSettings(prev => ({ ...(prev ?? DEFAULT_SETTINGS), sortOrder, sortDirection }));
    storageManager.updateSettings({ sortOrder, sortDirection }).catch((error: unknown) => {
      Logger.error('Failed to save sort order', toError(error), { component: 'SettingsView' });
      showToast('Failed to save the sort order', 'error');
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

  // Handle site toggle
  const handleSiteToggle = (hostname: string, enabled: boolean) => {
    // Get all hostnames to toggle (includes linked platforms from configuration)
    const hostnamesToToggle = getLinkedPlatformHostnames(hostname);

    // Use functional setState to avoid stale closure reads during rapid clicks
    setSettings(prev => {
      let newEnabledSites: string[];

      if (enabled) {
        // Add all linked hostnames, avoiding duplicates
        newEnabledSites = [...prev.enabledSites];
        for (const site of hostnamesToToggle) {
          if (!newEnabledSites.includes(site)) {
            newEnabledSites.push(site);
          }
        }
      } else {
        // Remove all linked hostnames
        newEnabledSites = prev.enabledSites.filter(
          site => !hostnamesToToggle.includes(site)
        );
      }

      return {
        ...prev,
        enabledSites: newEnabledSites
      };
    });
    // Persistence now handled by debounced useEffect
  };

  /**
   * Notifies all tabs matching a hostname to reinitialize their content scripts.
   * Called after adding, removing, or modifying a custom site configuration.
   * @param hostname - The hostname of the custom site that changed
   */
  const notifyCustomSiteChange = useCallback(async (hostname: string) => {
    try {
      // Since we're using universal content script, just notify existing tabs
      const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
      const tabsWithIds = tabs.filter(
        (tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined
      );

      // Notify all tabs in parallel
      await Promise.allSettled(
        tabsWithIds.map(tab => chrome.tabs.sendMessage(tab.id, {
          action: 'reinitialize',
          reason: 'custom_site_added'
        }))
      );
    } catch (error) {
      Logger.error('Failed to notify custom site change', toError(error));
    }
  }, []);

  // Handle custom site toggle
  const handleCustomSiteToggle = useCallback(async (hostname: string, enabled: boolean) => {
    const newCustomSites = settings.customSites.map(site =>
      site.hostname === hostname ? { ...site, enabled } : site
    );

    const newSettings = {
      ...settings,
      customSites: newCustomSites
    };

    setSettings(newSettings);
    await saveSettings(newSettings);

    // Notify tabs about the change
    await notifyCustomSiteChange(hostname);
  }, [settings, saveSettings, notifyCustomSiteChange]);

  // Handle remove custom site
  const handleRemoveCustomSite = useCallback(async (hostname: string) => {
    const newCustomSites = settings.customSites.filter(site => site.hostname !== hostname);

    const newSettings = {
      ...settings,
      customSites: newCustomSites
    };

    setSettings(newSettings);
    await saveSettings(newSettings);

    // Notify tabs about the removal
    await notifyCustomSiteChange(hostname);
  }, [settings, saveSettings, notifyCustomSiteChange]);

  // Handle add custom site
  const handleAddCustomSite = useCallback(async (siteData: Omit<CustomSite, 'dateAdded'>) => {
    const newSite: CustomSite = {
      ...siteData,
      dateAdded: Date.now()
    };

    const newSettings = {
      ...settings,
      customSites: [...settings.customSites, newSite]
    };

    setSettings(newSettings);
    await saveSettings(newSettings);

    // Notify any open tabs to reinitialize
    await notifyCustomSiteChange(newSite.hostname);
  }, [settings, saveSettings, notifyCustomSiteChange]);

  // Handle debug mode toggle
  const handleDebugModeChange = useCallback(async (enabled: boolean) => {
    const newSettings = {
      ...settings,
      debugMode: enabled
    };

    setSettings(newSettings);
    await saveSettings(newSettings);

    // Update localStorage for immediate effect
    if (enabled) {
      localStorage.setItem('prompt-library-debug', 'true');
    } else {
      localStorage.removeItem('prompt-library-debug');
    }
  }, [settings, saveSettings]);

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
      // Any other error: the report says how many were imported and why it stopped, which a toast
      // cut at 80 characters cannot hold
      const reason = error instanceof Error ? error.message : 'Unknown error occurred';
      setImportReport({ skipped, stopped: { imported: imported.prompts, total, reason } });
      showToast(`Import stopped: ${count} imported. See Backup & Restore.`, 'error');
      return;
    }

    // Reload data
    await loadSettings();

    const summary = `${formatCount(imported.prompts, 'prompt', 'prompts')} and ${formatCount(imported.categories + createdCategories, 'category', 'categories')}`;
    if (skipped.length === 0) {
      showToast(`Successfully imported ${summary}!`, 'success');
    } else {
      // Every skipped title and reason stays in Backup & Restore: a toast shows 80 characters
      setImportReport({ skipped });
      showToast(`Imported ${summary}. Skipped ${skipped.length.toString()}: see Backup & Restore.`, 'warning');
    }
  };

  const dismissImportReport = useCallback(() => { setImportReport(null); }, []);

  // Handle clear data
  const handleClearData = async () => {
    try {
      await storageManager.clearAllData();
      await loadSettings();
      showToast('All data has been cleared.', 'success');
    } catch (error) {
      Logger.error('Failed to clear data', toError(error));
      throw error;
    }
  };

  // Handle reset settings
  const handleResetSettings = async () => {
    try {
      await chrome.storage.local.set({
        promptLibrarySettings: defaultSettings,
        interfaceMode: 'popup'
      });
      
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
      showToast('Settings have been reset to defaults.', 'success');
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

  const handleCustomSiteToggleCallback = useCallback(
    (hostname: string, enabled: boolean) => {
      void handleCustomSiteToggle(hostname, enabled);
    },
    [handleCustomSiteToggle]
  );

  const handleRemoveCustomSiteCallback = useCallback(
    (hostname: string) => {
      void handleRemoveCustomSite(hostname);
    },
    [handleRemoveCustomSite]
  );

  const handleAddCustomSiteCallback = useCallback(
    (siteData: Omit<ImportedCustomSite, 'dateAdded'> & { positioning?: ImportedCustomSite['positioning'] }) => {
      void handleAddCustomSite(siteData as Omit<CustomSite, 'dateAdded'>);
    },
    [handleAddCustomSite]
  );

  const handleTestToastCallback = useCallback(
    (type: ToastType) => {
      showToast(`This is a ${type} notification`, type);
    },
    [showToast]
  );

  const handleDebugModeChangeCallback = useCallback(
    (enabled: boolean) => {
      void handleDebugModeChange(enabled);
    },
    [handleDebugModeChange]
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
      {/* Header */}
      <ViewHeader
        icon="settings"
        title="Settings"
        subtitle="Customize your experience"
        context={context}
      >
        {context === 'sidepanel' && (
          <ViewHeader.Actions>
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          </ViewHeader.Actions>
        )}
      </ViewHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" data-scroll-container>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Appearance Section */}
          <AppearanceSection
            interfaceMode={interfaceMode}
            onInterfaceModeChange={handleInterfaceModeChangeCallback}
            saving={saving}
            interfaceModeChanging={interfaceModeChanging}
          />

          <SectionSeparator />

          {/* Library Section */}
          <LibrarySection
            sortOrder={userSettings?.sortOrder ?? DEFAULT_SETTINGS.sortOrder}
            onSortOrderChange={handleSortOrderChange}
          />

          <SectionSeparator />

          {/* Site Integration Section */}
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

          <SectionSeparator />

          {/* Data & Storage Section */}
          <DataStorageSection
            prompts={prompts}
            categories={categories}
            libraryUnavailable={libraryUnavailable}
            storageUsage={storageUsage}
            onImport={handleImportData}
            importReport={importReport}
            onDismissImportReport={dismissImportReport}
            onClearData={handleClearData}
            onShowToast={showToast}
          />

          {/* Notification Settings Section */}
          <NotificationSection
            settings={toastSettings}
            onSettingsChange={onToastSettingsChange}
            onTestToast={handleTestToastCallback}
          />

          {/* Advanced Section */}
          <AdvancedSection
            debugMode={settings.debugMode}
            onDebugModeChange={handleDebugModeChangeCallback}
            saving={saving}
          />

          {/* About & Reset Section */}
          <AboutSection
            version={manifest.version}
            onReset={handleResetSettings}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
