import { connectToDatabase } from '@/database/mongoose';

export async function getUserEmailById(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return null;

    const user = await db.collection('user').findOne<{ email?: string; id?: string }>({ id: userId });
    return user?.email ?? null;
  } catch {
    return null;
  }
}
