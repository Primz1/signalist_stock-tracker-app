import Link from 'next/link';
import BrandLogo from '@/components/layout/BrandLogo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-6 md:px-8">
      <BrandLogo href="/" />
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-center py-20">
        <p className="mono text-[15px] text-signal">404</p>
        <h1 className="mt-4 max-w-[14ch] text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-ink">
          No signal at this address.
        </h1>
        <p className="mt-6 max-w-[44ch] text-[18px] leading-[1.55] text-ink-2">
          The page moved or never existed. If you were looking for a symbol, search for it from the
          dashboard.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/dashboard" className="yellow-btn h-11 px-5">
            Go to dashboard
          </Link>
          <Link href="/" className="ghost-btn h-11 px-5 text-[14px]">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
