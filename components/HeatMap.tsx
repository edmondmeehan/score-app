'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type Spot = {
  name: string;
  kind: 'neighborhood' | 'borough' | 'area';
  lat: number;
  lng: number;
  level: 'growing' | 'busy' | 'hot' | null;
  open?: boolean;
  /** admin only: shown in the popup */
  detail?: string;
  /** admin only: scales the circle */
  weight?: number;
};

const COLOR: Record<string, string> = { growing: '#8A7442', busy: '#C9A961', hot: '#F0C96A' };
const LABEL: Record<string, string> = { growing: 'Growing', busy: 'Busy', hot: 'Hot' };
const RADIUS: Record<string, number> = { neighborhood: 650, borough: 2600, area: 9000 };

/** Dark map with soft gold glows. Never plots people, only groups. */
export type Tiles = { url: string; subdomains: string; attribution: string };
const DEFAULT_TILES: Tiles = { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' };

export default function HeatMap({ spots, height = 360, center = [40.735, -73.97], zoom = 11, tiles = DEFAULT_TILES }: { spots: Spot[]; height?: number; center?: [number, number]; zoom?: number; tiles?: Tiles }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, zoom);
      L.tileLayer(tiles.url, { maxZoom: 15, minZoom: 8, subdomains: tiles.subdomains, attribution: tiles.attribution }).addTo(map);
      const maxW = Math.max(1, ...spots.map((s) => s.weight || 0));
      for (const s of spots) {
        const color = s.level ? COLOR[s.level] : '#55545A';
        const r = s.weight !== undefined ? RADIUS[s.kind] * (0.5 + 0.9 * Math.sqrt(s.weight / maxW)) : RADIUS[s.kind] * (s.level === 'hot' ? 1.35 : s.level === 'busy' ? 1.15 : 1);
        // soft halo + core
        L.circle([s.lat, s.lng], { radius: r * 1.8, stroke: false, fillColor: color, fillOpacity: s.level ? 0.12 : 0.05, interactive: false }).addTo(map);
        const c = L.circle([s.lat, s.lng], { radius: r, color, weight: 1, opacity: 0.7, fillColor: color, fillOpacity: s.level ? 0.35 : 0.12 }).addTo(map);
        const status = s.detail ?? (s.level ? LABEL[s.level] : s.open === false ? 'Opening soon' : 'Just getting started');
        c.bindPopup(`<strong>${s.name.replace(/</g, '&lt;')}</strong><br><span style="opacity:.75">${status.replace(/</g, '&lt;')}</span>`);
      }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [spots, center, zoom, tiles.url]);
  return <div ref={el} className="heatmap" style={{ height, width: '100%', borderRadius: 18, overflow: 'hidden', border: '1px solid #26262A', background: '#0B0B0C' }} />;
}

export function Legend() {
  return (
    <div className="row small muted" style={{ gap: 14, flexWrap: 'wrap' }}>
      {(['growing', 'busy', 'hot'] as const).map((l) => (
        <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: COLOR[l] }} />{LABEL[l]}</span>
      ))}
    </div>
  );
}
