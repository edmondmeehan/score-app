import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { SAMPLES, TEMPLATE_INFO, build, type TemplateName } from '@/lib/emails';
import { sendTestEmail } from './actions';

export default async function Emails({ searchParams }: { searchParams: Promise<{ t?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const names = Object.keys(TEMPLATE_INFO) as TemplateName[];
  const current: TemplateName = (names as string[]).includes(sp.t || '') ? (sp.t as TemplateName) : 'waitlist_joined';
  const email = build(current, SAMPLES[current] as never);
  const supabaseTemplate = current === 'magic_link' ? build('magic_link', { url: '{{ .ConfirmationURL }}' }).html : null;
  const supabase = await supabaseServer();
  const { data: log } = await supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(25);
  return (
    <>
      <div className="stack" style={{ gap: 4 }}><span className="label">Sent with Resend</span><h1 className="serif" style={{ fontSize: 44 }}>Emails</h1></div>
      {sp.sent && <div className="notice">Test sent to {sp.sent}.</div>}
      {sp.error && <div className="notice error">{sp.error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section className="card stack" style={{ flex: '1 1 260px', gap: 4 }}>
          {names.map((n) => (
            <Link key={n} href={`/admin/emails?t=${n}`} className="list-row" style={{ background: n === current ? '#1A1712' : undefined, borderRadius: 10, padding: '10px 12px' }}>
              <span className="grow stack" style={{ gap: 2 }}>
                <span style={{ color: n === current ? 'var(--gold-light)' : undefined }}>{TEMPLATE_INFO[n].label}</span>
                <span className="small muted">{TEMPLATE_INFO[n].when}</span>
              </span>
              <span className="small" style={{ color: TEMPLATE_INFO[n].live ? 'var(--ok, #7FC29B)' : 'var(--muted)' }}>{TEMPLATE_INFO[n].live ? 'Live' : 'Ready'}</span>
            </Link>
          ))}
        </section>
        <section className="stack" style={{ flex: '2 1 520px', gap: 14 }}>
          <div className="card stack" style={{ gap: 6 }}>
            <span className="small muted">Subject</span><span style={{ fontWeight: 600 }}>{email.subject}</span>
            <form action={sendTestEmail} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="template" value={current} />
              <button className="btn sm">Send a test to me</button>
              <span className="small muted">Uses sample data.</span>
            </form>
          </div>
          <iframe title="Email preview" srcDoc={email.html} style={{ width: '100%', height: 760, border: '1px solid var(--line-soft)', borderRadius: 18, background: '#0B0B0C' }} />
          {supabaseTemplate && (
            <div className="card stack">
              <h2 style={{ margin: 0, fontSize: 16 }}>Paste into Supabase</h2>
              <span className="small muted">Supabase → Authentication → Email Templates → Magic Link. Subject: “Your Score sign-in link”. Then set up Resend as custom SMTP (see Integrations → Email).</span>
              <textarea readOnly className="input mono small" style={{ height: 180 }} defaultValue={supabaseTemplate} />
            </div>
          )}
        </section>
      </div>
      <div className="card scroll-x">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Recent sends</h2>
        <table className="data" style={{ minWidth: 640 }}>
          <thead><tr><th>When</th><th>To</th><th>Email</th><th>Result</th></tr></thead>
          <tbody>{(log || []).map((l) => <tr key={l.id}><td className="muted">{new Date(l.created_at).toLocaleString()}</td><td>{l.to_email}</td><td className="muted">{TEMPLATE_INFO[l.template as TemplateName]?.label || l.template}</td><td style={{ color: l.ok ? '#7FC29B' : '#E58A7A' }}>{l.ok ? 'Sent' : l.error}</td></tr>)}
          {!log?.length && <tr><td colSpan={4} className="muted">Nothing sent yet.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
