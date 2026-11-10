import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { BandPill } from '@/components/ui';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';
import { DRINKING, EDUCATION, EXERCISE, HAS_KIDS, LOOKING_FOR, PETS, POLITICS, RELIGION, SMOKING, WANTS_KIDS, label } from '@/lib/profileDetails';
import { staffAct } from '../../actions';
import { testPush } from './pushActions';

export const dynamic = 'force-dynamic';

type Overview = {
  spend: { gross: number; refunds: number; net: number; takehome: number; payments: number; first_paid: string | null; last_paid: string | null; renews: string | null; addons: Record<string, number>; addon_left: Record<string, number> };
  history: { at: string; type: string; product_id: string | null; plan: string | null; store: string | null; price_usd: number | null; environment: string | null }[];
  activity: Record<string, number>;
  growth: { invited_by: { id: string; name: string | null } | null; invites_sent: number; invites_redeemed: number; referred: { id: string; name: string | null }[] };
  safety: Record<string, number>;
  last_sign_in: string | null;
};
type Usage = { opens_7d: number; opens_30d: number; app_opens_30d: number; days_active_30d: number; minutes_30d: number; avg_minutes: number; last_open: string | null; first_tracked: string | null; by_day: { d: string; n: number }[] };

const TZ = 'America/New_York';
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) : '—');
const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '—');
const usd = (n?: number | null) => (n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 }));
function ago(d?: string | null) {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} hr ago`;
  const days = Math.round(m / 1440);
  return days < 31 ? `${days} day${days === 1 ? '' : 's'} ago` : day(d);
}
function tenure(d: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
  if (days < 1) return 'Joined today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30.4);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(months / 12)} yr ${months % 12} mo`;
}
const PLAN_NAME: Record<string, string> = { none: 'No plan', preview: 'Preview', membership: 'Membership', premium: 'Premium', black: 'Reserve', paused: 'Paused' };
const ADDON_NAME: Record<string, string> = { extra_drop: '+5 more', spotlight: 'Spotlight', note: 'Notes', extra_connections: 'Extra connections' };

function Stat({ k, v, sub, tone }: { k: string; v: React.ReactNode; sub?: React.ReactNode; tone?: 'gold' | 'alert' }) {
  return (
    <div className="card stack" style={{ gap: 4, padding: 14 }}>
      <span className="label">{k}</span>
      <span className="serif" style={{ fontSize: 28, lineHeight: 1.1, color: tone === 'gold' ? 'var(--gold-light)' : tone === 'alert' ? 'var(--alert)' : undefined }}>{v}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="row small" style={{ justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}><span className="muted">{k}</span><span style={{ textAlign: 'right' }}>{v ?? '—'}</span></div>;
}
function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}><h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export default async function MemberDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; push?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();
  const [{ data: ver }, { data: log }, { data: ov, error: ovErr }, { data: social }, photos, { data: us }] = await Promise.all([
    supabase.from('verifications').select('kind, provider, status, detail, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('audit_log').select('*').eq('target_user', id).order('created_at', { ascending: false }).limit(20),
    supabase.rpc('staff_member_overview', { p_user: id }),
    supabase.from('profile_socials').select('instagram, instagram_public').eq('user_id', id).maybeSingle(),
    photoUrls(supabase, [id], false),
    supabase.rpc('staff_member_usage', { p_user: id }),
  ]);
  const { data: ps } = await supabase.rpc('staff_push_status', { p_user: id });
  const push = ps as { devices: { platform: string; tail: string; registered: string; seen: string; last_push: string | null; result: string | null }[]; web: number; recent: { at: string; title: string; push: string; email: string }[] } | null;
  const o = (ov as Overview | null) || null;
  const u = (us as Usage | null) || null;
  const peak = Math.max(1, ...(u?.by_day || []).map((x) => x.n));
  const pics = photos[id] || [];
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const height = p.height_cm ? `${Math.floor(p.height_cm / 2.54 / 12)}′${Math.round(p.height_cm / 2.54) % 12}″` : null;
  const back = `/admin/members/${id}`;
  const act = (action: string, text: string, cls = 'btn ghost sm') => (
    <form action={staffAct}><input type="hidden" name="action" value={action} /><input type="hidden" name="user" value={id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="reason" value={`${text} from member page`} /><button className={cls}>{text}</button></form>
  );
  const a = o?.activity || {};
  const s = o?.safety || {};
  const paid = ['membership', 'premium', 'black'].includes(p.plan);

  return (
    <>
      <Link href="/admin/members" className="small muted">‹ All members</Link>
      {sp.error && <div className="notice error">{sp.error}</div>}

      {/* Header */}
      <section className="card" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', padding: 20 }}>
        <div style={{ width: 112, height: 112, borderRadius: 24, overflow: 'hidden', background: 'var(--line)', flex: 'none' }}>
          {pics[0] ? <img src={pics[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="serif" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 44, color: 'var(--faint)' }}>{(p.first_name || p.email || '?')[0]?.toUpperCase()}</div>}
        </div>
        <div className="stack grow" style={{ gap: 8, minWidth: 240 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h1 className="serif" style={{ fontSize: 40, lineHeight: 1 }}>{p.first_name || 'No name yet'}</h1>
            <span className="muted">{[age, p.gender, p.neighborhood || p.borough].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <BandPill band={p.band} trend={p.trend} verified={Boolean(p.credit_verified_at)} />
            <span className="chip" style={{ textTransform: 'capitalize' }}>{p.status}</span>
            <span className="chip" style={paid ? { borderColor: 'var(--gold-edge)', color: 'var(--gold-light)' } : undefined}>{PLAN_NAME[p.plan] || p.plan}</span>
            {p.is_founder && <span className="chip" style={{ borderColor: 'var(--gold-edge)', color: 'var(--gold-light)' }}>Founding Member</span>}
            {p.spotlight_until && new Date(p.spotlight_until) > new Date() && <span className="chip">Spotlight on</span>}
          </div>
          <span className="small muted">{p.email} · Active {ago(p.last_active_at)} · Last sign-in {ago(o?.last_sign_in)} · <span className="mono" style={{ fontSize: 11 }}>{p.id}</span></span>
        </div>
      </section>

      {ovErr && <div className="notice">Run migration 0049 in the SQL Editor to see spending and activity for this member.</div>}

      {/* Key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Stat k="Lifetime spend" v={usd(o?.spend.gross ?? 0)} sub={o ? `${o.spend.payments} payment${o.spend.payments === 1 ? '' : 's'}${o.spend.refunds ? ` · ${usd(o.spend.refunds)} refunded` : ''}` : undefined} tone="gold" />
        <Stat k="After store fees" v={usd(o?.spend.takehome ?? 0)} sub="Estimated take-home" />
        <Stat k="Member for" v={tenure(p.created_at)} sub={`Since ${day(p.created_at)}`} />
        <Stat k="Paying since" v={o?.spend.first_paid ? tenure(o.spend.first_paid) : 'Not yet'} sub={o?.spend.renews ? `Renews ${day(o.spend.renews)}` : o?.spend.last_paid ? `Last paid ${day(o.spend.last_paid)}` : undefined} />
        <Stat k="Opens (30 days)" v={u?.opens_30d ?? '—'} sub={u ? `${u.days_active_30d} of 30 days active · ${u.app_opens_30d} in the app` : 'Run migration 0051'} />
        <Stat k="Matches & chats" v={a.conversations ?? 0} sub={`${a.active_chats ?? 0} active · ${a.messages_sent ?? 0} messages sent`} />
        <Stat k="Likes received" v={a.likes_received ?? 0} sub={`${a.views_30d ?? 0} profile views in 30 days`} />
        <Stat k="Reports against" v={s.reports_against ?? 0} sub={s.reports_open ? `${s.reports_open} open` : 'None open'} tone={s.reports_open ? 'alert' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Billing */}
        <Section title="Membership & billing">
          <Row k="Plan" v={`${PLAN_NAME[p.plan] || p.plan}${(p as Profile & { plan_store?: string }).plan_store ? ` · ${({ app_store: 'App Store', play_store: 'Google Play', stripe: 'Web' } as Record<string, string>)[(p as Profile & { plan_store?: string }).plan_store!] || (p as Profile & { plan_store?: string }).plan_store}` : ''}`} />
          {p.plan === 'preview' && <Row k="Preview ends" v={day(p.preview_ends_at)} />}
          <Row k="First payment" v={day(o?.spend.first_paid)} />
          <Row k="Last payment" v={day(o?.spend.last_paid)} />
          <Row k="Renews / expires" v={day(o?.spend.renews)} />
          <Row k="Net after refunds" v={usd(o?.spend.net ?? 0)} />
          <Row k="Add-ons bought" v={o && Object.keys(o.spend.addons).length ? Object.entries(o.spend.addons).map(([k, n]) => `${ADDON_NAME[k] || k} ×${n}`).join(' · ') : 'None'} />
          <Row k="Add-ons left" v={o && Object.keys(o.spend.addon_left).length ? Object.entries(o.spend.addon_left).map(([k, n]) => `${ADDON_NAME[k] || k} ${n}`).join(' · ') : 'None'} />
          {o && o.history.length > 0 && (
            <div className="stack" style={{ gap: 0, marginTop: 8 }}>
              <span className="label" style={{ marginBottom: 4 }}>Payment history</span>
              {o.history.map((h, i) => (
                <div key={i} className="row small" style={{ justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span className="muted" style={{ minWidth: 92 }}>{day(h.at)}</span>
                  <span className="grow" style={{ textTransform: 'capitalize' }}>{h.type.replace(/_/g, ' ').toLowerCase()}{h.plan ? ` · ${PLAN_NAME[h.plan] || h.plan}` : ''}{h.environment === 'SANDBOX' ? ' · test' : ''}</span>
                  <span style={{ color: (h.price_usd || 0) < 0 ? 'var(--alert)' : undefined }}>{h.price_usd == null ? '' : usd(h.price_usd)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Usage */}
        <Section title="App usage" right={<span className="small muted">Last open {ago(u?.last_open)}</span>}>
          {u ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 4 }}>
                {([['Opens · 7 days', u.opens_7d], ['Opens · 30 days', u.opens_30d], ['Days active', `${u.days_active_30d}/30`], ['Minutes · 30 days', u.minutes_30d]] as [string, number | string][]).map(([k, v]) => (
                  <div key={k} className="stack" style={{ gap: 2, padding: 10, borderRadius: 12, background: 'var(--onyx)', border: '1px solid var(--line-soft)' }}>
                    <span className="serif" style={{ fontSize: 22 }}>{v}</span><span className="small muted" style={{ fontSize: 12 }}>{k}</span>
                  </div>
                ))}
              </div>
              <div aria-label="Opens per day, last 30 days" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64, marginTop: 12 }}>
                {u.by_day.map((x) => <div key={x.d} title={`${x.d}: ${x.n} open${x.n === 1 ? '' : 's'}`} style={{ flex: 1, height: `${Math.max(4, (x.n / peak) * 100)}%`, borderRadius: 3, background: x.n ? 'var(--gold)' : 'var(--line)' }} />)}
              </div>
              <div className="row small muted" style={{ justifyContent: 'space-between', fontSize: 11 }}><span>30 days ago</span><span>Today</span></div>
              <span className="small muted">About {u.avg_minutes} min per visit · {u.app_opens_30d} of {u.opens_30d} opens in the iPhone app.{u.first_tracked ? ` Tracking since ${day(u.first_tracked)}.` : ' Starts counting from their next visit.'}</span>
            </>
          ) : <span className="small muted">Run migration 0051 to start tracking app opens.</span>}
        </Section>

        {/* Activity */}
        <Section title="Activity">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
            {([['Likes sent', a.likes_sent], ['Likes received', a.likes_received], ['Profile views', a.views_received], ['Views (30 days)', a.views_30d], ['People in Drops', a.drops_received], ['Messages sent', a.messages_sent], ['Dates planned', a.dates_planned], ['Dates confirmed', a.dates_accepted], ['Events RSVP’d', a.events_rsvp], ['Events attended', a.events_attended], ['Chats', a.conversations], ['Active chats', a.active_chats]] as [string, number | undefined][]).map(([k, v]) => (
              <div key={k} className="stack" style={{ gap: 2, padding: 10, borderRadius: 12, background: 'var(--onyx)', border: '1px solid var(--line-soft)' }}>
                <span className="serif" style={{ fontSize: 22 }}>{v ?? 0}</span>
                <span className="small muted" style={{ fontSize: 12 }}>{k}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Profile */}
        <Section title="Profile">
          <Row k="Job" v={p.job} />
          <Row k="Looking for" v={label(LOOKING_FOR, p.looking_for)} />
          <Row k="Interested in" v={(p.seeking || []).join(', ') || null} />
          <Row k="Home" v={[p.neighborhood, p.borough, p.zip].filter(Boolean).join(' · ') || null} />
          <Row k="Height" v={height} />
          <Row k="Education" v={label(EDUCATION, p.education)} />
          <Row k="Kids" v={[label(HAS_KIDS, p.has_kids), label(WANTS_KIDS, p.wants_kids)].filter(Boolean).join(' · ') || null} />
          <Row k="Drinks · smokes · exercise" v={[label(DRINKING, p.drinking), label(SMOKING, p.smoking), label(EXERCISE, p.exercise)].map((x) => x || '—').join(' · ')} />
          <Row k="Pets" v={label(PETS, p.pets)} />
          <Row k="Religion · politics" v={[label(RELIGION, p.religion), label(POLITICS, p.politics)].map((x) => x || '—').join(' · ')} />
          <Row k="Song" v={p.song_title ? `${p.song_title}${p.song_artist ? ` · ${p.song_artist}` : ''}` : null} />
          <Row k="Instagram" v={social?.instagram ? <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noopener noreferrer">@{social.instagram}{social.instagram_public ? '' : ' (private)'}</a> : null} />
          {(p.money_values || []).length > 0 && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{p.money_values.map((v) => <span key={v} className="chip" style={{ fontSize: 12, padding: '5px 10px' }}>{v}</span>)}</div>}
          {(p.flag_habit || p.flag_splurge) && <span className="small muted" style={{ marginTop: 6 }}>{p.flag_habit}{p.flag_splurge ? ` · Splurges on ${p.flag_splurge}` : ''}{p.flag_save ? `, saves on ${p.flag_save}` : ''}</span>}
          {(p.prompts || []).map((pr) => <div key={pr.q} className="stack" style={{ gap: 2, marginTop: 8 }}><span className="small muted">{pr.q}</span><span className="small">{pr.a}</span></div>)}
          {(p.my_nyc || []).length > 0 && <span className="small muted" style={{ marginTop: 8 }}>My NYC: {(p.my_nyc || []).map((x) => x.name).join(' · ')}</span>}
        </Section>

        <div className="stack" style={{ gap: 16 }}>
          {/* Verification */}
          <Section title="Verification">
            <Row k="ID" v={<span style={{ textTransform: 'capitalize' }}>{p.id_status}</span>} />
            <Row k="Photos" v={<span style={{ textTransform: 'capitalize' }}>{p.photo_status}</span>} />
            <Row k="Credit band confirmed" v={p.credit_verified_at ? day(p.credit_verified_at) : 'Not yet'} />
            {(ver || []).map((v, i) => <span key={i} className="small muted">{when(v.created_at)} · {v.kind} · {v.provider} · {v.status}{v.detail ? ` · ${v.detail}` : ''}</span>)}
            <span className="small muted" style={{ marginTop: 4 }}>ScoreDate never stores exact credit scores, reports or ID images.</span>
          </Section>

          {/* Growth */}
          <Section title="Invites & referrals">
            <Row k="Invited by" v={o?.growth.invited_by ? <Link href={`/admin/members/${o.growth.invited_by.id}`}>{o.growth.invited_by.name || 'Member'}</Link> : '—'} />
            <Row k="Invites sent" v={o ? `${o.growth.invites_sent} (${o.growth.invites_redeemed} used)` : '—'} />
            {o && o.growth.referred.length > 0 && <div className="row small" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}><span className="muted">Brought in:</span>{o.growth.referred.map((r) => <Link key={r.id} href={`/admin/members/${r.id}`}>{r.name || 'Member'}</Link>)}</div>}
          </Section>

          {/* Push */}
          <section id="push" className="card stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Push notifications</h2>
              <form action={testPush}><input type="hidden" name="id" value={id} /><button className="btn ghost sm">Send a test push</button></form>
            </div>
            {sp.push && <div className="notice small">{sp.push}</div>}
            {!push ? <span className="small muted">Run migration 0055 to see push status.</span> : (
              <>
                {push.devices.length === 0 ? <span className="small muted">No phone registered yet. It registers when they open the app and allow notifications.</span>
                  : push.devices.map((d) => (
                    <Row key={d.tail} k={`${d.platform === 'ios' ? 'iPhone' : 'Android'} …${d.tail}`} v={<span>Registered {day(d.registered)} · seen {ago(d.seen)}{d.last_push ? <><br /><span className="muted">Last push {ago(d.last_push)}: {d.result}</span></> : null}</span>} />
                  ))}
                <Row k="Web push (browser)" v={push.web ? `${push.web} browser${push.web === 1 ? '' : 's'}` : 'None'} />
                {push.recent.length > 0 && <span className="small muted" style={{ marginTop: 4 }}>Recent: {push.recent.map((r) => `${r.title} (push ${r.push})`).join(' · ')}</span>}
              </>
            )}
          </section>

          {/* Safety */}
          <Section title="Trust & support">
            <Row k="Reports against" v={`${s.reports_against ?? 0}${s.reports_open ? ` (${s.reports_open} open)` : ''}`} />
            <Row k="Reports they made" v={s.reports_made ?? 0} />
            <Row k="Blocked by" v={`${s.blocked_by ?? 0} member${s.blocked_by === 1 ? '' : 's'}`} />
            <Row k="Support tickets" v={<Link href="/admin/support">{`${s.tickets ?? 0}${s.tickets_open ? ` (${s.tickets_open} open)` : ''}`}</Link>} />
          </Section>
        </div>
      </div>

      {pics.length > 1 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>{pics.map((u) => <div key={u} className="photo"><img src={u} alt="" /></div>)}</div>}

      <Section title="Actions">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {act('approve_id', 'Approve ID')}{act('decline_id', 'Decline ID')}{act('approve_photos', 'Approve photos')}{act('suspend', 'Suspend')}{act('reinstate', 'Reinstate')}{act('remove', 'Remove', 'btn danger sm')}
        </div>
      </Section>

      <Section title="Staff history">
        {(log || []).length ? (log || []).map((l) => <span key={l.id} className="small muted">{when(l.created_at)} · {l.staff_email} · {l.action}{l.reason ? ` · ${l.reason}` : ''}</span>) : <span className="small muted">No staff actions yet.</span>}
      </Section>
    </>
  );
}
