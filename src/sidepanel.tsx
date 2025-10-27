import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './assets/popup.css';
import './assets/sidepanel.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App context="sidepanel" />
    </React.StrictMode>
  );
}