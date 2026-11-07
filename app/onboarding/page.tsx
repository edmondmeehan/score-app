import { redirect } from 'next/navigation';
import { getMe, nextStep } from '@/lib/session';

export default async function Onboarding() {
  const { me } = await getMe();
  if (!me) redirect('/signin');
  redirect(nextStep(me));
}
