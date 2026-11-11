'use client';
import { useRouter } from 'next/navigation';

/** Round back button that floats over a full-bleed photo. Goes back where you came from, or to the Drop if opened directly. */
export default function BackButton({ fallback = '/app' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="Back" className="photo-back"
      onClick={() => { if (window.history.length > 1) router.back(); else router.push(fallback); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
