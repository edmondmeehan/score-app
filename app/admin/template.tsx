import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { canOpen } from '@/lib/staffAccess';

export const dynamic = 'force-dynamic';

/** Re-checked on every admin navigation: staff only see the areas their role allows (lib/staffAccess). */
export default async function AdminTemplate({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const [{ data: role }, h] = await Promise.all([supabase.rpc('staff_role'), headers()]);
  const path = h.get('x-sd-path') || '/admin';
  if (canOpen(role as string | null, path)) return <>{children}</>;
  return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <span className="label">No access</span>
      <span>Your admin role doesn’t include this area. Ask an owner to change your role in Admin → Admins if you need it.</span>
      <a href="/admin" className="pill-link" style={{ alignSelf: 'flex-start' }}>← Admin overview</a>
    </div>
  );
}
