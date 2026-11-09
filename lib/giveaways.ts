export type Giveaway = {
  id: string; title: string; prize: string; prize_value_usd: number; winners_count: number; description: string | null; image_url: string | null;
  partner: string | null; area: string; eligibility: string; starts_at: string; ends_at: string; status: 'draft' | 'live' | 'closed' | 'drawn' | 'cancelled';
  extra_rules: string | null; created_at: string;
};

const TZ = 'America/New_York';
export const gwhen = (d: string) => new Date(d).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short' });
export const gday = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
export const isOpen = (g: Giveaway) => g.status === 'live' && Date.now() >= new Date(g.starts_at).getTime() && Date.now() <= new Date(g.ends_at).getTime();
export const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });

/** NY and FL require registration and a bond when total prizes are over $5,000. */
export const REGISTRATION_LIMIT = 5000;

const SPONSOR = 'ScoreDate, LLC, 1133 Broadway, Suite 1301, New York, NY 10010';

/** Official rules, generated from the giveaway's details. Draft language: have counsel review before the first giveaway. */
export function officialRules(g: Giveaway): { h: string; p: string[] }[] {
  const total = Number(g.prize_value_usd) * g.winners_count;
  return [
    { h: 'No purchase necessary', p: ['NO PURCHASE OR PAYMENT OF ANY KIND IS NECESSARY TO ENTER OR WIN. A purchase or subscription will not increase your chances of winning. Void where prohibited.'] },
    { h: 'Apple is not a sponsor', p: ['This giveaway is sponsored solely by ScoreDate, LLC. Apple Inc. is not a sponsor of, and is not involved in, this giveaway in any way.'] },
    { h: 'Sponsor', p: [SPONSOR + '.'] },
    { h: 'Who can enter', p: [`${g.eligibility} Employees of ScoreDate, LLC${g.partner ? ` and ${g.partner}` : ''}, and their immediate families and households, are not eligible.`] },
    { h: 'Dates', p: [`The giveaway starts ${gwhen(g.starts_at)} and ends ${gwhen(g.ends_at)}. Entries received outside these times will not count.`] },
    { h: 'How to enter', p: [
      `Free online entry: visit scoredate.app/giveaways/${g.id}, fill in your first name, email and ZIP code, confirm you are 25 or older, and submit. No account is needed.`,
      'Members can also enter with one tap in the ScoreDate app. Limit one entry form per person; additional forms are ignored.',
    ] },
    { h: 'Bonus entries (free)', p: ['Each entrant receives one entry. Entrants with a ScoreDate account receive one bonus entry for a complete, verified profile, and one bonus entry for each friend who joins ScoreDate with their invite during the giveaway (up to three). Bonus entries never depend on any purchase, subscription or payment.'] },
    { h: 'Prize', p: [`${g.winners_count} winner${g.winners_count === 1 ? '' : 's'} will each receive: ${g.prize}. Approximate retail value: ${usd(Number(g.prize_value_usd))} each (${usd(total)} total).${g.partner ? ` Prize provided in partnership with ${g.partner}.` : ''} Prizes are non-transferable and no cash or substitution is allowed, except that the Sponsor may substitute a prize of equal or greater value if the advertised prize is unavailable. Any event dates, travel and other costs not stated are the winner's responsibility.`] },
    { h: 'Winner selection and odds', p: [`Winners will be selected in a random drawing from all eligible entries within 7 days after the giveaway ends. Odds of winning depend on the number of eligible entries received.`] },
    { h: 'Notification', p: ['Winners will be notified by email (and in the app, if they have an account) and must respond within 7 days to claim the prize. If a winner does not respond, is ineligible, or does not comply with these rules, the prize may be forfeited and an alternate winner selected. Winners may be asked to confirm eligibility and identity.'] },
    { h: 'Taxes', p: ['Winners are responsible for all taxes. Winners of prizes valued at $600 or more will be asked for tax information and may receive an IRS Form 1099.'] },
    { h: 'Privacy', p: ['Information you submit is used to run this giveaway and contact winners, and as described in the ScoreDate Privacy Policy (scoredate.app/legal/privacy). Entering does not create a ScoreDate account or sign you up for marketing.'] },
    { h: 'General', p: [
      'By entering, you agree to these rules and the decisions of the Sponsor, which are final. The Sponsor may cancel or modify the giveaway if fraud, technical failure or any other factor impairs its integrity. To the extent allowed by law, entrants release the Sponsor and its partners from liability related to the giveaway or prize.',
      'For the winners list, email support@scoredate.app within 60 days after the giveaway ends.',
      ...(g.extra_rules ? [g.extra_rules] : []),
    ] },
  ];
}
