/**
 * Application entry point.
 *
 * Mounts the top-level <App /> in <StrictMode> so we can catch any
 * dev-only issues (double effects, deprecated APIs) during
 * development.  Production builds run the same code path.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/global.css';
import { App } from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    React.createElement(React.StrictMode, null, React.createElement(App)),
  );
}
