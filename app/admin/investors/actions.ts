'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { CONTENT_DEFAULT, hashPassword, newSalt, type InvestorContent } from '@/lib/investors';
import { ASSUMPTIONS_DEFAULT, type Assumptions, type Market } from '@/lib/investorModel';

const back = (q: string, hash = '') => redirect(`/admin/investors?${q}${hash}`);
const msg = (e: { message: string }) => (/function|does not exist|schema cache/i.test(e.message) ? 'Run migration 0021 in the ScoreDate SQL Editor first.' : e.message);

export async function setInvestorPassword(form: FormData) {
  const { supabase } = await requireStaff();
  const pw = String(form.get('password') || '');
  const confirm = String(form.get('confirm') || '');
  if (pw.length < 10) back('error=' + encodeURIComponent('Use at least 10 characters.'), '#access');
  if (pw !== confirm) back('error=' + encodeURIComponent('The two passwords don’t match.'), '#access');
  const salt = newSalt();
  const { error } = await supabase.rpc('staff_set_investor_password', { p_hash: hashPassword(pw, salt), p_salt: salt });
  if (error) back('error=' + encodeURIComponent(msg(error)), '#access');
  revalidatePath('/admin/investors');
  back('ok=' + encodeURIComponent('Password saved. Anyone signed in has been signed out.'), '#access');
}

export async function signOutInvestors() {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('staff_signout_investors');
  if (error) back('error=' + encodeURIComponent(msg(error)), '#access');
  revalidatePath('/admin/investors');
  back('ok=' + encodeURIComponent('Everyone has been signed out of the investor room.'), '#access');
}

export async function saveInvestorContent(form: FormData) {
  const { supabase } = await requireStaff();
  const content = {} as InvestorContent;
  for (const k of Object.keys(CONTENT_DEFAULT) as (keyof InvestorContent)[]) {
    content[k] = String(form.get(k) ?? '').replace(/\r/g, '').trim().slice(0, 4000);
  }
  if (!content.disclaimer) back('error=' + encodeURIComponent('Keep the disclaimer. It protects you and the company.'), '#content');
  if (content.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.contact_email)) back('error=' + encodeURIComponent('Contact email doesn’t look right.'), '#content');
  const { error } = await supabase.rpc('staff_set_investor_data', { p_content: content, p_model: null });
  if (error) back('error=' + encodeURIComponent(msg(error)), '#content');
  revalidatePath('/admin/investors');
  back('ok=' + encodeURIComponent('Investor content saved.'), '#content');
}

const num = (f: FormData, k: string, d: number, pct = false) => {
  const raw = String(f.get(k) ?? '').replace(/[$,%\s]/g, '');
  const v = Number(raw);
  if (raw === '' || !Number.isFinite(v)) return d;
  return pct ? v / 100 : v;
};
const list = (f: FormData, k: string, d: number[], pct = false) => {
  const out = String(f.get(k) ?? '').split(/[,\n]/).map((x) => Number(x.replace(/[$,%\s]/g, ''))).filter((x) => Number.isFinite(x));
  return out.length ? out.map((x) => (pct ? x / 100 : x)) : d;
};

export async function saveInvestorModel(form: FormData) {
  const { supabase } = await requireStaff();
  if (form.get('reset') === '1') {
    const { error } = await supabase.rpc('staff_set_investor_data', { p_content: null, p_model: {} });
    if (error) back('error=' + encodeURIComponent(msg(error)), '#model');
    revalidatePath('/admin/investors');
    back('ok=' + encodeURIComponent('Model reset to the default assumptions.'), '#model');
  }
  const d = ASSUMPTIONS_DEFAULT;
  const markets: Market[] = [];
  const errs: string[] = [];
  for (const line of String(form.get('markets') || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [name, launch, target] = line.split('|').map((x) => x.trim());
    const l = Number(launch); const t = Number((target || '').replace(/,/g, ''));
    if (!name || !Number.isInteger(l) || l < 1 || l > 7 || !Number.isFinite(t) || t < 0) { errs.push(line); continue; }
    markets.push({ name: name.slice(0, 40), launch: l, target: Math.round(t) });
  }
  if (errs.length) back('error=' + encodeURIComponent(`Markets need “Name | launch year | members”. Check: ${errs.join('; ')}`), '#model');
  const m: Assumptions = {
    years: Math.min(7, Math.max(3, Math.round(num(form, 'years', d.years)))),
    markets: markets.length ? markets : d.markets,
    ramp: list(form, 'ramp', d.ramp, true),
    mix: { membership: num(form, 'mix_membership', d.mix.membership, true), premium: num(form, 'mix_premium', d.mix.premium, true), reserve: num(form, 'mix_reserve', d.mix.reserve, true) },
    price: { membership: num(form, 'price_membership', d.price.membership), premium: num(form, 'price_premium', d.price.premium), reserve: num(form, 'price_reserve', d.price.reserve), preview: num(form, 'price_preview', d.price.preview), paused: num(form, 'price_paused', d.price.paused) },
    discount: num(form, 'discount', d.discount, true),
    addon_pm: num(form, 'addon_pm', d.addon_pm),
    paused_share: num(form, 'paused_share', d.paused_share, true),
    previews_per_member: num(form, 'previews_per_member', d.previews_per_member),
    churn_m: num(form, 'churn_m', d.churn_m, true),
    store_fee: num(form, 'store_fee', d.store_fee, true),
    events_per_market: num(form, 'events_per_market', d.events_per_market),
    events_cost: num(form, 'events_cost', d.events_cost, true),
    verify_cost: num(form, 'verify_cost', d.verify_cost),
    infra_pm: num(form, 'infra_pm', d.infra_pm),
    infra_base: num(form, 'infra_base', d.infra_base),
    cac: num(form, 'cac', d.cac),
    launch_budget: num(form, 'launch_budget', d.launch_budget),
    payroll: list(form, 'payroll', d.payroll),
    ga_pct: num(form, 'ga_pct', d.ga_pct, true),
    ga_min: num(form, 'ga_min', d.ga_min),
  };
  const mixSum = m.mix.membership + m.mix.premium + m.mix.reserve;
  if (Math.abs(mixSum - 1) > 0.011) back('error=' + encodeURIComponent(`Plan mix should add up to 100% (now ${Math.round(mixSum * 100)}%).`), '#model');
  const { error } = await supabase.rpc('staff_set_investor_data', { p_content: null, p_model: m });
  if (error) back('error=' + encodeURIComponent(msg(error)), '#model');
  revalidatePath('/admin/investors');
  back('ok=' + encodeURIComponent('Model saved. The P&L has been recalculated.'), '#model');
}
