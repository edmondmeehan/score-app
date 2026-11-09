import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export async function getMe() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, me: null as Profile | null };
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, me: data as Profile | null };
}

/** Where a signed-in person should be, based on how far they are. */
export function nextStep(me: Profile): string {
  if (me.status === 'removed' || me.status === 'suspended') return '/app/settings';
  if (!me.first_name || !me.gender || !me.birth_year || !me.zip) return '/onboarding/basics';
  if (me.id_status === 'none' || me.id_status === 'declined') return '/onboarding/identity';
  if (me.id_status === 'pending' || me.id_status === 'review') return '/onboarding/identity/status';
  if (!me.band) return '/onboarding/credit';
  if (!me.money_values || me.money_values.length < 3) return '/onboarding/quiz';
  if (me.photo_status === 'none') return '/onboarding/photos';
  if (me.plan === 'none') return '/plans';
  return '/app';
}

export async function requireMember() {
  const ctx = await getMe();
  if (!ctx.user || !ctx.me) redirect('/signin');
  const step = nextStep(ctx.me);
  if (step !== '/app' && !['paused', 'taken'].includes(ctx.me.status)) redirect(step);
  // Paused or Taken: you can sign in and manage your account, but everything else waits until you reactivate.
  if (['paused', 'taken'].includes(ctx.me.status)) {
    const path = (await headers()).get('x-sd-path') || '';
    const open = ['/app/paused', '/app/settings', '/app/support'].some((p) => path === p || path.startsWith(p + '/'));
    if (!open) redirect('/app/paused');
  }
  return ctx as { supabase: typeof ctx.supabase; user: NonNullable<typeof ctx.user>; me: Profile };
}

export async function requireStaff() {
  const ctx = await getMe();
  if (!ctx.user) redirect('/signin?next=/admin');
  const { data: isStaff } = await ctx.supabase.rpc('is_staff');
  if (!isStaff) redirect('/app');
  const { data: email } = await ctx.supabase.rpc('staff_email');
  return { ...ctx, staffEmail: email as string };
}
