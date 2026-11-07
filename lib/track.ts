import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, VISITOR_COOKIE, sendEvent } from '@/lib/analytics';

/** Record a named event (waitlist_join, plan_chosen, …) from a server action, tied to the visitor's session. */
export async function trackEvent(name: string, userId?: string | null) {
  try {
    const jar = await cookies();
    await sendEvent({
      name,
      visitor_id: jar.get(VISITOR_COOKIE)?.value ?? null,
      session_id: jar.get(SESSION_COOKIE)?.value ?? null,
      user_id: userId ?? null,
    });
  } catch { /* never block the action */ }
}
