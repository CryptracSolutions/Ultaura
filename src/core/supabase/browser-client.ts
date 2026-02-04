import { createBrowserClient } from '@supabase/ssr';

import invariant from 'tiny-invariant';
import type { Database } from '~/database.types';

let client: ReturnType<typeof createBrowserClient<Database>>;

function resolveSupabaseUrlForBrowser(supabaseUrl: string) {
  // When accessing the Next dev server from another device (e.g. via LAN IP),
  // `127.0.0.1`/`localhost` would point to *that* device, not this machine.
  // In dev, rewrite loopback Supabase URLs to the current hostname so auth works.
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return supabaseUrl;
  }

  try {
    const url = new URL(supabaseUrl);

    const loopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
    const currentHost = window.location.hostname;

    if (loopbackHosts.has(url.hostname) && !loopbackHosts.has(currentHost)) {
      url.hostname = currentHost;

      // Avoid trailing slash differences in logs and string comparisons.
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // If it isn't a valid URL, don't guess.
  }

  return supabaseUrl;
}

/**
 * @name getSupabaseBrowserClient
 * @description Get a Supabase client for use in the Browser
 */
function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  invariant(SUPABASE_URL, `Supabase URL was not provided`);
  invariant(SUPABASE_ANON_KEY, `Supabase Anon key was not provided`);

  client = createBrowserClient<Database>(
    resolveSupabaseUrlForBrowser(SUPABASE_URL),
    SUPABASE_ANON_KEY,
  );

  return client;
}

export default getSupabaseBrowserClient;
