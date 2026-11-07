import { Gauge } from '@/components/ui';
import { sendLink } from './actions';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 16, paddingBottom: 24 }}>
        <Gauge size={72} label="Score" />
        <span className="mono" style={{ fontSize: 20, letterSpacing: '.42em' }}>SCORE</span>
        <p className="serif" style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>Date someone who has their act together.</p>
      </div>
      {sp.sent ? (
        <div className="card gold stack"><span className="serif" style={{ fontSize: 26 }}>Check your email</span><span className="muted">We sent a sign-in link to {sp.sent}. It expires in an hour.</span></div>
      ) : (
        <form action={sendLink} className="stack">
          <input type="hidden" name="next" value={sp.next || ''} />
          <label className="field">Email<input className="input" type="email" name="email" required autoComplete="email" /></label>
          {sp.error && <div className="notice error">{sp.error}</div>}
          <button className="btn block">Email me a sign-in link</button>
          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>Sign in with Apple arrives with the iPhone app. By continuing you agree to our <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>. You must be 25 or older.</p>
        </form>
      )}
    </div>
  );
}
