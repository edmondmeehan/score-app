/** Traveling / visiting helpers. Dates are plain YYYY-MM-DD strings from Postgres. */
type P = { away_until?: string | null; away_where?: string | null; visit_until?: string | null };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const isAway = (p: P) => Boolean(p.away_until && p.away_until >= today());
export const tripEnded = (p: P) => Boolean(p.away_until && p.away_until < today());
export const isVisiting = (p: P) => Boolean(p.visit_until && p.visit_until >= today());

/** "Away until Dec 3" (or with the place, for the member themself). */
export function awayLabel(p: P, withWhere = false): string | null {
  if (!isAway(p)) return null;
  return `Away until ${fmt(p.away_until!)}${withWhere && p.away_where ? ` · ${p.away_where}` : ''}`;
}
export const dayLabel = (d: string | null | undefined) => (d ? fmt(d) : '');
export const isoToday = today;
export const isoPlus = (days: number) => {
  const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};
