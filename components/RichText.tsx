import Link from 'next/link';
import { Fragment } from 'react';

/** Tiny renderer for **bold** and [links](href) in policy copy. */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const b = p.match(/^\*\*([^*]+)\*\*$/);
        if (b) return <strong key={i}>{b[1]}</strong>;
        const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (l) return l[2].startsWith('/') ? <Link key={i} href={l[2]}>{l[1]}</Link> : <a key={i} href={l[2]} target={l[2].startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{l[1]}</a>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
