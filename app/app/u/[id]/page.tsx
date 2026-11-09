import Link from 'next/link';
import FounderBadge from '@/components/FounderBadge';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { Gauge, age } from '@/components/ui';
import { BANDS, type Profile } from '@/lib/types';
import { photoUrls } from '@/lib/photos';
import { replyToPrompt, sayHello } from '../../actions';
import MoneyStyleCard from '@/components/MoneyStyleCard';
import PlaceDetails from '@/components/PlaceDetails';
import { likeMember, unlikeMember } from '../../likes/actions';
import { sendNote } from '../../features';
import { LOOKING_FOR, NYC_SLOTS, detailChips, label } from '@/lib/profileDetails';
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge';
import ScreenshotContext from '@/components/ScreenshotContext';

export default async function Member({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; liked?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me } = await requireMember();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p) notFound();
  const photos = (await photoUrls(supabase, [p.id]))[p.id] || [];
  const { data: social } = await supabase.from('profile_socials').select('instagram').eq('user_id', p.id).maybeSingle();
  const { data: inviter } = p.invited_by ? await supabase.from('profiles').select('first_name').eq('id', p.invited_by).maybeSingle() : { data: null };
  const { data: voiceSigned } = p.voice_path ? await supabase.storage.from('voices').createSignedUrl(p.voice_path, 3600) : { data: null };
  const { data: vouch } = await supabase.from('vouches').select('body, voucher_id').eq('member_id', p.id).eq('status', 'approved').maybeSingle();
  const b = p.band ? BANDS[p.band] : null;
  const prompts = (p.prompts && p.prompts.length ? p.prompts : p.prompt_a ? [{ q: p.prompt_q || '', a: p.prompt_a }] : []).filter((x) => x?.a);
  const nyc = (p.my_nyc || []).filter((s) => s?.name);
  const [a2, b2] = [me.id, p.id].sort();
  const [{ data: existing }, { data: mine }] = await Promise.all([
    supabase.from('conversations').select('id').eq('user_a', a2).eq('user_b', b2).maybeSingle(),
    supabase.rpc('my_addons'),
  ]);
  const notes: number = mine?.included ? Infinity : (mine?.note ?? 0);
  const [{ data: liked }] = await Promise.all([
    supabase.from('likes').select('liker').eq('liker', me.id).eq('liked', p.id).maybeSingle(),
    p.id !== me.id ? supabase.rpc('log_profile_view', { p_viewed: p.id }) : Promise.resolve(null),
  ]);
  return (
    <div className="phone" style={{ paddingTop: 0 }}>
      <ScreenshotContext context="profile" target={p.id === me.id ? null : p.id} />
      <div className="photo" style={{ margin: '0 -20px', borderRadius: 0, aspectRatio: '4/5' }}>{photos[0] ? <img src={photos[0]} alt={`${p.first_name}`} /> : <span className="serif" style={{ fontSize: 64 }}>{p.first_name?.[0]}</span>}</div>
      <div><span className="serif" style={{ fontSize: 40 }}>{p.first_name}</span> <span className="muted" style={{ fontSize: 20 }}>{age(p.birth_year)}</span>{p.is_founder && <span style={{ marginLeft: 10, verticalAlign: 'middle' }}><FounderBadge /></span>}{isVerified(p) && <span style={{ marginLeft: 8 }}><VerifiedBadge credit={Boolean(p.credit_verified_at)} /></span>}<div className="muted small">{[p.job, p.neighborhood].filter(Boolean).join(' · ')}</div>{p.looking_for && <div style={{ marginTop: 10 }}><span className="looking-for">Looking for · {label(LOOKING_FOR, p.looking_for)}</span></div>}</div>
      {b && (
        <div className="card gold row">
          <Gauge fill={b.fill} color={b.color} size={56} />
          <div className="stack grow" style={{ gap: 2 }}>
            <span className="label">ScoreDate band</span>
            <span className="serif" style={{ fontSize: 32, color: b.color }}>{b.label}</span>
            <span className="small muted">{p.credit_verified_at ? `Verified ${new Date(p.credit_verified_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'Self-reported'}{inviter?.first_name ? ` · Invited by ${inviter.first_name}` : ''}</span>
          </div>
          {p.trend === 'up' && p.show_improving && <span className="small" style={{ color: 'var(--rise)', fontWeight: 600 }}>↑ Improving</span>}
        </div>
      )}
      {detailChips(p).length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{detailChips(p).map((c) => <span key={c} className="chip">{c}</span>)}</div>
      )}
      {voiceSigned?.signedUrl && (
        <div className="card stack" style={{ gap: 8 }}>
          <span className="label">{p.id === me.id ? 'My voice' : `Hear ${p.first_name}`}</span>
          <audio controls preload="none" src={voiceSigned.signedUrl} style={{ width: '100%' }} />
        </div>
      )}
      {vouch && (
        <div className="card gold stack" style={{ gap: 6 }}>
          <span className="label">Vouched for by {inviter?.first_name || 'a member'}</span>
          <span className="serif" style={{ fontSize: 20, lineHeight: 1.3 }}>“{vouch.body}”</span>
        </div>
      )}
      {p.money_values?.length > 0 && <MoneyStyleCard name={p.first_name || 'Their'} theirs={p.money_values} mine={me.money_values || []} isMe={p.id === me.id} />}
      {(p.flag_habit || (p.flag_splurge && p.flag_save)) && (
        <div className="card stack" style={{ gap: 10 }}>
          <span className="label" style={{ color: 'var(--rise)' }}>Financial green flags</span>
          {p.flag_habit && <div className="stack" style={{ gap: 2 }}><span className="small muted">My sexiest money habit</span><span className="serif" style={{ fontSize: 22 }}>{p.flag_habit}</span></div>}
          {p.flag_splurge && p.flag_save && <div className="stack" style={{ gap: 2 }}><span className="small muted">I’ll splurge on {p.flag_splurge}, but always save on…</span><span className="serif" style={{ fontSize: 22 }}>{p.flag_save}</span></div>}
        </div>
      )}
      {prompts.map((pr, i) => (
        <div key={pr.q} className="stack" style={{ gap: 12 }}>
          <div className="prompt-card">
            <span className="small muted">{pr.q}</span>
            <span className="serif">{pr.a}</span>
            {p.id !== me.id && (
              me.plan === 'preview' ? <Link href="/plans" className="small" style={{ color: 'var(--gold-light)', fontWeight: 600 }}>Become a member to reply</Link> : (
                <details className="prompt-reply">
                  <summary data-haptic="medium">↩ Reply to this</summary>
                  <form action={replyToPrompt}>
                    <input type="hidden" name="id" value={p.id} /><input type="hidden" name="prompt" value={`${pr.q} ${pr.a}`} />
                    <textarea className="input" name="body" rows={2} maxLength={1000} required placeholder={`Say something about “${pr.a.slice(0, 40)}${pr.a.length > 40 ? '…' : ''}”`} />
                    <button className="btn sm" data-haptic="success" style={{ alignSelf: 'flex-start' }}>Send reply</button>
                  </form>
                </details>
              )
            )}
          </div>
          {photos[i + 1] && <div className="photo"><img src={photos[i + 1]} alt="" /></div>}
        </div>
      ))}
      {nyc.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <span className="label">{p.id === me.id ? 'My NYC' : `${p.first_name}’s NYC`}</span>
          <div className="nyc-spots">
            {nyc.map((s) => (
              <div key={s.slot} className="nyc-spot">
                <span className="small muted">{NYC_SLOTS.find((x) => x.key === s.slot)?.label}</span>
                <strong className="serif" style={{ fontSize: 22, fontWeight: 400 }}>{s.name}</strong>
                {s.note && <span className="small">{s.note}</span>}
                {s.place_id && <PlaceDetails placeId={s.place_id} compact />}
              </div>
            ))}
          </div>
        </div>
      )}
      {p.song_id && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">{p.first_name}&apos;s song</span>
          <iframe title={`${p.first_name}'s song on Spotify`} src={`https://open.spotify.com/embed/track/${p.song_id}?theme=0`} width="100%" height="80" style={{ border: 0, borderRadius: 12 }} allow="encrypted-media" loading="lazy" />
        </div>
      )}
      {photos.slice(prompts.length + 1).map((u) => <div key={u} className="photo"><img src={u} alt="" /></div>)}
      {social?.instagram && (
        <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noopener noreferrer" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="stack grow" style={{ gap: 2 }}><span className="label">Instagram</span><span>@{social.instagram}</span></span>
          <span className="small" style={{ color: 'var(--gold)' }}>Open ↗</span>
        </a>
      )}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.liked && <div className="notice">Liked. If {p.first_name} likes you back, you’ll match.</div>}
      {p.id === me.id ? (
        <Link href="/app/profile" className="btn block">Edit profile</Link>
      ) : existing ? (
        <div className="row"><Link href={`/app/report/${p.id}`} className="btn ghost sm">Report</Link><Link href={`/app/messages/${existing.id}`} className="btn grow">Open conversation</Link></div>
      ) : (
        <div className="stack">
          <div className="row">
            <Link href={`/app/report/${p.id}`} className="btn ghost sm">Report</Link>
            <form action={liked ? unlikeMember : likeMember}>
              <input type="hidden" name="id" value={p.id} />
              <button className={liked ? 'btn sm' : 'btn ghost sm'} data-haptic={liked ? 'light' : 'success'} aria-pressed={Boolean(liked)} aria-label={liked ? `Unlike ${p.first_name}` : `Like ${p.first_name}`} style={{ minWidth: 48 }}>{liked ? '♥' : '♡'}</button>
            </form>
            {me.plan === 'preview' ? (
              <Link href="/plans" className="btn ghost grow">Become a member to say hello</Link>
            ) : (
              <form action={sayHello} className="grow"><input type="hidden" name="id" value={p.id} /><button className="btn block" data-haptic="medium">Say hello</button></form>
            )}
          </div>
          <details className="card" open={me.plan === 'preview'}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }} data-haptic="medium">Send a Note <span className="small muted">· stands out in their inbox{me.plan === 'preview' ? ', works on Preview' : ''}</span></summary>
            <form action={sendNote} className="stack" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={p.id} />
              <label className="field">Your note<textarea className="input" name="body" rows={3} maxLength={500} required placeholder={p.prompt_a ? `Say something about “${p.prompt_a.slice(0, 40)}”` : 'Say something specific'} /></label>
              {notes > 0 ? (
                <button className="btn block" data-haptic="success">Send Note{Number.isFinite(notes) ? ` (${notes} left)` : ''}</button>
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
