'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Compact Glitchy 404 — adapted from 21st.dev @isaiahbjork/glitchy-404-1
 * (width/height/color API). Exact-dimension design slot for marketing visuals
 * pending a dedicated 21st market/feature card (MCP unavailable this session).
 */
export function Glitchy404({
  width: widthProp = 200,
  height: heightProp = 140,
  color = '#FDD458',
  label = '404',
  fill = false,
  className,
}: {
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  /** Stretch to parent; keeps exact height via className (e.g. h-[220px]). */
  fill?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: widthProp, h: heightProp });

  useEffect(() => {
    if (!fill || !wrapRef.current) {
      setSize({ w: widthProp, h: heightProp });
      return;
    }
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({
        w: Math.max(80, Math.floor(cr.width)),
        h: Math.max(80, Math.floor(cr.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill, widthProp, heightProp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w: width, h: height } = size;
    let raf = 0;
    let t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(253,212,88,0.04)';
      for (let y = t % 4; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }

      for (let i = 0; i < 28; i++) {
        const x = (Math.sin(t * 0.07 + i * 12.1) * 0.5 + 0.5) * width;
        const y = (Math.cos(t * 0.05 + i * 7.3) * 0.5 + 0.5) * height;
        ctx.fillStyle = i % 3 === 0 ? color : 'rgba(245,245,245,0.35)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      const text = label;
      ctx.font = `700 ${Math.max(28, Math.min(width, height) * 0.42)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = width / 2;
      const cy = height / 2 - 6;
      const jx = Math.sin(t * 0.35) * 3;
      const jy = Math.cos(t * 0.28) * 2;

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(239,68,68,0.55)';
      ctx.fillText(text, cx + jx - 2, cy + jy);
      ctx.fillStyle = 'rgba(34,197,94,0.45)';
      ctx.fillText(text, cx - jx + 2, cy - jy);
      ctx.fillStyle = color;
      ctx.fillText(text, cx + (t % 7 === 0 ? 1 : 0), cy);
      ctx.globalCompositeOperation = 'source-over';

      if (t % 47 < 6) {
        const ty = (t * 7) % height;
        ctx.fillStyle = 'rgba(253,212,88,0.12)';
        ctx.fillRect(0, ty, width, 6);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, color, label]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative overflow-hidden rounded-xl border border-[#242424] bg-[#0A0A0A]',
        fill ? 'h-full w-full' : undefined,
        className
      )}
      style={fill ? undefined : { width: widthProp, height: heightProp }}
      aria-label="Design placeholder 404"
    >
      <canvas ref={canvasRef} id={`glitch-${uid}`} className="block h-full w-full" />
      <span className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[9px] uppercase tracking-widest text-[#6E6E6E]">
        Design slot
      </span>
    </div>
  );
}
