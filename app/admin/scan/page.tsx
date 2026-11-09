import { requireStaff } from '@/lib/session';
import Scanner from './Scanner';

export const dynamic = 'force-dynamic';

export default async function Scan({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const { data: events } = await supabase.from('events').select('id, title, starts_at').eq('status', 'published')
    .gte('starts_at', new Date(Date.now() - 12 * 3600000).toISOString()).order('starts_at').limit(30);
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Scan members</h1>
      <span className="small muted">Scan a member’s pass (Me → Member pass) to verify them and check them in. Passes change every 30 seconds, so screenshots and forwarded codes don’t work. Works best on a phone.</span>
      <Scanner events={(events as { id: string; title: string; starts_at: string }[]) || []} initialEvent={sp.event} />
    </>
  );
}
