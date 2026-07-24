'use client';

import { cn, formatPrice } from '@/lib/utils';

type Stance = 'buy' | 'sell' | 'wait' | 'caution' | 'na';

type Indicators = {
  sma20: number;
  sma50: number;
  rsi14: number;
  macd: { macd: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number };
};

export type ExtraIndicators = {
  adx?: number | null;
  adx_pos?: number | null;
  adx_neg?: number | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  cci?: number | null;
  willr?: number | null;
  mfi?: number | null;
  atr?: number | null;
};

const STANCE_STYLE: Record<Stance, string> = {
  buy: 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]',
  sell: 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
  wait: 'bg-[rgba(161,161,161,0.12)] text-[#A1A1A1]',
  caution: 'bg-[rgba(253,212,88,0.12)] text-[#FDD458]',
  na: 'bg-[#1C1C1C] text-[#6E6E6E]',
};

const STANCE_LABEL: Record<Stance, string> = {
  buy: 'Buy lean',
  sell: 'Sell lean',
  wait: 'Indecisive',
  caution: 'Caution',
  na: 'No data',
};

export function IndicatorGuide({
  indicators,
  price,
  extras,
}: {
  indicators: Indicators;
  price?: number;
  extras?: ExtraIndicators | null;
}) {
  const rsi = indicators.rsi14;
  const sma20 = indicators.sma20;
  const sma50 = indicators.sma50;
  const hist = indicators.macd.histogram;
  const bbLo = indicators.bollinger.lower;
  const bbHi = indicators.bollinger.upper;
  const bbMid = indicators.bollinger.middle;

  const rows: {
    label: string;
    value: string;
    stance: Stance;
    meaning: string;
    action: string;
  }[] = [
    (() => {
      if (!Number.isFinite(rsi)) {
        return {
          label: 'RSI',
          value: '—',
          stance: 'na' as const,
          meaning: 'Not enough price history yet.',
          action: 'Switch to 3M or longer, then check again.',
        };
      }
      if (rsi <= 30) {
        return {
          label: 'RSI',
          value: rsi.toFixed(1),
          stance: 'buy' as const,
          meaning: 'Looks washed out (oversold).',
          action: 'Buy lean — deep dips often bounce; still wait for a turn up.',
        };
      }
      if (rsi >= 70) {
        return {
          label: 'RSI',
          value: rsi.toFixed(1),
          stance: 'sell' as const,
          meaning: 'Looks stretched (overbought).',
          action: 'Sell lean / take profits — chasing here is riskier.',
        };
      }
      if (rsi >= 45 && rsi <= 55) {
        return {
          label: 'RSI',
          value: rsi.toFixed(1),
          stance: 'wait' as const,
          meaning: 'Momentum is balanced — neither hot nor cold.',
          action: 'Indecisive — RSI alone does not say buy or sell.',
        };
      }
      return {
        label: 'RSI',
        value: rsi.toFixed(1),
        stance: (rsi > 55 ? 'buy' : 'sell') as Stance,
        meaning:
          rsi > 55
            ? 'Mild upside momentum (bulls slightly ahead).'
            : 'Mild downside momentum (bears slightly ahead).',
        action:
          rsi > 55
            ? 'Soft buy lean — some strength, not a strong call.'
            : 'Soft sell lean — some weakness, not a strong call.',
      };
    })(),
    (() => {
      if (price == null || !Number.isFinite(sma20)) {
        return {
          label: 'SMA20',
          value: '—',
          stance: 'na' as const,
          meaning: 'Short-term average unavailable.',
          action: 'Need more bars before this can guide you.',
        };
      }
      if (price >= sma20) {
        return {
          label: 'SMA20',
          value: formatPrice(sma20),
          stance: 'buy' as const,
          meaning: 'Price is holding above the short-term average.',
          action: 'Buy lean for short-term trades — support looks intact.',
        };
      }
      return {
        label: 'SMA20',
        value: formatPrice(sma20),
        stance: 'sell' as const,
        meaning: 'Price slipped under the short-term average.',
        action: 'Sell lean / stay cautious — short-term weakness.',
      };
    })(),
    (() => {
      if (!Number.isFinite(sma20) || !Number.isFinite(sma50)) {
        return {
          label: 'SMA50',
          value: '—',
          stance: 'na' as const,
          meaning: 'Longer trend needs ~50 trading days of data.',
          action: 'Open 3M+ for a reliable trend read.',
        };
      }
      if (sma20 > sma50 * 1.005) {
        return {
          label: 'SMA50',
          value: formatPrice(sma50),
          stance: 'buy' as const,
          meaning: 'Short average is clearly above the long average.',
          action: 'Buy lean — classic uptrend structure.',
        };
      }
      if (sma20 < sma50 * 0.995) {
        return {
          label: 'SMA50',
          value: formatPrice(sma50),
          stance: 'sell' as const,
          meaning: 'Short average is clearly below the long average.',
          action: 'Sell lean — classic downtrend structure.',
        };
      }
      return {
        label: 'SMA50',
        value: formatPrice(sma50),
        stance: 'wait' as const,
        meaning: 'Short and long averages are nearly tied.',
        action: 'Indecisive — trend is chopping; wait for a clearer break.',
      };
    })(),
    (() => {
      if (!Number.isFinite(hist)) {
        return {
          label: 'MACD',
          value: '—',
          stance: 'na' as const,
          meaning: 'Momentum gauge unavailable.',
          action: 'Need more history before MACD can call buy/sell.',
        };
      }
      if (hist > 0.15) {
        return {
          label: 'MACD',
          value: `+${hist.toFixed(2)}`,
          stance: 'buy' as const,
          meaning: 'Upside momentum is in control.',
          action: 'Buy lean — pressure still favors higher prices.',
        };
      }
      if (hist < -0.15) {
        return {
          label: 'MACD',
          value: hist.toFixed(2),
          stance: 'sell' as const,
          meaning: 'Downside momentum is in control.',
          action: 'Sell lean — pressure still favors lower prices.',
        };
      }
      return {
        label: 'MACD',
        value: `${hist >= 0 ? '+' : ''}${hist.toFixed(2)}`,
        stance: 'wait' as const,
        meaning: 'Momentum is flat / flipping.',
        action: 'Indecisive — wait for a stronger push either way.',
      };
    })(),
    (() => {
      if (price == null || !Number.isFinite(bbLo) || !Number.isFinite(bbHi)) {
        return {
          label: 'Bollinger',
          value: '—',
          stance: 'na' as const,
          meaning: 'Volatility range unavailable.',
          action: 'Need more bars to map the expected price band.',
        };
      }
      const band = bbHi - bbLo || 1;
      const pos = (price - bbLo) / band;
      if (pos >= 0.85) {
        return {
          label: 'Bollinger',
          value: `${bbLo.toFixed(0)}–${bbHi.toFixed(0)}`,
          stance: 'caution' as const,
          meaning: 'Price is hugging the top of its recent range.',
          action: 'Caution — stretched high; buying here is easier to get burned.',
        };
      }
      if (pos <= 0.15) {
        return {
          label: 'Bollinger',
          value: `${bbLo.toFixed(0)}–${bbHi.toFixed(0)}`,
          stance: 'buy' as const,
          meaning: 'Price is near the bottom of its recent range.',
          action: 'Buy lean on dips — cheaper vs its band (confirm with trend).',
        };
      }
      if (pos >= 0.4 && pos <= 0.6) {
        return {
          label: 'Bollinger',
          value: `${bbLo.toFixed(0)}–${bbHi.toFixed(0)}`,
          stance: 'wait' as const,
          meaning: 'Price sits mid-range — no stretch either way.',
          action: 'Indecisive — wait for a break out of the middle.',
        };
      }
      return {
        label: 'Bollinger',
        value: `${bbLo.toFixed(0)}–${bbHi.toFixed(0)}`,
        stance: (pos > 0.5 ? 'caution' : 'buy') as Stance,
        meaning:
          pos > 0.5
            ? 'Price is in the upper half of the band.'
            : 'Price is in the lower half of the band.',
        action:
          pos > 0.5
            ? 'Mild caution — closer to “expensive” in-range.'
            : 'Mild buy lean — closer to “cheaper” in-range.',
      };
    })(),
  ];

  const buyVotes = rows.filter((r) => r.stance === 'buy').length;
  const sellVotes =
    rows.filter((r) => r.stance === 'sell').length +
    rows.filter((r) => r.stance === 'caution').length * 0.5;
  const actionable = rows.filter(
    (r) => r.stance === 'buy' || r.stance === 'sell' || r.stance === 'caution'
  ).length;

  let overall: Stance = 'wait';
  let overallText =
    'Indicators disagree or lack data — treat this as indecisive.';
  if (actionable >= 2) {
    if (buyVotes >= sellVotes + 1 && buyVotes >= 2) {
      overall = 'buy';
      overallText = `More signals lean buy (${buyVotes} buy vs ${Math.round(sellVotes)} sell/caution). Still follow your own plan — not financial advice.`;
    } else if (sellVotes >= buyVotes + 1 && sellVotes >= 2) {
      overall = 'sell';
      overallText = `More signals lean sell/caution (${Math.round(sellVotes)} vs ${buyVotes} buy). Favor patience or trimming over chasing.`;
    } else {
      overall = 'wait';
      overallText =
        'Mixed tape — buy and sell cues are close. Best read: wait / stay flat until it clarifies.';
    }
  } else if (actionable === 0) {
    overall = 'na';
    overallText = 'Not enough history on this view to call buy or sell yet.';
  }

  const extrasRows: {
    label: string;
    value: string;
    stance: Stance;
    meaning: string;
    action: string;
  }[] = [];

  if (extras) {
    const adx = extras.adx;
    const adxPos = extras.adx_pos;
    const adxNeg = extras.adx_neg;
    if (Number.isFinite(adx)) {
      const strong = (adx as number) >= 25;
      const bull = Number.isFinite(adxPos) && Number.isFinite(adxNeg) && (adxPos as number) > (adxNeg as number);
      const bear = Number.isFinite(adxPos) && Number.isFinite(adxNeg) && (adxNeg as number) > (adxPos as number);
      extrasRows.push({
        label: 'ADX',
        value: (adx as number).toFixed(1),
        stance: !strong ? 'wait' : bull ? 'buy' : bear ? 'sell' : 'caution',
        meaning: strong
          ? bull
            ? 'Strong trend with upside pressure (+DI > −DI).'
            : bear
              ? 'Strong trend with downside pressure (−DI > +DI).'
              : 'Strong trend, direction mixed.'
          : 'Weak / choppy trend (ADX under 25).',
        action: strong
          ? bull
            ? 'Buy lean — trend-following setups favored.'
            : bear
              ? 'Sell lean — respect the downtrend.'
              : 'Caution — strong move but unclear side.'
          : 'Indecisive — wait for ADX to rise before chasing.',
      });
    }

    const sk = extras.stoch_k;
    if (Number.isFinite(sk)) {
      const v = sk as number;
      extrasRows.push({
        label: 'Stoch',
        value: v.toFixed(1),
        stance: v <= 20 ? 'buy' : v >= 80 ? 'sell' : v >= 45 && v <= 55 ? 'wait' : v > 55 ? 'buy' : 'sell',
        meaning:
          v <= 20
            ? 'Stochastic oversold — sellers may be exhausted.'
            : v >= 80
              ? 'Stochastic overbought — buyers may be extended.'
              : 'Stochastic mid-range.',
        action:
          v <= 20
            ? 'Buy lean — watch for a turn up from oversold.'
            : v >= 80
              ? 'Sell lean / take profits — stretched.'
              : 'Indecisive on Stoch alone.',
      });
    }

    const cci = extras.cci;
    if (Number.isFinite(cci)) {
      const v = cci as number;
      extrasRows.push({
        label: 'CCI',
        value: v.toFixed(0),
        stance: v <= -100 ? 'buy' : v >= 100 ? 'caution' : 'wait',
        meaning:
          v <= -100
            ? 'CCI deeply negative — price stretched low vs typical.'
            : v >= 100
              ? 'CCI elevated — price stretched high vs typical.'
              : 'CCI in a normal band.',
        action:
          v <= -100
            ? 'Buy lean on dips — confirm with trend.'
            : v >= 100
              ? 'Caution — stretched; avoid chasing.'
              : 'Indecisive — CCI not extreme.',
      });
    }

    const mfi = extras.mfi;
    if (Number.isFinite(mfi)) {
      const v = mfi as number;
      extrasRows.push({
        label: 'MFI',
        value: v.toFixed(1),
        stance: v <= 20 ? 'buy' : v >= 80 ? 'sell' : 'wait',
        meaning:
          v <= 20
            ? 'Money Flow oversold — selling pressure may be fading.'
            : v >= 80
              ? 'Money Flow overbought — heavy buying already priced in.'
              : 'Money Flow balanced.',
        action:
          v <= 20
            ? 'Buy lean — volume-backed oversold.'
            : v >= 80
              ? 'Sell lean — volume-backed overbought.'
              : 'Indecisive on MFI alone.',
      });
    }

    const willr = extras.willr;
    if (Number.isFinite(willr)) {
      const v = willr as number;
      extrasRows.push({
        label: 'Williams',
        value: v.toFixed(1),
        stance: v <= -80 ? 'buy' : v >= -20 ? 'sell' : 'wait',
        meaning:
          v <= -80
            ? 'Williams %R oversold.'
            : v >= -20
              ? 'Williams %R overbought.'
              : 'Williams %R mid-zone.',
        action:
          v <= -80
            ? 'Buy lean — oversold bounce zone.'
            : v >= -20
              ? 'Sell lean — overbought zone.'
              : 'Indecisive on Williams alone.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-[#242424] bg-[#141414] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
            What should I do?
          </div>
          <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#F5F5F5]">{overallText}</p>
        </div>
        <span
          className={cn(
            'inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-[13px] font-medium',
            STANCE_STYLE[overall]
          )}
        >
          {STANCE_LABEL[overall]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex flex-col rounded-xl border border-[#242424] bg-[#141414] px-3.5 py-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
                {r.label}
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  STANCE_STYLE[r.stance]
                )}
              >
                {STANCE_LABEL[r.stance]}
              </span>
            </div>
            <div className="mono text-lg text-[#F5F5F5]">{r.value}</div>
            <div className="mt-2 text-[12px] leading-4 text-[#F5F5F5]">{r.meaning}</div>
            <div className="mt-auto pt-2 text-[11px] leading-4 text-[#A1A1A1]">{r.action}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-4 text-[#6E6E6E]">
        Paper-trading helpers only — heuristics, not guarantees. Tap SMA20 / RSI / MACD / BB above
        the chart to draw them on price.
        {Number.isFinite(bbMid) ? ` Mid-band ≈ ${formatPrice(bbMid)}.` : ''}
      </p>

      {extrasRows.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          <div className="text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
            Extra signals (from AI service)
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {extrasRows.map((r) => (
              <div
                key={r.label}
                className="flex flex-col rounded-xl border border-[#242424] bg-[#141414] px-3.5 py-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
                    {r.label}
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      STANCE_STYLE[r.stance]
                    )}
                  >
                    {STANCE_LABEL[r.stance]}
                  </span>
                </div>
                <div className="mono text-lg text-[#F5F5F5]">{r.value}</div>
                <div className="mt-2 text-[12px] leading-4 text-[#F5F5F5]">{r.meaning}</div>
                <div className="mt-auto pt-2 text-[11px] leading-4 text-[#A1A1A1]">{r.action}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
