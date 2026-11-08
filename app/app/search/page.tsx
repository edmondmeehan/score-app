import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { verifiedMap } from '@/lib/bandVerified';
import { BandPill } from '@/components/ui';
import FounderBadge from '@/components/FounderBadge';
import { photoUrls } from '@/lib/photos';
import { BANDS, MONEY_QUESTIONS, type Band } from '@/lib/types';
import { DRINKING, EDUCATION, EXERCISE, HAS_KIDS, HEIGHTS, SMOKING, WANTS_KIDS, heightLabel } from '@/lib/profileDetails';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
type Result = { id: string; first_name: string | null; age: number | null; band: Band | null; trend: string | null; job: string | null; neighborhood: string | null; is_founder: boolean; compat: number; height_cm: number | null; active: boolean };
type Area = { key: string; name: string; kind: string };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const MONEY = MONEY_QUESTIONS.flatMap((m) => m.options);

export default async function Search({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const searched = Object.keys(sp).some((k) => k !== 'page');
  const page = Math.max(0, Number(one(sp.page)) || 0);
  const f = {
    q: one(sp.q), age_min: one(sp.age_min), age_max: one(sp.age_max), bands: many(sp.band), trend_up: one(sp.trend_up) === '1',
    area: one(sp.area), money: many(sp.money), height_min: one(sp.height_min), height_max: one(sp.height_max),
    has_kids: one(sp.has_kids), wants_kids: many(sp.wants_kids), education: many(sp.education),
    drinking: many(sp.drinking), smoking: many(sp.smoking), exercise: many(sp.exercise),
    founders: one(sp.founders) === '1', active_days: one(sp.active_days), sort: one(sp.sort) || 'match',
  };
  const [{ data: areasData }, { data: remainingData }, search] = await Promise.all([
    supabase.rpc('search_areas'),
    supabase.rpc('search_remaining'),
    searched ? supabase.rpc('member_search', { f, p_page: page }) : Promise.resolve({ data: null, error: null }),
  ]);
  const areas = (areasData as Area[]) || [];
  const data = search.data as { results: Result[]; total: number; remaining: number | null; limited: boolean; per_page: number } | null;
  const results = data?.results || [];
  const [photos, vmap] = await Promise.all([photoUrls(supabase, results.map((r) => r.id)), verifiedMap(supabase, results.map((r) => r.id))]);
  const remaining = data ? data.remaining : (remainingData as number | null);
  const unlimited = ['premium', 'black'].includes(me.plan);
  const filterCount = [f.q, f.age_min, f.age_max, f.area, f.height_min, f.height_max, f.has_kids, f.active_days].filter(Boolean).length
    + f.bands.length + f.money.length + f.wants_kids.length + f.education.length + f.drinking.length + f.smoking.length + f.exercise.length + (f.trend_up ? 1 : 0) + (f.founders ? 1 : 0);
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== 'page') many(v).forEach((x) => q.append(k, x));
    if (p) q.set('page', String(p));
    return `/app/search?${q.toString()}`;
  };
  const Check = ({ name, value, label, on }: { name: string; value: string; label: string; on: boolean }) => (
    <label className="filter-chip"><input type="checkbox" name={name} value={value} defaultChecked={on} /><span>{label}</span></label>
  );

  return (
    <div className="phone">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href="/app" className="small">← Daily Drop</Link>
        {!unlimited && remaining !== null && <span className="small muted">{remaining} {remaining === 1 ? 'search' : 'searches'} left today</span>}
      </div>
      <h1 className="serif" style={{ fontSize: 38 }}>Search &amp; directory</h1>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/app/discover" className="chip">Discover</Link>
        <Link href="/app/events" className="chip">Events</Link>
        <Link href="/app/map" className="chip">Member map</Link>
        <Link href="/app/likes" className="chip">Likes</Link>
      </div>

      <form action="/app/search" method="get" className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input grow" type="search" name="q" defaultValue={f.q} placeholder="Name, job, neighborhood…" maxLength={60} aria-label="Search" />
          <button className="btn sm">Search</button>
        </div>

        <details className="card filters" open={!searched}>
          <summary><strong>Filters</strong>{filterCount > 0 && <span className="chip small" style={{ marginLeft: 8 }}>{filterCount}</span>}</summary>
          <div className="stack" style={{ gap: 16, marginTop: 14 }}>
            <div className="row" style={{ gap: 10 }}>
              <label className="field grow">Age from<input className="input" type="number" name="age_min" min={25} max={80} defaultValue={f.age_min} placeholder="25" /></label>
              <label className="field grow">to<input className="input" type="number" name="age_max" min={25} max={80} defaultValue={f.age_max} placeholder="Any" /></label>
            </div>
            <label className="field">Where
              <select className="input" name="area" defaultValue={f.area}>
                <option value="">Anywhere</option>
                {(['area', 'borough', 'neighborhood'] as const).map((kind) => {
                  const list = areas.filter((a) => a.kind === kind);
                  return list.length ? <optgroup key={kind} label={kind === 'area' ? 'Areas' : kind === 'borough' ? 'Boroughs' : 'Neighborhoods'}>{list.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</optgroup> : null;
                })}
              </select>
            </label>
            <fieldset className="filter-group"><legend>ScoreDate band</legend>
              {(Object.keys(BANDS) as Band[]).map((b) => <Check key={b} name="band" value={b} label={BANDS[b].label} on={f.bands.includes(b)} />)}
              <Check name="trend_up" value="1" label="Trending up" on={f.trend_up} />
            </fieldset>
            <div className="row" style={{ gap: 10 }}>
              <label className="field grow">Height from<select className="input" name="height_min" defaultValue={f.height_min}><option value="">Any</option>{HEIGHTS.map((h) => <option key={h.cm} value={h.cm}>{h.label}</option>)}</select></label>
              <label className="field grow">to<select className="input" name="height_max" defaultValue={f.height_max}><option value="">Any</option>{HEIGHTS.map((h) => <option key={h.cm} value={h.cm}>{h.label}</option>)}</select></label>
            </div>
            <fieldset className="filter-group"><legend>Kids</legend>
              <select className="input" name="has_kids" defaultValue={f.has_kids} aria-label="Has kids"><option value="">Any</option>{HAS_KIDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <div className="filter-row">{WANTS_KIDS.map(([k, l]) => <Check key={k} name="wants_kids" value={k} label={l} on={f.wants_kids.includes(k)} />)}</div>
            </fieldset>
            <fieldset className="filter-group"><legend>Education</legend>{EDUCATION.map(([k, l]) => <Check key={k} name="education" value={k} label={l} on={f.education.includes(k)} />)}</fieldset>
            <fieldset className="filter-group"><legend>Drinking</legend>{DRINKING.map(([k, l]) => <Check key={k} name="drinking" value={k} label={l} on={f.drinking.includes(k)} />)}</fieldset>
            <fieldset className="filter-group"><legend>Smoking</legend>{SMOKING.map(([k, l]) => <Check key={k} name="smoking" value={k} label={l} on={f.smoking.includes(k)} />)}</fieldset>
            <fieldset className="filter-group"><legend>Exercise</legend>{EXERCISE.map(([k, l]) => <Check key={k} name="exercise" value={k} label={l} on={f.exercise.includes(k)} />)}</fieldset>
            <fieldset className="filter-group"><legend>Money values</legend>{MONEY.map((m) => <Check key={m} name="money" value={m} label={m} on={f.money.includes(m)} />)}</fieldset>
            <fieldset className="filter-group"><legend>More</legend>
              <Check name="founders" value="1" label="Founding Members" on={f.founders} />
              <select className="input" name="active_days" defaultValue={f.active_days} aria-label="Last active"><option value="">Active any time</option><option value="1">Active today</option><option value="7">Active this week</option><option value="30">Active this month</option></select>
            </fieldset>
            <label className="field">Sort by<select className="input" name="sort" defaultValue={f.sort}><option value="match">Best match</option><option value="active">Recently active</option><option value="new">Newest members</option></select></label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn">Show results</button>
              {searched && <Link href="/app/search" className="btn ghost">Clear</Link>}
            </div>
            <span className="small muted">Only verified members who are looking for someone like you appear. People you&apos;ve blocked, or who blocked you, never show up.</span>
          </div>
        </details>
      </form>

      {search.error && <div className="notice error">{/function|schema|does not exist/i.test(search.error.message) ? 'Search is almost ready. Please try again soon.' : search.error.message}</div>}

      {data?.limited && (
        <div className="card gold stack" style={{ gap: 8 }}>
          <span className="serif" style={{ fontSize: 24 }}>You&apos;ve used today&apos;s searches</span>
          <span className="small muted">Searches reset at midnight. Premium members search as much as they like.</span>
          <Link href="/plans" className="btn sm" style={{ alignSelf: 'flex-start' }}>See plans</Link>
        </div>
      )}

      {data && !data.limited && (
        <>
          <span className="small muted">{data.total === 0 ? 'No one matches those filters yet. Try widening them.' : `${data.total} ${data.total === 1 ? 'member' : 'members'}`}</span>
          <div className="stack" style={{ gap: 10 }}>
            {results.map((p) => (
              <Link key={p.id} href={`/app/u/${p.id}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ivory)', padding: 12 }}>
                <div className="photo" style={{ width: 76, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</div>
                <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                  <span><strong style={{ fontSize: 17 }}>{p.first_name}</strong> <span className="muted">{p.age}</span>{p.is_founder && <span style={{ marginLeft: 8 }}><FounderBadge /></span>}{p.active && <span className="small" style={{ marginLeft: 8, color: 'var(--rise)' }}>● Active</span>}</span>
                  <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.job, p.neighborhood, heightLabel(p.height_cm)].filter(Boolean).join(' · ')}</span>
                  <BandPill band={p.band} trend={p.trend} verified={vmap[p.id]} />
                </div>
                <div className="stack" style={{ alignItems: 'flex-end', gap: 0 }}><span className="serif" style={{ fontSize: 26, color: 'var(--gold-light)' }}>{p.compat}%</span><span className="small muted">match</span></div>
              </Link>
            ))}
          </div>
          {data.total > data.per_page && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {page > 0 ? <Link href={pageHref(page - 1)} className="btn ghost sm">← Previous</Link> : <span />}
              {(page + 1) * data.per_page < data.total ? <Link href={pageHref(page + 1)} className="btn ghost sm">Next →</Link> : <span />}
            </div>
          )}
        </>
      )}

      {!searched && <span className="small muted">Set the filters you care about and tap Show results.{!unlimited && remaining !== null ? ` Membership includes ${remaining} searches today.` : ''}</span>}
    </div>
  );
}
