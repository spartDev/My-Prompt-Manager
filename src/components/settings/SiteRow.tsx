import { type FC, type ReactNode, useId } from 'react';

import { getBrandColors } from '../../constants/brandColors';
import { Dropdown, type DropdownItem } from '../Dropdown';

import SettingsRow from './SettingsRow';
import Switch from './Switch';

interface SiteRowProps {
  hostname: string;
  name: string;
  /** The grey line under the name: the domains the switch turns on */
  detail: string;
  icon: ReactNode;
  isEnabled: boolean;
  onToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  /** A custom site's actions, in its ⋯ menu */
  onRemove?: (hostname: string) => Promise<void> | void;
  onExport?: (hostname: string) => Promise<void> | void;
  exporting?: boolean;
  saving?: boolean;
}

/**
 * One site in the AI sites group: its logo, name and domain, and the switch that turns the extension on
 * there. A site that is off shows its logo greyed and dimmed.
 */
const SiteRow: FC<SiteRowProps> = ({
  hostname,
  name,
  detail,
  icon,
  isEnabled,
  onToggle,
  onRemove,
  onExport,
  exporting = false,
  saving = false
}) => {
  const labelId = useId();
  const brandColors = getBrandColors(hostname);

  const actions: DropdownItem[] = [];
  if (onExport) {
    actions.push({
      id: 'export',
      label: exporting ? 'Copying...' : 'Export configuration',
      disabled: saving || exporting,
      onSelect: () => { void onExport(hostname); }
    });
  }
  if (onRemove) {
    actions.push({
      id: 'remove',
      label: 'Remove',
      disabled: saving,
      // Important: the menu item's own text-secondary would otherwise win
      className: 'text-danger!',
      onSelect: () => { void onRemove(hostname); }
    });
  }

  return (
    <SettingsRow
      testId="site-row"
      label={name}
      labelId={labelId}
      detail={detail}
      leading={
        <span
          data-testid="site-logo"
          className={`
            size-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden text-sm font-semibold
            [&>svg]:size-[18px] ${brandColors.enabled}
            transition-[filter,opacity] duration-(--duration-dim)
            ${isEnabled ? '' : 'grayscale opacity-50'}
          `}
        >
          {icon}
        </span>
      }
      control={
        <div className="flex items-center gap-1">
          {actions.length > 0 && (
            <Dropdown
              placement="bottom-end"
              items={actions}
              ariaLabel={`${name} actions`}
              trigger={
                <button
                  type="button"
                  aria-label={`More actions for ${name}`}
                  className="size-8 rounded-full flex items-center justify-center text-tertiary hover:bg-muted hover:text-primary transition-colors focus-interactive"
                >
                  <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
              }
            />
          )}
          <Switch
            checked={isEnabled}
            onChange={(checked) => { void onToggle(hostname, checked); }}
            disabled={saving}
            labelledBy={labelId}
          />
        </div>
      }
    />
  );
};

export default SiteRow;
