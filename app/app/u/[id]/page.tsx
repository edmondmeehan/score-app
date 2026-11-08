import Link from 'next/link';
import FounderBadge from '@/components/FounderBadge';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { Gauge, age } from '@/components/ui';
import { BANDS, type Profile } from '@/lib/types';
import { photoUrls } from '@/lib/photos';
import { sayHello } from '../../actions';
import { sendNote } from '../../features';
import { detailChips } from '@/lib/profileDetails';

export default async function Member({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();
  const photos = (await photoUrls(supabase, [p.id]))[p.id] || [];
  const { data: social } = await supabase.from('profile_socials').select('instagram').eq('user_id', p.id).maybeSingle();
  const { data: inviter } = p.invited_by ? await supabase.from('profiles').select('first_name').eq('id', p.invited_by).maybeSingle() : { data: null };
  const b = p.band ? BANDS[p.band] : null;
  const [a2, b2] = [me.id, p.id].sort();
  const [{ data: existing }, { data: mine }] = await Promise.all([
    supabase.from('conversations').select('id').eq('user_a', a2).eq('user_b', b2).maybeSingle(),
    supabase.rpc('my_addons'),
  ]);
  const notes: number = mine?.included ? Infinity : (mine?.note ?? 0);
  return (
    <div className="phone" style={{ paddingTop: 0 }}>
      <div className="photo" style={{ margin: '0 -20px', borderRadius: 0, aspectRatio: '4/5' }}>{photos[0] ? <img src={photos[0]} alt={`${p.first_name}`} /> : <span className="serif" style={{ fontSize: 64 }}>{p.first_name?.[0]}</span>}</div>
      <div><span className="serif" style={{ fontSize: 40 }}>{p.first_name}</span> <span className="muted" style={{ fontSize: 20 }}>{age(p.birth_year)}</span>{p.is_founder && <span style={{ marginLeft: 10, verticalAlign: 'middle' }}><FounderBadge /></span>}<div className="muted small">{[p.job, p.neighborhood].filter(Boolean).join(' · ')}</div></div>
      {b && (
        <div className="card gold row">
          <Gauge fill={b.fill} color={b.color} size={56} />
          <div className="stack grow" style={{ gap: 2 }}>
            <span className="label">Score band</span>
            <span className="serif" style={{ fontSize: 32, color: b.color }}>{b.label}</span>
            <span className="small muted">Verified{p.credit_verified_at ? ` ${new Date(p.credit_verified_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}{inviter?.first_name ? ` · Invited by ${inviter.first_name}` : ''}</span>
          </div>
          {p.trend === 'up' && <span className="small" style={{ color: 'var(--rise)', fontWeight: 600 }}>↑ Up</span>}
        </div>
      )}
      {detailChips(p).length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{detailChips(p).map((c) => <span key={c} className="chip">{c}</span>)}</div>
      )}
      {p.money_values?.length > 0 && (
        <div className="stack" style={{ gap: 8 }}><span className="label">Money values</span><div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{p.money_values.map((v) => <span key={v} className="chip">{v}</span>)}</div></div>
      )}
      {p.prompt_a && <div className="card stack" style={{ gap: 6 }}><span className="small muted">{p.prompt_q}</span><span className="serif" style={{ fontSize: 22 }}>{p.prompt_a}</span></div>}
      {p.song_id && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">{p.first_name}&apos;s song</span>
          <iframe title={`${p.first_name}'s song on Spotify`} src={`https://open.spotify.com/embed/track/${p.song_id}?theme=0`} width="100%" height="80" style={{ border: 0, borderRadius: 12 }} allow="encrypted-media" loading="lazy" />
        </div>
      )}
      {photos.slice(1).map((u) => <div key={u} className="photo"><img src={u} alt="" /></div>)}
      {social?.instagram && (
        <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noopener noreferrer" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="stack grow" style={{ gap: 2 }}><span className="label">Instagram</span><span>@{social.instagram}</span></span>
          <span className="small" style={{ color: 'var(--gold)' }}>Open ↗</span>
        </a>
      )}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {p.id === me.id ? (
        <Link href="/app/profile" className="btn block">Edit profile</Link>
      ) : existing ? (
        <div className="row"><Link href={`/app/report/${p.id}`} className="btn ghost sm">Report</Link><Link href={`/app/messages/${existing.id}`} className="btn grow">Open conversation</Link></div>
      ) : (
        <div className="stack">
          <div className="row">
            <Link href={`/app/report/${p.id}`} className="btn ghost sm">Report</Link>
            {me.plan === 'preview' ? (
              <Link href="/plans" className="btn ghost grow">Become a member to say hello</Link>
            ) : (
              <form action={sayHello} className="grow"><input type="hidden" name="id" value={p.id} /><button className="btn block">Say hello</button></form>
            )}
          </div>
          <details className="card" open={me.plan === 'preview'}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Send a Note <span className="small muted">· stands out in their inbox{me.plan === 'preview' ? ', works on Preview' : ''}</span></summary>
            <form action={sendNote} className="stack" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={p.id} />
              <label className="field">Your note<textarea className="input" name="body" rows={3} maxLength={500} required placeholder={p.prompt_a ? `Say something about “${p.prompt_a.slice(0, 40)}”` : 'Say something specific'} /></label>
              {notes > 0 ? (
                <button className="btn block">Send Note{Number.isFinite(notes) ? ` (${notes} left)` : ''}</button>
              ) : (
                <Link href="/app/shop" className="btn block">Get Notes · from $1.99</Link>
              )}
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
