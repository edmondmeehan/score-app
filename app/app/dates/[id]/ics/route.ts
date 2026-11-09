import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { dateIcs } from '@/lib/ics';

/** Calendar file for a confirmed date. Only the two people in the conversation can open it (row-level security). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '');
  if (!user) return NextResponse.redirect(`${site}/signin`);
  const { data: p } = await supabase.from('date_plans').select('*').eq('id', id).maybeSingle();
  if (!p || p.status !== 'accepted') return new NextResponse('Not found', { status: 404 });
  const { data: conv } = await supabase.from('conversations').select('user_a, user_b').eq('id', p.conversation_id).maybeSingle();
  const otherId = conv ? (conv.user_a === user.id ? conv.user_b : conv.user_a) : null;
  const { data: other } = otherId ? await supabase.from('profiles').select('first_name').eq('id', otherId).maybeSingle() : { data: null };
  const ics = dateIcs(p, user.id, other?.first_name || null, site);
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="scoredate-date.ics"' } });
}
