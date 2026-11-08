import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { submitSupport } from '../features';

export const dynamic = 'force-dynamic';

const CATS = [['account', 'Account or profile'], ['billing', 'Billing or subscription'], ['verification', 'ID or credit verification'], ['safety', 'Safety concern'], ['bug', 'Something isn’t working'], ['feedback', 'Feedback or idea'], ['other', 'Something else']] as const;

export default async function Support({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data: mine } = await supabase.from('support_tickets').select('id, subject, status, created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(10);
  return (
    <div className="phone">
      <h1 className="serif" style={{ fontSize: 36 }}>Help &amp; support</h1>
      <span className="muted small">We usually reply by email within one business day. Quick answers are in the <Link href="/help">Help center</Link>.</span>
      {sp.ok && <div className="notice">Got it. We&apos;ll email you soon.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <div className="notice small">In danger right now? Call 911. To report a member, open their profile and tap Report so we can act on it right away.</div>
      <form action={submitSupport} className="card stack">
        <label className="stack" style={{ gap: 6 }}><span className="label">Topic</span>
          <select className="input" name="category" defaultValue="account">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="stack" style={{ gap: 6 }}><span className="label">Subject</span><input className="input" name="subject" required minLength={3} maxLength={120} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="label">What&apos;s going on?</span><textarea className="input" name="body" required minLength={5} maxLength={4000} rows={6} /></label>
        <span className="small muted">On iPhone, refunds for App Store purchases are handled by Apple at reportaproblem.apple.com.</span>
        <button className="btn">Send</button>
      </form>
      {(mine || []).length > 0 && (
        <div className="card stack">
          <span className="label">Your requests</span>
          {(mine || []).map((t) => <div key={t.id} className="row small"><span className="grow">{t.subject}</span><span className="muted">{t.status === 'resolved' ? 'Resolved' : t.status === 'pending' ? 'In progress' : 'Received'}</span></div>)}
        </div>
      )}
      <Link href="/app/settings" className="small muted">Back to settings</Link>
    </div>
  );
}
