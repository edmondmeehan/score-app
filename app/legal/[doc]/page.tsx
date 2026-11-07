import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import DocLayout from '@/components/DocLayout';
import RichText from '@/components/RichText';
import { DOCS } from '@/lib/docs';

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = DOCS[doc];
  return d ? { title: `${d.title} · Score`, description: d.summary } : {};
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (doc === 'safety') redirect('/safety');
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <DocLayout eyebrow={d.eyebrow} title={d.title} summary={d.summary} updated={d.updated} toc={d.sections}>
      {d.draft && <div className="doc-draft">Draft for review. This text is being finalized with counsel before launch.</div>}
      {d.sections.map((s) => (
        <section key={s.id} id={s.id}>
          <h2>{s.h}</h2>
          {s.body.map((b, i) =>
            typeof b === 'string' ? <p key={i}><RichText text={b} /></p>
              : 'ul' in b ? <ul key={i}>{b.ul.map((li, j) => <li key={j}><RichText text={li} /></li>)}</ul>
              : <h3 key={i}>{b.h3}</h3>)}
        </section>
      ))}
    </DocLayout>
  );
}
