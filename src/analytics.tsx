import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { AnalyticsDashboard } from './components/analytics';
import ErrorBoundary from './components/ErrorBoundary';
import './popup.css';

/**
 * Detect if dark mode is enabled
 */
function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') { return false; }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => { mediaQuery.removeEventListener('change', handler); };
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return isDark;
}

/**
 * Analytics page wrapper
 */
function AnalyticsPage(): React.ReactElement {
  const isDarkMode = useDarkMode();

  const handleBack = (): void => {
    // Close the tab when back is clicked
    window.close();
  };

  return (
    <AnalyticsDashboard
      onBack={handleBack}
      isDarkMode={isDarkMode}
    />
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AnalyticsPage />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
