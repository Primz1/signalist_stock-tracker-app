'use server';

import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { getUserProfile, upsertUserProfile } from '@/database/models/userProfile.model';
import { auth } from '@/lib/better-auth/auth';

type ActionResult<T> = { success: true; data: T } | { success: false; message: string };

const getSessionUser = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user || null;
};

export async function saveUserProfileOnSignUp(params: {
  userId: string;
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
}) {
  await connectToDatabase();
  return upsertUserProfile(params);
}

export async function getProfile(): Promise<ActionResult<Record<string, unknown> | null>> {
  try {
    const user = await getSessionUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    await connectToDatabase();
    const profile = await getUserProfile(user.id);
    return { success: true, data: profile as Record<string, unknown> | null };
  } catch (err) {
    return { success: false, message: 'Failed to load profile' };
  }
}

export async function updateProfile(params: {
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const user = await getSessionUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    await connectToDatabase();
    const profile = await upsertUserProfile({ userId: user.id, ...params });
    return { success: true, data: profile as Record<string, unknown> };
  } catch (err) {
    return { success: false, message: 'Failed to update profile' };
  }
}
