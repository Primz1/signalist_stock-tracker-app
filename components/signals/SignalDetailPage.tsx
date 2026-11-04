'use client';

import type { SignalDetailView } from '@/lib/intelligence/queries';
import { SignalDetail } from './SignalDetail';
import { useNow } from './useNow';

export function SignalDetailPage({ signal }: { signal: SignalDetailView }) {
  const now = useNow();
  return <SignalDetail signal={signal} now={now} />;
}
