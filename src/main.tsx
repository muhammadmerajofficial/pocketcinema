// Ensure window.fetch has both getter and setter in iframe environments
try {
  if (typeof window !== 'undefined' && window.fetch) {
    let _fetch = window.fetch.bind(window);
    Object.defineProperty(window, 'fetch', {
      get: () => _fetch,
      set: (fn) => {
        _fetch = fn;
      },
      configurable: true,
      enumerable: true,
    });
  }
} catch {
  // Ignore
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
