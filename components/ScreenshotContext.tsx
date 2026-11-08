'use client';
import { useEffect } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Tells the screenshot tracker what's on screen (e.g. whose profile). */
export default function ScreenshotContext({ context, target }: { context: string; target: string | null }) {
  useEffect(() => {
    (window as any).__scoreShot = { context, target };
    return () => { (window as any).__scoreShot = undefined; };
  }, [context, target]);
  return null;
}
