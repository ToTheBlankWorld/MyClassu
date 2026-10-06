import Config from 'react-native-config';

/**
 * Raw environment access for Supabase settings. Values come from `.env` at
 * the project root (loaded at build time by react-native-config). Only the
 * URL and the PUBLISHABLE key ever live here — database passwords and
 * service-role keys must never be placed in the mobile app.
 */

export interface SupabaseEnv {
  url?: string;
  publishableKey?: string;
}

export function readSupabaseEnv(): SupabaseEnv {
  const source = (Config ?? {}) as Record<string, string | undefined>;
  return {
    url: source.SUPABASE_URL,
    publishableKey: source.SUPABASE_PUBLISHABLE_KEY,
  };
}
