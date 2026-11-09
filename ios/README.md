# ScoreDate for iPhone

A Capacitor shell around www.scoredate.app (it opens on /join). Native pieces: push notifications (straight to
Apple, see lib/apns.ts), Apple in-app purchases via RevenueCat, camera for selfies and the ID check, haptics,
status bar and splash screen. Ad pixels are off inside the app (the app's user agent contains `ScoreDateApp`).

Bundle ID: `co.please.scoredate`. Version 1.0 (build 1). iPhone only, portrait.

## Build and upload to TestFlight (on a Mac with Xcode 16+)

1. `npm install` in the repo root (Xcode reads the plugins from node_modules).
2. `npx cap sync ios`
3. `open ios/App/App.xcodeproj`
4. In Xcode: select the **App** target → **Signing & Capabilities** → pick your Team. Leave "Automatically manage signing" on.
   Push Notifications is already enabled through App/App.entitlements.
5. Choose **Any iOS Device (arm64)** as the destination → **Product → Archive**.
6. In the Organizer: **Distribute App → App Store Connect → Upload**.
7. In App Store Connect → your app → **TestFlight**, the build appears after processing (10–30 min). Add yourself under Internal Testing.

For each new upload, bump the build number (App target → General → Build).

## Push notifications
Create an APNs key at developer.apple.com → Certificates, IDs & Profiles → Keys (enable Apple Push Notifications service).
In Vercel set `APNS_KEY` (contents of the .p8), `APNS_KEY_ID`, `APNS_TEAM_ID`, and optionally `APNS_BUNDLE_ID`.
