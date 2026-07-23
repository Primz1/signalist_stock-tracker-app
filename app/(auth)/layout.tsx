import BrandLogo from '@/components/layout/BrandLogo';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) redirect('/');

  return (
    <main className="auth-layout">
      <section className="auth-left-section scrollbar-hide-default">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(600px_circle_at_50%_0%,rgba(253,212,88,0.08),transparent_70%)]" />
        <div className="auth-logo">
          <BrandLogo />
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px] pb-8">{children}</div>
        </div>
      </section>

      <section className="auth-right-section">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#242424] bg-[#141414]">
          <div className="relative z-10 p-8 lg:p-10">
            <blockquote className="auth-blockquote">
              Signalist turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market.
            </blockquote>
            <div className="flex items-center justify-between">
              <div>
                <cite className="auth-testimonial-author">— 0xxghost</cite>
                <p className="text-xs text-[#6E6E6E]">Retail Investor</p>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Image
                    src="/assets/icons/star.svg"
                    alt=""
                    key={star}
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 px-4 pb-4">
            <Image
              src="/assets/images/dashboard.png"
              alt="Dashboard preview"
              width={1440}
              height={1150}
              className="auth-dashboard-preview h-full w-full rounded-xl border border-[#242424]"
              priority
            />
          </div>
        </div>
      </section>
    </main>
  );
};

export default layout;
