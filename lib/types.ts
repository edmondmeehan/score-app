export type Band = 'elite' | 'strong' | 'solid' | 'building';
export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  birth_year: number | null;
  gender: 'woman' | 'man' | 'nonbinary' | null;
  seeking: string[];
  job: string | null;
  neighborhood: string | null;
  zip: string | null;
  borough: string | null;
  city: string | null;
  prompt_q: string | null;
  prompt_a: string | null;
  song_id: string | null;
  song_title: string | null;
  song_artist: string | null;
  song_image: string | null;
  spotlight_until: string | null;
  map_opt_out?: boolean;
  money_values: string[];
  band: Band | null;
  trend: 'up' | 'steady' | 'down' | null;
  credit_verified_at: string | null;
  id_status: 'none' | 'pending' | 'approved' | 'declined' | 'review';
  photo_status: 'none' | 'pending' | 'approved' | 'review' | 'rejected';
  status: 'onboarding' | 'preview' | 'active' | 'paused' | 'taken' | 'suspended' | 'removed';
  plan: 'none' | 'preview' | 'membership' | 'premium' | 'black' | 'paused';
  preview_ends_at: string | null;
  is_founder: boolean;
  height_cm?: number | null;
  has_kids?: string | null;
  wants_kids?: string | null;
  education?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  exercise?: string | null;
  last_active_at?: string | null;
  invited_by: string | null;
  created_at: string;
  prompts?: { q: string; a: string }[] | null; looking_for?: string | null; pets?: string | null; religion?: string | null; politics?: string | null;
  my_nyc?: { slot: string; name: string; place_id?: string | null; note?: string | null }[] | null;
  flag_habit?: string | null; flag_splurge?: string | null; flag_save?: string | null; show_verified?: boolean; show_improving?: boolean;
};

export const BANDS: Record<Band, { label: string; range: string; color: string; fill: number }> = {
  elite: { label: 'Elite', range: '800+', color: 'var(--band-elite)', fill: 0.95 },
  strong: { label: 'Strong', range: '740–799', color: 'var(--band-strong)', fill: 0.8 },
  solid: { label: 'Solid', range: '670–739', color: 'var(--band-solid)', fill: 0.6 },
  building: { label: 'Building', range: 'Under 670', color: 'var(--band-building)', fill: 0.35 },
};

export const MONEY_QUESTIONS: { id: string; q: string; options: string[] }[] = [
  { id: 'style', q: 'Saver or spender?', options: ['Saver', 'Spender', 'Balanced'] },
  { id: 'debt', q: 'How do you feel about debt?', options: ['Debt: avoid', 'Debt: strategic', 'Paying it down'] },
  { id: 'check', q: 'First date check?', options: ['Splits the check', 'Happy to treat', 'Whoever asked pays'] },
  { id: 'finances', q: 'In a relationship, finances are…', options: ['Joint finances', 'Separate finances', 'A bit of both'] },
  { id: 'goal', q: 'Five-year goal?', options: ['Owning in 3 yrs', 'Starting a business', 'Retire early', 'Travel more'] },
  { id: 'risk', q: 'Your investing style?', options: ['Index funds', 'Real estate', 'High risk, high reward', 'Still figuring it out'] },
];

export const PLANS = {
  membership: { name: 'Membership', monthly: '$24.99/mo', annual: '$155.99/yr', perks: 'Messaging, 5 matches a day, 3 invites' },
  premium: { name: 'Premium', monthly: '$49.99/mo', annual: '$349.99/yr', perks: '10 matches a day, see who liked you, band filters' },
  black: { name: 'Reserve', monthly: '$149/mo', annual: 'Monthly only', perks: 'Everything in Premium, plus a matchmaker and member events' },
} as const;
