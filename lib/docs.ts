// Public policy pages. Text supports **bold** and [links](/path). Blocks: string = paragraph, { ul } = list, { h3 } = subheading.
export type Block = string | { ul: string[] } | { h3: string };
export type Section = { id: string; h: string; body: Block[] };
export type Doc = { title: string; eyebrow: string; summary: string; updated: string; draft?: boolean; sections: Section[] };

const COMPANY = 'Please & Thank You, Inc.';
const ADDRESS = '1133 Broadway, Suite 1301, New York, NY 10010';
const UPDATED = 'November 7, 2026';
const DRAFT = true; // flip to false once counsel has reviewed

export const DOCS: Record<string, Doc> = {
  terms: {
    title: 'Terms of Service', eyebrow: 'Legal', updated: UPDATED, draft: DRAFT,
    summary: 'The agreement between you and Score. Plain English where we can, precise where we have to be.',
    sections: [
      { id: 'who', h: 'Who we are', body: [
        `Score is an invite-only dating service operated by ${COMPANY} (“Score,” “we,” “us”), ${ADDRESS}. These Terms apply to the Score website at scoredate.app, the Score apps, and everything you can do in them (together, the “Service”).`,
        'By creating an account, joining the waitlist, or using the Service, you agree to these Terms, our [Privacy Policy](/legal/privacy), our [Community Guidelines](/legal/community) and our [Biometric Data Policy](/legal/biometric). If you don’t agree, please don’t use Score.',
      ] },
      { id: 'eligibility', h: 'Who can join', body: [
        'To be a member you must:',
        { ul: [
          'be at least **25 years old**;',
          'live in, or regularly spend time in, an area where Score is open;',
          'be legally able to enter a contract and not be barred from using the Service under any law;',
          'not be required to register as a sex offender anywhere, and not have been convicted of a violent or sexual crime;',
          'not have been removed from Score before, unless we’ve said in writing you can come back;',
          'be single or in an arrangement where dating is honest and consensual for everyone involved.',
        ] },
        'Membership is by invitation. Joining the waitlist does not guarantee an invite, and we decide who receives invites and when.',
      ] },
      { id: 'verification', h: 'Verification', body: [
        'Score is built on verification. Before you can match or message, we ask you to:',
        { ul: [
          '**Confirm your identity** with a government ID and a live selfie through our identity verification partner.',
          '**Verify your credit band** through a soft credit inquiry by our credit data partner. A soft inquiry does not affect your credit score. We receive only your band (Elite, Strong, Solid or Building) and a 12-month trend, never your exact score or your credit report.',
          '**Match your photos** to your selfie so members know your pictures are really you.',
        ] },
        'You authorize these checks when you start them. Bands are re-checked about every six months to keep them current. If a check fails or can’t be completed, we may limit or close your account. Verification lowers risk but can’t eliminate it; please read our [Safety Center](/safety).',
      ] },
      { id: 'account', h: 'Your account', body: [
        'Keep your sign-in details private and tell us right away at support@scoredate.app if you think someone else has accessed your account. You’re responsible for what happens on your account. One person, one account.',
        'Your profile must be accurate and current. Don’t impersonate anyone, use someone else’s photos, or misstate your age, relationship status or anything else that matters to the people you meet.',
      ] },
      { id: 'conduct', h: 'How you agree to behave', body: [
        'You agree to follow the [Community Guidelines](/legal/community). In short, you won’t:',
        { ul: [
          'harass, threaten, stalk, bully, or intimidate anyone, on or off Score;',
          'ask any member for money, gifts, crypto, investments, loans or financial account details;',
          'post nudity, sexual content, hate speech, or anything violent or illegal;',
          'share another member’s band, messages, photos or personal information outside Score;',
          'promote a business, sell anything, recruit, or solicit;',
          'use bots, scrape the Service, reverse-engineer it, or try to get around our security or limits;',
          'use Score if you’re under 25 or for anyone else.',
        ] },
      ] },
      { id: 'content', h: 'Your content', body: [
        'You own what you post (photos, prompts, messages). You give us a worldwide, non-exclusive, royalty-free license to host, store, display and process it only to run, improve and promote the Service to you and other members, and to keep Score safe. This license ends when you delete the content or your account, except where we must keep something for safety, legal or backup reasons for a limited time.',
        'We may remove any content or account that we believe breaks these Terms or puts anyone at risk.',
      ] },
      { id: 'billing', h: 'Memberships, purchases and billing', body: [
        'Score offers paid plans (such as Membership, Premium and Reserve), a one-time Preview, Paused or Taken plans, and optional add-ons. Prices are shown before you buy.',
        { ul: [
          '**Subscriptions renew automatically** at the end of each period unless you cancel at least 24 hours before it ends.',
          'If you subscribe through the **Apple App Store or Google Play**, that store bills you and handles cancellations and refunds under its own terms. Cancel in your device’s subscription settings. Deleting the app or your account does not cancel a store subscription.',
          'Add-ons (like Extra matches, Spotlight and Notes) are consumed when used and are non-refundable except where the law or the store requires.',
          'Introductory or Founding Member offers apply only to eligible members and only as described when offered.',
        ] },
        'If we change a price, we’ll tell you in advance, and the new price applies from your next renewal.',
      ] },
      { id: 'safety', h: 'Safety and your interactions', body: [
        'You’re responsible for your interactions with other members. Score does not run criminal background checks, and we can’t guarantee anyone’s identity, intentions or behavior, even with verification. Meet in public, tell a friend, and use the tools in our [Safety Center](/safety). If you’re in danger, call 911.',
        'Report anyone who makes you uncomfortable. We review every report and may warn, suspend or remove members, and we cooperate with law enforcement when required.',
      ] },
      { id: 'termination', h: 'Leaving, pausing and removal', body: [
        'You can pause or delete your account at any time in Settings. We may suspend or remove an account, with or without notice, if we believe it breaks these Terms, creates risk, or is required by law. If we remove you for breaking these Terms, you won’t be entitled to a refund of unused time, except where the law or the store requires.',
      ] },
      { id: 'disclaimers', h: 'Disclaimers', body: [
        'The Service is provided “as is” and “as available.” To the fullest extent the law allows, we disclaim all warranties, express or implied, including fitness for a particular purpose and non-infringement. We don’t promise you’ll find a match, and we aren’t responsible for the conduct of any member on or off Score.',
        'Score is not a credit bureau, lender or credit repair service, and nothing on Score is financial advice.',
      ] },
      { id: 'liability', h: 'Limits on our liability', body: [
        'To the fullest extent the law allows, Score will not be liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or goodwill. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid us in the 12 months before the claim or $100. Some places don’t allow these limits, so they may not apply to you.',
      ] },
      { id: 'disputes', h: 'Disputes', body: [
        'Most concerns can be solved quickly. Before filing any claim, email legal@scoredate.app with a description, and give us 30 days to try to resolve it informally.',
        'These Terms are governed by the laws of the State of New York, without regard to conflict-of-law rules. Any claim not resolved informally will be brought in the state or federal courts located in New York County, New York, and you and we consent to that jurisdiction, except where the law of your place of residence gives you the right to bring a claim locally.',
      ] },
      { id: 'changes', h: 'Changes to these Terms', body: [
        'We may update these Terms as Score grows. If a change is material, we’ll tell you by email or in the app before it takes effect. Continuing to use Score after that means you accept the updated Terms.',
      ] },
      { id: 'contact', h: 'Contact', body: [
        `${COMPANY}, ${ADDRESS}. Email support@scoredate.app for help or legal@scoredate.app for legal notices.`,
      ] },
    ],
  },

  privacy: {
    title: 'Privacy Policy', eyebrow: 'Legal', updated: UPDATED, draft: DRAFT,
    summary: 'What we collect, why, who we share it with, and the choices you have. We built Score to know as little as it needs to.',
    sections: [
      { id: 'short', h: 'The short version', body: [
        { ul: [
          'We store your **credit band and 12-month trend**, never your exact score or credit report.',
          'Your **ID images and ID selfie stay with our verification partner**, not on Score’s servers.',
          'We **don’t sell** your personal information or share it for cross-context behavioral advertising.',
          'Other members only ever see what’s on your profile. The member map shows **neighborhoods, never people**, and only for groups of 25 or more.',
          'You can delete your account any time in Settings.',
        ] },
      ] },
      { id: 'collect', h: 'What we collect', body: [
        { h3: 'You give us' },
        { ul: [
          'Waitlist details: name, email, zip code, what you do, and an invite or referral code if you have one.',
          'Account and profile: name, birth year, gender, who you’d like to meet, photos, job, neighborhood, prompts, money values, optional song and Instagram handle.',
          'Messages, Notes, date plans and event RSVPs you send through Score.',
          'Support requests and reports you file.',
        ] },
        { h3: 'From verification' },
        { ul: [
          '**Identity:** our verification partner tells us whether your ID and selfie check passed, failed or needs review. We don’t receive or store your ID images.',
          '**Credit:** our credit data partner returns your band and trend from a soft inquiry. We don’t receive your score, report, accounts or balances.',
          '**Photos:** we compare each profile photo with a live selfie to confirm it’s you and store only the result and a similarity score. See the [Biometric Data Policy](/legal/biometric).',
        ] },
        { h3: 'Automatically' },
        { ul: [
          'Device and usage: device type, browser, app version, pages visited, a random visitor ID and session ID, the referring site, and city-level location derived from your connection. We do not store your IP address in our analytics.',
          'Activity used to run the app, such as when you were last active (used for gentle reminders) and notification preferences.',
          'Purchase records from Apple, Google and RevenueCat: product, price, store and renewal status. We never see your card number.',
        ] },
      ] },
      { id: 'use', h: 'How we use it', body: [
        { ul: [
          'To run Score: create your account, verify you, build your Daily Drop, deliver messages, and process memberships.',
          'To keep members safe: detect fake accounts and scams, review reports, enforce our Guidelines, and respond to legal requests.',
          'To communicate: account emails, notifications you’ve turned on, and occasional updates you can unsubscribe from.',
          'To improve Score: understand which features help people meet, in aggregate.',
          'To comply with law and protect our rights.',
        ] },
      ] },
      { id: 'share', h: 'Who we share it with', body: [
        '**Other members** see your profile. They see your band, not your score.',
        '**Service providers** who process data for us under contract and only on our instructions:',
        { ul: [
          'identity verification (ID and selfie checks);',
          'credit data (soft-inquiry band and trend);',
          'Amazon Web Services (photo matching);',
          'Supabase and Vercel (hosting and databases, in the United States);',
          'Resend (email delivery) and web push services operated by your browser or phone maker (notifications);',
          'Apple, Google and RevenueCat (subscriptions and purchases);',
          'CARTO and OpenStreetMap (map tiles; they see that a map was loaded, not who you are).',
        ] },
        '**Legal and safety:** when required by law, or when we believe in good faith it’s necessary to prevent harm or fraud.',
        '**Business changes:** if Score is involved in a merger or sale, data may transfer under this policy.',
        'We do not sell personal information.',
      ] },
      { id: 'retention', h: 'How long we keep it', body: [
        { ul: [
          'Account data: while your account is open. When you delete your account, your profile disappears immediately and the rest is erased within 30 days, except what we must keep for safety, fraud prevention, legal or tax reasons.',
          'Biometric data held by our partners: deleted within 30 days of verification, or sooner when you delete your account.',
          'Notifications: removed after 90 days.',
          'Waitlist entries: until you join, ask us to remove you, or we close the waitlist.',
        ] },
      ] },
      { id: 'rights', h: 'Your rights and choices', body: [
        'Depending on where you live (including California, Colorado, Connecticut, Virginia and other states), you may have the right to access, correct, delete or get a copy of your personal information, and to opt out of sale, sharing or targeted advertising. Score doesn’t sell or share for targeted advertising, so there’s nothing to opt out of there, but you can still exercise the other rights. See [Your Privacy Choices](/legal/choices).',
        'We won’t treat you differently for exercising your rights.',
      ] },
      { id: 'security', h: 'Security', body: [
        'We use encryption in transit, row-level access controls on our database, encrypted secrets, and least-privilege staff access. Staff actions on member accounts are logged. No system is perfect; if we ever learn of a breach affecting you, we’ll notify you as the law requires.',
      ] },
      { id: 'age', h: 'Age', body: [
        'Score is for adults 25 and older. We don’t knowingly collect information from anyone under 18. If you believe a minor has joined, tell us at support@scoredate.app and we’ll remove the account.',
      ] },
      { id: 'changes', h: 'Changes', body: [
        'We’ll post updates here and tell you about material changes by email or in the app before they take effect.',
      ] },
      { id: 'contact', h: 'Contact', body: [
        `Questions or requests: privacy@scoredate.app or ${COMPANY}, Attn: Privacy, ${ADDRESS}.`,
      ] },
    ],
  },

  choices: {
    title: 'Your Privacy Choices', eyebrow: 'Legal', updated: UPDATED, draft: DRAFT,
    summary: 'Every control you have over your data, and how to use it.',
    sections: [
      { id: 'sell', h: 'We don’t sell or share your data for ads', body: [
        'Score does not sell personal information and does not share it for cross-context behavioral advertising. We don’t use third-party advertising cookies or trackers. If that ever changes, we’ll update this page first and give you a way to opt out.',
      ] },
      { id: 'in-app', h: 'Controls in the app', body: [
        { ul: [
          '**Delete your account:** Settings → Delete account. Your profile disappears immediately; everything else is erased within 30 days.',
          '**Pause or Taken:** hide from matching without deleting anything.',
          '**Email:** choose which emails you get in Settings, or use the unsubscribe link in any email.',
          '**Notifications:** turn push on or off per device, choose categories, and keep quiet hours on.',
          '**Member map:** Settings → Privacy → leave me off the member map.',
          '**Block and report:** from any profile or chat.',
        ] },
      ] },
      { id: 'requests', h: 'Access, correction, deletion and copies', body: [
        'Email **privacy@scoredate.app** from the address on your account and tell us what you’d like:',
        { ul: [
          'a copy of the personal information we hold about you;',
          'corrections to anything inaccurate;',
          'deletion of your information (or use Settings → Delete account);',
          'information about how we use and share your data.',
        ] },
        'We’ll confirm we received it, may ask you to verify your identity, and respond within 30 days (45 where state law allows). An authorized agent can make a request for you with your signed permission. If we decline a request, you can appeal by replying to our decision.',
      ] },
      { id: 'gpc', h: 'Global Privacy Control', body: [
        'If your browser sends a Global Privacy Control signal, we treat it as a request to opt out of sale and sharing. Since we don’t do either, nothing else changes, but we honor it anyway.',
      ] },
      { id: 'more', h: 'More', body: [
        'Read the full [Privacy Policy](/legal/privacy), the [Cookie Notice](/legal/cookies) and the [Biometric Data Policy](/legal/biometric).',
      ] },
    ],
  },

  cookies: {
    title: 'Cookie Notice', eyebrow: 'Legal', updated: UPDATED, draft: DRAFT,
    summary: 'A short list, because we only use the cookies Score actually needs.',
    sections: [
      { id: 'what', h: 'The cookies we use', body: [
        'All of these are first-party cookies set by scoredate.app. We don’t use third-party advertising or cross-site tracking cookies.',
        { ul: [
          '**Sign-in** (Supabase auth): keeps you signed in. Essential.',
          '**score_theme:** remembers light, dark or system theme. Up to 1 year.',
          '**score_vid / score_sid:** a random visitor ID (1 year) and session ID (30 minutes) so we can count visits and see which pages help. They’re not linked to your name unless you sign in.',
          '**score_seen:** limits how often we update your “last active” time. 1 hour.',
          '**score_ref:** remembers a friend’s invite link so they get credit if you join. 30 days.',
          '**score_invite:** holds an invite code while you sign up. Until you finish.',
        ] },
      ] },
      { id: 'storage', h: 'Other browser storage', body: [
        'If you turn on notifications, your browser stores a push subscription and a small service worker so notifications can arrive. We also remember if you dismissed the notifications prompt. Turning notifications off in Settings removes the subscription.',
      ] },
      { id: 'control', h: 'Your control', body: [
        'You can block or delete cookies in your browser settings. Blocking sign-in cookies will sign you out; blocking the others only resets your theme and counts you as a new visitor.',
      ] },
    ],
  },

  community: {
    title: 'Community Guidelines', eyebrow: 'Trust & safety', updated: UPDATED,
    summary: 'Score works because everyone here is who they say they are and treats each other well. These are the rules every member agrees to.',
    sections: [
      { id: 'real', h: 'Be real', body: [
        'Use your real first name, recent photos that clearly show you, and an honest profile. Your identity and band are verified, so everything else should be true too. No group photos as your first picture, no filters that change how you look, no photos of anyone else.',
      ] },
      { id: 'respect', h: 'Be respectful', body: [
        'Treat people the way you’d want to be treated at a dinner party. No harassment, insults, threats, or pressure. If someone isn’t interested or stops replying, let it go. A short, kind “not a match” message is always better than silence or persistence.',
      ] },
      { id: 'money', h: 'Never ask for money', body: [
        'Asking any member for money, gifts, crypto, investments, loans, or financial account details gets you removed immediately. A verified band is not a reason to trust a financial request. If anyone asks, report them, even if the story sounds real.',
      ] },
      { id: 'consent', h: 'Consent, always', body: [
        'No unsolicited sexual messages or images, ever. Consent is ongoing and can be withdrawn at any time, in messages and in person.',
      ] },
      { id: 'private', h: 'Keep it private', body: [
        'Don’t screenshot or share another member’s band, profile, messages or photos outside Score. Don’t try to find someone’s home, workplace or social accounts without their permission.',
      ] },
      { id: 'no-selling', h: 'No selling or recruiting', body: [
        'Score isn’t for promoting a business, selling products or services, recruiting for anything, or sending people to other apps or sites for money.',
      ] },
      { id: 'illegal', h: 'Nothing hateful, violent or illegal', body: [
        'No hate speech or discrimination based on race, ethnicity, religion, disability, gender, gender identity or sexual orientation. No violence, threats, weapons, drugs, or anything illegal.',
      ] },
      { id: 'age', h: '25 and older', body: [
        'Every member must be at least 25. Report anyone you believe is younger.',
      ] },
      { id: 'one', h: 'One account, honest status', body: [
        'One account per person. If you start a relationship, switch to Paused or Taken so others aren’t waiting on you.',
      ] },
      { id: 'enforce', h: 'What happens if someone breaks the rules', body: [
        'Our team reviews every report, usually within 24 hours, and anything involving money or harassment first. Depending on what happened, we may warn, suspend or remove a member, and we cooperate with law enforcement. The person you report never learns it was you, and once you report or block someone they can no longer see or message you.',
        'Report from any profile or chat, or see the [Safety Center](/safety#report).',
      ] },
    ],
  },

  biometric: {
    title: 'Biometric Data Policy', eyebrow: 'Trust & safety', updated: UPDATED, draft: DRAFT,
    summary: 'We use face comparison for one reason: to confirm that you are you and that your photos show you. Here is exactly how.',
    sections: [
      { id: 'what', h: 'What we collect', body: [
        { ul: [
          '**Identity check:** our identity verification partner scans your government ID and a live selfie and compares the face geometry in each.',
          '**Photo check:** when you add profile photos, we compare each one with a live selfie using Amazon Rekognition to confirm the photos show you.',
        ] },
      ] },
      { id: 'why', h: 'Why', body: [
        'Only to confirm you are who you say you are and that your photos are really you. We never use face data for advertising, to identify you anywhere else, or to train models, and we never sell, lease, trade or profit from it.',
      ] },
      { id: 'where', h: 'Who holds it', body: [
        'ID images and the ID selfie are held by our identity verification partner, not by Score. The photo-check selfie is processed in memory and not stored. Score keeps only the results (approved, declined or needs review) and a similarity score for each profile photo.',
      ] },
      { id: 'retention', h: 'How long it’s kept', body: [
        'Biometric data held by our partners is permanently destroyed within 30 days after verification is complete, immediately when you delete your account, and in all cases no later than the law allows (including no later than three years after your last interaction with Score where Illinois law applies).',
      ] },
      { id: 'consent', h: 'Your consent', body: [
        'We ask for your written consent before any face comparison, and we keep a record of it. You can withdraw consent at any time by deleting your account. Without it, we can’t verify you, so you can’t match or message.',
      ] },
      { id: 'security', h: 'Security', body: [
        'Biometric data is protected with at least the same care we use for our most sensitive information: encrypted in transit and at rest, with access limited to the systems that perform the check.',
      ] },
      { id: 'contact', h: 'Questions', body: [
        `privacy@scoredate.app · ${COMPANY}, ${ADDRESS}.`,
      ] },
    ],
  },
};
