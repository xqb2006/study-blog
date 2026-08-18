import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, description, actions, children, className }: PanelProps) {
  return (
    <section className={cn('rounded-xl border border-border/80 bg-card/84 shadow-[var(--cms-card-shadow)] backdrop-blur', className)}>
      {(title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-border/70 border-b bg-white/28 px-4 py-3">
          <div>
            {title && <h2 className="font-semibold text-base">{title}</h2>}
            {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export function Field({ label, description, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="font-medium text-sm">{label}</span>
      {children}
      {description && <span className="block text-muted-foreground text-xs">{description}</span>}
    </label>
  );
}

export const inputClassName =
  'w-full rounded-lg border border-input bg-white/72 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export const textareaClassName =
  'w-full resize-y rounded-lg border border-input bg-white/72 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
