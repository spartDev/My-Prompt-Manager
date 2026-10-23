import { type FC, type KeyboardEvent, useCallback, useId, useRef } from 'react';

import { type Theme, useThemeContext } from '../../contexts/ThemeContext';
import InterfaceModeSelector from '../InterfaceModeSelector';

import SettingsSection from './SettingsSection';

// Hoisted static JSX - avoids recreation on every render
const AppearanceIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

// Theme options of the segmented control
const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'system' as const, label: 'System' }
] as const;

interface AppearanceSectionProps {
  interfaceMode: 'popup' | 'sidepanel';
  onInterfaceModeChange: (mode: 'popup' | 'sidepanel') => void;
  saving?: boolean;
  interfaceModeChanging?: boolean;
}

const AppearanceSection: FC<AppearanceSectionProps> = ({
  interfaceMode,
  onInterfaceModeChange,
  saving = false,
  interfaceModeChanging = false
}) => {
  const { theme, setTheme } = useThemeContext();
  const themeLabelId = useId();
  const themeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleThemeClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const themeValue = e.currentTarget.dataset.theme as Theme | undefined;
    if (themeValue) {
      void setTheme(themeValue);
    }
  }, [setTheme]);

  // WAI-ARIA radio group: the arrows, Home and End move the focus and the selection
  const handleThemeKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { nextIndex = (index + 1) % THEME_OPTIONS.length; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { nextIndex = (index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length; }
    if (e.key === 'Home') { nextIndex = 0; }
    if (e.key === 'End') { nextIndex = THEME_OPTIONS.length - 1; }
    if (nextIndex === null) { return; }

    e.preventDefault();
    themeRefs.current[nextIndex]?.focus();
    void setTheme(THEME_OPTIONS[nextIndex].value);
  };

  return (
    <SettingsSection
      icon={AppearanceIcon}
      title="Appearance"
      description="Customize how the extension looks and behaves"
    >
      <div className="space-y-4">
        {/* Theme Selection */}
        <div className="bg-card rounded-xl p-4 border border-default">
          <h3 id={themeLabelId} className="font-medium text-primary text-sm mb-3">
            Theme
          </h3>
          {/* Segmented control: the chosen theme takes the chosen-item colors. The theme saves on its own
              (ThemeContext), so the Settings save in progress does not lock it */}
          <div role="radiogroup" aria-labelledby={themeLabelId} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-subtle">
            {THEME_OPTIONS.map((option, index) => (
              <button
                key={option.value}
                ref={(el) => { themeRefs.current[index] = el; }}
                type="button"
                role="radio"
                aria-checked={theme === option.value}
                tabIndex={theme === option.value ? 0 : -1}
                data-theme={option.value}
                onClick={handleThemeClick}
                onKeyDown={(e) => { handleThemeKeyDown(e, index); }}
                className={`
                  h-9 rounded-lg border text-sm font-semibold transition-colors focus-interactive cursor-pointer
                  ${theme === option.value
                    ? 'bg-accent-selected border-accent text-accent-strong'
                    : 'border-transparent text-secondary hover:text-primary hover:bg-muted'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interface Mode */}
        <div className="bg-card rounded-xl p-4 border border-default">
          <InterfaceModeSelector
            value={interfaceMode}
            onChange={onInterfaceModeChange}
            disabled={saving}
            loading={interfaceModeChanging}
          />
        </div>
      </div>
    </SettingsSection>
  );
};

export default AppearanceSection;