import PageBack from '@/components/PageBack';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';
import { TestBanner } from '@/components/ui';
import { PLANS } from '@/lib/types';
import { getFounderOffer } from '@/lib/founderOffer';
import { getReserveVisible } from '@/lib/reserve';
import FounderBadge from '@/components/FounderBadge';
import { choosePlan } from '../onboarding/actions';
import { headers } from 'next/headers';
import { getIntegration } from '@/lib/integrations';
import NativePaywall from './NativePaywall';

export default async function Plans({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  const offer = me.is_founder ? await getFounderOffer(supabase) : null;
  const showReserve = me.plan === 'black' || (await getReserveVisible(supabase));
  const planKeys = (Object.keys(PLANS) as (keyof typeof PLANS)[]).filter((k) => k !== 'black' || showReserve);
  const sp = await searchParams;
  const native = /ScoreDateApp/.test((await headers()).get('user-agent') || '');
  const [rc, { data: testMode }] = await Promise.all([getIntegration('revenuecat').catch(() => null), supabase.rpc('test_mode')]);
  const iosKey = rc?.config.ios_public_key || process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  const androidKey = rc?.config.android_public_key || process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  // In the iPhone app, memberships are bought through Apple (App Store rule 3.1.1).
  if (native && (iosKey || androidKey)) {
    return <NativePaywall userId={me.id} iosKey={iosKey} androidKey={androidKey} currentPlan={me.plan} plans={planKeys.map((k) => ({ key: k, name: PLANS[k].name, perks: PLANS[k].perks }))} />;
  }
  // On the website (once payments are live): memberships are bought in the app.
  if (!testMode) {
    const store = process.env.NEXT_PUBLIC_APP_STORE_URL;
    return (
      <div className="phone">
        <PageBack />
        <h1 className="serif" style={{ fontSize: 36 }}>Become a member</h1>
        <div className="card gold stack" style={{ gap: 10 }}>
          <strong>Memberships are in the ScoreDate app</strong>
          <span className="small">Download ScoreDate on your iPhone, sign in with this email, and choose Membership, Premium or Preview there. Your plan works everywhere you sign in.</span>
          {store ? <a className="btn block" href={store}>Get ScoreDate on the App Store</a> : <span className="small muted">The iPhone app is in final testing. We’ll email you the moment it’s in the App Store.</span>}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {planKeys.map((k) => <div key={k} className="card row" style={{ justifyContent: 'space-between' }}><span><strong>{PLANS[k].name}</strong><br /><span className="small muted">{PLANS[k].perks}</span></span><strong>{PLANS[k].monthly}</strong></div>)}
        </div>
      </div>
    );
  }
  return (
    <form action={choosePlan} className="phone">
      <PageBack />
        <h1 className="serif" style={{ fontSize: 36 }}>Become a member</h1>
      <TestBanner>Payments aren&apos;t connected. Choosing a paid plan activates it without charging. The iPhone app will bill through the App Store.</TestBanner>
      {offer?.enabled && (
        <div className="card gold stack" style={{ gap: 6 }}>
          <FounderBadge size="md" />
          <strong>Your Founding Member price</strong>
          <span className="small">{offer.intro}, then Membership at {offer.monthly} (regularly {offer.regular}) for as long as you stay subscribed.</span>
          <span className="small muted">Applied automatically when you subscribe in the ScoreDate iPhone app.</span>
        </div>
      )}
      <div className="stack" role="radiogroup" aria-label="Plan">
        {planKeys.map((k, i) => (
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
