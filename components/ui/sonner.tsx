'use client';

/**
 * P1 Toast Notification (Ark-UI demo) adapted to Sonner + Signalist dark surfaces.
 * Typed toasts: success / error / warning / info, toned border + icon.
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
            'group toast !flex !items-start !gap-3 !min-w-[320px] !rounded-lg !border !border-line-strong !bg-surface !p-4 !text-ink !shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
          title: '!text-[13px] !font-semibold !text-ink',
          description: '!mt-0.5 !text-[12px] !text-ink-2 !opacity-90',
          actionButton:
            '!bg-signal !text-signal-ink !text-xs !font-semibold',
          cancelButton: '!bg-surface-2 !text-ink-2 !text-xs',
          closeButton:
            '!border-line-strong !bg-surface-2 !text-ink-3 hover:!bg-line hover:!text-ink',
          success: '!border-up/40',
          error: '!border-down/50',
          warning: '!border-signal/40',
        },
      }}
      icons={{
        success: <CircleCheck className="mt-0.5 size-4 shrink-0 text-up" strokeWidth={2} />,
        error: <OctagonX className="mt-0.5 size-4 shrink-0 text-down" strokeWidth={2} />,
        warning: <TriangleAlert className="mt-0.5 size-4 shrink-0 text-signal" strokeWidth={2} />,
        info: <Info className="mt-0.5 size-4 shrink-0 text-signal" strokeWidth={2} />,
        loading: <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-signal" strokeWidth={2} />,
        close: <X className="size-3" strokeWidth={2} />,
      }}
      style={
        {
          '--normal-bg': 'var(--sg-surface)',
          '--normal-text': 'var(--sg-ink)',
          '--normal-border': 'var(--sg-line-strong)',
          '--success-bg': 'var(--sg-surface)',
          '--error-bg': 'var(--sg-surface)',
          '--border-radius': '8px',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
