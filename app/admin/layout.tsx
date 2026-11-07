import { requireStaff } from '@/lib/session';
import AdminNav from './AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, staffEmail } = await requireStaff();
  const [{ count: rep }, { count: ver }, { count: del }] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).or('id_status.eq.review,photo_status.eq.review'),
    supabase.from('deletion_requests').select('user_id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  return (
    <div className="admin">
      <AdminNav counts={{ rep: rep || 0, ver: ver || 0, del: del || 0 }} email={staffEmail} />
      <main>{children}</main>
    </div>
  );
}
