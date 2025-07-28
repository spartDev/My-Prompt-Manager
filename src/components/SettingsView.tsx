import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';

interface SiteConfig {
  name: string;
  description: string;
  icon: string;
}

interface Settings {
  enabledSites: string[];
  debugMode: boolean;
  floatingFallback: boolean;
}

interface SettingsViewProps {
  onBack: () => void;
}

const SettingsView: FC<SettingsViewProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<Settings>({
    enabledSites: [],
    debugMode: false,
    floatingFallback: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const siteConfigs: Record<string, SiteConfig> = useMemo(() => ({
    'concierge.sanofi.com': {
      name: 'Sanofi Concierge',
      description: 'Sanofi AI assistant platform',
      icon: 'S'
    },
    'www.perplexity.ai': {
      name: 'Perplexity',
      description: 'AI-powered search and chat',
      icon: 'P'
    },
    'claude.ai': {
      name: 'Claude',
      description: 'Anthropic\'s AI assistant',
      icon: 'C'
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      description: 'OpenAI\'s conversational AI',
      icon: 'G'
    }
  }), []);

  const defaultSettings: Settings = useMemo(() => ({
    enabledSites: Object.keys(siteConfigs),
    debugMode: false,
    floatingFallback: true
  }), [siteConfigs]);

  const loadSettings = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['promptLibrarySettings']);
      const savedSettings = result.promptLibrarySettings as Partial<Settings> | undefined;
      const loadedSettings: Settings = {
        ...defaultSettings,
        ...(savedSettings ?? {})
      };
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, [defaultSettings]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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
            // Ignore errors for tabs without content script
          }
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

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

  const handleAdvancedSetting = async (key: keyof Settings, value: boolean) => {
    const newSettings = {
      ...settings,
      [key]: value
    };

    setSettings(newSettings);
    await saveSettings(newSettings);

    // Handle debug mode localStorage
    if (key === 'debugMode') {
      if (value) {
        localStorage.setItem('prompt-library-debug', 'true');
      } else {
        localStorage.removeItem('prompt-library-debug');
      }
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      setSettings(defaultSettings);
      await saveSettings(defaultSettings);
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
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
            title="Back to library"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure your prompt library</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Site Integration */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Site Integration
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose which AI chat platforms should display the prompt library icon
          </p>
          
          <div className="space-y-3">
            {Object.entries(siteConfigs).map(([hostname, config]) => {
              const isEnabled = settings.enabledSites.includes(hostname);
              
              return (
                <div 
                  key={hostname}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {config.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => void handleSiteToggle(hostname, e.target.checked)}
                      disabled={saving}
                      className="sr-only peer"
                      aria-label={`Enable ${config.name}`}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        {/* Advanced Options */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Advanced Options
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Debug Mode
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enable console logging for troubleshooting
                </p>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.debugMode}
                  onChange={(e) => void handleAdvancedSetting('debugMode', e.target.checked)}
                  disabled={saving}
                  className="sr-only peer"
                  aria-label="Enable debug mode"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Floating Icon Fallback
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Show floating icon when integrated button fails
                </p>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.floatingFallback}
                  onChange={(e) => void handleAdvancedSetting('floatingFallback', e.target.checked)}
                  disabled={saving}
                  className="sr-only peer"
                  aria-label="Enable floating icon fallback"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Reset */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Reset
          </h2>
          <button
            onClick={() => void handleReset()}
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors focus-interactive"
          >
            {saving ? 'Resetting...' : 'Reset All Settings to Default'}
          </button>
        </section>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="absolute bottom-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
          Saving settings...
        </div>
      )}
    </div>
  );
};

export default SettingsView;