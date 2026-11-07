import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gauge } from '@/components/ui';
import { supabaseAnon } from '@/lib/supabase/server';
import { verifyUnsub } from '@/lib/unsub';

const LABEL: Record<string, string> = {
  all: 'all Score emails except account and security emails',
  daily_drop: 'Daily Drop emails',
  messages: 'new message emails',
  events: 'event announcements',
  reminders: 'Preview and re-verification reminders',
};

async function confirm(form: FormData) {
  'use server';
  const u = String(form.get('u')); const k = String(form.get('k')); const s = String(form.get('s'));
  if (!verifyUnsub(u, k, s)) redirect('/unsubscribe?bad=1');
  await supabaseAnon().rpc('email_unsubscribe', { p_secret: process.env.SCORE_SERVER_SECRET, p_user: u, p_kind: k });
  redirect(`/unsubscribe?done=${k}`);
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ u?: string; k?: string; s?: string; done?: string; bad?: string }> }) {
  const sp = await searchParams;
  const valid = sp.u && sp.k && sp.s && verifyUnsub(sp.u, sp.k, sp.s);
  return (
    <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 14 }}><Gauge size={56} label="Score" /></div>
      {sp.done ? (
        <>
          <h1 className="serif" style={{ fontSize: 34 }}>You&apos;re unsubscribed.</h1>
          <p className="muted">We won&apos;t send you {LABEL[sp.done] || 'those emails'} anymore. You can turn them back on any time in Settings.</p>
          <Link href="/app/settings#email" className="btn ghost block">Email settings</Link>
        </>
      ) : valid ? (
        <form action={confirm} className="stack">
          <h1 className="serif" style={{ fontSize: 34 }}>Unsubscribe?</h1>
          <p className="muted">Stop {LABEL[sp.k!]}. Account and security emails (like sign-in links) still come through.</p>
          <input type="hidden" name="u" value={sp.u} /><input type="hidden" name="k" value={sp.k} /><input type="hidden" name="s" value={sp.s} />
          <button className="btn block">Unsubscribe</button>
          <Link href="/app/settings#email" className="small muted">Choose which emails instead</Link>
        </form>
      ) : (
        <>
          <h1 className="serif" style={{ fontSize: 34 }}>That link didn&apos;t work.</h1>
          <p className="muted">Sign in to change your email settings.</p>
          <Link href="/app/settings#email" className="btn block">Email settings</Link>
        </>
      )}
    </div>
  );
}
