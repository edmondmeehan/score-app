import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { TestBanner } from '@/components/ui';
import { PLANS } from '@/lib/types';
import { getFounderOffer } from '@/lib/founderOffer';
import FounderBadge from '@/components/FounderBadge';
import { choosePlan } from '../onboarding/actions';

export default async function Plans({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  const offer = me.is_founder ? await getFounderOffer(supabase) : null;
  const sp = await searchParams;
  return (
    <form action={choosePlan} className="phone">
      <h1 className="serif" style={{ fontSize: 36 }}>Become a member</h1>
      <TestBanner>Payments aren&apos;t connected. Choosing a paid plan activates it without charging. The iPhone app will bill through the App Store.</TestBanner>
      {offer?.enabled && (
        <div className="card gold stack" style={{ gap: 6 }}>
          <FounderBadge size="md" />
          <strong>Your Founding Member price</strong>
          <span className="small">{offer.intro}, then Membership at {offer.monthly} (regularly {offer.regular}) for as long as you stay subscribed.</span>
          <span className="small muted">Applied automatically when you subscribe in the Score iPhone app.</span>
        </div>
      )}
      <div className="stack" role="radiogroup" aria-label="Plan">
        {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k, i) => (
          <label key={k} className="choice" style={{ alignItems: 'flex-start' }}>
            <input type="radio" name="plan" value={k} defaultChecked={i === 0} style={{ accentColor: 'var(--gold)', marginTop: 4 }} />
            <span className="stack grow" style={{ gap: 4 }}>
              <span className="row" style={{ justifyContent: 'space-between' }}><strong>{PLANS[k].name}</strong><strong>{PLANS[k].monthly}</strong></span>
              <span className="small muted">{PLANS[k].annual} · {PLANS[k].perks}</span>
            </span>
          </label>
        ))}
        <label className="choice" style={{ alignItems: 'flex-start' }}>
          <input type="radio" name="plan" value="preview" style={{ accentColor: 'var(--gold)', marginTop: 4 }} />
          <span className="stack grow" style={{ gap: 4 }}>
            <span className="row" style={{ justifyContent: 'space-between' }}><strong>Preview</strong><strong>$9.99 once</strong></span>
            <span className="small muted">30 days, 5 matches you can view but not message</span>
          </span>
        </label>
      </div>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <button className="btn block">Continue</button>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Cancel any time in Settings. <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a></p>
    </form>
  );
}
