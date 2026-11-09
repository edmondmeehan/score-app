import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { spotifyConfigured } from '@/lib/spotify';
import { faceMatchConfigured } from '@/lib/facematch';
import { TestBanner } from '@/components/ui';
import PhotoUploader from '../../onboarding/photos/PhotoUploader';
import SongPicker from './SongPicker';
import VoiceIntro from './VoiceIntro';
import { PROMPTS } from '@/lib/prompts';
import { answerVouch, clearSong, movePhoto, removePhoto, saveAbout, saveDetails, saveFlags, saveImproving, saveInstagram, saveNycSpot, savePrompts } from './actions';
import { profileStrength } from '@/lib/profileStrength';
import { BANDS } from '@/lib/types';
import PlaceFields from '@/components/PlaceFields';
import { DRINKING, EDUCATION, EXERCISE, HAS_KIDS, HEIGHTS, LOOKING_FOR, NYC_SLOTS, PETS, POLITICS, RELIGION, SMOKING, WANTS_KIDS } from '@/lib/profileDetails';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, [string, string]> = {
  approved: ['Live', 'var(--rise)'], review: ['In review', 'var(--gold)'], pending: ['Checking', 'var(--gold)'], rejected: ['Not approved', 'var(--alert)'],
};

export default async function EditProfile({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; add?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, me } = await requireMember();
  const [{ data: photos }, { data: social }, searchable, faceOn, { data: vouch }] = await Promise.all([
    supabase.from('photos').select('id, path, position, match_status').eq('user_id', user.id).order('position'),
    supabase.from('profile_socials').select('instagram, instagram_public').eq('user_id', user.id).maybeSingle(),
    spotifyConfigured(),
    faceMatchConfigured(),
    supabase.from('vouches').select('body, status, voucher_id').eq('member_id', user.id).maybeSingle(),
  ]);
  const list = photos || [];
  const strength = profileStrength(me, list.filter((p) => p.match_status !== 'rejected').length);
  const { data: voiceSigned } = me.voice_path ? await supabase.storage.from('voices').createSignedUrl(me.voice_path, 3600) : { data: null };
  const { data: voucherName } = vouch ? await supabase.rpc('first_name_of', { p: vouch.voucher_id }) : { data: null };
  const { data: signed } = list.length ? await supabase.storage.from('photos').createSignedUrls(list.map((p) => p.path), 3600) : { data: [] };
  const room = 6 - list.length;

  return (
    <div className="phone">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href="/app/settings" className="small">← Settings</Link>
        <Link href={`/app/u/${user.id}`} className="small">Preview my profile</Link>
      </div>
      <h1 className="serif" style={{ fontSize: 38 }}>Your profile</h1>
      {sp.error && <div className="notice error">{sp.error}</div>}
      {sp.saved && <div className="notice">Saved.</div>}

      {/* Profile strength */}
      <section className="card stack strength" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">Profile strength</span><span className="mono" style={{ color: 'var(--gold-light)' }}>{strength.pct}%</span></div>
        <div className="strength-bar"><span style={{ width: `${strength.pct}%` }} /></div>
        {strength.next ? <Link href={strength.next.href} className="small">Next: {strength.next.label} →</Link> : <span className="small muted">Your profile is complete. Nice.</span>}
      </section>

      {vouch && vouch.status !== 'hidden' && (
        <section id="vouch" className="card gold stack" style={{ gap: 8 }}>
          <span className="label">{voucherName || 'Your inviter'} vouched for you</span>
          <span className="serif" style={{ fontSize: 20, lineHeight: 1.3 }}>“{vouch.body}”</span>
          {vouch.status === 'pending' ? (
            <>
              <span className="small muted">Nobody sees this unless you choose to show it.</span>
              <div className="row" style={{ gap: 8 }}>
                <form action={answerVouch}><input type="hidden" name="show" value="yes" /><button className="btn sm" data-haptic="success">Show on my profile</button></form>
                <form action={answerVouch}><input type="hidden" name="show" value="no" /><button className="btn ghost sm">Keep private</button></form>
              </div>
            </>
          ) : (
            <form action={answerVouch}><input type="hidden" name="show" value="no" /><span className="small muted">Showing on your profile. </span><button className="btn ghost sm">Hide it</button></form>
          )}
        </section>
      )}

      {/* Photos */}
      <section className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">Photos · {list.length} of 6</span>{room > 0 && !sp.add && <Link href="/app/profile?add=1#add" className="small">Add photos</Link>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {list.map((p, i) => {
            const [label, color] = STATUS[p.match_status] || ['', ''];
            return (
              <div key={p.id} className="stack" style={{ gap: 4 }}>
                <div style={{ position: 'relative' }}>
                  {signed?.[i]?.signedUrl ? <img src={signed[i].signedUrl} alt={`Photo ${i + 1}`} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 10, opacity: p.match_status === 'rejected' ? 0.4 : 1 }} /> : <div style={{ aspectRatio: '3/4', borderRadius: 10, background: 'var(--track)' }} />}
                  {i === 0 && <span className="small" style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,.6)', padding: '2px 6px', borderRadius: 6 }}>Main</span>}
                </div>
                <span className="small" style={{ color }}>{label}</span>
                <div className="row" style={{ gap: 4 }}>
                  {i > 0 && <form action={movePhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="up" /><button className="btn ghost sm" aria-label="Move earlier" style={{ padding: '4px 8px' }}>←</button></form>}
                  {i < list.length - 1 && <form action={movePhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="down" /><button className="btn ghost sm" aria-label="Move later" style={{ padding: '4px 8px' }}>→</button></form>}
                  <form action={removePhoto}><input type="hidden" name="id" value={p.id} /><button className="btn ghost sm" aria-label="Remove photo" style={{ padding: '4px 8px' }}>✕</button></form>
                </div>
              </div>
            );
          })}
        </div>
        <span className="small muted">Only photos marked Live are shown to members. The first live photo is your main photo.</span>
        {sp.add && room > 0 && (
          <div id="add" className="stack" style={{ gap: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>Add photos</span>
            <span className="small muted">Take a quick live selfie so AI can confirm the new photos are you. The selfie is discarded after the check.</span>
            {!faceOn && <TestBanner>Face matching isn&apos;t connected yet, so new photos go to our team for review.</TestBanner>}
            <PhotoUploader doneHref="/app/profile?saved=photos" max={room} />
          </div>
        )}
      </section>

      {/* Details (optional, searchable) */}
      <form id="details" action={saveDetails} className="card stack">
        <span style={{ fontWeight: 600 }}>Details</span>
        <span className="small muted">Optional. Members can filter search by these, so filling them in helps the right people find you.</span>
        <label className="field">Looking for<select className="input" name="looking_for" defaultValue={me.looking_for || ''}><option value="">Prefer not to say</option>{LOOKING_FOR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field">Height<select className="input" name="height_cm" defaultValue={me.height_cm ? String(me.height_cm) : ''}><option value="">Prefer not to say</option>{HEIGHTS.map((h) => <option key={h.cm} value={h.cm}>{h.label}</option>)}</select></label>
        <label className="field">Education<select className="input" name="education" defaultValue={me.education || ''}><option value="">Prefer not to say</option>{EDUCATION.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Kids<select className="input" name="has_kids" defaultValue={me.has_kids || ''}><option value="">Prefer not to say</option>{HAS_KIDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field grow">Future kids<select className="input" name="wants_kids" defaultValue={me.wants_kids || ''}><option value="">Prefer not to say</option>{WANTS_KIDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Drinking<select className="input" name="drinking" defaultValue={me.drinking || ''}><option value="">—</option>{DRINKING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field grow">Smoking<select className="input" name="smoking" defaultValue={me.smoking || ''}><option value="">—</option>{SMOKING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field grow">Exercise<select className="input" name="exercise" defaultValue={me.exercise || ''}><option value="">—</option>{EXERCISE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label className="field">Pets<select className="input" name="pets" defaultValue={me.pets || ''}><option value="">Prefer not to say</option>{PETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Religion<select className="input" name="religion" defaultValue={me.religion || ''}><option value="">Prefer not to say</option>{RELIGION.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field grow">Politics<select className="input" name="politics" defaultValue={me.politics || ''}><option value="">Prefer not to say</option>{POLITICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <span className="small muted">Religion and politics only show if you pick one. Leave them on “Prefer not to say” to keep them private.</span>
        {sp.saved === 'details' && <div className="notice">Saved.</div>}
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Save details</button>
      </form>

      {/* About */}
      <form id="about" action={saveAbout} className="card stack">
        <span className="label">About you</span>
        <label className="field">What you do<input className="input" name="job" maxLength={80} defaultValue={me.job || ''} /></label>
        <label className="field">Neighborhood<input className="input" name="neighborhood" maxLength={80} defaultValue={me.neighborhood || ''} /></label>
        <div className="row"><button className="btn ghost sm">Save</button><Link href="/onboarding/quiz" className="small">Retake money quiz</Link></div>
      </form>

      {/* Prompts */}
      <form id="prompts" action={savePrompts} className="card stack">
        <span className="label">Your prompts</span>
        <span className="small muted">Up to three. Members can reply to a prompt directly, so specific answers get the best conversations.</span>
        {[0, 1, 2].map((i) => {
          const cur = (me.prompts || [])[i] || (i === 0 && me.prompt_a ? { q: me.prompt_q || PROMPTS[0], a: me.prompt_a } : null);
          return (
            <div key={i} className="stack" style={{ gap: 6, paddingTop: i ? 10 : 0, borderTop: i ? '1px solid var(--line-soft)' : undefined }}>
              <select className="input" name={`q${i}`} defaultValue={cur?.q || PROMPTS[(i * 4) % PROMPTS.length]} aria-label={`Prompt ${i + 1}`}>{PROMPTS.map((p) => <option key={p}>{p}</option>)}</select>
              <textarea className="input" name={`a${i}`} rows={2} maxLength={200} defaultValue={cur?.a || ''} placeholder={i === 0 ? 'Your answer' : 'Your answer (optional)'} aria-label={`Answer ${i + 1}`} />
            </div>
          );
        })}
        {sp.saved === 'prompts' && <div className="notice">Saved.</div>}
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Save prompts</button>
      </form>

      {/* My NYC */}
      <section id="nyc" className="card stack">
        <span className="label">My NYC</span>
        <span className="small muted">Pin up to three places that feel like you. Matches can turn them into a date in one tap.</span>
        {NYC_SLOTS.map((slot) => {
          const cur = (me.my_nyc || []).find((s) => s.slot === slot.key);
          return (
            <form key={slot.key} action={saveNycSpot} className="stack" style={{ gap: 6, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
              <input type="hidden" name="slot" value={slot.key} />
              <span style={{ fontWeight: 600 }}>{slot.label}</span>
              <PlaceFields compact required={false} nameField="spot_name" nameLabel="Place" namePlaceholder={slot.placeholder} addressField="spot_address" addressLabel="Address" defaults={{ name: cur?.name, place_id: cur?.place_id || undefined }} />
              <input className="input" name="note" maxLength={120} defaultValue={cur?.note || ''} placeholder="Why you love it (optional)" />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost sm">Save</button>
                {cur && <button className="btn ghost sm" name="clear" value="1">Remove</button>}
              </div>
            </form>
          );
        })}
        {sp.saved === 'nyc' && <div className="notice">Saved.</div>}
      </section>

      {/* Financial Green Flags */}
      <form id="flags" action={saveFlags} className="card stack">
        <span className="label">Financial green flags</span>
        <span className="small muted">Conversation starters about money. Shown on your profile when you fill them in.</span>
        <label className="field">My sexiest money habit<input className="input" name="flag_habit" maxLength={120} defaultValue={me.flag_habit || ''} placeholder="I pay my card off in full every month" /></label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="field grow">I’ll splurge on…<input className="input" name="flag_splurge" maxLength={60} defaultValue={me.flag_splurge || ''} placeholder="concert tickets" /></label>
          <label className="field grow">…but always save on<input className="input" name="flag_save" maxLength={60} defaultValue={me.flag_save || ''} placeholder="takeout" /></label>
        </div>
        <label className="choice" style={{ alignItems: 'flex-start' }}><input type="checkbox" name="show_verified" defaultChecked={me.show_verified !== false} style={{ accentColor: 'var(--gold)', marginTop: 4 }} /><span className="stack" style={{ gap: 2 }}><strong>Show my Verified badge</strong><span className="small muted">Shows you finished ScoreDate’s ID and credit checks. Never shows your score.</span></span></label>
        {sp.saved === 'flags' && <div className="notice">Saved.</div>}
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>Save</button>
      </form>

      <VoiceIntro userId={user.id} url={voiceSigned?.signedUrl || null} seconds={me.voice_seconds ?? null} />

      {/* Song */}
      <section id="song" className="card stack">
        <span className="label">Your song</span>
        {me.song_id ? (
          <div className="stack" style={{ gap: 8 }}>
            <iframe title="Your song on Spotify" src={`https://open.spotify.com/embed/track/${me.song_id}?theme=0`} width="100%" height="80" style={{ border: 0, borderRadius: 12 }} allow="encrypted-media" loading="lazy" />
            <form action={clearSong}><button className="btn ghost sm">Remove song</button></form>
            <span className="small muted">Pick a different one below to replace it.</span>
          </div>
        ) : <span className="small muted">Add a song that says something about you. It plays on your profile.</span>}
        <SongPicker searchable={searchable} />
      </section>

      {/* Band level-ups: the public ↑ is opt-in */}
      {me.band && (
        <form id="improving" action={saveImproving} className="card stack">
          <span className="label">Improving badge</span>
          <span className="small muted">When your band is trending up, show a small ↑ next to {BANDS[me.band].label} so matches can see it. Off by default. Your trend is never shown unless you turn this on.</span>
          <label className="row small" style={{ gap: 10 }}><input type="checkbox" name="show" defaultChecked={Boolean(me.show_improving)} style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />Show my Improving badge</label>
          <button className="btn ghost sm">Save</button>
        </form>
      )}

      {/* Instagram */}
      <form action={saveInstagram} className="card stack">
        <span className="label">Instagram</span>
        <label className="field">Handle<input className="input" name="instagram" placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" defaultValue={social?.instagram ? `@${social.instagram}` : ''} /></label>
        <label className="row small" style={{ gap: 10 }}><input type="checkbox" name="public" defaultChecked={social?.instagram_public ?? false} style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />Show to everyone in my Daily Drop</label>
        <span className="small muted">Off: only people you’re already talking with can see it. Leave the handle empty and save to remove it.</span>
        <button className="btn ghost sm">Save</button>
      </form>
    </div>
  );
}
