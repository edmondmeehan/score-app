/** Calendar file (.ics) for a confirmed date. Works with Apple Calendar, Google Calendar and Outlook. */
export type IcsPlan = { id: string; conversation_id: string; place: string; address: string | null; starts_at: string; reservation_at?: string | null;
  reservation_party?: number | null; reservation_name?: string | null; reservation_conf?: string | null };

export function dateIcs(p: IcsPlan, forUser: string, otherName: string | null, site: string): string {
  const start = new Date(p.reservation_at || p.starts_at);
  const end = new Date(start.getTime() + 2 * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const details = [
    otherName ? `Date with ${otherName}` : 'ScoreDate date',
    p.reservation_at ? `Reservation for ${p.reservation_party || 2}${p.reservation_name ? ` under ${p.reservation_name}` : ''}${p.reservation_conf ? ` (conf. ${p.reservation_conf})` : ''}` : '',
    'Meet in public and tell a friend where you’ll be.',
    `${site}/app/messages/${p.conversation_id}`,
  ].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScoreDate//Dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${p.id}-${forUser}@scoredate.app`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`Date${otherName ? ` with ${otherName}` : ''} at ${p.place}`)}`,
    `LOCATION:${esc([p.place, p.address].filter(Boolean).join(', '))}`, `DESCRIPTION:${esc(details)}`,
    `URL:${site}/app/messages/${p.conversation_id}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Date in 2 hours', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
