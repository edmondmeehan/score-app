'use client';
import { useEffect, useRef, useState } from 'react';
import { resolvedTheme } from './ThemeSwitch';
import 'leaflet/dist/leaflet.css';
import type { Tiles } from './HeatMap';

/**
 * Same dark CARTO basemap as the member heat map. exact = a gold pin on the venue;
 * otherwise a soft gold circle over the neighborhood (the address stays private until you RSVP).
 */
export default function EventMap({ lat, lng, exact, label, tiles, height = 240 }: { lat: number; lng: number; exact: boolean; label: string; tiles: Tiles; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [light, setLight] = useState(false);
  useEffect(() => {
    const update = () => setLight(resolvedTheme() === 'light');
    update();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    window.addEventListener('score-theme', update); mq.addEventListener('change', update);
    return () => { window.removeEventListener('score-theme', update); mq.removeEventListener('change', update); };
  }, []);
  const tileUrl = light ? tiles.url.replace('dark_all', 'light_all').replace('dark_nolabels', 'light_nolabels') : tiles.url;
  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false } as import('leaflet').MapOptions)
        .setView([lat, lng], exact ? 15 : 14);
      L.tileLayer(tileUrl, { maxZoom: 18, minZoom: 10, subdomains: tiles.subdomains, attribution: tiles.attribution }).addTo(map);
      const gold = light ? '#A07F2E' : '#C9A961';
      if (exact) {
        L.circle([lat, lng], { radius: 140, stroke: false, fillColor: gold, fillOpacity: 0.18, interactive: false }).addTo(map);
        const icon = L.divIcon({ className: 'event-pin', html: '<span class="event-pin-dot"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
        L.marker([lat, lng], { icon, title: label, keyboard: false }).addTo(map);
      } else {
        L.circle([lat, lng], { radius: 900, stroke: false, fillColor: gold, fillOpacity: 0.12, interactive: false }).addTo(map);
        L.circle([lat, lng], { radius: 520, color: gold, weight: 1, opacity: 0.6, fillColor: gold, fillOpacity: 0.22, interactive: false }).addTo(map);
      }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [lat, lng, exact, label, tileUrl, light, tiles.subdomains, tiles.attribution]);
  return <div ref={el} className="heatmap" role="img" aria-label={exact ? `Map showing ${label}` : 'Map showing the event’s neighborhood'} style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line-soft)', background: 'var(--onyx)' }} />;
}
