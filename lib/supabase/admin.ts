import { createClient } from '@supabase/supabase-js';

/**
 * Server-only client with the Supabase service role key (Vercel env SUPABASE_SERVICE_ROLE_KEY).
 * Used only by the cron job to delete expired voice notes from storage. Returns null if the key isn't set.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
