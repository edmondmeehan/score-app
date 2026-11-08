import TabBar from './TabBar';
import NativePurchases from '@/components/NativePurchases';
import AppFeedback from '@/components/AppFeedback';
import NativePush from '@/components/NativePush';
import { supabaseServer } from '@/lib/supabase/server';
import { getIntegration } from '@/lib/integrations';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const [{ data: { user } }, rc] = await Promise.all([supabase.auth.getUser(), getIntegration('revenuecat').catch(() => null)]);
  const iosKey = rc?.config.ios_public_key || process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  const androidKey = rc?.config.android_public_key || process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  return (
    <>
      {children}
      <TabBar />
      <AppFeedback />
      {user && <NativePush />}
      {user && (iosKey || androidKey) && <NativePurchases userId={user.id} iosKey={iosKey} androidKey={androidKey} />}
    </>
  );
}
