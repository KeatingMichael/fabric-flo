/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Set to `normalized` to use Postgres + RPCs instead of the `user_app_state` JSON blob. */
  readonly VITE_FABRIC_FLO_BACKEND?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_PRIVACY_EMAIL?: string;
  readonly VITE_ACCOUNT_DELETE_EDGE?: string;
  readonly VITE_ACCOUNT_DELETE_FUNCTION?: string;
  readonly VITE_APP_VERSION?: string;
}
