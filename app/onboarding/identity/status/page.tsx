import { redirect } from 'next/navigation';
import { getMe, nextStep } from '@/lib/session';
import { getInquiry, personaConfigured } from '@/lib/persona';
import { supabaseAnon } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function IdStatus() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  // Pull the latest result straight from the vendor in case the webhook hasn't arrived yet.
  if (me.id_status === 'pending' && (await personaConfigured())) {
    const { data: v } = await supabase.from('verifications').select('provider_ref').eq('user_id', me.id).eq('kind', 'id').eq('provider', 'persona').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (v?.provider_ref) {
      const r = await getInquiry(v.provider_ref).catch(() => null);
      if (r && r.status !== 'pending' && r.referenceId === me.id) {
        await supabaseAnon().rpc('record_id_result', { p_secret: process.env.SCORE_SERVER_SECRET, p_user: me.id, p_provider: 'persona', p_ref: v.provider_ref, p_status: r.status });
        redirect('/onboarding/identity/status');
      }
    }
  }
  if (me.id_status === 'approved') redirect(nextStep(me));
  const copy = {
    pending: ['Checking your ID', 'This usually takes under a minute. You can leave this page; we’ll email you.'],
    review: ['A person is taking a look', 'Some checks need human review. It usually takes a few hours. We’ll email you.'],
    declined: ['We couldn’t verify your ID', 'This is often a blurry photo or glare. You can try again.'],
    none: ['Not started', ''],
    approved: ['', ''],
  }[me.id_status];
  return (
    <div className="phone" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <h1 className="serif" style={{ fontSize: 36 }}>{copy[0]}</h1>
      <p className="muted">{copy[1]}</p>
      {me.id_status === 'pending' && <meta httpEquiv="refresh" content="8" />}
      {me.id_status === 'declined' && <a className="btn block" href="/onboarding/identity">Try again</a>}
      <a href="/onboarding/identity/status" className="small">Refresh</a>
    </div>
  );
}
