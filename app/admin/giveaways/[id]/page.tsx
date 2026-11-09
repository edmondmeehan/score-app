import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { REGISTRATION_LIMIT, gwhen, usd, type Giveaway } from '@/lib/giveaways';
import { drawWinners, saveGiveaway, setWinner } from '../actions';

export const dynamic = 'force-dynamic';
const local = (d?: string | null) => (d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T').slice(0, 16) : '');

export default async function EditGiveaway({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { supabase } = await requireStaff();
  const isNew = id === 'new';
  let g: Giveaway | null = null;
  if (!isNew) {
    const { data } = await supabase.from('giveaways').select('*').eq('id', id).maybeSingle();
    g = data as Giveaway | null;
    if (!g) notFound();
  }
  const [{ count: entries }, { data: winners }, { data: bySource }] = isNew ? [{ count: 0 }, { data: [] }, { data: [] }] : await Promise.all([
    supabase.from('giveaway_entries').select('id', { count: 'exact', head: true }).eq('giveaway_id', id),
    supabase.from('giveaway_winners').select('id, status, drawn_at, giveaway_entries(email, first_name, zip, source, user_id)').eq('giveaway_id', id).order('drawn_at'),
    supabase.from('giveaway_entries').select('source').eq('giveaway_id', id).limit(5000),
  ]);
  const web = (bySource || []).filter((r: { source: string }) => r.source === 'web').length;
  const total = g ? Number(g.prize_value_usd) * g.winners_count : 0;
  const ended = g ? Date.now() > new Date(g.ends_at).getTime() : false;
  const defaultEnd = new Date(Date.now() + 14 * 86400000).toISOString();
  return (
    <>
      <Link href="/admin/giveaways" className="small muted">‹ All giveaways</Link>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h1 className="serif" style={{ fontSize: 40 }}>{isNew ? 'New giveaway' : g!.title}</h1>
        {!isNew && <div className="row" style={{ gap: 8 }}><a href={`/giveaways/${id}`} target="_blank" rel="noopener noreferrer" className="btn ghost sm">View page ↗</a><a href={`/giveaways/${id}/rules`} target="_blank" rel="noopener noreferrer" className="btn ghost sm">Rules ↗</a></div>}
      </div>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {total > REGISTRATION_LIMIT && <div className="notice error">Total prizes are {usd(total)}. Over {usd(REGISTRATION_LIMIT)}, New York and Florida require registration and a bond before launch. Lower the value or talk to counsel.</div>}

      {!isNew && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="card stack" style={{ gap: 2 }}><span className="label">Entries</span><span className="serif" style={{ fontSize: 30 }}>{entries || 0}</span><span className="small muted">{web} on the web · {(entries || 0) - web} in the app</span></div>
          <div className="card stack" style={{ gap: 2 }}><span className="label">Status</span><span className="serif" style={{ fontSize: 30, textTransform: 'capitalize' }}>{g!.status}</span><span className="small muted">Ends {gwhen(g!.ends_at)}</span></div>
          <div className="card stack" style={{ gap: 2 }}><span className="label">Total prize value</span><span className="serif" style={{ fontSize: 30 }}>{usd(total)}</span><span className="small muted">{g!.winners_count} winner{g!.winners_count === 1 ? '' : 's'}</span></div>
        </div>
      )}

      {!isNew && (
        <section className="card stack" style={{ gap: 10 }}>
          <strong>Winners</strong>
          {(winners || []).length === 0 ? (
            ended ? <form action={drawWinners}><input type="hidden" name="id" value={id} /><button className="btn sm">Draw {g!.winners_count} winner{g!.winners_count === 1 ? '' : 's'} at random</button></form>
              : <span className="small muted">You can draw winners after it ends on {gwhen(g!.ends_at)}.</span>
          ) : (
            <>
              {(winners as unknown as { id: number; status: string; giveaway_entries: { email: string; first_name: string | null; zip: string | null; source: string; user_id: string | null } }[]).map((w) => (
                <div key={w.id} className="row small" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', borderBottom: '1px solid var(--line-soft)', padding: '6px 0' }}>
                  <span>{w.giveaway_entries.first_name || '—'} · <a href={`mailto:${w.giveaway_entries.email}?subject=${encodeURIComponent(`You won: ${g!.title}`)}`}>{w.giveaway_entries.email}</a> · {w.giveaway_entries.zip} · {w.giveaway_entries.source}{w.giveaway_entries.user_id ? <> · <Link href={`/admin/members/${w.giveaway_entries.user_id}`}>member</Link></> : ''}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="muted" style={{ textTransform: 'capitalize' }}>{w.status}</span>
                    {['claimed', 'forfeited'].filter((s) => s !== w.status).map((s) => (
                      <form key={s} action={setWinner}><input type="hidden" name="id" value={id} /><input type="hidden" name="winner" value={w.id} /><input type="hidden" name="status" value={s} /><button className="btn ghost sm">Mark {s}</button></form>
                    ))}
                  </span>
                </div>
              ))}
              <span className="small muted">Email each winner to claim within 7 days. If someone forfeits, mark it and draw again to pick an alternate.</span>
              {(winners || []).some((w: { status: string }) => w.status === 'forfeited') && <form action={drawWinners}><input type="hidden" name="id" value={id} /><button className="btn ghost sm">Draw an alternate</button></form>}
            </>
          )}
        </section>
      )}

      <form action={saveGiveaway} className="card stack" style={{ gap: 12 }}>
        <input type="hidden" name="id" value={isNew ? '' : id} />
        <label className="field">Title<input className="input" name="title" required maxLength={120} defaultValue={g?.title || ''} placeholder="Win two tickets to Lizzy McAlpine at Radio City" /></label>
        <label className="field">Prize<input className="input" name="prize" required maxLength={300} defaultValue={g?.prize || ''} placeholder="Two tickets to the Dec 12 show" /></label>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="field grow">Value per winner (USD)<input className="input" name="prize_value_usd" type="number" min={0} step="0.01" defaultValue={g?.prize_value_usd ?? 200} /></label>
          <label className="field grow">Number of winners<input className="input" name="winners_count" type="number" min={1} max={20} defaultValue={g?.winners_count ?? 1} /></label>
          <label className="field grow">Partner (optional)<input className="input" name="partner" maxLength={120} defaultValue={g?.partner || ''} /></label>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="field grow">Starts (New York time)<input className="input" name="starts_at" type="datetime-local" required defaultValue={local(g?.starts_at || new Date().toISOString())} /></label>
          <label className="field grow">Ends (New York time)<input className="input" name="ends_at" type="datetime-local" required defaultValue={local(g?.ends_at || defaultEnd)} /></label>
          <label className="field grow">Status
            <select className="input" name="status" defaultValue={g?.status || 'draft'}>
              <option value="draft">Draft (hidden)</option><option value="live">Live</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>{g?.status === 'drawn' && <option value="drawn">Drawn</option>}
            </select>
          </label>
        </div>
        <label className="field">Description<textarea className="input" name="description" rows={3} maxLength={2000} defaultValue={g?.description || ''} /></label>
        <label className="field">Image link (https://, optional)<input className="input" name="image_url" defaultValue={g?.image_url || ''} placeholder="https://…" /></label>
        <label className="field">Who can enter<textarea className="input" name="eligibility" rows={2} maxLength={500} defaultValue={g?.eligibility || 'Open to legal residents of New York, New Jersey and Connecticut who are 25 or older.'} /></label>
        <label className="field">Extra rules (optional, added to the official rules)<textarea className="input" name="extra_rules" rows={3} maxLength={4000} defaultValue={g?.extra_rules || ''} placeholder="e.g. Tickets are for the Dec 12 show only. Winner must be available that date." /></label>
        <span className="small muted">The official rules page is written automatically from these details: no purchase necessary, Apple isn’t a sponsor, free web entry, bonus entries only for free actions, odds, notification and taxes.</span>
        <button className="btn">{isNew ? 'Create giveaway' : 'Save changes'}</button>
      </form>
    </>
  );
}
