export type Effect = 'none' | 'snow' | 'confetti' | 'hearts' | 'leaves' | 'embers' | 'sparks';
export type SeasonKey = 'new_year' | 'valentines' | 'st_patricks' | 'fourth_of_july' | 'halloween' | 'thanksgiving' | 'holidays';

export type SeasonDef = {
  key: SeasonKey; name: string;
  start: string; end: string; // MM-DD (inclusive). Thanksgiving is computed when left on "auto".
  accent: string; accentLight: string; glow: string;
  banner: string; effect: Effect; enabled: boolean;
};

export const SEASONS: SeasonDef[] = [
  { key: 'new_year', name: 'New Year’s', start: '12-31', end: '01-02', accent: '#D9B86A', accentLight: '#F1DCA4', glow: 'rgba(217,184,106,.18)', banner: 'Happy New Year. Here’s to a year of better dates.', effect: 'confetti', enabled: true },
  { key: 'valentines', name: 'Valentine’s Day', start: '02-07', end: '02-14', accent: '#D9788A', accentLight: '#F0A9B6', glow: 'rgba(217,120,138,.16)', banner: 'Happy Valentine’s week. Honesty is the new romance.', effect: 'hearts', enabled: true },
  { key: 'st_patricks', name: 'St. Patrick’s Day', start: '03-15', end: '03-17', accent: '#5FB07D', accentLight: '#93D2A9', glow: 'rgba(95,176,125,.15)', banner: 'Feeling lucky? Good credit helps.', effect: 'none', enabled: false },
  { key: 'fourth_of_july', name: '4th of July', start: '07-01', end: '07-05', accent: '#D96B6B', accentLight: '#8FB4E8', glow: 'rgba(143,180,232,.14)', banner: 'Happy 4th. Financial independence looks good on you.', effect: 'sparks', enabled: true },
  { key: 'halloween', name: 'Halloween', start: '10-24', end: '10-31', accent: '#E8893A', accentLight: '#F4B57E', glow: 'rgba(232,137,58,.16)', banner: 'The only scary thing here is your ex’s credit.', effect: 'embers', enabled: true },
  { key: 'thanksgiving', name: 'Thanksgiving', start: 'auto', end: 'auto', accent: '#C98E62', accentLight: '#E3B48D', glow: 'rgba(201,142,98,.16)', banner: 'Grateful for every member, in every band.', effect: 'leaves', enabled: true },
  { key: 'holidays', name: 'Holidays', start: '12-15', end: '12-30', accent: '#C9A961', accentLight: '#E4CC8E', glow: 'rgba(201,169,97,.16)', banner: 'Happy holidays from Score.', effect: 'snow', enabled: true },
];

export type SeasonOverride = Partial<Pick<SeasonDef, 'start' | 'end' | 'banner' | 'effect' | 'enabled'>>;
export type SeasonConfig = { enabled: boolean; force: SeasonKey | 'off' | null; overrides: Partial<Record<SeasonKey, SeasonOverride>> };
export const SEASON_CONFIG_DEFAULT: SeasonConfig = { enabled: true, force: null, overrides: {} };

export function mergeSeasonConfig(v: unknown): SeasonConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<SeasonConfig>;
  return { enabled: o.enabled !== false, force: (o.force as SeasonConfig['force']) ?? null, overrides: (o.overrides as SeasonConfig['overrides']) || {} };
}

export const seasonsWith = (cfg: SeasonConfig): SeasonDef[] => SEASONS.map((s) => ({ ...s, ...(cfg.overrides[s.key] || {}) }));

/** Thanksgiving: the 4th Thursday of November, shown Monday through Sunday of that week. */
function thanksgivingWindow(year: number): [string, string] {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstThu = 1 + ((4 - nov1.getUTCDay() + 7) % 7);
  const day = firstThu + 21;
  const pad = (n: number) => String(n).padStart(2, '0');
  return [`11-${pad(day - 3)}`, `11-${pad(Math.min(30, day + 3))}`];
}

const inWindow = (md: string, start: string, end: string) => (start <= end ? md >= start && md <= end : md >= start || md <= end);

/** Today in New York as YYYY + MM-DD. */
export function nyToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '';
  return { year: Number(g('year')), md: `${g('month')}-${g('day')}` };
}

export function windowFor(s: SeasonDef, year: number): [string, string] {
  if (s.key === 'thanksgiving' && (s.start === 'auto' || !s.start)) return thanksgivingWindow(year);
  return [s.start, s.end];
}

export function activeSeason(cfg: SeasonConfig, now = new Date()): SeasonDef | null {
  const all = seasonsWith(cfg);
  if (cfg.force === 'off') return null;
  if (cfg.force) return all.find((s) => s.key === cfg.force) || null;
  if (!cfg.enabled) return null;
  const { year, md } = nyToday(now);
  return all.find((s) => s.enabled && (() => { const [a, b] = windowFor(s, year); return /^\d\d-\d\d$/.test(a) && /^\d\d-\d\d$/.test(b) && inWindow(md, a, b); })()) || null;
}
