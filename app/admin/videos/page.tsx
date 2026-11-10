import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { reviewVideo } from './actions';

export const dynamic = 'force-dynamic';
type Row = { id: string; first_name: string | null; video_path: string; video_seconds: number | null; video_status: string; video_at: string | null };

export default async function Videos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; all?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  let q = supabase.from('profiles').select('id, first_name, video_path, video_seconds, video_status, video_at').not('video_path', 'is', null).order('video_at', { ascending: true }).limit(60);
  if (!sp.all) q = q.eq('video_status', 'pending');
  const { data, error } = await q;
  const rows = (data as Row[]) || [];
  const urls = await Promise.all(rows.map((r) => supabase.storage.from('videos').createSignedUrl(r.video_path, 3600).then((x) => x.data?.signedUrl || null)));
  const when = (d: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '');
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Video clips</h1>
        <Link href={sp.all ? '/admin/videos' : '/admin/videos?all=1'} className="btn ghost sm">{sp.all ? 'Show waiting only' : 'Show all'}</Link>
      </div>
      <span className="small muted">Members’ profile clips (up to 15 seconds). Nobody else sees a clip until it’s approved here. Reject anything explicit, violent, with other people as the focus, contact details, or ads. The member gets a notification either way.</span>
      {error && <div className="notice">Run migration 0057 in the SQL Editor first.</div>}
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {rows.length === 0 && !error && <div className="card small muted">Nothing waiting for review.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {rows.map((r, i) => (
          <div key={r.id} className="card stack" style={{ gap: 8 }}>
            {urls[i] ? <video src={urls[i]!} controls playsInline muted preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} /> : <span className="small muted">Couldn’t load the file.</span>}
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <Link href={`/admin/members/${r.id}`}>{r.first_name || 'Member'}</Link>
              <span className="muted">{r.video_seconds ? `${r.video_seconds}s · ` : ''}{when(r.video_at)} · {r.video_status}</span>
            </div>
            <form action={reviewVideo} className="stack" style={{ gap: 6 }}>
              <input type="hidden" name="user" value={r.id} />
              <input className="input" name="note" placeholder="Note to member if rejecting (optional)" maxLength={200} />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm grow" name="ok" value="1">Approve</button>
                <button className="btn ghost sm grow" name="ok" value="0">Reject</button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
