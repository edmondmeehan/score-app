import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { when, type EventRow } from '@/lib/events';

export const dynamic = 'force-dynamic';

export default async function AdminEvents() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(100);
  const events = (data as EventRow[]) || [];
  const counts = await Promise.all(events.map((e) => supabase.rpc('event_counts', { p_event: e.id }).then((r) => r.data as { going: number; waitlist: number } | null)));
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Events</h1>
        <Link href="/admin/events/new" className="btn sm">New event</Link>
      </div>
      <div className="card scroll-x">
        <table className="data" style={{ minWidth: 720 }}>
          <thead><tr><th>When</th><th>Event</th><th>Venue</th><th>Status</th><th>Going</th><th>Waitlist</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={e.id}>
                <td className="mono small">{when(e.starts_at)}</td>
                <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link></td>
                <td className="muted">{e.venue}</td>
                <td style={{ color: e.status === 'published' ? '#7FC29B' : e.status === 'cancelled' ? '#E58A7A' : 'var(--muted)' }}>{e.status}</td>
                <td className="mono">{counts[i]?.going ?? 0} / {e.capacity}</td>
                <td className="mono muted">{counts[i]?.waitlist ?? 0}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={6} className="muted">No events yet. Create one, save it as a draft, then publish when it&apos;s ready.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
