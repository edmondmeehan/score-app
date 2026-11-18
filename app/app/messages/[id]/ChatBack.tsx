'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Back to Messages. If you came from the Messages list, step back in history: the list comes straight back from the
 * app's memory (same scroll position, no reload). Opened from a push or a link instead? Go to the list normally.
 */
export default function ChatBack() {
  const router = useRouter();
  return (
    <Link href="/app/messages" aria-label="Back" className="btn ghost sm" style={{ width: 44, padding: 0 }}
      onClick={(e) => {
        let fromList = false;
        try { fromList = sessionStorage.getItem('sd_chat_from_list') === '1'; sessionStorage.removeItem('sd_chat_from_list'); } catch { /* storage blocked */ }
        if (fromList && window.history.length > 1) {
          e.preventDefault(); router.back();
          // Then quietly update the list in place (read dots, newest message), keeping your scroll position.
          setTimeout(() => router.refresh(), 120);
        }
      }}>‹</Link>
  );
}
