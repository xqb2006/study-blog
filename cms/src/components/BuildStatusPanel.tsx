import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getBuildStatus, rebuildBlog } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BuildStatusResponse } from '@/types';
import { Panel } from './dashboard/Panel';

const STATUS_META: Record<BuildStatusResponse['lastResult'], { label: string; icon: string; className: string }> = {
  success: {
    label: '成功',
    icon: 'ri:checkbox-circle-line',
    className: 'bg-green-500/10 text-green-500',
  },
  failed: {
    label: '失败',
    icon: 'ri:error-warning-line',
    className: 'bg-red-500/10 text-red-500',
  },
  running: {
    label: '同步中',
    icon: 'ri:loader-4-line',
    className: 'bg-blue-500/10 text-blue-500',
  },
  unknown: {
    label: '未知',
    icon: 'ri:question-line',
    className: 'bg-muted text-muted-foreground',
  },
};

function formatDate(value?: string): string {
  if (!value) return '暂无';
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

export function BuildStatusPanel() {
  const [status, setStatus] = useState<BuildStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);

  const loadStatus = async (showError = true) => {
    try {
      const response = await getBuildStatus();
      setStatus(response);
    } catch (error) {
      if (showError) toast.error(error instanceof Error ? error.message : '读取发布同步失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!status?.isRunning && !status?.isPending) return;
    const timer = window.setInterval(() => loadStatus(false), 2000);
    return () => window.clearInterval(timer);
  }, [status?.isPending, status?.isRunning]);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      const response = await rebuildBlog();
      setStatus(response);
      toast.success(response.message || '已开始同步 Public Blog');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '启动同步失败');
    } finally {
      setIsRebuilding(false);
    }
  };

  const meta = STATUS_META[status?.lastResult || 'unknown'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">发布同步</h1>
          <p className="mt-1 text-muted-foreground text-sm">区分“CMS 已保存”和“Public Blog 已可见”，这里显示 Build Sync 状态、日志和重新同步入口。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadStatus()} disabled={isLoading}>
            <AppIcon name={isLoading ? 'ri:loader-4-line' : 'ri:refresh-line'} className={isLoading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            刷新状态
          </Button>
          <Button onClick={handleRebuild} disabled={isRebuilding || Boolean(status?.isRunning)}>
            <AppIcon
              name={isRebuilding || status?.isRunning ? 'ri:loader-4-line' : 'ri:rocket-line'}
              className={isRebuilding || status?.isRunning ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'}
            />
            重新同步
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <span className={cn('flex size-11 items-center justify-center rounded-full', meta.className)}>
              <AppIcon name={meta.icon} className={cn('size-6', status?.lastResult === 'running' && 'animate-spin')} />
            </span>
            <div>
              <p className="font-semibold text-xl">{status?.isRunning ? '同步中' : status?.isPending ? '已排队' : meta.label}</p>
              <p className="text-muted-foreground text-sm">当前状态</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{formatDate(status?.distUpdatedAt)}</p>
            <p className="text-muted-foreground text-sm">Public Blog dist 更新时间</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-mono text-sm">{status?.logPath || '.cache/cms/rebuild-blog.log'}</p>
            <p className="mt-1 text-muted-foreground text-sm">日志文件</p>
          </div>
        </Panel>
      </div>

      {status?.isPending && (
        <Panel>
          <div className="flex items-center gap-3 text-blue-600">
            <AppIcon name="ri:time-line" className="size-5" />
            <p className="text-sm">已有新的静态内容变更排队，当前同步完成后会继续执行下一轮。</p>
          </div>
        </Panel>
      )}

      {status?.lastResult === 'failed' && !status.isRunning && (
        <Panel>
          <div className="flex items-center gap-3 text-red-600">
            <AppIcon name="ri:error-warning-line" className="size-5" />
            <p className="text-sm">CMS 保存不受影响，但 Public Blog 上次 Build Sync 失败。请查看日志后重新同步。</p>
          </div>
        </Panel>
      )}

      <Panel title="同步日志" description="这里只显示日志尾部，同步中会每 5 秒自动刷新。">
        <pre className="max-h-[520px] min-h-72 overflow-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
          {status?.log?.trim() || '暂无构建日志。'}
        </pre>
      </Panel>
    </div>
  );
}
