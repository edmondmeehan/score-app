import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { createInvites, emailInvite, inviteBatch, resendInvite, setAreaStatus, setPrefix, setZip } from '../actions';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
type AreaRow = { name: string; status: 'open' | 'waitlist'; waiting: number; invited: number; joined: number };
type ZipRow = { area: string; zip: string; sub: string; waiting: number; total: number };

export default async function Waitlist({ searchParams }: { searchParams: Promise<{ codes?: string; error?: string; zip_saved?: string; invited?: string; area?: string; zip?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  let q = supabase.from('waitlist').select('*').order('created_at', { ascending: false }).limit(200);
  if (sp.area) q = q.eq('area', sp.area);
  if (sp.zip) q = q.eq('zip', sp.zip);
  const [{ data: rows }, { data: summary, error: sumErr }, { count: zipCount }] = await Promise.all([
    q,
    supabase.rpc('staff_waitlist_summary'),
    supabase.from('nyc_zip_codes').select('zip', { count: 'exact', head: true }).eq('active', true),
  ]);
  const areas: AreaRow[] = summary?.areas || [];
  const zips: ZipRow[] = (summary?.zips || []).filter((z: ZipRow) => !sp.area || z.area === sp.area);
  const codes = sp.codes ? sp.codes.split(',') : [];
  const waitingTotal = areas.reduce((s, a) => s + a.waiting, 0);

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Waitlist &amp; invites</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.invited && <div className="notice">{sp.invited}</div>}
      {sp.zip_saved && <div className="notice">Saved zip {sp.zip_saved}.</div>}
      {sumErr && <div className="notice error">Run migration 0005 in Supabase to turn on areas. ({sumErr.message})</div>}
      {codes.length > 0 && <div className="card stack"><span className="label">New codes (valid 14 days)</span><pre className="mono small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{codes.join('\n')}</pre></div>}

      {/* Areas */}
      <section className="card scroll-x">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Areas · {waitingTotal.toLocaleString()} waiting</h2>
          <span className="small muted">Everyone can join. You decide which areas get invites.</span>
        </div>
        <table className="data" style={{ minWidth: 760 }}>
          <thead><tr><th>Area</th><th>Status</th><th>Waiting</th><th>Invited</th><th>Joined</th><th>Invite the next…</th><th></th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.name}>
                <td><Link href={`/admin/waitlist?area=${encodeURIComponent(a.name)}`} style={{ fontWeight: sp.area === a.name ? 600 : 400 }}>{a.name}</Link></td>
                <td style={{ color: a.status === 'open' ? 'var(--rise)' : 'var(--muted)' }}>{a.status === 'open' ? 'Open' : 'Opening soon'}</td>
                <td className="mono">{a.waiting.toLocaleString()}</td><td className="mono muted">{a.invited.toLocaleString()}</td><td className="mono muted">{a.joined.toLocaleString()}</td>
                <td>
                  {a.waiting > 0 && (
                    <form action={inviteBatch} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="area" value={a.name} />
                      <input className="input" type="number" name="count" min={1} max={500} defaultValue={Math.min(a.waiting, 50)} style={{ width: 80, padding: '6px 8px' }} />
                      <button className="btn sm">Send invites</button>
                    </form>
                  )}
                </td>
                <td>
                  <form action={setAreaStatus}>
                    <input type="hidden" name="name" value={a.name} />
                    <input type="hidden" name="status" value={a.status === 'open' ? 'waitlist' : 'open'} />
                    <button className="btn ghost sm">{a.status === 'open' ? 'Mark opening soon' : 'Mark open'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ margin: '10px 0 0' }}>“Open” only changes what people see when they join (“you’re on the list” vs. “opening soon”). Nobody gets in until you send invites.</p>
      </section>

      {/* Zips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section className="card scroll-x" style={{ flex: '2 1 460px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Top zip codes{sp.area ? ` · ${sp.area}` : ''}</h2>
            {sp.area && <Link href="/admin/waitlist" className="small">All areas</Link>}
          </div>
          <table className="data" style={{ minWidth: 460 }}>
            <thead><tr><th>Zip</th><th>Area</th><th>Waiting</th><th>Invite</th></tr></thead>
            <tbody>
              {zips.slice(0, 40).map((z) => (
                <tr key={z.zip}>
                  <td className="mono"><Link href={`/admin/waitlist?zip=${z.zip}`}>{z.zip}</Link></td>
                  <td className="muted">{z.sub ? `${z.area} · ${z.sub}` : z.area}</td>
                  <td className="mono">{z.waiting}</td>
                  <td>{z.waiting > 0 && (
                    <form action={inviteBatch} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="zips" value={z.zip} />
                      <input className="input" type="number" name="count" min={1} max={500} defaultValue={z.waiting} style={{ width: 70, padding: '6px 8px' }} />
                      <button className="btn ghost sm">Send</button>
                    </form>
                  )}</td>
                </tr>
              ))}
              {zips.length === 0 && <tr><td colSpan={4} className="muted">No one yet.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="stack" style={{ flex: '1 1 300px', gap: 20 }}>
          <form action={inviteBatch} className="card stack">
            <h2 style={{ margin: 0, fontSize: 16 }}>Send invites by zip</h2>
            <label className="field">Zip codes<textarea className="input mono" name="zips" rows={3} placeholder="11201, 11215, 07030" /></label>
            <label className="field">Area (optional)<select className="input" name="area" defaultValue=""><option value="">Any</option>{areas.map((a) => <option key={a.name}>{a.name}</option>)}</select></label>
            <label className="field">How many<input className="input" type="number" name="count" min={1} max={500} defaultValue={50} /></label>
            <button className="btn sm">Send invites</button>
            <span className="small muted">Goes to the people waiting longest, with friend referrals first. Up to 500 at a time.</span>
          </form>

          <form action={setPrefix} className="card stack">
            <h2 style={{ margin: 0, fontSize: 16 }}>Add or change an area</h2>
            <span className="small muted">Zips are grouped by their first 3 digits. Example: 077 → Jersey Shore.</span>
            <div className="row" style={{ gap: 8 }}>
              <label className="field" style={{ width: 90 }}>First 3<input className="input mono" name="prefix" inputMode="numeric" pattern="[0-9]{3}" maxLength={3} required /></label>
              <label className="field grow">Area name<input className="input" name="area" list="area-names" required /></label>
            </div>
            <datalist id="area-names">{areas.map((a) => <option key={a.name} value={a.name} />)}</datalist>
            <button className="btn ghost sm">Save</button>
          </form>

          <form action={createInvites} className="card stack">
            <h2 style={{ margin: 0, fontSize: 16 }}>Blank invite codes</h2>
            <span className="small muted">For partners or events. Not tied to anyone on the list.</span>
            <div className="row" style={{ gap: 8 }}>
              <label className="field"><span>How many</span><input className="input" type="number" name="count" min={1} max={500} defaultValue={10} style={{ width: 90 }} /></label>
              <label className="field grow">Type<select className="input" name="kind"><option value="drop">City drop</option><option value="founder">Founding member</option></select></label>
            </div>
            <button className="btn ghost sm">Create codes</button>
          </form>
        </section>
      </div>

      {/* People */}
      <section className="card scroll-x">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>People{sp.area ? ` · ${sp.area}` : ''}{sp.zip ? ` · ${sp.zip}` : ''} (newest 200)</h2>
          {(sp.area || sp.zip) && <Link href="/admin/waitlist" className="small">Show everyone</Link>}
        </div>
        <table className="data" style={{ minWidth: 900 }}>
          <thead><tr><th>Name</th><th>Email</th><th>Zip</th><th>Area</th><th>Job</th><th>Joined list</th><th>Status</th><th></th></tr></thead>
          <tbody>{(rows || []).map((w) => (
            <tr key={w.id}>
              <td>{w.first_name || w.last_name ? `${w.first_name} ${w.last_name || ''}` : <span className="muted">No name (app)</span>}</td>
              <td className="muted">{w.email}</td>
              <td className="mono">{w.zip || '—'}</td>
              <td className="muted">{w.borough ? `${w.area} · ${w.borough}` : w.area || w.city}</td>
              <td className="muted">{w.job}</td>
              <td className="muted">{new Date(w.created_at).toLocaleDateString()}</td>
              <td>{w.status}{w.invite_code ? <span className="mono small muted"> · {w.invite_code}</span> : null}</td>
              <td>
                {w.status === 'waiting' && <form action={emailInvite}><input type="hidden" name="id" value={w.id} /><button className="btn sm">Email invite</button></form>}
                {w.status === 'invited' && w.invite_code && <form action={resendInvite}><input type="hidden" name="id" value={w.id} /><button className="btn ghost sm">Resend</button></form>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <form action={setZip} className="card row" style={{ flexWrap: 'wrap' }}>
        <div className="stack" style={{ flex: '1 1 100%', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>NYC borough zip codes ({zipCount ?? 0})</h2>
          <span className="small muted">Exact zips that count as New York City, tagged by borough. Everything else is grouped by area above.</span>
        </div>
        <label className="field">Zip<input className="input" name="zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required style={{ width: 110 }} /></label>
        <label className="field">Borough<select className="input" name="borough">{BOROUGHS.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label className="row small" style={{ alignSelf: 'flex-end', paddingBottom: 12 }}><input type="checkbox" name="active" defaultChecked style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />Counts as NYC</label>
        <button className="btn sm" style={{ alignSelf: 'flex-end' }}>Save zip</button>
      </form>
    </>
  );
}
