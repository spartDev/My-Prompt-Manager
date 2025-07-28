import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';

interface SiteConfig {
  name: string;
  description: string;
  icon: string;
}

interface CustomSite {
  hostname: string;
  displayName: string;
  icon?: string;
  enabled: boolean;
  dateAdded: number;
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

const SettingsView: FC<SettingsViewProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<Settings>({
    enabledSites: [],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Custom site addition state
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [urlError, setUrlError] = useState('');

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
    customSites: [],
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

  // Clear URL error when user types
  useEffect(() => {
    if (urlError && newSiteUrl) {
      setUrlError('');
    }
  }, [newSiteUrl, urlError]);

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

  // URL validation helper
  const validateAndProcessUrl = (url: string): { isValid: boolean; hostname?: string; error?: string } => {
    // Handle empty URL
    if (!url || url.trim() === '') {
      return { isValid: false, error: 'Please enter a URL' };
    }

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const hostname = urlObj.hostname;
      
      // Check for common issues
      if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
        return { isValid: false, error: 'Local sites are not supported' };
      }
      
      if (!hostname.includes('.')) {
        return { isValid: false, error: 'Please enter a valid domain' };
      }
      
      // Check if site already exists
      const existsInBuiltIn = Object.keys(siteConfigs).includes(hostname);
      const existsInCustom = settings.customSites.some(site => site.hostname === hostname);
      
      if (existsInBuiltIn) {
        return { isValid: false, error: 'This site is already supported by default' };
      }
      
      if (existsInCustom) {
        return { isValid: false, error: 'This site has already been added' };
      }
      
      return { isValid: true, hostname };
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }
  };

  const isValidUrl = (url: string): boolean => {
    return validateAndProcessUrl(url).isValid;
  };

  const extractHostname = (url: string): string => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  const handleAddCustomSite = async () => {
    const validation = validateAndProcessUrl(newSiteUrl);
    
    if (!validation.isValid) {
      setUrlError(validation.error || 'Invalid URL');
      return;
    }

    if (!validation.hostname) {
      return;
    }

    const newSite: CustomSite = {
      hostname: validation.hostname,
      displayName: newSiteName.trim() || validation.hostname,
      enabled: true,
      dateAdded: Date.now()
    };

    const newSettings = {
      ...settings,
      customSites: [...settings.customSites, newSite]
    };

    setSettings(newSettings);
    await saveSettings(newSettings);
    
    // Clear form
    setNewSiteUrl('');
    setNewSiteName('');
    setUrlError('');
    
    // Inject script into any open tabs matching this hostname
    await injectCustomSite(validation.hostname);
  };

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

    // Handle script injection/removal
    if (enabled) {
      await injectCustomSite(hostname);
    } else {
      await removeCustomSiteScript(hostname);
    }
  };

  const handleRemoveCustomSite = async (hostname: string) => {
    if (!confirm(`Remove ${hostname} from custom sites?`)) {
      return;
    }

    const newCustomSites = settings.customSites.filter(site => site.hostname !== hostname);
    
    const newSettings = {
      ...settings,
      customSites: newCustomSites
    };

    setSettings(newSettings);
    await saveSettings(newSettings);
    
    // Remove script from tabs
    await removeCustomSiteScript(hostname);
  };

  const injectCustomSite = async (hostname: string) => {
    try {
      const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
      
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content.js']
            });
          } catch (error) {
            console.error(`Could not inject into tab ${String(tab.id)}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to inject custom site script:', error);
    }
  };

  const removeCustomSiteScript = async (hostname: string) => {
    try {
      const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
      
      for (const tab of tabs) {
        if (tab.id) {
          try {
            // Send message to content script to clean up
            await chrome.tabs.sendMessage(tab.id, {
              action: 'cleanup'
            });
          } catch {
            // Tab might not have content script, ignore error
          }
        }
      }
    } catch (error) {
      console.error('Failed to remove custom site script:', error);
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

        {/* Custom Sites */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Custom Sites
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add your own websites where you want the prompt library to appear
          </p>
          
          {/* Add New Site Form */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://example.com"
                value={newSiteUrl}
                onChange={(e) => {
                  setNewSiteUrl(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                disabled={saving}
              />
              
              <input
                type="text"
                placeholder="Site Name (optional)"
                value={newSiteName}
                onChange={(e) => {
                  setNewSiteName(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                disabled={saving}
              />
              
              <button
                onClick={() => void handleAddCustomSite()}
                disabled={!isValidUrl(newSiteUrl) || saving}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                title={!isValidUrl(newSiteUrl) ? `Validation error: ${validateAndProcessUrl(newSiteUrl).error || 'Invalid URL'}` : ''}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v16m8-8H4"/>
                </svg>
                Add Custom Site
              </button>
            </div>
            
            {/* Validation Messages & Preview */}
            {urlError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {urlError}
                </p>
              </div>
            )}
            
            {newSiteUrl && !urlError && !isValidUrl(newSiteUrl) && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  {validateAndProcessUrl(newSiteUrl).error || 'Invalid URL'}
                </p>
              </div>
            )}
            
            {newSiteUrl && isValidUrl(newSiteUrl) && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-xs text-green-700 dark:text-green-300">
                  ✓ Will inject on: <code className="bg-green-100 dark:bg-green-800 px-1 rounded font-mono">{extractHostname(newSiteUrl)}</code>
                </p>
              </div>
            )}
          </div>
          
          {/* Custom Sites List */}
          <div className="space-y-2">
            {settings.customSites.map((site) => (
              <div 
                key={site.hostname}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                    {site.icon || site.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {site.displayName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {site.hostname}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Toggle for custom site */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={site.enabled}
                      onChange={(e) => void handleCustomSiteToggle(site.hostname, e.target.checked)}
                      disabled={saving}
                      className="sr-only peer"
                      aria-label={`Enable ${site.displayName}`}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => void handleRemoveCustomSite(site.hostname)}
                    disabled={saving}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove site"
                    aria-label={`Remove ${site.displayName}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            {settings.customSites.length === 0 && (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <p className="text-sm">No custom sites added yet</p>
                <p className="text-xs mt-1">Add websites where you want the prompt library to appear</p>
              </div>
            )}
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