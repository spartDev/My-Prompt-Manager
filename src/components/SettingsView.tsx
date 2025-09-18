import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC, ReactNode } from 'react';

import { StorageManager } from '../services/storage';
import type { Prompt, Category, Settings as UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

import { ClaudeIcon, ChatGPTIcon, PerplexityIcon } from './icons/SiteIcons';
import AboutSection from './settings/AboutSection';
import AdvancedSection from './settings/AdvancedSection';
import AppearanceSection from './settings/AppearanceSection';
import DataStorageSection from './settings/DataStorageSection';
import SiteIntegrationSection from './settings/SiteIntegrationSection';

interface SiteConfig {
  name: string;
  description: string;
  icon: ReactNode;
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

const SettingsView: FC<SettingsViewProps> = ({ onBack }) => {
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
  const [interfaceMode, setInterfaceMode] = useState<'popup' | 'sidepanel'>(DEFAULT_SETTINGS.interfaceMode);
  const [interfaceModeChanging, setInterfaceModeChanging] = useState(false);
  
  // Data for import/export
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const storageManager = StorageManager.getInstance();

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
    }
  }), []);

  const defaultSettings: Settings = useMemo(() => ({
    enabledSites: ['www.perplexity.ai', 'claude.ai', 'chatgpt.com'],
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
      setInterfaceMode(savedInterfaceMode || DEFAULT_SETTINGS.interfaceMode);
      
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
      console.error('Failed to load settings:', error instanceof Error ? error.message : 'Unknown error');
      setSettings(defaultSettings);
      setInterfaceMode(DEFAULT_SETTINGS.interfaceMode);
    } finally {
      setLoading(false);
    }
  }, [defaultSettings, storageManager]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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
      console.error('Failed to save settings:', error instanceof Error ? error.message : 'Unknown error');
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
      console.error('Failed to save interface mode:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Handle site toggle
  const handleSiteToggle = async (hostname: string, enabled: boolean) => {
    const newEnabledSites = enabled 
      ? [...settings.enabledSites, hostname]
      : settings.enabledSites.filter(site => site !== hostname);
    
    const newSettings = {
      ...settings,
      enabledSites: newEnabledSites
    };
    
    setSettings(newSettings);
    await saveSettings(newSettings);
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
      console.error('Failed to notify custom site change:', error instanceof Error ? error.message : 'Unknown error');
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
      console.error('Import failed:', error instanceof Error ? error.message : 'Unknown error');
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
      console.error('Failed to clear data:', error instanceof Error ? error.message : 'Unknown error');
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
      console.error('Failed to reset settings:', error instanceof Error ? error.message : 'Unknown error');
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
      <header className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
              title="Back to library"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">Settings</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Customize your experience</p>
            </div>
          </div>
        </div>
      </header>

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
            onSiteToggle={(hostname, enabled) => void handleSiteToggle(hostname, enabled)}
            onCustomSiteToggle={(hostname, enabled) => void handleCustomSiteToggle(hostname, enabled)}
            onRemoveCustomSite={(hostname) => void handleRemoveCustomSite(hostname)}
            onAddCustomSite={(siteData) => void handleAddCustomSite(siteData)}
            saving={saving}
          />

          <SectionSeparator />

          {/* Data & Storage Section */}
          <DataStorageSection
            prompts={prompts}
            categories={categories}
            onImport={handleImportData}
            onClearData={handleClearData}
          />

          <SectionSeparator />

          {/* Advanced Section */}
          <AdvancedSection
            debugMode={settings.debugMode}
            onDebugModeChange={(enabled) => void handleDebugModeChange(enabled)}
            saving={saving}
          />

          {/* About & Reset Section */}
          <AboutSection
            version="1.2.1"
            onReset={handleResetSettings}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsView;