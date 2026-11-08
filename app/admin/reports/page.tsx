import { requireStaff } from '@/lib/session';
import { REPORT_SECTIONS, reportBlocks } from '@/lib/adminReport';
import { saveReportPrefs, sendTestReport } from './actions';

export const dynamic = 'force-dynamic';

type Prefs = { daily: boolean; sections: string[]; last_sent_on: string | null; email: string };

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const [{ data: p, error }, { data: d }] = await Promise.all([supabase.rpc('my_report_prefs'), supabase.rpc('staff_daily_report')]);
  const prefs = (p as Prefs) || { daily: false, sections: REPORT_SECTIONS.map(([k]) => k), last_sent_on: null, email: '' };
  const notReady = error && /Could not find the function/i.test(error.message);
  const preview = d ? reportBlocks(d as never, prefs.sections) : null;

  return (
    <>
      <h1 className="serif" style={{ fontSize: 44 }}>Daily report</h1>
      <span className="small muted">A morning email with the last 24 hours on ScoreDate. Each admin chooses their own sections. Test accounts are left out.</span>
      {sp.ok && <div className="notice">{sp.ok}</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      {notReady && <div className="notice error">Run migration 0024 in the ScoreDate SQL Editor to turn on daily reports.</div>}

      <form action={saveReportPrefs} className="card stack" style={{ gap: 14 }}>
        <label className="row" style={{ gap: 10, alignItems: 'center' }}>
          <input type="checkbox" name="daily" defaultChecked={prefs.daily} style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />
          <span className="stack" style={{ gap: 2 }}><strong>Email me a daily report</strong><span className="small muted">Around 11am ET to {prefs.email || 'your admin email'}{prefs.last_sent_on ? ` · last sent ${prefs.last_sent_on}` : ''}</span></span>
        </label>
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Include</span>
          {REPORT_SECTIONS.map(([k, label, hint]) => (
            <label key={k} className="choice" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" name="sections" value={k} defaultChecked={prefs.sections.includes(k)} style={{ accentColor: 'var(--gold)', marginTop: 4 }} />
              <span className="stack" style={{ gap: 2 }}><strong>{label}</strong><span className="small muted">{hint}</span></span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn sm">Save</button>
          <button className="btn ghost sm" formAction={sendTestReport}>Send me a test now</button>
        </div>
      </form>

      {preview && (
        <section className="card stack" style={{ gap: 10 }}>
          <strong>Today so far</strong>
          <span className="small muted">{preview.headline}</span>
          {preview.blocks.map((b, i) => 'p' in b ? <span key={i} className="label" style={{ marginTop: 8 }}>{b.p}</span>
            : 'facts' in b ? (
              <div key={i} className="stack" style={{ gap: 0 }}>
                {b.facts.map(([k, v]) => <div key={k} className="row small" style={{ justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--line-soft)', padding: '7px 0' }}><span className="muted">{k}</span><span>{v}</span></div>)}
              </div>
            ) : 'note' in b ? <span key={i} className="small muted">{b.note}</span> : null)}
        </section>
      )}
    </>
  );
}
