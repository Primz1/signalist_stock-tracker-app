import BrandLogo from '@/components/layout/BrandLogo';
import { AmberMeshBackground } from '@/components/ui/ambient';
import { getCachedSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Image from 'next/image';

const layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getCachedSession();

  if (session?.user) redirect('/dashboard');

  return (
    <main className="auth-layout">
      <section className="auth-left-section scrollbar-hide-default">
        <AmberMeshBackground />
        <div className="auth-logo animate-el">
          <BrandLogo href="/" />
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px] pb-8">{children}</div>
        </div>
      </section>

      <section className="auth-right-section animate-hero">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#242424] bg-[#141414]">
          <AmberMeshBackground className="opacity-60" />
          <div className="relative z-10 space-y-4 p-8 lg:p-10">
            <div
              className="animate-test rounded-xl border border-[#242424] bg-[#0A0A0A]/70 p-4"
              style={{ animationDelay: '1000ms' }}
            >
              <blockquote className="text-[15px] leading-relaxed text-[#F5F5F5]">
                Signalist turned my watchlist into a winning list. The alerts are spot-on, and I feel
                more confident making moves in the market.
              </blockquote>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <cite className="auth-testimonial-author not-italic">— 0xxghost</cite>
                  <p className="text-xs text-[#6E6E6E]">Retail Investor</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Image
                      src="/assets/icons/star.svg"
                      alt=""
                      key={star}
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div
              className="animate-test rounded-xl border border-[#242424] bg-[#0A0A0A]/70 p-4"
              style={{ animationDelay: '1200ms' }}
            >
              <blockquote className="text-[15px] leading-relaxed text-[#F5F5F5]">
                The AI research summaries cite real numbers from the quant snapshot — finally
                something I can trust before I size a paper trade.
              </blockquote>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <cite className="auth-testimonial-author not-italic">— Mira K.</cite>
                  <p className="text-xs text-[#6E6E6E]">Swing trader</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Image
                      src="/assets/icons/star.svg"
                      alt=""
                      key={`m-${star}`}
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5"
                    />
                  ))}
                </div>
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
