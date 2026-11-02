import { connectToDatabase } from '@/database/mongoose';
import { MarketSnapshotModel } from '@/database/models/marketSnapshot.model';
import { getLastSignalTimes, publishEvent } from '@/lib/events/publisher';
import { EVENT_TYPES } from '@/lib/events/types';
import { applyCooldown, detectSignals, type DetectedSignal, type SignalSnapshot } from './signals';

const HISTORY_SIZE = 20;

/** Runs detection on a symbol's latest snapshots and publishes anything new. */
export async function detectAndPublishSignals(symbol: string): Promise<DetectedSignal[]> {
  await connectToDatabase();
  const docs = await MarketSnapshotModel.find({ symbol })
    .sort({ timestamp: -1 })
    .limit(HISTORY_SIZE)
    .select('price ohlcv indicators')
    .lean();
  if (docs.length < 2) return [];

  const history = docs.reverse() as unknown as SignalSnapshot[];
  const now = Date.now();
  const signals = applyCooldown(detectSignals(history), await getLastSignalTimes(symbol), now);

  const price = history[history.length - 1].price;
  await Promise.all(
    signals.map((signal) =>
      publishEvent({
        type: EVENT_TYPES.SIGNAL_DETECTED,
        payload: { symbol, price, timestamp: new Date(now).toISOString(), ...signal },
      })
    )
  );
  return signals;
}
