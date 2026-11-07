import 'server-only';
import { getIntegration } from '@/lib/integrations';

export type Basemap = { url: string; subdomains: string; attribution: string };

const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const STYLES = ['dark_all', 'dark_nolabels', 'light_all', 'light_nolabels', 'voyager'];

/** CARTO raster basemap. Since Sept 2026 every tile needs ?key= (a CARTO Basemaps key). */
export async function getBasemap(): Promise<Basemap> {
  const c = await getIntegration('carto').catch(() => null);
  const style = STYLES.includes(c?.config.style) ? c!.config.style : 'dark_all';
  const key = (c?.secrets.api_key || process.env.CARTO_BASEMAPS_KEY || '').trim();
  let url = String(c?.config.tile_url || '').trim();
  if (!/^https:\/\/[^\s]+\{z\}[^\s]*\{x\}[^\s]*\{y\}/.test(url)) url = '';
  if (!url) url = `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png`;
  url = url.replace('{style}', style);
  if (key) url = url.includes('{key}') ? url.replace('{key}', encodeURIComponent(key)) : url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
  return { url, subdomains: 'abcd', attribution: ATTR };
}

/** Admin test: fetch one tile over Manhattan, sending our site as the Referer like a browser would. */
export async function testCarto(): Promise<string> {
  const b = await getBasemap();
  if (!b.url.includes('key=')) throw new Error('Add your CARTO Basemaps key first.');
  const tile = b.url.replace('{s}', 'a').replace('{z}', '11').replace('{x}', '603').replace('{y}', '769').replace('{r}', '');
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.scoredate.app';
  const res = await fetch(tile, { cache: 'no-store', headers: { Referer: site.replace(/\/?$/, '/') } });
  const type = res.headers.get('content-type') || '';
  if (res.status === 403) throw new Error('CARTO refused the key (403). Check the key is pasted exactly and that scoredate.app and www.scoredate.app are both in its website restrictions.');
  if (!res.ok || !type.startsWith('image/')) throw new Error(`CARTO returned ${res.status}${type ? ` (${type})` : ''}.`);
  return 'Tiles load with your key. All maps are using it now.';
}
