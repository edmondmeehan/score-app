import 'server-only';
import { getIntegration } from '@/lib/integrations';

export type Basemap = { url: string; subdomains: string; attribution: string };

const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const STYLES = ['dark_all', 'dark_nolabels', 'light_all', 'light_nolabels', 'rastertiles/voyager'];

/** CARTO basemap from admin → Integrations, falling back to the public dark basemap. */
export async function getBasemap(): Promise<Basemap> {
  const c = await getIntegration('carto').catch(() => null);
  const style = STYLES.includes(c?.config.style) ? c!.config.style : 'dark_all';
  const key = c?.secrets.api_key || process.env.CARTO_API_KEY || '';
  let url = String(c?.config.tile_url || '').trim();
  if (!/^https:\/\/[^\s]+\{z\}[^\s]*\{x\}[^\s]*\{y\}/.test(url)) url = '';
  if (url) url = url.replace('{key}', encodeURIComponent(key)).replace('{style}', style);
  return { url: url || `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, subdomains: 'abcd', attribution: ATTR };
}

/** Admin test: fetch one tile over Manhattan. */
export async function testCarto(): Promise<string> {
  const b = await getBasemap();
  const tile = b.url.replace('{s}', 'a').replace('{z}', '11').replace('{x}', '603').replace('{y}', '769').replace('{r}', '');
  const res = await fetch(tile, { cache: 'no-store' });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) throw new Error(`CARTO returned ${res.status}${type ? ` (${type})` : ''}. Check the tile URL and token.`);
  return 'Tiles load. Maps are using your CARTO account.';
}
