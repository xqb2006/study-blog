import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { inputClassName } from './Panel';

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  pageCount,
  total,
  start,
  end,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < pageCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-border/70 border-t bg-white/30 px-4 py-3">
      <p className="text-muted-foreground text-sm">
        {total === 0 ? '暂无数据' : `${start}-${end} / ${total}`} · 第 {page} / {pageCount} 页
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-muted-foreground text-sm">
          每页
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className={`${inputClassName} h-9 w-20 py-1`}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={!canGoPrevious} title="第一页">
            <AppIcon name="ri:skip-left-line" className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canGoPrevious} title="上一页">
            <AppIcon name="ri:arrow-left-s-line" className="size-4" />
            上一页
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canGoNext} title="下一页">
            下一页
            <AppIcon name="ri:arrow-right-s-line" className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageCount)} disabled={!canGoNext} title="最后一页">
            <AppIcon name="ri:skip-right-line" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
