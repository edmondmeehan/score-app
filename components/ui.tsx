import { BANDS, type Band } from '@/lib/types';

function arcPoint(fill: number) {
  const a = ((135 + fill * 270) * Math.PI) / 180;
  return { x: 50 + 36 * Math.cos(a), y: 50 + 36 * Math.sin(a), large: fill * 270 > 180 ? 1 : 0 };
}

export function Gauge({ fill = 0.85, color = '#C9A961', size = 64, track = '#26262A', dot = true, label }: { fill?: number; color?: string; size?: number; track?: string; dot?: boolean; label?: string }) {
  const p = arcPoint(fill);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M24.5 75.5 A36 36 0 1 1 75.5 75.5" fill="none" stroke={track} strokeWidth={9} strokeLinecap="round" />
      <path d={`M24.5 75.5 A36 36 0 ${p.large} 1 ${p.x.toFixed(1)} ${p.y.toFixed(1)}`} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      {dot && <circle cx={p.x} cy={p.y} r={6.5} fill={color === '#C9A961' ? '#F2F0EB' : color} />}
    </svg>
  );
}

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <Gauge size={size * 1.6} label="Score" />
      <span className="mono" style={{ fontSize: size, letterSpacing: '.42em', fontWeight: 500 }}>SCORE</span>
    </span>
  );
}

export function BandPill({ band, trend }: { band: Band | null; trend?: string | null }) {
  if (!band) return <span className="chip small muted">Unverified</span>;
  const b = BANDS[band];
  const p = arcPoint(b.fill);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em', padding: '3px 9px 3px 7px', borderRadius: 999, border: `1px solid ${b.color}`, color: b.color }}>
      <svg width="12" height="12" viewBox="0 0 100 100" aria-hidden="true"><path d={`M24.5 75.5 A36 36 0 ${p.large} 1 ${p.x.toFixed(1)} ${p.y.toFixed(1)}`} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" /></svg>
      {b.label}{trend === 'up' && <span style={{ color: 'var(--rise)' }}> ↑</span>}
    </span>
  );
}

export function TestBanner({ children }: { children: React.ReactNode }) {
  return <div className="notice test"><strong>Test mode.</strong> {children}</div>;
}

export function Steps({ at, of = 5 }: { at: number; of?: number }) {
  return (
    <div className="row" style={{ gap: 6 }} aria-label={`Step ${at} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < at ? 'var(--gold)' : 'var(--line)' }} />
      ))}
    </div>
  );
}

export function age(birthYear: number | null) {
  return birthYear ? new Date().getFullYear() - birthYear : null;
}
