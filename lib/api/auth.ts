import { NextRequest } from 'next/server';
import { validateApiKey } from '@/database/models/apiKey.model';
import { connectToDatabase } from '@/database/mongoose';

export async function authenticateApiRequest(request: NextRequest) {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key');
  if (!key) return null;

  await connectToDatabase();
  return validateApiKey(key);
}
