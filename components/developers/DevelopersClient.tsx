'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateDeveloperApiKey, getDeveloperApiKeys } from '@/lib/actions/apiKey.actions';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageEnter } from '@/components/ui/motion';
import { EmptyState } from '@/components/ui/empty-state';

export default function DevelopersClient() {
  const [keys, setKeys] = useState<Record<string, unknown>[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState('My App');
  const [isPending, startTransition] = useTransition();
  const [keysLoaded, setKeysLoaded] = useState(false);

  useEffect(() => {
    getDeveloperApiKeys().then((res) => {
      if (res.success) setKeys(res.data as Record<string, unknown>[]);
      setKeysLoaded(true);
    });
  }, []);

  const createKey = () => {
    startTransition(async () => {
      const res = await generateDeveloperApiKey(name);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      setNewKey(res.data.key);
      toast.success('API key created — copy it now, it won\'t be shown again.');
      const list = await getDeveloperApiKeys();
      if (list.success) setKeys(list.data as Record<string, unknown>[]);
    });
  };

  return (
    <PageEnter className="max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">API keys</h1>
        <p className="page-lede">
          Pull price, AI score, factors and the latest report for any symbol into your own scripts.
        </p>
      </div>

      <pre className="mono overflow-x-auto rounded-lg border border-line bg-surface p-4 text-[13px] leading-6 text-ink-2">
        <code>
          <span className="text-ink-3"># Quote, score, factors, indicators</span>
          {'\n'}GET /api/v1/stocks/<span className="text-ink">AAPL</span>
          {'\n\n'}
          <span className="text-ink-3"># Latest AI report</span>
          {'\n'}GET /api/v1/stocks/<span className="text-ink">AAPL</span>/report
          {'\n\n'}
          <span className="text-ink-3"># Send your key as a header</span>
          {'\n'}x-api-key: <span className="text-signal">sk_…</span>
        </code>
      </pre>

      <div>
        <h2 className="section-title mb-3">Create a key</h2>
        <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name" className="form-input" />
        <Button
          onClick={createKey}
          disabled={isPending}
          aria-busy={isPending}
          className="yellow-btn"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create key'
          )}
        </Button>
        </div>
      </div>

      {newKey && (
        <div className="rounded-lg border border-signal/40 bg-signal/10 p-4 text-[14px] text-ink">
          <p className="font-medium">Copy this key now. It won’t be shown again.</p>
          <code className="mono mt-2 block break-all text-signal">{newKey}</code>
        </div>
      )}

      <div>
        <h2 className="section-title mb-3">Your keys</h2>
        {!keysLoaded ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading keys">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            title="No API keys yet"
            description="Create a key to call the Signalist developer API."
            icon={KeyRound}
            variant="dashed"
            className="py-10"
          />
        ) : (
          <ul className="surface-card divide-y divide-line text-[14px]">
            {keys.map((k) => (
              <li key={String(k._id)} className="flex items-baseline justify-between gap-4 px-4 py-3 text-ink-2">
                <span className="text-ink">
                  {String(k.name)} <span className="mono text-ink-3">{String(k.keyPrefix)}…</span>
                </span>
                <span className="mono text-ink-3">{String(k.usageCount)} requests</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageEnter>
  );
}
