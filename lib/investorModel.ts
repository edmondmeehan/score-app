/**
 * Illustrative growth P&L for the investor page. Pure functions, no I/O.
 * Every input is an editable assumption (Admin → Investors). Nothing here is a forecast or actual result.
 */

export type Market = { name: string; launch: number; target: number }; // launch = model year (1-5); target = members at maturity
export type Assumptions = {
  years: number;
  markets: Market[];
  ramp: number[]; // share of target reached at end of year 1, 2, 3… after launch (0-1)
  mix: { membership: number; premium: number; reserve: number }; // share of members on each plan (0-1)
  price: { membership: number; premium: number; reserve: number; preview: number; paused: number }; // list prices, USD
  discount: number; // average discount from annual plans and offers (0-1)
  addon_pm: number; // add-on revenue per member per month (Notes, featured placement, extra connections)
  paused_share: number; // members paused or "taken" at the paused price, as a share of active members
  previews_per_member: number; // $9.99 Preview purchases per new member (applicants who don't all convert)
  churn_m: number; // monthly member churn (0-1)
  store_fee: number; // App Store / Google Play fee on in-app revenue (0-1)
  events_per_market: number; // events + partnerships revenue per market per year, from its second year
  events_cost: number; // cost of events as a share of events revenue (0-1)
  verify_cost: number; // ID verification + credit band check, per applicant
  infra_pm: number; // hosting and tools per member per month
  infra_base: number; // fixed hosting and tools per year
  cac: number; // marketing cost per new member
  launch_budget: number; // one-time marketing per new market launch
  payroll: number[]; // team cost per year
  ga_pct: number; // general & admin (legal, insurance, accounting, office) as a share of net revenue (0-1)
  ga_min: number; // minimum G&A per year
};

export const ASSUMPTIONS_DEFAULT: Assumptions = {
  years: 5,
  markets: [
    { name: 'New York City', launch: 1, target: 12000 },
    { name: 'The Hamptons', launch: 1, target: 1500 },
    { name: 'Connecticut', launch: 2, target: 3000 },
    { name: 'Boston', launch: 2, target: 5000 },
    { name: 'Los Angeles', launch: 3, target: 9000 },
    { name: 'San Francisco', launch: 3, target: 6000 },
    { name: 'Next markets (by demand)', launch: 4, target: 15000 },
  ],
  ramp: [0.25, 0.55, 0.8, 1, 1],
  mix: { membership: 0.7, premium: 0.22, reserve: 0.08 },
  price: { membership: 24.99, premium: 49.99, reserve: 149, preview: 9.99, paused: 4.99 },
  discount: 0.15,
  addon_pm: 3,
  paused_share: 0.06,
  previews_per_member: 2,
  churn_m: 0.06,
  store_fee: 0.15,
  events_per_market: 60000,
  events_cost: 0.6,
  verify_cost: 4,
  infra_pm: 0.4,
  infra_base: 36000,
  cac: 90,
  launch_budget: 150000,
  payroll: [600000, 1400000, 2500000, 3500000, 4500000],
  ga_pct: 0.08,
  ga_min: 120000,
};

export type Row = {
  year: number; markets: number; members: number; newMembers: number;
  subs: number; addons: number; paused: number; preview: number; events: number; gross: number;
  storeFees: number; net: number;
  verify: number; infra: number; eventsCost: number; cogs: number; grossProfit: number; grossMargin: number;
  marketing: number; payroll: number; ga: number; opex: number; ebitda: number; ebitdaMargin: number; cumulative: number;
  arpu: number; // net revenue per average member per month
};

const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function mergeAssumptions(v: unknown): Assumptions {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Assumptions>;
  const d = ASSUMPTIONS_DEFAULT;
  return {
    ...d, ...o,
    markets: Array.isArray(o.markets) && o.markets.length ? o.markets : d.markets,
    ramp: Array.isArray(o.ramp) && o.ramp.length ? o.ramp : d.ramp,
    payroll: Array.isArray(o.payroll) && o.payroll.length ? o.payroll : d.payroll,
    mix: { ...d.mix, ...(o.mix || {}) },
    price: { ...d.price, ...(o.price || {}) },
    years: Math.min(7, Math.max(3, Math.round(n(o.years, d.years)))),
  };
}

export function computeModel(a: Assumptions): Row[] {
  const rows: Row[] = [];
  const mixSum = a.mix.membership + a.mix.premium + a.mix.reserve || 1;
  const blended = (a.mix.membership * a.price.membership + a.mix.premium * a.price.premium + a.mix.reserve * a.price.reserve) / mixSum;
  let prevEnd = 0; let cumulative = 0;
  for (let y = 1; y <= a.years; y++) {
    const live = a.markets.filter((m) => m.launch <= y);
    const end = live.reduce((s, m) => s + m.target * (a.ramp[Math.min(y - m.launch, a.ramp.length - 1)] ?? 1), 0);
    const avg = (prevEnd + end) / 2;
    const newMembers = Math.max(0, end - prevEnd) + avg * a.churn_m * 12;
    const launched = a.markets.filter((m) => m.launch === y).length;
    const eventMarkets = a.markets.filter((m) => m.launch < y).length;

    const subs = avg * blended * 12 * (1 - a.discount);
    const addons = avg * a.addon_pm * 12;
    const paused = avg * a.paused_share * a.price.paused * 12;
    const preview = newMembers * a.previews_per_member * a.price.preview;
    const events = eventMarkets * a.events_per_market;
    const gross = subs + addons + paused + preview + events;
    const storeFees = (subs + addons + paused + preview) * a.store_fee;
    const net = gross - storeFees;

    const verify = newMembers * a.previews_per_member * a.verify_cost;
    const infra = a.infra_base + avg * a.infra_pm * 12;
    const eventsCost = events * a.events_cost;
    const cogs = verify + infra + eventsCost;
    const grossProfit = net - cogs;

    const marketing = newMembers * a.cac + launched * a.launch_budget;
    const payroll = a.payroll[Math.min(y - 1, a.payroll.length - 1)] ?? 0;
    const ga = Math.max(a.ga_min, net * a.ga_pct);
    const opex = marketing + payroll + ga;
    const ebitda = grossProfit - opex;
    cumulative += ebitda;

    rows.push({
      year: y, markets: live.length, members: Math.round(end), newMembers: Math.round(newMembers),
      subs, addons, paused, preview, events, gross, storeFees, net,
      verify, infra, eventsCost, cogs, grossProfit, grossMargin: net ? grossProfit / net : 0,
      marketing, payroll, ga, opex, ebitda, ebitdaMargin: net ? ebitda / net : 0, cumulative,
      arpu: avg ? net / avg / 12 : 0,
    });
    prevEnd = end;
  }
  return rows;
}

export const usd = (v: number, compact = true) =>
  (v < 0 ? '−' : '') + (compact && Math.abs(v) >= 1000
    ? '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v))
    : '$' + Math.round(Math.abs(v)).toLocaleString('en-US'));
export const pctf = (v: number) => `${Math.round(v * 100)}%`;
