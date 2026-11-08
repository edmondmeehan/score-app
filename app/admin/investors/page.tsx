import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { CONTENT_DEFAULT, mergeContent, type InvestorContent } from '@/lib/investors';
import { computeModel, mergeAssumptions, pctf, usd } from '@/lib/investorModel';
import { saveInvestorContent, saveInvestorModel, setInvestorPassword, signOutInvestors } from './actions';

export const dynamic = 'force-dynamic';

type Settings = { password_set: boolean; pw_set_at: string | null; content: unknown; model: unknown; sessions: number; log: { label: string; ok: boolean; created_at: string }[] };
const when = (s: string) => new Date(s).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';

const FIELDS: { k: keyof InvestorContent; label: string; rows?: number; hint?: string }[] = [
  { k: 'headline', label: 'Headline', rows: 1 },
  { k: 'summary', label: 'Summary', rows: 4 },
  { k: 'problem', label: 'The problem', rows: 4 },
  { k: 'solution', label: 'Our answer', rows: 4 },
  { k: 'how', label: 'How it works', rows: 5, hint: 'One step per line' },
  { k: 'why_now', label: 'Why now', rows: 4 },
  { k: 'moat', label: 'What makes it defensible', rows: 4, hint: 'One point per line' },
  { k: 'trust', label: 'Trust & compliance', rows: 5, hint: 'One point per line' },
  { k: 'team', label: 'Team', rows: 4, hint: 'One person per line: Name | Role | Short bio' },
];
const RAISE: { k: keyof InvestorContent; label: string; rows?: number; hint?: string }[] = [
  { k: 'raise_amount', label: 'Amount raising', rows: 1, hint: 'e.g. $1.5M' },
  { k: 'raise_instrument', label: 'Instrument', rows: 1, hint: 'e.g. SAFE, $12M post-money cap' },
  { k: 'raise_terms', label: 'Terms note', rows: 2 },
  { k: 'raise_use', label: 'Use of funds', rows: 4, hint: 'One per line: Label | percent' },
  { k: 'raise_milestones', label: 'Milestones this round funds', rows: 4, hint: 'One per line' },
  { k: 'contact_name', label: 'Contact name', rows: 1 },
  { k: 'contact_email', label: 'Contact email', rows: 1 },
  { k: 'disclaimer', label: 'Disclaimer (required)', rows: 4, hint: 'Have counsel review before sharing with investors' },
];

function Field({ f, v }: { f: { k: keyof InvestorContent; label: string; rows?: number; hint?: string }; v: string }) {
  return (
    <label className="field">
      {f.label}{f.hint && <span className="small muted" style={{ fontWeight: 400 }}> · {f.hint}</span>}
      {f.rows === 1
        ? <input className="input" name={f.k} defaultValue={v} maxLength={300} />
        : <textarea className="input" name={f.k} rows={f.rows} defaultValue={v} maxLength={4000} />}
    </label>
  );
}

export default async function InvestorsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const { data, error } = await supabase.rpc('staff_investor_settings');
  const s = data as Settings | null;
  const notReady = error && /function|does not exist|schema cache/i.test(error.message);
  const owner = !error;
  const c = mergeContent(s?.content);
  const a = mergeAssumptions(s?.model);
  const rows = computeModel(a);
  const last = rows[rows.length - 1];
  const be = rows.find((r) => r.ebitda > 0);
  const pct = (v: number) => Math.round(v * 1000) / 10;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="serif" style={{ fontSize: 44 }}>Investors</h1>
        <Link href="/investors" target="_blank" className="btn ghost sm">Open investor room ↗</Link>
      </div>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0021 in the Score SQL Editor to turn on the investor room.</div>}
      {error && !notReady && <div className="notice error">{/owner/i.test(error.message) ? 'Only owners can manage the investor room.' : error.message}</div>}
      <span className="small muted">A private page at scoredate.app/investors. It isn’t linked anywhere and search engines are told not to index it. Share the address and password directly.</span>

      {owner && s && (
        <>
          <section id="access" className="card stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>Password & access</strong>
              <span className="chip small" style={{ color: s.password_set ? 'var(--rise)' : 'var(--alert)' }}>{s.password_set ? `Open · set ${s.pw_set_at ? when(s.pw_set_at) : ''}` : 'Closed · no password yet'}</span>
            </div>
            <form action={setInvestorPassword} className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field grow">{s.password_set ? 'New password' : 'Password'}<input className="input" name="password" type="password" minLength={10} autoComplete="new-password" required /></label>
              <label className="field grow">Confirm<input className="input" name="confirm" type="password" minLength={10} autoComplete="new-password" required /></label>
              <button className="btn sm">{s.password_set ? 'Change password' : 'Set password'}</button>
            </form>
            <span className="small muted">At least 10 characters. It’s stored scrambled (hashed), so we can’t show it again. Changing it signs everyone out. After 8 wrong tries, a network is locked out for 15 minutes.</span>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="small">{s.sessions} active investor session{s.sessions === 1 ? '' : 's'}</span>
              {s.sessions > 0 && <form action={signOutInvestors}><button className="btn ghost sm">Sign everyone out</button></form>}
            </div>
            <details>
              <summary className="small" style={{ cursor: 'pointer' }}>Recent sign-ins ({s.log.length})</summary>
              <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                {s.log.length === 0 && <span className="small muted">No visits yet.</span>}
                {s.log.map((l, i) => (
                  <div key={i} className="row small" style={{ justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--line-soft)', paddingBottom: 6 }}>
                    <span>{l.label || 'Unknown'}</span>
                    <span style={{ color: l.ok ? 'var(--rise)' : 'var(--alert)' }}>{l.ok ? 'Signed in' : 'Wrong password'} · {when(l.created_at)}</span>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <form id="content" action={saveInvestorContent} className="card stack" style={{ gap: 14 }}>
            <strong>Story and details</strong>
            {FIELDS.map((f) => <Field key={f.k} f={f} v={c[f.k]} />)}
            <strong style={{ marginTop: 8 }}>The raise</strong>
            {RAISE.map((f) => <Field key={f.k} f={f} v={c[f.k]} />)}
            <div className="row" style={{ gap: 10 }}><button className="btn sm">Save content</button></div>
            <span className="small muted">Live waitlist numbers, pricing and the P&L fill in automatically. Default text: {CONTENT_DEFAULT.raise_amount === c.raise_amount ? 'raise details still say TBD.' : 'customized.'}</span>
          </form>

          <form id="model" action={saveInvestorModel} className="card stack" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>Growth model assumptions</strong>
              <span className="small muted">Year {last.year}: {usd(last.net)} net revenue · EBITDA {usd(last.ebitda)} ({pctf(last.ebitdaMargin)}) · positive in {be ? `year ${be.year}` : 'no year shown'}</span>
            </div>
            <label className="field">Markets<span className="small muted" style={{ fontWeight: 400 }}> · One per line: Name | launch year | members at maturity</span>
              <textarea className="input mono" name="markets" rows={7} style={{ fontSize: 13 }} defaultValue={a.markets.map((m) => `${m.name} | ${m.launch} | ${m.target}`).join('\n')} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <label className="field">Years shown<input className="input" name="years" defaultValue={a.years} inputMode="numeric" /></label>
              <label className="field">Ramp by year after launch (%)<input className="input" name="ramp" defaultValue={a.ramp.map(pct).join(', ')} /></label>
              <label className="field">Mix: Membership (%)<input className="input" name="mix_membership" defaultValue={pct(a.mix.membership)} /></label>
              <label className="field">Mix: Premium (%)<input className="input" name="mix_premium" defaultValue={pct(a.mix.premium)} /></label>
              <label className="field">Mix: Reserve (%)<input className="input" name="mix_reserve" defaultValue={pct(a.mix.reserve)} /></label>
              <label className="field">Price: Membership ($/mo)<input className="input" name="price_membership" defaultValue={a.price.membership} /></label>
              <label className="field">Price: Premium ($/mo)<input className="input" name="price_premium" defaultValue={a.price.premium} /></label>
              <label className="field">Price: Reserve ($/mo)<input className="input" name="price_reserve" defaultValue={a.price.reserve} /></label>
              <label className="field">Price: Preview ($ once)<input className="input" name="price_preview" defaultValue={a.price.preview} /></label>
              <label className="field">Price: Paused ($/mo)<input className="input" name="price_paused" defaultValue={a.price.paused} /></label>
              <label className="field">Avg discount (%)<input className="input" name="discount" defaultValue={pct(a.discount)} /></label>
              <label className="field">Add-ons ($/member/mo)<input className="input" name="addon_pm" defaultValue={a.addon_pm} /></label>
              <label className="field">Paused share of members (%)<input className="input" name="paused_share" defaultValue={pct(a.paused_share)} /></label>
              <label className="field">Previews per new member<input className="input" name="previews_per_member" defaultValue={a.previews_per_member} /></label>
              <label className="field">Monthly churn (%)<input className="input" name="churn_m" defaultValue={pct(a.churn_m)} /></label>
              <label className="field">App store fee (%)<input className="input" name="store_fee" defaultValue={pct(a.store_fee)} /></label>
              <label className="field">Events per market ($/yr)<input className="input" name="events_per_market" defaultValue={a.events_per_market} /></label>
              <label className="field">Event cost (% of events revenue)<input className="input" name="events_cost" defaultValue={pct(a.events_cost)} /></label>
              <label className="field">Verification + credit ($/applicant)<input className="input" name="verify_cost" defaultValue={a.verify_cost} /></label>
              <label className="field">Hosting ($/member/mo)<input className="input" name="infra_pm" defaultValue={a.infra_pm} /></label>
              <label className="field">Hosting fixed ($/yr)<input className="input" name="infra_base" defaultValue={a.infra_base} /></label>
              <label className="field">Marketing per new member ($)<input className="input" name="cac" defaultValue={a.cac} /></label>
              <label className="field">Launch budget per market ($)<input className="input" name="launch_budget" defaultValue={a.launch_budget} /></label>
              <label className="field">G&A (% of net revenue)<input className="input" name="ga_pct" defaultValue={pct(a.ga_pct)} /></label>
              <label className="field">G&A minimum ($/yr)<input className="input" name="ga_min" defaultValue={a.ga_min} /></label>
            </div>
            <label className="field">Team cost by year ($, comma separated)<input className="input" name="payroll" defaultValue={a.payroll.join(', ')} /></label>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn sm">Save and recalculate</button>
              <button className="btn ghost sm" name="reset" value="1" formNoValidate>Reset to defaults</button>
            </div>
            <span className="small muted">The investor page labels this as an illustrative model, not a forecast.</span>
          </form>
        </>
      )}
    </>
  );
}
