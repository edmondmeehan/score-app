import { redirect } from 'next/navigation';
import { Gauge } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';
import { setNewPassword } from '../actions';

export default async function NewPassword({ searchParams }: { searchParams: Promise<{ error?: string; from?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin?mode=reset&error=' + encodeURIComponent('That reset link expired. Request a new one.'));
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 16, paddingBottom: 24 }}>
        <Gauge size={72} label="Score" />
        <p className="serif" style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>Choose a password.</p>
        <span className="small muted">{user.email}</span>
      </div>
      <form action={setNewPassword} className="stack">
        <input type="hidden" name="next" value={sp.from === 'settings' ? 'settings' : ''} />
        <label className="field">New password<input className="input" type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
        <label className="field">Confirm password<input className="input" type="password" name="confirm" required minLength={8} autoComplete="new-password" /></label>
        {sp.error && <div className="notice error">{sp.error}</div>}
        <button className="btn block">Save password</button>
      </form>
    </div>
  );
}
