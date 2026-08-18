/**
 * Category Stats Component
 *
 * Displays category statistics with horizontal bar charts.
 */

import { AppIcon } from '@/components/ui/app-icon';
interface CategoryStatsProps {
  categories: { name: string; count: number }[];
  maxDisplay?: number;
}

export function CategoryStats({ categories, maxDisplay = 6 }: CategoryStatsProps) {
  const displayCategories = categories.slice(0, maxDisplay);
  const maxCount = Math.max(...displayCategories.map((c) => c.count), 1);

  return (
    <div className="cms-premium-card rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-950">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-[#d79a00]">
            <AppIcon name="ri:bubble-chart-line" className="size-5" />
          </span>
          分类统计
        </h3>
        <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-slate-500 text-xs uppercase tracking-[0.14em]">top {displayCategories.length}</span>
      </div>
      <div className="space-y-3">
        {displayCategories.map((cat) => {
          const percentage = (cat.count / maxCount) * 100;
          return (
            <div key={cat.name} className="rounded-xl border border-slate-200 bg-white/70 p-3.5 transition hover:border-[rgba(255,213,128,0.65)] hover:bg-amber-50/70">
              <div className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium text-slate-950">
                  <span className="size-2 rounded-full bg-[#ffd580] shadow-[0_0_16px_rgba(255,213,128,0.6)]" />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 text-xs">{cat.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff2d6f] to-[#ffd580] transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-slate-500 text-sm">还没有分类。</p>}
      </div>
    </div>
  );
}
