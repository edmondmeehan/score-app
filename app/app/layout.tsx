import TabBar from './TabBar';
import NativePurchases from '@/components/NativePurchases';
import AppFeedback from '@/components/AppFeedback';
import NativePush from '@/components/NativePush';
import PresenceBeat from '@/components/PresenceBeat';
import PullToRefresh from '@/components/PullToRefresh';
import { getMe } from '@/lib/session';
import SpotlightGlow from '@/components/SpotlightGlow';
import { getIntegration } from '@/lib/integrations';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user, me }, rc] = await Promise.all([getMe(), getIntegration('revenuecat').catch(() => null)]);
  const iosKey = rc?.config.ios_public_key || process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  const androidKey = rc?.config.android_public_key || process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  return (
    <>
      <PullToRefresh>{children}</PullToRefresh>
      <TabBar />
      <SpotlightGlow until={(me as { spotlight_until?: string | null } | null)?.spotlight_until} />
      <AppFeedback />
      {user && <NativePush />}
      {user && <PresenceBeat on={Boolean((me as { show_online?: boolean } | null)?.show_online)} />}
      {user && (iosKey || androidKey) && <NativePurchases userId={user.id} iosKey={iosKey} androidKey={androidKey} />}
    </>
  );
}
