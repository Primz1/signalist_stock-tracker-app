import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ENGINE_SETTINGS, IMMEDIATE_PUBLISH_STRENGTH } from '@/lib/intelligence/signal-engine';
import { CONFIDENCE_WEIGHTS, STRENGTH_WEIGHTS } from '@/lib/intelligence/scoring';

export const metadata = { title: 'How signals work · Signalist' };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Plain-language version of docs/SIGNAL_ENGINE.md. Numbers come from the engine's own settings. */
export default function HowSignalsWork() {
  return (
    <article className="mx-auto max-w-2xl space-y-8 text-[15px] leading-relaxed text-ink-2">
      <Link href="/signals" className="text-btn h-11 gap-1.5 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        Signals
      </Link>
      <header>
        <h1 className="page-title">How signals work</h1>
        <p className="page-lede">Every number in a signal is calculated from market data. The AI only explains what was calculated.</p>
      </header>

      <section className="space-y-2">
        <h2 className="section-title">1. Watching</h2>
        <p>
          Every two minutes Signalist reads one-minute price bars for each asset on a watchlist and computes trend, momentum, volume,
          volatility and price levels. Stocks are analyzed during the regular US session; crypto around the clock.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">2. Detecting events</h2>
        <p>
          Events are specific, measurable things: a price move several times larger than usual, volume well above what is normal for that
          time of day, a close through recent resistance or support, an RSI or moving-average cross. Each fires once, when it happens, not on
          every minute it remains true.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">3. Connecting them</h2>
        <p>
          Events on the same asset, in the same direction, within {ENGINE_SETTINGS.correlationWindowMinutes} minutes are one story, so you see
          one signal instead of four notifications. A signal needs a real price, volume or level event at its core and enough force to matter.
          Indicator crossings alone never create one.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">4. Strength and confidence</h2>
        <p>
          <strong className="text-ink">Strength</strong> is how forceful the move is: price move {pct(STRENGTH_WEIGHTS.price)}, momentum{' '}
          {pct(STRENGTH_WEIGHTS.momentum)}, volume {pct(STRENGTH_WEIGHTS.volume)}, level break {pct(STRENGTH_WEIGHTS.breakout)} and trend{' '}
          {pct(STRENGTH_WEIGHTS.trend)}.
        </p>
        <p>
          <strong className="text-ink">Confidence</strong> is how much independent evidence agrees: how many kinds of event support it (
          {pct(CONFIDENCE_WEIGHTS.breadth)}), how much points the other way ({pct(CONFIDENCE_WEIGHTS.agreement)}) and how much could be
          measured ({pct(CONFIDENCE_WEIGHTS.coverage)}). A big move on one indicator is strong but not confident.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">5. Lifecycle</h2>
        <p>
          A signal is <em>detected</em>, becomes <em>active</em> if it holds for {ENGINE_SETTINGS.confirmMinutes} minutes, may be{' '}
          <em>weakening</em> when its strength fades, and ends as <em>invalidated</em> if price moves back through its key level or{' '}
          <em>resolved</em> after {ENGINE_SETTINGS.expireMinutes} quiet minutes or the market close. You are only notified once a signal is
          active, or straight away if its strength starts at {IMMEDIATE_PUBLISH_STRENGTH} or more.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">6. Context and news</h2>
        <p>
          Each move is compared with the S&amp;P 500 (SPY) and a sector fund, or with Bitcoin for other crypto, to say whether it is
          market-wide, sector-wide or specific to the asset. News published shortly before a move is shown with its timing. Timing is not
          proof of cause, and Signalist never says it is.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">7. The AI explanation</h2>
        <p>
          The AI receives only the computed evidence. Every number it writes is checked against that evidence, and any answer that cites a
          number it was not given, or reads as a recommendation to buy or sell, is discarded and replaced with a plain summary built from the
          data.
        </p>
      </section>

      <p className="meta border-t border-line pt-4">Signalist describes market activity. It does not give investment advice.</p>
    </article>
  );
}
