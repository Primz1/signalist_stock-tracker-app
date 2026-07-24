/**
 * Signalist toast helpers — P1 Toast Notification patterns (title + description + type)
 * via Sonner. Use these for watchlist / alerts / portfolio feedback.
 */
import { toast } from 'sonner';

type Desc = string | undefined;

function success(title: string, description?: Desc) {
  return toast.success(title, { description });
}

function error(title: string, description?: Desc) {
  return toast.error(title, { description });
}

function warning(title: string, description?: Desc) {
  return toast.warning(title, { description });
}

function info(title: string, description?: Desc) {
  return toast.info(title, { description });
}

export const notify = {
  success,
  error,
  warning,
  info,

  watchlistAdded(symbol: string) {
    const sym = symbol.toUpperCase();
    return success('Added to watchlist', `${sym} is now on your list.`);
  },

  watchlistRemoved(symbol: string) {
    const sym = symbol.toUpperCase();
    return success('Removed from watchlist', `${sym} was removed from your list.`);
  },

  watchlistFailed(action: 'add' | 'remove', message?: string) {
    return error(
      action === 'add' ? 'Couldn’t add to watchlist' : 'Couldn’t remove from watchlist',
      message || 'Something went wrong. Please try again.'
    );
  },

  alertCreated(symbol?: string) {
    return success(
      'Alert created',
      symbol ? `We’ll notify you when ${symbol.toUpperCase()} hits your level.` : 'Price alert is armed.'
    );
  },

  alertRemoved() {
    return success('Alert removed', 'That price alert is no longer active.');
  },

  alertUpdated(active: boolean) {
    return success(
      active ? 'Alert resumed' : 'Alert paused',
      active ? 'You’ll get notified again when the level hits.' : 'Notifications are paused for this alert.'
    );
  },

  alertFailed(message?: string) {
    return error('Alert failed', message || 'Something went wrong. Please try again.');
  },

  tradeFilled(side: string, symbol: string, detail?: string) {
    return success(
      `${side} filled`,
      detail || `${symbol.toUpperCase()} order completed.`
    );
  },

  tradeUndone() {
    return success('Trade undone', 'Your paper portfolio was reverted.');
  },

  researchReady(symbol?: string) {
    return success(
      'Quant research ready',
      symbol ? `Narrative and factors for ${symbol.toUpperCase()} are ready.` : 'Your report is ready to review.'
    );
  },
};
