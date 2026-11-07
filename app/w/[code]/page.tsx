import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase/server';
import { Logo } from '@/components/ui';
import ShareInvite from '@/components/ShareInvite';
import FounderBadge from '@/components/FounderBadge';
import { SITE_URL } from '@/lib/emails';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your spot · Score', robots: { index: false } };

type Status = {
  first_name: string | null; status: string; share_code: string; position: number | null; total: number | null; referrals: number;
  founder: boolean; founder_reason: string | null; referrals_needed: number; spots_per_referral: number; place: string; founder_spots_left: number; founder_spots: number;
};

export default async function Spot({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-f0-9]{20}$/.test(code)) notFound();
  const { data } = await supabaseAnon().rpc('waitlist_status', { p_token: code });
  const s = data as Status | null;
  if (!s) notFound();
  const url = `${SITE_URL}/?ref=${s.share_code}`;
  const invited = s.status !== 'waiting';
  return (
    <div className="phone" style={{ maxWidth: 560 }}>
      <Link href="/"><Logo /></Link>
      <span className="eyebrow">{s.first_name ? `${s.first_name}'s spot` : 'Your spot'} · {s.place}</span>
      {invited ? (
        <div className="card gold stack">
          <p className="serif" style={{ fontSize: 34, margin: 0 }}>{s.status === 'joined' ? 'You’re in.' : 'Your invite is out.'}</p>
          <span className="muted">{s.status === 'joined' ? 'Welcome to Score.' : 'Check your email for your invite code, then sign in.'}</span>
          <Link href={s.status === 'joined' ? '/app' : '/join'} className="btn">{s.status === 'joined' ? 'Open Score' : 'Enter my code'}</Link>
        </div>
      ) : (
        <div className="card stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="small muted">Your place in line</span>
            {s.founder && <FounderBadge size="md" />}
          </div>
          <p className="serif" style={{ fontSize: 56, margin: 0, lineHeight: 1 }}>#{(s.position ?? 0).toLocaleString('en-US')}</p>
          <span className="small muted">of {(s.total ?? 0).toLocaleString('en-US')} waiting · {s.referrals} friend{s.referrals === 1 ? '' : 's'} joined with your link</span>
        </div>
      )}

      <div className="card stack" style={{ gap: 12 }}>
        <strong>{s.founder ? 'You’re a Founding Member' : s.referrals_needed > 0 ? `${s.referrals_needed} more friend${s.referrals_needed === 1 ? '' : 's'} to become a Founding Member` : 'Founding Member'}</strong>
        {!s.founder && (
          <div style={{ height: 8, borderRadius: 4, background: 'var(--track)' }}>
            <div style={{ height: 8, borderRadius: 4, width: `${Math.min(100, (s.referrals / Math.max(1, s.referrals + s.referrals_needed)) * 100)}%`, background: 'var(--gold)' }} />
          </div>
        )}
        <span className="small muted">
          Founding Members get a badge on their profile, go first when invites go out, and get extra invites to bring friends.
          {' '}Each friend who joins with your link also moves you up {s.spots_per_referral} spots.
        </span>
        {s.founder_spots_left > 0 && <span className="small" style={{ color: 'var(--gold)' }}>{s.founder_spots_left} of {s.founder_spots} early founding spots left in {s.place}.</span>}
        <ShareInvite url={url} />
      </div>
      <span className="small muted">This page is private to you. Send the share link above, not this page’s address. We emailed you this page’s link so you can check back.</span>
    </div>
  );
}
