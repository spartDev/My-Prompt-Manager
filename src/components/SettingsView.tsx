import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FC, ReactNode } from 'react';

import manifest from '../../manifest.json';
import { getDefaultEnabledPlatforms } from '../config/platforms';
import { StorageManager } from '../services/storage';
import type { Prompt, Category, Settings as UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import type { ToastSettings } from '../types/hooks';
import { Logger, toError } from '../utils';

import { ClaudeIcon, ChatGPTIcon, PerplexityIcon, MistralIcon, GeminiIcon, CopilotIcon } from './icons/SiteIcons';
import AboutSection from './settings/AboutSection';
import AdvancedSection from './settings/AdvancedSection';
import AppearanceSection from './settings/AppearanceSection';
import DataStorageSection from './settings/DataStorageSection';
import NotificationSection from './settings/NotificationSection';
import SiteIntegrationSection from './settings/SiteIntegrationSection';
import ViewHeader from './ViewHeader';

interface SiteConfig {
  name: string;
  description: string;
  icon: ReactNode | ((isEnabled: boolean) => ReactNode);
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
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  toastSettings: ToastSettings;
  onToastSettingsChange: (settings: Partial<ToastSettings>) => void;
}

const SectionSeparator: FC = () => (
  <div className="flex items-center justify-center my-8">
    <div className="flex items-center gap-3">
      <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-300 dark:to-gray-600"></div>
      <div className="flex gap-1.5">
        <div className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      </div>
      <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-300 dark:to-gray-600"></div>
    </div>
  </div>
);

const SettingsView: FC<SettingsViewProps> = ({ onBack, showToast, toastSettings, onToastSettingsChange }) => {
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

  // Data for import/export
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const storageManager = StorageManager.getInstance();

  // Track initial mount to skip saving on first render
  const isInitialMount = useRef(true);

  const siteConfigs: Record<string, SiteConfig> = useMemo(() => ({
    'www.perplexity.ai': {
      name: 'Perplexity',
      description: 'AI-powered search engine',
      icon: <PerplexityIcon />
    },
    'claude.ai': {
      name: 'Claude',
      description: 'Anthropic\'s AI assistant',
      icon: <ClaudeIcon />
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      description: 'OpenAI\'s conversational AI',
      icon: <ChatGPTIcon />
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

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      // Load extension settings
      const result = await chrome.storage.local.get(['promptLibrarySettings', 'interfaceMode', 'settings']);
      const savedSettings = result.promptLibrarySettings as Partial<Settings> | undefined;
      const loadedSettings: Settings = {
        ...defaultSettings,
        ...(savedSettings ?? {})
      };
      setSettings(loadedSettings);
      
      // Load interface mode
      const savedInterfaceMode = result.interfaceMode as 'popup' | 'sidepanel' | undefined;
      setInterfaceMode(savedInterfaceMode ?? (DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel'));
      
      // Load user settings (theme, view mode, etc.)
      const savedUserSettings = result.settings as UserSettings | undefined;
      if (savedUserSettings) {
        setUserSettings(savedUserSettings);
      }
      
      // Load prompts and categories
      const [loadedPrompts, loadedCategories] = await Promise.all([
        storageManager.getPrompts(),
        storageManager.getCategories()
      ]);
      setPrompts(loadedPrompts);
      setCategories(loadedCategories);
    } catch (error) {
      Logger.error('Failed to load settings', toError(error));
      setSettings(defaultSettings);
      setInterfaceMode(DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel');
    } finally {
      setLoading(false);
    }
  }, [defaultSettings, storageManager]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Debounced persistence: save settings after user stops making changes
  useEffect(() => {
    // Skip saving on initial mount (when settings are loaded)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce: wait 150ms after last change before saving
    const timeoutId = setTimeout(() => {
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
  }, [settings]);

  // Save settings
  const saveSettings = async (newSettings: Settings) => {
    setSaving(true);
    try {
      await chrome.storage.local.set({ 
        promptLibrarySettings: newSettings 
      });
      
      // Notify content scripts of changes
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'settingsUpdated',
              settings: newSettings
            });
          } catch {
            // Tab might not have content script loaded, ignore error
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to save settings', toError(error));
    } finally {
      setSaving(false);
    }
  };


  // Handle interface mode change
  const handleInterfaceModeChange = async (mode: 'popup' | 'sidepanel') => {
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
  };

  // Handle site toggle
  const handleSiteToggle = (hostname: string, enabled: boolean) => {
    // Group hostnames that should be toggled together
    const linkedSites: Record<string, string[]> = {
      'copilot.microsoft.com': ['copilot.microsoft.com', 'm365.cloud.microsoft'],
      'm365.cloud.microsoft': ['copilot.microsoft.com', 'm365.cloud.microsoft']
    };

    // Get all hostnames to toggle (either the linked group or just the single hostname)
    const hostnamesToToggle = linkedSites[hostname] ?? [hostname];

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

  // Handle custom site toggle
  const handleCustomSiteToggle = async (hostname: string, enabled: boolean) => {
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
  };

  // Handle remove custom site
  const handleRemoveCustomSite = async (hostname: string) => {
    const newCustomSites = settings.customSites.filter(site => site.hostname !== hostname);
    
    const newSettings = {
      ...settings,
      customSites: newCustomSites
    };
    
    setSettings(newSettings);
    await saveSettings(newSettings);
    
    // Notify tabs about the removal
    await notifyCustomSiteChange(hostname);
  };

  // Notify custom site change
  const notifyCustomSiteChange = async (hostname: string) => {
    try {
      // Since we're using universal content script, just notify existing tabs
      const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
      
      for (const tab of tabs) {
        if (tab.id) {
          try {
            // Notify the content script to reinitialize
            await chrome.tabs.sendMessage(tab.id, {
              action: 'reinitialize',
              reason: 'custom_site_added'
            });
          } catch {
            // Tab might not have content script loaded yet, ignore error
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to notify custom site change', toError(error));
    }
  };

  // Handle add custom site
  const handleAddCustomSite = async (siteData: Omit<CustomSite, 'dateAdded'>) => {
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
  };

  // Handle debug mode toggle
  const handleDebugModeChange = async (enabled: boolean) => {
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
  };

  // Handle import data
  const handleImportData = async (data: { prompts: Prompt[]; categories: Category[] }) => {
    try {
      // Import categories first (prompts reference categories)
      for (const category of data.categories) {
        await storageManager.importCategory(category);
      }
      
      // Import prompts
      for (const prompt of data.prompts) {
        await storageManager.importPrompt(prompt);
      }
      
      // Reload data
      await loadSettings();
      
      alert(`Successfully imported ${data.prompts.length.toString()} prompts and ${data.categories.length.toString()} categories!`);
    } catch (error) {
      Logger.error('Import failed', toError(error));
      throw error;
    }
  };

  // Handle clear data
  const handleClearData = async () => {
    try {
      await chrome.storage.local.clear();
      await loadSettings();
      alert('All data has been cleared.');
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
      alert('Settings have been reset to defaults.');
    } catch (error) {
      Logger.error('Failed to reset settings', toError(error));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <ViewHeader
        icon="settings"
        title="Settings"
        subtitle="Customize your experience"
      >
        <ViewHeader.Actions>
          <ViewHeader.BackButton onClick={onBack} />
        </ViewHeader.Actions>
      </ViewHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Appearance Section */}
          <AppearanceSection
            interfaceMode={interfaceMode}
            onInterfaceModeChange={(mode) => void handleInterfaceModeChange(mode)}
            saving={saving}
            interfaceModeChanging={interfaceModeChanging}
          />

          <SectionSeparator />

          {/* Site Integration Section */}
          <SiteIntegrationSection
            enabledSites={settings.enabledSites}
            customSites={settings.customSites}
            siteConfigs={siteConfigs}
            interfaceMode={interfaceMode}
            onSiteToggle={(hostname, enabled) => { handleSiteToggle(hostname, enabled); }}
            onCustomSiteToggle={(hostname, enabled) => void handleCustomSiteToggle(hostname, enabled)}
            onRemoveCustomSite={(hostname) => void handleRemoveCustomSite(hostname)}
            onAddCustomSite={(siteData) => void handleAddCustomSite(siteData as Omit<CustomSite, 'dateAdded'>)}
            saving={saving}
            onShowToast={showToast}
          />

          <SectionSeparator />

          {/* Data & Storage Section */}
          <DataStorageSection
            prompts={prompts}
            categories={categories}
            onImport={handleImportData}
            onClearData={handleClearData}
          />

          {/* Notification Settings Section */}
          <NotificationSection
            settings={toastSettings}
            onSettingsChange={onToastSettingsChange}
            onTestToast={(type) => {
              showToast(`This is a ${type} notification`, type);
            }}
          />

          {/* Advanced Section */}
          <AdvancedSection
            debugMode={settings.debugMode}
            onDebugModeChange={(enabled) => void handleDebugModeChange(enabled)}
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
