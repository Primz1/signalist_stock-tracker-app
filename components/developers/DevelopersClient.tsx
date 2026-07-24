'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShinyButton } from '@/components/ui/shiny-button';
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
    <PageEnter className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="section-title">Developer API</h1>
        <p className="text-sm text-[#6E6E6E]">Access stock data, scores, and AI reports programmatically.</p>
      </div>

      <div className="surface-card p-4 text-sm text-[#A1A1A1]">
        <p className="font-medium text-[#F5F5F5]">Endpoints</p>
        <code className="mono mt-2 block text-[#FDD458]">GET /api/v1/stocks/AAPL</code>
        <code className="mono block text-[#FDD458]">GET /api/v1/stocks/AAPL/report</code>
        <p className="mt-2">Header: <code className="text-[#F5F5F5]">X-API-Key: your_key</code></p>
      </div>

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
            'Create Key'
          )}
        </Button>
      </div>

      {newKey && (
        <div className="rounded-xl border border-[rgba(253,212,88,0.4)] bg-[rgba(253,212,88,0.1)] p-3 text-sm text-[#F5F5F5] break-all">
          New key: <strong className="text-[#FDD458]">{newKey}</strong>
        </div>
      )}

      {/* Temporary — remove after UI MCP smoke test */}
      <div className="surface-card space-y-3 border border-dashed border-[#2E2E2E] p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#6E6E6E]">UI test</p>
          <p className="mt-1 text-sm text-[#A1A1A1]">
            21st.dev Shiny Button adapted to Signalist amber.
          </p>
        </div>
        <ShinyButton
          onClick={() => toast.success('UI test button works')}
        >
          Test Button
        </ShinyButton>
      </div>

      <div className="surface-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#F5F5F5]">Your Keys</h2>
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
          <ul className="space-y-2 text-sm">
            {keys.map((k) => (
              <li key={String(k._id)} className="flex justify-between border-b border-[#1C1C1C] py-2 text-[#A1A1A1] last:border-0">
                <span className="text-[#F5F5F5]">{String(k.name)} ({String(k.keyPrefix)}...)</span>
                <span className="text-[#6E6E6E]">{String(k.usageCount)} requests</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageEnter>
  );
}
