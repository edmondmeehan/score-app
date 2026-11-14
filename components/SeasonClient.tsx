'use client';
import { useEffect, useState } from 'react';
import SeasonLayer from './SeasonLayer';
import type { SeasonDef } from '@/lib/seasons';

/**
 * Seasonal theme on the client, so the root layout doesn't read cookies and public pages can be served from cache.
 * Everyone gets the scheduled season (already applied on <html> by the server). Staff previewing a season from
 * Admin → Themes have a short-lived "score_season_preview" cookie; this swaps the colors and layer to that season.
 */
export default function SeasonClient({ active, seasons }: { active: SeasonDef | null; seasons: SeasonDef[] }) {
  const [preview, setPreview] = useState<SeasonDef | null>(null);
  useEffect(() => {
    const key = document.cookie.match(/(?:^|; )score_season_preview=([a-z_]+)/)?.[1];
    const s = key ? seasons.find((x) => x.key === key) : null;
    if (!s) return;
    const el = document.documentElement;
    el.dataset.season = s.key;
    el.style.setProperty('--gold', s.accent);
    el.style.setProperty('--gold-light', s.accentLight);
    el.style.setProperty('--hero-glow', s.glow);
    setPreview(s);
  }, [seasons]);
  const s = preview || active;
  if (!s) return null;
  return <SeasonLayer seasonKey={s.key} name={s.name} banner={s.banner} effect={s.effect} preview={Boolean(preview)} />;
}
