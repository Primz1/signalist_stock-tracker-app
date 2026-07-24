'use client';

/**
 * P1 Toast Notification (Ark-UI demo) adapted to Sonner + Signalist dark surfaces.
 * Typed toasts: success / error / warning / info with left accent rail + icons.
 */
import {
  CircleCheck,
  Info,
  Loader2,
  OctagonX,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      gap={16}
      expand={false}
      visibleToasts={4}
      closeButton
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            'group toast animate-toast !flex !items-start !gap-3 !min-w-[320px] !rounded-lg !border !border-[#2E2E2E] !border-l-4 !bg-[#141414] !p-4 !text-[#F5F5F5] !shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
          title: '!text-[13px] !font-semibold !text-[#F5F5F5]',
          description: '!mt-0.5 !text-[12px] !text-[#A1A1A1] !opacity-90',
          actionButton:
            '!bg-[#FDD458] !text-[#0A0A0A] !text-xs !font-semibold',
          cancelButton: '!bg-[#1C1C1C] !text-[#A1A1A1] !text-xs',
          closeButton:
            '!border-[#2E2E2E] !bg-[#1C1C1C] !text-[#6E6E6E] hover:!bg-[#242424] hover:!text-[#F5F5F5]',
          success: '!border-l-[#22C55E]',
          error: '!border-l-[#EF4444]',
          warning: '!border-l-[#FDD458]',
          info: '!border-l-[#FDD458]',
          loading: '!border-l-[#FDD458]',
        },
      }}
      icons={{
        success: <CircleCheck className="mt-0.5 size-4 shrink-0 text-[#22C55E]" strokeWidth={2} />,
        error: <OctagonX className="mt-0.5 size-4 shrink-0 text-[#EF4444]" strokeWidth={2} />,
        warning: <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#FDD458]" strokeWidth={2} />,
        info: <Info className="mt-0.5 size-4 shrink-0 text-[#FDD458]" strokeWidth={2} />,
        loading: <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[#FDD458]" strokeWidth={2} />,
        close: <X className="size-3" strokeWidth={2} />,
      }}
      style={
        {
          '--normal-bg': '#141414',
          '--normal-text': '#F5F5F5',
          '--normal-border': '#2E2E2E',
          '--success-bg': '#141414',
          '--error-bg': '#141414',
          '--border-radius': '8px',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
