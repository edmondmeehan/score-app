"""Builds the branded investor market report (HTML + PDF) in ScoreDate's site design.
Run: python3 scripts/build-market-report.py  → writes lib/marketReport.ts (HTML + PDF, embedded)."""
import base64, html, pathlib, subprocess, json

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/investors'
OUT.mkdir(parents=True, exist_ok=True)

SRC = {
 'boa': ('Business of Apps', 'https://www.businessofapps.com/?p=102860'),
 'mtch': ('Match Group', 'https://ir.mtch.com/investor-relations/news-events/news-events/news-details/2026/Match-Group-Announces-Fourth-Quarter-and-Full-Year-Results'),
 'rm': ('Research and Markets', 'https://www.globenewswire.com/news-release/2025/06/18/3101211/28124/en/Online-Dating-Services-Industry-Trends-Competitive-Analysis-and-Investment-Opportunities-to-2030.html'),
 'pew': ('Pew Research Center', 'https://www.pewresearch.org/short-reads/2023/02/02/key-findings-about-online-dating-in-the-u-s/'),
 'ksu': ('Kansas State University', 'https://www.sciencedaily.com/releases/2013/07/130712102438.htm'),
 'idfa': ('Institute for Divorce Financial Analysts', 'https://www.institutedfa.com/Leading-Causes-Divorce/'),
 'ramsey': ('Ramsey Solutions', 'https://www.ramseysolutions.com/relationships/money-marriage-communication-research'),
 'fed': ('Federal Reserve Board', 'https://www.federalreserve.gov/econres/feds/credit-scores-and-committed-relationships.htm'),
 'brook': ('Brookings', 'https://www.brookings.edu/articles/how-your-credit-score-could-predict-the-success-of-your-relationship-in-4-charts'),
 'fico': ('myFICO', 'https://www.myfico.com/credit-education/credit-scores'),
 'bankrate': ('Bankrate', 'https://www.prnewswire.com/news-releases/42-of-americans-say-a-persons-credit-score-affects-romantic-interest-300454983.html'),
 'exp': ('Experian', 'https://www.experian.com/blogs/ask-experian/research/dating-and-credit-survey/'),
}
def c(k, label=None):
    n, u = SRC[k]
    return f'<a class="cite" href="{u}" target="_blank" rel="noopener">{html.escape(label or n)}</a>'

MARK = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24.5 75.5 A36 36 0 1 1 85.89 52.82" fill="none" stroke="#C9A961" stroke-width="9" stroke-linecap="round"/><circle cx="85.89" cy="52.82" r="6.5" fill="#F2F0EB"/></svg>'

# ---------- Charts (SVG, brand colors) ----------
def market_chart():
    start, end, n = 6.0, 8.9, 6
    r = (end / start) ** (1 / n)
    vals = [(2024 + i, start * r ** i) for i in range(n + 1)]
    W, H, L, B, T = 680, 300, 40, 250, 40
    bw = (W - L - 20) / len(vals)
    y = lambda v: B - v / 10 * (B - T)
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Dating app revenue grows from $6B in 2024 to $8.9B in 2030">']
    for t in (0, 2.5, 5, 7.5, 10):
        out.append(f'<line x1="{L}" x2="{W-10}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/><text x="{L-8}" y="{y(t)+4:.1f}" class="ax" text-anchor="end">${t:g}B</text>')
    for i, (yr, v) in enumerate(vals):
        x = L + i * bw + bw * 0.2
        w = bw * 0.6
        ends = i in (0, len(vals) - 1)
        out.append(f'<rect x="{x:.1f}" y="{y(v):.1f}" width="{w:.1f}" height="{B-y(v):.1f}" rx="6" class="{"bar-gold" if ends else "bar"}"/>')
        out.append(f'<text x="{x+w/2:.1f}" y="{y(v)-8:.1f}" text-anchor="middle" class="{"val-gold" if ends else "val"}">${v:.1f}B</text>')
        out.append(f'<text x="{x+w/2:.1f}" y="{B+20}" text-anchor="middle" class="ax">{yr}</text>')
    out.append('</svg>')
    return ''.join(out)

def scenario_chart():
    payers = [5000, 20000, 45000, 75000, 100000]
    yr = 28 * 12
    W, H, L, B, T = 680, 330, 52, 270, 30
    band = (W - L - 10) / 5
    y = lambda v: B - v / 110 * (B - T)
    cx = lambda i: L + band * (i + .5)
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Base case reaches $34M a year by Year 5">']
    for t in (0, 25, 50, 75, 100):
        o.append(f'<line x1="{L}" x2="{W-10}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/><text x="{L-8}" y="{y(t)+4:.1f}" class="ax" text-anchor="end">${t}M</text>')
    for i, p in enumerate(payers):
        base = p * yr / 1e6; lo, hi = base * .25, base * 3
        o.append(f'<line x1="{cx(i):.1f}" x2="{cx(i):.1f}" y1="{y(lo):.1f}" y2="{y(hi):.1f}" class="whisk"/>')
        o.append(f'<line x1="{cx(i)-9:.1f}" x2="{cx(i)+9:.1f}" y1="{y(hi):.1f}" y2="{y(hi):.1f}" class="whisk"/>')
        o.append(f'<line x1="{cx(i)-9:.1f}" x2="{cx(i)+9:.1f}" y1="{y(lo):.1f}" y2="{y(lo):.1f}" class="whisk"/>')
        o.append(f'<text x="{cx(i):.1f}" y="{y(hi)-9:.1f}" text-anchor="middle" class="val">${hi:.1f}M</text>')
        o.append(f'<circle cx="{cx(i):.1f}" cy="{y(base):.1f}" r="8" class="dot"/>')
        o.append(f'<text x="{cx(i)+14:.1f}" y="{y(base)+5:.1f}" class="val-gold">${base:.1f}M</text>')
        o.append(f'<text x="{cx(i):.1f}" y="{B+22}" text-anchor="middle" class="axb">Year {i+1}</text>')
        o.append(f'<text x="{cx(i):.1f}" y="{B+40}" text-anchor="middle" class="ax">{p//1000}k payers</text>')
    o.append('</svg>')
    return ''.join(o)

def table(head, rows):
    h = ''.join(f'<th>{x}</th>' for x in head)
    b = ''.join('<tr>' + ''.join(f'<td>{x}</td>' for x in r) + '</tr>' for r in rows)
    return f'<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'

def section(num, eyebrow, title, body, brk=True):
    return f'<section class="sec{" brk" if brk else ""}"><div class="eyebrow"><span class="num">{num}</span>{eyebrow}</div><h2>{title}</h2>{body}</section>'

def stats(items):
    return '<div class="stats">' + ''.join(f'<div class="stat"><div class="n">{n}</div><div class="l">{l}</div><div class="s">{s}</div></div>' for n, l, s in items) + '</div>'

S = []
S.append(section('01', 'Executive summary', 'Money is where relationships break. ScoreDate starts there.', stats([
    ('$8.9B', 'Global dating app revenue by 2030', 'From $6B+ in 2024'),
    ('2–3x', 'More likely to separate', 'Couples with the lowest credit scores'),
    ('$34M', 'Base-case revenue, Year 5', '100k paying members · illustrative'),
]) + '<ul class="points">'
 f'<li><strong>The market is big and shifting toward intent.</strong> Dating apps are a $6B+ global category, headed toward $8.9B by 2030. Growth is coming from apps for people who want a real relationship: Hinge grew 38% in 2024 while Match Group overall was flat and its payer count fell 5%.</li>'
 f'<li><strong>Money is where relationships break.</strong> Arguments about money are the strongest predictor of divorce ({c("ksu")}). Federal Reserve research found couples with the lowest credit scores are 2–3x more likely to split up.</li>'
 f'<li><strong>Credit is a trusted proxy for responsibility.</strong> Credit is how lenders judge whether someone keeps their commitments: FICO scores are used by 90% of top lenders. The same habits carry into relationships.</li>'
 f'<li><strong>Singles want this but rarely ask.</strong> 4 in 5 Americans say good credit is attractive, but only 4% talk about money before a first date. ScoreDate brings that up front with a verified credit band and matching on money values.</li>'
 f'<li><strong>The opportunity.</strong> In our base case, ScoreDate reaches about <span class="gold">$34M in annual revenue by Year 5</span> from 100,000 paying members, or 0.7% of Match’s paying base. Our range runs from about $8M (conservative) to about $101M (upside).</li></ul>', brk=False))

S.append(section('02', 'The market', 'The state of dating apps',
 f'<p class="lede">Dating apps are a $6 billion-plus global business that has stopped growing at the top and started splitting by intent.</p>'
 f'<p>Global dating app revenue passed $6 billion in 2024, with North America producing 50% of it ({c("boa")}).</p>'
 f'<p>The category leader is flat. {c("mtch")} (Tinder, Hinge, Match.com) reported $3.49 billion of revenue for 2025, unchanged from 2024. Its paying users fell 5% to 14.2 million, while revenue per payer rose 5% to $20.09 a month.</p>'
 + stats([('$3.49B', 'Match Group revenue, 2025', 'Flat year over year'), ('−5%', 'Match Group payers', 'Down to 14.2M'), ('+38%', 'Hinge revenue, 2024', '$550M · built for relationships')]) +
 f'<p>The growth has moved to apps built around serious intent. Hinge, positioned as the app “designed to be deleted”, made $550 million in 2024, up 38%, and grew direct revenue 26% year over year in Q4 2025 ({c("mtch")}). Swipe-first apps are losing payers: fewer people pay, but those who stay pay more. Users are tired of volume and willing to pay for quality.</p>'
 '<p class="callout">That is the opening for ScoreDate: a smaller, verified, intent-first product that charges for better matches rather than more of them.</p>'))

S.append(section('03', 'Five-year outlook', 'Close to $3B of new annual revenue by 2030',
 '<p class="lede">The market is expected to grow about 6 to 7% a year through 2030.</p>'
 f'<figure class="chart"><figcaption class="ct">Global dating app revenue, 2024–2030</figcaption>{market_chart()}<figcaption class="src">Source: Business of Apps, $6B+ in 2024 and $8.9B by 2030. Years between are interpolated.</figcaption></figure>'
 f'<p>A separate forecast puts online dating services growth at 6.9% a year from 2025 to 2030 ({c("rm")}). The demand base is broad: 30% of US adults have used a dating site or app, rising to 53% of adults under 30, and one in five partnered adults under 30 met their partner online ({c("pew")}).</p>'
 '<p>Growth is shifting from more users to more revenue per user. Match Group’s revenue per payer rose 5% in 2025 while payers fell 5%, so the winners over the next five years will be the apps people pay more to use because the matches are better.</p>'))

S.append(section('04', 'The problem', 'Money is where relationships break',
 '<p class="lede">Money conflict is the single strongest predictor of divorce, and no major dating app screens for it.</p>'
 + table(['Finding', 'Source'], [
   ['Arguments about money are “by far the top predictor of divorce”, ahead of children, sex and in-laws, in longitudinal data on 4,500+ couples', c('ksu', 'Dew, Britt & Huston, Kansas State University, Family Relations (2012)')],
   ['Money issues are the main reason for divorce in 18% of cases, third after incompatibility (44%) and infidelity (22%)', c('idfa', 'Institute for Divorce Financial Analysts, 2026 survey')],
   ['Financial problems contribute to between 20% and 40% of divorces; 41% of Gen X divorcees name finances as the primary reason', c('idfa', 'Institute for Divorce Financial Analysts, citing 2025 data')],
   ['41% of couples with consumer debt say money is what they argue about most, versus 25% of debt-free couples', c('ramsey', 'Ramsey Solutions, survey of 1,072 US adults')],
   ['63% of marriages start with debt; couples who fight about money carry about $30,000 of consumer debt on average', c('ramsey')],
 ]) +
 f'<p class="callout">The gap is timing. Only 4% of singles discuss finances before a first meeting, and 56% wait until they have committed ({c("exp", "Experian, 2024")}). By then, a mismatch is expensive to discover. ScoreDate moves that conversation to the start, gently and on the member’s terms.</p>'))

S.append(section('05', 'The signal', 'Why credit signals responsibility',
 '<p class="lede">A credit score is a track record of keeping promises, which is why lenders trust it with money and why it predicts relationships too.</p>'
 f'<h3>How lenders use it</h3><p>FICO Scores are used by 90% of top lenders to make billions of credit decisions a year ({c("fico")}). A score from 300 to 850 sums up a person’s credit history: whether they pay on time, how much they owe, how long they have managed credit, and how often they take on new debt. Lenders use it to decide who gets a mortgage, a car loan, a credit card or a line of cash, and at what price. It is the most widely used shorthand for “will this person do what they said they would?”</p>'
 f'<h3>What it predicts in relationships</h3><p>Federal Reserve economists studied a large panel of anonymized credit records and found the same signal at work in love ({c("fed", "Dokko, Li & Hayes, Federal Reserve Board, 2015")}):</p>'
 f'<ul class="points"><li>People pair up with others whose credit scores are similar, even after accounting for income, education and other traits.</li>'
 f'<li>Singles with the lowest scores are about 30% less likely to form a relationship in a given year than those with the highest ({c("brook")}).</li>'
 f'<li>Couples with the lowest average scores are two to three times more likely to separate than couples with the highest ({c("brook")}).</li>'
 '<li>The authors conclude a credit score also reveals “relationship skill and level of commitment”, not just money.</li></ul>'
 + stats([('90%', 'Of top lenders use FICO', 'myFICO'), ('42%', 'Say a credit score affects dating interest', 'Bankrate, 2017'), ('4 in 5', 'Young singles find good credit attractive', 'Experian, 2024')])))

S.append(section('06', 'Our position', 'ScoreDate’s position',
 '<p class="lede">The first dating app built on the finding that financial compatibility predicts whether a relationship lasts.</p>'
 '<div class="pillars">'
 '<div class="pillar"><h4>Credit bands, never scores</h4><p>Members show a band (Building, Solid, Strong or Elite), confirmed with a soft check that never affects their credit. ScoreDate never stores an exact score or a credit report.</p></div>'
 '<div class="pillar"><h4>Matched on money values</h4><p>Six questions (saver or spender, debt, who pays, joint or separate finances, five-year goals, investing style) feed the nightly Daily Drop, so people see shared values before they see a face.</p></div>'
 '<div class="pillar"><h4>Verified and invite-only</h4><p>Every member verifies their ID and photos. Membership opens neighborhood by neighborhood, starting in New York City, for people 25 and older.</p></div>'
 '<div class="pillar"><h4>Built to get people off the app</h4><p>Date planning, a safety share, calendar invites and post-date check-ins push matches toward real dates, the same intent-first model driving Hinge’s growth.</p></div>'
 '<div class="pillar wide"><h4>Premium by design</h4><p>Membership ($24.99 a month), Premium ($49.99) and Reserve ($149, with a matchmaker) price ScoreDate above swipe apps, aimed at a user who already pays for quality.</p></div>'
 '</div><p class="callout">The result is a self-selecting audience: people who are proud of how they handle money, and want a partner who is too.</p>'))

S.append(section('07', 'The opportunity', 'Market size and revenue potential',
 '<div class="tam">'
 f'<div><span class="label">Total market</span><div class="big">$6B → $8.9B</div><p>Dating apps worldwide, 2024 to 2030 ({c("boa")}).</p></div>'
 '<div><span class="label">Our slice</span><div class="big">~$3B</div><p>North America is about half of global spend. Inside it, the fastest-growing part is apps for real relationships: Hinge made $550M in 2024, up 38%.</p></div></div>'
 '<p>The chart shows three paths. They all use the same assumed price mix (about $28 a month across memberships, Premium and add-ons) and differ only in how many people pay.</p>'
 f'<figure class="chart"><figcaption class="ct">Annual revenue scenarios <span class="legend"><i class="ld"></i>Base case <i class="lw"></i>Conservative (25% of base payers) to upside (3x)</span></figcaption>{scenario_chart()}<figcaption class="src">ScoreDate scenario model. Payer counts and $28/month blended revenue per payer are planning assumptions, not results.</figcaption></figure>'
 '<p>The base case needs 100,000 paying members by Year 5. That is about <span class="gold">0.7% of Match Group’s 14.2M payers</span> today. Reaching it means winning a small, well-defined group, people who care about financial compatibility, rather than taking on the big apps head-to-head. Launching in New York, the largest US market for single professionals, keeps acquisition focused while the model is proven.</p>'
 '<p class="fine">These figures are planning scenarios built on our own assumptions. They are not forecasts or guarantees.</p>'))

S.append(section('08', 'Risks', 'Risks and how we manage them', table(['Risk', 'How we manage it'], [
 ['Credit feels exclusionary or judgmental', 'Bands, not scores. A Building band is welcome and shown with its trend; members choose whether to show an Improving badge; matching weights shared money values, not wealth.'],
 ['Privacy and regulation (credit data, biometrics)', 'No exact scores or reports stored; soft checks only; written biometric consent; deletion on request; policies drafted for counsel review.'],
 ['App Store rules for dating and payments', 'In-app purchases through Apple, moderation of photos and video, report and block on every profile, 25+ age gate.'],
 ['Advertising limits on dating ads', 'Meta requires prior permission for dating ads. Launch leans on referrals, Founding Members, events and organic social while approval is pending.'],
 ['Competition from Match Group and Bumble', 'A focused niche they cannot copy without alienating their mass-market users. Verification and a financial-values identity build trust that is hard to replicate.'],
 ['Slow network growth in a new city', 'Neighborhood-by-neighborhood launch with waitlists, so every member opens to a dense pool on day one.'],
])))

SOURCES = [
 ('boa', 'Business of Apps: global dating app revenues exceeded $6B (Aug 2025)'),
 ('mtch', 'Match Group: Q4 and full-year 2025 results (Feb 2026)'),
 ('rm', 'Research and Markets via GlobeNewswire: online dating services to 2030 (Jun 2025)'),
 ('pew', 'Pew Research Center: key findings about online dating in the US (Feb 2023)'),
 ('ksu', 'Kansas State University: money arguments and divorce, via ScienceDaily (Jul 2013)'),
 ('idfa', 'Institute for Divorce Financial Analysts: leading causes of divorce (Aug 2026)'),
 ('ramsey', 'Ramsey Solutions: money, marriage and communication research'),
 ('fed', 'Federal Reserve Board: Credit Scores and Committed Relationships, Dokko, Li & Hayes (Oct 2015)'),
 ('brook', 'Brookings: how your credit score could predict the success of your relationship (Oct 2015)'),
 ('fico', 'myFICO: what is a credit score'),
 ('bankrate', 'Bankrate via PR Newswire: 42% of Americans say a credit score affects romantic interest (May 2017)'),
 ('exp', 'Experian: dating and credit survey (Feb 2024)'),
]
S.append(section('09', 'Sources', 'Sources', '<ol class="sources">' + ''.join(f'<li><a href="{SRC[k][1]}" target="_blank" rel="noopener">{html.escape(t)}</a></li>' for k, t in SOURCES) + '</ol>'
 '<p class="fine disclaimer">Confidential. For discussion purposes only. This is not an offer to sell or a solicitation of an offer to buy any security. Scenario figures are illustrative and based on assumptions that may not prove correct; they are not a forecast or a guarantee of future results.</p>'))

IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');"
CSS = r"""
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--onyx:#0B0B0C;--graphite:#131315;--line:#2A2A2E;--line-soft:#222225;--ivory:#F2F0EB;--stone:#9A9890;--muted:#B4B2AC;--faint:#8E8C86;--gold:#C9A961;--gold-light:#E4CC8E;--deep:#050506;--track:#1F1F22;
--serif:'Instrument Serif',Georgia,serif;--sans:'Inter',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace}
*{box-sizing:border-box}html,body{margin:0;background:var(--onyx);color:var(--ivory);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.doc{max-width:860px;margin:0 auto;padding:0 28px 80px}
a{color:var(--gold);text-decoration:none}a:hover{color:var(--gold-light)}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:22px 0;border-bottom:1px solid var(--line-soft)}
.logo{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:14px;letter-spacing:.28em;font-weight:500;color:var(--ivory)}.logo svg{width:24px;height:24px}
.conf{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.cover{position:relative;padding:90px 0 70px;border-bottom:1px solid var(--line-soft);overflow:hidden}
.cover:before{content:'';position:absolute;right:-160px;top:-120px;width:520px;height:520px;background:radial-gradient(circle,rgba(201,169,97,.16),transparent 65%);pointer-events:none}
.cover .mark{width:84px;height:84px;margin-bottom:34px}
.kicker{font-family:var(--mono);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
.cover h1{font-family:var(--serif);font-weight:400;font-size:68px;line-height:1.02;margin:16px 0 22px;letter-spacing:-.01em}
.cover h1 em{color:var(--gold);font-style:italic}
.cover p{font-size:18px;line-height:1.6;color:var(--muted);max-width:620px;margin:0}
.meta{display:flex;gap:28px;margin-top:36px;font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}.meta b{display:block;color:var(--ivory);font-weight:500;margin-top:6px;letter-spacing:.06em}
.sec{padding:64px 0 8px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:12px}
.eyebrow .num{color:var(--faint);border:1px solid var(--line);border-radius:999px;padding:3px 9px;letter-spacing:.1em}
h2{font-family:var(--serif);font-weight:400;font-size:44px;line-height:1.08;margin:14px 0 22px}
h3{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);font-weight:500;margin:30px 0 10px}
h4{font-family:var(--serif);font-weight:400;font-size:24px;margin:0 0 8px}
p,li{font-size:16px;line-height:1.7;color:var(--muted)}p{margin:0 0 16px}
strong{color:var(--ivory);font-weight:600}.gold{color:var(--gold-light);font-weight:600}
.lede{font-family:var(--serif);font-size:26px;line-height:1.35;color:var(--ivory)}
.cite{border-bottom:1px solid rgba(201,169,97,.35)}
.points{padding:0;margin:20px 0;list-style:none}.points li{position:relative;padding:14px 0 14px 28px;border-top:1px solid var(--line-soft)}.points li:last-child{border-bottom:1px solid var(--line-soft)}
.points li:before{content:'';position:absolute;left:4px;top:25px;width:8px;height:8px;border-radius:50%;background:var(--gold)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:26px 0}
.stat{background:var(--graphite);border:1px solid var(--line-soft);border-radius:18px;padding:20px}
.stat .n{font-family:var(--serif);font-size:44px;line-height:1;color:var(--gold-light)}.stat .l{font-size:14px;color:var(--ivory);margin-top:10px;line-height:1.4}.stat .s{font-size:12px;color:var(--faint);margin-top:6px}
.callout{background:var(--deep);border:1px solid var(--gold);border-radius:18px;padding:22px 24px;color:var(--ivory);font-size:17px}
.chart{margin:26px 0;background:var(--graphite);border:1px solid var(--line-soft);border-radius:18px;padding:22px 20px 16px}
.chart svg{width:100%;height:auto;display:block}
.ct{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ivory);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between}
.legend{color:var(--faint);letter-spacing:.08em;display:flex;align-items:center;gap:8px;text-transform:none;font-family:var(--sans);font-size:12px}
.legend .ld{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--gold)}.legend .lw{display:inline-block;width:3px;height:14px;background:#5A5850;margin-left:8px}
.src{font-size:12px;color:var(--faint);margin-top:10px}
.grid{stroke:#232326;stroke-width:1}.ax{fill:#8E8C86;font:12px Inter,sans-serif}.axb{fill:#F2F0EB;font:500 13px Inter,sans-serif}
.bar{fill:#3A3833}.bar-gold{fill:#C9A961}.val{fill:#B4B2AC;font:500 12px Inter,sans-serif}.val-gold{fill:#E4CC8E;font:600 13px Inter,sans-serif}
.whisk{stroke:#5A5850;stroke-width:3;stroke-linecap:round}.dot{fill:#C9A961;stroke:#0B0B0C;stroke-width:3}
table{width:100%;border-collapse:separate;border-spacing:0;margin:22px 0;background:var(--graphite);border:1px solid var(--line-soft);border-radius:18px;overflow:hidden}
th{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);text-align:left;padding:14px 18px;border-bottom:1px solid var(--line)}
td{font-size:14px;line-height:1.55;color:var(--muted);padding:14px 18px;border-bottom:1px solid var(--line-soft);vertical-align:top}tr:last-child td{border-bottom:0}
td:first-child{color:var(--ivory);width:55%}
.pillars{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}
.pillar{background:var(--graphite);border:1px solid var(--line-soft);border-radius:18px;padding:20px}.pillar p{font-size:14px;margin:0}.pillar.wide{grid-column:1/-1}
.tam{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 24px}.tam>div{background:var(--graphite);border:1px solid var(--line-soft);border-radius:18px;padding:20px}
.tam .big{font-family:var(--serif);font-size:42px;color:var(--gold-light);margin:8px 0}.tam p{font-size:14px;margin:0}
.label{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.fine{font-size:12px;color:var(--faint)}
.sources{padding-left:20px}.sources li{font-size:14px;line-height:1.6;margin-bottom:6px}
.disclaimer{margin-top:30px;padding-top:18px;border-top:1px solid var(--line-soft)}
.foot{margin-top:50px;padding-top:20px;border-top:1px solid var(--line-soft);display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}
.actions{display:flex;gap:10px}.btn{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:999px;background:var(--gold);color:#0B0B0C;font:600 14px Inter,sans-serif}.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ivory)}
@media (max-width:680px){.cover h1{font-size:46px}h2{font-size:34px}.stats,.pillars,.tam{grid-template-columns:1fr}.meta{flex-wrap:wrap;gap:18px}.topbar .conf{display:none}}
@page{size:letter;margin:0}
@media print{
 html,body{background:var(--onyx);-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .doc{max-width:none;padding:0 54px 40px}.actions{display:none}
 .cover{min-height:10in;display:flex;flex-direction:column;justify-content:center;padding:0;border:0;break-after:page}
 .sec{padding-top:44px}.sec.brk.pb{break-before:page}
 h2,.eyebrow,h3{break-after:avoid}.lede{break-after:avoid}
 .stats,.chart,.pillar,.callout,.tam,tr,.points li{break-inside:avoid}p{orphans:3;widows:3}
 .topbar{padding-top:34px}
}
"""

FONTS = [('Instrument Serif','normal',400,'instrument-serif-latin-400-normal'),('Instrument Serif','italic',400,'instrument-serif-latin-400-italic'),
 ('Inter','normal',400,'inter-latin-400-normal'),('Inter','normal',500,'inter-latin-500-normal'),('Inter','normal',600,'inter-latin-600-normal'),
 ('JetBrains Mono','normal',400,'jetbrains-mono-latin-400-normal'),('JetBrains Mono','normal',500,'jetbrains-mono-latin-500-normal')]
def font_faces():
    out=[]
    for fam, style, w, f in FONTS:
        b = base64.b64encode((OUT / 'fonts' / (f + '.woff2')).read_bytes()).decode()
        out.append(f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{w};src:url(data:font/woff2;base64,{b}) format('woff2')}}")
    return ''.join(out)

def page(for_print=False):
    actions = '' if for_print else '<div class="actions"><a class="btn ghost" href="/investors">Back to investor room</a><a class="btn" href="/investors/market-report?download=1">Download PDF</a></div>'
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Market Report · ScoreDate</title><style>{(font_faces() + CSS.replace(IMPORT, '')) if for_print else CSS}</style></head><body><div class="doc">
<div class="topbar"><div class="logo">{MARK}SCOREDATE</div>{actions if actions else '<div class="conf">Confidential · Investor report</div>'}</div>
<header class="cover"><div class="mark">{MARK}</div><div class="kicker">Investor report · November 2026</div>
<h1>The market for dating with <em>financial compatibility</em></h1>
<p>The state of dating apps, where the next five years of growth will come from, why money is where relationships break, and why credit is a trusted signal of responsibility.</p>
<div class="meta"><div>Prepared by<b>Eddie Meehan, Founder &amp; CEO</b></div><div>Company<b>ScoreDate, LLC</b></div><div>Market<b>New York City</b></div></div></header>
{''.join(S)}
<div class="foot"><span>ScoreDate, LLC · 1133 Broadway, Suite 1301, New York, NY 10010</span><span>Confidential</span></div>
</div></body></html>"""

web = page(False)
prn = page(True)
(OUT / 'market-report.html').write_text(web)
(OUT / 'market-report-print.html').write_text(prn)

# PDF via Playwright (pre-installed Chromium)
js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://{OUT}/market-report-print.html', {{ waitUntil: 'networkidle' }});
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({{ path: '{OUT}/market-report.pdf', format: 'Letter', printBackground: true, preferCSSPageSize: true }});
  await b.close();
}})();
"""
(ROOT / 'scripts/.pdf.js').write_text(js)
subprocess.run(['node', str(ROOT / 'scripts/.pdf.js')], check=True)
(ROOT / 'scripts/.pdf.js').unlink()
(OUT / 'market-report-print.html').unlink()

pdf = base64.b64encode((OUT / 'market-report.pdf').read_bytes()).decode()
ts = ("import 'server-only';\n// Generated by scripts/build-market-report.py — edit the script and re-run, don't edit by hand.\n"
      f"export const MARKET_REPORT_HTML = {json.dumps(web)};\nexport const MARKET_REPORT_PDF_B64 = '{pdf}';\n")
(ROOT / 'lib/marketReport.ts').write_text(ts)
print('ok', len(web), (OUT / 'market-report.pdf').stat().st_size)
