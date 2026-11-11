import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from '@/app/signin/actions';
import TwoStep from './TwoStep';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Two-step sign-in · ScoreDate', robots: { index: false } };

const safe = (n: string | undefined) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

/** Enter a two-step code, or set two-step up (required for staff, optional for members). */
export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string; required?: string; setup?: string }> }) {
  const sp = await searchParams;
  const next = safe(sp.next);
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/two-step?next=${next}`)}`);
  const { data: onStaff } = await supabase.rpc('am_staff');
  return (
    <div className="phone" style={{ justifyContent: 'center' }}>
      <TwoStep next={next} staff={Boolean(onStaff)} required={sp.required === '1' || Boolean(onStaff)} setup={sp.setup === '1'} />
      <form action={signOut} style={{ alignSelf: 'center' }}><button className="btn ghost sm">Sign out</button></form>
    </div>
  );
}
