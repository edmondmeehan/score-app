'use client';
import { useRouter } from 'next/navigation';

/** Small "‹" back button for the top of a page. Goes back where you came from, or to the fallback if opened directly. */
export default function PageBack({ fallback = '/app' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0, alignSelf: 'flex-start' }}
      onClick={() => { if (window.history.length > 1) router.back(); else router.push(fallback); }}>‹</button>
  );
}
