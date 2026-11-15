import type { FC, ReactNode } from 'react';

import { getLinkedPlatformHostnames } from '../../config/platforms';
import { type IconPlacementRepairs, repairForHostnames } from '../../services/iconPlacementRepairs';

import SiteRow from './SiteRow';

export interface SiteConfig {
  name: string;
  icon: (isEnabled: boolean) => ReactNode;
}

interface SupportedSitesListProps {
  siteConfigs: Record<string, SiteConfig>;
  enabledPlatforms: string[];
  onSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  saving?: boolean;
  /** How the icon was placed on the Platforms whose Toolbar was not found */
  placementRepairs?: IconPlacementRepairs;
  onPlaceIcon?: (hostname: string) => void;
  placeError?: { hostname: string; message: string } | null;
}

/** The domains a Platform's switch turns on: its own, then its linked Platforms' (Copilot and M365 Copilot) */
export const platformDomains = (hostname: string): string =>
  getLinkedPlatformHostnames(hostname).map(domain => domain.replace(/^www\./, '')).join(' · ');

/** The Platforms, one row each, in the order of siteConfigs */
const SupportedSitesList: FC<SupportedSitesListProps> = ({
  siteConfigs,
  enabledPlatforms,
  onSiteToggle,
  saving = false,
  placementRepairs = {},
  onPlaceIcon,
  placeError = null,
}) => (
  <>
    {Object.entries(siteConfigs).map(([hostname, config]) => {
      const isEnabled = enabledPlatforms.includes(hostname);
      // The switch covers the linked Platforms too (Copilot and M365 Copilot), so does the notice
      const repair = onPlaceIcon ? repairForHostnames(placementRepairs, getLinkedPlatformHostnames(hostname)) : null;
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
          placement={repair && onPlaceIcon ? {
            status: repair.status,
            onPlace: () => { onPlaceIcon(repair.hostname); },
            error: placeError?.hostname === repair.hostname ? placeError.message : undefined
          } : undefined}
        />
      );
    })}
  </>
);

export default SupportedSitesList;
