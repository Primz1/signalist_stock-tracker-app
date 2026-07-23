'use client';

type TapeItem = {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
};

export default function TickerTape({ items }: { items: TapeItem[] }) {
  const loop = [...items, ...items];
  if (items.length === 0) return null;

  return (
    <div className="mb-7 h-9 w-full overflow-hidden border-y border-[#242424] bg-[#0A0A0A]">
      <div
        className="flex h-full w-max items-center gap-7 whitespace-nowrap px-4"
        style={{ animation: 'marquee 24s linear infinite' }}
      >
        {loop.map((t, i) => (
          <div key={`${t.symbol}-${i}`} className="mono flex flex-none items-center gap-1.5 text-xs">
            <span className="text-[#A1A1A1]">{t.symbol}</span>
            <span className="text-[#F5F5F5]">{t.price}</span>
            <span className={t.up ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{t.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
