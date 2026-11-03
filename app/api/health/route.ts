import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { MarketSnapshotModel } from '@/database/models/marketSnapshot.model';
import { pingAiService } from '@/lib/ai/service';

export const dynamic = 'force-dynamic';

const STALE_PIPELINE_MS = 10 * 60 * 1000;

async function databaseCheck() {
  try {
    await connectToDatabase();
    const latest = await MarketSnapshotModel.findOne().sort({ timestamp: -1 }).select('timestamp').lean();
    return { ok: true, lastSnapshotAt: latest?.timestamp ?? null };
  } catch {
    return { ok: false, lastSnapshotAt: null };
  }
}

/** Reports what is configured and reachable. Contains no secrets, so it can stay public. */
export async function GET() {
  const [database, ai] = await Promise.all([databaseCheck(), pingAiService()]);
  const inngestConfigured = Boolean(process.env.INNGEST_SIGNING_KEY && process.env.INNGEST_EVENT_KEY);
  const pipelineFresh =
    database.lastSnapshotAt != null && Date.now() - new Date(database.lastSnapshotAt).getTime() < STALE_PIPELINE_MS;

  return NextResponse.json(
    {
      // AI is enrichment, so only the database makes the app unhealthy
      status: database.ok ? 'ok' : 'degraded',
      database: database.ok,
      inngestConfigured,
      pipeline: { fresh: pipelineFresh, lastSnapshotAt: database.lastSnapshotAt },
      ai: { reachable: Boolean(ai), provider: ai?.ai_provider ?? null },
      time: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
