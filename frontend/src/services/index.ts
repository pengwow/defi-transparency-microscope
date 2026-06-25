/**
 * Service barrel — the single import point for the data layer.
 *
 * `currentAPI` picks between the in-memory `MockAPI` (default) and
 * the real `HttpAPI` based on the `VITE_USE_BACKEND` env var.  See
 * `.env.example` for the full configuration.
 */

/// <reference types="vite/client" />

import { MockAPI } from './mockApi';
import { HttpAPI } from './httpApi';
import type { DataAPI } from './api';

const useBackend = String(import.meta.env.VITE_USE_BACKEND ?? '').toLowerCase() === 'true';
const baseUrl = String(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080');

export const currentAPI: DataAPI = useBackend ? new HttpAPI(baseUrl) : new MockAPI();
export { MockAPI, HttpAPI };
export { HttpApiError, HttpNotFoundError } from './httpApi';
export type { DataAPI, ExperimentPreset, IlExperimentInput, AttributionExperimentInput } from './api';
