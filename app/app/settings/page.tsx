import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { BandPill } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';
import { signOut } from '../../signin/actions';
import { deleteAccount, setStatus } from '../actions';
import { saveEmailPrefs, saveMapPrivacy } from '../features';

export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  const { data: prefRow } = await supabase.from('email_prefs').select('*').eq('user_id', me.id).maybeSingle();
  const prefs = { daily_drop: true, messages: true, events: true, reminders: true, ...(prefRow || {}) };
  const sp = await searchParams;
  const current = me.status === 'taken' ? 'taken' : me.status === 'paused' ? 'paused' : 'active';
  return (
    <div className="phone">
      <div className="row"><div className="stack grow" style={{ gap: 4 }}><span className="serif" style={{ fontSize: 32 }}>{me.first_name || 'You'}</span><span className="small muted">{me.plan} · {me.status}</span></div><BandPill band={me.band} trend={me.trend} /></div>
      {me.status === 'suspended' && <div className="notice error">Your account is suspended. Check your email for details and how to appeal.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.saved && <div className="notice">Saved.</div>}
      <Link href="/app/shop" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}><span className="grow">Add-ons <span className="small muted">· Spotlight, Extra connections, Notes</span></span><span className="muted">›</span></Link>

      {['membership', 'premium', 'black', 'paused'].includes(me.plan) && (
        <form action={setStatus} className="card stack">
          <span className="label">Status</span>
          {[['active', 'Active', 'In the Daily Drop, matching and messaging.'], ['paused', 'Paused · $4.99/mo', 'Hidden from matching. Keep chats and friends.'], ['taken', 'Taken · $4.99/mo', 'You met someone. Friends see Matched on Score.']].map(([v, l, d]) => (
            <label key={v} className="choice" style={{ alignItems: 'flex-start' }}><input type="radio" name="status" value={v} defaultChecked={current === v} style={{ accentColor: 'var(--gold)', marginTop: 4 }} /><span className="stack" style={{ gap: 2 }}><strong>{l}</strong><span className="small muted">{d}</span></span></label>
          ))}
          <input type="hidden" name="plan" value="membership" />
          <button className="btn ghost sm">Save status</button>
        </form>
      )}

      <Link href="/app/profile" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="stack grow" style={{ gap: 2 }}><strong>Edit profile</strong><span className="small muted">Photos, prompt, song and Instagram</span></span>
        <span style={{ color: 'var(--gold)' }}>→</span>
      </Link>

      <div className="card stack">
        <span className="label">Membership</span>
        <Link href="/plans">Change plan</Link>
        <span className="small muted">On iPhone, subscriptions are managed in your App Store settings.</span>
      </div>

      <Link href="/signin/new-password?from=settings" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">Set or change password</span><span className="muted">›</span>
      </Link>
      <div className="card stack" id="appearance">
        <span className="label">Appearance</span>
        <ThemeSwitch />
        <span className="small muted">System follows your phone&apos;s light or dark mode.</span>
      </div>
      <form action={saveEmailPrefs} className="card stack" id="email">
        <span className="label">Email</span>
        {([['daily_drop', 'Daily Drop', 'When your new matches are ready'], ['messages', 'New messages', 'Only if unread for a bit, never more than every few hours'], ['events', 'Events', 'New member events'], ['reminders', 'Reminders', 'Preview ending and re-verification']] as const).map(([k, l, d]) => (
          <label key={k} className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name={k} defaultChecked={Boolean(prefs[k])} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>{l}</strong><span className="small muted">{d}</span></span></label>
        ))}
        <span className="small muted">Account and security emails (sign-in, password, verification results) always come through.</span>
        <button className="btn ghost sm">Save email settings</button>
      </form>
      <form action={signOut}><button className="btn ghost block">Sign out</button></form>

      <form action={saveMapPrivacy} className="card stack" id="privacy">
        <span className="label">Privacy</span>
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="map_opt_out" defaultChecked={Boolean(me.map_opt_out)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Leave me off the member map</strong><span className="small muted">The map only shows neighborhoods with 25+ members, never individuals. Turn this on to be left out of the count entirely.</span></span></label>
        <button className="btn ghost sm">Save</button>
      </form>
      <form action={deleteAccount} className="card stack" style={{ borderColor: 'var(--danger-line)' }}>
        <span className="label" style={{ color: 'var(--alert)' }}>Delete account</span>
        <span className="small muted">Permanently deletes your profile, photos, chats and verification results. Cancel any App Store subscription first so you&apos;re not billed again.</span>
        <label className="field">Type DELETE to confirm<input className="input" name="confirm" autoComplete="off" /></label>
        <button className="btn danger sm">Delete my account</button>
      </form>
    </div>
  );
}
