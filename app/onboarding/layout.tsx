import { redirect } from 'next/navigation';
import { getMe } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Score is invite only: onboarding requires a redeemed invite (staff are exempt). */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin?next=/onboarding');
  const [{ data: isStaff }, { count }] = await Promise.all([
    supabase.rpc('is_staff'),
    supabase.from('invites').select('code', { count: 'exact', head: true }).eq('redeemed_by', me.id),
  ]);
  if (!isStaff && !count) redirect('/join?need=1');
  return <>{children}</>;
}
