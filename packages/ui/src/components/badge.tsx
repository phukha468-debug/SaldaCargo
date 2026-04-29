import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import type { LifecycleStatus, SettlementStatus } from '@saldacargo/shared-types';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        draft: 'bg-amber-100 text-amber-700',
        approved: 'bg-green-100 text-green-700',
        returned: 'bg-red-100 text-red-700',
        cancelled: 'bg-slate-100 text-slate-500 line-through',
        pending: 'bg-blue-100 text-blue-700',
        completed: 'bg-green-100 text-green-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Хелперы для статусов
export function LifecycleBadge({ status }: { status: LifecycleStatus }) {
  const labels: Record<LifecycleStatus, string> = {
    draft: 'Черновик',
    approved: 'Утверждено',
    returned: 'Возвращено',
    cancelled: 'Отменено',
  };
  return <Badge variant={status}>{labels[status]}</Badge>;
}

export function SettlementBadge({ status }: { status: SettlementStatus }) {
  const labels: Record<SettlementStatus, string> = {
    pending: 'Ожидает',
    completed: 'Оплачено',
  };
  return <Badge variant={status}>{labels[status]}</Badge>;
}

export { Badge, badgeVariants };
