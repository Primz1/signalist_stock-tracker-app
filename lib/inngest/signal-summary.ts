import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { explainSignal } from '@/lib/intelligence/explain';

const RETRY_AFTER = '5m';

const explain = async (signalId: string) => {
  await connectToDatabase();
  return (await explainSignal(signalId))?.source ?? null;
};

export const explainSignals = inngest.createFunction(
  // A signal can confirm and then weaken within minutes; explain the latest state once
  { id: 'explain-signal', debounce: { key: 'event.data.signalId', period: '2m' } },
  { event: 'app/signal.changed' },
  async ({ event, step }) => {
    const signalId = String(event.data.signalId);
    const first = await step.run('explain', () => explain(signalId));
    if (first !== 'deterministic') return { signalId, source: first };

    // Gemini overloads come and go. One later attempt usually gets an AI explanation.
    await step.sleep('wait-before-retry', RETRY_AFTER);
    const second = await step.run('retry-explain', () => explain(signalId));
    return { signalId, source: second, retried: true };
  }
);
