import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './popup.css';
import './sidepanel.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App context="sidepanel" />
    </React.StrictMode>
  );
}