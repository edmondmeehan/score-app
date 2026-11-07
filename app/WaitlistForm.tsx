'use client';
import { useActionState } from 'react';
import { joinWaitlist, notifyMe, type WaitlistState } from './actions';
import JoinedCard from '@/components/JoinedCard';

export function NotifyMe({ first_name, email, zip, message }: { first_name: string; email: string; zip: string; message: string }) {
  const [state, action, pending] = useActionState(notifyMe, null);
  if (state?.ok) return <div className="card gold"><p className="serif" style={{ fontSize: 28, margin: 0 }}>{state.message}</p></div>;
  return (
    <form action={action} className="card stack">
      <p className="serif" style={{ fontSize: 26, margin: 0 }}>Not in your area yet</p>
      <p className="muted" style={{ margin: 0 }}>{message} Want us to email you when Score opens near you?</p>
      <input type="hidden" name="first_name" value={first_name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="zip" value={zip} />
      {state && !state.ok && <div className="notice error">{state.message}</div>}
      <button className="btn" disabled={pending}>{pending ? 'Saving…' : `Email me at ${email}`}</button>
      <button type="button" className="btn ghost sm" onClick={() => location.reload()}>Wrong zip? Start over</button>
    </form>
  );
}

export default function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, null);
  if (state?.ok && state.joined) return <JoinedCard message={state.message} code={state.joined.code} token={state.joined.token} position={state.joined.position} founder={state.joined.founder} founderReason={state.joined.founderReason} />;
  if (state?.ok) return <div className="card gold"><p className="serif" style={{ fontSize: 28, margin: 0 }}>{state.message}</p></div>;
  return (
    <form action={action} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      <label className="field">First name<input className="input" name="first_name" required autoComplete="given-name" /></label>
      <label className="field">Last name<input className="input" name="last_name" autoComplete="family-name" /></label>
      <label className="field" style={{ gridColumn: '1 / -1' }}>Email<input className="input" name="email" type="email" required autoComplete="email" /></label>
      <label className="field">Home zip code<input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" placeholder="10011" /></label>
      <label className="field">What you do<input className="input" name="job" /></label>
      {state && !state.ok && <div className="notice error" style={{ gridColumn: '1 / -1' }}>{state.message}</div>}
      <button className="btn" style={{ gridColumn: '1 / -1' }} disabled={pending}>{pending ? 'Adding you…' : 'Join the waitlist'}</button>
      <p className="small muted" style={{ gridColumn: '1 / -1', margin: 0 }}>New York City opens first, then more areas. Members must be 25 or older. Verification uses a soft pull and never affects your score.</p>
    </form>
  );
}
