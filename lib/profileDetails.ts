// Optional profile details members can add, and filter on in search.
export const EDUCATION = [
  ['high_school', 'High school'], ['trade', 'Trade school'], ['some_college', 'Some college'],
  ['bachelors', "Bachelor's"], ['masters', "Master's"], ['doctorate', 'Doctorate'],
] as const;
export const HAS_KIDS = [['no', 'No kids'], ['yes', 'Has kids']] as const;
export const WANTS_KIDS = [['yes', 'Wants kids'], ['open', 'Open to kids'], ['no', "Doesn't want kids"]] as const;
export const DRINKING = [['never', 'Never'], ['socially', 'Socially'], ['often', 'Often']] as const;
export const SMOKING = [['never', 'Never'], ['sometimes', 'Sometimes'], ['often', 'Often']] as const;
export const EXERCISE = [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']] as const;

export const LOOKING_FOR = [['relationship', 'A relationship'], ['long_term_open', 'Long-term, open to short'], ['casual', 'Something casual'], ['figuring_out', 'Still figuring it out']] as const;
export const PETS = [['dog', 'Has a dog'], ['cat', 'Has a cat'], ['both', 'Dog and cat'], ['other', 'Other pets'], ['none', 'No pets'], ['want', 'Wants a pet']] as const;
export const RELIGION = [['agnostic', 'Agnostic'], ['atheist', 'Atheist'], ['buddhist', 'Buddhist'], ['catholic', 'Catholic'], ['christian', 'Christian'], ['hindu', 'Hindu'], ['jewish', 'Jewish'], ['muslim', 'Muslim'], ['spiritual', 'Spiritual'], ['other', 'Other']] as const;
export const POLITICS = [['liberal', 'Liberal'], ['moderate', 'Moderate'], ['conservative', 'Conservative'], ['not_political', 'Not political'], ['other', 'Other']] as const;

/** My NYC: three spots a member can pin to their profile. */
export const NYC_SLOTS = [
  { key: 'favorite', label: 'My favorite spot', placeholder: 'Your go-to bar, restaurant or café' },
  { key: 'date', label: 'Best date spot', placeholder: 'Where you’d take someone' },
  { key: 'weekend', label: 'Weekend ritual', placeholder: 'A park, market, gym, museum…' },
] as const;
export type NycSpot = { slot: string; name: string; place_id?: string | null; note?: string | null };
export type Prompt = { q: string; a: string };

export const label = (list: readonly (readonly [string, string])[], v: string | null | undefined) => list.find(([k]) => k === v)?.[1] ?? null;
export const valid = (list: readonly (readonly [string, string])[], v: unknown) => (typeof v === 'string' && list.some(([k]) => k === v) ? v : null);

/** 4'10" to 7'0" in whole inches, stored as centimeters. */
export const HEIGHTS = Array.from({ length: 27 }, (_, i) => 58 + i).map((inches) => ({ cm: Math.round(inches * 2.54), label: `${Math.floor(inches / 12)}′${inches % 12}″` }));
export function heightLabel(cm: number | null | undefined) {
  if (!cm) return null;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

export type Details = {
  height_cm: number | null; has_kids: string | null; wants_kids: string | null;
  education: string | null; drinking: string | null; smoking: string | null; exercise: string | null;
  pets?: string | null; religion?: string | null; politics?: string | null;
};

/** Short chips for a profile: "5′9″", "Master's", "Wants kids", "Drinks socially"… */
export function detailChips(d: Partial<Details>) {
  return [
    heightLabel(d.height_cm),
    label(EDUCATION, d.education),
    label(HAS_KIDS, d.has_kids),
    label(WANTS_KIDS, d.wants_kids),
    d.drinking ? `Drinks ${label(DRINKING, d.drinking)!.toLowerCase()}` : null,
    d.smoking ? (d.smoking === 'never' ? "Doesn't smoke" : `Smokes ${label(SMOKING, d.smoking)!.toLowerCase()}`) : null,
    d.exercise ? `Works out ${label(EXERCISE, d.exercise)!.toLowerCase()}` : null,
    label(PETS, d.pets),
    label(RELIGION, d.religion),
    d.politics ? (d.politics === 'not_political' ? 'Not political' : `${label(POLITICS, d.politics)} politics`) : null,
  ].filter(Boolean) as string[];
}
