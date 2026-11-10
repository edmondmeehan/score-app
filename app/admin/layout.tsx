import { requireStaff } from '@/lib/session';
import AdminNav from './AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, staffEmail } = await requireStaff();
  const { data: role } = await supabase.rpc('staff_role');
  const [{ count: rep }, { count: ver }, { count: del }, { count: sup }, { count: vid }] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).or('id_status.eq.review,photo_status.eq.review'),
    supabase.from('deletion_requests').select('user_id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('video_status', 'pending').then((r) => (r.error ? { count: 0 } : r)),
  ]);
  return (
    <div className="admin">
      <AdminNav counts={{ rep: rep || 0, ver: ver || 0, del: del || 0, sup: sup || 0, vid: vid || 0 }} email={staffEmail} role={(role as string) || null} />
      <main>{children}</main>
    </div>
  );
}
