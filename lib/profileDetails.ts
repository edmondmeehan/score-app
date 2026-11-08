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
  ].filter(Boolean) as string[];
}
