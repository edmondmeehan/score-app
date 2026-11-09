import Link from 'next/link';
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge';
import { requireMember } from '@/lib/session';
import { BandPill, age } from '@/components/ui';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';
import { answerDaily, checkIn, dateAgain, useExtraDrop, useSpotlight } from './features';
import PushPrompt from '@/components/PushPrompt';
import FounderBadge from '@/components/FounderBadge';
import { getCreditMode } from '@/lib/creditMode';
import DropCountdown from '@/components/DropCountdown';
import { dropReason, dropTimeLabel, nextDropAt, publicTrend } from '@/lib/engagement';

export const dynamic = 'force-dynamic';

type Checkin = { plan_id: string; place: string; starts_at: string; conversation_id: string; match: string; other_id: string };
type Again = { plan_id: string; place: string; conversation_id: string; match: string };
type Daily = { id: number; q: string; options: string[]; mine: string | null } | null;
type Mine = { included: boolean; extra_drop: number; spotlight: number; note: number; spotlight_until: string | null };

export default async function Drop({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (me.status === 'paused' || me.status === 'taken') {
    return (
      <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <h1 className="serif" style={{ fontSize: 36 }}>{me.status === 'taken' ? 'Matched on ScoreDate' : 'You’re paused'}</h1>
        <p className="muted">You’re hidden from matching. Your chats and friends are still here.</p>
        <Link className="btn block" href="/app/settings">Change status</Link>
      </div>
    );
  }
  const [{ data: drop }, { data: mineData }, { data: checkinData }, { data: unread }, { data: againData }, { data: dailyData }, { data: wildId }] = await Promise.all([
    supabase.rpc('get_drop'), supabase.rpc('my_addons'), supabase.rpc('pending_checkins'), supabase.rpc('unread_notifications'),
    supabase.rpc('pending_again'), supabase.rpc('todays_question'), supabase.rpc('get_wildcard'),
  ]);
  const again = (againData as Again[] | null) || [];
  const daily = (dailyData as Daily) || null;
  const bell = Number(unread) || 0;
  const mine = (mineData as Mine) || { included: false, extra_drop: 0, spotlight: 0, note: 0, spotlight_until: null };
  const checkins = (checkinData as Checkin[]) || [];
  const spotlightUntil = mine.spotlight_until ? new Date(mine.spotlight_until) : null;
  const now = Date.now();
  const dropIds = (drop || []).map((d: { match_id: string }) => d.match_id);
  const wild = typeof wildId === 'string' && !dropIds.includes(wildId) ? wildId : null;
  const ids = wild ? [...dropIds, wild] : dropIds;
  const { data: people } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
  const byId = Object.fromEntries((people || []).map((p: Profile) => [p.id, p]));
  const photos = await photoUrls(supabase, ids);
  const preview = me.plan === 'preview';
  const creditMode = await getCreditMode();
  const daysLeft = me.preview_ends_at ? Math.max(0, Math.ceil((new Date(me.preview_ends_at).getTime() - Date.now()) / 86400000)) : null;
  return (
    <div className="phone">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{preview ? 'Preview' : 'Today'}</span>
        <span className="row" style={{ gap: 12 }}>
          {preview && daysLeft !== null && <span className="mono small muted">{daysLeft} days left</span>}
          <Link href="/app/likes" aria-label="Likes" style={{ color: 'inherit', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
          </Link>
          <Link href="/app/search" aria-label="Search members" style={{ color: 'inherit', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </Link>
          <Link href="/app/activity" aria-label={bell ? `Activity, ${bell} new` : 'Activity'} style={{ position: 'relative', color: 'inherit', display: 'inline-flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {bell > 0 && <span className="mono" style={{ position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>{bell > 9 ? '9+' : bell}</span>}
          </Link>
        </span>
      </div>
      {creditMode === 'verified' && me.band && !me.credit_verified_at && (
        <Link href="/onboarding/credit" className="card row" style={{ textDecoration: 'none', color: 'inherit', justifyContent: 'space-between', borderColor: 'var(--gold-edge)' }}>
          <span className="stack" style={{ gap: 2 }}><strong>Verify your band</strong><span className="small muted">Your band is self-reported. A one-minute soft check makes it verified.</span></span><span aria-hidden>›</span>
        </Link>
      )}
      <h1 className="serif" style={{ fontSize: 40 }}>{preview ? 'Your 5 matches' : 'Your Daily Drop'}</h1>
      <span className="muted small">{preview ? 'Look all you want. Members can say hello, or send a Note.' : `New people every night at ${dropTimeLabel()} ET`}</span>
      {!preview && <DropCountdown at={nextDropAt().toISOString()} label={`${dropTimeLabel()} ET`} />}
      {sp.ok && <div className="notice">{sp.ok}</div>}
      <PushPrompt />
      {sp.error && <div className="notice error">{sp.error}</div>}
      {checkins.map((c) => (
          <div key={c.plan_id} className="card gold stack" style={{ gap: 10 }}>
            <span className="label">Check in</span>
            <span className="serif" style={{ fontSize: 24 }}>How was {c.place} with {c.match}?</span>
            <span className="small muted">Just for you. {c.match} never sees this.</span>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {([['safe', 'All good'], ['not_great', 'Not great'], ['report', 'Something was wrong']] as const).map(([v, l]) => (
                <form key={v} action={checkIn}><input type="hidden" name="plan_id" value={c.plan_id} /><input type="hidden" name="status" value={v} /><input type="hidden" name="other_id" value={c.other_id} /><button className={v === 'safe' ? 'btn sm' : 'btn ghost sm'}>{l}</button></form>
              ))}
            </div>
            <span className="small muted">In danger right now? Call 911.</span>
          </div>
      ))}
      {again.map((a) => (
        <div key={a.plan_id} className="card gold stack" style={{ gap: 10 }}>
          <span className="label">One more question</span>
          <span className="serif" style={{ fontSize: 24 }}>Would you see {a.match} again?</span>
          <span className="small muted">Private. {a.match} only hears about it if you both say yes.</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {([['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']] as const).map(([v, l]) => (
              <form key={v} action={dateAgain}><input type="hidden" name="plan_id" value={a.plan_id} /><input type="hidden" name="conversation_id" value={a.conversation_id} /><input type="hidden" name="again" value={v} /><button className={v === 'yes' ? 'btn sm' : 'btn ghost sm'} data-haptic={v === 'yes' ? 'success' : undefined}>{l}</button></form>
            ))}
          </div>
        </div>
      ))}
      {daily && (
        <div id="daily" className="card stack daily-q" style={{ gap: 10 }}>
          <span className="label">Today’s question</span>
          <span className="serif" style={{ fontSize: 24, lineHeight: 1.15 }}>{daily.q}</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {daily.options.map((o) => (
              <form key={o} action={answerDaily}><input type="hidden" name="question_id" value={daily.id} /><input type="hidden" name="answer" value={o} /><button className={daily.mine === o ? 'btn sm' : 'btn ghost sm'} aria-pressed={daily.mine === o}>{o}</button></form>
            ))}
          </div>
          <span className="small muted">{daily.mine ? 'Saved. Matches who picked the same see it in your chat.' : 'Matches who pick the same answer see it in your chat.'}</span>
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <form action={useExtraDrop}><input type="hidden" name="return" value="/app" /><button className="btn ghost sm" disabled={!mine.included && mine.extra_drop < 1} title="Add 5 more people to today's Drop">+5 more today{!mine.included ? ` (${mine.extra_drop})` : ''}</button></form>
        <form action={useSpotlight}><input type="hidden" name="return" value="/app" /><button className="btn ghost sm" disabled={Boolean(spotlightUntil) || (!mine.included && mine.spotlight < 1)}>{spotlightUntil ? `Spotlight on until ${spotlightUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}` : `Spotlight${!mine.included ? ` (${mine.spotlight})` : ''}`}</button></form>
        <Link href="/app/shop" className="btn ghost sm">Add-ons</Link>
        <Link href="/app/map" className="btn ghost sm">Map</Link>
      </div>
      {(drop || []).length === 0 && (
        <div className="card stack" style={{ textAlign: 'center', padding: 32 }}>
          <span className="serif" style={{ fontSize: 26 }}>That&apos;s everyone for now</span>
          <span className="small muted">New members join with every drop. Invite someone you&apos;d vouch for.</span>
          <Link href="/app/invites" className="btn ghost sm">Send an invite</Link>
        </div>
      )}
      <div className="stack">
        <Link href="/app/blind" className="card gold row" style={{ textDecoration: 'none', color: 'inherit', gap: 14 }} data-haptic="light">
          <span className="serif" style={{ fontSize: 34, color: 'var(--gold-light)', lineHeight: 1 }}>?</span>
          <span className="stack grow" style={{ gap: 2 }}><strong>Hot or Financially Compatible?</strong><span className="small muted">Five money questions. See your compatibility before you see a photo.</span></span>
          <span style={{ color: 'var(--gold)' }}>→</span>
        </Link>
        {(drop || []).map((d: { match_id: string; compat: number }) => {
          const p = byId[d.match_id];
          if (!p) return null;
          const why = dropReason(me, p);
          return (
            <Link key={d.match_id} href={`/app/u/${p.id}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ivory)', padding: 12 }}>
              <div className="photo" style={{ width: 76, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</div>
              <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                <span><strong style={{ fontSize: 17 }}>{p.first_name}</strong> <span className="muted">{age(p.birth_year)}</span>{p.spotlight_until && new Date(p.spotlight_until).getTime() > now && <span className="chip" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', color: 'var(--gold-light)' }}>Featured</span>}{p.is_founder && <span style={{ marginLeft: 8 }}><FounderBadge /></span>}{isVerified(p) && <span style={{ marginLeft: 6 }}><VerifiedBadge credit={Boolean(p.credit_verified_at)} /></span>}</span>
                <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.job, p.neighborhood].filter(Boolean).join(' · ')}</span>
                <BandPill band={p.band} trend={publicTrend(p)} verified={Boolean(p.credit_verified_at)} />
                {why && <span className="drop-reason">{why}</span>}
              </div>
              <div className="stack" style={{ alignItems: 'flex-end', gap: 0 }}><span className="serif" style={{ fontSize: 30, color: 'var(--gold-light)' }}>{d.compat}%</span><span className="small muted">match</span></div>
            </Link>
          );
        })}
        {wild && byId[wild] && (() => {
          const p = byId[wild] as Profile;
          return (
            <Link href={`/app/u/${p.id}`} className="card row wildcard" style={{ textDecoration: 'none', color: 'var(--ivory)', padding: 12 }}>
              <div className="photo" style={{ width: 76, flex: 'none' }}>{photos[p.id]?.[0] ? <img src={photos[p.id][0]} alt="" /> : <span className="serif">{p.first_name?.[0]}</span>}</div>
              <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
                <span className="label" style={{ color: 'var(--gold-light)' }}>Today’s Wildcard</span>
                <span><strong style={{ fontSize: 17 }}>{p.first_name}</strong> <span className="muted">{age(p.birth_year)}</span></span>
                <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.job, p.neighborhood].filter(Boolean).join(' · ') || 'Outside your usual band'}</span>
                <BandPill band={p.band} trend={publicTrend(p)} verified={Boolean(p.credit_verified_at)} />
              </div>
              <span className="small muted" style={{ alignSelf: 'flex-start' }}>Outside your<br />usual picks</span>
            </Link>
          );
        })()}
      </div>
      {preview && <Link className="btn block" href="/plans">Become a member · $24.99/mo</Link>}
    </div>
  );
}
