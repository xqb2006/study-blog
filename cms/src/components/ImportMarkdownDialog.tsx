/**
 * Import Markdown Dialog
 *
 * Imports a Markdown file or a public Markdown URL into the blog content tree.
 */

import { AppIcon } from '@/components/ui/app-icon';
import type { FormEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { importMarkdown } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BuildSyncSummary } from '@/types';

type ImportMode = 'file' | 'url';

interface ImportMarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: string[];
  onSuccess: (postId: string, buildSync?: BuildSyncSummary) => void;
}

export function ImportMarkdownDialog({ open, onOpenChange, existingCategories, onSuccess }: ImportMarkdownDialogProps) {
  const [mode, setMode] = useState<ImportMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('笔记');
  const [tags, setTags] = useState('');
  const [draft, setDraft] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const options = existingCategories.length > 0 ? existingCategories : ['笔记'];
    return [...new Set(options)];
  }, [existingCategories]);

  const reset = useCallback(() => {
    setMode('file');
    setFile(null);
    setUrl('');
    setTitle('');
    setCategory('笔记');
    setTags('');
    setDraft(true);
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'file' && !file) {
      toast.error('请选择 .md 或 .mdx 文档');
      return;
    }
    if (mode === 'url' && !url.trim()) {
      toast.error('请填写 Markdown 链接');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await importMarkdown({
        file: mode === 'file' ? file || undefined : undefined,
        url: mode === 'url' ? url : undefined,
        title,
        category,
        tags,
        draft,
      });

      handleClose(false);
      onSuccess(response.postId, response.buildSync);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入 Markdown 失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>导入 Markdown</DialogTitle>
          <DialogDescription>上传本地 Markdown 文档，或从公开链接导入。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/25 p-1">
            {(['file', 'url'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                  mode === item ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/55',
                )}
              >
                <AppIcon name={item === 'file' ? 'ri:file-upload-line' : 'ri:link-m'} className="size-4" />
                {item === 'file' ? '上传文件' : '粘贴链接'}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <label className="block space-y-2">
              <span className="font-medium text-sm">Markdown 文档</span>
              <input
                type="file"
                accept=".md,.mdx,text/markdown,text/plain"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm"
              />
              {file && <span className="block text-muted-foreground text-xs">{file.name}</span>}
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="font-medium text-sm">Markdown 链接</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/post.md"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="font-medium text-sm">标题覆盖</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="留空则读取文档标题"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-medium text-sm">默认分类</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-medium text-sm">标签</span>
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="标签1, 标签2, 标签3"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft} onChange={(event) => setDraft(event.target.checked)} className="size-4 rounded border-input" />
            <span className="text-sm">保存为草稿</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <AppIcon name="ri:loader-4-line" className="mr-1.5 size-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <AppIcon name="ri:download-cloud-2-line" className="mr-1.5 size-4" />
                  导入并同步
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
