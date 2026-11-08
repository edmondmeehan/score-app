# Score — MVP web app

Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage, Realtime), hosted on Vercel.

## What's in it

- **Public:** landing page, waitlist, invite-code entry, email sign-in, legal pages (drafts).
- **Onboarding (invite only):** basics → ID + selfie check → credit band → money-values quiz → profile photos with AI face match → plan.
- **Member app:** Daily Drop (5 or 10 a day, compatibility from money values and band), member profiles, messaging with live updates, invites, report and block, status (Active / Paused / Taken), account deletion.
- **Admin (`/admin`, staff only):** overview, waitlist and invite codes, verification queue (ID and photo review), moderation, members, deletion requests, billing, integrations, audit log.
- **Integrations (`/admin/integrations`, owner edits):** Persona, AWS Rekognition, RevenueCat, Apple App Store, Google Play, credit partner, email. Secrets are encrypted in Supabase Vault and can't be read back from the UI.
- **Billing:** RevenueCat webhook at `/api/billing/revenuecat` keeps plans in sync with App Store and Google Play purchases. The mobile apps must use the Supabase user ID as the RevenueCat app user ID.

## Verification

| Step | Provider | Without keys |
| --- | --- | --- |
| ID + live selfie, liveness, face match to ID | Persona (`lib/persona.ts`) | Test mode: approves automatically, collects nothing |
| Profile photos vs. live selfie | AWS Rekognition CompareFaces (`lib/facematch.ts`) | Every photo goes to manual review in `/admin/verification` |
| Credit band | Credit-data partner (not chosen yet) | Test mode: member picks a band to simulate |

Privacy rules built into the database:

- Exact credit scores and reports are never stored, only the band and trend.
- ID images stay with Persona. The profile-check selfie is compared in memory and never saved.
- Explicit biometric consent is recorded (`biometric_consents`) before any face check.
- Sensitive fields (band, status, plan, verification results) can only change through database functions. Vendor results need a server secret.
- Staff actions are written to `audit_log`.

## Setup

1. Apply every file in `supabase/migrations/` to a new Supabase project, in number order (`0001` through `0007`).
2. Set the server secret in the database and in Vercel:

   ```sql
   update private.private_secrets set value = '<long random string>' where key = 'webhook_secret';
   ```

3. Set the environment variables (see `.env.example`) in Vercel.
4. Persona: create an inquiry template with Government ID + Selfie (with liveness). Set `PERSONA_API_KEY` and `PERSONA_TEMPLATE_ID`. Add a webhook to `https://<domain>/api/verify/webhook` and set `PERSONA_WEBHOOK_SECRET`.
5. AWS: create an IAM user allowed only `rekognition:CompareFaces`. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
6. Supabase Auth: set the Site URL and add `https://<domain>/auth/callback` to the redirect URLs.
7. To leave test mode: `update app_config set value = 'false' where key = 'test_mode';` Paid plans then require real billing (App Store in the iPhone app, or Stripe on the web).

## Not built yet

Real payments, the credit-partner integration, push and email notifications (beyond sign-in links), events, Black concierge, native iPhone app.
