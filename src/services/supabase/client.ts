import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './database.types';
import { resolveSupabaseConfig, type SupabaseConfig } from './config';
import { readSupabaseEnv } from './env';

/**
 * The single Supabase client for the whole app. Nothing else may call
 * `createClient` — cloud access goes through this module so configuration,
 * storage and (later) auth handling stay in one place.
 *
 * Offline-first: when no `.env` configuration is present, `getSupabaseClient`
 * returns null and the app keeps working purely on local data. Callers must
 * handle the null case instead of assuming connectivity.
 */

export type TypedSupabaseClient = SupabaseClient<Database>;

let cachedClient: TypedSupabaseClient | null = null;

export function createSupabaseClient(
  config: SupabaseConfig,
): TypedSupabaseClient {
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Deep links with session info are not used on Android.
      detectSessionInUrl: false,
    },
  });
}

/** The configured client, or null when Supabase is not set up on this device. */
export function getSupabaseClient(): TypedSupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }
  const result = resolveSupabaseConfig(readSupabaseEnv());
  if (result.status !== 'ready') {
    return null;
  }
  cachedClient = createSupabaseClient(result.config);
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return resolveSupabaseConfig(readSupabaseEnv()).status === 'ready';
}
