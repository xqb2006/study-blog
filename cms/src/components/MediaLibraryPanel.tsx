import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteMedia, listMedia, uploadMedia } from '@/lib/api';
import { getPageWindow } from '@/lib/pagination';
import type { MediaFile } from '@/types';
import { Field, inputClassName, Panel } from './dashboard/Panel';
import { PaginationControls } from './dashboard/PaginationControls';

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`已复制：${value}`);
}

export function MediaLibraryPanel() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadDirectory, setUploadDirectory] = useState('cms-uploads');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      const response = await listMedia();
      setFiles(response.files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取素材库失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, []);

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return files;
    return files.filter((file) => file.publicPath.toLowerCase().includes(keyword));
  }, [files, search]);

  const pageWindow = useMemo(() => getPageWindow(filteredFiles, page, pageSize), [filteredFiles, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, files.length]);

  const handleUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;
    setIsUploading(true);
    try {
      const uploaded: MediaFile[] = [];
      for (const file of Array.from(selectedFiles)) {
        const response = await uploadMedia(file, uploadDirectory.trim());
        uploaded.push(response.file);
      }
      setFiles((current) => {
        const map = new Map(current.map((file) => [file.publicPath, file]));
        uploaded.forEach((file) => map.set(file.publicPath, file));
        return [...map.values()].sort((left, right) => left.publicPath.localeCompare(right.publicPath));
      });
      if (uploaded.length === 1 && uploaded[0]) await copyText(uploaded[0].publicPath);
      toast.success(`已上传 ${uploaded.length} 张图片，并提交到 GitHub。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传图片失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`确定永久删除 ${file.name} 吗？GitHub 提交后无法从后台恢复。`)) return;
    setDeletingPath(file.publicPath);
    try {
      await deleteMedia(file.publicPath);
      setFiles((current) => current.filter((item) => item.publicPath !== file.publicPath));
      toast.success('图片已删除，并提交到 GitHub。');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除图片失败');
    } finally {
      setDeletingPath(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">素材库</h1>
          <p className="mt-1 text-muted-foreground text-sm">图片会保存到 GitHub 的 public/img，Cloudflare 会自动发布。</p>
        </div>
        <Button variant="outline" onClick={() => void loadMedia()} disabled={isLoading}>
          <AppIcon name={isLoading ? 'ri:loader-4-line' : 'ri:refresh-line'} className={isLoading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
          刷新
        </Button>
      </div>

      <Panel title="上传图片" description="上传成功后会自动提交 GitHub；单张图片会自动复制公开路径。">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Field label="保存目录" description="填写 public/img 下的相对目录，例如 cover 或 cms-uploads。">
            <input value={uploadDirectory} onChange={(event) => setUploadDirectory(event.target.value)} placeholder="cms-uploads" className={inputClassName} />
          </Field>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg cms-gradient-primary px-4 font-medium text-primary-foreground text-sm transition-all">
            <AppIcon name={isUploading ? 'ri:loader-4-line' : 'ri:upload-cloud-2-line'} className={isUploading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            {isUploading ? '上传中' : '选择图片上传'}
            <input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp" multiple disabled={isUploading} onChange={(event) => { void handleUpload(event.target.files); event.target.value = ''; }} className="sr-only" />
          </label>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-72 flex-1">
            <AppIcon name="ri:search-line" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索图片路径..." className={`${inputClassName} pl-9`} />
          </div>
          <div className="text-muted-foreground text-sm">{filteredFiles.length} / {files.length} 张图片</div>
        </div>
      </Panel>

      {isLoading ? <div className="flex h-64 items-center justify-center"><AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" /></div> : filteredFiles.length === 0 ? <Panel><div className="flex flex-col items-center justify-center gap-2 py-12 text-center"><AppIcon name="ri:image-line" className="size-12 text-muted-foreground" /><p className="text-muted-foreground text-sm">没有找到图片。</p></div></Panel> : <>
        <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/42 shadow-[var(--cms-card-shadow)] backdrop-blur">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {pageWindow.items.map((file) => <article key={file.publicPath} className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-white/62 shadow-[var(--cms-card-shadow)] backdrop-blur">
              <div className="aspect-[4/3] overflow-hidden bg-white/60"><img src={file.publicPath} alt={file.name} className="size-full object-cover" loading="lazy" /></div>
              <div className="space-y-2 p-3"><h2 className="line-clamp-1 font-medium text-sm">{file.name}</h2><p className="line-clamp-2 break-all font-mono text-muted-foreground text-xs">{file.publicPath}</p><p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p><div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => void copyText(file.publicPath)}>复制路径</Button><Button variant="ghost" size="sm" onClick={() => void handleDelete(file)} disabled={deletingPath === file.publicPath}><AppIcon name={deletingPath === file.publicPath ? 'ri:loader-4-line' : 'ri:delete-bin-line'} className={deletingPath === file.publicPath ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />删除</Button></div></div>
            </article>)}
          </div>
        </div>
        <PaginationControls page={pageWindow.page} pageSize={pageWindow.pageSize} pageCount={pageWindow.pageCount} total={pageWindow.total} start={pageWindow.start} end={pageWindow.end} pageSizeOptions={[12, 24, 48]} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} />
      </>}
    </div>
  );
}
