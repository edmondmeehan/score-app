export type EventRow = {
  id: string; title: string; description: string | null; venue: string; address: string | null; area: string;
  starts_at: string; ends_at: string | null; capacity: number; price_note: string | null; black_priority_hours: number;
  status: 'draft' | 'published' | 'cancelled'; published_at: string | null;
};

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
