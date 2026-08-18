import { AppIcon } from '@/components/ui/app-icon';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getImagePreviewSrc, getPublicImageReferenceError } from '@/lib/media-path';
import type { MediaFile } from '@/types';
import { inputClassName } from './dashboard/Panel';
import { MediaPickerDialog } from './MediaPickerDialog';

interface MediaPathFieldProps {
  value: string;
  placeholder?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  previewShape?: 'cover' | 'avatar';
  onChange: (value: string) => void;
}

export function MediaPathField({
  value,
  placeholder,
  dialogTitle = '选择图片',
  dialogDescription = '从 public/img 素材库中选择一张图片。',
  previewShape = 'cover',
  onChange,
}: MediaPathFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const previewSrc = getImagePreviewSrc(value);
  const isAvatar = previewShape === 'avatar';
  const validationError = getPublicImageReferenceError(value);

  const handleSelect = (file: MediaFile) => {
    onChange(file.publicPath);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={validationError ? `${inputClassName} border-destructive` : inputClassName}
          aria-invalid={Boolean(validationError)}
        />
        <Button type="button" variant="outline" className="shrink-0 px-3" onClick={() => setPickerOpen(true)}>
          <AppIcon name="ri:image-add-line" className="mr-1.5 size-4" />
          选择
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-white/45 p-2">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className={isAvatar ? 'size-12 rounded-full object-cover' : 'h-12 w-20 rounded-md object-cover'}
            loading="lazy"
          />
        ) : (
          <div className={isAvatar ? 'flex size-12 items-center justify-center rounded-full bg-muted' : 'flex h-12 w-20 items-center justify-center rounded-md bg-muted'}>
            <AppIcon name="ri:image-line" className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-xs">{previewSrc ? '当前预览' : '暂无可预览图片'}</p>
          <p className="line-clamp-1 font-mono text-muted-foreground text-xs">{value.trim() || placeholder || '未填写路径'}</p>
        </div>
      </div>
      {validationError && <p className="text-destructive text-xs">{validationError}</p>}
      {!validationError && value.trim() && /^https?:\/\//i.test(value.trim()) && (
        <p className="text-muted-foreground text-xs">外链图片会按公开 URL 保存，支持 GitHub、CDN 等公开地址。</p>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        title={dialogTitle}
        description={dialogDescription}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
      />
    </div>
  );
}
