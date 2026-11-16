import Link from 'next/link';

/** Events and Giveaways share one tab: this switch moves between them. */
export default function EventsSwitch({ on }: { on: 'events' | 'giveaways' }) {
  return (
    <nav className="seg-switch" aria-label="Events and giveaways">
      <Link href="/app/events" className={on === 'events' ? 'on' : ''} aria-current={on === 'events' ? 'page' : undefined}>Events</Link>
      <Link href="/app/giveaways" className={on === 'giveaways' ? 'on' : ''} aria-current={on === 'giveaways' ? 'page' : undefined}>Giveaways</Link>
    </nav>
  );
}
