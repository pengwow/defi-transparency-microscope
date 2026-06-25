// Vitest global setup.  Loaded once per test run.
// Add polyfills or global mocks here as the test suite grows.

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount any React components rendered by `@testing-library/react` between
// tests so state never bleeds across cases.
afterEach(() => {
  cleanup();
});
