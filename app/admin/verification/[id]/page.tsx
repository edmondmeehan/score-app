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
type Flag = { level: 'bad' | 'warn' | 'ok'; text: string };

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—');
const STEP: Record<string, string> = { signup: 'Profile basics', id_start: 'Started ID check', photos: 'Uploaded photos' };
const color = (s: string) => (/^(passed|approved|completed)$/.test(s) ? 'var(--rise)' : /^(failed|declined|rejected)$/.test(s) ? 'var(--alert)' : 'var(--gold)');
const norm = (s?: string | null) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

function Checks({ checks }: { checks: PersonaCheck[] }) {
  if (!checks.length) return null;
  const failed = checks.filter((c) => c.status !== 'passed');
  const passed = checks.filter((c) => c.status === 'passed');
  return (
    <div className="stack" style={{ gap: 4 }}>
      {failed.map((c) => <span key={c.name} className="small" style={{ color: color(c.status) }}>✕ {c.name}{c.reasons.length ? ` · ${c.reasons.join(', ')}` : ''}</span>)}
      {passed.length > 0 && <span className="small muted">✓ {passed.map((c) => c.name).join(' · ')}</span>}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: React.ReactNode }) {
  if (v == null || v === '') return null;
  return <div className="row small" style={{ gap: 10, alignItems: 'baseline' }}><span className="muted" style={{ width: 120, flex: 'none' }}>{k}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span></div>;
}

export default async function VerificationCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();

  const [{ data: sigs }, { data: phs }, { data: revs }, { data: vers }, { data: sameIp }, { data: zipRow }, personaOn, awsOn] = await Promise.all([
    supabase.from('verification_signals').select('step, ip, city, region, country, lat, lng, user_agent, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('photos').select('id, path, match_status, match_similarity, match_reason, created_at').eq('user_id', id).order('position'),
    supabase.from('verification_reviews').select('kind, decision, reason_code, note, member_message, staff_email, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('verifications').select('kind, provider, provider_ref, status, detail, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(40),
    supabase.rpc('staff_same_ip_accounts', { p_user: id }),
    p.zip ? supabase.from('zip_places').select('map_places(name, lat, lng)').eq('zip', p.zip).maybeSingle() : Promise.resolve({ data: null }),
    personaConfigured(),
    faceMatchConfigured(),
  ]);
  const signals = (sigs || []) as Signal[];
  const photos = (phs || []) as Photo[];
  const reviews = (revs || []) as Review[];
  const verifs = (vers || []) as Ver[];
  const others = (sameIp || []) as { id: string; name: string; status: string }[];
  const home = (zipRow as { map_places?: { name: string; lat: number; lng: number } | null } | null)?.map_places || null;

  // Photo URLs (private bucket, signed for an hour).
  const stored = photos.filter((x) => !/^https?:\/\//.test(x.path));
  const { data: signed } = stored.length ? await supabase.storage.from('photos').createSignedUrls(stored.map((x) => x.path), 3600) : { data: [] };
  const urlOf = new Map<string, string | undefined>(stored.map((x, i) => [x.path, signed?.[i]?.signedUrl ?? undefined] as [string, string | undefined]));
  photos.forEach((x) => { if (/^https?:\/\//.test(x.path)) urlOf.set(x.path, x.path); });

  // Live Persona details for the latest inquiry.
  const inquiryId = verifs.find((v) => v.kind === 'id' && v.provider === 'persona' && v.provider_ref)?.provider_ref || null;
  let persona: PersonaDetails | null = null;
  let personaError: string | null = null;
  if (inquiryId && personaOn) {
    try { persona = await getInquiryDetails(inquiryId); } catch (e) { personaError = (e as Error).message.slice(0, 200); }
  }

  // Flags.
  const flags: Flag[] = [];
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const idName = persona?.name || persona?.documents.find((d) => d.name)?.name;
  const idDob = persona?.birthdate || persona?.documents.find((d) => d.birthdate)?.birthdate;
  if (idName && p.first_name) {
    const first = norm(idName.split(' ')[0]);
    const mine = norm(p.first_name);
    flags.push(first.startsWith(mine.slice(0, 3)) || mine.startsWith(first.slice(0, 3)) ? { level: 'ok', text: `Name matches ID (${idName})` } : { level: 'warn', text: `Profile name “${p.first_name}” vs ID “${idName}”` });
  }
  if (idDob) {
    const y = Number(idDob.slice(0, 4));
    const idAge = Math.floor((Date.now() - new Date(idDob).getTime()) / (365.25 * 86400000));
    if (p.birth_year && Math.abs(y - p.birth_year) > 1) flags.push({ level: 'warn', text: `Profile birth year ${p.birth_year} vs ID ${y}` });
    if (idAge < 25) flags.push({ level: 'bad', text: `ID says ${idAge}, under the 25+ minimum` });
    else flags.push({ level: 'ok', text: `Age ${idAge} per ID` });
  }
  persona?.documents.forEach((d) => { if (d.expires && new Date(d.expires) < new Date()) flags.push({ level: 'bad', text: `ID expired ${d.expires}` }); });
  persona?.sessions.forEach((s) => s.flags.forEach((f) => flags.push({ level: 'warn', text: `${f} during ID check` })));
  const located = [...signals.filter((s) => s.lat != null && s.lng != null).map((s) => ({ lat: Number(s.lat), lng: Number(s.lng), where: [s.city, s.region].filter(Boolean).join(', ') })),
    ...(persona?.sessions || []).filter((s) => s.lat != null).map((s) => ({ lat: s.lat!, lng: s.lng!, where: s.location || '' }))];
  if (home && located.length) {
    const far = located.map((l) => ({ ...l, d: miles(Number(home.lat), Number(home.lng), l.lat, l.lng) })).sort((a, b) => b.d - a.d)[0];
    flags.push(far.d > 150 ? { level: 'warn', text: `Seen ${far.d} mi from their ZIP (${far.where || 'unknown'})` } : { level: 'ok', text: `Location consistent with ZIP ${p.zip} (${home.name})` });
  }
  const countries = [...new Set([...signals.map((s) => s.country), ...(persona?.sessions || []).map((s) => s.location?.split(', ').pop())].filter(Boolean))];
  if (countries.some((c) => c && !/^(US|United States)$/i.test(c))) flags.push({ level: 'warn', text: `Non-US IP seen: ${countries.join(', ')}` });
  if (others.length) flags.push({ level: 'warn', text: `${others.length} other account${others.length === 1 ? '' : 's'} on the same IP` });
  const sims = photos.map((x) => x.match_similarity).filter((x): x is number => x != null).map(Number);
  if (photos.some((x) => /^AWS error/.test(x.match_reason || ''))) flags.push({ level: 'bad', text: 'AWS face match errored (see photos) — check the AWS keys and permissions' });
  else if (sims.length) flags.push(Math.min(...sims) >= 92 ? { level: 'ok', text: `Photos match selfie (${Math.min(...sims)}%+)` } : { level: 'warn', text: `Lowest photo match ${Math.min(...sims)}%` });

  const ago = (d: string) => fmt(d);
  const decideForm = (kind: 'id' | 'photos') => (
    <form action={decideVerification} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="user" value={id} /><input type="hidden" name="kind" value={kind} />
      <label className="field small">If asking for a redo, why?
        <select className="input" name="reason" defaultValue={REASONS[kind][0].code}>{REASONS[kind].map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select>
      </label>
      <label className="field small">Message to the member (optional — leave blank to use the standard text for that reason)
        <textarea className="input" name="message" rows={3} maxLength={1000} placeholder="Example: Your second photo has sunglasses on. Swap it for one where we can see your eyes." />
      </label>
      <label className="field small">Internal note (staff only)
        <textarea className="input" name="note" rows={2} maxLength={2000} placeholder="What you checked and why" />
      </label>
      <label className="choice small"><input type="checkbox" name="notify" defaultChecked style={{ accentColor: 'var(--gold)' }} /> Email the member</label>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn sm" name="decision" value="approved">Approve {kind === 'id' ? 'ID' : 'photos in review'}</button>
        <button className="btn ghost sm" name="decision" value="retry">Ask to redo</button>
        <button className="btn ghost sm" name="decision" value="note">Save note only</button>
      </div>
    </form>
  );

  return (
    <>
      <Link href="/admin/verification" className="small muted">‹ Verification queue</Link>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
        <h1 className="serif" style={{ fontSize: 40, margin: 0 }}>{p.first_name || p.email}</h1>
        <span className="chip small" style={{ color: color(p.id_status) }}>ID: {p.id_status}</span>
        <span className="chip small" style={{ color: color(p.photo_status) }}>Photos: {p.photo_status}</span>
        <Link href={`/admin/members/${id}`} className="small">Member page ›</Link>
      </div>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <section className="card stack" style={{ gap: 6 }}>
          <strong>Profile</strong>
          <Row k="Email" v={p.email} />
          <Row k="Age" v={age != null ? `${age} (born ${p.birth_year})` : null} />
          <Row k="Gender" v={p.gender} />
          <Row k="ZIP" v={p.zip ? `${p.zip}${home ? ` · ${home.name}` : ''}` : null} />
          <Row k="Neighborhood" v={p.neighborhood} />
          <Row k="Job" v={p.job} />
          <Row k="Band" v={p.band ? `${p.band}${p.credit_verified_at ? ' · verified' : ' · self-reported'}` : null} />
          <Row k="Plan / status" v={`${p.plan} · ${p.status}`} />
          <Row k="Joined" v={fmt(p.created_at)} />
        </section>

        <section className="card stack" style={{ gap: 6 }}>
          <strong>Flags</strong>
          {flags.length ? flags.map((f, i) => (
            <span key={i} className="small" style={{ color: f.level === 'bad' ? 'var(--alert)' : f.level === 'warn' ? 'var(--gold)' : 'var(--rise)' }}>{f.level === 'ok' ? '✓' : f.level === 'bad' ? '✕' : '!'} {f.text}</span>
          )) : <span className="small muted">No signals yet. Location and device are recorded from the next signup or upload step.</span>}
          {others.length > 0 && <div className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>{others.map((o) => <Link key={o.id} href={`/admin/verification/${o.id}`}>{o.name} ({o.status})</Link>)}</div>}
        </section>
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <strong>ID check (Persona)</strong>
          {persona && <a href={persona.dashboardUrl} target="_blank" rel="noopener noreferrer" className="small">Open in Persona ↗</a>}
        </div>
        {!personaOn && <span className="small muted">Persona isn’t connected, so ID checks run in test mode.</span>}
        {personaOn && !inquiryId && <span className="small muted">No Persona inquiry on file for this member yet.</span>}
        {personaError && <span className="small" style={{ color: 'var(--alert)' }}>Couldn’t load the inquiry: {personaError}</span>}
        {persona && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="stack" style={{ gap: 6 }}>
              <Row k="Status" v={<span style={{ color: color(persona.status) }}>{persona.status}</span>} />
              <Row k="Name on ID" v={idName} />
              <Row k="Date of birth" v={idDob} />
              <Row k="Address" v={persona.address} />
              <Row k="Started" v={fmt(persona.createdAt)} />
              <Row k="Completed" v={fmt(persona.completedAt)} />
              <Row k="Inquiry" v={<span className="mono">{persona.id}</span>} />
            </div>
            {persona.documents.map((d, i) => (
              <div key={i} className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>Document · <span style={{ color: color(d.status) }}>{d.status}</span></span>
                <Row k="Type" v={[d.idClass?.toUpperCase(), d.country].filter(Boolean).join(' · ')} />
                <Row k="Expires" v={d.expires} />
                <Checks checks={d.checks} />
              </div>
            ))}
            {persona.selfies.map((s, i) => (
              <div key={i} className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>Selfie & liveness · <span style={{ color: color(s.status) }}>{s.status}</span></span>
                <Checks checks={s.checks} />
              </div>
            ))}
            {persona.sessions.map((s, i) => (
              <div key={i} className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>Device during ID check</span>
                <Row k="IP" v={s.ip} />
                <Row k="Location" v={s.location} />
                <Row k="Network" v={s.isp} />
                <Row k="Device" v={[s.device, s.os, s.browser].filter(Boolean).join(' · ')} />
                {s.flags.length > 0 && <span className="small" style={{ color: 'var(--gold)' }}>{s.flags.join(' · ')}</span>}
              </div>
            ))}
          </div>
        )}
        <span className="small muted">ID images stay in Persona. This page reads the case live and doesn’t copy it into ScoreDate.</span>
        {decideForm('id')}
      </section>

      <section className="card stack" style={{ gap: 10 }}>
        <strong>Photos</strong>
        {!awsOn && <span className="small muted">AWS face match isn’t connected, so every photo needs a person.</span>}
        {photos.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {photos.map((x) => (
              <div key={x.id} className="stack" style={{ gap: 6 }}>
                <div className="photo">{urlOf.get(x.path) ? <img src={urlOf.get(x.path)} alt="" /> : null}</div>
                <span className="small" style={{ color: color(x.match_status) }}>{x.match_status}{x.match_similarity != null ? ` · ${Number(x.match_similarity)}%` : ''}</span>
                {x.match_reason && <span className="small muted" style={{ overflowWrap: 'anywhere' }}>{x.match_reason}</span>}
                <div className="row" style={{ gap: 6 }}>
                  {x.match_status !== 'approved' && <form action={setPhoto}><input type="hidden" name="user" value={id} /><input type="hidden" name="photo" value={x.id} /><input type="hidden" name="status" value="approved" /><button className="btn ghost sm">Approve</button></form>}
                  {x.match_status !== 'rejected' && <form action={setPhoto}><input type="hidden" name="user" value={id} /><input type="hidden" name="photo" value={x.id} /><input type="hidden" name="status" value="rejected" /><button className="btn danger sm">Reject</button></form>}
                </div>
              </div>
            ))}
          </div>
        ) : <span className="small muted">No photos yet.</span>}
        {photos.length > 0 && decideForm('photos')}
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <strong>IP & device history</strong>
        {signals.length ? (
          <div className="scroll-x" style={{ overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%' }}>
              <thead><tr><th>When</th><th>Step</th><th>IP</th><th>Location</th><th>From ZIP</th><th>Device</th></tr></thead>
              <tbody>{signals.map((s, i) => {
                const ua = s.user_agent ? parseUA(s.user_agent) : null;
                const d = home && s.lat != null && s.lng != null ? miles(Number(home.lat), Number(home.lng), Number(s.lat), Number(s.lng)) : null;
                return <tr key={i}><td className="small">{ago(s.created_at)}</td><td className="small">{STEP[s.step] || s.step}</td><td className="mono small">{s.ip || '—'}</td><td className="small">{[s.city, s.region, s.country].filter(Boolean).join(', ') || '—'}</td><td className="small">{d != null ? `${d} mi` : '—'}</td><td className="small">{ua ? `${ua.device} · ${ua.os} · ${ua.browser}` : '—'}</td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : <span className="small muted">Nothing recorded yet. IP, approximate location and device are captured at profile basics, the ID check and photo upload (kept 180 days).</span>}
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <strong>Decisions & history</strong>
        {reviews.map((r, i) => (
          <div key={i} className="stack" style={{ gap: 2, borderTop: i ? '1px solid var(--line-soft)' : undefined, paddingTop: i ? 8 : 0 }}>
            <span className="small"><strong>{r.kind === 'id' ? 'ID' : 'Photos'} · {r.decision === 'retry' ? 'asked to redo' : r.decision}</strong>{r.reason_code ? ` · ${REASONS[r.kind as 'id' | 'photos']?.find((x) => x.code === r.reason_code)?.label || r.reason_code}` : ''} <span className="muted">· {r.staff_email} · {ago(r.created_at)}</span></span>
            {r.member_message && <span className="small">To member: “{r.member_message}”</span>}
            {r.note && <span className="small muted">Note: {r.note}</span>}
          </div>
        ))}
        {verifs.map((v, i) => (
          <span key={`v${i}`} className="small muted">{ago(v.created_at)} · {v.kind} · {v.provider} · <span style={{ color: color(v.status) }}>{v.status}</span>{v.detail ? ` · ${v.detail}` : ''}</span>
        ))}
        {!reviews.length && !verifs.length && <span className="small muted">No history yet.</span>}
      </section>
    </>
  );
}
