import { inngest } from '@/lib/inngest/client';
import { createWhatsChangedReport } from '@/lib/ai/whats-changed';

export const summarizeSignals = inngest.createFunction(
  // Waits for a quiet spell so a burst of signals produces one summary
  { id: 'summarize-signals', debounce: { key: 'event.data.symbol', period: '30m' } },
  { event: 'app/signals.detected' },
  async ({ event, step }) => {
    const symbol = String(event.data.symbol);
    await step.run('create-report', async () => {
      await createWhatsChangedReport(symbol);
    });
    return { symbol };
  }
);
