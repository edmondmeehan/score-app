export type Field = { key: string; label: string; secret?: boolean; placeholder?: string; help?: string; multiline?: boolean };
export type Spec = {
  provider: 'persona' | 'aws' | 'revenuecat' | 'apple' | 'google' | 'credit' | 'email' | 'spotify';
  name: string;
  what: string;
  required: string[]; // keys that must be set for "Connected"
  fields: Field[];
  webhookPath?: string;
  testable?: boolean;
  notes?: string[];
};

const PRODUCT_FIELDS = (prefix: string): Field[] => [
  { key: 'products.membership_monthly', label: 'Membership monthly product ID', placeholder: `${prefix}.membership.monthly` },
  { key: 'products.membership_annual', label: 'Membership annual product ID', placeholder: `${prefix}.membership.annual` },
  { key: 'products.premium_monthly', label: 'Premium monthly product ID', placeholder: `${prefix}.premium.monthly` },
  { key: 'products.premium_annual', label: 'Premium annual product ID', placeholder: `${prefix}.premium.annual` },
  { key: 'products.black_monthly', label: 'Black monthly product ID', placeholder: `${prefix}.black.monthly` },
  { key: 'products.paused_monthly', label: 'Paused monthly product ID', placeholder: `${prefix}.paused.monthly` },
  { key: 'products.preview_once', label: 'Preview (one-time $9.99) product ID', placeholder: `${prefix}.preview` },
];

export const SPECS: Spec[] = [
  {
    provider: 'persona', name: 'Persona', what: 'ID scan, live selfie with liveness, and face match to the ID.',
    required: ['api_key', 'template_id'], webhookPath: '/api/verify/webhook', testable: true,
    fields: [
      { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
      { key: 'template_id', label: 'Inquiry template ID', placeholder: 'itmpl_…', help: 'Template with Government ID + Selfie (liveness).' },
      { key: 'api_key', label: 'API key', secret: true, placeholder: 'persona_sandbox_…' },
      { key: 'webhook_secret', label: 'Webhook secret', secret: true, placeholder: 'wbhsec_…' },
    ],
    notes: ['Add the webhook URL in Persona → Webhooks with inquiry events.'],
  },
  {
    provider: 'aws', name: 'AWS Rekognition', what: 'AI check that each profile photo matches the member’s live selfie.',
    required: ['access_key_id', 'secret_access_key'],
    fields: [
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
      { key: 'approve_threshold', label: 'Auto-approve at similarity %', placeholder: '92', help: 'Below this, photos go to a person.' },
      { key: 'access_key_id', label: 'Access key ID', secret: true, placeholder: 'AKIA…' },
      { key: 'secret_access_key', label: 'Secret access key', secret: true },
    ],
    notes: ['Use an IAM user that can only call rekognition:CompareFaces.'],
  },
  {
    provider: 'revenuecat', name: 'RevenueCat', what: 'Subscriptions and purchases for the iPhone and Android apps. Keeps Score’s plans in sync with the App Store and Google Play.',
    required: ['secret_api_key', 'webhook_auth'], webhookPath: '/api/billing/revenuecat', testable: true,
    fields: [
      { key: 'entitlements.membership', label: 'Membership entitlement ID', placeholder: 'membership' },
      { key: 'entitlements.premium', label: 'Premium entitlement ID', placeholder: 'premium' },
      { key: 'entitlements.black', label: 'Black entitlement ID', placeholder: 'black' },
      { key: 'entitlements.paused', label: 'Paused entitlement ID', placeholder: 'paused' },
      { key: 'ios_public_key', label: 'Public SDK key (iOS)', placeholder: 'appl_…', help: 'Safe to ship in the app.' },
      { key: 'android_public_key', label: 'Public SDK key (Android)', placeholder: 'goog_…' },
      { key: 'secret_api_key', label: 'Secret API key (v1)', secret: true, placeholder: 'sk_…' },
      { key: 'webhook_auth', label: 'Webhook authorization value', secret: true, help: 'Make up a long random value. Paste the same value in RevenueCat’s webhook “Authorization header”.' },
    ],
    notes: ['In the apps, log in to RevenueCat with the member’s Score user ID.', 'App Store and Google Play credentials are uploaded to RevenueCat, not here.'],
  },
  {
    provider: 'apple', name: 'Apple App Store', what: 'iPhone app listing and in-app purchase products.',
    required: ['bundle_id'],
    fields: [
      { key: 'bundle_id', label: 'Bundle ID', placeholder: 'app.score.ios' },
      { key: 'team_id', label: 'Apple Developer Team ID', placeholder: 'ABCDE12345' },
      { key: 'app_store_id', label: 'App Store app ID', placeholder: '6400000000' },
      ...PRODUCT_FIELDS('app.score'),
    ],
    notes: [
      'Upload the In-App Purchase key (.p8) and App Store Connect API key to RevenueCat → Apps → App Store.',
      'Sign in with Apple: add the Services ID and key in Supabase → Authentication → Providers → Apple.',
      'Set App Store Server Notifications (v2) to RevenueCat’s URL so cancellations and refunds arrive instantly.',
    ],
  },
  {
    provider: 'google', name: 'Google Play', what: 'Android app listing and in-app purchase products.',
    required: ['package_name'],
    fields: [{ key: 'package_name', label: 'Package name', placeholder: 'app.score.android' }, ...PRODUCT_FIELDS('app.score')],
    notes: [
      'Upload the Google Play service account JSON to RevenueCat → Apps → Play Store.',
      'Turn on Real-time developer notifications (Pub/Sub) pointed at RevenueCat.',
      'Sign in with Google: add the OAuth client in Supabase → Authentication → Providers → Google.',
    ],
  },
  {
    provider: 'credit', name: 'Credit data partner', what: 'Soft-pull credit band and 12-month trend. Vendor not chosen yet.',
    required: ['vendor', 'api_key'],
    fields: [
      { key: 'vendor', label: 'Vendor', placeholder: 'e.g. Array, a bureau API' },
      { key: 'api_key', label: 'API key', secret: true },
      { key: 'webhook_secret', label: 'Webhook secret', secret: true },
    ],
    notes: ['Integration code is written once the vendor is signed. Until then onboarding uses test mode.'],
  },
  {
    provider: 'email', name: 'Email (Resend)', what: 'Waitlist, invite, verification and account emails.',
    required: ['from', 'resend_api_key'],
    testable: true,
    fields: [
      { key: 'resend_api_key', label: 'Resend API key', secret: true, placeholder: 're_…', help: 'Resend → API Keys → Create (Sending access is enough).' },
      { key: 'from', label: 'From address', placeholder: 'hello@score.app', help: 'Must be on a domain verified in Resend → Domains.' },
      { key: 'from_name', label: 'From name', placeholder: 'Score' },
      { key: 'reply_to', label: 'Reply-to address', placeholder: 'support@score.app' },
    ],
    notes: [
      'Verify your sending domain in Resend → Domains (add the DNS records it gives you), then use an address on that domain as From.',
      'Sign-in links come from Supabase Auth. In Supabase → Authentication → SMTP Settings, turn on custom SMTP with host smtp.resend.com, port 465, user "resend", and your Resend API key as the password.',
      'Then paste the Score sign-in template from admin → Emails into Supabase → Authentication → Email Templates → Magic Link.',
    ],
  },
  {
    provider: 'spotify', name: 'Spotify', what: 'Song search for member profiles.',
    required: ['client_id', 'client_secret'],
    testable: true,
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'from developer.spotify.com' },
      { key: 'client_secret', label: 'Client secret', secret: true },
    ],
    notes: [
      'Create an app at developer.spotify.com → Dashboard → Create app. Pick "Web API". No redirect URL is needed: Score only searches the catalog, members never connect their Spotify account.',
      'Without keys, members can still paste a Spotify song link. Search turns on once this is connected.',
    ],
  },
];

export function getPath(obj: Record<string, any>, path: string) {
  return path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj: Record<string, any>, path: string, value: unknown) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  o[keys[keys.length - 1]] = value;
}
