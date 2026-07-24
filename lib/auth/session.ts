import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';

/** One session lookup per React request — shared across layout + all server actions. */
export const getCachedSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getCachedUser = cache(async () => {
  const session = await getCachedSession();
  return session?.user ?? null;
});
