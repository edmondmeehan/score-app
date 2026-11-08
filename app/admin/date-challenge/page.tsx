import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

type E = { id: string; title: string; spent: number; story: string; share_ok: boolean; status: string; created_at: string; user_id: string };

async function setStatus(form: FormData) {
  'use server';
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_set_challenge_status', { p_id: String(form.get('id')), p_status: String(form.get('status')) });
  if (error) redirect('/admin/date-challenge?error=' + encodeURIComponent(error.message));
  revalidatePath('/admin/date-challenge');
  redirect('/admin/date-challenge');
}

export default async function DateChallenge({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from('date_challenge_entries').select('*').order('created_at', { ascending: false }).limit(200);
  const rows = (data as E[]) || [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, first_name').in('id', ids) : { data: [] };
  const name = Object.fromEntries((people || []).map((p: { id: string; first_name: string | null }) => [p.id, p.first_name]));
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>$50 Date Challenge</h1>
      <span className="small muted">Stories members shared after a $50 Date Challenge. Only entries marked “OK to feature” can be featured, using first names only.</span>
      {(sp.error || (error && /relation|schema cache/i.test(error.message))) && <div className="notice error">{sp.error || 'Run migration 0026 in the Score SQL Editor first.'}</div>}
      {rows.length === 0 && <div className="card small muted">No entries yet.</div>}
      {rows.map((r) => (
        <div key={r.id} className="card stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <strong>{r.title}</strong>
            <span className="small"><span style={{ color: 'var(--rise)' }}>${Number(r.spent).toFixed(2)}</span> · {name[r.user_id] || 'Member'} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.story}</p>
          <div className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="chip">{r.share_ok ? 'OK to feature' : 'Private'}</span>
            <span className="chip">{r.status}</span>
            <form action={setStatus} className="row" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={r.id} />
              {r.share_ok && r.status !== 'featured' && <button className="btn ghost sm" name="status" value="featured">Feature</button>}
              {r.status !== 'hidden' && <button className="btn ghost sm" name="status" value="hidden">Hide</button>}
              {r.status !== 'pending' && <button className="btn ghost sm" name="status" value="pending">Reset</button>}
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
