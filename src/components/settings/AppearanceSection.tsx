import { type FC, useId } from 'react';

import { useThemeContext } from '../../contexts/ThemeContext';

import SegmentedControl from './SegmentedControl';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'system' as const, label: 'System' }
] as const;

const INTERFACE_MODE_OPTIONS = [
  { value: 'popup' as const, label: 'Popup' },
  { value: 'sidepanel' as const, label: 'Side panel' }
] as const;

interface AppearanceSectionProps {
  interfaceMode: 'popup' | 'sidepanel';
  onInterfaceModeChange: (mode: 'popup' | 'sidepanel') => void;
  saving?: boolean;
  interfaceModeChanging?: boolean;
}

/** The Appearance group: the theme, and how the toolbar icon opens the extension */
const AppearanceSection: FC<AppearanceSectionProps> = ({
  interfaceMode,
  onInterfaceModeChange,
  saving = false,
  interfaceModeChanging = false
}) => {
  const { theme, setTheme } = useThemeContext();
  const themeLabelId = useId();
  const modeLabelId = useId();

  return (
    <SettingsGroup label="Appearance">
      {/* The theme saves on its own (ThemeContext), so a Settings save in progress does not lock it */}
      <SettingsRow
        label="Theme"
        labelId={themeLabelId}
        control={
          <SegmentedControl
            options={THEME_OPTIONS}
            value={theme}
            onChange={(value) => { void setTheme(value); }}
            labelledBy={themeLabelId}
          />
        }
      />
      {/* Locked while Settings saves, and for 3s after a change */}
      <SettingsRow
        label="Open in"
        labelId={modeLabelId}
        control={
          <div className="flex items-center gap-2">
            {interfaceModeChanging && (
              <span
                data-testid="interface-mode-spinner"
                aria-hidden="true"
                className="size-3 text-accent border-2 border-current/30 border-t-current rounded-full animate-spin"
              />
            )}
            <SegmentedControl
              options={INTERFACE_MODE_OPTIONS}
              value={interfaceMode}
              onChange={onInterfaceModeChange}
              labelledBy={modeLabelId}
              locked={saving || interfaceModeChanging}
            />
          </div>
        }
      />
    </SettingsGroup>
  );
};

export default AppearanceSection;
