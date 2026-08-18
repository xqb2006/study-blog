/**
 * Dashboard Stats Component
 *
 * Displays summary statistics cards for posts with circular icon backgrounds.
 */

import { AppIcon } from '@/components/ui/app-icon';
interface DashboardStatsProps {
  total: number;
  published: number;
  draft: number;
}

export function DashboardStats({ total, published, draft }: DashboardStatsProps) {
  const stats = [
    {
      label: '全部文章',
      value: total,
      icon: 'ri:file-list-3-line',
      description: '库内内容总量',
      accent: 'text-slate-700',
      bgColor: 'bg-slate-100',
    },
    {
      label: '已发布',
      value: published,
      icon: 'ri:check-line',
      description: '线上可访问内容',
      accent: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
    },
    {
      label: '草稿',
      value: draft,
      icon: 'ri:draft-line',
      description: '待完善和待发布',
      accent: 'text-amber-700',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="mt-2 font-semibold text-3xl leading-none">{stat.value}</p>
              <p className="mt-2 text-muted-foreground text-xs">{stat.description}</p>
            </div>
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${stat.bgColor} ${stat.accent}`}>
              <AppIcon name={stat.icon} className="size-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
