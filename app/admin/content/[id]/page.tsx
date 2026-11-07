import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { KIND_LABEL, type Post } from '@/lib/content';
import { savePost, deletePost } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; kind?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const p = id === 'new' ? null : ((await supabase.from('content_posts').select('*').eq('id', id).maybeSingle()).data as Post | null);
  const kind = p?.kind || (sp.kind as Post['kind']) || 'credit_tip';
  return (
    <>
      <Link href="/admin/content" className="small">‹ Content</Link>
      <h1 className="serif" style={{ fontSize: 40 }}>{p ? 'Edit post' : 'New post'}</h1>
      {sp.saved && <div className="notice test">Saved.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <form action={savePost} className="card stack" style={{ gap: 14, maxWidth: 720 }}>
        <input type="hidden" name="id" value={p?.id || ''} />
        <label className="field">Type
          <select className="input" name="kind" defaultValue={kind}>
            {(Object.keys(KIND_LABEL) as Post['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="field">Title<input className="input" name="title" defaultValue={p?.title || ''} maxLength={140} required /></label>
        <label className="field">Body<textarea className="input" name="body" rows={7} defaultValue={p?.body || ''} maxLength={4000} />
          <span className="small muted">For news, write your own short take on why it matters to members. Don&apos;t paste the article.</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <label className="field">Link (https://)<input className="input" name="url" defaultValue={p?.url || ''} placeholder="Article, perk or booking link" /></label>
          <label className="field">Source (news)<input className="input" name="source_name" defaultValue={p?.source_name || ''} placeholder="The New York Times" /></label>
          <label className="field">Partner (perks)<input className="input" name="partner_name" defaultValue={p?.partner_name || ''} placeholder="Bar Pisellino" /></label>
          <label className="field">Perk code<input className="input" name="perk_code" defaultValue={p?.perk_code || ''} placeholder="SCORE10" /></label>
        </div>
        <label className="row small"><input type="checkbox" name="pinned" defaultChecked={p?.pinned} /> Pin to the top of its section</label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" name="status" value="published">Publish</button>
          <button className="btn ghost" name="status" value="draft">Save as draft</button>
        </div>
      </form>
      {p && <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn danger sm">Delete post</button></form>}
    </>
  );
}
