'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'loading' | 'verify' | 'enroll' | 'done';

export default function TwoStep({ next, staff, required, setup }: { next: string; staff: boolean; required: boolean; setup: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: list } = await sb.auth.mfa.listFactors();
      const verified = list?.totp?.[0];
      if (verified) {
        if (aal?.currentLevel === 'aal2') { setMode('done'); if (!setup) router.replace(next); return; }
        setFactorId(verified.id); setMode('verify'); return;
      }
      // Clear any half-finished setup, then start a fresh one.
      for (const f of list?.all || []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => null);
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ScoreDate ${new Date().toISOString().slice(0, 10)}` });
      if (error || !data) { setErr('Couldn’t start setup. Refresh and try again.'); setMode('enroll'); return; }
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setMode('enroll');
    })();
  }, [next, setup, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setErr('Enter the 6-digit code from your authenticator app.'); return; }
    setBusy(true); setErr('');
    const sb = supabaseBrowser();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { setBusy(false); setCode(''); setErr('That code didn’t work. Codes change every 30 seconds, so try the newest one.'); return; }
    router.replace(next);
    router.refresh();
  }

  if (mode === 'loading') return <p className="muted" style={{ textAlign: 'center' }}>One moment…</p>;
  if (mode === 'done') return (
    <div className="card stack" style={{ textAlign: 'center' }}>
      <span className="serif" style={{ fontSize: 28 }}>Two-step sign-in is on</span>
      <span className="small muted">You’ll enter a code from your authenticator app when you sign in on a new device.</span>
      <a className="btn" href={next}>Done</a>
    </div>
  );

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6, textAlign: 'center' }}>
        <span className="label">Two-step sign-in</span>
        <span className="serif" style={{ fontSize: 30 }}>{mode === 'verify' ? 'Enter your code' : 'Protect your account'}</span>
        <span className="small muted">
          {mode === 'verify'
            ? 'Open your authenticator app and enter the 6-digit code for ScoreDate.'
            : staff
              ? 'Everyone on the ScoreDate team uses two-step sign-in. Set it up once and you’re in.'
              : required ? 'Set up two-step sign-in to continue.' : 'Add a code from your phone when you sign in, so a stolen password isn’t enough.'}
        </span>
      </div>
      {mode === 'enroll' && (
        <div className="card stack" style={{ gap: 12 }}>
          <span className="small"><strong>1.</strong> Open an authenticator app (Google Authenticator, 1Password, Authy or your iPhone’s Passwords app) and scan this code.</span>
          {qr && <img src={qr} alt="Setup code to scan" width={180} height={180} style={{ alignSelf: 'center', background: '#fff', borderRadius: 12, padding: 8 }} />}
          {secret && <span className="small muted">Can’t scan? Enter this key: <span className="mono" style={{ wordBreak: 'break-all' }}>{secret}</span></span>}
          <span className="small"><strong>2.</strong> Enter the 6-digit code it shows.</span>
        </div>
      )}
      <input className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ textAlign: 'center', fontSize: 24, letterSpacing: '.3em' }} autoFocus />
      {err && <span className="small" style={{ color: 'var(--alert)' }}>{err}</span>}
      <button className="btn block" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : mode === 'verify' ? 'Continue' : 'Turn on two-step sign-in'}</button>
      {mode === 'verify' && <span className="small muted" style={{ textAlign: 'center' }}>Lost your phone? Email support@scoredate.app from your account email and we’ll help you back in.</span>}
    </form>
  );
}
