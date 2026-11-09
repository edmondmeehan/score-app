/** Instant placeholder shown while a screen loads (Next.js loading.tsx). Calm grey shapes in the brand colors with a soft shimmer. */
export function Bone({ w = '100%', h = 16, r = 10, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="bone" style={{ width: w, minWidth: typeof w === 'number' ? w : undefined, height: h, borderRadius: r, ...style }} aria-hidden />;
}

export function CardRow() {
  return (
    <div className="card row" style={{ padding: 12, gap: 14 }}>
      <Bone w={76} h={100} r={12} />
      <div className="stack" style={{ gap: 10, flex: 1, minWidth: 0 }}><Bone w="45%" h={18} /><Bone w="70%" h={12} /><Bone w={90} h={22} r={999} /></div>
    </div>
  );
}

export function ListRow() {
  return (
    <div className="row" style={{ gap: 14, padding: '12px 0' }}>
      <Bone w={48} h={48} r={999} />
      <div className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}><Bone w="35%" h={14} /><Bone w="75%" h={12} /></div>
    </div>
  );
}

export default function ScreenSkeleton({ kind = 'cards', title = true, rows = 4 }: { kind?: 'cards' | 'list' | 'chat' | 'profile' | 'settings'; title?: boolean; rows?: number }) {
  return (
    <div className="phone skeleton" aria-busy="true" aria-label="Loading">
      {kind === 'chat' ? (
        <>
          <div className="row" style={{ gap: 12 }}><Bone w={44} h={44} r={12} /><div className="stack grow" style={{ gap: 8 }}><Bone w="30%" h={16} /><Bone w={90} h={20} r={999} /></div></div>
          <Bone h={52} r={14} />
          <div className="stack" style={{ gap: 12, marginTop: 8 }}>
            {[60, 45, 70, 40, 55].map((w, i) => <Bone key={i} w={`${w}%`} h={44} r={18} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />)}
          </div>
        </>
      ) : kind === 'profile' ? (
        <>
          <Bone h={420} r={18} />
          <Bone w="40%" h={30} /><Bone w="60%" h={14} /><Bone h={90} r={16} /><Bone h={90} r={16} />
        </>
      ) : (
        <>
          {title && <><Bone w={90} h={12} /><Bone w="55%" h={36} r={12} /></>}
          {kind === 'settings' && <div className="row" style={{ gap: 14 }}><Bone w={64} h={64} r={999} /><div className="stack grow" style={{ gap: 8 }}><Bone w="40%" h={20} /><Bone w="25%" h={12} /></div></div>}
          <div className="stack" style={{ gap: kind === 'list' ? 0 : 12 }}>
            {Array.from({ length: rows }).map((_, i) => (kind === 'list' ? <ListRow key={i} /> : kind === 'settings' ? <Bone key={i} h={64} r={16} /> : <CardRow key={i} />))}
          </div>
        </>
      )}
    </div>
  );
}
