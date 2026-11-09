'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Smooth navigation feedback for the web and the iPhone app (which has no browser loading bar):
 *  - a thin gold progress line at the top while a new screen loads,
 *  - a small spinner on any submit button while its form is saving (and no double taps).
 */
export default function NavProgress() {
  const path = usePathname();
  const params = useSearchParams();
  const bar = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const start = () => {
    const el = bar.current; if (!el) return;
    clear();
    el.style.transition = 'none'; el.style.width = '0%'; el.classList.add('on');
    void el.offsetWidth;
    el.style.transition = '';
    el.style.width = '30%';
    timers.current.push(setTimeout(() => { el.style.width = '60%'; }, 400));
    timers.current.push(setTimeout(() => { el.style.width = '82%'; }, 1500));
    timers.current.push(setTimeout(done, 12000)); // never hang forever
  };
  const done = () => {
    const el = bar.current; if (!el) return;
    clear();
    if (!el.classList.contains('on')) return;
    el.style.width = '100%';
    timers.current.push(setTimeout(() => { el.classList.remove('on'); el.style.width = '0%'; }, 250));
    document.querySelectorAll('.is-busy').forEach((b) => b.classList.remove('is-busy'));
  };

  // A new screen (or query) arrived: finish the bar and release busy buttons.
  useEffect(() => { done(); }, [path, params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same screen or just a #hash
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      // Runs after React has read the form, so marking the button busy can't change what gets sent.
      const btn = (e.submitter as HTMLElement | null) || (e.target as HTMLFormElement)?.querySelector?.('button:not([type=button])');
      if (btn) {
        btn.classList.add('is-busy');
        setTimeout(() => btn.classList.remove('is-busy'), 10000);
      }
      start();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    const onPop = () => start();
    window.addEventListener('popstate', onPop);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('submit', onSubmit); window.removeEventListener('popstate', onPop); clear(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={bar} className="navbar-progress" role="progressbar" aria-hidden />;
}
