import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';

import ThemeToggle from './ThemeToggle';

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
  positioning?: {
    mode: 'custom';
    selector: string;
    placement: 'before' | 'after' | 'inside-start' | 'inside-end';
    offset?: {
      x: number;
      y: number;
    };
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

// Visual separator component for section breaks
const SectionSeparator: FC = () => (
  <div className="relative py-6" role="separator" aria-hidden="true">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
    </div>
    <div className="relative flex justify-center">
      <div className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-900 px-3">
        <div className="w-1.5 h-1.5 bg-purple-300 dark:bg-purple-600 rounded-full"></div>
        <div className="w-1 h-1 bg-purple-200 dark:bg-purple-700 rounded-full"></div>
        <div className="w-1.5 h-1.5 bg-purple-300 dark:bg-purple-600 rounded-full"></div>
      </div>
    </div>
  </div>
);

// Site tile component for consistent display of both built-in and custom sites
interface SiteTileProps {
  hostname: string;
  name: string;
  description: string;
  icon: string;
  isEnabled: boolean;
  onToggle: (hostname: string, enabled: boolean) => void;
  saving: boolean;
  isCustom?: boolean;
  customSite?: CustomSite;
  onRemove?: (hostname: string) => void;
}

const SiteTile: FC<SiteTileProps> = ({ 
  hostname, 
  name, 
  description, 
  icon, 
  isEnabled, 
  onToggle, 
  saving, 
  isCustom = false,
  customSite,
  onRemove 
}) => {
  // Create enhanced description for custom sites
  const getEnhancedDescription = () => {
    if (!isCustom || !customSite) {return description;}
    
    // For custom sites, show positioning description
    if (customSite.positioning) {
      return customSite.positioning.description || 'Custom positioning';
    }
    return description;
  };

  return (
    <div 
      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm ${
          isCustom 
            ? 'bg-gradient-to-br from-green-500 to-teal-600' 
            : 'bg-gradient-to-br from-purple-600 to-indigo-600'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
              {name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isCustom && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md flex-shrink-0">
                Custom
              </span>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {getEnhancedDescription()}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => { onToggle(hostname, e.target.checked); }}
            disabled={saving}
            className="sr-only peer"
            aria-label={`Enable ${name}`}
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
        </label>
        
        {isCustom && onRemove && (
          <button
            onClick={() => { onRemove(hostname); }}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove site"
            aria-label={`Remove ${name}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

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
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [isCurrentSiteIntegrated, setIsCurrentSiteIntegrated] = useState(false);
  
  // Custom positioning state (always required now)
  const [showAdvancedPositioning, setShowAdvancedPositioning] = useState(true);
  const positioningMode = 'custom';  // Always custom mode now
  const [customSelector, setCustomSelector] = useState('');
  const [placement, setPlacement] = useState<'before' | 'after' | 'inside-start' | 'inside-end'>('after');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [customZIndex, setCustomZIndex] = useState(999999);
  const [positioningDescription, setPositioningDescription] = useState('');
  const [selectorError, setSelectorError] = useState('');

  // Element picker state
  const [isPickingElement, setIsPickingElement] = useState(false);
  const [pickedElementInfo, setPickedElementInfo] = useState<{
    selector: string;
    elementType: string;
  } | null>(null);
  const [originalTabId, setOriginalTabId] = useState<number | null>(null);

  // Check if we're in picker mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPickerWindow = urlParams.get('picker') === 'true';

  // Expandable sections state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showResetSection, setShowResetSection] = useState(false);

  const siteConfigs: Record<string, SiteConfig> = useMemo(() => ({
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

    // Check if we're in picker mode and auto-expand settings
    const urlParams = new URLSearchParams(window.location.search);
    const isPickerMode = urlParams.get('picker') === 'true';

    if (isPickerMode) {
      setShowAdvancedOptions(true);  // Show the Advanced Options section which contains Custom Sites

      // In picker mode, get the original URL and tab ID from URL parameters
      const originalUrl = urlParams.get('originalUrl');
      const originalHostname = urlParams.get('originalHostname');
      const originalTabIdStr = urlParams.get('originalTabId');

      if (originalUrl && originalHostname) {
        // Use the passed URL information
        setCurrentTabUrl(originalUrl);

        // Store the original tab ID if available
        if (originalTabIdStr) {
          const tabId = parseInt(originalTabIdStr, 10);
          if (!isNaN(tabId)) {
            setOriginalTabId(tabId);
          }
        }

        // Check if the original site is already integrated
        const isBuiltIn = Object.keys(siteConfigs).includes(originalHostname);
        void (async () => {
          const result = await chrome.storage.local.get(['promptLibrarySettings']);
          const savedSettings = result.promptLibrarySettings as Partial<Settings> | undefined;
          const customSites = savedSettings?.customSites || [];
          const isCustom = customSites.some(site => site.hostname === originalHostname);

          setIsCurrentSiteIntegrated(isBuiltIn || isCustom);
        })();
      }
    } else {
      // Not in picker mode, get current tab URL normally
      void (async () => {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.url) {
            const url = new URL(activeTab.url);
            const hostname = url.hostname;

            // Set current tab URL for auto-population
            setCurrentTabUrl(activeTab.url);

            // Check if the current site is already integrated
            const isBuiltIn = Object.keys(siteConfigs).includes(hostname);
            const result = await chrome.storage.local.get(['promptLibrarySettings']);
            const savedSettings = result.promptLibrarySettings as Partial<Settings> | undefined;
            const customSites = savedSettings?.customSites || [];
            const isCustom = customSites.some(site => site.hostname === hostname);

            setIsCurrentSiteIntegrated(isBuiltIn || isCustom);
          }
        } catch (error) {
          console.error('Failed to get current tab:', error);
        }
      })();
    }
  }, [loadSettings, siteConfigs]);

  // Listen for element picker results
  useEffect(() => {
    const handleMessage = (message: { type: string; data?: { selector: string; elementType: string } }) => {
      if (message.type === 'ELEMENT_PICKER_RESULT' && message.data) {
        const { selector, elementType } = message.data;
        setCustomSelector(selector);
        setPickedElementInfo({ selector, elementType });
        setIsPickingElement(false);
        setSelectorError('');

        // Custom positioning mode is always enabled
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Keep popup alive during element picking
    let port: chrome.runtime.Port | null = null;
    if (isPickingElement) {
      port = chrome.runtime.connect({ name: 'popup-keep-alive' });
    }

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      if (port) {
        port.disconnect();
      }
    };
  }, [isPickingElement, positioningMode]);

  // Clear URL error when user types
  useEffect(() => {
    if (urlError && newSiteUrl) {
      setUrlError('');
    }
  }, [newSiteUrl, urlError]);

  // Clear selector error when user types
  useEffect(() => {
    if (selectorError && customSelector) {
      setSelectorError('');
    }
  }, [customSelector, selectorError]);

  // Auto-populate URL field with current tab URL when available
  useEffect(() => {
    if (currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl) {
      // Only auto-populate if the field is empty and the site isn't already integrated
      setNewSiteUrl(currentTabUrl);

      // Also try to set a friendly name based on the hostname
      try {
        const url = new URL(currentTabUrl);
        const hostname = url.hostname;
        // Remove www. and common TLDs for a cleaner name
        const cleanName = hostname
          .replace(/^www\./, '')
          .replace(/\.(com|org|net|io|ai|app|dev)$/, '')
          .split('.').pop() || hostname;

        // Capitalize first letter
        const friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        setNewSiteName(friendlyName);
      } catch {
        // If URL parsing fails, just leave the name empty
      }
    }
  }, [currentTabUrl, isCurrentSiteIntegrated, newSiteUrl]);

  // Reset positioning form
  const resetPositioningForm = () => {
    setShowAdvancedPositioning(true);  // Keep it expanded since it's required
    setCustomSelector('');
    setPlacement('after');
    setOffsetX(0);
    setOffsetY(0);
    setCustomZIndex(999999);
    setPositioningDescription('');
    setSelectorError('');
  };

  // Start element picker mode
  const startElementPicker = async () => {
    try {
      setIsPickingElement(true);
      setSelectorError('');

      // Check if we're in picker mode (opened in a window)
      const urlParams = new URLSearchParams(window.location.search);
      const isPickerWindow = urlParams.get('picker') === 'true';

      if (isPickerWindow) {
        // We're in a picker window, directly start the picker with the original tab ID
        const response = await chrome.runtime.sendMessage({
          type: 'START_ELEMENT_PICKER',
          data: { tabId: originalTabId }
        }) as { success: boolean; error?: string };

        if (!response.success) {
          setIsPickingElement(false);
          setSelectorError(response.error || 'Failed to start element picker');
        }
      } else {
        // We're in a regular popup, need to open a new window
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Check if we're on a valid webpage
        if (!activeTab || !activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
          setIsPickingElement(false);
          setSelectorError('Please navigate to a webpage first, then try again');
          return;
        }

        // Open picker in a new window to prevent popup from closing
        // The background script will handle getting the tab URL and passing it
        const response = await chrome.runtime.sendMessage({
          type: 'OPEN_PICKER_WINDOW',
          data: { tabId: activeTab.id }
        }) as { success: boolean; error?: string };

        if (response.success) {
          // Close the current popup
          window.close();
        } else {
          setIsPickingElement(false);
          setSelectorError(response.error || 'Failed to open element picker');
        }
      }
    } catch (error) {
      console.error('Error starting element picker:', error);
      setIsPickingElement(false);
      setSelectorError('Failed to start element picker. Make sure you have a webpage open.');
    }
  };

  // Test selector and show preview
  const testSelector = async () => {
    if (!customSelector.trim()) {
      setSelectorError('Please enter a selector to test');
      return;
    }

    // First try to validate the selector syntax
    try {
      // Test if the selector is valid by trying to use it
      document.createElement('div').querySelector(customSelector);
    } catch {
      setSelectorError('Invalid CSS selector syntax. Please check for special characters that need escaping.');
      return;
    }

    const validation = validateSelector(customSelector);
    if (!validation.isValid) {
      setSelectorError(validation.error || 'Invalid selector');
      return;
    }

    try {
      // Send test message to current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'testSelector',
          selector: customSelector,
          placement,
          offset: { x: offsetX, y: offsetY },
          zIndex: customZIndex
        }) as unknown as { success: boolean; error?: string; elementCount?: number };
        
        if (response.success) {
          setSelectorError(''); // Clear any previous errors
          // Show success message with element count
          const elementCount = response.elementCount ?? 0;
          const elementText = elementCount === 1 ? 'element' : 'elements';
          setSelectorError(`✓ Success! Found ${String(elementCount)} ${elementText}. Check the page for visual feedback.`);
          
          // Change the error styling to success styling temporarily
          setTimeout(() => {
            setSelectorError('');
          }, 5000);
        } else {
          setSelectorError(response.error || 'Selector test failed');
        }
      } else {
        setSelectorError('No active tab found. Please make sure you have a webpage open.');
      }
    } catch (err) {
      console.error('Selector test error:', err);
      if (err instanceof Error && err.message.includes('Could not establish connection')) {
        setSelectorError('Extension not loaded on this page. Try refreshing the page or navigate to the target website.');
      } else {
        setSelectorError('Failed to test selector. Make sure the extension is loaded on the current page.');
      }
    }
  };

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

  // Enhanced CSS selector validation
  const validateSelector = (selector: string): { isValid: boolean; error?: string } => {
    if (!selector || selector.trim() === '') {
      return { isValid: false, error: 'Selector is required for custom positioning' };
    }

    const trimmedSelector = selector.trim();

    // Length validation
    if (trimmedSelector.length > 500) {
      return { isValid: false, error: 'Selector is too long (max 500 characters)' };
    }

    // Security checks for potentially dangerous selectors
    const dangerousPatterns = [
      /script/i,
      /iframe/i,
      /object/i,
      /embed/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmedSelector)) {
        return { isValid: false, error: 'Security: This selector type is not allowed' };
      }
    }

    // Check for overly complex selectors that might cause performance issues
    const complexityIndicators = [
      { pattern: /\s/g, limit: 10, message: 'Too many descendant selectors (max 10 spaces)' },
      { pattern: />/g, limit: 5, message: 'Too many child selectors (max 5)' },
      { pattern: /\+/g, limit: 3, message: 'Too many adjacent sibling selectors (max 3)' },
      { pattern: /~/g, limit: 3, message: 'Too many general sibling selectors (max 3)' },
      { pattern: /\[/g, limit: 5, message: 'Too many attribute selectors (max 5)' },
      { pattern: /:/g, limit: 5, message: 'Too many pseudo selectors (max 5)' }
    ];

    for (const { pattern, limit, message } of complexityIndicators) {
      const matches = trimmedSelector.match(pattern) || [];
      if (matches.length > limit) {
        return { isValid: false, error: `Complexity: ${message}` };
      }
    }

    try {
      // Test if selector is valid by trying to query it
      document.querySelector(trimmedSelector);
      return { isValid: true };
    } catch (error) {
      // Provide more specific error messages for common mistakes
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unexpected token')) {
        return { isValid: false, error: 'Syntax error: Check for typos in selector' };
      } else if (errorMessage.includes('Invalid selector')) {
        return { isValid: false, error: 'Invalid CSS selector syntax' };
      } else {
        return { isValid: false, error: `Selector error: ${errorMessage}` };
      }
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

    // Validate custom selector (always required for custom sites)
    const selectorValidation = validateSelector(customSelector);
    if (!selectorValidation.isValid) {
      setSelectorError(selectorValidation.error || 'Invalid selector');
      return;
    }

    const newSite: CustomSite = {
      hostname: validation.hostname,
      displayName: newSiteName.trim() || validation.hostname,
      enabled: true,
      dateAdded: Date.now(),
      positioning: {
        mode: 'custom',
        selector: customSelector.trim(),
        placement,
        offset: { x: offsetX, y: offsetY },
        zIndex: customZIndex,
        description: positioningDescription.trim() || undefined
      }
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
    resetPositioningForm();
    
    // Notify any open tabs to reinitialize
    await notifyCustomSiteChange(validation.hostname);
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

    // Notify tabs about the change
    await notifyCustomSiteChange(hostname);
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
    
    // Notify tabs about the removal
    await notifyCustomSiteChange(hostname);
  };

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
      console.error('Failed to notify custom site change:', error);
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure your prompt manager</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Site Integration */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Site Integration
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose which AI chat platforms should display my prompt manager icon. This includes both built-in sites and your custom sites.
          </p>
          
          <div className="space-y-3">
            {/* Built-in Sites */}
            {Object.entries(siteConfigs).map(([hostname, config]) => {
              const isEnabled = settings.enabledSites.includes(hostname);
              
              return (
                <SiteTile
                  key={hostname}
                  hostname={hostname}
                  name={config.name}
                  description={config.description}
                  icon={config.icon}
                  isEnabled={isEnabled}
                  onToggle={(hostname, enabled) => void handleSiteToggle(hostname, enabled)}
                  saving={saving}
                  isCustom={false}
                />
              );
            })}
            
            {/* Custom Sites */}
            {settings.customSites.map((site) => (
              <SiteTile
                key={site.hostname}
                hostname={site.hostname}
                name={site.displayName}
                description={site.hostname}
                icon={site.icon || site.displayName.charAt(0).toUpperCase()}
                isEnabled={site.enabled}
                onToggle={(hostname, enabled) => void handleCustomSiteToggle(hostname, enabled)}
                saving={saving}
                isCustom={true}
                customSite={site}
                onRemove={(hostname) => void handleRemoveCustomSite(hostname)}
              />
            ))}
            
            {/* Empty state when no custom sites exist */}
            {settings.customSites.length === 0 && Object.keys(siteConfigs).length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Want to add more sites?</strong> Use the &quot;Custom Sites&quot; feature in Advanced Options below to add my prompt manager to any website.
                </p>
              </div>
            )}
          </div>
        </section>

        <SectionSeparator />

        {/* Advanced Options */}
        <section>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => { setShowAdvancedOptions(!showAdvancedOptions); }}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors group"
              aria-expanded={showAdvancedOptions}
              aria-controls="advanced-options-content"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={2} 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6"/>
              </svg>
              Advanced Options
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-7">
              Expert settings for debugging and troubleshooting
            </p>
          </div>
          
          {showAdvancedOptions && (
            <div id="advanced-options-content" className="space-y-4 animate-in slide-in-from-top-2 duration-200">
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

              {/* Custom Sites */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Custom Sites
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Add your own websites where you want my prompt manager to appear. Added sites will appear in the Site Integration section above.
                </p>
                
                {/* Show message if current site is already integrated */}
                {isCurrentSiteIntegrated && currentTabUrl && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <strong>Note:</strong> The current website is already integrated. You can manage it in the Site Integration section above.
                    </p>
                  </div>
                )}

                {/* Add New Site Form */}
                <div className={`space-y-4 ${isCurrentSiteIntegrated ? 'opacity-50 pointer-events-none' : ''}`}>
                  {/* Basic Site Information */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Site Information</h4>
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
                    </div>
                  </div>

                  {/* Icon Positioning */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => { setShowAdvancedPositioning(!showAdvancedPositioning); }}
                        className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400"
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform ${showAdvancedPositioning ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={2} 
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                        Icon Positioning
                        <span className="text-xs text-red-500">*</span>
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                        Configure where the prompt library icon appears
                      </p>
                    </div>

                    {showAdvancedPositioning && (
                      <div className="space-y-3">
                        <>
                            {/* Custom Selector */}
                              <div>
                                <label htmlFor="custom-selector" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  CSS Selector <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2 mb-1">
                                  <input
                                    id="custom-selector"
                                    type="text"
                                    placeholder=".submit-button, #send-btn, textarea[data-id='root']"
                                    value={customSelector}
                                    onChange={(e) => { setCustomSelector(e.target.value); }}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 font-mono"
                                    disabled={saving || isPickingElement}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void startElementPicker()}
                                    disabled={saving || isPickingElement}
                                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 whitespace-nowrap flex items-center gap-1"
                                    title="Visually select an element on the webpage"
                                  >
                                    {isPickingElement ? (
                                      <>
                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Picking...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                        </svg>
                                        Pick Element
                                      </>
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {pickedElementInfo ?
                                    `Selected: ${pickedElementInfo.elementType} element with selector` :
                                    isPickingElement ?
                                    'Switch to the target tab and click on the desired element...' :
                                    'Target element where the icon should be positioned'
                                  }
                                </p>
                                {!isPickingElement && !isPickerWindow && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    Note: Clicking &quot;Pick Element&quot; will open settings in a new window
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void testSelector()}
                                  disabled={!customSelector.trim() || saving || isPickingElement}
                                  className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                >
                                  Test Selector
                                </button>
                              </div>

                              {/* Placement Options */}
                              <div>
                                <label htmlFor="placement-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Placement
                                </label>
                                <select
                                  id="placement-select"
                                  value={placement}
                                  onChange={(e) => { setPlacement(e.target.value as 'before' | 'after' | 'inside-start' | 'inside-end'); }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                                  disabled={saving}
                                >
                                  <option value="before">Before element</option>
                                  <option value="after">After element</option>
                                  <option value="inside-start">Inside element (start)</option>
                                  <option value="inside-end">Inside element (end)</option>
                                </select>
                              </div>

                              {/* Offset Controls */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label htmlFor="offset-x" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    X Offset (px)
                                  </label>
                                  <input
                                    id="offset-x"
                                    type="number"
                                    value={offsetX}
                                    onChange={(e) => { setOffsetX(parseInt(e.target.value) || 0); }}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                                    disabled={saving}
                                  />
                                </div>
                                <div>
                                  <label htmlFor="offset-y" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Y Offset (px)
                                  </label>
                                  <input
                                    id="offset-y"
                                    type="number"
                                    value={offsetY}
                                    onChange={(e) => { setOffsetY(parseInt(e.target.value) || 0); }}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                                    disabled={saving}
                                  />
                                </div>
                              </div>

                              {/* Z-Index Control */}
                              <div>
                                <label htmlFor="z-index" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Z-Index
                                </label>
                                <input
                                  id="z-index"
                                  type="number"
                                  value={customZIndex}
                                  onChange={(e) => { setCustomZIndex(parseInt(e.target.value) || 999999); }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                                  disabled={saving}
                                />
                              </div>

                              {/* Description */}
                              <div>
                                <label htmlFor="positioning-description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Description (Optional)
                                </label>
                                <input
                                  id="positioning-description"
                                  type="text"
                                  placeholder="E.g., 'Next to send button on contact form'"
                                  value={positioningDescription}
                                  onChange={(e) => { setPositioningDescription(e.target.value); }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                                  disabled={saving}
                                />
                              </div>

                              {/* Selector Error/Success */}
                              {selectorError && (
                                <div className={`p-2 border rounded ${
                                  selectorError.startsWith('✓') 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}>
                                  <p className={`text-xs ${
                                    selectorError.startsWith('✓')
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {selectorError}
                                  </p>
                                </div>
                              )}

                              {/* Helpful Tips */}
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Tips & Examples:</p>
                                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                                  <li>• <strong>Basic:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">.send-button</code> or <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">#submit-btn</code></li>
                                  <li>• <strong>Attributes:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">button[type=&quot;submit&quot;]</code></li>
                                  <li>• <strong>Multiple:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">button, .send-btn, #submit</code></li>
                                  <li>• <strong>DevTools:</strong> Right-click → Inspect → Copy selector</li>
                                  <li>• <strong>Test in console:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">document.querySelector(&apos;your-selector&apos;)</code></li>
                                  <li>• <strong>Placement:</strong> Use &quot;inside-end&quot; for button containers</li>
                                </ul>
                              </div>
                        </>
                      </div>
                    )}
                  </div>
                  
                  {/* Add Site Button */}
                  <button
                    onClick={() => void handleAddCustomSite()}
                    disabled={!isValidUrl(newSiteUrl) || saving || !customSelector.trim() || isCurrentSiteIntegrated}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    title={isCurrentSiteIntegrated ? 'This site is already integrated' : !isValidUrl(newSiteUrl) ? `Validation error: ${validateAndProcessUrl(newSiteUrl).error || 'Invalid URL'}` : !customSelector.trim() ? 'Icon positioning is required' : ''}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 4v16m8-8H4"/>
                    </svg>
                    {isCurrentSiteIntegrated ? 'Site Already Integrated' : 'Add Custom Site'}
                  </button>

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
                
                {/* Status/Summary of Custom Sites */}
                {settings.customSites.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>{settings.customSites.length}</strong> custom {settings.customSites.length === 1 ? 'site' : 'sites'} configured. 
                      You can manage them in the Site Integration section above.
                    </p>
                  </div>
                )}
                
                {settings.customSites.length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <p className="text-sm">No custom sites added yet</p>
                    <p className="text-xs mt-1">Use the form above to add websites where you want my prompt manager to appear</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <SectionSeparator />

        {/* Reset */}
        <section>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => { setShowResetSection(!showResetSection); }}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
              aria-expanded={showResetSection}
              aria-controls="reset-section-content"
            >
              <svg 
                className={`w-5 h-5 transition-transform ${showResetSection ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={2} 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6"/>
              </svg>
              Reset Settings
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-7">
              Dangerous action - restores all settings to factory defaults
            </p>
          </div>
          
          {showResetSection && (
            <div id="reset-section-content" className="animate-in slide-in-from-top-2 duration-200">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg 
                    className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                      Warning: This action cannot be undone
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                      This will reset all your settings including site configurations, custom sites, and preferences to their default values. 
                      All your custom sites will be removed.
                    </p>
                    <button
                      onClick={() => void handleReset()}
                      disabled={saving}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                    >
                      {saving ? 'Resetting...' : 'Reset All Settings to Default'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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