import Link from 'next/link';
import { requireMember } from '@/lib/session';

export const dynamic = 'force-dynamic';

type N = { id: string; kind: string; category: string; title: string; body: string; url: string; read_at: string | null; created_at: string };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
};

export default async function Activity() {
  const { supabase } = await requireMember();
  const { data } = await supabase.from('notifications').select('id, kind, category, title, body, url, read_at, created_at')
    .order('created_at', { ascending: false }).limit(60);
  const items = (data as N[]) || [];
  await supabase.rpc('mark_notifications_read');
  return (
    <div className="phone">
      <div className="row"><h1 className="serif grow" style={{ fontSize: 36 }}>Activity</h1><Link href="/app/settings#notifications" className="small muted">Settings</Link></div>
      {items.length === 0 && <div className="card muted small">Nothing yet. Messages, date plans and reminders show up here.</div>}
      <div className="stack" style={{ gap: 8 }}>
        {items.map((n) => (
          <Link key={n.id} href={n.url.startsWith('/') ? n.url : '/app'} className="card row" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'flex-start', gap: 12 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 8, marginTop: 7, flex: 'none', background: n.read_at ? 'transparent' : 'var(--gold)' }} />
            <span className="stack grow" style={{ gap: 2 }}><strong>{n.title}</strong><span className="small muted">{n.body}</span></span>
            <span className="small muted mono">{ago(n.created_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
