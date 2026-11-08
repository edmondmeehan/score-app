import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { BandPill } from '@/components/ui';
import { photoUrls } from '@/lib/photos';
import type { Profile } from '@/lib/types';
import { staffAct } from '../../actions';

export default async function MemberDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();
  const [{ data: ver }, { data: log }, { data: reps }, photos] = await Promise.all([
    supabase.from('verifications').select('kind, provider, status, detail, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('audit_log').select('*').eq('target_user', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('reports').select('reason, status, created_at').eq('reported_id', id),
    photoUrls(supabase, [id], false),
  ]);
  const back = `/admin/members/${id}`;
  const act = (action: string, label: string, cls = 'btn ghost sm') => (
    <form action={staffAct}><input type="hidden" name="action" value={action} /><input type="hidden" name="user" value={id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="reason" value={`${label} from member page`} /><button className={cls}>{label}</button></form>
  );
  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}><h1 className="serif" style={{ fontSize: 40 }}>{p.first_name || p.email}</h1><BandPill band={p.band} trend={p.trend} /><span className="chip">{p.status}</span></div>
      {sp.error && <div className="notice error">{sp.error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <section className="card stack" style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verification</h2>
          <span className="small">ID: {p.id_status} · Photos: {p.photo_status}</span>
          <span className="small">Band verified: {p.credit_verified_at ? new Date(p.credit_verified_at).toLocaleDateString() : 'not yet'}</span>
          <div className="notice">ScoreDate never stores exact credit scores, reports, or ID images.</div>
          {(ver || []).map((v, i) => <span key={i} className="small muted">{new Date(v.created_at).toLocaleString()} · {v.kind} · {v.provider} · {v.status} {v.detail ? `· ${v.detail}` : ''}</span>)}
        </section>
        <section className="card stack" style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Account</h2>
          <span className="small">Email: {p.email}</span><span className="small">Home zip: {p.zip || "not set"}{p.borough ? ` · ${p.borough}` : ""}</span><span className="small">Plan: {p.plan}</span><span className="small">Founder: {p.is_founder ? 'yes' : 'no'}</span>
          <span className="small">Reports against: {reps?.length || 0}</span>
        </section>
      </div>
      {(photos[id] || []).length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>{photos[id].map((u) => <div key={u} className="photo"><img src={u} alt="" /></div>)}</div>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {act('approve_id', 'Approve ID')}{act('decline_id', 'Decline ID')}{act('approve_photos', 'Approve photos')}{act('suspend', 'Suspend')}{act('reinstate', 'Reinstate')}{act('remove', 'Remove', 'btn danger sm')}
      </div>
      <section className="card stack"><h2 style={{ fontSize: 16, fontWeight: 600 }}>History</h2>{(log || []).map((l) => <span key={l.id} className="small muted">{new Date(l.created_at).toLocaleString()} · {l.staff_email} · {l.action} · {l.reason}</span>)}</section>
    </>
  );
}
