import TabBar from './TabBar';
import NativePurchases from '@/components/NativePurchases';
import AppFeedback from '@/components/AppFeedback';
import NativePush from '@/components/NativePush';
import PresenceBeat from '@/components/PresenceBeat';
import { supabaseServer } from '@/lib/supabase/server';
import { getIntegration } from '@/lib/integrations';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const [{ data: { user } }, rc] = await Promise.all([supabase.auth.getUser(), getIntegration('revenuecat').catch(() => null)]);
  const iosKey = rc?.config.ios_public_key || process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  const androidKey = rc?.config.android_public_key || process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  const { data: pres } = user ? await supabase.from('profiles').select('show_online').eq('id', user.id).maybeSingle() : { data: null };
  return (
    <>
      {children}
      <TabBar />
      <AppFeedback />
      {user && <NativePush />}
      {user && <PresenceBeat on={Boolean((pres as { show_online?: boolean } | null)?.show_online)} />}
      {user && (iosKey || androidKey) && <NativePurchases userId={user.id} iosKey={iosKey} androidKey={androidKey} />}
    </>
  );
}
