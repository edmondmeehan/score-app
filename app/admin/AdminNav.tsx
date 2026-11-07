'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui';

export default function AdminNav({ counts, email }: { counts: { rep: number; ver: number; del: number }; email: string }) {
  const path = usePathname();
  const items = [
    ['/admin', 'Overview', 0], ['/admin/analytics', 'Analytics', 0], ['/admin/waitlist', 'Waitlist & invites', 0], ['/admin/verification', 'Verification', counts.ver],
    ['/admin/moderation', 'Moderation', counts.rep], ['/admin/members', 'Members', 0], ['/admin/events', 'Events', 0], ['/admin/deletions', 'Deletions', counts.del], ['/admin/billing', 'Billing', 0], ['/admin/emails', 'Emails', 0], ['/admin/integrations', 'Integrations', 0], ['/admin/audit', 'Audit log', 0],
  ] as const;
  return (
    <nav aria-label="Admin">
      <div style={{ padding: '0 10px 18px' }}><Logo size={14} /></div>
      {items.map(([href, label, n]) => {
        const on = href === '/admin' ? path === '/admin' : path.startsWith(href);
        return <Link key={href} href={href} className={on ? 'on' : ''}>{label}{n ? <span style={{ color: href === '/admin/moderation' ? 'var(--alert)' : 'var(--gold)' }}> · {n}</span> : null}</Link>;
      })}
      <span className="small muted" style={{ padding: '18px 12px 0' }}>{email}</span>
      <Link href="/app" className="small" style={{ padding: '6px 12px' }}>Back to app</Link>
    </nav>
  );
}
