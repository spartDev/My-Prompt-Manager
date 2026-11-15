import { type FC, type ReactNode, useId } from 'react';

import { getBrandColors } from '../../constants/brandColors';
import type { RepairStatus } from '../../services/iconPlacementRepairs';
import { Dropdown, type DropdownItem } from '../Dropdown';

import { ROW_BUTTON_CLASSES } from './rowStyles';
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
  /** A built-in Platform whose Toolbar was not found: how the icon is placed instead, and the way to place it */
  placement?: {
    status: RepairStatus;
    onPlace: () => void;
    /** Why the Element picker could not open */
    error?: string;
  };
}

/**
 * Under a Platform row, when its icon is not in its Toolbar: on the Anchored overlay, a warning
 * that offers to place the icon; at the element the user picked, a line that offers to pick again.
 */
const PlacementNotice: FC<{ name: string } & NonNullable<SiteRowProps['placement']>> = ({ name, status, onPlace, error }) => {
  const fallback = status === 'overlay';
  return (
    <div data-testid="site-placement" data-status={status} className="mt-2 ml-[42px]">
      <div
        className={`flex items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-3 ${fallback ? 'border border-warning bg-warning-subtle' : 'bg-subtle'}`}
      >
        <p className={`flex-1 min-w-0 text-[12px] ${fallback ? 'text-warning' : 'text-secondary'}`}>
          {fallback
            ? `${name}'s toolbar changed: the icon sits in the corner of the input field.`
            : 'The icon sits where you placed it, until an update finds the toolbar again.'}
        </p>
        <button type="button" onClick={onPlace} className={ROW_BUTTON_CLASSES}>
          {fallback ? 'Place the icon' : 'Place again'}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 pl-1 text-[11.5px] text-danger">{error}</p>}
    </div>
  );
};

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
  saving = false,
  placement
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
    >
      {isEnabled && placement && <PlacementNotice name={name} {...placement} />}
    </SettingsRow>
  );
};

export default SiteRow;
