import { FC, useState, useEffect, useCallback } from 'react';

import { useSitePermissions } from '../../hooks/useSitePermissions';
import { CustomSite, ElementFingerprint } from '../../types';

interface AddCustomSiteFormProps {
  siteConfigs: Record<string, unknown>;
  customSites: CustomSite[];
  onAddCustomSite?: (siteData: Omit<CustomSite, 'dateAdded'> & { positioning?: CustomSite['positioning'] }) => Promise<void> | void;
  onCancel: () => void;
  // Picker state from parent
  pickerState: {
    pickingElement: boolean;
    pickerError: string | null;
    customSelector: string;
    elementFingerprint: ElementFingerprint | null;
  };
  onStartElementPicker: () => Promise<void>;
  // Picker window context
  pickerWindowState: {
    isPickerWindow: boolean;
    originalUrl: string | null;
    originalHostname: string | null;
  };
  // Current tab context
  currentTabState: {
    currentTabUrl: string | null;
    currentTabTitle: string | null;
    isCurrentSiteIntegrated: boolean;
  };
}

const AddCustomSiteForm: FC<AddCustomSiteFormProps> = ({
  siteConfigs,
  customSites,
  onAddCustomSite,
  onCancel,
  pickerState,
  onStartElementPicker,
  pickerWindowState,
  currentTabState,
}) => {
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [placement, setPlacement] = useState<'before' | 'after' | 'inside-start' | 'inside-end'>('before');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zIndex, setZIndex] = useState(1000);
  const [positioningDescription, setPositioningDescription] = useState('');
  const [urlError, setUrlError] = useState('');
  const [adding, setAdding] = useState(false);

  const { requestPermissionForOrigin } = useSitePermissions();

  const { isPickerWindow, originalUrl, originalHostname } = pickerWindowState;
  const { currentTabUrl, currentTabTitle, isCurrentSiteIntegrated } = currentTabState;
  const { pickingElement, pickerError, customSelector, elementFingerprint } = pickerState;

  // Auto-populate URL field in picker window mode
  useEffect(() => {
    if (isPickerWindow && originalUrl && !newSiteUrl) {
      setNewSiteUrl(originalUrl);

      if (originalHostname) {
        try {
          const cleanName = originalHostname
            .replace(/^www\./, '')
            .replace(/\.(com|org|net|io|ai|app|dev)$/, '');
          const friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setNewSiteName(friendlyName);
        } catch {
          // If processing fails, leave the name empty
        }
      }
    }
  }, [isPickerWindow, originalUrl, originalHostname, newSiteUrl]);

  // Auto-populate URL and title fields with current tab when available
  useEffect(() => {
    if (currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl) {
      setNewSiteUrl(currentTabUrl);

      if (currentTabTitle) {
        setNewSiteName(currentTabTitle);
      } else {
        try {
          const url = new URL(currentTabUrl);
          const hostname = url.hostname;
          const cleanName = hostname
            .replace(/^www\./, '')
            .replace(/\.(com|org|net|io|ai|app|dev)$/, '');
          const friendlyName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setNewSiteName(friendlyName);
        } catch {
          // If URL parsing fails, leave the name empty
        }
      }
    }
  }, [currentTabUrl, currentTabTitle, isCurrentSiteIntegrated, newSiteUrl]);

  /**
   * Validates input, requests site permission, and adds a new custom site.
   * Parses the URL, checks for duplicates, requests permission for the origin,
   * constructs the site data with optional custom positioning, and triggers
   * content script injection on any already-open matching tabs.
   */
  const handleAddSite = useCallback(async () => {
    if (!newSiteUrl.trim()) {
      setUrlError('Please enter a URL');
      return;
    }

    try {
      const url = new URL(newSiteUrl.startsWith('http') ? newSiteUrl : `https://${newSiteUrl}`);
      const hostname = url.hostname;

      // Check if already exists
      if (Object.keys(siteConfigs).includes(hostname) || customSites.some((s) => s.hostname === hostname)) {
        setUrlError('This site is already added');
        return;
      }

      setAdding(true);

      // Request permission for the new site
      const origin = `https://${hostname}/*`;
      const granted = await requestPermissionForOrigin(origin);

      if (!granted) {
        setUrlError('Permission denied. Cannot add custom site without permission.');
        return;
      }

      const siteData: Omit<CustomSite, 'dateAdded'> = {
        hostname,
        displayName: newSiteName.trim() || hostname,
        enabled: true,
        ...(customSelector && {
          positioning: {
            mode: 'custom' as const,
            fingerprint: elementFingerprint || undefined,
            selector: customSelector,
            placement,
            offset: { x: offsetX, y: offsetY },
            zIndex,
            description: positioningDescription.trim() || undefined,
          },
        }),
      };

      if (onAddCustomSite) {
        await Promise.resolve(onAddCustomSite(siteData));
      }

      // Inject content script immediately if tabs are open with this hostname
      try {
        const tabs = await chrome.tabs.query({ url: `*://${hostname}/*` });
        await Promise.allSettled(
          tabs
            .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
            .map((tab) =>
              chrome.runtime.sendMessage({
                type: 'REQUEST_INJECTION',
                data: { tabId: tab.id },
              })
            )
        );
      } catch {
        // Failed to inject content script into existing tabs - not critical
      }

      onCancel();
    } catch {
      setUrlError('Please enter a valid URL');
    } finally {
      setAdding(false);
    }
  }, [
    newSiteUrl,
    newSiteName,
    siteConfigs,
    customSites,
    customSelector,
    elementFingerprint,
    placement,
    offsetX,
    offsetY,
    zIndex,
    positioningDescription,
    onAddCustomSite,
    onCancel,
    requestPermissionForOrigin,
  ]);

  return (
    <div className="py-8 px-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 mb-3">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Manual Configuration</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">Configure your custom site integration</p>
      </div>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Basic Information Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Basic Information
          </h5>
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
              {urlError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{urlError}</p>}

              {/* Auto-fill indicator */}
              {!isPickerWindow && currentTabUrl && !isCurrentSiteIntegrated && !newSiteUrl && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Current page detected: {currentTabTitle || new URL(currentTabUrl).hostname}
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
                    <svg
                      className="w-4 h-4 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>Note:</strong> The current website ({new URL(currentTabUrl).hostname}) is already
                      integrated
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="display-name"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={newSiteName}
                onChange={(e) => {
                  setNewSiteName(e.target.value);
                }}
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
              onClick={() => {
                void onStartElementPicker();
              }}
              disabled={pickingElement || adding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                />
              </svg>
              {pickingElement ? 'Picking...' : 'Pick Element'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Specify where the prompt library icon should appear. If not set, the extension will automatically detect
            suitable input areas.
          </p>

          {pickerError && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{pickerError}</p>
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
                <label
                  htmlFor="placement-select"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Placement
                </label>
                <select
                  id="placement-select"
                  value={placement}
                  onChange={(e) => {
                    setPlacement(e.target.value as 'before' | 'after' | 'inside-start' | 'inside-end');
                  }}
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
                  <label
                    htmlFor="offset-x"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    Offset X (px)
                  </label>
                  <input
                    id="offset-x"
                    type="number"
                    value={offsetX}
                    onChange={(e) => {
                      setOffsetX(Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="-500"
                    max="500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="offset-y"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    Offset Y (px)
                  </label>
                  <input
                    id="offset-y"
                    type="number"
                    value={offsetY}
                    onChange={(e) => {
                      setOffsetY(Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="-500"
                    max="500"
                  />
                </div>
              </div>

              {/* Z-Index */}
              <div>
                <label
                  htmlFor="z-index"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Z-Index
                </label>
                <input
                  id="z-index"
                  type="number"
                  value={zIndex}
                  onChange={(e) => {
                    setZIndex(Number(e.target.value));
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min="1"
                  max="2147483647"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="positioning-description"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Description
                </label>
                <input
                  id="positioning-description"
                  type="text"
                  value={positioningDescription}
                  onChange={(e) => {
                    setPositioningDescription(e.target.value);
                  }}
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
            onClick={() => {
              void handleAddSite();
            }}
            disabled={adding}
            className="w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? 'Adding Site...' : 'Add Site'}
          </button>
          <button
            onClick={onCancel}
            disabled={adding}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 underline transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomSiteForm;
