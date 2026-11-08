import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { getInquiryDetails, personaConfigured, type PersonaCheck, type PersonaDetails } from '@/lib/persona';
import { faceMatchConfigured } from '@/lib/facematch';
import { parseUA } from '@/lib/analytics';
import { REASONS, miles } from '@/lib/verifyReview';
import { decideVerification, setPhoto } from '../actions';

export const dynamic = 'force-dynamic';

type Signal = { step: string; ip: string | null; city: string | null; region: string | null; country: string | null; lat: number | null; lng: number | null; user_agent: string | null; created_at: string };
type Photo = { id: string; path: string; match_status: string; match_similarity: number | null; match_reason: string | null; created_at: string };
type Review = { kind: string; decision: string; reason_code: string | null; note: string | null; member_message: string | null; staff_email: string; created_at: string };
type Ver = { kind: string; provider: string; provider_ref: string | null; status: string; detail: string | null; created_at: string };
type Zip = { zip: string; nyc: boolean; borough: string | null; neighborhood: string | null; lat: number | null; lng: number | null; precise: boolean };
type Flag = { level: 'bad' | 'warn' | 'ok'; text: string };
type Sighting = { source: 'ScoreDate' | 'Persona'; step: string; ip?: string | null; where: string; country?: string | null; lat?: number | null; lng?: number | null; device?: string; at?: string; netFlags?: string[] };

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—');
const STEP: Record<string, string> = { signup: 'Profile basics', id_start: 'Started ID check', photos: 'Uploaded photos', persona: 'During ID check' };
const tone = (s: string) => (/^(passed|approved|completed)$/.test(s) ? 'ok' : /^(failed|declined|rejected)$/.test(s) ? 'bad' : 'warn');
const norm = (s?: string | null) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const NYC_CITIES = /new york|manhattan|brooklyn|queens|bronx|staten island|astoria|flushing|jamaica|long island city/i;

function Pill({ t, children }: { t: 'ok' | 'warn' | 'bad' | 'plain'; children: React.ReactNode }) {
  return <span className={`vpill ${t}`}>{children}</span>;
}

function Checks({ checks }: { checks: PersonaCheck[] }) {
  if (!checks.length) return null;
  return (
    <div className="vchecks">
      {[...checks].sort((a, b) => Number(a.status === 'passed') - Number(b.status === 'passed')).map((c) => (
        <span key={c.name} className={`vcheck ${c.status === 'passed' ? 'ok' : 'bad'}`} title={c.reasons.join(', ')}>{c.status === 'passed' ? '✓' : '✕'} {c.name}{c.status !== 'passed' && c.reasons.length ? ` · ${c.reasons.join(', ')}` : ''}</span>
      ))}
    </div>
  );
}

function KV({ k, v }: { k: string; v?: React.ReactNode }) {
  if (v == null || v === '') return null;
  return <div className="vkv"><span>{k}</span><span>{v}</span></div>;
}

export default async function VerificationCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();

  const [{ data: sigs }, { data: phs }, { data: revs }, { data: vers }, { data: sameIp }, { data: zipData }, personaOn, awsOn] = await Promise.all([
    supabase.from('verification_signals').select('step, ip, city, region, country, lat, lng, user_agent, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('photos').select('id, path, match_status, match_similarity, match_reason, created_at').eq('user_id', id).order('position'),
    supabase.from('verification_reviews').select('kind, decision, reason_code, note, member_message, staff_email, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('verifications').select('kind, provider, provider_ref, status, detail, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(40),
    supabase.rpc('staff_same_ip_accounts', { p_user: id }),
    p.zip ? supabase.rpc('zip_lookup', { p_zip: p.zip }) : Promise.resolve({ data: null }),
    personaConfigured(),
    faceMatchConfigured(),
  ]);
  const signals = (sigs || []) as Signal[];
  const photos = (phs || []) as Photo[];
  const reviews = (revs || []) as Review[];
  const verifs = (vers || []) as Ver[];
  const others = (sameIp || []) as { id: string; name: string; status: string }[];
  const home = zipData as Zip | null;

  // Photo URLs (private bucket, signed for an hour).
  const stored = photos.filter((x) => !/^https?:\/\//.test(x.path));
  const { data: signed } = stored.length ? await supabase.storage.from('photos').createSignedUrls(stored.map((x) => x.path), 3600) : { data: [] };
  const urlOf = new Map<string, string | undefined>(stored.map((x, i) => [x.path, signed?.[i]?.signedUrl ?? undefined] as [string, string | undefined]));
  photos.forEach((x) => { if (/^https?:\/\//.test(x.path)) urlOf.set(x.path, x.path); });
  const avatar = urlOf.get((photos.find((x) => x.match_status === 'approved') || photos[0])?.path || '');

  // Live Persona details for the latest inquiry.
  const inquiryId = verifs.find((v) => v.kind === 'id' && v.provider === 'persona' && v.provider_ref)?.provider_ref || null;
  let persona: PersonaDetails | null = null;
  let personaError: string | null = null;
  if (inquiryId && personaOn) {
    try { persona = await getInquiryDetails(inquiryId); } catch (e) { personaError = (e as Error).message.slice(0, 200); }
  }

  // Every place we've seen them connect from, newest first.
  const sightings: Sighting[] = [
    ...signals.map((s): Sighting => {
      const ua = s.user_agent ? parseUA(s.user_agent) : null;
      return { source: 'ScoreDate', step: s.step, ip: s.ip, where: [s.city, s.region, s.country].filter(Boolean).join(', '), country: s.country, lat: s.lat != null ? Number(s.lat) : null, lng: s.lng != null ? Number(s.lng) : null, device: ua ? `${ua.device} · ${ua.os} · ${ua.browser}` : undefined, at: s.created_at };
    }),
    ...(persona?.sessions || []).map((s): Sighting => ({ source: 'Persona', step: 'persona', ip: s.ip, where: s.location || '', country: s.location?.split(', ').pop() || null, lat: s.lat, lng: s.lng, device: [s.device, s.os, s.browser].filter(Boolean).join(' · ') || undefined, at: s.at, netFlags: s.flags })),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const withDist = sightings.map((s) => ({ ...s, d: home?.lat != null && s.lat != null && s.lng != null ? miles(Number(home.lat), Number(home.lng), s.lat, s.lng) : null }));
  const latest = withDist[0] || null;
  const farthest = withDist.filter((s) => s.d != null).sort((a, b) => (b.d ?? 0) - (a.d ?? 0))[0] || null;
  const nonUS = sightings.some((s) => s.country && !/^(US|United States)$/i.test(s.country));
  const nycByName = sightings.some((s) => NYC_CITIES.test(s.where));
  // Borough-level ZIPs are only accurate to a few miles, so be generous.
  const near = home?.precise ? 15 : 20;
  const locVerdict: Flag | null = !home?.zip ? null
    : !sightings.length ? { level: 'warn', text: 'No connection data yet' }
    : nonUS ? { level: 'bad', text: 'Connected from outside the US' }
    : farthest?.d != null ? (farthest.d <= near ? { level: 'ok', text: `Matches their ZIP · within ${Math.max(1, farthest.d)} mi` } : farthest.d <= 60 ? { level: 'warn', text: `Nearby but not NYC · ${farthest.d} mi away` } : { level: 'bad', text: `Far from their ZIP · ${farthest.d} mi away` })
    : nycByName ? { level: 'ok', text: 'Connected from New York City' } : { level: 'warn', text: 'Couldn’t place the IP precisely' };

  // Flags.
  const flags: Flag[] = [];
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const idName = persona?.name || persona?.documents.find((d) => d.name)?.name;
  const idDob = persona?.birthdate || persona?.documents.find((d) => d.birthdate)?.birthdate;
  if (idName && p.first_name) {
    const first = norm(idName.split(' ')[0]);
    const mine = norm(p.first_name);
    flags.push(first.startsWith(mine.slice(0, 3)) || mine.startsWith(first.slice(0, 3)) ? { level: 'ok', text: `Name matches ID (${idName})` } : { level: 'warn', text: `Profile “${p.first_name}” vs ID “${idName}”` });
  }
  if (idDob) {
    const y = Number(idDob.slice(0, 4));
    const idAge = Math.floor((Date.now() - new Date(idDob).getTime()) / (365.25 * 86400000));
    if (p.birth_year && Math.abs(y - p.birth_year) > 1) flags.push({ level: 'warn', text: `Profile birth year ${p.birth_year} vs ID ${y}` });
    flags.push(idAge < 25 ? { level: 'bad', text: `ID says ${idAge}, under the 25+ minimum` } : { level: 'ok', text: `Age ${idAge} per ID` });
  }
  persona?.documents.forEach((d) => { if (d.expires && new Date(d.expires) < new Date()) flags.push({ level: 'bad', text: `ID expired ${d.expires}` }); });
  sightings.forEach((s) => s.netFlags?.forEach((f) => flags.push({ level: 'warn', text: `${f} during ID check` })));
  if (locVerdict) flags.push(locVerdict);
  if (others.length) flags.push({ level: 'warn', text: `${others.length} other account${others.length === 1 ? '' : 's'} on the same IP` });
  const sims = photos.map((x) => x.match_similarity).filter((x): x is number => x != null).map(Number);
  if (photos.some((x) => /^AWS error/.test(x.match_reason || ''))) flags.push({ level: 'bad', text: 'AWS face match errored — check the AWS keys' });
  else if (sims.length) flags.push(Math.min(...sims) >= 92 ? { level: 'ok', text: `Photos match selfie (${Math.min(...sims)}%+)` } : { level: 'warn', text: `Lowest photo match ${Math.min(...sims)}%` });
  const bad = flags.filter((f) => f.level === 'bad').length;
  const warn = flags.filter((f) => f.level === 'warn').length;
  const overall = bad ? { t: 'bad' as const, label: 'Red flags', sub: `${bad} red · ${warn} to check` } : warn ? { t: 'warn' as const, label: 'Worth a look', sub: `${warn} thing${warn === 1 ? '' : 's'} to check` } : { t: 'ok' as const, label: 'Looks good', sub: flags.length ? 'Everything lines up' : 'Not enough data yet' };

  const decideForm = (kind: 'id' | 'photos') => (
    <form action={decideVerification} className="vdecide">
      <input type="hidden" name="user" value={id} /><input type="hidden" name="kind" value={kind} />
      <div className="veyebrow">Decision · {kind === 'id' ? 'ID check' : 'Photos'}</div>
      <div className="vdecide-grid">
        <label className="field small">If asking for a redo, why?
          <select className="input" name="reason" defaultValue={REASONS[kind][0].code}>{REASONS[kind].map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select>
        </label>
        <label className="field small">Internal note <span className="muted">(staff only)</span>
          <input className="input" name="note" maxLength={2000} placeholder="What you checked and why" />
        </label>
      </div>
      <label className="field small">Message to the member <span className="muted">(optional, otherwise the standard text for that reason)</span>
        <textarea className="input" name="message" rows={2} maxLength={1000} placeholder="Example: Your second photo has sunglasses on. Swap it for one where we can see your eyes." />
      </label>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn sm" name="decision" value="approved">Approve {kind === 'id' ? 'ID' : 'photos'}</button>
        <button className="btn ghost sm" name="decision" value="retry">Ask to redo</button>
        <button className="btn ghost sm" name="decision" value="note">Save note</button>
        <label className="choice small" style={{ marginLeft: 'auto' }}><input type="checkbox" name="notify" defaultChecked style={{ accentColor: 'var(--gold)' }} /> Email the member</label>
      </div>
    </form>
  );

  return (
    <div className="vcase">
      <Link href="/admin/verification" className="small muted">‹ Verification queue</Link>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      {/* Hero */}
      <section className="vhero">
        <div className="vavatar">{avatar ? <img src={avatar} alt="" /> : <span className="serif">{(p.first_name || p.email || '?').slice(0, 1).toUpperCase()}</span>}</div>
        <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
          <div className="veyebrow">Verification case</div>
          <h1 className="serif">{p.first_name || p.email}{age ? <span className="muted">, {age}</span> : null}</h1>
          <span className="small muted">{[p.gender, home?.neighborhood || p.neighborhood, home?.borough, p.job].filter(Boolean).join(' · ')}</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Pill t={tone(p.id_status)}>ID {p.id_status}</Pill>
            <Pill t={tone(p.photo_status)}>Photos {p.photo_status}</Pill>
            {p.band && <Pill t="plain">{p.band}{p.credit_verified_at ? ' · verified' : ' · self-reported'}</Pill>}
            <Pill t="plain">{p.plan} · {p.status}</Pill>
          </div>
        </div>
        <div className={`vverdict ${overall.t}`}>
          <span className="serif">{overall.label}</span>
          <span className="small">{overall.sub}</span>
          <Link href={`/admin/members/${id}`} className="small">Member page ›</Link>
        </div>
      </section>

      {/* Location check */}
      <section className="vcard vloc">
        <div className="veyebrow">Location check · IP vs ZIP</div>
        <div className="vloc-row">
          <div className="vloc-side">
            <span className="small muted">Says they live in</span>
            <strong className="serif">{home?.neighborhood || p.neighborhood || '—'}</strong>
            <span className="small">{[home?.borough, p.zip ? `ZIP ${p.zip}` : null].filter(Boolean).join(' · ') || 'No ZIP yet'}</span>
          </div>
          <div className={`vloc-link ${locVerdict?.level || 'warn'}`}>
            <span className="vloc-line" />
            <span className="vloc-badge">{farthest?.d != null ? `${farthest.d} mi` : '?'}</span>
            <span className="vloc-line" />
          </div>
          <div className="vloc-side" style={{ textAlign: 'right' }}>
            <span className="small muted">Connected from{latest ? ` · ${latest.source === 'Persona' ? 'Persona' : STEP[latest.step] || latest.step}` : ''}</span>
            <strong className="serif">{latest?.where || '—'}</strong>
            <span className="small mono">{latest?.ip || 'No IP recorded yet'}</span>
          </div>
        </div>
        {locVerdict && <div className={`vloc-verdict ${locVerdict.level}`}>{locVerdict.level === 'ok' ? '✓' : locVerdict.level === 'bad' ? '✕' : '!'} {locVerdict.text}</div>}
        {withDist.length > 0 && (
          <div className="vsightings">
            {withDist.map((s, i) => (
              <div key={i} className="vsighting">
                <span className="mono small">{s.ip || '—'}</span>
                <span className="small">{s.where || 'Unknown location'}{s.netFlags?.length ? <span style={{ color: 'var(--gold)' }}> · {s.netFlags.join(', ')}</span> : null}</span>
                <span className="small muted">{s.d != null ? `${s.d} mi` : '—'}</span>
                <span className="small muted">{s.source === 'Persona' ? 'Persona' : STEP[s.step] || s.step}{s.device ? ` · ${s.device}` : ''}</span>
                <span className="small muted">{fmt(s.at)}</span>
              </div>
            ))}
          </div>
        )}
        <span className="small muted">IP location is approximate. Phones on cellular data can show a nearby town, so treat a few miles as a match.</span>
      </section>

      <div className="vgrid">
        <section className="vcard">
          <div className="veyebrow">Flags</div>
          <div className="stack" style={{ gap: 8 }}>
            {flags.length ? flags.map((f, i) => <div key={i} className={`vflag ${f.level}`}><span>{f.level === 'ok' ? '✓' : f.level === 'bad' ? '✕' : '!'}</span>{f.text}</div>)
              : <span className="small muted">Nothing yet. Signals start recording at profile basics, the ID check and photo upload.</span>}
            {others.length > 0 && <div className="row small" style={{ gap: 10, flexWrap: 'wrap' }}>Same IP: {others.map((o) => <Link key={o.id} href={`/admin/verification/${o.id}`}>{o.name} ({o.status})</Link>)}</div>}
          </div>
        </section>
        <section className="vcard">
          <div className="veyebrow">Profile</div>
          <KV k="Email" v={p.email} />
          <KV k="Born" v={p.birth_year ? String(p.birth_year) : null} />
          <KV k="ZIP" v={p.zip} />
          <KV k="Neighborhood" v={p.neighborhood} />
          <KV k="Job" v={p.job} />
          <KV k="Joined" v={fmt(p.created_at)} />
        </section>
      </div>

      {/* Persona */}
      <section className="vcard">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="veyebrow">ID check · Persona</div>
          {persona && <a href={persona.dashboardUrl} target="_blank" rel="noopener noreferrer" className="small">Open in Persona ↗</a>}
        </div>
        {!personaOn && <span className="small muted">Persona isn’t connected, so ID checks run in test mode.</span>}
        {personaOn && !inquiryId && <span className="small muted">No Persona inquiry on file for this member yet.</span>}
        {personaError && <span className="small" style={{ color: 'var(--alert)' }}>Couldn’t load the inquiry: {personaError}</span>}
        {persona && (
          <div className="vgrid">
            <div className="vsub">
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>Inquiry</strong><Pill t={tone(persona.status)}>{persona.status}</Pill></div>
              <KV k="Name on ID" v={idName} />
              <KV k="Date of birth" v={idDob} />
              <KV k="Address" v={persona.address} />
              <KV k="Completed" v={fmt(persona.completedAt || persona.createdAt)} />
            </div>
            {persona.documents.map((d, i) => (
              <div key={i} className="vsub">
                <div className="row" style={{ justifyContent: 'space-between' }}><strong>Document</strong><Pill t={tone(d.status)}>{d.status}</Pill></div>
                <KV k="Type" v={[d.idClass?.toUpperCase(), d.country].filter(Boolean).join(' · ')} />
                <KV k="Expires" v={d.expires} />
                <Checks checks={d.checks} />
              </div>
            ))}
            {persona.selfies.map((s, i) => (
              <div key={i} className="vsub">
                <div className="row" style={{ justifyContent: 'space-between' }}><strong>Selfie & liveness</strong><Pill t={tone(s.status)}>{s.status}</Pill></div>
                <Checks checks={s.checks} />
              </div>
            ))}
          </div>
        )}
        <span className="small muted">ID images stay in Persona. This page reads the case live and doesn’t copy it into ScoreDate.</span>
        {decideForm('id')}
      </section>

      {/* Photos */}
      <section className="vcard">
        <div className="veyebrow">Photos · face match {awsOn ? 'by AWS' : '(not connected)'}</div>
        {photos.length ? (
          <div className="vphotos">
            {photos.map((x) => (
              <div key={x.id} className="vphoto">
                <div className="vphoto-img">
                  {urlOf.get(x.path) ? <img src={urlOf.get(x.path)} alt="" /> : null}
                  <span className={`vphoto-score ${tone(x.match_status)}`}>{x.match_similarity != null ? `${Number(x.match_similarity)}%` : x.match_status}</span>
                </div>
                <span className="small" style={{ textTransform: 'capitalize' }}>{x.match_status}</span>
                {x.match_reason && <span className="small muted" style={{ overflowWrap: 'anywhere' }}>{x.match_reason}</span>}
                <div className="row" style={{ gap: 6 }}>
                  {x.match_status !== 'approved' && <form action={setPhoto}><input type="hidden" name="user" value={id} /><input type="hidden" name="photo" value={x.id} /><input type="hidden" name="status" value="approved" /><button className="btn ghost sm">Approve</button></form>}
                  {x.match_status !== 'rejected' && <form action={setPhoto}><input type="hidden" name="user" value={id} /><input type="hidden" name="photo" value={x.id} /><input type="hidden" name="status" value="rejected" /><button className="btn ghost sm" style={{ color: 'var(--alert)' }}>Reject</button></form>}
                </div>
              </div>
            ))}
          </div>
        ) : <span className="small muted">No photos yet.</span>}
        {photos.length > 0 && decideForm('photos')}
      </section>

      {/* History */}
      <section className="vcard">
        <div className="veyebrow">Decisions & history</div>
        <div className="vtimeline">
          {reviews.map((r, i) => (
            <div key={`r${i}`} className="vtl">
              <span className={`vtl-dot ${r.decision === 'approved' ? 'ok' : r.decision === 'retry' ? 'warn' : 'plain'}`} />
              <div className="stack" style={{ gap: 2 }}>
                <span className="small"><strong>{r.kind === 'id' ? 'ID' : 'Photos'} · {r.decision === 'retry' ? 'asked to redo' : r.decision}</strong>{r.reason_code ? ` · ${REASONS[r.kind as 'id' | 'photos']?.find((x) => x.code === r.reason_code)?.label || r.reason_code}` : ''}</span>
                {r.member_message && <span className="small">To member: “{r.member_message}”</span>}
                {r.note && <span className="small muted">Note: {r.note}</span>}
                <span className="small muted">{r.staff_email} · {fmt(r.created_at)}</span>
              </div>
            </div>
          ))}
          {verifs.map((v, i) => (
            <div key={`v${i}`} className="vtl">
              <span className={`vtl-dot ${tone(v.status)}`} />
              <span className="small muted">{fmt(v.created_at)} · {v.kind} · {v.provider} · {v.status}{v.detail ? ` · ${v.detail}` : ''}</span>
            </div>
          ))}
          {!reviews.length && !verifs.length && <span className="small muted">No history yet.</span>}
        </div>
      </section>
    </div>
  );
}
