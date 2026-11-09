import ScreenshotContext from '@/components/ScreenshotContext';
import HapticOnMount from '@/components/HapticOnMount';
import { unmatchConversation } from '../../actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { BandPill } from '@/components/ui';
import { SITE_URL } from '@/lib/emails';
import type { Profile } from '@/lib/types';
import Chat from './Chat';
import DatePanel, { type Pick, type Plan } from './DatePanel';

export const dynamic = 'force-dynamic';

export default async function Conversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; shared?: string; ok?: string; match?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (!conv) notFound();
  const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
  const [{ data: other }, { data: messages }, { data: plans }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at').limit(200),
    supabase.from('date_plans').select('*').eq('conversation_id', id).in('status', ['proposed', 'accepted']).order('created_at', { ascending: false }).limit(1),
    supabase.rpc('mark_read', { p_conversation: id }),
  ]);
  const plan = (plans?.[0] as Plan | undefined) || null;
  const { data: share } = plan ? await supabase.from('date_shares').select('token, revoked, friend_name').eq('plan_id', plan.id).eq('user_id', me.id).maybeSingle() : { data: null };
  const o = other as Profile | null;
  const shared = (o?.money_values || []).filter((v) => me.money_values?.includes(v));
  const paid = ['membership', 'premium', 'black', 'paused'].includes(me.plan);
  const canSend = !conv.ended_at && (paid || (Boolean(conv.note_from) && conv.note_from !== me.id));
  const { data: picksData } = await supabase.rpc('featured_spots_live');
  const [{ data: readAt }, { data: presence }] = await Promise.all([
    supabase.rpc('other_read_at', { p_conversation: id }),
    supabase.rpc('presence_of', { p_user: otherId }),
  ]);
  const fromNote = conv.note_from && conv.note_from !== me.id;
  return (
    <div className="phone" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
      <ScreenshotContext context="chat" target={otherId} />
      <div className="row appbar">
        <Link href="/app/messages" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link>
        <Link href={`/app/u/${otherId}`} className="stack grow" style={{ gap: 4, textDecoration: 'none', color: 'inherit' }}><strong>{o?.first_name || 'Member'}</strong>{presence === 'now' ? <span className="small" style={{ color: 'var(--rise)' }}><span className="presence-dot" />Active now</span> : presence === 'hour' ? <span className="small muted"><span className="presence-dot hour" />Active in the last hour</span> : null}{o && <BandPill band={o.band} trend={o.trend} verified={Boolean(o.credit_verified_at)} />}</Link>
        <details className="chat-menu">
          <summary className="small muted" aria-label="More">More</summary>
          <div className="chat-menu-list">
            <Link href={`/app/report/${otherId}`}>Report</Link>
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
      {shared.length > 0 && <div className="card stack" style={{ gap: 8 }}><span className="small muted">You both said</span><div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{shared.map((v) => <span key={v} className="chip">{v}</span>)}</div></div>}
      <DatePanel
        conversationId={id}
        meId={me.id}
        otherName={o?.first_name || 'them'}
        plan={plan}
        shareUrl={share && !share.revoked ? `${SITE_URL}/d/${share.token}` : null}
        justShared={Boolean(sp.shared)}
        picks={(picksData as Pick[] | null) || []}
      />
      <Chat conversationId={id} meId={me.id} otherName={o?.first_name || 'them'} initial={messages || []} canSend={canSend} initialReadAt={(readAt as string | null) || null} locked={conv.ended_at ? 'This conversation has ended' : 'Become a member to message'} />
    </div>
  );
}
