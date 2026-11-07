import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { BandPill } from '@/components/ui';
import type { Profile } from '@/lib/types';
import Chat from './Chat';

export const dynamic = 'force-dynamic';

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me } = await requireMember();
  const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (!conv) notFound();
  const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
  const [{ data: other }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at').limit(200),
  ]);
  const o = other as Profile | null;
  const shared = (o?.money_values || []).filter((v) => me.money_values?.includes(v));
  return (
    <div className="phone" style={{ paddingBottom: 160 }}>
      <div className="row">
        <Link href="/app/messages" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link>
        <div className="stack grow" style={{ gap: 4 }}><strong>{o?.first_name || 'Member'}</strong>{o && <BandPill band={o.band} trend={o.trend} />}</div>
        <Link href={`/app/report/${otherId}`} className="small muted">Report</Link>
      </div>
      {shared.length > 0 && <div className="card stack" style={{ gap: 8 }}><span className="small muted">You both said</span><div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{shared.map((v) => <span key={v} className="chip">{v}</span>)}</div></div>}
      <Chat conversationId={id} meId={me.id} initial={messages || []} canSend={me.plan !== 'preview'} />
    </div>
  );
}
