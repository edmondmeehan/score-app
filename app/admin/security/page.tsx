import { requireStaff } from '@/lib/session';
import { getSecurityStatus } from '@/lib/vercelSecurity';
import { attackMode, botProtection, aiBots } from './actions';

export const dynamic = 'force-dynamic';

const fmt = (ms: number) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET';

function State({ on, label }: { on: boolean; label: string }) {
  return <span className="chip small" style={{ color: on ? 'var(--rise)' : 'var(--muted)', borderColor: on ? 'var(--rise)' : 'var(--line-soft)' }}>{label}</span>;
}

export default async function Security({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const s = await getSecurityStatus();
  const left = s.attackMode.until ? Math.max(0, Math.round((s.attackMode.until - Date.now()) / 60000)) : null;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Security</h1>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {(sp.error || s.error) && <div className="notice error">{sp.error || s.error}</div>}
      {!s.configured && (
        <div className="notice error">
          To use these switches, create a Vercel access token (Vercel → Account Settings → Tokens, scoped to this team) and add it as a <strong>sensitive</strong> environment variable named <span className="mono">VERCEL_API_TOKEN</span> for Production, then redeploy. Don’t paste the token anywhere else.
        </div>
      )}
      <span className="small muted">Vercel’s automatic DDoS mitigation is always on. These add extra checks when you need them. Every change is recorded in the audit log.</span>

      <section className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Browser check for every visitor (human check)</strong>
          <State on={s.attackMode.on} label={s.attackMode.on ? `On${s.attackMode.until ? ` until ${fmt(s.attackMode.until)}` : ''}${left !== null ? ` · ${left >= 60 ? Math.round(left / 60) + 'h' : left + 'm'} left` : ''}` : 'Off'} />
        </div>
        <span className="small muted">Use during an attack or a traffic spike from bots. Every visitor sees a short automatic check before the site loads. Real people pass in a second or two; bots get stopped. It turns itself off when the time is up.</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {[1, 6, 24].map((h) => (
            <form key={h} action={attackMode}><input type="hidden" name="hours" value={h} /><button className="btn sm" disabled={!s.configured}>On for {h} hour{h === 1 ? '' : 's'}</button></form>
          ))}
          {s.attackMode.on && <form action={attackMode}><input type="hidden" name="hours" value={0} /><button className="btn ghost sm">Turn off now</button></form>}
        </div>
        <span className="small muted">Heads up: while it’s on, server-to-server calls (RevenueCat, ID verification webhooks) can be challenged too. Keep it to the shortest window you need.</span>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Bot protection (bot fight mode)</strong>
          <State on={s.botProtection.on} label={s.botProtection.on ? 'On · challenging bots' : 'Off'} />
        </div>
        <span className="small muted">Challenges automated traffic that doesn’t look like a browser, while letting known good bots (Google, Apple) through. Safe to leave on. Turning it on also adds a rule so webhooks and scheduled jobs are never challenged{s.bypassRule ? ' (rule in place)' : ''}.</span>
        <form action={botProtection}>
          <input type="hidden" name="on" value={s.botProtection.on ? 'false' : 'true'} />
          <button className={s.botProtection.on ? 'btn ghost sm' : 'btn sm'} disabled={!s.configured}>{s.botProtection.on ? 'Turn off' : 'Turn on'}</button>
        </form>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>Block AI crawlers</strong>
          <State on={s.aiBots.on} label={s.aiBots.on ? 'Blocking' : 'Allowed'} />
        </div>
        <span className="small muted">Stops AI scrapers from copying the public pages. Doesn’t affect search engines.</span>
        <form action={aiBots}>
          <input type="hidden" name="on" value={s.aiBots.on ? 'false' : 'true'} />
          <button className={s.aiBots.on ? 'btn ghost sm' : 'btn sm'} disabled={!s.configured}>{s.aiBots.on ? 'Allow' : 'Block'}</button>
        </form>
      </section>
    </>
  );
}
