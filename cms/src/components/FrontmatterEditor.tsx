/**
 * Frontmatter Editor
 *
 * Sidebar panel for editing post frontmatter fields.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { AppIcon } from '@/components/ui/app-icon';
import { format, isValid, parse } from 'date-fns';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { MediaPathField } from '@/components/MediaPathField';
import { PostReadinessPanel } from '@/components/PostReadinessPanel';
import { type FrontmatterFormData, frontmatterSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import type { BlogSchema } from '@/types';

export interface FrontmatterEditorRef {
  getFormData: () => FrontmatterFormData;
  isDirty: () => boolean;
}

interface FrontmatterEditorProps {
  frontmatter: BlogSchema;
  content?: string;
  onChange: (frontmatter: BlogSchema) => void;
  onCategoriesChange?: (categories: string[]) => void;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const nextDate = date instanceof Date ? date : new Date(date);
  if (!isValid(nextDate)) return '';
  return format(nextDate, 'yyyy-MM-dd HH:mm:ss');
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;
  const iso = new Date(dateStr);
  if (isValid(iso)) return iso;
  return undefined;
}

function categoriesToString(categories?: string | string[] | string[][]): string {
  if (!categories) return '';
  if (typeof categories === 'string') return categories;
  const flat = categories.flatMap((category) => (Array.isArray(category) ? category : [category]));
  return flat.join(' > ');
}

function stringToCategories(value: string): string[] | undefined {
  if (!value.trim()) return undefined;
  return value
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToString(tags?: string[]): string {
  if (!tags?.length) return '';
  return tags.join(', ');
}

function stringToTags(value: string): string[] | undefined {
  if (!value.trim()) return undefined;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formDataToFrontmatter(data: FrontmatterFormData): BlogSchema {
  const result: BlogSchema = {
    title: data.title,
    draft: data.draft,
    sticky: data.sticky,
    tocNumbering: data.tocNumbering,
    excludeFromSummary: data.excludeFromSummary,
    math: data.math,
    quiz: data.quiz,
  };

  if (data.date) result.date = parseDate(data.date);
  if (data.updated) result.updated = parseDate(data.updated);

  const categories = stringToCategories(data.categories || '');
  if (categories?.length) result.categories = [categories];

  const tags = stringToTags(data.tags || '');
  if (tags) result.tags = tags;

  if (data.description?.trim()) result.description = data.description.trim();
  if (data.cover?.trim()) result.cover = data.cover.trim();
  if (data.link?.trim()) result.link = data.link.trim();
  if (data.subtitle?.trim()) result.subtitle = data.subtitle.trim();

  return result;
}

function FormField({
  label,
  id,
  type = 'text',
  placeholder,
  error,
  className,
  ...props
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  error?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="font-medium text-muted-foreground text-xs">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-input bg-white/72 px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          error && 'border-destructive',
        )}
        {...props}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function FormTextarea({
  label,
  id,
  placeholder,
  error,
  className,
  ...props
}: {
  label: string;
  id: string;
  placeholder?: string;
  error?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="font-medium text-muted-foreground text-xs">
        {label}
      </label>
      <textarea
        id={id}
        placeholder={placeholder}
        className={cn(
          'w-full resize-none rounded-lg border border-input bg-white/72 px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          error && 'border-destructive',
        )}
        {...props}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function FormCheckbox({
  label,
  id,
  description,
  ...props
}: {
  label: string;
  id: string;
  description?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-white/45 px-3 py-2">
      <input id={id} type="checkbox" className="mt-0.5 size-4 rounded border-input" {...props} />
      <span>
        <span className="block text-sm">{label}</span>
        {description && <span className="block text-muted-foreground text-xs">{description}</span>}
      </span>
    </label>
  );
}

export const FrontmatterEditor = forwardRef<FrontmatterEditorRef, FrontmatterEditorProps>(function FrontmatterEditor(
  { frontmatter, content = '', onChange, onCategoriesChange },
  ref,
) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<FrontmatterFormData>({
    resolver: zodResolver(frontmatterSchema),
    defaultValues: {
      title: frontmatter.title || '',
      date: formatDate(frontmatter.date),
      updated: formatDate(frontmatter.updated),
      description: frontmatter.description || '',
      categories: categoriesToString(frontmatter.categories),
      tags: tagsToString(frontmatter.tags),
      cover: frontmatter.cover || '',
      link: frontmatter.link || '',
      subtitle: frontmatter.subtitle || '',
      draft: frontmatter.draft === true,
      sticky: frontmatter.sticky ?? false,
      tocNumbering: frontmatter.tocNumbering ?? true,
      excludeFromSummary: frontmatter.excludeFromSummary ?? false,
      math: frontmatter.math ?? false,
      quiz: frontmatter.quiz ?? false,
    },
  });

  const {
    register,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  useImperativeHandle(ref, () => ({
    getFormData: () => form.getValues(),
    isDirty: () => isDirty,
  }));

  useEffect(() => {
    const subscription = watch((values) => {
      const frontmatterValue = formDataToFrontmatter(values as FrontmatterFormData);
      onChange(frontmatterValue);

      if (onCategoriesChange) {
        onCategoriesChange(stringToCategories(values.categories || '') || []);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onChange, onCategoriesChange]);

  const watchedValues = watch() as FrontmatterFormData;
  const currentFrontmatter = formDataToFrontmatter(watchedValues);

  return (
    <div className="space-y-4 p-4">
      <PostReadinessPanel frontmatter={currentFrontmatter} content={content} />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">文章属性</h3>
        <span className={cn('rounded-full px-2 py-0.5 text-xs', watchedValues.draft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
          {watchedValues.draft ? '草稿' : '已发布'}
        </span>
      </div>

      <div className="space-y-3">
        <FormField label="标题" id="title" placeholder="文章标题" error={errors.title?.message} {...register('title')} />

        <div className="grid grid-cols-2 gap-2">
          <FormField label="发布日期" id="date" placeholder="YYYY-MM-DD HH:mm:ss" error={errors.date?.message} {...register('date')} />
          <FormField label="更新时间" id="updated" placeholder="YYYY-MM-DD HH:mm:ss" error={errors.updated?.message} {...register('updated')} />
        </div>

        <FormTextarea label="摘要" id="description" placeholder="写一句首页卡片能直接展示的摘要..." rows={3} error={errors.description?.message} {...register('description')} />

        <FormField label="分类" id="categories" placeholder="笔记 > 前端 > React" error={errors.categories?.message} {...register('categories')} />

        <FormField label="标签" id="tags" placeholder="标签1, 标签2, 标签3" error={errors.tags?.message} {...register('tags')} />

        <div className="space-y-1">
          <label htmlFor="cover" className="font-medium text-muted-foreground text-xs">
            封面图
          </label>
          <MediaPathField
            value={watchedValues.cover || ''}
            placeholder="/img/cover/1.webp"
            dialogTitle="选择文章封面"
            dialogDescription="选择后会自动填入封面图路径。"
            onChange={(value) => setValue('cover', value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
          />
          {errors.cover?.message && <p className="text-destructive text-xs">{errors.cover.message}</p>}
        </div>

        <FormField label="固定链接" id="link" placeholder="custom-post-slug" error={errors.link?.message} {...register('link')} />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-white/55 px-3 py-2 text-sm transition-colors hover:bg-white/75"
      >
        <span className="font-medium">高级选项</span>
        <AppIcon name={showAdvanced ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'} className="size-5 text-muted-foreground" />
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3">
          <FormField label="副标题" id="subtitle" placeholder="文章副标题" error={errors.subtitle?.message} {...register('subtitle')} />

          <div className="space-y-2">
            <FormCheckbox label="草稿" id="draft" description="开启后前台不会发布展示" {...register('draft')} />
            <FormCheckbox label="置顶" id="sticky" description="在文章列表中优先显示" {...register('sticky')} />
            <FormCheckbox label="目录编号" id="tocNumbering" description="为标题目录添加层级编号" {...register('tocNumbering')} />
            <FormCheckbox label="排除 AI 摘要" id="excludeFromSummary" description="跳过 AI 摘要生成" {...register('excludeFromSummary')} />
            <FormCheckbox label="数学公式（LaTeX）" id="math" description="启用数学公式渲染" {...register('math')} />
            <FormCheckbox label="练习题模式" id="quiz" description="启用练习题交互" {...register('quiz')} />
          </div>
        </div>
      )}
    </div>
  );
});
