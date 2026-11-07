import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { Steps } from '@/components/ui';
import { saveBasics } from '../actions';

export default async function Basics({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  const sp = await searchParams;
  return (
    <form action={saveBasics} className="phone">
      <Steps at={1} />
      <h1 className="serif" style={{ fontSize: 38 }}>The basics</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <label className="field">First name<input className="input" name="first_name" defaultValue={me.first_name || ''} required /></label>
      <label className="field">Year you were born<input className="input" name="birth_year" type="number" min={1940} max={2010} defaultValue={me.birth_year || ''} required /></label>
      <label className="field">I am a<select className="input" name="gender" defaultValue={me.gender || ''} required><option value="" disabled>Choose</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Nonbinary</option></select></label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ marginBottom: 8 }}>Interested in</legend>
        {['woman', 'man', 'nonbinary'].map((g) => (
          <label key={g} className="row" style={{ fontSize: 15, color: 'var(--ivory)' }}><input type="checkbox" name="seeking" value={g} defaultChecked={me.seeking?.includes(g)} style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />{g === 'woman' ? 'Women' : g === 'man' ? 'Men' : 'Nonbinary people'}</label>
        ))}
      </fieldset>
      <label className="field">What you do<input className="input" name="job" defaultValue={me.job || ''} /></label>
      <label className="field">Home zip code<input className="input" name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" defaultValue={me.zip || ''} /><span className="small muted">Used to match you with people nearby.</span></label>
      <label className="field">Neighborhood<input className="input" name="neighborhood" defaultValue={me.neighborhood || ''} /></label>
      <button className="btn block">Continue</button>
    </form>
  );
}
