'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/session';
import { setAttackMode, setBotProtection, setAiBots } from '@/lib/vercelSecurity';

async function log(action: string, reason: string) {
  const { supabase, staffEmail } = await requireStaff();
  // Best effort: the audit log shouldn't block a security change.
  await supabase.from('audit_log').insert({ staff_email: staffEmail, action, reason }).then(() => null, () => null);
}

function done(msg: string, err?: unknown): never {
  revalidatePath('/admin/security');
  redirect('/admin/security?' + (err ? 'error=' + encodeURIComponent((err as Error).message) : 'ok=' + encodeURIComponent(msg)));
}

export async function attackMode(form: FormData) {
  await requireStaff();
  const hours = Number(form.get('hours'));
  if (![0, 1, 6, 24].includes(hours)) done('', new Error('Pick 1, 6 or 24 hours.'));
  try { await setAttackMode(hours); } catch (e) { done('', e); }
  await log(hours ? 'attack_mode_on' : 'attack_mode_off', hours ? `${hours}h` : 'off');
  done(hours ? `Browser check is on for ${hours} hour${hours === 1 ? '' : 's'}.` : 'Browser check is off.');
}

export async function botProtection(form: FormData) {
  await requireStaff();
  const on = form.get('on') === 'true';
  try { await setBotProtection(on); } catch (e) { done('', e); }
  await log(on ? 'bot_protection_on' : 'bot_protection_off', '');
  done(on ? 'Bot protection is on.' : 'Bot protection is off.');
}

export async function aiBots(form: FormData) {
  await requireStaff();
  const on = form.get('on') === 'true';
  try { await setAiBots(on); } catch (e) { done('', e); }
  await log(on ? 'ai_bots_block_on' : 'ai_bots_block_off', '');
  done(on ? 'AI crawlers are blocked.' : 'AI crawlers are allowed.');
}
