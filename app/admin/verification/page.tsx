import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';
import { staffAct } from '../actions';

export default async function Verification() {
  const supabase = await supabaseServer();
  const [{ data: idq }, { data: phq }] = await Promise.all([
    supabase.from('profiles').select('*').in('id_status', ['review', 'pending']).order('created_at').limit(50),
    supabase.from('profiles').select('*').eq('photo_status', 'review').order('created_at').limit(50),
  ]);
  const photoMap = await photoUrls(supabase, (phq || []).map((p) => p.id), false);
  const btn = (action: string, user: string, label: string, cls = 'btn ghost sm') => (
    <form action={staffAct}><input type="hidden" name="action" value={action} /><input type="hidden" name="user" value={user} /><input type="hidden" name="back" value="/admin/verification" /><input type="hidden" name="reason" value={label} /><button className={cls}>{label}</button></form>
  );
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Verification</h1>
      <section className="card stack">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>ID checks waiting</h2>
        <span className="small muted">ID images stay in the verification partner&apos;s dashboard. Review the case there, then record the decision here.</span>
        {(idq as Profile[] | null)?.length ? (idq as Profile[]).map((p) => (
          <div key={p.id} className="list-row"><Link href={`/admin/members/${p.id}`} className="grow" style={{ color: 'var(--ivory)' }}>{p.first_name || p.email}</Link><span className="small muted">{p.id_status}</span>{btn('approve_id', p.id, 'Approve')}{btn('decline_id', p.id, 'Decline', 'btn danger sm')}</div>
        )) : <span className="small muted">Nothing waiting.</span>}
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Photos needing a person</h2>
        <span className="small muted">These didn&apos;t clearly match the member&apos;s live selfie. Approve only if they&apos;re clearly the same person and follow the photo rules.</span>
        {(phq as Profile[] | null)?.length ? (phq as Profile[]).map((p) => (
          <div key={p.id} className="stack" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
            <div className="row"><Link href={`/admin/members/${p.id}`} className="grow" style={{ color: 'var(--ivory)' }}>{p.first_name || p.email}</Link>{btn('approve_photos', p.id, 'Approve photos')}{btn('reject_photos', p.id, 'Reject', 'btn danger sm')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>{(photoMap[p.id] || []).map((u) => <div key={u} className="photo"><img src={u} alt="" /></div>)}</div>
          </div>
        )) : <span className="small muted">Nothing waiting.</span>}
      </section>
    </>
  );
}
