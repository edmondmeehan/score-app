export type Post = {
  id: string; kind: 'credit_tip' | 'dating_tip' | 'news' | 'perk'; title: string; body: string | null;
  source_name: string | null; url: string | null; partner_name: string | null; perk_code: string | null;
  status: 'draft' | 'published'; pinned: boolean; published_at: string | null; created_at: string;
};
export type Story = { id: string; headline: string; story: string; names: string | null; created_at: string };

export const KIND_LABEL: Record<Post['kind'], string> = { credit_tip: 'Credit tip', dating_tip: 'Dating tip', news: 'News', perk: 'Partner perk' };
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '');
export const host = (url: string | null) => { try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
