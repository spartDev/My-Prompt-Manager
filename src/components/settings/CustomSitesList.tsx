import { FC } from 'react';

import { useClipboard } from '../../hooks/useClipboard';
import { CustomSite } from '../../types';
import { CustomSiteIcon } from '../icons/SiteIcons';

import AddCustomSiteCard from './AddCustomSiteCard';
import SiteCard from './SiteCard';

interface CustomSitesListProps {
  customSites: CustomSite[];
  onCustomSiteToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onRemoveCustomSite: (hostname: string) => Promise<void> | void;
  onEditCustomSite?: (hostname: string) => void;
  onExportCustomSite: (site: CustomSite) => Promise<void>;
  onAddClick: () => void;
  exportingHostname: string | null;
  saving?: boolean;
  addActionDisabled?: boolean;
  addCardTooltip?: string;
}

const CustomSitesList: FC<CustomSitesListProps> = ({
  customSites,
  onCustomSiteToggle,
  onRemoveCustomSite,
  onEditCustomSite,
  onExportCustomSite,
  onAddClick,
  exportingHostname,
  saving = false,
  addActionDisabled = false,
  addCardTooltip = 'Add a new custom site',
}) => {
  const { copyStatus } = useClipboard();

  return (
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
            const target = customSites.find((s) => s.hostname === hostname);
            if (target) {
              void onExportCustomSite(target);
            }
          }}
          exporting={exportingHostname === site.hostname && copyStatus === 'copying'}
          saving={saving}
        />
      ))}
      <AddCustomSiteCard
        onClick={onAddClick}
        disabled={addActionDisabled}
        tooltip={addCardTooltip}
      />
    </div>
  );
};

export default CustomSitesList;
