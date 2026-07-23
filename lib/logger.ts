type LogMeta = Record<string, string | number | boolean | undefined>;

export function logInfo(message: string, meta?: LogMeta) {
  console.log(JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() }));
}

export function logError(message: string, meta?: LogMeta) {
  console.error(JSON.stringify({ level: 'error', message, ...meta, ts: new Date().toISOString() }));
}

export async function withTiming<T>(label: string, fn: () => Promise<T>, meta?: LogMeta): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logInfo(label, { ...meta, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    logError(`${label} failed`, {
      ...meta,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
