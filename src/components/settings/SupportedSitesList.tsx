import type { FC, ReactNode } from 'react';

import { getLinkedPlatformHostnames } from '../../config/platforms';

import SiteRow from './SiteRow';

export interface SiteConfig {
  name: string;
  icon: (isEnabled: boolean) => ReactNode;
}

interface SupportedSitesListProps {
  siteConfigs: Record<string, SiteConfig>;
  enabledSites: string[];
  onSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  saving?: boolean;
}

/** The domains a Platform's switch turns on: its own, then its linked Platforms' (Copilot and M365 Copilot) */
export const platformDomains = (hostname: string): string =>
  getLinkedPlatformHostnames(hostname).map(domain => domain.replace(/^www\./, '')).join(' · ');

/** The Platforms, one row each, in the order of siteConfigs */
const SupportedSitesList: FC<SupportedSitesListProps> = ({
  siteConfigs,
  enabledSites,
  onSiteToggle,
  saving = false,
}) => (
  <>
    {Object.entries(siteConfigs).map(([hostname, config]) => {
      const isEnabled = enabledSites.includes(hostname);
      return (
        <SiteRow
          key={hostname}
          hostname={hostname}
          name={config.name}
          detail={platformDomains(hostname)}
          // The logo keeps its brand colors; the row greys and dims it when the site is off
          icon={config.icon(true)}
          isEnabled={isEnabled}
          onToggle={onSiteToggle}
          saving={saving}
        />
      );
    })}
  </>
);

export default SupportedSitesList;
