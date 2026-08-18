import { AppIcon } from '@/components/ui/app-icon';
import { getPostReadiness } from '@/lib/post-readiness';
import { cn } from '@/lib/utils';
import type { BlogSchema } from '@/types';

interface PostReadinessPanelProps {
  frontmatter: BlogSchema;
  content: string;
}

const STATUS_STYLES = {
  ready: {
    icon: 'ri:checkbox-circle-line',
    className: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  },
  draft: {
    icon: 'ri:draft-line',
    className: 'border-amber-200 bg-amber-50/70 text-amber-700',
  },
  blocked: {
    icon: 'ri:error-warning-line',
    className: 'border-rose-200 bg-rose-50/70 text-rose-700',
  },
} as const;

export function PostReadinessPanel({ frontmatter, content }: PostReadinessPanelProps) {
  const readiness = getPostReadiness(frontmatter, content);
  const statusStyle = STATUS_STYLES[readiness.status];

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-white/65 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">文章状态</p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {readiness.summary.requiredDone}/{readiness.summary.requiredTotal} 项完成，约 {readiness.stats.words} 字
          </p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-medium text-xs', statusStyle.className)}>
          <AppIcon name={statusStyle.icon} className="size-3.5" />
          {readiness.statusLabel}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${readiness.score}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/70 bg-white/54 px-2 py-2">
          <p className="font-semibold text-sm">{readiness.score}%</p>
          <p className="text-muted-foreground text-[11px]">完整度</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-white/54 px-2 py-2">
          <p className="font-semibold text-sm">{readiness.stats.minutes} 分钟</p>
          <p className="text-muted-foreground text-[11px]">阅读</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-white/54 px-2 py-2">
          <p className="font-semibold text-sm">{readiness.summary.tags}</p>
          <p className="text-muted-foreground text-[11px]">标签</p>
        </div>
      </div>

      <div className="grid gap-2">
        {readiness.items.map((item) => (
          <div key={item.key} className="flex items-start gap-2 rounded-lg border border-border/70 bg-white/50 px-2.5 py-2">
            <AppIcon
              name={item.done ? 'ri:checkbox-circle-fill' : 'ri:circle-line'}
              className={cn('mt-0.5 size-4 shrink-0', item.done ? 'text-emerald-500' : 'text-muted-foreground')}
            />
            <div className="min-w-0">
              <p className="font-medium text-xs">{item.label}</p>
              {!item.done && <p className="mt-0.5 text-muted-foreground text-[11px]">{item.description}</p>}
            </div>
          </div>
        ))}
      </div>

      {readiness.warnings.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
          {readiness.warnings.map((warning) => (
            <div key={warning.key} className="flex gap-2">
              <AppIcon name="ri:information-line" className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 text-xs">{warning.label}</p>
                <p className="text-[11px] text-amber-700">{warning.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
