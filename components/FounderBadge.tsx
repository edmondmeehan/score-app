/** Small gold badge for Founding Members. */
export default function FounderBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="chip" title="Founding Member" style={{ fontSize: size === 'sm' ? 11 : 13, padding: size === 'sm' ? '2px 8px' : '4px 10px', color: 'var(--gold-light)', borderColor: 'var(--gold)', gap: 5, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <svg width={size === 'sm' ? 10 : 12} height={size === 'sm' ? 10 : 12} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l2.9 6.9L22 9.6l-5.4 4.9L18.2 22 12 18.3 5.8 22l1.6-7.5L2 9.6l7.1-.7z" /></svg>
      Founding Member
    </span>
  );
}
