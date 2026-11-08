import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';
import { staffAct } from '../actions';
import { setCreditMode } from './actions';
import { getCreditMode } from '@/lib/creditMode';
import { spinwheelConfigured } from '@/lib/spinwheel';

export default async function Verification({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const mode = await getCreditMode();
  const { count: selfCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).not('band', 'is', null).is('credit_verified_at', null);
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
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Credit bands</h2>
          <span className="chip small" style={{ color: mode === 'self' ? 'var(--gold)' : 'var(--rise)' }}>{mode === 'self' ? 'Self-reported' : 'Partner verified'}</span>
        </div>
        <span className="small muted">{mode === 'self'
          ? 'Members pick their own band from a free credit score (Credit Karma, Credit Sesame, their bank). Bands show “self-reported” and the Verified badge reads “ID verified”.'
          : 'Members verify their band with a soft check through the credit partner (Spinwheel). Members who self-reported earlier keep the self-reported label and are asked to verify.'}</span>
        <span className="small muted">{(selfCount ?? 0).toLocaleString('en-US')} member{selfCount === 1 ? '' : 's'} currently have a self-reported band.</span>
        <form action={setCreditMode} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="hidden" name="mode" value={mode === 'self' ? 'verified' : 'self'} />
          <button className="btn ghost sm">{mode === 'self' ? 'Switch to partner verification' : 'Switch to self-reported bands'}</button>
          {mode === 'self' && !spinwheelConfigured() && <span className="small" style={{ color: 'var(--alert)' }}>The credit partner isn’t connected yet, so new members would see the test screen.</span>}
        </form>
      </section>
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
