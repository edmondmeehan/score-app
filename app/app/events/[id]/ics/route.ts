import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { EventRow } from '@/lib/events';

/** Calendar file for an event you're going to (the address is only included for people going). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/signin', process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app'));
  const [{ data }, { data: mine }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase.from('event_rsvps').select('status').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  const e = data as EventRow | null;
  if (!e || mine?.status !== 'going') return new NextResponse('Not found', { status: 404 });
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 3 * 3600000).toISOString();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app').replace(/\/$/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScoreDate//Events//EN', 'BEGIN:VEVENT',
    `UID:${e.id}@scoredate.app`, `DTSTAMP:${fmt(new Date().toISOString())}`, `DTSTART:${fmt(e.starts_at)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.title)}`, `LOCATION:${esc([e.venue, e.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc(`ScoreDate members event. Details: ${site}/app/events/${e.id}`)}`, `URL:${site}/app/events/${e.id}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="scoredate-event.ics"` } });
}
