// Vitest global setup.  Loaded once per test run.
// Add polyfills or global mocks here as the test suite grows.

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver (used by ECharts-driven components).
// jsdom does not implement it; this no-op stub is enough for the
// useEffect to mount without throwing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  } as unknown as typeof ResizeObserver;
}

// Polyfill matchMedia (some ECharts paths may consult it).
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Unmount any React components rendered by `@testing-library/react` between
// tests so state never bleeds across cases.
afterEach(() => {
  cleanup();
});
