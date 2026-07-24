'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '@/lib/market/ohlcv';
import { cn } from '@/lib/utils';

export type IndicatorToggleKey = 'SMA20' | 'SMA50' | 'RSI' | 'MACD' | 'BB';

type ChartSeries = {
  sma20: number[];
  sma50: number[];
  rsi14?: number[];
  macd?: {
    macdLine: number[];
    signalLine: number[];
    histogram: number[];
  };
  bollinger?: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
};

type ChartData = {
  candles: Candle[];
  indicators?: {
    sma20: number;
    sma50: number;
    series?: ChartSeries;
  } | null;
};

function toLine(
  candles: Candle[],
  values: number[] | undefined
): { time: Time; value: number }[] {
  if (!values) return [];
  return candles
    .map((c, i) => ({
      time: c.time as unknown as Time,
      value: values[i],
    }))
    .filter((p) => Number.isFinite(p.value));
}

export default function CandlestickChart({
  data,
  overlays = { SMA20: true, SMA50: false, RSI: false, MACD: false, BB: false },
  height = 360,
  className,
}: {
  data: ChartData;
  overlays?: Partial<Record<IndicatorToggleKey, boolean>>;
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const showSma20 = !!overlays.SMA20;
  const showSma50 = !!overlays.SMA50;
  const showBb = !!overlays.BB;
  const showRsi = !!overlays.RSI;
  const showMacd = !!overlays.MACD;

  useEffect(() => {
    if (!containerRef.current || !data.candles.length) return;

    const paneCount = 1 + (showRsi ? 1 : 0) + (showMacd ? 1 : 0);
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#141414' },
        textColor: '#6E6E6E',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        panes: {
          separatorColor: '#242424',
          separatorHoverColor: '#2E2E2E',
        },
      },
      grid: {
        vertLines: { color: '#1C1C1C' },
        horzLines: { color: '#1C1C1C' },
      },
      rightPriceScale: { borderColor: '#2E2E2E' },
      timeScale: { borderColor: '#2E2E2E' },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    });

    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6E6E6E',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    volumeSeries.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as Time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
      }))
    );

    const series = data.indicators?.series;

    if (showSma20 && series?.sma20) {
      const s = chart.addSeries(LineSeries, {
        color: '#FDD458',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(toLine(data.candles, series.sma20));
    }

    if (showSma50 && series?.sma50) {
      const s = chart.addSeries(LineSeries, {
        color: '#A1A1A1',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(toLine(data.candles, series.sma50));
    }

    if (showBb && series?.bollinger) {
      const upper = chart.addSeries(LineSeries, {
        color: 'rgba(253,212,88,0.45)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lower = chart.addSeries(LineSeries, {
        color: 'rgba(253,212,88,0.45)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const mid = chart.addSeries(LineSeries, {
        color: 'rgba(161,161,161,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upper.setData(toLine(data.candles, series.bollinger.upper));
      lower.setData(toLine(data.candles, series.bollinger.lower));
      mid.setData(toLine(data.candles, series.bollinger.middle));
    }

    let nextPane = 1;

    if (showRsi && series?.rsi14) {
      const rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: '#F97316',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'RSI',
        },
        nextPane
      );
      rsiSeries.setData(toLine(data.candles, series.rsi14));
      try {
        chart.panes()[nextPane]?.setHeight(Math.round(height * 0.22));
      } catch {
        /* pane API may vary by version */
      }
      nextPane += 1;
    }

    if (showMacd && series?.macd) {
      const hist = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'MACD',
        },
        nextPane
      );
      hist.setData(
        data.candles
          .map((c, i) => {
            const v = series.macd!.histogram[i];
            return {
              time: c.time as unknown as Time,
              value: v,
              color: v >= 0 ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)',
            };
          })
          .filter((p) => Number.isFinite(p.value))
      );

      const macdLine = chart.addSeries(
        LineSeries,
        {
          color: '#FDD458',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        nextPane
      );
      macdLine.setData(toLine(data.candles, series.macd.macdLine));

      const signalLine = chart.addSeries(
        LineSeries,
        {
          color: '#A1A1A1',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        nextPane
      );
      signalLine.setData(toLine(data.candles, series.macd.signalLine));

      try {
        chart.panes()[nextPane]?.setHeight(Math.round(height * 0.22));
      } catch {
        /* ignore */
      }
    }

    // Stretch main pane when extras are on
    if (paneCount > 1) {
      try {
        chart.panes()[0]?.setHeight(Math.round(height * (paneCount === 2 ? 0.7 : 0.55)));
      } catch {
        /* ignore */
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      if (containerRef.current) containerRef.current.replaceChildren();
    };
  }, [
    data.candles,
    data.indicators,
    height,
    showSma20,
    showSma50,
    showBb,
    showRsi,
    showMacd,
  ]);

  if (!data.candles.length) {
    return (
      <div
        className={cn(
          'flex h-[280px] w-full items-center justify-center text-sm text-[#6E6E6E] md:h-[360px]',
          className
        )}
      >
        No chart data for this range
      </div>
    );
  }

  return <div ref={containerRef} className={cn('w-full', className)} />;
}
