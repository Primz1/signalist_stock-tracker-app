/** Leaves headroom under Finnhub's free limit of 60 calls per minute. */
export const POLL_CALL_BUDGET = 50;

/**
 * Picks the symbols to quote this minute. Alert symbols always go first and cost
 * two calls, because the alert sweep quotes them again. The rest rotate through
 * whatever budget remains, so every tracked symbol gets a turn.
 */
export function selectPollSymbols(
  alertSymbols: string[],
  trackedSymbols: string[],
  tick: number,
  budget = POLL_CALL_BUDGET
) {
  const priority = Array.from(new Set(alertSymbols)).slice(0, Math.floor(budget / 2));
  const chosen = new Set(priority);
  const rest = Array.from(new Set(trackedSymbols))
    .filter((symbol) => !chosen.has(symbol))
    .sort();
  const slots = Math.min(budget - priority.length * 2, rest.length);
  const offset = rest.length ? (tick * slots) % rest.length : 0;
  const rotated = Array.from({ length: slots }, (_, i) => rest[(offset + i) % rest.length]);
  return [...priority, ...rotated];
}
