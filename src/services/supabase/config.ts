/**
 * Validation of Supabase environment values. Kept pure (env in → result out)
 * so the behavior is fully unit-testable without native modules.
 *
 * MyClassu is offline-first: an unconfigured Supabase is a supported state,
 * not an error. The app stays fully functional; cloud features simply stay
 * unavailable until a `.env` provides real values.
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseConfigResult =
  | { status: 'ready'; config: SupabaseConfig }
  | {
      status: 'unconfigured';
      reason: 'missing_url' | 'missing_publishable_key' | 'invalid_url';
    };

export function resolveSupabaseConfig(env: {
  url?: string;
  publishableKey?: string;
}): SupabaseConfigResult {
  const url = env.url?.trim();
  const publishableKey = env.publishableKey?.trim();

  if (!url) {
    return { status: 'unconfigured', reason: 'missing_url' };
  }
  if (!publishableKey) {
    return { status: 'unconfigured', reason: 'missing_publishable_key' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'unconfigured', reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'unconfigured', reason: 'invalid_url' };
  }

  // Supabase clients append their own paths; strip any trailing slash.
  return {
    status: 'ready',
    config: { url: url.replace(/\/+$/, ''), publishableKey },
  };
}
