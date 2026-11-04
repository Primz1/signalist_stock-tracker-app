import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SignalDetailPage } from '@/components/signals/SignalDetailPage';
import { getCachedUser } from '@/lib/auth/session';
import { getSignalDetail } from '@/lib/intelligence/queries';

export default async function SignalPage({ params }: { params: Promise<{ signalId: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect('/sign-in');

  const { signalId } = await params;
  const signal = await getSignalDetail(decodeURIComponent(signalId));
  if (!signal) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/signals" className="text-btn h-11 gap-1.5 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        All signals
      </Link>
      <SignalDetailPage signal={signal} />
    </div>
  );
}
