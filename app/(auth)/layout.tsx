import BrandLogo from '@/components/layout/BrandLogo';
import { AlertLevelChart } from '@/components/marketing/AlertLevelChart';
import { getCachedSession } from '@/lib/auth/session';
import { getMarketingLiveData } from '@/lib/marketing/live-data';
import { redirect } from 'next/navigation';

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getCachedSession();

  if (session?.user) redirect('/dashboard');

  const data = await getMarketingLiveData();

  return (
    <main className="auth-layout">
      <section className="auth-left-section scrollbar-hide-default">
        <div className="auth-logo">
          <BrandLogo href="/" />
        </div>
        <div className="relative z-10 flex flex-1 items-center">
          <div className="mx-auto w-full max-w-[400px] pb-10 lg:mx-0">{children}</div>
        </div>
        <p className="text-[13px] text-ink-3">Paper money only. Nothing here is investment advice.</p>
      </section>

      <section className="auth-right-section animate-hero justify-between gap-12 p-10 xl:p-14">
        <h2 className="max-w-[16ch] text-[clamp(2.25rem,3.6vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
          Your levels, watched for you.
        </h2>
        {data.heroCandles.length > 20 ? (
          <AlertLevelChart symbol={data.hero.symbol} candles={data.heroCandles} />
        ) : (
          <p className="max-w-[40ch] text-[17px] leading-[1.55] text-ink-2">
            Set an upper or lower price on any stock or crypto. Signalist checks it in the
            background and tells you the moment it crosses.
          </p>
        )}
      </section>
    </main>
  );
};

export default layout;
