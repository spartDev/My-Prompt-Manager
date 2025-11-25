import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FC, ReactNode } from 'react';

import manifest from '../../manifest.json';
import { getDefaultEnabledPlatforms, getLinkedPlatformHostnames } from '../config/platforms';
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

  // Refs for flush-on-unmount pattern
  const saveTimeoutRef = useRef<number | null>(null);
  const hasPendingChanges = useRef(false);
  const settingsRef = useRef<Settings>(settings); // Always holds latest settings for unmount flush
  const lastPersistedSettingsRef = useRef<Settings | null>(null); // Tracks last successfully persisted settings

  // Debounce timer for tab notifications
  const notificationTimerRef = useRef<number | null>(null);

  // Track previous settings to detect disabled sites
  const previousSettingsRef = useRef<{
    enabledSites: string[];
    customSites: CustomSite[];
  } | null>(null);

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

      // Initialize previousSettingsRef to track changes from this point forward
      previousSettingsRef.current = {
        enabledSites: [...loadedSettings.enabledSites],
        customSites: [...loadedSettings.customSites]
      };

      // Initialize lastPersistedSettingsRef with the loaded settings
      lastPersistedSettingsRef.current = { ...loadedSettings };

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

      // Initialize previousSettingsRef even on error to prevent null checks
      previousSettingsRef.current = {
        enabledSites: [...defaultSettings.enabledSites],
        customSites: []
      };

      // Initialize lastPersistedSettingsRef even on error
      lastPersistedSettingsRef.current = { ...defaultSettings };

      setInterfaceMode(DEFAULT_SETTINGS.interfaceMode as 'popup' | 'sidepanel');
    } finally {
      setLoading(false);
    }
  }, [defaultSettings, storageManager]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Cleanup notification timer on unmount
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current !== null) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // CRITICAL: Update settingsRef during render (not in effect) to guarantee it's always current
  // This ensures unmount flush sees latest settings even if unmount happens before effects run
  settingsRef.current = settings;

  // CRITICAL: Detect pending changes during render by comparing with last persisted settings
  // This ensures unmount flush knows about unsaved changes even if unmount happens before effects run
  const hasUnsavedChanges = lastPersistedSettingsRef.current !== null &&
    JSON.stringify(settings) !== JSON.stringify(lastPersistedSettingsRef.current);

  // Update hasPendingChanges flag during render if we detect unsaved changes
  if (hasUnsavedChanges && !hasPendingChanges.current) {
    hasPendingChanges.current = true;
  }

  // Build URL patterns from enabled sites (defined early for use in unmount flush)
  const buildUrlPatterns = useCallback((settingsToUse: Settings): string[] => {
    const patterns: string[] = [];

    // Add patterns from enabledSites
    for (const hostname of settingsToUse.enabledSites) {
      patterns.push(`*://${hostname}/*`);
    }

    // Add patterns from enabled customSites
    for (const site of settingsToUse.customSites) {
      if (site.enabled) {
        patterns.push(`*://${site.hostname}/*`);
      }
    }

    return patterns;
  }, []);

  // Debounced persistence: save settings after user stops making changes
  useEffect(() => {
    // Skip saving on initial mount (when settings are loaded)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Mark that we have pending changes
    hasPendingChanges.current = true;

    // Clear existing timeout to reset debounce
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save after 150ms of inactivity
    saveTimeoutRef.current = window.setTimeout(() => {
      saveSettings(settings)
        .then(() => {
          // Clear pending flag on successful save
          hasPendingChanges.current = false;
        })
        .catch((err: unknown) => {
          Logger.error('Failed to save settings', toError(err), {
            component: 'SettingsView',
            operation: 'persist'
          });
          // Keep hasPendingChanges as true on error so unmount will retry
        });
    }, 150);

    // Cleanup: only cancel the timeout, do NOT flush here
    // Flushing in this cleanup would execute on every settings change (not just unmount)
    // because React runs cleanup when dependencies change, and the closure would capture
    // stale settings values from the previous render.
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Unmount-only flush: save any pending changes when component unmounts
  // This effect has empty dependencies, so its cleanup only runs on actual unmount.
  // We use settingsRef.current to always access the latest settings value.
  // CRITICAL: We must notify tabs immediately during unmount to keep content scripts in sync.
  useEffect(() => {
    return () => {
      // Cancel any scheduled save to prevent duplicate
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Cancel any scheduled notification to prevent duplicate
      if (notificationTimerRef.current !== null) {
        clearTimeout(notificationTimerRef.current);
      }

      // If we have pending changes that weren't saved, flush them now
      // NOTE: React cleanup functions cannot be async, so this is fire-and-forget.
      // The Chrome extension lifecycle typically allows enough time for the save to
      // complete, but in rare cases (immediate tab close), the save may not finish.
      // CRITICAL: Check if settings have changed by comparing with last persisted settings,
      // not just relying on hasPendingChanges flag (which may not be set if unmount
      // happens before the debounced effect runs)
      const currentSettings = settingsRef.current;
      const hasActualChanges = lastPersistedSettingsRef.current !== null &&
        JSON.stringify(currentSettings) !== JSON.stringify(lastPersistedSettingsRef.current);

      if (hasPendingChanges.current || hasActualChanges) {
        hasPendingChanges.current = false;

        // Persist settings to storage
        void persistSettings(currentSettings)
          .then(() => {
            // Update last persisted settings after successful unmount flush
            lastPersistedSettingsRef.current = { ...currentSettings };
          })
          .catch((err: unknown) => {
            Logger.error('Failed to flush settings on unmount', toError(err), {
              component: 'SettingsView',
              operation: 'flush-on-unmount',
              context: 'Component unmounted with pending changes'
            });
          });

        // CRITICAL: Notify tabs immediately (without debounce) to keep content scripts in sync
        // Build patterns for currently enabled sites
        const currentPatterns = buildUrlPatterns(currentSettings);
        const previousPatterns: string[] = [];

        if (previousSettingsRef.current) {
          // Build sets of enabled hostnames for comparison
          const prevEnabled = new Set([
            ...previousSettingsRef.current.enabledSites,
            ...previousSettingsRef.current.customSites
              .filter(s => s.enabled)
              .map(s => s.hostname)
          ]);

          const currentEnabled = new Set([
            ...currentSettings.enabledSites,
            ...currentSettings.customSites
              .filter(s => s.enabled)
              .map(s => s.hostname)
          ]);

          // Find sites that were enabled but are now disabled
          for (const hostname of prevEnabled) {
            if (!currentEnabled.has(hostname)) {
              previousPatterns.push(`*://${hostname}/*`);
            }
          }
        }

        // Combine current and previous patterns, removing duplicates
        const allPatterns = [...new Set([...currentPatterns, ...previousPatterns])];

        // Notify tabs if there are any patterns to notify
        if (allPatterns.length > 0) {
          void chrome.tabs.query({ url: allPatterns })
            .then(tabs => {
              if (tabs.length === 0) {
                return;
              }

              // Send messages in parallel with Promise.allSettled
              const messagePromises = tabs
                .filter(tab => tab.id !== undefined)
                .map(tab => {
                  const tabId = tab.id as number;
                  return chrome.tabs.sendMessage(tabId, {
                    action: 'settingsUpdated',
                    settings: currentSettings
                  }).catch(() => {
                    // Tab might not have content script loaded, ignore error
                  });
                });

              return Promise.allSettled(messagePromises);
            })
            .catch((err: unknown) => {
              Logger.error('Failed to notify tabs during unmount flush', toError(err), {
                component: 'SettingsView',
                operation: 'flush-on-unmount-notify'
              });
            });
        }
      }
    };
  }, [buildUrlPatterns]);

  // Notify tabs with debouncing and optimized querying
  const notifyTabs = useCallback((newSettings: Settings) => {
    // Clear existing notification timer
    if (notificationTimerRef.current !== null) {
      clearTimeout(notificationTimerRef.current);
    }

    // Debounce notifications by 200ms to batch rapid changes
    notificationTimerRef.current = window.setTimeout(() => {
      // Build patterns for currently enabled sites
      const currentPatterns = buildUrlPatterns(newSettings);
      const previousPatterns: string[] = [];

      if (previousSettingsRef.current) {
        // Build sets of enabled hostnames for comparison
        const prevEnabled = new Set([
          ...previousSettingsRef.current.enabledSites,
          ...previousSettingsRef.current.customSites
            .filter(s => s.enabled)
            .map(s => s.hostname)
        ]);

        const currentEnabled = new Set([
          ...newSettings.enabledSites,
          ...newSettings.customSites
            .filter(s => s.enabled)
            .map(s => s.hostname)
        ]);

        // Find sites that were enabled but are now disabled
        for (const hostname of prevEnabled) {
          if (!currentEnabled.has(hostname)) {
            previousPatterns.push(`*://${hostname}/*`);
          }
        }
      }

      // Combine current and previous patterns, removing duplicates
      const allPatterns = [...new Set([...currentPatterns, ...previousPatterns])];

      // Skip notification if no sites to notify
      if (allPatterns.length === 0) {
        Logger.debug('No sites to notify, skipping tab notification', {
          component: 'SettingsView'
        });
        return;
      }

      // Query tabs matching both enabled and recently disabled sites
      chrome.tabs.query({ url: allPatterns })
        .then(tabs => {
          if (tabs.length === 0) {
            Logger.debug('No matching tabs found for notification', {
              component: 'SettingsView',
              patternCount: allPatterns.length
            });
            // Update previous settings even if no tabs found
            previousSettingsRef.current = {
              enabledSites: [...newSettings.enabledSites],
              customSites: [...newSettings.customSites]
            };
            return;
          }

          Logger.debug('Notifying tabs of settings update', {
            component: 'SettingsView',
            tabCount: tabs.length,
            patternCount: allPatterns.length,
            currentPatterns: currentPatterns.length,
            previousPatterns: previousPatterns.length
          });

          // Send messages in parallel with Promise.allSettled
          const messagePromises = tabs
            .filter(tab => tab.id !== undefined)
            .map(tab => {
              // TypeScript knows tab.id is defined here due to the filter
              const tabId = tab.id as number;
              return chrome.tabs.sendMessage(tabId, {
                action: 'settingsUpdated',
                settings: newSettings
              }).catch(() => {
                // Tab might not have content script loaded, ignore error
                // Using catch instead of try/catch for cleaner parallel execution
              });
            });

          return Promise.allSettled(messagePromises).then(() => {
            // Update previous settings after successful notification
            previousSettingsRef.current = {
              enabledSites: [...newSettings.enabledSites],
              customSites: [...newSettings.customSites]
            };
          });
        })
        .catch((err: unknown) => {
          Logger.error('Failed to notify tabs of settings update', toError(err), {
            component: 'SettingsView',
            operation: 'notifyTabs'
          });
        });
    }, 200);
  }, [buildUrlPatterns]);

  // Raw storage persistence without tab notifications
  // This is a stable function that doesn't depend on other callbacks,
  // safe to use in the unmount-only flush effect
  const persistSettings = async (newSettings: Settings) => {
    try {
      await chrome.storage.local.set({
        promptLibrarySettings: newSettings
      });
    } catch (error) {
      Logger.error('Failed to persist settings', toError(error), {
        component: 'SettingsView',
        operation: 'persistSettings'
      });
      throw error;
    }
  };

  // Save settings with tab notifications
  const saveSettings = async (newSettings: Settings) => {
    setSaving(true);
    try {
      // Persist settings to storage
      await persistSettings(newSettings);

      // Update last persisted settings ref after successful save
      lastPersistedSettingsRef.current = { ...newSettings };

      // Notify content scripts of changes (debounced and optimized)
      notifyTabs(newSettings);
    } catch (error) {
      Logger.error('Failed to save settings', toError(error), {
        component: 'SettingsView',
        operation: 'saveSettings'
      });
      throw error;  // Re-throw so debounce effect's .catch() runs
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

  // Handle custom site toggle
  const handleCustomSiteToggle = (hostname: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      customSites: prev.customSites.map(site =>
        site.hostname === hostname ? { ...site, enabled } : site
      )
    }));
    // Persistence and tab notification handled by debounced useEffect
  };

  // Handle remove custom site
  const handleRemoveCustomSite = (hostname: string) => {
    setSettings(prev => ({
      ...prev,
      customSites: prev.customSites.filter(site => site.hostname !== hostname)
    }));
    // Persistence and tab notification handled by debounced useEffect
  };

  // Handle add custom site
  const handleAddCustomSite = (siteData: Omit<CustomSite, 'dateAdded'>) => {
    const newSite: CustomSite = {
      ...siteData,
      dateAdded: Date.now()
    };

    setSettings(prev => ({
      ...prev,
      customSites: [...prev.customSites, newSite]
    }));
    // Persistence and tab notification handled by debounced useEffect
  };

  // Handle debug mode toggle
  const handleDebugModeChange = (enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      debugMode: enabled
    }));

    // Update localStorage for immediate effect
    if (enabled) {
      localStorage.setItem('prompt-library-debug', 'true');
    } else {
      localStorage.removeItem('prompt-library-debug');
    }
    // Persistence handled by debounced useEffect
  };

  /**
   * Imports data with parallel processing for better performance.
   *
   * Categories are imported first (in parallel), followed by prompts (in parallel).
   * This ensures referential integrity since prompts reference categories.
   *
   * Uses Promise.allSettled to collect all failures before throwing, providing
   * detailed error messages for partial import scenarios.
   *
   * @param data - The backup data containing prompts and categories
   * @throws {Error} If any category or prompt import fails (with detailed context)
   */
  const handleImportData = async (data: { prompts: Prompt[]; categories: Category[] }) => {
    try {
      // Import categories in parallel (must complete before prompts)
      const categoryResults = await Promise.allSettled(
        data.categories.map((category) => storageManager.importCategory(category))
      );

      // Collect category failures with context
      const categoryFailures: Array<{ category: Category; error: unknown }> = [];
      categoryResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          categoryFailures.push({
            category: data.categories[index],
            error: result.reason
          });
        }
      });

      if (categoryFailures.length > 0) {
        const failureMessages = categoryFailures
          .map(({ category, error }) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return `Category "${category.name}" (${category.id}): ${errorMsg}`;
          })
          .join('\n');

        throw new Error(
          `Failed to import ${categoryFailures.length.toString()} of ${data.categories.length.toString()} categories:\n${failureMessages}`
        );
      }

      // Import prompts in parallel (categories must exist first)
      const promptResults = await Promise.allSettled(
        data.prompts.map((prompt) => storageManager.importPrompt(prompt))
      );

      // Collect prompt failures with context
      const promptFailures: Array<{ prompt: Prompt; error: unknown }> = [];
      promptResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          promptFailures.push({
            prompt: data.prompts[index],
            error: result.reason
          });
        }
      });

      if (promptFailures.length > 0) {
        const failureMessages = promptFailures
          .map(({ prompt, error }) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return `Prompt "${prompt.title}" (${prompt.id}): ${errorMsg}`;
          })
          .join('\n');

        const successCount = data.prompts.length - promptFailures.length;
        throw new Error(
          `Failed to import ${promptFailures.length.toString()} of ${data.prompts.length.toString()} prompts (${successCount.toString()} succeeded):\n${failureMessages}`
        );
      }

      // Reload data
      await loadSettings();

      alert(`Successfully imported ${data.prompts.length.toString()} prompts and ${data.categories.length.toString()} categories!`);
    } catch (error) {
      Logger.error('Import failed', toError(error), {
        component: 'SettingsView',
        operation: 'handleImportData',
        categoryCount: data.categories.length,
        promptCount: data.prompts.length,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
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
            onCustomSiteToggle={handleCustomSiteToggle}
            onRemoveCustomSite={handleRemoveCustomSite}
            onAddCustomSite={(siteData) => { handleAddCustomSite(siteData as Omit<CustomSite, 'dateAdded'>); }}
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
            onDebugModeChange={handleDebugModeChange}
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
