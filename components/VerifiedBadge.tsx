import type { Profile } from '@/lib/types';

/** Shown for any member who finished ID + credit verification (every band) and kept the badge on. Never shows a score. */
export const isVerified = (p: Pick<Profile, 'id_status' | 'band'> & { show_verified?: boolean }) => p.id_status === 'approved' && !!p.band && p.show_verified !== false;

export default function VerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const fs = size === 'md' ? 12 : 11;
  return (
    <span title="ID and credit band verified" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: fs, letterSpacing: '.06em', padding: '2px 8px 2px 6px', borderRadius: 999, border: '1px solid var(--rise-line)', color: 'var(--rise)', verticalAlign: 'middle' }}>
      <svg width={fs + 1} height={fs + 1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      Verified
    </span>
  );
}
