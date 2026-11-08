import type { Metadata } from 'next';
import { Gauge } from '@/components/ui';
import { supabaseAnon } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Date plan · ScoreDate', robots: { index: false, follow: false } };

type Share = { member: string; match: string; match_age: number | null; place: string; address: string | null; starts_at: string; status: string; checkin: string | null; checkin_at: string | null };

const CHECKIN: Record<string, string> = { safe: 'Checked in: all good', not_great: 'Checked in: it wasn’t great, but they’re home', report: 'Checked in: they reported a problem to ScoreDate' };

export default async function DateShare({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = /^[0-9a-f]{36}$/.test(token) ? await supabaseAnon().rpc('view_date_share', { p_token: token }) : { data: null };
  const s = data as Share | null;
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 12 }}><Gauge size={52} label="ScoreDate" /><span className="mono small" style={{ letterSpacing: '.28em' }}>SCOREDATE</span></div>
      {!s ? (
        <div className="card stack" style={{ textAlign: 'center' }}>
          <span className="serif" style={{ fontSize: 26 }}>This link has expired.</span>
          <span className="small muted">Date plan links turn off the day after the date, or when the member turns them off.</span>
        </div>
      ) : (
        <div className="card gold stack" style={{ gap: 10 }}>
          <span className="label">{s.member}&apos;s date plan</span>
          <span className="serif" style={{ fontSize: 30 }}>{s.place}</span>
          <span>{new Date(s.starts_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} (New York time)</span>
          {s.address && <a href={`https://maps.apple.com/?q=${encodeURIComponent(`${s.place} ${s.address}`)}`} target="_blank" rel="noopener noreferrer">{s.address} ↗</a>}
          <span className="small muted">With {s.match}{s.match_age ? `, ${s.match_age}` : ''}. Every ScoreDate member has verified their ID.</span>
          {s.status === 'cancelled' && <div className="notice">This date was cancelled.</div>}
          <div className="notice" style={{ margin: 0 }}>{s.checkin ? CHECKIN[s.checkin] : `${s.member} hasn’t checked in yet. ScoreDate asks them about two hours after the date starts.`}</div>
          <span className="small muted">If you think {s.member} is in danger, call 911.</span>
        </div>
      )}
    </div>
  );
}
