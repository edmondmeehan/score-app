import ScreenshotContext from '@/components/ScreenshotContext';
import HapticOnMount from '@/components/HapticOnMount';
import { markTogether, unmatchConversation } from '../../actions';
import DeeperCard, { type DeeperState } from './DeeperCard';
import MoneyTalk from './MoneyTalk';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { BandPill } from '@/components/ui';
import { SITE_URL } from '@/lib/emails';
import type { Profile } from '@/lib/types';
import Chat from './Chat';
import DatePanel, { type Pick, type Plan } from './DatePanel';
import { nearestFirst, openers, publicTrend } from '@/lib/engagement';

export const dynamic = 'force-dynamic';

export default async function Conversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; shared?: string; ok?: string; match?: string; second?: string; together?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (!conv) notFound();
  const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
  type Geo = { lat: number | null; lng: number | null };
  // Everything this screen needs, fetched at once (it used to be six round trips in a row).
  const [{ data: other }, { data: messages }, { data: plans }, , { data: picksData }, { data: myGeo }, { data: readAt }, { data: presence }, { data: sharedQ }, { data: deeper }, { count: pastDates }, { data: marks }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at').limit(200),
    supabase.from('date_plans').select('*').eq('conversation_id', id).in('status', ['proposed', 'accepted']).order('created_at', { ascending: false }).limit(1),
    supabase.rpc('mark_read', { p_conversation: id }),
    supabase.rpc('featured_spots_live'),
    me.zip ? supabase.rpc('zip_lookup', { p_zip: me.zip }) : Promise.resolve({ data: null }),
    supabase.rpc('other_read_at', { p_conversation: id }),
    supabase.rpc('presence_of', { p_user: otherId }),
    supabase.rpc('shared_answers', { p_other: otherId }),
    supabase.rpc('deeper_state', { p_conversation: id }),
    supabase.from('date_plans').select('id', { count: 'exact', head: true }).eq('conversation_id', id).eq('status', 'accepted').lt('starts_at', new Date().toISOString()),
    supabase.from('together_marks').select('user_id').eq('conversation_id', id),
  ]);
  const plan = (plans?.[0] as Plan | undefined) || null;
  const o = other as Profile | null;
  const [{ data: share }, { data: theirGeo }] = await Promise.all([
    plan ? supabase.from('date_shares').select('token, revoked, friend_name').eq('plan_id', plan.id).eq('user_id', me.id).maybeSingle() : Promise.resolve({ data: null }),
    o?.zip ? supabase.rpc('zip_lookup', { p_zip: o.zip }) : Promise.resolve({ data: null }),
  ]);
  const shared = (o?.money_values || []).filter((v) => me.money_values?.includes(v));
  const paid = ['membership', 'premium', 'black', 'paused'].includes(me.plan);
  const canSend = !conv.ended_at && (paid || (Boolean(conv.note_from) && conv.note_from !== me.id));
  // Partners nearest to the two of you first (used by the "Plan it" nudge and the Suggest a date row).
  const picks = nearestFirst((picksData as Pick[] | null) || [], myGeo as Geo | null, theirGeo as Geo | null);
  const iMarked = (marks || []).some((m) => m.user_id === me.id);
  const together = iMarked && (marks || []).some((m) => m.user_id === otherId);
  const sameAnswers = (sharedQ as { q: string; a: string }[] | null) || [];
  const fromNote = conv.note_from && conv.note_from !== me.id;
  return (
    <div className="phone" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
      <ScreenshotContext context="chat" target={otherId} />
      <div className="row appbar">
        <Link href="/app/messages" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link>
        <Link href={`/app/u/${otherId}`} className="stack grow" style={{ gap: 4, textDecoration: 'none', color: 'inherit' }}><strong>{o?.first_name || 'Member'}</strong>{presence === 'now' ? <span className="small" style={{ color: 'var(--rise)' }}><span className="presence-dot" />Active now</span> : presence === 'hour' ? <span className="small muted"><span className="presence-dot hour" />Active in the last hour</span> : null}{o && <BandPill band={o.band} trend={publicTrend(o)} verified={Boolean(o.credit_verified_at)} />}</Link>
        <details className="chat-menu">
          <summary className="small muted" aria-label="More">More</summary>
          <div className="chat-menu-list">
            <Link href={`/app/report/${otherId}`}>Report</Link>
            {!conv.ended_at && !iMarked && (
              <form action={markTogether}>
                <input type="hidden" name="id" value={id} />
                <button type="submit">We’re together</button>
                <span className="small muted">Private until {o?.first_name || 'they'} taps it too.</span>
              </form>
            )}
            {!conv.ended_at && (
              <form action={unmatchConversation}>
                <input type="hidden" name="id" value={id} />
                <button type="submit">Unmatch</button>
                <span className="small muted">Ends this chat for both of you. Nobody is reported.</span>
              </form>
            )}
          </div>
        </details>
      </div>
      {fromNote && <div className="notice">{o?.first_name} sent you a Note. Reply any time{me.plan === 'preview' ? ', even on Preview' : ''}.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.match && <HapticOnMount kind="success" />}
      {conv.ended_at && <div className="notice">{conv.ended_by === me.id ? 'You unmatched.' : 'This conversation has ended.'} Messages can’t be sent anymore.</div>}
      {sp.second && !conv.ended_at && (
        <div className="card gold stack" style={{ gap: 6 }}>
          <HapticOnMount kind="success" />
          <span className="label">Second date</span>
          <span className="serif" style={{ fontSize: 22 }}>You both said yes.</span>
          <span className="small muted">Suggest a spot below while it’s fresh. The ScoreDate Partners row has member perks.</span>
        </div>
      )}
      {together && !conv.ended_at && (
        <div className="card gold stack" style={{ gap: 8 }}>
          {sp.together && <HapticOnMount kind="success" />}
          <span className="label">It’s official</span>
          <span className="serif" style={{ fontSize: 24 }}>You and {o?.first_name} are together.</span>
          <span className="small muted">Congratulations. When you’re ready, you can set your status to Taken to step out of the Drop, and share your story if you both want to.</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link href="/app/settings#status" className="btn sm">Set status</Link>
            <Link href="/app/discover/stories" className="btn ghost sm">Share our story</Link>
          </div>
        </div>
      )}
      {iMarked && !together && !conv.ended_at && (
        <form action={markTogether} className="notice row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="on" value="no" />
          <span>You tapped “We’re together.” {o?.first_name} only sees it if they tap it too.</span>
          <button className="btn ghost sm">Undo</button>
        </form>
      )}
      {(shared.length > 0 || sameAnswers.length > 0) && (
        <div className="card stack" style={{ gap: 8 }}>
          <span className="small muted">You both said</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {shared.map((v) => <span key={v} className="chip">{v}</span>)}
            {sameAnswers.map((x) => <span key={x.q} className="chip" title={x.q}>{x.q} {x.a}</span>)}
          </div>
        </div>
      )}
      {!conv.ended_at && <DeeperCard conversationId={id} otherName={o?.first_name || 'them'} initial={(deeper as DeeperState) || null} />}
      {!conv.ended_at && (pastDates || 0) >= 2 && <MoneyTalk otherName={o?.first_name || 'them'} />}
      <DatePanel
        conversationId={id}
        meId={me.id}
        otherName={o?.first_name || 'them'}
        plan={plan}
        shareUrl={share && !share.revoked ? `${SITE_URL}/d/${share.token}` : null}
        justShared={Boolean(sp.shared)}
        picks={picks}
      />
      <Chat conversationId={id} meId={me.id} otherName={o?.first_name || 'them'} initial={messages || []} canSend={canSend} initialReadAt={(readAt as string | null) || null} locked={conv.ended_at ? 'This conversation has ended' : 'Become a member to message'} openers={o ? openers(me, o) : []} open={!conv.ended_at} startedAt={conv.created_at} hasPlan={Boolean(plan)} nudgePick={picks[0] || null} />
    </div>
  );
}
