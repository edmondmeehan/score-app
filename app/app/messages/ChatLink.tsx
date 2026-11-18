'use client';
import Link from 'next/link';
import { haptic } from '@/lib/haptics';

/** A conversation row. The first few chats are fully preloaded, so tapping one opens it instantly (no loading screen). */
export default function ChatLink({ href, preload, children }: { href: string; preload: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={preload ? true : undefined} className="list-row"
      onClick={() => { haptic('selection'); try { sessionStorage.setItem('sd_chat_from_list', '1'); } catch { /* storage blocked */ } }}>
      {children}
    </Link>
  );
}
