const DEFAULT_TIMEOUT_MS = 20_000;

/** The AI service is enrichment: callers catch this and carry on without it. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

export const aiServiceUrl = () => process.env.FASTAPI_URL || 'http://localhost:8000';

type AiRequestOptions = {
  timeoutMs?: number;
  /** Seconds to cache the response. Default is no caching. */
  revalidate?: number;
};

export async function postToAiService<T>(path: string, body: unknown, options: AiRequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, revalidate } = options;

  let res: Response;
  try {
    res = await fetch(`${aiServiceUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      ...(revalidate ? { next: { revalidate } } : { cache: 'no-store' as const }),
    });
  } catch (err) {
    throw new AiServiceError(err instanceof Error ? err.message : 'AI service unreachable');
  }

  if (!res.ok) throw new AiServiceError(`AI service error (${res.status})`, res.status);
  return (await res.json()) as T;
}

/** Returns the service's /health body, or null if it doesn't answer in time. */
export async function pingAiService(timeoutMs = 5_000) {
  try {
    const res = await fetch(`${aiServiceUrl()}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    return res.ok ? ((await res.json()) as { status: string; ai_provider?: string }) : null;
  } catch {
    return null;
  }
}
