'use client';

import { useEffect, useState } from 'react';

/** Current time, ticking every `intervalMs`. Null until mounted so server and client render the same markup. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
