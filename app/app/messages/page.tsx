import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { photoUrls } from '@/lib/photos';

export const dynamic = 'force-dynamic';

export default async function Messages({ searchParams }: { searchParams: Promise<{ reported?: string }> }) {
  const { supabase, me } = await requireMember();
  const sp = await searchParams;
  const { data: convs } = await supabase.from('conversations').select('id, user_a, user_b, created_at').or(`user_a.eq.${me.id},user_b.eq.${me.id}`);
  const others = (convs || []).map((c) => (c.user_a === me.id ? c.user_b : c.user_a));
  const [{ data: people }, { data: msgs }, photos] = await Promise.all([
    others.length ? supabase.from('member_cards').select('id, first_name').in('id', others) : Promise.resolve({ data: [] as { id: string; first_name: string }[] }),
    (convs || []).length ? supabase.from('messages').select('conversation_id, body, sender_id, created_at').in('conversation_id', convs!.map((c) => c.id)).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as { conversation_id: string; body: string; sender_id: string; created_at: string }[] }),
    photoUrls(supabase, others),
  ]);
  const name = Object.fromEntries((people || []).map((p) => [p.id, p.first_name]));
  const last: Record<string, { body: string; sender_id: string; created_at: string }> = {};
  (msgs || []).forEach((m) => { if (!last[m.conversation_id]) last[m.conversation_id] = m; });
  const rows = (convs || []).map((c) => ({ c, other: c.user_a === me.id ? c.user_b : c.user_a, m: last[c.id] }))
    .sort((a, b) => (b.m?.created_at || b.c.created_at).localeCompare(a.m?.created_at || a.c.created_at));
  return (
    <div className="phone">
      <h1 className="serif" style={{ fontSize: 38 }}>Messages</h1>
      {sp.reported && <div className="notice">Thanks. A person on our team will review your report, usually within 24 hours.</div>}
      {me.plan === 'preview' && <div className="notice test">Preview members can&apos;t message yet. <Link href="/plans">Become a member</Link> to say hello.</div>}
      {rows.length === 0 && <p className="muted">No conversations yet. Open someone from your Daily Drop and send a note.</p>}
      <div>
        {rows.map(({ c, other, m }) => (
          <Link key={c.id} href={`/app/messages/${c.id}`} className="list-row">
            <span className="avatar">{photos[other]?.[0] ? <img src={photos[other][0]} alt="" /> : name[other]?.[0]}</span>
            <span className="stack grow" style={{ gap: 4, minWidth: 0 }}>
              <strong>{name[other] || 'Member'}</strong>
              <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m ? `${m.sender_id === me.id ? 'You: ' : ''}${m.body}` : 'Say hello'}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
