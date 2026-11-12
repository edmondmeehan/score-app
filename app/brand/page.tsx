import type { Metadata } from 'next';
import Link from 'next/link';
import DocLayout from '@/components/DocLayout';
import { Gauge, Logo, BandPill } from '@/components/ui';
import { BANDS, type Band } from '@/lib/types';
import { supabaseServer } from '@/lib/supabase/server';
import { getCreditMode } from '@/lib/creditMode';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brand & marketing · ScoreDate',
  description: 'The ScoreDate brand guide: logo, color, type, voice, messaging and approved assets for press, partners and our team.',
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
  { id: 'campaign', h: 'Campaign: 60 days free' },
  { id: 'partners', h: 'Partners & press' },
];

const SWATCHES: { group: string; items: [string, string, string, boolean?][] }[] = [
  { group: 'Core', items: [['Onyx', '#0B0B0C', 'Primary background (dark)'], ['Graphite', '#131315', 'Cards and surfaces'], ['Ivory', '#F2F0EB', 'Primary text on dark', true], ['Stone', '#9A9890', 'Secondary text']] },
  { group: 'Gold', items: [['Gold', '#C9A961', 'Accent, buttons, the gauge'], ['Gold Light', '#E4CC8E', 'Highlights on dark', true], ['Gold Deep', '#A07F2E', 'Gold on light backgrounds'], ['Gold Wash', '#1A1712', 'Tinted panels on dark']] },
  { group: 'Light theme', items: [['Sand', '#E7E2DB', 'Background (light)', true], ['Linen', '#F1EDE7', 'Cards (light)', true], ['Ink', '#1A1916', 'Text on light'], ['Rise', '#7FC29B', 'Positive trend only', true]] },
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

const CAMPAIGN: [string, string, string, string][] = [
  ['score-story-60-days-free.png', 'Story · 60 days free', '1080×1920', 'dark'],
  ['score-post-60-days-free.png', 'Feed post · 60 days on us', '1080×1350', 'light'],
  ['score-post-get-on-the-list.png', 'Square post · Get on the list', '1080×1080', 'dark'],
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

export default async function Brand() {
  const creditMode = await getCreditMode();
  let staff = false;
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (user) staff = (await sb.rpc('is_staff')).data === true;
  } catch { /* public view */ }
  const toc = staff ? [...TOC.slice(0, -1), { id: 'concepts', h: 'Upcoming campaigns (staff)' }, TOC[TOC.length - 1]] : TOC;
  return (
    <DocLayout eyebrow="Company" title="Brand & marketing" toc={toc} updated="November 2026"
      summary="How ScoreDate looks, sounds and talks about itself. For our team, press, partners and anyone making something with our name on it.">

      <section>
        <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <span className="stack" style={{ gap: 2 }}><strong>Brand kit</strong><span className="small muted">Every approved logo and asset on this page, in one download.</span></span>
          <a className="btn sm" href="/brand/score-brand-kit.zip" download>Download kit (ZIP, 4 MB)</a>
        </div>
      </section>

      <section id="essence">
        <h2>Brand essence</h2>
        <p><strong>ScoreDate is a dating app for grown-ups who follow through.</strong> It’s a place for people who are serious about building a life: everyone is verified, money values come up early, and members get fewer, better matches that lead to real dates. The credit band is one signal among many, never a verdict.</p>
        <div className="tool-grid">
          <div className="tool-card"><h3>Promise</h3><p>Reliable is the new attractive.</p></div>
          <div className="tool-card"><h3>Belief</h3><p>Every band is welcome. Honesty about money is required.</p></div>
          <div className="tool-card"><h3>Personality</h3><p>Confident, discreet, warm, a little witty. Never smug, never salesy.</p></div>
          <div className="tool-card"><h3>Feels like</h3><p>A private members’ club with good lighting: quiet luxury, nothing flashy.</p></div>
        </div>
      </section>

      <section id="logo">
        <h2>Logo</h2>
        <p>The ScoreDate logo is the <strong>gauge mark</strong> with the <strong>SCOREDATE wordmark</strong> set in JetBrains Mono with wide letter spacing. The gauge is a credit dial, three-quarters full, with a dot at the tip. Use the full logo wherever you can; use the gauge mark alone only where space is tight (avatars, favicons, small placements).</p>
        <div className="tool-grid" style={{ marginBottom: 14 }}>
          <div className="tool-card" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 140, background: '#0B0B0C' }}><span style={{ color: '#F2F0EB' }}><Logo size={20} /></span></div>
          <div className="tool-card" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 140, background: '#E7E2DB' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#1A1916' }}><Gauge size={32} color="#A07F2E" track="#E6E0D2" /><span className="mono" style={{ fontSize: 20, letterSpacing: '.28em', fontWeight: 500 }}>SCOREDATE</span></span>
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
        <p>ScoreDate is dark-first: onyx and graphite with ivory type and a single gold accent. Gold is precious, so use it sparingly: one button, one highlight, the gauge. Roughly 80% onyx, 15% ivory and stone, 5% gold.</p>
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
          <div className="tool-card"><span className="label">Headlines · Instrument Serif</span><span className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>Reliable is the new attractive.</span><p>Regular weight, tight leading (0.95–1.1). Italic for a single word of emphasis. Sentence case, ending with a period.</p></div>
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
          <li>The product is “ScoreDate”, never “SCOREDATE” in running text (the uppercase wordmark is only in the logo).</li>
          <li>Ages: members are 25 and older. Location: “New York City first”.</li>
          <li>Use the Oxford comma. Spell out numbers one to nine; use numerals for 10 and up, prices and bands’ ranges.</li>
        </ul>
      </section>

      <section id="messaging">
        <h2>Messaging</h2>
        <h3>Tagline</h3>
        <p><strong>Reliable is the new attractive.</strong></p>
        <h3>Supporting lines</h3>
        <ul>
          <li>For people who follow through.</li>
          <li>Meet people who show up, call back and plan ahead.</li>
          <li>Fewer, better matches that lead to real dates.</li>
          <li>Every member verified. Every band welcome.</li>
          <li>Invite only. New York first.</li>
        </ul>
        <h3>Boilerplate (short)</h3>
        <p className="card" style={{ padding: 16 }}>ScoreDate is an invite-only dating app for grown-ups who follow through. Every member verifies their identity, and matches start from shared values and life plans, not just photos. Launching in New York City.</p>
        <h3>Boilerplate (long)</h3>
        <p className="card" style={{ padding: 16 }}>ScoreDate is an invite-only dating app for adults 25 and older who are serious about building a life, and want a partner who follows through. Every member verifies a government ID and a live selfie, answers questions about money and life, and shares a credit band (Elite, Strong, Solid or Building), never the number. Members get a small Daily Drop of curated matches instead of endless swiping. ScoreDate is launching in New York City and expanding area by area as demand grows. ScoreDate, LLC is based in New York.</p>
      </section>

      <section id="claims">
        <h2>Claims & compliance</h2>
        <p>ScoreDate touches credit, so a few rules are non-negotiable in every ad, post, email and partner placement.</p>
        {creditMode === 'self' && <div className="notice" style={{ margin: '4px 0 12px' }}><strong>Bands are self-reported right now.</strong> Until band verification is live, don’t say “verified credit band”, “soft check” or “soft pull”. Say “share your band” or “self-reported band”. “Verified” is fine for ID and selfie only. Older assets that say “verified credit band” shouldn’t run until verification is on.</div>}
        <DoDont
          dos={['“Checking your band is a soft inquiry and won’t affect your credit score.”', '“Members see a band and a trend, never the number.”', '“ScoreDate never sees or stores your exact score or credit report.”', 'Show real prices with “auto-renews, cancel anytime” where a price appears']}
          donts={['Describe ScoreDate as a credit bureau, lender, credit repair or financial advice service', 'Promise better credit, matches, relationships or outcomes', 'Use fake reviews, invented testimonials or made-up member counts', 'Imply we share credit data with other members or partners', 'Target anyone under 25 or use imagery that looks under 25']}
        />
        <p className="small muted">Statistics need a source. Our approved one: Federal Reserve research has found that couples with similar credit scores are more likely to stay together. Anything new goes through the ScoreDate team before it runs.</p>
      </section>

      <section id="imagery">
        <h2>Imagery</h2>
        <ul>
          <li><strong>Mood:</strong> warm evening light, city textures, real moments (a shared table, a walk across a bridge), shallow depth of field.</li>
          <li><strong>People:</strong> confident, relaxed adults 25 and older, styled but not glossy. Diverse in every sense.</li>
          <li><strong>Members:</strong> never use a member’s photo or story without written consent, and never present models, stock photos or AI-generated people as ScoreDate members.</li>
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
              <div style={{ height: 150, display: 'grid', placeItems: 'center', background: bg === 'light' ? '#E7E2DB' : '#0B0B0C', borderBottom: '1px solid var(--line-soft)' }}>
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

      <section id="campaign">
        <h2>Campaign: First 60 days free</h2>
        <p>Waitlist-growth assets for Instagram and TikTok. The offer: <strong>new members who join from the waitlist get their first 60 days of Membership free</strong>, then the regular price.</p>
        <div className="doc-draft">Every placement must keep the fine print: “New members from the waitlist. Then $24.99/mo, auto-renews, cancel anytime. Terms apply.” In captions, add it after the call to action.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: 18, alignItems: 'start', marginBottom: 16 }} className="campaign-grid">
          <div className="stack" style={{ gap: 8 }}>
            <video src="/brand/score-reel-60-days-free.mp4" poster="/brand/score-reel-poster.jpg" controls playsInline muted loop preload="none" style={{ width: '100%', borderRadius: 16, border: '1px solid var(--line-soft)', background: '#0B0B0C' }} />
            <a className="small" href="/brand/score-reel-60-days-free.mp4" download>Download Reel (MP4, 1080×1920, 10s) ↓</a>
            <span className="small muted">Silent, so add a trending or licensed track in Instagram or TikTok.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {CAMPAIGN.map(([file, label, spec, bg]) => (
              <a key={file} href={`/brand/${file}`} download className="tool-card" style={{ padding: 0, overflow: 'hidden', gap: 0, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ height: 170, display: 'grid', placeItems: 'center', background: bg === 'light' ? '#E7E2DB' : '#0B0B0C', borderBottom: '1px solid var(--line-soft)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand/thumbs/${file}`} alt={label} loading="lazy" style={{ maxWidth: '86%', maxHeight: 150, objectFit: 'contain' }} />
                </div>
                <div className="stack" style={{ gap: 2, padding: '10px 12px 12px' }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <span className="small muted">{spec}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
        <h3>Suggested captions</h3>
        <ul>
          <li>Reliable is the new attractive. ScoreDate opens in New York first, and new members get their first 60 days free. Get on the list at scoredate.app.</li>
          <li>Every member verified. Every band welcome. Your first two months are on us when your invite arrives. Link in bio.</li>
          <li>Invite only. New York first. 60 days free for new members. scoredate.app</li>
        </ul>
      </section>

      {staff && (
      <section id="concepts">
        <h2>Upcoming campaigns <span className="mono small" style={{ color: 'var(--gold)', letterSpacing: '.12em', verticalAlign: 'middle' }}>STAFF ONLY</span></h2>
        <div className="doc-draft">Only signed-in ScoreDate staff can see this section. Nothing here is live. Don’t share outside the team until it ships.</div>

        <h3>Big idea: make financial compatibility something people flirt about</h3>
        <p>The credit band gets attention. How someone handles money gives people a reason to connect.</p>

        <div className="card stack" style={{ gap: 10, marginBottom: 16 }}>
          <span className="label">Lead feature</span>
          <strong style={{ fontSize: 22, fontFamily: 'var(--serif)', fontWeight: 400 }}>Hot or Financially Compatible?</strong>
          <p style={{ margin: 0 }}>Two people answer five quick questions before seeing each other’s photos. ScoreDate reveals their money compatibility first, then their photos, and both choose whether to connect.</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
            <li>Would you rather have a luxury vacation or a bigger down payment?</li>
            <li>Split the check, alternate, or whoever invites pays?</li>
            <li>What purchase would you never give up?</li>
            <li>How much spending needs a conversation with your partner?</li>
            <li>Would you date someone who earns less but saves more?</li>
          </ol>
          <p style={{ margin: 0 }}><strong>The shareable moment:</strong> “We’re 96% financially compatible. Now let’s see if there’s chemistry.”</p>
          <ul style={{ margin: 0 }}>
            <li>Keep the percentage playful and clearly labeled as based on their five answers.</li>
            <li>Share cards show only your own result unless both people agree to share together.</li>
          </ul>
        </div>

        <div className="card stack" style={{ gap: 10, marginBottom: 16 }}>
          <span className="label">Launch campaign</span>
          <strong style={{ fontSize: 26, fontFamily: 'var(--serif)', fontWeight: 400 }}>Good Credit. <em>Questionable Taste in Exes.</em></strong>
          <p style={{ margin: 0 }}>Singles share their funniest dating mistake alongside one money habit they’re proud of. The best submissions become short videos and billboards.</p>
          <ul style={{ margin: 0 }}>
            <li>Signed release from everyone featured, before anything runs.</li>
            <li>No names, photos or identifying details about exes.</li>
            <li>Real submissions only: no scripted stories presented as real members.</li>
          </ul>
        </div>

        <h3>Supporting features</h3>
        <div className="tool-grid" style={{ marginBottom: 14 }}>
          <div className="tool-card"><h3>Verified badge</h3><p>An optional badge showing someone has completed ScoreDate’s ID and credit verification, for every band. Never shows the score, and never limited to people above a cutoff, so it doesn’t mark anyone as a red flag.</p></div>
          <div className="tool-card"><h3>The $50 Date Challenge</h3><p>Matches plan the best date under $50, then share the results. Makes being thoughtful and resourceful attractive. Builds on in-app date planning.</p></div>
          <div className="tool-card"><h3>Financial Green Flags</h3><p>Profile prompts like “My sexiest money habit” and “I’ll splurge on ___, but always save on ___” give people natural conversation starters.</p></div>
        </div>
        <p className="small muted">Suggested order: Financial Green Flags prompts (quick win), then the blind compatibility reveal with share cards, then the $50 Date Challenge, then the campaign.</p>
      </section>
      )}

      <section id="partners">
        <h2>Partners & press</h2>
        <ul>
          <li><strong>Co-branding:</strong> place the ScoreDate logo and the partner logo at equal visual weight, separated by a thin divider or “×”, with clear space around both.</li>
          <li><strong>Approval:</strong> anything using the ScoreDate name, logo or claims needs a sign-off from us first. We usually reply within one business day.</li>
          <li><strong>Press:</strong> fast facts, background and interview requests are on the <Link href="/press">Press page</Link>.</li>
          <li><strong>Partnerships:</strong> brands, venues and events can reach us through <Link href="/partners">Partners</Link>.</li>
        </ul>
        <div className="card stack" style={{ gap: 8, marginTop: 10 }}>
          <strong>Questions or approvals</strong>
          <span className="small muted">Email the team and include where and when the piece will run.</span>
          <a className="btn sm" href="mailto:press@scoredate.app?subject=Brand%20approval" style={{ alignSelf: 'flex-start' }}>press@scoredate.app</a>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>ScoreDate and the ScoreDate logo are trademarks of ScoreDate, LLC. Using these assets doesn’t imply endorsement or partnership.</p>
      </section>
    </DocLayout>
  );
}
