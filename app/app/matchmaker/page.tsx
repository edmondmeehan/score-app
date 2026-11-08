import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/session';
import type { MyMatchmaker } from '@/lib/reserve';
import { messageMatchmaker } from './actions';

export const dynamic = 'force-dynamic';

type Msg = { id: number; from_member: boolean; body: string; created_at: string };
const when = (s: string) => new Date(s).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function Matchmaker({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  if (me.plan !== 'black') redirect('/app/settings');
  const [{ data: mmData }, { data: msgs }] = await Promise.all([
    supabase.rpc('my_matchmaker'),
    supabase.from('matchmaker_messages').select('id, from_member, body, created_at').eq('member_id', me.id).order('created_at', { ascending: true }).limit(200),
  ]);
  const mm = mmData as MyMatchmaker | null;
  if (mm?.unread) await supabase.rpc('mark_matchmaker_read');
  const thread = (msgs as Msg[]) || [];
  const name = mm?.assigned ? mm.name : null;

  return (
    <div className="phone">
      <div className="row"><Link href="/app/settings" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}>‹</Link><span className="eyebrow">Reserve</span></div>
      <h1 className="serif" style={{ fontSize: 38 }}>Your matchmaker</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}

      {name ? (
        <div className="card gold stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            {mm!.photo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={mm!.photo_url} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              : <span className="serif" style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--gold-wash)', color: 'var(--gold-light)', fontSize: 28 }}>{name.slice(0, 1)}</span>}
            <span className="stack" style={{ gap: 2 }}><strong style={{ fontSize: 18 }}>{name}</strong><span className="small muted">Your Score matchmaker</span></span>
          </div>
          {mm!.bio && <span className="small" style={{ lineHeight: 1.55 }}>{mm!.bio}</span>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {mm!.booking_url && <a className="btn sm" href={mm!.booking_url} target="_blank" rel="noopener noreferrer">Book a call</a>}
            <a className="btn ghost sm" href="#thread">Message</a>
            <a className="btn ghost sm" href={`mailto:${mm!.contact_email}?subject=${encodeURIComponent('Reserve: message for ' + name)}`}>Email</a>
          </div>
        </div>
      ) : (
        <div className="card gold stack" style={{ gap: 8 }}>
          <strong>We’re matching you with a matchmaker</strong>
          <span className="small" style={{ lineHeight: 1.55 }}>Your matchmaker will reach out within 2 business days to set up your first call. In the meantime, send a note below about what you’re looking for and they’ll see it first.</span>
          <a className="small" href={`mailto:${mm?.contact_email || 'reserve@scoredate.app'}`}>{mm?.contact_email || 'reserve@scoredate.app'}</a>
        </div>
      )}

      <section id="thread" className="card stack" style={{ gap: 10, scrollMarginTop: 80 }}>
        <span className="label">Messages</span>
        {thread.length === 0 && <span className="small muted">No messages yet. Say hello and share what you’re hoping to find.</span>}
        {thread.map((m) => (
          <div key={m.id} className="stack" style={{ gap: 2, alignItems: m.from_member ? 'flex-end' : 'flex-start' }}>
            <span style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 16, lineHeight: 1.45, whiteSpace: 'pre-wrap', background: m.from_member ? 'var(--gold-wash)' : 'var(--bubble)', color: m.from_member ? 'var(--gold-light)' : 'inherit' }}>{m.body}</span>
            <span className="small muted" style={{ fontSize: 11 }}>{m.from_member ? 'You' : name || 'Score'} · {when(m.created_at)}</span>
          </div>
        ))}
        <form action={messageMatchmaker} className="stack" style={{ gap: 8 }}>
          <textarea className="input" name="body" rows={3} maxLength={2000} required placeholder={name ? `Message ${name}` : 'Message your matchmaker'} />
          <button className="btn sm">Send</button>
        </form>
        {sp.sent && <span className="small muted">Sent. Your matchmaker usually replies within one business day.</span>}
      </section>
      <span className="small muted">Matchmaking is included with Reserve. Your matchmaker only sees what you share here and on your profile, never your exact credit score.</span>
    </div>
  );
}
