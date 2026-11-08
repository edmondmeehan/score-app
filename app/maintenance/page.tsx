import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { BUILD_LABEL } from '@/lib/build';
import { supabaseAnon } from '@/lib/supabase/server';
import { sendContact } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Back soon · Score', robots: { index: false } };

const SUPPORT = 'support@scoredate.app';

export default async function Maintenance({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  let message = 'Score is down for scheduled maintenance. We’ll be back shortly.';
  let on = true;
  try {
    const { data } = await supabaseAnon().from('app_config').select('value').eq('key', 'maintenance').maybeSingle();
    if (data?.value?.message) message = data.value.message;
    on = data?.value?.on !== false;
  } catch { /* keep defaults */ }

  return (
    <main className="page stack" style={{ maxWidth: 480, minHeight: '100vh', padding: '14vh 20px 48px', gap: 24 }}>
      <Logo />
      <div className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">{on ? 'Maintenance' : 'All clear'}</span>
        <h1 className="serif" style={{ fontSize: 46, lineHeight: 1.05, margin: 0 }}>{on ? 'We’ll be right back.' : 'Score is back.'}</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{on ? message : 'Maintenance is finished.'}</p>
        {!on && <Link href="/" className="btn" style={{ alignSelf: 'flex-start' }}>Go to Score</Link>}
      </div>

      {on && (
        <section id="contact" className="card stack" style={{ gap: 12 }}>
          <strong>Need to reach us?</strong>
          <span className="small muted">Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> or leave a message and we’ll reply by email.</span>
          {sp.sent ? (
            <div className="notice">Thanks, we got your message.</div>
          ) : (
            <form action={sendContact} className="stack" style={{ gap: 10 }}>
              {sp.error && <div className="notice error">{sp.error}</div>}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
              <label className="field">Name<input className="input" name="name" maxLength={80} autoComplete="name" /></label>
              <label className="field">Email<input className="input" name="email" type="email" required maxLength={200} autoComplete="email" /></label>
              <label className="field">Message<textarea className="input" name="body" rows={4} required minLength={5} maxLength={4000} /></label>
              <button className="btn">Send</button>
            </form>
          )}
          <span className="small muted">In an emergency, call 911.</span>
        </section>
      )}

      <div className="stack small muted" style={{ gap: 6, marginTop: 'auto' }}>
        <span><Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link> · <Link href="/signin">Staff sign in</Link></span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '.06em' }}>{BUILD_LABEL}</span>
      </div>
    </main>
  );
}
