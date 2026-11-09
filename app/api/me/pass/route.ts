import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { passToken } from '@/lib/memberPass';

export const dynamic = 'force-dynamic';

/** The signed-in member's current pass token (changes every 30 seconds). */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('status').eq('id', user.id).single();
  if (!me || ['suspended', 'removed'].includes(me.status)) return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  return NextResponse.json(passToken(user.id), { headers: { 'Cache-Control': 'no-store' } });
}
