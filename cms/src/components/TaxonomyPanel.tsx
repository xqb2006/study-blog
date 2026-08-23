import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteCategory, getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { FeaturedCategoryItem, FeaturedSeriesItem, SiteSettings } from '@/types';
import { Field, inputClassName, Panel, textareaClassName } from './dashboard/Panel';
import { MediaPathField } from './MediaPathField';
import { ConfirmActionDialog } from './ConfirmActionDialog';

type CategoryMapRow = {
  name: string;
  slug: string;
};

const EMPTY_FEATURED_CATEGORY: FeaturedCategoryItem = {
  link: '',
  label: '',
  image: '',
  description: '',
};

const EMPTY_FEATURED_SERIES: FeaturedSeriesItem = {
  slug: '',
  categoryName: '',
  label: '',
  fullName: '',
  description: '',
  cover: '',
  enabled: true,
  icon: 'ri:newspaper-line',
  highlightOnHome: true,
  links: {},
};

function categoryMapToRows(categoryMap: SiteSettings['categoryMap']): CategoryMapRow[] {
  return Object.entries(categoryMap || {}).map(([name, slug]) => ({ name, slug }));
}

function rowsToCategoryMap(rows: CategoryMapRow[]): SiteSettings['categoryMap'] {
  return Object.fromEntries(rows.filter((row) => row.name.trim() && row.slug.trim()).map((row) => [row.name.trim(), row.slug.trim()]));
}

function cloneFeaturedCategories(value: FeaturedCategoryItem[]): FeaturedCategoryItem[] {
  return JSON.parse(JSON.stringify(value || [])) as FeaturedCategoryItem[];
}

function cloneFeaturedSeries(value: FeaturedSeriesItem[]): FeaturedSeriesItem[] {
  return JSON.parse(JSON.stringify(value || [])) as FeaturedSeriesItem[];
}

function linksToText(links?: Record<string, string>): string {
  return Object.entries(links || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function textToLinks(text: string): Record<string, string> | undefined {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex <= 0) return null;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      return key && value ? [key, value] : null;
    })
    .filter((entry): entry is [string, string] => Boolean(entry));

  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function TaxonomyPanel() {
  const [categoryRows, setCategoryRows] = useState<CategoryMapRow[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategoryItem[]>([]);
  const [featuredSeries, setFeaturedSeries] = useState<FeaturedSeriesItem[]>([]);
  const [seriesLinksText, setSeriesLinksText] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [categoryPendingDeletion, setCategoryPendingDeletion] = useState<CategoryMapRow | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isReloadConfirmOpen, setIsReloadConfirmOpen] = useState(false);

  const markDirty = () => {
    setIsDirty(true);
  };

  const notifyPendingDelete = (label: string) => {
    toast.info(`${label}已移除，点击“保存配置”后生效`);
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await getSiteSettings();
      setCategoryRows(categoryMapToRows(response.settings.categoryMap));
      setFeaturedCategories(cloneFeaturedCategories(response.settings.featuredCategories));
      const nextSeries = cloneFeaturedSeries(response.settings.featuredSeries);
      setFeaturedSeries(nextSeries);
      setSeriesLinksText(Object.fromEntries(nextSeries.map((series, index) => [index, linksToText(series.links)])));
      setIsDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取分类与系列配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const updateFeaturedCategory = (index: number, key: keyof FeaturedCategoryItem, value: string) => {
    markDirty();
    setFeaturedCategories((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const updateFeaturedSeries = (index: number, key: keyof FeaturedSeriesItem, value: string | boolean) => {
    markDirty();
    setFeaturedSeries((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const validate = (): boolean => {
    const invalidCategoryIndex = categoryRows.findIndex((row) => !row.name.trim() || !row.slug.trim());
    if (invalidCategoryIndex >= 0) {
      toast.error(`第 ${invalidCategoryIndex + 1} 个分类映射缺少分类名或 URL slug`);
      return false;
    }

    const invalidFeaturedCategoryIndex = featuredCategories.findIndex(
      (item) => !item.link.trim() || !item.label.trim() || !item.image.trim() || !item.description.trim(),
    );
    if (invalidFeaturedCategoryIndex >= 0) {
      toast.error(`第 ${invalidFeaturedCategoryIndex + 1} 个首页分类卡片缺少必填字段`);
      return false;
    }

    const invalidSeriesIndex = featuredSeries.findIndex((item) => !item.slug.trim() || !item.categoryName.trim());
    if (invalidSeriesIndex >= 0) {
      toast.error(`第 ${invalidSeriesIndex + 1} 个精选系列缺少 slug 或绑定分类`);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      categoryMap: rowsToCategoryMap(categoryRows),
      featuredCategories: featuredCategories.map((item) => ({
        link: item.link.trim(),
        label: item.label.trim(),
        image: item.image.trim(),
        description: item.description.trim(),
      })),
      featuredSeries: featuredSeries.map((item, index) => ({
        slug: item.slug.trim(),
        categoryName: item.categoryName.trim(),
        ...(item.label?.trim() ? { label: item.label.trim() } : {}),
        ...(item.fullName?.trim() ? { fullName: item.fullName.trim() } : {}),
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        ...(item.cover?.trim() ? { cover: item.cover.trim() } : {}),
        enabled: item.enabled !== false,
        ...(item.icon?.trim() ? { icon: item.icon.trim() } : {}),
        highlightOnHome: item.highlightOnHome !== false,
        ...(textToLinks(seriesLinksText[index] || '') ? { links: textToLinks(seriesLinksText[index] || '') } : {}),
      })),
    };

    setIsSaving(true);
    try {
      const response = await saveSiteSettings(payload);
      setCategoryRows(categoryMapToRows(response.settings.categoryMap));
      setFeaturedCategories(cloneFeaturedCategories(response.settings.featuredCategories));
      const nextSeries = cloneFeaturedSeries(response.settings.featuredSeries);
      setFeaturedSeries(nextSeries);
      setSeriesLinksText(Object.fromEntries(nextSeries.map((series, index) => [index, linksToText(series.links)])));
      setIsDirty(false);
      toast.success('分类与系列已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存分类与系列失败');
    } finally {
      setIsSaving(false);
    }
  };

  const requestReload = () => {
    if (isDirty) {
      setIsReloadConfirmOpen(true);
      return;
    }
    void loadSettings();
  };

  const handleDeleteCategory = async () => {
    if (!categoryPendingDeletion) return;
    setIsDeletingCategory(true);
    try {
      const result = await deleteCategory(categoryPendingDeletion.name);
      setCategoryPendingDeletion(null);
      await loadSettings();
      toast.success(`已删除“${result.categoryName}”：清理 ${result.updatedPostIds.length} 篇文章、${result.removedFeaturedCategories} 个首页卡片和 ${result.removedFeaturedSeries} 个系列入口。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除分类失败');
    } finally {
      setIsDeletingCategory(false);
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
          <h1 className="font-semibold text-2xl">分类花园</h1>
          <p className="mt-1 text-muted-foreground text-sm">管理分类 URL 映射、首页分类卡片和周刊/系列入口。</p>
          {isDirty && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 font-medium text-amber-700 text-xs">
              <AppIcon name="ri:error-warning-line" className="size-4" />
              有未保存修改，刷新前请先保存配置
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={requestReload} disabled={isSaving || isDeletingCategory}>
            <AppIcon name="ri:refresh-line" className="mr-1.5 size-4" />
            重新读取
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <AppIcon name={isSaving ? 'ri:loader-4-line' : 'ri:save-line'} className={isSaving ? 'mr-1.5 size-4 animate-spin' : 'mr-1.5 size-4'} />
            {isDirty ? '保存配置（未保存）' : '保存配置'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div>
            <p className="font-semibold text-xl">{categoryRows.length}</p>
            <p className="text-muted-foreground text-sm">分类映射</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{featuredCategories.length}</p>
            <p className="text-muted-foreground text-sm">首页分类卡片</p>
          </div>
        </Panel>
        <Panel>
          <div>
            <p className="font-semibold text-xl">{featuredSeries.length}</p>
            <p className="text-muted-foreground text-sm">精选系列</p>
          </div>
        </Panel>
      </div>

      <Panel
        title="分类 URL 映射"
        description="文章分类显示中文，URL 使用 slug；嵌套分类可继续使用 note/front-end 这种路径。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markDirty();
              setCategoryRows((current) => [...current, { name: '', slug: '' }]);
            }}
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加映射
          </Button>
        }
      >
        <div className="space-y-3">
          {categoryRows.map((row, index) => (
            <div key={`category-map-row-${index}`} className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={row.name}
                onChange={(event) => {
                  markDirty();
                  setCategoryRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)));
                }}
                placeholder="分类名，如 笔记"
                className={inputClassName}
              />
              <input
                value={row.slug}
                onChange={(event) => {
                  markDirty();
                  setCategoryRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, slug: event.target.value } : item)));
                }}
                placeholder="URL slug，如 note"
                className={inputClassName}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isDirty) {
                    toast.info('请先保存当前配置，或重新读取后再彻底删除分类。');
                    return;
                  }
                  setCategoryPendingDeletion(row);
                }}
                title="彻底删除分类及其文章引用"
              >
                <AppIcon name="ri:delete-bin-line" className="size-4" />
              </Button>
            </div>
          ))}
          {categoryRows.length === 0 && <p className="text-muted-foreground text-sm">暂无分类映射。</p>}
        </div>
      </Panel>

      <Panel
        title="首页精选分类"
        description="这些卡片显示在博客首页，用来引导访问常用分类。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markDirty();
              setFeaturedCategories((current) => [...current, { ...EMPTY_FEATURED_CATEGORY }]);
            }}
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加卡片
          </Button>
        }
      >
        <div className="space-y-4">
          {featuredCategories.map((item, index) => (
            <article key={`featured-category-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {item.image ? (
                    <img src={item.image} alt="" className="h-12 w-16 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-12 w-16 items-center justify-center rounded-md bg-muted">
                      <AppIcon name="ri:image-line" className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 font-medium">{item.label || `分类卡片 ${index + 1}`}</h2>
                    <p className="line-clamp-1 text-muted-foreground text-xs">{item.link || '未填写链接'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    markDirty();
                    setFeaturedCategories((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    notifyPendingDelete('首页分类卡片');
                  }}
                  title="删除卡片，保存后生效"
                >
                  <AppIcon name="ri:delete-bin-line" className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="分类链接">
                  <input value={item.link} onChange={(event) => updateFeaturedCategory(index, 'link', event.target.value)} placeholder="note/front-end" className={inputClassName} />
                </Field>
                <Field label="显示名称">
                  <input value={item.label} onChange={(event) => updateFeaturedCategory(index, 'label', event.target.value)} placeholder="前端" className={inputClassName} />
                </Field>
                <Field label="封面图片">
                  <MediaPathField
                    value={item.image}
                    onChange={(value) => updateFeaturedCategory(index, 'image', value)}
                    placeholder="/img/cover/1.webp"
                    dialogTitle="选择分类封面"
                  />
                </Field>
                <Field label="描述">
                  <input value={item.description} onChange={(event) => updateFeaturedCategory(index, 'description', event.target.value)} placeholder="前端技术相关" className={inputClassName} />
                </Field>
              </div>
            </article>
          ))}
          {featuredCategories.length === 0 && <p className="text-muted-foreground text-sm">暂无首页精选分类。</p>}
        </div>
      </Panel>

      <Panel
        title="精选系列"
        description="用于周刊、读书笔记等系列页面；保存后会进入发布同步。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markDirty();
              setFeaturedSeries((current) => [...current, { ...EMPTY_FEATURED_SERIES }]);
              setSeriesLinksText((current) => ({ ...current, [featuredSeries.length]: '' }));
            }}
          >
            <AppIcon name="ri:add-line" className="mr-1.5 size-4" />
            添加系列
          </Button>
        }
      >
        <div className="space-y-4">
          {featuredSeries.map((item, index) => (
            <article key={`featured-series-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">{item.fullName || item.label || item.slug || `系列 ${index + 1}`}</h2>
                  <p className="text-muted-foreground text-xs">{item.categoryName || '未绑定分类'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.enabled !== false}
                      onChange={(event) => updateFeaturedSeries(index, 'enabled', event.target.checked)}
                      className="size-4"
                    />
                    启用
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.highlightOnHome !== false}
                      onChange={(event) => updateFeaturedSeries(index, 'highlightOnHome', event.target.checked)}
                      className="size-4"
                    />
                    首页高亮
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      markDirty();
                      setFeaturedSeries((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      notifyPendingDelete('精选系列');
                    }}
                    title="删除系列，保存后生效"
                  >
                    <AppIcon name="ri:delete-bin-line" className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="URL slug">
                  <input value={item.slug} onChange={(event) => updateFeaturedSeries(index, 'slug', event.target.value)} placeholder="weekly" className={inputClassName} />
                </Field>
                <Field label="绑定分类">
                  <input value={item.categoryName} onChange={(event) => updateFeaturedSeries(index, 'categoryName', event.target.value)} placeholder="周刊" className={inputClassName} />
                </Field>
                <Field label="短名称">
                  <input value={item.label || ''} onChange={(event) => updateFeaturedSeries(index, 'label', event.target.value)} placeholder="我的周刊" className={inputClassName} />
                </Field>
                <Field label="完整名称">
                  <input value={item.fullName || ''} onChange={(event) => updateFeaturedSeries(index, 'fullName', event.target.value)} placeholder="我的技术周刊" className={inputClassName} />
                </Field>
                <Field label="封面图片">
                  <MediaPathField
                    value={item.cover || ''}
                    onChange={(value) => updateFeaturedSeries(index, 'cover', value)}
                    placeholder="/img/weekly_header.webp"
                    dialogTitle="选择系列封面"
                  />
                </Field>
                <Field label="导航图标">
                  <input value={item.icon || ''} onChange={(event) => updateFeaturedSeries(index, 'icon', event.target.value)} placeholder="ri:newspaper-line" className={inputClassName} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Field label="系列描述">
                  <textarea value={item.description || ''} onChange={(event) => updateFeaturedSeries(index, 'description', event.target.value)} rows={5} className={textareaClassName} />
                </Field>
                <Field label="相关链接" description="每行一个 key: value，例如 rss: /rss.xml。">
                  <textarea
                    value={seriesLinksText[index] || ''}
                    onChange={(event) => {
                      markDirty();
                      setSeriesLinksText((current) => ({ ...current, [index]: event.target.value }));
                    }}
                    rows={5}
                    className={textareaClassName}
                  />
                </Field>
              </div>
            </article>
          ))}
          {featuredSeries.length === 0 && <p className="text-muted-foreground text-sm">暂无精选系列。</p>}
        </div>
      </Panel>
      <ConfirmActionDialog
        open={Boolean(categoryPendingDeletion)}
        onOpenChange={(open) => {
          if (!open && !isDeletingCategory) setCategoryPendingDeletion(null);
        }}
        title={`彻底删除分类“${categoryPendingDeletion?.name || ''}”`}
        description="此操作会从所有使用该分类的文章中移除分类，同时删除 URL 映射、首页分类卡片和绑定该分类的系列入口。操作提交到 GitHub 后无法从后台恢复。"
        confirmLabel="彻底删除分类"
        pending={isDeletingCategory}
        destructive
        onConfirm={() => void handleDeleteCategory()}
      >
        <div className="border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
          请确认：这不是只删除网址映射，而是删除分类在文章和站点配置中的全部引用。
        </div>
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={isReloadConfirmOpen}
        onOpenChange={setIsReloadConfirmOpen}
        title="放弃未保存修改？"
        description="重新读取会恢复 GitHub 仓库中的配置，并丢弃当前页面尚未保存的修改。"
        confirmLabel="放弃并重新读取"
        onConfirm={() => {
          setIsReloadConfirmOpen(false);
          void loadSettings();
        }}
      />
    </div>
  );
}
