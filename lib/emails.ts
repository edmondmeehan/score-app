// ScoreDate email templates. Every template renders to { subject, html, text }.
// Styling is inline and table-based so it holds up in Gmail, Apple Mail and Outlook.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://score-app-eta-two.vercel.app').replace(/\/$/, '');
export const POSTAL_ADDRESS = 'ScoreDate, LLC · 1133 Broadway, #1301, New York, NY 10010';

const C = {
  bg: '#0B0B0C', card: '#131315', line: '#26262A', ivory: '#F2F0EB', stone: '#B4B2AC', muted: '#8E8C86',
  gold: '#C9A961', goldLight: '#E4CC8E', ink: '#0B0B0C',
};
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace";

export type Block =
  | { p: string }
  | { button: { label: string; url: string } }
  | { code: string; caption?: string }
  | { facts: [string, string][] }
  | { note: string };

export type Email = {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  blocks: Block[];
  /** notification emails get a "manage email settings" link; transactional ones don't */
  kind: 'transactional' | 'notification';
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function blockHtml(b: Block): string {
  if ('p' in b) return `<p style="margin:0 0 18px;font:400 16px/1.6 ${SANS};color:${C.stone};">${esc(b.p)}</p>`;
  if ('button' in b)
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 26px;"><tr><td bgcolor="${C.gold}" style="border-radius:999px;">
<a href="${esc(b.button.url)}" style="display:inline-block;padding:15px 30px;font:600 15px/1 ${SANS};color:${C.ink};text-decoration:none;border-radius:999px;">${esc(b.button.label)}</a></td></tr></table>`;
  if ('code' in b)
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td align="center" style="border:1px solid ${C.gold};border-radius:14px;padding:22px 12px;">
<div style="font:500 30px/1.2 ${MONO};letter-spacing:6px;color:${C.goldLight};">${esc(b.code)}</div>${b.caption ? `<div style="margin-top:8px;font:400 13px/1.4 ${SANS};color:${C.muted};">${esc(b.caption)}</div>` : ''}</td></tr></table>`;
  if ('facts' in b)
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${C.line};">${b.facts
      .map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.line};font:400 14px/1.4 ${SANS};color:${C.muted};">${esc(k)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid ${C.line};font:500 14px/1.4 ${SANS};color:${C.ivory};">${esc(v)}</td></tr>`)
      .join('')}</table>`;
  return `<p style="margin:0 0 18px;font:400 13px/1.6 ${SANS};color:${C.muted};">${esc(b.note)}</p>`;
}

function blockText(b: Block): string {
  if ('p' in b) return b.p;
  if ('button' in b) return `${b.button.label}: ${b.button.url}`;
  if ('code' in b) return `${b.code}${b.caption ? ` (${b.caption})` : ''}`;
  if ('facts' in b) return b.facts.map(([k, v]) => `${k}: ${v}`).join('\n');
  return b.note;
}

export type RenderOpts = { unsubUrl?: string };

export function render(e: Email, opts: RenderOpts = {}): { subject: string; html: string; text: string } {
  const footerLinks =
    e.kind === 'notification'
      ? `<a href="${SITE_URL}/app/settings#email" style="color:${C.muted};text-decoration:underline;">Manage email settings</a> · ${opts.unsubUrl ? `<a href="${esc(opts.unsubUrl)}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a> · ` : ''}`
      : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark">
<title>${esc(e.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark only;supported-color-schemes:dark}u+.body .gmail-bg{background:#0B0B0C!important}@media (max-width:620px){.wrap{padding:28px 22px!important}.h1{font-size:34px!important}}</style></head>
<body class="body" bgcolor="${C.bg}" style="margin:0;padding:0;background:${C.bg};background-color:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(e.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" class="gmail-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};background-color:${C.bg};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 6px 22px;"><a href="${SITE_URL}" style="text-decoration:none;"><img src="${SITE_URL}/email/logo.png" width="172" height="28" alt="SCOREDATE" style="display:block;border:0;color:${C.ivory};font:500 16px ${MONO};letter-spacing:6px;"></a></td></tr>
<tr><td class="wrap" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:40px 40px 22px;">
<div style="font:500 11px/1 ${MONO};letter-spacing:3px;text-transform:uppercase;color:${C.gold};margin:0 0 16px;">${esc(e.eyebrow)}</div>
<h1 class="h1" style="margin:0 0 22px;font:400 40px/1.08 ${SERIF};color:${C.ivory};">${esc(e.heading)}</h1>
${e.blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="padding:22px 8px 0;font:400 12px/1.6 ${SANS};color:${C.muted};">
${footerLinks}<a href="${SITE_URL}/legal/privacy" style="color:${C.muted};text-decoration:underline;">Privacy</a> · <a href="${SITE_URL}/legal/terms" style="color:${C.muted};text-decoration:underline;">Terms</a><br>
ScoreDate is invite-only dating for people who are honest about money. Exact credit scores are never stored or shown.<br>${esc(POSTAL_ADDRESS)}
</td></tr></table></td></tr></table></body></html>`;
  const text = [e.eyebrow.toUpperCase(), '', e.heading, '', ...e.blocks.map(blockText).flatMap((t) => [t, '']),
    '—', e.kind === 'notification' ? `Manage email settings: ${SITE_URL}/app/settings${opts.unsubUrl ? `\nUnsubscribe: ${opts.unsubUrl}` : ''}` : '', POSTAL_ADDRESS].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return { subject: e.subject, html, text };
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------
const hi = (name?: string | null) => (name ? `${name},` : 'Hi,');

export const templates = {
  waitlist_joined: (d: { first_name?: string | null; place: string; open: boolean; share_url?: string; position?: number | null; founder?: boolean; again?: boolean }) => {
    const share: Block[] = d.share_url
      ? [
          { p: d.founder ? 'You’re a Founding Member: a badge on your profile, first in line when invites go out, and extra invites to bring friends.' : 'Want in sooner? Every friend who joins with your link moves you up 5 spots, and 3 friends makes you a Founding Member.' },
          { button: { label: d.again ? 'See my spot' : 'Share my invite link', url: d.share_url } },
          { note: `Your link: ${d.share_url}` },
        ]
      : [];
    return {
      subject: d.again ? 'Your ScoreDate waitlist link' : "You're on the ScoreDate waitlist",
      preheader: d.again ? 'Check your spot and share your invite link.' : d.open ? `Invites go out in drops every two weeks. ${d.place} is on the list.` : `We'll email you as soon as ScoreDate opens in ${d.place}.`,
      eyebrow: `Waitlist · ${d.place}`,
      heading: d.again ? 'Here’s your link.' : "You're on the list.",
      kind: 'transactional',
      blocks: d.again
        ? [{ p: `${hi(d.first_name)} you (or someone using your email) tried to join again. You’re already on the list, and nothing changed.` }, ...share]
        : d.open
          ? [
              { p: `${hi(d.first_name)} thanks for signing up. ScoreDate sends invites in drops every two weeks, and we'll email you the moment yours is ready.` },
              ...share,
              { facts: [['Area', d.place], ...(d.position ? [['Your spot', `#${d.position.toLocaleString('en-US')}`] as [string, string]] : []), ['Age', '25 and older']] },
              { note: 'Verification uses a soft credit pull. It never affects your score, and only your band (never the number) is shown to members.' },
            ]
          : [
              { p: `${hi(d.first_name)} thanks for signing up. ScoreDate is opening in New York City first and expanding area by area. You're on the list for ${d.place}, and we'll email you as soon as invites go out there.` },
              ...share,
              { facts: [['Area', d.place], ['Status', 'Opening soon'], ['Age', '25 and older']] },
            ],
    } satisfies Email;
  },

  notify_area: (d: { first_name?: string | null; zip: string }) => ({
    subject: "We'll tell you when ScoreDate opens near you",
    preheader: 'ScoreDate is New York City only for now.',
    eyebrow: 'Coming to more cities',
    heading: 'Noted. We will be in touch.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} ScoreDate is opening in New York City first. We saved your zip code (${d.zip}) and will email you once, when we open near you.` },
      { p: "That's the only email you'll get from this list." },
    ],
  }) satisfies Email,

  invite: (d: { first_name?: string | null; code: string; days: number; inviter?: string | null }) => ({
    subject: d.inviter ? `${d.inviter} invited you to ScoreDate` : 'Your invite to ScoreDate is here',
    preheader: `Your code is good for ${d.days} days.`,
    eyebrow: d.inviter ? 'A member invited you' : 'Your drop is open',
    heading: "You're in.",
    kind: 'transactional',
    blocks: [
      { p: d.inviter ? `${hi(d.first_name)} ${d.inviter} thinks you belong on ScoreDate, the invite-only dating app where every member has verified their identity and their credit band.` : `${hi(d.first_name)} your spot in this New York drop is ready. Here is your personal invite code.` },
      { code: d.code, caption: `Good for ${d.days} days · one use` },
      { button: { label: 'Accept your invite', url: `${SITE_URL}/join?code=${encodeURIComponent(d.code)}` } },
      { p: 'Joining takes about ten minutes: the basics, a quick ID and selfie check, your credit band, a short money-values quiz and your photos.' },
    ],
  }) satisfies Email,

  magic_link: (d: { url: string }) => ({
    subject: 'Your ScoreDate sign-in link',
    preheader: 'This link works once and expires in one hour.',
    eyebrow: 'Sign in',
    heading: 'Tap to sign in.',
    kind: 'transactional',
    blocks: [
      { button: { label: 'Sign in to ScoreDate', url: d.url } },
      { p: 'This link works once and expires in one hour.' },
      { note: "Didn't ask for this? You can ignore this email. Nobody can sign in without the link." },
    ],
  }) satisfies Email,

  auth_confirm: (d: { url: string }) => ({
    subject: 'Confirm your email for ScoreDate',
    preheader: 'One tap to confirm it’s you.',
    eyebrow: 'Confirm your email',
    heading: 'Confirm it’s you.',
    kind: 'transactional',
    blocks: [
      { p: 'Tap below to confirm your email and finish signing in. This link works once and expires in one hour.' },
      { button: { label: 'Confirm and sign in', url: d.url } },
      { note: "Didn't try to join ScoreDate? You can ignore this email. Nothing happens without the link." },
    ],
  }) satisfies Email,

  auth_invite: (d: { url: string }) => ({
    subject: 'You’re invited to ScoreDate',
    preheader: 'Your invite is ready. Tap to accept.',
    eyebrow: 'Invitation',
    heading: 'Someone thinks you have your act together.',
    kind: 'transactional',
    blocks: [
      { p: 'You’ve been invited to ScoreDate, the invite-only dating app where every member has verified their identity and credit band.' },
      { button: { label: 'Accept your invite', url: d.url } },
      { note: 'This link works once. If it expires, reply and we’ll send a new one.' },
    ],
  }) satisfies Email,

  auth_email_change: (d: { url: string; new_email: string }) => ({
    subject: 'Confirm your new email for ScoreDate',
    preheader: 'Confirm the change to keep signing in.',
    eyebrow: 'Email change',
    heading: 'Confirm your new email.',
    kind: 'transactional',
    blocks: [
      { p: `You asked to change your ScoreDate sign-in email to ${d.new_email}. Tap below to confirm.` },
      { button: { label: 'Confirm new email', url: d.url } },
      { note: "Didn't ask for this? Don't tap the link, and reply to let us know. Your email stays the same." },
    ],
  }) satisfies Email,

  auth_reset: (d: { url: string }) => ({
    subject: 'Reset your ScoreDate password',
    preheader: 'This link works once and expires in one hour.',
    eyebrow: 'Account recovery',
    heading: 'Reset your password.',
    kind: 'transactional',
    blocks: [
      { p: 'We got a request to reset your ScoreDate password. Tap below to choose a new one. This link works once and expires in one hour.' },
      { button: { label: 'Choose a new password', url: d.url } },
      { note: "Didn't ask for this? You can ignore this email. Your account is unchanged." },
    ],
  }) satisfies Email,

  auth_reauth: (d: { code: string }) => ({
    subject: 'Your ScoreDate security code',
    preheader: 'Use this code to confirm a sensitive change.',
    eyebrow: 'Security check',
    heading: 'Confirm it’s you.',
    kind: 'transactional',
    blocks: [
      { p: 'Enter this code in ScoreDate to confirm the change you’re making.' },
      { code: d.code, caption: 'Expires in 10 minutes' },
      { note: "Didn't ask for this? Someone may have your device. Sign out everywhere from Settings and reply to us." },
    ],
  }) satisfies Email,

  welcome_member: (d: { first_name?: string | null; plan: string; drop_size: number }) => ({
    subject: 'Welcome to ScoreDate',
    preheader: `Your first Daily Drop of ${d.drop_size} arrives tomorrow at noon.`,
    eyebrow: `Member · ${d.plan}`,
    heading: 'Welcome in.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} you're verified and your profile is live. Every day at noon you'll get your Daily Drop: ${d.drop_size} people picked for shared money values and compatible bands.` },
      { facts: [['Plan', d.plan], ['Daily Drop', `${d.drop_size} a day at noon`], ['Status', 'Active']] },
      { button: { label: "See today's Drop", url: `${SITE_URL}/app` } },
      { p: 'Two house rules: be honest, and be kind. You can pause or mark yourself Taken any time from settings, and your profile hides right away.' },
    ],
  }) satisfies Email,

  id_approved: (d: { first_name?: string | null }) => ({
    subject: "You're verified",
    preheader: 'ID and selfie check complete. Next: your credit band.',
    eyebrow: 'Verification',
    heading: 'Identity confirmed.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} your ID and selfie check went through. Your ID images stay with our verification partner. ScoreDate never stores them.` },
      { button: { label: 'Continue setting up', url: `${SITE_URL}/onboarding` } },
    ],
  }) satisfies Email,

  id_needs_attention: (d: { first_name?: string | null }) => ({
    subject: 'One more try on your ID check',
    preheader: 'It usually comes down to lighting or glare. Takes two minutes.',
    eyebrow: 'Verification',
    heading: "Let's try that again.",
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} we couldn't finish your ID check. That almost always comes down to glare on the ID, a blurry photo or low light.` },
      { p: 'Find bright, even light, put your ID on a dark surface, and hold still for the selfie.' },
      { button: { label: 'Retry verification', url: `${SITE_URL}/onboarding/identity` } },
      { note: 'Still stuck? Reply to this email and a real person will help.' },
    ],
  }) satisfies Email,

  verification_feedback: (d: { first_name?: string | null; kind: 'id' | 'photos'; message: string }) => ({
    subject: d.kind === 'id' ? 'One more step on your ID check' : 'A quick note about your photos',
    preheader: d.kind === 'id' ? 'A note from our verification team.' : 'A note from our photo review team.',
    eyebrow: 'Verification',
    heading: d.kind === 'id' ? "Let's finish verifying you." : 'One quick fix on your photos.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} a person on our team reviewed your ${d.kind === 'id' ? 'ID check' : 'photos'}.` },
      { p: d.message },
      { button: d.kind === 'id' ? { label: 'Retry verification', url: `${SITE_URL}/onboarding/identity` } : { label: 'Update photos', url: `${SITE_URL}/onboarding/photos` } },
      { note: 'Questions? Reply to this email and a real person will help.' },
    ],
  }) satisfies Email,
  photos_review: (d: { first_name?: string | null; approved: boolean }) => ({
    subject: d.approved ? 'Your photos are approved' : 'A quick note about your photos',
    preheader: d.approved ? 'Your profile photos are live.' : 'One photo needs a swap before it goes live.',
    eyebrow: 'Photo check',
    heading: d.approved ? 'Looking good.' : 'One photo needs a swap.',
    kind: 'transactional',
    blocks: d.approved
      ? [{ p: `${hi(d.first_name)} our team reviewed your photos and they're live on your profile.` }, { button: { label: 'View your profile', url: `${SITE_URL}/app/settings` } }]
      : [
          { p: `${hi(d.first_name)} every photo on ScoreDate has to clearly show you, so members know who they're meeting. One of yours didn't pass: often it's a group shot, sunglasses or a heavy filter.` },
          { button: { label: 'Update photos', url: `${SITE_URL}/onboarding/photos` } },
        ],
  }) satisfies Email,

  daily_drop: (d: { first_name?: string | null; count: number; top_match?: string | null }) => ({
    subject: `Your Daily Drop: ${d.count} new ${d.count === 1 ? 'person' : 'people'}`,
    preheader: d.top_match ? `Including ${d.top_match}.` : 'Picked for you tonight.',
    eyebrow: "Tonight's Drop",
    heading: `${d.count} people, picked for you.`,
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} tonight's Drop is ready${d.top_match ? `, led by ${d.top_match}` : ''}. Everyone in it is ID-verified and picked for your money values and preferences.` },
      { button: { label: 'Open the Drop', url: `${SITE_URL}/app` } },
      { note: 'A new Drop arrives every day around noon.' },
    ],
  }) satisfies Email,

  new_message: (d: { first_name?: string | null; from_name: string; conversation_id: string; count?: number }) => ({
    subject: (d.count || 1) > 1 ? `You have ${d.count} new messages on ScoreDate` : `${d.from_name} sent you a message`,
    preheader: 'Open ScoreDate to read and reply.',
    eyebrow: 'New message',
    heading: (d.count || 1) > 1 ? `${d.count} new messages.` : `${d.from_name} sent you a message.`,
    kind: 'notification',
    blocks: [
      { p: (d.count || 1) > 1 ? `${hi(d.first_name)} you have ${d.count} unread messages, the latest from ${d.from_name}. For privacy, we don't put message text in email.` : `${hi(d.first_name)} you have a new message on ScoreDate. For privacy, we don't put message text in email.` },
      { button: { label: 'Read and reply', url: `${SITE_URL}/app/messages/${d.conversation_id}` } },
      { note: 'We send at most one of these every few hours.' },
    ],
  }) satisfies Email,

  date_confirmed: (d: { first_name?: string | null; other_name: string; place: string; address?: string | null; when: string; conversation_id: string }) => ({
    subject: `It’s a date: ${d.other_name}, ${d.when}`,
    preheader: `${d.place}${d.address ? `, ${d.address}` : ''}. The calendar invite is attached.`,
    eyebrow: 'Date confirmed',
    heading: `You and ${d.other_name} have a date.`,
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} it’s on: ${d.place}${d.address ? `, ${d.address}` : ''}, ${d.when}.` },
      { p: 'We attached a calendar invite. Open it to add the date to Apple Calendar, Google Calendar or Outlook, with a reminder two hours before.' },
      { button: { label: 'Open the chat', url: `${SITE_URL}/app/messages/${d.conversation_id}` } },
      { note: 'Meet in public, tell a friend where you’ll be (Share my plan in the chat does this), and get yourself home. In an emergency, call 911.' },
    ],
  }) satisfies Email,

  event_announce: (d: { first_name?: string | null; title: string; when: string; venue: string; event_id: string; black_only?: boolean }) => ({
    subject: d.black_only ? `Reserve members first: ${d.title}` : `New ScoreDate event: ${d.title}`,
    preheader: `${d.when} · ${d.venue}`,
    eyebrow: d.black_only ? 'Reserve · first access' : 'Member event',
    heading: d.title,
    kind: 'notification',
    blocks: [
      { facts: [['When', d.when], ['Where', d.venue]] },
      { p: d.black_only ? `${hi(d.first_name)} you get first access before RSVPs open to all members. Spots are limited.` : `${hi(d.first_name)} a new member event is open for RSVPs. Spots are limited and go to whoever RSVPs first.` },
      { button: { label: 'See details and RSVP', url: `${SITE_URL}/app/events/${d.event_id}` } },
    ],
  }) satisfies Email,

  preview_ending: (d: { first_name?: string | null; days_left: number }) => ({
    subject: `Your ScoreDate Preview ends in ${d.days_left} ${d.days_left === 1 ? 'day' : 'days'}`,
    preheader: 'Keep your matches by choosing a membership.',
    eyebrow: 'Preview',
    heading: `${d.days_left} ${d.days_left === 1 ? 'day' : 'days'} left in your Preview.`,
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} your Preview ends soon. Become a member to keep your Daily Drop and start conversations, or choose Paused to keep your verified account for later.` },
      { button: { label: 'See membership options', url: `${SITE_URL}/plans` } },
      { note: 'No charge happens automatically when a Preview ends.' },
    ],
  }) satisfies Email,

  plan_ended: (d: { first_name?: string | null }) => ({
    subject: 'Your ScoreDate membership has ended',
    preheader: 'Your profile is hidden. Your verification is kept for 6 months.',
    eyebrow: 'Membership',
    heading: 'Your membership has ended.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} your membership ended, so your profile is now hidden from the Daily Drop. Your conversations and verification are saved for six months, so rejoining is one tap and you won't need a new invite.` },
      { button: { label: 'Rejoin ScoreDate', url: `${SITE_URL}/plans` } },
      { p: "Just need a break? Paused keeps your account and friends for a small monthly fee, with your profile hidden." },
    ],
  }) satisfies Email,

  status_changed: (d: { first_name?: string | null; status: 'paused' | 'taken' | 'active' }) => ({
    subject: d.status === 'taken' ? 'Congratulations from ScoreDate' : d.status === 'paused' ? 'Your ScoreDate profile is paused' : 'Welcome back to ScoreDate',
    preheader: d.status === 'active' ? 'Your profile is visible again.' : 'Your profile is hidden from the Daily Drop.',
    eyebrow: 'Account status',
    heading: d.status === 'taken' ? 'Taken. We love that.' : d.status === 'paused' ? 'Paused.' : 'Welcome back.',
    kind: 'transactional',
    blocks: [
      { p: d.status === 'active' ? `${hi(d.first_name)} your profile is visible again and your next Daily Drop arrives at noon.` : `${hi(d.first_name)} your profile is hidden from new people. Existing conversations stay open, and you can switch back any time in settings.` },
      { button: { label: 'Account settings', url: `${SITE_URL}/app/settings` } },
    ],
  }) satisfies Email,

  reverify_reminder: (d: { first_name?: string | null; due: string }) => ({
    subject: 'Time to refresh your credit band',
    preheader: 'Bands are re-checked every 6 months. Soft pull, about a minute.',
    eyebrow: 'Re-verification',
    heading: 'Keep your band current.',
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} ScoreDate re-checks every member's band every six months so the community stays honest. Yours is due ${d.due}.` },
      { button: { label: 'Refresh my band', url: `${SITE_URL}/onboarding/credit` } },
      { note: 'Soft pull only. It never affects your credit score.' },
    ],
  }) satisfies Email,

  report_received: (d: { first_name?: string | null }) => ({
    subject: 'We got your report',
    preheader: 'Our team reviews every report, usually within 24 hours.',
    eyebrow: 'Safety',
    heading: 'Thank you for telling us.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} our team reviews every report, usually within 24 hours. The person you reported won't know it was you, and they can no longer see or message you.` },
      { note: 'If you are in danger, call 911.' },
    ],
  }) satisfies Email,

  error_alert: (d: { count: number; rows: [string, string][] }) => ({
    subject: `ScoreDate: ${d.count} server error${d.count === 1 ? '' : 's'} in the last hour`,
    preheader: d.rows.map(([k]) => k).slice(0, 2).join(' · '),
    eyebrow: 'Admin · Site health',
    heading: 'Something is failing.',
    kind: 'transactional',
    blocks: [
      { p: 'These pages returned server errors since the last alert. Members may be seeing an error screen.' },
      { facts: d.rows },
      { button: { label: 'Open Site health', url: `${SITE_URL}/admin/health` } },
      { note: 'You get at most one of these an hour. Sent to ScoreDate owners.' },
    ],
  }) satisfies Email,

  report_update: (d: { first_name?: string | null; acted: boolean }) => ({
    subject: 'We reviewed your report',
    preheader: d.acted ? 'We took action under our community guidelines.' : 'Thanks for helping keep ScoreDate safe.',
    eyebrow: 'Safety',
    heading: 'Thanks for telling us.',
    kind: 'transactional',
    blocks: [
      { p: d.acted ? `${hi(d.first_name)} we reviewed your report and took action under our community guidelines. For everyone’s privacy, we can’t share the details.` : `${hi(d.first_name)} we reviewed your report carefully. We didn’t find a rules violation this time, but we’ll keep an eye out.` },
      { p: 'If you ever feel unsafe, you can block or unmatch at any time. In an emergency, call 911.' },
      { button: { label: 'Open ScoreDate', url: `${SITE_URL}/app` } },
    ],
  }) satisfies Email,

  staff_welcome: (d: { name?: string | null; added_by?: string | null; url: string; has_account: boolean }) => ({
    subject: 'You’re now a ScoreDate admin',
    preheader: 'You have full access to the ScoreDate admin.',
    eyebrow: 'Team',
    heading: 'Welcome to the ScoreDate team.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.name)} ${d.added_by ? `${d.added_by} added you` : 'You’ve been added'} as an admin on ScoreDate, with full access to the admin: members, verification, safety, content, billing and settings.` },
      { p: d.has_account ? 'Sign in with this email address and you’ll go straight to the admin.' : 'Create your account with this email address (it has to match), and you’ll go straight to the admin.' },
      { button: { label: d.has_account ? 'Open the admin' : 'Create my account', url: d.url } },
      { p: 'Admin access includes members’ private information. Please keep it confidential and use it only to run ScoreDate. If you weren’t expecting this, reply and let us know.' },
    ],
  }) satisfies Email,

  admin_daily: (d: { date: string; headline: string; blocks: Block[] }) => ({
    subject: `ScoreDate daily report · ${d.date}`,
    preheader: d.headline,
    eyebrow: `Admin · ${d.date}`,
    heading: 'Your daily report.',
    kind: 'transactional',
    blocks: [
      { p: `Here’s the last 24 hours on ScoreDate: ${d.headline}. Test accounts are left out.` },
      ...d.blocks,
      { button: { label: 'Open admin', url: `${SITE_URL}/admin` } },
      { note: 'You get this because you turned on the daily report. Change sections or turn it off in Admin → Daily report.' },
    ],
  }) satisfies Email,

  notification: (d: { first_name?: string | null; title: string; body: string; url: string; category: string }) => ({
    subject: d.title,
    preheader: d.body,
    eyebrow: d.category === 'milestone' ? 'Milestone' : d.category === 'reminder' ? 'Reminder' : 'ScoreDate',
    heading: d.title,
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} ${d.body}` },
      { button: { label: 'Open ScoreDate', url: d.url } },
    ],
  }) satisfies Email,

  deletion_confirm: (d: { first_name?: string | null }) => ({
    subject: 'Your ScoreDate account is being deleted',
    preheader: 'Your profile is gone now. Everything else is erased within 30 days.',
    eyebrow: 'Account',
    heading: 'Your account is being deleted.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} as you asked, your profile has been removed from ScoreDate. Your photos, messages and verification results will be permanently erased within 30 days.` },
      { p: 'If you subscribed through the App Store or Google Play, cancel there too so you are not charged again.' },
      { note: "Didn't request this? Reply right away and we'll stop it." },
    ],
  }) satisfies Email,
} as const;

export type TemplateName = keyof typeof templates;

/** Sample data for the admin preview page. */
export const SAMPLES: { [K in TemplateName]: Parameters<(typeof templates)[K]>[0] } = {
  waitlist_joined: { first_name: 'Nadia', place: 'Williamsburg & Greenpoint', open: true, share_url: `${SITE_URL}/w/KH2KVJ`, position: 214, founder: true },
  notify_area: { first_name: 'Nadia', zip: '07030' },
  invite: { first_name: 'Nadia', code: 'SCR-7KQ2-M9', days: 14, inviter: null },
  date_confirmed: { first_name: 'Nadia', other_name: 'Owen', place: 'Bar Pisellino', address: '52 Grove St, New York, NY 10014', when: 'Thu, Nov 12, 7:30 PM', conversation_id: '00000000-0000-0000-0000-000000000000' },
  magic_link: { url: `${SITE_URL}/auth/callback?code=example` },
  auth_confirm: { url: `${SITE_URL}/auth/callback?code=example` },
  auth_invite: { url: `${SITE_URL}/auth/callback?code=example` },
  auth_email_change: { url: `${SITE_URL}/auth/callback?code=example`, new_email: 'nadia@example.com' },
  auth_reset: { url: `${SITE_URL}/auth/callback?code=example` },
  auth_reauth: { code: '482913' },
  welcome_member: { first_name: 'Nadia', plan: 'Membership', drop_size: 5 },
  id_approved: { first_name: 'Nadia' },
  id_needs_attention: { first_name: 'Nadia' },
  photos_review: { first_name: 'Nadia', approved: false },
  verification_feedback: { first_name: 'Nadia', kind: 'photos', message: 'Your second photo is a group shot, so we can’t tell which person is you. Swap it for a photo of just you and you’re all set.' },
  daily_drop: { first_name: 'Nadia', count: 5, top_match: 'Owen, 33' },
  new_message: { first_name: 'Nadia', from_name: 'Owen', conversation_id: 'example', count: 1 },
  event_announce: { first_name: 'Nadia', title: 'Rooftop supper club', when: 'Thursday, Dec 4 at 7:30 pm', venue: 'Westlight, Williamsburg', event_id: 'example', black_only: false },
  preview_ending: { first_name: 'Nadia', days_left: 3 },
  plan_ended: { first_name: 'Nadia' },
  status_changed: { first_name: 'Nadia', status: 'paused' },
  reverify_reminder: { first_name: 'Nadia', due: 'December 1' },
  report_received: { first_name: 'Nadia' },
  deletion_confirm: { first_name: 'Nadia' },
  error_alert: { count: 4, rows: [['GET /api/cron', '4 errors · relation "x" does not exist']] },
  report_update: { first_name: 'Nadia', acted: true },
  staff_welcome: { name: 'Jordan', added_by: 'Eddie', url: `${SITE_URL}/signin?mode=signup&next=/admin`, has_account: false },
  admin_daily: { date: 'Sun, Nov 8', headline: '$149.97 revenue · 12 sign-ups · 48 waitlist joins', blocks: [{ p: 'Finance' }, { facts: [['Revenue, last 24 hours', '$149.97'], ['New subscriptions', '3'], ['Estimated MRR', '$2,874.00']] }, { p: 'Waitlist' }, { facts: [['New joins', '48 (7-day avg 31.4)'], ['Total waitlist', '612']] }] },
  notification: { first_name: 'Nadia', title: 'Owen suggested a date', body: 'Via Carota · Sat Dec 6 at 7:30 pm', url: `${SITE_URL}/app/messages`, category: 'interaction' },
};

export const TEMPLATE_INFO: Record<TemplateName, { label: string; when: string; live: boolean }> = {
  waitlist_joined: { label: 'Waitlist confirmation', when: 'Someone joins the waitlist (open area or opening soon wording by zip)', live: true },
  notify_area: { label: 'Notify me (legacy)', when: 'Not used now: everyone goes on the waitlist', live: false },
  invite: { label: 'Invite', when: 'Staff emails an invite from the waitlist', live: true },
  date_confirmed: { label: 'Date confirmed + calendar invite', when: 'Both people, when a date is confirmed (with a .ics calendar file attached)', live: true },
  magic_link: { label: 'Sign-in link', when: 'Supabase · Magic Link template', live: false },
  auth_confirm: { label: 'Confirm email (first sign-in)', when: 'Supabase · Confirm signup template', live: false },
  auth_invite: { label: 'Staff invite', when: 'Supabase · Invite user template', live: false },
  auth_email_change: { label: 'Change email', when: 'Supabase · Change Email Address template', live: false },
  auth_reset: { label: 'Account recovery', when: 'Supabase · Reset Password template', live: false },
  auth_reauth: { label: 'Security code', when: 'Supabase · Reauthentication template', live: false },
  welcome_member: { label: 'Welcome to ScoreDate', when: 'A member picks a paid plan', live: true },
  id_approved: { label: 'ID approved', when: 'Persona approves the ID and selfie check', live: true },
  id_needs_attention: { label: 'ID retry', when: 'Persona declines the ID check', live: true },
  photos_review: { label: 'Photo review result', when: 'Staff approves or rejects photos in review', live: true },
  verification_feedback: { label: 'Verification feedback', when: 'Staff asks a member to redo their ID or photos, with a written note', live: true },
  daily_drop: { label: 'Daily Drop', when: 'Nightly at 7pm ET, 8pm in summer (automatic)', live: true },
  new_message: { label: 'New message', when: 'Unread for 10+ min, at most every 3 hours (automatic)', live: true },
  event_announce: { label: 'Event announcement', when: 'Staff announces an event (Reserve first during priority window)', live: true },
  preview_ending: { label: 'Preview ending', when: '3 days before a Preview ends (automatic)', live: true },
  plan_ended: { label: 'Membership ended', when: 'RevenueCat reports the plan expired or was refunded', live: true },
  status_changed: { label: 'Paused / Taken / Back', when: 'A member changes status in settings', live: true },
  reverify_reminder: { label: 'Re-verify band', when: '2 weeks before the 6-month re-check (automatic)', live: true },
  report_received: { label: 'Report received', when: 'A member reports someone', live: true },
  deletion_confirm: { label: 'Account deletion', when: 'A member deletes their account', live: true },
  error_alert: { label: 'Error alert (staff)', when: 'Server errors since the last alert, at most hourly, to owners', live: true },
  report_update: { label: 'Report follow-up', when: 'Staff resolves a report the member filed', live: true },
  staff_welcome: { label: 'Admin welcome', when: 'An owner adds a new admin in Admin → Admins', live: true },
  admin_daily: { label: 'Admin daily report', when: 'Every morning to staff who turned it on in Admin → Daily report', live: true },
  notification: { label: 'Activity alert', when: 'Date plans, Notes, event and date reminders, weekly catch-up (automatic, respects settings)', live: true },
};

export function build<K extends TemplateName>(name: K, data: Parameters<(typeof templates)[K]>[0], opts: RenderOpts = {}) {
  return render((templates[name] as (d: typeof data) => Email)(data), opts);
}

/** Supabase Auth email templates: what to paste where. */
export const SUPABASE_TEMPLATES: Partial<Record<TemplateName, { slot: string; data: Record<string, string> }>> = {
  // Links use the token-hash flow (/auth/confirm) so they work on any device or browser.
  auth_confirm: { slot: 'Confirm signup', data: { url: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup' } },
  magic_link: { slot: 'Magic Link', data: { url: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink' } },
  auth_invite: { slot: 'Invite user', data: { url: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite' } },
  auth_email_change: { slot: 'Change Email Address', data: { url: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change', new_email: '{{ .NewEmail }}' } },
  auth_reset: { slot: 'Reset Password', data: { url: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery' } },
  auth_reauth: { slot: 'Reauthentication', data: { code: '{{ .Token }}' } },
};
