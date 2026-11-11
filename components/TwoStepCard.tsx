'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Settings card: turn two-step sign-in on or off. Staff can't turn it off. */
export default function TwoStepCard({ staff }: { staff: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabaseBrowser().auth.mfa.listFactors().then(({ data }) => {
      const f = data?.totp?.[0];
      setOn(Boolean(f)); setFactorId(f?.id || '');
    }).catch(() => setOn(false));
  }, []);

  async function turnOff() {
    if (!confirm('Turn off two-step sign-in? Your password alone will be enough to sign in.')) return;
    setBusy(true); setErr('');
    const sb = supabaseBrowser();
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    if (error) { setBusy(false); setErr('Couldn’t turn it off. Sign out and back in, then try again.'); return; }
    await sb.auth.refreshSession().catch(() => null);
    setOn(false); setFactorId(''); setBusy(false);
  }

  return (
    <div className="card stack" id="two-step">
      <span className="label">Two-step sign-in</span>
      <span className="small muted">
        {on === null ? 'Checking…'
          : on ? 'On. You’ll enter a code from your authenticator app when you sign in on a new device.'
          : 'Add a code from your phone when you sign in, so a stolen password isn’t enough to get into your account.'}
      </span>
      {on === false && <a href="/two-step?setup=1&next=/app/settings" className="btn sm" style={{ alignSelf: 'flex-start' }}>Turn on</a>}
      {on && !staff && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={turnOff} disabled={busy}>{busy ? 'Turning off…' : 'Turn off'}</button>}
      {on && staff && <span className="small muted">Required for the ScoreDate team.</span>}
      {err && <span className="small" style={{ color: 'var(--alert)' }}>{err}</span>}
    </div>
  );
}
