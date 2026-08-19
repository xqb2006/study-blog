import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  void fetch('/api/admin/session')
    .then((response) => response.json())
    .then((session) => {
      if (!session.authenticated) {
        window.location.assign('/api/admin/login');
        return;
      }
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      );
    })
    .catch(() => window.location.assign('/api/admin/login'));
}
