import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { getSignalDetail } from '@/lib/intelligence/queries';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SIGNAL_ID = /^[A-Z0-9.:-]{1,24}-(?:up|down|neutral)-\d{9,11}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ signalId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { signalId } = await params;
  if (!SIGNAL_ID.test(signalId)) return NextResponse.json({ error: 'Invalid signal id' }, { status: 400 });
  try {
    const signal = await getSignalDetail(signalId);
    if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    return NextResponse.json({ signal }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    logError('signal detail failed', { signalId, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Signal is unavailable right now' }, { status: 503 });
  }
}
