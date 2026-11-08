/** Reasons staff can pick when asking a member to redo a step. The text is the default message emailed to them. */
export const REASONS: Record<'id' | 'photos', { code: string; label: string; message: string }[]> = {
  id: [
    { code: 'blur_glare', label: 'Blurry or glare on ID', message: 'The photo of your ID was blurry or had glare, so we couldn’t read it. Try again in bright, even light with your ID on a dark surface.' },
    { code: 'id_expired', label: 'ID expired', message: 'The ID you used has expired. Please verify again with a current driver’s license, passport or state ID.' },
    { code: 'name_mismatch', label: 'Name doesn’t match profile', message: 'The name on your ID didn’t match the name on your profile. Update your first name to match your ID (a common nickname is fine), then verify again.' },
    { code: 'age_mismatch', label: 'Age doesn’t match profile', message: 'The birth year on your ID didn’t match your profile. Please check your birth year and verify again.' },
    { code: 'selfie_mismatch', label: 'Selfie doesn’t match ID', message: 'Your selfie didn’t clearly match the photo on your ID. Retake it facing the camera in good light, with no hat or sunglasses.' },
    { code: 'unsupported_id', label: 'Unsupported document', message: 'We can only accept a government-issued photo ID (driver’s license, passport or state ID). Please try again with one of those.' },
    { code: 'other', label: 'Other (write a message)', message: 'We need you to complete your ID check again.' },
  ],
  photos: [
    { code: 'group', label: 'Group shot', message: 'One of your photos is a group shot, so members can’t tell which person is you. Swap it for a photo of just you.' },
    { code: 'face_hidden', label: 'Face hidden (sunglasses, hat, filter)', message: 'One of your photos hides your face (sunglasses, a hat or a heavy filter). Swap it for one where your face is clearly visible.' },
    { code: 'not_match', label: 'Doesn’t match selfie', message: 'One of your photos didn’t match your live selfie. Every photo needs to clearly be you. Swap it for a recent photo of yourself.' },
    { code: 'quality', label: 'Low quality', message: 'One of your photos is too blurry or dark to see you clearly. Swap it for a sharper one.' },
    { code: 'rules', label: 'Breaks photo rules', message: 'One of your photos doesn’t follow our photo guidelines (no nudity, no kids, no screenshots or images of other people). Please swap it.' },
    { code: 'other', label: 'Other (write a message)', message: 'One of your photos needs to be replaced before it can go live.' },
  ],
};

export const reasonFor = (kind: 'id' | 'photos', code: string) => REASONS[kind].find((r) => r.code === code) || REASONS[kind][REASONS[kind].length - 1];

/** Great-circle distance in miles. */
export function miles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(h)));
}
