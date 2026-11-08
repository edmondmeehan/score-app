'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { staffAct } from '@/app/admin/actions';

type Target = { id: string; first_name: string | null; status: string; id_status: string; photo_status: string; open_reports: number };
type Me = { staff: boolean; email?: string; target?: Target | null; maintenance?: boolean };

/** Thin bar shown only to signed-in Score staff, on the site and in the app. Moderation tools appear on member profiles. */
export default function AdminBar() {
  const path = usePathname() || '/';
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const memberId = path.match(/^\/app\/u\/([0-9a-f-]{36})/i)?.[1];
  const inAdmin = path.startsWith('/admin');

  useEffect(() => {
    if (inAdmin) return;
    // Only signed-in visitors can be staff; skip the check entirely for everyone else.
    if (!document.cookie.includes('-auth-token')) { setMe(null); return; }
    let live = true;
    fetch(`/api/staff/me${memberId ? `?user=${memberId}` : ''}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { staff: false })).then((d) => { if (live) setMe(d); }).catch(() => {});
    setOpen(false);
    return () => { live = false; };
  }, [path, memberId, inAdmin]);

  if (inAdmin || !me?.staff) return null;
  const t = me.target;
  const suspended = t && ['suspended', 'removed'].includes(t.status);

  return (
    <div className="staff-bar" role="region" aria-label="Staff tools">
      <div className="staff-bar-row">
        <span className="staff-pill">Admin</span>
        {me.maintenance && <Link href="/admin/security#maintenance" className="staff-pill" style={{ background: 'var(--alert)', color: '#111', textDecoration: 'none' }} title="Visitors and members see the maintenance page. Staff can still use everything.">Maintenance ON</Link>}
        <span className="staff-text">{me.maintenance ? 'Only staff can see the site right now' : `Signed in as staff${me.email ? ` · ${me.email}` : ''}`}</span>
        {t && (
          <button type="button" className="staff-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Moderate {t.first_name || 'member'}{t.open_reports ? ` · ${t.open_reports} report${t.open_reports > 1 ? 's' : ''}` : ''}
          </button>
        )}
        <Link href={t ? `/admin/members/${t.id}` : '/admin'} className="staff-btn gold">{t ? 'Open in admin' : 'Admin'}</Link>
      </div>
      {t && open && (
        <form action={staffAct} className="staff-panel">
          <input type="hidden" name="user" value={t.id} />
          <input type="hidden" name="back" value={path} />
          <span className="small">Status: <strong>{t.status}</strong> · ID: {t.id_status} · Photos: {t.photo_status}</span>
          <input className="input" name="reason" required maxLength={300} placeholder="Reason (saved in the audit log)" />
          <div className="staff-actions">
            <button className="btn ghost sm" name="action" value="warn">Warn</button>
            {suspended
              ? <button className="btn sm" name="action" value="reinstate">Reinstate</button>
              : <button className="btn ghost sm danger" name="action" value="suspend">Suspend</button>}
            {t.id_status === 'review' && <button className="btn ghost sm" name="action" value="approve_id">Approve ID</button>}
            {t.photo_status === 'review' && <button className="btn ghost sm" name="action" value="approve_photos">Approve photos</button>}
            {t.status !== 'removed' && (
              <button className="btn ghost sm danger" name="action" value="remove"
                onClick={(e) => { if (!window.confirm(`Remove ${t.first_name || 'this member'} from Score? They lose access and are hidden everywhere.`)) e.preventDefault(); }}>Remove</button>
            )}
          </div>
          <span className="small muted">Suspend hides them and stops messaging right away; Reinstate undoes it. Every action is recorded with your email.</span>
        </form>
      )}
    </div>
  );
}
