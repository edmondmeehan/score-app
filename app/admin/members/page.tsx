import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { BandPill } from '@/components/ui';
import type { Profile } from '@/lib/types';

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  if (sp.q) q = q.or(`first_name.ilike.%${sp.q.replace(/[%,()]/g, '')}%,email.ilike.%${sp.q.replace(/[%,()]/g, '')}%`);
  if (sp.status) q = q.eq('status', sp.status);
  const { data } = await q;
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Members</h1>
      <form className="row" style={{ flexWrap: 'wrap' }}>
        <input className="input" name="q" placeholder="Search name or email" defaultValue={sp.q || ''} style={{ maxWidth: 320 }} />
        <select className="input" name="status" defaultValue={sp.status || ''} style={{ maxWidth: 200 }}><option value="">All statuses</option>{['onboarding', 'preview', 'active', 'paused', 'taken', 'suspended', 'removed'].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn sm">Filter</button>
      </form>
      <div className="card scroll-x"><table className="data" style={{ minWidth: 820 }}>
        <thead><tr><th>Member</th><th>Band</th><th>Status</th><th>Plan</th><th>ID</th><th>Photos</th><th>Joined</th></tr></thead>
        <tbody>{(data as Profile[] | null)?.map((p) => (
          <tr key={p.id}><td><Link href={`/admin/members/${p.id}`} style={{ color: 'var(--ivory)', fontWeight: 600 }}>{p.first_name || p.email}</Link></td><td><BandPill band={p.band} trend={p.trend} verified={Boolean(p.credit_verified_at)} /></td><td>{p.status}</td><td className="muted">{p.plan}</td><td className="muted">{p.id_status}</td><td className="muted">{p.photo_status}</td><td className="muted">{new Date(p.created_at).toLocaleDateString()}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
