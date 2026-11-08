import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';
import { Gauge, Logo, BandPill } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Brand & marketing · Score',
  description: 'The Score brand guide: logo, color, type, voice, messaging and approved assets for press, partners and our team.',
};

const TOC = [
  { id: 'essence', h: 'Brand essence' },
  { id: 'logo', h: 'Logo' },
  { id: 'color', h: 'Color' },
  { id: 'type', h: 'Typography' },
  { id: 'bands', h: 'Credit bands' },
  { id: 'voice', h: 'Voice & tone' },
  { id: 'messaging', h: 'Messaging' },
  { id: 'claims', h: 'Claims & compliance' },
  { id: 'imagery', h: 'Imagery' },
  { id: 'assets', h: 'Approved assets' },
  { id: 'partners', h: 'Partners & press' },
];

const SWATCHES: { group: string; items: [string, string, string, boolean?][] }[] = [
  { group: 'Core', items: [['Onyx', '#0B0B0C', 'Primary background (dark)'], ['Graphite', '#131315', 'Cards and surfaces'], ['Ivory', '#F2F0EB', 'Primary text on dark', true], ['Stone', '#9A9890', 'Secondary text']] },
  { group: 'Gold', items: [['Gold', '#C9A961', 'Accent, buttons, the gauge'], ['Gold Light', '#E4CC8E', 'Highlights on dark', true], ['Gold Deep', '#A07F2E', 'Gold on light backgrounds'], ['Gold Wash', '#1A1712', 'Tinted panels on dark']] },
  { group: 'Light theme', items: [['Cream', '#F6F3EC', 'Background (light)', true], ['White', '#FFFFFF', 'Cards (light)', true], ['Ink', '#1A1916', 'Text on light'], ['Rise', '#7FC29B', 'Positive trend only', true]] },
];

const ASSETS: [string, string, string, string][] = [
  ['score-logo-on-dark.png', 'Logo · for dark backgrounds', 'PNG, transparent, 1600×480', 'dark'],
  ['score-logo-on-light.png', 'Logo · for light backgrounds', 'PNG, transparent, 1600×480', 'light'],
  ['score-mark-gold.svg', 'Gauge mark · gold', 'SVG, any size', 'dark'],
  ['score-mark-gold.png', 'Gauge mark · gold', 'PNG, transparent, 1024×1024', 'dark'],
  ['score-app-icon.png', 'App icon', 'PNG, 1024×1024', 'dark'],
  ['score-bands.png', 'The four bands', 'PNG, 1600×520', 'dark'],
  ['score-share-card-dark.png', 'Share card · dark', 'PNG, 1200×630 (links, LinkedIn, X)', 'dark'],
  ['score-share-card-light.png', 'Share card · light', 'PNG, 1200×630', 'light'],
  ['score-post-every-band.png', 'Social post · “Every band is welcome.”', 'PNG, 1080×1350 (Instagram feed)', 'dark'],
  ['score-post-soft-check.png', 'Social post · “A soft check.”', 'PNG, 1080×1350 (Instagram feed)', 'light'],
  ['score-story-request-invite.png', 'Story · “Request an invite”', 'PNG, 1080×1920 (Stories, Reels cover)', 'dark'],
];

function Swatch({ name, hex, use, light }: { name: string; hex: string; use: string; light?: boolean }) {
  return (
    <div className="tool-card" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
      <div style={{ height: 78, background: hex, borderBottom: '1px solid var(--line-soft)' }} aria-hidden />
      <div className="stack" style={{ gap: 2, padding: '10px 14px 14px' }}>
        <strong style={{ fontSize: 15 }}>{name}</strong>
        <span className="mono small" style={{ color: light ? 'var(--muted)' : 'var(--muted)' }}>{hex}</span>
        <span className="small muted">{use}</span>
      </div>
    </div>
  );
}

function DoDont({ dos, donts }: { dos: string[]; donts: string[] }) {
  return (
    <div className="tool-grid" style={{ margin: '6px 0 14px' }}>
      <div className="tool-card"><h3 style={{ color: 'var(--rise)' }}>Do</h3><ul style={{ margin: 0 }}>{dos.map((d) => <li key={d}>{d}</li>)}</ul></div>
      <div className="tool-card"><h3 style={{ color: 'var(--alert)' }}>Don’t</h3><ul style={{ margin: 0 }}>{donts.map((d) => <li key={d}>{d}</li>)}</ul></div>
    </div>
  );
}

export default function Brand() {
  return (
    <DocLayout eyebrow="Company" title="Brand & marketing" toc={TOC} updated="November 2026"
      summary="How Score looks, sounds and talks about itself. For our team, press, partners and anyone making something with our name on it.">

      <section>
        <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <span className="stack" style={{ gap: 2 }}><strong>Brand kit</strong><span className="small muted">Every approved logo and asset on this page, in one download.</span></span>
          <a className="btn sm" href="/brand/score-brand-kit.zip" download>Download kit (ZIP, 2 MB)</a>
        </div>
      </section>

      <section id="essence">
        <h2>Brand essence</h2>
        <p><strong>Score is the dating app where every member has verified their credit and their identity.</strong> We exist because money is one of the biggest sources of friction in relationships, and the honest conversation about it usually comes far too late.</p>
        <div className="tool-grid">
          <div className="tool-card"><h3>Promise</h3><p>Date someone who has their act together.</p></div>
          <div className="tool-card"><h3>Belief</h3><p>Every band is welcome. Honesty about money is required.</p></div>
          <div className="tool-card"><h3>Personality</h3><p>Confident, discreet, warm, a little witty. Never smug, never salesy.</p></div>
          <div className="tool-card"><h3>Feels like</h3><p>A private members’ club with good lighting: quiet luxury, nothing flashy.</p></div>
        </div>
      </section>

      <section id="logo">
        <h2>Logo</h2>
        <p>The Score logo is the <strong>gauge mark</strong> with the <strong>SCORE wordmark</strong> set in JetBrains Mono with wide letter spacing. The gauge is a credit dial, three-quarters full, with a dot at the tip. Use the full logo wherever you can; use the gauge mark alone only where space is tight (avatars, favicons, small placements).</p>
        <div className="tool-grid" style={{ marginBottom: 14 }}>
          <div className="tool-card" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 140, background: '#0B0B0C' }}><span style={{ color: '#F2F0EB' }}><Logo size={20} /></span></div>
          <div className="tool-card" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 140, background: '#F6F3EC' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#1A1916' }}><Gauge size={32} color="#A07F2E" track="#E6E0D2" /><span className="mono" style={{ fontSize: 20, letterSpacing: '.42em', fontWeight: 500 }}>SCORE</span></span>
          </div>
        </div>
        <h3>Clear space and size</h3>
        <p>Leave space around the logo equal to the height of the gauge on every side. The full logo should be at least 120 px (or 30 mm) wide; the gauge mark at least 24 px.</p>
        <DoDont
          dos={['Use the ivory version on dark backgrounds and the ink version on light ones', 'Keep the gauge gold', 'Use the supplied files']}
          donts={['Recolor, stretch, rotate or add effects', 'Change the gauge fill or move the dot', 'Retype the wordmark in another font', 'Place it on busy photos without a solid backing']}
        />
        <p className="small muted">The app icon is a gold serif “S” on onyx. Use it only to represent the app itself (for example, next to a download link).</p>
      </section>

      <section id="color">
        <h2>Color</h2>
        <p>Score is dark-first: onyx and graphite with ivory type and a single gold accent. Gold is precious, so use it sparingly: one button, one highlight, the gauge. Roughly 80% onyx, 15% ivory and stone, 5% gold.</p>
        {SWATCHES.map((g) => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>{g.group}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {g.items.map(([n, h, u, l]) => <Swatch key={n} name={n} hex={h} use={u} light={l} />)}
            </div>
          </div>
        ))}
        <p className="small muted">Text must meet WCAG AA contrast (4.5:1 for body copy). Don’t put stone or gold body text on graphite at small sizes.</p>
      </section>

      <section id="type">
        <h2>Typography</h2>
        <div className="stack" style={{ gap: 14 }}>
          <div className="tool-card"><span className="label">Headlines · Instrument Serif</span><span className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>Date someone who has their act together.</span><p>Regular weight, tight leading (0.95–1.1). Italic for a single word of emphasis. Sentence case, ending with a period.</p></div>
          <div className="tool-card"><span className="label">Body · Inter</span><span style={{ fontSize: 18, lineHeight: 1.6 }}>Every member verifies a government ID, a live selfie and their credit band before they can match.</span><p>400 for body, 500–600 for buttons and emphasis. 16 px minimum on screen.</p></div>
          <div className="tool-card"><span className="label">Labels · JetBrains Mono</span><span className="mono" style={{ fontSize: 14, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Invite only · New York</span><p>Uppercase with wide tracking for eyebrows, labels and the wordmark. Never for paragraphs.</p></div>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>All three are free on Google Fonts. If they aren’t available, fall back to Georgia, system sans-serif and a system monospace.</p>
      </section>

      <section id="bands">
        <h2>Credit bands</h2>
        <p>Members are placed in one of four bands by a soft credit check. Members see the band and a 12-month trend, never the number.</p>
        <div className="tool-grid">
          {(Object.keys(BANDS) as Band[]).map((b) => (
            <div key={b} className="tool-card" style={{ alignItems: 'flex-start' }}>
              <BandPill band={b} />
              <p className="mono small" style={{ marginTop: 4 }}>{BANDS[b].range}</p>
            </div>
          ))}
        </div>
        <DoDont
          dos={['Always say “band”, and capitalize band names (Elite, Strong, Solid, Building)', 'Show the trend arrow when it’s up', 'Celebrate every band equally in marketing']}
          donts={['Show or imply an exact score', 'Rank people as better or worse by band, or mock any band', 'Use “bad credit”, “poor” or “subprime”', 'Suggest a band reflects someone’s worth']}
        />
      </section>

      <section id="voice">
        <h2>Voice & tone</h2>
        <div className="tool-grid">
          <div className="tool-card"><h3>Direct</h3><p>Short sentences. Say the thing. “Verify your band in a minute.”</p></div>
          <div className="tool-card"><h3>Warm</h3><p>Talk to a person, not a user. Encouraging about money, never judgmental.</p></div>
          <div className="tool-card"><h3>Discreet</h3><p>Privacy is part of the product. We never overshare about members.</p></div>
          <div className="tool-card"><h3>Lightly witty</h3><p>A raised eyebrow, not a punchline. Never at anyone’s expense.</p></div>
        </div>
        <h3>Words we use</h3>
        <p>Members, invite, band, trend, verified, honest, Founding Member, the Daily Drop, say hello, Reserve, Membership, Premium.</p>
        <h3>Words we avoid</h3>
        <p>Users, swipe, hookup, rich, elite people, gold-digger, “financially attractive”, guaranteed, exclusive club for the wealthy, bad credit.</p>
        <h3>Style</h3>
        <ul>
          <li>Sentence case for headlines and buttons (“Request an invite”, not “Request An Invite”).</li>
          <li>The product is “Score”, never “SCORE” in running text (the uppercase wordmark is only in the logo).</li>
          <li>Ages: members are 25 and older. Location: “New York City first”.</li>
          <li>Use the Oxford comma. Spell out numbers one to nine; use numerals for 10 and up, prices and bands’ ranges.</li>
        </ul>
      </section>

      <section id="messaging">
        <h2>Messaging</h2>
        <h3>Tagline</h3>
        <p><strong>Date someone who has their act together.</strong></p>
        <h3>Supporting lines</h3>
        <ul>
          <li>Every band is welcome. Honesty about money is required.</li>
          <li>Verified identity. Verified credit band. No guesswork.</li>
          <li>A soft check. No impact on your score.</li>
          <li>Invite only. New York first.</li>
        </ul>
        <h3>Boilerplate (short)</h3>
        <p className="card" style={{ padding: 16 }}>Score is an invite-only dating app where every member verifies their identity and their credit band. Launching in New York City, Score makes honesty about money part of dating from the start, without ever showing anyone’s exact score.</p>
        <h3>Boilerplate (long)</h3>
        <p className="card" style={{ padding: 16 }}>Score is an invite-only dating app for adults 25 and older who want a partner with their act together. Every member verifies a government ID, a live selfie and their credit band through a soft inquiry that never affects their credit score. Members see each other’s band (Elite, Strong, Solid or Building) and 12-month trend, never the number. Score is launching in New York City and expanding area by area as demand grows. Score is built by Please &amp; Thank You, Inc., based in New York.</p>
      </section>

      <section id="claims">
        <h2>Claims & compliance</h2>
        <p>Score touches credit, so a few rules are non-negotiable in every ad, post, email and partner placement.</p>
        <DoDont
          dos={['“Checking your band is a soft inquiry and won’t affect your credit score.”', '“Members see a band and a trend, never the number.”', '“Score never sees or stores your exact score or credit report.”', 'Show real prices with “auto-renews, cancel anytime” where a price appears']}
          donts={['Describe Score as a credit bureau, lender, credit repair or financial advice service', 'Promise better credit, matches, relationships or outcomes', 'Use fake reviews, invented testimonials or made-up member counts', 'Imply we share credit data with other members or partners', 'Target anyone under 25 or use imagery that looks under 25']}
        />
        <p className="small muted">Statistics need a source. Our approved one: Federal Reserve research has found that couples with similar credit scores are more likely to stay together. Anything new goes through the Score team before it runs.</p>
      </section>

      <section id="imagery">
        <h2>Imagery</h2>
        <ul>
          <li><strong>Mood:</strong> warm evening light, city textures, real moments (a shared table, a walk across a bridge), shallow depth of field.</li>
          <li><strong>People:</strong> confident, relaxed adults 25 and older, styled but not glossy. Diverse in every sense.</li>
          <li><strong>Members:</strong> never use a member’s photo or story without written consent, and never present models, stock photos or AI-generated people as Score members.</li>
          <li><strong>Avoid:</strong> cash, luxury logos, credit cards, “money shots”, and anything that suggests buying affection.</li>
          <li><strong>Graphics:</strong> when in doubt, use type and the gauge on onyx. It’s our most recognizable look.</li>
        </ul>
      </section>

      <section id="assets">
        <h2>Approved assets</h2>
        <p>Ready to use as-is. Please don’t edit the copy on social templates; ask us for new versions instead.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {ASSETS.map(([file, label, spec, bg]) => (
            <a key={file} href={`/brand/${file}`} download className="tool-card" style={{ padding: 0, overflow: 'hidden', gap: 0, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ height: 150, display: 'grid', placeItems: 'center', background: bg === 'light' ? '#F6F3EC' : '#0B0B0C', borderBottom: '1px solid var(--line-soft)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/thumbs/${file}`} alt={label} loading="lazy" style={{ maxWidth: '86%', maxHeight: 128, objectFit: 'contain' }} />
              </div>
              <div className="stack" style={{ gap: 2, padding: '10px 14px 14px' }}>
                <strong style={{ fontSize: 14 }}>{label}</strong>
                <span className="small muted">{spec}</span>
                <span className="small" style={{ color: 'var(--gold)' }}>Download ↓</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="partners">
        <h2>Partners & press</h2>
        <ul>
          <li><strong>Co-branding:</strong> place the Score logo and the partner logo at equal visual weight, separated by a thin divider or “×”, with clear space around both.</li>
          <li><strong>Approval:</strong> anything using the Score name, logo or claims needs a sign-off from us first. We usually reply within one business day.</li>
          <li><strong>Press:</strong> fast facts, background and interview requests are on the <Link href="/press">Press page</Link>.</li>
          <li><strong>Partnerships:</strong> brands, venues and events can reach us through <Link href="/partners">Partners</Link>.</li>
        </ul>
        <div className="card stack" style={{ gap: 8, marginTop: 10 }}>
          <strong>Questions or approvals</strong>
          <span className="small muted">Email the team and include where and when the piece will run.</span>
          <a className="btn sm" href="mailto:press@scoredate.app?subject=Brand%20approval" style={{ alignSelf: 'flex-start' }}>press@scoredate.app</a>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>Score and the Score logo are trademarks of Please &amp; Thank You, Inc. Using these assets doesn’t imply endorsement or partnership.</p>
      </section>
    </DocLayout>
  );
}
