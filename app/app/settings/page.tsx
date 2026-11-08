import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { BandPill } from '@/components/ui';
import ThemeSwitch from '@/components/ThemeSwitch';
import HapticsToggle from '@/components/HapticsToggle';
import AppFooter from '@/components/AppFooter';
import { signOut } from '../../signin/actions';
import { deleteAccount, setStatus } from '../actions';
import { saveEmailPrefs, saveMapPrivacy, saveNotifyPrefs, setShowOnline } from '../features';
import PushToggle from '@/components/PushToggle';
import FounderBadge from '@/components/FounderBadge';

export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  const { data: prefRow } = await supabase.from('email_prefs').select('*').eq('user_id', me.id).maybeSingle();
  const prefs = { daily_drop: true, messages: true, events: true, reminders: true, ...(prefRow || {}) };
  const { data: nRow } = await supabase.from('notify_prefs').select('*').eq('user_id', me.id).maybeSingle();
  const np = { push_interactions: true, push_reminders: true, push_milestones: true, push_nudges: true, email_milestones: false, email_nudges: true, quiet_hours: true, ...(nRow || {}) };
  const sp = await searchParams;
  const current = me.status === 'taken' ? 'taken' : me.status === 'paused' ? 'paused' : 'active';
  return (
    <div className="phone">
      <div className="row"><div className="stack grow" style={{ gap: 4 }}><span className="serif" style={{ fontSize: 32 }}>{me.first_name || 'You'}</span><span className="small muted">{me.plan} · {me.status}</span>{me.is_founder && <FounderBadge />}</div><BandPill band={me.band} trend={me.trend} verified={Boolean(me.credit_verified_at)} /></div>
      {me.status === 'suspended' && <div className="notice error">Your account is suspended. Check your email for details and how to appeal.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.saved && <div className="notice">Saved.</div>}
      {me.plan === 'black' && (
        <Link href="/app/matchmaker" className="card gold row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="stack grow" style={{ gap: 2 }}><strong>Your matchmaker</strong><span className="small muted">Book a call, message or email</span></span>
          <span style={{ color: 'var(--gold)' }}>→</span>
        </Link>
      )}
      <Link href="/app/shop" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}><span className="grow">Add-ons <span className="small muted">· Spotlight, Extra connections, Notes</span></span><span className="muted">›</span></Link>

      {['membership', 'premium', 'black', 'paused'].includes(me.plan) && (
        <form action={setStatus} className="card stack">
          <span className="label">Status</span>
          {[['active', 'Active', 'In the Daily Drop, matching and messaging.'], ['paused', 'Paused · $4.99/mo', 'Hidden from matching. Keep chats and friends.'], ['taken', 'Taken · $4.99/mo', 'You met someone. Friends see Matched on ScoreDate.']].map(([v, l, d]) => (
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

      <Link href="/app/likes" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">Likes &amp; profile views</span><span className="muted">›</span>
      </Link>
      <Link href="/help" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">Help center</span><span className="muted">›</span>
      </Link>
      <Link href="/app/support" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">Contact support</span><span className="muted">›</span>
      </Link>
      <Link href="/signin/new-password?from=settings" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">Set or change password</span><span className="muted">›</span>
      </Link>
      <div className="card stack" id="appearance">
        <span className="label">Appearance</span>
        <ThemeSwitch />
        <HapticsToggle />
        <span className="small muted">System follows your phone&apos;s light or dark mode.</span>
      </div>
      <form action={saveNotifyPrefs} className="card stack" id="notifications">
        <span className="label">Notifications</span>
        <PushToggle />
        {([['push_interactions', 'Messages and date plans', 'New messages, Notes, date invites and replies'], ['push_reminders', 'Reminders', 'Unread messages, upcoming dates and events'], ['push_milestones', 'Milestones', 'First conversation, first date, credit trending up'], ['push_nudges', 'Weekly catch-up', 'Only if you have been away a few days. Stops after a month.']] as const).map(([k, l, d]) => (
          <label key={k} className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name={k} defaultChecked={Boolean(np[k])} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>{l}</strong><span className="small muted">{d}</span></span></label>
        ))}
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="quiet_hours" defaultChecked={Boolean(np.quiet_hours)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Quiet hours</strong><span className="small muted">Hold reminders and milestones from 10pm to 8am. Messages still come through.</span></span></label>
        <span className="label" style={{ marginTop: 6 }}>Also by email</span>
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="email_nudges" defaultChecked={Boolean(np.email_nudges)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Weekly catch-up email</strong><span className="small muted">At most once a week, only when you&apos;ve been away</span></span></label>
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="email_milestones" defaultChecked={Boolean(np.email_milestones)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Milestone emails</strong><span className="small muted">Off by default</span></span></label>
        <button className="btn ghost sm">Save notification settings</button>
      </form>
      <form action={saveEmailPrefs} className="card stack" id="email">
        <span className="label">Email</span>
        {([['daily_drop', 'Daily Drop', 'When your new matches are ready'], ['messages', 'Messages and date plans', 'Unread messages (never more than every few hours) and date invites'], ['events', 'Events', 'New member events'], ['reminders', 'Reminders', 'Preview ending, re-verification, upcoming dates']] as const).map(([k, l, d]) => (
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
      <form action={setShowOnline} className="card stack" id="active">
        <span className="label">Active status</span>
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="show_online" defaultChecked={Boolean((me as { show_online?: boolean }).show_online)} style={{ accentColor: 'var(--gold)', marginTop: 4, width: 18, height: 18 }} /><span className="stack" style={{ gap: 2 }}><strong>Show when I’m active</strong><span className="small muted">Your matches see “Active now” or “Active in the last hour” in your chat. It’s off by default, and you only see others’ status while yours is on. Turning it off clears your last active time.</span></span></label>
        <button className="btn ghost sm">Save</button>
      </form>
      <div className="card stack">
        <span className="label">Your data</span>
        <span className="small muted">Download a copy of your profile, messages you sent, matches, plans and settings. ScoreDate never stores your exact credit score or report.</span>
        <a className="btn ghost sm" href="/api/me/export" download style={{ alignSelf: 'flex-start' }}>Download my data</a>
      </div>
      <form action={deleteAccount} className="card stack" style={{ borderColor: 'var(--danger-line)' }}>
        <span className="label" style={{ color: 'var(--alert)' }}>Delete account</span>
        <span className="small muted">Permanently deletes your profile, photos, chats and verification results. Cancel any App Store subscription first so you&apos;re not billed again.</span>
        <label className="field">Type DELETE to confirm<input className="input" name="confirm" autoComplete="off" /></label>
        <button className="btn danger sm">Delete my account</button>
      </form>
      <AppFooter />
    </div>
  );
}
