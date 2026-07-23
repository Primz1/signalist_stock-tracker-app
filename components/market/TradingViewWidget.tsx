'use client';

import React, { memo } from 'react';
import useTradingViewWidget from "@/hooks/useTradingViewWidget";
import {cn} from "@/lib/utils";

interface TradingViewWidgetProps {
    title?: string;
    scriptUrl: string;
    config: Record<string, unknown>;
    height?: number;
    className?: string;
}

const TradingViewWidget = ({title, scriptUrl, config, height = 600, className}: TradingViewWidgetProps) => {
  const containerRef = useTradingViewWidget(scriptUrl, config, height);



  return (
    <div className="w-full">
      {title && (
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-[#6E6E6E]">
          {title}
        </h3>
      )}
      <div className={cn('tradingview-widget-container', className)} ref={containerRef}>
        <div
          className="tradingview-widget-container__widget"
          style={{ height, width: '100%' }}
        />
      </div>
    </div>
  );
}

export default memo(TradingViewWidget);
