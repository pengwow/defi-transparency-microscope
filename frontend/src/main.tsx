/**
 * Application entry point.
 *
 * Renders a minimal placeholder while the rest of the UI components
 * are being assembled.  Real pages are mounted in later phases; for
 * now this is enough to load the global stylesheet and verify that
 * Vite + React boot up.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/global.css';

function Placeholder() {
  return React.createElement(
    'div',
    { style: { padding: 24, fontFamily: 'system-ui, sans-serif' } },
    React.createElement('h1', null, 'DTM - DeFi Transparency Microscope'),
    React.createElement('p', { className: 'muted' }, 'Loading...'),
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    React.createElement(React.StrictMode, null, React.createElement(Placeholder)),
  );
}
