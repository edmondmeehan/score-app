import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { submitInquiry } from './actions';
import { getPartnersPage } from '@/lib/policies';

export const metadata: Metadata = { title: 'Partner with ScoreDate', description: 'Host members, offer a perk, or teach financial wellness to verified, invite-only daters in New York.' };

export default async function Partners({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const pg = await getPartnersPage();
  const FACTS = pg.facts, WAYS = pg.ways;
  return (
    <main>
      <SiteHeader cta={false} />
      <section className="page stack" style={{ gap: 18, padding: '48px 24px 24px', maxWidth: 820 }}>
        <span className="eyebrow">{pg.eyebrow}</span>
        <h1 className="serif" style={{ fontSize: 'clamp(44px, 8vw, 76px)', lineHeight: 1 }}>{pg.title}</h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.6, maxWidth: 620 }}>{pg.intro}</p>
      </section>
      <section className="page" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, padding: '12px 24px' }}>
        {FACTS.map(([big, small]) => (
          <div key={big} className="card stack" style={{ gap: 4 }}><span className="serif" style={{ fontSize: 32, color: 'var(--gold-light)' }}>{big}</span><span className="small muted">{small}</span></div>
        ))}
      </section>
      <section className="page" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, padding: '24px' }}>
        {WAYS.map(([t, d]) => (
          <div key={t} className="card stack" style={{ gap: 8 }}><span className="serif" style={{ fontSize: 26 }}>{t}</span><span className="muted" style={{ lineHeight: 1.6 }}>{d}</span></div>
        ))}
      </section>
      <section className="page stack" style={{ gap: 10, padding: '12px 24px', maxWidth: 820 }}>
        <span className="label">How we work</span>
        <span className="muted" style={{ lineHeight: 1.6 }}>We never sell or share member data. Partners get event headcounts and how many members used a perk, never names, contact details or credit information. Paid placements are always labeled.</span>
      </section>
      <section id="contact" className="page" style={{ padding: '24px 24px 64px', maxWidth: 720 }}>
        <form action={submitInquiry} className="card stack" style={{ gap: 14 }}>
          <span className="serif" style={{ fontSize: 30 }}>Tell us about you</span>
          {sp.sent && <div className="notice test">Thanks, we&apos;ll be in touch within a few business days.</div>}
          {sp.error && <div className="notice error">{sp.error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <label className="field">Your name<input className="input" name="name" required autoComplete="name" /></label>
            <label className="field">Company<input className="input" name="company" required autoComplete="organization" /></label>
            <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email" /></label>
            <label className="field">Website<input className="input" name="website" placeholder="https://" /></label>
          </div>
          <label className="field">I&apos;m interested in
            <select className="input" name="kind" defaultValue="venue">
              <option value="venue">Hosting an event at my venue</option><option value="brand">Offering a member perk</option>
              <option value="financial">Financial wellness content</option><option value="events">Sponsoring events</option>
              <option value="press">Press</option><option value="other">Something else</option>
            </select>
          </label>
          <label className="field">What do you have in mind?<textarea className="input" name="message" rows={5} required /></label>
          <input type="text" name="company_website_confirm" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
          <button className="btn">Send</button>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}
