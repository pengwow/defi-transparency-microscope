/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * When "true" the app talks to the real backend via HttpAPI.
   * Default: false (use MockAPI).
   */
  readonly VITE_USE_BACKEND?: string;

  /**
   * Base URL for the dtm-backend service.  Used only when
   * VITE_USE_BACKEND=true.  Default: http://localhost:8000.
   */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
