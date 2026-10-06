/**
 * Supabase configuration behavior. The client module is the only place that
 * may construct a Supabase client; these tests pin its contract:
 * unconfigured → null (offline-first), configured → a single shared client.
 */

jest.mock('react-native-config', () => ({}));

// The URL polyfill ships ESM and is a no-op under Node; keep it out of jest.
jest.mock('react-native-url-polyfill/auto', () => ({}));

// Minimal storage mock — createClient only stores the reference; no auth
// storage method runs during client construction.
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    getAllKeys: jest.fn(async () => []),
    multiRemove: jest.fn(async () => undefined),
  };
  return { __esModule: true, default: storage };
});

import Config from 'react-native-config';
import { resolveSupabaseConfig } from './config';

const configModule = Config as Record<string, string | undefined>;

describe('resolveSupabaseConfig', () => {
  it('reports missing_url when no URL is set', () => {
    expect(resolveSupabaseConfig({})).toEqual({
      status: 'unconfigured',
      reason: 'missing_url',
    });
  });

  it('reports missing_publishable_key when only a URL is set', () => {
    expect(resolveSupabaseConfig({ url: 'https://x.supabase.co' })).toEqual({
      status: 'unconfigured',
      reason: 'missing_publishable_key',
    });
  });

  it('reports invalid_url for a non-URL value', () => {
    expect(
      resolveSupabaseConfig({ url: 'not-a-url', publishableKey: 'k' }).status,
    ).toBe('unconfigured');
  });

  it('reports invalid_url for a non-http(s) protocol', () => {
    expect(
      resolveSupabaseConfig({ url: 'ftp://x.supabase.co', publishableKey: 'k' })
        .status,
    ).toBe('unconfigured');
  });

  it('accepts a valid URL and strips the trailing slash', () => {
    const result = resolveSupabaseConfig({
      url: 'https://x.supabase.co/',
      publishableKey: 'k',
    });
    expect(result).toEqual({
      status: 'ready',
      config: { url: 'https://x.supabase.co', publishableKey: 'k' },
    });
  });

  it('trims whitespace around values', () => {
    const result = resolveSupabaseConfig({
      url: '  https://x.supabase.co  ',
      publishableKey: '  k  ',
    });
    expect(result.status).toBe('ready');
  });
});

describe('supabase client configuration behavior', () => {
  const loadClientModule = () => {
    let mod!: typeof import('./client');
    jest.isolateModules(() => {
      mod = require('./client');
    });
    return mod;
  };

  beforeEach(() => {
    delete configModule.SUPABASE_URL;
    delete configModule.SUPABASE_PUBLISHABLE_KEY;
  });

  it('returns null (and stays functional) when Supabase is not configured', () => {
    const { getSupabaseClient, isSupabaseConfigured } = loadClientModule();
    expect(getSupabaseClient()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('creates a client when the environment is configured', () => {
    configModule.SUPABASE_URL = 'https://x.supabase.co';
    configModule.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

    const { getSupabaseClient, isSupabaseConfigured } = loadClientModule();
    const client = getSupabaseClient();
    expect(client).not.toBeNull();
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('returns the same singleton instance on repeated calls', () => {
    configModule.SUPABASE_URL = 'https://x.supabase.co';
    configModule.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

    const { getSupabaseClient } = loadClientModule();
    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });
});
