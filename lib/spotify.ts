import 'server-only';
import { getIntegration } from '@/lib/integrations';

export type Track = { id: string; title: string; artist: string | null; image: string | null };

let token: { value: string; exp: number } | null = null;

async function creds() {
  const s = await getIntegration('spotify');
  const id = s.config.client_id || process.env.SPOTIFY_CLIENT_ID;
  const secret = s.secrets.client_secret || process.env.SPOTIFY_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export async function spotifyConfigured() {
  return Boolean(await creds());
}

/** App-only token (Client Credentials flow). Members never connect their own Spotify account. */
async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 30_000) return token.value;
  const c = await creds();
  if (!c) throw new Error('Spotify is not set up');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${c.id}:${c.secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error_description || `Spotify error ${res.status}`);
  token = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return token.value;
}

const toTrack = (t: any): Track => ({
  id: t.id,
  title: t.name,
  artist: (t.artists || []).map((a: any) => a.name).join(', ') || null,
  image: t.album?.images?.slice(-2)[0]?.url || t.album?.images?.[0]?.url || null,
});

export async function searchTracks(q: string): Promise<Track[]> {
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Spotify error ${res.status}`);
  return (body.tracks?.items || []).map(toTrack);
}

/** Look up one track. Uses the API when connected, otherwise Spotify's public oEmbed (title + cover only). */
export async function getTrack(id: string): Promise<Track | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;
  if (await spotifyConfigured()) {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${await accessToken()}` }, cache: 'no-store' });
    if (res.ok) return toTrack(await res.json());
  }
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const o = await res.json();
  return { id, title: o.title || 'Song', artist: null, image: o.thumbnail_url || null };
}

/** Accepts a Spotify track link, a spotify:track: URI, or a bare id. */
export function parseTrackId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/track[/:]([A-Za-z0-9]{22})/) || s.match(/^([A-Za-z0-9]{22})$/);
  return m ? m[1] : null;
}

export async function testSpotify(): Promise<string> {
  await accessToken();
  const r = await searchTracks('Fleetwood Mac Dreams');
  return `Connected. Search works (${r.length} results).`;
}
