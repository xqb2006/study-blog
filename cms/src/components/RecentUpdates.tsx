/**
 * Recent Updates Component
 *
 * Displays recently updated posts with relative time formatting.
 */

import { AppIcon } from '@/components/ui/app-icon';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { PostListItem } from '@/types';

interface RecentUpdatesProps {
  posts: PostListItem[];
  maxDisplay?: number;
  onEdit?: (postId: string) => void;
}

export function RecentUpdates({ posts, maxDisplay = 5, onEdit }: RecentUpdatesProps) {
  const displayPosts = posts.slice(0, maxDisplay);

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="cms-premium-card rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-950">
          <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-[#ff2d6f]">
            <AppIcon name="ri:time-line" className="size-5" />
          </span>
          最近更新
        </h3>
        <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-slate-500 text-xs uppercase tracking-[0.14em]">latest</span>
      </div>
      <div className="space-y-2.5">
        {displayPosts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onEdit?.(post.id)}
            className={cn(
              'group flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-left transition',
              'hover:border-[rgba(255,45,111,0.35)] hover:bg-rose-50',
              onEdit && 'cursor-pointer',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 self-stretch">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-[#ff2d6f] group-hover:text-white">
                <AppIcon name={post.draft ? 'ri:draft-line' : 'ri:file-text-line'} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="cms-clamp-1 font-medium text-sm text-slate-950">{post.title}</span>
                <span className="cms-clamp-1 mt-0.5 block text-slate-400 text-xs">{post.id}</span>
              </span>
              {post.draft && (
                <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700 text-xs">草稿</span>
              )}
            </div>
            <span className="self-end text-slate-500 text-xs">{formatRelativeTime(post.date)}</span>
          </button>
        ))}
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AppIcon name="ri:file-list-3-line" className="size-8 text-slate-300" />
            <p className="mt-2 text-slate-500 text-sm">还没有文章。</p>
          </div>
        )}
      </div>
    </div>
  );
}
