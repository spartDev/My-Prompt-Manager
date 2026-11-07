import type { FC } from 'react';

import { useClipboard } from '../../hooks/useClipboard';
import type { CustomSite } from '../../types';
import { CustomSiteIcon } from '../icons/SiteIcons';

import SiteRow from './SiteRow';

interface CustomSitesListProps {
  customSites: CustomSite[];
  onCustomSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onRemoveCustomSite: (hostname: string) => Promise<void> | void;
  onExportCustomSite: (site: CustomSite) => Promise<void>;
  exportingHostname: string | null;
  saving?: boolean;
}

/** The custom sites, one row each after the Platforms, with Export and Remove in each row's menu */
const CustomSitesList: FC<CustomSitesListProps> = ({
  customSites,
  onCustomSiteToggle,
  onRemoveCustomSite,
  onExportCustomSite,
  exportingHostname,
  saving = false,
}) => {
  const { copyStatus } = useClipboard();

  return (
    <>
      {customSites.map((site) => (
        <SiteRow
          key={site.hostname}
          hostname={site.hostname}
          name={site.displayName}
          detail={site.hostname}
          icon={site.icon || <CustomSiteIcon letter={site.displayName.charAt(0)} />}
          isEnabled={site.enabled}
          onToggle={onCustomSiteToggle}
          onRemove={onRemoveCustomSite}
          onExport={(hostname) => {
            const target = customSites.find((s) => s.hostname === hostname);
            if (target) {
              void onExportCustomSite(target);
            }
          }}
          exporting={exportingHostname === site.hostname && copyStatus === 'copying'}
          saving={saving}
        />
      ))}
    </>
  );
};

export default CustomSitesList;
