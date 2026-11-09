import { redirect } from 'next/navigation';
import { getMe, hasInvite } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** ScoreDate is invite only: onboarding requires a redeemed invite (staff are exempt). */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin?next=/onboarding');
  if (!(await hasInvite(supabase, me.id))) redirect('/join?need=1');
  return <>{children}</>;
}
