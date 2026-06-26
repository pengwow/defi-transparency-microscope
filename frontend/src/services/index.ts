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

export { MockAPI, HttpAPI };
export { WsClient };
export type { WsMessageEnvelope, WsState };
export { HttpApiError, HttpNotFoundError } from './httpApi';
export type { DataAPI, ExperimentPreset, IlExperimentInput, AttributionExperimentInput } from './api';
