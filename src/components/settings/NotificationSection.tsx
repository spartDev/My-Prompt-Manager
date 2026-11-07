import { type FC, useId } from 'react';

import type { ToastSettings } from '../../types/hooks';
import { BellIcon } from '../icons/SettingsIcons';

import ToggleSwitch from './ToggleSwitch';

interface NotificationSectionProps {
  settings: ToastSettings;
  /** Turns every Notification on or off, failures included */
  onEnabledChange: (enabled: boolean) => void;
}

/** One switch for every Notification: no position (always the top center) and no type left to pick */
const NotificationSection: FC<NotificationSectionProps> = ({ settings, onEnabledChange }) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="border-t border-default pt-6">
      <div className="flex items-center gap-3 mb-4">
        <div data-testid="section-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center shrink-0">
          <BellIcon className="w-5 h-5" />
        </div>
        <h2 id={titleId} className="text-xl font-semibold text-primary">
          Notifications
        </h2>
      </div>

      <div className="bg-card rounded-xl p-4 border border-default flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-primary">
            Show notifications
          </div>
          <p className="text-xs text-tertiary mt-1">
            Brief messages at the top after you save, copy or delete.
          </p>
        </div>
        <ToggleSwitch
          checked={settings.enabled}
          onChange={onEnabledChange}
          ariaLabel="Show notifications"
          size="small"
        />
      </div>
    </section>
  );
};

export default NotificationSection;
