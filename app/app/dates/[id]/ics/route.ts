import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

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
  const start = new Date(p.reservation_at || p.starts_at);
  const end = new Date(start.getTime() + 2 * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const details = [
    other?.first_name ? `Date with ${other.first_name}` : 'ScoreDate date',
    p.reservation_at ? `Reservation for ${p.reservation_party || 2}${p.reservation_name ? ` under ${p.reservation_name}` : ''}${p.reservation_conf ? ` (conf. ${p.reservation_conf})` : ''}` : '',
    `${site}/app/messages/${p.conversation_id}`,
  ].filter(Boolean).join('\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScoreDate//Dates//EN', 'BEGIN:VEVENT',
    `UID:${p.id}-${user.id}@scoredate.app`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`Date${other?.first_name ? ` with ${other.first_name}` : ''} at ${p.place}`)}`,
    `LOCATION:${esc([p.place, p.address].filter(Boolean).join(', '))}`, `DESCRIPTION:${esc(details)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Date in 2 hours', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="scoredate-date.ics"' } });
}
