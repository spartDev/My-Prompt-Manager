import React, { useCallback } from 'react';
import ReactDOM from 'react-dom/client';

import { AnalyticsDashboard } from './components/analytics';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import './popup.css';

/**
 * Analytics page wrapper
 */
function AnalyticsPage(): React.ReactElement {
  const handleBack = useCallback((): void => {
    // Close the tab when back is clicked
    window.close();
  }, []);

  return (
    <AnalyticsDashboard onBack={handleBack} />
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
