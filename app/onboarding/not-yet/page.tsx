import Link from 'next/link';
import { Logo } from '@/components/ui';
import { notifyArea } from '../actions';

export default async function NotYet({ searchParams }: { searchParams: Promise<{ zip?: string; done?: string }> }) {
  const sp = await searchParams;
  const zip = /^[0-9]{5}$/.test(sp.zip || '') ? sp.zip! : '';
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 16 }}><Logo size={64} /></div>
      <h1 className="serif" style={{ fontSize: 36, textAlign: 'center' }}>Not in your area yet</h1>
      <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
        Score is opening in New York City first{zip ? `, and ${zip} is outside the five boroughs` : ''}. Members need a home zip code in Manhattan, Brooklyn, Queens, the Bronx or Staten Island.
      </p>
      {sp.done ? (
        <div className="card gold"><p className="serif" style={{ fontSize: 24, margin: 0 }}>Thanks. We&apos;ll email you when Score opens near you.</p></div>
      ) : (
        <form action={notifyArea} className="stack">
          <input type="hidden" name="zip" value={zip} />
          <button className="btn block">Email me when Score opens near me</button>
        </form>
      )}
      <Link href="/onboarding/basics" className="btn ghost block">I live in NYC, change my zip</Link>
    </div>
  );
}
