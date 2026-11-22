'use client';
import { usePathname } from 'next/navigation';
import type { AppEnv } from '@/lib/appEnv';

const ENVS: { env: AppEnv; label: string; url: string }[] = [
  { env: 'dev', label: 'Dev', url: 'https://dev.scoredate.app' },
  { env: 'staging', label: 'Staging', url: 'https://staging.scoredate.app' },
  { env: 'live', label: 'Live', url: 'https://www.scoredate.app' },
];

/** Dev / Staging / Live switch at the top of the admin. Opens the same admin page on the other copy. */
export default function EnvSwitch({ current }: { current: AppEnv }) {
  const path = usePathname() || '/admin';
  return (
    <div className="env-switch" role="group" aria-label="Which copy of ScoreDate">
      {ENVS.map((e) => e.env === current
        ? <span key={e.env} className={`on env-${e.env}`} aria-current="true">{e.label}</span>
        : <a key={e.env} href={e.url + path} title={`Open this page on ${e.label.toLowerCase()} (${e.env === 'live' ? 'real members' : 'test data'})`}>{e.label}</a>)}
    </div>
  );
}
