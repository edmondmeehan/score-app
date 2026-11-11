import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { canOpen } from '@/lib/staffAccess';

/** Who's signed in plus their profile. Cached per request, so the layout and the page share one lookup. */
export const getMe = cache(async function getMe() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, me: null as Profile | null };
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, me: data as Profile | null };
});

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

type Sb = Awaited<ReturnType<typeof supabaseServer>>;
/** ScoreDate is invite only: true once this person redeemed an invite (staff always pass). */
export async function hasInvite(supabase: Sb, userId: string): Promise<boolean> {
  const [{ data: isStaff }, { count }, { data: prof }] = await Promise.all([
    supabase.rpc('is_staff'),
    supabase.from('invites').select('code', { count: 'exact', head: true }).eq('redeemed_by', userId),
    supabase.from('profiles').select('status').eq('id', userId).maybeSingle(),
  ]);
  // Anyone who is already a member (or was) is in, invite or not: founders, test accounts, people added by staff.
  const member = ['active', 'preview', 'paused', 'taken'].includes(String(prof?.status || ''));
  return Boolean(isStaff) || Boolean(count) || member;
}

/**
 * Where to send someone right after they sign in or confirm their email. People without an invite go
 * straight to the invite screen, so they never see the app (or its loading screen) for a moment first.
 */
export async function afterSignIn(supabase: Sb, dest: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return dest;
  // Staff set up (or enter) their two-step code right at sign-in, not just when they open admin.
  const { data: onStaff } = await supabase.rpc('am_staff');
  if (onStaff) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') return `/two-step?required=1&next=${encodeURIComponent(dest.startsWith('/onboarding') ? '/app' : dest)}`;
    // Staff skip the member sign-up steps and the invite check.
    return dest.startsWith('/onboarding') ? '/app' : dest;
  }
  if (!(dest === '/app' || dest.startsWith('/app/') || dest.startsWith('/onboarding'))) return dest;
  return (await hasInvite(supabase, user.id)) ? dest : '/join?need=1';
}

export async function requireMember() {
  const ctx = await getMe();
  if (!ctx.user || !ctx.me) redirect('/signin');
  // Staff can use the whole app without finishing member sign-up (ID check, band, photos) or an invite.
  const { data: onStaff } = await ctx.supabase.rpc('am_staff');
  if (onStaff) return ctx as { supabase: typeof ctx.supabase; user: NonNullable<typeof ctx.user>; me: Profile };
  const step = nextStep(ctx.me);
  if (step !== '/app' && !['paused', 'taken'].includes(ctx.me.status)) {
    if (step.startsWith('/onboarding') && !(await hasInvite(ctx.supabase, ctx.user.id))) redirect('/join?need=1');
    redirect(step);
  }
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
  const path = (await headers()).get('x-sd-path') || '';
  // Everyone on the staff list must use two-step sign-in; staff powers don't switch on until they do.
  const { data: onStaff } = await ctx.supabase.rpc('am_staff');
  if (!onStaff) redirect('/app');
  const { data: aal } = await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect(`/two-step?required=1&next=${encodeURIComponent(path.startsWith('/admin') ? path : '/admin')}`);
  const { data: isStaff } = await ctx.supabase.rpc('is_staff');
  if (!isStaff) redirect('/app');
  const [{ data: email }, { data: role }] = await Promise.all([ctx.supabase.rpc('staff_email'), ctx.supabase.rpc('staff_role')]);
  // Role-based access (lib/staffAccess): pages and form actions under /admin check the area they belong to.
  if (path.startsWith('/admin') && !canOpen(role as string | null, path)) redirect('/admin?denied=1');
  return { ...ctx, staffEmail: email as string, staffRole: (role as string) || null };
}
