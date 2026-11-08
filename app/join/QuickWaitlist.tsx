'use client';
import { useActionState } from 'react';
import { joinWaitlist, type WaitlistState } from '../actions';
import JoinedCard from '@/components/JoinedCard';

/** "No invite code?" — email + zip, confirms right on the screen. */
export default function QuickWaitlist({ email }: { email?: string | null }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, null);
  if (state?.ok && state.joined) return <JoinedCard eventId={state.joined.eventId} message={state.message} code={state.joined.code} token={state.joined.token} position={state.joined.position} founder={state.joined.founder} founderReason={state.joined.founderReason} />;
  if (state?.ok)
    return (
      <div className="card gold stack" style={{ gap: 10 }}>
        <span className="eyebrow">You&apos;re on the waitlist</span>
        <p className="serif" style={{ fontSize: 26, margin: 0, lineHeight: 1.15 }}>{state.message}</p>
        <span className="small muted">Got a code from a friend later? Enter it above any time.</span>
      </div>
    );
  return (
    <form action={action} className="card stack" style={{ gap: 12 }}>
      <span style={{ fontWeight: 600 }}>No invite code?</span>
      <span className="small muted">Join the waitlist. We open area by area and send invites by zip code.</span>
      <input type="hidden" name="quick" value="1" />
      <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={email || ''} /></label>
      <label className="field">Home zip code<input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" placeholder="10011" /></label>
      {state && !state.ok && <div className="notice error">{state.message}</div>}
      <button className="btn ghost block" disabled={pending}>{pending ? 'Adding you…' : 'Join the waitlist'}</button>
    </form>
  );
}
