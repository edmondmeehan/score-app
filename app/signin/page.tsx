import Link from 'next/link';
import Turnstile from '@/components/Turnstile';
import { Gauge } from '@/components/ui';
import { sendLink, sendReset, signInPassword, signUpPassword } from './actions';

type SP = { next?: string; sent?: string; kind?: string; error?: string; mode?: string; email?: string };

export default async function SignIn({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = ['signin', 'signup', 'reset', 'link'].includes(sp.mode || '') ? sp.mode! : sp.next === '/onboarding' ? 'signup' : 'signin';
  const next = sp.next || '';
  const q = (m: string) => `/signin?mode=${m}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
  const sentCopy: Record<string, string> = {
    confirm: 'confirm your email. Tap the link and you’re in.',
    reset: 'reset your password. The link expires in an hour.',
    link: 'sign in. The link expires in an hour.',
  };

  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 16, paddingBottom: 24 }}>
        <Gauge size={72} label="ScoreDate" />
        <span className="mono" style={{ fontSize: 20, letterSpacing: '.28em' }}>SCOREDATE</span>
        <p className="serif" style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>
          {mode === 'signup' ? 'Create your account.' : mode === 'reset' ? 'Reset your password.' : 'Reliable is the new attractive.'}
        </p>
      </div>

      {sp.sent ? (
        <div className="card gold stack">
          <span className="serif" style={{ fontSize: 26 }}>Check your email</span>
          <span className="muted">We sent {sp.sent} a link to {sentCopy[sp.kind || 'link'] || sentCopy.link}</span>
          <Link href="/signin" className="small">Back to sign in</Link>
        </div>
      ) : (
        <div className="stack">
          {mode === 'signin' && (
            <form action={signInPassword} className="stack">
              <input type="hidden" name="next" value={next} />
              <label className="field">Email<input className="input" type="email" name="email" required autoComplete="email" defaultValue={sp.email || ''} /></label>
              <label className="field">Password<input className="input" type="password" name="password" required autoComplete="current-password" /></label>
              {sp.error && <div className="notice error">{sp.error}</div>}
              <button className="btn block">Sign in</button>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <Link href={q('signup')}>Create an account</Link>
                <Link href={q('reset')} className="muted">Forgot password?</Link>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form action={signUpPassword} className="stack">
              <input type="hidden" name="next" value={next} />
              <label className="field">Email<input className="input" type="email" name="email" required autoComplete="email" defaultValue={sp.email || ''} /></label>
              <label className="field">Password<input className="input" type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
              <label className="field">Confirm password<input className="input" type="password" name="confirm" required minLength={8} autoComplete="new-password" /></label>
              <Turnstile />
              {sp.error && <div className="notice error">{sp.error}</div>}
              <button className="btn block">Create account</button>
              <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>Already a member? <Link href={q('signin')}>Sign in</Link></p>
            </form>
          )}

          {mode === 'reset' && (
            <form action={sendReset} className="stack">
              <label className="field">Email<input className="input" type="email" name="email" required autoComplete="email" defaultValue={sp.email || ''} /></label>
              {sp.error && <div className="notice error">{sp.error}</div>}
              <button className="btn block">Email me a reset link</button>
              <p className="small muted" style={{ textAlign: 'center', margin: 0 }}><Link href={q('signin')}>Back to sign in</Link></p>
            </form>
          )}

          {mode === 'link' && (
            <form action={sendLink} className="stack">
              <input type="hidden" name="next" value={next} />
              <label className="field">Email<input className="input" type="email" name="email" required autoComplete="email" defaultValue={sp.email || ''} /></label>
              {sp.error && <div className="notice error">{sp.error}</div>}
              <button className="btn block">Email me a sign-in link</button>
              <p className="small muted" style={{ textAlign: 'center', margin: 0 }}><Link href={q('signin')}>Use a password instead</Link></p>
            </form>
          )}

          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
            By continuing you agree to our <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>. You must be 25 or older.
          </p>
        </div>
      )}
    </div>
  );
}
