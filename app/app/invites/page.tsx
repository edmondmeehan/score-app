import { requireMember } from '@/lib/session';
import { makeInvite } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Invites({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, me } = await requireMember();
  const sp = await searchParams;
  const [{ data: invites }, { data: cfg }] = await Promise.all([
    supabase.from('invites').select('code, kind, expires_at, redeemed_by, redeemed_at, created_at').eq('inviter_id', me.id).order('created_at', { ascending: false }),
    supabase.from('app_config').select('key, value').in('key', ['invites_per_member', 'invites_per_founder']),
  ]);
  const allowance = Number(cfg?.find((c) => c.key === (me.is_founder ? 'invites_per_founder' : 'invites_per_member'))?.value ?? 3);
  const left = Math.max(0, allowance - (invites?.length || 0));
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const member = ['membership', 'premium', 'black'].includes(me.plan);
  return (
    <div className="phone">
      <span className="eyebrow">Invites</span>
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Who would you vouch for?</h1>
      <div className="card gold stack">
        <strong>{left} invite{left === 1 ? '' : 's'} left</strong>
        {member ? (
          <div className="row">
            <form action={makeInvite} className="grow"><input type="hidden" name="kind" value="date" /><button className="btn block sm" disabled={!left}>Invite a date</button></form>
            <form action={makeInvite} className="grow"><input type="hidden" name="kind" value="friend" /><button className="btn ghost block sm" disabled={!left}>Set up a friend</button></form>
          </div>
        ) : <span className="small muted">Members can send invites.</span>}
        <span className="small muted">Your name shows on profiles you invite. Invites expire after 7 days.</span>
      </div>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <div className="stack">
        {(invites || []).map((i) => {
          const status = i.redeemed_by ? 'Joined' : new Date(i.expires_at) < new Date() ? 'Expired' : 'Pending';
          const link = `${site}/join?code=${i.code}`;
          return (
            <div key={i.code} className="card stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="mono" style={{ letterSpacing: '.12em' }}>{i.code}</span><span className="small" style={{ color: status === 'Joined' ? 'var(--rise)' : 'var(--muted)' }}>{status}</span></div>
              {status === 'Pending' && <span className="small muted" style={{ wordBreak: 'break-all' }}>Share: {link}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
