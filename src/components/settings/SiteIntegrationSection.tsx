import { FC, useState, useEffect, ReactNode, useCallback } from 'react';

import { useClipboard } from '../../hooks/useClipboard';
import { ConfigurationEncoder, ConfigurationEncoderError } from '../../services/configurationEncoder';
import { CustomSite, CustomSiteConfiguration, SecurityWarning, ElementFingerprint } from '../../types';
import { Logger, toError } from '../../utils';
import { CustomSiteIcon } from '../icons/SiteIcons';

import AddCustomSiteCard from './AddCustomSiteCard';
import ConfigurationPreview from './ConfigurationPreview';
import ImportSection from './ImportSection';
import SettingsSection from './SettingsSection';
import SiteCard from './SiteCard';

interface SiteIntegrationSectionProps {
  enabledSites: string[];
  customSites: CustomSite[];
  siteConfigs: Record<string, { name: string; description: string; icon: ReactNode | ((isEnabled: boolean) => ReactNode) }>;
  onSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onCustomSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onRemoveCustomSite: (hostname: string) => Promise<void> | void;
  onAddCustomSite?: (siteData: Omit<CustomSite, 'dateAdded'> & { positioning?: CustomSite['positioning'] }) => Promise<void> | void;
  onEditCustomSite?: (hostname: string) => void;
  interfaceMode?: 'popup' | 'sidepanel';
  saving?: boolean;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface PendingImport {
  config: CustomSiteConfiguration;
  warnings: SecurityWarning[];
  duplicate: boolean;
  existingSite?: CustomSite;
}

const SiteIntegrationSection: FC<SiteIntegrationSectionProps> = ({
  enabledSites,
  customSites,
  siteConfigs,
  onSiteToggle,
  onCustomSiteToggle,
  onRemoveCustomSite,
  onAddCustomSite,
  onEditCustomSite,
  interfaceMode = 'popup',
  saving = false,
  onShowToast
}) => {
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [customSelector, setCustomSelector] = useState('');
  const [elementFingerprint, setElementFingerprint] = useState<ElementFingerprint | null>(null); // NEW: Store fingerprint
  const [placement, setPlacement] = useState<'before' | 'after' | 'inside-start' | 'inside-end'>('before');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zIndex, setZIndex] = useState(1000);
  const [positioningDescription, setPositioningDescription] = useState('');
  const [urlError, setUrlError] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickingElement, setPickingElement] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const { copyToClipboard, copyStatus } = useClipboard();
  const [exportingHostname, setExportingHostname] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importingConfig, setImportingConfig] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [showAddMethodChooser, setShowAddMethodChooser] = useState(false);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) {
      onShowToast(message, type);
    }
  }, [onShowToast]);

  const resetAddSiteForm = useCallback(() => {
    setNewSiteUrl('');
    setNewSiteName('');
    setCustomSelector('');
    setElementFingerprint(null); // NEW: Reset fingerprint
    setPlacement('before');
    setOffsetX(0);
    setOffsetY(0);
    setZIndex(1000);
    setPositioningDescription('');
    setUrlError('');
    setPickingElement(false);
    setPickerError(null);
  }, []);

  const openAddMethodSelector = useCallback(() => {
    resetAddSiteForm();
    setShowImportDrawer(false);
    setShowAddSite(false);
    setShowAddMethodChooser(true);
  }, [resetAddSiteForm]);

  const openManualFlow = useCallback(() => {
    resetAddSiteForm();
    setShowImportDrawer(false);
    setShowAddMethodChooser(false);
    setShowAddSite(true);
  }, [resetAddSiteForm]);

  const openImportFlow = useCallback(() => {
    setShowAddMethodChooser(false);
    setShowAddSite(false);
    setShowImportDrawer(true);
  }, []);

  const handleExportCustomSite = async (site: CustomSite) => {
    try {
      setExportingHostname(site.hostname);
      const encoded = await ConfigurationEncoder.encode(site);
      const copied = await copyToClipboard(encoded);

      if (copied) {
        notify('Configuration copied to clipboard', 'success');
      } else {
        setImportCode(encoded);
        openImportFlow();
        setImportError('Clipboard access was blocked. The configuration code is now in the import field for manual copying.');
        notify('Clipboard access was blocked. The configuration code has been added to the import field.', 'error');
      }
    } catch (error) {
      const message = error instanceof ConfigurationEncoderError
        ? error.message
        : 'Failed to export configuration';
      notify(message, 'error');
    } finally {
      setExportingHostname(null);
    }
  };

  const mapEncoderErrorToMessage = (error: ConfigurationEncoderError): string => {
    switch (error.code) {
      case 'INVALID_FORMAT':
        return 'Invalid configuration code. Please check the value and try again.';
      case 'UNSUPPORTED_VERSION':
        return 'This configuration was created with a newer version that is not supported yet.';
      case 'CHECKSUM_FAILED':
        return 'The configuration appears to be corrupted or tampered with.';
      case 'SECURITY_VIOLATION':
        return 'Import blocked because the configuration failed security checks.';
      case 'VALIDATION_ERROR':
      default:
        return error.message || 'Configuration failed validation.';
    }
  };

  const requestSitePermission = async (hostname: string): Promise<boolean> => {
    const origin = `https://${hostname}/*`;

    try {
      const granted = await chrome.permissions.request({
        origins: [origin]
      });

      if (!granted) {
        return false;
      }

      await chrome.runtime.sendMessage({
        type: 'REQUEST_PERMISSION',
        data: { origins: [origin] }
      });

      return true;
    } catch (error) {
      Logger.error('Failed to request permission for imported site', toError(error));
      return false;
    }
  };

  const handleClearImport = () => {
    setImportCode('');
    setImportError(null);
    setPendingImport(null);
  };

  const handlePreviewImport = async () => {
    if (!importCode.trim()) {
      setImportError('Enter a configuration code to continue.');
      return;
    }

    setImportError(null);
    setPendingImport(null);
    setPreviewOpen(false);
    setImportingConfig(true);
    openImportFlow();

    try {
      const decodedConfig = await ConfigurationEncoder.decode(importCode.trim());
      const validation = ConfigurationEncoder.validate(decodedConfig);
      const existingCustomSite = customSites.find(site => site.hostname === validation.sanitizedConfig.hostname);
      const isBuiltIn = Object.prototype.hasOwnProperty.call(siteConfigs, validation.sanitizedConfig.hostname);

      if (isBuiltIn) {
        const message = 'This hostname already has a built-in integration and cannot be imported as custom.';
        setImportError(message);
        notify(message, 'error');
        return;
      }

      setPendingImport({
        config: validation.sanitizedConfig,
        warnings: validation.warnings.filter(warning => warning.severity !== 'error'),
        duplicate: Boolean(existingCustomSite),
        existingSite: existingCustomSite
      });
      setPreviewOpen(true);
    } catch (error) {
      const message = error instanceof ConfigurationEncoderError
        ? mapEncoderErrorToMessage(error)
        : 'Failed to decode configuration. Please verify the code and try again.';
      setImportError(message);
      notify(message, 'error');
    } finally {
      setImportingConfig(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) {
      return;
    }

    setConfirmingImport(true);

    try {
      const granted = await requestSitePermission(pendingImport.config.hostname);

      if (!granted) {
        const message = 'Permission denied. Please allow access to the site and try again.';
        setImportError(message);
        notify(message, 'error');
        return;
      }

      if (pendingImport.duplicate && pendingImport.existingSite) {
        await Promise.resolve(onRemoveCustomSite(pendingImport.existingSite.hostname));
      }

      const siteData: Omit<CustomSite, 'dateAdded'> = {
        hostname: pendingImport.config.hostname,
        displayName: pendingImport.config.displayName,
        enabled: true,
        ...(pendingImport.config.positioning ? { positioning: pendingImport.config.positioning } : {})
      };

      if (onAddCustomSite) {
        await Promise.resolve(onAddCustomSite(siteData));
      }

      setImportError(null);
      setShowImportDrawer(false);
      setShowAddSite(false);
      setShowAddMethodChooser(false);
      notify('Configuration imported successfully', 'success');
      setPreviewOpen(false);
      setPendingImport(null);
      setImportCode('');
    } catch (error) {
      Logger.error('Failed to import configuration', toError(error));
      notify('Failed to import configuration. Please try again.', 'error');
    } finally {
      setConfirmingImport(false);
    }
  };
  
  // Current tab state for auto-fill
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [currentTabTitle, setCurrentTabTitle] = useState<string | null>(null);
  const [isCurrentSiteIntegrated, setIsCurrentSiteIntegrated] = useState(false);
  
  // Check if we're in picker window mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPickerWindow = urlParams.get('picker') === 'true';
  const originalTabIdStr = urlParams.get('originalTabId');
  const originalTabId = originalTabIdStr ? parseInt(originalTabIdStr, 10) : null;
  const originalUrl = urlParams.get('originalUrl');
  const originalHostname = urlParams.get('originalHostname');

  const icon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );

  // Element picker functionality
  useEffect(() => {
    const handleMessage = (message: { type?: string; data?: unknown }) => {
      if (message.type === 'ELEMENT_PICKER_RESULT') {
        const data = message.data as {
          fingerprint?: ElementFingerprint;
          selector?: string;
          elementType?: string;
          elementInfo?: Record<string, unknown>;
          hostname?: string;
        } | undefined;
        
        if (data?.selector) {
          setCustomSelector(data.selector);
          setElementFingerprint(data.fingerprint || null); // NEW: Store fingerprint
          setPickingElement(false);
          
          // Log for debugging
          Logger.debug('Element picker result received', {
            component: 'SiteIntegrationSection',
            hasFingerprint: !!data.fingerprint,
            selector: data.selector
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Auto-populate URL field in picker window mode
  useEffect(() => {
    if (isPickerWindow && originalUrl && !newSiteUrl) {
      // Auto-populate the URL field with the original URL
      setNewSiteUrl(originalUrl);
      
      // Also try to set a friendly name based on the hostname
      if (originalHostname) {
        try {
          // Remove www. and common TLDs for a cleaner name
          const cleanName = originalHostname
            .replace(/^www\./, '')
            .replace(/\.(com|org|net|io|ai|app|dev)$/, '');
          
          // Capitalize first letter
          const friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setNewSiteName(friendlyName);
        } catch {
          // If processing fails, just leave the name empty
        }
      }
    }
  }, [isPickerWindow, originalUrl, originalHostname, newSiteUrl]);

  // Get current tab information for auto-fill (only when not in picker window mode)
  useEffect(() => {
    if (!isPickerWindow) {
      void (async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0 && tabs[0]?.url) {
            const activeTab = tabs[0];
            const tabUrl = activeTab.url;
            const tabTitle = activeTab.title;
            
            if (tabUrl) {
              const url = new URL(tabUrl);
              const hostname = url.hostname;
              
              // Set current tab info for auto-population
              setCurrentTabUrl(tabUrl);
              setCurrentTabTitle(tabTitle || null);
              
              // Check if the current site is already integrated
              const isBuiltIn = Object.keys(siteConfigs).includes(hostname);
              const isCustom = customSites.some(site => site.hostname === hostname);
              
              setIsCurrentSiteIntegrated(isBuiltIn || isCustom);
            }
          }
        } catch (error) {
          Logger.error('Failed to get current tab', toError(error));
        }
      })();
    }
  }, [isPickerWindow, siteConfigs, customSites]);

  // Auto-populate URL and title fields with current tab when available
  useEffect(() => {
    if (currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl && !showAddSite) {
      // Only auto-populate when user opens the add site form
      return;
    }
    
    if (currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl && showAddSite) {
      // Auto-populate the URL field
      setNewSiteUrl(currentTabUrl);
      
      // Auto-populate display name with page title or fallback to hostname
      if (currentTabTitle) {
        setNewSiteName(currentTabTitle);
      } else {
        // Fallback to hostname-based name (same as old implementation)
        try {
          const url = new URL(currentTabUrl);
          const hostname = url.hostname;
          // Remove www. and common TLDs for a cleaner name
          const cleanName = hostname
            .replace(/^www\./, '')
            .replace(/\.(com|org|net|io|ai|app|dev)$/, '');
          
          // Capitalize first letter
          const friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setNewSiteName(friendlyName);
        } catch {
          // If URL parsing fails, just leave the name empty
        }
      }
    }
  }, [currentTabUrl, currentTabTitle, isCurrentSiteIntegrated, newSiteUrl, showAddSite]);

  const startElementPicker = async () => {
    setPickingElement(true);
    setPickerError(null);
    
    try {
      let targetTabId: number | null = null;
      let targetTab: chrome.tabs.Tab | undefined;

      if (isPickerWindow) {
        // We're in a picker window, use the original tab ID
        if (originalTabId) {
          targetTabId = originalTabId;
          try {
            targetTab = await chrome.tabs.get(originalTabId);
          } catch {
            throw new Error('Original tab is no longer available');
          }
        } else {
          throw new Error('No original tab ID found');
        }
      } else {
        // Get the current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = tabs[0] as chrome.tabs.Tab | undefined;
        targetTabId = targetTab?.id || null;
        
        if (!targetTabId || !targetTab?.url) {
          throw new Error('No active tab found');
        }
      }

      // Check if we need permission for this tab's URL
      if (targetTab.url) {
        const url = new URL(targetTab.url);
        const origin = `${url.protocol}//${url.hostname}/*`;
        
        // Skip permission check for already allowed origins
        const isAllowedOrigin = targetTab.url.startsWith('https://claude.ai/') ||
                               targetTab.url.startsWith('https://chatgpt.com/') ||
                               targetTab.url.startsWith('https://www.perplexity.ai/') ||
                               targetTab.url.startsWith('https://chat.mistral.ai/');
        
        if (!isAllowedOrigin) {
          // Check if we have permission
          const hasPermission = await chrome.permissions.contains({
            origins: [origin]
          });
          
          if (!hasPermission) {
            // Request permission directly from user gesture context
            try {
              const granted = await chrome.permissions.request({
                origins: [origin]
              });
              
              if (!granted) {
                throw new Error('Permission denied. Please grant access to use the element picker on this site.');
              }
            } catch (permissionError) {
              // Handle both permission denial and any other permission request errors
              if (permissionError instanceof Error) {
                throw permissionError;
              } else {
                throw new Error('Permission request failed. Please try again.');
              }
            }
          }
        }
      }

      // Now that permission is handled, start the element picker
      if (isPickerWindow) {
        // We're in a picker window, directly start the picker with the original tab ID
        const response = await chrome.runtime.sendMessage({
          type: 'START_ELEMENT_PICKER',
          data: { tabId: targetTabId }
        }) as unknown as { success?: boolean; error?: string } | undefined;
        
        if (!response?.success) {
          throw new Error(response?.error || 'Failed to start element picker');
        }
      } else if (interfaceMode === 'sidepanel') {
        // In sidepanel mode, directly activate picker
        const response = await chrome.runtime.sendMessage({
          type: 'START_ELEMENT_PICKER',
          data: { tabId: targetTabId }
        }) as unknown as { success?: boolean; error?: string } | undefined;
        
        if (!response?.success) {
          throw new Error(response?.error || 'Failed to start element picker');
        }
      } else {
        // In popup mode, open new window for picker
        const response = await chrome.runtime.sendMessage({
          type: 'OPEN_PICKER_WINDOW',
          data: { tabId: targetTabId }
        }) as unknown as { success?: boolean; error?: string } | undefined;
        
        if (response?.success) {
          // Close the current popup
          window.close();
        } else {
          throw new Error(response?.error || 'Failed to open picker window');
        }
      }
    } catch (error) {
      Logger.error('Failed to start element picker', toError(error));
      const errorMessage = error instanceof Error ? error.message : 'Failed to start element picker';
      setPickerError(errorMessage);
      setPickingElement(false);
    }
  };

  const handleAddSite = async () => {
    if (!newSiteUrl.trim()) {
      setUrlError('Please enter a URL');
      return;
    }

    try {
      const url = new URL(newSiteUrl.startsWith('http') ? newSiteUrl : `https://${newSiteUrl}`);
      const hostname = url.hostname;
      
      // Check if already exists
      if (Object.keys(siteConfigs).includes(hostname) || customSites.some(s => s.hostname === hostname)) {
        setUrlError('This site is already added');
        return;
      }

      setAdding(true);

      // Request permission for the new site
      const origin = `https://${hostname}/*`;
      
      try {
        const granted = await chrome.permissions.request({
          origins: [origin]
        });

        if (!granted) {
          setUrlError('Permission denied. Cannot add custom site without permission.');
          return;
        }

        // Send a message to background script to notify about permission grant
        await chrome.runtime.sendMessage({
          type: 'REQUEST_PERMISSION',
          data: { origins: [origin] }
        });

      } catch (permissionError) {
        Logger.error('Failed to request permission', toError(permissionError));
        setUrlError('Failed to request permission. Please try again.');
        return;
      }

      const siteData: Omit<CustomSite, 'dateAdded'> = {
        hostname,
        displayName: newSiteName.trim() || hostname,
        enabled: true,
        ...(customSelector && {
          positioning: {
            mode: 'custom' as const,
            fingerprint: elementFingerprint || undefined, // NEW: Include fingerprint
            selector: customSelector,
            placement,
            offset: { x: offsetX, y: offsetY },
            zIndex,
            description: positioningDescription.trim() || undefined
          }
        })
      };

      if (onAddCustomSite) {
        await Promise.resolve(onAddCustomSite(siteData));
      }

      // Inject content script immediately if tabs are open with this hostname
      try {
        const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
        for (const tab of tabs) {
          if (tab.id) {
            await chrome.runtime.sendMessage({
              type: 'REQUEST_INJECTION',
              data: { tabId: tab.id }
            });
          }
        }
      } catch {
        // Failed to inject content script into existing tabs - not critical, continue
      }

      resetAddSiteForm();
      setShowAddSite(false);
      setShowAddMethodChooser(false);
    } catch {
      setUrlError('Please enter a valid URL');
    } finally {
      setAdding(false);
    }
  };

  const cancelAddSite = () => {
    resetAddSiteForm();
    setShowAddSite(false);
    setShowAddMethodChooser(false);
  };

  const currentSiteHostname = (() => {
    if (!currentTabUrl) {
      return 'this website';
    }

    try {
      return new URL(currentTabUrl).hostname;
    } catch {
      return 'this website';
    }
  })();

  const addActionDisabled = !isPickerWindow && isCurrentSiteIntegrated;
  const addCardTooltip = addActionDisabled
    ? `Current site (${currentSiteHostname}) is already integrated`
    : 'Add a new custom site';
  const addFirstSiteTooltip = addActionDisabled
    ? `Current site (${currentSiteHostname}) is already integrated`
    : 'Add your first custom site';
  const addFirstSiteLabel = addActionDisabled ? 'Current Site Already Added' : 'Add Your First Site';

  return (
    <>
    <SettingsSection
      icon={icon}
      title="Site Integration"
      description="Choose which sites show the prompt library"
    >
      <div className="space-y-4">
        {/* Supported Sites */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
            Supported Sites
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(siteConfigs).map(([hostname, config]) => {
              const isEnabled = enabledSites.includes(hostname);
              return (
                <SiteCard
                  key={hostname}
                  hostname={hostname}
                  name={config.name}
                  description={config.description}
                  icon={typeof config.icon === 'function' ? config.icon(isEnabled) : config.icon}
                  isEnabled={isEnabled}
                  onToggle={onSiteToggle}
                  saving={saving}
                />
              );
            })}
          </div>
        </div>

        {/* Custom Sites */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              Custom Sites
            </h3>
          </div>

          {showAddMethodChooser && (
            <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                How would you like to add this site?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Choose a method to continue
              </p>
              <div className="grid gap-3 max-w-2xl mx-auto sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openManualFlow}
                  className="group flex flex-row items-start gap-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-left transition-all hover:border-purple-400 hover:shadow-md dark:hover:border-purple-500"
                >
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/60 transition-colors">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Manual Configuration</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Configure hostname, selectors, and positioning yourself
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={openImportFlow}
                  className="group flex flex-row items-start gap-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-left transition-all hover:border-purple-400 hover:shadow-md dark:hover:border-purple-500"
                >
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/60 transition-colors">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Import Configuration</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Paste a shared code to reuse an existing setup instantly
                    </p>
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddMethodChooser(false); }}
                className="mt-6 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 underline transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {showImportDrawer && (
            <div
              id="custom-site-import-drawer"
              className="py-8 px-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 mb-3">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Import Configuration
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reuse an existing setup by pasting a configuration code
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <ImportSection
                  value={importCode}
                  onChange={(value) => {
                    setImportCode(value);
                    setImportError(null);
                  }}
                  onPreview={() => { void handlePreviewImport(); }}
                  onClear={() => {
                    handleClearImport();
                    setShowImportDrawer(false);
                  }}
                  loading={importingConfig}
                  error={importError}
                />
              </div>
            </div>
          )}
          {/* Add Site Form */}
          {showAddSite && (
            <div className="py-8 px-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 mb-3">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  Manual Configuration
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure your custom site integration
                </p>
              </div>
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Basic Information Card */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Basic Information</h5>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="website-url" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Website URL *
                      </label>
                      <input
                        id="website-url"
                        type="text"
                        value={newSiteUrl}
                        onChange={(e) => {
                          setNewSiteUrl(e.target.value);
                          setUrlError('');
                        }}
                        placeholder="example.com or https://example.com"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {urlError && (
                        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{urlError}</p>
                      )}

                      {/* Auto-fill indicator */}
                      {!isPickerWindow && currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                                💡 Current page detected: {currentTabTitle || new URL(currentTabUrl).hostname}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                Fields will auto-fill when you start adding this site
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Already integrated warning */}
                      {!isPickerWindow && currentTabUrl && isCurrentSiteIntegrated && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              <strong>Note:</strong> The current website ({new URL(currentTabUrl).hostname}) is already integrated
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="display-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Display Name
                      </label>
                      <input
                        id="display-name"
                        type="text"
                        value={newSiteName}
                        onChange={(e) => { setNewSiteName(e.target.value); }}
                        placeholder="My Website (optional)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Element Picker Section */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Custom Positioning
                    </h5>
                    <button
                      type="button"
                      onClick={() => { void startElementPicker(); }}
                      disabled={pickingElement || adding}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      {pickingElement ? 'Picking...' : 'Pick Element'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Specify where the prompt library icon should appear. If not set, the extension will automatically detect suitable input areas.
                  </p>
                  
                  {pickerError && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {pickerError}
                      </p>
                      {pickerError.includes('refresh') && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                          This usually happens when the page was already open before the extension was installed or updated.
                        </p>
                      )}
                    </div>
                  )}

                  {customSelector && (
                    <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {/* Placement */}
                      <div>
                        <label htmlFor="placement-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Placement
                        </label>
                        <select
                          id="placement-select"
                          value={placement}
                          onChange={(e) => { setPlacement(e.target.value as 'before' | 'after' | 'inside-start' | 'inside-end'); }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="before">Before element</option>
                          <option value="after">After element</option>
                          <option value="inside-start">Inside at start</option>
                          <option value="inside-end">Inside at end</option>
                        </select>
                      </div>

                      {/* Offset */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="offset-x" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Offset X (px)
                          </label>
                          <input
                            id="offset-x"
                            type="number"
                            value={offsetX}
                            onChange={(e) => { setOffsetX(Number(e.target.value)); }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            min="-500"
                            max="500"
                          />
                        </div>
                        <div>
                          <label htmlFor="offset-y" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Offset Y (px)
                          </label>
                          <input
                            id="offset-y"
                            type="number"
                            value={offsetY}
                            onChange={(e) => { setOffsetY(Number(e.target.value)); }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            min="-500"
                            max="500"
                          />
                        </div>
                      </div>

                      {/* Z-Index */}
                      <div>
                        <label htmlFor="z-index" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Z-Index
                        </label>
                        <input
                          id="z-index"
                          type="number"
                          value={zIndex}
                          onChange={(e) => { setZIndex(Number(e.target.value)); }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          min="1"
                          max="2147483647"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label htmlFor="positioning-description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Description
                        </label>
                        <input
                          id="positioning-description"
                          type="text"
                          value={positioningDescription}
                          onChange={(e) => { setPositioningDescription(e.target.value); }}
                          placeholder="e.g., 'Next to submit button' (optional)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={() => { void handleAddSite(); }}
                    disabled={adding}
                    className="w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? 'Adding Site...' : 'Add Site'}
                  </button>
                  <button
                    onClick={cancelAddSite}
                    disabled={adding}
                    className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 underline transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Sites List */}
          {customSites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customSites.map((site) => (
                <SiteCard
                  key={site.hostname}
                  hostname={site.hostname}
                  name={site.displayName}
                  icon={site.icon || <CustomSiteIcon letter={site.displayName.charAt(0)} />}
                  isEnabled={site.enabled}
                  isCustom={true}
                  onToggle={onCustomSiteToggle}
                  onRemove={onRemoveCustomSite}
                  onEdit={onEditCustomSite}
                  onExport={(hostname) => {
                    const target = customSites.find(s => s.hostname === hostname);
                    if (target) {
                      void handleExportCustomSite(target);
                    }
                  }}
                  exporting={exportingHostname === site.hostname && copyStatus === 'copying'}
                  saving={saving}
                />
              ))}
              <AddCustomSiteCard
                onClick={openAddMethodSelector}
                disabled={addActionDisabled}
                tooltip={addCardTooltip}
              />
            </div>
          ) : (
            !showAddSite && !showAddMethodChooser && !showImportDrawer && (
              <>
                <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    No custom sites added
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Add any website to use your prompt library there
                  </p>
                <button
                  onClick={openAddMethodSelector}
                  disabled={addActionDisabled}
                  className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    addActionDisabled
                      ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={addFirstSiteTooltip}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {addFirstSiteLabel}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </SettingsSection>
    <ConfigurationPreview
      isOpen={previewOpen}
      config={pendingImport?.config ?? null}
      warnings={pendingImport?.warnings ?? []}
      duplicate={Boolean(pendingImport?.duplicate)}
      existingDisplayName={pendingImport?.existingSite?.displayName}
      onClose={() => {
        if (!confirmingImport) {
          setPreviewOpen(false);
          setPendingImport(null);
        }
      }}
      onConfirm={() => { void handleConfirmImport(); }}
      isProcessing={confirmingImport}
    />
    </>
  );
};

export default SiteIntegrationSection;
