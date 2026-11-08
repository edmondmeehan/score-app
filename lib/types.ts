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
  invited_by: string | null;
  created_at: string;
};

/** What one member can see about another (the member_cards view). */
export type MemberCard = Pick<Profile,
  'id' | 'first_name' | 'birth_year' | 'gender' | 'job' | 'neighborhood' | 'city' | 'prompt_q' | 'prompt_a' | 'money_values'
  | 'band' | 'trend' | 'credit_verified_at' | 'invited_by' | 'song_id' | 'song_title' | 'song_artist' | 'song_image'>;

export const BANDS: Record<Band, { label: string; range: string; color: string; fill: number }> = {
  elite: { label: 'Elite', range: '800+', color: '#E8E8EC', fill: 0.95 },
  strong: { label: 'Strong', range: '740–799', color: '#D4B46A', fill: 0.8 },
  solid: { label: 'Solid', range: '670–739', color: '#C4C5CA', fill: 0.6 },
  building: { label: 'Building', range: 'Under 670', color: '#C98E62', fill: 0.35 },
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
  black: { name: 'Black', monthly: '$149/mo', annual: 'Monthly only', perks: 'Everything in Premium, plus a matchmaker and member events' },
} as const;
