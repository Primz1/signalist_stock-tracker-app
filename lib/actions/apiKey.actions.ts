'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { createApiKey, listApiKeys } from '@/database/models/apiKey.model';

export async function generateDeveloperApiKey(name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { success: false as const, message: 'Not authenticated' };

  await connectToDatabase();
  const { raw, keyPrefix } = await createApiKey(session.user.id, name || 'Default');
  return { success: true as const, data: { key: raw, keyPrefix } };
}

export async function getDeveloperApiKeys() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { success: false as const, message: 'Not authenticated' };

  await connectToDatabase();
  const keys = await listApiKeys(session.user.id);
  return { success: true as const, data: keys };
}
