import { FC, useState, useEffect } from 'react';

import { CustomSite } from '../../types';

import SettingsSection from './SettingsSection';
import SiteCard from './SiteCard';

interface SiteIntegrationSectionProps {
  enabledSites: string[];
  customSites: CustomSite[];
  siteConfigs: Record<string, { name: string; description: string; icon: string }>;
  onSiteToggle: (hostname: string, enabled: boolean) => void;
  onCustomSiteToggle: (hostname: string, enabled: boolean) => void;
  onRemoveCustomSite: (hostname: string) => void;
  onAddCustomSite?: (siteData: Omit<CustomSite, 'dateAdded'>) => void;
  onEditCustomSite?: (hostname: string) => void;
  interfaceMode?: 'popup' | 'sidepanel';
  saving?: boolean;
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
  saving = false
}) => {
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [customSelector, setCustomSelector] = useState('');
  const [placement, setPlacement] = useState<'before' | 'after' | 'inside-start' | 'inside-end'>('before');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zIndex, setZIndex] = useState(1000);
  const [positioningDescription, setPositioningDescription] = useState('');
  const [urlError, setUrlError] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickingElement, setPickingElement] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  
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
        const data = message.data as { selector?: string; elementType?: string; elementInfo?: Record<string, unknown>; hostname?: string } | undefined;
        if (data?.selector) {
          setCustomSelector(data.selector);
          setPickingElement(false);
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
          console.error('Failed to get current tab:', error);
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
      if (isPickerWindow) {
        // We're in a picker window, directly start the picker with the original tab ID
        if (originalTabId) {
          const response = await chrome.runtime.sendMessage({
            type: 'START_ELEMENT_PICKER',
            data: { tabId: originalTabId }
          }) as unknown as { success?: boolean; error?: string } | undefined;
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to start element picker');
          }
        } else {
          throw new Error('No original tab ID found');
        }
      } else if (interfaceMode === 'sidepanel') {
        // In sidepanel mode, directly activate picker
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0] as chrome.tabs.Tab | undefined;
        
        if (activeTab?.id) {
          const response = await chrome.runtime.sendMessage({
            type: 'START_ELEMENT_PICKER',
            data: { tabId: activeTab.id }
          }) as unknown as { success?: boolean; error?: string } | undefined;
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to start element picker');
          }
        } else {
          throw new Error('No active tab found');
        }
      } else {
        // In popup mode, open new window for picker
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0] as chrome.tabs.Tab | undefined;
        
        if (activeTab?.id) {
          const response = await chrome.runtime.sendMessage({
            type: 'OPEN_PICKER_WINDOW',
            data: { tabId: activeTab.id }
          }) as unknown as { success?: boolean; error?: string } | undefined;
          
          if (response?.success) {
            // Close the current popup
            window.close();
          } else {
            throw new Error(response?.error || 'Failed to open picker window');
          }
        } else {
          throw new Error('No active tab found');
        }
      }
    } catch (error) {
      console.error('Failed to start element picker:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start element picker';
      setPickerError(errorMessage);
      setPickingElement(false);
    }
  };

  const handleAddSite = () => {
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

      const siteData: Omit<CustomSite, 'dateAdded'> = {
        hostname,
        displayName: newSiteName.trim() || hostname,
        enabled: true,
        ...(customSelector && {
          positioning: {
            mode: 'custom' as const,
            selector: customSelector,
            placement,
            offset: { x: offsetX, y: offsetY },
            zIndex,
            description: positioningDescription.trim() || undefined
          }
        })
      };

      if (onAddCustomSite) {
        onAddCustomSite(siteData);
      }

      // Reset form
      setNewSiteUrl('');
      setNewSiteName('');
      setCustomSelector('');
      setPlacement('before');
      setOffsetX(0);
      setOffsetY(0);
      setZIndex(1000);
      setPositioningDescription('');
      setShowAddSite(false);
      setUrlError('');
    } catch {
      setUrlError('Please enter a valid URL');
    } finally {
      setAdding(false);
    }
  };

  const cancelAddSite = () => {
    setShowAddSite(false);
    setNewSiteUrl('');
    setNewSiteName('');
    setCustomSelector('');
    setPlacement('before');
    setOffsetX(0);
    setOffsetY(0);
    setZIndex(1000);
    setPositioningDescription('');
    setUrlError('');
    setPickingElement(false);
  };

  return (
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
                  icon={config.icon}
                  isEnabled={isEnabled}
                  onToggle={onSiteToggle}
                  saving={saving}
                />
              );
            })}
          </div>
        </div>

        {/* Custom Sites */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              Custom Sites
            </h3>
            <button
              onClick={() => { setShowAddSite(true); }}
              disabled={!isPickerWindow && isCurrentSiteIntegrated}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                !isPickerWindow && isCurrentSiteIntegrated
                  ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              title={
                !isPickerWindow && isCurrentSiteIntegrated 
                  ? `Current site (${currentTabUrl ? new URL(currentTabUrl).hostname : 'this website'}) is already integrated`
                  : 'Add a new custom site'
              }
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {!isPickerWindow && isCurrentSiteIntegrated ? 'Site Already Added' : 'Add Site'}
            </button>
          </div>

          {/* Add Site Form */}
          {showAddSite && (
            <div className="mb-3 p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg">
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-3">
                Add Custom Site
              </h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="website-url" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website URL
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
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{urlError}</p>
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
                  <label htmlFor="display-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name (optional)
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={newSiteName}
                    onChange={(e) => { setNewSiteName(e.target.value); }}
                    placeholder="My Website"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Element Picker Section */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Custom Positioning (optional)
                    </h5>
                    <button
                      type="button"
                      onClick={() => { void startElementPicker(); }}
                      disabled={pickingElement || adding}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                      {pickingElement ? 'Picking...' : 'Pick Element'}
                    </button>
                  </div>
                  
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
                    <div className="space-y-3">
                      {/* Selected Element Display */}
                      <div>
                        <div className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Selected Element
                        </div>
                        <div className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-gray-900 dark:text-gray-100 break-all">
                          {customSelector}
                        </div>
                      </div>

                      {/* Placement */}
                      <div>
                        <label htmlFor="placement-select" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="offset-x" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                          <label htmlFor="offset-y" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                        <label htmlFor="z-index" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                        <label htmlFor="positioning-description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description (optional)
                        </label>
                        <input
                          id="positioning-description"
                          type="text"
                          value={positioningDescription}
                          onChange={(e) => { setPositioningDescription(e.target.value); }}
                          placeholder="e.g., &apos;Next to submit button&apos;"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!customSelector && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use the &quot;Pick Element&quot; button to specify where the prompt library icon should appear on this site. If not set, the extension will automatically detect suitable input areas.
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddSite}
                    disabled={adding}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? 'Adding...' : 'Add Site'}
                  </button>
                  <button
                    onClick={cancelAddSite}
                    disabled={adding}
                    className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 The extension will automatically detect text input areas. Use custom positioning to specify exact placement if needed.
                </p>
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
                  icon={site.icon || site.displayName.charAt(0).toUpperCase()}
                  isEnabled={site.enabled}
                  isCustom={true}
                  onToggle={onCustomSiteToggle}
                  onRemove={onRemoveCustomSite}
                  onEdit={onEditCustomSite}
                  saving={saving}
                />
              ))}
            </div>
          ) : (
            !showAddSite && (
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
                  onClick={() => { setShowAddSite(true); }}
                  disabled={!isPickerWindow && isCurrentSiteIntegrated}
                  className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    !isPickerWindow && isCurrentSiteIntegrated
                      ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={
                    !isPickerWindow && isCurrentSiteIntegrated 
                      ? `Current site (${currentTabUrl ? new URL(currentTabUrl).hostname : 'this website'}) is already integrated`
                      : 'Add your first custom site'
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {!isPickerWindow && isCurrentSiteIntegrated ? 'Current Site Already Added' : 'Add Your First Site'}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </SettingsSection>
  );
};

export default SiteIntegrationSection;