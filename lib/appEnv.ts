/**
 * Which copy of ScoreDate this is. Set NEXT_PUBLIC_APP_ENV per branch in Vercel:
 *   dev branch → "dev" (dev.scoredate.app), staging branch → "staging" (staging.scoredate.app), main → live (www.scoredate.app).
 * Dev and staging use the separate test database and are staff-only.
 */
export type AppEnv = 'dev' | 'staging' | 'live';
export const APP_ENV: AppEnv = ((): AppEnv => {
  const v = process.env.NEXT_PUBLIC_APP_ENV;
  if (v === 'dev' || v === 'staging' || v === 'live') return v;
  if (process.env.VERCEL_ENV === 'production') return 'live';
  // Vercel tells every build which branch it came from.
  const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
  return branch === 'staging' ? 'staging' : 'dev';
})();
export const IS_LIVE = APP_ENV === 'live';
export const LIVE_URL = 'https://www.scoredate.app';
