import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { explainSignal } from '@/lib/intelligence/explain';

export const explainSignals = inngest.createFunction(
  // A signal can confirm and then weaken within minutes; explain the latest state once
  { id: 'explain-signal', debounce: { key: 'event.data.signalId', period: '2m' } },
  { event: 'app/signal.changed' },
  async ({ event }) => {
    await connectToDatabase();
    const explanation = await explainSignal(String(event.data.signalId));
    return { signalId: event.data.signalId, source: explanation?.source ?? null };
  }
);
