import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/server';
import { verifyUnsub } from '@/lib/unsub';

/** One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header. */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const u = url.searchParams.get('u') || '';
  const k = url.searchParams.get('k') || '';
  const s = url.searchParams.get('s') || '';
  if (!verifyUnsub(u, k, s)) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await supabaseAnon().rpc('email_unsubscribe', { p_secret: process.env.SCORE_SERVER_SECRET, p_user: u, p_kind: k });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
