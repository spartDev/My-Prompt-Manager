import { FC, ReactNode } from 'react';

import SiteCard from './SiteCard';

export interface SiteConfig {
  name: string;
  description: string;
  icon: (isEnabled: boolean) => ReactNode;
}

interface SupportedSitesListProps {
  siteConfigs: Record<string, SiteConfig>;
  enabledSites: string[];
  onSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  saving?: boolean;
}

const SupportedSitesList: FC<SupportedSitesListProps> = ({
  siteConfigs,
  enabledSites,
  onSiteToggle,
  saving = false,
}) => {
  return (
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
              icon={config.icon(isEnabled)}
              isEnabled={isEnabled}
              onToggle={onSiteToggle}
              saving={saving}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SupportedSitesList;
