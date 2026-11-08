import { cookies } from 'next/headers';
import { requireStaff } from '@/lib/session';
import { getSeasonConfig } from '@/lib/seasonsServer';
import { activeSeason, nyToday, seasonsWith, windowFor, type Effect } from '@/lib/seasons';
import { previewSeason, saveSeasons } from './actions';

export const dynamic = 'force-dynamic';

const EFFECTS: [Effect, string][] = [['none', 'No effect'], ['snow', 'Snow'], ['confetti', 'Confetti'], ['hearts', 'Hearts'], ['leaves', 'Falling leaves'], ['embers', 'Glowing embers'], ['sparks', 'Fireworks sparks']];
const fmtMD = (md: string) => (/^\d\d-\d\d$/.test(md) ? new Date(`2000-${md}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : md);

export default async function Themes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const [{ data: role }, cfg] = await Promise.all([supabase.rpc('staff_role'), getSeasonConfig()]);
  const owner = role === 'owner';
  const list = seasonsWith(cfg);
  const now = activeSeason(cfg);
  const { year } = nyToday();
  const preview = (await cookies()).get('score_season_preview')?.value;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Seasonal themes</h1>
      <span className="small muted">Holiday looks that switch on and off by themselves (New York time): a tinted accent color, a small dismissible banner, and a light effect that plays for a few seconds once per visit. Effects never play for people who turn on reduced motion. Admin pages and open chats stay plain.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span className="stack" style={{ gap: 2 }}>
          <strong>{now ? `Showing now: ${now.name}` : 'No theme showing right now'}</strong>
          <span className="small muted">{cfg.force === 'off' ? 'All themes are switched off.' : cfg.force ? 'Forced on until you change it below.' : cfg.enabled ? 'Following the schedule.' : 'Schedule is turned off.'}{preview ? ` · You’re previewing ${list.find((s) => s.key === preview)?.name}.` : ''}</span>
        </span>
        {preview && <form action={previewSeason}><input type="hidden" name="key" value="" /><button className="btn ghost sm">End my preview</button></form>}
      </div>

      <form action={saveSeasons} className="stack" style={{ gap: 14 }}>
        <fieldset className="stack" style={{ gap: 14, border: 0, padding: 0, margin: 0 }}>
          <section className="card stack" style={{ gap: 12 }}>
            <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} style={{ accentColor: 'var(--gold)', marginTop: 4 }} /><span className="stack" style={{ gap: 2 }}><strong>Run themes on schedule</strong><span className="small muted">Turn off to pause every seasonal theme.</span></span></label>
            <label className="field">Override
              <select className="input" name="force" defaultValue={cfg.force ?? ''}>
                <option value="">Follow the schedule</option>
                <option value="off">Turn all themes off now</option>
                {list.map((s) => <option key={s.key} value={s.key}>Force on: {s.name}</option>)}
              </select>
            </label>
          </section>

          {list.map((s) => {
            const [a, b] = windowFor(s, year);
            return (
              <section key={s.key} className="card stack" style={{ gap: 10, borderColor: now?.key === s.key ? s.accent : undefined }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <label className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <input type="checkbox" name={`${s.key}_enabled`} defaultChecked={s.enabled} style={{ width: 18, height: 18, accentColor: s.accent }} />
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: s.accent, display: 'inline-block' }} aria-hidden />
                    <strong>{s.name}</strong>
                  </label>
                  <span className="small muted">{year}: {fmtMD(a)} – {fmtMD(b)}{now?.key === s.key ? ' · showing now' : ''}</span>
                </div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <label className="field" style={{ width: 120 }}>Starts (MM-DD)<input className="input" name={`${s.key}_start`} defaultValue={s.start} placeholder={s.key === 'thanksgiving' ? 'auto' : '10-24'} /></label>
                  <label className="field" style={{ width: 120 }}>Ends (MM-DD)<input className="input" name={`${s.key}_end`} defaultValue={s.end} placeholder={s.key === 'thanksgiving' ? 'auto' : '10-31'} /></label>
                  <label className="field grow">Effect
                    <select className="input" name={`${s.key}_effect`} defaultValue={s.effect}>{EFFECTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </label>
                </div>
                <label className="field">Banner (leave blank for no banner)<input className="input" name={`${s.key}_banner`} defaultValue={s.banner} maxLength={140} /></label>
                {s.key === 'thanksgiving' && <span className="small muted">Leave dates as “auto” to follow Thanksgiving week each year (Monday to Sunday around the 4th Thursday of November).</span>}
                <div><button className="btn ghost sm" formAction={previewSeason} name="key" value={s.key} formNoValidate>Preview on the site (just you, 1 hour)</button></div>
              </section>
            );
          })}
        </fieldset>
        {owner ? <div><button className="btn">Save themes</button></div> : <span className="small muted">Only owners can change themes. Anyone on staff can preview.</span>}
      </form>
    </>
  );
}
