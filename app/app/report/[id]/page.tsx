import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { submitReport } from '../../actions';

const REASONS = ['Asked me for money', 'Harassment or threats', 'Fake photos or identity', 'Explicit or offensive content', 'Spam or selling something', 'Something else'];

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireMember();
  const { data: p } = await supabase.from('profiles').select('first_name').eq('id', id).maybeSingle();
  return (
    <form action={submitReport} className="phone">
      <input type="hidden" name="id" value={id} />
      <div className="row"><Link href="/app/messages" className="small muted">Cancel</Link></div>
      <h1 className="serif" style={{ fontSize: 34 }}>Report {p?.first_name || 'this member'}</h1>
      <p className="muted small" style={{ margin: 0 }}>They won&apos;t know you reported them. A person on our team reviews every report, usually within 24 hours.</p>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
        <legend className="label" style={{ marginBottom: 8 }}>What happened?</legend>
        {REASONS.map((r, i) => <label key={r} className="choice"><input type="radio" name="reason" value={r} defaultChecked={i === 0} style={{ accentColor: 'var(--gold)' }} />{r}</label>)}
      </fieldset>
      <label className="field">Tell us more (optional)<textarea className="input" name="note" rows={3} /></label>
      <label className="row small"><input type="checkbox" name="block" value="yes" defaultChecked style={{ width: 20, height: 20, accentColor: 'var(--gold)' }} />Also block {p?.first_name || 'them'}</label>
      <button className="btn danger block">Submit report</button>
      <span className="small muted" style={{ textAlign: 'center' }}>In danger? Call 911.</span>
    </form>
  );
}
