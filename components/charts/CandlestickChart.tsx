'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { Candle } from '@/lib/market/ohlcv';

type ChartData = {
  candles: Candle[];
  indicators?: {
    sma20: number;
    sma50: number;
    series?: {
      sma20: number[];
      sma50: number[];
    };
  } | null;
};

export default function CandlestickChart({
  data,
  showMA = true,
  height = 420,
}: {
  data: ChartData;
  showMA?: boolean;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.candles.length) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#141414' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151' },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as import('lightweight-charts').Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6b7280',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    volumeSeries.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as import('lightweight-charts').Time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      }))
    );

    if (showMA && data.indicators?.series) {
      const sma20Series = chart.addSeries(LineSeries, { color: '#facc15', lineWidth: 1 });
      const sma50Series = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1 });

      sma20Series.setData(
        data.candles.map((c, i) => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          value: data.indicators!.series!.sma20[i],
        })).filter((p) => Number.isFinite(p.value))
      );

      sma50Series.setData(
        data.candles.map((c, i) => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          value: data.indicators!.series!.sma50[i],
        })).filter((p) => Number.isFinite(p.value))
      );
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data, showMA, height]);

  return <div ref={containerRef} className="w-full rounded-xl border border-gray-800 overflow-hidden" />;
}
