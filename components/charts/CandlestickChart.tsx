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
import { PALETTE } from '@/lib/theme';

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
        background: { type: ColorType.Solid, color: PALETTE.surface },
        textColor: PALETTE.ink3,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        panes: {
          separatorColor: PALETTE.line,
          separatorHoverColor: PALETTE.lineStrong,
        },
      },
      grid: {
        vertLines: { color: PALETTE.surface2 },
        horzLines: { color: PALETTE.surface2 },
      },
      rightPriceScale: { borderColor: PALETTE.lineStrong },
      timeScale: { borderColor: PALETTE.lineStrong },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: PALETTE.up,
      downColor: PALETTE.down,
      borderVisible: false,
      wickUpColor: PALETTE.up,
      wickDownColor: PALETTE.down,
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
      color: PALETTE.ink3,
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
        color: c.close >= c.open ? 'rgba(71,207,121,0.32)' : 'rgba(247,93,89,0.32)',
      }))
    );

    const series = data.indicators?.series;

    if (showSma20 && series?.sma20) {
      const s = chart.addSeries(LineSeries, {
        color: PALETTE.signal,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(toLine(data.candles, series.sma20));
    }

    if (showSma50 && series?.sma50) {
      const s = chart.addSeries(LineSeries, {
        color: PALETTE.ink2,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(toLine(data.candles, series.sma50));
    }

    if (showBb && series?.bollinger) {
      const upper = chart.addSeries(LineSeries, {
        color: 'rgba(252,213,95,0.45)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lower = chart.addSeries(LineSeries, {
        color: 'rgba(252,213,95,0.45)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const mid = chart.addSeries(LineSeries, {
        color: 'rgba(189,186,181,0.5)',
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
          color: PALETTE.warm,
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
              color: v >= 0 ? 'rgba(71,207,121,0.5)' : 'rgba(247,93,89,0.5)',
            };
          })
          .filter((p) => Number.isFinite(p.value))
      );

      const macdLine = chart.addSeries(
        LineSeries,
        {
          color: PALETTE.signal,
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
          color: PALETTE.ink2,
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
          'flex h-[280px] w-full items-center justify-center text-sm text-ink-3 md:h-[360px]',
          className
        )}
      >
        No chart data for this range
      </div>
    );
  }

  return <div ref={containerRef} className={cn('w-full', className)} />;
}
