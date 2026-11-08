export type EventRow = {
  id: string; title: string; description: string | null; venue: string; address: string | null; area: string;
  starts_at: string; ends_at: string | null; capacity: number; price_note: string | null; black_priority_hours: number; founders_only?: boolean;
  status: 'draft' | 'published' | 'cancelled'; published_at: string | null;
  place_id?: string | null; lat?: number | null; lng?: number | null;
  image_path?: string | null; host?: string | null; dress_code?: string | null;
};

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

const NY = 'America/New_York';
export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: NY });
export const dayParts = (iso: string) => {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: NY }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: NY }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: NY }),
  };
};

/** "Tonight", "Tomorrow", "In 3 days", "Happening now" (New York calendar days). */
export function countdown(startIso: string, endIso?: string | null) {
  const now = Date.now(), start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : start + 3 * 3600000;
  if (now >= start && now <= end) return 'Happening now';
  if (now > end) return 'Ended';
  const key = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: NY });
  const days = Math.round((Date.parse(key(start)) - Date.parse(key(now))) / 86400000);
  if (days === 0) return Number(new Date(start).toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: NY })) >= 17 ? 'Tonight' : 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return `In ${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`;
}

/** Public URL for a header image in the 'events' storage bucket. */
export const eventImage = (path?: string | null) =>
  !path ? null : path.startsWith('/events/headers/') ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/events/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Rough location (about 1 km) for people who haven't RSVP'd: the exact spot stays private until you're going. */
export const approx = (n?: number | null) => (n == null ? null : Math.round(n * 100) / 100);
