import { FC, useCallback } from 'react';

import { useThemeContext, Theme } from '../../contexts/ThemeContext';
import InterfaceModeSelector from '../InterfaceModeSelector';

import SettingsSection from './SettingsSection';

// Hoisted static JSX - avoids recreation on every render
const AppearanceIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const LightThemeIcon = (
  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
);

const DarkThemeIcon = (
  <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const SystemThemeIcon = (
  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ThemeCheckIcon = (
  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

// Theme options configuration with hoisted icons
const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: LightThemeIcon },
  { value: 'dark' as const, label: 'Dark', icon: DarkThemeIcon },
  { value: 'system' as const, label: 'System', icon: SystemThemeIcon }
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

  const handleThemeClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const themeValue = e.currentTarget.dataset.theme as Theme | undefined;
    if (themeValue) {
      void setTheme(themeValue);
    }
  }, [setTheme]);

  return (
    <SettingsSection
      icon={AppearanceIcon}
      title="Appearance"
      description="Customize how the extension looks and behaves"
    >
      <div className="space-y-4">
        {/* Theme Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
            Theme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                data-theme={option.value}
                onClick={handleThemeClick}
                disabled={saving}
                className={`
                  relative p-3 rounded-lg border-2 transition-all duration-200
                  ${theme === option.value
                    ? 'border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600'
                  }
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex justify-center mb-2">{option.icon}</div>
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </div>
                {theme === option.value && (
                  <div className="absolute top-1 right-1">
                    <div className="w-4 h-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
                      {ThemeCheckIcon}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Interface Mode */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
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