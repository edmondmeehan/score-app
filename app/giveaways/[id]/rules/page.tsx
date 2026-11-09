import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DocLayout from '@/components/DocLayout';
import { supabaseServer } from '@/lib/supabase/server';
import { officialRules, type Giveaway } from '@/lib/giveaways';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Official rules · ScoreDate giveaway' };

export default async function Rules({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.from('giveaways').select('*').eq('id', id).maybeSingle();
  const g = data as Giveaway | null;
  if (!g) notFound();
  const rules = officialRules(g);
  const toc = rules.map((r, i) => ({ id: `r${i}`, h: r.h }));
  return (
    <DocLayout eyebrow="Official rules" title={g.title} summary={`Sponsored by ScoreDate, LLC. No purchase necessary. Apple is not a sponsor.`} updated={new Date(g.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })} toc={toc}>
      {rules.map((r, i) => <section key={i} id={`r${i}`}><h2>{r.h}</h2>{r.p.map((t, j) => <p key={j}>{t}</p>)}</section>)}
    </DocLayout>
  );
}
