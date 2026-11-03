import { connectToDatabase } from "@/database/mongoose";
import { listActiveAlerts, Alert } from "@/database/models/alert.model";
import { addAlertNotification } from "@/database/models/alertNotification.model";
import { sendPriceAlertEmail } from "@/lib/nodemailer";
import { getUserEmailById } from "@/lib/actions/userLookup";
import { logError } from "@/lib/logger";
import { publishEvent } from "@/lib/events/publisher";
import { EVENT_TYPES } from "@/lib/events/types";
import { marketData, type Quote } from "@/lib/market/service";
import { normalizeMarketSymbol } from "@/lib/market/symbols";

const shouldNotify = (frequency: 'once' | 'per_hour' | 'per_day', lastNotifiedAt?: Date) => {
  if (!lastNotifiedAt) return true;
  const now = Date.now();
  const last = new Date(lastNotifiedAt).getTime();
  const diff = now - last;
  if (frequency === 'once') return false;
  if (frequency === 'per_hour') return diff >= 60 * 60 * 1000;
  if (frequency === 'per_day') return diff >= 24 * 60 * 60 * 1000;
  return true;
};

const evaluateAlerts = async (
  alerts: Awaited<ReturnType<typeof listActiveAlerts>>,
  prefetched: Map<string, Quote> = new Map()
) => {
  if (!alerts || alerts.length === 0) return { success: true, triggered: 0, message: "No active alerts" };

  const symbols = Array.from(new Set(alerts.map((a) => a.symbol?.toUpperCase()).filter(Boolean)));
  const missing = symbols.filter((sym) => !prefetched.has(sym));
  const priceMap = new Map([...prefetched, ...(await marketData.getQuotes(missing))]);

  const now = new Date();
  let triggered = 0;

  for (const alert of alerts) {
    const symUpper = (alert.symbol || "").toUpperCase();
    const quote = priceMap.get(normalizeMarketSymbol(symUpper));
    if (!quote?.price) continue;

    const hit = alert.condition === "gt" ? quote.price >= alert.threshold : quote.price <= alert.threshold;
    if (!hit) continue;
    if (!shouldNotify(alert.frequency, alert.lastNotifiedAt)) continue;

    try {
      await addAlertNotification({
        userId: alert.userId,
        alertId: String(alert._id),
        symbol: symUpper,
        company: alert.company,
        message: `${symUpper} is ${alert.condition === "gt" ? "above" : "below"} ${alert.threshold}`,
        price: quote.price,
        changePercent: quote.changePercent,
        triggeredAt: now,
      });
    } catch (err) {
      logError("alert notification insert failed", { alertId: String(alert._id) });
    }

    try {
      await publishEvent({
        type: EVENT_TYPES.ALERT_TRIGGERED,
        userId: alert.userId,
        payload: {
          alertId: String(alert._id),
          symbol: symUpper,
          company: alert.company,
          message: `${symUpper} is ${alert.condition === "gt" ? "above" : "below"} ${alert.threshold}`,
          price: quote.price,
          changePercent: quote.changePercent,
          timestamp: now.toISOString(),
        },
      });
    } catch (err) {
      logError("alert event publish failed", { alertId: String(alert._id) });
    }

    try {
      const email = await getUserEmailById(alert.userId);
      if (email) {
        await sendPriceAlertEmail({
          email,
          symbol: symUpper,
          company: alert.company,
          condition: alert.condition,
          threshold: alert.threshold,
          price: quote.price,
        });
      }
    } catch (err) {
      logError("alert email failed", { alertId: String(alert._id) });
    }

    try {
      await Alert.updateOne(
        { _id: alert._id },
        {
          $set: {
            lastTriggeredAt: now,
            lastNotifiedAt: now,
            lastPrice: quote.price,
            lastChangePercent: quote.changePercent,
            ...(alert.frequency === "once" ? { isActive: false } : {}),
          },
        }
      );
    } catch (err) {
      console.error("alert update failed", alert._id, err);
    }

    triggered += 1;
  }

  return { success: true, triggered };
};

/**
 * Runs from the price poller. A second cron here would evaluate every alert twice.
 * Quotes the poller already fetched are reused, so each symbol costs one provider call.
 */
export const runAlertSweep = async (prefetched?: Map<string, Quote>) => {
  await connectToDatabase();
  const alerts = await listActiveAlerts();
  return evaluateAlerts(alerts, prefetched);
};
