/**
 * Post Table Component
 *
 * Displays a sortable table of blog posts with actions.
 */

import { AppIcon } from '@/components/ui/app-icon';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { SortField, SortOrder } from '@/hooks';
import { getPageWindow } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import type { PostListItem } from '@/types';
import { PaginationControls } from './dashboard/PaginationControls';

interface SortableHeaderProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

function SortableHeader({ label, field, sortField, sortOrder, onSort }: SortableHeaderProps) {
  const isActive = field === sortField;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn('flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-wide', isActive && 'text-primary')}
    >
      {label}
      <AppIcon
        name={isActive ? (sortOrder === 'asc' ? 'ri:arrow-up-s-fill' : 'ri:arrow-down-s-fill') : 'ri:arrow-up-down-line'}
        className={cn('size-4', !isActive && 'opacity-50')}
      />
    </button>
  );
}

interface PostTableProps {
  posts: PostListItem[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onToggleDraft: (postId: string) => void;
  onToggleSticky?: (postId: string) => void;
  onDelete?: (postId: string, title: string) => void;
  onEdit?: (postId: string) => void;
  onOpenInEditor?: (postId: string) => void;
}

export function PostTable({
  posts,
  sortField,
  sortOrder,
  onSort,
  onToggleDraft,
  onToggleSticky,
  onDelete,
  onEdit,
  onOpenInEditor,
}: PostTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const pageWindow = useMemo(() => getPageWindow(posts, page, pageSize), [posts, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [posts]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card p-8 text-center">
        <AppIcon name="ri:file-list-3-line" className="size-12 text-muted-foreground" />
        <p className="mt-2 font-medium text-muted-foreground">没有找到文章</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/84 shadow-[var(--cms-card-shadow)] backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-border/70 border-b bg-white/34">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortableHeader label="标题" field="title" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
              </th>
              <th className="hidden px-4 py-3 text-left md:table-cell">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">分类</span>
              </th>
              <th className="hidden px-4 py-3 text-left lg:table-cell">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">标签</span>
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader label="日期" field="date" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-left">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">状态</span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageWindow.items.map((post) => (
              <tr key={post.id} className="transition-colors hover:bg-white/42">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {post.sticky && (
                      <span title="置顶">
                        <AppIcon name="ri:pushpin-fill" className="size-4 shrink-0 text-orange-500" />
                      </span>
                    )}
                    <span className="line-clamp-1 font-medium text-sm">{post.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{post.id}</p>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="text-muted-foreground text-sm">{post.categories.join(' > ') || '-'}</span>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                    {post.tags.length > 3 && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs">+{post.tags.length - 3}</span>
                    )}
                    {post.tags.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-muted-foreground text-sm">{format(new Date(post.date), 'yyyy-MM-dd')}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs',
                      post.draft ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500',
                    )}
                  >
                    {post.draft ? '草稿' : '已发布'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(post.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="编辑文章"
                      >
                        <AppIcon name="ri:edit-line" className="size-4" />
                      </button>
                    )}
                    {onOpenInEditor && (
                      <button
                        type="button"
                        onClick={() => onOpenInEditor(post.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="在本地编辑器中打开"
                      >
                        <AppIcon name="ri:vscode-line" className="size-4" />
                      </button>
                    )}
                    {onToggleSticky && (
                      <button
                        type="button"
                        onClick={() => onToggleSticky(post.id)}
                        className={cn(
                          'rounded-md p-1.5 transition-colors hover:bg-accent hover:text-foreground',
                          post.sticky ? 'text-orange-500' : 'text-muted-foreground',
                        )}
                        title={post.sticky ? '取消置顶' : '置顶文章'}
                      >
                        <AppIcon name={post.sticky ? 'ri:pushpin-fill' : 'ri:pushpin-line'} className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleDraft(post.id)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={post.draft ? '发布文章' : '设为草稿'}
                    >
                      <AppIcon name={post.draft ? 'ri:check-line' : 'ri:draft-line'} className="size-4" />
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(post.id, post.title)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="删除文章"
                      >
                        <AppIcon name="ri:delete-bin-line" className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={pageWindow.page}
        pageSize={pageWindow.pageSize}
        pageCount={pageWindow.pageCount}
        total={pageWindow.total}
        start={pageWindow.start}
        end={pageWindow.end}
        pageSizeOptions={[12, 24, 48]}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </div>
  );
}
