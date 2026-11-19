import { APP_ENV } from '@/lib/appEnv';

/** A thin strip on dev and staging so nobody mistakes them for the live app. Nothing on live. */
export default function EnvBanner() {
  if (APP_ENV === 'live') return null;
  const staging = APP_ENV === 'staging';
  return (
    <div role="note" style={{
      position: 'fixed', zIndex: 9999, left: 0, right: 0, top: 0, height: 'calc(4px + env(safe-area-inset-top))',
      background: staging ? '#E8893A' : '#5B8DEF', pointerEvents: 'none',
    }}>
      <span style={{
        position: 'fixed', top: 'calc(6px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
        font: '600 10px/1 var(--font-mono, monospace)', letterSpacing: '.18em', textTransform: 'uppercase',
        padding: '4px 8px', borderRadius: 999, background: staging ? '#E8893A' : '#5B8DEF', color: '#0B0B0C',
      }}>{staging ? 'Staging · test data' : 'Dev · test data'}</span>
    </div>
  );
}
