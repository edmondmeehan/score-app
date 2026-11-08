import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { setCreditMode } from './actions';
import { getCreditMode } from '@/lib/creditMode';
import { spinwheelConfigured } from '@/lib/spinwheel';

export const dynamic = 'force-dynamic';

export default async function Verification({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const mode = await getCreditMode();
  const { count: selfCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).not('band', 'is', null).is('credit_verified_at', null);
  const [{ data: idq }, { data: phq }, { data: recentRows }] = await Promise.all([
    supabase.from('profiles').select('*').in('id_status', ['review', 'pending']).order('created_at').limit(50),
    supabase.from('profiles').select('*').eq('photo_status', 'review').order('created_at').limit(50),
    supabase.from('verifications').select('user_id, kind, provider, created_at').eq('status', 'approved').in('kind', ['id', 'photo']).order('created_at', { ascending: false }).limit(15),
  ]);
  const queue = [...new Map([...((idq || []) as Profile[]), ...((phq || []) as Profile[])].map((p) => [p.id, p])).values()];
  const recent = (recentRows || []) as { user_id: string; kind: string; provider: string; created_at: string }[];
  const ids = [...new Set([...queue.map((p) => p.id), ...recent.map((r) => r.user_id)])];
  const [{ data: sigRows }, { data: photoRows }, { data: nameRows }] = ids.length ? await Promise.all([
    supabase.from('verification_signals').select('user_id, city, country, created_at').in('user_id', ids).order('created_at', { ascending: false }),
    supabase.from('photos').select('user_id, match_similarity').in('user_id', queue.map((p) => p.id)).eq('match_status', 'review'),
    supabase.from('profiles').select('id, first_name, email').in('id', recent.map((r) => r.user_id)),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const sigBy = new Map<string, { city: string | null; country: string | null }>();
  (sigRows || []).forEach((r) => { if (!sigBy.has(r.user_id)) sigBy.set(r.user_id, r); });
  const lowBy = new Map<string, number>();
  (photoRows || []).forEach((r) => { if (r.match_similarity != null) lowBy.set(r.user_id, Math.min(lowBy.get(r.user_id) ?? 100, Number(r.match_similarity))); });
  const names = new Map((nameRows || []).map((r) => [r.id, r.first_name || r.email]));
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Verification</h1>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Credit bands</h2>
          <span className="chip small" style={{ color: mode === 'self' ? 'var(--gold)' : 'var(--rise)' }}>{mode === 'self' ? 'Self-reported' : 'Partner verified'}</span>
        </div>
        <span className="small muted">{mode === 'self'
          ? 'Members pick their own band from a free credit score (Credit Karma, Credit Sesame, their bank). Bands show “self-reported” and the Verified badge reads “ID verified”.'
          : 'Members verify their band with a soft check through the credit partner (Spinwheel). Members who self-reported earlier keep the self-reported label and are asked to verify.'}</span>
        <span className="small muted">{(selfCount ?? 0).toLocaleString('en-US')} member{selfCount === 1 ? '' : 's'} currently have a self-reported band.</span>
        <form action={setCreditMode} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="hidden" name="mode" value={mode === 'self' ? 'verified' : 'self'} />
          <button className="btn ghost sm">{mode === 'self' ? 'Switch to partner verification' : 'Switch to self-reported bands'}</button>
          {mode === 'self' && !spinwheelConfigured() && <span className="small" style={{ color: 'var(--alert)' }}>The credit partner isn’t connected yet, so new members would see the test screen.</span>}
        </form>
      </section>
      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Needs review ({queue.length})</h2>
        <span className="small muted">ID checks Persona flagged or hasn’t finished, and photos that didn’t clearly match the live selfie. Open a case to see the Persona results, IP and location, photo scores and to send feedback.</span>
        {queue.length ? queue.map((p) => {
          const sig = sigBy.get(p.id);
          const low = lowBy.get(p.id);
          return (
            <Link key={p.id} href={`/admin/verification/${p.id}`} className="list-row" style={{ color: 'var(--ivory)', textDecoration: 'none', gap: 10, flexWrap: 'wrap' }}>
              <span className="grow" style={{ minWidth: 140 }}><strong>{p.first_name || p.email}</strong>{p.birth_year ? <span className="muted">, {new Date().getFullYear() - p.birth_year}</span> : null}<span className="small muted"> · {p.zip || 'no zip'}</span></span>
              {['review', 'pending'].includes(p.id_status) && <span className="chip small" style={{ color: 'var(--gold)' }}>ID {p.id_status}</span>}
              {p.photo_status === 'review' && <span className="chip small" style={{ color: 'var(--gold)' }}>Photos{low != null ? ` · ${low}%` : ''}</span>}
              {sig && <span className="small muted">{[sig.city, sig.country].filter(Boolean).join(', ')}{sig.country && sig.country !== 'US' ? ' ⚠' : ''}</span>}
              <span className="small muted">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ›</span>
            </Link>
          );
        }) : <span className="small muted">Nothing waiting.</span>}
      </section>
      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recently verified</h2>
        <span className="small muted">Spot-check automatic approvals. Open any case for full details.</span>
        {recent.length ? recent.map((r) => (
          <Link key={r.user_id + r.created_at} href={`/admin/verification/${r.user_id}`} className="list-row" style={{ color: 'var(--ivory)', textDecoration: 'none' }}>
            <span className="grow">{names.get(r.user_id) || 'Member'}</span>
            <span className="small muted">{r.kind === 'id' ? `ID · ${r.provider}` : 'Photo match'} · {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ›</span>
          </Link>
        )) : <span className="small muted">None yet.</span>}
      </section>
    </>
  );
}
