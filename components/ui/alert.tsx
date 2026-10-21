import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative rounded-lg border', {
  variants: {
    variant: {
      default: 'border-line bg-surface text-ink',
      warning:
        'border-signal/40 bg-signal/10 text-ink',
      error: 'border-down/40 bg-down/10 text-ink',
      success:
        'border-up/40 bg-up/10 text-ink',
      info: 'border-line-strong bg-surface-2 text-ink-2',
    },
    size: {
      sm: 'px-3.5 py-3',
      lg: 'p-4',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'sm',
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, size, icon, action, children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant, size }), className)}
      {...props}
    >
      <div className="flex items-start gap-2">
        {icon ? <span className="mt-0.5 inline-flex shrink-0">{icon}</span> : null}
        <div className="min-w-0 grow text-[13px] leading-relaxed">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
