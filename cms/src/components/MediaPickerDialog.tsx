import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listMedia, uploadMedia } from '@/lib/api';
import { getPageWindow } from '@/lib/pagination';
import type { MediaFile } from '@/types';
import { inputClassName } from './dashboard/Panel';
import { PaginationControls } from './dashboard/PaginationControls';

interface MediaPickerDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: MediaFile) => void;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPickerDialog({
  open,
  title = '选择图片',
  description = '从 public/img 素材库中选择一张图片。',
  onOpenChange,
  onSelect,
}: MediaPickerDialogProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [uploadDirectory, setUploadDirectory] = useState('cms-uploads');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoading(true);
    listMedia()
      .then((response) => {
        if (isMounted) setFiles(response.files);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : '读取素材库失败');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return files;

    return files.filter((file) => file.publicPath.toLowerCase().includes(keyword) || file.name.toLowerCase().includes(keyword));
  }, [files, search]);

  const pageWindow = useMemo(() => getPageWindow(filteredFiles, page, pageSize), [filteredFiles, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, files.length]);

  const handleSelect = (file: MediaFile) => {
    onSelect(file);
    onOpenChange(false);
  };

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

      setFiles((current) => {
        const nextFiles = new Map(current.map((file) => [file.publicPath, file]));
        for (const file of uploaded) nextFiles.set(file.publicPath, file);
        return [...nextFiles.values()].sort((a, b) => a.publicPath.localeCompare(b.publicPath));
      });

      toast.success(`已上传 ${uploaded.length} 张图片`);
      if (uploaded.length === 1 && uploaded[0]) {
        handleSelect(uploaded[0]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传图片失败');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-border/70 border-b px-5 pt-5 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <AppIcon name="ri:search-line" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索图片名称或路径..."
                className={`${inputClassName} pl-9`}
              />
            </div>
            <p className="text-muted-foreground text-sm">{filteredFiles.length} / {files.length} 张图片</p>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-white/45 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block space-y-1.5">
              <span className="font-medium text-sm">上传目录</span>
              <input
                value={uploadDirectory}
                onChange={(event) => setUploadDirectory(event.target.value)}
                placeholder="cms-uploads"
                className={inputClassName}
              />
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg cms-gradient-primary px-4 font-medium text-primary-foreground text-sm shadow-[var(--cms-soft-shadow)] transition-all hover:-translate-y-0.5">
              <AppIcon name={isUploading ? 'ri:loader-4-line' : 'ri:upload-cloud-2-line'} className={isUploading ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
              {isUploading ? '上传中' : '上传并使用'}
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

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <AppIcon name="ri:loader-4-line" className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <AppIcon name="ri:image-line" className="size-10 text-muted-foreground" />
              <p className="font-medium text-sm">没有找到图片</p>
              <p className="text-muted-foreground text-sm">可以先到素材库上传，再回来选择。</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageWindow.items.map((file) => (
                <button
                  key={file.publicPath}
                  type="button"
                  onClick={() => handleSelect(file)}
                  className="group overflow-hidden rounded-xl border border-white/70 bg-white/58 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white/82"
                >
                  <span className="block aspect-[16/10] overflow-hidden bg-muted">
                    <img src={file.publicPath} alt={file.name} className="size-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                  </span>
                  <span className="block space-y-1 p-3">
                    <span className="line-clamp-1 block font-medium text-sm">{file.name}</span>
                    <span className="line-clamp-1 block font-mono text-muted-foreground text-xs">{file.publicPath}</span>
                    <span className="flex items-center justify-between text-muted-foreground text-xs">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{file.extension.replace('.', '').toUpperCase()}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredFiles.length > 0 && (
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
        )}

        <div className="flex justify-end border-border/70 border-t bg-white/28 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
