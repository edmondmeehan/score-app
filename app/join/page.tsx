import { Logo } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';
import { saveInvite } from './actions';
import QuickWaitlist from './QuickWaitlist';
import HeatMap, { Legend, type Spot } from '@/components/HeatMap';

export default async function Join({ searchParams }: { searchParams: Promise<{ code?: string; need?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: { user } }, { data: heat }] = await Promise.all([supabase.auth.getUser(), supabase.rpc('public_area_heat')]);
  const spots = (heat as Spot[]) || [];
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <Logo />
      <span className="eyebrow">Invite only · New York</span>
      <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.02 }}>Someone thinks you have your act together.</h1>
      {sp.need && <div className="notice">Score is invite only. Enter the code a member sent you, or join the waitlist below.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <form action={saveInvite} className="stack">
        <label className="field">Invite code
          <input className="input mono" name="code" defaultValue={sp.code || ''} placeholder="SCR-XXXX-XXX" required style={{ letterSpacing: '.18em', textAlign: 'center', fontSize: 20 }} />
        </label>
        <button className="btn block">Continue</button>
      </form>
      <QuickWaitlist email={user?.email} />
      {spots.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <span className="label">Where Score is growing</span>
          <HeatMap spots={spots} height={280} center={[40.85, -73.85]} zoom={9} />
          <Legend />
          <span className="small muted">New York City is open now. Other areas open as their waitlists grow. Shown by area only.</span>
        </section>
      )}
    </div>
  );
}
