import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative rounded-xl border', {
  variants: {
    variant: {
      default: 'border-[#242424] bg-[#141414] text-[#F5F5F5]',
      warning:
        'border-[rgba(253,212,88,0.4)] bg-[rgba(253,212,88,0.1)] text-[#F5F5F5]',
      error: 'border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.1)] text-[#F5F5F5]',
      success:
        'border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.1)] text-[#F5F5F5]',
      info: 'border-[#2E2E2E] bg-[#1C1C1C] text-[#A1A1A1]',
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
