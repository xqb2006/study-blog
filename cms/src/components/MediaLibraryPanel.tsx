import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteMedia, listMedia, listMediaTrash, purgeMedia, restoreMedia, uploadMedia } from '@/lib/api';
import { getPageWindow } from '@/lib/pagination';
import type { MediaFile, MediaTrashFile } from '@/types';
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

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function MediaLibraryPanel() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [trashFiles, setTrashFiles] = useState<MediaTrashFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrashLoading, setIsTrashLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [activeTrashPath, setActiveTrashPath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadDirectory, setUploadDirectory] = useState('cms-uploads');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [trashPage, setTrashPage] = useState(1);
  const [trashPageSize, setTrashPageSize] = useState(6);

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

  const loadMediaTrash = async () => {
    setIsTrashLoading(true);
    try {
      const response = await listMediaTrash();
      setTrashFiles(response.files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取媒体回收失败');
    } finally {
      setIsTrashLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
    loadMediaTrash();
  }, []);

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return files;
    return files.filter((file) => file.publicPath.toLowerCase().includes(keyword));
  }, [files, search]);

  const pageWindow = useMemo(() => getPageWindow(filteredFiles, page, pageSize), [filteredFiles, page, pageSize]);
  const trashPageWindow = useMemo(
    () => getPageWindow(trashFiles, trashPage, trashPageSize),
    [trashFiles, trashPage, trashPageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, files.length]);

  useEffect(() => {
    setTrashPage(1);
  }, [trashFiles.length]);

  const folders = useMemo(() => {
    const folderSet = new Set(files.map((file) => file.relativePath.split('/').slice(0, -1).join('/') || '根目录'));
    return [...folderSet].sort();
  }, [files]);

  const handleUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;

    const imageFiles = [...selectedFiles].filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      toast.error('请选择图片文件');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded: MediaFile[] = [];
      for (const file of imageFiles) {
        const response = await uploadMedia(file, uploadDirectory);
        uploaded.push(response.file);
      }
      toast.success(`已上传 ${uploaded.length} 张图片`);
      setFiles((current) => {
        const map = new Map(current.map((file) => [file.publicPath, file]));
        for (const file of uploaded) map.set(file.publicPath, file);
        return [...map.values()].sort((a, b) => a.publicPath.localeCompare(b.publicPath));
      });
      const firstUploaded = uploaded[0];
      if (uploaded.length === 1 && firstUploaded) {
        await copyText(firstUploaded.publicPath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传图片失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: MediaFile) => {
    const confirmed = window.confirm(`确定把 ${file.name} 移入媒体回收目录吗？博客里如果还引用这张图，会显示不出来。`);
    if (!confirmed) return;

    setDeletingPath(file.publicPath);
    try {
      const response = await deleteMedia(file.publicPath);
      setFiles((current) => current.filter((item) => item.publicPath !== file.publicPath));
      toast.success(`已移入媒体回收：${response.trashPath}`);
      await loadMediaTrash();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除图片失败');
    } finally {
      setDeletingPath(null);
    }
  };

  const handleRestore = async (file: MediaTrashFile) => {
    setActiveTrashPath(file.trashPath);
    try {
      const response = await restoreMedia(file.trashPath);
      setFiles((current) => {
        const map = new Map(current.map((item) => [item.publicPath, item]));
        map.set(response.file.publicPath, response.file);
        return [...map.values()].sort((a, b) => a.publicPath.localeCompare(b.publicPath));
      });
      setTrashFiles((current) => current.filter((item) => item.trashPath !== file.trashPath));
      toast.success(`已恢复：${response.file.publicPath}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '恢复图片失败');
    } finally {
      setActiveTrashPath(null);
    }
  };

  const handlePurge = async (file: MediaTrashFile) => {
    const confirmed = window.confirm(`确定彻底清理 ${file.name} 吗？清理后不能从 CMS 恢复。`);
    if (!confirmed) return;

    setActiveTrashPath(file.trashPath);
    try {
      await purgeMedia(file.trashPath);
      setTrashFiles((current) => current.filter((item) => item.trashPath !== file.trashPath));
      toast.success('媒体回收记录已清理');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '清理图片失败');
    } finally {
      setActiveTrashPath(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">素材库</h1>
          <p className="mt-1 text-muted-foreground text-sm">浏览 public/img 图片资源，复制路径后可用于文章封面、头像和站点分享图。</p>
        </div>
        <Button variant="outline" onClick={loadMedia} disabled={isLoading}>
          <AppIcon name={isLoading ? 'ri:loader-4-line' : 'ri:refresh-line'} className={isLoading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
          刷新
        </Button>
      </div>

      <Panel title="上传图片" description="上传后会保存到 public/img 下，路径可直接用于文章封面、正文图片、头像和分享图。">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Field label="保存目录" description="只填写 public/img 下面的相对目录，例如 cms-uploads 或 cover。">
            <input
              value={uploadDirectory}
              onChange={(event) => setUploadDirectory(event.target.value)}
              placeholder="cms-uploads"
              className={inputClassName}
            />
          </Field>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg cms-gradient-primary px-4 font-medium text-primary-foreground text-sm shadow-[var(--cms-soft-shadow)] transition-all hover:-translate-y-0.5">
            <AppIcon name={isUploading ? 'ri:loader-4-line' : 'ri:upload-cloud-2-line'} className={isUploading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            {isUploading ? '上传中' : '选择图片上传'}
            <input
              type="file"
              accept="image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
              multiple
              disabled={isUploading}
              onChange={(event) => {
                void handleUpload(event.target.files);
                event.target.value = '';
              }}
              className="sr-only"
            />
          </label>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-72 flex-1">
            <AppIcon name="ri:search-line" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索图片路径..."
              className={`${inputClassName} pl-9`}
            />
          </div>
          <div className="text-muted-foreground text-sm">
            {filteredFiles.length} / {files.length} 张图片，{folders.length} 个文件夹
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-rose-600 text-sm">
            <AppIcon name="ri:delete-bin-6-line" className="size-4" />
            回收 {trashFiles.length}
          </div>
        </div>
      </Panel>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AppIcon name="ri:image-line" className="size-12 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">没有找到图片。</p>
          </div>
        </Panel>
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/42 shadow-[var(--cms-card-shadow)] backdrop-blur">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {pageWindow.items.map((file) => (
              <article key={file.publicPath} className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-white/62 shadow-[var(--cms-card-shadow)] backdrop-blur">
                <button
                  type="button"
                  onClick={() => copyText(file.publicPath)}
                  className="group relative block aspect-[16/10] w-full overflow-hidden bg-muted"
                  title="点击复制图片路径"
                >
                  <img src={file.publicPath} alt={file.name} className="size-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                  <span className="absolute right-2 bottom-2 rounded-md bg-background/85 px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    复制路径
                  </span>
                </button>
                <div className="space-y-2 p-3">
                  <div>
                    <h2 className="line-clamp-1 font-medium text-sm">{file.name}</h2>
                    <p className="line-clamp-1 text-muted-foreground text-xs">{file.publicPath}</p>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{file.extension.replace('.', '').toUpperCase()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => copyText(file.publicPath)}>
                      <AppIcon name="ri:file-copy-line" className="mr-1.5 size-4" />
                      路径
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(file)} disabled={deletingPath === file.publicPath} title="移入媒体回收目录">
                      <AppIcon name={deletingPath === file.publicPath ? 'ri:loader-4-line' : 'ri:delete-bin-line'} className={deletingPath === file.publicPath ? 'size-4 animate-spin' : 'size-4'} />
                    </Button>
                    <a
                      href={file.publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-3 text-sm hover:bg-background/70"
                    >
                      <AppIcon name="ri:external-link-line" className="size-4" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
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
      )}

      <Panel
        title="媒体回收"
        description="误删图片可以在这里恢复；确认不用后再清理，避免博客引用图片时失效。"
        actions={
          <Button variant="outline" size="sm" onClick={loadMediaTrash} disabled={isTrashLoading || Boolean(activeTrashPath)}>
            <AppIcon name={isTrashLoading ? 'ri:loader-4-line' : 'ri:refresh-line'} className={isTrashLoading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            刷新
          </Button>
        }
      >
        {isTrashLoading ? (
          <div className="flex h-28 items-center justify-center">
            <AppIcon name="ri:loader-4-line" className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : trashFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AppIcon name="ri:inbox-archive-line" className="size-10 text-muted-foreground" />
            <p className="font-medium text-sm">媒体回收是空的</p>
            <p className="text-muted-foreground text-sm">删除图片后，会在这里保留可恢复记录。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {trashPageWindow.items.map((file) => (
                <article key={file.trashPath} className="rounded-xl border border-white/70 bg-white/48 p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <AppIcon name="ri:image-2-line" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-1 font-medium text-sm">{file.name}</h2>
                      <p className="mt-1 line-clamp-1 font-mono text-muted-foreground text-xs">{file.publicPath}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-muted-foreground">{formatFileSize(file.size)}</span>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-muted-foreground">{formatDate(file.deletedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleRestore(file)} disabled={activeTrashPath === file.trashPath}>
                      <AppIcon name={activeTrashPath === file.trashPath ? 'ri:loader-4-line' : 'ri:arrow-go-back-line'} className={activeTrashPath === file.trashPath ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
                      恢复
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePurge(file)} disabled={activeTrashPath === file.trashPath}>
                      <AppIcon name="ri:delete-bin-line" className="mr-1.5 size-4" />
                      清理
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="-mx-4 -mb-4">
              <PaginationControls
                page={trashPageWindow.page}
                pageSize={trashPageWindow.pageSize}
                pageCount={trashPageWindow.pageCount}
                total={trashPageWindow.total}
                start={trashPageWindow.start}
                end={trashPageWindow.end}
                pageSizeOptions={[6, 12, 24]}
                onPageChange={setTrashPage}
                onPageSizeChange={(nextPageSize) => {
                  setTrashPageSize(nextPageSize);
                  setTrashPage(1);
                }}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
