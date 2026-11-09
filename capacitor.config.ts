import type { CapacitorConfig } from '@capacitor/cli';

/**
 * ScoreDate iPhone/Android app. The app is a native shell around www.scoredate.app (the Next.js app needs its
 * server, so it can't be bundled). Native pieces: push notifications, Apple in-app purchases (RevenueCat),
 * camera for selfies and the ID check, haptics, status bar and splash screen.
 * native-shell/ holds a tiny offline page used only if the site can't be reached.
 */
const BG = '#0B0B0C';

const config: CapacitorConfig = {
  appId: 'co.please.scoredate',
  appName: 'ScoreDate',
  webDir: 'native-shell',
  backgroundColor: BG,
  appendUserAgent: 'ScoreDateApp',
  server: {
    url: 'https://www.scoredate.app/join',
    errorPath: 'index.html',
    // Pages that stay inside the app. Anything else (Google Maps, Resy, Instagram…) opens in Safari.
    allowNavigation: ['www.scoredate.app', 'scoredate.app', 'staging.scoredate.app', 'withpersona.com', '*.withpersona.com', 'nxiaujxablikzgljckaq.supabase.co'],
  },
  ios: {
    contentInset: 'never',
    backgroundColor: BG,
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'ScoreDate',
  },
  android: { backgroundColor: BG },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: BG, showSpinner: false, iosSpinnerStyle: 'small' },
    StatusBar: { style: 'DARK', backgroundColor: BG, overlaysWebView: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
