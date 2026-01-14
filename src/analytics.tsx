import React from 'react';
import ReactDOM from 'react-dom/client';

import { AnalyticsDashboard } from './components/analytics';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import './popup.css';

/**
 * Analytics page wrapper
 */
function AnalyticsPage(): React.ReactElement {
  const { resolvedTheme } = useThemeContext();

  const handleBack = (): void => {
    // Close the tab when back is clicked
    window.close();
  };

  return (
    <AnalyticsDashboard
      onBack={handleBack}
      isDarkMode={resolvedTheme === 'dark'}
    />
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <AnalyticsPage />
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
