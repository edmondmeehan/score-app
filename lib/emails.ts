// Score email templates. Every template renders to { subject, html, text }.
// Styling is inline and table-based so it holds up in Gmail, Apple Mail and Outlook.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://score-app-eta-two.vercel.app').replace(/\/$/, '');
export const POSTAL_ADDRESS = 'Please & Thank You, Inc. · 1133 Broadway, #1301, New York, NY 10010';

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

export function render(e: Email): { subject: string; html: string; text: string } {
  const footerLinks =
    e.kind === 'notification'
      ? `<a href="${SITE_URL}/app/settings" style="color:${C.muted};text-decoration:underline;">Manage email settings</a> · `
      : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(e.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{padding:28px 22px!important}.h1{font-size:34px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(e.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 6px 22px;"><a href="${SITE_URL}" style="text-decoration:none;"><img src="${SITE_URL}/email/logo.png" width="132" height="28" alt="SCORE" style="display:block;border:0;color:${C.ivory};font:500 16px ${MONO};letter-spacing:6px;"></a></td></tr>
<tr><td class="wrap" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:40px 40px 22px;">
<div style="font:500 11px/1 ${MONO};letter-spacing:3px;text-transform:uppercase;color:${C.gold};margin:0 0 16px;">${esc(e.eyebrow)}</div>
<h1 class="h1" style="margin:0 0 22px;font:400 40px/1.08 ${SERIF};color:${C.ivory};">${esc(e.heading)}</h1>
${e.blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="padding:22px 8px 0;font:400 12px/1.6 ${SANS};color:${C.muted};">
${footerLinks}<a href="${SITE_URL}/legal/privacy" style="color:${C.muted};text-decoration:underline;">Privacy</a> · <a href="${SITE_URL}/legal/terms" style="color:${C.muted};text-decoration:underline;">Terms</a><br>
Score is invite-only dating for people who are honest about money. Exact credit scores are never stored or shown.<br>${esc(POSTAL_ADDRESS)}
</td></tr></table></td></tr></table></body></html>`;
  const text = [e.eyebrow.toUpperCase(), '', e.heading, '', ...e.blocks.map(blockText).flatMap((t) => [t, '']),
    '—', e.kind === 'notification' ? `Manage email settings: ${SITE_URL}/app/settings` : '', POSTAL_ADDRESS].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return { subject: e.subject, html, text };
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------
const hi = (name?: string | null) => (name ? `${name},` : 'Hi,');

export const templates = {
  waitlist_joined: (d: { first_name?: string | null; place: string; open: boolean }) => ({
    subject: "You're on the Score waitlist",
    preheader: d.open ? `Invites go out in drops every two weeks. ${d.place} is on the list.` : `We'll email you as soon as Score opens in ${d.place}.`,
    eyebrow: `Waitlist · ${d.place}`,
    heading: "You're on the list.",
    kind: 'transactional',
    blocks: d.open
      ? [
          { p: `${hi(d.first_name)} thanks for signing up. Score sends invites in drops every two weeks, and we'll email you the moment yours is ready.` },
          { p: 'Invites go out in balanced groups, and people with friends already inside move up the line. Nothing to do right now.' },
          { facts: [['Area', d.place], ['Drops', 'Every two weeks'], ['Age', '25 and older']] },
          { note: 'Verification uses a soft credit pull. It never affects your score, and only your band (never the number) is shown to members.' },
        ]
      : [
          { p: `${hi(d.first_name)} thanks for signing up. Score is opening in New York City first and expanding area by area. You're on the list for ${d.place}, and we'll email you as soon as invites go out there.` },
          { p: 'Know someone already on Score? An invite from a member gets you in sooner.' },
          { facts: [['Area', d.place], ['Status', 'Opening soon'], ['Age', '25 and older']] },
        ],
  }) satisfies Email,

  notify_area: (d: { first_name?: string | null; zip: string }) => ({
    subject: "We'll tell you when Score opens near you",
    preheader: 'Score is New York City only for now.',
    eyebrow: 'Coming to more cities',
    heading: 'Noted. We will be in touch.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} Score is opening in New York City first. We saved your zip code (${d.zip}) and will email you once, when we open near you.` },
      { p: "That's the only email you'll get from this list." },
    ],
  }) satisfies Email,

  invite: (d: { first_name?: string | null; code: string; days: number; inviter?: string | null }) => ({
    subject: d.inviter ? `${d.inviter} invited you to Score` : 'Your invite to Score is here',
    preheader: `Your code is good for ${d.days} days.`,
    eyebrow: d.inviter ? 'A member invited you' : 'Your drop is open',
    heading: "You're in.",
    kind: 'transactional',
    blocks: [
      { p: d.inviter ? `${hi(d.first_name)} ${d.inviter} thinks you belong on Score, the invite-only dating app where every member has verified their identity and their credit band.` : `${hi(d.first_name)} your spot in this New York drop is ready. Here is your personal invite code.` },
      { code: d.code, caption: `Good for ${d.days} days · one use` },
      { button: { label: 'Accept your invite', url: `${SITE_URL}/join?code=${encodeURIComponent(d.code)}` } },
      { p: 'Joining takes about ten minutes: the basics, a quick ID and selfie check, your credit band (soft pull, never affects your score), a short money-values quiz and your photos.' },
    ],
  }) satisfies Email,

  magic_link: (d: { url: string }) => ({
    subject: 'Your Score sign-in link',
    preheader: 'This link works once and expires in one hour.',
    eyebrow: 'Sign in',
    heading: 'Tap to sign in.',
    kind: 'transactional',
    blocks: [
      { button: { label: 'Sign in to Score', url: d.url } },
      { p: 'This link works once and expires in one hour.' },
      { note: "Didn't ask for this? You can ignore this email. Nobody can sign in without the link." },
    ],
  }) satisfies Email,

  auth_confirm: (d: { url: string }) => ({
    subject: 'Confirm your email for Score',
    preheader: 'One tap to confirm it’s you.',
    eyebrow: 'Confirm your email',
    heading: 'Confirm it’s you.',
    kind: 'transactional',
    blocks: [
      { p: 'Tap below to confirm your email and finish signing in. This link works once and expires in one hour.' },
      { button: { label: 'Confirm and sign in', url: d.url } },
      { note: "Didn't try to join Score? You can ignore this email. Nothing happens without the link." },
    ],
  }) satisfies Email,

  auth_invite: (d: { url: string }) => ({
    subject: 'You’re invited to Score',
    preheader: 'Your invite is ready. Tap to accept.',
    eyebrow: 'Invitation',
    heading: 'Someone thinks you have your act together.',
    kind: 'transactional',
    blocks: [
      { p: 'You’ve been invited to Score, the invite-only dating app where every member has verified their identity and credit band.' },
      { button: { label: 'Accept your invite', url: d.url } },
      { note: 'This link works once. If it expires, reply and we’ll send a new one.' },
    ],
  }) satisfies Email,

  auth_email_change: (d: { url: string; new_email: string }) => ({
    subject: 'Confirm your new email for Score',
    preheader: 'Confirm the change to keep signing in.',
    eyebrow: 'Email change',
    heading: 'Confirm your new email.',
    kind: 'transactional',
    blocks: [
      { p: `You asked to change your Score sign-in email to ${d.new_email}. Tap below to confirm.` },
      { button: { label: 'Confirm new email', url: d.url } },
      { note: "Didn't ask for this? Don't tap the link, and reply to let us know. Your email stays the same." },
    ],
  }) satisfies Email,

  auth_reset: (d: { url: string }) => ({
    subject: 'Reset your Score sign-in',
    preheader: 'This link works once and expires in one hour.',
    eyebrow: 'Account recovery',
    heading: 'Get back in.',
    kind: 'transactional',
    blocks: [
      { p: 'We got a request to recover your Score account. Tap below to sign in and update your details.' },
      { button: { label: 'Recover my account', url: d.url } },
      { note: "Didn't ask for this? You can ignore this email. Your account is unchanged." },
    ],
  }) satisfies Email,

  auth_reauth: (d: { code: string }) => ({
    subject: 'Your Score security code',
    preheader: 'Use this code to confirm a sensitive change.',
    eyebrow: 'Security check',
    heading: 'Confirm it’s you.',
    kind: 'transactional',
    blocks: [
      { p: 'Enter this code in Score to confirm the change you’re making.' },
      { code: d.code, caption: 'Expires in 10 minutes' },
      { note: "Didn't ask for this? Someone may have your device. Sign out everywhere from Settings and reply to us." },
    ],
  }) satisfies Email,

  welcome_member: (d: { first_name?: string | null; plan: string; drop_size: number }) => ({
    subject: 'Welcome to Score',
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
      { p: `${hi(d.first_name)} your ID and selfie check went through. Your ID images stay with our verification partner. Score never stores them.` },
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

  photos_review: (d: { first_name?: string | null; approved: boolean }) => ({
    subject: d.approved ? 'Your photos are approved' : 'A quick note about your photos',
    preheader: d.approved ? 'Your profile photos are live.' : 'One photo needs a swap before it goes live.',
    eyebrow: 'Photo check',
    heading: d.approved ? 'Looking good.' : 'One photo needs a swap.',
    kind: 'transactional',
    blocks: d.approved
      ? [{ p: `${hi(d.first_name)} our team reviewed your photos and they're live on your profile.` }, { button: { label: 'View your profile', url: `${SITE_URL}/app/settings` } }]
      : [
          { p: `${hi(d.first_name)} every photo on Score has to clearly show you, so members know who they're meeting. One of yours didn't pass: often it's a group shot, sunglasses or a heavy filter.` },
          { button: { label: 'Update photos', url: `${SITE_URL}/onboarding/photos` } },
        ],
  }) satisfies Email,

  daily_drop: (d: { first_name?: string | null; count: number; top_match?: string | null }) => ({
    subject: `Your Daily Drop: ${d.count} new ${d.count === 1 ? 'person' : 'people'}`,
    preheader: d.top_match ? `Including ${d.top_match}. Gone at midnight.` : 'Gone at midnight.',
    eyebrow: "Today's Drop",
    heading: `${d.count} people, picked for you.`,
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} today's Drop is ready${d.top_match ? `, led by ${d.top_match}` : ''}. Each one shares at least three of your money values.` },
      { button: { label: 'Open the Drop', url: `${SITE_URL}/app` } },
      { note: 'Drops refresh at noon and disappear at midnight.' },
    ],
  }) satisfies Email,

  new_message: (d: { first_name?: string | null; from_name: string; conversation_id: string }) => ({
    subject: `${d.from_name} sent you a message`,
    preheader: 'Open Score to read and reply.',
    eyebrow: 'New message',
    heading: `${d.from_name} said hello.`,
    kind: 'notification',
    blocks: [
      { p: `${hi(d.first_name)} you have a new message on Score. For privacy, we don't put message text in email.` },
      { button: { label: 'Read and reply', url: `${SITE_URL}/app/messages/${d.conversation_id}` } },
    ],
  }) satisfies Email,

  preview_ending: (d: { first_name?: string | null; days_left: number }) => ({
    subject: `Your Score Preview ends in ${d.days_left} ${d.days_left === 1 ? 'day' : 'days'}`,
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
    subject: 'Your Score membership has ended',
    preheader: 'Your profile is hidden. Your verification is kept for 6 months.',
    eyebrow: 'Membership',
    heading: 'Your membership has ended.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} your membership ended, so your profile is now hidden from the Daily Drop. Your conversations and verification are saved for six months, so rejoining is one tap and you won't need a new invite.` },
      { button: { label: 'Rejoin Score', url: `${SITE_URL}/plans` } },
      { p: "Just need a break? Paused keeps your account and friends for a small monthly fee, with your profile hidden." },
    ],
  }) satisfies Email,

  status_changed: (d: { first_name?: string | null; status: 'paused' | 'taken' | 'active' }) => ({
    subject: d.status === 'taken' ? 'Congratulations from Score' : d.status === 'paused' ? 'Your Score profile is paused' : 'Welcome back to Score',
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
      { p: `${hi(d.first_name)} Score re-checks every member's band every six months so the community stays honest. Yours is due ${d.due}.` },
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

  deletion_confirm: (d: { first_name?: string | null }) => ({
    subject: 'Your Score account is being deleted',
    preheader: 'Your profile is gone now. Everything else is erased within 30 days.',
    eyebrow: 'Account',
    heading: 'Your account is being deleted.',
    kind: 'transactional',
    blocks: [
      { p: `${hi(d.first_name)} as you asked, your profile has been removed from Score. Your photos, messages and verification results will be permanently erased within 30 days.` },
      { p: 'If you subscribed through the App Store or Google Play, cancel there too so you are not charged again.' },
      { note: "Didn't request this? Reply right away and we'll stop it." },
    ],
  }) satisfies Email,
} as const;

export type TemplateName = keyof typeof templates;

/** Sample data for the admin preview page. */
export const SAMPLES: { [K in TemplateName]: Parameters<(typeof templates)[K]>[0] } = {
  waitlist_joined: { first_name: 'Nadia', place: 'Brooklyn', open: true },
  notify_area: { first_name: 'Nadia', zip: '07030' },
  invite: { first_name: 'Nadia', code: 'SCR-7KQ2-M9', days: 14, inviter: null },
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
  daily_drop: { first_name: 'Nadia', count: 5, top_match: 'Owen, 33' },
  new_message: { first_name: 'Nadia', from_name: 'Owen', conversation_id: 'example' },
  preview_ending: { first_name: 'Nadia', days_left: 3 },
  plan_ended: { first_name: 'Nadia' },
  status_changed: { first_name: 'Nadia', status: 'paused' },
  reverify_reminder: { first_name: 'Nadia', due: 'December 1' },
  report_received: { first_name: 'Nadia' },
  deletion_confirm: { first_name: 'Nadia' },
};

export const TEMPLATE_INFO: Record<TemplateName, { label: string; when: string; live: boolean }> = {
  waitlist_joined: { label: 'Waitlist confirmation', when: 'Someone joins the waitlist (open area or opening soon wording by zip)', live: true },
  notify_area: { label: 'Notify me (legacy)', when: 'Not used now: everyone goes on the waitlist', live: false },
  invite: { label: 'Invite', when: 'Staff emails an invite from the waitlist', live: true },
  magic_link: { label: 'Sign-in link', when: 'Supabase · Magic Link template', live: false },
  auth_confirm: { label: 'Confirm email (first sign-in)', when: 'Supabase · Confirm signup template', live: false },
  auth_invite: { label: 'Staff invite', when: 'Supabase · Invite user template', live: false },
  auth_email_change: { label: 'Change email', when: 'Supabase · Change Email Address template', live: false },
  auth_reset: { label: 'Account recovery', when: 'Supabase · Reset Password template', live: false },
  auth_reauth: { label: 'Security code', when: 'Supabase · Reauthentication template', live: false },
  welcome_member: { label: 'Welcome to Score', when: 'A member picks a paid plan', live: true },
  id_approved: { label: 'ID approved', when: 'Persona approves the ID and selfie check', live: true },
  id_needs_attention: { label: 'ID retry', when: 'Persona declines the ID check', live: true },
  photos_review: { label: 'Photo review result', when: 'Staff approves or rejects photos in review', live: true },
  daily_drop: { label: 'Daily Drop', when: 'Daily at noon (needs scheduled job, not on yet)', live: false },
  new_message: { label: 'New message', when: 'A message arrives while the member is away (not on yet)', live: false },
  preview_ending: { label: 'Preview ending', when: '3 days before a Preview ends (needs scheduled job)', live: false },
  plan_ended: { label: 'Membership ended', when: 'RevenueCat reports the plan expired or was refunded', live: true },
  status_changed: { label: 'Paused / Taken / Back', when: 'A member changes status in settings', live: true },
  reverify_reminder: { label: 'Re-verify band', when: 'Every 6 months (needs scheduled job)', live: false },
  report_received: { label: 'Report received', when: 'A member reports someone', live: true },
  deletion_confirm: { label: 'Account deletion', when: 'A member deletes their account', live: true },
};

export function build<K extends TemplateName>(name: K, data: Parameters<(typeof templates)[K]>[0]) {
  return render((templates[name] as (d: typeof data) => Email)(data));
}

/** Supabase Auth email templates: what to paste where. */
export const SUPABASE_TEMPLATES: Partial<Record<TemplateName, { slot: string; data: Record<string, string> }>> = {
  auth_confirm: { slot: 'Confirm signup', data: { url: '{{ .ConfirmationURL }}' } },
  magic_link: { slot: 'Magic Link', data: { url: '{{ .ConfirmationURL }}' } },
  auth_invite: { slot: 'Invite user', data: { url: '{{ .ConfirmationURL }}' } },
  auth_email_change: { slot: 'Change Email Address', data: { url: '{{ .ConfirmationURL }}', new_email: '{{ .NewEmail }}' } },
  auth_reset: { slot: 'Reset Password', data: { url: '{{ .ConfirmationURL }}' } },
  auth_reauth: { slot: 'Reauthentication', data: { code: '{{ .Token }}' } },
};
