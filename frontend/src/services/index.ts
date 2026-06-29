/**
 * Service barrel — the single import point for the data layer.
 *
 * `currentAPI` picks between the in-memory `MockAPI` (default) and
 * the real `HttpAPI` based on the `VITE_USE_BACKEND` env var.  See
 * `.env.example` for the full configuration.
 *
 * `currentWSClient` is the realtime companion: when `VITE_USE_BACKEND`
 * is true, this is a live `WsClient` connected to
 * `${VITE_BACKEND_URL}/ws`.  When the flag is false, the field is
 * `null` and the demo script (or the page-level mocks) drive any
 * live UI.
 */

/// <reference types="vite/client" />

import { MockAPI } from './mockApi';
import { HttpAPI } from './httpApi';
import { WsClient, type WsMessageEnvelope, type WsState } from './wsClient';
import type { DataAPI } from './api';

const useBackend = String(import.meta.env.VITE_USE_BACKEND ?? '').toLowerCase() === 'true';
const baseUrl = String(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000');
const wsBaseUrl = baseUrl.replace(/^http/, 'ws');

export const currentAPI: DataAPI = useBackend ? new HttpAPI(baseUrl) : new MockAPI();

/** Live WS client when `VITE_USE_BACKEND=true`; `null` in mock mode. */
export const currentWSClient: WsClient | null = useBackend
  ? new WsClient({ url: wsBaseUrl })
  : null;

/**
 * One-line banner printed at module-load so the developer can see
 * at a glance whether the UI is talking to the real backend or to
 * the in-memory mock.  This is the single most useful diagnostic
 * when the browser console shows CORS errors — if the banner says
 * `data=mock` the frontend is *not* hitting the backend at all
 * (and CORS is irrelevant), and if it says `data=backend <url>`
 * you can immediately tell whether the URL matches the running
 * FastAPI process.
 */
const dataLabel = useBackend ? `backend ${baseUrl}` : 'mock';
// eslint-disable-next-line no-console
console.info(
  `%c[dtm-frontend] data=${dataLabel}  ws=${useBackend ? wsBaseUrl : 'off'}`,
  'color:#5bd17b;font-weight:bold',
);

export { MockAPI, HttpAPI };
export { WsClient };
export type { WsMessageEnvelope, WsState };
export { HttpApiError, HttpNotFoundError } from './httpApi';
export type { DataAPI, ExperimentPreset, IlExperimentInput, AttributionExperimentInput } from './api';

/** Exposed for the App.tsx reachability probe. */
export const backendConfig = Object.freeze({
  useBackend,
  baseUrl,
  wsBaseUrl,
});
