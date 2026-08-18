import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { listTrash, purgeTrash, restoreTrash } from '@/lib/api';
import { getPageWindow } from '@/lib/pagination';
import type { TrashEntry } from '@/types';
import { PaginationControls } from './dashboard/PaginationControls';
import { Panel } from './dashboard/Panel';

function formatDate(value?: string): string {
  if (!value) return '未知时间';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TrashPanel() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const response = await listTrash();
      setEntries(response.entries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取回收站失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (entry: TrashEntry) => {
    const confirmed = window.confirm(`确定恢复《${entry.primaryTitle}》吗？同一批删除的 ${entry.fileCount} 个文件会一起恢复。`);
    if (!confirmed) return;

    setActiveActionId(entry.trashId);
    try {
      const result = await restoreTrash(entry.trashId);
      toast.success(`文章已恢复；${result.buildSync?.message || '发布同步已请求'}`);
      await loadTrash();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '恢复文章失败');
    } finally {
      setActiveActionId(null);
    }
  };

  const handlePurge = async (entry: TrashEntry) => {
    const confirmed = window.confirm(`确定彻底清理《${entry.primaryTitle}》吗？这个操作不能从 CMS 恢复。`);
    if (!confirmed) return;

    setActiveActionId(entry.trashId);
    try {
      await purgeTrash(entry.trashId);
      toast.success('回收站记录已清理');
      await loadTrash();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '清理回收站失败');
    } finally {
      setActiveActionId(null);
    }
  };

  const totalFiles = entries.reduce((sum, entry) => sum + entry.fileCount, 0);
  const pageWindow = useMemo(() => getPageWindow(entries, page, pageSize), [entries, page, pageSize]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">回收站</h1>
          <p className="mt-1 text-muted-foreground text-sm">恢复误删文章，或清理不再需要的删除记录。</p>
        </div>
        <Button variant="outline" onClick={loadTrash} disabled={Boolean(activeActionId)}>
          <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
          刷新回收站
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div>
            <p className="font-semibold text-xl">{entries.length}</p>
            <p className="text-muted-foreground text-sm">删除批次</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{totalFiles}</p>
            <p className="text-muted-foreground text-sm">可恢复文件</p>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <AppIcon name="ri:delete-bin-6-line" className="size-6" />
            </span>
            <div>
              <p className="font-semibold text-xl">软删除</p>
              <p className="text-muted-foreground text-sm">恢复前不会覆盖现有文章</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="删除记录" description="恢复后会进入发布同步，可在发布同步查看列表和详情页更新状态。">
        <div className="space-y-4">
          {pageWindow.items.map((entry) => (
            <article key={entry.trashId} className="rounded-xl border border-border/80 bg-white/36 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{entry.primaryTitle}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">{entry.fileCount} 个文件</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">{formatSize(entry.totalSize)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">
                    删除批次：<span className="font-mono">{entry.trashId}</span> · {formatDate(entry.deletedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleRestore(entry)} disabled={activeActionId === entry.trashId}>
                    <AppIcon name={activeActionId === entry.trashId ? 'ri:loader-4-line' : 'ri:arrow-go-back-line'} className={activeActionId === entry.trashId ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
                    恢复
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePurge(entry)} disabled={activeActionId === entry.trashId}>
                    <AppIcon name="ri:delete-bin-line" className="mr-1.5 size-4" />
                    清理
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-border/80 bg-white/40">
                <table className="min-w-[680px] w-full text-sm">
                  <thead className="bg-white/48 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">文章路径</th>
                      <th className="px-3 py-2 text-left font-medium">标题</th>
                      <th className="px-3 py-2 text-left font-medium">状态</th>
                      <th className="px-3 py-2 text-left font-medium">大小</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.files.map((file) => (
                      <tr key={file.postId} className="border-border border-t">
                        <td className="px-3 py-2 font-mono text-xs">{file.postId}</td>
                        <td className="px-3 py-2">{file.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{file.draft ? '草稿' : '发布'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatSize(file.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AppIcon name="ri:delete-bin-6-line" className="size-10 text-muted-foreground" />
              <p className="font-medium">回收站是空的</p>
              <p className="text-muted-foreground text-sm">删除文章后，会在这里保留可恢复记录。</p>
            </div>
          )}
        </div>
        {entries.length > 0 && (
          <div className="-mx-4 -mb-4 mt-4">
            <PaginationControls
              page={pageWindow.page}
              pageSize={pageWindow.pageSize}
              pageCount={pageWindow.pageCount}
              total={pageWindow.total}
              start={pageWindow.start}
              end={pageWindow.end}
              pageSizeOptions={[5, 10, 20]}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
