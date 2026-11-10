import { requireStaff } from '@/lib/session';
import { CREATIVE } from '@/lib/creative';

export const dynamic = 'force-dynamic';
// Files live in public/_creative; middleware only serves them to signed-in staff.
const src = (p: string) => `/_creative/${p}`;
const thumb = (k: string, f: string) => src(`_thumbs/${k}_${f.replace(/\.png$/, '.jpg')}`);
const nice = (f: string) => f.replace(/\.(png|mp4|md|txt)$/, '').replace(/^_/, '').replace(/^\d+-/, '').replace(/-/g, ' ');

export default async function Assets() {
  await requireStaff();
  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Brand assets</h1>
      <span className="small muted">Ads, posts, Facebook images and avatars, full size. Tap an image to open it; Download saves the original. Copy and captions are in the text files in each section.</span>
      <nav className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {CREATIVE.map((s) => <a key={s.key} href={`#${s.key}`} className="btn ghost sm">{s.title}</a>)}
      </nav>
      {CREATIVE.map((s) => {
        const docs = s.files.filter((f) => /\.(md|txt)$/.test(f));
        const media = s.files.filter((f) => /\.(png|mp4)$/.test(f));
        return (
          <section key={s.key} id={s.key} className="stack" style={{ gap: 12, scrollMarginTop: 80 }}>
            <div className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <h2 className="serif" style={{ fontSize: 28 }}>{s.title}</h2>
              <span className="small muted grow">{s.note}</span>
              {docs.map((d) => <a key={d} href={src(`${s.key}/${d}`)} target="_blank" rel="noopener noreferrer" className="small">{nice(d)} ↗</a>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${s.key === 'facebook-kit' ? 260 : s.key === 'avatars' ? 140 : 180}px, 1fr))`, gap: 12 }}>
              {media.map((f) => (
                <figure key={f} className="card stack" style={{ gap: 8, padding: 8, margin: 0 }}>
                  {f.endsWith('.mp4')
                    ? <video src={src(`${s.key}/${f}`)} controls muted playsInline preload="metadata" style={{ width: '100%', borderRadius: 8, background: '#000' }} />
                    : <a href={src(`${s.key}/${f}`)} target="_blank" rel="noopener noreferrer"><img src={thumb(s.key, f)} alt={nice(f)} loading="lazy" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: s.key === 'avatars' ? '50%' : 8 }} /></a>}
                  <div className="row small" style={{ gap: 8, justifyContent: 'space-between' }}>
                    <span className="muted" style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nice(f)}</span>
                    <a href={src(`${s.key}/${f}`)} download={f} className="small">Download</a>
                  </div>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
