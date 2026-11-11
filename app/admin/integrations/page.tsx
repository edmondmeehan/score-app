import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { SPECS, getPath } from '@/lib/integrationSpecs';
import { saveIntegration, testIntegration } from './actions';

type Row = { provider: string; enabled: boolean; config: Record<string, any>; secret_hints: Record<string, { hint: string; set_at: string }>; last_test_at: string | null; last_test_ok: boolean | null; last_test_message: string | null; updated_by: string | null; updated_at: string };

export default async function Integrations({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: rows }, { data: role }] = await Promise.all([supabase.from('integrations').select('*'), supabase.rpc('staff_role')]);
  const byProvider = Object.fromEntries(((rows as Row[]) || []).map((r) => [r.provider, r]));
  const owner = role === 'owner';
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`;
  return (
    <>
      <div className="stack" style={{ gap: 4 }}><span className="label">{owner ? 'Owner only · every change is logged' : 'Read only · owner can edit'}</span><h1 className="serif" style={{ fontSize: 44 }}>Integrations</h1></div>
      <p className="muted" style={{ margin: 0, maxWidth: 760, lineHeight: 1.55 }}>API keys and third-party settings. Secret keys are encrypted in the database vault. After you save one, nobody can view it again here, including you. You can only replace or clear it.</p>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {SPECS.map((s) => {
          const r = byProvider[s.provider];
          const has = (k: string) => Boolean(r?.secret_hints?.[k] || getPath(r?.config || {}, k));
          const connected = Boolean(r?.enabled && s.required.every(has));
          return <a key={s.provider} href={`#${s.provider}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ivory)', padding: 14 }}><span className="grow">{s.name}</span><span className="small" style={{ color: connected ? 'var(--rise)' : 'var(--faint)' }}>{connected ? 'Connected' : r?.enabled ? 'Incomplete' : 'Off'}</span></a>;
        })}
      </div>
      {SPECS.map((s) => {
        const r = byProvider[s.provider];
        return (
          <form key={s.provider} id={s.provider} action={saveIntegration} className="card stack" style={{ scrollMarginTop: 24 }}>
            <input type="hidden" name="provider" value={s.provider} />
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div className="stack" style={{ gap: 4 }}><h2 className="serif" style={{ fontSize: 28 }}>{s.name}</h2><span className="small muted">{s.what}</span></div>
              <label className="row small"><input type="checkbox" name="enabled" defaultChecked={r?.enabled} disabled={!owner} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />Enabled</label>
            </div>
            {sp.saved === s.provider && <div className="notice">Saved.</div>}
            {s.webhookPath && <div className="notice"><span className="label">Webhook URL</span><div className="mono small" style={{ color: 'var(--ivory)', wordBreak: 'break-all', marginTop: 6 }}>{origin}{s.webhookPath}</div></div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {s.fields.map((f) => f.secret ? (
                <div key={f.key} className="field">
                  <label htmlFor={`${s.provider}-${f.key}`}>{f.label} {r?.secret_hints?.[f.key] ? <span style={{ color: 'var(--rise)' }}>· set {r.secret_hints[f.key].hint}</span> : <span style={{ color: 'var(--faint)' }}>· not set</span>}</label>
                  {/* Not type="password": browsers and password managers were auto-filling a saved key into every secret box on Save. */}
                  <input id={`${s.provider}-${f.key}`} className="input mono secret-input" type="text" name={`sec:${f.key}`} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore="true" data-lpignore="true" data-bwignore="true" data-form-type="other" placeholder={r?.secret_hints?.[f.key] ? 'Leave blank to keep current' : f.placeholder} disabled={!owner} />
                  {r?.secret_hints?.[f.key] && owner && <label className="row small"><input type="checkbox" name={`clear:${f.key}`} />Clear this key</label>}
                  {f.help && <span className="small muted">{f.help}</span>}
                </div>
              ) : (
                <label key={f.key} className="field">{f.label}
                  <input className="input" name={`cfg:${f.key}`} defaultValue={String(getPath(r?.config || {}, f.key) ?? '')} placeholder={f.placeholder} disabled={!owner} />
                  {f.help && <span className="small muted">{f.help}</span>}
                </label>
              ))}
            </div>
            {s.notes && <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {owner && <button className="btn sm">Save {s.name}</button>}
              {owner && s.testable && <button className="btn ghost sm" formAction={testIntegration}>Test connection</button>}
              {r?.last_test_at && <span className="small" style={{ color: r.last_test_ok ? 'var(--rise)' : 'var(--alert)' }}>{r.last_test_ok ? 'Passed' : 'Failed'}: {r.last_test_message} · {new Date(r.last_test_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</span>}
              {r?.updated_by && <span className="small muted">Last changed by {r.updated_by}</span>}
            </div>
          </form>
        );
      })}
    </>
  );
}
