import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { AnnouncementItem } from '@/types';
import { Field, inputClassName, Panel, textareaClassName } from './dashboard/Panel';

const EMPTY_ANNOUNCEMENT: AnnouncementItem = {
  id: '',
  title: '',
  content: '',
  type: 'info',
  priority: 1,
  publishDate: '',
};

const TYPE_LABELS: Record<AnnouncementItem['type'], string> = {
  info: '信息',
  success: '成功',
  warning: '警告',
  error: '错误',
};

function createAnnouncementId(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `notice-${Date.now()}`;
}

function normalizeAnnouncement(item: AnnouncementItem): AnnouncementItem {
  const title = item.title.trim();
  const id = item.id.trim() || createAnnouncementId(title);
  return {
    id,
    title,
    content: item.content.trim(),
    type: item.type || 'info',
    ...(typeof item.priority === 'number' ? { priority: item.priority } : {}),
    ...(item.color?.trim() ? { color: item.color.trim() } : {}),
    ...(item.publishDate?.trim() ? { publishDate: item.publishDate.trim() } : {}),
    ...(item.startDate?.trim() ? { startDate: item.startDate.trim() } : {}),
    ...(item.endDate?.trim() ? { endDate: item.endDate.trim() } : {}),
    ...(item.link?.url?.trim() && item.link?.text?.trim()
      ? {
          link: {
            url: item.link.url.trim(),
            text: item.link.text.trim(),
            external: item.link.external === true,
          },
        }
      : {}),
  };
}

export function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sortedAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [announcements],
  );

  const loadAnnouncements = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      setAnnouncements(JSON.parse(JSON.stringify(response.settings.announcements || [])) as AnnouncementItem[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取公告失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const updateAnnouncement = <K extends keyof AnnouncementItem>(index: number, key: K, value: AnnouncementItem[K]) => {
    setAnnouncements((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const updateLink = (index: number, key: 'url' | 'text' | 'external', value: string | boolean) => {
    setAnnouncements((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              link: {
                url: item.link?.url || '',
                text: item.link?.text || '',
                external: item.link?.external || false,
                [key]: value,
              },
            }
          : item,
      ),
    );
  };

  const handleSave = async () => {
    const normalized = announcements.map(normalizeAnnouncement);
    const invalidIndex = normalized.findIndex((item) => !item.id || !item.title || !item.content);
    if (invalidIndex >= 0) {
      toast.error(`第 ${invalidIndex + 1} 条公告缺少标题或内容`);
      return;
    }

    const ids = new Set<string>();
    const duplicate = normalized.find((item) => {
      if (ids.has(item.id)) return true;
      ids.add(item.id);
      return false;
    });
    if (duplicate) {
      toast.error(`公告 ID 重复：${duplicate.id}`);
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveSiteSettings({ announcements: normalized });
      setAnnouncements(JSON.parse(JSON.stringify(response.settings.announcements || [])) as AnnouncementItem[]);
      toast.success('公告已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存公告失败');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="font-semibold text-2xl">公告管理</h1>
          <p className="mt-1 text-muted-foreground text-sm">维护站点顶部公告，支持类型、优先级、时间范围和跳转链接。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnnouncements} disabled={isSaving}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            保存公告
          </Button>
        </div>
      </div>

      <Panel
        title={`公告列表（${announcements.length} 条）`}
        description="优先级越高越靠前；保存后会进入发布同步。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnnouncements((current) => [{ ...EMPTY_ANNOUNCEMENT, id: `notice-${Date.now()}` }, ...current])}
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加公告
          </Button>
        }
      >
        <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-medium text-sm">当前排序预览</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sortedAnnouncements.length ? (
              sortedAnnouncements.map((item) => (
                <span key={item.id || item.title} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {item.title || '未命名'} · {TYPE_LABELS[item.type || 'info']} · {item.priority || 0}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">暂无公告。</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {announcements.map((item, index) => (
            <article key={`${item.id}-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">{item.title || `公告 ${index + 1}`}</h2>
                  <p className="text-muted-foreground text-xs">{item.id || '保存时会自动生成 ID'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setAnnouncements((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="删除公告">
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="公告 ID">
                  <input value={item.id} onChange={(event) => updateAnnouncement(index, 'id', event.target.value)} placeholder="welcome-2026" className={inputClassName} />
                </Field>
                <Field label="标题">
                  <input value={item.title} onChange={(event) => updateAnnouncement(index, 'title', event.target.value)} className={inputClassName} />
                </Field>
                <Field label="类型">
                  <select value={item.type || 'info'} onChange={(event) => updateAnnouncement(index, 'type', event.target.value as AnnouncementItem['type'])} className={inputClassName}>
                    <option value="info">信息</option>
                    <option value="success">成功</option>
                    <option value="warning">警告</option>
                    <option value="error">错误</option>
                  </select>
                </Field>
                <Field label="优先级">
                  <input
                    type="number"
                    value={item.priority ?? ''}
                    onChange={(event) => updateAnnouncement(index, 'priority', event.target.value ? Number(event.target.value) : undefined)}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="内容">
                  <textarea value={item.content} onChange={(event) => updateAnnouncement(index, 'content', event.target.value)} rows={3} className={textareaClassName} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="自定义颜色">
                  <input value={item.color || ''} onChange={(event) => updateAnnouncement(index, 'color', event.target.value)} placeholder="#6366F1" className={inputClassName} />
                </Field>
                <Field label="发布日期">
                  <input value={item.publishDate || ''} onChange={(event) => updateAnnouncement(index, 'publishDate', event.target.value)} placeholder="2026-06-20" className={inputClassName} />
                </Field>
                <Field label="开始显示">
                  <input value={item.startDate || ''} onChange={(event) => updateAnnouncement(index, 'startDate', event.target.value)} placeholder="2026-06-20T00:00:00+08:00" className={inputClassName} />
                </Field>
                <Field label="结束显示">
                  <input value={item.endDate || ''} onChange={(event) => updateAnnouncement(index, 'endDate', event.target.value)} placeholder="2026-07-01T00:00:00+08:00" className={inputClassName} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_120px]">
                <Field label="跳转链接">
                  <input value={item.link?.url || ''} onChange={(event) => updateLink(index, 'url', event.target.value)} placeholder="https://example.com" className={inputClassName} />
                </Field>
                <Field label="链接文字">
                  <input value={item.link?.text || ''} onChange={(event) => updateLink(index, 'text', event.target.value)} placeholder="了解更多" className={inputClassName} />
                </Field>
                <label className="mt-7 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <input type="checkbox" checked={item.link?.external === true} onChange={(event) => updateLink(index, 'external', event.target.checked)} className="size-4" />
                  <span className="text-sm">新窗口</span>
                </label>
              </div>
            </article>
          ))}
          {announcements.length === 0 && <p className="text-muted-foreground text-sm">暂无公告。</p>}
        </div>
      </Panel>
    </div>
  );
}
