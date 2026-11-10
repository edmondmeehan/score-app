/**
 * Which admin areas each staff role can open (Admin → Admins sets the role). Owners can open everything.
 * Enforced in the admin layout (server) and used to hide links in the admin menu.
 */
export type StaffRole = 'owner' | 'moderator' | 'verification' | 'community' | 'matchmaker';

const ACCESS: Record<Exclude<StaffRole, 'owner'>, string[]> = {
  moderator: ['/admin/members', '/admin/moderation', '/admin/videos', '/admin/flags', '/admin/screenshots', '/admin/support', '/admin/deletions', '/admin/wellbeing', '/admin/verification'],
  verification: ['/admin/verification', '/admin/videos', '/admin/members', '/admin/moderation'],
  community: ['/admin/events', '/admin/giveaways', '/admin/content', '/admin/featured', '/admin/scan', '/admin/date-challenge', '/admin/waitlist', '/admin/zips', '/admin/assets', '/admin/campaigns', '/admin/messages', '/admin/themes', '/admin/map', '/admin/analytics', '/admin/partners'],
  matchmaker: ['/admin/reserve', '/admin/members'],
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner · everything, including billing, integrations, investors and admins',
  moderator: 'Moderator · members, reports, photos, support and deletions',
  verification: 'Verification · ID and photo review',
  community: 'Community · events, giveaways, content, waitlist and campaigns',
  matchmaker: 'Matchmaker · Reserve members',
};

export function canOpen(role: string | null | undefined, path: string): boolean {
  if (role === 'owner') return true;
  if (!role || !(role in ACCESS)) return false;
  if (path === '/admin' || path === '/admin/') return true; // overview
  return ACCESS[role as Exclude<StaffRole, 'owner'>].some((p) => path === p || path.startsWith(p + '/'));
}
