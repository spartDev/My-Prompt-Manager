import { FC, useState } from 'react';

import SettingsSection from './SettingsSection';
import SiteCard from './SiteCard';

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

interface SiteIntegrationSectionProps {
  enabledSites: string[];
  customSites: CustomSite[];
  siteConfigs: Record<string, { name: string; description: string; icon: string }>;
  onSiteToggle: (hostname: string, enabled: boolean) => void;
  onCustomSiteToggle: (hostname: string, enabled: boolean) => void;
  onRemoveCustomSite: (hostname: string) => void;
  onAddCustomSite?: () => void;
  onEditCustomSite?: (hostname: string) => void;
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
  saving = false
}) => {
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [urlError, setUrlError] = useState('');
  const [adding, setAdding] = useState(false);

  const icon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );

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

      // This would normally call the parent's add function
      // For now, we'll just show the UI
      if (onAddCustomSite) {
        onAddCustomSite();
      }

      // Reset form
      setNewSiteUrl('');
      setNewSiteName('');
      setShowAddSite(false);
      setUrlError('');
    } catch {
      setUrlError('Please enter a valid URL');
    } finally {
      setAdding(false);
    }
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
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Site
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

                <div className="flex gap-2">
                  <button
                    onClick={handleAddSite}
                    disabled={adding}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? 'Adding...' : 'Add Site'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddSite(false);
                      setNewSiteUrl('');
                      setNewSiteName('');
                      setUrlError('');
                    }}
                    disabled={adding}
                    className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 The extension will automatically detect text input areas on the site and add the prompt library icon.
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
                  className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Site
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