/**
 * Service-layer barrel.
 *
 * Exports `currentAPI`, a single `DataAPI` instance chosen at module
 * load time based on Vite env vars:
 *
 *   - `VITE_USE_BACKEND === 'true'`  → `HttpAPI` (real backend)
 *   - otherwise                       → `MockAPI`  (default, safe)
 *
 * The base URL for the real backend is read from `VITE_BACKEND_URL`
 * (default `http://localhost:8000`).  Both env vars are configured in
 * `frontend/.env.example`.
 *
 * The selection happens once at import time so all consumers in the
 * app share the same instance.  Switching backends therefore means
 * restarting the dev server (or rebuilding) — there is no runtime
 * toggle by design, since the URL is hot-baked into the bundle.
 */

import type { DataAPI } from './api';
import { MockAPI } from './mockApi';
import { HttpAPI } from './httpApi';

const useBackend = import.meta.env.VITE_USE_BACKEND === 'true';
const baseUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export const currentAPI: DataAPI = useBackend
  ? new HttpAPI({ baseUrl })
  : new MockAPI();

export type { DataAPI };
export { MockAPI, HttpAPI };
