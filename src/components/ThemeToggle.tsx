import type { FC } from 'react';

import { useThemeContext } from '../contexts/ThemeContext';
import { Logger, toError } from '../utils';

const MoonIcon = (
  <svg
    className="w-5 h-5 text-gray-600 dark:text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const SunIcon = (
  <svg
    className="w-5 h-5 text-yellow-500"
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
);

const ThemeToggle: FC = () => {
  const { theme, resolvedTheme, setTheme } = useThemeContext();

  const handleThemeChange = async () => {
    try {
      if (theme === 'system') {
        await setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
      } else {
        await setTheme(theme === 'light' ? 'dark' : 'light');
      }
    } catch (error) {
      Logger.error('Failed to change theme', toError(error));
    }
  };

  return (
    <button
      onClick={() => { void handleThemeChange(); }}
      className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-interactive"
      aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} theme`}
      title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} theme`}
    >
      {resolvedTheme === 'light' ? MoonIcon : SunIcon}
    </button>
  );
};

export default ThemeToggle;
