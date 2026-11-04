import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { listSignals } from '@/lib/intelligence/queries';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Confirmed signals from the last 48 hours, newest change first. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const signals = await listSignals();
    return NextResponse.json({ signals, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    logError('signals list failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Signals are unavailable right now' }, { status: 503 });
  }
}
