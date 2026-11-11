import { redirect } from 'next/navigation';
import { getMe, nextStep } from '@/lib/session';

export default async function Onboarding() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/signin');
  // Staff skip member sign-up.
  const { data: onStaff } = await supabase.rpc('am_staff');
  if (onStaff) redirect('/app');
  redirect(nextStep(me));
}
