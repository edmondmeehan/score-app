import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** For the admin toolbar: is the signed-in person staff, and (optionally) the member they're looking at. */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const none = NextResponse.json({ staff: false }, { headers: { 'Cache-Control': 'no-store' } });
  if (!user) return none;
  const { data: isStaff } = await supabase.rpc('is_staff');
  if (!isStaff) return none;
  const { data: email } = await supabase.rpc('staff_email');
  const id = new URL(req.url).searchParams.get('user');
  let target = null;
  if (id && /^[0-9a-f-]{36}$/i.test(id) && id !== user.id) {
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, status, id_status, photo_status').eq('id', id).maybeSingle(),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_id', id).eq('status', 'open'),
    ]);
    if (p) target = { ...p, open_reports: count || 0 };
  }
  const { data: m } = await supabase.from('app_config').select('value').eq('key', 'maintenance').maybeSingle();
  return NextResponse.json({ staff: true, email, target, maintenance: Boolean(m?.value?.on) }, { headers: { 'Cache-Control': 'no-store' } });
}
