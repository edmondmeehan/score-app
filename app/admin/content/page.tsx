import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { KIND_LABEL, day, type Post } from '@/lib/content';
import { reviewStory, setInquiry } from './actions';

export const dynamic = 'force-dynamic';

type StoryRow = { id: string; headline: string; story: string; partner_first_name: string | null; show_names: boolean; partner_consent: boolean; status: string; created_at: string; user_id: string };
type Inquiry = { id: string; name: string; company: string; email: string; kind: string; website: string | null; message: string; status: string; created_at: string };

export default async function Content({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'stories' ? 'stories' : sp.tab === 'partners' ? 'partners' : 'posts';
  const supabase = await supabaseServer();
  const [{ data: posts, error }, { data: stories }, { data: inquiries }] = await Promise.all([
    supabase.from('content_posts').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('success_stories').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('partner_inquiries').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const st = (stories as StoryRow[]) || [];
  const iq = (inquiries as Inquiry[]) || [];
  const list = ((posts as Post[]) || []).filter((p) => !sp.kind || p.kind === sp.kind);
  const pending = st.filter((s) => s.status === 'pending').length;
  const fresh = iq.filter((i) => i.status === 'new').length;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Content</h1>
        <Link href="/admin/content/new" className="btn sm">New post</Link>
      </div>
      {error && <div className="notice error">Run migration 0010 in Supabase to turn on Discover. ({error.message})</div>}
      <span className="small muted">Everything here shows in the app&apos;s Discover tab. News: link to the original article and write your own one-line take; don&apos;t paste articles.</span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/admin/content" className={tab === 'posts' ? 'btn sm' : 'btn ghost sm'}>Tips, news & perks</Link>
        <Link href="/admin/content?tab=stories" className={tab === 'stories' ? 'btn sm' : 'btn ghost sm'}>Stories{pending ? ` · ${pending}` : ''}</Link>
        <Link href="/admin/content?tab=partners" className={tab === 'partners' ? 'btn sm' : 'btn ghost sm'}>Partner inquiries{fresh ? ` · ${fresh}` : ''}</Link>
      </div>

      {tab === 'posts' && (
        <>
          <div className="row small" style={{ gap: 14, flexWrap: 'wrap' }}>
            <Link href="/admin/content">All</Link>
            {(Object.keys(KIND_LABEL) as Post['kind'][]).map((k) => <Link key={k} href={`/admin/content?kind=${k}`}>{KIND_LABEL[k]}</Link>)}
          </div>
          <div className="card scroll-x"><table className="data" style={{ minWidth: 640 }}>
            <thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Published</th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}>
                <td className="muted small">{KIND_LABEL[p.kind]}{p.pinned ? ' · pinned' : ''}</td>
                <td><Link href={`/admin/content/${p.id}`}>{p.title}</Link></td>
                <td style={{ color: p.status === 'published' ? 'var(--rise)' : 'var(--muted)' }}>{p.status}</td>
                <td className="mono small muted">{day(p.published_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      )}

      {tab === 'stories' && (
        <div className="stack">
          {st.length === 0 && <div className="notice">No stories yet. Members submit them from Discover → Success stories.</div>}
          {st.map((s) => (
            <div key={s.id} className="card stack" style={{ gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{s.headline}</strong>
                <span className="small" style={{ color: s.status === 'approved' ? 'var(--rise)' : s.status === 'rejected' ? 'var(--alert)' : 'var(--gold)' }}>{s.status}</span>
              </div>
              <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.story}</p>
              <span className="small muted">
                {day(s.created_at)} · member {s.user_id.slice(0, 8)}{s.partner_first_name ? ` · with ${s.partner_first_name}` : ''} · names {s.show_names && s.partner_consent ? 'shown' : s.show_names ? 'hidden (partner hasn’t agreed)' : 'hidden'}
              </span>
              <div className="row" style={{ gap: 8 }}>
                {s.status !== 'approved' && <form action={reviewStory}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="approved" /><button className="btn sm">Feature</button></form>}
                {s.status !== 'rejected' && <form action={reviewStory}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="rejected" /><button className="btn ghost sm">{s.status === 'approved' ? 'Take down' : 'Don’t feature'}</button></form>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'partners' && (
        <div className="stack">
          <span className="small muted">From the public form at <a href="/partners" target="_blank">scoredate.app/partners</a>.</span>
          {iq.length === 0 && <div className="notice">No inquiries yet.</div>}
          {iq.map((i) => (
            <div key={i.id} className="card stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <strong>{i.company} <span className="muted small">· {i.kind}</span></strong>
                <span className="small" style={{ color: i.status === 'new' ? 'var(--gold)' : 'var(--muted)' }}>{i.status}</span>
              </div>
              <span className="small">{i.name} · <a href={`mailto:${i.email}`}>{i.email}</a>{i.website ? <> · {i.website}</> : null}</span>
              <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{i.message}</p>
              <div className="row" style={{ gap: 8 }}>
                {(['contacted', 'closed'] as const).filter((x) => x !== i.status).map((x) => (
                  <form key={x} action={setInquiry}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value={x} /><button className="btn ghost sm">Mark {x}</button></form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
