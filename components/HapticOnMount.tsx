'use client';
import { useEffect } from 'react';
import { haptic, type HapticKind } from '@/lib/haptics';

export default function HapticOnMount({ kind }: { kind: HapticKind }) {
  useEffect(() => { haptic(kind); }, [kind]);
  return null;
}
