import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { reactivate } from '../actions';

export const dynamic = 'force-dynamic';

/** Shown to members who are Paused or Taken: they can sign in, but have to reactivate to see the app. */
export default async function Paused({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  if (!['paused', 'taken'].includes(me.status)) redirect('/app');
  const sp = await searchParams;
  const taken = me.status === 'taken';
  return (
    <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <span className="eyebrow">{taken ? 'Taken' : 'On a break'}</span>
      <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.05, margin: 0 }}>{taken ? `Congrats, ${me.first_name || 'you'}.` : `Welcome back, ${me.first_name || 'there'}.`}</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
        {taken
          ? 'Your profile is hidden while you’re Taken. Reactivate any time to see your Daily Drop, messages and events again.'
          : 'Your account is paused, so you’re hidden from matching. Reactivate to see your Daily Drop, messages, likes and events again.'}
      </p>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <form action={reactivate} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="plan" value="membership" />
        <button className="btn block" data-haptic="success">Reactivate my account</button>
      </form>
      <Link href="/plans" className="small">Choose a different plan</Link>
      <div className="row" style={{ justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <Link href="/app/settings" className="small muted">Account settings</Link>
        <Link href="/app/support" className="small muted">Contact support</Link>
      </div>
    </div>
  );
}
