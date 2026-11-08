import 'server-only';
import { headers } from 'next/headers';
import { supabaseAnon } from '@/lib/supabase/server';

/** Record IP, approximate location (from Vercel's edge) and device at a verification step. Staff-only, kept 180 days. Never throws. */
export async function recordSignal(userId: string, step: 'signup' | 'id_start' | 'photos') {
  try {
    const h = await headers();
    const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : null; } catch { return v; } };
    const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
    await supabaseAnon().rpc('record_verification_signal', {
      p_secret: process.env.SCORE_SERVER_SECRET, p_user: userId, p_step: step,
      p_ip: (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || null,
      p_city: dec(h.get('x-vercel-ip-city')), p_region: h.get('x-vercel-ip-country-region'), p_country: h.get('x-vercel-ip-country'),
      p_lat: num(h.get('x-vercel-ip-latitude')), p_lng: num(h.get('x-vercel-ip-longitude')),
      p_ua: h.get('user-agent'),
    });
  } catch (e) {
    console.error('[signals]', (e as Error).message);
  }
}
