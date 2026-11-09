import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyPass } from '@/lib/memberPass';
import { photoUrls } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/** Staff scanner: verify a member pass, show who it is, and check them in to an event if one is chosen. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff) return NextResponse.json({ ok: false, error: 'Staff only' }, { status: 403 });
  const { token, eventId } = (await req.json().catch(() => ({}))) as { token?: string; eventId?: string };
  const v = verifyPass(String(token || ''));
  if ('error' in v) return NextResponse.json({ ok: false, error: v.error === 'expired' ? 'This pass has expired. Ask them to refresh it (it changes every 30 seconds).' : 'Not a ScoreDate pass.' });
  const { data: p } = await supabase.from('profiles').select('id, first_name, birth_year, status, plan, id_status, photo_status, band, credit_verified_at, is_founder').eq('id', v.userId).maybeSingle();
  if (!p) return NextResponse.json({ ok: false, error: 'Member not found.' });
  const ev = eventId && /^[0-9a-f-]{36}$/.test(eventId) ? eventId : null;
  const [{ data: scan, error }, photos] = await Promise.all([
    supabase.rpc('staff_scan_member', { p_user: p.id, p_event: ev }),
    photoUrls(supabase, [p.id]),
  ]);
  if (error) return NextResponse.json({ ok: false, error: /function|schema/.test(error.message) ? 'Run migration 0041 first.' : error.message });
  return NextResponse.json({
    ok: true,
    member: { ...p, age: p.birth_year ? new Date().getFullYear() - p.birth_year : null, photo: photos[p.id]?.[0] || null },
    scan,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
