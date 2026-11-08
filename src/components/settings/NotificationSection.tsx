import { type FC, useId } from 'react';

import type { ToastSettings } from '../../types/hooks';

import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import Switch from './Switch';

interface NotificationSectionProps {
  settings: ToastSettings;
  /** Turns every Notification on or off, failures included */
  onEnabledChange: (enabled: boolean) => void;
}

/** One switch for every Notification: no position (always the top center) and no type left to pick */
const NotificationSection: FC<NotificationSectionProps> = ({ settings, onEnabledChange }) => {
  const labelId = useId();

  return (
    <SettingsGroup label="Notifications">
      <SettingsRow
        label="Show notifications"
        labelId={labelId}
        control={<Switch checked={settings.enabled} onChange={onEnabledChange} labelledBy={labelId} />}
      />
    </SettingsGroup>
  );
};

export default NotificationSection;
